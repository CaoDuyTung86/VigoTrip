# 🧹 Quét cạn màn hình trước demo (Route Sweep)

Mục đích **khác** với [DEMO_SCRIPT.md](DEMO_SCRIPT.md): kịch bản demo bảo vệ **đường bạn chọn đi**, tài liệu này bảo vệ **đường hội đồng tự bấm vào**.

Không kiểm tra nghiệp vụ đúng/sai ở đây. Chỉ cần trả lời một câu cho mỗi màn hình: **mở ra có vỡ mặt không?**

> ⏱ Chạy hết: ~90 phút. Làm ở **T-2**, trên **bản deploy** (`vigotrip.vercel.app`), không phải localhost.

---

## 0. Cách chạy

1. Mở **F12 → tab Console**, để nguyên suốt buổi quét.
2. Với mỗi vai, dán lần lượt từng URL vào thanh địa chỉ (dán URL, **không** bấm theo menu — hội đồng cũng sẽ dán URL).
3. Mỗi màn: nhìn Console → bấm hết nút thấy được ở màn hình đầu → đổi **VI ↔ EN** → bật **Dark mode**.
4. Tick vào ô của vai tương ứng. Có vấn đề thì ghi xuống **mục 4** rồi đi tiếp — **đừng dừng lại sửa**, sửa gộp một lượt ở cuối.

### Tiêu chí ĐẠT (chỉ 4 điều)

| ✔ | Điều kiện |
| --- | --- |
| 1 | Không trang trắng, không màn hình "Đã xảy ra lỗi" của ErrorBoundary |
| 2 | Console **không có dòng đỏ** (vàng thì bỏ qua) |
| 3 | Không lòi key i18n thô kiểu `chatbotFaqTitle` khi đổi sang EN |
| 4 | Dark mode không có chữ trắng trên nền trắng, không mất viền bảng/biểu đồ |

Không đạt điều nào thì màn đó vào **danh sách vàng/đỏ** của [DEMO_CHEATSHEET.md](DEMO_CHEATSHEET.md), chứ không nhất thiết phải sửa code — vài ngày trước demo, **né một màn rẻ hơn sửa một màn**.

---

## 1. Bảng quét 21 route

Route lấy từ [App.jsx:63-83](../my-react-app/src/App.jsx#L63). Cột vai: **G** = khách vãng lai, **U** = user, **A** = admin, **P** = provider.

| G | U | A | P | Route | Kết quả mong đợi / điểm cần soi |
| --- | --- | --- | --- | --- | --- |
| ☐ | ☐ | ☐ | ☐ | `/` | Load < 3s. Bấm thử **mọi** ô của form tìm kiếm ở hero |
| ☐ | ☐ | ☐ | ☐ | `/ve-may-bay` | Tìm được chuyến trong 30 ngày tới. Kéo dual slider giờ khởi hành qua mốc 0h/24h |
| ☐ | ☐ | ☐ | ☐ | `/ve-tau-hoa` | Như trên |
| ☐ | ☐ | ☐ | ☐ | `/xe-khach` | Như trên + mở sơ đồ ghế, mở lịch giá |
| ☐ | ☐ | ☐ | ☐ | `/uu-dai` | Danh sách voucher có dữ liệu, không rỗng trắng |
| ☐ | ☐ | ☐ | ☐ | `/auth` | ⚠ **Vai U/A/P**: đang đăng nhập mà mở `/auth` thì xử lý thế nào? Chưa rõ — xác minh |
| ☐ | ☐ | ☐ | ☐ | `/my-bookings` | ⚠ **Vai G**: không có guard ở router, xem khách vãng lai vào thì hiện gì |
| ☐ | — | — | — | `/forgot-password` | 🔴 **Chỉ mở XEM, đúng MỘT lần, không gửi lặp** — giới hạn 3 lượt/15 phút chung IP |
| ☐ | ☐ | ☐ | ☐ | `/dieu-khoan` | ⚠ Kiểm **email hỗ trợ** hiện ra là địa chỉ thật, không phải `support@vigotrip.vn` (xem mục 3) |
| ☐ | ☐ | ☐ | ☐ | `/chinh-sach-bao-mat` | Như trên |
| ☐ | ☐ | ☐ | ☐ | `/verify-email` | ⚠ Mở **không kèm token** trên URL — phải báo lỗi tử tế, không nổ trắng trang |
| ☐ | ☐ | ☐ | ☐ | `/admin/trips` | G/U/P phải bị chặn ([AdminTrips.jsx:324](../my-react-app/src/Page/AdminTrips.jsx#L324) chặn ngoài ROLE_ADMIN). A: sửa được 1 chuyến |
| ☐ | ☐ | ☐ | ☐ | `/admin/routes` | Như trên ([AdminRoutes.jsx:202](../my-react-app/src/Page/AdminRoutes.jsx#L202)) |
| ☐ | ☐ | ☐ | ☐ | `/admin/users` | ✅ Chặn sạch nhất trong nhóm admin ([AdminUsers.jsx:136](../my-react-app/src/Page/AdminUsers.jsx#L136)) → **dùng đúng trang này khi hội đồng đòi thử phân quyền** |
| ☐ | ☐ | ☐ | ☐ | `/admin/vouchers` | Cả A lẫn P đều vào được, nhưng thấy khác nhau ([AdminVouchers.jsx:101](../my-react-app/src/Page/AdminVouchers.jsx#L101)). Tạo nhanh 1 mã rồi bật/tắt |
| ☐ | ☐ | ☐ | ☐ | `/admin/reviews` | A và P vào được, G/U bị đá về `/` ([AdminReviews.jsx:17](../my-react-app/src/Page/AdminReviews.jsx#L17)) |
| ☐ | ☐ | ☐ | ☐ | `/admin/revenue` | ⚠ **Không có guard ở giao diện** — chặn ở tầng API. G/U vào sẽ thấy khung trang rồi mới báo lỗi. Xem lỗi hiện ra có tử tế không, và **đừng dùng trang này để demo phân quyền** |
| ☐ | ☐ | ☐ | ☐ | `/admin/chatbot` | ⚠ Chỉ có cờ `isAdmin` ẩn/hiện khối ([AdminChatbot.jsx:72](../my-react-app/src/Page/AdminChatbot.jsx#L72)), không đá ra. Xem U/P vào thì còn lại gì trên màn |
| ☐ | ☐ | ☐ | ☐ | `/account` | ⚠ Không tìm thấy guard — xác minh vai G vào thì hiện gì |
| ☐ | ☐ | ☐ | ☐ | `/provider/refunds` | ⚠ **Chỉ ROLE_ADMIN** ([ProviderRefunds.jsx:24](../my-react-app/src/Page/ProviderRefunds.jsx#L24) + [SecurityConfig.java:74](../backend/ticket-booking/src/main/java/com/booking/api/config/SecurityConfig.java#L74)) — vai **P bị chặn dù URL mang tên provider**. Demo hoàn tiền bằng tab ADMIN |
| ☐ | ☐ | ☐ | ☐ | `/provider/check-in` | A và P vào được ([ProviderCheckIn.jsx:458](../my-react-app/src/Page/ProviderCheckIn.jsx#L458)). Cần HTTPS + quyền camera |
| ☐ | ☐ | ☐ | ☐ | `/duong-dan-khong-ton-tai` | ⚠ **Không có route `*` trong App.jsx** → URL sai sẽ ra màn trống, chỉ còn Header/Footer. Biết trước để không hoảng |

---

## 2. Nút tầng 1 (làm một lần, ở vai USER là đủ)

| ☐ | Chỗ | Kiểm |
| --- | --- | --- |
| ☐ | **Header** | Bấm hết mục menu; nút Dark/Light; đổi VI→EN→VI; menu tài khoản |
| ☐ | **Footer** | ⚠ Bấm **từng link một**. Các link chết `href="#"` đã được thay trong thay đổi **chưa commit** — nên bản đang chạy trên Vercel vẫn còn. Kiểm lại **sau khi deploy**; link chết trên footer là chỗ hội đồng hay bấm bừa nhất |
| ☐ | **Footer → email hỗ trợ** | Bấm phải mở mail client với **địa chỉ thật** |
| ☐ | **Nút chatbot** (góc phải dưới) | Bấm được ở **mọi điểm** trên nút, kể cả mép trái — đây là bug vừa fix, kiểm lại |
| ☐ | **Chatbot đóng** | Đóng khung chat rồi bấm vào phần trang phía sau — phải bấm được bình thường |
| ☐ | **Dải chip gợi ý** | Bấm 1 chip → gửi ngay (không phải bấm 2 lần); **kéo ngang** → chỉ cuộn, không vô tình gửi |
| ☐ | **Resize khung chat** | Kéo góc dưới-phải, layout không vỡ |
| ☐ | **Ba trang tìm vé** | Lọc nhà xe/hãng, lọc giá, lọc chỗ trống — không văng lỗi khi bỏ chọn hết bộ lọc |
| ☐ | **Mobile** | Thu cửa sổ về ~390px hoặc mở bằng điện thoại: Header, Footer, sơ đồ ghế, chatbot không tràn ngang |

---

## 3. Ba thứ kiểm bằng mắt trước, đừng chờ tới lúc demo

| ☐ | Việc | Vì sao quan trọng |
| --- | --- | --- |
| ☐ | **Đã redeploy Vercel SAU KHI thêm `VITE_SUPPORT_EMAIL` chưa?** | Biến `VITE_*` là **build-time** — Vite nhúng thẳng vào bundle. Khai biến trên Vercel mà **không build lại** thì bản đang chạy vẫn hiện `support@vigotrip.vn`. Mở `/dieu-khoan` trên deploy xem tận mắt |
| ☐ | **Trang tìm vé còn chuyến trong 30 ngày tới** | Lịch chuyến tự bù lúc 03:00 và mỗi lần app khởi động, nhưng Render ngủ đông có thể làm lỡ nhịp cron |
| ☐ | **`/admin/revenue` kỳ nào đang có dữ liệu** | Banner sẽ tự nói. Biết trước con số để lúc demo đối chiếu với bài viết của AI cho nhanh |

---

## 4. Nhật ký lỗi phát hiện khi quét

| Route | Vai | Hiện tượng | Xếp loại (🟢/🟡/🔴) | Đã xử lý? |
| ----- | --- | ---------- | ------------------- | --------- |
|       |     |            |                     |           |
|       |     |            |                     |           |
|       |     |            |                     |           |
|       |     |            |                     |           |

**Sau khi quét xong:** chuyển mọi dòng 🟡/🔴 vào đúng mục "Đèn giao thông" của [DEMO_CHEATSHEET.md](DEMO_CHEATSHEET.md), rồi đưa cheat sheet cho người trực tiếp demo.
