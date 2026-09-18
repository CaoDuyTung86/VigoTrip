// @ts-check
import { useState } from "react";
import { FaPlaneDeparture } from "react-icons/fa";

import Sidebar from "../components/Sidebar";
import AirplaneSeatMap from "../components/AirplaneSeatMap";
import TripSearchPanel from "../components/TripSearchPanel";
import TripResultsList from "../components/TripResultsList";
import BookingStepper from "../components/BookingStepper";
import SeatSelectionStep from "../components/SeatSelectionStep";
import PassengerStep from "../components/PassengerStep";
import ExtrasStep from "../components/ExtrasStep";
import ReviewStep from "../components/ReviewStep";

import useTicketBooking from "../hooks/useTicketBooking";
import { canSelectSeats, isSeatLockedByOthers } from "../utils/seatBookingHelpers";
import { seatPrice } from "../utils/seatPricing";
import { providersFor } from "../utils/providerBranding";
import { themeFor } from "../utils/bookingTheme";

/** Nhãn hiệu nhà cung cấp của luồng này — xem utils/providerBranding.js. */
const PROVIDER_LOGOS = providersFor("air");

/** Màu nhấn và biểu tượng của luồng này — xem utils/bookingTheme.js. */
const THEME = themeFor("air");

/**
 * Máy bay chỉ có MỘT hạng cao, và `utils/seatPricing.js` cũng chỉ tính phụ thu cho đúng
 * hạng ấy — giống hệt `BookingService` ở backend. Bản cũ của trang này từng coi VIP và
 * SLEEPER cũng là hạng cao ở bước nhập hành khách, tức là hứa một mức giá mà backend
 * không thu; nay danh sách hạng chỉ khai ở một chỗ.
 */
const PREMIUM_SEAT_TYPES = ["BUSINESS"];
const premiumSeatLabel = (_type, t) => t.business;

/** Nhãn của một hạng chỗ bất kỳ, kể cả hạng thường. */
const seatClassLabel = (type, t) =>
  (PREMIUM_SEAT_TYPES.includes(type) ? premiumSeatLabel(type, t) : t.economy);

/** Giá một chỗ theo hạng, đã chốt sẵn loại phương tiện của trang này. */
const getSeatPrice = (base, seat) => seatPrice("PLANE", base, seat);

const AirlineTickets = () => {
  const [isSidebarOpen] = useState(true); // setter đã bỏ: chỉ từng truyền cho <Header />, mà Header không nhận prop

  /**
   * Luồng đặt vé dùng chung với hai trang phương tiện còn lại — xem hooks/useTicketBooking.js.
   * Giao diện cũng dùng chung: trang này chỉ còn chọn màu, biểu tượng, sơ đồ chỗ và chữ
   * riêng của máy bay — xem components/TripResultsList.jsx và các bước đặt vé cạnh nó.
   */
  const booking = useTicketBooking({
    mode: "air",
    tripType: "PLANE",
    searchFailedKey: "airSearchFailed",
    calendarCountsInfants: true,
  });
  const {
    t, step, seats, selectedSeatIds, toggleSeat, maxSeats, isMaxReached,
    selectedSeatClass, setSelectedSeatClass, ownerToken, user, isAuthenticated, selectedTrip,
  } = booking;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)" }}>

      {/* App.jsx đã dựng <Header /> cho route này. Trang tự dựng thêm một cái nữa là
          hai header position:fixed chồng khít lên nhau — từ khi có ngăn kéo mobile thành
          hai hamburger, hai ngăn kéo trong DOM. Prop setIsSidebarOpen cũng chưa bao giờ
          có tác dụng: Header không nhận prop nào. */}

      <div className="page-with-sidebar">
        <Sidebar isOpen={isSidebarOpen} />
        <div
          className={`page-main ${isSidebarOpen ? "with-sidebar" : ""}`}
          style={{ backgroundColor: "var(--bg-main)" }}
        >
          <div className="page-content-wrap" style={{ maxWidth: "1200px" }}>
            <h1 style={{ fontSize: "32px", fontWeight: "700", color: "var(--text-main)", marginBottom: "30px" }}>
              {t.flight}
            </h1>

            <TripSearchPanel
              booking={booking}
              theme={THEME}
              PlaceIcon={FaPlaneDeparture}
              labels={{
                selectPlace: t.selectAirport,
                searchButton: t.searchFlight,
                noCalendarResults: t.noCheapFlights,
              }}
            />

            {step === "chooseTrip" && (
              <TripResultsList
                booking={booking}
                theme={THEME}
                ModeIcon={FaPlaneDeparture}
                providerLogos={PROVIDER_LOGOS}
                labels={{
                  listTitle: t.listFlightTitle,
                  providerLabel: t.airlineProvider,
                  clearProviderFilter: t.clearAirlineFilter,
                  noMatchingTrips: t.noMatchingFlightTrips,
                  modeBadge: t.airlineBadge,
                  vehicleFallback: t.commercialFlight,
                  directRoute: t.directFlightRoute,
                }}
              />
            )}

            <BookingStepper booking={booking} />

            {step === "seatClass" && (
              <SeatSelectionStep
                booking={booking}
                theme={THEME}
                ModeIcon={FaPlaneDeparture}
                premiumSeatTypes={PREMIUM_SEAT_TYPES}
                premiumSeatLabel={premiumSeatLabel}
                getSeatPrice={getSeatPrice}
                labels={{
                  instruction: t.selectSeatInstruction,
                  ecoSeat: t.economy,
                }}
                seatMap={
                  <AirplaneSeatMap
                    seats={seats}
                    selectedSeatIds={selectedSeatIds}
                    onToggleSeat={toggleSeat}
                    isSeatLockedByOthers={isSeatLockedByOthers}
                    ownerToken={ownerToken}
                    user={user}
                    isAuthenticated={isAuthenticated}
                    canSelectSeats={canSelectSeats}
                    isMaxReached={isMaxReached}
                    maxSeats={maxSeats}
                    selectedSeatClass={selectedSeatClass}
                    setSelectedSeatClass={setSelectedSeatClass}
                  />
                }
              />
            )}

            {step === "passenger" && (
              <PassengerStep
                booking={booking}
                theme={THEME}
                ModeIcon={FaPlaneDeparture}
                premiumSeatTypes={PREMIUM_SEAT_TYPES}
                premiumSeatLabel={premiumSeatLabel}
                getSeatPrice={getSeatPrice}
              />
            )}

            {selectedTrip && step === "extras" && (
              <ExtrasStep
                booking={booking}
                getSeatPrice={getSeatPrice}
                baggageOptionLabel={(s) => s.serviceName.replace(/[^\d]+/g, "") + "kg"}
                labels={{
                  baggageTitle: t.checkedBaggage,
                  baggageSub: t.baggageSub,
                  noExtraBaggage: t.doNotBuy,
                  mealSub: t.mealSub,
                  noMeals: t.airlineNoMeals,
                  buyMealElsewhere: t.buyOnboard,
                  insuranceTitle: t.travelInsurance,
                  insuranceSub: t.insuranceSub,
                  insuranceTip: t.insuranceTip,
                  transferTitle: t.airportTaxi,
                  transferSub: t.taxiSub,
                }}
                insuranceRows={[
                  [t.insFlightAccident, `250 ${t.millionVnd}`, `500 ${t.millionVnd}`],
                  [t.insTripCancellation, "✕", t.insFullRefund],
                  [t.insLostBaggage, `2 ${t.millionVnd}`, `5 ${t.millionVnd}`],
                  [t.insMedicalCosts, `10 ${t.millionVnd}`, `50 ${t.millionVnd}`],
                  [t.insFlightDelay, "✕", t.insDelayComp],
                ]}
              />
            )}

            {step === "review" && (
              <ReviewStep
                booking={booking}
                theme={THEME}
                getSeatPrice={getSeatPrice}
                seatClassLabel={seatClassLabel}
                tripLabel={t.flightLabel}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AirlineTickets;
