import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { FaBullhorn, FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff } from "react-icons/fa";
import ModalPortal from "../components/ModalPortal";

/**
 * Quản lý tin nhập tay của bảng tin chạy — nhịp hai.
 *
 * Dựng theo khuôn AdminVouchers: cùng bố cục form-trên-bảng-dưới, cùng lối "tắt chứ không xóa",
 * cùng cách đọc thông điệp lỗi của backend. Giống nhau là cố ý — admin không phải học lại một
 * màn hình mới chỉ vì dữ liệu bên dưới khác.
 *
 * Khác một chỗ đáng nói: tin ở đây KHÔNG đi qua bảng dịch. Câu chữ do người đăng gõ vào, nên
 * form có hai ô riêng cho tiếng Việt và tiếng Anh. Bản tiếng Anh được phép bỏ trống, khi đó
 * khách đọc tiếng Anh thấy bản tiếng Việt — thà đọc một câu tiếng Việt còn hơn không biết là
 * có thông báo.
 */

const API_BASE = "/api";

const LOCALE_BY_LANG = { vi: "vi-VN", en: "en-GB", ja: "ja-JP", zh: "zh-TW" };

const fill = (template, values) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template ?? "");

// Backend trả lỗi dạng { status, error, message, ... }. Lấy đúng trường message thay vì
// đổ cả chuỗi JSON lên màn hình admin.
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

const KINDS = ["ROUTE", "MAINTENANCE", "INFO"];

const KIND_LABEL_KEY = {
  ROUTE: "admAnnKindRoute",
  MAINTENANCE: "admAnnKindMaintenance",
  INFO: "admAnnKindInfo",
};

const emptyForm = {
  contentVi: "",
  contentEn: "",
  link: "",
  kind: "INFO",
  startsAt: "",
  endsAt: "",
  sortOrder: "0",
  active: true,
};

// input[type=datetime-local] value <-> ISO LocalDateTime (yyyy-MM-ddTHH:mm)
const toInputDate = (iso) => (iso ? iso.substring(0, 16) : "");
const toPayloadDate = (val) => (val ? `${val}:00` : null);

const formatDate = (iso, locale) => {
  if (!iso) return null;
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildPayload = (form) => ({
  contentVi: form.contentVi.trim(),
  contentEn: form.contentEn.trim(),
  link: form.link.trim(),
  kind: form.kind,
  startsAt: toPayloadDate(form.startsAt),
  endsAt: toPayloadDate(form.endsAt),
  sortOrder: form.sortOrder === "" ? 0 : Number(form.sortOrder),
  active: form.active,
});

const toForm = (item) => ({
  contentVi: item.contentVi || "",
  contentEn: item.contentEn || "",
  link: item.link || "",
  kind: item.kind || "INFO",
  startsAt: toInputDate(item.startsAt),
  endsAt: toInputDate(item.endsAt),
  sortOrder: String(item.sortOrder ?? 0),
  active: item.active !== false,
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

const STATUS_STYLE = {
  live: { color: "#10b981", labelKey: "admAnnStatusLive" },
  disabled: { color: "#9ca3af", labelKey: "admAnnStatusDisabled" },
  expired: { color: "#ef4444", labelKey: "admAnnStatusExpired" },
  scheduled: { color: "#f59e0b", labelKey: "admAnnStatusScheduled" },
};

/**
 * Trạng thái admin đọc trên bảng phải khớp đúng với điều kiện backend dùng để chọn tin
 * (AnnouncementRepository.findLive). Lệch một chút là admin thấy "Đang chạy" trong khi dải tin
 * không có gì, rồi đi tìm lỗi ở chỗ khác.
 */
function announcementStatus(item) {
  if (item.active === false) return "disabled";
  const now = new Date();
  if (item.endsAt && now > new Date(item.endsAt)) return "expired";
  if (item.startsAt && now < new Date(item.startsAt)) return "scheduled";
  return "live";
}

function StatusBadge({ item, t }) {
  const { color, labelKey } = STATUS_STYLE[announcementStatus(item)];
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
      {t[labelKey]}
    </span>
  );
}

const AdminAnnouncements = () => {
  const { token, user } = useAuth();
  const toast = useToast?.() || { showToast: () => {} };
  const { t, currentLanguage } = useLanguage();
  const locale = LOCALE_BY_LANG[currentLanguage.code] || "vi-VN";
  const isAdmin = user?.role === "ROLE_ADMIN";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [editModal, setEditModal] = useState({ show: false, item: null, form: emptyForm, loading: false });
  const [deleteModal, setDeleteModal] = useState({ show: false, item: null, loading: false });

  const kindOptions = useMemo(() => KINDS.map((kind) => ({ kind, label: t[KIND_LABEL_KEY[kind]] })), [t]);

  useEffect(() => {
    if (token && isAdmin) loadItems();
    // loadItems đọc token từ closure nên chỉ cần chạy lại khi token đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } else {
        toast.showToast?.(t.admAnnLoadError, "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.(t.admAnnConnError, "error");
    } finally {
      setLoading(false);
    }
  };

  // Kiểm ở đây chỉ để báo sớm cho người đang gõ; backend kiểm lại y hệt và mới là chỗ chốt.
  const validateForm = (f) => {
    if (!f.contentVi.trim()) return t.admAnnErrContentRequired;
    if (f.startsAt && f.endsAt && new Date(f.startsAt) >= new Date(f.endsAt)) return t.admAnnErrDateOrder;
    return null;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const err = validateForm(form);
    if (err) {
      toast.showToast?.(err, "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload(form)),
      });
      if (res.ok) {
        setForm(emptyForm);
        loadItems();
        toast.showToast?.(t.admAnnCreated, "success");
      } else {
        toast.showToast?.(await readErrorMessage(res, t.admAnnCreateError), "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.(t.admAnnConnError, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    const err = validateForm(editModal.form);
    if (err) {
      toast.showToast?.(err, "error");
      return;
    }
    setEditModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/admin/announcements/${editModal.item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload(editModal.form)),
      });
      if (res.ok) {
        setEditModal({ show: false, item: null, form: emptyForm, loading: false });
        loadItems();
        toast.showToast?.(t.admAnnUpdated, "success");
      } else {
        toast.showToast?.(await readErrorMessage(res, t.admAnnUpdateError), "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.(t.admAnnConnError, "error");
    } finally {
      setEditModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Tắt là cách gỡ mặc định: giữ lại bản ghi nên đăng lại được mà không phải gõ lại cả đoạn.
  const handleToggleActive = async (item) => {
    setTogglingId(item.id);
    const nextActive = item.active === false;
    try {
      const res = await fetch(`${API_BASE}/admin/announcements/${item.id}/active?active=${nextActive}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        loadItems();
        toast.showToast?.(nextActive ? t.admAnnEnabled : t.admAnnDisabled, "success");
      } else {
        toast.showToast?.(await readErrorMessage(res, t.admAnnToggleError), "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.(t.admAnnConnError, "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    setDeleteModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/admin/announcements/${deleteModal.item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok || res.status === 204) {
        setDeleteModal({ show: false, item: null, loading: false });
        loadItems();
        toast.showToast?.(t.admAnnDeleted, "success");
      } else {
        toast.showToast?.(await readErrorMessage(res, t.admAnnDeleteError), "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.(t.admAnnConnError, "error");
    } finally {
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: 24, color: "var(--text-main)", textAlign: "center" }}>
        <h2>{t.admAnnTitle}</h2>
        <p>{t.admAnnNoAccess}</p>
      </div>
    );
  }

  const renderFields = (value, onChange) => (
    <>
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelStyle}>
          {t.admAnnContentVi} <span style={{ color: "red" }}>*</span>
        </label>
        <input
          type="text"
          maxLength={500}
          placeholder={t.admAnnContentViPlaceholder}
          value={value.contentVi}
          onChange={(e) => onChange({ contentVi: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelStyle}>{t.admAnnContentEn}</label>
        <input
          type="text"
          maxLength={500}
          placeholder={t.admAnnContentEnPlaceholder}
          value={value.contentEn}
          onChange={(e) => onChange({ contentEn: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>{t.admAnnKind}</label>
        <select value={value.kind} onChange={(e) => onChange({ kind: e.target.value })} style={inputStyle}>
          {kindOptions.map((option) => (
            <option key={option.kind} value={option.kind}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>{t.admAnnLink}</label>
        <input
          type="text"
          placeholder={t.admAnnLinkPlaceholder}
          value={value.link}
          onChange={(e) => onChange({ link: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>{t.admAnnStartsAt}</label>
        <input
          type="datetime-local"
          value={value.startsAt}
          onChange={(e) => onChange({ startsAt: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle} title={t.admAnnEndsAtHint}>
          {t.admAnnEndsAt}
        </label>
        <input
          type="datetime-local"
          value={value.endsAt}
          onChange={(e) => onChange({ endsAt: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>{t.admAnnSortOrder}</label>
        <input
          type="number"
          value={value.sortOrder}
          onChange={(e) => onChange({ sortOrder: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-main)", cursor: "pointer" }}>
          <input type="checkbox" checked={value.active} onChange={(e) => onChange({ active: e.target.checked })} />
          {t.admAnnActivateNow}
        </label>
      </div>
    </>
  );

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
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 10 }}>
          <FaBullhorn style={{ color: "var(--primary)" }} /> {t.admAnnTitle}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{t.admAnnSubtitle}</p>
      </div>

      {/* Nhắc phạm vi ngay trên form, không giấu trong tài liệu: người sắp gõ một thông báo
          khẩn cấp vào đây phải đọc được nó trước khi gõ, không phải sau khi đăng. */}
      <div
        style={{
          marginBottom: 20,
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid var(--border-light)",
          background: "var(--bg-soft, rgba(125, 175, 255, 0.10))",
          fontSize: 12.5,
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}
      >
        {t.admAnnScopeNote}
      </div>

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
          <FaPlus style={{ fontSize: 14, color: "var(--primary)" }} /> {t.admAnnAddNew}
        </h3>
        <form className="grid-form" onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {renderFields(form, (patch) => setForm((prev) => ({ ...prev, ...patch })))}
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
              {submitting ? t.admAnnSaving : t.admAnnSubmit}
            </button>
          </div>
        </form>
      </div>

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
            {fill(t.admAnnTotal, { count: items.length })}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{t.admAnnLoading}</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{t.admAnnEmpty}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "14px 16px" }}>{t.admAnnColContent}</th>
                  <th style={{ padding: "14px 16px" }}>{t.admAnnColKind}</th>
                  <th style={{ padding: "14px 16px" }}>{t.admAnnColWindow}</th>
                  <th style={{ padding: "14px 16px" }}>{t.admAnnColOrder}</th>
                  <th style={{ padding: "14px 16px" }}>{t.admAnnColStatus}</th>
                  <th style={{ padding: "14px 16px" }}>{t.admAnnColActions}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "14px 16px", maxWidth: 420 }}>
                      <div style={{ fontWeight: 600 }}>{item.contentVi}</div>
                      {item.contentEn && (
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{item.contentEn}</div>
                      )}
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                        {t.admAnnLink}: {item.link || t.admAnnNoLink}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>{t[KIND_LABEL_KEY[item.kind]] || item.kind}</td>
                    <td style={{ padding: "14px 16px", fontSize: 12.5, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      <div>{formatDate(item.startsAt, locale) || t.admAnnAlways}</div>
                      <div>{formatDate(item.endsAt, locale) || t.admAnnAlways}</div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>{item.sortOrder ?? 0}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge item={item} t={t} />
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          disabled={togglingId === item.id}
                          title={item.active === false ? t.admAnnEnabled : t.admAnnDisabled}
                          style={{ border: "none", background: "transparent", cursor: "pointer", color: item.active === false ? "#9ca3af" : "#10b981", fontSize: 18 }}
                        >
                          {item.active === false ? <FaToggleOff /> : <FaToggleOn />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditModal({ show: true, item, form: toForm(item), loading: false })}
                          title={t.admAnnEditTitle}
                          style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--primary)", fontSize: 15 }}
                        >
                          <FaEdit />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModal({ show: true, item, loading: false })}
                          title={t.admAnnDelete}
                          style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444", fontSize: 15 }}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* closeOnBackdrop={false} như AdminVouchers: bấm nhầm ra nền trong lúc đang sửa dở một
          đoạn thông báo dài mà mất sạch thì cay hơn nhiều so với phải bấm nút Hủy. */}
      {editModal.show && (
        <ModalPortal
          closeOnBackdrop={false}
          onClose={() => setEditModal({ show: false, item: null, form: emptyForm, loading: false })}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 760,
              border: "1px solid var(--border-light)",
              boxShadow: "var(--shadow-xl)",
              maxHeight: "90vh",
              overflowY: "auto",
              color: "var(--text-main)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 18, fontSize: 18, color: "var(--text-heading)" }}>{t.admAnnEditTitle}</h3>
            <div className="grid-form" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {renderFields(editModal.form, (patch) =>
                setEditModal((prev) => ({ ...prev, form: { ...prev.form, ...patch } })))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setEditModal({ show: false, item: null, form: emptyForm, loading: false })}
                style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-input)", background: "transparent", color: "var(--text-main)", cursor: "pointer", fontWeight: 600 }}
              >
                {t.admAnnCancel}
              </button>
              <button
                type="button"
                onClick={handleEdit}
                disabled={editModal.loading}
                style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "var(--primary)", color: "#fff", cursor: editModal.loading ? "not-allowed" : "pointer", fontWeight: 600 }}
              >
                {editModal.loading ? t.admAnnSaving : t.admAnnSave}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {deleteModal.show && (
        <ModalPortal onClose={() => setDeleteModal({ show: false, item: null, loading: false })}>
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 460,
              border: "1px solid var(--border-light)",
              boxShadow: "var(--shadow-xl)",
              color: "var(--text-main)",
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: 18, color: "var(--text-heading)" }}>{t.admAnnDeleteTitle}</h3>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{t.admAnnDeleteConfirm}</p>
            <p style={{ fontSize: 13.5, fontWeight: 600 }}>{deleteModal.item?.contentVi}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setDeleteModal({ show: false, item: null, loading: false })}
                style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border-input)", background: "transparent", color: "var(--text-main)", cursor: "pointer", fontWeight: 600 }}
              >
                {t.admAnnCancel}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteModal.loading}
                style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", cursor: deleteModal.loading ? "not-allowed" : "pointer", fontWeight: 600 }}
              >
                {deleteModal.loading ? t.admAnnSaving : t.admAnnDelete}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default AdminAnnouncements;
