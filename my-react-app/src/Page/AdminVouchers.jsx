import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useLanguage, translateVoucherDescription } from "../context/LanguageContext";
import { FaTag, FaPlus, FaEdit, FaTrash, FaSearch, FaTimes, FaToggleOn, FaToggleOff } from "react-icons/fa";
import ModalPortal from "../components/ModalPortal";

const API_BASE = "/api";

// Ngôn ngữ giao diện -> locale cho ngày/số. Xem chú thích cùng tên ở VoucherPromotions.jsx.
const LOCALE_BY_LANG = { vi: "vi-VN", en: "en-GB", ja: "ja-JP", zh: "zh-TW" };

const fill = (template, values) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template ?? "");

// Backend trả lỗi dạng { status, error, message, ... }. Trước đây chỗ này alert nguyên
// chuỗi JSON nên admin nhìn thấy cả dấu ngoặc và timestamp; lấy đúng trường message ra.
const readErrorMessage = async (res, fallback) => {
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const data = JSON.parse(text);
      return data?.message || data?.error || fallback;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
};

const emptyForm = {
  code: "",
  discountPercent: "",
  maxDiscountAmount: "",
  minOrderAmount: "",
  startDate: "",
  expiryDate: "",
  maxUsage: "",
  description: "",
  isActive: true,
  // Mặc định BẬT: phần lớn mã sinh ra là để rao. Mã riêng cho từng người mới là ngoại lệ,
  // và ngoại lệ thì để người tạo tự tắt.
  showOnTicker: true,
  providerId: "",
};

// input[type=datetime-local] value <-> ISO LocalDateTime (yyyy-MM-ddTHH:mm)
const toInputDate = (iso) => (iso ? iso.substring(0, 16) : "");
const toPayloadDate = (val) => (val ? `${val}:00` : null);

const formatDate = (iso, locale) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// Tiền luôn là VND, chỉ khác cách nhóm chữ số và đơn vị hiển thị.
const formatMoney = (n, locale, langCode) => {
  const amount = Number(n || 0).toLocaleString(locale);
  return langCode === "vi" ? `${amount}đ` : `${amount} VND`;
};

const providerTypeLabel = (type, t) => {
  if (type === "AIRLINE") return t.admVchVehiclePlane;
  if (type === "TRAIN") return t.admVchVehicleTrain;
  return t.admVchVehicleBus;
};

const buildPayload = (form) => ({
  code: form.code.trim().toUpperCase(),
  discountPercent: form.discountPercent === "" ? null : Number(form.discountPercent),
  maxDiscountAmount: form.maxDiscountAmount === "" ? null : Number(form.maxDiscountAmount),
  minOrderAmount: form.minOrderAmount === "" ? null : Number(form.minOrderAmount),
  startDate: toPayloadDate(form.startDate),
  expiryDate: toPayloadDate(form.expiryDate),
  maxUsage: form.maxUsage === "" ? null : Number(form.maxUsage),
  description: form.description.trim(),
  isActive: form.isActive,
  showOnTicker: form.showOnTicker,
  providerId: form.providerId === "" ? null : Number(form.providerId),
});

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border-input)",
  background: "var(--bg-main)",
  color: "var(--text-main)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle = { fontSize: 13, fontWeight: 600, marginBottom: 6, display: "block", color: "var(--text-muted)" };

// Trạng thái rút gọn của một voucher. Tách khỏi badge vì bộ lọc "còn hiệu lực / đã nghỉ"
// phải phân loại y hệt những gì admin đọc được trên bảng.
const STATUS_STYLE = {
  active: { color: "#10b981", labelKey: "admVchStatusActive" },
  disabled: { color: "#9ca3af", labelKey: "admVchStatusDisabled" },
  soldOut: { color: "#ef4444", labelKey: "admVchStatusSoldOut" },
  expired: { color: "#ef4444", labelKey: "admVchStatusExpired" },
  notStarted: { color: "#f59e0b", labelKey: "admVchStatusNotStarted" },
};

// Voucher "đã nghỉ": không còn phát hành được nữa và cũng không tự sống lại.
// notStarted không nằm ở đây vì nó sẽ tự chạy khi tới ngày bắt đầu.
const RETIRED_STATUSES = ["disabled", "soldOut", "expired"];

function voucherStatus(voucher) {
  const now = new Date();
  const start = voucher.startDate ? new Date(voucher.startDate) : null;
  const end = voucher.expiryDate ? new Date(voucher.expiryDate) : null;
  const soldOut = voucher.maxUsage != null && voucher.currentUsage >= voucher.maxUsage;

  if (!voucher.isActive) return "disabled";
  if (soldOut) return "soldOut";
  if (end && now > end) return "expired";
  if (start && now < start) return "notStarted";
  return "active";
}

function VoucherStatusBadge({ voucher, t }) {
  const { color, labelKey } = STATUS_STYLE[voucherStatus(voucher)];
  const label = t[labelKey];

  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: `${color}1a`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

const AdminVouchers = () => {
  const { token, user } = useAuth();
  const toast = useToast?.() || { showToast: () => {} };
  const { t, currentLanguage } = useLanguage();
  const locale = LOCALE_BY_LANG[currentLanguage.code] || "vi-VN";
  const money = (n) => formatMoney(n, locale, currentLanguage.code);
  const isAdmin = user?.role === "ROLE_ADMIN";
  const isProvider = user?.role === "ROLE_PROVIDER";

  const [vouchers, setVouchers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // "active" = chỉ voucher còn dùng được, "retired" = đã tắt/hết hạn/hết lượt, "all" = tất cả.
  // Mặc định giấu voucher đã nghỉ để bảng không phình ra theo thời gian — đó là cách xử lý
  // "voucher cũ nằm lại mãi" thay vì xóa dữ liệu đi.
  const [statusFilter, setStatusFilter] = useState("active");
  const [togglingId, setTogglingId] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [editModal, setEditModal] = useState({ show: false, voucher: null, form: emptyForm, loading: false });
  const [deleteModal, setDeleteModal] = useState({ show: false, voucher: null, loading: false, bookingCount: null });

  useEffect(() => {
    if (token) loadVouchers();
  }, [token, isAdmin]);

  useEffect(() => {
    if (token && isAdmin) loadProviders();
  }, [token, isAdmin]);

  const loadProviders = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/providers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProviders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadVouchers = async () => {
    setLoading(true);
    try {
      // Provider chỉ được xem các mã đang hoạt động và còn hiệu lực
      const endpoint = isAdmin ? "/admin/vouchers" : "/admin/vouchers/active";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVouchers(Array.isArray(data) ? data : []);
      } else {
        toast.showToast?.(t.admVchLoadError, "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.(t.admVchConnError, "error");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (f) => {
    if (!f.code.trim()) return t.admVchErrCodeRequired;
    if (f.discountPercent === "" || Number(f.discountPercent) <= 0 || Number(f.discountPercent) > 100) {
      return t.admVchErrPercentRange;
    }
    if (f.startDate && f.expiryDate && new Date(f.startDate) >= new Date(f.expiryDate)) {
      return t.admVchErrDateOrder;
    }
    if (f.maxUsage !== "" && Number(f.maxUsage) <= 0) {
      return t.admVchErrMaxUsage;
    }
    return null;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const err = validateForm(form);
    if (err) {
      alert(err);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/vouchers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload(form)),
      });
      if (res.ok) {
        setForm(emptyForm);
        loadVouchers();
        toast.showToast?.(t.admVchCreated, "success");
      } else {
        alert(await readErrorMessage(res, t.admVchCreateError));
      }
    } catch (err) {
      console.error(err);
      alert(t.admVchConnError);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (voucher) => {
    setEditModal({
      show: true,
      voucher,
      loading: false,
      form: {
        code: voucher.code || "",
        discountPercent: voucher.discountPercent ?? "",
        maxDiscountAmount: voucher.maxDiscountAmount ?? "",
        minOrderAmount: voucher.minOrderAmount ?? "",
        startDate: toInputDate(voucher.startDate),
        expiryDate: toInputDate(voucher.expiryDate),
        maxUsage: voucher.maxUsage ?? "",
        description: voucher.description || "",
        isActive: voucher.isActive !== false,
        // undefined của bản ghi cũ (cột thêm sau) được hiểu là bật, khớp với backend.
        showOnTicker: voucher.showOnTicker !== false,
        providerId: voucher.provider?.id ?? "",
      },
    });
  };

  const handleEdit = async () => {
    const err = validateForm(editModal.form);
    if (err) {
      alert(err);
      return;
    }
    setEditModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/admin/vouchers/${editModal.voucher.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload(editModal.form)),
      });
      if (res.ok) {
        setEditModal({ show: false, voucher: null, form: emptyForm, loading: false });
        loadVouchers();
        toast.showToast?.(t.admVchUpdated, "success");
      } else {
        alert(await readErrorMessage(res, t.admVchUpdateError));
      }
    } catch (err) {
      console.error(err);
      alert(t.admVchConnError);
    } finally {
      setEditModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Bật/tắt voucher — thao tác "gỡ" mặc định. Giữ nguyên bản ghi nên không mất dữ liệu
  // đối soát của các đơn cũ, và bật lại được bất cứ lúc nào.
  const handleToggleActive = async (voucher) => {
    setTogglingId(voucher.id);
    const nextActive = !voucher.isActive;
    try {
      const res = await fetch(`${API_BASE}/admin/vouchers/${voucher.id}/active?active=${nextActive}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        loadVouchers();
        toast.showToast?.(nextActive ? t.admVchEnabled : t.admVchDisabled, "success");
      } else {
        alert(await readErrorMessage(res, t.admVchToggleError));
      }
    } catch (err) {
      console.error(err);
      alert(t.admVchConnError);
    } finally {
      setTogglingId(null);
    }
  };

  // Hỏi backend voucher đã nằm trên bao nhiêu đơn TRƯỚC khi mở hộp thoại, để hiện đúng
  // lựa chọn: chưa đơn nào thì cho xóa hẳn, đã có đơn thì chỉ mời tắt.
  const openDeleteModal = async (voucher) => {
    setDeleteModal({ show: true, voucher, loading: false, bookingCount: null });
    try {
      const res = await fetch(`${API_BASE}/admin/vouchers/${voucher.id}/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDeleteModal((prev) =>
          prev.voucher?.id === voucher.id ? { ...prev, bookingCount: data.bookingCount ?? 0 } : prev);
      }
    } catch (err) {
      // Không đọc được số đơn thì vẫn cho bấm — backend còn một lớp chặn nữa.
      console.error(err);
    }
  };

  const closeDeleteModal = () => setDeleteModal({ show: false, voucher: null, loading: false, bookingCount: null });

  const handleDelete = async () => {
    setDeleteModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/admin/vouchers/${deleteModal.voucher.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok || res.status === 204) {
        closeDeleteModal();
        loadVouchers();
        toast.showToast?.(t.admVchDeleted, "success");
      } else {
        alert(await readErrorMessage(res, t.admVchDeleteError));
      }
    } catch (err) {
      console.error(err);
      alert(t.admVchConnError);
    } finally {
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Tắt ngay từ trong hộp thoại xóa, cho trường hợp voucher đã có đơn nên không xóa được.
  const handleDisableFromDeleteModal = async () => {
    const voucher = deleteModal.voucher;
    setDeleteModal((prev) => ({ ...prev, loading: true }));
    await handleToggleActive(voucher);
    closeDeleteModal();
  };

  if (!isAdmin && !isProvider) {
    return (
      <div style={{ padding: 24, color: "var(--text-main)", textAlign: "center" }}>
        <h2>{t.admVchTitle}</h2>
        <p>{t.admVchNoAccess}</p>
      </div>
    );
  }

  const filteredVouchers = vouchers.filter((v) => {
    const retired = RETIRED_STATUSES.includes(voucherStatus(v));
    if (statusFilter === "active" && retired) return false;
    if (statusFilter === "retired" && !retired) return false;

    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (v.code || "").toLowerCase().includes(q) || (v.description || "").toLowerCase().includes(q);
  });

  const retiredCount = vouchers.filter((v) => RETIRED_STATUSES.includes(voucherStatus(v))).length;

  return (
    <div
      className="page-main"
      style={{
        padding: "var(--page-padding)",
        paddingTop: "calc(var(--header-offset) + var(--page-padding))",
        color: "var(--text-main)",
        maxWidth: 1300,
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 10 }}>
            <FaTag style={{ color: "var(--primary)" }} /> {isAdmin ? t.admVchTitle : t.admVchTitleProvider}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            {isAdmin ? t.admVchSubtitle : t.admVchSubtitleProvider}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            title={t.admVchFilterLabel}
            style={{ ...inputStyle, padding: "9px 12px", width: "auto" }}
          >
            <option value="active">{t.admVchFilterActive}</option>
            <option value="retired">{fill(t.admVchFilterRetired, { count: retiredCount })}</option>
            <option value="all">{t.admVchFilterAll}</option>
          </select>

          <div style={{ position: "relative" }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 13 }} />
            <input
              type="text"
              placeholder={t.admVchSearchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, padding: "9px 14px 9px 34px", width: 240 }}
            />
          </div>
        </div>
      </div>

      {/* Form tạo voucher mới (chỉ Admin) */}
      {isAdmin && (
      <div
        style={{
          marginBottom: 28,
          padding: 22,
          borderRadius: 16,
          border: "1px solid var(--border-light)",
          background: "var(--bg-card)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 8 }}>
          <FaPlus style={{ fontSize: 14, color: "var(--primary)" }} /> {t.admVchAddNew}
        </h3>
        <form className="grid-form" onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <div>
            <label style={labelStyle}>{t.admVchProviderLabel}</label>
            <select value={form.providerId} onChange={(e) => setForm((p) => ({ ...p, providerId: e.target.value }))} style={inputStyle}>
              <option value="">{t.admVchAllProviders}</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.providerName} ({providerTypeLabel(p.providerType, t)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t.admVchCode} <span style={{ color: "red" }}>*</span></label>
            <input type="text" placeholder={t.admVchCodePlaceholder} value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t.admVchDiscountPercent} <span style={{ color: "red" }}>*</span></label>
            <input type="number" min="1" max="100" placeholder={t.admVchDiscountPercentPlaceholder} value={form.discountPercent} onChange={(e) => setForm((p) => ({ ...p, discountPercent: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t.admVchMaxDiscount}</label>
            <input type="number" min="0" placeholder={t.admVchMaxDiscountPlaceholder} value={form.maxDiscountAmount} onChange={(e) => setForm((p) => ({ ...p, maxDiscountAmount: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t.admVchMinOrder}</label>
            <input type="number" min="0" placeholder={t.admVchMinOrderPlaceholder} value={form.minOrderAmount} onChange={(e) => setForm((p) => ({ ...p, minOrderAmount: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t.admVchStartDate}</label>
            <input type="datetime-local" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t.admVchExpiryDate}</label>
            <input type="datetime-local" value={form.expiryDate} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t.admVchMaxUsage}</label>
            <input type="number" min="1" placeholder={t.admVchMaxUsagePlaceholder} value={form.maxUsage} onChange={(e) => setForm((p) => ({ ...p, maxUsage: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-main)", cursor: "pointer" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
              {t.admVchActivateNow}
            </label>
          </div>
          {/* Tách khỏi "kích hoạt": mã còn dùng được và mã được rao lên bảng tin là hai câu
              hỏi khác nhau. Mã chatbot phát riêng cho từng người thì bật nhưng không rao. */}
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <label
              title={t.admVchShowOnTickerHint}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-main)", cursor: "pointer" }}
            >
              <input type="checkbox" checked={form.showOnTicker} onChange={(e) => setForm((p) => ({ ...p, showOnTicker: e.target.checked }))} />
              {t.admVchShowOnTicker}
            </label>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>{t.admVchDescription}</label>
            <input type="text" placeholder={t.admVchDescriptionPlaceholder} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "11px 24px",
                borderRadius: 10,
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                cursor: submitting ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 14,
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
              }}
            >
              {submitting ? t.admVchSaving : t.admVchSubmit}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Bảng danh sách */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid var(--border-light)",
          background: "var(--bg-card)",
          boxShadow: "var(--shadow-md)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light)" }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-heading)" }}>
            {fill(t.admVchTotal, { count: filteredVouchers.length })}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{t.admVchLoading}</div>
        ) : filteredVouchers.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{t.admVchEmpty}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "14px 16px" }}>{t.admVchColCode}</th>
                  <th style={{ padding: "14px 16px" }}>{t.admVchColDiscount}</th>
                  <th style={{ padding: "14px 16px" }}>{t.admVchColProvider}</th>
                  <th style={{ padding: "14px 16px" }}>{t.admVchColPeriod}</th>
                  <th style={{ padding: "14px 16px" }}>{t.admVchColUsage}</th>
                  <th style={{ padding: "14px 16px" }}>{t.admVchColStatus}</th>
                  {isAdmin && <th style={{ padding: "14px 16px", textAlign: "center" }}>{t.admVchColActions}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.map((v) => {
                  const remaining = v.maxUsage != null ? Math.max(v.maxUsage - (v.currentUsage || 0), 0) : null;
                  return (
                    <tr key={v.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "var(--primary)" }}>{v.code}</div>
                        {v.description && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, maxWidth: 220 }}>
                            {translateVoucherDescription(v.description, v.code, t)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600 }}>{v.discountPercent}%</div>
                        {v.maxDiscountAmount != null && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{fill(t.admVchUpTo, { amount: money(v.maxDiscountAmount) })}</div>
                        )}
                        {v.minOrderAmount != null && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{fill(t.admVchMinOrderShort, { amount: money(v.minOrderAmount) })}</div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13 }}>
                        {v.provider ? (
                          <span style={{ padding: "3px 8px", background: "rgba(99,102,241,0.1)", color: "var(--primary)", borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
                            {v.provider.providerName}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>{t.admVchAllProviders}</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13 }}>
                        <div>{fill(t.admVchFrom, { date: formatDate(v.startDate, locale) })}</div>
                        <div>{fill(t.admVchTo, { date: formatDate(v.expiryDate, locale) })}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13 }}>
                        <div>{fill(t.admVchUsed, { count: v.currentUsage ?? 0 })}</div>
                        <div>{fill(t.admVchLimit, { value: v.maxUsage ?? t.admVchUnlimited })}</div>
                        {remaining !== null && (
                          <div style={{ fontWeight: 600, color: remaining === 0 ? "#ef4444" : "var(--text-main)" }}>
                            {fill(t.admVchLeft, { count: remaining })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <VoucherStatusBadge voucher={v} t={t} />
                      </td>
                      {isAdmin && (
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                          <button
                            onClick={() => openEditModal(v)}
                            title={t.admVchEdit}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid var(--border-input)",
                              background: "transparent",
                              color: "var(--primary)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 13,
                            }}
                          >
                            <FaEdit /> {t.admVchEdit}
                          </button>
                          <button
                            onClick={() => handleToggleActive(v)}
                            disabled={togglingId === v.id}
                            title={v.isActive ? t.admVchDisable : t.admVchEnable}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid var(--border-input)",
                              background: "transparent",
                              color: v.isActive ? "#f59e0b" : "#10b981",
                              cursor: togglingId === v.id ? "not-allowed" : "pointer",
                              opacity: togglingId === v.id ? 0.6 : 1,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 13,
                            }}
                          >
                            {v.isActive ? <FaToggleOff /> : <FaToggleOn />}
                            {v.isActive ? t.admVchDisable : t.admVchEnable}
                          </button>
                          <button
                            onClick={() => openDeleteModal(v)}
                            title={t.admVchDelete}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid rgba(239, 68, 68, 0.2)",
                              background: "rgba(239, 68, 68, 0.08)",
                              color: "#ef4444",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 13,
                            }}
                          >
                            <FaTrash /> {t.admVchDelete}
                          </button>
                        </div>
                      </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Chỉnh sửa */}
      {editModal.show && (
        <ModalPortal closeOnBackdrop={false} onClose={() => setEditModal({ show: false, voucher: null, form: emptyForm, loading: false })}>
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 560,
              border: "1px solid var(--border-light)",
              boxShadow: "var(--shadow-xl)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-heading)" }}>
                ✏️ {fill(t.admVchEditTitle, { id: editModal.voucher?.id })}
              </h3>
              <button
                onClick={() => setEditModal({ show: false, voucher: null, form: emptyForm, loading: false })}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}
              >
                <FaTimes />
              </button>
            </div>

            <div className="grid-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>{t.admVchProviderLabel}</label>
                <select
                  value={editModal.form.providerId}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, providerId: e.target.value } }))}
                  style={inputStyle}
                >
                  <option value="">{t.admVchAllProviders}</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.providerName} ({providerTypeLabel(p.providerType, t)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t.admVchCode}</label>
                <input
                  type="text"
                  value={editModal.form.code}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, code: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{t.admVchDiscountPercent}</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editModal.form.discountPercent}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, discountPercent: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{t.admVchMaxDiscount}</label>
                <input
                  type="number"
                  min="0"
                  value={editModal.form.maxDiscountAmount}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, maxDiscountAmount: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{t.admVchMinOrder}</label>
                <input
                  type="number"
                  min="0"
                  value={editModal.form.minOrderAmount}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, minOrderAmount: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{t.admVchStartDate}</label>
                <input
                  type="datetime-local"
                  value={editModal.form.startDate}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, startDate: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{t.admVchExpiryDate}</label>
                <input
                  type="datetime-local"
                  value={editModal.form.expiryDate}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, expiryDate: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{t.admVchMaxUsage}</label>
                <input
                  type="number"
                  min="1"
                  placeholder={t.admVchMaxUsageBlankHint}
                  value={editModal.form.maxUsage}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, maxUsage: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-main)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={editModal.form.isActive}
                    onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, isActive: e.target.checked } }))}
                  />
                  {t.admVchIsActive}
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <label
                  title={t.admVchShowOnTickerHint}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-main)", cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={editModal.form.showOnTicker}
                    onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, showOnTicker: e.target.checked } }))}
                  />
                  {t.admVchShowOnTicker}
                </label>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>{t.admVchDescription}</label>
                <input
                  type="text"
                  value={editModal.form.description}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, description: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              {editModal.voucher && (
                <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "var(--text-muted)" }}>
                  {fill(t.admVchUsageSoFar, { count: editModal.voucher.currentUsage ?? 0 })}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => setEditModal({ show: false, voucher: null, form: emptyForm, loading: false })}
                style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border-input)", background: "transparent", color: "var(--text-main)", cursor: "pointer" }}
              >
                {t.admVchCancel}
              </button>
              <button
                onClick={handleEdit}
                disabled={editModal.loading}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--primary)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: editModal.loading ? "not-allowed" : "pointer",
                }}
              >
                {editModal.loading ? t.admVchSaving : t.admVchSaveChanges}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Xác nhận xóa */}
      {deleteModal.show && (
        <ModalPortal onClose={closeDeleteModal}>
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 460,
              border: "1px solid var(--border-light)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            {/* bookingCount === null nghĩa là chưa hỏi xong backend — chưa biết thì chưa cho bấm nút đỏ. */}
            {(() => {
              const count = deleteModal.bookingCount;
              const used = count != null && count > 0;
              const code = deleteModal.voucher?.code ?? "";
              const id = deleteModal.voucher?.id ?? "";
              return (
                <>
                  <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: used ? "#f59e0b" : "#ef4444" }}>
                    {used ? "🔒" : "⚠️"} {used ? t.admVchCannotDeleteTitle : t.admVchDeleteTitle}
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: used ? 12 : 20 }}>
                    {count == null
                      ? t.admVchCheckingUsage
                      : used
                        ? fill(t.admVchCannotDeleteBody, { code, count })
                        : fill(t.admVchDeleteConfirm, { code, id })}
                  </p>
                  {used && deleteModal.voucher?.isActive && (
                    <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 20 }}>
                      {t.admVchDisableHint}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button
                      onClick={closeDeleteModal}
                      style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border-input)", background: "transparent", color: "var(--text-main)", cursor: "pointer" }}
                    >
                      {t.admVchCancel}
                    </button>
                    {used ? (
                      deleteModal.voucher?.isActive && (
                        <button
                          onClick={handleDisableFromDeleteModal}
                          disabled={deleteModal.loading}
                          style={{
                            padding: "9px 20px",
                            borderRadius: 8,
                            border: "none",
                            background: "#f59e0b",
                            color: "#fff",
                            fontWeight: 600,
                            cursor: deleteModal.loading ? "not-allowed" : "pointer",
                          }}
                        >
                          {t.admVchDisable}
                        </button>
                      )
                    ) : (
                      <button
                        onClick={handleDelete}
                        disabled={deleteModal.loading || count == null}
                        style={{
                          padding: "9px 20px",
                          borderRadius: 8,
                          border: "none",
                          background: "#ef4444",
                          color: "#fff",
                          fontWeight: 600,
                          opacity: count == null ? 0.6 : 1,
                          cursor: deleteModal.loading || count == null ? "not-allowed" : "pointer",
                        }}
                      >
                        {deleteModal.loading ? t.admVchDeleting : t.admVchDeleteAction}
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default AdminVouchers;
