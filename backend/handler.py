import openai
import asyncio
import json
from typing import Dict, Any, List, AsyncGenerator
from models import Agent, MCPTool
from utils import get_env_config, logger, format_openai_messages

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
    """MCP 工具处理器"""
    
    def __init__(self):
        self.active_connections = {}
    
    async def list_available_tools(self) -> List[Dict[str, Any]]:
        """获取可用的 MCP 工具列表"""
        try:
            tools = await MCPTool.filter(is_active=True).all()
            return [tool.to_dict() for tool in tools]
        except Exception as e:
            logger.error(f"获取 MCP 工具列表失败: {str(e)}")
            return []
    
    async def call_tool(
        self,
        tool_name: str,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """调用 MCP 工具"""
        try:
            tool = await MCPTool.filter(name=tool_name, is_active=True).first()
            if not tool:
                return {
                    "success": False,
                    "error": f"工具 {tool_name} 不存在或未激活"
                }
            
            # 这里应该根据实际的 MCP 协议调用外部工具
            # 目前返回模拟结果
            if tool_name == "file_reader":
                return await self._mock_file_reader(parameters)
            elif tool_name == "web_search":
                return await self._mock_web_search(parameters)
            elif tool_name == "calculator":
                return await self._mock_calculator(parameters)
            else:
                return {
                    "success": False,
                    "error": f"未实现的工具: {tool_name}"
                }
        except Exception as e:
            logger.error(f"调用 MCP 工具失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
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
        """处理消息并生成回复"""
        try:
            agent = await Agent.get(id=agent_id)
            
            # 格式化消息
            formatted_messages = format_openai_messages(agent.prompt, messages)
            
            # 获取 OpenAI 配置
            openai_config = agent.openai_config or {}
            model = openai_config.get("model", "gpt-3.5-turbo")
            temperature = openai_config.get("temperature", 0.7)
            max_tokens = openai_config.get("max_tokens")
            
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

# 全局实例
openai_handler = OpenAIHandler()
mcp_handler = MCPHandler()
agent_handler = AgentHandler()
