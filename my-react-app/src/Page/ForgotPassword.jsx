// @ts-check
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

const ForgotPassword = () => {
    const { t } = useLanguage();
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [step, setStep] = useState(1); 
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const navigate = useNavigate();

    const handleRequestOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: "", text: "" });

        try {
            await axios.post("/api/auth/forgot-password", { email });
            setStep(2);
            // Backend nay LUÔN trả thành công, kể cả khi email không tồn tại — nếu phân biệt
            // thì form này thành công cụ dò xem email nào đã đăng ký. Vì vậy câu thông báo
            // cũng phải trung tính ("nếu email này có tài khoản thì mã đã được gửi"), và
            // nhánh "không tìm thấy tài khoản" ở đây không còn xảy ra nữa.
            setMessage({ type: "success", text: t.fgpOtpSent });
        } catch {
            setMessage({ type: "error", text: t.authXConnFailed });
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setMessage({ type: "error", text: t.fgpPwdMismatch });
            return;
        }

        setLoading(true);
        setMessage({ type: "", text: "" });

        try {
            await axios.post("/api/auth/reset-password", {
                email,
                newPassword,
                otpCode: otp
            });
            setMessage({ type: "success", text: t.fgpResetSuccess });
            // Lưu email vào sessionStorage để trang /auth tự điền sẵn, tránh bắt người dùng
            // gõ lại email họ vừa nhập ở bước trên (Auth.jsx đọc key "tempEmail" lúc mount).
            sessionStorage.setItem("tempEmail", email);
            setTimeout(() => {
                navigate("/auth");
            }, 2000);
        } catch (err) {
            // Backend gộp "sai mã" / "hết hạn" / "email không tồn tại" thành một câu duy nhất.
            setMessage({ type: "error", text: err.response?.data?.message || t.fgpOtpInvalid });
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
            background: "var(--bg-main)",
            padding: "20px"
        }}>
            <div style={{ 
                background: "var(--bg-card)", 
                padding: "40px", 
                borderRadius: "24px", 
                boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
                width: "100%",
                maxWidth: "450px"
            }}>
                <h2 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "10px", color: "var(--text-heading)", textAlign: "center" }}>
                    {step === 1 ? t.fgpTitle : t.fgpResetTitle}
                </h2>
                <p style={{ color: "var(--text-secondary)", textAlign: "center", marginBottom: "30px", fontSize: "14px" }}>
                    {step === 1
                        ? t.fgpStep1Desc
                        : t.fgpStep2Desc}
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

                {step === 1 ? (
                    <form onSubmit={handleRequestOTP}>
                        <div style={{ marginBottom: "25px" }}>
                            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "var(--text-heading)" }}>{t.fgpEmailLabel}</label>
                            <input 
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="example@gmail.com"
                                style={{
                                    width: "100%",
                                    padding: "14px",
                                    borderRadius: "12px",
                                    border: "1px solid var(--border-input)",
                                    outline: "none",
                                    fontSize: "15px",
                                    background: "var(--bg-input)",
                                    color: "var(--text-main)"
                                }}
                            />
                        </div>
                        <button 
                            disabled={loading}
                            type="submit"
                            style={{
                                width: "100%",
                                padding: "14px",
                                borderRadius: "12px",
                                border: "none",
                                background: "var(--primary)",
                                color: "#fff",
                                fontWeight: "700",
                                cursor: loading ? "not-allowed" : "pointer",
                                opacity: loading ? 0.7 : 1,
                                fontSize: "16px"
                            }}
                        >
                            {loading ? t.fgpSending : t.fgpSendOtp}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword}>
                        <div style={{ marginBottom: "20px" }}>
                            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "var(--text-heading)" }}>{t.fgpOtpLabel}</label>
                            <input 
                                type="text"
                                required
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="000000"
                                style={{
                                    width: "100%",
                                    padding: "14px",
                                    borderRadius: "12px",
                                    border: "1px solid var(--border-input)",
                                    outline: "none",
                                    fontSize: "18px",
                                    textAlign: "center",
                                    letterSpacing: "8px",
                                    fontWeight: "700",
                                    background: "var(--bg-input)",
                                    color: "var(--text-main)"
                                }}
                            />
                        </div>
                        <div style={{ marginBottom: "20px" }}>
                            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "var(--text-heading)" }}>{t.fgpNewPwd}</label>
                            <input 
                                type="password"
                                required
                                minLength={6}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "14px",
                                    borderRadius: "12px",
                                    border: "1px solid var(--border-input)",
                                    outline: "none",
                                    fontSize: "15px",
                                    background: "var(--bg-input)",
                                    color: "var(--text-main)"
                                }}
                            />
                        </div>
                        <div style={{ marginBottom: "25px" }}>
                            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "var(--text-heading)" }}>{t.fgpConfirmNewPwd}</label>
                            <input 
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "14px",
                                    borderRadius: "12px",
                                    border: "1px solid var(--border-input)",
                                    outline: "none",
                                    fontSize: "15px",
                                    background: "var(--bg-input)",
                                    color: "var(--text-main)"
                                }}
                            />
                        </div>
                        <button 
                            disabled={loading}
                            type="submit"
                            style={{
                                width: "100%",
                                padding: "14px",
                                borderRadius: "12px",
                                border: "none",
                                background: "#20c997",
                                color: "#fff",
                                fontWeight: "700",
                                cursor: loading ? "not-allowed" : "pointer",
                                opacity: loading ? 0.7 : 1,
                                fontSize: "16px"
                            }}
                        >
                            {loading ? t.fgpConfirming : t.fgpUpdatePwd}
                        </button>
                        <button 
                            type="button"
                            onClick={() => setStep(1)}
                            style={{
                                width: "100%",
                                padding: "12px",
                                marginTop: "12px",
                                borderRadius: "12px",
                                border: "1px solid var(--border-input)",
                                background: "var(--bg-card)",
                                color: "var(--text-secondary)",
                                fontWeight: "600",
                                cursor: "pointer",
                                fontSize: "14px"
                            }}
                        >
                            {t.goBack}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
