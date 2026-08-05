import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, X, MessageCircle, Search, Bot, User, Link as LinkIcon, HelpCircle, Tag, Ticket, CreditCard, RotateCcw } from 'lucide-react';

const API_BASE = '/api';

const MAX_HISTORY_PAIRS_FRONTEND = 10; // Sliding window: chỉ giữ 10 cặp cuối

const Chatbot = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Xin chào! Tôi là trợ lý của **VigoTrip**. Tôi có thể giúp bạn tìm kiếm chuyến đi hoặc giải đáp thắc mắc dịch vụ. Bạn cần hỗ trợ gì hôm nay?' }
  ]);
  const [chatHistory, setChatHistory] = useState([]); // Lịch sử gửi lên AI
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const chipsRef = useRef(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const dragDistance = useRef(0);

  const handleChipsMouseDown = (e) => {
    if (!chipsRef.current) return;
    setIsMouseDown(true);
    dragDistance.current = 0;
    setStartX(e.pageX - chipsRef.current.offsetLeft);
    setScrollLeftState(chipsRef.current.scrollLeft);
  };

  const handleChipsMouseLeaveOrUp = () => {
    setIsMouseDown(false);
  };

  const handleChipsMouseMove = (e) => {
    if (!isMouseDown || !chipsRef.current) return;
    e.preventDefault();
    const x = e.pageX - chipsRef.current.offsetLeft;
    const walk = (x - startX) * 1.8;
    dragDistance.current += Math.abs(e.movementX);
    chipsRef.current.scrollLeft = scrollLeftState - walk;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, loading]);

  const handleSend = async (text = input) => {
    const messageToSend = typeof text === 'string' ? text.trim() : input.trim();
    if (!messageToSend) return;

    if (messageToSend.length > 500) {
      setMessages(prev => [...prev, { sender: 'bot', text: 'Tin nhắn quá dài (tối đa 500 ký tự). Vui lòng rút gọn và thử lại.' }]);
      return;
    }

    setMessages(prev => [...prev, { sender: 'user', text: messageToSend }]);
    setInput('');
    setLoading(true);   // Loading = true → typing-loader hiện, KHÔNG thêm bubble rỗng
    setShowFaq(false);

    const getGuestSessionId = () => {
      let sid = sessionStorage.getItem('chat_session_id');
      if (!sid) {
        sid = 'guest_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        sessionStorage.setItem('chat_session_id', sid);
      }
      return sid;
    };
    const sessionId = getGuestSessionId();

    const trimmedHistory = chatHistory.slice(-MAX_HISTORY_PAIRS_FRONTEND * 2);

    const token = localStorage.getItem('authToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    let botReply = '';
    let streamSuccess = false;

    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: messageToSend, sessionId, history: trimmedHistory })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let streamBubbleAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let line of lines) {
          line = line.trim();
          if (!line.startsWith('data:')) continue;

          const dataStr = line.substring(5).trim();
          try {
            const parsed = JSON.parse(dataStr);
            // Kiểm tra signal [DONE]
            if (parsed.content === '[DONE]') break;

            if (parsed.content) {
              botReply += parsed.content;
              streamSuccess = true;
              if (!streamBubbleAdded) {
                // Lần đầu nhận ký tự → tắt loader, thêm bubble bot
                setLoading(false);
                setMessages(prev => [...prev, { sender: 'bot', text: botReply }]);
                streamBubbleAdded = true;
              } else {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { sender: 'bot', text: botReply };
                  return updated;
                });
              }
            }
          } catch {
            // Ignore parse error for partial chunks
          }
        }
      }
    } catch (streamError) {
      console.warn('SSE stream lỗi, fallback sang POST /api/chat:', streamError);
    }

    if (!streamSuccess) {
      // Fallback sang POST /api/chat chuẩn
      try {
        const response = await fetch(`${API_BASE}/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: messageToSend, sessionId, history: trimmedHistory })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        botReply = data.reply || 'Xin lỗi, không thể xử lý câu hỏi lúc này.';
        setMessages(prev => [...prev, { sender: 'bot', text: botReply }]);
      } catch (fallbackError) {
        console.error('Fallback chat cũng lỗi:', fallbackError);
        setMessages(prev => [...prev, { sender: 'bot', text: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối và thử lại.' }]);
      }
    }

    // Lưu lịch sử
    if (botReply) {
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: messageToSend },
        { role: 'assistant', content: botReply }
      ].slice(-MAX_HISTORY_PAIRS_FRONTEND * 2));
    }

    setLoading(false);
  };

  const [showFaq, setShowFaq] = useState(true);

  const faqItems = [
    { icon: <Search size={14} />, text: 'Tìm vé máy bay rẻ nhất' },
    { icon: <Search size={14} />, text: 'Có chuyến bay đi Sài Gòn không?' },
    { icon: <RotateCcw size={14} />, text: 'Hủy vé thì làm sao?' },
    { icon: <Tag size={14} />, text: 'Có mã giảm giá không?' },
    { icon: <Ticket size={14} />, text: 'Xem vé đã đặt của tôi' },
    { icon: <CreditCard size={14} />, text: 'Thanh toán bằng gì?' },
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
      const tableStartIndex = lines.findIndex(l => l.includes('|') && lines[lines.indexOf(l) + 1]?.includes('---'));

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
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Tag size={12} /> Mã giảm giá dành cho bạn
                </div>
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
                      const textarea = document.createElement('textarea');
                      textarea.value = code;
                      textarea.style.position = 'fixed';
                      textarea.style.opacity = '0';
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textarea);
                      btn.textContent = 'Đã sao chép!';
                      btn.style.background = 'rgba(255,255,255,0.5)';
                      setTimeout(() => {
                        btn.textContent = 'Sao chép';
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
                    Sao chép
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
      {/* Nút mở Chatbot */}
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

      {/* Cửa sổ Chatbot */}
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
              <div style={{ fontWeight: 600, fontSize: 16 }}>Trợ lý VigoTrip</div>
              <div style={{ fontSize: 12, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, backgroundColor: '#2ecc71', borderRadius: '50%' }}></span>
                Đang trực tuyến
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Nút xóa lịch sử chat */}
            <button
              onClick={() => {
                setMessages([{ sender: 'bot', text: 'Cuộc hội thoại mới. Tôi có thể giúp gì cho bạn?' }]);
                setChatHistory([]);
                setShowFaq(true);
              }}
              title="Xóa lịch sử chat"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.7, borderRadius: 8, padding: '4px 8px', fontSize: 12 }}
            >
              Xóa
            </button>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.7 }}>
              <X size={20} />
            </button>
          </div>
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

        {/* FAQ Panel - hiện khi showFaq = true */}
        {!loading && showFaq && (
          <div style={{
            padding: '0 16px 12px',
            backgroundColor: 'var(--bg-card)',
            borderTop: '1px solid var(--border-light)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 6px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <HelpCircle size={14} style={{ color: 'var(--primary)' }} /> Câu hỏi phổ biến
              </span>
              <button
                onClick={() => setShowFaq(false)}
                style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}
              >Ẩn</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {faqItems.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(item.text)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    gap: 10,
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{item.icon}</span>
                    <span>{item.text}</span>
                  </span>
                  <span style={{ fontSize: 16, opacity: 0.4 }}>›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick chips - hiện khi FAQ Panel bị ẩn */}
        {!loading && !showFaq && (
          <div
            ref={chipsRef}
            onMouseDown={handleChipsMouseDown}
            onMouseLeave={handleChipsMouseLeaveOrUp}
            onMouseUp={handleChipsMouseLeaveOrUp}
            onMouseMove={handleChipsMouseMove}
            style={{
              display: 'flex',
              gap: 6,
              padding: '10px 16px',
              overflowX: 'auto',
              backgroundColor: 'var(--bg-card)',
              borderTop: '1px solid var(--border-light)',
              scrollbarWidth: 'none',
              cursor: isMouseDown ? 'grabbing' : 'grab',
              userSelect: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {faqItems.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (dragDistance.current > 6) return;
                  handleSend(item.text);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  borderRadius: 20,
                  border: '1px solid #e0e7ff',
                  backgroundColor: 'white',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  userSelect: 'none'
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#e0e7ff'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                {item.icon} {item.text}
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
          {/* Nút toggle bật/tắt FAQ Panel */}
          <button
            onClick={() => setShowFaq(!showFaq)}
            title="Hiện gợi ý câu hỏi"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: showFaq ? 'rgba(99, 102, 241, 0.15)' : '#f1f5f9',
              color: showFaq ? 'var(--primary)' : 'var(--text-secondary)',
              border: '1px solid var(--border-light)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            <HelpCircle size={20} />
          </button>
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
