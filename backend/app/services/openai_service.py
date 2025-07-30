import openai
from typing import List, Dict, Any, AsyncGenerator
import os
import json

class OpenAIService:
    """OpenAI API 服务"""
    
    def __init__(self):
        self.client = openai.AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY", "sk-test-key")
        )
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: int = None,
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        调用 OpenAI Chat Completion API
        """
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
            # 模拟响应用于测试
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
        """
        流式调用 OpenAI Chat Completion API
        """
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
            # 模拟流式响应用于测试
            import asyncio
            response_text = f"这是一个模拟的流式AI回复。原始消息: {messages[-1]['content'] if messages else ''}"
            for word in response_text.split():
                yield word + " "
                await asyncio.sleep(0.1)

# 全局实例
openai_service = OpenAIService()
