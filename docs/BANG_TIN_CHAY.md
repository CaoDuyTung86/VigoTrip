# Bảng tin chạy (Announcement Ticker)

Dải chữ chạy ngang kiểu bảng điện tử nhà ga, nằm ngay dưới `Header` trên mọi trang có
header. Tài liệu này ghi lại: nó dùng để làm gì (và cố ý KHÔNG làm gì), hai nhịp đã dựng ra
sao, và phần trả lời cho câu hỏi "gắn thêm dự báo thời tiết vào thì có khả thi không".

---

## 1. Phạm vi — cái gì được lên dải tin

Chỉ tin **không khẩn cấp**, **dùng chung cho cả site**, và **đọc lướt cũng không mất gì**:

- Voucher đang hiệu lực (nhịp một).
- Tuyến mới mở bán, lịch bảo trì (nhịp hai, bảng `thong_bao`).

Ba loại thông tin cố ý KHÔNG đi vào đây, vì mỗi loại đã có chỗ đúng của nó:

| Loại | Thuộc về | Vì sao không phải dải tin |
| --- | --- | --- |
| Giữ ghế sắp hết hạn | `HoldCountdownBanner` | Gắn với một thao tác đang dở; phải hiện ngay tại chỗ người dùng đang làm, không phải ở đỉnh trang |
| Phản hồi sau thao tác ("đã lưu voucher") | `ToastContext` | Có người nhận cụ thể và có thời điểm cụ thể |
| Bất cứ thứ gì bỏ lỡ thì mất tiền hoặc mất chuyến | Không phải ở đây | Chữ đang trôi ngang là thứ đọc lướt. Đặt tin quan trọng vào đó là thiết kế ra một kênh mà người dùng được phép bỏ qua |

Nguyên tắc xuyên suốt: **chữ chạy chỉ là mồi, không phải nơi chứa nội dung.** Mẩu tin nào có
trang đích thì là một liên kết mở trang đầy đủ để đọc lại.

---

## 2. Nhịp một — không đụng lược đồ CSDL

### Nguồn dữ liệu

`AnnouncementService` suy tin thẳng từ voucher đang hiệu lực: đang bật, đã tới ngày áp dụng,
chưa hết hạn, chưa cạn lượt. Đây đúng là tập dữ liệu mà trang `/uu-dai` vốn đã công khai cho
khách vãng lai, nên dải tin **không mở thêm gì ra ngoài** — nó chỉ là một lối vào khác của
cùng nội dung đó.

Sắp xếp: mã sắp hết hạn lên trước (đó là tin duy nhất có tính thời điểm), mã không có hạn
xuống cuối, cùng hạn thì mã giảm sâu hơn đứng trước. Trần 6 mẩu — dài hơn thì một vòng chạy
mất hơn một phút và mẩu cuối gần như không ai đọc tới.

### Không dùng WebSocket

Thông báo đổi vài lần mỗi tuần, khác hẳn trạng thái ghế đổi từng giây. Một endpoint công
khai + cache ngắn + client gọi lại khi cửa sổ được focus là đủ. Mở thêm một kênh STOMP toàn
cục sẽ buộc mọi khách vãng lai giữ một kết nối thường trực chỉ để nhận một dải quảng cáo.

### Ba lớp chắn trước CSDL

| Lớp | Thời gian sống | Xóa khi nào |
| --- | --- | --- |
| `Cache-Control: public, max-age=60` (trình duyệt) | 60 giây | Tự hết |
| Cache Caffeine `announcements` (máy chủ) | 5 phút | Admin thêm/sửa/bật-tắt/xóa voucher |
| `REFRESH_COOLDOWN_MS` phía client | 60 giây | Tự hết |

Thao tác đổi *số lượt dùng* voucher (đặt vé, hủy vé) cố ý **không** xóa cache này: một mã
cạn lượt chậm nhất 5 phút sau sẽ tự rụng khỏi dải tin theo TTL, đổi lại mỗi lượt đặt vé
không kéo theo một lượt tính lại dải tin cho toàn hệ thống.

### Ngôn ngữ

Backend gửi `kind` + `params` (mã, phần trăm, mức giảm tối đa, đơn tối thiểu, tên hãng) chứ
**không** gửi câu chữ dựng sẵn. Câu hoàn chỉnh do `utils/announcements.js` ghép từ bảng dịch
của ngôn ngữ đang chọn — cùng lối đi đã dùng cho `VoucherPublicDTO.unavailableReasonCode`.
Chốt cứng tiếng Việt trong service nghĩa là người dùng bản English đọc được một dải tin
tiếng Việt mà không có gì báo.

Các mảnh nối bằng `·` thay vì lồng vào một câu dài: mỗi mảnh là một khoá dịch độc lập, người
dịch không phải giữ đúng trật tự từ của tiếng Việt để câu còn chạy được.

```
vi: Mã VIP50 — giảm 50% · tối đa 500.000 đ · đơn từ 1.000.000 đ · đến hết 31/12/2026
en: Code VIP50 — 50% off · up to 500,000 VND · orders from 1,000,000 VND · until 31 Dec 2026
```

Tin nhập tay thiếu bản tiếng Anh thì **hiện tiếng Việt chứ không ẩn tin**; thiếu bản tiếng
Việt là lỗi nhập liệu, bị chặn ở cả form lẫn `AnnouncementService.validate`.

---

## 3. Khả năng tiếp cận và chuyển động

| Yêu cầu | Cách làm |
| --- | --- |
| Dừng khi rê chuột hoặc focus bàn phím | `.ann-ticker:hover .ann-track, .ann-ticker:focus-within .ann-track { animation-play-state: paused }` — thuần CSS, không phụ thuộc sự kiện React nào có thể bị bỏ lỡ |
| `prefers-reduced-motion` | `matchMedia` đổi sang danh sách tĩnh cuộn ngang được; thêm một luật `@media` làm chốt chặn thứ hai khi JS đó không chạy |
| Mỗi tin đọc lại được | Tin voucher là `<Link>` tới `/uu-dai?code=...`, trang ưu đãi cuộn tới và viền sáng đúng thẻ đó. Tin nhập tay không khai đường dẫn thì là `<span>`, không phải liên kết trỏ bừa |
| Trình đọc màn hình | `role="region"` + `aria-label`; bản sao dùng để nối vòng lặp mang `aria-hidden` và `tabIndex={-1}` nên mỗi tin chỉ đọc và chỉ dừng Tab một lần |
| Tắt được | Nút ✕ nhớ theo **nội dung** (`vigotrip.ticker.dismissed` = danh sách id đang hiện), nên có tin mới là dải tin hiện lại. Nhớ theo kiểu "đã tắt hôm nay" thì một thông báo bảo trì đăng lúc 10h không bao giờ tới được người đã tắt lúc 9h. Tắt rồi vẫn còn một tai nhỏ có biểu tượng loa treo dưới mép header (`.ann-reopen`) để mở lại ngay: trước đây bấm ✕ nhầm thì hoặc chờ có tin mới, hoặc mở DevTools xoá localStorage. Tai này không đặt `--ticker-height` nên trang không nhảy khi ẩn/hiện, và không có tin thì không có tai |

Tốc độ chạy cố định 55 px/giây, thời lượng một vòng do `ResizeObserver` tính theo bề rộng
nội dung thật — ít tin thì hết vòng nhanh, nhiều tin thì lâu hơn, nhưng tốc độ đọc không đổi.

---

## 4. Chỗ đứng trong bố cục

Header là `position: fixed`, nên dải tin cũng phải fixed và mọi trang phải chừa thêm chỗ.
Trước đây mỗi trang chừa chỗ bằng `var(--header-height)`; giờ có ba biến:

```css
--header-height       /* chiều cao riêng của header (64px, 56px + tai thỏ trên mobile) */
--ticker-height       /* 0 mặc định; component đặt lên :root khi CÓ tin, gỡ khi không */
--header-offset       /* = header-height + ticker-height — biến mà mọi trang phải đọc */
```

Mọi chỗ né header đã chuyển sang `--header-offset`. Thêm trang mới thì dùng biến này, đừng
dùng `--header-height`, nếu không bật dải tin lên là nó đè lên dòng đầu của trang.

`z-index` của dải tin (999) thấp hơn header (1000) một bậc để dropdown ngôn ngữ và menu tài
khoản đổ đè lên nó.

---

## 5. Nhịp hai — bảng `thong_bao`

Đã làm. Tin nhập tay cho những thứ không có dữ liệu nào để suy ra: tuyến mới mở bán, lịch
bảo trì.

### Bảng và màn quản trị

- Bảng `thong_bao` (`entity/Announcement.java`): `noi_dung_vi`, `noi_dung_en`, `duong_dan`,
  `loai` (ROUTE / MAINTENANCE / INFO), `hieu_luc_tu`, `hieu_luc_den`, `thu_tu`, `dang_bat`.
- Trang `/admin/announcements` (`Page/AdminAnnouncements.jsx`) dựng theo khuôn
  `AdminVouchers`: cùng bố cục form-trên-bảng-dưới, cùng lối "tắt chứ không xóa". Giống nhau
  là cố ý — admin không phải học lại một màn hình mới chỉ vì dữ liệu bên dưới khác.
- Đường ghi nằm dưới `/api/admin/announcements`, tức đã được `SecurityConfig` chặn sẵn cho
  Admin. Đường đọc `GET /api/announcements` vẫn công khai như cũ.

### Bốn quyết định đáng ghi lại

**Cặp hiệu lực là trường quan trọng nhất.** Tin phải **tự hết hạn**. Nếu việc tắt tin phụ
thuộc vào một người nhớ ra mà vào tắt thì sớm muộn dải tin cũng treo khuyến mãi Tết vào tháng
Tư — kiểu lỗi không ai báo cáo, chỉ làm cả bảng tin mất uy tín dần.

**Tin nhập tay đứng trước tin voucher.** Chỗ trong dải tin có hạn (`MAX_ITEMS` = 6), nên thứ
tự hợp nhất chính là thứ tự ưu tiên. Tin nhập tay thắng vì có người quyết định đăng nó vào
đúng lúc này, còn tin voucher tự sinh ra từ việc có một mã còn hạn. Một thông báo bảo trì bị
bốn mã giảm giá đẩy khỏi dải tin là cái giá không đáng trả.

**Đường dẫn là tuỳ chọn.** Trước đây client mặc định về `/uu-dai` khi thiếu trường `link`.
Với tin voucher thì đúng, với tin nhập tay thì sai: một thông báo bảo trì dẫn người đọc sang
trang khuyến mãi còn tệ hơn một mẩu tin bấm không được. Tin không khai đường dẫn nay render
ra `<span>` chứ không phải `<a>` — dựng một thẻ liên kết trỏ đi đâu đó cho có cũng là nói dối
trình đọc màn hình về việc có gì ở đầu bên kia.

**Nguyên văn hai thứ tiếng, không phải khoá dịch.** Câu chữ do người đăng gõ ra, không bảng
dịch nào chứa được nó. Bản tiếng Anh để trống thì hiện bản tiếng Việt: thà đọc một câu tiếng
Việt còn hơn không biết là có thông báo.

### Cờ `hien_thi_bang_tin` cho voucher

Làm cùng nhịp hai. Nó tách hai câu hỏi vốn bị gộp làm một: "mã còn dùng được không" và "có
rao mã này cho mọi người không". Trước đó mọi voucher đang bật đều lên dải tin, kể cả mã mang
tính cá nhân như mã chatbot phát cho từng người — không rò rỉ gì (trang `/uu-dai` vốn đã liệt
kê đúng danh sách ấy), nhưng đưa một mã "riêng" lên bảng điện tử thì cái tính riêng của nó
thành ra vô nghĩa.

`null` được hiểu là **bật**. Cột này thêm sau bằng `ddl-auto=update` nên mọi bản ghi cũ đều
mang null; hiểu null là tắt thì một lần nâng cấp sẽ xoá sạch dải tin của các môi trường đang
chạy mà không ai yêu cầu điều đó. Hệ quả cần biết: `VoucherDataSeeder` đặt `false` cho
`AI_PROMO_10` ở môi trường mới, còn môi trường đã có sẵn dữ liệu thì mã đó vẫn đang hiện —
bỏ tick "Hiện trên bảng tin" trong màn quản lý voucher một lần là xong.

---

## 6. Gắn thêm dự báo thời tiết thì sao?

Câu trả lời ngắn: **kỹ thuật thì dễ, chỗ đặt mới là vấn đề.** Nên làm, nhưng đặt ở trang chi
tiết chuyến / vé của tôi, KHÔNG đặt trên dải tin chạy.

> **Đã làm.** Khối dự báo nay nằm ở bảng tóm tắt đơn của cả ba luồng đặt vé và ở `MyBookings`,
> dựng trên `WeatherService` + `OpenMeteoClient` phía backend và `components/WeatherPanel.jsx`
> phía giao diện. Dải tin chạy **không** đụng tới, đúng như phần phân tích bên dưới. Mục này giữ
> lại nguyên văn vì nó là lý do của từng quyết định trong bản đã làm.

### 6.1 Vì sao không nên nhét vào dải tin

1. **Sai loại thông tin.** Dải tin là kênh *một nội dung cho mọi người*. Thời tiết chỉ có
   nghĩa khi gắn với **một nơi** và **một ngày** — tức là thông tin theo ngữ cảnh từng người.
   "Hà Nội 28°C" hiện cho một khách đang xem chuyến Sài Gòn – Phú Quốc là chữ chạy vô nghĩa
   chiếm chỗ của một mã giảm giá thật.
2. **Phá luôn mô hình cache.** Cả kiến trúc nhịp một đứng trên giả định "tin đổi vài lần mỗi
   tuần": cache 5 phút, gọi lại khi focus, không WebSocket. Thời tiết đổi từng giờ. Trộn hai
   nhịp sống khác nhau vào một endpoint thì hoặc thời tiết bị cũ, hoặc voucher bị tính lại
   liên tục một cách vô ích.
3. **Pha loãng dải tin.** Sáu mẩu là trần đã cân nhắc. Mỗi mẩu thời tiết chiếm chỗ của một
   thông báo thật, và làm vòng chạy dài thêm.

### 6.2 Chỗ nó thật sự có giá trị

Nơi người dùng đã có sẵn **địa điểm** và **ngày**:

- Trang chi tiết chuyến (sau khi chọn chuyến, trước khi trả tiền).
- `MyBookings` — vé sắp khởi hành trong vài ngày tới.
- Thư nhắc trước chuyến (`TripReminderScheduler` đã gửi sẵn, chỉ thêm một dòng).

Ở ba chỗ đó, "Đà Nẵng ngày 14/09: 29°C, mưa rào" là thứ khách đọc rồi hành động được (mang ô,
đi sớm hơn). Trên dải tin thì không.

### 6.3 Điều kiện cần — phần lớn đã trả xong

**Toạ độ.** Mọi API thời tiết đều hỏi `lat/lon`. Trước đây `tuyen_duong.origin/destination` là
chuỗi tự do không toạ độ, và một thành phố mang hai mã tuỳ phương tiện (`HUI`/`HUE`,
`CXR`/`NTR`, `DLI`/`DLT`, `VII`/`VIN`) nên không gộp lại được.

Món nợ đó **đã trả** khi làm lại nguồn cung chuyến: `PlaceCatalog` giữ 12 thành phố kèm
`latitude`/`longitude`, và hai mã của cùng một nơi trỏ về cùng một `cityId`. Nó ra đời vì lý do
khác hẳn — sinh chuyến cần cự ly thật để suy ra thời gian chạy và giá — nhưng đúng là thứ mà
thời tiết cần. Một test khoá lại rằng thêm mã điểm vào danh mục tuyến thì phải thêm cả toạ độ,
nên danh sách này không lệch đi được.

Còn nợ lại: bảng `dia_diem` + `diem_don_tra` trong CSDL của mục **Map & Realtime Tracking**.
Khi làm, bảng đó nên seed **từ** `PlaceCatalog` rồi mới xoá lớp hằng số, chứ đừng gõ lại toạ độ
lần nữa. Riêng phần dự báo thời tiết thì không phải chờ tới đó: nó chỉ cần (thành phố, ngày).

### 6.4 Đánh đổi lớn nhất: tầm dự báo ngắn hơn tầm đặt vé

`TripSupplyScheduler` luôn phủ đủ **30 ngày** lịch chuyến. Dự báo miễn phí chỉ xa được
**7–16 ngày**, và độ tin cậy sau ngày thứ 7 thì rất thấp.

Hệ quả: **phần lớn lượt đặt vé sẽ không có dự báo để hiện.** Chỗ trống đó phải xử lý tử tế —
hoặc ẩn hẳn khối thời tiết, hoặc ghi rõ "chưa có dự báo cho ngày này". Tuyệt đối không lấp
bằng trung bình khí hậu nhiều năm rồi trình bày như dự báo: đó là bịa một con số có vẻ chính
xác.

### 6.5 Rủi ro

| Rủi ro | Mức | Cách giảm |
| --- | --- | --- |
| **Khách hiểu thành dự đoán hoãn chuyến.** Chữ "mưa to" nằm cạnh nút thanh toán rất dễ đọc thành "chuyến này sẽ delay". Dự báo sai → khiếu nại, và khiếu nại về tiền | Cao | Ghi rõ nguồn + giờ cập nhật, dùng giọng mô tả ("dự báo tại Đà Nẵng"), không bao giờ suy ra khả năng hoãn/huỷ |
| **Phụ thuộc dịch vụ ngoài.** Thêm một lời gọi mạng ra ngoài từ Render gói free | Trung bình | Bắt buộc theo đúng kỷ luật đã áp cho LLM: timeout HTTP, cache 30–60 phút theo (thành phố, ngày), hỏng thì ẩn khối thời tiết chứ không chặn luồng đặt vé |
| **Thêm một khoá bí mật.** `.env` đã có 6 biến chặn khởi động | Thấp | Khoá thời tiết phải là **tuỳ chọn**, thiếu thì mất tính năng chứ hệ thống vẫn chạy — giống hệt khoá AI và khoá gửi thư hiện nay. Open-Meteo thậm chí không cần khoá |
| **Giấy phép và ghi nguồn.** Open-Meteo miễn phí cho dùng phi thương mại kèm CC-BY-4.0; OpenWeather bắt ghi nguồn | Thấp | Hiện dòng ghi nguồn ngay dưới khối thời tiết. Điều khoản có thể đổi — đừng để tính năng tính tiền nào phụ thuộc vào nó |
| **Dịch thuật.** API trả mã WMO hoặc chữ tiếng Anh | Thấp | Tự ánh xạ mã WMO sang biểu tượng + chữ trong bảng dịch (vi/en), đừng hiện thẳng chuỗi của nhà cung cấp — nếu không bản tiếng Việt lại hiện "light rain shower" |
| **Cột mốc 19/09/2026.** Dự án dừng hỗ trợ sau mốc đó | Trung bình | Tính năng phụ thuộc API ngoài mà không ai trực thì hỏng âm thầm. Nếu làm, làm sớm và làm sao cho hỏng là ẩn đi, không phải hỏng là vỡ trang |

### 6.6 Đề xuất

1. Làm bảng `dia_diem` + `diem_don_tra` trước (dùng chung với Map).
2. Thêm khối dự báo ở trang chi tiết chuyến và `MyBookings`, **chỉ cho chuyến trong vòng 7
   ngày**, ngoài tầm đó thì ẩn.
3. Dùng Open-Meteo (không cần khoá, có mã WMO chuẩn để tự dịch), cache 30–60 phút theo cặp
   (thành phố, ngày).
4. Nếu vẫn muốn thấy thời tiết trên dải tin: chỉ nên là **cảnh báo thời tiết cực đoan ảnh
   hưởng tới một tuyến đang bán**, và khi đó nó không còn là "thời tiết" nữa mà là một mẩu
   `MAINTENANCE`/`INFO` do người trực nhập tay qua bảng `thong_bao` của nhịp hai — có người
   chịu trách nhiệm cho câu chữ, thay vì một con số máy tự kéo về.

Bản đã làm theo đúng bốn điểm trên, kèm mấy chỗ chốt thêm lúc viết:

- Tầm hiện dự báo chốt ở **7 ngày** (`WeatherService.FORECAST_HORIZON_DAYS`). Ngoài tầm thì
  endpoint trả 204 và giao diện ẩn hẳn khối — không ô trống, không vòng xoay chờ.
- Endpoint trả **mã WMO**, không trả chuỗi mô tả. Ánh xạ sang biểu tượng và chữ nằm ở
  `utils/weather.js` nên mỗi ngôn ngữ có câu chữ của mình, thay vì bản tiếng Việt hiện
  "light rain shower".
- Có một dòng cố định ngay trong khối: *"Đây là dự báo thời tiết, không phải dự đoán giờ chạy
  của chuyến."* Đó là cách xử lý rủi ro lớn nhất ở bảng 6.5, đặt đúng chỗ dễ hiểu nhầm nhất.
- Cache 60 phút theo (thành phố, ngày) và **cache cả lượt hỏng**: Open-Meteo trục trặc thì một
  cặp im lặng trong một tiếng, thay vì mỗi lượt xem trang lại chờ hết giờ chờ.
- `WEATHER_ENABLED=false` tắt sạch tính năng mà không ảnh hưởng gì tới luồng đặt vé.

Ước lượng công: **khoảng một ngày**. Phần chuẩn hoá địa điểm vốn là phần nặng nhất thì nay đã
có sẵn `PlaceCatalog`, nên chỉ còn lớp gọi Open-Meteo, cache, và khối hiển thị.

---

## 7. Kiểm thử

```bash
# Backend — hợp nhất hai nguồn, lọc, sắp xếp, cắt ngọn, chặn tin sai
cd backend/ticket-booking && mvnw test -Dtest=AnnouncementServiceTest

# Frontend — ghép câu, ẩn/hiện, nhớ tin đã tắt, tin không đường dẫn, backend lỗi thì im lặng
npm run test:run --prefix my-react-app
```

Kiểm bằng mắt cho nhịp hai: vào `/admin/announcements`, đăng một tin có hạn kết thúc sau vài
phút (phải thấy nó lên dải tin NGAY, không chờ hết 5 phút cache), đăng một tin không điền
đường dẫn (phải là chữ thường, bấm không được), tắt tin (phải rụng khỏi dải tin ngay), và đặt
hạn bắt đầu ở tương lai (bảng quản trị ghi "Chờ tới ngày", dải tin chưa có gì).

Kiểm bằng mắt: mở trang chủ, rê chuột vào dải tin (phải dừng), nhấn Tab tới một mẩu tin
(cũng phải dừng), bấm vào một mẩu (phải sang `/uu-dai` với đúng thẻ được viền sáng), đổi
ngôn ngữ sang English (câu chữ, tiền và ngày phải đổi theo mà không cần tải lại trang), bật
"giảm chuyển động" trong cài đặt hệ điều hành (chữ phải đứng yên thành danh sách).
