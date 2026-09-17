/**
 * Tên điểm đi/đến hiển thị trên ba trang đặt vé, dịch sẵn bốn thứ tiếng.
 *
 * Gom về một chỗ vì trước đây mỗi trang giữ một bản `...Translations` riêng với đúng cùng
 * một hình dạng, và ba bản ấy đã bắt đầu trôi khỏi nhau: thứ tự `baseCodes` mỗi trang một
 * kiểu, cùng một thành phố có nơi ghi "Ga Huế (HUE)" có nơi ghi "Bến xe Phía Nam Huế".
 *
 * KHÔNG gộp ba bảng thành một. Cùng một thành phố nhưng bến xe, nhà ga và sân bay là ba
 * địa điểm khác nhau, và ở vài nơi còn mang MÃ khác nhau (Huế `HUE` với tàu/xe nhưng `HUI`
 * với máy bay; tương tự `NTR`/`CXR`, `DLT`/`DLI`, `VIN`/`VII`). Gộp lại là tự tạo ra đúng
 * loại lỗi mà README đã ghi ở mục Map & Realtime Tracking: một thành phố hiện hai pin, và
 * `search_trips` tra nhầm mã rồi báo "không tìm thấy chuyến nào".
 *
 * Nguồn dữ liệu lâu dài nên là bảng `dia_diem` / `diem_don_tra` dưới CSDL — xem mục 5 phần
 * Thiết kế CSDL trong docs/SRS_FSD_SPECIFICATION.md. File này là chỗ đứng tạm cho tới lúc đó.
 */

/** Bến xe khách. Mã dùng chung với tàu và máy bay ở những nơi có cả ba. */
const BUS_STATIONS = {
    vi: {
      HAN: { name: "Hà Nội", fullName: "Bến xe Mỹ Đình / Giáp Bát" },
      SGN: { name: "TP. HCM", fullName: "Bến xe Miền Đông / Miền Tây" },
      DAD: { name: "Đà Nẵng", fullName: "Bến xe Đà Nẵng" },
      HUE: { name: "Huế", fullName: "Bến xe Phía Nam Huế" },
      HPH: { name: "Hải Phòng", fullName: "Bến xe Niệm Nghĩa" },
      NTR: { name: "Nha Trang", fullName: "Bến xe Phía Nam Nha Trang" },
      DLT: { name: "Đà Lạt", fullName: "Bến xe Đà Lạt" },
      SAP: { name: "Sapa", fullName: "Bến xe Sapa" },
      QNH: { name: "Quảng Ninh", fullName: "Bến xe Bãi Cháy" },
      VIN: { name: "Vinh", fullName: "Bến xe Vinh" },
    },
    en: {
      HAN: { name: "Hanoi", fullName: "My Dinh / Giap Bat Bus Station" },
      SGN: { name: "Ho Chi Minh City", fullName: "Mien Dong / Mien Tay Bus Station" },
      DAD: { name: "Da Nang", fullName: "Da Nang Central Bus Station" },
      HUE: { name: "Hue", fullName: "Hue Southern Bus Station" },
      HPH: { name: "Hai Phong", fullName: "Niem Nghia Bus Station" },
      NTR: { name: "Nha Trang", fullName: "Nha Trang Southern Bus Station" },
      DLT: { name: "Da Lat", fullName: "Da Lat Interprovincial Bus Station" },
      SAP: { name: "Sapa", fullName: "Sapa Bus Station" },
      QNH: { name: "Quang Ninh", fullName: "Bai Chay Bus Station" },
      VIN: { name: "Vinh", fullName: "Vinh Bus Station" },
    },
    ja: {
      HAN: { name: "ハノイ", fullName: "ミーディン / ザップバット バスターミナル" },
      SGN: { name: "ホーチミン", fullName: "ミエンドン / ミエンタイ バスターミナル" },
      DAD: { name: "ダナン", fullName: "ダナン バスターミナル" },
      HUE: { name: "フエ", fullName: "フエ南部バスターミナル" },
      HPH: { name: "ハイフォン", fullName: "ニエムギア バスターミナル" },
      NTR: { name: "ニャチャン", fullName: "ニャチャン南部バスターミナル" },
      DLT: { name: "ダラット", fullName: "ダラット バスターミナル" },
      SAP: { name: "サパ", fullName: "サパ バスターミナル" },
      QNH: { name: "クアンニン", fullName: "バイチャイ バスターミナル" },
      VIN: { name: "ヴィン", fullName: "ヴィン バスターミナル" },
    },
    zh: {
      HAN: { name: "河內", fullName: "美亭 / 甲八 巴士總站" },
      SGN: { name: "胡志明市", fullName: "東部 / 西部 巴士總站" },
      DAD: { name: "峴港", fullName: "峴港巴士總站" },
      HUE: { name: "順化", fullName: "順化南區巴士站" },
      HPH: { name: "海防", fullName: "念義巴士站" },
      NTR: { name: "芽莊", fullName: "芽莊南區巴士站" },
      DLT: { name: "大叻", fullName: "大叻巴士總站" },
      SAP: { name: "沙壩", fullName: "沙壩巴士站" },
      QNH: { name: "廣寧", fullName: "白齋巴士站" },
      VIN: { name: "榮市", fullName: "榮市巴士站" },
    }
  };

/** Ga tàu. */
const TRAIN_STATIONS = {
    vi: {
      HAN: { name: "Hà Nội", fullName: "Ga Hà Nội" },
      SGN: { name: "TP. HCM", fullName: "Ga Sài Gòn" },
      DAD: { name: "Đà Nẵng", fullName: "Ga Đà Nẵng" },
      HUE: { name: "Huế", fullName: "Ga Huế (HUE)" },
      HPH: { name: "Hải Phòng", fullName: "Ga Hải Phòng" },
      NTR: { name: "Nha Trang", fullName: "Ga Nha Trang (NTR)" },
      VIN: { name: "Vinh", fullName: "Ga Vinh (VIN)" },
      DLT: { name: "Đà Lạt", fullName: "Ga Đà Lạt (DLT)" },
      SAP: { name: "Sapa", fullName: "Ga Lào Cai / Sapa" },
      QNH: { name: "Quảng Ninh", fullName: "Ga Hạ Long" },
    },
    en: {
      HAN: { name: "Hanoi", fullName: "Hanoi Railway Station" },
      SGN: { name: "Ho Chi Minh City", fullName: "Saigon Railway Station" },
      DAD: { name: "Da Nang", fullName: "Da Nang Railway Station" },
      HUE: { name: "Hue", fullName: "Hue Railway Station" },
      HPH: { name: "Hai Phong", fullName: "Hai Phong Railway Station" },
      NTR: { name: "Nha Trang", fullName: "Nha Trang Railway Station" },
      VIN: { name: "Vinh", fullName: "Vinh Railway Station" },
      DLT: { name: "Da Lat", fullName: "Da Lat Railway Station" },
      SAP: { name: "Sapa", fullName: "Lao Cai / Sapa Station" },
      QNH: { name: "Quang Ninh", fullName: "Ha Long Railway Station" },
    },
    ja: {
      HAN: { name: "ハノイ", fullName: "ハノイ駅" },
      SGN: { name: "ホーチミン", fullName: "サイゴン駅" },
      DAD: { name: "ダナン", fullName: "ダナン駅" },
      HUE: { name: "フエ", fullName: "フエ駅" },
      HPH: { name: "ハイフォン", fullName: "ハイフォン駅" },
      NTR: { name: "ニャチャン", fullName: "ニャチャン駅" },
      VIN: { name: "ヴィン", fullName: "ヴィン駅" },
      DLT: { name: "ダラット", fullName: "ダラット駅" },
      SAP: { name: "サパ", fullName: "ラオカイ / サパ駅" },
      QNH: { name: "クアンニン", fullName: "ハロン駅" },
    },
    zh: {
      HAN: { name: "河內", fullName: "河內火車站" },
      SGN: { name: "胡志明市", fullName: "西貢火車站" },
      DAD: { name: "峴港", fullName: "峴港火車站" },
      HUE: { name: "順化", fullName: "順化火車站" },
      HPH: { name: "海防", fullName: "海防火車站" },
      NTR: { name: "芽莊", fullName: "芽莊火車站" },
      VIN: { name: "榮市", fullName: "榮市火車站" },
      DLT: { name: "大叻", fullName: "大叻火車站" },
      SAP: { name: "沙壩", fullName: "老街 / 沙壩火車站" },
      QNH: { name: "廣寧", fullName: "下龍火車站" },
    }
  };

/** Sân bay. Lưu ý mã KHÁC với tàu/xe ở vài nơi (HUI vs HUE, CXR vs NTR, DLI vs DLT, VII vs VIN). */
const AIRPORTS = {
    vi: {
      HAN: { name: "Hà Nội", fullName: "Hà Nội (HAN) - Nội Bài" },
      SGN: { name: "TP. HCM", fullName: "TP. Hồ Chí Minh (SGN) - Tân Sơn Nhất" },
      DAD: { name: "Đà Nẵng", fullName: "Đà Nẵng (DAD)" },
      VCL: { name: "Chu Lai", fullName: "Chu Lai (VCL) - Quảng Nam" },
      PQC: { name: "Phú Quốc", fullName: "Phú Quốc (PQC)" },
      CXR: { name: "Nha Trang", fullName: "Nha Trang (CXR) - Cam Ranh" },
      DLI: { name: "Đà Lạt", fullName: "Đà Lạt (DLI) - Liên Khương" },
      HPH: { name: "Hải Phòng", fullName: "Hải Phòng (HPH) - Cát Bi" },
      HUI: { name: "Huế", fullName: "Huế (HUI) - Phú Bài" },
      VII: { name: "Vinh", fullName: "Vinh (VII)" },
    },
    en: {
      HAN: { name: "Hanoi", fullName: "Hanoi (HAN) - Noi Bai Intl" },
      SGN: { name: "Ho Chi Minh City", fullName: "Ho Chi Minh City (SGN) - Tan Son Nhat Intl" },
      DAD: { name: "Da Nang", fullName: "Da Nang (DAD) - Da Nang Intl" },
      VCL: { name: "Chu Lai", fullName: "Chu Lai (VCL) - Quang Nam" },
      PQC: { name: "Phu Quoc", fullName: "Phu Quoc (PQC) - Phu Quoc Intl" },
      CXR: { name: "Nha Trang", fullName: "Nha Trang (CXR) - Cam Ranh Intl" },
      DLI: { name: "Da Lat", fullName: "Da Lat (DLI) - Lien Khuong Airport" },
      HPH: { name: "Hai Phong", fullName: "Hai Phong (HPH) - Cat Bi Intl" },
      HUI: { name: "Hue", fullName: "Hue (HUI) - Phu Bai Intl" },
      VII: { name: "Vinh", fullName: "Vinh (VII) - Vinh Airport" },
    },
    ja: {
      HAN: { name: "ハノイ", fullName: "ハノイ (HAN) - ノイバイ国際空港" },
      SGN: { name: "ホーチミン", fullName: "ホーチミン (SGN) - タンソンニャット国際空港" },
      DAD: { name: "ダナン", fullName: "ダナン (DAD) - ダナン国際空港" },
      VCL: { name: "チュライ", fullName: "チュライ (VCL) - クアンナム" },
      PQC: { name: "フーコック", fullName: "フーコック (PQC) - フーコック国際空港" },
      CXR: { name: "ニャチャン", fullName: "ニャチャン (CXR) - カムラン国際空港" },
      DLI: { name: "ダラット", fullName: "ダラット (DLI) - リエンクオン空港" },
      HPH: { name: "ハイフォン", fullName: "ハイフォン (HPH) - カットビ国際空港" },
      HUI: { name: "フエ", fullName: "フエ (HUI) - フーバイ国際空港" },
      VII: { name: "ヴィン", fullName: "ヴィン (VII) - ヴィン空港" },
    },
    zh: {
      HAN: { name: "河內", fullName: "河內 (HAN) - 內排國際機場" },
      SGN: { name: "胡志明市", fullName: "胡志明市 (SGN) - 新山一國際機場" },
      DAD: { name: "峴港", fullName: "峴港 (DAD) - 峴港國際機場" },
      VCL: { name: "朱萊", fullName: "朱萊 (VCL) - 廣南" },
      PQC: { name: "富國島", fullName: "富國島 (PQC) - 富國國際機場" },
      CXR: { name: "芽莊", fullName: "芽莊 (CXR) - 金蘭國際機場" },
      DLI: { name: "大叻", fullName: "大叻 (DLI) - 蓮姜機場" },
      HPH: { name: "海防", fullName: "海防 (HPH) - 吉碑國際機場" },
      HUI: { name: "順化", fullName: "順化 (HUI) - 符牌國際機場" },
      VII: { name: "榮市", fullName: "榮市 (VII) - 榮市機場" },
    }
  };

/** Thứ tự hiện trong ô chọn điểm đi/đến. Mỗi phương tiện phục vụ một tập điểm khác nhau. */
const CODES = {
  bus: ["HAN", "SGN", "DAD", "HUE", "HPH", "NTR", "DLT", "SAP", "QNH", "VIN"],
  train: ["HAN", "SGN", "DAD", "HUE", "HPH", "NTR", "VIN", "DLT", "SAP", "QNH"],
  air: ["HAN", "SGN", "DAD", "VCL", "PQC", "CXR", "DLI", "HPH", "HUI", "VII"],
};

const DICTS = { bus: BUS_STATIONS, train: TRAIN_STATIONS, air: AIRPORTS };

/**
 * Danh sách điểm đi/đến của một phương tiện, đã dịch sang ngôn ngữ đang hiển thị.
 *
 * Thiếu bản dịch thì rơi về tiếng Việt, và thiếu cả tiếng Việt thì hiện chính mã — thà
 * hiện "VCL" còn hơn hiện một ô trống mà người dùng không chọn được gì.
 *
 * @param {"bus"|"train"|"air"} mode luồng đặt vé
 * @param {string} langCode mã ngôn ngữ đang hiển thị (currentLanguage.code)
 * @returns {Array<{code: string, name: string, fullName: string}>}
 */
export const placesFor = (mode, langCode) => {
  const dict = DICTS[mode];
  const codes = CODES[mode];
  if (!dict || !codes) return [];
  const byLang = dict[langCode] || dict.vi;
  return codes.map((code) => ({
    code,
    name: byLang?.[code]?.name || code,
    fullName: byLang?.[code]?.fullName || code,
  }));
};

export { BUS_STATIONS, TRAIN_STATIONS, AIRPORTS };
