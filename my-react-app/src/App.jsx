import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useState } from "react";
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
import Footer from "./LayOut/Footer";
import MyBookings from "./Page/MyBookings";
import ForgotPassword from "./Page/ForgotPassword";
import VerifyEmail from "./Page/VerifyEmail";
import AdminTrips from "./Page/AdminTrips";
import AdminReviews from "./Page/AdminReviews";
import AccountPage from "./Page/AccountPage";
import AdminRevenue from "./Page/AdminRevenue";
import ProviderRefunds from "./Page/ProviderRefunds";
import Chatbot from "./components/Chatbot";

function AppWrapper() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const showHeader = location.pathname !== "/auth" && location.pathname !== "/my-bookings" && location.pathname !== "/forgot-password" && location.pathname !== "/verify-email";
  const showFooter = location.pathname !== "/auth" && location.pathname !== "/my-bookings" && location.pathname !== "/forgot-password" && location.pathname !== "/verify-email";

  return (
    <>
      {showHeader && <Header setIsSidebarOpen={setIsSidebarOpen} />}
      <Routes>
        <Route path="/" element={<Home isSidebarOpen={isSidebarOpen} />} />
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
            <AuthProvider>
              <SavedPassengersProvider>
                <AppWrapper />
              </SavedPassengersProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;