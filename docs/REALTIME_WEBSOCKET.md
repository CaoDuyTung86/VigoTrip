# 🔒 Giữ ghế thời gian thực — WebSocket và ba lớp chống đặt trùng vé

Tài liệu giải thích tầng realtime (`/ws`, STOMP over SockJS): nó chống đặt trùng vé bằng
cách nào, những lỗ hổng nào đã được vá, và giới hạn nào còn nguyên đó cùng lý do.

Phần AI là chuyện khác: xem [CHATBOT_AI.md](./CHATBOT_AI.md) và [AI_BI.md](./AI_BI.md).

---

## 1. Ba lớp, và chỉ hai lớp dưới mới quyết định tính đúng đắn

```
       Trình duyệt A                  Trình duyệt B
            │                              │
            │ /app/seat-selection          │ /app/seat-selection
            ▼                              ▼
  ┌──────────────────────────────────────────────────┐
  │ LỚP 1 — SeatLockService (bộ nhớ, TTL 10 phút)    │  chặn ở mức trải nghiệm
  │ Ai bấm trước giữ được; người sau thấy ghế xám     │  MẤT KHI RESTART
  └──────────────────────────────────────────────────┘
            │ POST /api/bookings
            ▼
  ┌──────────────────────────────────────────────────┐
  │ LỚP 2 — findByIdWithLock (PESSIMISTIC_WRITE)     │  chặn ở mức giao dịch
  │       + existsByTripIdAndSeatId trong cùng tx     │  ĐÚNG VỚI MỌI SỐ INSTANCE
  └──────────────────────────────────────────────────┘
            │ callback VNPay + redirect người dùng
            ▼
  ┌──────────────────────────────────────────────────┐
  │ LỚP 3 — findByIdForUpdate trên đơn hàng          │  chặn xác nhận trùng
  │ Hai lượt xác nhận phải xếp hàng, lượt sau đọc ra  │  ĐÚNG VỚI MỌI SỐ INSTANCE
  │ ALREADY_PROCESSED                                 │
  └──────────────────────────────────────────────────┘
```

Mỗi lớp bắt một loại tranh chấp khác nhau:

| Lớp | Bắt được gì | Ở đâu trong mã |
| --- | --- | --- |
| 1 | Hai người cùng nhìn sơ đồ ghế, cùng bấm một ghế | `SeatLockService` |
| 2 | Hai yêu cầu lọt qua lớp 1 (mất mạng, tab cũ, gọi thẳng API, backend vừa restart) | `SeatRepository.findByIdWithLock` |
| 3 | Callback VNPay và redirect người dùng cùng xác nhận một đơn → hai mail, tích điểm hai lần | `BookingRepository.findByIdForUpdate` |

**Điểm quan trọng nhất:** tính đúng đắn KHÔNG nằm ở lớp 1. Lớp 1 nằm trong bộ nhớ của một
tiến trình và *sẽ* biến mất trong đời thật (mục 4). Mất sạch lớp 1 thì hậu quả tệ nhất là
hai người cùng chọn được một ghế trên giao diện rồi một người bị từ chối ở bước tạo đơn —
khó chịu, nhưng **không có vé trùng**.

Đây không phải lời hứa suông. `SeatDoubleBookingIntegrationTest` vô hiệu hoá lớp 1 hoàn
toàn (mock `SeatLockService`, mọi ghế trông như đang trống) rồi cho hai luồng trong hai
giao dịch thật cùng đặt một ghế:

```bash
./mvnw test -Dtest=SeatDoubleBookingIntegrationTest
```

> đúng một luồng tạo được đơn, và CSDL cuối cùng có đúng một vé cho cặp (chuyến, ghế).

Còn `SeatWebSocketIntegrationTest` chạy toàn bộ tầng realtime trên một máy chủ thật ở cổng
ngẫu nhiên — nối STOMP bằng JWT, hỏi mã chủ sở hữu, giữ ghế, và dựng lại đúng kịch bản tấn
công cũ bằng một phiên thứ hai. Hai thứ chỉ đúng hay sai khi chạy thật mới biết: quy ước
đích `/user/queue/**` có nhận đúng danh tính mang dấu hai chấm (`user:a@b.com`) hay không,
và frame CONNECT mang JWT có đi qua được toàn bộ chuỗi bộ chặn hay không. Sai một trong hai
thì phản hồi giữ ghế không bao giờ về tới trình duyệt: người dùng thấy "hết thời gian chờ"
trong khi log máy chủ sạch bong.

---

## 2. Bốn lỗ hổng đã vá

### 2.1. Kênh STOMP không hề xác thực

**Trước.** Danh tính người giữ ghế là trường `userId` nằm trong *thân thông điệp*, do trình
duyệt tự khai, máy chủ tin thẳng:

```json
{ "tripId": 12, "seatId": 42, "status": "AVAILABLE", "userId": "nan.nhan@gmail.com" }
```

Gửi frame đó là nhả được ghế người khác đang giữ. Đổi `status` thành `SELECTED` là giữ ghế
dưới danh tính bịa ra. `RateLimitingFilter` không đỡ được vì nó là servlet filter, chỉ chạy
trên HTTP thường chứ không thấy các frame STOMP đi trong một kết nối đã mở.

Trong `SeatStatusController` còn một hàm `isAuthenticatedUser()` được viết ra rồi **không ai
gọi** — dấu vết của một lần định làm rồi bỏ dở.

**Sau.** Danh tính chuyển từ "client khai" sang "máy chủ suy ra một lần lúc bắt tay", đúng
mô hình `JwtAuthFilter` đang áp dụng cho REST. `StompAuthChannelInterceptor` đọc frame
CONNECT:

| Header CONNECT | Danh tính phiên | Ghi chú |
| --- | --- | --- |
| `Authorization: Bearer <jwt>` hợp lệ | `user:<email chữ thường>` | Tài khoản bị khoá mất quyền ngay, không đợi token hết hạn |
| Token sai / hết hạn / tài khoản bị khoá | **Từ chối CONNECT** | Không âm thầm hạ xuống phiên khách |
| Không có header | `guest:<khoá thiết bị>` | Luồng đặt vé cho phép chọn ghế trước rồi mới đăng nhập |

Tiền tố là ranh giới an ninh: một phiên khách không tài nào tạo ra được danh tính
`user:...`, nên không mạo danh tài khoản đã đăng nhập được nữa. Khoá thiết bị sai hình dạng
thì máy chủ tự cấp một khoá ngẫu nhiên, để client không tự chọn được khoá trùng người khác.

Vì sao **từ chối** chứ không hạ ngầm xuống phiên khách: hạ ngầm sẽ khiến người dùng tưởng
mình đang giữ ghế dưới tài khoản của mình, tới bước tạo đơn mới vỡ ra là không phải. Cùng
một nguyên tắc với việc AI BI trả 403 cho đối tác xin `scope=SYSTEM` thay vì lặng lẽ thu
hẹp phạm vi. Đổi lại, frontend phải biết nối lại dưới dạng khách khi gặp lỗi này, nếu không
nó sẽ quay vòng thử lại mãi bằng đúng cái token hỏng (`reconnectDelay: 5000`).

Khoá lại bằng `StompAuthChannelInterceptorTest` và `SeatStatusControllerTest`, trong đó có
đúng kịch bản tấn công cũ:

> `unlockSeat_CannotReleaseSomeoneElsesSeat` — kẻ tấn công gửi lệnh nhả ghế của nạn nhân,
> ghế vẫn nguyên trong tay nạn nhân.

### 2.2. Email của người dùng bị phát cho mọi client

**Trước.** Mọi thông điệp trạng thái ghế mang thẳng `userId` — tức **email** — và được phát
tới mọi trình duyệt đang mở trang. Mở DevTools là đọc được email của tất cả những người
đang chọn ghế cùng chuyến. Với khách chưa đăng nhập còn tệ hơn: khoá thiết bị bị lộ chính
là thứ dùng để giữ ghế, ai nhặt được là cướp được ghế của nhau.

**Sau.** Thông điệp mang `ownerToken` — HMAC-SHA256 của danh tính, cắt còn 16 ký tự
base64url (`SeatOwnerTokenService`). Cùng một người thì cùng một mã (so sánh được), nhưng
không hoàn nguyên về email được. Giao diện chỉ cần trả lời "ghế này có phải của tôi không",
nên chừng đó là đủ; mỗi client hỏi mã của chính mình một lần qua `/app/whoami`.

`SeatStatusMessage` cố ý không còn trường `userId` nào.

### 2.3. Một kênh toàn cục cho mọi chuyến

**Trước.** Tất cả đi qua đúng một kênh `/topic/seat-status`. Một cú bấm ghế ở chuyến Đà
Nẵng–Huế được đẩy tới cả những người đang xem chuyến Hà Nội–Sài Gòn, và cả những người đang
đứng ở trang chủ. Lưu lượng tăng theo tích (số người xem × số sự kiện của mọi chuyến).

**Sau.** `/topic/seat-status/{tripId}`. Mỗi client chỉ nhận sự kiện của chuyến đang mở. Ngoài
việc giảm lưu lượng, nó bịt luôn đường quan sát chéo: không đăng ký chuyến nào thì không
nghe được gì của chuyến đó.

Đồng thời `LOCK_FAILED` chuyển sang hàng đợi riêng `/user/queue/seat-status`: chuyện một
người bấm hụt ghế không liên quan gì tới người khác, phát cho cả phòng chỉ làm giao diện họ
nhấp nháy vô cớ.

### 2.4. `setAllowedOriginPatterns("*")`

**Trước.** Bất kỳ trang web nào trên Internet cũng mở được kết nối WebSocket tới máy chủ từ
trình duyệt người dùng. Cộng với 2.1 và 2.2, một trang bất kỳ chỉ cần vài dòng JavaScript
là đọc được toàn bộ luồng chọn ghế kèm email, và nhả ghế của bất cứ ai.

**Sau.** Danh sách tên miền lấy từ cấu hình (`app.websocket.allowed-origin-patterns`), mặc
định là các tên miền đang deploy. Để cấu hình được chứ không chặn cứng trong mã, vì mỗi bản
deploy xem trước Vercel lại cấp một tên miền mới — chặn cứng sẽ khiến bản xem trước gãy rồi
lại bị nới về `"*"` cho xong.

---

## 3. Hai cải tiến đi kèm

### 3.1. Trần số ghế một danh tính giữ cùng lúc

Không có trần thì một phiên chỉ cần gửi liên tiếp vài trăm frame là giữ sạch ghế của mọi
chuyến trong 10 phút. Không cướp được vé của ai, nhưng đủ để không ai đặt được vé nữa — và
`RateLimitingFilter` không chạm tới được. Trần đặt ở 20 ghế mỗi danh tính; gia hạn ghế đang
giữ không tính thêm.

### 3.2. Chuyển chủ ghế khi khách đăng nhập giữa chừng

Khách chọn ghế lúc chưa đăng nhập (`guest:...`) rồi mới đăng nhập ở bước thanh toán
(`user:...`). Không chuyển lock theo thì chính họ bị `BookingService` báo "ghế đang được giữ
bởi người khác".

Trước đây frontend tự xoay xở bằng hai lượt: **nhả** ghế theo danh tính cũ rồi **giữ lại**
bằng danh tính mới. Giữa hai lượt, ghế thực sự trống vài chục mili giây — đủ để người khác
chen vào và khách mất ghế dù không làm gì sai.

Giờ là một thao tác phía máy chủ (`/app/seat-handover` → `SeatLockService.transferLock`),
không còn khoảng trống nào. Phiên được phép nhận vì chính nó đã khai khoá thiết bị đó ở
frame CONNECT — tức nó vốn là phiên khách đang giữ mấy ghế này, chỉ vừa đăng nhập xong.

---

## 4. Giới hạn còn nguyên, và vì sao chấp nhận được

Bảng lock nằm trong một `ConcurrentHashMap` của tiến trình. Hệ quả:

- **Backend restart là mất sạch.** Render gói miễn phí ngủ khi vắng request.
- **Chạy hai instance thì mỗi instance một bảng riêng**, và `enableSimpleBroker` cũng chỉ
  phát trong nội bộ một JVM — client nối vào instance A không bao giờ thấy sự kiện sinh ra
  ở instance B.

**Vì sao vẫn chấp nhận được:** vì tính đúng đắn không đặt ở lớp này (mục 1), và điều đó đã
được kiểm chứng bằng `SeatDoubleBookingIntegrationTest` chứ không phải bằng lời.

**Muốn bỏ giới hạn thì cần hai thứ, không phải một:**

1. Đưa bảng lock ra kho ngoài tiến trình — Redis, hoặc một bảng trong CSDL kèm cột hết hạn.
2. Thay `SimpleBroker` bằng broker thật (RabbitMQ / Redis pub-sub) để sự kiện đi được giữa
   các instance.

Thiếu vế thứ hai thì lock có đúng nhưng giao diện vẫn không đồng bộ — người dùng vẫn thấy
ghế trống rồi bị từ chối ở bước tạo đơn. Cả hai đều nằm ngoài hạn mức RAM của gói Render
đang dùng (backend chạy với `-Xmx256m`), nên đây là **đánh đổi có chủ ý** chứ không phải
thiếu sót.

---

## 5. Bảng tra nhanh

| Đích | Chiều | Nội dung |
| --- | --- | --- |
| `/app/seat-selection` | client → server | `{tripId, seatId, status}` — giữ (`SELECTED`) hoặc nhả (`AVAILABLE`) một ghế. **Không có `userId`.** |
| `/app/seat-handover` | client → server | `{tripId, seatIds}` — nhận lại ghế đã giữ lúc chưa đăng nhập |
| `/app/whoami` | client → server | hỏi mã chủ sở hữu của chính mình |
| `/topic/seat-status/{tripId}` | server → cả phòng | `{tripId, seatId, status, ownerToken}` với status ∈ `SELECTED`/`BOOKED`/`AVAILABLE` |
| `/user/queue/seat-status` | server → một phiên | `LOCK_FAILED` — giữ hụt ghế nào |
| `/user/queue/identity` | server → một phiên | `{ownerToken, authenticated}` |

**Header của frame CONNECT:** `Authorization: Bearer <jwt>` (nếu đã đăng nhập) và
`X-Guest-Key: sess_...` (luôn gửi, kể cả khi đã đăng nhập, để phục vụ seat-handover).

---

## 6. Chạy các bộ kiểm thử liên quan

```bash
# Backend
./mvnw test -Dtest=StompAuthChannelInterceptorTest   # xác thực ở frame CONNECT
./mvnw test -Dtest=SeatStatusControllerTest          # danh tính lấy từ phiên, không từ thân tin
./mvnw test -Dtest=SeatLockServiceTest               # lock, trần ghế, chuyển chủ
./mvnw test -Dtest=SeatDoubleBookingIntegrationTest  # lớp 2 giữ được bất biến khi lớp 1 mất
./mvnw test -Dtest=SeatWebSocketIntegrationTest       # đầu-cuối trên máy chủ thật, cổng ngẫu nhiên

# Frontend
npm run test:run -- src/context/WebSocketContext.test.jsx
npm run test:run -- src/hooks/useSeatLockRekey.test.jsx
```
