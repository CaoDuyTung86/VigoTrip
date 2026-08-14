import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../LayOut/Header";
import Sidebar from "../components/Sidebar";
import { useLanguage } from "../context/LanguageContext";
import { TbTrain, TbBus } from "react-icons/tb";
import { FaPlane, FaQrcode } from "react-icons/fa";
import { FiLock, FiAlertCircle, FiRefreshCw } from "react-icons/fi";
import { QRCodeCanvas } from "qrcode.react";
import Auth from "./Auth";

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { t } = useLanguage();

  const location = useLocation();
  const navigate = useNavigate();
  const [toastMsg, setToastMsg] = useState(null); // { text, type, duration }
  const [showFireworks, setShowFireworks] = useState(false);

  const triggerFireworks = () => {
    setShowFireworks(true);
    setTimeout(() => setShowFireworks(false), 4500);
  };


  const [confirmModal, setConfirmModal] = useState({ show: false, title: "", message: "", onConfirm: null });
  const [cancelModal, setCancelModal] = useState({ show: false, booking: null, loading: false, error: null, reason: "", success: false });
  const [reviewModal, setReviewModal] = useState({ show: false, booking: null, rating: 0, hovered: 0, comment: "", loading: false, error: null, success: false });
  const [qrModal, setQrModal] = useState({ show: false, booking: null });


  const fetchBookings = async () => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setLoading(false);
      setErrorStatus(401);
      setError("Vui lòng đăng nhập để xem lịch sử đặt vé.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setErrorStatus(null);
      const res = await axios.get("/api/bookings", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(res.data || []);
    } catch (err) {
      const status = err.response?.status;
      setErrorStatus(status || 500);
      if (status === 401 || status === 403) {
        setError("Phiên đăng nhập đã hết hạn hoặc không có quyền truy cập. Vui lòng đăng nhập lại.");
      } else {
        setError(err.response?.data?.message || "Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const payment = params.get("payment");
    const reviewBookingId = params.get("reviewBookingId");

    if (payment === "success") {
      setToastMsg({ text: "Thanh toán thành công! Vé của bạn đã được xác nhận.", type: "success" });
      navigate("/my-bookings", { replace: true });
    } else if (payment === "failed") {
      setToastMsg({ text: "Thanh toán thất bại hoặc đã bị hủy.", type: "error" });
      navigate("/my-bookings", { replace: true });
    } else if (reviewBookingId && bookings.length > 0) {
      const targetBooking = bookings.find(b => String(b.id) === String(reviewBookingId));
      if (targetBooking) {
        setReviewModal({ show: true, booking: targetBooking, rating: 5, hovered: 0, comment: "", loading: false, error: null, success: false });
        navigate("/my-bookings", { replace: true });
      }
    }
  }, [location.search, bookings]);

  const openCancelModal = (booking) => {
    setCancelModal({ show: true, booking, loading: false, error: null, reason: "", success: false });
  };

  const closeCancelModal = () => {
    setCancelModal({ show: false, booking: null, loading: false, error: null, reason: "", success: false });
  };

  const handleConfirmCancel = async () => {
    if (!cancelModal.booking) return;
    if (!cancelModal.reason.trim()) {
      setCancelModal(prev => ({ ...prev, error: "Vui lòng nhập lý do hoàn vé." }));
      return;
    }
    try {
      setCancelModal(prev => ({ ...prev, loading: true, error: null }));
      const token = localStorage.getItem("authToken");
      await axios.post(`/api/refunds/request`, {
        bookingId: cancelModal.booking.id,
        reason: cancelModal.reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCancelModal(prev => ({ ...prev, loading: false, success: true }));

      setTimeout(async () => {
        await fetchBookings();
        closeCancelModal();
      }, 2000);
    } catch (err) {
      setCancelModal(prev => ({ ...prev, loading: false, error: err.response?.data?.message || err.message }));
    }
  };


  const getRefundInfo = (booking) => {
    if (!booking || !booking.departureTime) return { canRefund: false, penaltyPercent: 0, text: "" };

    const depTime = new Date(booking.departureTime).getTime();
    const now = new Date().getTime();
    const diffHours = (depTime - now) / (1000 * 60 * 60);

    if (diffHours < 4) {
      return { canRefund: false, penaltyPercent: 100, text: "Dưới 4 tiếng đến lúc khởi hành. KHÔNG hỗ trợ hoàn vé." };
    } else if (diffHours <= 24) {
      return { canRefund: true, penaltyPercent: 10, text: "Dưới 24 tiếng đến lúc khởi hành. PHÍ PHẠT LÀ 10%." };
    } else {
      return { canRefund: true, penaltyPercent: 0, text: "Trước 24 tiếng khởi hành. HỖ TRỢ HOÀN TRẢ 100%." };
    }
  };


  const openReviewModal = (booking) => {
    setReviewModal({ show: true, booking, rating: 0, hovered: 0, comment: "", loading: false, error: null, success: false });
  };

  const closeReviewModal = () => {
    setReviewModal({ show: false, booking: null, rating: 0, hovered: 0, comment: "", loading: false, error: null, success: false });
  };

  const handleSubmitReview = async () => {
    if (reviewModal.rating === 0) {
      setReviewModal(prev => ({ ...prev, error: "Vui lòng chọn số sao đánh giá (1–5)." }));
      return;
    }
    const currentRating = reviewModal.rating;
    try {
      setReviewModal(prev => ({ ...prev, loading: true, error: null }));
      const token = localStorage.getItem("authToken");
      await axios.post("/api/reviews", {
        bookingId: reviewModal.booking.id,
        rating: currentRating,
        comment: reviewModal.comment
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      // Mark booking as reviewed locally immediately
      const reviewedBookingId = reviewModal.booking.id;
      setBookings(prev => prev.map(b => b.id === reviewedBookingId ? { ...b, hasReviewed: true, reviewed: true } : b));

      closeReviewModal();
      
      if (currentRating === 5) {
        triggerFireworks();
        setToastMsg({ text: "🌟 Cảm ơn bạn đã đánh giá 5 sao tuyệt vời! Phản hồi của bạn là động lực rất lớn cho chúng tôi.", type: "success" });
      } else {
        setToastMsg({ text: "Cảm ơn bạn đã gửi đánh giá! Phản hồi của bạn giúp chúng tôi nâng cao chất lượng dịch vụ.", type: "success" });
      }
      await fetchBookings();
    } catch (err) {
      setReviewModal(prev => ({ ...prev, loading: false, error: err.response?.data?.message || err.message }));
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-main)" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Header />
        <div style={{ padding: "100px 40px 40px", flex: 1 }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24, color: "var(--text-heading)" }}>
              {t.yourBookings}
            </h1>

            {toastMsg && (
              <div style={{
                padding: "16px 20px",
                background: toastMsg.type === "error" ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
                color: toastMsg.type === "error" ? "#ef4444" : "#22c55e",
                borderRadius: 12,
                marginBottom: 24,
                fontWeight: 700,
                fontSize: 14,
                border: `1px solid ${toastMsg.type === "error" ? "#ef4444" : "#22c55e"}`,
                display: "flex",
                alignItems: "center",
                justify: "space-between",
                gap: 12,
                boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                animation: "fadeIn 0.3s ease"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <span>{toastMsg.type === "error" ? "⚠️" : "🎉"}</span>
                  <span>{toastMsg.text}</span>
                </div>
                <button
                  onClick={() => setToastMsg(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: toastMsg.type === "error" ? "#ef4444" : "#22c55e",
                    fontSize: 20,
                    fontWeight: 800,
                    cursor: "pointer",
                    padding: "0 4px",
                    lineHeight: 1
                  }}
                  title="Đóng thông báo"
                >
                  ✕
                </button>
              </div>
            )}

            {loading ? (
              <div style={{
                background: "var(--bg-card)",
                borderRadius: 16,
                padding: "60px 20px",
                textAlign: "center",
                border: "1px solid var(--border-main)",
                boxShadow: "var(--shadow-card)"
              }}>
                <div style={{
                  width: 44,
                  height: 44,
                  border: "3px solid rgba(79, 124, 255, 0.2)",
                  borderTopColor: "var(--primary)",
                  borderRadius: "50%",
                  margin: "0 auto 16px",
                  animation: "spin 0.8s linear infinite"
                }} />
                <p style={{ color: "var(--text-secondary)", fontSize: 15, fontWeight: 600 }}>
                  Đang tải dữ liệu lịch sử đặt vé...
                </p>
              </div>
            ) : (errorStatus === 401 || errorStatus === 403) ? (
              <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-main)",
                borderRadius: 20,
                padding: "48px 24px",
                textAlign: "center",
                boxShadow: "var(--shadow-card)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(249, 115, 22, 0.15))",
                  border: "1.5px solid rgba(239, 68, 68, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ef4444",
                  fontSize: 28,
                }}>
                  <FiLock />
                </div>
                <div style={{ maxWidth: 460 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-heading)", marginBottom: 8 }}>
                    Phiên đăng nhập đã hết hạn
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    Vui lòng đăng nhập tài khoản của bạn để tra cứu và quản lý toàn bộ vé đã đặt.
                  </p>
                </div>
                <button
                  onClick={() => setIsAuthOpen(true)}
                  style={{
                    marginTop: 8,
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    color: "#fff",
                    border: "none",
                    padding: "12px 28px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.2s",
                  }}
                >
                  <FiLock style={{ fontSize: 16 }} /> Đăng nhập / Đăng ký ngay
                </button>
              </div>
            ) : error ? (
              <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-main)",
                borderRadius: 20,
                padding: "48px 24px",
                textAlign: "center",
                boxShadow: "var(--shadow-card)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1.5px solid rgba(239, 68, 68, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ef4444",
                  fontSize: 28,
                }}>
                  <FiAlertCircle />
                </div>
                <div style={{ maxWidth: 480 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-heading)", marginBottom: 8 }}>
                    Không thể tải lịch sử vé
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {error}
                  </p>
                </div>
                <button
                  onClick={fetchBookings}
                  style={{
                    marginTop: 8,
                    background: "var(--bg-input)",
                    color: "var(--text-main)",
                    border: "1px solid var(--border-main)",
                    padding: "10px 24px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.2s",
                  }}
                >
                  <FiRefreshCw style={{ fontSize: 15 }} /> Thử lại
                </button>
              </div>
            ) : bookings.length === 0 ? (
              <div style={{
                background: "var(--bg-card)",
                padding: "50px 24px",
                borderRadius: 20,
                textAlign: "center",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-main)",
                boxShadow: "var(--shadow-card)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}>
                <div style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: "var(--bg-input)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                }}>
                  🎫
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-heading)", marginBottom: 6 }}>
                    {t.noBookings || "Bạn chưa có chuyến đi nào"}
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 400 }}>
                    Hãy khám phá các chuyến bay, tàu hỏa và xe khách giá tốt nhất ngay hôm nay!
                  </p>
                </div>
                <button
                  onClick={() => navigate("/")}
                  style={{
                    marginTop: 4,
                    background: "linear-gradient(135deg, var(--primary), #2563eb)",
                    color: "#fff",
                    border: "none",
                    padding: "10px 22px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  🚀 Khám phá chuyến đi ngay
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {bookings.map(bk => {
                  const isPaidOrConfirmed = bk.status === "PAID" || bk.status === "CONFIRMED";
                  const statusBg = isPaidOrConfirmed ? "rgba(34, 197, 94, 0.15)" : bk.status === "COMPLETED" ? "rgba(16, 185, 129, 0.2)" : bk.status === "CANCELLED" ? "rgba(156, 163, 175, 0.15)" : "rgba(234, 179, 8, 0.15)";
                  const statusColor = isPaidOrConfirmed ? "#22c55e" : bk.status === "COMPLETED" ? "#10b981" : bk.status === "CANCELLED" ? "#9ca3af" : "#eab308";
                  const statusText = bk.status === "PAID" ? "Đã thanh toán" : bk.status === "CONFIRMED" ? "Đã xác nhận" : bk.status === "COMPLETED" ? "Đã hoàn thành" : bk.status === "CANCELLED" ? "Đã hủy/Hoàn" : "Chờ thanh toán";
                  const hasPendingRefund = bk.refundStatus === "PENDING";
                  const hasRejectedRefund = bk.refundStatus === "REJECTED";

                  // Calculate arrival time (arrivalTime or departureTime + 2h fallback)
                  const depTime = bk.departureTime ? new Date(bk.departureTime).getTime() : 0;
                  const arrTime = bk.arrivalTime ? new Date(bk.arrivalTime).getTime() : (depTime > 0 ? depTime + 2 * 60 * 60 * 1000 : 0);
                  const isExpiredAfterArrival = arrTime > 0 && (Date.now() - arrTime > 60 * 60 * 1000);
                  const isTripFinished = arrTime > 0 && (Date.now() >= arrTime);

                  return (
                    <div key={bk.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-main)", borderRadius: 14, padding: 22, boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Top Header Row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-main)", paddingBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ background: statusBg, color: statusColor, border: `1px solid ${statusColor}`, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                            {statusText}
                          </span>
                          <span style={{ fontSize: 13, color: "var(--text-main)", fontWeight: 700 }}>Mã vé: #{bk.id}</span>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>• Đặt lúc: {new Date(bk.bookingDate).toLocaleString("vi-VN")}</span>
                        </div>
                        {/* Vehicle Badge */}
                        <div style={{ fontSize: 13, color: "var(--text-main)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, background: "var(--bg-input)", padding: "4px 12px", borderRadius: 8, border: "1px solid var(--border-main)" }}>
                          {bk.vehicleType === "PLANE" ? <FaPlane style={{ color: "var(--primary)" }} /> : bk.vehicleType === "BUS" ? <TbBus style={{ color: "var(--primary)" }} /> : <TbTrain style={{ color: "var(--primary)" }} />}
                          <span>{bk.vehicleType === "PLANE" ? "Vé máy bay" : bk.vehicleType === "BUS" ? "Vé xe khách" : "Vé tàu hỏa"}</span>
                          <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>({bk.providerName})</span>
                        </div>
                      </div>

                      {/* Middle Body Row */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "start" }}>
                        {/* Left Column Info */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 10 }}>
                            <span>{bk.origin}</span>
                            <span style={{ color: "#f97316", fontSize: 16 }}>➔</span>
                            <span>{bk.destination}</span>
                          </div>

                          <div style={{ display: "flex", gap: 24, fontSize: 14, color: "var(--text-main)", flexWrap: "wrap", marginTop: 4 }}>
                            <div>Khởi hành: <b style={{ color: "var(--text-main)", fontWeight: 700 }}>{new Date(bk.departureTime).toLocaleString("vi-VN")}</b></div>
                            <div>Ghế: <b style={{ color: "#f97316", fontWeight: 700 }}>{bk.seatNumbers ? bk.seatNumbers.join(", ") : "N/A"}</b></div>
                          </div>

                          {/* Passengers */}
                          {bk.ticketDetails && bk.ticketDetails.length > 0 && (
                            <div style={{ fontSize: 14, color: "var(--text-main)", marginTop: 4 }}>
                              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Hành khách: </span>
                              {bk.ticketDetails.map((td, idx) => (
                                <span key={idx} style={{ fontWeight: 700 }}>
                                  {td.passengerName || "N/A"}
                                  <span style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500 }}> ({td.seatNumber})</span>
                                  {idx < bk.ticketDetails.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Services */}
                          {bk.additionalServices && bk.additionalServices.length > 0 && (
                            <div style={{ fontSize: 13.5, color: "var(--text-main)", marginTop: 4, lineHeight: 1.5 }}>
                              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Dịch vụ: </span>
                              <span style={{ fontWeight: 600 }}>{bk.additionalServices.join(", ")}</span>
                            </div>
                          )}

                          {/* Refund Badges */}
                          {bk.status === "CANCELLED" && bk.refundAmount > 0 && (
                            <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 700, marginTop: 4 }}>
                              Đã hoàn tiền: {bk.refundAmount.toLocaleString("vi-VN")} đ
                            </div>
                          )}
                          {hasPendingRefund && (
                            <div style={{ marginTop: 6, padding: "6px 12px", background: "rgba(234, 179, 8, 0.15)", color: "#eab308", borderRadius: 6, fontSize: 12, fontWeight: 700, display: "inline-block", border: "1px solid #eab308" }}>
                              ⏳ Đang chờ admin duyệt yêu cầu hoàn vé
                            </div>
                          )}
                          {hasRejectedRefund && bk.status !== "CANCELLED" && (
                            <div style={{ marginTop: 6, padding: "6px 12px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", borderRadius: 6, fontSize: 12, fontWeight: 700, display: "inline-block", border: "1px solid #ef4444" }}>
                              ❌ Yêu cầu hoàn tiền bị từ chối
                            </div>
                          )}
                        </div>

                        {/* Right Column Price */}
                        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: "#f97316", whiteSpace: "nowrap" }}>
                            {(bk.totalPrice || 0).toLocaleString("vi-VN")} đ
                          </div>
                          <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600, marginTop: 2 }}>
                            (Đã áp dụng ưu đãi)
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action Buttons Row */}
                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px dashed var(--border-main)", paddingTop: 12, flexWrap: "wrap" }}>
                        {isPaidOrConfirmed && !isExpiredAfterArrival && (
                          <button
                            onClick={() => setQrModal({ show: true, booking: bk })}
                            style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 6px rgba(79, 124, 255, 0.3)" }}
                          >
                            <FaQrcode /> Mã vé QR
                          </button>
                        )}

                        {bk.status === "CONFIRMED" && !isExpiredAfterArrival && (
                          <button
                            onClick={() => {
                              setConfirmModal({
                                show: true,
                                title: "Xác nhận hoàn thành chuyến đi",
                                message: "Bạn có chắc chắn chuyến đi này đã hoàn thành? Hệ thống sẽ gửi khảo sát dịch vụ qua Email của bạn.",
                                onConfirm: async () => {
                                  try {
                                    setLoading(true);
                                    const token = localStorage.getItem("authToken");
                                    await axios.put(`/api/bookings/${bk.id}/complete`, {}, { headers: { Authorization: `Bearer ${token}` } });
                                    setToastMsg({ text: "Chuyến đi đã hoàn thành. Cảm ơn bạn!", type: "success" });
                                    await fetchBookings();
                                  } catch (e) {
                                    setError("Có lỗi xảy ra: " + (e.response?.data?.message || e.message));
                                  } finally {
                                    setLoading(false);
                                  }
                                }
                              });
                            }}
                            style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                          >
                            Hoàn thành chuyến đi
                          </button>
                        )}

                        {bk.status === "PENDING" && (
                          <button
                            onClick={async () => {
                              try {
                                setLoading(true);
                                const token = localStorage.getItem("authToken");
                                const res = await axios.post(`/api/payment/resume`,
                                  { bookingId: bk.id, language: "vn" },
                                  { headers: { Authorization: `Bearer ${token}` } }
                                );
                                if (res.data && res.data.paymentUrl) {
                                  window.location.href = res.data.paymentUrl;
                                } else {
                                  alert("Lỗi tạo link thanh toán, vui lòng thử lại.");
                                }
                              } catch (e) {
                                alert("Lỗi tiếp tục thanh toán: " + (e.response?.data?.message || e.message));
                              } finally {
                                setLoading(false);
                              }
                            }}
                            style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#f97316", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                          >
                            Thanh toán ngay →
                          </button>
                        )}

                        {bk.status !== "CANCELLED" && bk.status !== "COMPLETED" && !hasPendingRefund && (
                          <button
                            onClick={() => openCancelModal(bk)}
                            style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #ef4444", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                          >
                            Hủy / Hoàn vé
                          </button>
                        )}

                        {(bk.status === "COMPLETED" || isTripFinished) && (
                          (bk.hasReviewed || bk.reviewed) ? (
                            <span style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.4)", fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                              ✓ Đã đánh giá
                            </span>
                          ) : (
                            <button
                              onClick={() => openReviewModal(bk)}
                              style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#6366f1", color: "#ffffff", fontWeight: 700, cursor: "pointer", fontSize: 13, boxShadow: "0 2px 8px rgba(99, 102, 241, 0.35)" }}
                            >
                              Gửi Đánh Giá
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Hoàn vé */}
      {cancelModal.show && cancelModal.booking && (() => {
        const refundInfo = getRefundInfo(cancelModal.booking);
        const penaltyAmount = cancelModal.booking.totalPrice * (refundInfo.penaltyPercent / 100);
        const expectedRefund = cancelModal.booking.totalPrice - penaltyAmount;

        return (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 20 }}>
            <div style={{ background: "var(--bg-card)", padding: 32, borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, color: "var(--text-heading)" }}>
                Xác nhận hoàn/hủy vé
              </h3>

              <div style={{ background: "var(--bg-input)", border: "1px solid var(--border-light)", padding: 16, borderRadius: 8, marginBottom: 20 }}>
                <p style={{ margin: "0 0 8px 0", fontSize: 14 }}><b>Chuyến:</b> {cancelModal.booking.origin} → {cancelModal.booking.destination}</p>
                <p style={{ margin: "0 0 8px 0", fontSize: 14 }}><b>Khởi hành:</b> {new Date(cancelModal.booking.departureTime).toLocaleString("vi-VN")}</p>
                <p style={{ margin: 0, fontSize: 14 }}><b>Tổng tiền đã đặt:</b> <span style={{ color: "#ff6b00", fontWeight: 700 }}>{(cancelModal.booking.totalPrice || 0).toLocaleString("vi-VN")} đ</span></p>
              </div>

              <div style={{
                padding: 16,
                borderRadius: 12,
                background: refundInfo.canRefund ? "rgba(30, 58, 138, 0.3)" : "rgba(153, 27, 27, 0.3)",
                border: `1px solid ${refundInfo.canRefund ? "rgba(59, 130, 246, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
                marginBottom: 24
              }}>
                <div style={{ fontWeight: 700, color: refundInfo.canRefund ? "#60a5fa" : "#fca5a5", marginBottom: 8, fontSize: 15 }}>
                  Chính sách áp dụng:
                </div>
                <div style={{ fontSize: 13.5, color: refundInfo.canRefund ? "#93c5fd" : "#fecaca", lineHeight: 1.5 }}>
                  {refundInfo.text}
                </div>

                {refundInfo.canRefund && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(59, 130, 246, 0.3)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6, color: "var(--text-secondary)" }}>
                      <span>Phí phạt ({refundInfo.penaltyPercent}%):</span>
                      <span style={{ color: "#ef4444" }}>-{penaltyAmount.toLocaleString("vi-VN")} đ</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, marginTop: 8, color: "var(--text-main)" }}>
                      <span>Số tiền sẽ nhận lại:</span>
                      <span style={{ color: "#4ade80", fontSize: 18 }}>{expectedRefund.toLocaleString("vi-VN")} đ</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Lý do hoàn vé */}
              {refundInfo.canRefund && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 14, marginBottom: 8, color: "var(--text-heading)" }}>
                    Lý do hoàn vé <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <textarea
                    value={cancelModal.reason}
                    onChange={e => setCancelModal(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Vui lòng cho biết lý do bạn muốn hoàn/hủy vé..."
                    rows={3}
                    maxLength={500}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-input)", fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5, background: "var(--bg-input)", color: "var(--text-primary)" }}
                  />
                  <div style={{ textAlign: "right", fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{cancelModal.reason.length}/500</div>
                </div>
              )}

              {cancelModal.error && (
                <div style={{ padding: 12, background: "#fee2e2", color: "#dc2626", borderRadius: 8, fontSize: 13, marginBottom: 20, fontWeight: 600 }}>
                  ⚠️ {cancelModal.error}
                </div>
              )}

              {cancelModal.success && (
                <div style={{ padding: 16, background: "#dcfce7", color: "#16a34a", borderRadius: 8, fontSize: 14, marginBottom: 20, fontWeight: 700, textAlign: "center", border: "1px solid #bbf7d0" }}>
                  🎉 Yêu cầu hoàn vé đã được gửi thành công!<br />
                  <span style={{ fontWeight: 400, fontSize: 13 }}>Vui lòng chờ Admin duyệt. Bạn có thể theo dõi trạng thái tại đây.</span>
                </div>
              )}

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={closeCancelModal}
                  disabled={cancelModal.loading}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-card)", fontWeight: 700, cursor: "pointer", color: "var(--text-secondary)" }}
                >
                  Đóng
                </button>
                {refundInfo.canRefund && !cancelModal.success && (
                  <button
                    onClick={handleConfirmCancel}
                    disabled={cancelModal.loading}
                    style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: cancelModal.loading ? "#fca5a5" : "#ef4444", color: "#fff", fontWeight: 700, cursor: cancelModal.loading ? "not-allowed" : "pointer", transition: "0.2s" }}
                  >
                    {cancelModal.loading ? "Đang gửi yêu cầu..." : "Gửi yêu cầu hoàn vé"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Đánh Giá */}
      {reviewModal.show && reviewModal.booking && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "var(--bg-card)", padding: 32, borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>

            {reviewModal.success ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "#16a34a", marginBottom: 8 }}>Cảm ơn bạn đã đánh giá!</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Phản hồi của bạn giúp chúng tôi cải thiện dịch vụ mỗi ngày.</p>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, color: "var(--text-main)" }}>Đánh giá chuyến đi</h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
                  {reviewModal.booking.origin} → {reviewModal.booking.destination} &nbsp;•&nbsp;
                  {reviewModal.booking.vehicleType === "PLANE" ? "✈️" : reviewModal.booking.vehicleType === "BUS" ? "🚌" : "🚂"} {reviewModal.booking.providerName}
                </p>

                {/* Star Rating */}
                <div style={{ marginBottom: 20, background: "var(--bg-input)", padding: 16, borderRadius: 12, border: "1px solid var(--border-main)" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "var(--text-main)" }}>Chọn số sao <span style={{ color: "#ef4444" }}>*</span></div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <span
                        key={star}
                        onClick={() => setReviewModal(prev => ({ ...prev, rating: star }))}
                        onMouseEnter={() => setReviewModal(prev => ({ ...prev, hovered: star }))}
                        onMouseLeave={() => setReviewModal(prev => ({ ...prev, hovered: 0 }))}
                        style={{
                          fontSize: 40,
                          cursor: "pointer",
                          color: star <= (reviewModal.hovered || reviewModal.rating) ? "#f59e0b" : "var(--border-main)",
                          transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                          transform: star <= (reviewModal.hovered || reviewModal.rating) ? "scale(1.2)" : "scale(1)",
                          display: "inline-block",
                          userSelect: "none"
                        }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  {reviewModal.rating > 0 && (
                    <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: "#f59e0b", textAlign: "center" }}>
                      {["", "Tệ", "Không hài lòng", "Bình thường", "Tốt", "Tuyệt vời"][reviewModal.rating]}
                    </div>
                  )}
                </div>

                {/* Comment */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "var(--text-main)" }}>Nhận xét (tùy chọn)</div>
                  <textarea
                    value={reviewModal.comment}
                    onChange={e => setReviewModal(prev => ({ ...prev, comment: e.target.value }))}
                    placeholder="Chia sẻ trải nghiệm của bạn về dịch vụ, ghế ngồi, đúng giờ..."
                    rows={4}
                    maxLength={500}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border-main)", background: "var(--bg-input)", color: "var(--text-main)", fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
                  />
                  <div style={{ textAlign: "right", fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{reviewModal.comment.length}/500</div>
                </div>

                {/* Error */}
                {reviewModal.error && (
                  <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
                    ⚠️ {reviewModal.error}
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button
                    onClick={closeReviewModal}
                    disabled={reviewModal.loading}
                    style={{ padding: "11px 22px", borderRadius: 10, border: "1px solid var(--border-main)", background: "var(--bg-input)", fontWeight: 700, cursor: "pointer", color: "var(--text-main)", fontSize: 14 }}
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSubmitReview}
                    disabled={reviewModal.loading}
                    style={{ padding: "11px 26px", borderRadius: 10, border: "none", background: reviewModal.loading ? "#a5b4fc" : "#6366f1", color: "#fff", fontWeight: 700, cursor: reviewModal.loading ? "not-allowed" : "pointer", fontSize: 14, boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)" }}
                  >
                    {reviewModal.loading ? "Đang gửi..." : "Gửi Đánh Giá"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Mã vé QR */}
      {qrModal.show && qrModal.booking && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: 20 }}>
          <div style={{ background: "var(--bg-card)", padding: 32, borderRadius: 20, width: "100%", maxWidth: 400, boxShadow: "0 20px 40px rgba(0,0,0,0.3)", textAlign: "center", position: "relative" }}>
            <button 
              onClick={() => setQrModal({ show: false, booking: null })}
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "var(--text-muted)" }}
            >
              ×
            </button>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: "var(--text-heading)" }}>Mã vé của bạn</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
              Xuất trình mã này tại quầy để làm thủ tục check-in.
            </p>
            
            <div style={{ background: "#fff", padding: 20, borderRadius: 16, display: "inline-block", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", marginBottom: 24 }}>
              <QRCodeCanvas 
                value={JSON.stringify({
                  bookingId: qrModal.booking.id,
                  type: qrModal.booking.vehicleType,
                  user: qrModal.booking.userEmail,
                  code: `TICKET-${qrModal.booking.id}-${qrModal.booking.bookingDate}`
                })}
                size={220}
                level="H"
                includeMargin={true}
              />
            </div>

            <div style={{ background: "var(--bg-input)", padding: 16, borderRadius: 12, textAlign: "left", marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Mã đặt chỗ:</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>#{qrModal.booking.id}</div>
              
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Hành trình:</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{qrModal.booking.origin} → {qrModal.booking.destination}</div>
            </div>

            <button
              onClick={() => setQrModal({ show: false, booking: null })}
              style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15 }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.show && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: 20 }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, maxWidth: 420, width: "100%", border: "1px solid var(--border-main)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(99, 102, 241, 0.15)", border: "1px solid rgba(99, 102, 241, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto", color: "#6366f1" }}>
              <FaPlane fontSize={26} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 8 }}>{confirmModal.title}</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>{confirmModal.message}</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setConfirmModal({ show: false, title: "", message: "", onConfirm: null })}
                style={{ flex: 1, padding: "11px 16px", borderRadius: 10, border: "1px solid var(--border-main)", background: "var(--bg-input)", color: "var(--text-main)", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
              >
                Hủy bỏ
              </button>
              <button
                onClick={async () => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal({ show: false, title: "", message: "", onConfirm: null });
                  if (action) await action();
                }}
                style={{ flex: 1, padding: "11px 16px", borderRadius: 10, border: "none", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, boxShadow: "0 4px 12px rgba(79, 124, 255, 0.3)" }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Canvas Fireworks overlay */}
      {showFireworks && (
        <FireworksCanvas />
      )}

      {/* Auth Modal */}
      {isAuthOpen && (
        <Auth
          isOpen={isAuthOpen}
          onClose={() => {
            setIsAuthOpen(false);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
};

// Canvas Fireworks Component
const FireworksCanvas = () => {
  useEffect(() => {
    const canvas = document.getElementById("fireworks-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles = [];
    const colors = ["#ff0055", "#4f7cff", "#00ffcc", "#ffcc00", "#ff6600", "#cc00ff", "#ffffff"];

    const createFirework = (x, y) => {
      const count = 80;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = Math.random() * 6 + 2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 3 + 2,
          decay: Math.random() * 0.015 + 0.01
        });
      }
    };

    // Burst initial fireworks at random spots
    createFirework(width * 0.3, height * 0.4);
    createFirework(width * 0.7, height * 0.35);
    createFirework(width * 0.5, height * 0.5);

    let timer = setInterval(() => {
      createFirework(Math.random() * width, Math.random() * (height * 0.6));
    }, 400);

    let animId;
    const render = () => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      clearInterval(timer);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      id="fireworks-canvas"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999
      }}
    />
  );
};


export default MyBookings;
