// @ts-check
/**
 * Nguồn duy nhất để đọc danh mục dịch vụ bổ sung mà backend trả về.
 *
 * Trước đây ba trang đặt vé (tàu / xe khách / máy bay) mỗi trang tự chép một bản logic
 * giống nhau, và cả ba đều bám vào CHỮ TIẾNG VIỆT trong tên dịch vụ:
 *
 *   - xếp nhóm bằng `serviceName.startsWith("Suất ăn")`, `.includes("Bảo hiểm")`...
 *   - lấy tên ngắn bằng cách regex-replace tiền tố "Bảo hiểm du lịch " ra khỏi tên
 *   - tra ảnh suất ăn bằng nguyên chuỗi tên tiếng Việt
 *
 * Ba hệ quả đã thấy trên bản deploy:
 *
 *   1. Khách xem bản English vẫn đọc "Hành lý ký gửi 20kg", "Combo Bún xào Singapore..."
 *      vì không có chỗ nào để móc bản dịch vào.
 *   2. Trang tàu cắt tiền tố "Taxi đưa đón sân ga" trong khi dữ liệu ghi "Taxi đưa đón sân
 *      bay" — regex trượt, nhãn hiện nguyên cả câu.
 *   3. Bảo hiểm hiện ra "cơ bản" / "cao cấp" viết thường, vì phần bị cắt là "Bảo hiểm du
 *      lịch " còn lại đúng cái đuôi.
 *
 * Giờ backend trả kèm `serviceCode` (khoá cố định) và `category` (nhóm). Tên tiếng Việt tụt
 * xuống vai trò chữ dự phòng, dùng khi gặp dòng do quản trị viên tự thêm nên chưa có mã.
 */

/** Phải khớp với các hằng CAT_* trong AdditionalServiceSeeder.java. */
export const SERVICE_CATEGORY = {
  BAGGAGE: "BAGGAGE",
  MEAL: "MEAL",
  INSURANCE: "INSURANCE",
  TRANSFER: "TRANSFER",
};

/**
 * Nhận diện nhóm cho những dòng chưa có `category`.
 *
 * Tồn tại vì một lý do hẹp: lần deploy đầu sau khi thêm cột, backend cần một vòng khởi động
 * để gắn mã cho dữ liệu cũ; và dòng do quản trị viên tự thêm thì không bao giờ có mã. Không
 * có nhánh này thì trong khoảng đó màn hình chọn dịch vụ trống trơn, khách không mua được gì.
 * Đây là đường lui, không phải đường chính — đừng thêm case mới vào đây, hãy thêm vào CATALOG
 * của seeder.
 */
const guessCategory = (serviceName = "") => {
  const name = serviceName.toLowerCase();
  if (name.startsWith("suất ăn")) return SERVICE_CATEGORY.MEAL;
  if (name.includes("hành lý")) return SERVICE_CATEGORY.BAGGAGE;
  if (name.includes("bảo hiểm")) return SERVICE_CATEGORY.INSURANCE;
  if (name.includes("taxi") || name.includes("đưa đón")) return SERVICE_CATEGORY.TRANSFER;
  return null;
};

export const categoryOf = (service) =>
  service?.category || guessCategory(service?.serviceName || "");

/**
 * Chữ hiển thị cho một dịch vụ, theo ngôn ngữ đang chọn.
 *
 * Cùng khuôn với translateVoucherDescription trong LanguageContext: tra bảng dịch bằng mã,
 * không tra được thì trả về nguyên văn từ cơ sở dữ liệu. Không bao giờ trả về chuỗi rỗng —
 * một dòng dịch vụ không có nhãn là một dòng khách không biết mình đang mua gì.
 */
export const translateServiceName = (service, t) => {
  const fromTable = service?.serviceCode ? t?.[`svc_${service.serviceCode}`] : null;
  return fromTable || service?.serviceName || "";
};

/**
 * Xếp danh sách dịch vụ vào từng nhóm, giữ nguyên thứ tự backend trả về.
 *
 * @param {Array} services danh sách thô từ GET /api/additional-services
 * @returns {{baggage: Array, meal: Array, insurance: Array, transfer: Array}}
 */
export const groupServices = (services = []) => {
  const groups = { baggage: [], meal: [], insurance: [], transfer: [] };
  const bucket = {
    [SERVICE_CATEGORY.BAGGAGE]: groups.baggage,
    [SERVICE_CATEGORY.MEAL]: groups.meal,
    [SERVICE_CATEGORY.INSURANCE]: groups.insurance,
    [SERVICE_CATEGORY.TRANSFER]: groups.transfer,
  };

  for (const service of services) {
    // Dòng không thuộc nhóm nào (ngừng bán, hoặc dữ liệu lạ) thì không chào bán, nhưng vẫn
    // tra được tên ở lịch sử đơn hàng — nơi tra theo id chứ không qua hàm này.
    bucket[categoryOf(service)]?.push(service);
  }
  return groups;
};
