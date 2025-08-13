import React, { useEffect, useRef, useState } from 'react';
import { Input, Button, Avatar, Typography, Empty, message as antdMessage } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import { chatApi } from '../services/api';
import { API_BASE_URL } from '../services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

// 渲染带有思考标记和 MCP 工具调用的消息内容
const renderMessageContent = (content: string) => {
  // 先处理 <think>...</think> 和 <mcp>...</mcp> 标记
  const parts = content.split(/(<think>[\s\S]*?<\/think>|<mcp>[\s\S]*?<\/mcp>)/g);

  return parts.map((part, index) => {
    if (part.match(/^<think>[\s\S]*?<\/think>$/)) {
      // 这是思考内容，用特殊样式显示
      const thinkContent = part.replace(/<\/?think>/g, '');
      return (
        <div key={index} style={{
          backgroundColor: '#f6f8fa',
          border: '1px solid #d1d9e0',
          borderRadius: '6px',
          padding: '8px 12px',
          margin: '4px 0',
          fontSize: '13px',
          color: '#656d76',
          fontStyle: 'italic',
          position: 'relative'
        }}>
          <div style={{
            fontSize: '11px',
            color: '#8b949e',
            marginBottom: '4px',
            fontWeight: 500
          }}>
            💭 AI 思考过程
          </div>
          {thinkContent}
        </div>
      );
    } else if (part.match(/^<mcp>[\s\S]*?<\/mcp>$/)) {
      // 这是 MCP 工具调用内容，用不同的样式显示
      const mcpContent = part.replace(/<\/?mcp>/g, '');
      return (
        <div key={index} style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '6px',
          padding: '8px 12px',
          margin: '4px 0',
          fontSize: '13px',
          color: '#856404',
          fontFamily: 'Monaco, Consolas, "Courier New", monospace'
        }}>
          <div style={{
            fontSize: '11px',
            color: '#b8860b',
            marginBottom: '4px',
            fontWeight: 500
          }}>
            🔧 MCP 工具调用
          </div>
          {mcpContent}
        </div>
      );
    } else {
      // 这是正常内容
      return <span key={index}>{part}</span>;
    }
  });
};

const ChatArea: React.FC = () => {
  const { currentAgent, currentSession, addMessage, updateMessage, appendToMessage } = useAppStore();
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!currentAgent || !currentSession) return;
    const content = inputMessage.trim();
    if (!content) return;

    const scrollToBottom = () => {
      const el = document.getElementById('chat-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    };

    // 1) 先追加用户消息
    addMessage(currentSession.id, {
      id: Date.now().toString(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    });

    setInputMessage('');
    setSending(true);

    try {
      // 2) 组装历史消息（不包括系统提示词，后端会加）
      const history = useAppStore.getState().currentSession?.messages.map(m => ({ role: m.role, content: m.content })) || [];
      const payload = { agent_id: currentAgent.id, messages: history };

      // 3) 先插入一个空的 assistant 占位消息，用于流式增量更新
      const replyId = `reply-${Date.now()}`;
      addMessage(currentSession.id, {
        id: replyId,
        role: 'assistant',
        content: '思考中...'
        ,
        created_at: new Date().toISOString(),
      });

      // 4) 优先尝试流式
      const resp = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok || !resp.body) {
        // 回退到非流式
        const noStream = await chatApi.sendMessage(payload);
        const replyText = typeof noStream === 'string' ? noStream : (noStream.content || JSON.stringify(noStream));
        // 用占位回复更新为最终文本
        updateMessage(currentSession.id, replyId, { content: replyText });
        scrollToBottom();
        return;
      }

      // 5) 读取 SSE data: 流，边到边渲染
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let received = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while (true) {
          idx = buffer.indexOf('\n\n');
          let sepLen = 2;
          if (idx === -1) {
            idx = buffer.indexOf('\r\n\r\n');
            sepLen = idx === -1 ? -1 : 4;
          }
          if (idx === -1) break;
          const raw = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + sepLen);
          if (!raw.startsWith('data:')) continue;
          // 有些实现会在一个事件块里包含多行 data: 或者拼接多个 data:
          const segments = raw
            .split(/\r?\n+/)               // 先按换行拆分
            .flatMap(l => l.split(/(?=data:\s*)/)) // 再按 data: 边界切分
            .map(s => s.replace(/^data:\s*/, '').trim())
            .filter(s => s.length > 0);

          let done = false;
          for (const seg of segments) {
            if (seg === '[DONE]') { done = true; break; }

            // 解析 OpenAI chunk JSON，提取 choices[0].delta.content
            let text = '';
            try {
              const j = JSON.parse(seg);
              text = j?.choices?.[0]?.delta?.content ?? '';
              if (!text && j?.choices?.[0]?.message?.content) {
                text = j.choices[0].message.content;
              }
            } catch {
              // 非 JSON（例如后端直接推送纯文本增量），直接当作文本
              text = seg;
            }

            // 过滤思考标记，但保留空格和其他内容
            if (text !== undefined && text !== null) {
              // 保留所有内容，包括 <think> 标签，不做任何过滤

              // 即使是空格也要保留，只过滤掉纯标签内容
              if (text !== '') {
                if (!received) {
                  // 第一次收到内容时，清空占位“思考中...”
                  updateMessage(currentSession.id, replyId, { content: '' });
                }
                appendToMessage(currentSession.id, replyId, text);
                received = true;
                scrollToBottom();
              }
            }
          }
          if (done) break;
        }
      }

      // 若未收到任何片段，给一个兜底文案
      if (!received) {
        updateMessage(currentSession.id, replyId, { content: '[空响应]' });
      }
    } catch (err: any) {
      // 出错时把占位消息替换为错误信息
      updateMessage(currentSession.id, `reply-${Date.now()}`, { content: err?.message || '发送失败' });
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
                    {renderMessageContent(message.content)}
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
