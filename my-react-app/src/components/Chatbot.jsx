import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, X, MessageCircle, Search, Bot, User, Link as LinkIcon, HelpCircle, Tag, Ticket, CreditCard, RotateCcw, TrainTrack, Bus, Trash2, ThumbsUp, ThumbsDown, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Turnstile } from '@marsidev/react-turnstile';

const API_BASE = '/api';

const MAX_HISTORY_PAIRS_FRONTEND = 10; // Sliding window: chỉ giữ 10 cặp cuối

// Bộ nhớ đệm hội thoại của KHÁCH VÃNG LAI, cố ý nằm hoàn toàn ở máy khách.
// Server không lưu gì cho người chưa đăng nhập (xem ghi chú quyền riêng tư ở entity
// ChatMessage) — nhưng mất sạch hội thoại chỉ vì tải lại trang thì quá phí.
const GUEST_CACHE_KEY = 'vigotrip_chat_guest';
// Máy dùng chung (phòng máy, quán net) là rủi ro chính của việc lưu phía client: người
// sau mở widget lên sẽ thấy hội thoại của người trước. Hạn 7 ngày để dữ liệu không nằm
// lại vô thời hạn.
const GUEST_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHED_MESSAGES = 60; // trần dung lượng, tránh phình localStorage

/** Cache của khách, hoặc null nếu không có / hỏng / đã quá hạn. */
const readGuestCache = () => {
  try {
    const raw = localStorage.getItem(GUEST_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || !Array.isArray(cached.messages) || !cached.savedAt) return null;
    if (Date.now() - cached.savedAt > GUEST_CACHE_TTL_MS) {
      localStorage.removeItem(GUEST_CACHE_KEY);
      return null;
    }
    return {
      messages: cached.messages,
      chatHistory: Array.isArray(cached.chatHistory) ? cached.chatHistory : []
    };
  } catch {
    // localStorage bị chặn (chế độ riêng tư) hoặc JSON hỏng — coi như chưa có gì.
    return null;
  }
};

const writeGuestCache = (messages, chatHistory) => {
  try {
    localStorage.setItem(GUEST_CACHE_KEY, JSON.stringify({
      messages: messages.slice(-MAX_CACHED_MESSAGES),
      chatHistory: chatHistory.slice(-MAX_HISTORY_PAIRS_FRONTEND * 2),
      savedAt: Date.now()
    }));
  } catch {
    // Hết quota hoặc bị chặn: bỏ qua, chat vẫn chạy bình thường trong RAM.
  }
};

const clearGuestCache = () => {
  try {
    localStorage.removeItem(GUEST_CACHE_KEY);
  } catch {
    // Không đọc được storage thì cũng không có gì để dọn.
  }
};

/**
 * Định danh phiên chat. Trước đây nằm ở sessionStorage nên mỗi tab là một phiên mới và
 * cột session_id trong DB gần như vô dụng; chuyển sang localStorage để một người dùng
 * giữ nguyên một mạch hội thoại — cũng là thứ cần thiết nếu sau này tách nhiều hội thoại.
 */
const getGuestSessionId = () => {
  const newId = () => 'guest_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  try {
    let sid = localStorage.getItem('chat_session_id');
    if (!sid) {
      sid = newId();
      localStorage.setItem('chat_session_id', sid);
    }
    return sid;
  } catch {
    // Không lưu được thì request hiện tại vẫn phải có id.
    return newId();
  }
};

/**
 * Định danh cho một câu trả lời của bot, để gắn đánh giá 👍/👎 vào đúng câu đó và để
 * người dùng đổi ý thì sửa dòng cũ chứ không đẻ thêm dòng mới.
 *
 * Chỉ câu trả lời THẬT mới có id. Tin nhắn chào và các thông báo lỗi cố ý không có, nhờ
 * vậy phần render không cần biết gì thêm vẫn tự động không hỏi đánh giá cho chúng.
 */
const newMessageRef = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'm_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
};

// Danh sách lý do đóng, khớp với ALLOWED_REASONS ở ChatFeedbackService. Không có ô nhập
// tự do: đó là đường nhanh nhất để thông tin cá nhân lọt vào một bảng vốn không định chứa.
const FEEDBACK_REASONS = [
  { code: 'WRONG_INFO', key: 'cbFeedbackReasonWrongInfo', fallback: 'Thông tin sai' },
  { code: 'NOT_UNDERSTOOD', key: 'cbFeedbackReasonNotUnderstood', fallback: 'Không hiểu câu hỏi' },
  { code: 'INCOMPLETE', key: 'cbFeedbackReasonIncomplete', fallback: 'Trả lời thiếu' },
  { code: 'OFF_TOPIC', key: 'cbFeedbackReasonOffTopic', fallback: 'Lạc đề' },
  { code: 'OTHER', key: 'cbFeedbackReasonOther', fallback: 'Lý do khác' }
];

// Người dùng đã đăng nhập phải được biết hội thoại đang được lưu. Ghi nhận đã xem ở
// localStorage để không lải nhải mỗi lần mở widget.
const NOTICE_ACK_KEY = 'vigotrip_chat_notice_ack';

const Chatbot = () => {
  const navigate = useNavigate();
  const { t, currentLanguage } = useLanguage();
  // Lấy từ AuthContext chứ không đọc localStorage: trước đây token được chụp một lần
  // lúc mount và không bao giờ đọc lại, nên người dùng đăng nhập giữa phiên vẫn bị
  // hỏi CAPTCHA cho tới khi component remount.
  const { token: authToken, isAuthenticated } = useAuth();
  // Gom về một chỗ: chuỗi chào trước đây bị lặp ở ba nơi, sửa một chỗ là lệch hai chỗ kia.
  const welcomeText = t.chatbotWelcomeMsg || 'Xin chào. Tôi là trợ lý của **VigoTrip**. Tôi có thể hỗ trợ bạn tra cứu chuyến đi, tìm vé giá tốt hoặc giải đáp thắc mắc dịch vụ. Bạn cần hỗ trợ gì hôm nay?';
  const welcomeMessage = () => [{ sender: 'bot', text: welcomeText }];
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(welcomeMessage);
  const [chatHistory, setChatHistory] = useState([]); // Lịch sử gửi lên AI
  const [historyLoading, setHistoryLoading] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  // Đánh giá đã gửi, khóa theo id câu trả lời: { [messageRef]: { rating, reason } }
  const [feedback, setFeedback] = useState({});
  const [reasonPromptFor, setReasonPromptFor] = useState(null);
  const [noticeAcked, setNoticeAcked] = useState(() => {
    try {
      return localStorage.getItem(NOTICE_ACK_KEY) === '1';
    } catch {
      return false;
    }
  });
  // Danh tính mà state trên màn hình đang thuộc về: 'user' | 'guest' | null (chưa khôi phục).
  const restoredIdentityRef = useRef(null);
  // Chỉ ghi cache sau khi khôi phục xong; nếu không, lần render đầu (mới có mỗi tin nhắn
  // chào) sẽ ghi đè lên hội thoại đang lưu.
  const canPersistRef = useRef(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiHealth, setAiHealth] = useState({ status: 'CHECKING', ready: true, message: '' });
  const messagesEndRef = useRef(null);
  const chipsRef = useRef(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const dragDistance = useRef(0);
  const pointerStartX = useRef(0);
  const DRAG_THRESHOLD_PX = 8; // dưới ngưỡng này coi là click, không phải kéo
  
  const [guestCaptchaToken, setGuestCaptchaToken] = useState(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const hasToken = isAuthenticated;

  const fetchAiStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/status`);
      if (res.ok) {
        const data = await res.json();
        setAiHealth(data);
      } else {
        setAiHealth({ status: 'OFFLINE', ready: false, message: t.cbAiOffline });
      }
    } catch {
      setAiHealth({ status: 'OFFLINE', ready: false, message: t.cbAiDisconnected });
    }
  };

  useEffect(() => {
    fetchAiStatus();
    const interval = setInterval(fetchAiStatus, 45000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAiStatus();
    }
  }, [isOpen]);

  const handleChipsMouseDown = (e) => {
    if (!chipsRef.current) return;
    setIsMouseDown(true);
    dragDistance.current = 0;
    pointerStartX.current = e.pageX;
    setStartX(e.pageX - chipsRef.current.offsetLeft);
    setScrollLeftState(chipsRef.current.scrollLeft);
  };

  const handleChipsMouseLeaveOrUp = () => {
    setIsMouseDown(false);
  };

  const handleChipsMouseMove = (e) => {
    if (!isMouseDown || !chipsRef.current) return;
    dragDistance.current = Math.abs(e.pageX - pointerStartX.current);
    if (dragDistance.current <= DRAG_THRESHOLD_PX) return; // chưa phải kéo -> để click chạy bình thường
    e.preventDefault();
    const x = e.pageX - chipsRef.current.offsetLeft;
    const walk = (x - startX) * 1.8;
    chipsRef.current.scrollLeft = scrollLeftState - walk;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    // If user hasn't started conversing, sync initial welcome message to current language
    if (messages.length === 1 && messages[0].sender === 'bot') {
      setMessages(welcomeMessage());
    }
  }, [currentLanguage?.code]);

  /**
   * Khôi phục hội thoại khi mở widget. Hai nguồn tách bạch theo danh tính:
   *
   *  - Đã đăng nhập → GET /api/chat/history. Backend vẫn ghi đủ mọi lượt vào bảng
   *    tin_nhan_chat từ trước, chỉ là chưa từng có ai gọi tới đọc lại.
   *  - Khách vãng lai → localStorage của chính máy đó; server không giữ gì.
   *
   * Đổi danh tính giữa phiên (đăng nhập / đăng xuất) thì nạp lại từ đầu, để hội thoại của
   * người này không còn nằm trên màn hình của người kia.
   */
  useEffect(() => {
    if (!isOpen) return;
    const identity = isAuthenticated ? 'user' : 'guest';
    if (restoredIdentityRef.current === identity) return;
    restoredIdentityRef.current = identity;
    canPersistRef.current = false;

    let cancelled = false;

    const restore = async () => {
      if (isAuthenticated) {
        // Cache của khách không được sống tiếp sang phiên đã đăng nhập: từ đây lịch sử do
        // server giữ, và người dùng sau trên cùng máy này không được thấy lại nó.
        clearGuestCache();
        setHistoryLoading(true);
        try {
          const res = await fetch(`${API_BASE}/chat/history`, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (cancelled) return;
          if (Array.isArray(data) && data.length > 0) {
            setMessages([
              ...welcomeMessage(),
              ...data.map(m => ({
                sender: m.role === 'user' ? 'user' : 'bot',
                text: m.content,
                // id sinh lại mỗi lần khôi phục, nên đánh giá cho câu trả lời cũ sau khi
                // tải lại trang sẽ tính là một lượt mới. Chấp nhận được: đây là tín hiệu
                // tổng hợp, không phải sổ kế toán.
                ...(m.role === 'user' ? {} : { id: newMessageRef() })
              }))
            ]);
            // Server trả về tối đa 50 tin nhắn để hiển thị, nhưng phần đẩy lên model vẫn
            // giữ nguyên cửa sổ 10 cặp — đây là hai thứ khác nhau, đừng gộp.
            setChatHistory(
              data.map(m => ({ role: m.role, content: m.content }))
                .slice(-MAX_HISTORY_PAIRS_FRONTEND * 2)
            );
            setShowFaq(false);
          } else {
            setMessages(welcomeMessage());
            setChatHistory([]);
          }
        } catch (e) {
          // Không lấy được lịch sử thì vẫn phải chat được: chỉ mất phần cũ, không chặn widget.
          console.warn('Không khôi phục được lịch sử chat:', e);
          if (!cancelled) {
            setMessages(welcomeMessage());
            setChatHistory([]);
          }
        } finally {
          if (!cancelled) setHistoryLoading(false);
        }
      } else {
        const cached = readGuestCache();
        if (cached && cached.messages.length > 1) {
          setMessages(cached.messages);
          setChatHistory(cached.chatHistory);
          setShowFaq(false);
        } else {
          setMessages(welcomeMessage());
          setChatHistory([]);
        }
      }
      if (!cancelled) canPersistRef.current = true;
    };

    restore();
    return () => { cancelled = true; };
  }, [isOpen, isAuthenticated, authToken]);

  /** Ghi lại hội thoại của khách sau mỗi thay đổi. Người đã đăng nhập không cần: backend đã lưu. */
  useEffect(() => {
    if (isAuthenticated || !canPersistRef.current) return;
    if (messages.length <= 1) {
      // Chưa hỏi gì, hoặc vừa bấm xóa: không để lại key nào trong localStorage.
      clearGuestCache();
      return;
    }
    writeGuestCache(messages, chatHistory);
  }, [messages, chatHistory, isAuthenticated]);

  const handleSend = async (text = input) => {
    const messageToSend = typeof text === 'string' ? text.trim() : input.trim();
    if (!messageToSend) return;
    if (loading) return; // chặn spam khi đang xử lý

    if (!hasToken && !guestCaptchaToken && import.meta.env.VITE_TURNSTILE_SITE_KEY) {
      setMessages(prev => [...prev, { sender: 'bot', text: t.cbCaptchaRequired }]);
      return;
    }

    if (messageToSend.length > 500) {
      setMessages(prev => [...prev, { sender: 'bot', text: t.cbMsgTooLong }]);
      return;
    }

    if (!aiHealth.ready && aiHealth.status !== 'CHECKING') {
      setMessages(prev => [
        ...prev,
        { sender: 'user', text: messageToSend },
        { sender: 'bot', text: '⚠️ ' + (t.chatbotMaintenanceNotice || 'Hệ thống AI hiện đang bảo trì hoặc quá tải. Vui lòng liên hệ tổng đài 1900 1234 để được hỗ trợ.') }
      ]);
      setInput('');
      return;
    }

    setMessages(prev => [...prev, { sender: 'user', text: messageToSend }]);
    setInput('');
    setLoading(true);   // Loading = true → typing-loader hiện, KHÔNG thêm bubble rỗng
    setShowFaq(false);

    const sessionId = getGuestSessionId();
    // Sinh trước, dùng chung cho cả nhánh stream lẫn nhánh fallback: dù câu trả lời đến
    // bằng đường nào thì nó vẫn là một câu trả lời, một lượt đánh giá.
    const answerRef = newMessageRef();

    const trimmedHistory = chatHistory.slice(-MAX_HISTORY_PAIRS_FRONTEND * 2);

    const headers = {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
    };

    // Dựng một lần rồi dùng cho cả nhánh stream lẫn nhánh fallback. Trước đây hai
    // nhánh dựng payload riêng, thêm một trường là phải nhớ sửa cả hai chỗ.
    const payload = {
      message: messageToSend,
      sessionId,
      history: trimmedHistory,
      language: currentLanguage?.code || 'vi',
      captchaToken: guestCaptchaToken
    };

    let botReply = '';
    let streamSuccess = false;

    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
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
                setMessages(prev => [...prev, { sender: 'bot', text: botReply, id: answerRef }]);
                streamBubbleAdded = true;
              } else {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { sender: 'bot', text: botReply, id: answerRef };
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
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        botReply = data.reply || t.cbReplyFallback;
        setMessages(prev => [...prev, { sender: 'bot', text: botReply, id: answerRef }]);
      } catch (fallbackError) {
        console.error('Fallback chat cũng lỗi:', fallbackError);
        setMessages(prev => [...prev, { sender: 'bot', text: t.cbConnectError }]);
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
    
    // Đặt lại captcha token sau mỗi lần gửi cho guest (nếu có key)
    if (!hasToken && import.meta.env.VITE_TURNSTILE_SITE_KEY) {
       setGuestCaptchaToken(null);
       setTurnstileKey(prev => prev + 1); // Render lại Turnstile widget
    }
  };

  /**
   * Gửi đánh giá 👍/👎 cho một câu trả lời.
   *
   * Cập nhật giao diện trước rồi mới gọi API, và nuốt lỗi mạng: đây là tín hiệu phụ, để
   * nó chặn hay báo đỏ giữa cuộc trò chuyện thì lợi bất cập hại. Câu hỏi đi kèm chỉ để
   * server đối chiếu — server tự quyết định có lưu hay không dựa trên cài đặt của người
   * dùng, client không được phép tự cho mình quyền đó.
   */
  const sendFeedback = async (messageId, index, rating, reason = null) => {
    if (!messageId) return;
    setFeedback(prev => ({ ...prev, [messageId]: { rating, reason } }));
    setReasonPromptFor(rating === 'DOWN' && !reason ? messageId : null);

    // Câu hỏi gần nhất đứng trước câu trả lời này.
    let question = null;
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') {
        question = messages[i].text;
        break;
      }
    }

    try {
      await fetch(`${API_BASE}/chat/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          messageRef: messageId,
          sessionId: getGuestSessionId(),
          rating,
          reason,
          question,
          language: currentLanguage?.code || 'vi'
        })
      });
    } catch (e) {
      console.warn('Không gửi được đánh giá:', e);
    }
  };

  /**
   * Xóa hội thoại. Trước đây nút này chỉ dọn state trong RAM: người dùng bấm "Xóa", màn
   * hình sạch, nhưng toàn bộ lịch sử vẫn nằm nguyên trong DB — nói dối người dùng về
   * chính dữ liệu của họ.
   */
  const handleClearHistory = async () => {
    if (clearingHistory) return;
    const confirmText = t.chatbotClearConfirm
      || 'Xóa toàn bộ lịch sử hội thoại? Thao tác này không thể hoàn tác.';
    if (messages.length > 1 && !window.confirm(confirmText)) return;

    if (isAuthenticated) {
      setClearingHistory(true);
      try {
        const res = await fetch(`${API_BASE}/chat/history`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (e) {
        console.error('Không xóa được lịch sử chat:', e);
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: t.chatbotClearFailed || 'Chưa xóa được lịch sử. Vui lòng thử lại sau.'
        }]);
        setClearingHistory(false);
        // Cố ý KHÔNG dọn màn hình khi server chưa xóa: màn hình trắng sẽ khiến người dùng
        // tin là đã xóa xong trong khi dữ liệu vẫn còn.
        return;
      }
      setClearingHistory(false);
    } else {
      clearGuestCache();
    }

    setMessages([{ sender: 'bot', text: t.chatbotNewChatMsg || 'Cuộc hội thoại mới. Tôi có thể hỗ trợ gì cho bạn?' }]);
    setChatHistory([]);
    setFeedback({});
    setReasonPromptFor(null);
    setShowFaq(true);
  };

  const [showFaq, setShowFaq] = useState(true);

  const faqItems = [
    { icon: <Search size={14} />, text: t.chatbotFaqFlight || 'Tìm vé máy bay rẻ nhất' },
    { icon: <TrainTrack size={14} />, text: t.chatbotFaqTrain || 'Tìm vé tàu hỏa giá tốt' },
    { icon: <Bus size={14} />, text: t.chatbotFaqBus || 'Tìm vé xe khách hôm nay' },
    { icon: <RotateCcw size={14} />, text: t.chatbotFaqRefund || 'Chính sách đổi trả và hủy vé' },
    { icon: <Tag size={14} />, text: t.chatbotFaqPromo || 'Mã giảm giá mới nhất' },
    { icon: <Ticket size={14} />, text: t.chatbotFaqBookings || 'Xem vé đã đặt của tôi' },
    { icon: <CreditCard size={14} />, text: t.chatbotFaqPayment || 'Phương thức thanh toán' },
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
      let rawUrl = matchLink[2].trim();
      // Sanitize link: chỉ cho phép relative path nội bộ, chặn javascript scheme
      let safeUrl = rawUrl;
      if (!rawUrl.startsWith('/') || rawUrl.toLowerCase().includes('javascript:')) {
        console.warn('Blocked unsafe URL from AI:', rawUrl);
        safeUrl = '/'; // fallback an toàn
      }
      dynamicLinks.push({ text: matchLink[1].trim(), url: safeUrl });
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
                  <Tag size={12} /> {t.cbPromoForYou}
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
                      btn.textContent = t.cbCopied;
                      btn.style.background = 'rgba(255,255,255,0.5)';
                      setTimeout(() => {
                        btn.textContent = t.cbCopy;
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
                    {t.cbCopy}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Render Buttons */}
        {dynamicButtons.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
            {dynamicButtons.map((btn, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(btn)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '20px',
                  border: '1.5px solid rgba(0, 113, 235, 0.45)',
                  backgroundColor: 'rgba(0, 113, 235, 0.08)',
                  color: 'var(--primary)',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 6px rgba(0, 113, 235, 0.1)',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary)';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 113, 235, 0.35)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 113, 235, 0.08)';
                  e.currentTarget.style.color = 'var(--primary)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 113, 235, 0.1)';
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
        className="chat-fab"
        aria-label={t.chatbotSupportBtn || 'Hỗ trợ đặt vé'}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          /* Vị trí, kích thước và bo góc chuyển hết sang .chat-fab trong index.css
             để media query mobile thu nút này về dạng tròn 56px chỉ có icon —
             bản cũ rộng ~200px nằm đè lên widget đặt vé trên màn hình iPhone.
             Inline style chỉ còn giữ phần đổi theo state (ẩn/hiện khi mở chat). */
          backgroundColor: 'var(--primary)',
          color: 'white',
          border: 'none',
          boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 1000,
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: isOpen ? 'translateY(24px) scale(0.92)' : 'translateY(0) scale(1)',
          opacity: isOpen ? 0 : 1,
          visibility: isOpen ? 'hidden' : 'visible',
          pointerEvents: isOpen ? 'none' : 'auto'
        }}
      >
        <MessageCircle size={28} />
        <span className="chat-fab-label" style={{ fontSize: '16px', fontWeight: 600 }}>{t.chatbotSupportBtn || 'Hỗ trợ đặt vé'}</span>
      </button>

      {/* Cửa sổ Chatbot */}
      <div
        className="chat-panel"
        inert={!isOpen}
        style={{
          /* Hình học nằm ở .chat-panel: dưới 768px cửa sổ chuyển sang chiếm trọn
             màn hình, vì 450x680 không thể vừa iPhone và resize:both vô dụng khi
             không có chuột. */
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          transition: 'opacity 0.3s ease, transform 0.3s ease, visibility 0.3s',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateY(0)' : 'translateY(20px)',
          visibility: isOpen ? 'visible' : 'hidden',
          pointerEvents: isOpen ? 'auto' : 'none',
          border: '1px solid var(--border-light)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #091b4f 0%, #0071EB 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.18)', padding: 8, borderRadius: 12 }}>
              <Bot size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15.5, letterSpacing: '-0.2px' }}>
                {t.chatbotAssistantName || 'Trợ lý VigoTrip'}
              </div>
              <div 
                title={aiHealth.message || ''}
                style={{ fontSize: 12, opacity: 0.95, display: 'flex', alignItems: 'center', gap: 6, cursor: 'help' }}
              >
                {aiHealth.status === 'ONLINE' ? (
                  <>
                    <span className="live-pulse-dot"></span>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>{t.chatbotOnlineStatus || 'Đang trực tuyến'}</span>
                  </>
                ) : aiHealth.status === 'CHECKING' ? (
                  <>
                    <span className="connecting-pulse-dot"></span>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>{t.chatbotConnectingStatus || 'Đang kết nối...'}</span>
                  </>
                ) : (
                  <>
                    <span className="offline-pulse-dot"></span>
                    <span style={{ color: '#fca5a5', fontWeight: 600 }}>{t.chatbotMaintenanceStatus || 'Bảo trì / Quá tải'}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Nút xóa lịch sử chat */}
            <button
              onClick={handleClearHistory}
              disabled={clearingHistory}
              title={t.chatbotClearHistoryTitle || 'Xóa lịch sử chat'}
              style={{
                background: 'rgba(255,255,255,0.16)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                opacity: clearingHistory ? 0.6 : 1,
                cursor: clearingHistory ? 'not-allowed' : 'pointer',
                borderRadius: 8,
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
            >
              <Trash2 size={13} /> {t.chatbotClearHistory || 'Xóa'}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.85, padding: 4 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Nội dung Chat */}
        <div
          className="chatbot-messages-container"
          style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            backgroundColor: 'var(--bg-main)'
          }}
        >
          {/* Cảnh báo bảo trì nếu AI Offline / Lỗi */}
          {!aiHealth.ready && aiHealth.status !== 'CHECKING' && (
            <div style={{
              padding: '12px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '12px',
              color: '#f87171',
              fontSize: '13px',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <div>
                <b style={{ color: '#ef4444' }}>{t.chatbotMaintenanceStatus || "Hệ thống AI đang bảo trì"}:</b> {t.chatbotMaintenanceNotice || "Hệ thống AI hiện đang bảo trì hoặc quá tải. Bạn vui lòng thử lại sau ít phút hoặc liên hệ hotline 1900 1234."}
              </div>
            </div>
          )}
          {/* Người dùng đã đăng nhập phải biết hội thoại đang được lưu và tắt được ở đâu.
              Không có dòng này thì việc khôi phục lịch sử là bất ngờ khó chịu, chứ không
              phải tiện lợi. */}
          {isAuthenticated && !noticeAcked && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(99, 102, 241, 0.10)',
              border: '1px solid rgba(99, 102, 241, 0.30)',
              borderRadius: 10,
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8
            }}>
              <ShieldCheck size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                {t.cbPrivacyNotice || 'Hội thoại của bạn được lưu 30 ngày để bạn xem lại. Bạn có thể tắt trong Tài khoản → Cài đặt, hoặc bấm Xóa bất cứ lúc nào.'}
                <button
                  onClick={() => {
                    setNoticeAcked(true);
                    try { localStorage.setItem(NOTICE_ACK_KEY, '1'); } catch { /* không lưu được thì hiện lại lần sau */ }
                  }}
                  style={{
                    display: 'block',
                    marginTop: 6,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--primary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >{t.cbPrivacyNoticeAck || 'Đã hiểu'}</button>
              </div>
            </div>
          )}
          {historyLoading && (
            <div style={{
              alignSelf: 'center',
              fontSize: 12,
              color: 'var(--text-muted)',
              padding: '4px 0'
            }}>
              {t.chatbotLoadingHistory || 'Đang tải lại hội thoại trước…'}
            </div>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                display: 'flex',
                gap: 10,
                flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: msg.sender === 'user' ? 'var(--primary)' : 'rgba(99, 102, 241, 0.15)',
                border: msg.sender === 'bot' ? '1px solid rgba(99, 102, 241, 0.3)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: msg.sender === 'user' ? 'white' : '#818cf8'
              }}>
                {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <div
                  style={{
                    backgroundColor: msg.sender === 'user' ? 'var(--primary)' : 'var(--bg-card)',
                    color: msg.sender === 'user' ? 'white' : 'var(--text-main)',
                    padding: '12px 16px',
                    borderRadius: msg.sender === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                    fontSize: 14.5,
                    lineHeight: 1.55,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    border: msg.sender === 'bot' ? '1px solid var(--border-light)' : 'none',
                    wordBreak: 'break-word'
                  }}
                >
                  {renderMessageContent(msg.text)}
                </div>

                {/* Đánh giá: chỉ hỏi cho câu trả lời thật (có id), không hỏi cho tin nhắn
                    chào hay các thông báo lỗi. Cú bấm chính là sự đồng ý gửi tín hiệu này. */}
                {msg.sender === 'bot' && msg.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {feedback[msg.id] ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {feedback[msg.id].rating === 'UP'
                            ? (t.cbFeedbackThanksUp || 'Cảm ơn bạn đã đánh giá.')
                            : (t.cbFeedbackThanksDown || 'Cảm ơn bạn, chúng tôi sẽ cải thiện.')}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {t.cbFeedbackAsk || 'Câu trả lời này có hữu ích không?'}
                        </span>
                      )}
                      {['UP', 'DOWN'].map(rating => {
                        const active = feedback[msg.id]?.rating === rating;
                        const Icon = rating === 'UP' ? ThumbsUp : ThumbsDown;
                        return (
                          <button
                            key={rating}
                            onClick={() => sendFeedback(msg.id, index, rating)}
                            title={rating === 'UP'
                              ? (t.cbFeedbackUp || 'Hữu ích')
                              : (t.cbFeedbackDown || 'Chưa tốt')}
                            style={{
                              background: active ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                              border: '1px solid',
                              borderColor: active ? 'var(--primary)' : 'var(--border-light)',
                              color: active ? 'var(--primary)' : 'var(--text-muted)',
                              borderRadius: 6,
                              padding: '2px 6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              lineHeight: 1
                            }}
                          >
                            <Icon size={12} />
                          </button>
                        );
                      })}
                    </div>

                    {reasonPromptFor === msg.id && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {FEEDBACK_REASONS.map(({ code, key, fallback }) => (
                          <button
                            key={code}
                            onClick={() => sendFeedback(msg.id, index, 'DOWN', code)}
                            style={{
                              background: 'var(--bg-main)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-muted)',
                              borderRadius: 999,
                              padding: '3px 9px',
                              fontSize: 11,
                              cursor: 'pointer'
                            }}
                          >
                            {t[key] || fallback}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                <Bot size={16} />
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
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 6px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <HelpCircle size={14} style={{ color: 'var(--primary)' }} /> {t.chatbotFaqTitle || 'Câu hỏi phổ biến'}
              </span>
              <button
                onClick={() => setShowFaq(false)}
                style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}
              >{t.chatbotHideFaq || 'Ẩn'}</button>
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
                    color: 'var(--text-main)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    gap: 10,
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = '#818cf8'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span>{item.icon}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.text}</span>
                  </span>
                  <span style={{ fontSize: 16, opacity: 0.4, flexShrink: 0 }}>›</span>
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
              msOverflowStyle: 'none',
              flexShrink: 0
            }}
          >
            {faqItems.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (dragDistance.current > DRAG_THRESHOLD_PX) return;
                  handleSend(item.text);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  userSelect: 'none'
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = '#818cf8'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                {item.icon} {item.text}
              </button>
            ))}
          </div>
        )}

        {/* Turnstile CAPTCHA */}
        {!hasToken && !guestCaptchaToken && import.meta.env.VITE_TURNSTILE_SITE_KEY && (
          <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'center' }}>
            <Turnstile
              key={turnstileKey}
              siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
              onSuccess={(token) => setGuestCaptchaToken(token)}
              options={{ theme: 'auto', size: 'flexible' }}
            />
          </div>
        )}

        {/* Khung nhập */}
        <div style={{
          padding: '14px 18px',
          borderTop: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexShrink: 0
        }}>
          {/* Nút toggle bật/tắt FAQ Panel */}
          <button
            onClick={() => setShowFaq(!showFaq)}
            title="Hiện gợi ý câu hỏi"
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: showFaq ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-main)',
              color: showFaq ? '#818cf8' : 'var(--text-muted)',
              border: '1px solid var(--border-light)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s'
            }}
          >
            <HelpCircle size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !loading && handleSend()}
            placeholder={t.chatbotInputPlaceholder || "Nhập câu hỏi..."}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '11px 16px',
              borderRadius: 12,
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: 14,
              outline: 'none',
              opacity: loading ? 0.6 : 1,
              pointerEvents: (loading || !isOpen) ? 'none' : 'auto'
            }}
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: input.trim() ? 'var(--primary)' : 'var(--bg-main)',
              color: input.trim() ? 'white' : 'var(--text-muted)',
              border: input.trim() ? 'none' : '1px solid var(--border-light)',
              cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s'
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </>
  );
};

export default Chatbot;
