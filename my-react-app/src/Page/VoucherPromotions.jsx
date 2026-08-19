import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { FaGift, FaRegCopy, FaRegBookmark, FaBookmark, FaTag } from "react-icons/fa";

const formatDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatMoney = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";

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

function VoucherCard({ voucher, saved, isAuthenticated, onToggleSave, onCopy }) {
  const remaining = voucher.maxUsage != null ? Math.max(voucher.maxUsage - (voucher.currentUsage || 0), 0) : null;

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
              {voucher.providerName ? `Áp dụng: ${voucher.providerName}` : "Áp dụng cho tất cả các hãng"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleSave(voucher)}
          title={!isAuthenticated ? "Đăng nhập để lưu voucher" : saved ? "Bỏ lưu" : "Lưu vào tài khoản"}
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
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>tối đa {formatMoney(voucher.maxDiscountAmount)}</span>
        )}
      </div>

      {voucher.description && (
        <div style={{ fontSize: 13, color: "var(--text-main)", lineHeight: 1.5 }}>{voucher.description}</div>
      )}

      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 3 }}>
        {voucher.minOrderAmount != null && <div>Đơn hàng tối thiểu: {formatMoney(voucher.minOrderAmount)}</div>}
        {voucher.expiryDate && <div>Hạn sử dụng: {formatDate(voucher.expiryDate)}</div>}
        {remaining !== null && <div>Số lượt còn lại: {remaining}</div>}
      </div>

      {!voucher.available && voucher.unavailableReason && (
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
          {voucher.unavailableReason}
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
        <FaRegCopy /> Sao chép mã
      </button>
    </div>
  );
}

const VoucherPromotions = () => {
  const { token, isAuthenticated } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const providerId = searchParams.get("providerId") || null;
  const orderAmount = searchParams.get("orderAmount") || null;

  const [vouchers, setVouchers] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

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
      toast.showToast("Không thể tải danh sách ưu đãi", "error");
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
      toast.showToast("Vui lòng đăng nhập để lưu voucher vào tài khoản", "info");
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
        toast.showToast("Đã bỏ lưu voucher", "info");
      } else {
        await axios.post(`/api/saved-vouchers/${voucher.id}`, null, { headers: { Authorization: `Bearer ${token}` } });
        setSavedIds((prev) => new Set(prev).add(voucher.id));
        toast.showToast("Đã lưu voucher vào tài khoản", "success");
      }
    } catch (err) {
      console.error(err);
      toast.showToast("Không thể cập nhật voucher đã lưu", "error");
    }
  };

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.showToast(`Đã sao chép mã ${code}`, "success");
    } catch {
      toast.showToast(code, "info");
    }
  };

  const { availableVouchers, unavailableVouchers } = useMemo(() => {
    const av = vouchers.filter((v) => v.available);
    const un = vouchers.filter((v) => !v.available);
    return { availableVouchers: av, unavailableVouchers: un };
  }, [vouchers]);

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
          <FaTag style={{ color: "var(--primary)" }} /> Ưu đãi & Voucher
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
          {providerId
            ? "Danh sách voucher áp dụng cho đơn hàng bạn đang đặt. Lưu mã yêu thích để dùng nhanh ở lần đặt vé tới."
            : "Khám phá các mã giảm giá đang có. Lưu voucher vào tài khoản để mở nhanh khi nhập mã lúc đặt vé."}
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>Đang tải ưu đãi...</div>
      ) : vouchers.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>Hiện chưa có voucher nào.</div>
      ) : (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: "var(--text-heading)" }}>
            Đang khả dụng ({availableVouchers.length})
          </div>
          {availableVouchers.length === 0 ? (
            <div style={{ padding: "16px 4px", color: "var(--text-muted)", fontSize: 13.5, marginBottom: 24 }}>
              Không có voucher nào khả dụng với đơn hàng hiện tại.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
              {availableVouchers.map((v) => (
                <VoucherCard
                  key={v.id}
                  voucher={v}
                  saved={savedIds.has(v.id)}
                  isAuthenticated={isAuthenticated}
                  onToggleSave={handleToggleSave}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          )}

          {unavailableVouchers.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: "var(--text-heading)" }}>
                Chưa thể sử dụng ({unavailableVouchers.length})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {unavailableVouchers.map((v) => (
                  <VoucherCard
                    key={v.id}
                    voucher={v}
                    saved={savedIds.has(v.id)}
                    isAuthenticated={isAuthenticated}
                    onToggleSave={handleToggleSave}
                    onCopy={handleCopy}
                  />
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
