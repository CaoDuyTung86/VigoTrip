import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { FaTag, FaPlus, FaEdit, FaTrash, FaSearch, FaTimes } from "react-icons/fa";

const API_BASE = "/api";

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
  providerId: "",
};

// input[type=datetime-local] value <-> ISO LocalDateTime (yyyy-MM-ddTHH:mm)
const toInputDate = (iso) => (iso ? iso.substring(0, 16) : "");
const toPayloadDate = (val) => (val ? `${val}:00` : null);

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

function VoucherStatusBadge({ voucher }) {
  const now = new Date();
  const start = voucher.startDate ? new Date(voucher.startDate) : null;
  const end = voucher.expiryDate ? new Date(voucher.expiryDate) : null;
  const soldOut = voucher.maxUsage != null && voucher.currentUsage >= voucher.maxUsage;

  let label = "Đang hoạt động";
  let color = "#10b981";

  if (!voucher.isActive) {
    label = "Đã tắt";
    color = "#9ca3af";
  } else if (soldOut) {
    label = "Hết lượt";
    color = "#ef4444";
  } else if (end && now > end) {
    label = "Hết hạn";
    color = "#ef4444";
  } else if (start && now < start) {
    label = "Chưa bắt đầu";
    color = "#f59e0b";
  }

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
  const isAdmin = user?.role === "ROLE_ADMIN";
  const isProvider = user?.role === "ROLE_PROVIDER";

  const [vouchers, setVouchers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [editModal, setEditModal] = useState({ show: false, voucher: null, form: emptyForm, loading: false });
  const [deleteModal, setDeleteModal] = useState({ show: false, voucher: null, loading: false });

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
        toast.showToast?.("Không thể tải danh sách voucher", "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.("Lỗi kết nối máy chủ", "error");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (f) => {
    if (!f.code.trim()) return "Vui lòng nhập mã voucher";
    if (f.discountPercent === "" || Number(f.discountPercent) <= 0 || Number(f.discountPercent) > 100) {
      return "Phần trăm giảm giá phải trong khoảng 1-100";
    }
    if (f.startDate && f.expiryDate && new Date(f.startDate) >= new Date(f.expiryDate)) {
      return "Ngày bắt đầu phải trước ngày hết hạn";
    }
    if (f.maxUsage !== "" && Number(f.maxUsage) <= 0) {
      return "Số lượt sử dụng tối đa phải lớn hơn 0";
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
        toast.showToast?.("Tạo voucher thành công!", "success");
      } else {
        const text = await res.text();
        alert(text || "Không thể tạo voucher");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ");
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
        toast.showToast?.("Cập nhật voucher thành công!", "success");
      } else {
        const text = await res.text();
        alert(text || "Không thể cập nhật voucher");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ");
    } finally {
      setEditModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleDelete = async () => {
    setDeleteModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/admin/vouchers/${deleteModal.voucher.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok || res.status === 204) {
        setDeleteModal({ show: false, voucher: null, loading: false });
        loadVouchers();
        toast.showToast?.("Xóa voucher thành công!", "success");
      } else {
        const text = await res.text();
        alert(text || "Không thể xóa voucher");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ");
    } finally {
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  if (!isAdmin && !isProvider) {
    return (
      <div style={{ padding: 24, color: "var(--text-main)", textAlign: "center" }}>
        <h2>Quản lý Voucher</h2>
        <p>Tính năng chỉ dành cho Quản trị viên và Nhà cung cấp.</p>
      </div>
    );
  }

  const filteredVouchers = vouchers.filter((v) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (v.code || "").toLowerCase().includes(q) || (v.description || "").toLowerCase().includes(q);
  });

  return (
    <div
      className="page-main"
      style={{
        padding: "var(--page-padding)",
        paddingTop: "calc(var(--header-height) + var(--page-padding))",
        color: "var(--text-main)",
        maxWidth: 1300,
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 10 }}>
            <FaTag style={{ color: "var(--primary)" }} /> {isAdmin ? "Quản lý Voucher" : "Voucher đang hoạt động"}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            {isAdmin
              ? "Tạo, chỉnh sửa và theo dõi các mã giảm giá trong toàn hệ thống"
              : "Danh sách các mã giảm giá đang còn hiệu lực áp dụng cho khách hàng"}
          </p>
        </div>

        <div style={{ position: "relative" }}>
          <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 13 }} />
          <input
            type="text"
            placeholder="Tìm mã hoặc mô tả..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, padding: "9px 14px 9px 34px", width: 240 }}
          />
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
          <FaPlus style={{ fontSize: 14, color: "var(--primary)" }} /> Thêm Voucher Mới
        </h3>
        <form className="grid-form" onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <div>
            <label style={labelStyle}>Hãng phương tiện áp dụng</label>
            <select value={form.providerId} onChange={(e) => setForm((p) => ({ ...p, providerId: e.target.value }))} style={inputStyle}>
              <option value="">Tất cả các hãng</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.providerName} ({p.providerType === "AIRLINE" ? "Máy bay" : p.providerType === "TRAIN" ? "Tàu hỏa" : "Xe khách"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Mã voucher <span style={{ color: "red" }}>*</span></label>
            <input type="text" placeholder="VD: SUMMER2026" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>% Giảm giá <span style={{ color: "red" }}>*</span></label>
            <input type="number" min="1" max="100" placeholder="VD: 15" value={form.discountPercent} onChange={(e) => setForm((p) => ({ ...p, discountPercent: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Giảm tối đa (VND)</label>
            <input type="number" min="0" placeholder="VD: 100000" value={form.maxDiscountAmount} onChange={(e) => setForm((p) => ({ ...p, maxDiscountAmount: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Đơn hàng tối thiểu (VND)</label>
            <input type="number" min="0" placeholder="VD: 200000" value={form.minOrderAmount} onChange={(e) => setForm((p) => ({ ...p, minOrderAmount: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Ngày bắt đầu</label>
            <input type="datetime-local" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Ngày hết hạn</label>
            <input type="datetime-local" value={form.expiryDate} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Giới hạn lượt sử dụng</label>
            <input type="number" min="1" placeholder="VD: 100 (để trống = không giới hạn)" value={form.maxUsage} onChange={(e) => setForm((p) => ({ ...p, maxUsage: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-main)", cursor: "pointer" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
              Kích hoạt ngay
            </label>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Mô tả</label>
            <input type="text" placeholder="VD: Ưu đãi mùa hè cho 100 khách đầu tiên" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} style={inputStyle} />
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
              {submitting ? "Đang lưu..." : "Thêm Voucher"}
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
            Tổng số: {filteredVouchers.length} voucher
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Đang tải danh sách voucher...</div>
        ) : filteredVouchers.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Không tìm thấy voucher nào.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "14px 16px" }}>Mã</th>
                  <th style={{ padding: "14px 16px" }}>Giảm giá</th>
                  <th style={{ padding: "14px 16px" }}>Hãng áp dụng</th>
                  <th style={{ padding: "14px 16px" }}>Thời hạn</th>
                  <th style={{ padding: "14px 16px" }}>Lượt dùng</th>
                  <th style={{ padding: "14px 16px" }}>Trạng thái</th>
                  {isAdmin && <th style={{ padding: "14px 16px", textAlign: "center" }}>Thao tác</th>}
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
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, maxWidth: 220 }}>{v.description}</div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600 }}>{v.discountPercent}%</div>
                        {v.maxDiscountAmount != null && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Tối đa {Number(v.maxDiscountAmount).toLocaleString("vi-VN")}đ</div>
                        )}
                        {v.minOrderAmount != null && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Đơn tối thiểu {Number(v.minOrderAmount).toLocaleString("vi-VN")}đ</div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13 }}>
                        {v.provider ? (
                          <span style={{ padding: "3px 8px", background: "rgba(99,102,241,0.1)", color: "var(--primary)", borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
                            {v.provider.providerName}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Tất cả các hãng</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13 }}>
                        <div>Từ: {formatDate(v.startDate)}</div>
                        <div>Đến: {formatDate(v.expiryDate)}</div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13 }}>
                        <div>Đã dùng: {v.currentUsage ?? 0}</div>
                        <div>Giới hạn: {v.maxUsage ?? "Không giới hạn"}</div>
                        {remaining !== null && (
                          <div style={{ fontWeight: 600, color: remaining === 0 ? "#ef4444" : "var(--text-main)" }}>
                            Còn lại: {remaining}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <VoucherStatusBadge voucher={v} />
                      </td>
                      {isAdmin && (
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                          <button
                            onClick={() => openEditModal(v)}
                            title="Chỉnh sửa"
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
                            <FaEdit /> Sửa
                          </button>
                          <button
                            onClick={() => setDeleteModal({ show: true, voucher: v, loading: false })}
                            title="Xóa"
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
                            <FaTrash /> Xóa
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
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
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
                ✏️ Chỉnh sửa Voucher #{editModal.voucher?.id}
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
                <label style={labelStyle}>Hãng phương tiện áp dụng</label>
                <select
                  value={editModal.form.providerId}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, providerId: e.target.value } }))}
                  style={inputStyle}
                >
                  <option value="">Tất cả các hãng</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.providerName} ({p.providerType === "AIRLINE" ? "Máy bay" : p.providerType === "TRAIN" ? "Tàu hỏa" : "Xe khách"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Mã voucher</label>
                <input
                  type="text"
                  value={editModal.form.code}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, code: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>% Giảm giá</label>
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
                <label style={labelStyle}>Giảm tối đa (VND)</label>
                <input
                  type="number"
                  min="0"
                  value={editModal.form.maxDiscountAmount}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, maxDiscountAmount: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Đơn hàng tối thiểu (VND)</label>
                <input
                  type="number"
                  min="0"
                  value={editModal.form.minOrderAmount}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, minOrderAmount: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Ngày bắt đầu</label>
                <input
                  type="datetime-local"
                  value={editModal.form.startDate}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, startDate: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Ngày hết hạn</label>
                <input
                  type="datetime-local"
                  value={editModal.form.expiryDate}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, expiryDate: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Giới hạn lượt sử dụng</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Để trống = không giới hạn"
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
                  Đang kích hoạt
                </label>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Mô tả</label>
                <input
                  type="text"
                  value={editModal.form.description}
                  onChange={(e) => setEditModal((p) => ({ ...p, form: { ...p.form, description: e.target.value } }))}
                  style={inputStyle}
                />
              </div>
              {editModal.voucher && (
                <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "var(--text-muted)" }}>
                  Đã sử dụng: {editModal.voucher.currentUsage ?? 0} lượt
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => setEditModal({ show: false, voucher: null, form: emptyForm, loading: false })}
                style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border-input)", background: "transparent", color: "var(--text-main)", cursor: "pointer" }}
              >
                Hủy
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
                {editModal.loading ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận xóa */}
      {deleteModal.show && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 420,
              border: "1px solid var(--border-light)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#ef4444" }}>⚠️ Xác nhận xóa voucher</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
              Bạn có chắc chắn muốn xóa mã <strong>{deleteModal.voucher?.code}</strong> (ID: #{deleteModal.voucher?.id})?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteModal({ show: false, voucher: null, loading: false })}
                style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border-input)", background: "transparent", color: "var(--text-main)", cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteModal.loading}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: deleteModal.loading ? "not-allowed" : "pointer",
                }}
              >
                {deleteModal.loading ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVouchers;
