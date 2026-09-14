import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BookmarkPlus, Mail, Sparkles } from 'lucide-react';
import { useLanguage, LANGUAGES } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { buildAnnouncementText } from '../utils/announcements';

/**
 * Nút xác nhận cho hành động có ghi dữ liệu mà trợ lý đề xuất: lưu mã giảm giá, đổi cài đặt thư.
 *
 * Thẻ [ACTION: mã] trong câu trả lời do SERVER gắn, và thẻ này chỉ mang một mã đề xuất. Mọi chữ
 * trên nút — mã nào, đổi cài đặt gì từ đâu sang đâu — dựng từ dữ liệu server trả về theo mã đó,
 * không lấy từ câu trả lời của model. Model chỉ quyết định được là có nút hay không; nó không viết
 * được nội dung nút, nên không dựng được một nút ghi "lưu mã giảm giá" mà thật ra làm việc khác.
 *
 * Việc ghi chỉ xảy ra ở cú bấm xác nhận. Không bấm thì đề xuất tự hết hạn sau 10 phút.
 */
const endpoint = (token) => `/api/chat-actions/${encodeURIComponent(token)}`;

const cardStyle = {
  marginTop: 12,
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--border-light)',
  background: 'rgba(0, 113, 235, 0.06)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const primaryButton = {
  padding: '7px 14px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButton = {
  ...primaryButton,
  background: 'transparent',
  color: 'var(--text-main)',
  border: '1px solid var(--border-light)',
};

const languageName = (code) => LANGUAGES.find((lang) => lang.code === code)?.name ?? code;

/** "Bật → Tắt", hoặc chỉ "Tắt" khi khách đã tự đổi đúng như vậy trong lúc nút còn chờ. */
const describeChange = (from, to, format) => (from === to ? format(to) : `${format(from)} → ${format(to)}`);

export default function ChatActionCard({ token, onNavigate }) {
  const { t, currentLanguage, changeLanguage } = useLanguage();
  const { token: authToken, isAuthenticated } = useAuth();
  const langCode = currentLanguage?.code || 'vi';
  const canCall = Boolean(isAuthenticated && authToken);

  // LOADING | PENDING | SAVED | CANCELLED | GONE | UNAVAILABLE | ERROR
  const [status, setStatus] = useState('LOADING');
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canCall) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await axios.get(endpoint(token), { headers: { Authorization: `Bearer ${authToken}` } });
        if (cancelled) return;
        setAction(res.data ?? null);
        setStatus(res.data?.status === 'PENDING' ? 'PENDING' : 'UNAVAILABLE');
      } catch (err) {
        // 404 là trạng thái bình thường chứ không phải sự cố: đề xuất đã dùng, đã bỏ qua, quá 10
        // phút, hoặc đây là hội thoại khôi phục lại từ lịch sử.
        if (!cancelled) setStatus(err?.response?.status === 404 ? 'GONE' : 'ERROR');
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token, authToken, canCall]);

  const headers = { Authorization: `Bearer ${authToken}` };
  const isMail = action?.type === 'MAIL_PREFERENCES';
  const voucher = action?.voucher ?? null;
  const prefs = isMail ? action.mailPreferences : null;

  const confirm = async () => {
    setBusy(true);
    try {
      await axios.post(`${endpoint(token)}/confirm`, null, { headers });
      setStatus('SAVED');
      // Ngôn ngữ tài khoản cũng là ngôn ngữ giao diện, nên áp nó y như một cú bấm cờ. Không chỉ cho
      // khớp mắt: nếu khách đã bấm cờ trong phiên này, lần nạp hồ sơ sau sẽ đẩy ngôn ngữ trên máy
      // NGƯỢC lên server (syncLanguageFromProfile) và ghi đè mất thứ khách vừa xác nhận ở đây.
      if (prefs?.language) changeLanguage(prefs.language);
    } catch (err) {
      const code = err?.response?.status;
      setStatus(code === 404 ? 'GONE' : code === 409 ? 'UNAVAILABLE' : 'ERROR');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await axios.delete(endpoint(token), { headers });
    } catch {
      /* không huỷ được thì đề xuất vẫn tự hết hạn; với khách, bỏ qua là bỏ qua */
    }
    setBusy(false);
    setStatus('CANCELLED');
  };

  const onOff = (on) => (on ? t.cbActMailOn : t.cbActMailOff);

  let summary = [];
  if (voucher) {
    summary = [
      buildAnnouncementText(
        {
          kind: 'VOUCHER',
          params: {
            code: voucher.code,
            percent: voucher.discountPercent != null ? String(voucher.discountPercent) : '',
            maxDiscount: voucher.maxDiscountAmount,
            minOrder: voucher.minOrderAmount,
            provider: voucher.providerName,
          },
          endsAt: voucher.expiryDate,
        },
        t,
        langCode,
      ),
    ];
  } else if (prefs) {
    summary = [
      prefs.tripReminders != null &&
        `${t.cbActMailReminders}: ${describeChange(prefs.currentTripReminders, prefs.tripReminders, onOff)}`,
      prefs.language &&
        `${t.cbActMailLanguage}: ${describeChange(prefs.currentLanguage, prefs.language, languageName)}`,
    ].filter(Boolean);
  }

  // Những điều phải biết TRƯỚC khi bấm — sau khi bấm thì đã muộn.
  const notes = isMail
    ? [
        t.cbActMailNote,
        prefs?.tripReminders === false && t.cbActMailOtherMails,
        prefs?.language && t.cbActMailLanguageNote,
        prefs?.language &&
          !prefs.languageHasMailTranslation &&
          (t.cbActMailNoTranslation || '').replace('{language}', languageName(prefs.language)),
      ].filter(Boolean)
    : [t.cbActNote];

  const known = isMail || action?.type === 'SAVE_VOUCHER';
  const title = isMail ? t.cbActMailTitle : known ? t.cbActTitle : t.cbActGenericTitle;
  const Icon = isMail ? Mail : known ? BookmarkPlus : Sparkles;

  const messages = {
    SAVED: isMail ? t.cbActMailSaved : (t.cbActSaved || '').replace('{code}', voucher?.code ?? ''),
    CANCELLED: isMail ? t.cbActMailCancelled : t.cbActCancelled,
    GONE: t.cbActGone,
    UNAVAILABLE: t.cbActUnavailable,
    ERROR: t.cbActError,
  };
  const message = canCall ? messages[status] : t.cbActLogin;

  return (
    <div style={cardStyle} role="group" aria-label={title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
        <Icon size={14} /> {title}
      </div>

      {canCall &&
        summary.map((line) => (
          <div key={line} style={{ fontSize: 13, fontWeight: 600 }}>
            {line}
          </div>
        ))}

      {canCall && status === 'PENDING' && (
        <>
          {notes.map((note) => (
            <div key={note} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {note}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={primaryButton} onClick={confirm} disabled={busy}>
              {isMail ? t.cbActMailConfirm : t.cbActConfirm}
            </button>
            <button type="button" style={secondaryButton} onClick={cancel} disabled={busy}>
              {t.cbActCancel}
            </button>
          </div>
        </>
      )}

      {message && (
        <div role="status" style={{ fontSize: 13 }}>
          {message}
        </div>
      )}

      {canCall && status === 'SAVED' && (
        <button
          type="button"
          style={{ ...secondaryButton, alignSelf: 'flex-start' }}
          onClick={() => onNavigate?.(isMail ? '/account' : '/uu-dai')}
        >
          {isMail ? t.cbLinkAccount : t.cbLinkOffers}
        </button>
      )}
    </div>
  );
}
