/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/apiClient";
import { useToast } from "./ToastContext";

const AuthContext = createContext(null);

/**
 * Những khu vực chỉ xem được khi đã đăng nhập — mất phiên ở đây thì buộc phải rời trang.
 * Mọi nơi khác (nhất là luồng đặt vé) phải ở nguyên chỗ cũ.
 */
const AUTH_ONLY_PREFIXES = ["/admin", "/account", "/my-bookings", "/provider"];

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("authUser");
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch {
        localStorage.removeItem("authUser");
      }
    }
    return null;
  });

  const [token, setToken] = useState(() => {
    const storedToken = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("authUser");
    if (storedToken && storedUser) {
      return storedToken;
    }
    if (!storedUser) {
      localStorage.removeItem("authToken");
    }
    return null;
  });

  // Hồ sơ đầy đủ lấy từ /api/users/me — chứa điểm tích lũy, hạng và % giảm giá thành viên.
  // Backend LUÔN trừ % này trước khi áp voucher khi tạo booking, nên giao diện phải
  // biết con số này thì bảng "Chi tiết thanh toán" mới khớp số tiền thật lúc thanh toán.
  const [profile, setProfile] = useState(null);

  // ref để interceptor fetch luôn truy cập token mới nhất mà không re-subscribe
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const refreshProfile = useCallback(async () => {
    if (!tokenRef.current) {
      setProfile(null);
      return null;
    }
    try {
      const { ok, data } = await apiFetch(
        "/api/users/me",
        { headers: { Authorization: `Bearer ${tokenRef.current}` } },
      );
      if (!ok || !data) return null;
      setProfile(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  // Nạp hồ sơ mỗi khi đăng nhập lại. Khi đăng xuất, profile đã được xóa trong logout/forceLogout.
  //
  // Dùng apiFetch (có retry) thay vì fetch trần: nếu backend đang "thức dậy" và lần gọi này
  // thất bại, profile sẽ đứng ở null → membershipDiscountPercent = 0 → bảng "Chi tiết thanh toán"
  // hiển thị sai số tiền so với lúc backend thực sự tạo booking.
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { ok, data } = await apiFetch(
          "/api/users/me",
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!ok || !data || cancelled) return;
        setProfile(data);
      } catch {
        // giữ nguyên profile hiện tại, lần điều hướng sau sẽ thử lại
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const loginSuccess = useCallback((authData) => {
    if (!authData) return;

    const authUser = {
      email: authData.email,
      fullName: authData.fullName,
      role: authData.role,
    };

    setToken(authData.token);
    setUser(authUser);

    localStorage.setItem("authToken", authData.token);
    localStorage.setItem("authUser", JSON.stringify(authUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setProfile(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
  }, []);

  /**
   * Bắt buộc logout khi server trả 401 cho tài khoản bị khóa/hết hạn.
   *
   * Trước đây hàm này làm `window.location.href = "/"`: tải lại cả trang, cuốn theo toàn bộ
   * form đặt vé đang dở (chuyến, ghế đã giữ, thông tin hành khách, dịch vụ, mã giảm giá) —
   * chỉ vì một request nền hết hạn phiên. Giờ chỉ xoá phiên tại chỗ và báo bằng toast;
   * điều hướng chỉ xảy ra khi đang đứng trong khu vực bắt buộc đăng nhập, và bằng router
   * chứ không tải lại trang.
   */
  const forceLogout = useCallback((reason = "Phiên đăng nhập đã hết hạn hoặc tài khoản bị khóa. Vui lòng đăng nhập lại.") => {
    if (!tokenRef.current) return; // chỉ xử lý nếu đang đăng nhập
    setToken(null);
    setUser(null);
    setProfile(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    showToast(reason, "error", 6000);

    if (AUTH_ONLY_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix))) {
      navigate("/", { replace: true });
    }
  }, [navigate, showToast]);

  /**
   * Patch global fetch — chỉ đăng xuất khi API nội bộ trả về 401.
   *
   * Trước đây hàm này đăng xuất với CẢ 403, và đó là nguyên nhân của lỗi
   * "tài khoản đã bị khóa / phiên đăng nhập hết hạn" xuất hiện ngẫu nhiên:
   *   - Spring Security trả 403 cho cả "thiếu quyền" lẫn "chưa xác thực", nên chỉ cần
   *     người dùng thường vô tình chạm vào một endpoint dành cho admin/nhà xe là bị
   *     đá ra ngoài, dù phiên đăng nhập vẫn còn nguyên hiệu lực.
   *   - Tài khoản tạo bằng Google Login (password = null) làm CustomUserDetailsService
   *     ném lỗi → mọi request đều 403 → đăng nhập xong là bị đăng xuất ngay.
   * Backend nay đã tách bạch: 401 = phiên thật sự không còn hiệu lực, 403 = thiếu quyền.
   * Xem RestAuthenticationHandlers.java phía backend.
   */
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      // Chỉ xử lý khi đang có token (đang đăng nhập)
      if (tokenRef.current && response.status === 401) {
        // Kiểm tra có phải URL API nội bộ không (tránh bắt nhầm Google/third-party)
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
        const isInternalApi = url.startsWith("/api") || url.includes(window.location.origin + "/api");

        // Endpoint /api/auth/* là public: 401 ở đó là kết quả của thao tác đăng nhập,
        // không phải dấu hiệu phiên hiện tại đã hỏng.
        const isAuthEndpoint = url.includes("/api/auth/");

        if (isInternalApi && !isAuthEndpoint) {
          forceLogout("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [forceLogout]);

  const value = useMemo(() => ({
    user: user && profile ? { ...user, ...profile } : user,
    profile,
    // % giảm giá theo hạng thành viên (0 nếu chưa đăng nhập / hạng Đồng)
    membershipDiscountPercent: Number(profile?.discountPercent) || 0,
    membershipLevel: profile?.membershipLevel || null,
    refreshProfile,
    token,
    isAuthenticated: !!token,
    loginSuccess,
    logout,
    forceLogout,
  }), [user, profile, token, loginSuccess, logout, forceLogout, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
