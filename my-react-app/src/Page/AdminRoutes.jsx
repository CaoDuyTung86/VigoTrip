import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { FaRoute, FaPlus, FaEdit, FaTrash, FaSearch, FaTimes } from "react-icons/fa";

const API_BASE = "/api";

const CITY_NAME_MAP = {
  HAN: "Hà Nội",
  SGN: "TP. Hồ Chí Minh",
  DAD: "Đà Nẵng",
  HPH: "Hải Phòng",
  HUI: "Huế",
  HUE: "Huế",
  VII: "Vinh",
  VIN: "Vinh",
  SAP: "Sapa",
  // QNH = Quảng Ninh (Ga Hạ Long / BX Bãi Cháy), khớp với TrainTickets.jsx và
  // BusTickets.jsx. Chỗ này từng ghi nhầm "Quy Nhơn" — lệch gần 900km so với
  // điểm thật, nên mã trong tuyen_duong và tên hiển thị cho admin nói hai chuyện
  // khác nhau; càng phải đúng vì đây sẽ là toạ độ cắm lên bản đồ sau này.
  QNH: "Quảng Ninh",
  CXR: "Nha Trang (Cam Ranh)",
  NTR: "Nha Trang",
  DLI: "Đà Lạt",
  DLT: "Đà Lạt",
  PQC: "Phú Quốc",
  VCL: "Chu Lai / Quảng Nam",
};

const getCityLabel = (code) => {
  if (!code) return "";
  const name = CITY_NAME_MAP[code.toUpperCase()];
  return name ? `${name} (${code})` : code;
};

const AdminRoutes = () => {
  const { token, user } = useAuth();
  const toast = useToast?.() || { showToast: () => {} };

  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Create form state
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit modal state
  const [editModal, setEditModal] = useState({
    show: false,
    route: null,
    origin: "",
    destination: "",
    loading: false,
  });

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({
    show: false,
    route: null,
    loading: false,
  });

  useEffect(() => {
    if (token) {
      loadRoutes();
    }
  }, [token]);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/routes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRoutes(Array.isArray(data) ? data : []);
      } else {
        toast.showToast?.("Không thể tải danh sách tuyến đường", "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.("Lỗi kết nối máy chủ", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) {
      alert("Vui lòng nhập đầy đủ Điểm đi và Điểm đến");
      return;
    }
    if (origin.trim().toUpperCase() === destination.trim().toUpperCase()) {
      alert("Điểm đi và điểm đến không được trùng nhau");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/routes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          origin: origin.trim().toUpperCase(),
          destination: destination.trim().toUpperCase(),
        }),
      });

      if (res.ok) {
        setOrigin("");
        setDestination("");
        loadRoutes();
        if (toast.showToast) toast.showToast("Tạo tuyến đường thành công!", "success");
      } else {
        const text = await res.text();
        alert(text || "Không thể tạo tuyến đường");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRoute = async () => {
    if (!editModal.origin.trim() || !editModal.destination.trim()) {
      alert("Vui lòng nhập đầy đủ Điểm đi và Điểm đến");
      return;
    }
    if (editModal.origin.trim().toUpperCase() === editModal.destination.trim().toUpperCase()) {
      alert("Điểm đi và điểm đến không được trùng nhau");
      return;
    }

    setEditModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/admin/routes/${editModal.route.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          origin: editModal.origin.trim().toUpperCase(),
          destination: editModal.destination.trim().toUpperCase(),
        }),
      });

      if (res.ok) {
        setEditModal({ show: false, route: null, origin: "", destination: "", loading: false });
        loadRoutes();
        if (toast.showToast) toast.showToast("Cập nhật tuyến đường thành công!", "success");
      } else {
        const text = await res.text();
        alert(text || "Không thể cập nhật tuyến đường");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ");
    } finally {
      setEditModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleDeleteRoute = async () => {
    setDeleteModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/admin/routes/${deleteModal.route.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok || res.status === 204) {
        setDeleteModal({ show: false, route: null, loading: false });
        loadRoutes();
        if (toast.showToast) toast.showToast("Xóa tuyến đường thành công!", "success");
      } else {
        const text = await res.text();
        alert(text || "Không thể xóa tuyến đường (có thể tuyến đang có chuyến đi hoạt động)");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ");
    } finally {
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  if (!user || user.role !== "ROLE_ADMIN") {
    return (
      <div style={{ padding: 24, color: "var(--text-main)", textAlign: "center" }}>
        <h2>Quản lý Tuyến đường</h2>
        <p>Tính năng chỉ dành cho Quản trị viên.</p>
      </div>
    );
  }

  const filteredRoutes = routes.filter((r) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const orig = (r.origin || "").toLowerCase();
    const dest = (r.destination || "").toLowerCase();
    const origName = (CITY_NAME_MAP[r.origin] || "").toLowerCase();
    const destName = (CITY_NAME_MAP[r.destination] || "").toLowerCase();
    return orig.includes(q) || dest.includes(q) || origName.includes(q) || destName.includes(q);
  });

  return (
    <div
      className="page-main"
      style={{
        padding: "var(--page-padding)",
        paddingTop: "calc(var(--header-height) + var(--page-padding))",
        color: "var(--text-main)",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 10 }}>
            <FaRoute style={{ color: "var(--primary)" }} /> Quản lý Tuyến đường
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Danh sách và cấu hình các tuyến khởi hành / điểm đến trong toàn hệ thống
          </p>
        </div>

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 13 }} />
            <input
              type="text"
              placeholder="Tìm mã hoặc tên địa điểm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: "9px 14px 9px 34px",
                borderRadius: 10,
                border: "1px solid var(--border-input)",
                backgroundColor: "var(--bg-card)",
                color: "var(--text-main)",
                width: 240,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* Form Tạo Tuyến Mới */}
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
          <FaPlus style={{ fontSize: 14, color: "var(--primary)" }} /> Thêm Tuyến đường Mới
        </h3>
        <form className="grid-form" onSubmit={handleCreateRoute} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 16, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>
              Điểm đi (Mã TP / Sân bay / Bến) <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Ví dụ: HAN hoặc Hà Nội"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 10,
                border: "1px solid var(--border-input)",
                backgroundColor: "var(--bg-main)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>
              Điểm đến (Mã TP / Sân bay / Bến) <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Ví dụ: SGN hoặc TP. Hồ Chí Minh"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 10,
                border: "1px solid var(--border-input)",
                backgroundColor: "var(--bg-main)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

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
              transition: "0.2s",
              height: 44,
              whiteSpace: "nowrap",
            }}
          >
            {submitting ? "Đang lưu..." : "Thêm Tuyến"}
          </button>
        </form>
      </div>

      {/* Bảng danh sách tuyến đường */}
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
            Tổng số: {filteredRoutes.length} tuyến
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            Đang tải danh sách tuyến đường...
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            Không tìm thấy tuyến đường nào.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "14px 18px", width: 80 }}>ID</th>
                  <th style={{ padding: "14px 18px" }}>Điểm đi (Origin)</th>
                  <th style={{ padding: "14px 18px" }}>Điểm đến (Destination)</th>
                  <th style={{ padding: "14px 18px" }}>Hành trình hiển thị</th>
                  <th style={{ padding: "14px 18px", textAlign: "center", width: 140 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.map((route) => (
                  <tr key={route.id} style={{ borderBottom: "1px solid var(--border-light)", transition: "background 0.15s" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 600, color: "var(--text-muted)" }}>
                      #{route.id}
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ padding: "4px 8px", background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                        {route.origin}
                      </span>
                      <span style={{ marginLeft: 8, color: "var(--text-secondary)", fontSize: 13 }}>
                        {CITY_NAME_MAP[route.origin] || ""}
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ padding: "4px 8px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                        {route.destination}
                      </span>
                      <span style={{ marginLeft: 8, color: "var(--text-secondary)", fontSize: 13 }}>
                        {CITY_NAME_MAP[route.destination] || ""}
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px", fontWeight: 500, color: "var(--text-main)" }}>
                      {getCityLabel(route.origin)} ➔ {getCityLabel(route.destination)}
                    </td>
                    <td style={{ padding: "14px 18px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button
                          onClick={() =>
                            setEditModal({
                              show: true,
                              route,
                              origin: route.origin,
                              destination: route.destination,
                              loading: false,
                            })
                          }
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
                          onClick={() =>
                            setDeleteModal({
                              show: true,
                              route,
                              loading: false,
                            })
                          }
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Chỉnh Sửa */}
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
              maxWidth: 450,
              border: "1px solid var(--border-light)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-heading)" }}>
                ✏️ Chỉnh sửa Tuyến đường #{editModal.route?.id}
              </h3>
              <button
                onClick={() => setEditModal({ show: false, route: null, origin: "", destination: "", loading: false })}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}
              >
                <FaTimes />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: "block", color: "var(--text-muted)" }}>
                Điểm đi:
              </label>
              <input
                type="text"
                value={editModal.origin}
                onChange={(e) => setEditModal((prev) => ({ ...prev, origin: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-main)",
                  color: "var(--text-main)",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: "block", color: "var(--text-muted)" }}>
                Điểm đến:
              </label>
              <input
                type="text"
                value={editModal.destination}
                onChange={(e) => setEditModal((prev) => ({ ...prev, destination: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-main)",
                  color: "var(--text-main)",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditModal({ show: false, route: null, origin: "", destination: "", loading: false })}
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
                onClick={handleEditRoute}
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

      {/* Modal Xác nhận Xóa */}
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
            <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#ef4444" }}>
              ⚠️ Xác nhận xóa tuyến đường
            </h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
              Bạn có chắc chắn muốn xóa tuyến{" "}
              <strong>
                {deleteModal.route?.origin} ➔ {deleteModal.route?.destination}
              </strong>{" "}
              (ID: #{deleteModal.route?.id})?
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteModal({ show: false, route: null, loading: false })}
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
                onClick={handleDeleteRoute}
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

export default AdminRoutes;
