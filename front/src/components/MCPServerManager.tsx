import { useState, useEffect } from 'react';
import { Button, List, Avatar, Popconfirm, message, Modal, Form, Input, Switch } from 'antd';
import { PlusOutlined, CloudServerOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { mcpApi } from '../services/api';
import { THEME } from '../theme';
import type { MCPServer } from '../types';

interface MCPServerManagerProps {
  onServersChange?: () => void;
}

const MCPServerManager: React.FC<MCPServerManagerProps> = ({ onServersChange }) => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const serversData = await mcpApi.getServers();
      setServers(serversData);
      onServersChange?.();
    } catch (error) {
      console.error('加载 MCP 服务器失败:', error);
    }
  };

  const handleCreate = () => {
    setEditingServer(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (server: MCPServer) => {
    setEditingServer(server);
    form.setFieldsValue({
      name: server.name,
      description: server.description,
      api_url: server.api_url,
      is_active: server.is_active
    });
    setModalOpen(true);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async (values: any) => {
    try {
      setSaving(true);
      if (editingServer) {
        await mcpApi.updateServer(editingServer.id, values);
        message.success('MCP 服务器更新成功');
      } else {
        await mcpApi.createServer(values);
        message.success('MCP 服务器创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingServer(null);
      loadServers();
    } catch (error: any) {
      const detail = error?.detail;
      message.error(detail?.message || error?.message || '保存 MCP 服务器失败');
      console.error('Error saving MCP server:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serverId: number) => {
    try {
      await mcpApi.deleteServer(serverId);
      message.success('MCP 服务器删除成功');
      loadServers();
    } catch (error) {
      message.error('删除 MCP 服务器失败');
      console.error('Error deleting MCP server:', error);
    }
  };

  const handleToggleActive = async (server: MCPServer, checked: boolean) => {
    try {
      await mcpApi.updateServer(server.id, { is_active: checked });
      message.success(`MCP 服务器已${checked ? '启用' : '禁用'}`);
      loadServers();
    } catch (error) {
      message.error('更新服务器状态失败');
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
      {/* 新建 MCP 服务器按钮 */}
      <div style={{ marginBottom: '24px' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="middle"
          block
          onClick={handleCreate}
          style={{
            borderRadius: '10px',
            height: 40,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          新建 MCP 服务器
        </Button>
      </div>

      {/* MCP 服务器列表 */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        minHeight: 0  // 重要：确保可以收缩
      }}>
        {servers.length > 0 ? (
          <List
            dataSource={servers}
            renderItem={(server) => (
              <List.Item
                style={{
                  background: '#fff',
                  borderRadius: 10,
                  marginBottom: 12,
                  padding: 16,
                  border: '1px solid #eee'
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size={40}
                      style={{
                        backgroundColor: server.is_active ? '#52c41a' : '#d9d9d9',
                        color: '#ffffff'
                      }}
                      icon={<CloudServerOutlined style={{ fontSize: 18 }} />}
                    />
                  }
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 600 }}>
                        {server.name}
                      </span>
                      <Switch
                        size="small"
                        checked={server.is_active}
                        onChange={(checked) => handleToggleActive(server, checked)}
                      />
                    </div>
                  }
                  description={
                    <div>
                      <div style={{ marginBottom: '4px', color: '#666' }}>
                        {server.description}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        API 地址: {server.api_url}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={(e) => { e.stopPropagation(); handleEdit(server); }}
                          style={{ color: '#1890ff', padding: '0 6px' }}
                        >
                          编辑
                        </Button>
                        <Popconfirm
                          title="确定要删除这个 MCP 服务器吗？"
                          onConfirm={(e) => { e?.stopPropagation?.(); handleDelete(server.id); }}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Button type="text" size="small" icon={<DeleteOutlined />} danger style={{ padding: '0 6px' }} onClick={(e) => e.stopPropagation()}>
                            删除
                          </Button>
                        </Popconfirm>
                      </div>
                    </div>
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
            <CloudServerOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>暂无 MCP 服务器</div>
            <div style={{ fontSize: '14px' }}>点击上方按钮创建您的第一个 MCP 服务器</div>
          </div>
        )}
      </div>

      {/* MCP 服务器创建/编辑模态框 */}
      <Modal
        title={
          <span style={{ fontSize: '18px', fontWeight: 600 }}>
            {editingServer ? '编辑 MCP 服务器' : '新建 MCP 服务器'}
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
            label={<span style={{ fontWeight: 600 }}>服务器名称</span>}
            rules={[{ required: true, message: '请输入服务器名称' }]}
          >
            <Input
              placeholder="例如：time_server"
              style={{ borderRadius: '8px', padding: '10px 12px' }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label={<span style={{ fontWeight: 600 }}>描述</span>}
            rules={[{ required: true, message: '请输入服务器描述' }]}
          >
            <Input.TextArea
              placeholder="描述这个 MCP 服务器的功能..."
              rows={3}
              style={{ borderRadius: '8px', padding: '10px 12px' }}
            />
          </Form.Item>

          <Form.Item
            name="api_url"
            label={<span style={{ fontWeight: 600 }}>API 地址</span>}
            rules={[
              { required: true, message: '请输入 API 地址' },
              { pattern: /^https?:\/\//i, message: '仅支持以 http:// 或 https:// 开头的 MCP HTTP 接口' }
            ]}
            tooltip="请输入 MCP HTTP(S) 接口，例如：http://host:port/mcp"
          >
            <Input
              placeholder="例如：http://localhost:9090/mcp"
              style={{ borderRadius: '8px', padding: '10px 12px' }}
            />
          </Form.Item>

          <Form.Item
            name="is_active"
            label={<span style={{ fontWeight: 600 }}>状态</span>}
            valuePropName="checked"
            initialValue={true}
          >
            <Switch
              checkedChildren="启用"
              unCheckedChildren="禁用"
            />
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
              loading={saving}
              style={{
                borderRadius: '8px',
                padding: '6px 20px',
                height: 'auto',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                border: 'none'
              }}
            >
              {editingServer ? (saving ? '更新中…' : '更新') : (saving ? '创建中…' : '创建')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MCPServerManager;
