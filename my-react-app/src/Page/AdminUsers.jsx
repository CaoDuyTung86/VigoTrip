import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { 
  FaUsers, 
  FaUserShield, 
  FaSearch, 
  FaUserCheck, 
  FaUserLock, 
  FaUserEdit,
  FaTimes,
  FaCheckCircle,
  FaBan,
  FaEnvelope,
  FaSort,
  FaSortUp,
  FaSortDown
} from "react-icons/fa";
import ModalPortal from "../components/ModalPortal";

const API_BASE = "/api";

const ROLE_RANK = { ROLE_ADMIN: 0, ROLE_PROVIDER: 1, ROLE_USER: 2 };
// Khóa xếp trước, chờ xác thực email xếp giữa, đang hoạt động xếp cuối — admin nhìn
// phát thấy ngay mấy tài khoản cần đụng tới.
const statusRank = (u) => (u.enabled ? 2 : u.awaitingEmailVerification ? 1 : 0);
const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

const sortUsers = (list, sortBy) => {
  const [field, dir] = sortBy.split("_");
  const sign = dir === "desc" ? -1 : 1;
  const cmp = (a, b) => {
    switch (field) {
      case "name":
        return collator.compare(a.fullName || "", b.fullName || "");
      case "email":
        return collator.compare(a.email || "", b.email || "");
      case "role":
        return (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9);
      case "points":
        return (a.points || 0) - (b.points || 0);
      case "status":
        return statusRank(a) - statusRank(b);
      default:
        return (a.id || 0) - (b.id || 0);
    }
  };
  // Luôn phá hòa bằng ID để hai lần render cùng dữ liệu cho ra đúng một thứ tự.
  return [...list].sort((a, b) => sign * cmp(a, b) || (a.id || 0) - (b.id || 0));
};

const getMembershipName = (level, t) => {
  if (!level) return t.tierBronze || "Đồng";
  const map = {
    "Đồng": t.tierBronze || "Đồng",
    "Bạc": t.tierSilver || "Bạc",
    "Vàng": t.tierGold || "Vàng",
    "Kim Cương": t.tierDiamond || "Kim Cương",
  };
  return map[level] || level;
};

const AdminUsers = () => {
  const { token, user: currentUser } = useAuth();
  const toast = useToast?.() || { showToast: () => {} };
  const { t } = useLanguage();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("id_asc");

  /* API trả danh sách tài khoản theo thứ tự của DB, không cam kết sắp xếp gì cả nên nhìn
     rất lộn xộn (#4, #2, #6, #7...). Mặc định xếp lại theo ID tăng dần và cho admin đổi
     tiêu chí bằng ô chọn hoặc bấm thẳng vào tiêu đề cột.
     Nằm trong component vì nhãn phải đổi theo ngôn ngữ đang chọn. */
  const sortFields = useMemo(() => [
    { field: "id", asc: t.sortIdAsc || "ID tăng dần (#1 → #n)", desc: t.sortIdDesc || "Mới nhất (ID giảm dần)" },
    { field: "name", asc: t.sortNameAsc || "Tên A → Z", desc: t.sortNameDesc || "Tên Z → A" },
    { field: "email", asc: t.sortEmailAsc || "Email A → Z", desc: t.sortEmailDesc || "Email Z → A" },
    { field: "role", asc: t.sortRoleAsc || "Vai trò: Admin trước", desc: t.sortRoleDesc || "Vai trò: Khách hàng trước" },
    { field: "points", asc: t.sortPointsAsc || "Điểm thưởng thấp nhất", desc: t.sortPointsDesc || "Điểm thưởng cao nhất" },
    { field: "status", asc: t.sortStatusAsc || "Trạng thái: cần xử lý trước", desc: t.sortStatusDesc || "Trạng thái: hoạt động trước" },
  ], [t]);

  // Liệt kê đủ cả hai chiều của mọi cột, không cắt bớt: bấm tiêu đề cột cũng đổi sortBy,
  // nếu thiếu tổ hợp nào thì ô chọn sẽ hiện trống vì không khớp option nào.
  const sortOptions = useMemo(() => sortFields.flatMap((f) => [
    { value: `${f.field}_asc`, label: f.asc },
    { value: `${f.field}_desc`, label: f.desc },
  ]), [sortFields]);

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
        toast.showToast?.(t.errLoadUsers || "Không thể tải danh sách tài khoản", "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.(t.errServerConnect || "Lỗi kết nối máy chủ", "error");
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
        toast.showToast?.(t.roleUpdatedSuccess || "Cập nhật vai trò thành công!", "success");
        setRoleModal({ show: false, user: null, role: "ROLE_USER", loading: false });
        loadUsers();
      } else {
        const text = await res.text();
        toast.showToast?.(text || t.errUpdateRole || "Không thể đổi vai trò", "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.(t.errServerConnect || "Lỗi kết nối máy chủ", "error");
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
            ? (t.accountUnlockedSuccess || "Đã kích hoạt / mở khóa tài khoản thành công!")
            : (t.accountLockedSuccess || "Đã khóa tài khoản thành công!"),
          "success"
        );
        setStatusModal({ show: false, user: null, targetEnabled: true, loading: false });
        loadUsers();
      } else {
        const text = await res.text();
        toast.showToast?.(text || t.errUpdateStatus || "Không thể cập nhật trạng thái", "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.(t.errServerConnect || "Lỗi kết nối máy chủ", "error");
    } finally {
      setStatusModal((prev) => ({ ...prev, loading: false }));
    }
  };

  if (!currentUser || currentUser.role !== "ROLE_ADMIN") {
    return (
      <div style={{ padding: 24, color: "var(--text-main)", textAlign: "center" }}>
        <h2>{t.userManagementTitle || "Quản lý Người dùng & Phân quyền"}</h2>
        <p>{t.admAdminOnly || "Tính năng chỉ dành cho Quản trị viên (Admin)."}</p>
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
    // enabled = false có HAI nghĩa khác hẳn nhau: đang chờ xác thực email, và bị khóa.
    // Backend nay tách sẵn bằng cờ awaitingEmailVerification nên lọc được riêng từng loại.
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && u.enabled) ||
      (statusFilter === "UNVERIFIED" && !u.enabled && u.awaitingEmailVerification) ||
      (statusFilter === "LOCKED" && !u.enabled && !u.awaitingEmailVerification);

    return matchSearch && matchRole && matchStatus;
  });

  const visibleUsers = sortUsers(filteredUsers, sortBy);

  // Bấm lại đúng cột đang xếp thì đảo chiều, bấm cột khác thì về chiều mặc định của cột đó.
  const toggleSort = (field) => {
    const defaultDir = field === "points" ? "desc" : "asc";
    setSortBy((prev) => {
      const [prevField, prevDir] = prev.split("_");
      if (prevField !== field) return `${field}_${defaultDir}`;
      return `${field}_${prevDir === "asc" ? "desc" : "asc"}`;
    });
  };

  const sortHeader = (field, label, extraStyle = {}) => {
    const [activeField, activeDir] = sortBy.split("_");
    const isActive = activeField === field;
    const Icon = !isActive ? FaSort : activeDir === "asc" ? FaSortUp : FaSortDown;
    const headerTitle = (t.sortByColTitle || "Sắp xếp theo {label}").replace("{label}", label);
    return (
      <th
        onClick={() => toggleSort(field)}
        title={headerTitle}
        style={{ padding: "14px 18px", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", color: isActive ? "var(--primary)" : undefined, ...extraStyle }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {label}
          <Icon size={11} style={{ opacity: isActive ? 1 : 0.4 }} />
        </span>
      </th>
    );
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case "ROLE_ADMIN":
        return { label: t.roleBadgeAdmin || "Admin", bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "rgba(239, 68, 68, 0.3)" };
      case "ROLE_PROVIDER":
        return { label: t.roleBadgeProvider || "Nhà xe / Tàu / Bay", bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" };
      default:
        return { label: t.roleBadgeUser || "Khách hàng", bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.3)" };
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
            <FaUsers style={{ color: "var(--primary)" }} /> {t.userManagementTitle || "Quản lý Người dùng & Phân quyền"}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            {t.userManagementSubtitle || "Kiểm soát tài khoản, cấp quyền Admin/Nhà cung cấp, khóa/mở khóa và kích hoạt email hộ người dùng"}
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
            <option value="ALL">{t.allRoles || "Tất cả vai trò"}</option>
            <option value="ROLE_USER">{t.roleUserOption || "Khách hàng (User)"}</option>
            <option value="ROLE_PROVIDER">{t.roleProviderOption || "Nhà cung cấp (Provider)"}</option>
            <option value="ROLE_ADMIN">{t.roleAdminOption || "Quản trị viên (Admin)"}</option>
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
            <option value="ALL">{t.allStatuses || "Tất cả trạng thái"}</option>
            <option value="ACTIVE">{t.statusActive || "Đang hoạt động"}</option>
            <option value="UNVERIFIED">{t.statusUnverified || "Chưa xác thực email"}</option>
            <option value="LOCKED">{t.statusLocked || "Bị khóa"}</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            title="Sắp xếp danh sách"
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
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {(t.sortByPrefix || "Sắp xếp: ")}{o.label}
              </option>
            ))}
          </select>

          {/* Search box */}
          <div style={{ position: "relative" }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 13 }} />
            <input
              type="text"
              placeholder={t.searchUserPlaceholder || "Tìm tên, email, sđt..."}
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
            {(t.userListCount || "Danh sách: {count} tài khoản").replace("{count}", visibleUsers.length)}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            {t.loadingUsers || "Đang tải dữ liệu người dùng..."}
          </div>
        ) : visibleUsers.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            {t.noUsersFound || "Không tìm thấy người dùng phù hợp."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
                  {sortHeader("id", t.colRouteId || "ID", { width: 70 })}
                  {sortHeader("name", t.colUser || "Người dùng")}
                  {sortHeader("email", t.colEmailPhone || "Email & SĐT")}
                  {sortHeader("role", t.colRole || "Vai trò (Role)")}
                  {sortHeader("points", t.colPointsTier || "Điểm thưởng / Hạng")}
                  {sortHeader("status", t.colStatus || "Trạng thái")}
                  <th style={{ padding: "14px 18px", textAlign: "center", width: 170 }}>{t.colActions || "Thao tác"}</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => {
                  const roleBadge = getRoleBadge(u.role);
                  const isCurrent = currentUser?.email === u.email;

                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border-light)", transition: "background 0.15s" }}>
                      <td style={{ padding: "14px 18px", fontWeight: 600, color: "var(--text-muted)" }}>
                        #{u.id}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                          {u.fullName || (t.unnamedUser || "Chưa đặt tên")} {isCurrent && <span style={{ fontSize: 11, color: "var(--primary)" }}>{t.youBadge || "(Bạn)"}</span>}
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 13, color: "var(--text-main)" }}>{u.email}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{u.phone || (t.noPhone || "Chưa có SĐT")}</div>
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
                          {(t.userPointsUnit || "{points} xu").replace("{points}", u.points || 0)}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {(t.membershipTierPrefix || "Hạng {tier}").replace("{tier}", getMembershipName(u.membershipLevel, t))}
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        {u.enabled ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#10b981", fontSize: 13, fontWeight: 600 }}>
                            <FaCheckCircle size={14} /> {t.statusActiveBadge || "Hoạt động"}
                          </span>
                        ) : u.awaitingEmailVerification ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#f59e0b", fontSize: 13, fontWeight: 600 }}>
                            <FaEnvelope size={13} /> {t.statusUnverifiedBadge || "Chưa xác thực email"}
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#ef4444", fontSize: 13, fontWeight: 600 }}>
                            <FaBan size={14} /> {t.statusLockedBadge || "Đã khóa"}
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
                            title={t.btnAssignRoleTitle || "Phân quyền tài khoản"}
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
                            <FaUserEdit /> {t.btnRole || "Quyền"}
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
                              title={t.btnLockAccountTitle || "Khóa tài khoản này"}
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
                              <FaUserLock /> {t.btnLock || "Khóa"}
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
                              title={u.awaitingEmailVerification ? (t.btnActivateSkipOtp || "Kích hoạt hộ (bỏ qua bước xác thực email)") : (t.btnUnlockAccount || "Mở khóa tài khoản")}
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
                              <FaUserCheck /> {t.btnActivate || "Kích hoạt"}
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
        <ModalPortal closeOnBackdrop={false} onClose={() => setRoleModal({ show: false, user: null, role: "ROLE_USER", loading: false })}>
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
                <FaUserShield style={{ color: "var(--primary)" }} /> {t.changeRoleModalTitle || "Đổi vai trò tài khoản"}
              </h3>
              <button
                onClick={() => setRoleModal({ show: false, user: null, role: "ROLE_USER", loading: false })}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}
              >
                <FaTimes />
              </button>
            </div>

            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
              {t.changeRoleUserLabel || "Người dùng:"} <strong>{roleModal.user?.fullName || roleModal.user?.email}</strong> (#{roleModal.user?.id})
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>
                {t.selectNewRoleLabel || "Chọn vai trò mới:"}
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
                <option value="ROLE_USER">{t.roleDescUser || "Khách hàng (ROLE_USER) - Đặt vé, tích điểm, đánh giá"}</option>
                <option value="ROLE_PROVIDER">{t.roleDescProvider || "Nhà cung cấp (ROLE_PROVIDER) - Quét vé, xem doanh thu"}</option>
                <option value="ROLE_ADMIN">{t.roleDescAdmin || "Quản trị viên (ROLE_ADMIN) - Toàn quyền quản trị hệ thống"}</option>
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
                {t.cancelBtn || "Hủy"}
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
                {roleModal.loading ? (t.savingRoute || "Đang lưu...") : (t.btnUpdate || "Cập nhật")}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Khóa / Mở khóa */}
      {statusModal.show && (
        <ModalPortal onClose={() => setStatusModal({ show: false, user: null, targetEnabled: true, loading: false })}>
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
              {statusModal.targetEnabled ? (t.modalUnlockTitle || "✓ Kích hoạt / Mở khóa tài khoản") : (t.modalLockTitle || "⚠️ Xác nhận khóa tài khoản")}
            </h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
              {statusModal.targetEnabled
                ? (t.confirmActivateMsg || "Bạn có muốn kích hoạt tài khoản cho {email} không? Tài khoản này sẽ có thể đăng nhập ngay mà không cần nhập mã xác thực OTP.").replace("{email}", statusModal.user?.email)
                : (t.confirmLockMsg || "Bạn có chắc chắn muốn khóa tài khoản {email}? Người dùng sẽ không thể đăng nhập vào hệ thống cho tới khi được mở khóa lại.").replace("{email}", statusModal.user?.email)
              }
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
                {t.cancelBtn || "Hủy"}
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
                {statusModal.loading ? (t.btnProcessing || "Đang xử lý...") : statusModal.targetEnabled ? (t.btnConfirmActivate || "Xác nhận kích hoạt") : (t.btnLockAccount || "Khóa tài khoản")}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default AdminUsers;
