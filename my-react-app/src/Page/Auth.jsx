import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IoIosWarning } from "react-icons/io";
import { Eye, EyeOff } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";

import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiFetch } from "../utils/apiClient";

const inputStyle = (hasError) => ({
  width: "100%",
  padding: "15px 16px",
  border: hasError ? "1.5px solid #ef4444" : "1.5px solid var(--border-main)",
  borderRadius: "12px",
  backgroundColor: "var(--bg-input)",
  color: "var(--text-main)",
  fontSize: "15px",
  outline: "none",
  boxSizing: "border-box",
  transition: "0.2s",
});

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
  fontWeight: "600",
  color: "var(--text-secondary)",
};

const legalLinkStyle = {
  color: "var(--primary)",
  fontWeight: "500",
  textDecoration: "underline",
};

const errorTextStyle = {
  color: "#ff4444",
  fontSize: "13px",
  margin: "6px 0 0",
  display: "flex",
  alignItems: "center",
  gap: "4px",
};

/**
 * Ô mật khẩu kèm nút hiện/ẩn.
 *
 * Định nghĩa ở cấp module, KHÔNG lồng trong Auth: một component khai báo bên trong thân
 * hàm render sẽ là một type mới sau mỗi lần render, React tháo rồi dựng lại cái input —
 * gõ một ký tự là mất focus.
 */
const PasswordField = ({
  id, name, value, onChange, autoComplete, placeholder,
  hasError, inputRef, visible, onToggle, toggleLabel,
}) => (
  <div style={{ position: "relative" }}>
    <input
      id={id}
      ref={inputRef}
      type={visible ? "text" : "password"}
      name={name}
      autoComplete={autoComplete}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      style={{ ...inputStyle(hasError), paddingRight: "48px" }}
      onFocus={e => e.target.style.borderColor = "var(--primary)"}
      onBlur={e => e.target.style.borderColor = hasError ? "#ef4444" : "var(--border-main)"}
    />
    <button
      type="button"
      onClick={onToggle}
      aria-label={toggleLabel}
      title={toggleLabel}
      style={{
        position: "absolute",
        right: "6px",
        top: "50%",
        transform: "translateY(-50%)",
        background: "none",
        border: "none",
        padding: "8px",
        cursor: "pointer",
        color: "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
      }}
    >
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </div>
);

/**
 * Modal đăng nhập / đăng ký / quên mật khẩu.
 *
 * Ba bước, tất cả nằm TRONG modal:
 *   "form"   — email + mật khẩu (+ họ tên, SĐT khi đăng ký) trên cùng một màn hình
 *   "verify" — nhập mã 6 số, cho tài khoản chưa kích hoạt
 *   "forgot" — gửi mã OTP rồi đặt lại mật khẩu
 *
 * Bước "nhập email" riêng trước đây đã bỏ: nó chỉ chạy regex rồi sang bước sau, không hề
 * hỏi backend xem email đã tồn tại hay chưa, nên không rẽ nhánh được login/register —
 * đúng thứ duy nhất biện minh cho việc tách bước. Đổi lại nó bắt người dùng bấm thêm một
 * lần, và tách email khỏi ô mật khẩu ở hai form khác nhau khiến trình quản lý mật khẩu
 * không nhận ra đây là form đăng nhập để lưu / tự điền.
 *
 * Quên mật khẩu cũng đã kéo vào đây thay vì điều hướng sang /forgot-password: rời trang là
 * BusTickets/TrainTickets/AirlineTickets bị unmount, mất sạch form đặt vé đang dở — đúng
 * lý do bước xác thực email được đưa vào modal từ trước.
 */
const Auth = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [step, setStep] = useState("form");
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [fullName, setFullName] = useState("");
  const [apiError, setApiError] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Bật khi backend trả EMAIL_NOT_VERIFIED: hiện nút dẫn thẳng sang màn nhập mã.
  // Không có nó thì người đăng ký dở dang bị kẹt vĩnh viễn — đăng nhập báo lỗi,
  // đăng ký lại thì "email đã được sử dụng".
  const [needsVerification, setNeedsVerification] = useState(false);
  // Khóa chống bấm Google Login hai lần. Dùng ref (không phải state) vì cần chặn NGAY
  // trong cùng một vòng lặp sự kiện — state cập nhật bất đồng bộ nên vẫn lọt request thứ hai.
  // Hai request google-login song song từng tạo ra hai tài khoản trùng email.
  const googleInFlight = useRef(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Mã 6 số của bước xác thực email
  const [verifyCode, setVerifyCode] = useState("");
  const [isResending, setIsResending] = useState(false);
  // Bước quên mật khẩu: "request" (gửi mã) -> "reset" (nhập mã + mật khẩu mới)
  const [forgotStage, setForgotStage] = useState("request");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const { t } = useLanguage();
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();

  const isModal = !!onClose;
  const shouldRender = isModal ? isOpen : true;

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
    if (isModal && !isOpen) {
      // Dọn TẤT CẢ, không chỉ bước và lỗi. Thiếu mode/fullName/phone/verifyCode thì lần mở
      // sau vẫn đang ở chế độ đăng ký với họ tên, số điện thoại của lần trước còn nguyên.
      // `email` là ngoại lệ có chủ đích: nó được nhớ lại từ sessionStorage để khỏi bắt gõ lại.
      setStep("form");
      setMode("login");
      setApiError("");
      setEmailError("");
      setPasswordError("");
      setNeedsVerification(false);
      setPassword("");
      setShowPassword(false);
      setFullName("");
      setPhone("");
      setVerifyCode("");
      setForgotStage("request");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setForgotMessage("");
      setIsSubmitting(false);
    }
  }, [isModal, isOpen]);

  // Khóa cuộn của trang nền khi modal mở. Thiếu nó thì cuộn trong modal làm trang đặt vé
  // phía sau trôi đi còn modal đứng yên — cảm giác như modal bị treo.
  useEffect(() => {
    if (!isModal || !isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [isModal, isOpen]);

  // Escape để đóng — lối thoát cuối cùng nếu nút ✕ vì lý do nào đó không bấm được.
  useEffect(() => {
    if (!isModal || !isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModal, isOpen, onClose]);

  // Con trỏ vào sẵn ô đầu tiên còn trống. Đọc giá trị từ DOM chứ không phụ thuộc state
  // `email`, nếu không mỗi ký tự gõ vào sẽ kích hoạt lại effect và nhảy focus lung tung.
  useEffect(() => {
    if (!shouldRender || step !== "form") return undefined;
    const timer = setTimeout(() => {
      const target = emailRef.current?.value ? passwordRef.current : emailRef.current;
      target?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [shouldRender, step, mode]);

  const clearTempData = () => {
    sessionStorage.removeItem("tempEmail");
  };

  if (!shouldRender) return null;

  const isValidEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  };

  const isValidPassword = (value) => {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(value);
  };

  const isValidPhone = (value) => /^0\d{9}$/.test(value);

  const normalizedEmail = () => email.trim().toLowerCase();

  /** Thông báo lỗi mạng/cold-start, đã dịch — không lấy chuỗi cứng từ apiClient nữa. */
  const networkError = (error) => (error?.isColdStart ? t.apiWakingUp : t.authXConnFailed);

  const retryToast = { onRetry: () => showToast(t.apiWakingUp, "info") };

  /**
   * Kết thúc một lần xác thực thành công. Ở dạng modal thì chỉ đóng lại để trang bên dưới
   * (đang dở form đặt vé) còn nguyên; ở dạng trang /auth thì mới về trang chủ.
   */
  const finishAuth = () => {
    clearTempData();
    setPassword("");
    setShowPassword(false);
    if (onClose) {
      onClose();
    } else {
      navigate("/");
    }
  };

  const handleRegister = async () => {
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
      const { ok, status, data: body } = await apiFetch(
        "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: normalizedEmail(),
            password,
            phone: phone.trim(),
          }),
        },
        retryToast,
      );
      const data = body || {};

      // 409 = email đã có tài khoản. Đừng bắt gõ lại từ đầu: chuyển thẳng sang chế độ
      // đăng nhập, giữ nguyên email và đưa con trỏ vào ô mật khẩu. Đây chính là tình huống
      // "điền xong xuôi hết mới báo email đã đăng ký" — nay nó tốn đúng một lần gõ mật khẩu.
      if (status === 409) {
        setMode("login");
        setPassword("");
        setPasswordError("");
        setApiError("");
        setEmailError(t.authXEmailTakenSwitch);
        showToast(t.authXEmailTakenSwitch, "info");
        setIsSubmitting(false);
        setTimeout(() => passwordRef.current?.focus(), 0);
        return;
      }

      if (!ok) {
        // Với các mã lỗi đã biết thì dùng chuỗi đã dịch; chỉ rơi về data.message cho
        // trường hợp lạ, để không nuốt mất thông tin chẩn đoán.
        const message = status === 400 && data?.message ? data.message : t.authXRegisterFailed;
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
      setStep("verify");
    } catch (error) {
      console.error("Register error:", error);
      const errMsg = networkError(error);
      showToast(errMsg, "error");
      setApiError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    setIsSubmitting(true);

    try {
      const { ok, status, data: body } = await apiFetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail(), password }),
        },
        retryToast,
      );
      const data = body || {};

      // Mật khẩu ĐÚNG nhưng tài khoản chưa kích hoạt. Backend chỉ trả mã này SAU khi đã so
      // khớp mật khẩu, nên nói ra ở đây không làm lộ email nào có trên hệ thống.
      if (status === 403 && data?.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
        setApiError(t.authXNotVerified);
        setIsSubmitting(false);
        return;
      }

      // Bị quản trị viên khóa. Cùng 403 nhưng TUYỆT ĐỐI không kèm nút "nhập mã xác thực":
      // nút đó gọi resend-verification rồi verify-email, tức là người bị khóa tự mở khóa.
      if (status === 403 && data?.code === "ACCOUNT_LOCKED") {
        setNeedsVerification(false);
        setApiError(t.authXAccountLocked);
        setIsSubmitting(false);
        return;
      }

      if (!ok) {
        const message = status === 401 ? t.authXInvalidCredentials : t.authXLoginFailed;
        showToast(message, "error");
        setApiError(message);
        setIsSubmitting(false);
        return;
      }

      if (data?.token) {
        loginSuccess(data);
      }

      showToast(t.authXLoginSuccess, "success");
      // Đóng ngay, không chờ. setTimeout 1 giây ở đây trước kia chỉ tạo ra một quãng
      // đứng hình trong khi toast đã báo thành công rồi.
      finishAuth();
      setStep("form");
      setEmailError("");
      setPasswordError("");
      setFullName("");
      setPhone("");
      setApiError("");
    } catch (error) {
      console.error("Login error:", error);
      const errMsg = networkError(error);
      showToast(errMsg, "error");
      setApiError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setEmailError("");
    setPasswordError("");
    setApiError("");
    setNeedsVerification(false);

    if (!email.trim()) {
      setEmailError(t.emailRequired);
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError(t.emailInvalid);
      return;
    }
    if (!password) {
      setPasswordError(t.passwordRequired);
      return;
    }

    if (mode === "register") {
      handleRegister();
    } else {
      handleLogin();
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
        `/api/auth/verify-email?email=${encodeURIComponent(normalizedEmail())}&code=${encodeURIComponent(trimmed)}`,
        { method: "POST" },
        retryToast,
      );

      if (!ok || !data?.token) {
        setApiError(t.vfyInvalidCode);
        showToast(t.vfyInvalidCode, "error");
        return;
      }

      loginSuccess(data);
      showToast(t.vfySuccessInline, "success");
      setStep("form");
      setVerifyCode("");
      setNeedsVerification(false);
      finishAuth();
    } catch (error) {
      console.error("Verify email error:", error);
      const errMsg = error?.isColdStart ? t.apiWakingUp : t.vfyInvalidCode;
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
        `/api/auth/resend-verification?email=${encodeURIComponent(normalizedEmail())}`,
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

  /** Từ lỗi "chưa kích hoạt" đi thẳng sang màn nhập mã, kèm một mã mới. */
  const handleGoToVerify = async () => {
    setApiError("");
    setVerifyCode("");
    setNeedsVerification(false);
    setStep("verify");
    await handleResendCode();
  };

  const openForgot = () => {
    setStep("forgot");
    setForgotStage("request");
    setApiError("");
    setEmailError("");
    setForgotMessage("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const backToLogin = () => {
    setStep("form");
    setMode("login");
    setApiError("");
    setEmailError("");
    setVerifyCode("");
    setForgotStage("request");
    setForgotMessage("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleForgotRequest = async (e) => {
    e.preventDefault();
    setApiError("");
    setEmailError("");

    if (!isValidEmail(email)) {
      setEmailError(t.emailInvalid);
      return;
    }

    setIsSubmitting(true);
    try {
      const { ok } = await apiFetch(
        "/api/auth/forgot-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail() }),
        },
        retryToast,
      );

      if (!ok) {
        setApiError(t.authXConnFailed);
        setIsSubmitting(false);
        return;
      }

      // Backend cố tình trả thành công kể cả khi email không tồn tại (nếu không, form này
      // là công cụ dò xem email nào đã đăng ký). Nên câu thông báo cũng phải trung tính:
      // "nếu email này có tài khoản thì mã đã được gửi".
      setForgotMessage(t.fgpOtpSent);
      setForgotStage("reset");
    } catch (error) {
      const msg = networkError(error);
      setApiError(msg);
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotReset = async (e) => {
    e.preventDefault();
    setApiError("");

    if (otp.trim().length !== 6) {
      setApiError(t.fgpOtpInvalid);
      return;
    }
    if (!isValidPassword(newPassword)) {
      setApiError(t.passwordInvalid);
      return;
    }
    if (newPassword !== confirmPassword) {
      setApiError(t.fgpPwdMismatch);
      return;
    }

    setIsSubmitting(true);
    try {
      const { ok, data } = await apiFetch(
        "/api/auth/reset-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail(),
            newPassword,
            otpCode: otp.trim(),
          }),
        },
        retryToast,
      );

      if (!ok) {
        // Backend gộp "sai mã" / "hết hạn" / "email không tồn tại" vào một câu duy nhất
        // (chống dò email), nên ở đây cũng chỉ có một câu. Riêng "mật khẩu mới trùng mật
        // khẩu cũ" thì nằm sau một mã OTP hợp lệ nên hiện nguyên văn được.
        const message = data?.message || t.fgpOtpInvalid;
        setApiError(message);
        showToast(message, "error");
        setIsSubmitting(false);
        return;
      }

      showToast(t.fgpResetSuccess, "success");
      // Quay về màn đăng nhập NGAY TRONG modal — trang đặt vé phía sau vẫn còn nguyên.
      backToLogin();
      setPassword("");
      setTimeout(() => passwordRef.current?.focus(), 50);
    } catch (error) {
      const msg = networkError(error);
      setApiError(msg);
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleMode = () => {
    setMode((prev) => (prev === "register" ? "login" : "register"));
    setPasswordError("");
    setEmailError("");
    setApiError("");
    setNeedsVerification(false);
  };

  const linkButtonStyle = {
    background: "none",
    border: "none",
    color: "var(--primary)",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    textDecoration: "underline",
    padding: 0,
  };

  const primaryButtonStyle = (enabled) => ({
    width: "100%",
    padding: "16px",
    backgroundColor: enabled ? "var(--primary)" : "var(--border-main)",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: enabled ? "pointer" : "not-allowed",
    marginBottom: "20px",
    transition: "background-color 0.2s",
  });

  const bodyStyle = { flex: 1, minHeight: 0, padding: "40px clamp(20px, 6vw, 40px)" };

  const renderApiError = () => apiError && (
    <div style={{
      marginBottom: "16px",
      padding: "12px 14px",
      borderRadius: "10px",
      background: "rgba(239, 68, 68, 0.08)",
      border: "1px solid rgba(239, 68, 68, 0.3)",
    }}>
      <p style={{ ...errorTextStyle, margin: 0 }}>
        <span><IoIosWarning /></span> {apiError}
      </p>
      {/* Lối ra cho tài khoản đăng ký dở dang. Trước đây không có nút này:
          đăng nhập thì báo lỗi, đăng ký lại thì "email đã được sử dụng",
          và màn nhập mã chỉ tới được bằng cách tự gõ tay /verify-email. */}
      {needsVerification && (
        <button
          type="button"
          onClick={handleGoToVerify}
          style={{
            marginTop: "10px",
            width: "100%",
            padding: "10px",
            border: "none",
            borderRadius: "8px",
            background: "var(--primary)",
            color: "#fff",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          {t.authXGoVerify}
        </button>
      )}
    </div>
  );

  return (
    <div
      style={isModal ? {
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        boxSizing: "border-box",
        zIndex: 10000,
      } : {
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        padding: "20px",
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        className="auth-card"
        style={{
          position: "relative",
          backgroundColor: "var(--bg-card)",
          borderRadius: "24px",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          padding: "0",
          width: isModal ? "520px" : "700px",
          maxWidth: "100%",
          // display:flex là bắt buộc: panel trang trí bên dưới được viết như một CỘT TRÁI
          // (width 180px) nhưng card cũ là display:block nên nó xếp đè lên trên form,
          // thành một mảng tím lệch góc ở trang /auth.
          display: "flex",
          flexDirection: isModal ? "column" : "row",
          border: "1px solid var(--border-main)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          width: "180px",
          flexShrink: 0,
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
            aria-label={t.authXClose}
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

        {step === "form" && (
          <div className="auth-card-body" style={bodyStyle}>
            <div style={{ marginBottom: "12px", paddingRight: isModal ? "40px" : 0 }}>
              <h3 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "var(--text-heading)" }}>
                {mode === "login" ? t.authXWelcomeBack : t.authXJoinUs}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                {mode === "login" ? t.authXLoginSubtitle : t.authXRegisterSubtitle}
              </p>
            </div>

            <div style={{ marginBottom: "20px" }}>
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

            {/* Email và mật khẩu nằm CÙNG một <form>. Đây là điều kiện để trình duyệt và
                trình quản lý mật khẩu nhận ra đây là form đăng nhập mà lưu / tự điền —
                tách hai trường sang hai bước như trước thì chúng không ghép lại được.
                Kèm theo đó, phím Enter nay submit được (trước kia bước email không có
                <form> nên Enter không làm gì cả). */}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label htmlFor="authEmail" style={labelStyle}>{t.authXEmailLabel}</label>
                <input
                  id="authEmail"
                  ref={emailRef}
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  style={inputStyle(!!emailError)}
                  onFocus={e => e.target.style.borderColor = "var(--primary)"}
                  onBlur={e => e.target.style.borderColor = emailError ? "#ef4444" : "var(--border-main)"}
                />
                {emailError && (
                  <p style={errorTextStyle}><span><IoIosWarning /></span> {emailError}</p>
                )}
              </div>

              {mode === "register" && (
                <>
                  <div style={{ marginBottom: "16px" }}>
                    <label htmlFor="authFullName" style={labelStyle}>{t.authXFullName}</label>
                    <input
                      id="authFullName"
                      type="text"
                      name="fullName"
                      autoComplete="name"
                      placeholder={t.authXFullNamePlaceholder}
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setApiError("");
                      }}
                      style={inputStyle(false)}
                      onFocus={e => e.target.style.borderColor = "var(--primary)"}
                      onBlur={e => e.target.style.borderColor = "var(--border-main)"}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label htmlFor="authPhone" style={labelStyle}>{t.authXPhoneLabel}</label>
                    <input
                      id="authPhone"
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      placeholder={t.authXPhonePlaceholder}
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setApiError("");
                      }}
                      style={inputStyle(false)}
                      onFocus={e => e.target.style.borderColor = "var(--primary)"}
                      onBlur={e => e.target.style.borderColor = "var(--border-main)"}
                      required
                    />
                  </div>
                </>
              )}

              <div style={{ marginBottom: "16px" }}>
                <label htmlFor="authPassword" style={labelStyle}>{t.password}</label>
                <PasswordField
                  id="authPassword"
                  name="password"
                  inputRef={passwordRef}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  placeholder={t.password}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError("");
                  }}
                  hasError={!!passwordError}
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  toggleLabel={showPassword ? t.authXHidePwd : t.authXShowPwd}
                />
                {passwordError && (
                  <p style={errorTextStyle}><span><IoIosWarning /></span> {passwordError}</p>
                )}
              </div>

              {mode === "register" && (
                <p style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  margin: "0 0 16px",
                  background: "var(--bg-input)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  borderLeft: "3px solid var(--primary)",
                }}>
                  <span>{t.passwordRequirement}</span>
                </p>
              )}

              {mode === "login" && (
                <div style={{ textAlign: "right", marginBottom: "16px" }}>
                  {/* Ở lại trong modal. Trước đây chỗ này đóng modal rồi điều hướng sang
                      /forgot-password, cuốn theo cả form đặt vé đang dở. */}
                  <button type="button" onClick={openForgot} style={linkButtonStyle}>
                    {t.authXForgotPwd}
                  </button>
                </div>
              )}

              {renderApiError()}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  ...primaryButtonStyle(!isSubmitting),
                  cursor: isSubmitting ? "wait" : "pointer",
                  boxShadow: "0 4px 10px rgba(79,124,255,0.3)",
                }}
              >
                {isSubmitting
                  ? t.processing
                  : mode === "register"
                    ? t.authXRegisterSubmit
                    : t.authXLoginBtn}
              </button>
            </form>

            <div
              style={{
                position: "relative",
                textAlign: "center",
                borderBottom: "1px solid var(--border-main)",
                lineHeight: "0.1em",
                margin: "10px 0 26px",
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
                        body: JSON.stringify({ idToken: credentialResponse.credential }),
                      },
                      retryToast,
                    );

                    if (ok && data?.token) {
                      loginSuccess(data);
                      showToast(t.authXGoogleLoginSuccess, "success");
                      finishAuth();
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
                      ? t.apiWakingUp
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
                {t.authXGoogleInFlight}
              </div>
            )}

            <p style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              textAlign: "center",
              lineHeight: "1.6",
              borderTop: "1px solid var(--border-main)",
              paddingTop: "18px",
              marginTop: "10px",
              marginBottom: 0,
            }}>
              {/* target="_blank": mở tab mới thay vì điều hướng. Bấm vào một liên kết ở đây
                  mà rời trang thì mất luôn form đặt vé đang dở phía sau modal — đúng thứ mà
                  bước xác thực email và bước quên mật khẩu đã được kéo vào modal để tránh. */}
              {t.termsPrefix}{" "}
              <a href="/dieu-khoan" target="_blank" rel="noopener noreferrer" style={legalLinkStyle}>{t.termsAndConditions}</a>
              {" "}{t.authXAnd}{" "}
              <a href="/chinh-sach-bao-mat" target="_blank" rel="noopener noreferrer" style={legalLinkStyle}>{t.privacyPolicy}</a>
              {" "}{t.of} VigoTrip.
            </p>
          </div>
        )}

        {step === "verify" && (
          <div className="auth-card-body" style={bodyStyle}>
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
              <strong style={{ color: "var(--primary)", wordBreak: "break-word" }}>{email}</strong>
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleVerifyEmail(verifyCode); }}>
              <label htmlFor="verifyCode" style={labelStyle}>{t.vfyCodeLabel}</label>
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
                  ...inputStyle(false),
                  fontSize: "24px",
                  letterSpacing: "10px",
                  textAlign: "center",
                  fontWeight: "700",
                  marginBottom: "16px",
                }}
              />

              {apiError && (
                <p style={{ ...errorTextStyle, marginBottom: "12px", marginTop: "-8px" }}>
                  <span><IoIosWarning /></span> {apiError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || verifyCode.length !== 6}
                style={primaryButtonStyle(verifyCode.length === 6 && !isSubmitting)}
              >
                {isSubmitting ? t.vfyVerifying : t.vfyActivate}
              </button>
            </form>

            <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              {t.vfyNotReceived}{" "}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isResending}
                style={{ ...linkButtonStyle, fontSize: "13px", fontWeight: "600", cursor: isResending ? "wait" : "pointer" }}
              >
                {t.vfyResend}
              </button>
            </p>

            {/* Màn này cũng phải có lối ra, nếu không lại thành một ngõ cụt mới. */}
            <p style={{ textAlign: "center", fontSize: "13px", marginTop: 0 }}>
              <button
                type="button"
                onClick={backToLogin}
                style={{ ...linkButtonStyle, color: "var(--text-secondary)", fontSize: "13px" }}
              >
                {t.authXBackToLogin}
              </button>
            </p>
          </div>
        )}

        {step === "forgot" && (
          <div className="auth-card-body" style={bodyStyle}>
            <div style={{ marginBottom: "20px", paddingRight: isModal ? "40px" : 0 }}>
              <h3 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "var(--text-heading)" }}>
                {forgotStage === "request" ? t.fgpTitle : t.fgpResetTitle}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                {forgotStage === "request" ? t.fgpStep1Desc : t.fgpStep2Desc}
              </p>
            </div>

            {forgotMessage && (
              <div style={{
                marginBottom: "16px",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "rgba(34, 197, 94, 0.08)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                color: "var(--text-main)",
                fontSize: "13px",
                lineHeight: "1.6",
              }}>
                {forgotMessage}
              </div>
            )}

            {renderApiError()}

            {forgotStage === "request" ? (
              <form onSubmit={handleForgotRequest}>
                <div style={{ marginBottom: "16px" }}>
                  <label htmlFor="forgotEmail" style={labelStyle}>{t.fgpEmailLabel}</label>
                  <input
                    id="forgotEmail"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder={t.emailPlaceholder}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    style={inputStyle(!!emailError)}
                    onFocus={e => e.target.style.borderColor = "var(--primary)"}
                    onBlur={e => e.target.style.borderColor = emailError ? "#ef4444" : "var(--border-main)"}
                  />
                  {emailError && (
                    <p style={errorTextStyle}><span><IoIosWarning /></span> {emailError}</p>
                  )}
                </div>

                <button type="submit" disabled={isSubmitting} style={primaryButtonStyle(!isSubmitting)}>
                  {isSubmitting ? t.fgpSending : t.fgpSendOtp}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotReset}>
                <div style={{ marginBottom: "16px" }}>
                  <label htmlFor="forgotOtp" style={labelStyle}>{t.fgpOtpLabel}</label>
                  <input
                    id="forgotOtp"
                    name="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setApiError("");
                    }}
                    style={{
                      ...inputStyle(false),
                      fontSize: "22px",
                      letterSpacing: "10px",
                      textAlign: "center",
                      fontWeight: "700",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label htmlFor="forgotNewPwd" style={labelStyle}>{t.fgpNewPwd}</label>
                  <PasswordField
                    id="forgotNewPwd"
                    name="newPassword"
                    autoComplete="new-password"
                    placeholder={t.fgpNewPwd}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setApiError("");
                    }}
                    hasError={false}
                    visible={showNewPassword}
                    onToggle={() => setShowNewPassword((v) => !v)}
                    toggleLabel={showNewPassword ? t.authXHidePwd : t.authXShowPwd}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label htmlFor="forgotConfirmPwd" style={labelStyle}>{t.fgpConfirmNewPwd}</label>
                  <PasswordField
                    id="forgotConfirmPwd"
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder={t.fgpConfirmNewPwd}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setApiError("");
                    }}
                    hasError={!!confirmPassword && confirmPassword !== newPassword}
                    visible={showNewPassword}
                    onToggle={() => setShowNewPassword((v) => !v)}
                    toggleLabel={showNewPassword ? t.authXHidePwd : t.authXShowPwd}
                  />
                </div>

                <p style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  margin: "0 0 16px",
                  background: "var(--bg-input)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  borderLeft: "3px solid var(--primary)",
                }}>
                  {t.passwordRequirement}
                </p>

                <button type="submit" disabled={isSubmitting} style={primaryButtonStyle(!isSubmitting)}>
                  {isSubmitting ? t.fgpConfirming : t.fgpUpdatePwd}
                </button>

                <button
                  type="button"
                  onClick={() => { setForgotStage("request"); setApiError(""); }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    marginBottom: "12px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-main)",
                    background: "var(--bg-card)",
                    color: "var(--text-secondary)",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  {t.goBack}
                </button>
              </form>
            )}

            <p style={{ textAlign: "center", fontSize: "13px", marginTop: "4px", marginBottom: 0 }}>
              <button
                type="button"
                onClick={backToLogin}
                style={{ ...linkButtonStyle, color: "var(--text-secondary)", fontSize: "13px" }}
              >
                {t.authXBackToLogin}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
