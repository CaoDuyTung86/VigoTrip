import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IoIosWarning } from "react-icons/io";
import { GoogleLogin } from "@react-oauth/google";

import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiFetch, WAKING_UP_MESSAGE } from "../utils/apiClient";

const Auth = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [fullName, setFullName] = useState("");
  const [apiError, setApiError] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Khóa chống bấm Google Login hai lần. Dùng ref (không phải state) vì cần chặn NGAY
  // trong cùng một vòng lặp sự kiện — state cập nhật bất đồng bộ nên vẫn lọt request thứ hai.
  // Hai request google-login song song từng tạo ra hai tài khoản trùng email.
  const googleInFlight = useRef(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Mã 6 số của bước xác thực email (step 3)
  const [verifyCode, setVerifyCode] = useState("");
  const [isResending, setIsResending] = useState(false);
  const { t } = useLanguage();
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedEmail = sessionStorage.getItem("tempEmail");
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  useEffect(() => {
    if (email) {
      sessionStorage.setItem("tempEmail", email);
    }
  }, [email]);

  // Modal Auth luôn được mount sẵn trong Header và chỉ trả về null khi đóng, nên state
  // không tự reset. Phải dọn tay, nếu không lần mở sau (ví dụ sau khi đăng xuất) vẫn
  // còn nguyên bước/lỗi/thông báo của phiên đăng nhập trước.
  useEffect(() => {
    if (onClose && !isOpen) {
      setStep(1);
      setApiError("");
      setEmailError("");
      setPasswordError("");
      setIsSubmitting(false);
    }
  }, [onClose, isOpen]);

  const clearTempData = () => {
    sessionStorage.removeItem("tempEmail");
  };

  const isModal = !!onClose;
  const shouldRender = isModal ? isOpen : true;

  if (!shouldRender) return null;

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const isValidPassword = (password) => {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const handleEmailSubmit = (submittedEmail) => {
    setEmailError("");

    if (!submittedEmail.trim()) {
      setEmailError(t.emailRequired);
      return;
    }

    if (!isValidEmail(submittedEmail)) {
      setEmailError(t.emailInvalid);
      return;
    }

    setEmail(submittedEmail.trim());
    setStep(2);
  };

  const isValidPhone = (value) => /^0\d{9}$/.test(value);

  const handleRegister = async (password) => {
    setPasswordError("");
    setApiError("");

    if (!password) {
      setPasswordError(t.passwordRequired);
      return;
    }

    if (!isValidPassword(password)) {
      setPasswordError(t.passwordInvalid);
      return;
    }

    if (!fullName.trim() || !phone.trim()) {
      setApiError(t.authXNamePhoneRequired);
      return;
    }

    if (!isValidPhone(phone.trim())) {
      setApiError(t.authXPhoneInvalid);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
        }),
      });

      let data = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        const message = data?.message || (response.status === 401 ? "Sai tài khoản hoặc mật khẩu" : t.authXRegisterFailed);
        showToast(message, "error");
        setApiError(message);
        setIsSubmitting(false);
        return;
      }

      // /register luôn trả token = null (AuthService bắt buộc xác thực email trước), nên
      // nhập mã ngay tại đây rồi mới có phiên đăng nhập. Trước đây chỗ này điều hướng sang
      // /verify-email — rời trang là BusTickets/TrainTickets/AirlineTickets bị unmount và
      // toàn bộ form đặt vé đang dở (chuyến, ghế, hành khách, dịch vụ, mã giảm giá) mất sạch.
      showToast(t.authXRegisterSuccessVerify, "success");
      setVerifyCode("");
      setApiError("");
      setStep(3);
    } catch (error) {
      console.error("Register error:", error);
      const errMsg = "Không thể kết nối đến máy chủ backend (hãy kiểm tra backend đã chạy chưa)";
      showToast(errMsg, "error");
      setApiError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Kết thúc một lần xác thực thành công. Ở dạng modal thì chỉ đóng lại để trang bên dưới
   * (đang dở form đặt vé) còn nguyên; ở dạng trang /auth thì mới về trang chủ.
   */
  const finishAuth = () => {
    if (onClose) {
      onClose();
    } else {
      navigate("/");
    }
  };

  const handleVerifyEmail = async (code) => {
    const trimmed = (code || "").trim();
    if (trimmed.length !== 6) {
      setApiError(t.vfyInvalidCode);
      return;
    }

    setApiError("");
    setIsSubmitting(true);

    try {
      const { ok, data } = await apiFetch(
        `/api/auth/verify-email?email=${encodeURIComponent(email.trim())}&code=${encodeURIComponent(trimmed)}`,
        { method: "POST" },
        { onRetry: () => showToast(WAKING_UP_MESSAGE, "info") },
      );

      if (!ok || !data?.token) {
        const message = data?.message || t.vfyInvalidCode;
        setApiError(message);
        showToast(message, "error");
        return;
      }

      loginSuccess(data);
      clearTempData();
      showToast(t.vfySuccessInline, "success");
      setStep(1);
      setVerifyCode("");
      finishAuth();
    } catch (error) {
      console.error("Verify email error:", error);
      const errMsg = error?.isColdStart ? WAKING_UP_MESSAGE : t.vfyInvalidCode;
      setApiError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    try {
      await apiFetch(
        `/api/auth/resend-verification?email=${encodeURIComponent(email.trim())}`,
        { method: "POST" },
      );
      // Backend luôn trả 204 kể cả khi email không tồn tại, nên thông báo cũng phải trung tính
      showToast(t.vfyResendSent, "info");
    } catch {
      showToast(t.vfyResendFailed, "error");
    } finally {
      setIsResending(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setPasswordError("");
    setApiError("");
  };

  const handleToggleMode = () => {
    setMode((prev) => (prev === "register" ? "login" : "register"));
    setStep(1);
    setPasswordError("");
    setApiError("");
  };

  const handleLogin = async (password) => {
    setPasswordError("");
    setApiError("");

    if (!password) {
      setPasswordError(t.passwordRequired);
      return;
    }

    setIsSubmitting(true);

    try {
      const { ok, status, data: body } = await apiFetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        },
        { onRetry: () => showToast(WAKING_UP_MESSAGE, "info") },
      );
      const data = body || {};
      const response = { ok, status };

      if (!response.ok) {
        const message = data?.message || (response.status === 401 ? "Sai tài khoản hoặc mật khẩu" : (response.status === 403 ? "Tài khoản chưa được kích hoạt hoặc bị khóa" : t.authXLoginFailed));
        showToast(message, "error");
        setApiError(message);
        setIsSubmitting(false);
        return;
      }

      if (data?.token) {
        loginSuccess(data);
      }

      showToast(t.authXLoginSuccess, "success");

      setTimeout(() => {
        if (onClose) {
          onClose();
        } else {
          navigate("/");
        }
        setStep(1);
        setEmail("");
        setEmailError("");
        setPasswordError("");
        setFullName("");
        setPhone("");
        setApiError("");
      }, 1000);
    } catch (error) {
      console.error("Login error:", error);
      const errMsg = error?.isColdStart
        ? WAKING_UP_MESSAGE
        : "Không thể kết nối đến máy chủ backend (hãy kiểm tra backend đã chạy chưa)";
      showToast(errMsg, "error");
      setApiError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div
      style={isModal ? {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10000,
      } : {
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        padding: "20px"
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--bg-card)",
          borderRadius: "24px",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          padding: "0",
          width: isModal ? "520px" : "480px",
          maxWidth: "92vw",
          border: "1px solid var(--border-main)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Side Decorative Panel (Optional, but adds premium feel) */}
        <div style={{ 
          width: "180px", 
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", 
          display: isModal ? "none" : "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "40px",
          color: "white"
        }}>
          <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "16px" }}>VigoTrip</h2>
          <p style={{ fontSize: "14px", opacity: 0.8, lineHeight: "1.6" }}>{t.authXSideTagline}</p>
        </div>
        {isModal && (
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "15px",
              right: "15px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-main)",
              color: "var(--text-main)",
              borderRadius: "50%",
              width: "35px",
              height: "35px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "18px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 10,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--bg-input)"}
          >
            ✕
          </button>
        )}

        {step === 1 && (
          <>
            <div style={{ flex: 1, padding: "50px 40px", display: "flex", flexDirection: "column" }}>
              <div style={{ marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "var(--text-heading)" }}>
                  {mode === "login" ? t.authXWelcomeBack : t.authXJoinUs}
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                  {mode === "login" ? t.authXLoginSubtitle : t.authXRegisterSubtitle}
                </p>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <button
                  type="button"
                  onClick={handleToggleMode}
                  style={{
                    border: "1px solid var(--border-light)",
                    background: "var(--bg-hover)",
                    color: "var(--text-main)",
                    padding: "8px 16px",
                    borderRadius: "100px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    transition: "0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--border-light)"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                >
                  {mode === "login" ? t.authXSwitchToRegister : t.authXSwitchToLogin}
                </button>
              </div>

                <input
                  type="email"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  style={{
                    padding: "16px",
                    marginBottom: "8px",
                    border: emailError ? "1px solid #ef4444" : "1.5px solid var(--border-main)",
                    borderRadius: "12px",
                    backgroundColor: "var(--bg-input)",
                    color: "var(--text-main)",
                    fontSize: "15px",
                    outline: "none",
                    transition: "0.2s",
                  }}
                  onFocus={e => e.target.style.borderColor = "var(--primary)"}
                  onBlur={e => e.target.style.borderColor = emailError ? "#ef4444" : "var(--border-main)"}
                />

              {emailError && (
                <p style={{
                  color: "#ff4444",
                  fontSize: "13px",
                  marginBottom: "12px",
                  marginTop: "0",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <span><IoIosWarning /></span> {emailError}
                </p>
              )}

              <button
                onClick={() => handleEmailSubmit(email)}
                style={{
                  padding: "16px",
                  border: "none",
                  borderRadius: "12px",
                  backgroundColor: "var(--primary)",
                  fontWeight: "700",
                  cursor: "pointer",
                  marginBottom: "30px",
                  color: "#fff",
                  boxShadow: "0 10px 15px -3px rgba(56, 139, 253, 0.3)",
                  transition: "0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                {mode === "login" ? t.authXContinueLogin : t.authXContinueRegister}
              </button>

              <div
                style={{
                  position: "relative",
                  textAlign: "center",
                  borderBottom: "1px solid var(--border-main)",
                  lineHeight: "0.1em",
                  margin: "10px 0 30px",
                }}
              >
                <span style={{ background: "var(--bg-card)", padding: "0 15px", color: "var(--text-secondary)", fontSize: "14px" }}>{t.authXOrLower}</span>
              </div>

              {/* Khi đang gửi request: chặn tương tác với nút Google (nút do Google render
                  trong iframe nên không thể disable trực tiếp) và cho người dùng thấy
                  hệ thống đang xử lý — tránh việc bấm lại tạo request trùng. */}
              <div
                style={{
                  marginBottom: "12px",
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  pointerEvents: googleLoading ? "none" : "auto",
                  opacity: googleLoading ? 0.55 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    if (!credentialResponse.credential) {
                      showToast(t.authXGoogleNoToken, "error");
                      return;
                    }
                    // Chặn request thứ hai khi request đầu chưa xong. Nếu để lọt, hai lần
                    // google-login song song cùng thấy "email chưa tồn tại" và cùng tạo user
                    // → sinh hai tài khoản trùng email → những lần đăng nhập sau đó báo lỗi
                    // backend hoặc "tài khoản đã bị khóa".
                    if (googleInFlight.current) return;
                    googleInFlight.current = true;
                    setGoogleLoading(true);
                    setApiError("");

                    try {
                      const { ok, data } = await apiFetch(
                        "/api/auth/google-login",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            idToken: credentialResponse.credential
                          }),
                        },
                        { onRetry: () => showToast(WAKING_UP_MESSAGE, "info") },
                      );

                      if (ok && data?.token) {
                        loginSuccess(data);
                        showToast(t.authXGoogleLoginSuccess, "success");
                        setTimeout(() => {
                          if (onClose) {
                            onClose();
                          } else {
                            navigate("/");
                          }
                        }, 1000);
                      } else {
                        const errorMsg = t.authXBackendError.replace('{msg}', data?.message || t.authXUnknown);
                        setApiError(errorMsg);
                        showToast(errorMsg, "error");
                      }
                    } catch (error) {
                      console.error("Google login error:", error);
                      // Cold start của Render có thông báo riêng — nói "đăng nhập Google thất bại"
                      // khiến người dùng bấm lại liên tục, đúng thứ gây ra tài khoản trùng.
                      const errorMsg = error?.isColdStart
                        ? WAKING_UP_MESSAGE
                        : t.authXGoogleLoginError.replace('{error}', error.message);
                      setApiError(errorMsg);
                      showToast(errorMsg, "error");
                    } finally {
                      googleInFlight.current = false;
                      setGoogleLoading(false);
                    }
                  }}
                  onError={(error) => {
                    console.error("Google OAuth Error:", error);
                    setApiError(t.authXGoogleLoginFailed);
                    showToast(t.authXGoogleLoginFailed, "error");
                  }}
                  theme="outline"
                  size="large"
                  text="continue_with"
                  shape="rectangular"
                  width="100%"
                />
              </div>
              {googleLoading && (
                <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                  Đang đăng nhập bằng Google, vui lòng không bấm lại...
                </div>
              )}

              </div>
          </>
        )}

        {step === 2 && (
          <div style={{ flex: 1, padding: "50px 40px" }}>
            <h2 style={{
              marginBottom: "16px",
              fontSize: "28px",
              color: "var(--text-main)",
              textAlign: "center",
              fontWeight: "600"
            }}>
              {mode === "register" ? t.createAccount : t.authXLoginBtn}
            </h2>

            <p style={{
              marginBottom: "24px",
              color: "var(--text-secondary)",
              textAlign: "center",
              fontSize: "16px"
            }}>
              {mode === "register" ? t.setPassword : t.authXEnterPwdFor.replace('{email}', email)}
            </p>

            <div style={{
              padding: "12px 18px",
              background: "var(--bg-input)",
              borderRadius: "12px",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid var(--border-main)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  fontWeight: "600",
                  fontSize: "15px",
                  color: "var(--text-main)",
                  wordBreak: "break-all"
                }}>
                  {email}
                </span>
              </div>
              <button
                type="button"
                onClick={handleBack}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary)",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                  padding: "4px 8px",
                }}
              >
                {t.notYou}
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              // elements.password thay vì e.target.password: named access trên form là API
              // của trình duyệt, jsdom không có -> viết kiểu này thì test chạy được luôn.
              const password = e.target.elements.password.value;
              if (mode === "register") {
                handleRegister(password);
              } else {
                handleLogin(password);
              }
            }}>
              {mode === "register" && (
                <>
                  <div style={{ marginBottom: "16px" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {t.authXFullName}
                    </label>
                      <input
                        type="text"
                        name="fullName"
                        placeholder={t.authXFullNamePlaceholder}
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          setApiError("");
                        }}
                        style={{
                          width: "100%",
                          padding: "16px",
                          border: "1.5px solid var(--border-main)",
                          borderRadius: "12px",
                          fontSize: "15px",
                          boxSizing: "border-box",
                          outline: "none",
                          marginBottom: "4px",
                          backgroundColor: "var(--bg-input)",
                          color: "var(--text-main)",
                          transition: "0.2s"
                        }}
                        onFocus={e => e.target.style.borderColor = "var(--primary)"}
                        onBlur={e => e.target.style.borderColor = "var(--border-main)"}
                        required
                      />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {t.authXPhoneLabel}
                    </label>
                      <input
                        type="tel"
                        name="phone"
                        placeholder={t.authXPhonePlaceholder}
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          setApiError("");
                        }}
                        style={{
                          width: "100%",
                          padding: "16px",
                          border: "1.5px solid var(--border-main)",
                          borderRadius: "12px",
                          fontSize: "15px",
                          boxSizing: "border-box",
                          outline: "none",
                          marginBottom: "4px",
                          backgroundColor: "var(--bg-input)",
                          color: "var(--text-main)",
                          transition: "0.2s"
                        }}
                        onFocus={e => e.target.style.borderColor = "var(--primary)"}
                        onBlur={e => e.target.style.borderColor = "var(--border-main)"}
                        required
                      />
                  </div>
                </>
              )}

              <div style={{ marginBottom: "16px" }}>
                <label style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "var(--text-secondary)"
                }}>
                  {t.password}
                </label>
                <input
                  type="password"
                  name="password"
                  placeholder={t.password}
                  style={{
                    width: "100%",
                    padding: "16px",
                    border: passwordError ? "2px solid #ef4444" : "1.5px solid var(--border-main)",
                    borderRadius: "12px",
                    fontSize: "15px",
                    boxSizing: "border-box",
                    transition: "all 0.2s",
                    outline: "none",
                    backgroundColor: "var(--bg-input)",
                    color: "var(--text-main)",
                  }}
                  onFocus={(e) => {
                    if (!passwordError) {
                      e.target.style.borderColor = "var(--primary)";
                      e.target.style.boxShadow = "0 0 0 4px rgba(56, 139, 253, 0.15)";
                    }
                  }}
                  onBlur={(e) => {
                    if (!passwordError) {
                      e.target.style.borderColor = "var(--border-main)";
                      e.target.style.boxShadow = "none";
                    }
                  }}
                  onChange={() => setPasswordError("")}
                  required
                />
              </div>

              {passwordError && (
                <p style={{
                  color: "#ff4444",
                  fontSize: "13px",
                  marginBottom: "12px",
                  marginTop: "-8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <span><IoIosWarning /></span> {passwordError}
                </p>
              )}

              {apiError && (
                <p style={{
                  color: "#ff4444",
                  fontSize: "13px",
                  marginBottom: "12px",
                  marginTop: "-8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <span><IoIosWarning /></span> {apiError}
                </p>
              )}



              {mode === "register" && (
                <p style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  marginBottom: "24px",
                  background: "var(--bg-input)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  borderLeft: "3px solid var(--primary)",
                }}>
                  <span>{t.passwordRequirement}</span>
                </p>
              )}

              {mode === "login" && (

                <div style={{ textAlign: "right", marginBottom: "20px" }}>
                  <span
                    onClick={() => {
                      if (onClose) onClose();
                      navigate("/forgot-password");
                    }}
                    style={{ color: "var(--primary)", cursor: "pointer", fontSize: "14px", fontWeight: "500", textDecoration: "underline" }}
                  >
                    {t.authXForgotPwd}
                  </span>
                </div>
              )}

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "16px",
                  backgroundColor: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  marginBottom: "20px",
                  transition: "background-color 0.2s",
                  boxShadow: "0 4px 10px rgba(79,124,255,0.3)",
                }}
                disabled={isSubmitting}
                onMouseOver={(e) => e.target.style.backgroundColor = "var(--primary-hover)"}
                onMouseOut={(e) => e.target.style.backgroundColor = "var(--primary)"}
              >
                {isSubmitting
                  ? t.processing
                  : mode === "register"
                    ? t.registerAndLogin
                    : t.authXLoginBtn}
              </button>
            </form>

            <p style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              textAlign: "center",
              lineHeight: "1.6",
              borderTop: "1px solid var(--border-main)",
              paddingTop: "20px",
              marginTop: "10px",
            }}>
              {t.termsPrefix} <a href="#" style={{ color: "var(--primary)", fontWeight: "500", textDecoration: "underline", }}>{t.termsAndConditions}</a> {t.authXAnd} <a href="#" style={{ color: "var(--primary)", fontWeight: "500", textDecoration: "underline", }}>{t.privacyPolicy}</a> {t.of} VigoTrip.
            </p>
          </div>
        )}

        {step === 3 && (
          <div style={{ flex: 1, padding: "50px 40px" }}>
            <div style={{ fontSize: "44px", textAlign: "center", marginBottom: "12px" }}>📧</div>
            <h2 style={{
              marginBottom: "12px",
              fontSize: "26px",
              color: "var(--text-main)",
              textAlign: "center",
              fontWeight: "700"
            }}>
              {t.vfyTitle}
            </h2>

            <p style={{
              marginBottom: "24px",
              color: "var(--text-secondary)",
              textAlign: "center",
              fontSize: "14px",
              lineHeight: "1.6"
            }}>
              {t.vfySentTo}<br />
              <strong style={{ color: "var(--primary)", wordBreak: "break-all" }}>{email}</strong>
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleVerifyEmail(verifyCode); }}>
              <label htmlFor="verifyCode" style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--text-main)",
                marginBottom: "8px"
              }}>
                {t.vfyCodeLabel}
              </label>
              <input
                id="verifyCode"
                name="verifyCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => {
                  setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setApiError("");
                }}
                style={{
                  width: "100%",
                  padding: "16px",
                  fontSize: "24px",
                  letterSpacing: "10px",
                  textAlign: "center",
                  fontWeight: "700",
                  borderRadius: "10px",
                  border: "1px solid var(--border-main)",
                  background: "var(--bg-input)",
                  color: "var(--text-main)",
                  marginBottom: "16px",
                  boxSizing: "border-box",
                }}
              />

              {apiError && (
                <p style={{
                  color: "#ff4444",
                  fontSize: "13px",
                  marginBottom: "12px",
                  marginTop: "-8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <span><IoIosWarning /></span> {apiError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || verifyCode.length !== 6}
                style={{
                  width: "100%",
                  padding: "16px",
                  backgroundColor: verifyCode.length === 6 ? "var(--primary)" : "var(--border-main)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: verifyCode.length === 6 ? "pointer" : "not-allowed",
                  marginBottom: "20px",
                  transition: "background-color 0.2s",
                }}
              >
                {isSubmitting ? t.vfyVerifying : t.vfyActivate}
              </button>
            </form>

            <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-secondary)" }}>
              {t.vfyNotReceived}{" "}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isResending}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary)",
                  cursor: isResending ? "wait" : "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                {t.vfyResend}
              </button>
            </p>
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
};

export default Auth;