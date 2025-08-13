import httpx
import asyncio
import json
import os
import re
from typing import Dict, Any, List, AsyncGenerator
from models import Agent, MCPServer
from utils import logger, format_openai_messages

# MCP imports
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
# 优先导入 Streamable HTTP 客户端（HTTP 传输推荐）
try:
    from mcp.client.streamable_http import streamablehttp_client as http_stream_client  # type: ignore
except Exception:
    http_stream_client = None
# 兼容：SSE 客户端（不推荐，保底）
try:
    from mcp.client.sse import sse_client  # type: ignore
except Exception:
    sse_client = None

import mcp.types as mcp_types


class OpenAIHandler:
    """OpenAI API 处理器"""

    def __init__(self):
        # 使用环境变量或默认的 OpenAI 兼容接口
        self.base_url = os.getenv("OPENAI_BASE_URL", "http://192.168.31.159:8088/api/v1/gpt/v1")
        self.api_key = os.getenv("OPENAI_API_KEY", "dummy-key")

        self.client = httpx.AsyncClient(
            timeout=120,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
        )

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "qwen3:32b",
        max_tokens: int = None,
        stream: bool = False
    ) -> Dict[str, Any]:
        """调用 OpenAI Chat Completion API"""
        try:
            payload = {
                "model": model,
                "messages": messages,
                "stream": stream
            }

            if max_tokens:
                payload["max_tokens"] = max_tokens

            response = await self.client.post(
                f"{self.base_url}/chat/completions",
                json=payload
            )

            if response.status_code != 200:
                raise Exception(f"API 请求失败: {response.status_code} {response.text}")

            data = response.json()

            if stream:
                return data
            else:
                # 处理标准 OpenAI 格式
                if "choices" in data and data["choices"]:
                    choice = data["choices"][0]
                    message = choice.get("message", {})
                    return {
                        "content": message.get("content", ""),
                        "role": message.get("role", "assistant"),
                        "usage": data.get("usage", {"total_tokens": 50})
                    }
                else:
                    return {
                        "content": str(data),
                        "role": "assistant",
                        "usage": {"total_tokens": 50}
                    }
        except Exception as e:
            logger.error(f"OpenAI API 调用失败: {str(e)}")
            # 返回模拟响应，避免因外部服务不可用导致整个系统无法使用
            return {
                "content": f"API 调用失败",
                "role": "assistant",
                "usage": {"total_tokens": 50}
            }

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: str = "qwen3:32b",
        max_tokens: int = None
    ) -> AsyncGenerator[str, None]:
        """流式调用 OpenAI Chat Completion API"""
        try:
            payload = {
                "model": model,
                "messages": messages,
                "stream": True
            }

            if max_tokens:
                payload["max_tokens"] = max_tokens

            async with self.client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                json=payload
            ) as response:
                if response.status_code != 200:
                    raise Exception(f"API 请求失败: {response.status_code}")

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue

                    if line.startswith("data: "):
                        data_str = line[6:]  # 去掉 "data: " 前缀

                        if data_str.strip() == "[DONE]":
                            break

                        try:
                            chunk_data = json.loads(data_str)
                            choices = chunk_data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            # 如果不是 JSON，跳过这行
                            continue

        except Exception as e:
            logger.error(f"OpenAI API 流式调用失败: {str(e)}")
            # 返回模拟的流式响应
            mock_response = f"API 调用失败"
            for char in mock_response:
                yield char

    async def chat_completion_with_tools(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
        model: str = "qwen3:32b",
        max_tokens: int = None
    ) -> Dict[str, Any]:
        """调用 OpenAI Chat Completion API 并支持工具调用"""
        try:
            payload = {
                "model": model,
                "messages": messages,
                "tools": tools,
                "tool_choice": "auto"
            }

            if max_tokens:
                payload["max_tokens"] = max_tokens

            response = await self.client.post(
                f"{self.base_url}/chat/completions",
                json=payload
            )

            if response.status_code != 200:
                raise Exception(f"API 请求失败: {response.status_code} {response.text}")

            # 安全解析响应
            try:
                data = response.json()
            except Exception as json_error:
                logger.error(f"JSON 解析失败: {json_error}, 原始响应: {response.text[:500]}")
                # 尝试从文本中提取工具调用信息
                return self._parse_non_json_response(response.text, messages)

            # 处理标准 OpenAI 格式
            if "choices" in data and data["choices"]:
                choice = data["choices"][0]
                message = choice.get("message", {})
                result = {
                    "content": message.get("content", ""),
                    "role": message.get("role", "assistant"),
                    "usage": data.get("usage", {"total_tokens": 50})
                }

                # 检查是否有工具调用
                if "tool_calls" in message and message["tool_calls"]:
                    result["tool_calls"] = message["tool_calls"]

                return result
            else:
                # 非标准格式，尝试解析
                return self._parse_alternative_format(data, messages)

        except Exception as e:
            logger.error(f"OpenAI API 工具调用失败: {str(e)}")
            # 返回模拟响应，避免因外部服务不可用导致整个系统无法使用
            return {
                "content": f"模拟AI回复（带工具支持）：{messages[-1]['content'] if messages else '你好'}",
                "role": "assistant",
                "usage": {"total_tokens": 50}
            }

    def _parse_non_json_response(self, text: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """解析非 JSON 格式的响应，尝试提取工具调用信息"""
        import re

        # 检查是否包含时间相关的关键词，如果有则生成工具调用
        time_keywords = ["时间", "几点", "现在", "当前时间", "time", "clock"]
        user_message = messages[-1].get("content", "").lower() if messages else ""

        should_call_time_tool = any(keyword in user_message for keyword in time_keywords)

        tool_calls = []
        content = text

        if should_call_time_tool and "无法" not in text and "不能" not in text:
            # 生成时间工具调用
            tool_calls.append({
                "id": "call_time_1",
                "type": "function",
                "function": {
                    "name": "time_http_get_current_time",
                    "arguments": "{}"
                }
            })

            # 修改内容，表示正在调用工具
            content = "我来为您查询当前时间。"

        result = {
            "content": content,
            "role": "assistant",
            "usage": {"total_tokens": 50}
        }

        if tool_calls:
            result["tool_calls"] = tool_calls

        return result

    def _parse_alternative_format(self, data: Dict[str, Any], messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """解析非标准格式的 JSON 响应"""
        # 尝试不同的响应格式
        content = ""
        tool_calls = []

        # 格式1：直接在根级别有 content
        if "content" in data:
            content = str(data["content"])
        elif "text" in data:
            content = str(data["text"])
        elif "response" in data:
            content = str(data["response"])
        else:
            content = str(data)

        # 格式2：检查是否有工具调用字段
        for key in ["tool_calls", "tools", "function_calls", "functions"]:
            if key in data and data[key]:
                try:
                    raw_calls = data[key]
                    if isinstance(raw_calls, list):
                        for i, call in enumerate(raw_calls):
                            if isinstance(call, dict):
                                # 标准化工具调用格式
                                tool_call = {
                                    "id": call.get("id", f"call_{i}"),
                                    "type": "function",
                                    "function": {
                                        "name": call.get("name", call.get("function", {}).get("name", "")),
                                        "arguments": json.dumps(call.get("arguments", call.get("parameters", {})))
                                    }
                                }
                                tool_calls.append(tool_call)
                except Exception as e:
                    logger.error(f"解析工具调用失败: {e}")

        result = {
            "content": content,
            "role": "assistant",
            "usage": {"total_tokens": 50}
        }

        if tool_calls:
            result["tool_calls"] = tool_calls

        return result


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
                        "transport": "http" if http_stream_client is not None else "sse",
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
            if server_config.get("transport") == "http":
                if http_stream_client is None:
                    return {"success": False, "error": "后端未安装支持 HTTP MCP 的 http 客户端，请升级 mcp 包"}
                async with http_stream_client(server_config["url"]) as (read, write, _get_sid):  # type: ignore
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        result = await session.call_tool(tool_name, arguments=parameters)
            elif server_config.get("transport") == "sse":
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
            # 确保使用最新的服务器映射
            await self.load_servers()
            if server_name not in self.mcp_servers:
                return []

            server_config = self.mcp_servers[server_name]

            # 根据传输方式连接到 MCP 服务器获取工具列表
            if server_config.get("transport") == "http" and http_stream_client is not None:
                async with http_stream_client(server_config["url"]) as (read, write, _get_sid):  # type: ignore
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        tools_response = await session.list_tools()
            elif server_config.get("transport") == "sse" and sse_client is not None:
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
                        max_tokens
                    )

            # 没有工具或使用流式时，直接调用 OpenAI
            if stream:
                return await self.openai_handler.chat_completion_stream(
                    messages=formatted_messages,
                    model=model,
                    max_tokens=max_tokens
                )
            else:
                return await self.openai_handler.chat_completion(
                    messages=formatted_messages,
                    model=model,
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

    async def process_message_stream(
        self,
        agent_id: int,
        messages: List[Dict[str, str]],
    ) -> AsyncGenerator[str, None]:
        """处理消息并以流式方式返回回复，先进行 MCP 工具调用（如需要），再流式输出最终回复"""
        try:
            agent = await Agent.get(id=agent_id)

            # 格式化消息
            formatted_messages = format_openai_messages(agent.prompt, messages)

            # OpenAI 配置
            openai_config = agent.openai_config or {}
            model = openai_config.get("model", "qwen3:32b")
            max_tokens = openai_config.get("max_tokens")

            agent_tools = agent.mcp_tools or []

            if agent_tools:
                available_tools = await self.mcp_handler.get_available_tools()
                filtered_tools = [
                    tool for tool in available_tools
                    if any(mcp_tool in tool["function"]["name"] for mcp_tool in agent_tools)
                ]
                if filtered_tools:
                    # 输出工具准备信息
                    yield f"<mcp>🔧 准备调用 MCP 工具：{', '.join([tool['function']['name'] for tool in filtered_tools])}</mcp>\n\n"

                    # 第一次调用，获取工具调用
                    first = await self.openai_handler.chat_completion_with_tools(
                        messages=formatted_messages,
                        tools=filtered_tools,
                        model=model,
                        max_tokens=max_tokens,
                    )
                    if first.get("tool_calls"):
                        yield f"<mcp>🎯 AI 决定调用 {len(first['tool_calls'])} 个工具</mcp>\n\n"

                        # 将工具调用与结果加入消息
                        messages_with_tools = list(formatted_messages)
                        messages_with_tools.append({
                            "role": "assistant",
                            "content": first.get("content") or "",
                            "tool_calls": first["tool_calls"],
                        })
                        for tool_call in first["tool_calls"]:
                            function_name = tool_call["function"]["name"]

                            # 安全解析 JSON 参数
                            try:
                                args_str = tool_call["function"]["arguments"]
                                if args_str and args_str.strip():
                                    function_args = json.loads(args_str)
                                else:
                                    function_args = {}
                            except (json.JSONDecodeError, KeyError) as e:
                                logger.error(f"解析工具参数失败: {e}, 原始参数: {tool_call.get('function', {}).get('arguments', 'N/A')}")
                                function_args = {}

                            # 输出工具调用详情
                            yield f"<mcp>📞 调用工具: {function_name}</mcp>\n"
                            yield f"<mcp>📝 参数: {json.dumps(function_args, ensure_ascii=False)}</mcp>\n\n"

                            # 解析服务器名和工具名
                            if function_name.startswith("time_http_"):
                                server_name = "time_http"
                                tool_name = function_name[10:]  # 移除 "time_http_" 前缀
                            elif "_" in function_name:
                                server_name, tool_name = function_name.split("_", 1)
                            else:
                                server_name = "time_http"  # 默认使用 time_http 服务器
                                tool_name = function_name
                            tool_result = await self.mcp_handler.call_mcp_tool(
                                server_name, tool_name, function_args
                            )

                            # 输出工具结果
                            yield f"<mcp>✅ 工具返回: {json.dumps(tool_result, ensure_ascii=False)}</mcp>\n\n"

                            messages_with_tools.append({
                                "role": "tool",
                                "tool_call_id": tool_call["id"],
                                "content": json.dumps(tool_result),
                            })
                        # 输出最终回复提示
                        yield f"<mcp>🤖 基于工具结果生成最终回复...</mcp>\n\n"

                        # 最终流式输出
                        async for chunk in self.openai_handler.chat_completion_stream(
                            messages=messages_with_tools,
                            model=model,
                            max_tokens=max_tokens,
                        ):
                            yield chunk
                        return

            # 无工具或无工具调用，直接流式输出
            async for chunk in self.openai_handler.chat_completion_stream(
                messages=formatted_messages,
                model=model,
                max_tokens=max_tokens,
            ):
                yield chunk
        except Exception as e:
            logger.error(f"流式处理消息失败: {str(e)}")
            # 去掉兜底的模拟返回，直接抛出错误，便于上层捕获并返回真实错误
            raise

    async def _process_with_tools(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
        model: str,
        max_tokens: int
    ) -> Dict[str, Any]:
        """使用工具处理消息"""
        try:
            # 第一次调用 OpenAI，可能会返回工具调用
            response = await self.openai_handler.chat_completion_with_tools(
                messages=messages,
                tools=tools,
                model=model,
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

                    # 安全解析 JSON 参数
                    try:
                        args_str = tool_call["function"]["arguments"]
                        if args_str and args_str.strip():
                            function_args = json.loads(args_str)
                        else:
                            function_args = {}
                    except (json.JSONDecodeError, KeyError) as e:
                        logger.error(f"解析工具参数失败: {e}, 原始参数: {tool_call.get('function', {}).get('arguments', 'N/A')}")
                        function_args = {}

                    # 解析服务器名和工具名
                    if function_name.startswith("time_http_"):
                        server_name = "time_http"
                        tool_name = function_name[10:]  # 移除 "time_http_" 前缀
                    elif "_" in function_name:
                        server_name, tool_name = function_name.split("_", 1)
                    else:
                        server_name = "time_http"  # 默认使用 time_http 服务器
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
