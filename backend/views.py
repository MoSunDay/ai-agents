from sanic import Blueprint
from sanic.response import json as sanic_json
from sanic import Request
from models import Agent, MCPServer
from utils import success_response, error_response, validate_agent_data, parse_request_json
from handler import AgentHandler
import json

# 创建 handler 实例
agent_handler = AgentHandler()

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

# MCP 服务器管理路由
@api.route("/mcp/servers", methods=["GET"])
async def list_mcp_servers(request: Request):
    """获取所有 MCP 服务器"""
    try:
        servers = await MCPServer.all()
        return success_response([server.to_dict() for server in servers])
    except Exception as e:
        return error_response(f"获取 MCP 服务器列表失败: {str(e)}", 500)

@api.route("/mcp/servers", methods=["POST"])
async def create_mcp_server(request: Request):
    """创建新的 MCP 服务器"""
    try:
        data = parse_request_json(request)

        if not data.get("name"):
            return error_response("服务器名称不能为空", 400)

        api_url = (data.get("api_url") or "").strip()
        if not api_url:
            return error_response("API 地址不能为空", 400)
        if not (api_url.startswith("http://") or api_url.startswith("https://")):
            return error_response("仅支持以 http:// 或 https:// 开头的 MCP HTTP 接口", 400)

        # 检查名称是否已存在
        existing_server = await MCPServer.filter(name=data["name"]).first()
        if existing_server:
            return error_response("服务器名称已存在", 400)

        server = await MCPServer.create(
            name=data["name"],
            description=data.get("description", ""),
            api_url=api_url,
            is_active=data.get("is_active", True)
        )

        return success_response(server.to_dict(), "MCP 服务器创建成功")
    except Exception as e:
        return error_response(f"创建 MCP 服务器失败: {str(e)}", 500)

@api.route("/mcp/servers/<server_id:int>", methods=["PUT"])
async def update_mcp_server(request: Request, server_id: int):
    """更新 MCP 服务器"""
    try:
        data = parse_request_json(request)

        server = await MCPServer.get(id=server_id)

        # 如果要更新名称，检查是否与其他服务器重复
        if "name" in data and data["name"] != server.name:
            existing_server = await MCPServer.filter(name=data["name"]).first()
            if existing_server:
                return error_response("服务器名称已存在", 400)

        # 限制 api_url 只能是 http(s)
        if "api_url" in data:
            new_url = (data["api_url"] or "").strip()
            if not (new_url.startswith("http://") or new_url.startswith("https://")):
                return error_response("仅支持以 http:// 或 https:// 开头的 MCP HTTP 接口", 400)
            data["api_url"] = new_url

        # 更新字段
        for field in ["name", "description", "api_url", "is_active"]:
            if field in data:
                setattr(server, field, data[field])

        await server.save()

        return success_response(server.to_dict(), "MCP 服务器更新成功")
    except MCPServer.DoesNotExist:
        return error_response("MCP 服务器不存在", 404)
    except Exception as e:
        return error_response(f"更新 MCP 服务器失败: {str(e)}", 500)

@api.route("/mcp/servers/<server_id:int>", methods=["DELETE"])
async def delete_mcp_server(request: Request, server_id: int):
    """删除 MCP 服务器"""
    try:
        server = await MCPServer.get(id=server_id)
        await server.delete()

        return success_response(None, "MCP 服务器删除成功")
    except MCPServer.DoesNotExist:
        return error_response("MCP 服务器不存在", 404)
    except Exception as e:
        return error_response(f"删除 MCP 服务器失败: {str(e)}", 500)

@api.route("/mcp/servers/<server_name>/tools", methods=["GET"])
async def get_server_tools(request: Request, server_name: str):
    """获取指定 MCP 服务器的工具列表"""
    try:
        tools = await agent_handler.mcp_handler.get_server_tools_dynamic(server_name)
        return success_response(tools)
    except Exception as e:
        return error_response(f"获取服务器 {server_name} 工具列表失败: {str(e)}", 500)

# 健康检查
@api.route("/health", methods=["GET"])
async def health_check(request: Request):
    """健康检查"""
    return success_response({"status": "healthy"}, "服务正常运行")
