import { useEffect, useState } from 'react';
import { Typography, Modal, message, ConfigProvider, theme } from 'antd';
import ChatMode from './components/ChatMode';
import ChatArea from './components/ChatArea';
import AgentManager from './components/AgentManager';
import MCPServerManager from './components/MCPServerManager';
import TabNavigation from './components/TabNavigation';
import { useAppStore } from './store';
import { agentApi } from './services/api';
import 'antd/dist/reset.css';
import './App.css';
import { THEME } from './theme';

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

  // 创建新对话：直接使用当前已选择的 Agent，不再二次选择
  const handleCreateSession = () => {
    if (!currentAgent) {
      message.error('请先在上方选择一个 Agent');
      return;
    }
    const newSession = createSession(currentAgent, '新建对话');
    if (newSession) {
      message.success('新对话创建成功');
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
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: THEME.colors.primary,
          borderRadius: THEME.radius,
          colorBgLayout: '#f7f8fa',
        },
      }}
    >
      <div className="app-container" style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #eef2ff 0%, #fafafa 100%)',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}>
        {/* 顶部标题栏 */}
        <div style={{
          padding: '16px 20px',
          background: '#ffffff',
          borderBottom: '1px solid #eee',
          boxShadow: '0 1px 6px rgba(0, 0, 0, 0.06)',
          flexShrink: 0
        }}>
          <Title level={3} style={{
            margin: 0,
            color: '#2b2f36',
            fontWeight: 700
          }}>
            AI Agents 管理平台
          </Title>
        </div>

        {/* 主内容区域 */}
        <div style={{
          flex: 1,
          margin: '12px',
          borderRadius: '12px',
          background: '#ffffff',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row',
          minHeight: 0
        }}>
          {/* 左侧：Tab 导航 + 管理内容 */}
          <div style={{
            width: `${THEME.sidebarWidth}px`,
            borderRight: '1px solid #eee',
            display: 'flex',
            flexDirection: 'column',
            background: '#fafafa',
            flexShrink: 0
          }}>
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
            {/* 左侧底部 Tab 导航 */}
            <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {/* 中间间隙 */}
          <div style={{ width: 12, flexShrink: 0, background: 'linear-gradient(135deg, #eef2ff 0%, #fafafa 100%)' }} />

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

        {/* 新建对话模态框（不再需要选择 Agent，暂时隐藏） */}
        {/* 保留结构以便未来扩展标题等 */}
        <Modal open={false} footer={null} />
      </div>
    </ConfigProvider>
  );
}

export default App;