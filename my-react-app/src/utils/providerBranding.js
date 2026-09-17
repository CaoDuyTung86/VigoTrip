/**
 * Nhãn hiệu nhà cung cấp hiện trên thẻ chuyến: mã viết tắt, màu chữ và màu nền của ô logo.
 *
 * Ba trang đặt vé trước đây mỗi trang khai một hằng `PROVIDER_LOGOS` riêng. Khoá của bảng
 * là TÊN nhà cung cấp đúng như backend trả về trong `trip.providerName`, nên sai một dấu
 * cách là ô logo im lặng rơi về kiểu mặc định — không lỗi, không cảnh báo, chỉ là một thẻ
 * chuyến trông nhạt hơn những thẻ khác.
 *
 * Để riêng theo phương tiện thay vì trộn một bảng phẳng: tên trùng nhau giữa hai phương
 * tiện là chuyện có thể xảy ra (một nhà xe mở thêm tuyến tàu), và khi đó màu sắc nên theo
 * ngữ cảnh trang chứ không theo thứ tự khai báo.
 */

/** Nhà xe khách. */
const BUS_PROVIDERS = {
  "Phương Trang (FUTA)": {
    code: "FUTA",
    color: "#ef4444",
    bg: "#fef2f2",
  },
  "Thành Bưởi": {
    code: "TB",
    color: "#3b82f6",
    bg: "#eff6ff",
  },
  "Hoàng Long": {
    code: "HL",
    color: "#f59e0b",
    bg: "#fef3c7",
  },
};

/** Nhà vận tải đường sắt. */
const TRAIN_PROVIDERS = {
  "Đường Sắt VN (VNR)": {
    code: "VNR",
    color: "#1d4ed8",
    bg: "#dbeafe",
  },
  "Violette Express": {
    code: "VIO",
    color: "#7c3aed",
    bg: "#f3e8ff",
  },
  "Lotus Train": {
    code: "LOTUS",
    color: "#059669",
    bg: "#d1fae5",
  },
};

/**
 * Ô logo chỉ rộng 52px, nên ảnh nguồn phải là PNG NỀN TRONG SUỐT và đã cắt sát nét.
 *
 * Bản .jpg trước đây hỏng ở hai chỗ. Một, JPG không có kênh trong suốt: nền trắng của
 * ảnh đè lên màu nền `bg` của ô, thành ra một hình chữ nhật trắng nằm giữa ô bo tròn
 * (riêng Vietjet là khối đỏ đặc chọi với nền hồng nhạt). Hai, ảnh để nguyên khung gốc
 * nên 71–91% diện tích là khoảng trắng thừa; `object-fit: contain` co cả khung đó vào
 * 44px, đẩy phần logo thật xuống chỉ còn cao 4–10px — nhoè thành một vệt.
 *
 * Vietnam Airlines dùng RIÊNG bông sen thay vì nguyên lockup: chữ trong lockup không
 * đọc được ở cỡ này, còn biểu tượng gần vuông nên lấp đầy ô. Bamboo giữ cả tên nhưng
 * XẾP CHỒNG lá tre lên trên chữ — lockup gốc nằm ngang tỉ lệ 4:1, nhét vào ô vuông thì
 * chữ chỉ còn cao 8px; xếp chồng kéo tỉ lệ về 1.42 nên chữ to gần gấp đôi. Vietjet không
 * có biểu tượng tách rời nên đành giữ chữ, đổi sang chữ đỏ nền trong suốt.
 *
 * Hai biến thể còn lại của Bamboo vẫn nằm trong /logos nếu muốn đổi: bambooairways.png
 * (chỉ lá tre, rõ nhất nhưng không có tên) và bambooairways-full.png (lockup gốc).
 */
const AIR_PROVIDERS = {
  "Vietnam Airlines": {
    logo: "/logos/vietnamairlines.png",
    code: "VN",
    color: "#005baa",
    bg: "#e6f0fa",
  },
  "Vietjet Air": {
    logo: "/logos/vietjetair.png",
    code: "VJ",
    color: "#e3001b",
    bg: "#fde8eb",
  },
  "Bamboo Airways": {
    logo: "/logos/bambooairways-stacked.png",
    code: "QH",
    color: "#00843d",
    bg: "#e6f3ec",
  },
};

const BY_MODE = { bus: BUS_PROVIDERS, train: TRAIN_PROVIDERS, air: AIR_PROVIDERS };

/**
 * Bảng nhãn hiệu của một luồng đặt vé.
 *
 * @param {"bus"|"train"|"air"} mode
 * @returns {Record<string, {logo?: string, code: string, color: string, bg: string}>}
 */
export const providersFor = (mode) => BY_MODE[mode] || {};

export { BUS_PROVIDERS, TRAIN_PROVIDERS, AIR_PROVIDERS };
