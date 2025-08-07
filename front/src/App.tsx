import { useEffect, useState } from 'react';
import { Button, Typography, Modal, Form, Select, message, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import ChatMode from './components/ChatMode';
import ChatArea from './components/ChatArea';
import AgentManager from './components/AgentManager';
import MCPServerManager from './components/MCPServerManager';
import TabNavigation from './components/TabNavigation';
import { useAppStore } from './store';
import { agentApi } from './services/api';
import type { Agent } from './types';
import 'antd/dist/reset.css';
import './App.css';

const { Title } = Typography;

function App() {
  const {
    agents,
    setAgents,
    currentAgent,
    setCurrentAgent,
    createSession,
    loadSessionsFromStorage
  } = useAppStore();

  const [activeTab, setActiveTab] = useState('chat');
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
      console.error('Error loading agents:', error);
    }
  };

  // 创建新对话
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

      setNewSessionModalOpen(false);
      sessionForm.resetFields();
      message.success('新对话创建成功');
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const renderChatArea = () => {
    const { currentSession, currentAgent } = useAppStore();

    if (activeTab !== 'chat') {
      // 非聊天模式下显示提示信息
      return (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          color: '#8c8c8c',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)'
        }}>
          <div style={{
            padding: '40px',
            borderRadius: '20px',
            background: '#ffffff',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            textAlign: 'center',
            maxWidth: '400px'
          }}>
            <div style={{
              fontSize: '64px',
              marginBottom: '24px',
              color: '#667eea'
            }}>
              {activeTab === 'manage' ? '⚙️' : '🔧'}
            </div>
            <div style={{
              fontSize: '20px',
              marginBottom: '12px',
              fontWeight: 600,
              color: '#262626'
            }}>
              {activeTab === 'manage' ? 'Agent 管理模式' : 'MCP 服务器管理'}
            </div>
            <div style={{
              fontSize: '15px',
              color: '#8c8c8c',
              lineHeight: '1.5'
            }}>
              {activeTab === 'manage'
                ? '在左侧管理您的 AI Agent'
                : '在左侧管理您的 MCP 服务器'}
            </div>
          </div>
        </div>
      );
    }

    // 聊天模式下显示聊天区域
    if (currentSession && currentAgent) {
      return <ChatArea />;
    } else {
      return (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          color: '#8c8c8c',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)'
        }}>
          <div style={{
            padding: '40px',
            borderRadius: '20px',
            background: '#ffffff',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            textAlign: 'center',
            maxWidth: '400px'
          }}>
            <div style={{
              fontSize: '80px',
              marginBottom: '24px',
              color: '#667eea'
            }}>
              💬
            </div>
            <div style={{
              fontSize: '20px',
              marginBottom: '12px',
              fontWeight: 600,
              color: '#262626'
            }}>
              {!currentAgent ? '请选择一个 Agent' : '请选择或创建一个对话'}
            </div>
            <div style={{
              fontSize: '15px',
              color: '#8c8c8c',
              lineHeight: '1.5'
            }}>
              {!currentAgent ? '从左侧选择一个 Agent 开始对话' : '点击"新建对话"开始聊天'}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="app-container" style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      {/* 顶部标题栏 */}
      <div style={{
        padding: '20px 24px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 2px 20px rgba(0, 0, 0, 0.1)',
        flexShrink: 0
      }}>
        <Title level={2} style={{
          margin: 0,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 700
        }}>
          AI Agents 管理平台
        </Title>
      </div>

      {/* 主内容区域 */}
      <div style={{
        flex: 1,
        margin: '16px',
        borderRadius: '16px',
        background: '#ffffff',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'row',  // 改为水平布局
        minHeight: 0
      }}>
        {/* 左侧：Tab 导航 + 管理内容 */}
        <div style={{
          width: '400px',
          borderRight: '1px solid #e8e9ea',
          display: 'flex',
          flexDirection: 'column',
          background: '#f8f9fa',
          flexShrink: 0
        }}>
          {/* Tab 导航 */}
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

          {/* 管理内容区域 */}
          <div style={{
            flex: 1,
            overflow: 'hidden',
            minHeight: 0
          }}>
            {activeTab === 'manage' ? (
              <AgentManager agents={agents} onAgentsChange={setAgents} />
            ) : activeTab === 'mcp' ? (
              <MCPServerManager />
            ) : (
              // 聊天模式下显示 Agent 选择和对话历史
              <ChatMode agents={agents} onCreateSession={handleCreateSession} />
            )}
          </div>
        </div>

        {/* 右侧：聊天区域 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          minHeight: 0,
          overflow: 'hidden'
        }}>
          {renderChatArea()}
        </div>
      </div>

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
              placeholder="请选择要对话的 Agent"
              style={{ borderRadius: '8px' }}
              options={agents.map(agent => ({
                label: agent.name,
                value: agent.id
              }))}
            />
          </Form.Item>

          <Form.Item
            name="title"
            label={<span style={{ fontWeight: 600 }}>对话标题</span>}
          >
            <Input
              placeholder="为这次对话起个名字（可选）"
              style={{ borderRadius: '8px', padding: '10px 12px' }}
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
              icon={<PlusOutlined />}
              style={{
                borderRadius: '8px',
                padding: '6px 20px',
                height: 'auto',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none'
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