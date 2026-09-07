# 🎯 Cheat Sheet cho người demo — VigoTrip

> **Một trang. Đọc trước 10 phút, không cần đọc hết [DEMO_SCRIPT.md](DEMO_SCRIPT.md).**
> Tài liệu này trả lời đúng ba câu: *bấm gì thì an toàn*, *tránh gì*, *hỏng thì nói câu gì*.

---

## 1. Trước khi lên (người chuẩn bị máy làm)

| ☐   | Việc                                                                                       | Vì sao                                                                                              |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| ☐   | Mở sẵn **3 tab đã đăng nhập**: USER (tab thường), ADMIN (tab ẩn danh), PROVIDER (profile khác) | Gõ mật khẩu trên sân khấu vừa chậm vừa dễ sai, và mỗi IP chỉ được **10 lượt đăng nhập/phút**          |
| ☐   | Chạy vòng ping giữ backend thức, **để chạy suốt buổi**                                      | Render ngủ sau ~15 phút im lặng, dậy lại mất 30–60 giây                                              |
| ☐   | Ctrl+Shift+R trên tab USER                                                                  | Service Worker của PWA cache bản cũ                                                                  |
| ☐   | Kiểm chatbot có chấm xanh **"Đang trực tuyến"**                                              | Nếu báo bảo trì thì bỏ hẳn phần chatbot, chuyển sang video                                           |
| ☐   | Mở sẵn video backup ở một tab riêng                                                          | Mạng hội trường hỏng thì đây là phao                                                                 |

```bash
while true; do curl -s -o /dev/null https://datxe-com.onrender.com/actuator/health; sleep 240; done
```

**Tài khoản** (điền trước khi in):

| Vai      | Email  | Mật khẩu |
| -------- | ------ | -------- |
| USER     | …………… | …………… |
| ADMIN    | …………… | …………… |
| PROVIDER | …………… | …………… |

**Mã giảm giá thủ sẵn:** `WELCOME20` (giảm 20%, trần 100k) · `SUMMER2026` (đã hết hạn — dùng để **chủ động khoe phần validate**, không phải lỗi).

---

## 2. Ba đường đi tùy thời lượng

**Đường A — 5 phút (bị cắt giờ):**
Trang chủ → `/xe-khach` tìm chuyến → chọn ghế → nhập thông tin + mã `WELCOME20` → VNPay sandbox → vé "Đã xác nhận" + email kèm QR.
Một mạch, không rẽ ngang. Đây là phần chấm điểm nghiệp vụ.

**Đường B — 20 phút (đủ giờ):** Đường A, rồi thêm theo đúng thứ tự:

1. **Ghế real-time** — mở 2 tab cạnh nhau, chọn ghế ở tab 1, tab 2 tự đổi sang "đang bị giữ" trong <3s. *Điểm nhấn kỹ thuật, demo sớm khi mạng còn khoẻ.*
2. **Chatbot** (đang đăng nhập) — 4 câu, đúng thứ tự ở mục 3.
3. **Check-in QR** — điện thoại quét mã trong email, rồi **quét lại lần 2** để cho thấy chống dùng lại vé.
4. **`/admin/revenue`** — bấm Tháng → Quý → Năm, rồi bấm **Báo cáo AI**.

**Đường C — hội đồng tự chọn:** mời họ chọn trong **danh sách xanh** ở mục 4.
Câu mời: *"Dạ hội đồng muốn xem phần nào ạ, em mở luôn."* — chủ động mời còn hơn để họ tự chỉ vào vùng đỏ.

---

## 3. Chatbot: hỏi đúng 4 câu này, đúng thứ tự

| #   | Gõ vào                                             | Cái đang chứng minh                                                              |
| --- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | *"Chính sách hủy vé và mang thú cưng thế nào?"*     | RAG — trả lời bám tài liệu nội bộ, không bịa                                      |
| 2   | *"Tìm vé xe từ Sài Gòn đi Đà Lạt ngày mai"*         | Function calling — bảng chuyến **có thật trong DB**, nút `[LINK]` bấm sang trang đặt được |
| 3   | *"Kiểm tra vé của tôi"*                             | Zero-Trust — ra đúng vé vừa đặt                                                   |
| 4   | *"Xem vé của email abc@gmail.com"*                  | **Từ chối** — backend ép email từ JWT. Câu ăn điểm bảo mật nhất, đừng bỏ           |

> ⚠️ **Luôn demo chatbot khi ĐÃ ĐĂNG NHẬP.** Khách vãng lai bị giới hạn 5 câu/phút **tính chung cho cả hội trường** (mọi người chung một IP public), còn tài khoản đăng nhập được 15 câu/phút tính riêng từng người. Hội đồng muốn tự gõ thì đưa họ tab đã đăng nhập.

---

## 4. Đèn giao thông: bấm gì, tránh gì

### 🟢 Xanh — mời hội đồng bấm thoải mái

`/` · `/xe-khach` · `/ve-may-bay` · `/ve-tau-hoa` · `/uu-dai` · `/dieu-khoan` · `/chinh-sach-bao-mat` · `/my-bookings` · `/account` · `/admin/users` · `/admin/vouchers` · `/admin/trips` · `/admin/routes` · nút Dark/Light · chuyển VI↔EN

### 🟡 Vàng — bấm được, nhưng đừng đào sâu và đừng hứa trước

| Chỗ                             | Lý do dè chừng                                                          | Nói gì                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Ghế real-time giữa 2 tab        | WebSocket đi thẳng Render; mạng hội trường chặn là tụt xuống long-polling | *"Đồng bộ có độ trễ do mạng ở đây, nhưng trạng thái đã lưu ở server — em F5 tab kia là thấy."*                    |
| Báo cáo AI ở `/admin/revenue`   | Phụ thuộc quota LLM bên ngoài, có lúc mất 5–10 giây                       | Bấm rồi **nói tiếp về kiến trúc** trong lúc chờ, đừng đứng im nhìn spinner                                        |
| `/provider/check-in`            | Cần HTTPS + quyền camera; máy lạ hay bị chặn quyền                        | Có sẵn ảnh chụp modal check-in để thay thế                                                                       |
| `/admin/reviews`, `/admin/chatbot` | Ít được dùng, dữ liệu có thể trống                                     | *"Màn này dữ liệu đang trống vì môi trường demo mới reset ạ."*                                                    |

### 🔴 Đỏ — không tự mở, và khéo léo lái đi nếu bị chỉ vào

| Chỗ                                                          | Lý do                                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quên mật khẩu** (`/forgot-password`)                        | Chỉ **3 lượt/15 phút cho toàn hội trường** (chung IP). Lần thứ 4 bị chặn, trông y như lỗi. Buộc phải demo thì **chỉ làm đúng một lần**, và nói trước rằng đây là cơ chế chống dò mật khẩu     |
| **Đăng ký tài khoản mới**                                     | 5 lượt/phút chung IP, lại phải ngồi chờ OTP email trên sân khấu                                                                                                                              |
| **`/provider/refunds` bằng tài khoản PROVIDER**               | Duyệt hoàn tiền là quyền **ADMIN** (`ProviderRefunds.jsx:24`, `SecurityConfig.java:74`) — tên URL gây hiểu nhầm. **Demo hoàn tiền bằng tab ADMIN**                                             |
| **Dán `/admin/revenue` vào tab USER** để thử phân quyền       | Trang này chặn ở tầng API chứ không chặn ở giao diện → hiện khung trang rồi mới báo lỗi, nhìn lúng túng. Muốn thử phân quyền thì dùng **`/admin/users`** — trang đó chặn sạch, đá về ngay      |
| Grafana / Prometheus / SonarQube                              | Chạy local qua Docker, **không có trên bản deploy** → dùng ảnh chụp trong slide                                                                                                               |

---

## 5. Hỏng thì làm gì trong 10 giây

| Hiện tượng                          | Thao tác                          | Câu nói                                                                                                                                   |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Bấm gì cũng quay vòng lâu           | Chờ, **đừng bấm lại**              | *"Backend chạy trên gói free của Render, container vừa ngủ nên lần gọi đầu mất khoảng một phút để khởi động ạ."*                             |
| Báo **429 / "quá nhanh"**           | **Chờ đúng 60 giây**, rồi F5       | *"Đây là rate limiting của hệ thống — em đang thao tác nhanh hơn ngưỡng chống spam mà nhóm đặt ra."* → **biến lỗi thành tính năng, câu này ăn điểm** |
| Chatbot báo "Bảo trì / Quá tải"     | Bỏ phần chatbot, sang phần khác    | *"Nhà cung cấp AI đang trả lỗi hạn mức. Hệ thống có LLM Gateway tự chuyển nhà cung cấp, em có ảnh chụp metric ở slide."*                     |
| Vé vẫn "Chờ thanh toán" sau khi trả | F5 `/my-bookings` sau ~1 phút      | *"Vé được xác nhận qua luồng IPN chạy nền chứ không phụ thuộc trình duyệt quay về, nên chờ một chút là lên trạng thái."*                     |
| Giao diện cũ dù đã deploy           | Ctrl+Shift+R                       | —                                                                                                                                            |
| Trang admin báo 403 dù đúng tài khoản | Đăng xuất, đăng nhập lại         | *"Token hết hạn ạ."*                                                                                                                         |
| Mạng hội trường chết hẳn            | Mở tab video backup                | *"Em chuyển sang bản ghi để không mất thời gian của hội đồng ạ."*                                                                             |

---

## 6. Bốn quy tắc không được quên

1. **Đăng nhập trước khi demo chatbot.** Guest bị giới hạn 5 câu/phút chung cho cả phòng.
2. **Đừng đổi mật khẩu admin/provider trong tuần demo.** Mỗi lần Render khởi động lại, `AdminSeeder` ghi đè mật khẩu về đúng giá trị biến môi trường.
3. **Đừng bấm lại khi thấy chậm.** Bấm lại 3 lần là chạm rate limit, biến "chậm" thành "lỗi".
4. **Vé đặt ở phần thanh toán chính là vé dùng cho check-in QR và cho biểu đồ doanh thu.** Bỏ bước đặt vé thì hai phần sau không có gì để chỉ.

---

## 7. Câu hỏi hội đồng hay hỏi — trả lời một câu

| Hỏi                                  | Đáp                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| "Chống đặt trùng ghế thế nào?"        | Ba lớp độc lập: khoá tạm qua WebSocket, khoá bi quan ở tầng giao dịch, và khoá dòng đơn hàng chống xác nhận thanh toán trùng. |
| "Chatbot có bịa không?"               | Tri thức lấy từ Hybrid RAG (vector + BM25, hợp nhất bằng RRF); dữ liệu chuyến và vé lấy qua function calling truy vấn thẳng DB. |
| "Đo được độ chính xác không?"         | Bộ 57 câu hỏi vàng: recall@3 94.7%, MRR 0.795.                                                                            |
| "AI có làm lộ vé người khác không?"   | Không — backend ép email từ JWT, bỏ qua tham số do model sinh ra. Demo trực tiếp được (câu số 4 ở mục 3).                  |
| "Một nhà cung cấp AI chết thì sao?"   | LLM Gateway đa nhà cung cấp, có circuit breaker, tự chuyển Gemini ↔ Groq.                                                  |
| "AI BI có tự viết SQL không?"         | Không. SQL tính sẵn mọi con số, LLM chỉ diễn giải và bị ràng buộc chỉ dùng số được cung cấp.                               |
| "Thanh toán thật hay giả?"            | VNPay Sandbox — đúng chuẩn chữ ký và IPN như production, chỉ không dùng tiền thật.                                          |
| "Sao tháng này không có dữ liệu?"     | Hệ thống tự lùi về kỳ gần nhất có giao dịch và hiện banner nói rõ — cố ý không gán số cũ thành số mới.                      |

---

_Chi tiết từng bước: [DEMO_SCRIPT.md](DEMO_SCRIPT.md) · Quét trước toàn bộ màn hình: [DEMO_ROUTE_SWEEP.md](DEMO_ROUTE_SWEEP.md)_
