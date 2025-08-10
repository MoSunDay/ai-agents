from sanic import Sanic
from sanic_cors import CORS
from tortoise.contrib.sanic import register_tortoise
from views import api
from utils import get_env_config, get_database_url, logger
from models import Agent, MCPServer

# 创建 Sanic 应用
app = Sanic("ai-agents-api")

# 配置 CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://localhost:5173"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# 注册蓝图
app.blueprint(api)

# 配置数据库
register_tortoise(
    app,
    db_url=get_database_url(),
    modules={"models": ["models"]},
    generate_schemas=True,
)

@app.before_server_start
async def init_data(app, loop):
    """初始化数据"""
    try:
        # MCP 工具管理已移除 - 现在由独立的 MCP 服务器处理
        
        # 创建默认的 MCP 服务器（如果不存在）
        default_server = await MCPServer.filter(name="time_server").first()
        if not default_server:
            await MCPServer.create(
                name="time_server",
                description="时间工具服务器(HTTP)",
                api_url="http://127.0.0.1:8000",  # 使用 HTTP 协议，SSE 默认端口
                is_active=True
            )
            logger.info("创建默认 MCP 服务器: time_server")

        # 不再自动创建默认 Agent - 让用户手动创建
        logger.info("系统启动完成，等待用户创建 Agent")
            
    except Exception as e:
        logger.error(f"初始化数据失败: {str(e)}")

@app.route("/")
async def root(request):
    """根路径"""
    return {"message": "AI Agents API 服务正在运行", "version": "1.0.0"}

if __name__ == "__main__":
    config = get_env_config()
    app.run(
        host="0.0.0.0",
        port=8001,
        debug=True,
        auto_reload=True
    )
