import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IoIosWarning } from "react-icons/io";
import { TiTick } from "react-icons/ti";
import { GoogleLogin } from "@react-oauth/google";

import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

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
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
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

      if (data?.token) {
        loginSuccess(data);
      }

      setSuccessMessage(t.authXRegisterSuccessVerify);
      setShowSuccess(true);
      showToast(t.authXRegisterSuccessVerify, "success");

      clearTempData();

      setTimeout(() => {
        onClose();
        navigate(`/verify-email?email=${email}`);
      }, 1500);
    } catch (error) {
      console.error("Register error:", error);
      const errMsg = "Không thể kết nối đến máy chủ backend (hãy kiểm tra backend đã chạy chưa)";
      showToast(errMsg, "error");
      setApiError(errMsg);
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

      let data = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

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

      setSuccessMessage(t.authXLoginSuccess);
      setShowSuccess(true);
      showToast(t.authXLoginSuccess, "success");

      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);

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
      const errMsg = "Không thể kết nối đến máy chủ backend (hãy kiểm tra backend đã chạy chưa)";
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

              <div style={{ marginBottom: "12px", width: "100%", display: "flex", justifyContent: "center" }}>
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    console.log("Google response:", credentialResponse);
                    if (!credentialResponse.credential) {
                      alert(t.authXGoogleNoToken);
                      return;
                    }
                    // alert("DEBUG - Credential nhận được: " + credentialResponse.credential.substring(0, 20) + "...");
                    
                    try {
                      const response = await fetch("/api/auth/google-login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          idToken: credentialResponse.credential
                        }),
                      });
                      const data = await response.json();
                      if (response.ok) {
                        loginSuccess(data);
                        setSuccessMessage(t.authXGoogleLoginSuccess);
                        setShowSuccess(true);
                        setTimeout(() => {
                          if (onClose) {
                            onClose();
                          } else {
                            navigate("/");
                          }
                        }, 1500);
                      } else {
                        setApiError(t.authXBackendError.replace('{msg}', data.message || t.authXUnknown));
                        alert(t.authXBackendErrorAlert.replace('{msg}', data.message || t.authXUnknown));
                      }
                    } catch (error) {
                      console.error("Google login error:", error);
                      const errorMsg = t.authXGoogleLoginError.replace('{error}', error.message);
                      setApiError(errorMsg);
                      alert(errorMsg);
                    }
                  }}
                  onError={(error) => {
                    console.error("Google OAuth Error:", error);
                    setApiError(t.authXGoogleLoginFailed);
                    alert(t.authXGoogleOAuthError.replace('{error}', JSON.stringify(error || t.authXUnknown)));
                  }}
                  theme="outline"
                  size="large"
                  text="continue_with"
                  shape="rectangular"
                  width="100%"
                />
              </div>

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