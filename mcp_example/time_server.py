#!/usr/bin/env python3
"""
简单的 MCP 时间服务器
提供获取当前时间的工具
"""

import asyncio
import sys
from datetime import datetime
from typing import Any, Dict

from fastmcp import FastMCP

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
    """主函数 - 启动 MCP 服务器
    用法:
      python time_server.py sse [port]    # 启动 HTTP(S)+SSE 服务器，默认端口 9090
      python time_server.py stdio         # 启动 stdio 服务器（仅用于本地调试）
    """
    transport = "stdio"
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower()
        if arg in {"http", "streamable-http", "http-sse"}:
            transport = "http"
        elif arg == "sse":
            transport = "sse"
        elif arg == "stdio":
            transport = "stdio"

    if transport in {"http", "sse"}:
        # 尝试在 0.0.0.0:9090 端口启动，避免与后端 8001 冲突
        port = 9090
        if len(sys.argv) > 2:
            try:
                port = int(sys.argv[2])
            except ValueError:
                pass
        try:
            if transport == "http":
                print(f"[MCP] Starting HTTP (streamable) server on port {port}...")
                mcp.run(transport="http", host="0.0.0.0", port=port, path="/mcp")
            else:
                print(f"[MCP] Starting SSE server on port {port}...")
                mcp.run(transport="sse", host="0.0.0.0", port=port)
        except TypeError:
            # 老版本不支持关键字参数，回退到默认设置
            print("[MCP] Falling back to defaults...")
            mcp.run(transport="http" if transport == "http" else "sse")
        except Exception as e:
            print(f"无法启动 MCP 服务器: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # 本地调试：stdio
        print("[MCP] Starting stdio server...")
        pass
if __name__ == "__main__":
    main()
