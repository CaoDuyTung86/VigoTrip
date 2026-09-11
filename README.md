# Hệ Thống Đặt Vé Đa Phương Tiện (Ticket Booking System)

Dự án đồ án tốt nghiệp cung cấp giải pháp đặt vé toàn diện cho máy bay, tàu hỏa và xe khách. Hệ thống tập trung vào tính ổn định, quy trình nghiệp vụ chặt chẽ và khả năng phân tích dữ liệu thông minh. Đồng thời là một bài học đắt giá về việc định hướng, mục tiêu, scope dự án ngay từ đầu thay vì chỉ đặt nặng về kỹ thuật, và cái giá đã phải trả.

---

## ⚠️ Trạng thái: ngừng hỗ trợ từ 19/09/2026

Dự án đã bảo vệ xong và **đóng băng** kể từ mốc trên. Cụ thể là:

- **Không có ai trả lời issue hay pull request.** Không phải chậm, mà là không.
- **Không có bản vá bảo mật.** Phụ thuộc trong `pom.xml` và `package.json` đứng yên từ ngày
  đóng băng, và lỗ hổng công bố sau đó sẽ không được vá.
- **Bản chạy thử có thể tắt bất cứ lúc nào.** Các đường dẫn trong tài liệu này trỏ tới tài
  khoản miễn phí của nhóm; khoá của cổng thanh toán, của mô hình ngôn ngữ và của dịch vụ gửi
  thư đều sẽ bị thu hồi. Đừng xây bất cứ thứ gì dựa trên chúng.
- **Mã nguồn vẫn ở đây và vẫn dùng lại được**, theo giấy phép MIT. Xem [LICENSE](./LICENSE).

Muốn chạy tiếp thì fork về, tự đăng ký khoá của mình, và đọc mục 10 "Việc còn lại" trong
[docs/THANH_TOAN_VNPAY.md](./docs/THANH_TOAN_VNPAY.md) trước — nó liệt kê đúng những chỗ còn
thiếu, bằng lời của người đã đi qua chúng.

---

## Tính Năng Nổi Bật

- **AI Chatbot với Hybrid RAG:** Tri thức lưu trong CSDL kèm vector embedding, truy hồi lai giữa tìm kiếm ngữ nghĩa (cosine) và BM25, hợp nhất bằng Reciprocal Rank Fusion. Đo được: recall@3 94.7%, MRR 0.795 trên bộ 57 câu hỏi vàng.
- **Multi-model LLM Gateway:** Bộ điều phối tự động chuyển đổi giữa các nhà cung cấp LLM (Gemini, Groq) kèm circuit breaker và metric Prometheus, bảo đảm chatbot vẫn trả lời khi một nhà cung cấp trả 429/503.
- **AI Business Intelligence:** Phân tích dữ liệu doanh thu và đưa ra các nhận định chiến lược cho Admin & Nhà xe.
- **Real-time Synchronization:** Đồng bộ trạng thái chỗ ngồi thời gian thực qua WebSocket (STOMP / SockJS). Chống đặt trùng vé bằng ba lớp độc lập — lock tạm qua WebSocket, khoá bi quan ở tầng giao dịch, và khoá dòng đơn hàng chống xác nhận thanh toán trùng. Kênh STOMP xác thực bằng JWT ngay tại frame CONNECT, danh tính do máy chủ suy ra chứ không đọc từ thân thông điệp.
- **QR Check-in System:** Hệ thống xác thực vé tại bến qua mã QR (ZXing + html5-qrcode), tích hợp trình quét camera trực tiếp trên web, tối ưu cho quy trình soát vé nhanh.
- **Hệ thống Giám sát & Quản lý:** Theo dõi sức khỏe hệ thống (CPU, RAM, Request) qua Prometheus & Grafana; Kiểm soát chất lượng mã nguồn qua SonarQube.
- **Quy trình Thanh toán:** Tích hợp cổng thanh toán VNPay Sandbox, xử lý quy trình đặt chỗ và hoàn tiền tự động.

---

## Môi Trường Thử Nghiệm (Staging & Production)

Hệ thống hỗ trợ 2 kiến trúc triển khai điện toán đám mây linh hoạt:

1. **Môi trường Serverless Cloud (Khuyên dùng - 0$ Cost & Auto Scaling):**
   - **Frontend:** [https://vigotrip.vercel.app](https://vigotrip.vercel.app) _(Vercel Global Edge Network)_
   - **Backend API:** `https://datxe-com.onrender.com` _(Render Container Service)_
   - **Database:** Neon Cloud PostgreSQL _(Serverless Database)_
   - **Ưu điểm:** Tự động mở rộng, tự cấp SSL, không tốn phí duy trì hạ tầng, không lo sập server.

2. **Môi trường AWS EC2 (Truyền thống):**
   - **Website:** `https://datxe.duckdns.org` _(AWS EC2 t3.micro)_
   - **Cấu hình:** Docker Compose (7 Container), Nginx Reverse Proxy, Let's Encrypt SSL, AWS RDS SQL Server.

---

## Công Nghệ Sử Dụng

| Thành phần               | Công nghệ                                                                                   |
| :----------------------- | :------------------------------------------------------------------------------------------ |
| **Backend**              | Java 17, Spring Boot 3.4, Spring Security 6, JWT, JPA/Hibernate, MapStruct, Caffeine Cache  |
| **Frontend**             | React (Vite), CSS Variables, Recharts (Biểu đồ), WebSocket Client, PWA                      |
| **Database**             | Neon Cloud PostgreSQL (Serverless) / AWS RDS SQL Server / MS SQL Server 2022 (Local Docker) |
| **Hosting & Cloud**      | Vercel (Frontend Edge), Render (Backend Container), Neon (Database), AWS EC2                |
| **DevOps & Tools**       | Docker Compose, Nginx Reverse Proxy, Prometheus, Grafana, SonarQube                         |
| **AI Engine**            | Multi-provider LLM Gateway (giao thức OpenAI-compatible): Google Gemini, Groq fallback      |
| **Real-time & Security** | WebSocket STOMP, Google OAuth2, ZXing QR Code                                               |

---

## Trạng Thái Dự Án (Roadmap)

### Các tính năng đã hoàn thành:

- [x] **Hệ thống lõi:** Quản lý chuyến đi, đặt vé, quản lý người dùng và phân quyền (RBAC).
- [x] **AI Business Intelligence & Chatbot:** Phân tích doanh thu và tư vấn chuyến đi bằng RAG + Google Gemini AI.
- [x] **Real-time Seat Locking:** Đồng bộ khóa ghế ngồi thời gian thực qua WebSocket (STOMP).
- [x] **QR Code Check-in:** Quét mã xác thực vé và xem chi tiết hành trình ngay tại bến.
- [x] **Payment Integration:** Thanh toán qua VNPay Sanbox và quản lý hoàn tiền (Refund).
- [x] **Monitoring:** Triển khai hạ tầng giám sát hệ thống thời gian thực qua Prometheus & Grafana.
- [x] **Security:** Chuyển đổi quản lý Secret sang biến môi trường (.env), Google OAuth2 và tích hợp quét bảo mật tự động.
- [x] **Code Quality:** Kiểm soát chất lượng mã nguồn qua SonarQube.
- [x] **Database Cloud:** Cấu hình cơ sở dữ liệu tách biệt kết nối đến Neon Cloud PostgreSQL (Serverless).
- [x] **Serverless Cloud Deployment:** Triển khai hạ tầng Serverless hoàn chỉnh: Frontend (Vercel Edge Network), Backend (Render Java Container với tối ưu hóa RAM `-Xmx256m`), Database (Neon Cloud Serverless PostgreSQL).
- [x] **Advanced RAG & Hybrid Search:** Knowledge base chuyển từ hằng số hardcode sang bảng `tri_thuc` trong CSDL, mỗi chunk kèm vector embedding. Truy hồi lai vector + BM25 hợp nhất bằng Reciprocal Rank Fusion, tự suy giảm êm về BM25 khi thiếu API key. Có API quản trị tri thức cho Admin và bộ đo chất lượng truy hồi tự động (recall@3, MRR).
- [x] **Multi-model LLM Gateway:** Tầng `LlmRouter` với chuỗi nhà cung cấp cấu hình được, tự động failover khi gặp 429/5xx, circuit breaker theo từng nhà cung cấp, và metric Prometheus (`llm_requests_total`, `llm_fallback_total`, `llm_latency_seconds`).
- [x] **AI Hardening & Cost Control:** Đóng lỗ hổng bypass CAPTCHA, siết rate limit chống giả mạo IP qua `X-Forwarded-For`, timeout HTTP cho mọi lời gọi ra ngoài, và trần ngân sách LLM theo ngày cho toàn hệ thống.
- [x] **Chat History:** Lưu hội thoại cho người dùng đã đăng nhập, chỉ chính chủ đọc được, tự động xóa sau 30 ngày.
- [x] **Proxy & API Routing:** Cấu hình `vercel.json` rewrites điều hướng trong suốt toàn bộ request `/api` và `/ws` (WebSocket) từ Vercel sang Render.
- [x] **Trip Supply Scheduler:** Lịch chuyến luôn phủ đủ 30 ngày tới, thay cho cơ chế seed một lần khiến dữ liệu cạn dần theo thời gian. Danh mục tuyến gom về một nguồn duy nhất (`TripSupplyService`), điều kiện bù xét theo từng `(tuyến, phương tiện, ngày)` nên thiếu chỗ nào bù đúng chỗ đó, và chỉ thêm chứ không xoá — chuyến đã qua giữ lại làm dữ liệu lịch sử cho AI phân tích doanh thu.
- [x] **AI BI theo kỳ báo cáo:** Màn Thống kê doanh thu chọn được kỳ Tháng / Quý / Năm, có so sánh tăng trưởng với kỳ liền trước. Trước đây chỉ biểu đồ doanh thu tháng là có lọc thời gian, còn top tuyến, cơ cấu theo loại phương tiện, top nhà cung cấp và tổng số booking đều lấy all-time — báo cáo ghi tiêu đề một tháng nhưng thân bài là số liệu từ đầu hệ thống. Giao diện và phần AI giờ đọc chung một đối tượng số liệu (`/api/analytics/summary`) nên con số AI dẫn ra không thể lệch với biểu đồ. Kỳ trống thì tự chuyển về kỳ gần nhất có dữ liệu kèm thông báo rõ ràng.
- [x] **Provider Data Scoping:** Tài khoản đối tác chỉ đọc được số liệu của những thương hiệu mình vận hành (`nha_cung_cap.owner_user_id`), thay vì xem được doanh thu của cả đối thủ như trước. Yêu cầu phạm vi toàn hệ thống từ tài khoản đối tác bị từ chối thẳng.

- [x] **Zero-Trust Auth (HttpOnly Cookie + Refresh Token):** Tách một JWT hạn 24 giờ nằm trong `localStorage` thành hai chìa khoá: access token 15 phút chỉ sống trong bộ nhớ tab, và refresh token 256 bit nằm trong cookie `HttpOnly` mà JavaScript không có API nào đọc được. Refresh token lưu dưới dạng SHA-256 trong bảng `phien_dang_nhap`, xoay vòng sau mỗi lần dùng, và một token đã thu hồi mà quay lại sẽ bị coi là dấu hiệu bị đánh cắp: cả họ token sinh ra từ lần đăng nhập đó bị thu hồi. Nhờ có trạng thái phía máy chủ, những việc mà JWT thuần không làm được nay làm được — đăng xuất cắt phiên thật chứ không chỉ xoá bản sao trong trình duyệt, đổi mật khẩu đuổi được kẻ đang ở trong tài khoản, và khoá tài khoản cắt luôn phiên đang mở. Nói thẳng phần KHÔNG giải quyết được: mã độc đã chạy được trong trang vẫn gọi API thay mặt nạn nhân trong lúc tab còn mở; cái mất đi là khả năng mang chìa khoá ra khỏi trình duyệt để dùng lại sau. Chi tiết, đánh đổi và cấu hình tại [docs/BAO_MAT_XAC_THUC.md](./docs/BAO_MAT_XAC_THUC.md).

- [x] **Bảng tin chạy (Announcement Ticker) — nhịp một:** Dải chữ chạy ngang kiểu bảng điện tử nhà ga dưới `Header`, gom thông tin dùng chung cả site. Nhịp một không đụng lược đồ CSDL: tin suy thẳng từ voucher đang hiệu lực — cùng tập dữ liệu trang `/uu-dai` vốn đã công khai, nên dải tin không mở thêm gì ra ngoài. Không dùng WebSocket, vì thông báo đổi vài lần mỗi tuần chứ không phải từng giây như trạng thái ghế: một endpoint công khai, cache 5 phút phía máy chủ, client gọi lại khi cửa sổ được focus. Dừng khi rê chuột hoặc focus bàn phím, tôn trọng `prefers-reduced-motion` (thoái lui về danh sách tĩnh), mỗi mẩu tin mở được trang đầy đủ với đúng thẻ voucher được viền sáng. Câu chữ do frontend ghép từ `kind` + `params` backend gửi sang nên đổi ngôn ngữ là đổi ngay, không phải gọi lại API. Chi tiết, đánh đổi và phần trả lời "có nên gắn dự báo thời tiết vào không" tại [docs/BANG_TIN_CHAY.md](./docs/BANG_TIN_CHAY.md).

- [x] **WebSocket Hardening:** Vá bốn lỗ hổng của kênh giữ ghế thời gian thực. (1) Kênh STOMP trước đây không xác thực — danh tính người giữ ghế là trường `userId` do trình duyệt tự khai, nên bất kỳ ai cũng gửi được một frame để nhả ghế người khác đang giữ; giờ `StompAuthChannelInterceptor` suy ra danh tính từ JWT ngay tại frame CONNECT và bỏ qua mọi thứ client khai trong thân thông điệp. (2) Thông điệp phát ra không còn chứa email — chủ ghế được nêu bằng mã HMAC ẩn danh, trước đây mở DevTools là đọc được email của mọi người đang chọn ghế cùng chuyến. (3) Tách kênh theo từng chuyến thay cho một kênh toàn cục đẩy mọi sự kiện của mọi chuyến tới mọi trình duyệt. (4) Bỏ `setAllowedOriginPatterns("*")`. Kèm theo: trần 20 ghế mỗi danh tính chống giữ ghế hàng loạt, và việc chuyển chủ ghế lúc khách đăng nhập giữa chừng gộp về một thao tác phía máy chủ thay vì cặp nhả-rồi-giữ-lại để hở ghế ở giữa. Chi tiết tại [docs/REALTIME_WEBSOCKET.md](./docs/REALTIME_WEBSOCKET.md).

### Hướng phát triển tiếp theo:

- [ ] **AI BI 2.0 (Text-to-SQL & Predictive Analytics):** Hỗ trợ Admin truy vấn dữ liệu kinh doanh bằng ngôn ngữ tự nhiên (NL2SQL), dự báo nhu cầu đặt vé theo mùa vụ (Time-series Forecasting) và gợi ý định giá vé động (Dynamic Pricing).
- [ ] **Map & Realtime Tracking:** Tích hợp bản đồ Leaflet / Mapbox theo dõi lộ trình di chuyển và định vị bến bãi, nhà ga thời gian thực.
  - *Điều kiện cần:* chuẩn hoá điểm đi/đến trước khi vẽ. Hiện `tuyen_duong.origin/destination` là chuỗi tự do, không toạ độ, và một thành phố mang hai mã tuỳ phương tiện (`HUI`/`HUE`, `CXR`/`NTR`, `DLI`/`DLT`, `VII`/`VIN`) nên sẽ ra hai pin cho cùng một nơi. Cần tách bảng `dia_diem` (thành phố) và `diem_don_tra` (sân bay / nhà ga / bến xe, kèm `latitude`, `longitude`) — xem chi tiết tại mục 5 phần Thiết kế CSDL trong [SRS_FSD_SPECIFICATION.md](./SRS_FSD_SPECIFICATION.md).
  - *Riêng Realtime Tracking:* cần thêm `tuyen_duong.path_geojson` để nội suy vị trí dọc tuyến. Chặng `AIR` dùng cung vòng lớn giữa hai sân bay nên không cần dữ liệu ngoài; `RAIL`/`ROAD` không có polyline thì chấm vị trí sẽ trôi theo đường thẳng thay vì bám tuyến thật.
- [ ] **Bảng tin chạy — nhịp hai (bảng `thong_bao`):** Nhịp một đã chạy (xem mục đã hoàn thành). Còn lại là tin nhập tay: bảng `thong_bao` cho tuyến mới mở bán và lịch bảo trì, kèm trang quản trị dựng theo khuôn `AdminVouchers`. Trường quan trọng nhất là cặp `hieu_luc_tu` / `hieu_luc_den` để tin tự hết hạn, tránh cảnh dải tin còn treo khuyến mãi Tết vào tháng Tư. Kèm theo: cờ `hien_thi_bang_tin` cho voucher, vì hiện mọi mã đang bật đều lên dải tin — kể cả mã chatbot phát riêng cho từng người.
- [ ] **Dự báo thời tiết theo chuyến:** Khối dự báo ở trang chi tiết chuyến và `MyBookings`, chỉ cho chuyến trong vòng 7 ngày. *Điều kiện cần:* toạ độ điểm đi/đến — cùng bảng `dia_diem` mà mục Map ở trên đang chờ. *Đánh đổi đã biết:* lịch chuyến phủ 30 ngày còn dự báo miễn phí chỉ xa được 7–16 ngày, nên phần lớn lượt đặt vé sẽ không có gì để hiện, và chỗ trống đó phải ẩn đi chứ không được lấp bằng trung bình khí hậu rồi trình bày như dự báo. Cố ý KHÔNG đặt trên dải tin chạy: thời tiết chỉ có nghĩa khi gắn với một nơi và một ngày, còn dải tin là kênh một nội dung cho mọi người. Phân tích đầy đủ rủi ro và đề xuất tại [docs/BANG_TIN_CHAY.md](./docs/BANG_TIN_CHAY.md) mục 6.

---

## Đa Ngôn Ngữ (i18n)

Hỗ trợ 4 ngôn ngữ (`vi`, `en`, `ja`, `zh`). Nút cờ trên header chính là cài đặt ngôn ngữ của tài khoản: đổi ở đó thì giao diện đổi ngay, và từ đó về sau **thư gửi về hòm thư cũng đổi theo** — kể cả mail nhắc chuyến do bộ lập lịch gửi lúc không có trình duyệt nào mở.

Hàng rào chống dịch sót chạy trong CI:

```bash
npm run i18n:check --prefix my-react-app
```

Chi tiết đầy đủ — quy tắc "ai thắng" giữa client và server, chuỗi dự phòng của chữ trong mail, cơ chế bánh cóc cho nợ cũ, và những gì còn lại — xem [docs/DA_NGON_NGU.md](./docs/DA_NGON_NGU.md).

---

## Hướng Dẫn Cài Đặt

1. **Yêu cầu hệ thống:** Đã cài đặt Docker và Docker Compose.
2. **Cấu hình:** Sao chép file `.env.example` thành `.env` và điền sáu biến chặn khởi động: `SPRING_DATASOURCE_PASSWORD`, `JWT_SECRET`, `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `ADMIN_PASSWORD`, `PROVIDER_PASSWORD`. Khoá AI và khoá gửi thư là tuỳ chọn — thiếu thì mất tính năng tương ứng chứ hệ thống vẫn chạy. Danh sách đầy đủ kèm cách lấy từng giá trị: [docs/AI_ONBOARDING.md](./docs/AI_ONBOARDING.md).
3. **Khởi chạy:**
   ```bash
   docker-compose up -d
   ```
4. **Chi tiết thiết lập:** Xem hướng dẫn chi tiết dành cho AI/Developer tại [AI_ONBOARDING.md](./AI_ONBOARDING.md).
5. **Tìm hiểu Chatbot AI:** Giải thích toàn diện về kiến trúc RAG, LLM Gateway, cách đo chất lượng (Recall@3, MRR, F1) và các quyết định thiết kế: [docs/CHATBOT_AI.md](./docs/CHATBOT_AI.md).
6. **Tìm hiểu AI Business Intelligence:** Cách phần Thống kê doanh thu + Báo cáo AI hoạt động (SQL tính số → LLM chỉ diễn giải), kỳ báo cáo, phân quyền đối tác và đo chất lượng tới đâu: [docs/AI_BI.md](./docs/AI_BI.md).
7. **Demo & kiểm thử bản deploy:** Kịch bản demo theo từng màn kèm checklist smoke test sau mỗi lần deploy: [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md).
8. **Bảng tin chạy:** Phạm vi (cái gì được lên dải tin, cái gì thuộc về Toast/HoldCountdownBanner), kiến trúc nhịp một, phần còn thiếu của nhịp hai, và phân tích khả thi cho dự báo thời tiết: [docs/BANG_TIN_CHAY.md](./docs/BANG_TIN_CHAY.md).
9. **Luồng thanh toán VNPay:** Luồng Return/IPN, ba lớp phòng thủ trước khi giao vé, các sự cố đã gặp (và vì sao sửa theo cách hiện tại), cùng cách chẩn đoán bằng log: [docs/THANH_TOAN_VNPAY.md](./docs/THANH_TOAN_VNPAY.md).
---

## Giấy phép

Mã nguồn và tài liệu: [MIT](./LICENSE). Dùng lại, sửa, thương mại hoá đều được, miễn giữ lại
thông báo bản quyền — và hiểu rằng phần mềm được cấp "nguyên trạng", không bảo hành.

Logo hãng bay, biểu tượng phương thức thanh toán và ảnh minh hoạ **không** nằm trong giấy phép
đó: chúng thuộc về chủ sở hữu tương ứng, có mặt ở đây chỉ để một bản demo học thuật trông giống
thật. Dùng lại mã nguồn thì thay chúng bằng tài sản của bạn. Chi tiết ở cuối [LICENSE](./LICENSE).

---

_Phát triển bởi nhóm sinh viên Đồ án Tốt nghiệp trường Đại Học CMC - 2026_
