# Đa ngôn ngữ (i18n)

Tài liệu này mô tả cách VigoTrip xử lý đa ngôn ngữ ở cả ba nơi chữ nghĩa xuất hiện: giao diện web, thư gửi đi, và cơ chế nào quyết định "người này đọc tiếng gì".

Hệ thống hỗ trợ **4 ngôn ngữ**: `vi` (tiếng Việt, mặc định), `en`, `ja`, `zh`.

---

## 1. Nút đổi ngôn ngữ chính là cài đặt của tài khoản

Đây là quyết định thiết kế cần nắm trước khi đọc phần còn lại.

Chỉ có **một** điều khiển đổi ngôn ngữ: nút cờ trên header. Nó vừa đổi giao diện tức thì, vừa ghi lựa chọn xuống tài khoản khi người dùng đã đăng nhập. Cố ý **không** làm thêm một mục "Ngôn ngữ" riêng trong trang Cài đặt: hai điều khiển cho cùng một giá trị thì sớm muộn cũng có lúc lệch nhau, và khi đó không ai trả lời được cái nào mới là thật — trong khi thứ duy nhất người dùng quan tâm là "tôi chọn tiếng Anh thì mọi thứ phải là tiếng Anh".

Đổi lại, nút trên header giữ nguyên được ưu điểm bấm-phát-ăn-ngay khi demo.

### Ai thắng khi client và server bất đồng

Tình huống thật: khách chọn English lúc chưa đăng nhập, rồi đăng nhập vào tài khoản đang để tiếng Việt.

| Trường hợp | Xử lý |
|---|---|
| Đã tự bấm đổi ngôn ngữ **trong phiên này** | Lựa chọn vừa bấm thắng, và được đẩy ngược lên tài khoản |
| Chưa bấm gì trong phiên này | Tài khoản là nguồn đúng, giao diện đổi theo tài khoản |

Cờ đánh dấu "đã bấm trong phiên này" nằm ở `sessionStorage` (`languageTouchedThisSession`), nên nó chỉ sống trong tab hiện tại. Hai thái cực đều sai nên mới cần cờ này:

- **Luôn nghe server:** vừa bấm English xong đăng nhập cái là giao diện nhảy ngược về tiếng Việt, mail cũng về tiếng Việt. Hỏng đúng kịch bản hay dùng để demo.
- **Luôn nghe máy này:** cờ trong `localStorage` không bao giờ mất, nên máy nào từng đổi ngôn ngữ sẽ vĩnh viễn ghi đè lựa chọn mới đặt từ máy khác.

Mở lại trình duyệt ngày hôm sau thì `sessionStorage` đã rỗng, tài khoản lại là nguồn đúng — đúng như mong đợi.

---

## 2. Giao diện web

### Bản dịch nằm ở đâu

`my-react-app/src/context/LanguageContext.jsx` — cả 4 bảng ngôn ngữ trong một file.

Khi lấy chữ ra, `t` xếp lớp **vi → en → ngôn ngữ đang chọn**, nên khoá chưa dịch sang Nhật/Trung hiện ra bản tiếng Anh (hoặc tiếng Việt nếu `en` cũng chưa có) chứ không hiện `undefined`.

### Vì sao cần script kiểm tra

`t` là một **object**, nên `t.khoaGoSai` trả về `undefined` một cách im lặng. Tệ hơn: ở phần lớn chỗ gọi nó lại được che bằng `|| "chuỗi tiếng Việt"`, nên một khoá gõ sai hoặc quên thêm vào bảng sẽ hiện tiếng Việt cho người dùng tiếng Anh mà **không có gì báo** — không log, không test đỏ.

Đó không phải giả thuyết: lần đầu chạy script đã tìm ra **39 khoá** rơi vào đúng trường hợp này, trong đó cả trang doanh thu/BI (33 khoá `bi*`) chưa bao giờ dịch được dù nhìn code thì tưởng đã dịch.

### Chạy

```bash
npm run i18n:check --prefix my-react-app
```

Bước này chạy trong CI (job `build-frontend`). Nó **đỏ** khi:

- một khoá được gọi trong `src/` nhưng không có trong bảng `vi`;
- bảng `en` thiếu khoá so với `vi`;
- xuất hiện **thêm** chuỗi tiếng Việt viết cứng, hoặc **thêm** fallback kiểu `t.key || "…"`;
- một khoá mail được gọi trong Java nhưng không có trong `messages.properties`;
- `messages_vi.properties` thiếu khoá so với bản mặc định.

Chỉ **cảnh báo** khi `ja`/`zh` thiếu khoá — hai ngôn ngữ này đang hoãn có chủ ý, đã có fallback đỡ.

### Bánh cóc (ratchet)

Kho có sẵn **85 chuỗi cứng** và **706 fallback trùng lặp** từ trước. Bắt sửa hết mới cho build thì không ai chạy nổi, còn chỉ cảnh báo suông thì lẫn vào đống cũ và vô nghĩa. Nên toàn bộ nợ cũ đóng băng trong `my-react-app/scripts/i18n-baseline.json`, và CI chỉ chặn cái **phát sinh thêm**. Con số cũ chỉ giảm được, không tăng lại.

Dọn xong một phần thì hạ mốc:

```bash
npm run i18n:check --prefix my-react-app -- --update-baseline
```

Baseline so khớp theo **nội dung chuỗi**, không theo số dòng — dời code lên xuống thì dấu vân tay vẫn khớp.

Mục `notTranslationKeys` trong file baseline là danh sách viết tay, liệt kê các biến cục bộ cũng đặt tên `t` (một chuyến đi, một toast, một tab) để `t.arrivalTime` không bị hiểu nhầm là khoá dịch. Phân biệt cho đúng thì phải phân tích phạm vi biến bằng parser thật; số ca như vậy đủ ít để liệt kê thẳng, và liệt kê thẳng thì người đọc thấy được vì sao chúng được bỏ qua.

### Hạn chế đã biết

- Chỉ phát hiện được tiếng Việt **có dấu**. Chuỗi viết không dấu lọt lưới.
- Khoá ghép động (`t[labelKey]`) không đối chiếu được; script đếm và báo số chỗ như vậy.

---

## 3. Chữ trong thư gửi đi

### Nằm ở đâu

| File | Nội dung |
|---|---|
| `backend/ticket-booking/src/main/resources/messages.properties` | Bản **mặc định — tiếng Anh** |
| `backend/ticket-booking/src/main/resources/messages_vi.properties` | Bản tiếng Việt |

Bản mặc định là tiếng Anh chứ không phải tiếng Việt, vì đó là thứ Spring rơi về khi người nhận chọn một ngôn ngữ chưa dịch (`ja`, `zh`) hoặc khi một khoá bị thiếu. Tiếng Anh là bản đọc được với nhiều người nhất trong tình huống đó. Người dùng tiếng Việt không bao giờ chạm tới file mặc định — họ đọc `messages_vi.properties`, và tài khoản chưa chọn gì cũng được quy về `vi`.

Chuỗi dự phòng: `messages_vi.properties` → `messages.properties`.

`spring.messages.fallback-to-system-locale: false` trong `application.yml` là **bắt buộc**. Để `true` thì với `ja`/`zh`, Spring lấy locale của **máy chủ** làm bản dự phòng — tức chữ trong mail phụ thuộc vào cấu hình container, mỗi nơi deploy một kiểu.

### Vì sao mail đọc ngôn ngữ từ DB chứ không từ `Accept-Language`

Mail nhắc khởi hành do bộ lập lịch gửi lúc nửa đêm; mail báo hoãn/huỷ chuyến do quản trị viên bấm từ máy khác. Ở những luồng đó **không có request nào** để mà đọc header. Nơi duy nhất trả lời được "người này đọc tiếng gì" là bản ghi tài khoản.

Vì vậy `EmailService` **nhận `Locale` từ bên gọi**, không tự đi tra cứu: cả class chạy trên thread `@Async` nơi không còn Hibernate Session, nên việc đọc ngôn ngữ thuộc về phía gọi — nơi vẫn còn entity trong tay.

Hai hàm trợ giúp:

- `User.resolveLocale()` — ngôn ngữ của một tài khoản.
- `Booking.resolveNotificationLocale()` — ngôn ngữ để soạn mail về một đơn. Đơn của khách vãng lai (không có tài khoản) rơi về tiếng Việt. Đơn đặt hộ lấy ngôn ngữ của người **đặt**, không phải người nhận mail: người nhận có thể không có tài khoản, còn người đặt thì hệ thống biết chắc họ vừa đọc giao diện bằng thứ tiếng gì.

### Lưu ý khi viết chuỗi mới

Ở những dòng có tham số `{0}`, **dấu nháy đơn phải viết gấp đôi** (`''`) vì `MessageFormat` coi nháy đơn là ký tự thoát. Cách an toàn hơn là đừng dùng nháy đơn.

Và đừng truyền `Long`/`int` thẳng làm tham số cho mã đơn: `MessageFormat` định dạng số có dấu phân cách nhóm, `#1234` sẽ thành `#1,234`. Truyền `String.valueOf(id)`.

---

## 4. Đường đi của một lựa chọn ngôn ngữ

```
Người dùng bấm cờ trên header
        │
        ├─► applyLanguage()  → state + localStorage + <html lang> + sự kiện 'languageChange'
        ├─► đánh dấu sessionStorage.languageTouchedThisSession
        └─► PUT /api/users/me/language   (chỉ khi đã đăng nhập)
                    │
                    ▼
            nguoi_dung.ngon_ngu
                    │
     ┌──────────────┴───────────────┐
     ▼                              ▼
User.resolveLocale()      Booking.resolveNotificationLocale()
     │                              │
     └──────────────┬───────────────┘
                    ▼
      EmailService.send*(..., Locale)
                    ▼
          messages_vi / messages.properties
```

Chiều ngược lại: `AuthContext` nạp `/api/users/me` sau khi đăng nhập, rồi gọi `syncLanguageFromProfile(data.language)` để đồng bộ giao diện theo tài khoản (xem quy tắc "ai thắng" ở mục 1).

Đăng ký tài khoản mới gửi kèm `language` trong body: mail kích hoạt là lá thư **đầu tiên** hệ thống gửi, mà lúc đó tài khoản còn chưa tồn tại để lưu lựa chọn ngôn ngữ. Không gửi kèm thì người đang xem bản tiếng Anh nhận mail kích hoạt bằng tiếng Việt — đúng khoảnh khắc họ chưa biết VigoTrip có tiếng Anh hay không.

### API

```
PUT /api/users/me/language
Authorization: Bearer <token>
Content-Type: application/json

{ "language": "en" }
```

Trả về `UserResponse` (đã kèm trường `language`). Mã lạ trả `400`; danh sách hợp lệ nằm ở `com.booking.api.i18n.SupportedLocales` và **phải khớp** với `LANGUAGES` trong `LanguageContext.jsx`.

### Cột trong cơ sở dữ liệu

`nguoi_dung.ngon_ngu VARCHAR(5) NULL` — `null` nghĩa là chưa từng chọn, hiểu là `vi`.

Dự án chạy `spring.jpa.hibernate.ddl-auto=update` nên cột này được tạo tự động lúc khởi động. Môi trường nào tắt `ddl-auto` thì chạy tay:

```sql
ALTER TABLE nguoi_dung ADD ngon_ngu VARCHAR(5) NULL;   -- SQL Server
ALTER TABLE nguoi_dung ADD COLUMN ngon_ngu VARCHAR(5); -- PostgreSQL
```

---

## 5. Còn lại

- **`ja` / `zh` thiếu 314 khoá giao diện** và chưa có file `messages_ja/zh.properties`. Hoãn có chủ ý — ưu tiên hoàn thiện tiếng Anh trước. Fallback đang đỡ nên không có màn hình nào vỡ.
- **706 fallback trùng lặp + 85 chuỗi cứng** đang đóng băng trong baseline. Dọn dần: bỏ phần `|| "…"` ở chỗ gọi, để bảng `vi` là nguồn duy nhất.
- **103 khoá không dùng** trong bảng `vi` — script liệt kê sẵn, xoá được.
- **Tách bảng dịch ra JSON** theo namespace (`src/i18n/locales/*.json`) để `LanguageContext.jsx` không còn 5000 dòng. Khi làm, chỉ cần sửa hàm `loadLocales()` trong `scripts/i18n-check.mjs`, phần còn lại giữ nguyên.
- **Thông báo lỗi từ API** vẫn là tiếng Việt cứng (khoảng 931 chuỗi trong Java). Muốn dịch thì thêm `LocaleResolver` đọc `Accept-Language` — nhưng phải gom 50 chỗ gọi `fetch()` trần về `apiFetch` trước để có một chỗ nhét header.
