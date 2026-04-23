import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import G from "../Picture/G.png";
import FB from "../Picture/FB.png";
import A from "../Picture/A.svg";
import { IoIosWarning } from "react-icons/io";
import { TiTick } from "react-icons/ti";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

const Auth = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("register");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { t, currentLanguage } = useLanguage();
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
      setApiError("Vui lòng nhập đầy đủ họ tên và số điện thoại.");
      return;
    }

    if (!isValidPhone(phone.trim())) {
      setApiError("Số điện thoại phải bắt đầu bằng 0 và có đúng 10 chữ số.");
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

      const data = await response.json();

      if (!response.ok) {
        const message = data?.message || "Đăng ký thất bại. Vui lòng thử lại.";
        setApiError(message);
        setIsSubmitting(false);
        return;
      }

      if (data?.token) {
        loginSuccess(data);
      }

      setSuccessMessage("Đăng ký thành công! Vui lòng kiểm tra email để lấy mã xác thực.");
      setShowSuccess(true);

      clearTempData();

      setTimeout(() => {
        onClose();
        navigate(`/verify-email?email=${email}`);
      }, 1500);
    } catch (error) {
      console.error("Register error:", error);
      setApiError("Lỗi kết nối: " + error.message);
      alert("Lỗi kết nối: " + error.message);
    } finally {
      setIsSubmitting(false);
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
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message = data?.message || "Đăng nhập thất bại. Vui lòng thử lại.";
        setApiError(message);
        setIsSubmitting(false);
        return;
      }

      if (data?.token) {
        loginSuccess(data);
      }

      setSuccessMessage("Đăng nhập thành công!");
      setShowSuccess(true);

      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);

      setTimeout(() => {
        onClose();
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
      setApiError("Lỗi kết nối: " + error.message);
      alert("Lỗi kết nối: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const iconStyle = {
    width: "20px",
    height: "20px",
    objectFit: "contain",
  };

  return (
    <div
      style={isModal ? {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10000,
      } : {
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "var(--bg-main)",
        padding: "20px"
      }}
      onClick={onClose}
    >
      {showSuccess && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            backgroundColor: "#4caf50",
            color: "white",
            padding: "16px 24px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 10001,
            animation: "slideIn 0.3s ease",
            fontSize: "16px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "20px" }}><TiTick /></span>
          {successMessage}
        </div>
      )}

      <div
        style={{
          position: "relative",
          width: "500px",
          maxWidth: "95vw",
          display: "flex",
          backgroundColor: "var(--bg-card)",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
          transition: "width 0.3s ease",
          padding: "10px"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isModal && (
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "15px",
              right: "15px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-input)",
              borderRadius: "50%",
              width: "35px",
              height: "35px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 10,
            }}
          >
            ×
          </button>
        )}

        {step === 1 && (
          <>
            <div style={{ flex: 1, padding: "50px 40px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ margin: 0, fontSize: "22px", fontWeight: "500" }}>
                  {t.authTitle}
                </h3>
                <button
                  type="button"
                  onClick={handleToggleMode}
                  style={{
                    border: "none",
                    background: "none",
                    color: "var(--primary)",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    textDecoration: "underline",
                  }}
                >
                  {mode === "register" ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
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
                  padding: "14px",
                  marginBottom: "8px",
                  border: emailError ? "1px solid #ff4444" : "1px solid #ccc",
                  borderRadius: "4px",
                  backgroundColor: "var(--bg-card)",
                  color: "var(--text-main)",
                  fontSize: "15px",
                  outline: "none",
                }}
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
                  padding: "14px",
                  border: "none",
                  borderRadius: "4px",
                  backgroundColor: "var(--primary)",
                  fontWeight: "600",
                  cursor: "pointer",
                  marginBottom: "25px",
                  color: "#fff",
                }}
              >
                {mode === "register" ? t.continueWithEmail : "Tiếp tục để đăng nhập"}
              </button>

              <div
                style={{
                  position: "relative",
                  textAlign: "center",
                  borderBottom: "1px solid #eee",
                  lineHeight: "0.1em",
                  margin: "10px 0 30px",
                }}
              >
                <span style={{ background: "var(--bg-card)", padding: "0 15px", color: "var(--text-muted)", fontSize: "14px" }}>hoặc</span>
              </div>

              <div style={{ marginBottom: "12px", width: "100%", display: "flex", justifyContent: "center" }}>
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    console.log("Google response:", credentialResponse);
                    if (!credentialResponse.credential) {
                      alert("Google không trả về Token. Có thể trình duyệt đã chặn Cookie.");
                      return;
                    }
                    // alert("DEBUG - Credential nhận được: " + credentialResponse.credential.substring(0, 20) + "...");
                    
                    try {
                      const decoded = jwtDecode(credentialResponse.credential);
                      const response = await fetch("/api/auth/google-login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          email: decoded.email,
                          fullName: decoded.name,
                          googleId: decoded.sub
                        }),
                      });
                      const data = await response.json();
                      if (response.ok) {
                        loginSuccess(data);
                        setSuccessMessage("Đăng nhập Google thành công!");
                        setShowSuccess(true);
                        setTimeout(() => {
                          onClose();
                          window.location.reload();
                        }, 1500);
                      } else {
                        setApiError("Backend lỗi: " + (data.message || "Không xác định"));
                        alert("Lỗi Backend: " + (data.message || "Không xác định"));
                      }
                    } catch (error) {
                      console.error("Google login error:", error);
                      const errorMsg = "Lỗi đăng nhập Google: " + error.message;
                      setApiError(errorMsg);
                      alert(errorMsg);
                    }
                  }}
                  onError={(error) => {
                    console.error("Google OAuth Error:", error);
                    setApiError("Đăng nhập Google thất bại");
                    alert("Lỗi Google OAuth: " + JSON.stringify(error || "Không xác định"));
                  }}
                  theme="outline"
                  size="large"
                  text="continue_with"
                  shape="rectangular"
                  width="100%"
                />
              </div>

              <button style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "12px", marginBottom: "12px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "15px", fontWeight: "500", width: "100%", backgroundColor: "#1877F2", color: "white" }}>
                <img src={FB} alt="Facebook" style={iconStyle} />
                {t.loginWithFacebook}
              </button>

              <button style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "12px", marginBottom: "12px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "15px", fontWeight: "500", width: "100%", backgroundColor: "#000", color: "white" }}>
                <img src={A} alt="Apple" style={{ ...iconStyle, filter: "invert(1)" }} />
                {t.loginWithApple}
              </button>
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
              {mode === "register" ? t.createAccount : "Đăng nhập"}
            </h2>

            <p style={{
              marginBottom: "24px",
              color: "var(--text-secondary)",
              textAlign: "center",
              fontSize: "16px"
            }}>
              {mode === "register" ? t.setPassword : `Nhập mật khẩu cho tài khoản ${email}`}
            </p>

            <div style={{
              padding: "16px 20px",
              background: "#f0f7ff",
              borderRadius: "12px",
              marginBottom: "28px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid #d4e4ff",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  fontWeight: "600",
                  fontSize: "16px",
                  color: "#1a1a1a",
                  wordBreak: "break-all"
                }}>
                  {email}
                </span>
              </div>
              <button
                onClick={handleBack}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary)",
                  cursor: "pointer",
                  fontWeight: "500",
                  fontSize: "14px",
                  textDecoration: "underline",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                {t.notYou}
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const password = e.target.password.value;
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
                      Họ và tên
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      placeholder="Nhập họ và tên"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setApiError("");
                      }}
                      style={{
                        width: "100%",
                        padding: "14px 16px",
                        border: "2px solid #e0e0e0",
                        borderRadius: "10px",
                        fontSize: "15px",
                        boxSizing: "border-box",
                        outline: "none",
                        marginBottom: "4px",
                      }}
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
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      placeholder="Nhập số điện thoại"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setApiError("");
                      }}
                      style={{
                        width: "100%",
                        padding: "14px 16px",
                        border: "2px solid #e0e0e0",
                        borderRadius: "10px",
                        fontSize: "15px",
                        boxSizing: "border-box",
                        outline: "none",
                        marginBottom: "4px",
                      }}
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
                    padding: "14px 16px",
                    border: passwordError ? "2px solid #ff4444" : "2px solid #e0e0e0",
                    borderRadius: "10px",
                    fontSize: "15px",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    if (!passwordError) {
                      e.target.style.borderColor = "#4f7cff";
                    }
                  }}
                  onBlur={(e) => {
                    if (!passwordError) {
                      e.target.style.borderColor = "#e0e0e0";
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
                <p
                  style={{
                    color: "#ff4444",
                    fontSize: "13px",
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>
                    <IoIosWarning />
                  </span>
                  {apiError}
                </p>
              )}

              {mode === "register" && (
                <p style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  marginBottom: "28px",
                  fontStyle: "italic",
                  background: "#f9f9f9",
                  padding: "12px",
                  borderRadius: "8px",
                  borderLeft: "3px solid #4f7cff",
                }}>
                  <span style={{ fontWeight: "600" }}>{t.passwordRequirement}</span>
                </p>
              )}

              {mode === "login" && (

                <div style={{ textAlign: "right", marginBottom: "20px" }}>
                  <span
                    onClick={() => {
                      onClose();
                      navigate("/forgot-password");
                    }}
                    style={{ color: "var(--primary)", cursor: "pointer", fontSize: "14px", fontWeight: "500", textDecoration: "underline" }}
                  >
                    Quên mật khẩu?
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
                  ? "Đang xử lý..."
                  : mode === "register"
                    ? t.registerAndLogin
                    : "Đăng nhập"}
              </button>
            </form>

            <p style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              textAlign: "center",
              lineHeight: "1.6",
              borderTop: "1px solid var(--border-light)",
              paddingTop: "20px",
              marginTop: "10px",
            }}>
              {t.termsPrefix} <a href="#" style={{ color: "var(--primary)", fontWeight: "500", textDecoration: "underline", }}>{t.termsAndConditions}</a> {t.termsPrefix === "Bằng việc đăng nhập hoặc đăng ký, bạn được xem như đã đồng ý với" ? "và" : "and"} <a href="#" style={{ color: "var(--primary)", fontWeight: "500", textDecoration: "underline", }}>{t.privacyPolicy}</a> {t.of} Datxe.com.
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