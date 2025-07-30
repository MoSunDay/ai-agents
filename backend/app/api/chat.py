from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel
import json

from ..models import get_db, Agent, ChatSession, ChatMessage
from ..services import openai_service, mcp_service

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    agent_id: int
    message: str
    session_id: int = None

class SessionCreate(BaseModel):
    agent_id: int
    title: str = "新对话"

@router.get("/sessions", response_model=List[Dict[str, Any]])
async def list_sessions(db: Session = Depends(get_db)):
    """获取所有聊天会话"""
    sessions = db.query(ChatSession).order_by(ChatSession.updated_at.desc()).all()
    return [session.to_dict() for session in sessions]

@router.post("/sessions", response_model=Dict[str, Any])
async def create_session(session_data: SessionCreate, db: Session = Depends(get_db)):
    """创建新的聊天会话"""
    # 验证 Agent 是否存在
    agent = db.query(Agent).filter(Agent.id == session_data.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    
    session = ChatSession(
        agent_id=session_data.agent_id,
        title=session_data.title
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return session.to_dict()

@router.get("/sessions/{session_id}/messages", response_model=List[Dict[str, Any]])
async def get_session_messages(session_id: int, db: Session = Depends(get_db)):
    """获取会话的所有消息"""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at).all()
    
    return [message.to_dict() for message in messages]

@router.post("/send")
async def send_message(chat_request: ChatRequest, db: Session = Depends(get_db)):
    """发送消息并获取 Agent 回复"""
    # 验证 Agent
    agent = db.query(Agent).filter(Agent.id == chat_request.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent 不存在")
    
    # 获取或创建会话
    if chat_request.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == chat_request.session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
    else:
        session = ChatSession(
            agent_id=chat_request.agent_id,
            title=chat_request.message[:50] + "..." if len(chat_request.message) > 50 else chat_request.message
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    
    # 保存用户消息
    user_message = ChatMessage(
        session_id=session.id,
        role="user",
        content=chat_request.message
    )
    db.add(user_message)
    db.commit()
    
    # 构建消息历史
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session.id
    ).order_by(ChatMessage.created_at).all()
    
    # 构建 OpenAI 消息格式
    openai_messages = [{"role": "system", "content": agent.prompt}]
    for msg in messages:
        openai_messages.append({
            "role": msg.role,
            "content": msg.content
        })
    
    try:
        # 调用 OpenAI API
        response = await openai_service.chat_completion(
            messages=openai_messages,
            model=agent.openai_config.get("model", "gpt-3.5-turbo"),
            temperature=agent.openai_config.get("temperature", 0.7)
        )
        
        # 保存 Assistant 回复
        assistant_message = ChatMessage(
            session_id=session.id,
            role="assistant",
            content=response["content"],
            metadata={"usage": response.get("usage")}
        )
        db.add(assistant_message)
        db.commit()
        
        return {
            "session_id": session.id,
            "user_message": user_message.to_dict(),
            "assistant_message": assistant_message.to_dict()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成回复失败: {str(e)}")

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, db: Session = Depends(get_db)):
    """删除聊天会话"""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    db.delete(session)
    db.commit()
    
    return {"message": "会话删除成功"}
