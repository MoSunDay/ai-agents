#!/usr/bin/env python3
"""
简单的 MCP 时间服务器
提供获取当前时间的工具
"""

import asyncio
import sys
from datetime import datetime
from typing import Any, Dict

from mcp.server.fastmcp import FastMCP

# 创建 MCP 服务器
mcp = FastMCP("TimeServer")

@mcp.tool()
def get_current_time(format: str = "%Y-%m-%d %H:%M:%S") -> str:
    """获取当前时间
    
    Args:
        format: 时间格式字符串，默认为 "%Y-%m-%d %H:%M:%S"
    
    Returns:
        格式化的当前时间字符串
    """
    now = datetime.now()
    return now.strftime(format)

@mcp.tool()
def get_timestamp() -> float:
    """获取当前时间戳
    
    Returns:
        当前的 Unix 时间戳
    """
    return datetime.now().timestamp()

@mcp.tool()
def get_time_info() -> Dict[str, Any]:
    """获取详细的时间信息
    
    Returns:
        包含多种时间格式的字典
    """
    now = datetime.now()
    return {
        "datetime": now.strftime("%Y-%m-%d %H:%M:%S"),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "timestamp": now.timestamp(),
        "year": now.year,
        "month": now.month,
        "day": now.day,
        "hour": now.hour,
        "minute": now.minute,
        "second": now.second,
        "weekday": now.strftime("%A"),
        "iso_format": now.isoformat()
    }

@mcp.resource("time://current")
def get_current_time_resource() -> str:
    """时间资源 - 返回当前时间"""
    return f"当前时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

@mcp.prompt()
def time_prompt(action: str = "current") -> str:
    """时间相关的提示词
    
    Args:
        action: 动作类型，可以是 "current", "format", "compare"
    """
    if action == "current":
        return "请获取当前时间并告诉我。"
    elif action == "format":
        return "请获取当前时间并用不同的格式显示。"
    elif action == "compare":
        return "请获取当前时间并与昨天同一时间进行比较。"
    else:
        return "请使用时间相关的工具。"

def main():
    """主函数 - 启动 MCP 服务器"""
    # 从命令行参数获取传输方式
    if len(sys.argv) > 1 and sys.argv[1] == "stdio":
        # 使用 stdio 传输
        mcp.run(transport="stdio")
    else:
        # 默认使用 stdio
        mcp.run(transport="stdio")

if __name__ == "__main__":
    main()
