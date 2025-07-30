import React, { useEffect, useState } from 'react';
import {
  Button,
  List,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Card,
  Space,
  Popconfirm,
  Avatar,
  Tag,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  MessageOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../store';
import type { ChatSession } from '../types';
import { agentApi } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const Sidebar: React.FC = () => {
  const {
    agents,
    currentAgent,
    sessions,
    currentSession,
    setAgents,
    setCurrentAgent,
    setCurrentSession,
    createSession,
    deleteSession,
    loadSessionsFromStorage,
    setLoading,
    setError,
  } = useAppStore();

  const [newSessionModalOpen, setNewSessionModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 加载数据
  useEffect(() => {
    loadAgents();
    loadSessionsFromStorage();
  }, [loadSessionsFromStorage]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      console.log('开始加载 agents...');
      const agentsData = await agentApi.getAll();
      console.log('加载到的 agents 数据:', agentsData);
      setAgents(agentsData);
      if (agentsData.length > 0 && !currentAgent) {
        console.log('设置当前 agent:', agentsData[0]);
        setCurrentAgent(agentsData[0]);
      }
    } catch (error) {
      setError('加载 Agent 列表失败');
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionSelect = (session: any) => {
    setCurrentSession(session);

    // 设置当前 Agent
    const agent = agents.find(a => a.id === session.agent_id);
    if (agent) {
      setCurrentAgent(agent);
    }
  };

  const handleCreateSession = async (values: any) => {
    try {
      const agent = agents.find(a => a.id === values.agent_id);
      if (!agent) return;

      const newSession = createSession(agent, values.title);
      setCurrentAgent(agent);

      setNewSessionModalOpen(false);
      form.resetFields();
    } catch (error) {
      setError('创建会话失败');
      console.error('Error creating session:', error);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 16px',
      background: '#fafafa'
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
          size="large"
          block
          onClick={() => setNewSessionModalOpen(true)}
          disabled={agents.length === 0}
          style={{
            borderRadius: '8px',
            height: '44px',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          新建对话
        </Button>
      </div>

      {/* 当前 Agent */}
      {currentAgent && (
        <Card
          style={{
            marginBottom: '20px',
            borderRadius: '12px',
            border: '1px solid #e8e8e8',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
          }}
          styles={{ body: { padding: '16px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <Avatar
              icon={<RobotOutlined />}
              size="default"
              style={{
                marginRight: '12px',
                backgroundColor: '#1890ff'
              }}
            />
            <div style={{ flex: 1 }}>
              <Text strong style={{ fontSize: '14px', color: '#262626' }}>
                {currentAgent.name}
              </Text>
            </div>
          </div>
          <Text type="secondary" style={{ fontSize: '13px', lineHeight: '1.4' }}>
            {currentAgent.description || '暂无描述'}
          </Text>
          {currentAgent.mcp_tools && currentAgent.mcp_tools.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <Text type="secondary" style={{ fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                可用工具:
              </Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {currentAgent.mcp_tools.map((tool, index) => (
                  <Tag key={index} color="blue" style={{ fontSize: '11px', margin: 0 }}>
                    {tool}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <Divider style={{ margin: '0 0 20px 0' }} />

      {/* 会话列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ marginBottom: '12px' }}>
          <Text type="secondary" style={{ fontSize: '13px', fontWeight: 500 }}>
            💬 对话历史
          </Text>
        </div>
        <List
          dataSource={sessions}
          renderItem={(session: ChatSession) => (
            <List.Item
              key={session.id}
              style={{
                cursor: 'pointer',
                backgroundColor: currentSession?.id === session.id ? '#e6f7ff' : '#fff',
                borderRadius: '8px',
                marginBottom: '8px',
                padding: '12px',
                border: currentSession?.id === session.id ? '1px solid #91d5ff' : '1px solid #f0f0f0',
                transition: 'all 0.2s ease',
                boxShadow: currentSession?.id === session.id ? '0 2px 8px rgba(24, 144, 255, 0.2)' : '0 1px 4px rgba(0, 0, 0, 0.04)'
              }}
              onClick={() => handleSessionSelect(session)}
              actions={[
                <Popconfirm
                  key="delete"
                  title="确定删除这个会话吗？"
                  onConfirm={() => handleDeleteSession(session.id)}
                  okText="确定"
                  cancelText="取消"
                  placement="topRight"
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    style={{
                      color: '#ff4d4f',
                      opacity: 0.6
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.opacity = '0.6';
                    }}
                  />
                </Popconfirm>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    icon={<MessageOutlined />}
                    size="default"
                    style={{
                      backgroundColor: currentSession?.id === session.id ? '#1890ff' : '#52c41a'
                    }}
                  />
                }
                title={
                  <Text
                    ellipsis
                    style={{
                      fontSize: '14px',
                      fontWeight: currentSession?.id === session.id ? 500 : 400,
                      color: currentSession?.id === session.id ? '#1890ff' : '#262626'
                    }}
                  >
                    {session.title}
                  </Text>
                }
                description={
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {session.messages.length} 条消息 • {session.agent_name}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
        {sessions.length === 0 && (
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
            <Space>
              <Button onClick={() => setNewSessionModalOpen(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Sidebar;
