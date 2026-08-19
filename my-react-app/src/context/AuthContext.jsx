/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
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
      const res = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      setProfile(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  // Nạp hồ sơ mỗi khi đăng nhập lại. Khi đăng xuất, profile đã được xóa trong logout/forceLogout.
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users/me", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setProfile(data);
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
   * Bắt buộc logout khi server trả 401/403 cho tài khoản bị khóa/hết hạn.
   * Lưu thông báo vào sessionStorage để Header/Toast đọc sau khi redirect.
   */
  const forceLogout = useCallback((reason = "Phiên đăng nhập đã hết hạn hoặc tài khoản bị khóa. Vui lòng đăng nhập lại.") => {
    if (!tokenRef.current) return; // chỉ xử lý nếu đang đăng nhập
    setToken(null);
    setUser(null);
    setProfile(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    sessionStorage.setItem("forceLogoutMessage", reason);
    // Redirect về trang chủ — App sẽ xử lý hiển thị toast từ sessionStorage
    window.location.href = "/";
  }, []);

  // Patch global fetch — chặn 401/403 từ API nội bộ → tự động logout
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      // Chỉ xử lý khi đang có token (đang đăng nhập)
      if (tokenRef.current && (response.status === 401 || response.status === 403)) {
        // Kiểm tra có phải URL API nội bộ không (tránh bắt nhầm Google/third-party)
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
        const isInternalApi = url.startsWith("/api") || url.includes(window.location.origin + "/api");

        if (isInternalApi) {
          forceLogout("Tài khoản của bạn đã bị khóa hoặc phiên đăng nhập hết hạn.");
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
