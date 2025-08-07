import { Tabs } from 'antd';
import { MessageOutlined, SettingOutlined, CloudServerOutlined } from '@ant-design/icons';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div style={{
      padding: '16px',
      borderBottom: '1px solid #e8e9ea',
      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      flexShrink: 0
    }}>
      <Tabs
        activeKey={activeTab}
        onChange={onTabChange}
        size="small"
        tabPosition="top"
        items={[
          {
            key: 'chat',
            label: (
              <span style={{
                fontSize: '14px',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: '8px',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <MessageOutlined style={{ fontSize: '14px' }} />
                聊天模式
              </span>
            )
          },
          {
            key: 'manage',
            label: (
              <span style={{
                fontSize: '14px',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: '8px',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <SettingOutlined style={{ fontSize: '14px' }} />
                管理 Agent
              </span>
            )
          },
          {
            key: 'mcp',
            label: (
              <span style={{
                fontSize: '14px',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: '8px',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CloudServerOutlined style={{ fontSize: '14px' }} />
                管理 MCP
              </span>
            )
          }
        ]}
        style={{
          minHeight: 'auto'
        }}
      />
    </div>
  );
};

export default TabNavigation;
