import { Tabs } from 'antd';
import { MessageOutlined, SettingOutlined, CloudServerOutlined } from '@ant-design/icons';
import { THEME } from '../theme';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div style={{
      padding: '8px 12px',
      borderTop: `1px solid ${THEME.colors.border}`,
      background: THEME.colors.bgSidebar,
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
