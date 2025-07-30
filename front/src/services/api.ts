import axios from 'axios';
import type { Agent } from '../types';

// API 基础配置
const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 响应拦截器处理新的响应格式
api.interceptors.response.use(
  (response) => {
    // 如果响应有 success 字段，返回 data 部分
    if (response.data && typeof response.data.success !== 'undefined') {
      if (response.data.success) {
        return { ...response, data: response.data.data };
      } else {
        throw new Error(response.data.message || '请求失败');
      }
    }
    return response;
  },
  (error) => {
    throw error;
  }
);

// Agent API
export const agentApi = {
  // 获取所有 Agent
  getAll: async (): Promise<Agent[]> => {
    const response = await api.get('/agents/');
    return response.data;
  },
  
  // 创建 Agent
  create: async (agentData: Omit<Agent, 'id' | 'created_at' | 'updated_at'>): Promise<Agent> => {
    const response = await api.post('/agents/', agentData);
    return response.data;
  },
  
  // 获取单个 Agent
  getById: async (id: number): Promise<Agent> => {
    const response = await api.get(`/agents/${id}`);
    return response.data;
  },
  
  // 更新 Agent
  update: async (id: number, agentData: Partial<Agent>): Promise<Agent> => {
    const response = await api.put(`/agents/${id}`, agentData);
    return response.data;
  },
  
  // 删除 Agent
  delete: async (id: number): Promise<void> => {
    await api.delete(`/agents/${id}`);
  },
  
  // 获取 Agent 的 MCP 工具
  getMcpTools: async (id: number) => {
    const response = await api.get(`/agents/${id}/mcp-tools`);
    return response.data;
  },
};

// 聊天 API - 更新为新的后端格式
export const chatApi = {
  // 发送消息 - 后端不存储会话，直接发送消息
  sendMessage: async (data: {
    agent_id: number;
    messages: Array<{ role: string; content: string }>;
  }) => {
    const response = await api.post('/chat/send', data);
    return response.data;
  },

  // 发送消息（流式）
  sendMessageStream: async (data: {
    agent_id: number;
    messages: Array<{ role: string; content: string }>;
  }) => {
    const response = await api.post('/chat/stream', data);
    return response.data;
  },
};

export default api;
