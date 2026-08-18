import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { 
  FaUsers, 
  FaUserShield, 
  FaSearch, 
  FaUserCheck, 
  FaUserLock, 
  FaUserEdit,
  FaTimes,
  FaCheckCircle,
  FaBan
} from "react-icons/fa";

const API_BASE = "/api";

const AdminUsers = () => {
  const { token, user: currentUser } = useAuth();
  const toast = useToast?.() || { showToast: () => {} };

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal đổi vai trò
  const [roleModal, setRoleModal] = useState({
    show: false,
    user: null,
    role: "ROLE_USER",
    loading: false,
  });

  // Modal xác nhận khóa / mở khóa
  const [statusModal, setStatusModal] = useState({
    show: false,
    user: null,
    targetEnabled: true,
    loading: false,
  });

  useEffect(() => {
    if (token) {
      loadUsers();
    }
  }, [token]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } else {
        toast.showToast?.("Không thể tải danh sách tài khoản", "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.("Lỗi kết nối máy chủ", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!roleModal.user) return;
    setRoleModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/admin/users/${roleModal.user.id}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: roleModal.role }),
      });

      if (res.ok) {
        toast.showToast?.("Cập nhật vai trò thành công!", "success");
        setRoleModal({ show: false, user: null, role: "ROLE_USER", loading: false });
        loadUsers();
      } else {
        const text = await res.text();
        toast.showToast?.(text || "Không thể đổi vai trò", "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.("Lỗi kết nối máy chủ", "error");
    } finally {
      setRoleModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleToggleStatus = async () => {
    if (!statusModal.user) return;
    setStatusModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/admin/users/${statusModal.user.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: statusModal.targetEnabled }),
      });

      if (res.ok) {
        toast.showToast?.(
          statusModal.targetEnabled
            ? "Đã kích hoạt / mở khóa tài khoản thành công!"
            : "Đã khóa tài khoản thành công!",
          "success"
        );
        setStatusModal({ show: false, user: null, targetEnabled: true, loading: false });
        loadUsers();
      } else {
        const text = await res.text();
        toast.showToast?.(text || "Không thể cập nhật trạng thái", "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.("Lỗi kết nối máy chủ", "error");
    } finally {
      setStatusModal((prev) => ({ ...prev, loading: false }));
    }
  };

  if (!currentUser || currentUser.role !== "ROLE_ADMIN") {
    return (
      <div style={{ padding: 24, color: "var(--text-main)", textAlign: "center" }}>
        <h2>Quản lý Tài khoản</h2>
        <p>Tính năng chỉ dành cho Quản trị viên (Admin).</p>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase().trim();
    const matchSearch =
      !q ||
      (u.fullName || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q) ||
      String(u.id).includes(q);

    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && u.enabled) ||
      (statusFilter === "LOCKED" && !u.enabled);

    return matchSearch && matchRole && matchStatus;
  });

  const getRoleBadge = (role) => {
    switch (role) {
      case "ROLE_ADMIN":
        return { label: "Admin", bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "rgba(239, 68, 68, 0.3)" };
      case "ROLE_PROVIDER":
        return { label: "Nhà xe / Tàu / Bay", bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" };
      default:
        return { label: "Khách hàng", bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.3)" };
    }
  };

  return (
    <div
      className="page-main"
      style={{
        padding: "var(--page-padding)",
        paddingTop: "calc(var(--header-height) + var(--page-padding))",
        color: "var(--text-main)",
        maxWidth: 1250,
        margin: "0 auto",
      }}
    >
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 10 }}>
            <FaUsers style={{ color: "var(--primary)" }} /> Quản lý Người dùng & Phân quyền
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Kiểm soát tài khoản, cấp quyền Admin/Nhà cung cấp, mở khóa và kích hoạt email hộ người dùng
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              border: "1px solid var(--border-input)",
              backgroundColor: "var(--bg-card)",
              color: "var(--text-main)",
              fontSize: 13,
              outline: "none",
            }}
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="ROLE_USER">Khách hàng (User)</option>
            <option value="ROLE_PROVIDER">Nhà cung cấp (Provider)</option>
            <option value="ROLE_ADMIN">Quản trị viên (Admin)</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              border: "1px solid var(--border-input)",
              backgroundColor: "var(--bg-card)",
              color: "var(--text-main)",
              fontSize: 13,
              outline: "none",
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đã kích hoạt / Hoạt động</option>
            <option value="LOCKED">Bị khóa / Chưa kích hoạt</option>
          </select>

          {/* Search box */}
          <div style={{ position: "relative" }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 13 }} />
            <input
              type="text"
              placeholder="Tìm tên, email, sđt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: "9px 14px 9px 34px",
                borderRadius: 10,
                border: "1px solid var(--border-input)",
                backgroundColor: "var(--bg-card)",
                color: "var(--text-main)",
                width: 220,
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* Bảng danh sách User */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid var(--border-light)",
          background: "var(--bg-card)",
          boxShadow: "var(--shadow-md)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-heading)" }}>
            Danh sách: {filteredUsers.length} tài khoản
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            Đang tải dữ liệu người dùng...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            Không tìm thấy người dùng phù hợp.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "14px 18px", width: 70 }}>ID</th>
                  <th style={{ padding: "14px 18px" }}>Người dùng</th>
                  <th style={{ padding: "14px 18px" }}>Email & SĐT</th>
                  <th style={{ padding: "14px 18px" }}>Vai trò (Role)</th>
                  <th style={{ padding: "14px 18px" }}>Điểm thưởng / Hạng</th>
                  <th style={{ padding: "14px 18px" }}>Trạng thái</th>
                  <th style={{ padding: "14px 18px", textAlign: "center", width: 170 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const roleBadge = getRoleBadge(u.role);
                  const isCurrent = currentUser?.email === u.email;

                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border-light)", transition: "background 0.15s" }}>
                      <td style={{ padding: "14px 18px", fontWeight: 600, color: "var(--text-muted)" }}>
                        #{u.id}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                          {u.fullName || "Chưa đặt tên"} {isCurrent && <span style={{ fontSize: 11, color: "var(--primary)" }}>(Bạn)</span>}
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 13, color: "var(--text-main)" }}>{u.email}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{u.phone || "Chưa có SĐT"}</div>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            padding: "4px 9px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            background: roleBadge.bg,
                            color: roleBadge.color,
                            border: `1px solid ${roleBadge.border}`,
                          }}
                        >
                          {roleBadge.label}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}>
                          {u.points || 0} xu
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Hạng {u.membershipLevel || "Đồng"}
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        {u.enabled ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#10b981", fontSize: 13, fontWeight: 600 }}>
                            <FaCheckCircle size={14} /> Hoạt động
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#ef4444", fontSize: 13, fontWeight: 600 }}>
                            <FaBan size={14} /> Đã khóa / Chưa kích hoạt
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          {/* Nút đổi quyền */}
                          <button
                            onClick={() =>
                              setRoleModal({
                                show: true,
                                user: u,
                                role: u.role || "ROLE_USER",
                                loading: false,
                              })
                            }
                            title="Phân quyền tài khoản"
                            disabled={isCurrent}
                            style={{
                              padding: "6px 9px",
                              borderRadius: 8,
                              border: "1px solid var(--border-input)",
                              background: "transparent",
                              color: isCurrent ? "var(--text-muted)" : "var(--primary)",
                              cursor: isCurrent ? "not-allowed" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 12.5,
                            }}
                          >
                            <FaUserEdit /> Quyền
                          </button>

                          {/* Nút Khóa / Mở khóa / Kích hoạt hộ */}
                          {u.enabled ? (
                            <button
                              onClick={() =>
                                setStatusModal({
                                  show: true,
                                  user: u,
                                  targetEnabled: false,
                                  loading: false,
                                })
                              }
                              title="Khóa tài khoản này"
                              disabled={isCurrent}
                              style={{
                                padding: "6px 9px",
                                borderRadius: 8,
                                border: "1px solid rgba(239, 68, 68, 0.2)",
                                background: "rgba(239, 68, 68, 0.08)",
                                color: isCurrent ? "var(--text-muted)" : "#ef4444",
                                cursor: isCurrent ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 12.5,
                              }}
                            >
                              <FaUserLock /> Khóa
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setStatusModal({
                                  show: true,
                                  user: u,
                                  targetEnabled: true,
                                  loading: false,
                                })
                              }
                              title="Kích hoạt email / Mở khóa tài khoản"
                              style={{
                                padding: "6px 9px",
                                borderRadius: 8,
                                border: "1px solid rgba(16, 185, 129, 0.2)",
                                background: "rgba(16, 185, 129, 0.08)",
                                color: "#10b981",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 12.5,
                              }}
                            >
                              <FaUserCheck /> Kích hoạt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Đổi Vai Trò (Role) */}
      {roleModal.show && (
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
              maxWidth: 440,
              border: "1px solid var(--border-light)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 8 }}>
                <FaUserShield style={{ color: "var(--primary)" }} /> Đổi vai trò tài khoản
              </h3>
              <button
                onClick={() => setRoleModal({ show: false, user: null, role: "ROLE_USER", loading: false })}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}
              >
                <FaTimes />
              </button>
            </div>

            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
              Người dùng: <strong>{roleModal.user?.fullName || roleModal.user?.email}</strong> (#{roleModal.user?.id})
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>
                Chọn vai trò mới:
              </label>
              <select
                value={roleModal.role}
                onChange={(e) => setRoleModal((prev) => ({ ...prev, role: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-main)",
                  color: "var(--text-main)",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              >
                <option value="ROLE_USER">Khách hàng (ROLE_USER) - Đặt vé, tích điểm, đánh giá</option>
                <option value="ROLE_PROVIDER">Nhà cung cấp (ROLE_PROVIDER) - Quét vé, xem doanh thu</option>
                <option value="ROLE_ADMIN">Quản trị viên (ROLE_ADMIN) - Toàn quyền quản trị hệ thống</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setRoleModal({ show: false, user: null, role: "ROLE_USER", loading: false })}
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border-input)",
                  background: "transparent",
                  color: "var(--text-main)",
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                onClick={handleUpdateRole}
                disabled={roleModal.loading}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--primary)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: roleModal.loading ? "not-allowed" : "pointer",
                }}
              >
                {roleModal.loading ? "Đang lưu..." : "Cập nhật"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Khóa / Mở khóa */}
      {statusModal.show && (
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
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 18,
                fontWeight: 700,
                color: statusModal.targetEnabled ? "#10b981" : "#ef4444",
              }}
            >
              {statusModal.targetEnabled ? "✓ Kích hoạt / Mở khóa tài khoản" : "⚠️ Xác nhận khóa tài khoản"}
            </h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
              {statusModal.targetEnabled ? (
                <>
                  Bạn có muốn kích hoạt tài khoản cho <strong>{statusModal.user?.email}</strong> không? Tài khoản này sẽ có thể đăng nhập ngay mà không cần nhập mã xác thực OTP.
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn khóa tài khoản <strong>{statusModal.user?.email}</strong>? Người dùng sẽ không thể đăng nhập vào hệ thống cho tới khi được mở khóa lại.
                </>
              )}
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setStatusModal({ show: false, user: null, targetEnabled: true, loading: false })}
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border-input)",
                  background: "transparent",
                  color: "var(--text-main)",
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                onClick={handleToggleStatus}
                disabled={statusModal.loading}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: statusModal.targetEnabled ? "#10b981" : "#ef4444",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: statusModal.loading ? "not-allowed" : "pointer",
                }}
              >
                {statusModal.loading ? "Đang xử lý..." : statusModal.targetEnabled ? "Xác nhận kích hoạt" : "Khóa tài khoản"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
