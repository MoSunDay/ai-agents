from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel

from ..models import get_db, Agent
from ..services import mcp_service

router = APIRouter(prefix="/agents", tags=["agents"])

class AgentCreate(BaseModel):
    name: str
    description: str = ""
    prompt: str
    mcp_tools: List[str] = []
    openai_config: Dict[str, Any] = {}

class AgentUpdate(BaseModel):
    name: str = None
    description: str = None
    prompt: str = None
    mcp_tools: List[str] = None
    openai_config: Dict[str, Any] = None

@router.get("/", response_model=List[Dict[str, Any]])
async def list_agents(db: Session = Depends(get_db)):
    """获取所有 Agent"""
    agents = db.query(Agent).all()
    return [agent.to_dict() for agent in agents]

@router.post("/", response_model=Dict[str, Any])
async def create_agent(agent_data: AgentCreate, db: Session = Depends(get_db)):
    """创建新的 Agent"""
    agent = Agent(
        name=agent_data.name,
        description=agent_data.description,
        prompt=agent_data.prompt,
        mcp_tools=agent_data.mcp_tools,
        openai_config=agent_data.openai_config
    )
    
    db.add(agent)
    db.commit()
    db.refresh(agent)
    
    return agent.to_dict()

@router.get("/{agent_id}", response_model=Dict[str, Any])
async def get_agent(agent_id: int, db: Session = Depends(get_db)):
    """获取指定 Agent"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    
    return agent.to_dict()

@router.put("/{agent_id}", response_model=Dict[str, Any])
async def update_agent(
    agent_id: int,
    agent_data: AgentUpdate,
    db: Session = Depends(get_db)
):
    """更新 Agent"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    
    # 更新字段
    for field, value in agent_data.dict(exclude_unset=True).items():
        setattr(agent, field, value)
    
    db.commit()
    db.refresh(agent)
    
    return agent.to_dict()

@router.delete("/{agent_id}")
async def delete_agent(agent_id: int, db: Session = Depends(get_db)):
    """删除 Agent"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    
    db.delete(agent)
    db.commit()
    
    return {"message": "Agent 删除成功"}

@router.get("/{agent_id}/mcp-tools")
async def get_agent_mcp_tools(agent_id: int, db: Session = Depends(get_db)):
    """获取 Agent 的 MCP 工具列表"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    
    # 获取可用的 MCP 工具
    available_tools = await mcp_service.list_available_tools(agent.openai_config or {})
    
    return {
        "agent_id": agent_id,
        "configured_tools": agent.mcp_tools or [],
        "available_tools": available_tools
    }
