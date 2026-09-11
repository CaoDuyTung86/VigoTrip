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

### Chống trùng: ba lớp, lớp cuối nằm dưới cơ sở dữ liệu

Cùng một giao dịch về hai lần là chuyện bình thường (Return và IPN), nên xử lý nó hai lần thì
không. Ba thứ chặn việc đó, xếp từ trong ra ngoài:

| Lớp | Cơ chế | Ở đâu |
|---|---|---|
| Khoá dòng đơn | `SELECT ... FOR UPDATE` xếp hàng hai luồng callback | `BookingRepository.findByIdForUpdate` |
| Cờ đã xử lý | `vnp_TxnRef` đã có kết quả chưa (loại trừ `INITIATED`) | `existsByTransactionRefAndPaymentStatusNot` |
| Index duy nhất | DB từ chối dòng thứ hai cùng `vnp_TxnRef` | `ux_thanh_toan_transaction_ref` |

Hai lớp đầu là logic ứng dụng — chúng chỉ đúng **chừng nào code còn viết đúng**. Lớp thứ ba
không phụ thuộc điều đó: nó chặn cả khi chạy nhiều instance, khi ai đó sửa dữ liệu bằng tay,
hoặc khi một thay đổi sau này vô tình bỏ mất phép kiểm tra kia. §5.7 là bằng chứng lớp này cần
thiết chứ không thừa.

Index **không tự tạo** bằng `ddl-auto=update` (nó là index có điều kiện lọc). Script và hướng
dẫn từng bước cho cả PostgreSQL lẫn SQL Server: `backend/migrations/2026-09-06__unique_transaction_ref.sql`.

Mệnh đề `WHERE transaction_ref IS NOT NULL` là bắt buộc trên SQL Server: nơi đó các `NULL` bị
coi là **trùng nhau**, nên một `UNIQUE` thường sẽ chỉ cho phép đúng một dòng có mã giao dịch
rỗng trong cả bảng — mà cột này rỗng thật được.

Khi index chặn một lượt ghi, lỗi **không được bắt bên trong** `PaymentService`: transaction đã
bị đánh dấu rollback-only nên mọi giá trị trả về từ bên trong đều bị Spring lật lại thành
`UnexpectedRollbackException` lúc commit. `PaymentController` — điểm đầu tiên nằm ngoài
transaction — mới là nơi dịch nó thành `RspCode 02` cho IPN, hoặc trang kết quả cho Return.

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

Một lượt dọn xử lý mỗi đơn bằng ba bước tách rời — đọc manh mối, hỏi cổng, ghi kết quả — trong
đó chỉ bước đầu và bước cuối chạm CSDL, mỗi bước một transaction ngắn riêng. Lời gọi ra cổng nằm
ở giữa, ngoài mọi transaction.

Cleanup vẫn chặn **20 đơn/lượt**, nhưng lý do đã đổi: không còn là để khỏi giữ connection, mà là
để một lượt dọn không kéo dài quá lâu — bộ lập lịch mặc định của Spring chỉ có một luồng, lượt
dọn chạy lâu là mọi job theo lịch khác phải xếp hàng chờ. Phần bị bỏ qua vẫn PENDING nên lượt
sau nhặt tiếp.

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

**Triệu chứng.** Cảnh báo này từng xuất hiện ở **mọi** giao dịch, suốt nhiều tháng.

**Nguyên nhân: `vnp_OrderInfo`.** Cổng **có** ký trường này trong phản hồi querydr, còn ta thì
bỏ hẳn nó ra ngoài chuỗi nối. Nó nằm sau `vnp_TransactionStatus` và trước cặp khuyến mãi — tức
**không** theo thứ tự các khoá trong body JSON, nơi nó đứng ngay sau `vnp_Amount`. Đoán theo thứ
tự body là trượt, và đó là lý do nhiều tháng không ai dò ra bằng mắt.

**Đã sửa ngày 11/09/2026.** Thứ tự đúng, 15 trường:

```
vnp_ResponseId|vnp_Command|vnp_ResponseCode|vnp_Message|vnp_TmnCode|vnp_TxnRef|vnp_Amount|
vnp_BankCode|vnp_PayDate|vnp_TransactionNo|vnp_TransactionType|vnp_TransactionStatus|
vnp_OrderInfo|vnp_PromotionCode|vnp_PromotionAmount
```

Hai trường khuyến mãi gần như luôn vắng mặt trong phản hồi, nhưng cổng **vẫn ký chúng dưới dạng
chuỗi rỗng**, nên chuỗi ký kết thúc bằng hai dấu gạch đứng và không được lược bớt. Thứ tự nằm ở
hằng số `RESPONSE_HASH_FIELDS`; `VNPayQueryServiceTest` khoá lại đúng chuỗi ấy bằng một chuỗi
mong đợi viết tay, chứ không dựng lại từ cùng danh sách trường — dựng từ cùng nguồn thì test tự
đúng với mọi thứ tự và không chặn được gì.

**Vẫn chỉ ghi log, không phủ quyết.** Lý do không đổi: thứ chứng thực phản hồi là TLS tới đúng
tên miền của cổng, còn chữ ký chỉ là lớp đối chiếu thêm. Để nó phủ quyết thì một sai sót thứ tự
sẽ chặn đứng **mọi** thanh toán, mà chính trường hợp này cho thấy một sai sót như vậy sống được
nhiều tháng. Điều đã đổi là ý nghĩa của cảnh báo: trước đây nó kêu ở mọi giao dịch nên không ai
đọc, giờ nó im ở giao dịch bình thường và chỉ kêu khi có chuyện thật.

**Cách dò lại, nếu một ngày nào đó nó kêu trở lại.** `logChecksumEvidence` in ra chuỗi ký ta
dựng, **body JSON thô**, và hai chữ ký. Ba bước:

1. Lấy khối `Phản hồi querydr thô: {...}` trong log Render của một giao dịch **mã 00**, lưu
   thành một file `.json` **ngoài repo** — xem cảnh báo bên dưới.
2. Chạy `scripts/vnpay-querydr-checksum-probe.py` với `VNP_HASH_SECRET` là khoá **đang hiệu
   lực lúc phản hồi đó được ký**. Script thử vài chục cách nối: thứ tự tài liệu có và không có các
   trường tuỳ chọn, thứ tự khoá trong body, thứ tự chữ cái, dạng `key=value`, họ "sai đúng một
   vị trí", và họ đã tìm ra đáp án lần này — chèn một trường lạ của body vào mọi vị trí có thể.
3. Trúng ứng viên nào thì sửa `RESPONSE_HASH_FIELDS` cho khớp, và sửa luôn chuỗi mong đợi
   trong `VNPayQueryServiceTest` cùng bản sao `DOCUMENTED` trong script.

> ⚠️ **File phản hồi thô là thứ phải xoá sau khi dùng.** Nó chứa một `vnp_SecureHash` thật, tức
> một mẫu HMAC của hash-secret đang hiệu lực, kèm mã giao dịch và số tiền thật. Đừng lưu nó
> trong repo: một lần `git add -A` là nó vào lịch sử công khai vĩnh viễn. Chính vì lý do này mà
> `redactSignatures` bôi chữ ký trước khi ghi vào `nhat_ky_thanh_toan` (§8) — nên bảng đó cũng
> **không** dùng để dò được, nguồn duy nhất có chữ ký là log Render.

> ⚠️ **Thế hệ khoá.** Khoá đã xoay ngày 11/09/2026. Một phản hồi bắt được trước mốc đó chỉ khớp
> với khoá cũ; dò bằng khoá mới thì mọi ứng viên đều trượt và không học được gì.

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

### 5.7 — Booking 49 và 52: một khoản thu, hai dòng `payment`

**Triệu chứng.** Phát hiện ngày 06/09/2026 khi rà dữ liệu trước lúc tạo index chống trùng:
`thanh_toan` có hai cặp dòng trùng `transaction_ref`.

| Booking | `transaction_ref` | Hai dòng cách nhau | Trạng thái |
|---|---|---|---|
| 49 | `be76f754eb98` | **92 mili giây** | cả hai `SUCCESS`, cùng 4.952.950đ |
| 52 | `e86bac3593af` | **199 mili giây** | cả hai `SUCCESS`, cùng 4.462.500đ |

**Không mất tiền.** Dashboard VNPay sandbox xác nhận mỗi giao dịch chỉ thu **một lần**. Đây là
một khoản thu bị ghi lại hai lần, không phải hai lần trừ tiền. Khách đã nhận vé.

**Nguyên nhân.** Khoảng cách vài chục mili giây là chữ ký của việc Return và IPN về gần như
cùng lúc: cả hai cùng tra `findByTransactionRef`, cùng thấy trống, cùng chèn một dòng mới.
Cả hai cặp đều **không có dòng `INITIATED`** — dấu hiệu chúng ra đời trước khi có thay đổi ở
§4 (ghi trước dòng `INITIATED` lúc mở phiên). Từ khi có dòng đó, `savePayment` tìm thấy và
**cập nhật** nó thay vì chèn thêm.

**Tác hại nếu để nguyên.** `PaymentRepository.findByTransactionRef` khai báo trả về đúng một
kết quả. Hễ có callback nào tới cho một mã đang bị trùng là Spring ném
`IncorrectResultSizeDataAccessException` và lượt xử lý chết giữa chừng.

**Đã xử lý.** Xoá dòng thừa (giữ `payment_id` nhỏ hơn — hai dòng giống hệt nhau về nội dung),
rồi tạo index chống trùng. Doanh thu không bị ảnh hưởng: báo cáo đọc từ `dat_ve` chứ không
đọc `thanh_toan`, và không bảng nào có khoá ngoại trỏ vào `thanh_toan.payment_id`.

**Bài học.** Khoá dòng đơn ở lớp một là đúng, nhưng nó chỉ bảo vệ được đoạn code đi qua nó.
Dữ liệu sinh ra từ trước khi có lớp bảo vệ vẫn nằm nguyên trong bảng — và không có gì phát
hiện ra chúng cho tới khi ai đó chủ động đi tìm.

---

## 6. Năm mốc thời gian

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

> **Trước khi đọc log Render, hãy tra bảng nhật ký giao dịch (§8).** Log container bị xoá mỗi
> lần restart; bảng nhật ký giữ 180 ngày. Log Render vẫn hữu ích cho những gì bảng không ghi:
> diễn biến của cleanup, và chi tiết chẩn đoán chữ ký.

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

## 8. Nhật ký giao dịch (`nhat_ky_thanh_toan`)

**Vì sao cần một bảng, trong khi đã có `log.info`.** Log ứng dụng nằm trong container. Container
restart, hoặc nhà cung cấp xoay vòng log, là chứng cứ biến mất — mà tranh chấp tiền nong thì
thường nổ ra sau đó vài ngày. Chính §5.1 đã không truy được đến cùng vì lý do này.

**Ghi gì.** Một dòng cho **mọi** lượt, kể cả lượt bị từ chối:

| Kênh | Khi nào ghi |
|---|---|
| `RETURN` | Cổng chuyển hướng trình duyệt khách về backend |
| `IPN` | Cổng gọi ngầm server-to-server |
| `QUERYDR` | Ta chủ động hỏi cổng — **cả lúc không hỏi được** |
| `REFUND_APPROVE` / `REFUND_REJECT` | Người vận hành quyết định hoàn tiền, kèm email người bấm |

Cột đáng chú ý: `signature_valid` (chữ ký hợp lệ hay không), `outcome` (kết luận của lượt đó —
`RspCode` với IPN, chuỗi kết quả với Return, verdict với querydr), `source_ip`, và hai cột
payload giữ **nguyên văn** thứ nhận được / gửi đi.

**Ba tính chất được thiết kế có chủ đích:**

1. **Ghi bằng transaction riêng** (`REQUIRES_NEW`, xem `PaymentLogWriter`). Nếu dùng chung
   transaction với luồng callback thì nó rollback cùng luồng hỏng — đúng những lượt cần bằng
   chứng nhất lại là những lượt không để lại gì.
2. **Không bao giờ ném lỗi ra ngoài.** Ghi chép hỏng thì mất một dòng bằng chứng; ném lỗi ra
   ngoài là làm hỏng chính giao dịch nó sinh ra để bảo vệ.
3. **Không lưu chữ ký.** `vnp_SecureHash` bị lọc khỏi cả hai chiều — kết luận về chữ ký đã nằm
   ở cột riêng, còn bản thân chữ ký chỉ là mẫu HMAC của hash-secret đang dùng.

**Tra cứu.** Hai đường, cùng dữ liệu:

- **Tab admin** `/admin/payment-logs` (chỉ `ROLE_ADMIN`). Nhập mã giao dịch hoặc mã đơn.
- **SQL trực tiếp**, khi cần lọc phức tạp hơn:
  ```sql
  SELECT * FROM nhat_ky_thanh_toan
  WHERE transaction_ref = 'ma_khach_dua' ORDER BY created_at;
  ```

**Tab admin cố ý KHÔNG có danh sách để duyệt.** Đây là quyết định về bề mặt tấn công: trước khi
có màn hình, đọc bảng này phải có thông tin đăng nhập cơ sở dữ liệu — một nhóm rất nhỏ. Mở ra
web là hạ nó xuống thành "ai có phiên quản trị", cộng mọi đường mất phiên thường gặp. Bắt buộc
biết trước mã (do chính khách khiếu nại cung cấp) là thứ giữ cho việc mở ra đó không thành một
cái vòi tải dữ liệu. **Đừng thêm endpoint liệt kê vào đây vì "cho tiện".**

Mỗi lượt tra cứu ghi một dòng `INFO` kèm email người tra — nếu tài khoản quản trị bị chiếm thì
đó là chỗ duy nhất còn dấu.

---

## 9. Cấu hình

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `VNP_TMN_CODE` | *(rỗng)* | Mã terminal |
| `VNP_HASH_SECRET` | *(rỗng)* | **Không bao giờ dán giá trị này vào file nào trong repo, kể cả test** |
| `VNP_RETURN_URL` | `localhost:8081/...` | Phải khớp Return Url trên portal |
| `VNP_VERIFY_CALLBACK` | `true` | Tắt thì querydr trả `UNAVAILABLE` và luồng chạy như trước khi có lớp này. Chỉ tắt khi môi trường không có đường ra Internet (dev offline, CI) |
| `ALLOWED_FRONTEND_ORIGINS` | 3 tên miền | Allowlist chống open redirect. Trả khách về sai tên miền là mất token trong `localStorage` |
| `PAYMENT_AUDIT_ENABLED` | `true` | Công tắc nhật ký giao dịch (§8). Tắt là mất bằng chứng cho mọi tranh chấp sau đó |
| `PAYMENT_AUDIT_RETENTION_DAYS` | `180` | Dài hơn hẳn lịch sử chat (30) vì đối soát ngân hàng tính bằng tháng |
| `PAYMENT_AUDIT_CLEANUP_CRON` | `0 15 3 * * *` | Lệch khỏi các job dọn chat (3h00, 3h30, 3h45) để không có hai `DELETE` lớn chồng nhau |
| `BOOKING_CLEANUP_SAFETY_SWEEP_MINUTES` | `30` | Lưới an toàn của `PendingBookingSignal`: dù cổng đang đóng thì cứ ngần này phút vẫn quét lại một lượt. Đặt `0` để tắt cổng, quét mỗi phút như trước |

**IPN Url điền trên portal VNPay**, không phải biến môi trường:
`https://<host>/api/payment/vnpay-ipn`, giao thức GET, HMACSHA512. Nhớ bấm **Hoàn thành** để
lưu — đây chính là chỗ đã gây ra §5.1.

Giá trị đang đặt trên portal từ 11/09/2026: `https://datxe-com.onrender.com/api/payment/vnpay-ipn`,
tức trỏ thẳng vào backend Render chứ không qua Vercel. Cố ý: rewrite của Vercel là để phục vụ
trình duyệt của khách, còn IPN là cuộc gọi máy-tới-máy từ cổng, thêm một chặng trung gian chỉ
thêm một chỗ hỏng và một chỗ nữa có thể đổi thân yêu cầu trước khi chữ ký được kiểm.

`StartupSecretsValidator` chặn khởi động khi phát hiện khoá đã lộ. `ALLOW_KNOWN_LEAKED_SECRETS`
là cửa thoát hiểm chỉ nới cho lỗi *"khoá đã lộ"*, **không** nới cho lỗi *"thiếu khoá"*.

---

## 10. Việc còn lại

> **Đã xong ngày 06/09/2026:** nhật ký giao dịch (§8), index chống trùng (§4), dọn hai cặp dòng
> trùng của booking 49 và 52 (§5.7).
>
> **Đã xong ngày 11/09/2026:** tách lời gọi `querydr` ra khỏi transaction (việc số 5); xoay
> `VNP_HASH_SECRET` (việc số 1); dò ra thứ tự trường của chữ ký phản hồi querydr (việc số 2,
> §5.3); trỏ IPN Url trên portal về backend Render (§9); bật chạy đủ bộ test backend trong CI
> thay cho `-DskipTests`.
>
> Một giao dịch sandbox thật cùng ngày (booking 67, 424.150đ) đi trọn luồng và cho phản hồi
> querydr mã 00: khoá mới trên Render và trên portal đang khớp nhau.
>
> Danh sách dưới đây là phần còn lại.

1. ~~Xoay `VNP_HASH_SECRET`.~~ **Đã làm ngày 11/09/2026.** Giá trị cũ đã lộ công khai trong
   lịch sử Git; hash của nó vẫn nằm trong `LEAKED_SHA256` của `StartupSecretsValidator` nên
   không ai vô tình khôi phục lại được từ một file `.env` cũ. Việc còn lại là kiểm tra biến
   môi trường trên Render **không còn** `ALLOW_KNOWN_LEAKED_SECRETS=true`: cửa thoát hiểm mở
   sẵn trên môi trường thật thì tự nó vô hiệu hoá chính lớp chặn.
2. ~~Dò đúng thứ tự trường của chữ ký phản hồi querydr.~~ **Đã làm ngày 11/09/2026** bằng
   `scripts/vnpay-querydr-checksum-probe.py` trên một phản hồi sandbox thật. Thủ phạm là
   `vnp_OrderInfo` — chi tiết và cách dò lại ở §5.3.
3. ~~Đặt `spring.datasource.hikari.minimum-idle: 0`.~~ **Đã làm.** Trước đó
   `idle-timeout: 30000` không có tác dụng vì HikariCP mặc định `minimumIdle = maximumPoolSize`,
   và `idleTimeout` chỉ áp dụng khi `minimumIdle < maximumPoolSize`; pool giữ 10 kết nối mở
   vĩnh viễn. Một mình nó chưa đủ để Neon ngủ — nhịp quét mỗi 60 giây của
   `BookingCleanupService` vẫn đánh thức compute — nhưng việc số 8 đã xử lý nốt phần đó.
4. **Dọn đơn demo nếu cần số liệu doanh thu sạch.** `DemoBookingSeeder` đóng dấu
   `transaction_ref = 'DEMO<id>'` nên lọc ra được chính xác. Seeder mặc định tắt
   (`DEMO_SEED_BOOKINGS`), nhưng tắt cờ **không xoá** những dòng đã sinh.
5. ~~Tách lời gọi `querydr` ra khỏi transaction.~~ **Đã làm.** Trước đó
   `VNPayQueryService.query` — 3 giây kết nối cộng 6 giây đọc — chạy **bên trong** transaction
   của cả hai đường callback lẫn của `BookingCleanupService`, nên mỗi giây chờ cổng là một giây
   giữ một connection trong pool mười chỗ, và với hai đường callback thì giữ luôn cả khoá dòng
   đơn. Giờ cả ba đường đều theo cùng một hình: hỏi cổng **trước**, ngoài transaction; mở một
   transaction ngắn **sau** chỉ để ghi kết quả.
   - `handleVNPayReturn` / `handleVNPayIPN` không còn `@Transactional`. Chúng gọi
     `askGatewayFirst` rồi chuyển sang `handleVNPay*InTransaction` qua proxy của Spring, mang
     theo kết luận của cổng trong một `CallbackVerification`.
   - `askGatewayFirst` chỉ hỏi khi kết luận thật sự được dùng tới: callback báo thành công,
     chữ ký hợp lệ, đúng số tiền, và giao dịch chưa được lượt callback trước xử lý. Chữ ký
     được kiểm hai lần có chủ ý — lần ở ngoài ngăn người lạ gọi vào endpoint công khai để bắt
     máy chủ bắn hàng loạt yêu cầu sang cổng.
   - Cleanup tách thành `planSweep` (transaction chỉ-đọc) → `askGateway` (không transaction)
     → `settleExpiredBooking` (transaction ghi, có khoá dòng). Bước cuối đọc lại đơn kèm khoá
     và kiểm tra lại cả trạng thái lẫn điều kiện quá hạn, vì trong quãng chờ cổng thì một
     callback thật có thể đã về, hoặc khách vừa mở một phiên thanh toán mới.
   - `CallbackVerification` và `SweepProbe` đều mang theo số tiền đã dùng để hỏi. Nửa trong
     chỉ tin câu trả lời khi con số đó còn khớp với giá trị đơn; lệch thì coi như chưa hỏi.
   - `MAX_BOOKINGS_PER_RUN = 20` **giữ nguyên**, không bỏ như dự tính ban đầu. Nó không còn
     chặn việc giữ connection nữa, nhưng vẫn cần để một lượt dọn không chiếm luồng lập lịch
     duy nhất của Spring quá lâu.
6. **ShedLock cho các job `@Scheduled`.** *(~2–3 giờ)* Hệ thống có 9 job chạy theo lịch, tất cả
   đều giả định **chỉ có một tiến trình**. Chạy từ hai instance trở lên mà không có khoá phân
   tán thì hai `BookingCleanupService` cùng quét một đơn, hai `TripReminderScheduler` cùng gửi
   một mail nhắc. **Chưa cần làm chừng nào còn chạy một instance** — xem ghi chú dưới bảng.
7. **API Refund tự động** (`vnp_Command=refund`). *(~2–3 ngày)* Hiện `approveRefund` chỉ đổi
   trạng thái và gửi mail; tiền do người thật chuyển tay. **Kiểm tra quyền hoàn tiền của
   merchant TRƯỚC khi viết code** — lệnh `refund` cần VNPay cấp quyền riêng và rất có thể không
   bật được ở môi trường thật, build xong mới biết thì phí công. Nếu làm: chỉ tự động cho nhánh
   `LATE_NEEDS_REFUND` (lỗi hệ thống, không cần con người phán xét); khách chủ động xin hủy vé
   thì vẫn để người duyệt. Bắt buộc idempotent — một `vnp_TxnRef` chỉ được hoàn đúng một lần.
8. ~~Để Neon thật sự ngủ được.~~ **Đã làm** — xem §12.

### Khi nào mới cần chạy nhiều instance

Không phải khi "muốn nhanh hơn". Chỉ có ba lý do thật:

| Lý do | Dấu hiệu nhận biết |
|---|---|
| Một tiến trình không chịu nổi tải | CPU/RAM chạm trần liên tục, người dùng thấy chậm rõ rệt |
| Cần không gián đoạn khi deploy | Không chấp nhận được vài chục giây chết lúc cập nhật |
| Cần chịu được hỏng một máy | Một container chết là dịch vụ ngừng, không chấp nhận được |

Không lý do nào áp dụng cho dự án này ở quy mô hiện tại, nên **một instance là lựa chọn đúng** —
và còn tránh được cả một lớp lỗi (job chạy trùng, bộ đếm ngân sách AI và `SeatLockService` đều
để trong RAM tiến trình). Việc số 6 chỉ trở nên bắt buộc vào ngày quyết định nhân bản backend.

**Số instance backend không liên quan tới hoá đơn Neon.** Neon là *cơ sở dữ liệu*, tính tiền
theo **thời gian compute thức**, không theo số truy vấn. Thứ đốt CU-hrs là những gì giữ compute
thức — pool kết nối và các job chạy theo lịch chạm vào DB — chứ không phải số tiến trình gọi vào.
Nhân đôi backend không làm hoá đơn Neon tăng gấp đôi. Chi tiết và những gì đã sửa: §12.

---

## 11. Đọc thêm trong code

Các lời giải thích chi tiết nhất nằm ngay tại chỗ, dưới dạng Javadoc — mỗi quyết định đánh đổi
đều được ghi lý do tại nơi nó được thực hiện:

- `PaymentService.applyPaymentResult` — thứ tự ba lớp phòng thủ, và vì sao
- `PaymentService.applySweepAnswers` — vì sao "không hỏi được" ≠ "chưa trả tiền"
- `PaymentService.askGatewayFirst` — vì sao câu hỏi gửi sang cổng phải xong trước khi transaction mở
- `BookingCleanupService.cancelUnpaidBookings` — ba bước, ba transaction, và lời gọi mạng nằm giữa
- `VNPayQueryService` (Javadoc lớp) — vì sao fail-open
- `VNPayQueryService.RESPONSE_HASH_FIELDS` — thứ tự trường của chữ ký phản hồi, và vì sao
  `vnp_OrderInfo` nằm ở chỗ không ai ngờ
- `VNPayUtil.validateHash` — vì sao chấp nhận cả hai cách mã hoá khoảng trắng
- `PaymentRepository.existsByTransactionRefAndPaymentStatusNot` — cái bẫy ở §5.5
- `PaymentLog` (Javadoc lớp) — vì sao cần một bảng chứ không chỉ log ứng dụng
- `PaymentLogWriter` (Javadoc lớp) — vì sao phải ghi bằng transaction riêng, và cái giá của nó
- `PaymentService.isDuplicateTransactionRef` — vì sao nhận diện lỗi trùng bằng **tên index**
- `PaymentController.returnResult` — vì sao lỗi ràng buộc phải bắt ở controller, không bắt trong service
- `AdminPaymentLogController` (Javadoc lớp) — vì sao chỉ tra cứu, không có danh sách để duyệt
- `backend/migrations/2026-09-06__unique_transaction_ref.sql` — cách tạo index, và đường lùi
- `PendingBookingSignal` (Javadoc lớp) — vì sao lượt dọn được phép ngủ, và khe hở phải bịt để ngủ an toàn

---

## 12. Vì sao hoá đơn Neon cao, và đã sửa những gì

Neon tính tiền theo **thời gian compute thức**, không theo số truy vấn, và tự ngủ sau **5 phút**
không có truy vấn nào. Nghĩa là chỉ cần một thứ chạm vào DB đều đặn dưới 5 phút một lần là hoá
đơn bằng đúng hoá đơn của một máy chủ chạy 24/7, dù không có người dùng nào.

Có ba thứ như vậy trong dự án này:

| Thứ giữ compute thức | Nhịp | Tình trạng |
|---|---|---|
| HikariCP giữ 10 kết nối mở vĩnh viễn | liên tục | **Đã sửa** — `minimum-idle: 0` (§10 việc 3) |
| `BookingCleanupService` quét đơn quá hạn | 60 giây | **Đã sửa** — `PendingBookingSignal` |
| Render ping Health Check Path định kỳ | tuỳ Render, không chỉ lúc deploy | **Đã sửa** — `management.health.db.enabled: false` |

### Lượt quét biết ngủ

`BookingCleanupService.sweepExpiredBookingsIfNeeded` hỏi `PendingBookingSignal` trước khi chạm
DB. Cổng chỉ đóng khi một lượt quét vừa nhìn thấy `countByStatus("PENDING") == 0`, và mở lại
ngay khi `BookingService.createBooking` báo có đơn mới. Không còn đơn nào treo thì backend
không gửi một câu truy vấn nào — Neon ngủ.

Ba khe hở đã bịt, và mỗi cái đều là một đơn có thể nằm lại vĩnh viễn nếu bỏ qua:

- **Đơn tạo giữa lúc quét.** Cổng so bằng *bộ đếm số đơn đã tạo*, không bằng cờ boolean: lượt
  quét chỉ được đóng cổng nếu bộ đếm chưa nhích kể từ lúc nó bắt đầu.
- **Đơn chưa commit.** Tín hiệu chỉ tính sau `afterCommit`. Tính sớm hơn thì lượt quét có thể
  chốt "DB sạch" đúng vào lúc dòng chưa hiện ra, rồi dòng đó commit sau khi cổng đã đóng.
- **Một đường tạo đơn mới mà quên báo tín hiệu.** Lưới an toàn
  `BOOKING_CLEANUP_SAFETY_SWEEP_MINUTES` (mặc định 30) vẫn quét lại bất kể cổng: hậu quả tệ
  nhất là dọn trễ 30 phút thay vì không bao giờ dọn. Giá phải trả là compute thức khoảng 5
  phút mỗi 30 phút thay vì ngủ hẳn — vẫn cắt hơn 80% so với trước.

Toàn bộ trạng thái này nằm trong RAM tiến trình, nên **chỉ đúng khi chạy một instance**, đúng
như `SeatLockService`. Xem ghi chú cuối §10.

### `/actuator/health` không còn chạm DB

Health Check Path trên Render đang trỏ vào `/actuator/health` (`permitAll` trong
`SecurityConfig`), và Render ping endpoint này định kỳ suốt vòng đời instance để quyết định có
restart service hay không — không chỉ lúc deploy. Mặc định Spring Boot gắn
`DataSourceHealthIndicator` vào đó, nên mỗi lần Render ping là một truy vấn xuống Neon, đều đặn
hơn hẳn ngưỡng autosuspend 5 phút. Có ping này thì hai việc phía trên vô nghĩa — Neon vẫn thức
24/7 bất kể có đơn PENDING nào hay không.

Đã tắt riêng nhánh DB của health check (`management.health.db.enabled: false`
trong `application.yml`); các chỉ báo khác (`mail` đã tắt từ trước, `disk`, `ping`...) vẫn chạy
bình thường. Đổi lại, Render không còn tự phát hiện "DB chết" qua health check — chấp nhận
được vì cleanup service và các lời gọi DB khác đã tự chịu lỗi tạm thời (`Verdict.UNAVAILABLE`
fail-open, `TripSupplyScheduler` nuốt lỗi để không chết lịch), không dựa vào health check để
phản ứng.
