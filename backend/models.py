from tortoise.models import Model
from tortoise import fields
from typing import Dict, List, Any
import json

class Agent(Model):
    """Agent 模型 - 仅存储配置信息"""
    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=100, unique=True)
    description = fields.TextField(null=True)
    prompt = fields.TextField()  # 系统提示词
    mcp_tools = fields.JSONField(default=list)  # MCP 工具列表
    openai_config = fields.JSONField(default=dict)  # OpenAI 配置
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)
    
    class Meta:
        table = "agents"
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "prompt": self.prompt,
            "mcp_tools": self.mcp_tools or [],
            "openai_config": self.openai_config or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class MCPTool(Model):
    """MCP 工具模型"""
    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=100, unique=True)
    description = fields.TextField()
    config = fields.JSONField(default=dict)  # 工具配置
    is_active = fields.BooleanField(default=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)
    
    class Meta:
        table = "mcp_tools"
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "config": self.config or {},
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
