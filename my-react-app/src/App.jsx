import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Header from "./LayOut/Header";
import Home from "./Page/Home";
import Auth from "./Page/Auth";
import AirlineTickets from "./Page/AirlineTickets";
import BusTickets from "./Page/BusTickets";
import TrainTickets from "./Page/TrainTickets";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";
import { SavedPassengersProvider } from "./context/SavedPassengersContext";
import { ThemeProvider } from "./context/ThemeContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import Footer from "./LayOut/Footer";
import MyBookings from "./Page/MyBookings";
import ForgotPassword from "./Page/ForgotPassword";
import VerifyEmail from "./Page/VerifyEmail";
import AdminTrips from "./Page/AdminTrips";
import AdminRoutes from "./Page/AdminRoutes";
import AdminUsers from "./Page/AdminUsers";
import AdminReviews from "./Page/AdminReviews";
import AdminVouchers from "./Page/AdminVouchers";
import VoucherPromotions from "./Page/VoucherPromotions";
import AccountPage from "./Page/AccountPage";
import AdminRevenue from "./Page/AdminRevenue";
import AdminChatbot from "./Page/AdminChatbot";
import ProviderRefunds from "./Page/ProviderRefunds";
import ProviderCheckIn from "./Page/ProviderCheckIn";
import Chatbot from "./components/Chatbot";
import ErrorBoundary from "./components/ErrorBoundary";

import { ToastProvider } from "./context/ToastContext";
import { warmUpBackend } from "./utils/apiClient";

function AppWrapper() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);

  // Đánh thức backend ngay khi mở trang. Render gói free cho container ngủ sau ~15 phút
  // không có lưu lượng, và lần gọi đầu tiên phải chờ 30–60 giây để nó khởi động lại —
  // đủ lâu để proxy của Vercel bỏ cuộc và người dùng nhận về lỗi "Backend lỗi".
  // Gọi trước ở đây thì tới lúc người dùng thật sự bấm đăng nhập, container đã sẵn sàng.
  useEffect(() => {
    warmUpBackend();
  }, []);

  // Toast báo hết phiên đăng nhập nay do AuthContext.forceLogout bắn thẳng, không còn phải
  // gửi qua sessionStorage vì đã bỏ việc tải lại trang khi bị đăng xuất.

  const showHeader = location.pathname !== "/auth" && location.pathname !== "/my-bookings" && location.pathname !== "/forgot-password" && location.pathname !== "/verify-email";
  const showFooter = location.pathname !== "/auth" && location.pathname !== "/my-bookings" && location.pathname !== "/forgot-password" && location.pathname !== "/verify-email";

  return (
    <>
      {showHeader && <Header />}
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ve-may-bay" element={<AirlineTickets />} />
          <Route path="/ve-tau-hoa" element={<TrainTickets />} />
          <Route path="/xe-khach" element={<BusTickets />} />
          <Route path="/uu-dai" element={<VoucherPromotions />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/admin/trips" element={<AdminTrips />} />
          <Route path="/admin/routes" element={<AdminRoutes />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/vouchers" element={<AdminVouchers />} />
          <Route path="/admin/reviews" element={<AdminReviews />} />
          <Route path="/admin/revenue" element={<AdminRevenue />} />
          <Route path="/admin/chatbot" element={<AdminChatbot />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/provider/refunds" element={<ProviderRefunds />} />
          <Route path="/provider/check-in" element={<ProviderCheckIn />} />
        </Routes>
      </ErrorBoundary>
      {showFooter && <Footer />}
      <Chatbot />
    </>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId="326005367827-9hc363n1hv4sls4rcnb4caish7v8fhk2.apps.googleusercontent.com">
      <BrowserRouter>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>
              <AuthProvider>
                <SavedPassengersProvider>
                  <WebSocketProvider>
                    <AppWrapper />
                  </WebSocketProvider>
                </SavedPassengersProvider>
              </AuthProvider>
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;