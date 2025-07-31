import { useEffect, useState } from 'react';
import { Button, Typography, Avatar, Input, message, List, Popconfirm, Tabs, Form, Select, Modal } from 'antd';
import { PlusOutlined, MessageOutlined, RobotOutlined, DeleteOutlined, SettingOutlined, EditOutlined } from '@ant-design/icons';
import ChatArea from './components/ChatArea';
import { useAppStore } from './store';
import { agentApi } from './services/api';
import 'antd/dist/reset.css';

const { Title, Text } = Typography;

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
    updateSessionTitle,
    deleteSession,
    loadSessionsFromStorage,
    setError,
  } = useAppStore();

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [agentForm] = Form.useForm();
  const [newSessionModalOpen, setNewSessionModalOpen] = useState(false);
  const [sessionForm] = Form.useForm();

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

  const handleCreateSession = () => {
    if (agents.length === 0) {
      message.error('请先创建一个 Agent');
      setActiveTab('manage');
      return;
    }
    setNewSessionModalOpen(true);
  };

  const handleCreateSessionSubmit = (values: any) => {
    try {
      const agent = agents.find(a => a.id === values.agent_id);
      if (!agent) {
        message.error('请选择一个有效的 Agent');
        return;
      }

      const newSession = createSession(agent, values.title || '新建对话');
      setCurrentAgent(agent);
      setCurrentSession(newSession);

      setNewSessionModalOpen(false);
      sessionForm.resetFields();
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
      updateSessionTitle(sessionId, editingTitle.trim());
      message.success('标题更新成功');
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
    message.success('对话已删除');
  };

  // Agent 管理功能
  const handleCreateAgent = () => {
    setEditingAgent(null);
    agentForm.resetFields();
    setAgentModalOpen(true);
  };

  const handleEditAgent = (agent: any) => {
    setEditingAgent(agent);
    agentForm.setFieldsValue({
      name: agent.name,
      description: agent.description,
      prompt: agent.prompt,
      mcp_tools: agent.mcp_tools
    });
    setAgentModalOpen(true);
  };

  const handleSaveAgent = async (values: any) => {
    try {
      if (editingAgent) {
        // 更新 Agent
        const updatedAgent = { ...editingAgent, ...values };
        const updatedAgents = agents.map(a => a.id === editingAgent.id ? updatedAgent : a);
        setAgents(updatedAgents);
        message.success('Agent 更新成功');
      } else {
        // 创建新 Agent
        const newAgent = {
          id: Date.now(),
          ...values,
          openai_config: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setAgents([...agents, newAgent]);
        message.success('Agent 创建成功');
      }
      setAgentModalOpen(false);
      agentForm.resetFields();
    } catch (error) {
      message.error('保存失败');
      console.error('Error saving agent:', error);
    }
  };

  const handleDeleteAgent = (agentId: number) => {
    const updatedAgents = agents.filter(a => a.id !== agentId);
    setAgents(updatedAgents);
    
    // 如果删除的是当前 Agent，切换到第一个可用的 Agent
    if (currentAgent?.id === agentId) {
      setCurrentAgent(updatedAgents[0] || null);
    }
    
    message.success('Agent 已删除');
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
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* 头部 */}
        <div style={{ padding: '20px 16px 0', marginBottom: '16px' }}>
          <Title level={3} style={{ 
            margin: 0, 
            marginBottom: '16px',
            color: '#1890ff',
            textAlign: 'center'
          }}>
            🤖 AI Agents
          </Title>
        </div>

        {/* 主要内容区域 */}
        <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'chat' ? (
            // 聊天模式内容
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* 新建对话按钮 */}
              <div style={{ marginBottom: '20px' }}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="large"
                  block
                  onClick={handleCreateSession}
                  style={{
                    borderRadius: '12px',
                    height: '48px',
                    fontSize: '15px',
                    fontWeight: 600,
                    border: 'none',
                    background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                    boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  新建对话
                </Button>
              </div>

              {/* 当前 Agent */}
              {currentAgent && (
                <div style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                  borderRadius: '16px',
                  border: '1px solid #e8e8e8',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                  padding: '20px',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <Avatar
                      icon={<RobotOutlined />}
                      size={48}
                      style={{
                        marginRight: '16px',
                        background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                        boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)'
                      }}
                    />
                    <div>
                      <Text strong style={{ fontSize: '16px', color: '#262626', display: 'block' }}>
                        {currentAgent.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '13px', lineHeight: '1.4' }}>
                        当前选中的 Agent
                      </Text>
                    </div>
                  </div>
                  <Text type="secondary" style={{ fontSize: '14px', lineHeight: '1.5' }}>
                    {currentAgent.description || '暂无描述'}
                  </Text>
                </div>
              )}

              {/* 会话列表 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '16px' }}>
                  <Text strong style={{ fontSize: '15px', color: '#262626' }}>
                    💬 对话历史
                  </Text>
                </div>

                {sessions.length > 0 ? (
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    paddingRight: '4px',
                    maxHeight: 'calc(100vh - 400px)' // 限制最大高度
                  }}>
                    <List
                      dataSource={sessions}
                      renderItem={(session) => (
                      <List.Item
                        style={{
                          padding: 0,
                          marginBottom: '12px',
                          border: 'none'
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            background: currentSession?.id === session.id
                              ? 'linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%)'
                              : '#fff',
                            borderRadius: '12px',
                            padding: '16px',
                            border: currentSession?.id === session.id
                              ? '2px solid #1890ff'
                              : '1px solid #e8e8e8',
                            boxShadow: currentSession?.id === session.id
                              ? '0 4px 16px rgba(24, 144, 255, 0.2)'
                              : '0 2px 8px rgba(0, 0, 0, 0.06)',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            position: 'relative'
                          }}
                          onClick={() => handleSessionSelect(session)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                            <Avatar
                              icon={<MessageOutlined />}
                              size="default"
                              style={{
                                backgroundColor: currentSession?.id === session.id ? '#1890ff' : '#52c41a',
                                marginRight: '12px'
                              }}
                            />
                            {editingSessionId === session.id ? (
                              <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                                <Input
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onPressEnter={() => handleSaveTitle(session.id)}
                                  onBlur={() => handleSaveTitle(session.id)}
                                  style={{ fontSize: '14px', borderRadius: '8px' }}
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <Text
                                style={{
                                  fontSize: '15px',
                                  fontWeight: 600,
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
                            <Popconfirm
                              title="确定要删除这个对话吗？"
                              description="删除后无法恢复"
                              onConfirm={(e) => {
                                e?.stopPropagation();
                                handleDeleteSession(session.id);
                              }}
                              okText="删除"
                              cancelText="取消"
                              placement="topRight"
                            >
                              <Button
                                type="text"
                                icon={<DeleteOutlined />}
                                size="small"
                                danger
                                style={{
                                  opacity: 0.6,
                                  padding: '4px 8px',
                                  borderRadius: '8px',
                                  height: 'auto'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </Popconfirm>
                          </div>
                          <Text type="secondary" style={{ fontSize: '13px' }}>
                            {session.messages.length} 条消息 • {session.agent_name}
                          </Text>
                        </div>
                      </List.Item>
                    )}
                    />
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#8c8c8c',
                    background: '#fafafa',
                    borderRadius: '12px',
                    border: '2px dashed #d9d9d9'
                  }}>
                    <MessageOutlined style={{ fontSize: '32px', marginBottom: '12px', color: '#bfbfbf' }} />
                    <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>
                      暂无对话历史
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      点击上方按钮创建新对话
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // 管理 Agent 模式内容
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* 新建 Agent 按钮 */}
              <div style={{ marginBottom: '20px' }}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="large"
                  block
                  onClick={handleCreateAgent}
                  style={{
                    borderRadius: '12px',
                    height: '48px',
                    fontSize: '15px',
                    fontWeight: 600,
                    border: 'none',
                    background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                    boxShadow: '0 4px 12px rgba(82, 196, 26, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  新建 Agent
                </Button>
              </div>

              {/* Agent 列表 */}
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '16px' }}>
                  <Text strong style={{ fontSize: '15px', color: '#262626' }}>
                    🤖 Agent 列表
                  </Text>
                </div>

                {agents.length > 0 ? (
                  <List
                    dataSource={agents}
                    renderItem={(agent) => (
                      <List.Item
                        style={{
                          padding: 0,
                          marginBottom: '12px',
                          border: 'none'
                        }}
                      >
                        <div style={{
                          width: '100%',
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                          borderRadius: '12px',
                          padding: '16px',
                          border: '1px solid #e8e8e8',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                          transition: 'all 0.3s ease',
                          position: 'relative'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                            <Avatar
                              icon={<RobotOutlined />}
                              size={40}
                              style={{
                                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                                marginRight: '12px',
                                boxShadow: '0 2px 8px rgba(24, 144, 255, 0.3)'
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <Text strong style={{ fontSize: '15px', color: '#262626', display: 'block' }}>
                                {agent.name}
                              </Text>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <Button
                                type="text"
                                icon={<EditOutlined />}
                                size="small"
                                onClick={() => handleEditAgent(agent)}
                                style={{
                                  opacity: 0.7,
                                  padding: '4px 8px',
                                  borderRadius: '8px',
                                  height: 'auto'
                                }}
                              />
                              <Popconfirm
                                title="确定要删除这个 Agent 吗？"
                                description="删除后无法恢复"
                                onConfirm={() => handleDeleteAgent(agent.id)}
                                okText="删除"
                                cancelText="取消"
                                placement="topRight"
                              >
                                <Button
                                  type="text"
                                  icon={<DeleteOutlined />}
                                  size="small"
                                  danger
                                  style={{
                                    opacity: 0.7,
                                    padding: '4px 8px',
                                    borderRadius: '8px',
                                    height: 'auto'
                                  }}
                                />
                              </Popconfirm>
                            </div>
                          </div>
                          <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: '8px', lineHeight: '1.4' }}>
                            {agent.description || '暂无描述'}
                          </Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            工具: {agent.mcp_tools.length > 0 ? agent.mcp_tools.join(', ') : '无'}
                          </Text>
                        </div>
                      </List.Item>
                    )}
                  />
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#8c8c8c',
                    background: '#fafafa',
                    borderRadius: '12px',
                    border: '2px dashed #d9d9d9'
                  }}>
                    <RobotOutlined style={{ fontSize: '32px', marginBottom: '12px', color: '#bfbfbf' }} />
                    <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>
                      暂无 Agent
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      点击上方按钮创建新 Agent
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tab 切换 - 放在底部 */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid #f0f0f0',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)'
        }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            centered
            size="large"
            items={[
              {
                key: 'chat',
                label: (
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>
                    <MessageOutlined style={{ marginRight: '6px' }} />
                    聊天模式
                  </span>
                )
              },
              {
                key: 'manage',
                label: (
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>
                    <SettingOutlined style={{ marginRight: '6px' }} />
                    管理 Agent
                  </span>
                )
              }
            ]}
          />
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

      {/* Agent 管理模态框 */}
      <Modal
        title={
          <span style={{ fontSize: '18px', fontWeight: 600 }}>
            {editingAgent ? '编辑 Agent' : '新建 Agent'}
          </span>
        }
        open={agentModalOpen}
        onCancel={() => setAgentModalOpen(false)}
        footer={null}
        width={600}
        style={{ borderRadius: '16px' }}
      >
        <Form form={agentForm} onFinish={handleSaveAgent} layout="vertical">
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 600 }}>Agent 名称</span>}
            rules={[{ required: true, message: '请输入 Agent 名称' }]}
          >
            <Input
              placeholder="输入 Agent 名称..."
              style={{ borderRadius: '8px', padding: '8px 12px' }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label={<span style={{ fontWeight: 600 }}>描述</span>}
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <Input.TextArea
              placeholder="输入 Agent 描述..."
              rows={3}
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="prompt"
            label={<span style={{ fontWeight: 600 }}>系统提示词</span>}
            rules={[{ required: true, message: '请输入系统提示词' }]}
          >
            <Input.TextArea
              placeholder="输入系统提示词..."
              rows={4}
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="mcp_tools"
            label={<span style={{ fontWeight: 600 }}>MCP 工具</span>}
          >
            <Select
              mode="tags"
              placeholder="选择或输入 MCP 工具..."
              style={{ borderRadius: '8px' }}
              options={[
                { label: 'file_operations', value: 'file_operations' },
                { label: 'web_search', value: 'web_search' },
                { label: 'code_execution', value: 'code_execution' },
                { label: 'database', value: 'database' },
                { label: 'api_client', value: 'api_client' }
              ]}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: '24px' }}>
            <Button
              onClick={() => setAgentModalOpen(false)}
              style={{
                marginRight: '12px',
                borderRadius: '8px',
                padding: '6px 20px',
                height: 'auto'
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              style={{
                borderRadius: '8px',
                padding: '6px 20px',
                height: 'auto',
                background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                border: 'none',
                fontWeight: 600
              }}
            >
              {editingAgent ? '更新' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 新建对话模态框 */}
      <Modal
        title={
          <span style={{ fontSize: '18px', fontWeight: 600 }}>
            新建对话
          </span>
        }
        open={newSessionModalOpen}
        onCancel={() => setNewSessionModalOpen(false)}
        footer={null}
        width={500}
        style={{ borderRadius: '16px' }}
      >
        <Form form={sessionForm} onFinish={handleCreateSessionSubmit} layout="vertical">
          <Form.Item
            name="agent_id"
            label={<span style={{ fontWeight: 600 }}>选择 Agent</span>}
            rules={[{ required: true, message: '请选择一个 Agent' }]}
          >
            <Select
              placeholder="请选择要使用的 Agent..."
              style={{ borderRadius: '8px' }}
              size="large"
              optionLabelProp="label"
            >
              {agents.map((agent) => (
                <Select.Option
                  key={agent.id}
                  value={agent.id}
                  label={
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar
                        icon={<RobotOutlined />}
                        size={16}
                        style={{
                          backgroundColor: '#1890ff',
                          marginRight: '6px'
                        }}
                      />
                      {agent.name}
                    </span>
                  }
                >
                  <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                    <Avatar
                      icon={<RobotOutlined />}
                      size="small"
                      style={{
                        backgroundColor: '#1890ff',
                        marginRight: '8px'
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '2px' }}>{agent.name}</div>
                      <div style={{ fontSize: '12px', color: '#8c8c8c', lineHeight: '1.2' }}>
                        {agent.description}
                      </div>
                    </div>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label={<span style={{ fontWeight: 600 }}>对话标题</span>}
            initialValue="新建对话"
          >
            <Input
              placeholder="输入对话标题..."
              style={{ borderRadius: '8px', padding: '8px 12px' }}
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: '24px' }}>
            <Button
              onClick={() => setNewSessionModalOpen(false)}
              style={{
                marginRight: '12px',
                borderRadius: '8px',
                padding: '6px 20px',
                height: 'auto'
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              style={{
                borderRadius: '8px',
                padding: '6px 20px',
                height: 'auto',
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                border: 'none',
                fontWeight: 600
              }}
            >
              创建对话
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default App;
