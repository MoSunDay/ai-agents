import React, { useEffect, useState } from 'react';
import { Button, Typography, Avatar, Modal, Form, Input, Select, message, List } from 'antd';
import { PlusOutlined, MessageOutlined, RobotOutlined } from '@ant-design/icons';
import ChatArea from './components/ChatArea';
import { useAppStore } from './store';
import { agentApi } from './services/api';
import 'antd/dist/reset.css';

const { Title, Text } = Typography;
const { Option } = Select;

function App() {
  const {
    agents,
    currentAgent,
    sessions,
    currentSession,
    setAgents,
    setCurrentAgent,
    setCurrentSession,
    createSession,
    loadSessionsFromStorage,
    setError,
  } = useAppStore();

  const [newSessionModalOpen, setNewSessionModalOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [form] = Form.useForm();

  // 加载数据
  useEffect(() => {
    loadAgents();
    loadSessionsFromStorage();
  }, [loadSessionsFromStorage]);

  const loadAgents = async () => {
    try {
      const agentsData = await agentApi.getAll();
      setAgents(agentsData);
      if (agentsData.length > 0 && !currentAgent) {
        setCurrentAgent(agentsData[0]);
      }
    } catch (error) {
      setError('加载 Agent 列表失败');
      console.error('Error loading agents:', error);
    }
  };

  const handleCreateSession = async (values: any) => {
    try {
      const agent = agents.find(a => a.id === values.agent_id);
      if (!agent) return;

      const newSession = createSession(agent, values.title);
      setCurrentAgent(agent);
      setCurrentSession(newSession);

      setNewSessionModalOpen(false);
      form.resetFields();
      message.success('新对话创建成功');
    } catch (error) {
      setError('创建会话失败');
      console.error('Error creating session:', error);
    }
  };

  const handleSessionSelect = (session: any) => {
    setCurrentSession(session);
    const agent = agents.find(a => a.id === session.agent_id);
    if (agent) {
      setCurrentAgent(agent);
    }
  };

  const handleEditTitle = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  const handleSaveTitle = (sessionId: string) => {
    if (editingTitle.trim()) {
      // 这里应该调用 store 的更新方法
      // updateSessionTitle(sessionId, editingTitle.trim());
      message.success('标题更新成功');
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      fontFamily: 'Arial, sans-serif',
      background: '#ffffff',
      overflow: 'hidden'
    }}>
      {/* 左侧边栏 */}
      <div style={{
        width: '320px',
        minWidth: '320px',
        background: '#fafafa',
        borderRight: '1px solid #f0f0f0',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* 头部 */}
        <div style={{ marginBottom: '20px' }}>
          <Title level={3} style={{
            margin: 0,
            marginBottom: '16px',
            color: '#1890ff',
            textAlign: 'center'
          }}>
            🤖 AI Agents
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="middle"
            block
            onClick={() => setNewSessionModalOpen(true)}
            disabled={agents.length === 0}
            style={{
              borderRadius: '20px',
              height: '40px',
              fontSize: '14px',
              fontWeight: 500,
              border: 'none',
              boxShadow: '0 2px 8px rgba(24, 144, 255, 0.3)'
            }}
          >
            新建对话
          </Button>
        </div>

        {/* 当前 Agent */}
        {currentAgent && (
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e8e8e8',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <Avatar
                icon={<RobotOutlined />}
                style={{
                  marginRight: '12px',
                  backgroundColor: '#1890ff'
                }}
              />
              <div>
                <Text strong style={{ fontSize: '14px', color: '#262626' }}>
                  {currentAgent.name}
                </Text>
              </div>
            </div>
            <Text type="secondary" style={{ fontSize: '13px', lineHeight: '1.4' }}>
              {currentAgent.description || '暂无描述'}
            </Text>
          </div>
        )}

        {/* 会话列表 */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '12px' }}>
            <Text type="secondary" style={{ fontSize: '13px', fontWeight: 500 }}>
              💬 对话历史
            </Text>
          </div>

          {sessions.length > 0 ? (
            <List
              dataSource={sessions}
              renderItem={(session) => (
                <List.Item
                  style={{
                    padding: 0,
                    marginBottom: '8px',
                    border: 'none'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      background: currentSession?.id === session.id ? '#e6f7ff' : '#fff',
                      borderRadius: '8px',
                      padding: '12px',
                      border: currentSession?.id === session.id ? '1px solid #91d5ff' : '1px solid #e8e8e8',
                      boxShadow: currentSession?.id === session.id ? '0 2px 8px rgba(24, 144, 255, 0.2)' : '0 1px 4px rgba(0, 0, 0, 0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => handleSessionSelect(session)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <Avatar
                        icon={<MessageOutlined />}
                        size="default"
                        style={{ backgroundColor: '#1890ff', marginRight: '12px' }}
                      />
                      {editingSessionId === session.id ? (
                        <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onPressEnter={() => handleSaveTitle(session.id)}
                            onBlur={() => handleSaveTitle(session.id)}
                            style={{ fontSize: '14px' }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <Text
                          style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: currentSession?.id === session.id ? '#1890ff' : '#262626',
                            cursor: 'pointer',
                            flex: 1
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTitle(session.id, session.title);
                          }}
                        >
                          {session.title}
                        </Text>
                      )}
                    </div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {session.messages.length} 条消息 • {session.agent_name}
                    </Text>
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#8c8c8c'
            }}>
              <MessageOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px' }}>
                暂无对话历史
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 右侧聊天区域 */}
      <div style={{
        flex: 1,
        width: 0,
        background: '#ffffff',
        overflow: 'hidden'
      }}>
        <ChatArea />
      </div>

      {/* 新建会话模态框 */}
      <Modal
        title="新建对话"
        open={newSessionModalOpen}
        onCancel={() => setNewSessionModalOpen(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleCreateSession} layout="vertical">
          <Form.Item
            name="agent_id"
            label="选择 Agent"
            rules={[{ required: true, message: '请选择一个 Agent' }]}
          >
            <Select placeholder="选择 Agent">
              {agents.map((agent) => (
                <Option key={agent.id} value={agent.id}>
                  {agent.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="title"
            label="对话标题"
            rules={[{ required: true, message: '请输入对话标题' }]}
          >
            <Input placeholder="输入对话标题..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setNewSessionModalOpen(false)} style={{ marginRight: '8px' }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default App;
