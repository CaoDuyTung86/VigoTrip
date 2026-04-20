import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, X, MessageCircle, RefreshCcw, Search, Calendar, History, Bot, User, Link as LinkIcon } from 'lucide-react';

const API_BASE = '/api';

const Chatbot = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Xin chào! Tôi là trợ lý ảo của **Datxe.com**. Tôi có thể giúp bạn tìm kiếm chuyến đi hoặc giải đáp thắc mắc về dịch vụ. Bạn muốn đi đâu hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, loading]);

  const handleSend = async (text = input) => {
    const messageToSend = typeof text === 'string' ? text.trim() : input.trim();
    if (!messageToSend) return;

    setMessages(prev => [...prev, { sender: 'user', text: messageToSend }]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message: messageToSend })
      });

      if (!response.ok) throw new Error('Lỗi máy chủ');

      const data = await response.json();
      setMessages(prev => [...prev, { sender: 'bot', text: data.reply || 'Xin lỗi, tôi không hiểu ý bạn.' }]);
    } catch (error) {
      console.error('Chat API Error:', error);
      setMessages(prev => [...prev, { sender: 'bot', text: 'Xin lỗi, hệ thống AI đang bận. Vui lòng thử lại sau vài giây nhé! 🥀💔' }]);
    } finally {
      setLoading(false);
    }
  };

  const quickReplies = [
    { text: 'Tìm vé rẻ nhất', icon: <RefreshCcw size={14} /> },
    { text: 'Chuyến từ Hà Nội', icon: <Search size={14} /> },
  ];

  // Mini Markdown & Table Parser
  const renderMessageContent = (text) => {
    // Tách các nút [BTN: ...] ra khỏi nội dung
    const buttonRegex = /\[BTN:\s*(.+?)\]/g;
    const dynamicButtons = [];
    let matchBtn;
    let contentWithoutButtons = text;
    
    while ((matchBtn = buttonRegex.exec(text)) !== null) {
      dynamicButtons.push(matchBtn[1]);
      contentWithoutButtons = contentWithoutButtons.replace(matchBtn[0], '');
    }

    // Tách các link [LINK: Tên | /đường-dẫn] ra khỏi nội dung
    const linkRegex = /\[LINK:\s*([^|]+)\|\s*([^\]]+)\]/g;
    const dynamicLinks = [];
    let matchLink;

    while ((matchLink = linkRegex.exec(contentWithoutButtons)) !== null) {
      dynamicLinks.push({ text: matchLink[1].trim(), url: matchLink[2].trim() });
      contentWithoutButtons = contentWithoutButtons.replace(matchLink[0], '');
    }

    // Tách các voucher [VOUCHER: CODE] ra khỏi nội dung
    const voucherRegex = /\[VOUCHER:\s*(.+?)\]/g;
    const dynamicVouchers = [];
    let matchVoucher;

    while ((matchVoucher = voucherRegex.exec(contentWithoutButtons)) !== null) {
      dynamicVouchers.push(matchVoucher[1].trim());
      contentWithoutButtons = contentWithoutButtons.replace(matchVoucher[0], '');
    }

    contentWithoutButtons = contentWithoutButtons.trim();

    // 1. Xử lý Bảng (Table)
    let parsedContent = null;
    if (contentWithoutButtons.includes('|') && contentWithoutButtons.includes('---')) {
      const lines = contentWithoutButtons.split('\n').filter(l => l.trim());
      const tableStartIndex = lines.findIndex(l => l.includes('|') && lines[lines.indexOf(l)+1]?.includes('---'));
      
      if (tableStartIndex !== -1) {
        const tableLines = lines.slice(tableStartIndex);
        const headers = tableLines[0].split('|').filter(c => c.trim()).map(c => c.trim());
        const rows = tableLines.slice(2).map(line => line.split('|').filter(c => c.trim()).map(c => c.trim()));

        parsedContent = (
          <div className="chat-table-container">
            <table>
              <thead>
                <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }

    // 2. Xử lý Chữ đậm, Danh sách, Xuống dòng (nếu không phải bảng)
    if (!parsedContent) {
      parsedContent = contentWithoutButtons.split('\n').map((line, i) => {
        let content = line;
        // Bold **text**
        const boldRegex = /\*\*(.*?)\*\*/g;
        const parts = [];
        let lastIndex = 0;
        let match;
        while ((match = boldRegex.exec(line)) !== null) {
          parts.push(line.substring(lastIndex, match.index));
          parts.push(<strong key={match.index}>{match[1]}</strong>);
          lastIndex = match.index + match[0].length;
        }
        parts.push(line.substring(lastIndex));

        return (
          <div key={i} style={{ marginBottom: line.startsWith('-') ? 2 : 6 }}>
            {line.startsWith('-') ? '• ' : ''}
            {parts.length > 1 ? parts : line.replace(/^- /, '')}
          </div>
        );
      });
    }

    return (
      <>
        {parsedContent}

        {/* Render Links */}
        {dynamicLinks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {dynamicLinks.map((link, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setIsOpen(false);
                  navigate(link.url);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #3a5fd0 100%)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(79, 124, 255, 0.3)',
                  transition: 'transform 0.2s',
                  alignSelf: 'flex-start'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {link.text} <LinkIcon size={14} />
              </button>
            ))}
          </div>
        )}

        {/* Render Voucher Cards */}
        {dynamicVouchers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {dynamicVouchers.map((code, idx) => (
              <div
                key={idx}
                style={{
                  background: 'linear-gradient(135deg, #ff6b00 0%, #ff9248 50%, #ffb347 100%)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 4px 15px rgba(255, 107, 0, 0.3)',
                }}
              >
                <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '60px', opacity: 0.15 }}>🎫</div>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>🎁 Mã giảm giá dành cho bạn</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    background: 'rgba(255,255,255,0.25)',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontWeight: '800',
                    fontSize: '16px',
                    letterSpacing: '2px',
                    border: '2px dashed rgba(255,255,255,0.5)',
                  }}>
                    {code}
                  </span>
                  <button
                    id={`copy-btn-${idx}`}
                    onClick={(e) => {
                      const btn = e.currentTarget;
                      // Fallback copy method
                      const textarea = document.createElement('textarea');
                      textarea.value = code;
                      textarea.style.position = 'fixed';
                      textarea.style.opacity = '0';
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textarea);
                      // Visual feedback
                      btn.textContent = '✅ Đã sao chép!';
                      btn.style.background = 'rgba(255,255,255,0.5)';
                      setTimeout(() => {
                        btn.textContent = '📋 Sao chép';
                        btn.style.background = 'rgba(255,255,255,0.3)';
                      }, 2000);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.3)',
                      border: 'none',
                      color: 'white',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '600',
                      transition: 'background 0.2s',
                    }}
                  >
                    📋 Sao chép
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Render Buttons */}
        {dynamicButtons.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
            {dynamicButtons.map((btn, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(btn)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  border: '1px solid var(--primary)',
                  backgroundColor: 'white',
                  color: 'var(--primary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
              >
                {btn}
              </button>
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      {/* Nút mở Chatbot (Được thiết kế lại to và rõ ràng hơn) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          height: '64px',
          padding: '0 24px',
          borderRadius: '32px',
          backgroundColor: 'var(--primary)',
          color: 'white',
          border: 'none',
          boxShadow: '0 6px 20px rgba(79, 124, 255, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 1000,
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: isOpen ? 'translateY(100px) opacity(0)' : 'translateY(0) opacity(1)',
          opacity: isOpen ? 0 : 1,
          pointerEvents: isOpen ? 'none' : 'all'
        }}
      >
        <MessageCircle size={28} />
        <span style={{ fontSize: '16px', fontWeight: 600 }}>Hỗ trợ đặt vé</span>
      </button>

      {/* Cửa sổ Chatbot (Được thiết kế rộng rãi hơn) */}
      <div
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          width: '450px',
          height: '700px',
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 80px)',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '24px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateY(0)' : 'translateY(20px)',
          pointerEvents: isOpen ? 'all' : 'none',
          border: '1px solid var(--border-light)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, var(--primary) 0%, #3a5fd0 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12 }}>
              <Bot size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Trợ lý Datxe.com</div>
              <div style={{ fontSize: 12, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, backgroundColor: '#2ecc71', borderRadius: '50%' }}></span>
                Đang trực tuyến
              </div>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.7 }}>
            <X size={20} />
          </button>
        </div>

        {/* Nội dung Chat */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          backgroundColor: 'var(--bg-main)'
        }}>
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                gap: 8,
                flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: msg.sender === 'user' ? 'var(--primary)' : '#e0e7ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: msg.sender === 'user' ? 'white' : 'var(--primary)'
              }}>
                {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div
                style={{
                  backgroundColor: msg.sender === 'user' ? 'var(--primary)' : '#f1f5f9',
                  color: msg.sender === 'user' ? 'white' : '#1e293b',
                  padding: '12px 16px',
                  borderRadius: msg.sender === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                  border: msg.sender === 'bot' ? '1px solid #e2e8f0' : 'none',
                }}
              >
                {renderMessageContent(msg.text)}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'var(--primary)' }}>
                <Bot size={16} style={{ margin: 'auto' }} />
              </div>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px 16px', borderRadius: '18px 18px 18px 2px', border: '1px solid var(--border-light)' }}>
                <div className="typing-loader">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Replies */}
        {!loading && (
          <div style={{
            display: 'flex',
            gap: 8,
            padding: '12px 20px',
            overflowX: 'auto',
            backgroundColor: 'var(--bg-card)',
            borderTop: '1px solid var(--border-light)',
            scrollbarWidth: 'none'
          }}>
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(reply.text)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 20,
                  border: '1px solid #e0e7ff',
                  backgroundColor: 'white',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e0e7ff';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                {reply.icon}
                {reply.text}
              </button>
            ))}
          </div>
        )}

        {/* Khung nhập */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          gap: 12,
          alignItems: 'center'
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Nhập câu hỏi..."
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none'
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: input.trim() ? 'var(--primary)' : '#e0e7ff',
              color: 'white',
              border: 'none',
              cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </>
  );
};

export default Chatbot;
