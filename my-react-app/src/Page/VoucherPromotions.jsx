import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useLanguage, translateVoucherDescription } from "../context/LanguageContext";
import { FaGift, FaRegCopy, FaRegBookmark, FaBookmark, FaTag } from "react-icons/fa";

// Ngôn ngữ giao diện -> locale dùng cho ngày/số. Không dùng thẳng mã ngôn ngữ vì
// Intl cần locale đầy đủ ("vi" vẫn chạy nhưng "zh" thì ra giản thể, không khớp 繁體中文).
const LOCALE_BY_LANG = { vi: "vi-VN", en: "en-GB", ja: "ja-JP", zh: "zh-TW" };

const fill = (template, values) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template ?? "");

/**
 * Lý do voucher chưa dùng được.
 *
 * Backend gửi kèm `unavailableReasonCode` (ALREADY_USED, EXPIRED, ...) chính là để chỗ này
 * tự dựng câu theo ngôn ngữ đang chọn; `unavailableReason` là câu tiếng Việt dựng sẵn, chỉ
 * dùng làm phương án dự phòng cho bản backend cũ chưa có mã lý do.
 */
const REASON_KEY_BY_CODE = {
  ALREADY_USED: "vchReasonAlreadyUsed",
  EXPIRED: "vchReasonExpired",
  NOT_STARTED: "vchReasonNotStarted",
  SOLD_OUT: "vchReasonSoldOut",
  PROVIDER_ONLY: "vchReasonProviderOnly",
  MIN_ORDER: "vchReasonMinOrder",
};

const cardBaseStyle = {
  borderRadius: 14,
  border: "1px solid var(--border-light)",
  background: "var(--bg-card)",
  boxShadow: "var(--shadow-md)",
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  position: "relative",
};

function VoucherCard({ voucher, saved, isAuthenticated, onToggleSave, onCopy, t, formatDate, formatMoney }) {
  const remaining = voucher.maxUsage != null ? Math.max(voucher.maxUsage - (voucher.currentUsage || 0), 0) : null;

  const reasonKey = REASON_KEY_BY_CODE[voucher.unavailableReasonCode];
  const reasonText = reasonKey
    ? fill(t[reasonKey], {
        provider: voucher.providerName ?? "",
        amount: voucher.minOrderAmount != null ? formatMoney(voucher.minOrderAmount) : "",
      })
    : voucher.unavailableReason;

  return (
    <div style={{ ...cardBaseStyle, opacity: voucher.available ? 1 : 0.65 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: voucher.available ? "linear-gradient(135deg,#f97316,#fb923c)" : "var(--bg-hover)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: voucher.available ? "#fff" : "var(--text-muted)",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            <FaGift />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--primary)", letterSpacing: 0.3 }}>{voucher.code}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {voucher.providerName ? fill(t.vchAppliesTo, { provider: voucher.providerName }) : t.vchAppliesToAll}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleSave(voucher)}
          title={!isAuthenticated ? t.vchLoginToSaveHint : saved ? t.vchUnsaveHint : t.vchSaveHint}
          style={{
            background: "none",
            border: "none",
            cursor: isAuthenticated ? "pointer" : "not-allowed",
            color: saved ? "#f97316" : "var(--text-muted)",
            fontSize: 18,
            padding: 2,
            flexShrink: 0,
          }}
        >
          {saved ? <FaBookmark /> : <FaRegBookmark />}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: "#f97316" }}>-{voucher.discountPercent}%</span>
        {voucher.maxDiscountAmount != null && (
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            {fill(t.vchMaxDiscount, { amount: formatMoney(voucher.maxDiscountAmount) })}
          </span>
        )}
      </div>

      {voucher.description && (
        <div style={{ fontSize: 13, color: "var(--text-main)", lineHeight: 1.5 }}>
          {translateVoucherDescription(voucher.description, voucher.code, t)}
        </div>
      )}

      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 3 }}>
        {voucher.minOrderAmount != null && <div>{fill(t.vchMinOrder, { amount: formatMoney(voucher.minOrderAmount) })}</div>}
        {voucher.expiryDate && <div>{fill(t.vchExpiry, { date: formatDate(voucher.expiryDate) })}</div>}
        {remaining !== null && <div>{fill(t.vchRemaining, { count: remaining })}</div>}
      </div>

      {!voucher.available && reasonText && (
        <div
          style={{
            fontSize: 12.5,
            color: "#ef4444",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          {reasonText}
        </div>
      )}

      <button
        type="button"
        onClick={() => onCopy(voucher.code)}
        disabled={!voucher.available}
        style={{
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "9px 0",
          borderRadius: 8,
          border: "1px dashed var(--border-main)",
          background: "transparent",
          color: voucher.available ? "var(--primary)" : "var(--text-muted)",
          fontWeight: 700,
          fontSize: 13,
          cursor: voucher.available ? "pointer" : "not-allowed",
        }}
      >
        <FaRegCopy /> {t.vchCopyCode}
      </button>
    </div>
  );
}

const VoucherPromotions = () => {
  const { token, isAuthenticated } = useAuth();
  const toast = useToast();
  const { t, currentLanguage } = useLanguage();
  const [searchParams] = useSearchParams();

  const providerId = searchParams.get("providerId") || null;
  const orderAmount = searchParams.get("orderAmount") || null;

  const [vouchers, setVouchers] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const locale = LOCALE_BY_LANG[currentLanguage.code] || "vi-VN";

  const formatDate = React.useCallback(
    (iso) => {
      if (!iso) return null;
      const d = new Date(iso);
      return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
    },
    [locale]
  );

  // Tiền vẫn luôn là VND, chỉ đổi cách nhóm chữ số và đơn vị: "đ" là ký hiệu quen thuộc với
  // người Việt, còn các ngôn ngữ khác đọc "VND" rõ hơn nhiều.
  const formatMoney = React.useCallback(
    (n) => {
      const amount = Number(n || 0).toLocaleString(locale);
      return currentLanguage.code === "vi" ? `${amount}đ` : `${amount} VND`;
    },
    [locale, currentLanguage.code]
  );

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (providerId) params.providerId = providerId;
      if (orderAmount) params.orderAmount = orderAmount;
      // Gửi kèm token để backend đánh dấu luôn những mã tài khoản này đã dùng rồi
      const res = await axios.get("/api/voucher/list", {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setVouchers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.showToast(t.vchLoadError, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadSaved = async () => {
    if (!isAuthenticated) {
      setSavedIds(new Set());
      return;
    }
    try {
      const res = await axios.get("/api/saved-vouchers", { headers: { Authorization: `Bearer ${token}` } });
      const ids = new Set((Array.isArray(res.data) ? res.data : []).map((v) => v.id));
      setSavedIds(ids);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadVouchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, orderAmount, token]);

  useEffect(() => {
    loadSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleToggleSave = async (voucher) => {
    if (!isAuthenticated) {
      toast.showToast(t.vchLoginToSave, "info");
      return;
    }
    const alreadySaved = savedIds.has(voucher.id);
    try {
      if (alreadySaved) {
        await axios.delete(`/api/saved-vouchers/${voucher.id}`, { headers: { Authorization: `Bearer ${token}` } });
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(voucher.id);
          return next;
        });
        toast.showToast(t.vchUnsaved, "info");
      } else {
        await axios.post(`/api/saved-vouchers/${voucher.id}`, null, { headers: { Authorization: `Bearer ${token}` } });
        setSavedIds((prev) => new Set(prev).add(voucher.id));
        toast.showToast(t.vchSaved, "success");
      }
    } catch (err) {
      console.error(err);
      toast.showToast(t.vchSaveError, "error");
    }
  };

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.showToast(fill(t.vchCopied, { code }), "success");
    } catch {
      toast.showToast(code, "info");
    }
  };

  const { availableVouchers, unavailableVouchers } = useMemo(() => {
    const av = vouchers.filter((v) => v.available);
    const un = vouchers.filter((v) => !v.available);
    return { availableVouchers: av, unavailableVouchers: un };
  }, [vouchers]);

  const cardProps = { t, formatDate, formatMoney, isAuthenticated, onToggleSave: handleToggleSave, onCopy: handleCopy };

  return (
    <div
      className="page-main"
      style={{
        padding: "var(--page-padding)",
        paddingTop: "calc(var(--header-height) + var(--page-padding))",
        color: "var(--text-main)",
        maxWidth: 1200,
        margin: "0 auto",
        minHeight: "60vh",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 10 }}>
          <FaTag style={{ color: "var(--primary)" }} /> {t.vchPageTitle}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
          {providerId ? t.vchSubtitleForOrder : t.vchSubtitleGeneral}
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>{t.vchLoading}</div>
      ) : vouchers.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>{t.vchEmpty}</div>
      ) : (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: "var(--text-heading)" }}>
            {fill(t.vchAvailableHeading, { count: availableVouchers.length })}
          </div>
          {availableVouchers.length === 0 ? (
            <div style={{ padding: "16px 4px", color: "var(--text-muted)", fontSize: 13.5, marginBottom: 24 }}>
              {t.vchNoneAvailable}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
              {availableVouchers.map((v) => (
                <VoucherCard key={v.id} voucher={v} saved={savedIds.has(v.id)} {...cardProps} />
              ))}
            </div>
          )}

          {unavailableVouchers.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: "var(--text-heading)" }}>
                {fill(t.vchUnavailableHeading, { count: unavailableVouchers.length })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {unavailableVouchers.map((v) => (
                  <VoucherCard key={v.id} voucher={v} saved={savedIds.has(v.id)} {...cardProps} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default VoucherPromotions;
