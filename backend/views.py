from sanic import Blueprint
from sanic.response import json as sanic_json
from sanic import Request
from models import Agent, MCPTool
from utils import success_response, error_response, validate_agent_data, parse_request_json
from handler import agent_handler, mcp_handler
import json

# 创建蓝图
api = Blueprint("api", url_prefix="/api")

# Agent 相关路由
@api.route("/agents", methods=["GET"])
async def list_agents(request: Request):
    """获取所有 Agent"""
    try:
        agents = await Agent.all()
        return success_response([agent.to_dict() for agent in agents])
    except Exception as e:
        return error_response(f"获取 Agent 列表失败: {str(e)}", 500)

@api.route("/agents", methods=["POST"])
async def create_agent(request: Request):
    """创建新的 Agent"""
    try:
        data = parse_request_json(request)
        
        # 验证数据
        errors = validate_agent_data(data)
        if errors:
            return error_response("数据验证失败", 400, {"errors": errors})
        
        # 检查名称是否已存在
        existing_agent = await Agent.filter(name=data["name"]).first()
        if existing_agent:
            return error_response("Agent 名称已存在", 400)
        
        # 创建 Agent
        agent = await Agent.create(
            name=data["name"],
            description=data.get("description", ""),
            prompt=data["prompt"],
            mcp_tools=data.get("mcp_tools", []),
            openai_config=data.get("openai_config", {})
        )
        
        return success_response(agent.to_dict(), "Agent 创建成功")
    except Exception as e:
        return error_response(f"创建 Agent 失败: {str(e)}", 500)

@api.route("/agents/<agent_id:int>", methods=["GET"])
async def get_agent(request: Request, agent_id: int):
    """获取指定 Agent"""
    try:
        agent = await Agent.get(id=agent_id)
        return success_response(agent.to_dict())
    except Agent.DoesNotExist:
        return error_response("Agent 不存在", 404)
    except Exception as e:
        return error_response(f"获取 Agent 失败: {str(e)}", 500)

@api.route("/agents/<agent_id:int>", methods=["PUT"])
async def update_agent(request: Request, agent_id: int):
    """更新 Agent"""
    try:
        agent = await Agent.get(id=agent_id)
        data = parse_request_json(request)
        
        # 验证数据
        errors = validate_agent_data(data)
        if errors:
            return error_response("数据验证失败", 400, {"errors": errors})
        
        # 检查名称冲突
        if "name" in data and data["name"] != agent.name:
            existing_agent = await Agent.filter(name=data["name"]).first()
            if existing_agent:
                return error_response("Agent 名称已存在", 400)
        
        # 更新字段
        for field in ["name", "description", "prompt", "mcp_tools", "openai_config"]:
            if field in data:
                setattr(agent, field, data[field])
        
        await agent.save()
        return success_response(agent.to_dict(), "Agent 更新成功")
    except Agent.DoesNotExist:
        return error_response("Agent 不存在", 404)
    except Exception as e:
        return error_response(f"更新 Agent 失败: {str(e)}", 500)

@api.route("/agents/<agent_id:int>", methods=["DELETE"])
async def delete_agent(request: Request, agent_id: int):
    """删除 Agent"""
    try:
        agent = await Agent.get(id=agent_id)
        await agent.delete()
        return success_response(None, "Agent 删除成功")
    except Agent.DoesNotExist:
        return error_response("Agent 不存在", 404)
    except Exception as e:
        return error_response(f"删除 Agent 失败: {str(e)}", 500)

# 聊天相关路由
@api.route("/chat/send", methods=["POST"])
async def send_message(request: Request):
    """发送消息并获取回复"""
    try:
        data = parse_request_json(request)
        agent_id = data.get("agent_id")
        messages = data.get("messages", [])
        
        if not agent_id:
            return error_response("缺少 agent_id 参数", 400)
        
        if not messages:
            return error_response("缺少 messages 参数", 400)
        
        # 处理消息
        response = await agent_handler.process_message(agent_id, messages, stream=False)
        
        if isinstance(response, dict) and not response.get("success", True):
            return error_response(response.get("error", "处理消息失败"), 500)
        
        return success_response(response)
    except Exception as e:
        return error_response(f"发送消息失败: {str(e)}", 500)

@api.route("/chat/stream", methods=["POST"])
async def send_message_stream(request: Request):
    """发送消息并流式获取回复 - 暂时返回普通响应"""
    try:
        data = parse_request_json(request)
        agent_id = data.get("agent_id")
        messages = data.get("messages", [])

        if not agent_id:
            return error_response("缺少 agent_id 参数", 400)

        if not messages:
            return error_response("缺少 messages 参数", 400)

        # 暂时使用普通响应，后续可以实现真正的流式响应
        response = await agent_handler.process_message(agent_id, messages, stream=False)

        if isinstance(response, dict) and not response.get("success", True):
            return error_response(response.get("error", "处理消息失败"), 500)

        return success_response(response)
    except Exception as e:
        return error_response(f"流式发送消息失败: {str(e)}", 500)

# MCP 工具相关路由
@api.route("/mcp/tools", methods=["GET"])
async def list_mcp_tools(request: Request):
    """获取所有 MCP 工具"""
    try:
        tools = await mcp_handler.list_available_tools()
        return success_response(tools)
    except Exception as e:
        return error_response(f"获取 MCP 工具列表失败: {str(e)}", 500)

@api.route("/mcp/tools", methods=["POST"])
async def create_mcp_tool(request: Request):
    """创建新的 MCP 工具"""
    try:
        data = parse_request_json(request)
        
        if not data.get("name"):
            return error_response("工具名称不能为空", 400)
        
        # 检查名称是否已存在
        existing_tool = await MCPTool.filter(name=data["name"]).first()
        if existing_tool:
            return error_response("工具名称已存在", 400)
        
        tool = await MCPTool.create(
            name=data["name"],
            description=data.get("description", ""),
            config=data.get("config", {}),
            is_active=data.get("is_active", True)
        )
        
        return success_response(tool.to_dict(), "MCP 工具创建成功")
    except Exception as e:
        return error_response(f"创建 MCP 工具失败: {str(e)}", 500)

# 健康检查
@api.route("/health", methods=["GET"])
async def health_check(request: Request):
    """健康检查"""
    return success_response({"status": "healthy"}, "服务正常运行")
