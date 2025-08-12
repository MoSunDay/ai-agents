import { create } from 'zustand';
import type { Agent, ChatSession, ChatMessage } from '../types';

// 应用状态接口
interface AppState {
  // Agent 相关
  agents: Agent[];
  currentAgent: Agent | null;

  // 聊天会话相关 - 前端本地存储
  sessions: ChatSession[];
  currentSession: ChatSession | null;

  // UI 状态
  isLoading: boolean;
  error: string | null;

  // Actions
  setAgents: (agents: Agent[]) => void;
  setCurrentAgent: (agent: Agent | null) => void;
  setSessions: (sessions: ChatSession[]) => void;
  setCurrentSession: (session: ChatSession | null) => void;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  updateMessage: (sessionId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  appendToMessage: (sessionId: string, messageId: string, text: string) => void;
  createSession: (agent: Agent, title?: string) => ChatSession;
  updateSessionTitle: (sessionId: string, newTitle: string) => void;
  deleteSession: (sessionId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  loadSessionsFromStorage: () => void;
  saveSessionsToStorage: () => void;
}

// 本地存储键
const SESSIONS_STORAGE_KEY = 'ai-agents-sessions';

// 创建 Zustand store
export const useAppStore = create<AppState>((set, get) => ({
  // 初始状态
  agents: [],
  currentAgent: null,
  sessions: [],
  currentSession: null,
  isLoading: false,
  error: null,

  // Actions
  setAgents: (agents) => set({ agents }),
  setCurrentAgent: (agent) => set({ currentAgent: agent }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (session) => set({ currentSession: session }),

  addMessage: (sessionId, message) => set((state) => {
    const updatedSessions = state.sessions.map(session =>
      session.id === sessionId
        ? { ...session, messages: [...session.messages, message], updated_at: new Date().toISOString() }
        : session
    );

    // 更新当前会话
    const updatedCurrentSession = state.currentSession?.id === sessionId
      ? updatedSessions.find(s => s.id === sessionId) || state.currentSession
      : state.currentSession;

    // 保存到本地存储
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));

    return {
      sessions: updatedSessions,
      currentSession: updatedCurrentSession
    };
  }),

  updateMessage: (sessionId, messageId, patch) => set((state) => {
    const updatedSessions = state.sessions.map(session =>
      session.id === sessionId
        ? {
            ...session,
            messages: session.messages.map(m => m.id === messageId ? { ...m, ...patch } : m),
            updated_at: new Date().toISOString()
          }
        : session
    );
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
    return {
      sessions: updatedSessions,
      currentSession: state.currentSession?.id === sessionId
        ? updatedSessions.find(s => s.id === sessionId) || state.currentSession
        : state.currentSession
    };
  }),

  appendToMessage: (sessionId, messageId, text) => set((state) => {
    const updatedSessions = state.sessions.map(session =>
      session.id === sessionId
        ? {
            ...session,
            messages: session.messages.map(m => m.id === messageId ? { ...m, content: (m.content || '') + text } : m),
            updated_at: new Date().toISOString()
          }
        : session
    );
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
    return {
      sessions: updatedSessions,
      currentSession: state.currentSession?.id === sessionId
        ? updatedSessions.find(s => s.id === sessionId) || state.currentSession
        : state.currentSession
    };
  }),

  createSession: (agent, title) => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      agent_id: agent.id,
      agent_name: agent.name,
      title: title || `与 ${agent.name} 的对话`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: []
    };

    set((state) => {
      const updatedSessions = [newSession, ...state.sessions];
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
      return {
        sessions: updatedSessions,
        currentSession: newSession
      };
    });

    return newSession;
  },

  updateSessionTitle: (sessionId, newTitle) => set((state) => {
    const updatedSessions = state.sessions.map(session =>
      session.id === sessionId
        ? { ...session, title: newTitle, updated_at: new Date().toISOString() }
        : session
    );

    const updatedCurrentSession = state.currentSession?.id === sessionId
      ? { ...state.currentSession, title: newTitle, updated_at: new Date().toISOString() }
      : state.currentSession;

    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));

    return {
      sessions: updatedSessions,
      currentSession: updatedCurrentSession
    };
  }),

  deleteSession: (sessionId) => set((state) => {
    const updatedSessions = state.sessions.filter(s => s.id !== sessionId);
    const updatedCurrentSession = state.currentSession?.id === sessionId ? null : state.currentSession;

    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));

    return {
      sessions: updatedSessions,
      currentSession: updatedCurrentSession
    };
  }),

  loadSessionsFromStorage: () => {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (stored) {
        const sessions = JSON.parse(stored);
        set({ sessions });
      }
    } catch (error) {
      console.error('加载会话历史失败:', error);
    }
  },

  saveSessionsToStorage: () => {
    const { sessions } = get();
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
