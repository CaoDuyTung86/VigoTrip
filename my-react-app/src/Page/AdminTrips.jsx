import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { RiTimerLine } from "react-icons/ri";
import { MdOutlineCancel } from "react-icons/md";


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
  QNH: "Quy Nhơn",
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

const formatFormattedDateTime = (isoString) => {
  if (!isoString) return "--:--";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.replace("T", " ");
    const timeStr = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const dateStr = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${timeStr} - ${dateStr}`;
  } catch {
    return isoString.replace("T", " ");
  }
};

const AdminTrips = () => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("PLANE");
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingPrice, setEditingPrice] = useState({});
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    routeId: "",
    vehicleId: "",
    departureDate: "",
    departureTime: "",
    arrivalTime: "",
    price: "",
    status: "ACTIVE",
  });

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Delay modal state
  const [delayModal, setDelayModal] = useState({ show: false, trip: null, newDeparture: "", newArrival: "", reason: "", loading: false });
  // Cancel modal state
  const [cancelAdminModal, setCancelAdminModal] = useState({ show: false, trip: null, reason: "", loading: false });

  useEffect(() => {
    if (!token) return;
    loadRoutes();
    loadVehicles();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadTrips();
  }, [token, currentPage, activeTab, searchTerm]);

  const loadTrips = async () => {
    setLoading(true);
    setError("");
    try {
      const url = new URL(`${window.location.origin}${API_BASE}/admin/trips`);
      url.searchParams.append("page", currentPage);
      url.searchParams.append("size", pageSize);
      url.searchParams.append("type", activeTab);
      if (searchTerm) url.searchParams.append("search", searchTerm);

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError(t.admLoadTripsError);
        } else {
          const text = await res.text();
          setError(text || t.admErrorStatus.replace("{status}", res.status));
        }
        setTrips([]);
        setTotalPages(0);
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      let parsed;

      // Ưu tiên parse theo JSON nếu server trả đúng content-type
      if (contentType.includes("application/json")) {
        try {
          parsed = await res.json();
        } catch {
          // fallback: đọc text để hiển thị preview debug
          const text = await res.text();
          const preview = (text || "").replace(/^\uFEFF/, "").slice(0, 200);
          setError(
            t.admInvalidJsonPreview.replace("{preview}", preview || t.admEmptyPreview)
          );
          setTrips([]);
          setTotalPages(0);
          return;
        }
      } else {
        // fallback: server trả text/html hoặc text/plain nhưng body vẫn có thể là JSON
        const text = await res.text();
        const cleaned = (text || "").replace(/^\uFEFF/, "").trim();
        if (!cleaned) {
          setTrips([]);
          setTotalPages(0);
          return;
        }
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          const preview = cleaned.slice(0, 200);
          setError(
            t.admInvalidDataPreview.replace("{contentType}", contentType || t.admNoContentType).replace("{preview}", preview)
          );
          setTrips([]);
          setTotalPages(0);
          return;
        }
      }

      // Backend trả về Page<Trip> nên data nằm trong 'content', số trang nằm trong 'totalPages'
      const data = parsed?.content ?? parsed?.data ?? (Array.isArray(parsed) ? parsed : []);
      setTrips(Array.isArray(data) ? data : []);
      setTotalPages(parsed?.totalPages ?? 1);
    } catch (e) {
      console.error(e);
      setError(t.admServerError);
    } finally {
      setLoading(false);
    }
  };

  const loadRoutes = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/routes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setRoutes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadVehicles = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePriceChange = (id, value) => {
    setEditingPrice((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const savePrice = async (id) => {
    const raw = editingPrice[id];
    if (!raw) return;
    const value = Number(raw);
    if (Number.isNaN(value) || value <= 0) {
      setError(t.admPriceInvalid);
      return;
    }

    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/trips/${id}/price`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      await loadTrips();
    } catch (e) {
      console.error(e);
      setError(t.admPriceUpdateError);
    }
  };

  const handleCreateFieldChange = (field, value) => {
    setCreateForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const submitCreateTrip = async () => {
    if (!createForm.routeId || !createForm.vehicleId || !createForm.departureDate || !createForm.departureTime || !createForm.arrivalTime || !createForm.price) {
      setError(t.admCreateRequired);
      return;
    }
    setError("");
    setCreating(true);
    try {
      const departureTime = `${createForm.departureDate}T${createForm.departureTime}:00`;
      const arrivalTime = `${createForm.departureDate}T${createForm.arrivalTime}:00`;
      const body = {
        route: { id: Number(createForm.routeId) },
        vehicle: { id: Number(createForm.vehicleId) },
        departureTime,
        arrivalTime,
        price: Number(createForm.price),
        status: createForm.status,
      };
      const res = await fetch(`${API_BASE}/admin/trips`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      setCreateForm({
        routeId: "",
        vehicleId: "",
        departureDate: "",
        departureTime: "",
        arrivalTime: "",
        price: "",
        status: "ACTIVE",
      });
      await loadTrips();
    } catch (e) {
      console.error(e);
      setError(t.admCreateError);
    } finally {
      setCreating(false);
    }
  };

  const handleDelay = async () => {
    if (!delayModal.reason.trim()) { setError(t.admDelayReasonRequired); return; }
    setDelayModal(prev => ({ ...prev, loading: true }));
    try {
      const body = { reason: delayModal.reason };
      if (delayModal.newDeparture) body.newDepartureTime = delayModal.newDeparture;
      if (delayModal.newArrival) body.newArrivalTime = delayModal.newArrival;
      const res = await fetch(`${API_BASE}/admin/trips/${delayModal.trip.id}/delay`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setDelayModal({ show: false, trip: null, newDeparture: "", newArrival: "", reason: "", loading: false });
      await loadTrips();
    } catch (e) { setError(t.admDelayError.replace("{msg}", e.message)); setDelayModal(prev => ({ ...prev, loading: false })); }
  };

  const handleCancelTrip = async () => {
    if (!cancelAdminModal.reason.trim()) { setError(t.admCancelReasonRequired); return; }
    setCancelAdminModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/admin/trips/${cancelAdminModal.trip.id}/cancel`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelAdminModal.reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCancelAdminModal({ show: false, trip: null, reason: "", loading: false });
      await loadTrips();
    } catch (e) { setError(t.admCancelError.replace("{msg}", e.message)); setCancelAdminModal(prev => ({ ...prev, loading: false })); }
  };

  if (!user || user.role !== "ROLE_ADMIN") {
    return (
      <div style={{ padding: 24, color: "var(--text-main)" }}>
        <h2>{t.admTripsTitle}</h2>
        <p>{t.admAdminOnly}</p>
      </div>
    );
  }

  return (
    <div className="page-main" style={{ padding: "var(--page-padding)", paddingTop: "calc(var(--header-height) + var(--page-padding))", color: "var(--text-main)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text-heading)" }}>
            {t.admTripsTitle}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            {t.admTripsSubtitle}
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", marginBottom: 20, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Bar điều hướng Tab & Tìm kiếm */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, background: "var(--bg-card)", padding: 4, borderRadius: 12, border: "1px solid var(--border-light)" }}>
          {["PLANE", "BUS", "TRAIN"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setCurrentPage(0);
                setSearchInput("");
                setSearchTerm("");
              }}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                background: activeTab === tab ? "var(--primary)" : "transparent",
                color: activeTab === tab ? "#fff" : "var(--text-secondary)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: activeTab === tab ? "0 4px 12px rgba(99, 102, 241, 0.3)" : "none"
              }}
            >
              {tab === "PLANE" ? t.flight : tab === "BUS" ? t.bus : t.train}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder={t.admSearchPlaceholder}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearchTerm(searchInput);
                setCurrentPage(0);
              }
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--border-input)",
              backgroundColor: "var(--bg-card)",
              color: "var(--text-main)",
              width: 260,
              fontSize: 14,
              outline: "none"
            }}
          />
          <button
            onClick={() => {
              setSearchTerm(searchInput);
              setCurrentPage(0);
            }}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
              transition: "0.2s"
            }}
          >
            {t.admSearchBtn}
          </button>
        </div>
      </div>

      {/* Form tạo chuyến mới */}
      <div
        style={{
          marginBottom: 24,
          padding: 20,
          borderRadius: 16,
          border: "1px solid var(--border-light)",
          background: "var(--bg-card)",
          boxShadow: "var(--shadow-md)"
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 8 }}>
          ➕ {t.admCreateTripTitle} ({activeTab === "PLANE" ? t.flight : activeTab === "BUS" ? t.bus : t.train})
        </h3>

        {/* Hàng 1: 4 ô bằng nhau */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>
              {t.admRouteLabel}
            </label>
            <select
              value={createForm.routeId}
              onChange={(e) => handleCreateFieldChange("routeId", e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 10,
                border: "1px solid var(--border-input)",
                backgroundColor: "var(--bg-main)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box"
              }}
            >
              <option value="">{t.admSelectRoute}</option>
              {routes
                .filter((r, idx, self) => idx === self.findIndex(t => t.origin === r.origin && t.destination === r.destination))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {getCityLabel(r.origin)} → {getCityLabel(r.destination)}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>
              {t.admVehicleLabel}
            </label>
            <select
              value={createForm.vehicleId}
              onChange={(e) => handleCreateFieldChange("vehicleId", e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 10,
                border: "1px solid var(--border-input)",
                backgroundColor: "var(--bg-main)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box"
              }}
            >
              <option value="">{t.admSelectVehicle}</option>
              {vehicles
                .filter(v => v.vehicleType === activeTab)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.provider?.providerName} ({t.admSeatCount.replace("{count}", v.totalSeats || 0)})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>
              {t.departureDate}
            </label>
            <input
              type="date"
              value={createForm.departureDate}
              onChange={(e) => handleCreateFieldChange("departureDate", e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 10,
                border: "1px solid var(--border-input)",
                backgroundColor: "var(--bg-main)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>
              {t.status}
            </label>
            <select
              value={createForm.status}
              onChange={(e) => handleCreateFieldChange("status", e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 10,
                border: "1px solid var(--border-input)",
                backgroundColor: "var(--bg-main)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box"
              }}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        {/* Hàng 2: 4 ô đối ứng (Giờ đi, Giờ đến, Giá vé, Nút bấm) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "flex-end", marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>
              {t.admDepartureTimeLabel}
            </label>
            <input
              type="time"
              value={createForm.departureTime}
              onChange={(e) => handleCreateFieldChange("departureTime", e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 10,
                border: "1px solid var(--border-input)",
                backgroundColor: "var(--bg-main)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>
              {t.admArrivalTimeLabel}
            </label>
            <input
              type="time"
              value={createForm.arrivalTime}
              onChange={(e) => handleCreateFieldChange("arrivalTime", e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 10,
                border: "1px solid var(--border-input)",
                backgroundColor: "var(--bg-main)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-muted)" }}>
              {t.admPriceLabel}
            </label>
            <input
              type="number"
              value={createForm.price}
              onChange={(e) => handleCreateFieldChange("price", e.target.value)}
              placeholder={t.admPriceExample}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 10,
                border: "1px solid var(--border-input)",
                backgroundColor: "var(--bg-main)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>
          <div>
            <button
              type="button"
              onClick={submitCreateTrip}
              disabled={creating}
              style={{
                width: "100%",
                padding: "11px 20px",
                borderRadius: 10,
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
                transition: "0.2s",
                boxSizing: "border-box"
              }}
            >
              {creating ? t.admCreating : t.admCreateTripBtn}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button
          type="button"
          onClick={loadTrips}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--border-input)",
            background: "var(--bg-card)",
            color: "var(--text-main)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500
          }}
          disabled={loading}
        >
          🔄 {loading ? t.admLoading : t.admReloadList}
        </button>
      </div>

      {/* Bảng danh sách chuyến đi */}
      <div className="table-wrap" style={{ border: "1px solid var(--border-light)", borderRadius: 16, overflow: "hidden", background: "var(--bg-card)", boxShadow: "var(--shadow-md)" }}>
        <table
          style={{
            borderCollapse: "collapse",
            fontSize: 13,
            width: "100%",
          }}
        >
          <thead>
            <tr
              style={{
                background: "rgba(99,102,241,0.06)",
                textAlign: "left",
              }}
            >
              <th style={{ padding: "14px 18px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase" }}>ID</th>
              <th style={{ padding: "14px 18px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase" }}>{t.admRouteCol}</th>
              <th style={{ padding: "14px 18px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase" }}>{t.admDepartureCol}</th>
              <th style={{ padding: "14px 18px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase" }}>{t.admArrivalCol}</th>
              <th style={{ padding: "14px 18px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase" }}>{t.admCarrierCol}</th>
              <th style={{ padding: "14px 18px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase" }}>{t.admCurrentPriceCol}</th>
              <th style={{ padding: "14px 18px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase" }}>{t.admEditPriceCol}</th>
              <th style={{ padding: "14px 18px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase" }}>{t.status}</th>
              <th style={{ padding: "14px 18px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase" }}>{t.admActionsCol}</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr key={trip.id} style={{ borderBottom: "1px solid var(--border-light)", transition: "0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,0.04)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "14px 18px", color: "#64748b", fontWeight: "600", fontFamily: "monospace" }}>
                  #{trip.id}
                </td>
                <td style={{ padding: "14px 18px", fontWeight: 600, color: "var(--text-heading)" }}>
                  {getCityLabel(trip.route?.origin)} → {getCityLabel(trip.route?.destination)}
                </td>
                <td style={{ padding: "14px 18px", color: "var(--text-main)", fontSize: 13, whiteSpace: "nowrap" }}>
                  {formatFormattedDateTime(trip.departureTime)}
                </td>
                <td style={{ padding: "14px 18px", color: "var(--text-main)", fontSize: 13, whiteSpace: "nowrap" }}>
                  {formatFormattedDateTime(trip.arrivalTime)}
                </td>
                <td style={{ padding: "14px 18px", color: "var(--text-main)", fontWeight: 500 }}>
                  {trip.vehicle?.provider?.providerName}
                </td>
                <td style={{ padding: "14px 18px", fontWeight: 700, color: "#a5b4fc", fontFamily: "monospace", fontSize: 14 }}>
                  {Number(trip.price || 0).toLocaleString("vi-VN")} đ
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="number" placeholder={t.admNewPricePlaceholder}
                      value={editingPrice[trip.id] ?? ""}
                      onChange={(e) => handlePriceChange(trip.id, e.target.value)}
                      style={{ width: 100, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border-input)", backgroundColor: "var(--bg-main)", color: "var(--text-main)", fontSize: 12, outline: "none" }}
                    />
                    <button type="button" onClick={() => savePrice(trip.id)}
                      style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 12, boxShadow: "0 2px 6px rgba(99,102,241,0.3)" }}
                    >{t.admSaveBtn}</button>
                  </div>
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: trip.status === "CANCELLED" ? "rgba(239,68,68,0.15)" : trip.status === "DELAYED" ? "rgba(245,158,11,0.15)" : "rgba(52,211,153,0.15)",
                    color: trip.status === "CANCELLED" ? "#f87171" : trip.status === "DELAYED" ? "#fbbf24" : "#34d399",
                    border: `1px solid ${trip.status === "CANCELLED" ? "#f8717133" : trip.status === "DELAYED" ? "#fbbf2433" : "#34d39933"}`
                  }}>{trip.status}</span>
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setDelayModal({ show: true, trip, newDeparture: "", newArrival: "", reason: "", loading: false })}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "rgba(245,158,11,0.2)", color: "#fbbf24", cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 4, transition: "0.2s" }}
                    ><RiTimerLine />{t.admDelayBtn}</button>
                    <button onClick={() => setCancelAdminModal({ show: true, trip, reason: "", loading: false })}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.2)", color: "#f87171", cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 4, transition: "0.2s" }}
                    ><MdOutlineCancel />{t.cancelBtn}</button>
                  </div>
                </td>
              </tr>
            ))}
            {trips.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  {t.admNoTrips}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Phân trang */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
          {t.admPageInfo.replace("{current}", currentPage + 1).replace("{total}", totalPages || 1)}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            disabled={currentPage === 0 || loading}
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--border-input)",
              background: currentPage === 0 ? "var(--bg-main)" : "var(--bg-card)",
              color: currentPage === 0 ? "var(--text-muted)" : "var(--text-main)",
              cursor: currentPage === 0 ? "not-allowed" : "pointer"
            }}
          >
            {t.admPrevPage}
          </button>
          
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i;
              } else if (currentPage < 3) {
                pageNum = i;
              } else if (currentPage > totalPages - 3) {
                pageNum = totalPages - 5 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              if (pageNum < 0 || pageNum >= totalPages) return null;
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: currentPage === pageNum ? "none" : "1px solid var(--border-input)",
                    background: currentPage === pageNum ? "var(--primary)" : "var(--bg-card)",
                    color: currentPage === pageNum ? "#fff" : "var(--text-main)",
                    cursor: "pointer",
                    fontWeight: currentPage === pageNum ? 700 : 400,
                    boxShadow: currentPage === pageNum ? "0 4px 12px rgba(99,102,241,0.3)" : "none"
                  }}
                >
                  {pageNum + 1}
                </button>
              );
            })}
          </div>

          <button
            disabled={currentPage >= totalPages - 1 || loading}
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--border-input)",
              background: currentPage >= totalPages - 1 ? "var(--bg-main)" : "var(--bg-card)",
              color: currentPage >= totalPages - 1 ? "var(--text-muted)" : "var(--text-main)",
              cursor: currentPage >= totalPages - 1 ? "not-allowed" : "pointer"
            }}
          >
            {t.admNextPage}
          </button>
        </div>
      </div>

      {/* Modal Hoãn chuyến */}
      {delayModal.show && delayModal.trip && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--bg-card)", padding: 28, borderRadius: 20, width: 440, maxWidth: "95vw", border: "1px solid var(--border-light)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
            <h3 style={{ fontWeight: 800, color: "#fbbf24", marginBottom: 4, fontSize: 18 }}>⏰ {t.admDelayTitle}</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>{delayModal.trip.route?.origin} → {delayModal.trip.route?.destination}</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 6, color: "var(--text-muted)" }}>{t.admNewDepartureLabel}</label>
              <input type="datetime-local" value={delayModal.newDeparture}
                onChange={e => setDelayModal(p => ({ ...p, newDeparture: e.target.value }))}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-input)", backgroundColor: "var(--bg-main)", color: "var(--text-main)", boxSizing: "border-box", outline: "none" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 6, color: "var(--text-muted)" }}>{t.admReasonLabel} <span style={{ color: "#f87171" }}>*</span></label>
              <textarea rows={3} value={delayModal.reason} onChange={e => setDelayModal(p => ({ ...p, reason: e.target.value }))}
                placeholder={t.admDelayReasonPlaceholder} maxLength={300}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-input)", backgroundColor: "var(--bg-main)", color: "var(--text-main)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDelayModal({ show: false, trip: null, newDeparture: "", newArrival: "", reason: "", loading: false })}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-main)", color: "var(--text-main)", cursor: "pointer" }}>{t.cancelBtn}</button>
              <button onClick={handleDelay} disabled={delayModal.loading}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#fff", cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(245,158,11,0.3)" }}>
                {delayModal.loading ? t.processing : t.admDelayConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hủy chuyến */}
      {cancelAdminModal.show && cancelAdminModal.trip && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--bg-card)", padding: 28, borderRadius: 20, width: 440, maxWidth: "95vw", border: "1px solid var(--border-light)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
            <h3 style={{ fontWeight: 800, color: "#f87171", marginBottom: 4, fontSize: 18 }}>❌ {t.admCancelTripTitle}</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{cancelAdminModal.trip.route?.origin} → {cancelAdminModal.trip.route?.destination}</p>
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#f87171" }}>
              ⚠️ {t.admCancelWarning}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 6, color: "var(--text-muted)" }}>{t.admReasonLabel} <span style={{ color: "#f87171" }}>*</span></label>
              <textarea rows={3} value={cancelAdminModal.reason} onChange={e => setCancelAdminModal(p => ({ ...p, reason: e.target.value }))}
                placeholder={t.admCancelReasonPlaceholder} maxLength={300}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-input)", backgroundColor: "var(--bg-main)", color: "var(--text-main)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setCancelAdminModal({ show: false, trip: null, reason: "", loading: false })}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-main)", color: "var(--text-main)", cursor: "pointer" }}>{t.qrCloseBtn}</button>
              <button onClick={handleCancelTrip} disabled={cancelAdminModal.loading}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(239,68,68,0.3)" }}>
                {cancelAdminModal.loading ? t.processing : t.admCancelConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTrips;


