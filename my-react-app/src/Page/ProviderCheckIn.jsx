import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import axios from "axios";
import Header from "../LayOut/Header";
import Sidebar from "../components/Sidebar";
import { useLanguage } from "../context/LanguageContext";
import { FaSearch, FaHistory, FaCheckCircle, FaImage, FaCamera, FaSync } from "react-icons/fa";

const ProviderCheckIn = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [isScanning, setIsScanning] = useState(false);
  const [manualId, setManualId] = useState("");
  const [recentCheckIns, setRecentCheckIns] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchRecentCheckIns();

    try {
      scannerRef.current = new Html5Qrcode("reader");
      // Lấy danh sách camera ngay khi load trang
      Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Mặc định chọn camera sau nếu có, không thì lấy cái đầu tiên
          const back = devices.find(c =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('sau') ||
            c.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(back ? back.id : devices[0].id);
        }
      }).catch(err => console.error("Error getting cameras:", err));
    } catch (err) {
      console.error("Scanner init error:", err);
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => { });
      }
    };
  }, []);

  const fetchRecentCheckIns = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) return;
      const res = await axios.get("/api/bookings/recent-checkins", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && Array.isArray(res.data)) {
        console.log("Fetched recent check-ins:", res.data.length);
        setRecentCheckIns(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch recent check-ins", err);
    }
  };

  const startScanner = async () => {
    if (!scannerRef.current || isScanning) return;

    // Phát hiện PWA standalone (thêm vào màn hình chính)
    const isPWA = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isPWA) {
      setMessage({
        text: t.chkCameraPwaError,
        type: "error"
      });
      return;
    }

    try {
      setIsScanning(true);
      setMessage({ text: "", type: "" });

      // Nếu đã có danh sách camera, dùng cái được chọn
      if (selectedCameraId) {
        await scannerRef.current.start(
          selectedCameraId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScanSuccess
        );
      } else {
        // Fallback nếu chưa lấy được danh sách
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          let targetId = devices[0].id;
          const back = devices.find(c =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('sau') ||
            c.label.toLowerCase().includes('environment')
          );
          if (back) targetId = back.id;

          setSelectedCameraId(targetId);
          await scannerRef.current.start(
            targetId,
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess
          );
        } else {
          throw new Error(t.chkNoCamera);
        }
      }
    } catch (err) {
      console.error("Scanner start error:", err);

      try {
        await scannerRef.current.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScanSuccess
        );
      } catch (fallbackErr) {
        console.error("Scanner fallback error:", fallbackErr);
        setIsScanning(false);
        setMessage({ text: t.chkCameraFail, type: "error" });
      }
    }
  };

  const stopScanner = async () => {
    if (!scannerRef.current) return;

    try {
      await scannerRef.current.stop();
      setIsScanning(false);
    } catch (err) {
      console.error("Scanner stop error:", err);
      setIsScanning(false);
    }
  };

  const onScanSuccess = (result) => {
    handleCheckIn(result);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !scannerRef.current) return;

    try {
      setLoading(true);
      setMessage({ text: t.chkAnalyzingImage, type: "" });

      if (isScanning) {
        await stopScanner();
      }

      const result = await scannerRef.current.scanFile(file, true);
      handleCheckIn(result);
    } catch {
      setMessage({ text: t.chkQrNotFound, type: "error" });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCheckIn = async (qrData) => {
    if (!qrData) return;
    console.log("Bắt đầu check-in cho dữ liệu:", qrData);

    let targetBookingId = "";

    try {
      setLoading(true);
      setMessage({ text: t.chkVerifying, type: "" });

      try {
        const data = JSON.parse(qrData);
        targetBookingId = typeof data === 'object' && data !== null ? data.bookingId : data;
      } catch {
        targetBookingId = qrData;
      }

      if (typeof targetBookingId === 'string') {
        targetBookingId = targetBookingId.replace(/[#\s]/g, '').trim();
      }

      if (!targetBookingId) {
        throw new Error(t.chkInvalidTicket);
      }

      console.log("Đang gửi request check-in cho ID:", targetBookingId);
      const token = localStorage.getItem("authToken");

      const response = await axios.post(`/api/bookings/${targetBookingId}/check-in`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 6000 // Giảm xuống 6s để người dùng đỡ chờ lâu
      });

      console.log("Check-in thành công:", response.data);
      setMessage({ text: t.chkCheckInSuccess.replace("{id}", targetBookingId), type: "success" });
      setManualId("");
      fetchRecentCheckIns();
    } catch (err) {
      console.error("Lỗi check-in:", err);
      const errorMsg = err.response?.data?.message || err.message || t.chkProcessingError;

      if (errorMsg.includes("đã được check-in vào lúc")) {
        const parts = errorMsg.split("vào lúc ");
        let displayMsg = errorMsg;
        if (parts.length === 2) {
          try {
            const dateObj = new Date(parts[1]);
            const formattedTime = dateObj.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' });
            const formattedDate = dateObj.toLocaleDateString("vi-VN");
            displayMsg = t.chkAlreadyCheckedIn.replace("{time}", formattedTime).replace("{date}", formattedDate);
          } catch {
            displayMsg = errorMsg.replace("Vé này ", "");
          }
        } else {
          displayMsg = errorMsg.replace("Vé này ", "");
        }

        setMessage({ text: t.chkInfoMessage.replace("{id}", targetBookingId).replace("{msg}", displayMsg), type: "success" });
        setTimeout(() => fetchRecentCheckIns(), 100); 
      } else {
        setMessage({ text: t.chkErrorPrefix.replace("{msg}", errorMsg), type: "error" });
      }
    } finally {
      console.log("Kết thúc xử lý check-in");
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-main)" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Header />
        <div style={{ padding: "100px 20px 40px", flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "25px", maxWidth: "1100px", width: "100%" }}>

            <div style={{ background: "var(--bg-card)", padding: 25, borderRadius: 24, boxShadow: "var(--shadow-card)", textAlign: "center" }}>
              <h2 style={{ marginBottom: 15, color: "var(--text-heading)", fontSize: "20px" }}>{t.chkTitle}</h2>

              <div style={{ display: "flex", gap: "8px", marginBottom: 20 }}>
                <input
                  type="text"
                  placeholder={t.chkTicketPlaceholder}
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid var(--border-input)", background: "var(--bg-main)", color: "var(--text-main)" }}
                />
                <button
                  onClick={() => handleCheckIn(manualId)}
                  disabled={!manualId || loading}
                  style={{ width: "50px", borderRadius: 12, border: "none", background: "var(--primary)", color: "white", cursor: "pointer" }}
                >
                  {loading ? <FaSync className="fa-spin" /> : <FaSearch />}
                </button>
              </div>

              <div style={{ position: "relative", width: "100%", minHeight: "250px", marginBottom: 20 }}>
                {/* Vùng chứa camera, để trống hoàn toàn để tránh React và thư viện quét mã đánh nhau giành quyền điều khiển DOM */}
                <div id="reader" style={{ width: "100%", borderRadius: 18, overflow: "hidden", backgroundColor: "#111", minHeight: "250px", border: "4px solid var(--bg-main)" }}></div>

                {/* Lớp overlay hướng dẫn đè lên trên khi chưa quét */}
                {!isScanning && (
                  <div style={{
                    position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    color: "#888", gap: "12px", pointerEvents: "none", backgroundColor: "#111", borderRadius: 18
                  }}>
                    <FaCamera style={{ fontSize: "40px", opacity: 0.3 }} />
                    <span style={{ fontSize: "14px" }}>{t.chkScanHint1}</span>
                    <span style={{ fontSize: "11px", opacity: 0.5 }}>{t.chkScanHint2}</span>
                  </div>
                )}
              </div>

              {cameras.length > 1 && (
                <div style={{ marginBottom: 15 }}>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    disabled={isScanning}
                    style={{
                      width: "100%", padding: "10px", borderRadius: 12,
                      border: "1px solid var(--border-input)", background: "var(--bg-main)",
                      color: "var(--text-main)", fontSize: "13px"
                    }}
                  >
                    {cameras.map(cam => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || t.chkCameraLabel.replace("{id}", cam.id.substring(0, 5))}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: 20 }}>
                <button
                  onClick={isScanning ? stopScanner : startScanner}
                  style={{
                    padding: "12px", borderRadius: 12, border: "none",
                    background: isScanning ? "#fee2e2" : "#eef2ff",
                    color: isScanning ? "#ef4444" : "var(--primary)",
                    fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                  }}
                >
                  <FaCamera /> {isScanning ? t.chkStopCam : t.chkStartCam}
                </button>

                <button
                  onClick={() => fileInputRef.current.click()}
                  style={{
                    padding: "12px", borderRadius: 12, border: "none",
                    background: "#f0fdf4", color: "#16a34a",
                    fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                  }}
                >
                  <FaImage /> {t.chkScanImage}
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: "none" }} />
              </div>

              {message.text && (
                <div style={{
                  padding: "14px", borderRadius: 14,
                  background: message.type === "success" ? "#dcfce7" : message.type === "error" ? "#fee2e2" : "#f3f4f6",
                  color: message.type === "success" ? "#15803d" : message.type === "error" ? "#b91c1c" : "#4b5563",
                  fontWeight: 600, border: "1px solid rgba(0,0,0,0.05)"
                }}>
                  {message.text}
                </div>
              )}
            </div>

            <div style={{ background: "var(--bg-card)", padding: 25, borderRadius: 24, boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column" }}>
              <h3 style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: "10px", color: "var(--text-heading)", fontSize: "18px" }}>
                <FaHistory style={{ color: "var(--primary)" }} /> {t.chkScanHistory}
              </h3>

              <div style={{ flex: 1, overflowY: "auto", maxHeight: "400px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {recentCheckIns.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", border: "2px dashed var(--border-input)", borderRadius: 18 }}>
                    {t.chkNoScans}
                  </div>
                ) : (
                  recentCheckIns.map((item, index) => (
                    <div 
                      key={item.id || index} 
                      onClick={() => {
                        console.log("Click vào vé:", item.id);
                        setSelectedTicket(item);
                      }}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 16px", borderRadius: 14, 
                        background: index === 0 ? "var(--bg-main)" : "transparent",
                        border: "1px solid var(--border-input)",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-main)"}
                      onMouseLeave={(e) => {
                        if (index !== 0) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-main)" }}>{t.ticketCode}: #{item.id}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {new Date(item.checkInDate).toLocaleTimeString()}
                        </div>
                      </div>
                      <div style={{ color: "#16a34a", fontWeight: 700, fontSize: "12px" }}>
                        <FaCheckCircle /> OK
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Modal chi tiết vé */}
      {selectedTicket && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: "20px"
        }} onClick={() => setSelectedTicket(null)}>
          <div style={{
            background: "var(--bg-card)", padding: "30px", borderRadius: "24px",
            maxWidth: "500px", width: "100%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            position: "relative"
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: "20px", color: "var(--text-heading)", borderBottom: "1px solid var(--border-input)", paddingBottom: "10px" }}>
              {t.chkTicketDetail.replace("{id}", selectedTicket.id)}
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.chkRouteLabel}</label>
                  <div style={{ fontWeight: 600 }}>{selectedTicket.origin || "N/A"} → {selectedTicket.destination || "N/A"}</div>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.chkVehicleTypeLabel}</label>
                  <div style={{ fontWeight: 600 }}>{selectedTicket.vehicleType || "N/A"}</div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.chkPassengerSeatLabel}</label>
                <div style={{ marginTop: "5px", display: "flex", flexDirection: "column", gap: "5px" }}>
                  {selectedTicket.ticketDetails && selectedTicket.ticketDetails.length > 0 ? (
                    selectedTicket.ticketDetails.map((td, idx) => (
                      <div key={idx} style={{ background: "var(--bg-main)", padding: "8px 12px", borderRadius: "10px", display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                        <span>{td.passengerName || t.chkWalkInGuest}</span>
                        <span style={{ color: "var(--primary)", fontWeight: 700 }}>{t.seatPrefix} {td.seatNumber || "N/A"}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>{t.chkNoSeatDetails}</div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.chkCheckInAtLabel}</label>
                  <div style={{ fontWeight: 600 }}>
                    {selectedTicket.checkInDate ? new Date(selectedTicket.checkInDate).toLocaleString() : "N/A"}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.status}</label>
                  <div style={{ color: "#16a34a", fontWeight: 700 }}>{t.chkVerified}</div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setSelectedTicket(null)}
              style={{
                marginTop: "30px", width: "100%", padding: "12px", borderRadius: "12px",
                border: "none", background: "var(--primary)", color: "white", fontWeight: 600,
                cursor: "pointer"
              }}
            >
              {t.qrCloseBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderCheckIn;
