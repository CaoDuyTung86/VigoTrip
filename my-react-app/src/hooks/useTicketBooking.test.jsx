import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

/**
 * Hook này thay cho ba bản sao logic đặt vé từng nằm trong `BusTickets`, `TrainTickets` và
 * `AirlineTickets`. Bộ test tập trung vào đúng thứ mà việc gộp có thể làm hỏng: BẢY điểm
 * khác nhau giữa ba luồng: nếu gộp sai thì trang tàu sẽ đi hỏi máy chủ về chuyến xe khách,
 * hoặc ghi đè bản nháp của luồng khác — cả hai đều không ném lỗi, chỉ trả về kết quả sai.
 *
 * Các context bên ngoài được thay bằng bản giả tối thiểu: hook chỉ đọc vài trường của
 * chúng, còn hành vi thật của WebSocket đã có WebSocketContext.test.jsx lo.
 */

const showToast = vi.fn();
const unlockSeats = vi.fn();
const lockSeats = vi.fn(async () => ({ success: true }));

// Bảng dịch giả: trả về chính khoá, để test đối chiếu được khoá nào đã dùng.
const t = new Proxy({}, { get: (_, key) => String(key) });

vi.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({ t, currentLanguage: { code: "vi" } }),
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    token: "token-test",
    isAuthenticated: true,
    user: null,
    membershipDiscountPercent: 0,
  }),
}));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ showToast }) }));
vi.mock("../context/WebSocketContext", () => ({
  useWebSocket: () => ({
    isConnected: true,
    ownerToken: "owner-test",
    subscribeToTrip: () => ({ unsubscribe: () => {} }),
    lockSeats,
    unlockSeats,
    handoverSeats: vi.fn(),
  }),
}));
vi.mock("../context/SavedPassengersContext", () => ({
  useSavedPassengers: () => ({ savedPassengers: [], addPassenger: vi.fn() }),
}));
vi.mock("react-router-dom", () => ({ useLocation: () => ({ search: "" }) }));

const useTicketBooking = (await import("./useTicketBooking")).default;
const { writeDraft, clearDraft } = await import("../utils/bookingDraft");

const CONFIGS = {
  bus: { mode: "bus", tripType: "BUS", searchFailedKey: "busSearchFailed" },
  train: { mode: "train", tripType: "TRAIN", searchFailedKey: "trnSearchFailed" },
  air: {
    mode: "air",
    tripType: "PLANE",
    searchFailedKey: "airSearchFailed",
    calendarCountsInfants: true,
  },
};

/** URL của lần gọi fetch khớp `fragment`, hoặc null. */
const urlMatching = (fragment) => {
  const call = globalThis.fetch.mock.calls.find((c) => String(c[0]).includes(fragment));
  return call ? new URL(String(call[0]), "http://localhost") : null;
};

describe("useTicketBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => [], text: async () => "" }));
  });

  afterEach(() => {
    for (const mode of ["bus", "train", "air"]) clearDraft(mode);
  });

  describe("mã loại chuyến gửi lên máy chủ", () => {
    it.each([
      ["bus", "BUS"],
      ["train", "TRAIN"],
      ["air", "PLANE"],
    ])("luồng %s hỏi máy chủ về chuyến loại %s", async (mode, expectedType) => {
      const { result } = renderHook(() => useTicketBooking(CONFIGS[mode]));

      await act(async () => {
        await result.current.performSearch("HAN", "SGN", "2026-10-01", 2);
      });

      expect(urlMatching("/trips/search").searchParams.get("type")).toBe(expectedType);
    });

    it("lịch giá cũng dùng đúng mã loại chuyến đó", async () => {
      const { result } = renderHook(() => useTicketBooking(CONFIGS.train));

      await act(async () => {
        await result.current.loadCalendar();
      });

      expect(urlMatching("/trips/calendar").searchParams.get("type")).toBe("TRAIN");
    });
  });

  describe("bản nháp tách riêng theo luồng", () => {
    it("trang tàu KHÔNG khôi phục bản nháp mà trang xe khách để lại", async () => {
      // Dùng chung một khoá thì bấm sang trang tàu sẽ dựng lại lượt đặt vé xe khách:
      // chuyến, ghế và tiền đều của một phương tiện khác.
      writeDraft("bus", {
        step: "seatClass",
        tripId: 99,
        selectedTrip: { id: 99, price: 100000 },
        selectedSeatIds: [1],
        lockDeadline: Date.now() + 600000,
        from: "HAN",
        to: "SGN",
        date: "2026-10-01",
        passengerCounts: { adult: 1, child: 0, infant: 0 },
        contactInfo: {},
        passengerInfoList: [],
        globalContact: {},
        selectedServiceIds: [],
        selectedSeatClass: "",
        promoCode: "",
      });

      const { result } = renderHook(() => useTicketBooking(CONFIGS.train));

      // Không có gì để khôi phục -> không đi hỏi sơ đồ ghế của chuyến 99.
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.selectedTrip).toBeNull();
      expect(urlMatching("/trips/99/seats")).toBeNull();
    });

    it("đúng luồng của mình thì có khôi phục", async () => {
      writeDraft("train", {
        step: "seatClass",
        tripId: 77,
        selectedTrip: { id: 77, price: 100000 },
        selectedSeatIds: [],
        lockDeadline: Date.now() + 600000,
        from: "HAN",
        to: "DAD",
        date: "2026-10-02",
        passengerCounts: { adult: 1, child: 0, infant: 0 },
        contactInfo: {},
        passengerInfoList: [],
        globalContact: {},
        selectedServiceIds: [],
        selectedSeatClass: "",
        promoCode: "",
      });

      const { result } = renderHook(() => useTicketBooking(CONFIGS.train));

      await waitFor(() => expect(urlMatching("/trips/77/seats")).not.toBeNull());
      await waitFor(() => expect(result.current.selectedTrip?.id).toBe(77));
    });
  });

  describe("câu báo lỗi riêng của từng luồng", () => {
    it.each([
      ["bus", "busSearchFailed"],
      ["train", "trnSearchFailed"],
      ["air", "airSearchFailed"],
    ])("luồng %s báo bằng khoá %s khi tìm chuyến hỏng", async (mode, expectedKey) => {
      globalThis.fetch = vi.fn(async () => ({ ok: false, text: async () => "loi" }));
      const { result } = renderHook(() => useTicketBooking(CONFIGS[mode]));

      await act(async () => {
        await result.current.performSearch("HAN", "SGN", "2026-10-01", 1);
      });

      expect(showToast).toHaveBeenCalledWith(expectedKey, "error");
    });
  });

  describe("số hành khách gửi lên lịch giá", () => {
    // Khác biệt này có từ TRƯỚC lần gộp và được giữ nguyên có chủ ý, vì con số này
    // quyết định ngày nào bị chấm là hết chỗ trên lịch giá.
    it("xe khách và tàu KHÔNG đếm em bé", async () => {
      const { result } = renderHook(() => useTicketBooking(CONFIGS.bus));

      act(() => {
        result.current.changePassengerCount("infant", 2);
      });
      await act(async () => {
        await result.current.loadCalendar();
      });

      expect(urlMatching("/trips/calendar").searchParams.get("passengers")).toBe("1");
    });

    it("máy bay CÓ đếm em bé", async () => {
      const { result } = renderHook(() => useTicketBooking(CONFIGS.air));

      act(() => {
        result.current.changePassengerCount("infant", 2);
      });
      await act(async () => {
        await result.current.loadCalendar();
      });

      expect(urlMatching("/trips/calendar").searchParams.get("passengers")).toBe("3");
    });
  });

  describe("điểm đi/đến theo phương tiện", () => {
    it("mỗi luồng nhận đúng danh mục của nó", () => {
      const bus = renderHook(() => useTicketBooking(CONFIGS.bus)).result.current.stations;
      const air = renderHook(() => useTicketBooking(CONFIGS.air)).result.current.stations;

      expect(bus.map((s) => s.code)).toContain("HUE");
      expect(air.map((s) => s.code)).toContain("HUI");
      expect(air.map((s) => s.code)).not.toContain("HUE");
    });
  });

  describe("giữ chỗ và số chỗ tối đa", () => {
    it("em bé không chiếm chỗ nên không làm tăng số ghế phải chọn", () => {
      const { result } = renderHook(() => useTicketBooking(CONFIGS.bus));

      act(() => {
        result.current.changePassengerCount("child", 1);
        result.current.changePassengerCount("infant", 1);
      });

      // 1 người lớn + 1 trẻ em = 2 chỗ; em bé ngồi cùng người lớn.
      expect(result.current.maxSeats).toBe(2);
    });

    it("đổi số hành khách thì nhả hết ghế đang giữ", () => {
      const { result } = renderHook(() => useTicketBooking(CONFIGS.bus));

      act(() => {
        result.current.setSelectedSeatIds([11, 12]);
      });
      act(() => {
        result.current.changePassengerCount("adult", 1);
      });

      expect(unlockSeats).toHaveBeenCalledWith(
        expect.objectContaining({ seatIds: [11, 12] })
      );
      expect(result.current.selectedSeatIds).toEqual([]);
    });

    it("số hành khách bị khoá từ bước chọn ghế trở đi", () => {
      const { result } = renderHook(() => useTicketBooking(CONFIGS.bus));

      expect(result.current.passengerCountLocked).toBe(false);

      act(() => {
        result.current.handleSelectTrip({ id: 1, price: 100000 });
      });
      act(() => {
        result.current.setStep("passenger");
      });

      expect(result.current.passengerCountLocked).toBe(true);
    });
  });

  describe("phản hồi rỗng từ máy chủ", () => {
    // Trước khi gộp, BusTickets viết `setSeats(data || [])` còn hai trang kia viết
    // `setSeats(data)`, nên cùng một phản hồi `null` thì xe khách hiện sơ đồ trống
    // còn tàu và máy bay vỡ trang. Nay cả ba đi chung một đường.
    it.each(["bus", "train", "air"])("luồng %s nhận null mà không vỡ", async (mode) => {
      globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => null }));
      const { result } = renderHook(() => useTicketBooking(CONFIGS[mode]));

      await act(async () => {
        await result.current.handleSelectTrip({ id: 5, price: 100000 });
      });

      expect(result.current.seats).toEqual([]);
      expect(result.current.step).toBe("seatClass");
    });
  });
});
