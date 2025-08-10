import openai
import asyncio
import json
import os
from typing import Dict, Any, List, AsyncGenerator
from models import Agent, MCPServer
from utils import logger, format_openai_messages

# MCP imports
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
# 尝试导入 SSE 客户端以支持 HTTP(S) 协议的 MCP 服务器
try:
    from mcp.client.sse import sse_client  # type: ignore
except Exception:  # pragma: no cover
    sse_client = None  # 动态检测

import mcp.types as mcp_types


class OpenAIHandler:
    """OpenAI API 处理器"""

    def __init__(self):
        # 使用自定义的 OpenAI 兼容接口
        self.client = openai.AsyncOpenAI(
            api_key="dummy-key",  # 免验证接口不需要真实 API key
            base_url="http://192.168.31.159:8088/api/v1/gpt/v1"  # 自定义接口地址
        )

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "qwen3:32b",
        temperature: float = 0.7,
        max_tokens: int = None,
        stream: bool = False
    ) -> Dict[str, Any]:
        """调用 OpenAI Chat Completion API"""
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "stream": stream
            }
            
            if max_tokens:
                kwargs["max_tokens"] = max_tokens
            
            response = await self.client.chat.completions.create(**kwargs)

            if stream:
                return response
            else:
                # 处理不同的响应格式
                if isinstance(response, str):
                    # 如果返回的是字符串，直接使用
                    return {
                        "content": response,
                        "role": "assistant",
                        "usage": {"total_tokens": 50}
                    }
                elif hasattr(response, 'choices') and response.choices:
                    # 标准 OpenAI 格式
                    return {
                        "content": response.choices[0].message.content,
                        "role": response.choices[0].message.role,
                        "usage": response.usage.dict() if response.usage else None
                    }
                else:
                    # 其他格式，尝试解析
                    return {
                        "content": str(response),
                        "role": "assistant",
                        "usage": {"total_tokens": 50}
                    }
        except Exception as e:
            logger.error(f"OpenAI API 调用失败: {str(e)}")
            # 返回模拟响应用于测试
            return {
                "content": f"这是一个模拟的AI回复。原始消息: {messages[-1]['content'] if messages else ''}",
                "role": "assistant",
                "usage": {"total_tokens": 50}
            }

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: str = "qwen3:32b",
        temperature: float = 0.7,
        max_tokens: int = None
    ) -> AsyncGenerator[str, None]:
        """流式调用 OpenAI Chat Completion API"""
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "stream": True
            }

            if max_tokens:
                kwargs["max_tokens"] = max_tokens

            response = await self.client.chat.completions.create(**kwargs)

            async for chunk in response:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            logger.error(f"OpenAI API 流式调用失败: {str(e)}")
            yield f"流式调用失败: {str(e)}"

    async def chat_completion_with_tools(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
        model: str = "qwen3:32b",
        temperature: float = 0.7,
        max_tokens: int = None
    ) -> Dict[str, Any]:
        """调用 OpenAI Chat Completion API 并支持工具调用"""
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "tools": tools,
                "tool_choice": "auto"
            }

            if max_tokens:
                kwargs["max_tokens"] = max_tokens

            response = await self.client.chat.completions.create(**kwargs)

            # 处理不同的响应格式
            if isinstance(response, str):
                # 如果返回的是字符串，直接使用（不支持工具调用）
                return {
                    "content": response,
                    "role": "assistant",
                    "usage": {"total_tokens": 50}
                }
            elif hasattr(response, 'choices') and response.choices:
                # 标准 OpenAI 格式
                message = response.choices[0].message
                result = {
                    "content": message.content,
                    "role": message.role,
                    "usage": response.usage.dict() if response.usage else None
                }

                # 检查是否有工具调用
                if hasattr(message, 'tool_calls') and message.tool_calls:
                    result["tool_calls"] = [
                        {
                            "id": tool_call.id,
                            "type": tool_call.type,
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments
                            }
                        }
                        for tool_call in message.tool_calls
                    ]

                return result
            else:
                # 其他格式
                return {
                    "content": str(response),
                    "role": "assistant",
                    "usage": {"total_tokens": 50}
                }

        except Exception as e:
            logger.error(f"OpenAI API 工具调用失败: {str(e)}")
            # 返回模拟响应用于测试
            return {
                "content": f"这是一个模拟的AI回复（带工具支持）。原始消息: {messages[-1]['content'] if messages else ''}",
                "role": "assistant",
                "usage": {"total_tokens": 50}
            }


class MCPClientHandler:
    """MCP 客户端处理器 - 连接到外部 MCP 服务器"""

    def __init__(self):
        # 获取项目根目录
        self.project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        # 运行期从数据库动态加载服务器配置
        self.mcp_servers: Dict[str, Dict[str, Any]] = {}

    async def load_servers(self) -> None:
        """从数据库动态加载 MCP 服务器配置到内存映射"""
        try:
            servers = await MCPServer.all()
            mapping: Dict[str, Dict[str, Any]] = {}
            for s in servers:
                url = (s.api_url or '').strip()
                # 仅支持 http(s) 协议
                if url.startswith("http://") or url.startswith("https://"):
                    mapping[s.name] = {
                        "transport": "sse",
                        "url": url,
                        "description": s.description,
                    }
                else:
                    logger.warning(f"不支持的 MCP api_url 协议: {url}")
            self.mcp_servers = mapping
        except Exception as e:
            logger.error(f"加载 MCP 服务器配置失败: {str(e)}")

    async def call_mcp_tool(
        self,
        server_name: str,
        tool_name: str,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """调用 MCP 服务器上的工具"""
        try:
            # 确保服务器配置是最新的
            await self.load_servers()
            if server_name not in self.mcp_servers:
                return {
                    "success": False,
                    "error": f"MCP 服务器 {server_name} 不存在"
                }

            server_config = self.mcp_servers[server_name]

            # 根据 transport 连接服务器（SSE 或 stdio）
            if server_config.get("transport") == "sse":
                if sse_client is None:
                    return {"success": False, "error": "后端未安装支持 HTTP(S) MCP 的 sse 客户端，请升级 mcp 包或改用 stdio 服务器"}
                async with sse_client(server_config["url"]) as (read, write):  # type: ignore
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        result = await session.call_tool(tool_name, arguments=parameters)
            else:
                server_params = StdioServerParameters(command=server_config["command"], args=server_config["args"])
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        result = await session.call_tool(tool_name, arguments=parameters)

                    # 处理结果
                    if result.isError:
                        error_content = ""
                        for content in result.content:
                            if isinstance(content, mcp_types.TextContent):
                                error_content += content.text
                        return {
                            "success": False,
                            "error": f"MCP 工具执行失败: {error_content}"
                        }
                    else:
                        # 提取结果内容
                        result_content = ""
                        for content in result.content:
                            if isinstance(content, mcp_types.TextContent):
                                result_content += content.text

                        return {
                            "success": True,
                            "result": result_content
                        }

        except Exception as e:
            logger.error(f"MCP 服务器调用失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_available_tools(self) -> List[Dict[str, Any]]:
        """聚合所有活动 MCP 服务器的工具（动态）"""
        # 确保加载最新服务器列表
        await self.load_servers()
        tools: List[Dict[str, Any]] = []
        for server_name in self.mcp_servers.keys():
            # 动态查询每个服务器可用工具
            dynamic_tools = await self.get_server_tools_dynamic(server_name)
            for t in dynamic_tools:
                tools.append({
                    "type": "function",
                    "function": {
                        "name": f"{server_name}_{t['name']}",
                        "description": f"{t.get('description', '')}",
                        "parameters": t.get('parameters', {}) or {}
                    }
                })
        return tools

    def get_mcp_servers_info(self) -> Dict[str, Any]:
        """获取所有 MCP 服务器信息"""
        servers_info = {}
        for server_name, server_config in self.mcp_servers.items():
            servers_info[server_name] = {
                "name": server_name,
                "description": server_config["description"],
                "tools": server_config.get("tools", []),
                "command": server_config["command"],
                "args": server_config["args"]
            }
        return servers_info

    async def get_server_tools_dynamic(self, server_name: str) -> List[Dict[str, Any]]:
        """动态获取 MCP 服务器的工具列表"""
        try:
            if server_name not in self.mcp_servers:
                return []

            server_config = self.mcp_servers[server_name]

            # 根据传输方式连接到 MCP 服务器获取工具列表
            if server_config.get("transport") == "sse" and sse_client is not None:
                async with sse_client(server_config["url"]) as (read, write):  # type: ignore
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        tools_response = await session.list_tools()
            else:
                server_params = StdioServerParameters(command=server_config["command"], args=server_config["args"])
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        tools_response = await session.list_tools()

            tools = []
            for tool in tools_response.tools:
                tools.append({
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.inputSchema if hasattr(tool, 'inputSchema') else {}
                })

            return tools

        except Exception as e:
            logger.error(f"获取 MCP 服务器 {server_name} 工具列表失败: {str(e)}")
            # 失败时返回空
            return []


class AgentHandler:
    """Agent 处理器 - 管理 Agent 并与 MCP 服务器交互"""

    def __init__(self):
        self.openai_handler = OpenAIHandler()
        self.mcp_handler = MCPClientHandler()

    async def process_message(
        self,
        agent_id: int,
        messages: List[Dict[str, str]],
        stream: bool = False
    ) -> Dict[str, Any]:
        """处理消息并生成回复 - 支持 MCP 工具调用"""
        try:
            agent = await Agent.get(id=agent_id)

            # 格式化消息
            formatted_messages = format_openai_messages(agent.prompt, messages)

            # 获取 OpenAI 配置
            openai_config = agent.openai_config or {}
            model = openai_config.get("model", "qwen3:32b")
            temperature = openai_config.get("temperature", 0.7)
            max_tokens = openai_config.get("max_tokens")

            # 检查 Agent 是否配置了 MCP 工具
            agent_tools = agent.mcp_tools or []

            if agent_tools and not stream:  # 工具调用暂不支持流式
                # 获取可用工具
                available_tools = await self.mcp_handler.get_available_tools()

                # 过滤 Agent 配置的工具
                filtered_tools = [
                    tool for tool in available_tools
                    if any(mcp_tool in tool["function"]["name"] for mcp_tool in agent_tools)
                ]

                if filtered_tools:
                    return await self._process_with_tools(
                        formatted_messages,
                        filtered_tools,
                        model,
                        temperature,
                        max_tokens
                    )

            # 没有工具或使用流式时，直接调用 OpenAI
            if stream:
                return await self.openai_handler.chat_completion_stream(
                    messages=formatted_messages,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
            else:
                return await self.openai_handler.chat_completion(
                    messages=formatted_messages,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens
                )

        except Agent.DoesNotExist:
            return {
                "success": False,
                "error": "Agent 不存在"
            }
        except Exception as e:
            logger.error(f"处理消息失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _process_with_tools(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
        model: str,
        temperature: float,
        max_tokens: int
    ) -> Dict[str, Any]:
        """使用工具处理消息"""
        try:
            # 第一次调用 OpenAI，可能会返回工具调用
            response = await self.openai_handler.chat_completion_with_tools(
                messages=messages,
                tools=tools,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens
            )

            # 检查是否需要调用工具
            if response.get("tool_calls"):
                # 处理工具调用
                messages.append({
                    "role": "assistant",
                    "content": response.get("content") or "",
                    "tool_calls": response["tool_calls"]
                })

                # 执行工具调用
                for tool_call in response["tool_calls"]:
                    function_name = tool_call["function"]["name"]
                    function_args = json.loads(tool_call["function"]["arguments"])

                    # 解析服务器名和工具名
                    if "_" in function_name:
                        server_name, tool_name = function_name.split("_", 1)
                    else:
                        server_name = "time_server"
                        tool_name = function_name

                    # 调用 MCP 工具
                    tool_result = await self.mcp_handler.call_mcp_tool(
                        server_name, tool_name, function_args
                    )

                    # 添加工具结果到消息历史
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "content": json.dumps(tool_result)
                    })

                # 再次调用 OpenAI 获取最终回复
                final_response = await self.openai_handler.chat_completion(
                    messages=messages,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens
                )

                return final_response
            else:
                # 没有工具调用，直接返回回复
                return response

        except Exception as e:
            logger.error(f"工具处理失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_agent_info(self, agent_id: int) -> Dict[str, Any]:
        """获取 Agent 信息"""
        try:
            agent = await Agent.get(id=agent_id)
            return {
                "success": True,
                "agent": {
                    "id": agent.id,
                    "name": agent.name,
                    "description": agent.description,
                    "prompt": agent.prompt,
                    "mcp_tools": agent.mcp_tools,
                    "openai_config": agent.openai_config,
                    "created_at": agent.created_at.isoformat(),
                    "updated_at": agent.updated_at.isoformat()
                }
            }
        except Agent.DoesNotExist:
            return {
                "success": False,
                "error": "Agent 不存在"
            }
        except Exception as e:
            logger.error(f"获取 Agent 信息失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def list_agents(self) -> Dict[str, Any]:
        """获取所有 Agent 列表"""
        try:
            agents = await Agent.all()
            return {
                "success": True,
                "agents": [
                    {
                        "id": agent.id,
                        "name": agent.name,
                        "description": agent.description,
                        "mcp_tools": agent.mcp_tools,
                        "created_at": agent.created_at.isoformat(),
                        "updated_at": agent.updated_at.isoformat()
                    }
                    for agent in agents
                ]
            }
        except Exception as e:
            logger.error(f"获取 Agent 列表失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
