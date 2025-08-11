import React, { useEffect, useRef, useState } from 'react';
import { Input, Button, Avatar, Typography, Empty, message as antdMessage } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import { chatApi } from '../services/api';
import { API_BASE_URL } from '../services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ChatArea: React.FC = () => {
  const { currentAgent, currentSession, addMessage } = useAppStore();
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!currentAgent || !currentSession) return;
    const content = inputMessage.trim();
    if (!content) return;

    // 追加用户消息
    addMessage(currentSession.id, {
      id: Date.now().toString(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    });

    setInputMessage('');
    setSending(true);

    try {
      // 组装历史消息（不包括系统提示词，后端会加）
      const history = useAppStore.getState().currentSession?.messages.map(m => ({ role: m.role, content: m.content })) || [];
      const payload = { agent_id: currentAgent.id, messages: history };

      // 优先尝试流式
      const resp = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok || !resp.body) {
        // 回退到非流式
        const noStream = await chatApi.sendMessage(payload);
        const replyText = typeof noStream === 'string' ? noStream : (noStream.content || JSON.stringify(noStream));
        addMessage(currentSession.id, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: replyText,
          created_at: new Date().toISOString(),
        });
        return;
      }

      // 读取 SSE data: 流
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let acc = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!raw.startsWith('data:')) continue;
          const data = raw.slice(5).trim();
          if (data === '[DONE]') {
            break;
          }
          // 累积文本片段（后端当前返回的是文本增量）
          acc += data;
        }
      }

      addMessage(currentSession.id, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: acc || '[空响应]',
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      antdMessage.error(err?.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  // 自动滚动到底部
  useEffect(() => {
    const el = document.getElementById('chat-scroll');
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [currentSession?.messages.length]);

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
        borderBottom: '1px solid #eee',
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
      <div id="chat-scroll" style={{
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
                <div>
                  <div style={{
                    backgroundColor: message.role === 'user' ? '#1677ff' : '#fff',
                    color: message.role === 'user' ? '#fff' : '#262626',
                    padding: '10px 14px',
                    borderRadius: '18px',
                    borderBottomRightRadius: message.role === 'user' ? '4px' : '18px',
                    borderBottomLeftRadius: message.role === 'user' ? '18px' : '4px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    border: message.role === 'user' ? 'none' : '1px solid #f0f0f0',
                    wordBreak: 'break-word',
                    boxShadow: message.role === 'user' ? 'none' : '0 1px 3px rgba(0,0,0,0.06)'
                  }}>
                    {message.content}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#999',
                    marginTop: '4px',
                    textAlign: message.role === 'user' ? 'right' : 'left'
                  }}>
                    {new Date(message.created_at).toLocaleTimeString()}
                  </div>
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
                  handleSend();
                }
              }}
            />
          </div>
          <Button
            type="primary"
            shape="circle"
            icon={<SendOutlined />}
            disabled={!inputMessage.trim() || sending}
            loading={sending}
            onClick={handleSend}
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
