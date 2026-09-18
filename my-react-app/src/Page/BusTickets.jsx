import { useState } from "react";
import { TbBus } from "react-icons/tb";

import Sidebar from "../components/Sidebar";
import BusSeatMap from "../components/BusSeatMap";
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
const PROVIDER_LOGOS = providersFor("bus");

/** Màu nhấn và biểu tượng của luồng này — xem utils/bookingTheme.js. */
const THEME = themeFor("bus");

/**
 * Các hạng cao có thể xuất hiện trong sơ đồ chỗ, kèm nhãn hiển thị. Bảng giá tóm tắt đọc
 * hạng thật từ danh sách chỗ thay vì đoán, vì mỗi hạng một mức phụ thu khác nhau.
 */
const PREMIUM_SEAT_TYPES = ["SLEEPER", "BUSINESS", "VIP"];
const premiumSeatLabel = (type, t) => (type === "SLEEPER" ? t.busSleeperVip : t.business);

/** Nhãn của một hạng chỗ bất kỳ, kể cả hạng thường. */
const seatClassLabel = (type, t) =>
  (PREMIUM_SEAT_TYPES.includes(type) ? premiumSeatLabel(type, t) : t.busEcoSeat);

/** Giá một chỗ theo hạng, đã chốt sẵn loại phương tiện của trang này. */
const getSeatPrice = (base, seat) => seatPrice("BUS", base, seat);

const BusTickets = () => {
  const [isSidebarOpen] = useState(true); // setter đã bỏ: chỉ từng truyền cho <Header />, mà Header không nhận prop

  /**
   * Luồng đặt vé dùng chung với hai trang phương tiện còn lại — xem hooks/useTicketBooking.js.
   * Giao diện cũng dùng chung: trang này chỉ còn chọn màu, biểu tượng, sơ đồ chỗ và chữ
   * riêng của xe khách — xem components/TripResultsList.jsx và các bước đặt vé cạnh nó.
   */
  const booking = useTicketBooking({
    mode: "bus",
    tripType: "BUS",
    searchFailedKey: "busSearchFailed",
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
              {t.bus}
            </h1>

            <TripSearchPanel
              booking={booking}
              theme={THEME}
              PlaceIcon={TbBus}
              labels={{
                selectPlace: t.selectBusStation,
                searchButton: t.searchBus,
                noCalendarResults: t.noCheapFlights,
              }}
            />

            {step === "chooseTrip" && (
              <TripResultsList
                booking={booking}
                theme={THEME}
                ModeIcon={TbBus}
                providerLogos={PROVIDER_LOGOS}
                labels={{
                  listTitle: t.listBusTitle,
                  providerLabel: t.busProvider,
                  clearProviderFilter: t.clearBusFilter,
                  noMatchingTrips: t.noMatchingBusTrips,
                  modeBadge: t.busBadge,
                  vehicleFallback: t.sleeperBus,
                  directRoute: t.directRoute,
                }}
              />
            )}

            <BookingStepper booking={booking} />

            {step === "seatClass" && (
              <SeatSelectionStep
                booking={booking}
                theme={THEME}
                ModeIcon={TbBus}
                premiumSeatTypes={PREMIUM_SEAT_TYPES}
                premiumSeatLabel={premiumSeatLabel}
                getSeatPrice={getSeatPrice}
                labels={{
                  instruction: t.busSelectSeatInstruction,
                  ecoSeat: t.busEcoSeat,
                }}
                seatMap={
                  <BusSeatMap
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
                ModeIcon={TbBus}
                premiumSeatTypes={PREMIUM_SEAT_TYPES}
                premiumSeatLabel={premiumSeatLabel}
                getSeatPrice={getSeatPrice}
              />
            )}

            {selectedTrip && step === "extras" && (
              <ExtrasStep
                booking={booking}
                getSeatPrice={getSeatPrice}
                labels={{
                  baggageTitle: t.baggage,
                  baggageSub: t.busBaggageSub,
                  noExtraBaggage: t.doNotBuyMore,
                  mealSub: t.busMealSub,
                  noMeals: t.busNoMeals,
                  buyMealElsewhere: t.busBuyAtStop,
                  insuranceTitle: t.busTravelInsurance,
                  insuranceSub: t.insuranceSub,
                  insuranceTip: t.shortTripInsuranceTip,
                  transferTitle: t.busShuttle,
                  transferSub: t.busShuttleSub,
                }}
                insuranceRows={[
                  [t.busInsAccident, `50 ${t.millionVnd}`, `100 ${t.millionVnd}`],
                  [t.insTripCancellation, "✕", t.insFullRefund],
                  [t.insLostBaggage, `1 ${t.millionVnd}`, `3 ${t.millionVnd}`],
                  [t.insMedicalCosts, `2 ${t.millionVnd}`, `10 ${t.millionVnd}`],
                  [t.insFlightDelay, "✕", t.insVnd100k],
                ]}
              />
            )}

            {step === "review" && (
              <ReviewStep
                booking={booking}
                theme={THEME}
                getSeatPrice={getSeatPrice}
                seatClassLabel={seatClassLabel}
                tripLabel={t.busTripLabel}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusTickets;
