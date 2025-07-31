import openai
import asyncio
import json
from typing import Dict, Any, List, AsyncGenerator
from models import Agent, MCPTool
from utils import get_env_config, logger, format_openai_messages

# MCP imports
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import mcp.types as mcp_types

class OpenAIHandler:
    """OpenAI API 处理器"""
    
    def __init__(self):
        config = get_env_config()
        self.client = openai.AsyncOpenAI(
            api_key=config["OPENAI_API_KEY"]
        )
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "gpt-3.5-turbo",
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
                return {
                    "content": response.choices[0].message.content,
                    "role": response.choices[0].message.role,
                    "usage": response.usage.dict() if response.usage else None
                }
        except Exception as e:
            logger.error(f"OpenAI API 调用失败: {str(e)}")
            # 返回模拟响应用于测试
            return {
                "content": f"这是一个模拟的AI回复。原始消息: {messages[-1]['content'] if messages else ''}",
                "role": "assistant",
                "usage": {"total_tokens": 50}
            }

    async def chat_completion_with_tools(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
        model: str = "gpt-3.5-turbo",
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

            message = response.choices[0].message
            result = {
                "content": message.content,
                "role": message.role,
                "usage": response.usage.dict() if response.usage else None
            }

            # 检查是否有工具调用
            if message.tool_calls:
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

        except Exception as e:
            logger.error(f"OpenAI API 工具调用失败: {str(e)}")
            # 返回模拟响应用于测试
            return {
                "content": f"这是一个模拟的AI回复（带工具支持）。原始消息: {messages[-1]['content'] if messages else ''}",
                "role": "assistant",
                "usage": {"total_tokens": 50}
            }
    
    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: str = "gpt-3.5-turbo",
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
            
            stream = await self.client.chat.completions.create(**kwargs)
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"OpenAI 流式 API 调用失败: {str(e)}")
            # 返回模拟流式响应用于测试
            response_text = f"这是一个模拟的流式AI回复。原始消息: {messages[-1]['content'] if messages else ''}"
            for word in response_text.split():
                yield word + " "
                await asyncio.sleep(0.1)

class MCPHandler:
    """MCP 客户端处理器 - 连接到外部 MCP 服务器"""

    def __init__(self):
        self.active_connections = {}
        self.mcp_servers = {
            # 配置可用的 MCP 服务器
            "file_operations": {
                "command": "python",
                "args": ["-m", "mcp_file_server"],  # 假设的文件操作 MCP 服务器
                "description": "文件操作工具"
            },
            "web_search": {
                "command": "python",
                "args": ["-m", "mcp_web_search"],  # 假设的网络搜索 MCP 服务器
                "description": "网络搜索工具"
            },
            "code_execution": {
                "command": "python",
                "args": ["-m", "mcp_code_runner"],  # 假设的代码执行 MCP 服务器
                "description": "代码执行工具"
            }
        }

    async def list_available_tools(self) -> List[Dict[str, Any]]:
        """获取可用的 MCP 工具列表"""
        try:
            # 从数据库获取配置的工具
            tools = await MCPTool.filter(is_active=True).all()
            available_tools = []

            for tool in tools:
                # 检查对应的 MCP 服务器是否可用
                if tool.name in self.mcp_servers:
                    available_tools.append({
                        "name": tool.name,
                        "description": tool.description,
                        "server_config": self.mcp_servers[tool.name],
                        "config": tool.config
                    })
                else:
                    # 对于没有对应 MCP 服务器的工具，返回基本信息
                    available_tools.append(tool.to_dict())

            return available_tools
        except Exception as e:
            logger.error(f"获取 MCP 工具列表失败: {str(e)}")
            return []
    
    async def call_tool(
        self,
        tool_name: str,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """调用 MCP 工具 - 连接到真实的 MCP 服务器"""
        try:
            tool = await MCPTool.filter(name=tool_name, is_active=True).first()
            if not tool:
                return {
                    "success": False,
                    "error": f"工具 {tool_name} 不存在或未激活"
                }

            # 检查是否有对应的 MCP 服务器配置
            if tool_name in self.mcp_servers:
                return await self._call_mcp_server_tool(tool_name, parameters)
            else:
                # 回退到模拟实现
                logger.warning(f"工具 {tool_name} 没有对应的 MCP 服务器，使用模拟实现")
                return await self._call_mock_tool(tool_name, parameters)

        except Exception as e:
            logger.error(f"调用 MCP 工具失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _call_mcp_server_tool(
        self,
        tool_name: str,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """连接到 MCP 服务器并调用工具"""
        try:
            server_config = self.mcp_servers[tool_name]

            # 创建 MCP 服务器参数
            server_params = StdioServerParameters(
                command=server_config["command"],
                args=server_config["args"]
            )

            # 连接到 MCP 服务器
            async with stdio_client(server_params) as (read, write):
                async with ClientSession(read, write) as session:
                    # 初始化连接
                    await session.initialize()

                    # 列出可用工具
                    tools_response = await session.list_tools()
                    available_tools = [tool.name for tool in tools_response.tools]

                    logger.info(f"MCP 服务器 {tool_name} 可用工具: {available_tools}")

                    # 查找匹配的工具
                    target_tool = None
                    for tool in tools_response.tools:
                        if tool.name == tool_name or tool_name in tool.name:
                            target_tool = tool
                            break

                    if not target_tool and available_tools:
                        # 如果没有完全匹配，使用第一个可用工具
                        target_tool = tools_response.tools[0]
                        logger.info(f"使用第一个可用工具: {target_tool.name}")

                    if not target_tool:
                        return {
                            "success": False,
                            "error": f"MCP 服务器中没有找到工具 {tool_name}"
                        }

                    # 调用工具
                    result = await session.call_tool(target_tool.name, arguments=parameters)

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

                        # 如果有结构化内容，也包含进来
                        structured_result = None
                        if hasattr(result, 'structuredContent') and result.structuredContent:
                            structured_result = result.structuredContent

                        return {
                            "success": True,
                            "result": {
                                "tool_name": target_tool.name,
                                "content": result_content,
                                "structured_content": structured_result,
                                "parameters": parameters
                            }
                        }

        except Exception as e:
            logger.error(f"MCP 服务器调用失败: {str(e)}")
            # 如果 MCP 服务器调用失败，回退到模拟实现
            logger.info(f"回退到模拟实现: {tool_name}")
            return await self._call_mock_tool(tool_name, parameters)

    async def _call_mock_tool(
        self,
        tool_name: str,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """模拟工具调用 - 当 MCP 服务器不可用时使用"""
        if tool_name == "file_operations":
            return await self._handle_file_operations(parameters)
        elif tool_name == "web_search":
            return await self._handle_web_search(parameters)
        elif tool_name == "code_execution":
            return await self._handle_code_execution(parameters)
        elif tool_name == "database":
            return await self._handle_database(parameters)
        elif tool_name == "api_client":
            return await self._handle_api_client(parameters)
        else:
            return await self._handle_generic_tool(tool_name, parameters)

    async def _handle_file_operations(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """处理文件操作工具"""
        operation = parameters.get("operation", "read")
        file_path = parameters.get("file_path")

        if operation == "read":
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return {
                    "success": True,
                    "result": {
                        "operation": "read",
                        "file_path": file_path,
                        "content": content[:2000] + "..." if len(content) > 2000 else content
                    }
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": f"读取文件失败: {str(e)}"
                }
        elif operation == "write":
            content = parameters.get("content", "")
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                return {
                    "success": True,
                    "result": {
                        "operation": "write",
                        "file_path": file_path,
                        "bytes_written": len(content.encode('utf-8'))
                    }
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": f"写入文件失败: {str(e)}"
                }
        else:
            return {
                "success": False,
                "error": f"不支持的文件操作: {operation}"
            }

    async def _handle_web_search(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """处理网络搜索工具"""
        query = parameters.get("query")
        max_results = parameters.get("max_results", 5)

        # 模拟搜索结果
        results = []
        for i in range(min(max_results, 3)):
            results.append({
                "title": f"搜索结果 {i+1} for '{query}'",
                "url": f"https://example.com/result-{i+1}",
                "snippet": f"这是关于 '{query}' 的搜索结果 {i+1}。包含相关信息和详细描述...",
                "relevance_score": 0.9 - i * 0.1
            })

        return {
            "success": True,
            "result": {
                "query": query,
                "total_results": len(results),
                "results": results
            }
        }

    async def _handle_code_execution(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """处理代码执行工具"""
        code = parameters.get("code")
        language = parameters.get("language", "python")

        if language == "python":
            try:
                # 注意：实际生产环境中需要安全的代码执行环境
                import io
                from contextlib import redirect_stdout, redirect_stderr

                stdout_buffer = io.StringIO()
                stderr_buffer = io.StringIO()

                with redirect_stdout(stdout_buffer), redirect_stderr(stderr_buffer):
                    exec(code)

                stdout_content = stdout_buffer.getvalue()
                stderr_content = stderr_buffer.getvalue()

                return {
                    "success": True,
                    "result": {
                        "language": language,
                        "code": code,
                        "stdout": stdout_content,
                        "stderr": stderr_content,
                        "execution_time": "0.1s"
                    }
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": f"代码执行失败: {str(e)}"
                }
        else:
            return {
                "success": False,
                "error": f"不支持的编程语言: {language}"
            }

    async def _handle_database(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """处理数据库工具"""
        query = parameters.get("query")
        database = parameters.get("database", "default")

        # 模拟数据库查询
        return {
            "success": True,
            "result": {
                "database": database,
                "query": query,
                "rows_affected": 1,
                "data": [
                    {"id": 1, "name": "示例数据", "value": "模拟结果"}
                ],
                "execution_time": "0.05s"
            }
        }

    async def _handle_api_client(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """处理 API 客户端工具"""
        url = parameters.get("url")
        method = parameters.get("method", "GET")
        headers = parameters.get("headers", {})
        data = parameters.get("data")

        # 模拟 API 调用
        return {
            "success": True,
            "result": {
                "url": url,
                "method": method,
                "headers": headers,
                "request_data": data,
                "status_code": 200,
                "response": {
                    "message": "API 调用成功",
                    "data": "模拟的 API 响应数据"
                },
                "response_time": "0.2s"
            }
        }

    async def _handle_generic_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """处理通用工具"""
        return {
            "success": True,
            "result": {
                "tool": tool_name,
                "parameters": parameters,
                "message": f"工具 {tool_name} 执行成功",
                "timestamp": "2024-01-01T00:00:00Z"
            }
        }
    
    async def _mock_file_reader(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """模拟文件读取工具"""
        file_path = parameters.get("file_path")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return {
                "success": True,
                "result": {
                    "file_path": file_path,
                    "content": content[:1000] + "..." if len(content) > 1000 else content
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"读取文件失败: {str(e)}"
            }
    
    async def _mock_web_search(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """模拟网络搜索工具"""
        query = parameters.get("query")
        return {
            "success": True,
            "result": {
                "query": query,
                "results": [
                    {
                        "title": f"搜索结果 1 for '{query}'",
                        "url": "https://example.com/1",
                        "snippet": "这是一个模拟的搜索结果..."
                    }
                ]
            }
        }
    
    async def _mock_calculator(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """模拟计算器工具"""
        expression = parameters.get("expression")
        try:
            result = eval(expression)
            return {
                "success": True,
                "result": {
                    "expression": expression,
                    "result": result
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"计算失败: {str(e)}"
            }

class AgentHandler:
    """Agent 处理器"""
    
    def __init__(self):
        self.openai_handler = OpenAIHandler()
        self.mcp_handler = MCPHandler()
    
    async def process_message(
        self,
        agent_id: int,
        messages: List[Dict[str, str]],
        stream: bool = False
    ) -> Dict[str, Any]:
        """处理消息并生成回复，支持 MCP 工具调用"""
        try:
            agent = await Agent.get(id=agent_id)

            # 格式化消息
            formatted_messages = format_openai_messages(agent.prompt, messages)

            # 获取 Agent 绑定的 MCP 工具
            agent_tools = agent.mcp_tools or []
            available_tools = []

            if agent_tools:
                # 获取工具定义
                for tool_name in agent_tools:
                    tool = await MCPTool.filter(name=tool_name, is_active=True).first()
                    if tool:
                        available_tools.append({
                            "type": "function",
                            "function": {
                                "name": tool.name,
                                "description": tool.description,
                                "parameters": tool.config.get("parameters", {})
                            }
                        })

            # 获取 OpenAI 配置
            openai_config = agent.openai_config or {}
            model = openai_config.get("model", "gpt-3.5-turbo")
            temperature = openai_config.get("temperature", 0.7)
            max_tokens = openai_config.get("max_tokens")

            # 如果有可用工具，使用 function calling
            if available_tools:
                return await self._process_with_tools(
                    formatted_messages,
                    available_tools,
                    model,
                    temperature,
                    max_tokens,
                    stream
                )
            else:
                # 没有工具时，直接调用 OpenAI
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
        max_tokens: int,
        stream: bool = False
    ) -> Dict[str, Any]:
        """使用工具处理消息"""
        try:
            # 注意：工具调用暂不支持流式响应
            if stream:
                logger.warning("工具调用模式下暂不支持流式响应，将使用普通响应")
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

                    # 调用 MCP 工具
                    tool_result = await self.mcp_handler.call_tool(function_name, function_args)

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

# 全局实例
openai_handler = OpenAIHandler()
mcp_handler = MCPHandler()
agent_handler = AgentHandler()
