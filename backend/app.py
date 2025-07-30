from sanic import Sanic
from sanic_cors import CORS
from tortoise.contrib.sanic import register_tortoise
from views import api
from utils import get_env_config, get_database_url, logger
from models import Agent, MCPTool

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
        # 创建默认的 MCP 工具
        default_tools = [
            {
                "name": "file_reader",
                "description": "读取文件内容",
                "config": {
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "file_path": {
                                "type": "string",
                                "description": "文件路径"
                            }
                        },
                        "required": ["file_path"]
                    }
                }
            },
            {
                "name": "web_search",
                "description": "网络搜索",
                "config": {
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "搜索查询"
                            }
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "name": "calculator",
                "description": "数学计算",
                "config": {
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "expression": {
                                "type": "string",
                                "description": "数学表达式"
                            }
                        },
                        "required": ["expression"]
                    }
                }
            }
        ]
        
        for tool_data in default_tools:
            existing_tool = await MCPTool.filter(name=tool_data["name"]).first()
            if not existing_tool:
                await MCPTool.create(**tool_data)
                logger.info(f"创建默认 MCP 工具: {tool_data['name']}")
        
        # 创建默认 Agent
        default_agent = await Agent.filter(name="默认助手").first()
        if not default_agent:
            await Agent.create(
                name="默认助手",
                description="一个通用的AI助手",
                prompt="你是一个有用的AI助手。请友好、准确地回答用户的问题。",
                mcp_tools=["calculator"],
                openai_config={
                    "model": "gpt-3.5-turbo",
                    "temperature": 0.7,
                    "max_tokens": 2000
                }
            )
            logger.info("创建默认 Agent")
            
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
        port=8000,
        debug=True,
        auto_reload=True
    )
