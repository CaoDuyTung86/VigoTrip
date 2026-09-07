import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { FaRoute, FaPlus, FaEdit, FaTrash, FaSearch, FaTimes } from "react-icons/fa";
import ModalPortal from "../components/ModalPortal";

const API_BASE = "/api";

const CITY_NAME_MAP = {
  vi: {
    HAN: "Hà Nội",
    SGN: "TP. Hồ Chí Minh",
    DAD: "Đà Nẵng",
    HPH: "Hải Phòng",
    HUI: "Huế",
    HUE: "Huế",
    VII: "Vinh",
    VIN: "Vinh",
    SAP: "Sapa",
    QNH: "Quảng Ninh",
    CXR: "Nha Trang (Cam Ranh)",
    NTR: "Nha Trang",
    DLI: "Đà Lạt",
    DLT: "Đà Lạt",
    PQC: "Phú Quốc",
    VCL: "Chu Lai / Quảng Nam",
  },
  en: {
    HAN: "Hanoi",
    SGN: "Ho Chi Minh City",
    DAD: "Da Nang",
    HPH: "Hai Phong",
    HUI: "Hue",
    HUE: "Hue",
    VII: "Vinh",
    VIN: "Vinh",
    SAP: "Sapa",
    QNH: "Quang Ninh",
    CXR: "Nha Trang (Cam Ranh)",
    NTR: "Nha Trang",
    DLI: "Da Lat",
    DLT: "Da Lat",
    PQC: "Phu Quoc",
    VCL: "Chu Lai / Quang Nam",
  },
  ja: {
    HAN: "ハノイ",
    SGN: "ホーチミン",
    DAD: "ダナン",
    HPH: "ハイフォン",
    HUI: "フエ",
    HUE: "フエ",
    VII: "ヴィン",
    VIN: "ヴィン",
    SAP: "サパ",
    QNH: "クアンニン",
    CXR: "ニャチャン",
    NTR: "ニャチャン",
    DLI: "ダラット",
    DLT: "ダラット",
    PQC: "フーコック",
    VCL: "チュライ",
  },
  zh: {
    HAN: "河內",
    SGN: "胡志明市",
    DAD: "峴港",
    HPH: "海防",
    HUI: "順化",
    HUE: "順化",
    VII: "榮市",
    VIN: "榮市",
    SAP: "沙壩",
    QNH: "廣寧",
    CXR: "芽莊",
    NTR: "芽莊",
    DLI: "大叻",
    DLT: "大叻",
    PQC: "富國島",
    VCL: "朱萊",
  },
};

const getCityLabel = (code, lang = "vi") => {
  if (!code) return "";
  const dict = CITY_NAME_MAP[lang] || CITY_NAME_MAP.vi;
  const name = dict[code.toUpperCase()] || CITY_NAME_MAP.vi[code.toUpperCase()];
  return name ? `${name} (${code})` : code;
};

const AdminRoutes = () => {
  const { token, user } = useAuth();
  const toast = useToast?.() || { showToast: () => {} };
  const { t, currentLanguage } = useLanguage();
  const lang = currentLanguage?.code || "vi";

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
        toast.showToast?.(t.errLoadRoutes || "Không thể tải danh sách tuyến đường", "error");
      }
    } catch (err) {
      console.error(err);
      toast.showToast?.(t.errServerConnect || "Lỗi kết nối máy chủ", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) {
      alert(t.errFillOriginDest || "Vui lòng nhập đầy đủ Điểm đi và Điểm đến");
      return;
    }
    if (origin.trim().toUpperCase() === destination.trim().toUpperCase()) {
      alert(t.errSameOriginDest || "Điểm đi và điểm đến không được trùng nhau");
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
        if (toast.showToast) toast.showToast(t.routeCreatedSuccess || "Tạo tuyến đường thành công!", "success");
      } else {
        const text = await res.text();
        alert(text || t.errCreateRoute || "Không thể tạo tuyến đường");
      }
    } catch (err) {
      console.error(err);
      alert(t.errServerConnect || "Lỗi kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRoute = async () => {
    if (!editModal.origin.trim() || !editModal.destination.trim()) {
      alert(t.errFillOriginDest || "Vui lòng nhập đầy đủ Điểm đi và Điểm đến");
      return;
    }
    if (editModal.origin.trim().toUpperCase() === editModal.destination.trim().toUpperCase()) {
      alert(t.errSameOriginDest || "Điểm đi và điểm đến không được trùng nhau");
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
        if (toast.showToast) toast.showToast(t.routeUpdatedSuccess || "Cập nhật tuyến đường thành công!", "success");
      } else {
        const text = await res.text();
        alert(text || t.errUpdateRoute || "Không thể cập nhật tuyến đường");
      }
    } catch (err) {
      console.error(err);
      alert(t.errServerConnect || "Lỗi kết nối máy chủ");
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
        if (toast.showToast) toast.showToast(t.routeDeletedSuccess || "Xóa tuyến đường thành công!", "success");
      } else {
        const text = await res.text();
        alert(text || t.errDeleteRoute || "Không thể xóa tuyến đường (có thể tuyến đang có chuyến đi hoạt động)");
      }
    } catch (err) {
      console.error(err);
      alert(t.errServerConnect || "Lỗi kết nối máy chủ");
    } finally {
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  if (!user || user.role !== "ROLE_ADMIN") {
    return (
      <div style={{ padding: 24, color: "var(--text-main)", textAlign: "center" }}>
        <h2>{t.routeManagementTitle || "Quản lý Tuyến đường"}</h2>
        <p>{t.admAdminOnly || "Tính năng chỉ dành cho Quản trị viên."}</p>
      </div>
    );
  }

  const dict = CITY_NAME_MAP[lang] || CITY_NAME_MAP.vi;
  const filteredRoutes = routes.filter((r) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const orig = (r.origin || "").toLowerCase();
    const dest = (r.destination || "").toLowerCase();
    const origName = (dict[r.origin] || CITY_NAME_MAP.vi[r.origin] || "").toLowerCase();
    const destName = (dict[r.destination] || CITY_NAME_MAP.vi[r.destination] || "").toLowerCase();
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
            <FaRoute style={{ color: "var(--primary)" }} /> {t.routeManagementTitle || "Quản lý Tuyến đường"}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            {t.routeManagementSubtitle || "Danh sách và cấu hình các tuyến khởi hành / điểm đến trong toàn hệ thống"}
          </p>
        </div>

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 13 }} />
            <input
              type="text"
              placeholder={t.searchRoutePlaceholder || "Tìm mã hoặc tên địa điểm..."}
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
          <FaPlus style={{ fontSize: 14, color: "var(--primary)" }} /> {t.addRoute || "Thêm Tuyến đường Mới"}
        </h3>
        <form className="grid-form" onSubmit={handleCreateRoute} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 16, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>
              {t.departurePointLabel || "Điểm đi (Mã TP / Sân bay / Bến)"} <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="text"
              placeholder={t.departurePointPlaceholder || "Ví dụ: HAN hoặc Hà Nội"}
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
              {t.arrivalPointLabel || "Điểm đến (Mã TP / Sân bay / Bến)"} <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="text"
              placeholder={t.arrivalPointPlaceholder || "Ví dụ: SGN hoặc TP. Hồ Chí Minh"}
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
            {submitting ? (t.savingRoute || "Đang lưu...") : (t.addRouteButton || "Thêm Tuyến")}
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
            {(t.totalRoutes || "Tổng số: {count} tuyến").replace("{count}", filteredRoutes.length)}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            {t.loadingRoutes || "Đang tải danh sách tuyến đường..."}
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            {t.noRoutesFound || "Không tìm thấy tuyến đường nào."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "14px 18px", width: 80 }}>{t.colRouteId || "ID"}</th>
                  <th style={{ padding: "14px 18px" }}>{t.colOrigin || "Điểm đi (Origin)"}</th>
                  <th style={{ padding: "14px 18px" }}>{t.colDestination || "Điểm đến (Destination)"}</th>
                  <th style={{ padding: "14px 18px" }}>{t.colDisplayJourney || "Hành trình hiển thị"}</th>
                  <th style={{ padding: "14px 18px", textAlign: "center", width: 140 }}>{t.colActions || "Thao tác"}</th>
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
                        {dict[route.origin] || CITY_NAME_MAP.vi[route.origin] || ""}
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ padding: "4px 8px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                        {route.destination}
                      </span>
                      <span style={{ marginLeft: 8, color: "var(--text-secondary)", fontSize: 13 }}>
                        {dict[route.destination] || CITY_NAME_MAP.vi[route.destination] || ""}
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px", fontWeight: 500, color: "var(--text-main)" }}>
                      {getCityLabel(route.origin, lang)} ➔ {getCityLabel(route.destination, lang)}
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
                          title={t.editAction || "Chỉnh sửa"}
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
                          <FaEdit /> {t.editAction || "Sửa"}
                        </button>
                        <button
                          onClick={() =>
                            setDeleteModal({
                              show: true,
                              route,
                              loading: false,
                            })
                          }
                          title={t.deleteAction || "Xóa"}
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
                          <FaTrash /> {t.deleteAction || "Xóa"}
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
        <ModalPortal closeOnBackdrop={false} onClose={() => setEditModal({ show: false, route: null, origin: "", destination: "", loading: false })}>
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
                {(t.editRouteTitle || "✏️ Chỉnh sửa Tuyến đường #{id}").replace("{id}", editModal.route?.id)}
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
                {t.editOriginLabel || "Điểm đi:"}
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
                {t.editDestinationLabel || "Điểm đến:"}
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
                {t.cancelBtn || "Hủy"}
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
                {editModal.loading ? (t.savingRoute || "Đang lưu...") : (t.saveChangesBtn || "Lưu thay đổi")}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Xác nhận Xóa */}
      {deleteModal.show && (
        <ModalPortal onClose={() => setDeleteModal({ show: false, route: null, loading: false })}>
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
              {t.confirmDeleteRouteTitle || "⚠️ Xác nhận xóa tuyến đường"}
            </h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
              {(t.confirmDeleteRouteMsg || "Bạn có chắc chắn muốn xóa tuyến {route} (ID: #{id})?")
                .replace("{route}", `${deleteModal.route?.origin} ➔ ${deleteModal.route?.destination}`)
                .replace("{id}", deleteModal.route?.id)}
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
                {t.cancelBtn || "Hủy"}
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
                {deleteModal.loading ? (t.deletingBtn || "Đang xóa...") : (t.confirmDeleteBtn || "Xác nhận xóa")}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default AdminRoutes;
