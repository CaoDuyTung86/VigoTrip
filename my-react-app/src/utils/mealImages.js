// Ảnh minh hoạ suất ăn nằm trong /public/suat an/.
//
// Tra theo MÃ dịch vụ (AdditionalServiceSeeder.CATALOG), không tra theo tên nữa.
//
// Bản cũ tra bằng nguyên tên tiếng Việt và vẫn chạy đúng, vì tên đưa vào là tên THÔ từ cơ sở
// dữ liệu chứ không phải tên đã dịch. Nhưng nó buộc tên dịch vụ phải bất biến: sửa một dấu
// phẩy trong seeder là ảnh của combo đó lặng lẽ rơi về ảnh Unsplash dùng chung, và không có
// gì báo. Mã thì không đổi theo câu chữ.
const MEAL_IMAGES_BY_CODE = {
  MEAL_BANH_CHUNG: "/suat an/Combo Banh chung cha bong, hat dieu va nuoc suoi.jpg",
  MEAL_BUN_XAO_SINGAPORE: "/suat an/Combo Bun xao Singapore va Nuoc suoi va Hat dieu.jpg",
  MEAL_COM_CHIEN_THAI: "/suat an/Combo Com chien Thai va Nuoc suoi va Hat dieu.jpg",
  MEAL_COM_CHIEN_DUONG_CHAU_CHAY: "/suat an/Combo Com chien duong chau chay va Nuoc suoi va Hat dieu.jpg",
  MEAL_COM_THIT_BO: "/suat an/Combo Com thit bo, hat dieu va nuoc suoi.jpg",
  MEAL_HATTRICK_BIA: "/suat an/Combo Hattrick Bia, Kho ga va Cha gio.jpg",
  MEAL_MIEN_XAO_TOM_CUA: "/suat an/Combo Mien xao Tom cua va Nuoc suoi va Hat dieu.jpg",
  MEAL_MY_Y: "/suat an/Combo My Y va Nuoc suoi va Hat dieu.jpg",
  MEAL_PENALTY_SODA: "/suat an/Combo Penalty Soda Dau va Hat Macca.jpg",
  MEAL_XOI_KHUC_GIO: "/suat an/Combo Xoi khuc gio, hat dieu va nuoc suoi.jpg",
  MEAL_XOI_MAN: "/suat an/Combo Xoi man, hat dieu va nuoc suoi.jpg",
};

// Đường lui cho khoảng thời gian dữ liệu cũ chưa được gắn mã (xem backfillCodes ở seeder).
const MEAL_IMAGES_BY_NAME = {
  "Suất ăn - Combo Bánh chưng chà bông, hạt điều & nước suối": MEAL_IMAGES_BY_CODE.MEAL_BANH_CHUNG,
  "Suất ăn - Combo Bún xào Singapore, nước suối & hạt điều": MEAL_IMAGES_BY_CODE.MEAL_BUN_XAO_SINGAPORE,
  "Suất ăn - Combo Cơm chiên Thái, nước suối & hạt điều": MEAL_IMAGES_BY_CODE.MEAL_COM_CHIEN_THAI,
  "Suất ăn - Combo Cơm chiên Dương Châu chay, nước suối & hạt điều": MEAL_IMAGES_BY_CODE.MEAL_COM_CHIEN_DUONG_CHAU_CHAY,
  "Suất ăn - Combo Cơm thịt bò, hạt điều & nước suối": MEAL_IMAGES_BY_CODE.MEAL_COM_THIT_BO,
  "Suất ăn - Combo Hattrick Bia, khô gà & chả giò": MEAL_IMAGES_BY_CODE.MEAL_HATTRICK_BIA,
  "Suất ăn - Combo Miến xào tôm cua, nước suối & hạt điều": MEAL_IMAGES_BY_CODE.MEAL_MIEN_XAO_TOM_CUA,
  "Suất ăn - Combo Mỳ Ý, nước suối & hạt điều": MEAL_IMAGES_BY_CODE.MEAL_MY_Y,
  "Suất ăn - Combo Penalty Soda dâu & hạt Macca": MEAL_IMAGES_BY_CODE.MEAL_PENALTY_SODA,
  "Suất ăn - Combo Xôi khúc giò, hạt điều & nước suối": MEAL_IMAGES_BY_CODE.MEAL_XOI_KHUC_GIO,
  "Suất ăn - Combo Xôi mặn, hạt điều & nước suối": MEAL_IMAGES_BY_CODE.MEAL_XOI_MAN,
};

/** @param {{serviceCode?: string, serviceName?: string}} service dòng dịch vụ từ backend */
export const getMealImage = (service) => {
  if (!service) return null;
  return MEAL_IMAGES_BY_CODE[service.serviceCode]
    || MEAL_IMAGES_BY_NAME[service.serviceName]
    || null;
};

export default MEAL_IMAGES_BY_CODE;
