// Agent 类型定义
export interface Agent {
  id: number;
  name: string;
  description: string;
  prompt: string;
  mcp_tools: string[];
  openai_config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// 聊天会话类型定义 - 前端本地存储
export interface ChatSession {
  id: string;
  agent_id: number;
  agent_name: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

// 聊天消息类型定义
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

// MCP 服务器类型定义
export interface MCPServer {
  id: number;
  name: string;
  description: string;
  api_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
