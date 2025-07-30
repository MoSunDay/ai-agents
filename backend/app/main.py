from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

from .models import init_db
from .api import agents_router, chat_router

# 创建 FastAPI 应用
app = FastAPI(
    title="AI Agents API",
    description="支持 MCP 的 AI Agent 聊天系统",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # 前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(agents_router)
app.include_router(chat_router)

@app.on_event("startup")
async def startup_event():
    """应用启动时初始化数据库"""
    init_db()

@app.get("/")
async def root():
    """根路径"""
    return {"message": "AI Agents API 服务正在运行"}

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
