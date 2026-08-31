import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

/**
 * Trang xác thực email độc lập. Luồng đăng ký bình thường nay xác thực ngay trong modal
 * Auth (không rời trang, xem Auth.jsx step 3); trang này giữ lại cho các đường dẫn cũ.
 */
const VerifyEmail = () => {
    const { t } = useLanguage();
    const { loginSuccess } = useAuth();
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const navigate = useNavigate();
    const location = useLocation();
    const email = new URLSearchParams(location.search).get("email");

    useEffect(() => {
        if (!email) {
            navigate("/auth");
        }
    }, [email, navigate]);

    const handleVerify = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: "", text: "" });

        try {
            const response = await axios.post(`/api/auth/verify-email?email=${email}&code=${otp}`);
            setMessage({ type: "success", text: t.vfySuccess });
            
  
            // Phải đi qua loginSuccess: AuthContext đọc localStorage theo khoá
            // "authToken"/"authUser", ghi tay vào "token"/"user" như trước là xác thực
            // xong vẫn ở trạng thái chưa đăng nhập.
            if (response.data.token) {
                loginSuccess(response.data);
            }

            setTimeout(() => {
                navigate("/");
            }, 2000);
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.message || t.vfyInvalidCode });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ 
            minHeight: "100vh", 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            background: "linear-gradient(135deg, #f0fff4 0%, #dcfce7 100%)",
            padding: "20px"
        }}>
            <div style={{ 
                background: "var(--bg-card)", 
                padding: "40px", 
                borderRadius: "24px", 
                boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
                width: "100%",
                maxWidth: "450px",
                textAlign: "center"
            }}>
                <div style={{ fontSize: "50px", marginBottom: "20px" }}>📧</div>
                <h2 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "10px", color: "var(--text-heading)" }}>
                    {t.vfyTitle}
                </h2>
                <p style={{ color: "var(--text-secondary)", marginBottom: "30px", fontSize: "14px" }}>
                    {t.vfySentTo} <br/>
                    <strong style={{ color: "#20c997" }}>{email}</strong>
                </p>

                {message.text && (
                    <div style={{ 
                        padding: "12px 16px", 
                        borderRadius: "12px", 
                        marginBottom: "20px",
                        fontSize: "14px",
                        fontWeight: "500",
                        backgroundColor: message.type === "success" ? "#dcfce7" : "#fee2e2",
                        color: message.type === "success" ? "#16a34a" : "#dc2626",
                        border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}`
                    }}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleVerify}>
                    <div style={{ marginBottom: "25px" }}>
                        <label style={{ display: "block", marginBottom: "12px", fontWeight: "600", color: "#374151" }}>{t.vfyCodeLabel}</label>
                        <input 
                            type="text"
                            required
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="000000"
                            style={{
                                width: "100%",
                                padding: "16px",
                                borderRadius: "16px",
                                border: "2px solid #e0e0e0",
                                outline: "none",
                                fontSize: "24px",
                                textAlign: "center",
                                letterSpacing: "10px",
                                fontWeight: "700",
                                transition: "border-color 0.2s"
                            }}
                            onFocus={(e) => e.target.style.borderColor = "#20c997"}
                            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
                        />
                    </div>
                    <button 
                        disabled={loading}
                        type="submit"
                        style={{
                            width: "100%",
                            padding: "16px",
                            borderRadius: "16px",
                            border: "none",
                            background: "#20c997",
                            color: "#fff",
                            fontWeight: "700",
                            cursor: loading ? "not-allowed" : "pointer",
                            opacity: loading ? 0.7 : 1,
                            fontSize: "16px",
                            boxShadow: "0 4px 12px rgba(32, 201, 151, 0.3)"
                        }}
                    >
                        {loading ? t.vfyVerifying : t.vfyActivate}
                    </button>
                    
                    <p style={{ marginTop: "25px", fontSize: "14px", color: "var(--text-muted)" }}>
                        {t.vfyNotReceived} <span style={{ color: "#20c997", cursor: "pointer", fontWeight: "600" }}>{t.vfyResend}</span>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default VerifyEmail;
