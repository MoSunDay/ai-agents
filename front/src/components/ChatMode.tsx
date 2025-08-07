import { useState } from 'react';
import { Button, Select, List, Avatar, Input, Typography } from 'antd';
import { PlusOutlined, MessageOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import type { Agent } from '../types';

const { Text } = Typography;

interface ChatModeProps {
  agents: Agent[];
  onCreateSession: () => void;
}

const ChatMode: React.FC<ChatModeProps> = ({ agents, onCreateSession }) => {
  const {
    currentAgent,
    setCurrentAgent,
    sessions,
    currentSession,
    setCurrentSession,
    deleteSession,
    updateSessionTitle
  } = useAppStore();

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleSessionTitleEdit = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  const handleSessionTitleSave = (sessionId: string) => {
    if (editingTitle.trim()) {
      updateSessionTitle(sessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const currentSessions = sessions.filter(s => s.agent_id === currentAgent?.id);

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)',
      minHeight: 0,
      overflow: 'hidden'
    }}>
      {/* Agent 选择器 */}
      <div style={{ 
        padding: '20px', 
        borderBottom: '1px solid #e8e9ea',
        background: '#ffffff'
      }}>
        <Text strong style={{ 
          display: 'block', 
          marginBottom: '12px',
          fontSize: '15px',
          color: '#262626'
        }}>
          选择 Agent
        </Text>
        <Select
          value={currentAgent?.id}
          onChange={(agentId) => {
            const agent = agents.find(a => a.id === agentId);
            setCurrentAgent(agent || null);
            setCurrentSession(null);
          }}
          placeholder="请选择一个 Agent"
          style={{ 
            width: '100%',
            borderRadius: '8px'
          }}
          size="large"
          options={agents.map(agent => ({
            label: agent.name,
            value: agent.id
          }))}
        />
      </div>

      {/* 新建对话按钮 */}
      <div style={{ 
        padding: '20px', 
        borderBottom: '1px solid #e8e9ea',
        background: '#ffffff'
      }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={onCreateSession}
          disabled={!currentAgent}
          style={{
            borderRadius: '10px',
            height: '44px',
            fontWeight: 600,
            fontSize: '15px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}
        >
          新建对话
        </Button>
      </div>

      {/* 对话历史 */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        padding: '8px 0',
        minHeight: 0
      }}>
        {currentSessions.length > 0 ? (
          <List
            dataSource={currentSessions}
            renderItem={(session) => (
              <List.Item
                style={{
                  padding: '12px 20px',
                  cursor: 'pointer',
                  background: currentSession?.id === session.id 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                    : 'transparent',
                  borderLeft: currentSession?.id === session.id ? '4px solid #667eea' : '4px solid transparent',
                  margin: '4px 12px',
                  borderRadius: '12px',
                  transition: 'all 0.3s ease',
                  boxShadow: currentSession?.id === session.id 
                    ? '0 4px 12px rgba(102, 126, 234, 0.3)' 
                    : 'none'
                }}
                onClick={() => setCurrentSession(session)}
                actions={[
                  <Button
                    key="edit"
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSessionTitleEdit(session.id, session.title);
                    }}
                  />,
                  <Button
                    key="delete"
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    danger
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                      if (currentSession?.id === session.id) {
                        setCurrentSession(null);
                      }
                    }}
                  />
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size="small"
                      style={{ 
                        backgroundColor: currentSession?.id === session.id ? '#ffffff' : '#667eea',
                        color: currentSession?.id === session.id ? '#667eea' : '#ffffff'
                      }}
                      icon={<MessageOutlined />}
                    />
                  }
                  title={
                    editingSessionId === session.id ? (
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onPressEnter={() => handleSessionTitleSave(session.id)}
                        onBlur={() => handleSessionTitleSave(session.id)}
                        size="small"
                        style={{ fontSize: '14px' }}
                        autoFocus
                      />
                    ) : (
                      <span style={{
                        fontSize: '14px',
                        fontWeight: currentSession?.id === session.id ? 600 : 500,
                        color: currentSession?.id === session.id ? '#ffffff' : '#333'
                      }}>
                        {session.title}
                      </span>
                    )
                  }
                  description={
                    <span style={{ 
                      fontSize: '12px', 
                      color: currentSession?.id === session.id ? 'rgba(255,255,255,0.8)' : '#999'
                    }}>
                      {new Date(session.created_at).toLocaleString()}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#8c8c8c'
          }}>
            <MessageOutlined style={{ 
              fontSize: '48px', 
              marginBottom: '16px',
              color: '#d9d9d9'
            }} />
            <div style={{ fontSize: '16px', marginBottom: '8px', fontWeight: 500 }}>
              暂无对话历史
            </div>
            <div style={{ fontSize: '14px', color: '#999' }}>
              {currentAgent ? '点击上方按钮开始新对话' : '请先选择一个 Agent'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMode;
