import os
import json
import logging
from typing import Dict, Any, List
from sanic.response import json as sanic_json
from sanic import Request

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_env_config() -> Dict[str, Any]:
    """获取环境配置"""
    return {
        "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", "sk-test-key"),
        "MYSQL_HOST": os.getenv("MYSQL_HOST", "localhost"),
        "MYSQL_PORT": int(os.getenv("MYSQL_PORT", "3306")),
        "MYSQL_USER": os.getenv("MYSQL_USER", "root"),
        "MYSQL_PASSWORD": os.getenv("MYSQL_PASSWORD", "123456"),
        "MYSQL_DATABASE": os.getenv("MYSQL_DATABASE", "ai_agents"),
    }

def success_response(data: Any = None, message: str = "success") -> sanic_json:
    """成功响应"""
    return sanic_json({
        "success": True,
        "message": message,
        "data": data
    })

def error_response(message: str, code: int = 400, data: Any = None) -> sanic_json:
    """错误响应"""
    return sanic_json({
        "success": False,
        "message": message,
        "data": data
    }, status=code)

def validate_agent_data(data: Dict[str, Any]) -> List[str]:
    """验证 Agent 数据"""
    errors = []
    
    if not data.get("name"):
        errors.append("Agent 名称不能为空")
    
    if not data.get("prompt"):
        errors.append("系统提示词不能为空")
    
    if "mcp_tools" in data and not isinstance(data["mcp_tools"], list):
        errors.append("MCP 工具列表必须是数组")
    
    if "openai_config" in data and not isinstance(data["openai_config"], dict):
        errors.append("OpenAI 配置必须是对象")
    
    return errors

def get_database_url() -> str:
    """获取数据库连接URL"""
    # 暂时使用 SQLite 进行测试，生产环境可以切换到 MySQL
    return "sqlite://agents.db"
    # config = get_env_config()
    # return f"mysql://{config['MYSQL_USER']}:{config['MYSQL_PASSWORD']}@{config['MYSQL_HOST']}:{config['MYSQL_PORT']}/{config['MYSQL_DATABASE']}"

def parse_request_json(request: Request) -> Dict[str, Any]:
    """解析请求JSON数据"""
    try:
        return request.json or {}
    except Exception as e:
        logger.error(f"解析JSON失败: {str(e)}")
        return {}

def format_openai_messages(prompt: str, messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """格式化 OpenAI 消息"""
    formatted_messages = [{"role": "system", "content": prompt}]
    formatted_messages.extend(messages)
    return formatted_messages
