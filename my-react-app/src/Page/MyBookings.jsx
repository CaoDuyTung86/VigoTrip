import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../LayOut/Header";
import Sidebar from "../components/Sidebar";
import { useLanguage } from "../context/LanguageContext";
import { TbTrain, TbBus } from "react-icons/tb";
import { FaRegStar, FaPlane, FaQrcode } from "react-icons/fa";
import { QRCodeCanvas } from "qrcode.react";

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { t } = useLanguage();

  const location = useLocation();
  const navigate = useNavigate();
  const [paymentMsg, setPaymentMsg] = useState(null);


  const [cancelModal, setCancelModal] = useState({ show: false, booking: null, loading: false, error: null, reason: "", success: false });
  const [reviewModal, setReviewModal] = useState({ show: false, booking: null, rating: 0, hovered: 0, comment: "", loading: false, error: null, success: false });
  const [qrModal, setQrModal] = useState({ show: false, booking: null });


  const fetchBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const res = await axios.get("/api/bookings", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
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
    if (payment === "success") {
      setPaymentMsg("Thanh toán thành công! Vé của bạn đã được xác nhận.");
      navigate("/my-bookings", { replace: true });
      setTimeout(() => setPaymentMsg(null), 8000);
    } else if (payment === "failed") {
      setPaymentMsg("Thanh toán thất bại hoặc đã bị hủy.");
      navigate("/my-bookings", { replace: true });
      setTimeout(() => setPaymentMsg(null), 8000);
    }
  }, [location, navigate]);

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
    try {
      setReviewModal(prev => ({ ...prev, loading: true, error: null }));
      const token = localStorage.getItem("authToken");
      await axios.post("/api/reviews", {
        bookingId: reviewModal.booking.id,
        rating: reviewModal.rating,
        comment: reviewModal.comment
      }, { headers: { Authorization: `Bearer ${token}` } });
      setReviewModal(prev => ({ ...prev, loading: false, success: true }));

      setTimeout(() => closeReviewModal(), 1500);
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

            {paymentMsg && (
              <div style={{ padding: 16, background: paymentMsg.includes('thành công') ? "#dcfce7" : "#fee2e2", color: paymentMsg.includes('thành công') ? "#16a34a" : "#dc2626", borderRadius: 8, marginBottom: 20, fontWeight: 700, border: `1px solid ${paymentMsg.includes('thành công') ? "#bbf7d0" : "#fecaca"}`, display: "flex", alignItems: "center", gap: 8 }}>
                {paymentMsg.includes('thành công') ? "🎉" : "⚠️"}
                {paymentMsg}
              </div>
            )}

            {error && <div style={{ padding: 16, background: "#fee2e2", color: "#dc2626", borderRadius: 8, marginBottom: 20 }}>{error}</div>}

            {loading ? (
              <p style={{ color: "var(--text-secondary)" }}>Đang tải danh sách vé...</p>
            ) : bookings.length === 0 ? (
              <div style={{ background: "var(--bg-card)", padding: 40, borderRadius: 12, textAlign: "center", color: "var(--text-secondary)", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                {t.noBookings}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {bookings.map(bk => {
                  const statusBg = bk.status === "PAID" || bk.status === "CONFIRMED" ? "#dcfce7" : bk.status === "COMPLETED" ? "#e0e7ff" : bk.status === "CANCELLED" ? "#f3f4f6" : "#fef9c3";
                  const statusColor = bk.status === "PAID" || bk.status === "CONFIRMED" ? "#16a34a" : bk.status === "COMPLETED" ? "#4f46e5" : bk.status === "CANCELLED" ? "#6b7280" : "#ca8a04";
                  const statusText = bk.status === "PAID" ? "Đã thanh toán" : bk.status === "CONFIRMED" ? "Đã xác nhận" : bk.status === "COMPLETED" ? "Đã hoàn thành" : bk.status === "CANCELLED" ? "Đã hủy/Hoàn" : "Chờ thanh toán";
                  const hasPendingRefund = bk.refundStatus === "PENDING";
                  const hasRejectedRefund = bk.refundStatus === "REJECTED";

                  return (
                    <div key={bk.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 12, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>

                      {/* Left side info */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                          <span style={{ background: statusBg, color: statusColor, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                            {statusText}
                          </span>
                          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>{t.ticketCode}: #{bk.id}</span>
                          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>• {t.bookedAt}: {new Date(bk.bookingDate).toLocaleString("vi-VN")}</span>
                        </div>

                        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                          {bk.origin} <span style={{ color: "var(--text-muted)", margin: "0 6px" }}>→</span> {bk.destination}
                        </div>

                        <div style={{ fontSize: 14, color: "#444", marginBottom: 8 }}>
                          {bk.vehicleType === "PLANE" ? <> <FaPlane /> ${t.flight}</> : bk.vehicleType === "BUS" ? <><TbBus /> ${t.bus}</> : <><TbTrain /> {t.train}</>}
                          <span style={{ marginLeft: 6, color: "var(--text-muted)", fontWeight: 600 }}>({bk.providerName})</span>
                        </div>

                        <div style={{ display: "flex", gap: 24, fontSize: 13, color: "var(--text-secondary)" }}>
                          <div><b>Khởi hành:</b> {new Date(bk.departureTime).toLocaleString("vi-VN")}</div>
                          <div><b>Ghế:</b> {bk.seatNumbers ? bk.seatNumbers.join(", ") : "N/A"}</div>
                        </div>

                        {/* Hiển thị tên hành khách */}
                        {bk.ticketDetails && bk.ticketDetails.length > 0 && (
                          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                            <b>👤 Hành khách:</b>{" "}
                            {bk.ticketDetails.map((td, idx) => (
                              <span key={idx}>
                                {td.passengerName || "N/A"}
                                <span style={{ color: "var(--text-muted)", fontSize: 11 }}> ({td.seatNumber})</span>
                                {idx < bk.ticketDetails.length - 1 ? ", " : ""}
                              </span>
                            ))}
                          </div>
                        )}

                        {bk.additionalServices && bk.additionalServices.length > 0 && (
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                            <b>Dịch vụ:</b> {bk.additionalServices.join(", ")}
                          </div>
                        )}

                        {bk.status === "CANCELLED" && bk.refundAmount > 0 && (
                          <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 700, marginTop: 8 }}>
                            {t.refundedAmount}: {bk.refundAmount.toLocaleString("vi-VN")} đ
                          </div>
                        )}

                        {/* Badge trạng thái yêu cầu hoàn tiền */}
                        {hasPendingRefund && (
                          <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef3c7", color: "#92400e", borderRadius: 6, fontSize: 13, fontWeight: 700, display: "inline-block", border: "1px solid #fde68a" }}>
                            ⏳ Đang chờ admin duyệt yêu cầu hoàn vé
                          </div>
                        )}
                        {hasRejectedRefund && bk.status !== "CANCELLED" && (
                          <div style={{ marginTop: 8, padding: "6px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 6, fontSize: 13, fontWeight: 700, display: "inline-block", border: "1px solid #fecaca" }}>
                            ❌ Yêu cầu hoàn tiền bị từ chối
                          </div>
                        )}
                      </div>

                      {/* Right side Price & Actions */}
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#ff6b00", marginBottom: 4 }}>
                          {(bk.totalPrice || 0).toLocaleString("vi-VN")} đ
                        </div>
                        <div style={{ fontSize: 13, color: "#16a34a", fontWeight: "bold", marginBottom: 12 }}>
                          (Đã áp dụng ưu đãi thành viên)
                        </div>

                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          {(bk.status === "PAID" || bk.status === "CONFIRMED") && (
                            <button
                              onClick={() => setQrModal({ show: true, booking: bk })}
                              style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--primary)", background: "var(--primary)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, transition: "0.2s", display: "flex", alignItems: "center", gap: 6 }}
                            >
                              <FaQrcode /> Mã vé QR
                            </button>
                          )}

                          {bk.status === "CONFIRMED" && (
                            <button
                              onClick={async () => {
                                if (window.confirm("Bạn xác nhận chuyến đi này đã hoàn thành? Hệ thống sẽ gửi thư khảo sát qua Email.")) {
                                  try {
                                    setLoading(true);
                                    const token = localStorage.getItem("authToken");
                                    await axios.put(`/api/bookings/${bk.id}/complete`, {}, { headers: { Authorization: `Bearer ${token}` } });
                                    alert("Chuyến đi đã hoàn thành. Cảm ơn bạn!");
                                    await fetchBookings();
                                  } catch (e) {
                                    alert("Có lỗi xảy ra: " + (e.response?.data?.message || e.message));
                                  } finally {
                                    setLoading(false);
                                  }
                                }
                              }}
                              style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#4f46e5", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, transition: "0.2s" }}
                            >
                              Hoàn thành & Điểm Đánh Giá
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
                              style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#ff6b00", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, transition: "0.2s" }}
                            >
                              Thanh toán ngay
                            </button>
                          )}

                          {bk.status !== "CANCELLED" && bk.status !== "COMPLETED" && !hasPendingRefund && (
                            <button
                              onClick={() => openCancelModal(bk)}
                              style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ef4444", background: "var(--bg-card)", color: "#ef4444", fontWeight: 700, cursor: "pointer", fontSize: 13, transition: "0.2s" }}
                              onMouseOver={e => { e.target.style.background = "#fee2e2" }}
                              onMouseOut={e => { e.target.style.background = "var(--bg-card)" }}
                            >
                              Hủy / Hoàn vé
                            </button>
                          )}

                          {bk.status === "COMPLETED" && (
                            <button
                              onClick={() => openReviewModal(bk)}
                              style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #4f46e5", background: "var(--bg-accent)", color: "#4f46e5", fontWeight: 700, cursor: "pointer", fontSize: 13, transition: "0.2s" }}
                              onMouseOver={e => { e.target.style.background = "#e0e7ff" }}
                              onMouseOut={e => { e.target.style.background = "#eff6ff" }}
                            >
                              Gửi Đánh Giá <FaRegStar />
                            </button>
                          )}
                        </div>
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

              <div style={{ padding: 16, borderRadius: 8, background: refundInfo.canRefund ? "#eff6ff" : "#fee2e2", border: `1px solid ${refundInfo.canRefund ? "#bfdbfe" : "#fca5a5"}`, marginBottom: 24 }}>
                <div style={{ fontWeight: 700, color: refundInfo.canRefund ? "#1e40af" : "#991b1b", marginBottom: 8 }}>
                  Chính sách áp dụng:
                </div>
                <div style={{ fontSize: 13, color: refundInfo.canRefund ? "#1e3a8a" : "#7f1d1d", lineHeight: 1.5 }}>
                  {refundInfo.text}
                </div>

                {refundInfo.canRefund && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${refundInfo.canRefund ? "#bfdbfe" : "#fca5a5"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                      <span>Phí phạt ({refundInfo.penaltyPercent}%):</span>
                      <span>-{penaltyAmount.toLocaleString("vi-VN")} đ</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, marginTop: 8 }}>
                      <span>Số tiền sẽ nhận lại:</span>
                      <span style={{ color: "#16a34a" }}>{expectedRefund.toLocaleString("vi-VN")} đ</span>
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
                <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: "var(--text-heading)" }}>Đánh giá chuyến đi</h3>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
                  {reviewModal.booking.origin} → {reviewModal.booking.destination} &nbsp;•&nbsp;
                  {reviewModal.booking.vehicleType === "PLANE" ? "✈️" : reviewModal.booking.vehicleType === "BUS" ? "🚌" : "🚂"} {reviewModal.booking.providerName}
                </p>

                {/* Star Rating */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#374151" }}>Chọn số sao <span style={{ color: "#ef4444" }}>*</span></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <span
                        key={star}
                        onClick={() => setReviewModal(prev => ({ ...prev, rating: star }))}
                        onMouseEnter={() => setReviewModal(prev => ({ ...prev, hovered: star }))}
                        onMouseLeave={() => setReviewModal(prev => ({ ...prev, hovered: 0 }))}
                        style={{
                          fontSize: 38,
                          cursor: "pointer",
                          color: star <= (reviewModal.hovered || reviewModal.rating) ? "#f59e0b" : "#d1d5db",
                          transition: "color 0.15s, transform 0.1s",
                          transform: star <= (reviewModal.hovered || reviewModal.rating) ? "scale(1.15)" : "scale(1)",
                          display: "inline-block",
                          userSelect: "none"
                        }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  {reviewModal.rating > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                      {["", "Tệ 😞", "Không hài lòng 😐", "Ổn 🙂", "Tốt 😊", "Tuyệt vời! 🤩"][reviewModal.rating]}
                    </div>
                  )}
                </div>

                {/* Comment */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "#374151" }}>Nhận xét (tùy chọn)</div>
                  <textarea
                    value={reviewModal.comment}
                    onChange={e => setReviewModal(prev => ({ ...prev, comment: e.target.value }))}
                    placeholder="Chia sẻ trải nghiệm của bạn về chuyến đi này..."
                    rows={4}
                    maxLength={500}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }}
                  />
                  <div style={{ textAlign: "right", fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{reviewModal.comment.length}/500</div>
                </div>

                {/* Error */}
                {reviewModal.error && (
                  <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#dc2626", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
                    ⚠️ {reviewModal.error}
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button
                    onClick={closeReviewModal}
                    disabled={reviewModal.loading}
                    style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-card)", fontWeight: 700, cursor: "pointer", color: "var(--text-secondary)", fontSize: 14 }}
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSubmitReview}
                    disabled={reviewModal.loading}
                    style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: reviewModal.loading ? "#a5b4fc" : "#4f46e5", color: "#fff", fontWeight: 700, cursor: reviewModal.loading ? "not-allowed" : "pointer", fontSize: 14, transition: "0.2s" }}
                  >
                    {reviewModal.loading ? "Đang gửi..." : "Gửi Đánh Giá ⭐️"}
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
    </div>
  );
};


export default MyBookings;
