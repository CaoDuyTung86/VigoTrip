# Lựa chọn công nghệ — vì sao cái này mà không phải cái kia

Tài liệu này trả lời đúng một loại câu hỏi: **"Sao lại dùng X? Sao không dùng Y?"**

Nó không mô tả cách hệ thống hoạt động (xem `AI_ONBOARDING.md`, `CHATBOT_AI.md`,
`REALTIME_WEBSOCKET.md`, `THANH_TOAN_VNPAY.md`, `DA_NGON_NGU.md` cho phần đó). Ở đây chỉ có
**quyết định, lý do, và cái giá phải trả**.

Nguyên tắc xuyên suốt khi đọc: mọi lựa chọn dưới đây đều bị ép bởi ba ràng buộc thật của dự án,
không phải bởi "cái nào xịn hơn".

| Ràng buộc | Hệ quả |
|---|---|
| **Nhóm 5 người, ~6 tháng, học phần đồ án** | Mỗi thành phần thêm vào phải có người bảo trì được. Độ phức tạp là chi phí thật. |
| **Hạ tầng miễn phí** (Render free tier: 1 instance, heap 256 MB, ngủ sau 15 phút) | Không có chỗ cho thêm container. Không có bộ nhớ cho model chạy tại chỗ. |
| **Phải chạy được offline trên máy sinh viên** bằng `docker compose up` | Không được phụ thuộc dịch vụ đám mây chỉ-có-trên-cloud. |

Khi bị hỏi "sao không dùng công nghệ Z hiện đại hơn", câu trả lời gần như luôn quy về một trong
ba dòng trên. Đó là câu trả lời đúng, không phải câu chống chế.

---

## 1. Kiến trúc tổng thể — đính chính: đây **không** phải microservices

### Dự án đang là gì

**Một monolith phân tầng (layered monolith) viết bằng Spring Boot, cộng một SPA React tách rời.**

Bằng chứng cụ thể trong kho:

- Toàn bộ backend là **một** Maven module duy nhất: `backend/ticket-booking`, sinh ra **một** file
  `.jar`, chạy bằng **một** tiến trình JVM. Không có module thứ hai, không có `<modules>` trong
  `pom.xml`.
- `docker-compose.yml` có 7 container, nhưng chỉ **1** trong số đó là mã của nhóm (`backend`).
  Sáu cái còn lại là hạ tầng mua sẵn: SQL Server, Nginx phục vụ bản build frontend, Prometheus,
  Grafana, SonarQube, Postgres-cho-Sonar. **Nhiều container ≠ microservices.**
- Các gói trong `com.booking.api` chia theo **tầng** (`controller` → `service` → `repository` →
  `entity`), có thêm vài **module gắn kết theo tính năng** (`ai/`, `realtime/`, `security/`,
  `scheduler/`, `i18n/`). Chúng gọi nhau **trong cùng một tiến trình**, bằng lời gọi hàm Java, chia
  chung một `DataSource` và một transaction. Không có ranh giới mạng, không có API nội bộ,
  không có CSDL riêng cho từng module — ba dấu hiệu định nghĩa của microservices.

### Vậy gọi tên nó cho đúng là gì

> **Kiến trúc phân tầng, monolith triển khai độc lập, frontend tách rời (decoupled SPA),
> triển khai dạng 3 dịch vụ quản lý: Vercel (tĩnh) + Render (ứng dụng) + Neon (dữ liệu).**

Nếu hội đồng hỏi "hệ thống của em có phải microservices không", câu trả lời chuẩn là:

> *"Dạ không ạ. Backend là một monolith phân tầng, đóng gói thành một service duy nhất. Em tách
> frontend ra khỏi backend và tách CSDL ra dịch vụ riêng, nên khi triển khai thì có ba thành
> phần độc lập nhau, nhưng đó là kiến trúc client–server ba tầng chứ không phải microservices —
> vì các module nghiệp vụ của em vẫn chạy chung một tiến trình và chung một CSDL."*

Trả lời như vậy **ghi điểm**. Nhận nhầm là microservices rồi bị hỏi tiếp "vậy service nào gọi
service nào qua giao thức gì, xử lý transaction phân tán ra sao, service discovery đâu" thì không
có đường lùi.

### Vì sao không làm microservices

| Tiêu chí | Monolith (đang dùng) | Microservices |
|---|---|---|
| Số thứ phải triển khai & theo dõi | 1 | 5–8 |
| Transaction "đặt vé + trừ ghế + tạo thanh toán" | **1 transaction ACID** của CSDL | Saga / outbox / bù trừ — tự viết, dễ sai |
| Hạ tầng tối thiểu | 1 instance free tier | Registry, gateway, mỗi service 1 instance → không còn miễn phí |
| Gỡ lỗi khi demo hỏng | Đọc 1 log | Ghép log từ N nguồn, cần tracing phân tán |
| Ai bảo trì được | Cả nhóm | Không ai |

**Điều kiện thật để microservices có lợi:** nhiều đội làm song song trên cùng sản phẩm và cần
deploy độc lập; hoặc một phần hệ thống có tải lệch hẳn, cần scale riêng. Dự án này **không có cả
hai**. Chọn microservices ở đây là trả toàn bộ chi phí phức tạp để đổi lấy lợi ích bằng không.

**Ngưỡng đổi ý:** khi có một module thực sự cần scale riêng (ứng viên gần nhất là tầng AI, vì nó
chờ I/O lâu và tốn tiền theo lượt gọi) hoặc khi số người sửa cùng một file bắt đầu gây xung đột
liên tục. Cách tách hợp lý nhất khi đó là bóc `ai/` ra trước — nó đã là một biên giới gọn, chỉ đọc
knowledge base và gọi ra ngoài, không nắm state đặt vé.

---

## 2. Backend: Java 17 + Spring Boot 3.4

| Lựa chọn | Ưu | Vì sao loại |
|---|---|---|
| **Java 17 + Spring Boot 3.4** ✅ | Hệ sinh thái đầy đủ trong một framework: Security, Data JPA, Validation, WebSocket, Mail, Actuator. Kiểu tĩnh giúp refactor an toàn khi 5 người đụng chung code. Là stack được dạy và được tuyển dụng nhiều nhất ở VN. | — |
| Node.js / Express / NestJS | Chung ngôn ngữ với frontend, khởi động nhanh | Mỗi mảnh (auth, ORM, validation, WS) là một thư viện rời do bên thứ ba giữ; nhóm phải tự ráp và tự chịu trách nhiệm bảo mật. JS động khiến lỗi hợp đồng dữ liệu chỉ lộ ra lúc chạy. |
| .NET / ASP.NET Core | Tương đương Spring về độ chín | Nhóm không có nền C#; đổi stack giữa chừng = học lại từ đầu |
| Python / FastAPI / Django | Viết nhanh, hợp với AI | Phần AI của dự án chỉ **gọi API** LLM chứ không huấn luyện gì, nên lợi thế Python biến mất. Đổi lại mất kiểu tĩnh và mất Spring Security. |
| Go | Nhị phân nhỏ, ăn ít RAM (rất hợp free tier) | Không có ORM/Security ở tầm Spring; phải tự viết nhiều; nhóm không ai biết |

**Java 17 chứ không phải 21:** 17 là bản LTS mà Render, GitHub Actions và máy các thành viên đều
có sẵn, đồng thời là bản tối thiểu Spring Boot 3.x yêu cầu. Nâng lên 21 chỉ để lấy virtual threads
là không đáng khi ứng dụng chưa từng chạm trần luồng.

**Các thư viện đi kèm và lý do:**

| Thư viện | Thay cho | Lý do |
|---|---|---|
| **MapStruct** | Viết tay hàm `toDTO()`, hoặc ModelMapper | Sinh mã lúc **biên dịch** → đổi tên field mà quên map thì **build đỏ**. ModelMapper dùng reflection, sai chỉ lộ lúc chạy và chậm hơn. |
| **Lombok** | Getter/setter/constructor viết tay | Giảm nhiễu; đổi lại phải bật annotation processor trong IDE |
| **Caffeine** | Redis, hoặc `ConcurrentHashMap` tự viết | Chỉ chạy **1 instance** nên cache trong tiến trình là đủ và đúng. Thêm Redis là thêm container + điểm lỗi để giải quyết một vấn đề chưa tồn tại. Xem mục 5. |
| **springdoc-openapi (Swagger UI)** | Postman collection viết tay | Tài liệu API sinh từ chính chữ ký hàm nên không bao giờ lệch với code |
| **ZXing** | Dịch vụ sinh QR bên ngoài | Sinh QR tại chỗ, không phụ thuộc mạng, không lộ mã vé cho bên thứ ba |

---

## 3. Frontend: React 19 + Vite

| Lựa chọn | Vì sao / vì sao không |
|---|---|
| **React** ✅ | Cộng đồng và tài liệu lớn nhất; nhóm có nền sẵn; ba thư viện dự án cần (`@stomp/stompjs`, `recharts`, `html5-qrcode`) đều hỗ trợ React tốt nhất |
| Vue | Đường học dễ hơn thật | Không ai trong nhóm biết; đổi = học lại |
| Angular | Có sẵn khuôn mẫu, hợp app doanh nghiệp | Quá nặng cho quy mô này; DI + RxJS + module là ba khái niệm phải học trước khi viết được màn hình đầu tiên |
| **Next.js** | SSR/SEO tốt hơn hẳn | Phần lớn màn hình là **sau đăng nhập** (đặt vé, vé của tôi, quản trị) — SEO vô nghĩa ở đó. Next.js kéo theo một runtime Node phải deploy, trong khi SPA build ra tệp tĩnh và Vercel phục vụ **miễn phí trên CDN toàn cầu**. Đây là lựa chọn *bỏ tính năng để lấy đơn giản*, có ý thức. |

**Vite chứ không phải Create React App:** CRA đã ngừng phát triển. Vite dùng ESM gốc nên khởi động
dev server gần như tức thì và HMR không phụ thuộc kích thước dự án — thứ này nhân với hàng trăm
lần chạy lại trong 6 tháng là khác biệt lớn. CRA (webpack) build lại chậm dần theo dự án.

**Không dùng Redux / Zustand:** trạng thái toàn cục của app chỉ có ba thứ — người dùng đăng nhập,
ngôn ngữ, vé đang chọn. React Context xử lý đủ. Thêm Redux cho ba giá trị là boilerplate thuần.
*Ngưỡng đổi ý:* khi có trạng thái server phức tạp cần cache/invalidate — lúc đó thứ cần là
**TanStack Query**, không phải Redux.

**Không dùng TypeScript** — xem mục 15 (nợ kỹ thuật có chủ đích).

**PWA (`vite-plugin-pwa`):** cài được lên điện thoại và mở lại được khi mạng chập chờn ở bến xe —
đúng bối cảnh sử dụng của sản phẩm.

---

## 4. Cơ sở dữ liệu: quan hệ, và chạy được trên hai hệ

### Vì sao SQL quan hệ chứ không phải NoSQL

Nghiệp vụ đặt vé là **giao dịch tiền bạc trên tài nguyên hữu hạn**: một ghế, một người. Thứ dự án
cần nhất là **ràng buộc toàn vẹn** và **transaction ACID** — chính là điểm mạnh cốt lõi của RDBMS.

MongoDB đổi lấy lược đồ linh hoạt, nhưng lược đồ ở đây **không nên** linh hoạt: một đơn thiếu
trường trạng thái thanh toán là một đơn hỏng. Và khi chống đặt trùng ghế, thứ cứu hệ thống là
**unique index của CSDL** (mục 12) — thứ NoSQL không cho một cách tự nhiên trên quan hệ nhiều bảng.

### Vì sao đồng thời SQL Server và PostgreSQL

Đây là câu dễ bị hỏi. Lý do rõ ràng:

| Môi trường | Hệ CSDL | Vì sao |
|---|---|---|
| Local / Docker | **SQL Server 2022** | Là hệ được dạy trong chương trình; `docker compose up` là chạy được, không cần tài khoản đám mây |
| Cloud staging | **Neon PostgreSQL (serverless)** | Không có SQL Server free tier nào dùng được thật; Neon cho Postgres miễn phí, tự ngủ khi rảnh, khớp mô hình chi phí của Render |
| Bản EC2 | AWS RDS SQL Server | Bản triển khai VPS truyền thống để đối chiếu |

Chạy được trên cả hai là **ràng buộc thiết kế**, không phải tai nạn: mọi truy vấn đi qua JPA/JPQL
chứ không phải SQL thuần theo phương ngữ riêng; chỗ nào buộc phải dùng SQL riêng (ví dụ
`VoucherUsageConstraintInitializer` tạo *filtered unique index*) đều **kiểm tra phương ngữ trước
và suy giảm êm** nếu hệ không hỗ trợ. Đây cũng chính là lý do **không** chọn `pgvector` cho RAG
(mục 9): nó sẽ phá vỡ đường chạy local.

**Neon vì sao chứ không phải Supabase / PlanetScale / RDS:**

| | Nhận xét |
|---|---|
| **Neon** ✅ | Postgres thuần, tách compute khỏi storage nên ngủ được → free tier dùng thật được; có branching như Git, tiện tạo CSDL thử nghiệm |
| Supabase | Cũng Postgres, nhưng bán kèm auth/storage/realtime — dự án đã tự làm cả ba, mua thêm là thừa và tạo trùng lặp |
| PlanetScale | MySQL/Vitess, đã bỏ gói miễn phí; không có khóa ngoại theo mặc định — ngược hẳn nhu cầu toàn vẹn |
| AWS RDS | Chuẩn công nghiệp nhưng **không miễn phí lâu dài** |

---

## 5. Đóng gói & hạ tầng

### Docker: dùng. Kubernetes: không.

**Docker giải quyết một vấn đề có thật đã xảy ra với nhóm:** "máy em chạy được mà máy anh không".
`docker-compose.yml` dựng nguyên môi trường (CSDL + backend + frontend + giám sát) bằng một lệnh, và
là thứ cho phép người mới vào nhóm chạy được hệ thống trong 10 phút. CI cũng dùng chính nó
(`docker compose build`) để bảo đảm Dockerfile không mục.

**Kubernetes bị loại vì nó giải quyết bài toán mà dự án không có:**

| K8s cho ta | Dự án có cần không |
|---|---|
| Tự scale nhiều bản sao | Không — cố tình chạy **1 instance** (mục 12: cơ chế chống trùng dựa vào 1 CSDL, có bản sao phải viết lại) |
| Tự phục hồi khi container chết | Render đã làm sẵn |
| Rolling update không downtime | Downtime vài chục giây khi deploy là chấp nhận được |
| Service discovery | Chỉ có 1 service |

Cái giá của K8s: một cụm (kể cả managed) đắt hơn toàn bộ hạ tầng hiện tại, cộng thêm YAML,
Ingress, Secret, HPA — một bộ khái niệm cần người chuyên trách. Kết luận trung thực:
**dự án dùng Docker để chuẩn hoá môi trường, không dùng orchestration vì chưa có gì để điều phối.**

### Vì sao chia ba nhà: Vercel + Render + Neon

Mỗi tầng đặt ở nơi làm tốt nhất phần việc của nó — và tất cả đều nằm trong gói miễn phí.

| Tầng | Nơi đặt | Vì sao chính nó | Cái giá đã biết |
|---|---|---|---|
| Frontend (tệp tĩnh) | **Vercel** | Tệp tĩnh nên phát từ CDN biên là tối ưu tuyệt đối; HTTPS + preview theo từng PR sẵn có; `vercel.json` rewrite `/api` và `/ws` sang Render nên trình duyệt chỉ thấy **một** origin → **không cần CORS** | Ràng vào một nhà cung cấp ở phần cấu hình rewrite |
| Backend (tiến trình có state) | **Render** | Chạy container Java lâu dài, giữ được **kết nối WebSocket** và **bộ nhớ trong** (vector store, cache, trạng thái giữ ghế) | Free tier **ngủ sau ~15 phút** → lần gọi đầu mất 30–60 s. Đã có quy trình đối phó khi demo trong `DEMO_CHEATSHEET.md`. |
| CSDL | **Neon** | Postgres serverless miễn phí, ngủ được | Kết nối lạnh mất thêm thời gian |

**Vì sao backend không chạy serverless function (Vercel Functions / AWS Lambda):** đây là câu hỏi
hay và câu trả lời rất chắc — **WebSocket không sống được trên serverless function**. Function có
vòng đời tính bằng giây và không giữ kết nối. Mà giữ ghế thời gian thực là tính năng lõi. Ngoài ra
JVM khởi động lạnh chậm, còn vector store nằm trong bộ nhớ tiến trình sẽ phải nạp lại mỗi lần gọi.
Kết luận: **frontend hợp serverless, backend thì không** — và dự án chia đúng như vậy.

**Vì sao vẫn giữ thêm bản AWS EC2 (`datxe.duckdns.org`):** để có một bản triển khai **không ngủ**,
đủ ổn định làm phương án dự phòng khi demo, đồng thời chứng minh hệ thống chạy được theo lối
VPS truyền thống (Nginx reverse proxy + Let's Encrypt + Docker Compose) chứ không chỉ trên PaaS.

---

## 6. Kafka và hàng đợi thông điệp: **không dùng**, và đây là lý do

Kafka là câu hỏi hay bị hỏi nhất trong nhóm "sao không dùng".

**Kafka sinh ra để giải quyết:** luồng sự kiện thông lượng rất cao (hàng chục nghìn/giây), cần
**nhiều hệ tiêu thụ độc lập** cùng đọc một dòng sự kiện, cần **phát lại lịch sử** sự kiện, và cần
tách rời các dịch vụ ở mức triển khai.

**Dự án này:** tất cả bên gửi và bên nhận **nằm trong cùng một tiến trình JVM**. Đưa Kafka vào giữa
hai lớp Java gọi nhau bằng lời gọi hàm nghĩa là serialize thông điệp, đẩy qua mạng, đọc lại,
deserialize — để tới đúng đối tượng lẽ ra chỉ cần gọi trực tiếp. Đó là độ trễ và điểm lỗi mua bằng
tiền mặt, đổi lấy con số không.

**Thứ dự án thật sự cần — "làm việc này nhưng đừng bắt người dùng chờ" — đã có, bằng công cụ nhẹ hơn:**

| Nhu cầu | Đang dùng | Kafka có tốt hơn không |
|---|---|---|
| Gửi mail xác nhận sau khi đặt vé xong | `ApplicationEvent` + listener sau commit + `@Async` (`BookingConfirmedEvent`) | Không — sự kiện chỉ có **một** nơi tiêu thụ, và phát **sau khi commit** nên không bao giờ gửi mail cho đơn bị rollback |
| Dọn đơn treo, nhắc chuyến, bù lịch chuyến, đánh dấu no-show | `@Scheduled` (`scheduler/`) | Không — đây là việc **theo giờ**, không phải theo sự kiện. Kafka không phải bộ lập lịch. |
| Đẩy trạng thái ghế tới các trình duyệt | WebSocket/STOMP broker trong tiến trình | Không — người tiêu thụ là **trình duyệt**, không phải service backend |

**Ngưỡng đổi ý (nói ra được là ghi điểm):** khi tách `ai/` hoặc dịch vụ thông báo thành tiến trình
riêng, hoặc khi cần nhiều instance backend — lúc đó broker trong bộ nhớ không còn phát tới đúng
mọi instance, và thứ cần trước tiên là một **message broker** (RabbitMQ hoặc Redis Pub/Sub làm
STOMP relay) — vẫn **chưa phải Kafka**. Kafka chỉ đáng khi cần lưu và phát lại dòng sự kiện.

---

## 7. Realtime: WebSocket + STOMP

Bài toán: hai người mở cùng một chuyến, A chọn ghế B12 thì màn hình B phải thấy B12 chuyển sang
"đang có người giữ" **ngay**, không cần F5.

| Cách | Đánh giá |
|---|---|
| **WebSocket (STOMP over SockJS)** ✅ | Song công, một kết nối duy nhất, độ trễ ~mili giây. STOMP cho **định tuyến theo topic**, nhờ đó tách kênh **theo từng chuyến** (`SeatTopic`) thay vì phát mọi sự kiện tới mọi trình duyệt. Có sẵn trong `spring-boot-starter-websocket`. |
| Polling (gọi API mỗi 3 giây) | Đơn giản nhất, nhưng: trễ tới 3 s, và tạo tải nền không đổi kể cả khi không có gì thay đổi — trên free tier thì đây là tiền và là RAM |
| Long-polling | Đỡ tốn hơn polling nhưng vẫn nặng, và độ phức tạp đã gần bằng WebSocket |
| **SSE (Server-Sent Events)** | Ứng viên **nghiêm túc nhất**: nhẹ hơn, tự kết nối lại, đi qua proxy dễ hơn. Loại vì **một chiều** — client còn phải *gửi lên* "tôi giữ ghế này / tôi nhả ghế này", nên vẫn phải kèm một kênh HTTP riêng, thành hai cơ chế thay vì một. |

**SockJS để làm gì:** dự phòng khi mạng chặn WebSocket (mạng hội trường, wifi trường học hay chặn).
Khi đó nó tụt xuống long-polling — chậm hơn nhưng **vẫn chạy**. Đây là lựa chọn vì buổi demo.

**Vì sao STOMP chứ không phải WebSocket thô:** WebSocket thô chỉ cho ta một ống byte; muốn có
topic, subscribe, hay chặn thông điệp thì phải tự định nghĩa giao thức. STOMP có sẵn, và quan
trọng hơn: có sẵn **điểm móc để kiểm soát** — `StompAuthChannelInterceptor` xác thực JWT ngay ở
frame CONNECT, `StompRateLimitChannelInterceptor` chặn spam. Tự viết giao thức thì phải tự viết
cả hai thứ này (và ban đầu dự án đã quên — xem `REALTIME_WEBSOCKET.md`).

---

## 8. Chịu lỗi: circuit breaker tự viết thay vì Resilience4j

Chi tiết đầy đủ ở `CHATBOT_AI.md` §8.9. Tóm tắt để trả lời nhanh:

**Bối cảnh:** nhà cung cấp LLM miễn phí trả 429 (hết quota) và 503 (quá tải) khá thường xuyên.
`LlmRouter` chuyển sang nhà kế tiếp, `ProviderCircuitBreaker` ngắt tạm nhà đang hỏng để khỏi phí
thời gian gọi vào chỗ chết, có trạng thái **HALF-OPEN** để thăm dò và **backoff luỹ tiến**.

| | Tự viết (~150 dòng) | Resilience4j |
|---|---|---|
| Phần khó thật của bài toán | **Router**: thứ tự nhà cung cấp, đổi model, giữ hợp đồng OpenAI-compatible, metric gắn nhãn theo `task`/`provider`/`model` | Resilience4j bọc **một** lời gọi tới **một** đích — nó **không** giải phần router. Vẫn phải tự viết. |
| Trần chi phí theo **token/ngày** (`LlmBudgetGuard`) | Có | `RateLimiter` đếm **số lời gọi**, không biết token là gì → không thay thế được |
| Chi phí hiểu | Đọc hết trong một buổi | Thêm dependency + cấu hình + tài liệu |

**Điểm cần nói thẳng:** tự viết cơ chế chịu lỗi trong sản phẩm thật thường là **quyết định sai**.
Nó đúng ở đây vì thứ cần bọc là *một* lời gọi ra ngoài, còn phần Resilience4j giải quyết được lại
chỉ là phần dễ. **Ngưỡng đổi ý:** khi có nhà cung cấp thứ ba, hoặc khi cần bulkhead / retry có
jitter / cách ly luồng — lúc đó viết tiếp là tự dựng lại Resilience4j một cách tệ hơn, và phải chuyển.

**Một lưu ý đã ghi trong code:** `LlmRouter.execute` chạy **lại toàn bộ** action trên nhà cung cấp
kế tiếp, nên action phải **idempotent**. Hiện mọi tool đều là truy vấn **chỉ đọc**
(`search_trips`, `get_user_bookings`, `get_booking_by_id`) nên chạy lại vô hại — thêm tool có ghi
dữ liệu thì phải xem lại chỗ này.

---

## 9. AI: vì sao RAG lai (hybrid) chứ không phải cách khác

### Bước 1 — vì sao RAG chứ không phải fine-tune hay nhét hết vào prompt

| Cách | Vì sao loại / chọn |
|---|---|
| Hỏi thẳng LLM, không có tri thức riêng | Model **không biết** chính sách hoàn vé của VigoTrip. Nó sẽ **bịa ra một chính sách nghe rất hợp lý** (hallucination). Với chatbot chăm sóc khách hàng, đây là rủi ro nghiêm trọng. |
| **Fine-tune** model trên tài liệu công ty | Tốn dữ liệu và tiền; **sửa một dòng chính sách phải huấn luyện lại**; và fine-tune dạy *văn phong*, không dạy *sự kiện* một cách đáng tin |
| Nhét **toàn bộ** knowledge base vào prompt | Tốn token tuyến tính theo mọi lượt chat; và ngữ cảnh dài làm loãng — model bỏ sót thông tin nằm giữa prompt ("lost in the middle") |
| **RAG** ✅ | Chỉ nạp vài đoạn **liên quan** vào prompt. Sửa tri thức = sửa một dòng trong bảng `tri_thuc`, hiệu lực ngay, không huấn luyện lại. |

### Bước 2 — vì sao **hybrid** chứ không chỉ vector

Hai nhánh hỏng ở hai chỗ khác nhau, và bù được cho nhau:

| Nhánh | Mạnh | Yếu |
|---|---|---|
| **Ngữ nghĩa (vector)** | Hiểu diễn đạt khác từ: "hủy vé có lấy lại tiền không" khớp được chunk viết "chính sách hoàn tiền" | Kém với **mã và số hiệu**: "VNP01", "chuyến SE7" bị hòa tan thành vector chung chung |
| **Từ khóa (BM25)** | Chính xác tuyệt đối với mã, số hiệu, tên riêng | Mù trước từ đồng nghĩa: hỏi "đổi vé" mà tài liệu viết "thay đổi lịch trình" là trượt |

Miền của dự án có **cả hai** loại truy vấn — nên chọn cả hai nhánh.

**Hợp nhất bằng Reciprocal Rank Fusion (RRF), không phải cộng điểm có trọng số:** hai nhánh cho
điểm trên hai thang không so sánh được (cosine 0–1 so với BM25 không chặn trên). RRF chỉ dùng
**thứ hạng** (`score = Σ 1/(k + rank)`, `k = 60` theo tài liệu gốc), nên không cần chuẩn hóa và
không phải tự gán trọng số — mà với corpus cỡ này thì gán trọng số chỉ là đoán mò.

**Suy giảm êm (graceful degradation):** thiếu API key hoặc lời gọi embedding hỏng → nhánh ngữ nghĩa
trả rỗng, hệ thống **rơi về BM25 thuần** và chatbot vẫn tra cứu được. Không có trạng thái "chết hẳn".

Tham số hiện tại (`RagProperties`): `topK = 4` chunk nạp vào prompt, `candidatesPerBranch = 10`
ứng viên lấy từ mỗi nhánh trước khi hợp nhất, `minSimilarity = 0.55` để lọc nhiễu — model embedding
đa ngôn ngữ hiếm khi cho điểm dưới 0.3 kể cả với cặp không liên quan, nên ngưỡng này có tác dụng rõ.

### Bước 3 — vì sao vector store trong bộ nhớ, không phải vector DB

| Lựa chọn | Kết luận |
|---|---|
| **`InMemoryVectorStore`** ✅ | Corpus **~56 chunk × 768 chiều × 4 byte ≈ 168 KB**. Trên heap 256 MB thì đây là số không. Quét toàn bộ (brute-force cosine) mất chưa tới một mili giây — **chính xác hơn** mọi chỉ mục xấp xỉ kiểu HNSW, vốn chỉ có nghĩa từ cỡ hàng trăm nghìn vector trở lên. |
| Qdrant / ChromaDB | Cần thêm container — Render free tier chỉ chạy được 1. Thêm một điểm lỗi và một phụ thuộc free tier bên ngoài. |
| **pgvector trên Neon** | Đúng chuẩn nhất về kỹ thuật, nhưng **phá vỡ đường chạy local**: SQL Server 2022 không có pgvector → không còn test được bằng `docker compose`. Đây là ràng buộc "chạy được trên hai hệ" ở mục 4. |

Vector vẫn được **lưu bền trong CSDL** (bảng `tri_thuc`, mã hóa qua `VectorCodec`) và nạp lên bộ nhớ
lúc khởi động — nên khởi động lại không phải gọi lại API embedding. `content_hash` (SHA-256) khiến
chỉ chunk **đổi nội dung** mới phải sinh embedding lại; đây là thứ giữ chi phí không leo thang.

**Embedding gọi API chứ không chạy model tại chỗ:** Dockerfile giới hạn `-Xmx256m` cho Render free
tier, còn model embedding nhỏ nhất cũng cần nhiều hơn thế. Không có lựa chọn nào khác.

**Gemini là nhà chính, Groq dự phòng, giao thức OpenAI-compatible:** dùng chung một hợp đồng API
nghĩa là thêm/đổi nhà cung cấp chỉ là thêm cấu hình, không phải viết lại client — chính điều đó
làm cho `LlmRouter` ở mục 8 khả thi.

---

## 10. Đo chất lượng AI: các chỉ số và vì sao chọn đúng những chỉ số đó

Đây là phần khác biệt nhất so với đồ án thông thường — **AI được đo, không được tin**. Và điểm mấu
chốt cần nói: **hai tầng AI dùng hai loại thước khác nhau, vì rủi ro của chúng khác nhau.**

### 10.1 Chatbot RAG — đo **truy hồi** (`RagRetrievalQualityTest`)

Đo trên **bộ câu hỏi vàng** (`rag-eval.yml`, 57 câu): mỗi câu ghi sẵn chunk nào *đúng ra* phải được
lấy về. Chạy trên nhánh BM25, **offline hoàn toàn** — JUnit thuần, không Spring context, không CSDL,
không API key — nên chạy được trong CI ở mọi lần push.

| Chỉ số | Định nghĩa | Trả lời câu hỏi gì | Vì sao cần |
|---|---|---|---|
| **Recall@3** | Tỉ lệ câu hỏi mà chunk đúng **nằm trong 3 kết quả đầu** | *"Tài liệu đúng có được lấy về không?"* | **Quan trọng nhất.** Truy hồi trượt thì LLM giỏi mấy cũng không cứu được — không có gì để dựa vào thì nó quay lại bịa. Chọn `@3` vì prompt nạp `topK = 4`. |
| **MRR** (Mean Reciprocal Rank) | Trung bình của `1/thứ hạng` của kết quả đúng đầu tiên | *"Nó nằm ở hạng mấy?"* | Recall coi hạng 1 và hạng 3 như nhau; MRR thì không. Hạng cao hơn = LLM đọc thấy sớm hơn, ít bị loãng. |
| **Precision@1** | Tỉ lệ câu hỏi mà kết quả **đầu tiên** đã đúng | *"Phát ăn ngay bao nhiêu phần trăm?"* | Là chỉ số gần nhất với khái niệm "accuracy" quen thuộc trong bài toán phân loại — dễ giải thích cho người ngoài |

**Ngưỡng chặn trong CI: `recall@3 ≥ 0.85` và `MRR ≥ 0.70`.** Ngưỡng đặt **thấp hơn mức đo được thật**
— có chủ đích: mục tiêu là bắt **thoái lui** (sửa knowledge base hay `TextNormalizer` làm tụt chất
lượng thì build đỏ ngay), chứ không phải khoe con số. Đặt ngưỡng sát mức thật thì CI sẽ đỏ vì
nhiễu và mọi người sẽ học cách phớt lờ nó.

Chế độ **live** (`RAG_EVAL_LIVE=1` + API key, chạy tay, **không** trong CI) đo thêm nhánh ngữ nghĩa
và nhánh lai — đây là nguồn số liệu so sánh ba kiến trúc truy hồi cho báo cáo.

### 10.2 AI BI — đo **groundedness** (`AiBiGroundednessTest`)

Ở màn Thống kê doanh thu, SQL tính ra số, rồi LLM **viết lời bình** cho các con số đó. Rủi ro duy
nhất đáng kể ở đây rất cụ thể: **AI nói ra một con số không có trong dữ liệu.**

```
groundedness = |số trong câu trả lời ∩ số trong bản tóm tắt| / |số trong câu trả lời|
mục tiêu = 1.00
```

Phép đo này **tất định 100%**: bóc số bằng biểu thức chính quy rồi kiểm tra thuộc tập hợp.
**Không có model nào chấm điểm model nào** — nên nó chạy được trong test tự động, lặp lại cho cùng
kết quả, và không tốn tiền.

Củng cố bằng thiết kế: giao diện và phần AI **đọc chung một đối tượng số liệu**
(`/api/analytics/summary`), nên con số AI dẫn ra **không thể** lệch với biểu đồ người dùng đang nhìn.

### 10.3 Vì sao **không** đo Faithfulness bằng máy

| | |
|---|---|
| **Faithfulness** | *"Câu trả lời có bịa thêm gì ngoài tài liệu đã lấy về không?"* — tách câu trả lời thành từng **mệnh đề** và kiểm tra mỗi mệnh đề có suy ra được từ chunk hay không |
| Vì sao nó khó | Mệnh đề là **ngôn ngữ tự nhiên**, không phải con số. Chấm tự động cần **LLM-as-a-judge** — tức là một model chấm điểm một model, có chi phí, có độ trôi giữa các lần chạy, và bản thân trọng tài cũng sai được. |
| Xử lý hiện tại | Groundedness dùng ở nơi rủi ro **đếm được** (AI BI). Bên chatbot thì phòng thủ **ở khâu sinh** thay vì khâu chấm: prompt buộc trả lời trong phạm vi tri thức lấy về và nói "không biết" khi thiếu căn cứ. |
| Tín hiệu bổ sung | Nút 👍/👎 (`ChatFeedback`) từ người dùng thật. Đây **không** thay thế Faithfulness — mẫu bị lệch, vì người hài lòng ít bấm hơn người bực. Nó là tín hiệu, không phải phép đo. |

Nói được đúng chỗ này — *"em biết Faithfulness là gì, biết vì sao em chưa đo tự động được, và em
đã đo cái đo được"* — mạnh hơn nhiều so với khẳng định đã đo mọi thứ.

### 10.4 Bảng tra nhanh thuật ngữ

| Thuật ngữ | Một câu |
|---|---|
| **Hallucination** | Model bịa thông tin nghe thuyết phục nhưng sai — vấn đề trung tâm mà RAG sinh ra để giải |
| **Chunk** | Một mẩu tri thức đủ nhỏ để nạp vào prompt và đủ trọn nghĩa để trả lời được một câu hỏi |
| **Embedding** | Vector số biểu diễn nghĩa của văn bản; hai đoạn cùng nghĩa thì hai vector gần nhau |
| **Cosine similarity** | Độ gần giữa hai vector, 0–1; ngưỡng lọc nhiễu của dự án là 0.55 |
| **BM25** | Xếp hạng theo tần suất từ khóa, có phạt từ phổ biến và phạt tài liệu dài |
| **RRF** | Trộn hai bảng xếp hạng bằng **thứ hạng** thay vì bằng điểm, nên không cần chuẩn hóa thang điểm |
| **Recall@k** | Tài liệu đúng có nằm trong k kết quả đầu không |
| **MRR** | Nó nằm ở hạng mấy (trung bình của 1/hạng) |
| **Precision@1** | Kết quả đầu tiên đã đúng chưa |
| **Groundedness** | Câu trả lời có neo được vào dữ liệu nguồn không (dự án đo trên **số**) |
| **Faithfulness** | Câu trả lời có bịa thêm mệnh đề nào ngoài tài liệu không (cần LLM-as-a-judge) |

---

## 11. Bảo mật & xác thực

### JWT thay vì session trên server

| | JWT (đang dùng) | Session + cookie |
|---|---|---|
| Trạng thái phía server | **Không có** — hợp với 1 instance có thể bị Render khởi động lại bất cứ lúc nào, và hợp nếu sau này có nhiều instance | Cần bộ nhớ session dùng chung (Redis) khi có từ 2 instance |
| Dùng cho WebSocket | Gửi token ở frame CONNECT là xong | Phải bắc cầu session HTTP sang kênh WS |
| Thu hồi ngay lập tức | **Không làm được** — token còn hạn là còn dùng được | Xóa session là mất hiệu lực tức thì |

Đánh đổi được chấp nhận vì hạn token ngắn và hệ thống chưa có nhu cầu thu hồi tức thì
(chưa có tính năng "đăng xuất khỏi mọi thiết bị").

**Nợ đã biết và đã ghi vào roadmap:** access token hiện lưu ở `localStorage`, tức là **script XSS
nào đọc được thì lấy được phiên**. Hướng xử lý đã xác định: HttpOnly cookie + refresh token có
xoay vòng, access token ngắn hạn giữ trong React Context. **Chưa làm.** Nếu bị hỏi, trả lời thẳng
như vậy — đây là lỗ hổng phổ biến nhất trong đồ án web, và biết nó tồn tại là điều hội đồng muốn nghe.

### Các lớp phòng thủ khác và lý do

| Cơ chế | Chống cái gì |
|---|---|
| `StompAuthChannelInterceptor` | Trước đây danh tính người giữ ghế là trường `userId` **do trình duyệt tự khai** → ai cũng nhả được ghế người khác. Giờ danh tính suy ra từ JWT tại frame CONNECT, bỏ qua mọi thứ client khai trong thân thông điệp. |
| Mã HMAC ẩn danh cho chủ ghế | Trước đây mở DevTools là đọc được **email** của mọi người đang chọn ghế cùng chuyến |
| Tách kênh theo chuyến + `WS_ALLOWED_ORIGIN_PATTERNS` | Bỏ `setAllowedOriginPatterns("*")` — khi để mở, **bất kỳ trang web nào** cũng nhúng được vài dòng JS để đọc luồng chọn ghế của người dùng |
| Trần 20 ghế mỗi danh tính | Giữ ghế hàng loạt để phá hoại nguồn cung |
| `RateLimitingFilter` (đọc `X-Forwarded-For` an toàn) | Spam API và giả mạo IP để né giới hạn |
| `LlmBudgetGuard` | Trần token/ngày — chống **cạn quota** và chống hóa đơn bất ngờ, thứ mà rate limit theo *số lời gọi* không chặn được |
| `StartupSecretsValidator` | Thiếu secret bắt buộc thì **chặn khởi động** thay vì chạy với cấu hình mặc định nguy hiểm |
| **Gitleaks trong CI** | Quét toàn bộ lịch sử Git tìm secret bị commit nhầm — chặn ở PR, trước khi lên public |
| Xác minh callback VNPay bằng `querydr` | Không tin mỗi chữ ký trên URL trả về; đối chiếu ngược với cổng thanh toán |
| Unique index trên `transaction_ref` | Chặn ghi trùng giao dịch ở tầng CSDL (mục 12) |
| Google OAuth2 (xác minh ID token phía server) | Không tin token client gửi lên; verify bằng thư viện chính chủ của Google |

---

## 12. Đồng thời & toàn vẹn dữ liệu — vì sao dựa vào CSDL

Bài toán kinh điển của hệ đặt vé: hai người bấm mua **ghế cuối cùng** đúng cùng một khoảnh khắc.

| Cách | Đánh giá |
|---|---|
| Kiểm tra ở tầng service rồi mới ghi | **Sai.** Giữa lúc kiểm tra và lúc ghi có khe hở; hai luồng cùng qua được vòng kiểm tra là bán trùng. |
| `synchronized` trong Java | Chỉ đúng khi có **một** JVM. Thêm instance thứ hai là hỏng ngay, và hỏng âm thầm. |
| Khóa phân tán bằng Redis | Đúng khi có nhiều instance, nhưng thêm một container và một lớp phức tạp (hết hạn khóa, chủ khóa chết) để giải bài toán **hiện chưa có** |
| **Khóa bi quan (`PESSIMISTIC_WRITE`) + unique index của CSDL** ✅ | Hai lớp: khóa hàng cho luồng thường; và **unique index là chốt chặn cuối** — hai request song song mà cùng lọt qua vòng kiểm tra thì INSERT thua sẽ bị CSDL từ chối, service bắt lỗi vi phạm ràng buộc và dịch sang thông báo tử tế. **CSDL là bên duy nhất thấy toàn bộ, nên chốt chặn phải nằm ở đó.** |

Cùng nguyên tắc áp cho voucher (*filtered unique index* trên `(user_id, voucher_code)` với đơn chưa
hủy) và cho thanh toán (`ux_thanh_toan_transaction_ref`). Đều có test đi kèm
(`SeatDoubleBookingIntegrationTest`, `BookingServiceTest`, `PaymentServiceTest`).

**Nói rõ giới hạn:** thiết kế này giả định **một instance backend**. Chạy nhiều bản sao thì
unique index vẫn đúng (nó ở CSDL), nhưng phần **giữ ghế tạm thời trong bộ nhớ** và **broker STOMP
trong tiến trình** thì không — cần STOMP relay ngoài và một kho giữ ghế dùng chung. Đây là ràng
buộc đã ghi nhận, không phải chỗ bị bỏ sót.

---

## 13. i18n: vì sao không dịch máy

Chi tiết ở `DA_NGON_NGU.md`. Phần "vì sao":

| Cách | Vì sao loại / chọn |
|---|---|
| Gắn Google Translate widget | Dịch cả **mã vé**, **tên riêng**, **thuật ngữ nghiệp vụ**; không dịch được **mail** (mail gửi ngoài trình duyệt); phá vỡ bố cục; và tạo phụ thuộc mạng cho một thứ đáng ra là tĩnh |
| Gọi API dịch máy lúc chạy | Tốn tiền theo mỗi lượt xem, thêm độ trễ, kết quả **không ổn định giữa các lần** — cùng một nút có thể ra hai chữ khác nhau |
| **Bảng khoá dịch tĩnh** ✅ | Chữ do người viết, kiểm soát được, **kiểm tra được bằng script**, và dùng chung một nguồn cho cả web lẫn mail |
| `react-i18next` | Thư viện chuẩn thật; dự án dùng React Context + object `t` cho gọn. Đánh đổi: mất tính năng số nhiều/nội suy tinh vi, và mất an toàn khoá — nên phải bù bằng script kiểm tra bên dưới. |

**Vì sao phải có script `i18n:check` trong CI:** `t` là một **object**, nên `t.khoaGoSai` trả về
`undefined` **im lặng**; tệ hơn, phần lớn chỗ gọi lại che bằng `|| "chuỗi tiếng Việt"`, nên khoá gõ
sai sẽ hiện tiếng Việt cho người dùng tiếng Anh mà **không log, không test đỏ, không ai biết**.
Không phải giả thuyết: lần chạy đầu tiên tìm ra **39 khoá** như vậy — trong đó cả trang doanh
thu/BI (33 khoá `bi*`) chưa bao giờ dịch được dù nhìn code thì tưởng đã dịch.

**Cơ chế bánh cóc (ratchet):** kho có sẵn 85 chuỗi cứng và 706 fallback trùng lặp từ trước. Bắt sửa
hết mới cho build thì không ai chạy nổi; chỉ cảnh báo suông thì lẫn vào đống cũ và vô nghĩa. Nợ cũ
đóng băng trong `i18n-baseline.json`, CI **chỉ chặn cái phát sinh thêm** — con số chỉ giảm được,
không tăng lại. Đây là mẫu hình đáng nói ra: **cách đưa một tiêu chuẩn mới vào một kho đã có nợ.**

**Ngôn ngữ mặc định của mail là tiếng Anh, không phải tiếng Việt:** vì đó là thứ Spring rơi về khi
người nhận chọn ngôn ngữ chưa dịch (`ja`/`zh`) — tiếng Anh đọc được với nhiều người nhất trong
tình huống đó. Người dùng Việt không bao giờ chạm tới file mặc định.

**Mail đọc ngôn ngữ từ CSDL chứ không từ header `Accept-Language`:** mail nhắc khởi hành do bộ lập
lịch gửi lúc nửa đêm, mail báo hoãn chuyến do quản trị viên bấm từ máy khác — **không có request
nào** để mà đọc header. Nơi duy nhất trả lời được "người này đọc tiếng gì" là bản ghi tài khoản.

---

## 14. Chất lượng & vận hành

| Công cụ | Thay cho | Vì sao |
|---|---|---|
| **GitHub Actions** | Chạy test tay trước khi merge | Miễn phí cho repo công khai; nằm cùng chỗ với code nên không phải nuôi hạ tầng CI |
| **SonarQube** (self-host qua Docker) | Chỉ ESLint | Bắt được lớp lỗi khác: code smell, độ phức tạp vòng lặp, lỗ hổng, trùng lặp. Self-host vì SonarCloud yêu cầu repo công khai + tài khoản tổ chức. |
| **Prometheus + Grafana** | `System.out.println` | Chuỗi chuẩn công nghiệp; Spring Boot Actuator phơi metric sẵn qua Micrometer nên chi phí tích hợp gần bằng không. Metric tự định nghĩa (`rag_retrievals_total`, `llm_requests_total`, `llm_fallback_total`, `llm_latency_seconds`) khiến **hành vi của AI quan sát được** thay vì phải đoán. |
| **Gitleaks** | Nhớ đừng commit secret | Con người sẽ quên; máy thì không |
| **Vitest + Testing Library** | Jest | Dùng chung cấu hình và pipeline của Vite → không phải duy trì hai hệ build |

### Bốn cổng chặn trong CI và mỗi cổng chặn gì

| Cổng | Chặn |
|---|---|
| Gitleaks | Secret lọt vào lịch sử Git |
| **RAG Retrieval Quality Gate** | Thoái lui chất lượng truy hồi (`recall@3 < 0.85` hoặc `MRR < 0.70`) |
| **i18n check** | Dịch sót **mới** phát sinh |
| Frontend unit tests + `docker compose build` | Logic vé/ghế/đếm ngược bị sửa hỏng; Dockerfile mục |

Điểm đáng nhấn khi thuyết trình: **cổng thứ hai và thứ ba là loại kiểm thử ít đồ án nào có** — một
cái đo chất lượng AI, một cái đo tính toàn vẹn bản dịch. Cả hai đều sinh ra từ lỗi có thật đã xảy ra.

---

## 15. Nợ kỹ thuật có chủ đích

Liệt kê ở đây để **chủ động** nói ra, thay vì bị đào ra.

| Nợ | Vì sao chấp nhận | Hướng xử lý |
|---|---|---|
| Access token trong `localStorage` | Đơn giản, và ngưỡng rủi ro chấp nhận được ở giai đoạn staging | HttpOnly cookie + refresh token xoay vòng (đã có trong roadmap) |
| Không dùng TypeScript | Đội chưa quen; chuyển giữa chừng thì phần lớn thời gian sẽ đi vào việc sửa kiểu thay vì làm tính năng | Áp dần theo từng file — `.jsx` và `.tsx` sống chung được |
| Chỉ chạy **1 instance** | Toàn bộ cơ chế giữ ghế và broker STOMP trong bộ nhớ dựa trên giả định này | Cần STOMP relay ngoài + kho giữ ghế dùng chung trước khi scale ngang |
| `ddl-auto=update` thay vì công cụ migration | Lược đồ đổi liên tục suốt quá trình làm; và phải chạy trên hai hệ CSDL | Chuyển sang Flyway/Liquibase trước khi có dữ liệu thật (`backend/migrations/` đã là bước đầu) |
| `ja`/`zh` mới dịch một phần | Hoãn **có chủ đích**: ưu tiên tiếng Anh trước; đã có chuỗi dự phòng vi → en → ngôn ngữ đang chọn nên không bao giờ hiện `undefined` | Dịch tiếp khi tiếng Anh đã phủ đủ |
| Script i18n chỉ bắt được tiếng Việt **có dấu** | Chuỗi không dấu lọt lưới; bắt hết cần parser phân tích phạm vi biến | Chấp nhận; đã ghi rõ trong `DA_NGON_NGU.md` |
| Chưa đo Faithfulness tự động | Cần LLM-as-a-judge — tốn tiền, kết quả trôi giữa các lần chạy | Đã đo groundedness ở nơi rủi ro đếm được (AI BI) |
| Render free tier ngủ sau 15 phút | Đánh đổi để hạ tầng bằng 0 đồng | Đã có quy trình giữ thức khi demo; bản EC2 làm phương án dự phòng |
| VNPay ở chế độ **Sandbox** | Không thể có tài khoản merchant thật cho đồ án | Luồng và chữ ký giống hệt bản thật; đổi khoá là chạy được production |

---

## 16. Bảng tra nhanh — dùng khi bị hỏi bất ngờ

| Câu hỏi | Câu trả lời một dòng |
|---|---|
| Có phải microservices không? | **Không** — monolith phân tầng, một service, một CSDL; frontend và CSDL tách riêng nên triển khai thành 3 thành phần, nhưng đó là client–server ba tầng |
| Sao không microservices? | Một đội, một CSDL, không có module nào cần scale riêng — trả toàn bộ chi phí phức tạp mà lợi ích bằng không |
| Sao không Kafka? | Bên gửi và bên nhận nằm chung một tiến trình; nhu cầu bất đồng bộ đã giải bằng Spring events + `@Scheduled` |
| Sao không Kubernetes? | Cố tình chạy 1 instance; K8s giải bài toán điều phối nhiều bản sao mà dự án chưa có |
| Sao không Redis? | 1 instance → cache trong tiến trình (Caffeine) là đủ và đúng; chống trùng đã dựa vào unique index của CSDL |
| Sao dùng cả SQL Server lẫn PostgreSQL? | SQL Server để chạy local bằng Docker không cần tài khoản đám mây; Neon Postgres vì đó là CSDL miễn phí dùng thật được trên cloud |
| Sao backend không serverless? | **WebSocket không sống được trên serverless function** — mà giữ ghế thời gian thực là tính năng lõi |
| Sao không Next.js? | Phần lớn màn hình nằm sau đăng nhập nên SEO vô nghĩa; SPA tĩnh phát trên CDN Vercel miễn phí, không phải nuôi runtime Node |
| Sao tự viết circuit breaker? | Phần khó là **router đa nhà cung cấp** và **trần theo token** — Resilience4j không giải cả hai |
| Sao RAG chứ không fine-tune? | Sửa chính sách = sửa một dòng trong CSDL, hiệu lực ngay; fine-tune phải huấn luyện lại và dạy văn phong chứ không dạy sự kiện |
| Sao hybrid chứ không chỉ vector? | Vector kém với mã và số hiệu; BM25 mù trước từ đồng nghĩa — miền dự án có cả hai loại câu hỏi |
| Sao không vector DB? | 56 chunk ≈ 168 KB; quét toàn bộ vừa nhanh hơn vừa **chính xác hơn** chỉ mục xấp xỉ ở quy mô này |
| Chống bịa số ở AI BI bằng gì? | Groundedness = 1.00, đo tất định bằng cách bóc số và đối chiếu tập hợp; giao diện và AI đọc chung một nguồn số liệu |
| Chống đặt trùng ghế bằng gì? | Khóa bi quan + **unique index của CSDL** làm chốt chặn cuối — CSDL là bên duy nhất thấy toàn bộ |
| Chỗ nào còn yếu nhất? | Token trong `localStorage` (XSS), và giả định 1 instance — cả hai đã có hướng xử lý ghi trong roadmap |

---

## Phụ lục — tài liệu chi tiết theo chủ đề

| Chủ đề | Tài liệu |
|---|---|
| Tổng quan hệ thống, môi trường triển khai | `AI_ONBOARDING.md`, `README.md` |
| Chatbot RAG, LLM gateway, circuit breaker | `CHATBOT_AI.md` |
| AI Business Intelligence | `AI_BI.md` |
| Giữ ghế thời gian thực & vá lỗ hổng WebSocket | `REALTIME_WEBSOCKET.md` |
| Thanh toán & hoàn tiền VNPay | `THANH_TOAN_VNPAY.md` |
| Đa ngôn ngữ | `DA_NGON_NGU.md` |
| Đặc tả yêu cầu & thiết kế CSDL | `SRS_FSD_SPECIFICATION.md` |
| Kịch bản demo & xử lý sự cố khi demo | `DEMO_SCRIPT.md`, `DEMO_CHEATSHEET.md` |
