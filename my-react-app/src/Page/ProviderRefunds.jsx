import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import { useLanguage } from "../context/LanguageContext";
import { FaPlane, FaBus, FaTrain, FaUser, FaRegClock, FaCommentDots, FaCheck, FaTimes } from "react-icons/fa";

const ProviderRefunds = () => {
  const { user, token, isAuthenticated } = useAuth();

  const { t } = useLanguage();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSidebarOpen] = useState(true); // setter đã bỏ: chỉ từng truyền cho <Header />, mà Header không nhận prop
  const [filter, setFilter] = useState("ALL");

  // Modal cho approve & reject
  const [rejectModal, setRejectModal] = useState({ show: false, refundId: null, note: "", loading: false });
  const [approveModal, setApproveModal] = useState({ show: false, refundId: null, loading: false });

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "ROLE_ADMIN") {
      setError(t.prfAdminLoginRequired);
      setLoading(false);
      return;
    }
    fetchRefunds();
  }, [isAuthenticated, user, token]);

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/refunds/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRefunds(res.data);
    } catch (err) {
      console.error(err);
      setError(t.prfLoadError);
    } finally {
      setLoading(false);
    }
  };

  const openApproveModal = (refundId) => {
    setApproveModal({ show: true, refundId, loading: false });
  };

  const handleApprove = async () => {
    try {
      setApproveModal(prev => ({ ...prev, loading: true }));
      await axios.put(`/api/refunds/${approveModal.refundId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApproveModal({ show: false, refundId: null, loading: false });
      await fetchRefunds();
    } catch (err) {
      alert(t.prfErrorAlert.replace("{msg}", err.response?.data?.message || err.message));
      setApproveModal(prev => ({ ...prev, loading: false }));
    }
  };

  const openRejectModal = (refundId) => {
    setRejectModal({ show: true, refundId, note: "", loading: false });
  };

  const handleReject = async () => {
    try {
      setRejectModal(prev => ({ ...prev, loading: true }));
      await axios.put(`/api/refunds/${rejectModal.refundId}/reject`, 
        { note: rejectModal.note },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRejectModal({ show: false, refundId: null, note: "", loading: false });
      await fetchRefunds();
      alert(t.prfRejectedAlert);
    } catch (err) {
      alert(t.prfErrorAlert.replace("{msg}", err.response?.data?.message || err.message));
      setRejectModal(prev => ({ ...prev, loading: false }));
    }
  };

  const filteredRefunds = filter === "ALL" ? refunds : refunds.filter(r => r.status === filter);

  const statusMap = {
    PENDING: { bg: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", text: t.pendingFilter },
    APPROVED: { bg: "rgba(34, 197, 94, 0.2)", color: "#4ade80", text: t.approvedFilter },
    REJECTED: { bg: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", text: t.rejectedFilter },
    COMPLETED: { bg: "rgba(34, 197, 94, 0.2)", color: "#4ade80", text: t.completed },
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)", display: "flex", flexDirection: "column" }}>
      {/* App.jsx đã dựng <Header /> cho route này. Trang tự dựng thêm một cái nữa là
          hai header position:fixed chồng khít lên nhau — từ khi có ngăn kéo mobile thành
          hai hamburger, hai ngăn kéo trong DOM. Prop setIsSidebarOpen cũng chưa bao giờ
          có tác dụng: Header không nhận prop nào. */}
      <div className="page-with-sidebar" style={{ display: "flex", flex: 1, marginTop: "var(--header-height)" }}>
        <Sidebar isOpen={isSidebarOpen} />
        <div className={`page-main ${isSidebarOpen ? "with-sidebar" : ""}`} style={{ padding: "30px", flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, color: "var(--text-heading)" }}>
              {t.refundManagement}
            </h1>

            {error && (
              <div style={{ padding: "20px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "12px", marginBottom: "20px", fontWeight: 600, textAlign: "center" }}>
                ⚠️ {error}
              </div>
            )}

            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              {[
                { key: "ALL", label: t.allFilter, count: refunds.length },
                { key: "PENDING", label: t.pendingFilter, count: refunds.filter(r => r.status === "PENDING").length },
                { key: "APPROVED", label: t.approvedFilter, count: refunds.filter(r => r.status === "APPROVED").length },
                { key: "REJECTED", label: t.rejectedFilter, count: refunds.filter(r => r.status === "REJECTED").length }
              ].map(tab => {
                const isActive = filter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    style={{
                      padding: "8px 18px", borderRadius: 20,
                      border: isActive ? "2px solid var(--primary)" : "1px solid var(--border-main)",
                      background: isActive ? "var(--primary)" : "var(--bg-card)",
                      color: isActive ? "#ffffff" : "var(--text-secondary)",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                      transition: "all 0.2s"
                    }}
                  >
                    {tab.label}
                    <span style={{
                      background: isActive ? "rgba(255,255,255,0.25)" : "var(--bg-input)",
                      color: isActive ? "#ffffff" : "var(--text-main)",
                      borderRadius: "50%", width: 22, height: 22,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 800
                    }}>{tab.count}</span>
                  </button>
                );
              })}
            </div>

            {loading ? (
              <p style={{ color: "var(--text-secondary)" }}>{t.prfLoading}</p>
            ) : filteredRefunds.length === 0 ? (
              <div style={{ background: "var(--bg-card)", padding: 40, borderRadius: 12, textAlign: "center", color: "var(--text-secondary)", border: "1px solid var(--border-main)", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                {t.noRefunds}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {filteredRefunds.map(r => {
                  const st = statusMap[r.status] || { bg: "var(--bg-input)", color: "var(--text-muted)", text: r.status };
                  return (
                    <div key={r.id} style={{
                      background: "var(--bg-card)", border: "1px solid var(--border-main)", borderRadius: 16,
                      padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", position: "relative", overflow: "hidden",
                      borderLeft: r.status === "PENDING" ? "6px solid #f59e0b" : r.status === "APPROVED" ? "6px solid #10b981" : r.status === "REJECTED" ? "6px solid #ef4444" : "6px solid var(--border-main)"
                    }}>
                      {/* Top bar: Badge status & Booking info + Price */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border-main)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <span style={{ background: st.bg, color: st.color, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 800, border: `1px solid ${st.color}40` }}>
                            {st.text}
                          </span>
                          <span style={{ fontSize: 14, color: "var(--text-main)", fontWeight: 700 }}>{t.prfRequestId.replace("{id}", r.id)}</span>
                          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>• {t.prfBookingIdLabel} <b style={{ color: "var(--primary)" }}>#{r.bookingId}</b></span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{t.prfRefundAmountLabel}</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: "#f97316", lineHeight: 1.2 }}>
                            {r.refundAmount?.toLocaleString("vi-VN")} đ
                          </div>
                        </div>
                      </div>

                      {/* Main details: Route, Provider, Passenger */}
                      <div className="grid-stack" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center", marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 19, fontWeight: 800, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <span style={{ color: "var(--primary)", display: "flex", alignItems: "center" }}>
                              {r.vehicleType === "PLANE" ? <FaPlane fontSize={20} /> : r.vehicleType === "BUS" ? <FaBus fontSize={20} /> : <FaTrain fontSize={20} />}
                            </span>
                            <span>{r.origin}</span>
                            <span style={{ color: "var(--primary)", fontSize: 16 }}>→</span>
                            <span>{r.destination}</span>
                          </div>

                          <div style={{ display: "flex", gap: 16, fontSize: 14, color: "var(--text-secondary)", flexWrap: "wrap", alignItems: "center" }}>
                            <span>{t.prfProviderLabel} <b style={{ color: "var(--text-main)" }}>{r.providerName}</b></span>
                            <span>•</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {t.passengerPrefix} <FaUser style={{ color: "var(--primary)", fontSize: 13 }} /> <b style={{ color: "var(--text-main)" }}>{r.userName}</b>
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons for Pending */}
                        {r.status === "PENDING" && (
                          <div style={{ display: "flex", gap: 10 }}>
                            <button
                              onClick={() => openApproveModal(r.id)}
                              style={{
                                width: 140, height: 42, borderRadius: 10, border: "none",
                                background: "linear-gradient(135deg, #10b981, #059669)", color: "white",
                                fontWeight: 700, fontSize: 13.5, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)", transition: "all 0.2s"
                              }}
                            >
                              <FaCheck fontSize={13} /> {t.prfApproveBtn}
                            </button>
                            <button
                              onClick={() => openRejectModal(r.id)}
                              style={{
                                width: 140, height: 42, borderRadius: 10,
                                border: "1px solid rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.1)",
                                color: "#fca5a5", fontWeight: 700, fontSize: 13.5,
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                transition: "all 0.2s"
                              }}
                            >
                              <FaTimes fontSize={13} /> {t.prfRejectBtn}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Reason box */}
                      {r.reason && (
                        <div style={{ background: "var(--bg-input)", border: "1px solid var(--border-main)", padding: "14px 16px", borderRadius: 10, marginBottom: 14, fontSize: 14.5, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
                          <FaCommentDots style={{ color: "var(--primary)", fontSize: 16, flexShrink: 0 }} />
                          <div>
                            <b style={{ color: "var(--primary)", marginRight: 6 }}>{t.refundReason}:</b> {r.reason}
                          </div>
                        </div>
                      )}

                      {r.providerNote && (
                        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "14px 16px", borderRadius: 10, marginBottom: 14, fontSize: 14.5, color: "#fca5a5" }}>
                          <b style={{ color: "#ef4444", marginRight: 6 }}>⚠️ {t.prfProviderNoteLabel}</b> {r.providerNote}
                        </div>
                      )}

                      {/* Footer time */}
                      <div style={{ fontSize: 13.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}>
                        <FaRegClock style={{ fontSize: 14, color: "var(--text-secondary)" }} />
                        <span>{t.sentAt}: <b style={{ color: "var(--text-secondary)" }}>{r.requestedAt ? new Date(r.requestedAt).toLocaleString("vi-VN") : "N/A"}</b></span>
                        {r.refundDate && <span>• {t.processedAt}: <b style={{ color: "var(--text-secondary)" }}>{new Date(r.refundDate).toLocaleString("vi-VN")}</b></span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Xác nhận Duyệt */}
      {approveModal.show && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.65)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "var(--bg-card)", padding: 32, borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 10px 25px rgba(0,0,0,0.4)", border: "1px solid var(--border-main)", textAlign: "center" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto", color: "#10b981" }}>
              <FaCheck fontSize={28} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: "var(--text-heading)" }}>
              {t.prfApproveConfirmTitle}
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              {t.prfApproveConfirmDesc.replace("{id}", approveModal.refundId)}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setApproveModal({ show: false, refundId: null, loading: false })}
                style={{ flex: 1, padding: "12px 20px", borderRadius: 10, border: "1px solid var(--border-main)", background: "var(--bg-input)", fontWeight: 700, cursor: "pointer", color: "var(--text-main)", fontSize: 14 }}
              >
                {t.prfCancelApproveBtn}
              </button>
              <button
                onClick={handleApprove}
                disabled={approveModal.loading}
                style={{ flex: 1, padding: "12px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: 700, cursor: approveModal.loading ? "not-allowed" : "pointer", fontSize: 14, boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)" }}
              >
                {approveModal.loading ? t.processing : t.prfApproveConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Từ chối */}
      {rejectModal.show && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.65)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "var(--bg-card)", padding: 32, borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 10px 25px rgba(0,0,0,0.4)", border: "1px solid var(--border-main)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: "var(--text-heading)" }}>
              {t.rejectTitle}
            </h3>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 700, fontSize: 14, display: "block", marginBottom: 8, color: "var(--text-main)" }}>{t.rejectReasonLabel}</label>
              <textarea
                value={rejectModal.note}
                onChange={e => setRejectModal(prev => ({ ...prev, note: e.target.value }))}
                placeholder={t.prfRejectReasonPlaceholder}
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-main)", background: "var(--bg-input)", color: "var(--text-main)", fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setRejectModal({ show: false, refundId: null, note: "", loading: false })}
                style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid var(--border-main)", background: "var(--bg-input)", fontWeight: 700, cursor: "pointer", color: "var(--text-main)" }}
              >
                {t.cancelBtn}
              </button>
              <button
                onClick={handleReject}
                disabled={rejectModal.loading}
                style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: rejectModal.loading ? "not-allowed" : "pointer" }}
              >
                {rejectModal.loading ? t.processing : t.rejectConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderRefunds;
