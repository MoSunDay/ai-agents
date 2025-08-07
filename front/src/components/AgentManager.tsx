import { useState, useEffect } from 'react';
import { Button, List, Avatar, Popconfirm, message, Modal, Form, Input, Select, Checkbox, Divider } from 'antd';
import { PlusOutlined, RobotOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { agentApi, mcpApi } from '../services/api';
import type { Agent, MCPServer } from '../types';

interface AgentManagerProps {
  agents: Agent[];
  onAgentsChange: (agents: Agent[]) => void;
}

const AgentManager: React.FC<AgentManagerProps> = ({ agents, onAgentsChange }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form] = Form.useForm();
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);

  useEffect(() => {
    loadMcpServers();
  }, []);

  const loadMcpServers = async () => {
    try {
      const servers = await mcpApi.getServers();
      setMcpServers(servers);
    } catch (error) {
      console.error('加载 MCP 服务器失败:', error);
    }
  };

  const handleCreate = () => {
    setEditingAgent(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    form.setFieldsValue({
      name: agent.name,
      description: agent.description,
      prompt: agent.prompt,
      mcp_tools: agent.mcp_tools
    });
    setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    try {
      if (editingAgent) {
        const updatedAgent = await agentApi.update(editingAgent.id, values);
        const updatedAgents = agents.map(a => a.id === editingAgent.id ? updatedAgent : a);
        onAgentsChange(updatedAgents);
        message.success('Agent 更新成功');
      } else {
        const newAgent = await agentApi.create(values);
        onAgentsChange([...agents, newAgent]);
        message.success('Agent 创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingAgent(null);
    } catch (error) {
      message.error('保存 Agent 失败');
      console.error('Error saving agent:', error);
    }
  };

  const handleDelete = async (agentId: number) => {
    try {
      await agentApi.delete(agentId);
      const updatedAgents = agents.filter(a => a.id !== agentId);
      onAgentsChange(updatedAgents);
      message.success('Agent 删除成功');
    } catch (error) {
      message.error('删除 Agent 失败');
      console.error('Error deleting agent:', error);
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
      padding: '24px'
    }}>
      {/* 新建 Agent 按钮 */}
      <div style={{ marginBottom: '24px' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          block
          onClick={handleCreate}
          style={{
            borderRadius: '16px',
            height: '56px',
            fontSize: '16px',
            fontWeight: 600,
            border: 'none',
            background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
            boxShadow: '0 6px 20px rgba(82, 196, 26, 0.4)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(82, 196, 26, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(82, 196, 26, 0.4)';
          }}
        >
          创建新的 Agent
        </Button>
      </div>

      {/* Agent 列表 */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        minHeight: 0  // 重要：确保可以收缩
      }}>
        {agents.length > 0 ? (
          <List
            dataSource={agents}
            renderItem={(agent) => (
              <List.Item
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  marginBottom: '16px',
                  padding: '20px',
                  border: '1px solid #e8e9ea',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08)';
                }}
                actions={[
                  <Button
                    key="edit"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(agent)}
                    style={{
                      color: '#1890ff',
                      borderRadius: '8px',
                      padding: '6px 12px'
                    }}
                  >
                    编辑
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="确定要删除这个 Agent 吗？"
                    onConfirm={() => handleDelete(agent.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      danger
                      style={{
                        borderRadius: '8px',
                        padding: '6px 12px'
                      }}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size={48}
                      style={{
                        backgroundColor: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                        background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                        color: '#ffffff',
                        boxShadow: '0 4px 12px rgba(82, 196, 26, 0.3)'
                      }}
                      icon={<RobotOutlined style={{ fontSize: '20px' }} />}
                    />
                  }
                  title={
                    <span style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      color: '#262626',
                      marginBottom: '4px',
                      display: 'block'
                    }}>
                      {agent.name}
                    </span>
                  }
                  description={
                    <div>
                      <div style={{
                        marginBottom: '8px',
                        color: '#666',
                        fontSize: '14px',
                        lineHeight: '1.5'
                      }}>
                        {agent.description}
                      </div>
                      {agent.mcp_tools && agent.mcp_tools.length > 0 && (
                        <div style={{
                          fontSize: '12px',
                          color: '#52c41a',
                          background: 'rgba(82, 196, 26, 0.1)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          display: 'inline-block'
                        }}>
                          🔧 MCP 工具: {agent.mcp_tools.join(', ')}
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: '#8c8c8c',
            background: '#ffffff',
            borderRadius: '16px',
            border: '2px dashed #e8e9ea'
          }}>
            <RobotOutlined style={{
              fontSize: '64px',
              marginBottom: '20px',
              color: '#d9d9d9'
            }} />
            <div style={{
              fontSize: '18px',
              marginBottom: '12px',
              fontWeight: 600,
              color: '#666'
            }}>
              暂无 Agent
            </div>
            <div style={{
              fontSize: '15px',
              color: '#999',
              lineHeight: '1.5'
            }}>
              点击上方按钮创建您的第一个 Agent
            </div>
          </div>
        )}
      </div>

      {/* Agent 创建/编辑模态框 */}
      <Modal
        title={
          <span style={{ fontSize: '18px', fontWeight: 600 }}>
            {editingAgent ? '编辑 Agent' : '新建 Agent'}
          </span>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
        style={{ borderRadius: '16px' }}
      >
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 600 }}>Agent 名称</span>}
            rules={[{ required: true, message: '请输入 Agent 名称' }]}
          >
            <Input
              placeholder="例如：智能助手"
              style={{ borderRadius: '8px', padding: '10px 12px' }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label={<span style={{ fontWeight: 600 }}>描述</span>}
            rules={[{ required: true, message: '请输入 Agent 描述' }]}
          >
            <Input.TextArea
              placeholder="描述这个 Agent 的功能和特点..."
              rows={3}
              style={{ borderRadius: '8px', padding: '10px 12px' }}
            />
          </Form.Item>

          <Form.Item
            name="prompt"
            label={<span style={{ fontWeight: 600 }}>系统提示词</span>}
            rules={[{ required: true, message: '请输入系统提示词' }]}
          >
            <Input.TextArea
              placeholder="你是一个有用的AI助手..."
              rows={4}
              style={{ borderRadius: '8px', padding: '10px 12px' }}
            />
          </Form.Item>

          <Form.Item
            name="mcp_tools"
            label={<span style={{ fontWeight: 600 }}>MCP 工具</span>}
          >
            <div>
              {mcpServers.length > 0 ? (
                mcpServers.map((server) => (
                  <div key={server.id} style={{ marginBottom: '16px' }}>
                    <Divider orientation="left" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {server.description || server.name}
                    </Divider>
                    <Checkbox.Group
                      style={{ width: '100%' }}
                      onChange={(checkedValues) => {
                        const currentValues = form.getFieldValue('mcp_tools') || [];
                        const otherServerTools = currentValues.filter((tool: string) => 
                          !tool.startsWith(`${server.name}_`)
                        );
                        const newServerTools = checkedValues.map((tool: string) => 
                          tool.startsWith(`${server.name}_`) ? tool : `${server.name}_${tool}`
                        );
                        form.setFieldValue('mcp_tools', [...otherServerTools, ...newServerTools]);
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                        {/* 这里需要动态获取服务器的工具列表 */}
                        <Checkbox value="get_current_time">get_current_time</Checkbox>
                        <Checkbox value="get_timestamp">get_timestamp</Checkbox>
                        <Checkbox value="get_time_info">get_time_info</Checkbox>
                      </div>
                    </Checkbox.Group>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#8c8c8c' }}>
                  <RobotOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
                  <div>暂无可用的 MCP 服务器</div>
                </div>
              )}
            </div>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: '24px' }}>
            <Button
              onClick={() => setModalOpen(false)}
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
                fontWeight: 600,
                background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                border: 'none'
              }}
            >
              {editingAgent ? '更新' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AgentManager;
