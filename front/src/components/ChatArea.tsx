import React, { useState } from 'react';
import { Input, Button, Avatar, Typography, Empty } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ChatArea: React.FC = () => {
  const { currentAgent, currentSession } = useAppStore();
  const [inputMessage, setInputMessage] = useState('');

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 头部 */}
      <div style={{
        height: '64px',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        borderBottom: '1px solid #f0f0f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
      }}>
        <Avatar icon={<RobotOutlined />} size="large" style={{ marginRight: '12px', backgroundColor: '#1890ff' }} />
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: '2px' }}>
            {currentAgent?.name || '请选择 Agent'}
          </Title>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            {currentAgent?.description || '暂无描述'}
          </Text>
        </div>
      </div>

      {/* 消息区域 */}
      <div style={{
        flex: 1,
        padding: '20px 24px',
        background: '#f8f9fa',
        overflow: 'auto',
        minHeight: 0
      }}>
        {currentSession && currentSession.messages.length > 0 ? (
          // 显示会话消息
          currentSession.messages.map((message, index) => (
            <div key={index} style={{
              marginBottom: '16px',
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                maxWidth: '70%',
                flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
              }}>
                <Avatar
                  icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                  size="small"
                  style={{
                    backgroundColor: message.role === 'user' ? '#1890ff' : '#52c41a',
                    flexShrink: 0
                  }}
                />
                <div style={{
                  backgroundColor: message.role === 'user' ? '#1890ff' : '#fff',
                  color: message.role === 'user' ? '#fff' : '#262626',
                  padding: '10px 14px',
                  borderRadius: '18px',
                  borderBottomRightRadius: message.role === 'user' ? '4px' : '18px',
                  borderBottomLeftRadius: message.role === 'user' ? '18px' : '4px',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  border: message.role === 'user' ? 'none' : '1px solid #e8e8e8',
                  wordBreak: 'break-word'
                }}>
                  {message.content}
                </div>
              </div>
            </div>
          ))
        ) : currentSession ? (
          // 空会话状态
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center',
            color: '#8c8c8c'
          }}>
            <Avatar
              icon={<RobotOutlined />}
              size={64}
              style={{ backgroundColor: '#1890ff', marginBottom: '16px' }}
            />
            <Title level={4} style={{ color: '#8c8c8c', marginBottom: '8px' }}>
              开始与 {currentAgent?.name} 对话
            </Title>
            <Text type="secondary">
              发送消息开始您的对话
            </Text>
          </div>
        ) : (
          // 未选择会话状态
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center',
            color: '#8c8c8c'
          }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  请选择一个对话或<br />
                  <Text style={{ color: '#1890ff', cursor: 'pointer' }}>创建新对话</Text>
                </span>
              }
            />
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div style={{
        background: '#fff',
        borderTop: '1px solid #f0f0f0',
        padding: '16px 24px',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
          maxWidth: '100%'
        }}>
          <div style={{ flex: 1 }}>
            <TextArea
              placeholder="输入消息..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              autoSize={{ minRows: 1, maxRows: 4 }}
              style={{
                borderRadius: '20px',
                fontSize: '14px',
                resize: 'none',
                border: '1px solid #d9d9d9',
                padding: '8px 16px'
              }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  // 这里后续添加发送逻辑
                }
              }}
            />
          </div>
          <Button
            type="primary"
            shape="circle"
            icon={<SendOutlined />}
            disabled={!inputMessage.trim()}
            size="large"
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
