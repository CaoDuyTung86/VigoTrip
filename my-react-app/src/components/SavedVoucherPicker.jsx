import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { FaGift, FaChevronDown, FaRegBookmark, FaBookmark, FaExternalLinkAlt } from "react-icons/fa";

/**
 * Nút "Voucher đã lưu" đặt cạnh ô nhập mã khuyến mãi khi đặt vé.
 *
 * Hai chế độ, cả hai đều nằm gọn trong popup — KHÔNG rời khỏi trang đặt vé:
 *   - "Đã lưu"          : voucher người dùng đã lưu vào tài khoản, chọn rồi áp mã.
 *   - "Khám phá ưu đãi" : toàn bộ ưu đãi đang có, lưu và áp mã ngay tại chỗ.
 *
 * Vì sao không điều hướng sang /uu-dai nữa: toàn bộ tiến trình đặt vé (ghế đã chọn,
 * thông tin hành khách, bước đang đứng) nằm trong state của trang đặt vé. Chuyển route
 * là mất sạch, người dùng phải đặt lại từ đầu — và ghế đang giữ cũng đếm ngược hết hạn.
 */
const SavedVoucherPicker = ({ providerId, orderAmount, onApply }) => {
  const { token, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const containerRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("saved"); // "saved" | "discover"
  const [loading, setLoading] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [allVouchers, setAllVouchers] = useState([]);
  const [selectedCode, setSelectedCode] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const buildParams = useCallback(() => {
    const params = {};
    if (providerId != null) params.providerId = providerId;
    if (orderAmount != null) params.orderAmount = orderAmount;
    return params;
  }, [providerId, orderAmount]);

  const authHeaders = useCallback(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token],
  );

  const loadSavedVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/saved-vouchers", { params: buildParams(), headers: authHeaders() });
      setVouchers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      showToast("Không tải được voucher đã lưu. Vui lòng thử lại.", "error");
    } finally {
      setLoading(false);
    }
  }, [buildParams, authHeaders, showToast]);

  const loadAllVouchers = useCallback(async () => {
    setLoading(true);
    try {
      // Gửi kèm token để backend đánh dấu sẵn mã nào đã lưu / đã dùng
      const res = await axios.get("/api/voucher/list", { params: buildParams(), headers: authHeaders() });
      setAllVouchers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      showToast("Không tải được danh sách ưu đãi. Vui lòng thử lại.", "error");
    } finally {
      setLoading(false);
    }
  }, [buildParams, authHeaders, showToast]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    // Luôn tải lại khi mở để tình trạng khả dụng khớp với giá trị đơn hàng hiện tại
    if (next && isAuthenticated) {
      setTab("saved");
      setSelectedCode(null);
      loadSavedVouchers();
    }
  };

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setSelectedCode(null);
    if (nextTab === "discover") {
      loadAllVouchers();
    } else {
      loadSavedVouchers();
    }
  };

  const handleConfirm = () => {
    if (!selectedCode) return;
    onApply(selectedCode);
    setOpen(false);
  };

  /** Lưu / bỏ lưu voucher ngay tại popup — không rời trang đặt vé. */
  const handleSave = async (voucher) => {
    if (savingId != null) return;
    setSavingId(voucher.id);
    try {
      if (voucher.saved) {
        await axios.delete(`/api/saved-vouchers/${voucher.id}`, { headers: authHeaders() });
        showToast(`Đã bỏ lưu mã ${voucher.code}`, "info");
      } else {
        await axios.post(`/api/saved-vouchers/${voucher.id}`, null, { headers: authHeaders() });
        showToast(`Đã lưu mã ${voucher.code} vào tài khoản`, "success");
      }
      setAllVouchers((prev) =>
        prev.map((v) => (v.id === voucher.id ? { ...v, saved: !voucher.saved } : v)),
      );
      // Danh sách "Đã lưu" giờ đã cũ — nạp lại nền để lần chuyển tab sau là đúng.
      loadSavedVouchers();
    } catch (err) {
      console.error(err);
      showToast("Không thể cập nhật voucher đã lưu. Vui lòng thử lại.", "error");
    } finally {
      setSavingId(null);
    }
  };

  /** Áp mã trực tiếp từ tab Khám phá, bỏ qua bước lưu. */
  const handleApplyNow = (voucher) => {
    onApply(voucher.code);
    setOpen(false);
  };

  /**
   * Mở trang ưu đãi đầy đủ ở TAB MỚI. Giữ nguyên tab đang đặt vé để tiến trình
   * (ghế, hành khách, đồng hồ giữ chỗ) không bị mất.
   */
  const openPromotionsInNewTab = () => {
    const params = new URLSearchParams();
    if (providerId != null) params.set("providerId", providerId);
    if (orderAmount != null) params.set("orderAmount", Math.round(orderAmount));
    window.open(`/uu-dai${params.toString() ? `?${params.toString()}` : ""}`, "_blank", "noopener,noreferrer");
  };

  const tabButtonStyle = (active) => ({
    flex: 1,
    padding: "6px 0",
    borderRadius: 7,
    border: "none",
    background: active ? "var(--primary)" : "transparent",
    color: active ? "#fff" : "var(--text-secondary)",
    fontWeight: 700,
    fontSize: 12.5,
    cursor: "pointer",
  });

  const renderSavedList = () => {
    if (loading) {
      return <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", padding: "12px 4px" }}>Đang tải...</div>;
    }
    if (vouchers.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "6px 4px" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>Bạn chưa lưu voucher nào.</div>
          <button
            type="button"
            onClick={() => switchTab("discover")}
            style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
          >
            Khám phá ưu đãi
          </button>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}>
            Xem ngay tại đây, không mất tiến trình đặt vé.
          </div>
        </div>
      );
    }
    return (
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
    );
  };

  const renderDiscoverList = () => {
    if (loading) {
      return <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", padding: "12px 4px" }}>Đang tải ưu đãi...</div>;
    }
    if (allVouchers.length === 0) {
      return (
        <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", padding: "12px 4px" }}>
          Hiện chưa có ưu đãi nào phù hợp với đơn hàng này.
        </div>
      );
    }
    return (
      <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {allVouchers.map((v) => (
          <div
            key={v.id}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border-main)",
              opacity: v.available ? 1 : 0.6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 13, color: "var(--primary)" }}>{v.code}</b>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {v.providerName ? `Áp dụng: ${v.providerName}` : "Áp dụng cho tất cả các hãng"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#f97316", whiteSpace: "nowrap" }}>-{v.discountPercent}%</span>
                <button
                  type="button"
                  onClick={() => handleSave(v)}
                  disabled={savingId === v.id}
                  title={v.saved ? "Bỏ lưu" : "Lưu vào tài khoản"}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 2,
                    cursor: savingId === v.id ? "wait" : "pointer",
                    color: v.saved ? "#f97316" : "var(--text-muted)",
                    fontSize: 15,
                  }}
                >
                  {v.saved ? <FaBookmark /> : <FaRegBookmark />}
                </button>
              </div>
            </div>

            {v.minOrderAmount != null && (
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
                Đơn tối thiểu {Number(v.minOrderAmount).toLocaleString("vi-VN")}đ
              </div>
            )}
            {!v.available && v.unavailableReason && (
              <div style={{ fontSize: 11.5, color: "#ef4444", marginTop: 3 }}>{v.unavailableReason}</div>
            )}

            <button
              type="button"
              onClick={() => handleApplyNow(v)}
              disabled={!v.available}
              style={{
                marginTop: 7,
                width: "100%",
                padding: "6px 0",
                borderRadius: 7,
                border: "none",
                background: v.available ? "var(--primary)" : "var(--bg-hover)",
                color: v.available ? "#fff" : "var(--text-muted)",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: v.available ? "pointer" : "not-allowed",
              }}
            >
              Áp dụng ngay
            </button>
          </div>
        ))}
      </div>
    );
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
            width: 320,
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
          ) : (
            <>
              <div style={{ display: "flex", gap: 4, marginBottom: 10, padding: 3, background: "var(--bg-hover)", borderRadius: 9 }}>
                <button type="button" onClick={() => switchTab("saved")} style={tabButtonStyle(tab === "saved")}>
                  Đã lưu
                </button>
                <button type="button" onClick={() => switchTab("discover")} style={tabButtonStyle(tab === "discover")}>
                  Khám phá ưu đãi
                </button>
              </div>

              {tab === "saved" ? renderSavedList() : renderDiscoverList()}

              <button
                type="button"
                onClick={openPromotionsInNewTab}
                title="Mở ở tab mới — tiến trình đặt vé của bạn được giữ nguyên"
                style={{
                  marginTop: 10,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "6px 0",
                  borderRadius: 7,
                  border: "1px dashed var(--border-main)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <FaExternalLinkAlt style={{ fontSize: 10 }} /> Mở trang ưu đãi ở tab mới
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SavedVoucherPicker;
