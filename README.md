# Hệ Thống Đặt Vé Đa Phương Tiện (Ticket Booking System)

Dự án đồ án tốt nghiệp cung cấp giải pháp đặt vé toàn diện cho máy bay, tàu hỏa và xe khách. Hệ thống tập trung vào tính ổn định, quy trình nghiệp vụ chặt chẽ và khả năng phân tích dữ liệu thông minh. Đồng thời là một bài học đắt giá về việc định hướng, mục tiêu, scope dự án ngay từ đầu thay vì chỉ đặt nặng về kỹ thuật, và cái giá đã phải trả.

---

## ⚠️ Trạng thái: dự kiến tạm ngừng hỗ trợ từ 19/09/2026

Dự án đã bảo vệ xong và **đóng băng** kể từ mốc trên. Cụ thể là:

- **Không có bản vá bảo mật.** Phụ thuộc trong `pom.xml` và `package.json` đứng yên từ ngày
  đóng băng, và lỗ hổng công bố sau đó sẽ không được vá.
- **Bản chạy thử có thể tắt bất cứ lúc nào.** Các đường dẫn trong tài liệu này trỏ tới tài
  khoản miễn phí của nhóm; khoá của cổng thanh toán, của mô hình ngôn ngữ và của dịch vụ gửi
  thư đều sẽ bị thu hồi. Đừng xây bất cứ thứ gì dựa trên chúng.
- **Mã nguồn vẫn ở đây và vẫn dùng lại được**, theo giấy phép MIT. Xem [LICENSE](./LICENSE).

---

## Tính Năng Nổi Bật

- **AI Chatbot với Hybrid RAG:** Tri thức lưu trong CSDL kèm vector embedding, truy hồi lai giữa tìm kiếm ngữ nghĩa (cosine) và BM25, hợp nhất bằng Reciprocal Rank Fusion. Kho tri thức song song bốn ngôn ngữ (224 chunk). Đo được: recall@3 95.4%, MRR 0.855 trên bộ 130 câu hỏi vàng `vi`/`en`/`ja`/`zh`; chọn tool khớp bộ 46/46 ca.
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

- [x] **Bảng tin chạy — nhịp hai (bảng `thong_bao`):** Tin nhập tay cho tuyến mới mở bán và lịch bảo trì, kèm trang quản trị `/admin/announcements` dựng theo khuôn `AdminVouchers`. Hai nguồn hợp nhất trong `AnnouncementService`: tin nhập tay đứng trước tin voucher, vì chỗ trong dải tin có hạn và một thông báo bảo trì bị bốn mã giảm giá đẩy ra ngoài là cái giá không đáng trả. Cặp `hieu_luc_tu` / `hieu_luc_den` để tin **tự hết hạn** — việc tắt tin không được phụ thuộc vào một người nhớ ra mà vào tắt, nếu không dải tin sẽ treo khuyến mãi Tết tới tháng Tư. Mỗi tin có nguyên văn hai thứ tiếng (bản tiếng Anh để trống thì khách đọc tiếng Anh thấy bản tiếng Việt, thà đọc tiếng Việt còn hơn không biết là có thông báo) và đường dẫn **tuỳ chọn**: tin không khai đường dẫn thì hiện ra dạng chữ thường chứ không dựng liên kết giả về `/uu-dai`. Kèm theo: cờ `hien_thi_bang_tin` cho voucher, tách "mã còn dùng được" khỏi "có rao mã này cho mọi người" — mã chatbot phát riêng cho từng người nay bật mặc định là không lên bảng tin.

- [x] **Dự báo thời tiết theo chuyến:** Khối dự báo tại điểm đến vào ngày khởi hành, hiện ở bảng tóm tắt đơn của ba luồng đặt vé và ở danh sách vé sắp đi. Dữ liệu thật từ Open-Meteo — nhà cung cấp duy nhất trong dự án **không cần khoá**, nên đây là tính năng ngoài duy nhất không thêm một biến bí mật nào. Tầm hiện chốt ở **7 ngày** dù nhà cung cấp trả xa hơn: qua mốc một tuần thì con số gần như không còn giá trị để khách dựa vào mà quyết định, và hiện một dự báo mà chính mình không tin là mời khách trách nhầm. Lịch chuyến phủ 30 ngày nên phần lớn lượt đặt vé sẽ KHÔNG có dự báo — đó là trạng thái bình thường, khối tự ẩn hẳn chứ tuyệt đối không lấp bằng trung bình khí hậu nhiều năm rồi trình bày như dự báo. Hỏng là ẩn đi, không phải vỡ: mọi lỗi mạng đều trả 204 và không chạm vào luồng đặt vé, cache 60 phút giữ **cả lượt hỏng** để một nguồn đang yếu không bị dồn lời gọi. Endpoint trả mã WMO chứ không trả chuỗi mô tả, giao diện tự ánh xạ sang biểu tượng và chữ theo ngôn ngữ đang chọn. Rủi ro lớn nhất là chữ "mưa to" nằm cạnh nút thanh toán bị đọc thành "chuyến này sẽ hoãn", nên khối có một dòng cố định tách hai thứ đó ra. Phân tích đầy đủ tại [docs/BANG_TIN_CHAY.md](./docs/BANG_TIN_CHAY.md) mục 6.

- [x] **Tool thời tiết cho chatbot:** Trợ lý gọi được dự báo thật, nên câu "cuối tuần này đi Đà Nẵng thời tiết sao" có số liệu chứ không còn là một câu chung chung. Tool thứ sáu, dùng chung nguồn Open-Meteo với khối thời tiết ở bảng tóm tắt đơn nên con số trợ lý đọc ra không thể lệch với con số khách nhìn thấy lúc thanh toán. **Tool nhận TÊN nơi chứ không nhận mã**, và đó là điểm chính: `PlaceCatalog` nay tra được theo tên tiếng Việt có dấu lẫn không dấu, tên tiếng Anh, các cách gọi khác ("Sài Gòn", "TPHCM", "Quảng Ninh", "Hạ Long") và cả chữ chỉ loại công trình đứng trước ("sân bay Đà Nẵng", "ga Huế"). Trước đây việc đổi tên sang mã nằm trong trí nhớ của model, và nó đã trượt một lần: mô tả tool dạy model rằng `QNH` là Quy Nhơn trong khi `QNH` là Quảng Ninh, nên khách hỏi Quy Nhơn nhận về dữ liệu của một tỉnh cách đó hơn tám trăm cây số mà không có lỗi nào được ném ra. **Cấm suy diễn** là luật riêng của tool này: câu chặn "chỉ mô tả thời tiết, không suy ra hoãn/huỷ/trễ chuyến" gắn vào cuối MỌI kết quả kể cả kết quả rỗng, chứ không chỉ nằm trong system prompt — luật đứng cạnh dữ liệu khó bị bỏ qua hơn luật nằm cách đó hai nghìn chữ. Bốn đường không có số liệu (nơi ngoài danh mục, ngày đã qua, ngày ngoài tầm bảy ngày, nguồn không trả lời) là bốn câu trả lời khác nhau, và ba đường đầu chặn trước khi đi ra mạng. Hỏi nhiều ngày chỉ tốn một lời gọi ra ngoài nhờ `OpenMeteoClient.range`; lặp bảy lần thì một lượt chat treo gần nửa phút khi nguồn chậm. Chi tiết tại [docs/CHATBOT_AI.md](./docs/CHATBOT_AI.md) mục 4.3.

- [x] **Vòng function calling nhiều lượt:** Trợ lý gọi được công cụ thứ hai dựa trên kết quả của công cụ thứ nhất. Trước đây vòng lặp đóng cứng ở hai lượt — hỏi, chạy tool, hỏi lần nữa để lấy câu trả lời — nên chịu thua đúng một loại câu hỏi, nhưng là loại rất tự nhiên với khách: loại mà kết quả tra lần một mới cho biết lần hai phải tra gì. "Vé sắp đi của tôi tới đâu, chỗ đó thời tiết thế nào" phải đọc đơn hàng xong mới biết hỏi thời tiết ở nơi nào, và với hai lượt thì model chỉ có hai lối thoát: bỏ nửa sau câu hỏi, hoặc đoán bừa một thành phố rồi trả lời như thật. Trần nay là `llm.tools.max-rounds`, mặc định ba. Ba chốt chặn đi kèm, vì nới trần thì mở ra đường hỏng mới: **vòng cuối luôn gọi không kèm định nghĩa tool** nên model buộc phải trả lời bằng chữ thay vì xin thêm một lần tra mà ta đã hết lượt phục vụ; **trần tổng số lần chạy tool mỗi lượt** vì trần số vòng một mình không chặn được việc model xin nhiều tool trong cùng một vòng; và **sổ nhớ lời gọi đã chạy** cắt vòng quẩn khi model xin lại đúng tool với đúng tham số nó vừa xin. Cái giá phải trả nằm ở streaming: muốn biết model còn xin tra gì nữa không thì phải hỏi kèm định nghĩa tool, mà lời gọi kèm tool thì không stream được, nên lượt nào dùng tool sẽ nhận câu trả lời theo kiểu gõ chữ thay vì stream thật. Chi tiết tại [docs/CHATBOT_AI.md](./docs/CHATBOT_AI.md) mục 4.2.

- [x] **Kho tri thức đa ngôn ngữ (`en`, rồi cả `ja`/`zh`):** Trước đây 56 chunk đều là `lang: vi`, nhánh BM25 khớp theo mặt chữ nên câu hỏi tiếng Anh gần như không chạm được chunk nào — tám câu thử chỉ trúng 2, và *"my discount code is not working"* trả về rỗng dù kho có hẳn chunk `voucher-not-working`. Nay có `faq-en.yml`, `faq-ja.yml`, `faq-zh.yml` viết song song, mỗi mục ứng đúng một mục tiếng Việt. Ba thay đổi đi kèm, mỗi cái đều do bộ đo chỉ ra chứ không phải đoán: **lọc theo `lang`** ở cả hai nhánh truy hồi (`LangFilter`) để chunk tiếng Việt không chen vào top của câu hỏi tiếng Anh; **bảng từ đồng nghĩa riêng theo ngôn ngữ**, vì bảng chung nhét cả loạt từ về thú cưng vào câu hỏi chọn ghế; và **thống kê BM25 tách theo ngôn ngữ**, vì chunk tiếng Nhật/Trung dài hơn làm lệch độ dài trung bình và kéo tụt R@3 tiếng Việt. Tiếng Nhật/Trung tách token bằng bigram chữ Hán/kana, không thì chunk vô hình với BM25. Bộ câu hỏi vàng lên 130 câu, chấm và chốt ngưỡng riêng từng ngôn ngữ (R@3 ≥ 0.85, MRR ≥ 0.70): `vi` 94.7% / 0.829, `en` 94.6% / 0.914, `ja` 94.4% / 0.844, `zh` 100% / 0.824. Còn nợ: `faq-ja.yml`/`faq-zh.yml` chưa qua tay người bản ngữ, và mỗi thứ tiếng mới có 18 câu hỏi vàng. Chi tiết tại [docs/CHATBOT_AI.md](./docs/CHATBOT_AI.md) mục 10.

- [x] **Bộ đo chọn tool:** `tool-eval.yml` (46 ca, bốn ngôn ngữ) + `ToolSelectionQualityTest`. Chọn tool là bài phân loại nhiều nhãn nên dùng precision/recall/F1 nguyên bản, cộng thêm tỉ lệ khớp bộ, gọi thừa, bỏ tra và khớp tham số. 13 ca **không được** gọi tool nào — thiếu nửa này thì bộ đo sẽ khen một hệ thống gọi tool cho mọi thứ. Trường `forbid` chấm riêng lỗi bịa tham số, sinh ra từ vụ `QNH` bị hiểu thành Quy Nhơn. Bộ đo gọi thẳng `AIService.getChatResponse` và bắt lại định nghĩa tool mà nó gửi đi, nên không có bản sao nào lệch pha với code thật. Phần offline chạy trong mọi lượt test: tool đổi tên, tham số bị bỏ, hay thêm tool mới mà chưa có ca đo đều làm build đỏ. Phần live đo ngày 13/09/2026 trên `gemini-flash-lite-latest`: **46/46 khớp bộ, 0/13 gọi thừa, 100% tham số khớp**, 2,07 lời gọi mô hình mỗi câu. Điểm tối đa được ghi lại đúng như nó là: tin tốt về hệ thống, tin xấu về cây thước — nó chỉ còn dùng làm chốt chặn chống thoái lui, và chỗ cần mở rộng tiếp là tham số chứ không phải việc chọn tool. Bộ đo tự fail nếu có lời gọi hỏng vì rate limit, vì lời gọi hỏng bị chấm thành "mô hình bỏ tra" — sai mà không báo. Chi tiết tại [docs/CHATBOT_AI.md](./docs/CHATBOT_AI.md) mục 6.8.

- [x] **Tool có ghi dữ liệu đầu tiên — lưu mã giảm giá qua chat:** `save_voucher` tự nó không ghi gì. Nó tạo một **đề xuất** (mã ngẫu nhiên 128 bit, gắn với tài khoản trong JWT, hết hạn sau 10 phút, dùng một lần), server gắn thẻ `[ACTION: mã]` vào cuối câu trả lời, giao diện dựng nút xác nhận từ dữ liệu server trả về theo mã đó, và chỉ cú bấm của khách mới gọi `/api/chat-actions/{mã}/confirm` để ghi. Ba đường hỏng của tool ghi vì thế bị chặn bằng cấu trúc chứ không bằng lời dặn trong prompt: failover chạy lại cả vòng function calling thì chỉ tạo lại đề xuất (gộp trùng theo lượt chat) chứ không lưu hai lần; prompt injection cùng lắm dựng được một nút mà người thật vẫn phải tự bấm; và model không viết được nội dung nút nên không dựng được nút giả. Mã chỉ được tra trong đúng danh sách công khai mà `check_voucher` đã dùng, nên tool không mở thêm cách dò mã ẩn. Làm đợt này thì lộ ra một lỗ có sẵn từ trước: `POST /api/saved-vouchers/{id}` nhận mọi id kể cả mã admin đã tắt, còn `GET` trả lại nguyên mã, nên đếm id từ 1 trở lên là đọc được mã đang ẩn. Nay mã đã tắt bị từ chối bằng đúng câu báo lỗi của id không tồn tại. Kèm theo trong cùng đợt: prompt khứ hồi được sửa (câu "hướng dẫn khách tìm vé 1 chiều" từng khiến trợ lý hứa "少々お待ちください" rồi không tra gì), nhãn nút liên kết dịch theo ngôn ngữ đang chọn, và 9 mã voucher demo phủ đủ trạng thái (theo hãng, chưa tới ngày, sắp hết lượt, sắp hết hạn). Chi tiết và phân tích rủi ro tại [docs/CHATBOT_AI.md](./docs/CHATBOT_AI.md) mục 4.5.

- [x] **Hành động ghi thứ hai qua trợ lý — cài đặt thư:** `update_mail_preferences` đi đúng khuôn đề xuất → khách bấm xác nhận của `save_voucher`, cho hai việc trên chính tài khoản mình: bật/tắt thư nhắc trước giờ khởi hành (cột mới `nguoi_dung.nhan_thu_nhac_chuyen`, `null` = bật; kèm công tắc ở **Tài khoản → Cài đặt**, để đây không phải thứ chỉ đổi được qua chat) và đổi ngôn ngữ nhận thư. Ba chỗ dễ sai đã chặn: (1) ngôn ngữ tài khoản cũng là ngôn ngữ giao diện, và ai đã bấm cờ trong phiên thì lần nạp hồ sơ sau sẽ đẩy ngôn ngữ trên máy **ngược** lên server — đổi qua chat mà chỉ ghi DB là bị ghi đè ngầm, nên thẻ xác nhận áp ngôn ngữ y như một cú bấm cờ và nói trước là giao diện sẽ đổi theo; (2) thư tiếng Nhật/Trung chưa dịch và đang rơi về tiếng Anh — `SupportedLocales.hasMailTranslation` hỏi thẳng classpath, và cả model lẫn thẻ nút phải nói điều đó trước khi khách bấm; (3) tham số là chuỗi, rỗng = không nhắc tới, để câu "gửi thư bằng tiếng Anh" không dựng một nút tiện tay tắt luôn thư nhắc (ca đo tiếng Anh có `forbid` cho đúng lỗi này). Tắt thư nhắc chỉ chặn thư nhắc: thư xác nhận vé, báo hoãn/huỷ và hoàn tiền vẫn gửi. Bộ lập lịch lọc ngay trong câu truy vấn và kiểm lại trước khi giành cờ `reminderSent`, nên bật lại kịp giờ vẫn nhận thư. Chi tiết tại [docs/CHATBOT_AI.md](./docs/CHATBOT_AI.md) mục 4.5.

### Hướng phát triển tiếp theo:

- [ ] **Hành động ghi tiếp theo qua trợ lý:** cùng khuôn đề xuất → khách bấm xác nhận, xếp theo rủi ro tăng dần: gửi lại email vé (cần trần theo đơn để không thành công cụ dội thư); tạo yêu cầu hỗ trợ chuyển cho người thật kèm mã đơn. **Không** làm qua chat: huỷ vé / hoàn tiền và đặt vé — dính tới tiền và không đảo ngược được, chat chỉ nên dẫn sang đúng trang có sẵn bước xác nhận của nó. Riêng mã đề xuất đang nằm trong RAM của một instance; chạy nhiều instance thì phải chuyển sang CSDL trước.
- [ ] **AI BI 2.0 (Text-to-SQL & Predictive Analytics):** Hỗ trợ Admin truy vấn dữ liệu kinh doanh bằng ngôn ngữ tự nhiên (NL2SQL), dự báo nhu cầu đặt vé theo mùa vụ (Time-series Forecasting) và gợi ý định giá vé động (Dynamic Pricing).
- [ ] **Map & Realtime Tracking:** Tích hợp bản đồ Leaflet / Mapbox theo dõi lộ trình di chuyển và định vị bến bãi, nhà ga thời gian thực.
  - *Điều kiện cần:* chuẩn hoá điểm đi/đến trước khi vẽ. Hiện `tuyen_duong.origin/destination` là chuỗi tự do, không toạ độ, và một thành phố mang hai mã tuỳ phương tiện (`HUI`/`HUE`, `CXR`/`NTR`, `DLI`/`DLT`, `VII`/`VIN`) nên sẽ ra hai pin cho cùng một nơi. Cần tách bảng `dia_diem` (thành phố) và `diem_don_tra` (sân bay / nhà ga / bến xe, kèm `latitude`, `longitude`) — xem chi tiết tại mục 5 phần Thiết kế CSDL trong [SRS_FSD_SPECIFICATION.md](./SRS_FSD_SPECIFICATION.md).
  - *Đã có sẵn một phần:* `PlaceCatalog` giữ toạ độ thật của 12 thành phố, gộp các mã trùng về cùng một `cityId`, và từ mục tool thời tiết thì tra được cả theo tên người dùng gõ. Bảng `dia_diem` nên được seed TỪ đây rồi mới xoá chỗ đó, chứ không gõ lại toạ độ lần nữa.
  - *Một lỗi còn nằm đó, không phải của riêng Map:* `search_trips` nhận đúng một mã điểm, trong khi chặng bay Hà Nội - Huế dùng `HUI` còn tàu và xe cùng tuyến ấy dùng `HUE`. Khách hỏi vé máy bay đi Huế mà model truyền `HUE` thì kết quả là "không tìm thấy chuyến nào" chứ không phải một thông báo cho biết đã tra nhầm mã. Việc gộp mã anh em khi truy vấn nên làm chung với đợt chuẩn hoá địa điểm này.
  - *Riêng Realtime Tracking:* cần thêm `tuyen_duong.path_geojson` để nội suy vị trí dọc tuyến. Chặng `AIR` dùng cung vòng lớn giữa hai sân bay nên không cần dữ liệu ngoài; `RAIL`/`ROAD` không có polyline thì chấm vị trí sẽ trôi theo đường thẳng thay vì bám tuyến thật.

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
8. **Bảng tin chạy:** Phạm vi (cái gì được lên dải tin, cái gì thuộc về Toast/HoldCountdownBanner), kiến trúc cả hai nhịp, và phân tích rủi ro cho dự báo thời tiết: [docs/BANG_TIN_CHAY.md](./docs/BANG_TIN_CHAY.md).
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
