import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaGift, FaChevronDown } from "react-icons/fa";

/**
 * Nút "Voucher đã lưu" đặt cạnh ô nhập mã khuyến mãi khi đặt vé.
 * Cho phép mở nhanh danh sách voucher người dùng đã lưu vào tài khoản,
 * chọn 1 mã còn áp dụng được rồi bấm "Đồng ý" để tự động áp mã (gọi onApply(code)).
 */
const SavedVoucherPicker = ({ providerId, orderAmount, onApply }) => {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [selectedCode, setSelectedCode] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadSavedVouchers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (providerId != null) params.providerId = providerId;
      if (orderAmount != null) params.orderAmount = orderAmount;
      const res = await axios.get("/api/saved-vouchers", { params, headers: { Authorization: `Bearer ${token}` } });
      setVouchers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    // Luôn tải lại khi mở để tình trạng khả dụng khớp với giá trị đơn hàng hiện tại
    if (next && isAuthenticated) {
      loadSavedVouchers();
    }
  };

  const handleConfirm = () => {
    if (!selectedCode) return;
    onApply(selectedCode);
    setOpen(false);
  };

  const goToPromotions = () => {
    const params = new URLSearchParams();
    if (providerId != null) params.set("providerId", providerId);
    if (orderAmount != null) params.set("orderAmount", Math.round(orderAmount));
    navigate(`/uu-dai${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={toggleOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid var(--border-main)",
          background: open ? "var(--bg-hover)" : "transparent",
          color: "var(--primary)",
          fontSize: 12.5,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <FaGift /> Voucher đã lưu
        <FaChevronDown style={{ fontSize: 10, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            right: 0,
            width: 300,
            maxWidth: "90vw",
            background: "var(--bg-dropdown)",
            border: "1px solid var(--border-light)",
            borderRadius: 12,
            boxShadow: "var(--shadow-lg)",
            zIndex: 1002,
            padding: 12,
          }}
        >
          {!isAuthenticated ? (
            <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", padding: "8px 4px" }}>
              Đăng nhập để lưu và áp dụng nhanh voucher yêu thích.
            </div>
          ) : loading ? (
            <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", padding: "12px 4px" }}>Đang tải...</div>
          ) : vouchers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "6px 4px" }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>Bạn chưa lưu voucher nào.</div>
              <button
                type="button"
                onClick={goToPromotions}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
              >
                Khám phá ưu đãi
              </button>
            </div>
          ) : (
            <>
              <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {vouchers.map((v) => (
                  <label
                    key={v.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${selectedCode === v.code ? "var(--primary)" : "var(--border-main)"}`,
                      background: selectedCode === v.code ? "var(--primary-light)" : "transparent",
                      cursor: v.available ? "pointer" : "not-allowed",
                      opacity: v.available ? 1 : 0.55,
                    }}
                  >
                    <input
                      type="radio"
                      name="saved-voucher-pick"
                      disabled={!v.available}
                      checked={selectedCode === v.code}
                      onChange={() => setSelectedCode(v.code)}
                      style={{ marginTop: 3 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                        <b style={{ fontSize: 13, color: "var(--primary)" }}>{v.code}</b>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#f97316", whiteSpace: "nowrap" }}>-{v.discountPercent}%</span>
                      </div>
                      {v.minOrderAmount != null && (
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Đơn tối thiểu {Number(v.minOrderAmount).toLocaleString("vi-VN")}đ</div>
                      )}
                      {!v.available && (
                        <div style={{ fontSize: 11.5, color: "#ef4444", marginTop: 2 }}>{v.unavailableReason}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedCode}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "9px 0",
                  borderRadius: 8,
                  border: "none",
                  background: selectedCode ? "var(--primary)" : "var(--bg-hover)",
                  color: selectedCode ? "#fff" : "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: selectedCode ? "pointer" : "not-allowed",
                }}
              >
                Đồng ý, áp dụng mã
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SavedVoucherPicker;
