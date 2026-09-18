import { useState } from "react";
import { TbTrain } from "react-icons/tb";

import Sidebar from "../components/Sidebar";
import TrainSeatMap from "../components/TrainSeatMap";
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
const PROVIDER_LOGOS = providersFor("train");

/** Màu nhấn và biểu tượng của luồng này — xem utils/bookingTheme.js. */
const THEME = themeFor("train");

/**
 * Các hạng cao có thể xuất hiện trong sơ đồ chỗ, kèm nhãn hiển thị. Bảng giá tóm tắt đọc
 * hạng thật từ danh sách chỗ thay vì đoán, vì mỗi hạng một mức phụ thu khác nhau.
 */
const PREMIUM_SEAT_TYPES = ["BUSINESS", "VIP", "SLEEPER"];
const premiumSeatLabel = (type, t) => (type === "SLEEPER" ? t.smSleeper : t.business);

/** Nhãn của một hạng chỗ bất kỳ, kể cả hạng thường. */
const seatClassLabel = (type, t) =>
  (PREMIUM_SEAT_TYPES.includes(type) ? premiumSeatLabel(type, t) : t.economy);

/** Giá một chỗ theo hạng, đã chốt sẵn loại phương tiện của trang này. */
const getSeatPrice = (base, seat) => seatPrice("TRAIN", base, seat);

const TrainTickets = () => {
  const [isSidebarOpen] = useState(true); // setter đã bỏ: chỉ từng truyền cho <Header />, mà Header không nhận prop

  /**
   * Luồng đặt vé dùng chung với hai trang phương tiện còn lại — xem hooks/useTicketBooking.js.
   * Giao diện cũng dùng chung: trang này chỉ còn chọn màu, biểu tượng, sơ đồ chỗ và chữ
   * riêng của tàu hoả — xem components/TripResultsList.jsx và các bước đặt vé cạnh nó.
   */
  const booking = useTicketBooking({
    mode: "train",
    tripType: "TRAIN",
    searchFailedKey: "trnSearchFailed",
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
              {t.train}
            </h1>

            <TripSearchPanel
              booking={booking}
              theme={THEME}
              PlaceIcon={TbTrain}
              labels={{
                selectPlace: t.selectTrainStation,
                searchButton: t.searchTrain,
                noCalendarResults: t.noCheapFlights,
              }}
            />

            {step === "chooseTrip" && (
              <TripResultsList
                booking={booking}
                theme={THEME}
                ModeIcon={TbTrain}
                providerLogos={PROVIDER_LOGOS}
                labels={{
                  listTitle: t.listTrainTitle,
                  providerLabel: t.trainProvider,
                  clearProviderFilter: t.clearTrainFilter,
                  noMatchingTrips: t.noMatchingTrainTrips,
                  modeBadge: t.trainBadge,
                  vehicleFallback: t.expressTrain,
                  directRoute: t.directRoute,
                }}
              />
            )}

            <BookingStepper booking={booking} />

            {step === "seatClass" && (
              <SeatSelectionStep
                booking={booking}
                theme={THEME}
                ModeIcon={TbTrain}
                premiumSeatTypes={PREMIUM_SEAT_TYPES}
                premiumSeatLabel={premiumSeatLabel}
                getSeatPrice={getSeatPrice}
                labels={{
                  instruction: t.selectSeatInstruction,
                  ecoSeat: t.economy,
                }}
                seatMap={
                  <TrainSeatMap
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
                ModeIcon={TbTrain}
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
                  mealSub: t.mealSub,
                  noMeals: t.trnNoMeals,
                  buyMealElsewhere: t.trnBuyOnTrain,
                  insuranceTitle: t.travelInsurance,
                  insuranceSub: t.insuranceSub,
                  insuranceTip: t.shortTripInsuranceTip,
                  transferTitle: t.trnStationTaxi,
                  transferSub: t.taxiSub,
                }}
                insuranceRows={[
                  [t.trnInsAccident, `150 ${t.millionVnd}`, `300 ${t.millionVnd}`],
                  [t.insTripCancellation, "✕", t.insFullRefund],
                  [t.insLostBaggage, `2 ${t.millionVnd}`, `5 ${t.millionVnd}`],
                  [t.insMedicalCosts, `5 ${t.millionVnd}`, `20 ${t.millionVnd}`],
                  [t.insFlightDelay, "✕", t.insVnd150k],
                ]}
              />
            )}

            {step === "review" && (
              <ReviewStep
                booking={booking}
                theme={THEME}
                getSeatPrice={getSeatPrice}
                seatClassLabel={seatClassLabel}
                tripLabel={t.trnTripLabel}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainTickets;
