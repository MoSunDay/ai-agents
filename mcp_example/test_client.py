#!/usr/bin/env python3
"""
测试 MCP 时间服务器的客户端
"""

import asyncio
import os
import sys
from pydantic import AnyUrl

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import mcp.types as mcp_types

async def test_time_server():
    """测试时间服务器的功能"""
    
    # 获取当前脚本目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    server_script = os.path.join(current_dir, "time_server.py")
    
    # 创建服务器参数
    server_params = StdioServerParameters(
        command="python",
        args=[server_script, "stdio"]
    )
    
    print("🚀 启动 MCP 时间服务器测试...")
    
    try:
        # 连接到 MCP 服务器
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                # 初始化连接
                print("📡 初始化连接...")
                await session.initialize()
                print("✅ 连接成功！")
                
                # 列出可用工具
                print("\n🔧 获取可用工具...")
                tools_response = await session.list_tools()
                print(f"可用工具数量: {len(tools_response.tools)}")
                for tool in tools_response.tools:
                    print(f"  - {tool.name}: {tool.description}")
                
                # 列出可用资源
                print("\n📚 获取可用资源...")
                resources_response = await session.list_resources()
                print(f"可用资源数量: {len(resources_response.resources)}")
                for resource in resources_response.resources:
                    print(f"  - {resource.uri}: {resource.name}")
                
                # 列出可用提示词
                print("\n💬 获取可用提示词...")
                prompts_response = await session.list_prompts()
                print(f"可用提示词数量: {len(prompts_response.prompts)}")
                for prompt in prompts_response.prompts:
                    print(f"  - {prompt.name}: {prompt.description}")
                
                # 测试工具调用
                print("\n🧪 测试工具调用...")
                
                # 1. 测试获取当前时间
                print("1. 获取当前时间:")
                result = await session.call_tool("get_current_time", arguments={})
                if not result.isError:
                    for content in result.content:
                        if isinstance(content, mcp_types.TextContent):
                            print(f"   结果: {content.text}")
                    if hasattr(result, 'structuredContent') and result.structuredContent:
                        print(f"   结构化结果: {result.structuredContent}")
                else:
                    print("   ❌ 调用失败")
                
                # 2. 测试获取时间戳
                print("2. 获取时间戳:")
                result = await session.call_tool("get_timestamp", arguments={})
                if not result.isError:
                    for content in result.content:
                        if isinstance(content, mcp_types.TextContent):
                            print(f"   结果: {content.text}")
                    if hasattr(result, 'structuredContent') and result.structuredContent:
                        print(f"   结构化结果: {result.structuredContent}")
                else:
                    print("   ❌ 调用失败")
                
                # 3. 测试获取详细时间信息
                print("3. 获取详细时间信息:")
                result = await session.call_tool("get_time_info", arguments={})
                if not result.isError:
                    for content in result.content:
                        if isinstance(content, mcp_types.TextContent):
                            print(f"   结果: {content.text}")
                    if hasattr(result, 'structuredContent') and result.structuredContent:
                        print(f"   结构化结果: {result.structuredContent}")
                else:
                    print("   ❌ 调用失败")
                
                # 4. 测试自定义格式
                print("4. 获取自定义格式时间:")
                result = await session.call_tool("get_current_time", arguments={"format": "%Y年%m月%d日 %H时%M分%S秒"})
                if not result.isError:
                    for content in result.content:
                        if isinstance(content, mcp_types.TextContent):
                            print(f"   结果: {content.text}")
                    if hasattr(result, 'structuredContent') and result.structuredContent:
                        print(f"   结构化结果: {result.structuredContent}")
                else:
                    print("   ❌ 调用失败")
                
                # 测试资源读取
                print("\n📖 测试资源读取...")
                if resources_response.resources:
                    resource_uri = resources_response.resources[0].uri
                    print(f"读取资源: {resource_uri}")
                    resource_content = await session.read_resource(AnyUrl(resource_uri))
                    for content in resource_content.contents:
                        if isinstance(content, mcp_types.TextContent):
                            print(f"   内容: {content.text}")
                
                # 测试提示词
                print("\n💭 测试提示词...")
                if prompts_response.prompts:
                    prompt_name = prompts_response.prompts[0].name
                    print(f"获取提示词: {prompt_name}")
                    prompt_result = await session.get_prompt(prompt_name, arguments={"action": "current"})
                    for message in prompt_result.messages:
                        if hasattr(message, 'content'):
                            if isinstance(message.content, mcp_types.TextContent):
                                print(f"   提示词内容: {message.content.text}")
                
                print("\n🎉 测试完成！")
                
    except Exception as e:
        print(f"❌ 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()

async def main():
    """主函数"""
    await test_time_server()

if __name__ == "__main__":
    asyncio.run(main())
