# 💳 Thanh toán VNPay — luồng, sự cố, và cách chẩn đoán

Tài liệu về luồng thanh toán VNPay sandbox: nó chạy thế nào, đã hỏng ở đâu, và vì sao
từng chỗ lại được sửa theo cách hiện tại.

Viết cho người phải chạm vào `PaymentService`, `VNPayQueryService` hoặc
`BookingCleanupService` — hoặc phải đọc log Render lúc một đơn không được xác nhận.

---

## 1. Nguyên tắc chi phối mọi thứ bên dưới

> **Tiền đã ra khỏi tài khoản khách là một sự thật độc lập với việc hệ thống ta có biết hay không.**

Gần như mọi sự cố trong tài liệu này đều là biến thể của việc quên nguyên tắc đó: hệ thống
coi "không nhận được tin báo" đồng nghĩa với "khách chưa trả tiền". Hai chuyện đó khác nhau,
và khoảng cách giữa chúng là chỗ tiền biến mất.

Hệ quả thực tế: **không được im lặng hủy một đơn khi chưa hỏi cổng.**

---

## 2. Luồng tổng quát

```
[1] Mở phiên                    [2] Khách trả tiền        [3] Cổng báo về
    ─────────────                   ────────────────          ──────────────
 POST /api/payment/create            Trang VNPay          ┌── IPN  (server→server)
        │                                 │               │   nguồn tin cậy
        ├─ kiểm quyền + trạng thái        │               │
        ├─ paymentExpiresAt = now+20 ─────┼───────────────┤
        ├─ txnRef = UUID(12)              │               └── Return (trình duyệt)
        ├─ GHI payment INITIATED  ◄───────┘                   chỉ để điều hướng
        └─ ký HMAC-SHA512 → URL                                     │
                                                                    ▼
                                                        applyPaymentResult()
                                                          (dùng chung cho cả hai)
[4] Lưới an toàn
    ─────────────
 BookingCleanupService mỗi 60 giây
        │
        └─ đơn PENDING quá hạn → hỏi cổng bằng querydr → cứu / hủy / giữ lại
```

**Điểm quan trọng nhất:** IPN và Return đi vào **cùng một hàm** `applyPaymentResult`. Không
có hai bộ luật song song, nên không thể có cảnh hai luồng xử lý lệch nhau. Đây là lý do một
quy tắc (ví dụ: đối chiếu số tiền) chỉ cần viết đúng một chỗ.

**Return không đáng tin.** Nó là điều hướng trình duyệt: khách đóng tab là nó không bao giờ
xảy ra. IPN là server-to-server nên không phụ thuộc trình duyệt. Nếu một đơn chỉ được xác nhận
khi khách *không* đóng tab, nghĩa là IPN đang không hoạt động — xem §5.1.

---

## 3. Ba lớp phòng thủ trước khi giao vé

Xếp theo thứ tự chạy trong `applyPaymentResult`:

| Lớp | Chặn cái gì | Ở đâu |
|---|---|---|
| **Chữ ký HMAC-SHA512** | Callback không do người biết hash-secret gửi | `VNPayUtil.validateHash` |
| **Đối chiếu số tiền** | Callback hợp lệ nhưng khai số tiền tự đặt | `PaymentService.isAmountMatching` |
| **querydr** | Callback ký đúng bởi kẻ **đã có** hash-secret | `VNPayQueryService` |

Lớp thứ ba tồn tại vì `VNP_HASH_SECRET` của dự án **đã từng bị đẩy lên Git công khai**. Chữ ký
chỉ chứng minh người gửi biết bí mật; nó không chứng minh giao dịch có thật. `querydr` hỏi
thẳng máy chủ VNPay, nên kẻ tấn công dù cầm khoá cũng không khiến cổng khai ra một giao dịch
chưa từng tồn tại.

**querydr fail-open, có chủ ý.** Chỉ khi cổng **phủ nhận rõ ràng** (`CONTRADICTED`) mới chặn.
Mọi trục trặc khác — mất mạng, timeout, mã lỗi lạ — là `UNAVAILABLE` và luồng chạy như cũ.
Nhầm theo hướng "không kết luận" thì mất một lớp phòng thủ phụ; nhầm theo hướng từ chối là
khách mất tiền mà không có vé.

Rate limit ở hai endpoint callback: Return **20/phút/IP**, IPN **120/phút/IP**. Trần IPN cao vì
mọi giao dịch dồn vào cùng dải IP của cổng — chặn nhầm một IPN thật nghĩa là khách mất tiền
không có vé.

---

## 4. Vòng đời một dòng `payment`

Trước đây dòng `payment` chỉ ra đời **khi có callback**. Đó chính là lỗ hổng ở §5.1. Giờ nó ra
đời **lúc mở phiên**, trước khi khách rời đi:

| Trạng thái | Nghĩa | Ai ghi |
|---|---|---|
| `INITIATED` | Đã dựng URL sang cổng, chưa biết kết quả | `createVNPayPayment` |
| `SUCCESS` | Đã thu tiền, đã giao vé | callback, hoặc `sweepExpiredBooking` cứu về |
| `FAILED` | Cổng báo giao dịch hỏng | callback |
| `SUCCESS_NEEDS_REFUND` | Thu tiền khi đơn không còn hiệu lực → đã mở `refund` | `recordLatePaymentForRefund` |
| `ABANDONED` | Cổng khẳng định lần thử này không thành công | `sweepExpiredBooking` |

**Mỗi lần bấm thanh toán một dòng, không phải mỗi đơn một dòng.** Một đơn có thể được thử
nhiều lần, và lần bị trừ tiền không nhất thiết là lần cuối — booking 48 mất tiền ở lần thử
**đầu tiên**.

`INITIATED` **không phải** một khoản tiền đã thu. Nó tồn tại chỉ để giữ lại `vnp_TxnRef` và
thời điểm mở phiên — hai thứ bắt buộc phải có mới hỏi lại cổng được về sau.

---

## 5. Những gì đã hỏng, và vì sao

### 5.1 — Booking 48 mất 680.000đ

**Triệu chứng.** Ngày 31/08/2026, hai giao dịch cùng 680.000đ cho booking 48, cách nhau 45
giây, **cả hai đều thành công ở cổng**. Chỉ giao dịch thứ hai (15670841) làm đơn được xác nhận.
Giao dịch đầu (15670839) không để lại `payment` lẫn `refund` nào.

Tái hiện được: bấm thanh toán rồi **đóng trình duyệt ngay** (~0.5s) thì đơn không được xác nhận;
đóng chậm hơn (~1s) thì được.

**Nguyên nhân.** Chính kịch bản tái hiện là câu trả lời: đơn đang được xác nhận bằng **Return**
chứ không phải **IPN**. IPN Url chưa được lưu trên portal VNPay, nên cổng chưa từng gọi tới.
Không callback nào tới → không dòng `payment` nào được tạo (lúc đó dòng `payment` chỉ sinh khi
có callback) → `BookingCleanupService` hủy đơn quá hạn mà không hỏi cổng câu nào. Khoản tiền
không thành vé, cũng không thành yêu cầu hoàn tiền.

**Cách xử lý — ba lớp:**

1. Lưu IPN Url trên portal. IPN hoạt động từ 01/09/2026 (log cho thấy IPN vào **trước** Return
   0,56 giây).
2. **Ghi `payment` trạng thái `INITIATED` ngay lúc mở phiên.** Không có `vnp_TxnRef` lưu lại thì
   không thể hỏi cổng, và tiền mất dấu vĩnh viễn — kể cả khi phát hiện ra sau đó.
3. **`BookingCleanupService` hỏi `querydr` trước khi hủy** (`PaymentService.sweepExpiredBooking`).

| Cổng trả lời | Kết quả | Hành động |
|---|---|---|
| Đã thu tiền, đúng số | `RECOVERED` | Xác nhận đơn, gửi vé, **không hủy** |
| Không có giao dịch | `SAFE_TO_CANCEL` | Hủy như cũ, đánh dấu `ABANDONED` |
| Không hỏi được | `HOLD` | **Giữ đơn**, thử lại lượt sau |

`HOLD` không vô hạn: quá **60 phút** kể từ lúc đơn hết hạn mà vẫn không hỏi được cổng thì hủy
để trả ghế, kèm log `ERROR` để đối chiếu tay với sao kê. Giữ vô thời hạn nghĩa là ghế bị khoá
vĩnh viễn mỗi khi cổng chết — đó là đánh đổi có ý thức, không phải sơ suất.

Cleanup cũng chặn **20 đơn/lượt**: mỗi lần hỏi là một HTTP call nằm trong transaction, mỗi giây
chờ là một giây giữ connection DB. Phần bị bỏ qua vẫn PENDING nên lượt sau nhặt tiếp.

> ⚠️ **Bản sửa này chỉ cứu được đơn từ thời điểm triển khai trở đi.** Đơn cũ không có dòng
> `INITIATED` nên không có gì để hỏi. Riêng 680.000đ của booking 48 không tự đòi lại được —
> `vnp_TxnRef` của giao dịch đó chưa bao giờ được ghi. Phải lấy mã từ portal rồi đối chiếu tay.

---

### 5.2 — Nút "Test call IPN" trên portal luôn trả `97 Invalid Signature`

**Nguyên nhân.** VNPay v2.1.0 quy định khoảng trắng mã hoá thành `%20`, nhưng `URLEncoder` của
Java sinh ra dấu `+` — mã mẫu của chính VNPay phải thêm `replace("+", "%20")` thủ công. Đo được
bằng thực nghiệm:

```
orderInfo KHÔNG có khoảng trắng (= giao dịch thật của hệ thống):
  ký %20 / gửi %20 -> OK        ký + / gửi + -> OK
orderInfo CÓ khoảng trắng (= payload mẫu của nút Test call):
  ký %20 / gửi %20 -> OK
  ký +   / gửi %20 -> 97        ký + / gửi + -> 97
```

`vnp_OrderInfo` của hệ thống là `Thanh_toan_booking_48` — gạch dưới, không khoảng trắng — nên
hai cách mã hoá cho ra chuỗi y hệt nhau và giao dịch thật đi lọt.

**Cách xử lý.** `VNPayUtil.validateHash` chấp nhận cả hai cách mã hoá. Không mất an toàn: vẫn là
HMAC-SHA512 trên cùng bộ dữ liệu, vẫn đòi đúng hash-secret. Ta chỉ thôi bắt bẻ một chi tiết mã
hoá mà spec để mở.

**Nhưng đây là lỗi đang NẤP, không phải lỗi lành tính.** Chỉ cần đổi định dạng `vnp_OrderInfo`
sang có khoảng trắng là toàn bộ callback thật gãy. Đừng đổi nó.

**Và nút Test call vẫn 97 sau khi sửa.** Payload mẫu của nó có `vnp_SecureHashType` nhưng
thiếu `vnp_TransactionStatus` — tức là định dạng cũ (v2.0.x), ký theo luật khác. **Nút này không
dùng để kiểm chứng luồng thật được**, đừng tốn thời gian vào nó.

---

### 5.3 — `Chữ ký phản hồi querydr không khớp`

**Triệu chứng.** Cảnh báo này xuất hiện ở **mọi** giao dịch.

**Trạng thái: chưa sửa xong.** Công thức nối 14 trường bằng `|` trong `logChecksumMismatch`
đang sai ở đâu đó. Đây là thứ duy nhất trong lớp này không hồi quy được bằng unit test — phải
có phản hồi thật từ cổng mới biết đúng sai.

**Nó vô hại, và cố ý vô hại.** Hàm chỉ ghi log, không phủ quyết kết luận. Thứ thật sự chứng thực
phản hồi là TLS tới đúng tên miền của cổng — kẻ giả mạo callback không nằm trên đường ta gọi ra.
Để một sai sót về thứ tự trường phủ quyết được thì nó sẽ chặn đứng **mọi** thanh toán: cái giá
quá đắt cho một lớp phòng thủ dư.

**Cách dò tiếp.** Khi checksum lệch, `logChecksumEvidence` in ra chuỗi ký ta dựng, **body JSON
thô**, và hai chữ ký. Có body thô rồi thì thử lại các thứ tự khác **offline**, không cần thêm
giao dịch thật nào nữa.

> 🔍 Đọc `vnp_ResponseCode` trong body **trước**. Khác `00` (94 trùng yêu cầu, 02 sai TmnCode…)
> thì phản hồi vốn đã thiếu trường, và checksum lệch chỉ là **hệ quả** — không phải lỗi thứ tự.

---

### 5.4 — Cửa sổ của cổng và cửa sổ của ta hết hạn cùng một giây

**Nguyên nhân.** Một hằng số `PAYMENT_WINDOW_MINUTES` gánh hai vai trò đối nghịch: vừa là
`vnp_ExpireDate` gửi cho cổng, vừa là mốc `paymentExpiresAt` mà cleanup được phép hủy đơn. Vì
luôn bằng nhau nên lỗi này **vô hình**.

**Ca hỏng.** Khách bấm trả tiền ở phút 14:30 — cổng vẫn nhận vì chưa quá 15. Ngân hàng xử lý mất
60–90 giây. Callback về ở phút ~16 thì đơn đã bị cleanup hủy ở phút 15: tiền trừ rồi mà không có
vé, phải đi đường hoàn tiền thủ công.

**Cách xử lý.** Tách làm hai hằng số. Phần dôi ra là thời gian **chờ callback**, không phải thời
gian trả tiền — cổng đã tự đóng phiên ở phút 15 nên không ai mở giao dịch mới trong quãng đệm đó.
Có một test khoá bất biến `PAYMENT_WINDOW_MINUTES > GATEWAY_WINDOW_MINUTES`.

---

### 5.5 — Cái bẫy: dòng `INITIATED` suýt làm chết toàn bộ luồng xác nhận

Đây không phải sự cố đã xảy ra, mà là hố sập nằm ngay trên đường sửa §5.1 — ghi lại để đừng ai
đạp lại.

Chốt chống xử lý trùng Return/IPN là "đã tồn tại dòng `payment` mang `vnp_TxnRef` này chưa".
Từ khi mỗi lần mở cổng đều ghi trước một dòng mang **đúng** `vnp_TxnRef` đó, phép kiểm tra ấy sẽ
thấy chính dòng ta vừa tự ghi và kết luận nhầm rằng callback đã được xử lý.

**Hậu quả nếu bỏ sót: không đơn nào còn được xác nhận nữa.** Toàn bộ thanh toán chết câm, không
báo lỗi gì.

Chốt hiện tại là `existsByTransactionRefAndPaymentStatusNot(txnRef, "INITIATED")`, và `savePayment`
**cập nhật lại** dòng cũ chứ không chèn dòng thứ hai — chèn thêm thì lịch sử thanh toán đọc thành
khách bị thu tiền hai lần. Có test hồi quy riêng cho cả hai điều này.

---

### 5.6 — Lệch múi giờ

Cổng đối chiếu mọi mốc thời gian theo **giờ Việt Nam**, còn container deploy chạy **UTC**. Hai
lỗi đã gặp:

1. `vnp_CreateDate`/`vnp_ExpireDate` lấy theo giờ JVM thì lùi 7 tiếng, cổng đọc thấy đã quá hạn
   và báo *"Giao dịch đã quá thời gian chờ thanh toán"* ngay khi vừa mở trang.
   → Hai tham số này luôn lấy theo `VNPAY_ZONE`.

2. Muốn hỏi lại cổng về một giao dịch cũ thì phải dựng lại **đúng chuỗi đã gửi**. Nhưng
   `payment.payment_date` lưu theo giờ server còn `vnp_CreateDate` theo giờ VN — lệch 7 tiếng là
   cổng không tìm thấy giao dịch, và ta kết luận nhầm rằng khách chưa trả tiền.
   → `VNPayUtil.toGatewayDate` đổi ngược lại. Và cả hai mốc sinh ra từ **cùng một `Instant`**:
   gọi `now()` hai lần thì có thể lệch một giây, đủ để cổng không nhận ra.

---

## 6. Bốn mốc thời gian

| Giai đoạn | Hằng số | Giá trị | Đếm từ |
|---|---|---|---|
| Giữ ghế (chọn ghế → điền thông tin) | `SeatLockService.LOCK_TIMEOUT_MINUTES` | 10 | click ghế |
| Đơn PENDING chưa bấm sang cổng | `BookingCleanupService.PENDING_HOLD_MINUTES` | 5 | tạo đơn |
| Phiên ở cổng — **khách nhìn thấy số này** | `PaymentService.GATEWAY_WINDOW_MINUTES` | 15 | bấm thanh toán |
| Cửa sổ chống-hủy phía ta | `PaymentService.PAYMENT_WINDOW_MINUTES` | **20** | bấm thanh toán |
| Thôi chờ cổng trả lời | `BookingCleanupService.SWEEP_GIVE_UP_MINUTES` | 60 | **lúc đơn hết hạn** |

Form thông tin liên hệ nằm trong `BookingRequest`, tức là được điền **trước** khi đơn ra đời —
nó thuộc 10 phút khoá ghế, không phải 5 phút PENDING. Nên 10 và 5 không đá nhau.

Mốc cuối đếm từ lúc đơn **hết hạn**, không phải lúc tạo đơn: "chờ cổng bao lâu" và "khách ngồi
nghĩ bao lâu" là hai quãng khác nhau. Cộng gộp thì khách chần chừ 15 phút ở cổng bị cắt mất 15
phút hạn mức — mà đó đúng là loại đơn dễ đã bị trừ tiền nhất.

---

## 7. Chẩn đoán bằng log Render

Lọc theo các chuỗi này, **theo thứ tự**:

| Lọc | Trả lời câu hỏi gì |
|---|---|
| `Nhận callback` | Cổng có gọi về không, và bằng kênh nào (`[VNPay IPN]` hay `[VNPay Return]`) |
| `Chữ ký KHÔNG hợp lệ` | Callback có tới nhưng bị từ chối — kèm TmnCode nhận được vs đang cấu hình, độ dài secret, cờ khoảng trắng thừa |
| `Các tham số nhận được` | Cổng gửi đúng bộ trường nào (chỉ tên, không có giá trị) |
| `vnp_ResponseCode` | querydr trả về mã gì — đọc trước khi kết luận lỗi thứ tự trường |
| `Chuỗi ký querydr ta dựng` | Bằng chứng thô để dò công thức nối (§5.3) |
| `sắp bị hủy vì quá hạn` | Cleanup vừa cứu một đơn đã bị trừ tiền |
| `chưa hỏi được cổng VNPay` | Đã hủy một đơn **có thể** đã bị trừ tiền → đối chiếu tay với sao kê |

**Quy tắc đọc:** không có dòng `Nhận callback` nào với `vnp_TxnRef` thật ⇒ cổng chưa từng gọi
tới, vấn đề nằm ở cấu hình phía VNPay chứ không ở code. Có dòng đó rồi mới đào tiếp xuống.

Dòng `Nhận callback` in ở mức `INFO` và **trước** cả bước kiểm tra chữ ký — cố ý: một callback
chữ ký sai vẫn là một callback **đã tới**, và phân biệt "cổng không gọi" với "cổng gọi nhưng ta
từ chối" là toàn bộ giá trị của nó.

---

## 8. Cấu hình

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `VNP_TMN_CODE` | *(rỗng)* | Mã terminal |
| `VNP_HASH_SECRET` | *(rỗng)* | **Không bao giờ dán giá trị này vào file nào trong repo, kể cả test** |
| `VNP_RETURN_URL` | `localhost:8081/...` | Phải khớp Return Url trên portal |
| `VNP_VERIFY_CALLBACK` | `true` | Tắt thì querydr trả `UNAVAILABLE` và luồng chạy như trước khi có lớp này. Chỉ tắt khi môi trường không có đường ra Internet (dev offline, CI) |
| `ALLOWED_FRONTEND_ORIGINS` | 3 tên miền | Allowlist chống open redirect. Trả khách về sai tên miền là mất token trong `localStorage` |

**IPN Url điền trên portal VNPay**, không phải biến môi trường:
`https://<host>/api/payment/vnpay-ipn`, giao thức GET, HMACSHA512. Nhớ bấm **Hoàn thành** để
lưu — đây chính là chỗ đã gây ra §5.1.

`StartupSecretsValidator` chặn khởi động khi phát hiện khoá đã lộ. `ALLOW_KNOWN_LEAKED_SECRETS`
là cửa thoát hiểm chỉ nới cho lỗi *"khoá đã lộ"*, **không** nới cho lỗi *"thiếu khoá"*.

---

## 9. Việc còn lại

1. **Xoay `VNP_HASH_SECRET`.** Giá trị đang dùng đã lộ công khai trong lịch sử Git. Đăng ký
   terminal sandbox mới là cách nhanh nhất. Xong thì **xoá `ALLOW_KNOWN_LEAKED_SECRETS`**.
2. **Dò đúng thứ tự trường của chữ ký phản hồi querydr** (§5.3) — đã có sẵn bằng chứng thô
   trong log, làm offline được.
3. **Đặt `spring.datasource.hikari.minimum-idle: 0`.** Hiện `idle-timeout: 30000` **không có
   tác dụng** vì HikariCP mặc định `minimumIdle = maximumPoolSize`, và `idleTimeout` chỉ áp
   dụng khi `minimumIdle < maximumPoolSize`. Pool giữ 10 kết nối mở vĩnh viễn nên Neon không
   tự ngủ được lúc nào backend còn chạy, dù không ai dùng — và Neon tính tiền theo **thời gian
   compute thức**, không theo lượng truy vấn.
4. **Dọn đơn demo nếu cần số liệu doanh thu sạch.** `DemoBookingSeeder` đóng dấu
   `transaction_ref = 'DEMO<id>'` nên lọc ra được chính xác. Seeder mặc định tắt
   (`DEMO_SEED_BOOKINGS`), nhưng tắt cờ **không xoá** những dòng đã sinh.

---

## 10. Đọc thêm trong code

Các lời giải thích chi tiết nhất nằm ngay tại chỗ, dưới dạng Javadoc — mỗi quyết định đánh đổi
đều được ghi lý do tại nơi nó được thực hiện:

- `PaymentService.applyPaymentResult` — thứ tự ba lớp phòng thủ, và vì sao
- `PaymentService.sweepExpiredBooking` — vì sao "không hỏi được" ≠ "chưa trả tiền"
- `VNPayQueryService` (Javadoc lớp) — vì sao fail-open
- `VNPayUtil.validateHash` — vì sao chấp nhận cả hai cách mã hoá khoảng trắng
- `PaymentRepository.existsByTransactionRefAndPaymentStatusNot` — cái bẫy ở §5.5
