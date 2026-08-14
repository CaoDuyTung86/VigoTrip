import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Header from "./LayOut/Header";
import Home from "./Page/Home";
import Auth from "./Page/Auth";
import AirlineTickets from "./Page/AirlineTickets";
import BusTickets from "./Page/BusTickets";
import TrainTickets from "./Page/TrainTickets";
import OrderByPackage from "./Page/OrderByPackage";
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
import AdminReviews from "./Page/AdminReviews";
import AccountPage from "./Page/AccountPage";
import AdminRevenue from "./Page/AdminRevenue";
import ProviderRefunds from "./Page/ProviderRefunds";
import ProviderCheckIn from "./Page/ProviderCheckIn";
import Chatbot from "./components/Chatbot";

import { ToastProvider } from "./context/ToastContext";

function AppWrapper() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);

  const showHeader = location.pathname !== "/auth" && location.pathname !== "/my-bookings" && location.pathname !== "/forgot-password" && location.pathname !== "/verify-email";
  const showFooter = location.pathname !== "/auth" && location.pathname !== "/my-bookings" && location.pathname !== "/forgot-password" && location.pathname !== "/verify-email";

  return (
    <>
      {showHeader && <Header />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ve-may-bay" element={<AirlineTickets />} />
        <Route path="/ve-tau-hoa" element={<TrainTickets />} />
        <Route path="/xe-khach" element={<BusTickets />} />
        <Route path="/dat-theo-goi" element={<OrderByPackage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/admin/trips" element={<AdminTrips />} />
        <Route path="/admin/reviews" element={<AdminReviews />} />
        <Route path="/admin/revenue" element={<AdminRevenue />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/provider/refunds" element={<ProviderRefunds />} />
        <Route path="/provider/check-in" element={<ProviderCheckIn />} />
      </Routes>
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