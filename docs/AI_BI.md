# 📊 AI Business Intelligence — Cách hoạt động

Tài liệu ngắn giải thích phần **Thống kê doanh thu + Báo cáo AI** (`/admin/revenue`).
Phần chatbot RAG là chuyện khác, xem [CHATBOT_AI.md](./CHATBOT_AI.md).

---

## 1. Ba bước, và AI chỉ tham gia bước cuối

```
[1] SQL gom số          [2] Dựng bản tóm tắt        [3] LLM viết lời
    ─────────────           ──────────────────          ────────────
    BookingRepository  →   AnalyticsSummaryResponse  →  "Doanh thu tháng 8
    (5 truy vấn,            (bản ghi có cấu trúc:        tăng 42.9%, chủ yếu
    cùng 1 khoảng           tổng, tăng trưởng,           nhờ tuyến HAN-SGN…"
    thời gian)              cơ cấu, top tuyến)
                                   │
                                   ├──→ Giao diện vẽ biểu đồ
                                   └──→ Prompt gửi cho LLM
```

**Điểm quan trọng nhất:** LLM **không** truy cập cơ sở dữ liệu, **không** tự tính con số nào.
Mọi số liệu do SQL tính ra trước, rồi mới đưa cho LLM dưới dạng văn bản. Việc của LLM chỉ là
*diễn giải thành lời*: nhận định, chỉ ra điểm sáng, đề xuất hành động.

Nên câu bạn hỏi — *"đọc hết số liệu rồi tự phân tích theo mẫu có sẵn trong code?"* — là **đúng**,
với một điều chỉnh: nó không "đọc" dữ liệu thô mà nhận một bản tóm tắt đã tính sẵn. Mẫu hướng dẫn
nằm ở `AnalyticsService.systemInstruction()`, và có một câu ràng buộc quan trọng:

> *"TUYỆT ĐỐI chỉ dùng con số có trong dữ liệu được cung cấp, không tự suy ra số liệu mới.
> Nếu dữ liệu quá ít để kết luận, hãy nói thẳng là chưa đủ dữ liệu thay vì suy đoán."*

Khác hẳn chatbot: chatbot có **function calling** (tự gọi hàm truy vấn DB) và **RAG** (tự tìm
tri thức). AI BI thì không có cả hai — luồng một chiều, đơn giản hơn nhiều và cũng khó sai hơn.

---

## 2. Kỳ báo cáo

Chọn **Tháng / Quý / Năm**. `ReportPeriod` quy mọi kỳ về đúng một khoảng nửa mở
`[đầu kỳ, đầu kỳ kế tiếp)`, và **cả 5 truy vấn đều dùng chung khoảng đó**.

> ⚠️ Đây là chỗ bản cũ sai: chỉ mỗi biểu đồ doanh thu theo tháng có lọc thời gian, còn top tuyến,
> cơ cấu phương tiện, top nhà cung cấp và tổng số booking đều lấy **all-time**. Báo cáo mở đầu
> bằng "BÁO CÁO (Tháng 8/2026)" nhưng thân bài là số liệu từ ngày đầu hệ thống → AI kết luận sai
> mà nhìn vẫn rất thuyết phục.

Mỗi kỳ đều so với **kỳ liền trước**. Kỳ trước bằng 0 thì để trống chỉ số tăng trưởng (hiện `—`)
chứ không quy ra vô cực.

### Kỳ trống thì sao?

Tự chuyển về **kỳ gần nhất có dữ liệu** và nói thẳng trên màn hình:

> *Tháng 8/2026 chưa có giao dịch nào. Đang hiển thị số liệu của Tháng 4/2026 — kỳ gần nhất có dữ liệu.*

Dòng cảnh báo này cũng được nhét vào prompt, nên AI cũng biết mình đang đọc kỳ nào.
Nhờ vậy demo không bao giờ trắng màn, mà cũng không gán số liệu kỳ này thành kỳ khác.

Không có dữ liệu → **không gọi LLM**, trả luôn câu thông báo. Tiết kiệm trần ngân sách token.

---

## 3. Ai xem được gì

| Vai trò | `scope` | Phạm vi |
| --- | --- | --- |
| Admin | `SYSTEM` | Toàn bộ nhà cung cấp |
| Đối tác | `PROVIDER` | Chỉ những thương hiệu có `nha_cung_cap.owner_user_id` = mình |

Đối tác gọi `scope=SYSTEM` bị trả **403**, không âm thầm hạ xuống phạm vi hẹp — hạ ngầm sẽ khiến
họ tưởng con số đang xem là của toàn sàn.

Hệ thống chỉ dựng **một** tài khoản đối tác để demo cho dễ nhớ. Danh sách thương hiệu tài khoản
đó vận hành khai trong `app.provider.owned-providers` (mô hình đại lý tổng — một đối tác quản lý
nhiều thương hiệu). Để đúng một tên là quay về mô hình 1 đối tác = 1 hãng, không phải sửa mã.

---

## 4. Hai con số doanh thu, lệch nhau là đúng

| Chỉ số | Nguồn | Ý nghĩa |
| --- | --- | --- |
| **Doanh thu thực thu** | `SUM(Booking.totalPrice)` | Tiền thật thu về — đã gồm dịch vụ cộng thêm, đã trừ voucher |
| **Doanh thu vé** | `SUM(Ticket.price)` | Phần duy nhất quy được về từng hãng và từng tuyến |

Mọi **tỷ trọng** tính trên *doanh thu vé* để cộng lại luôn tròn 100%. Nếu hội đồng hỏi *"sao hai
số này lệch nhau?"* — đó là câu trả lời, không phải lỗi làm tròn.

---

## 5. Đo chất lượng được tới đâu?

Câu hỏi hay gặp: *"AI BI có đo được như chatbot RAG (recall@3, MRR) không?"*

**Không, và không phải vì làm thiếu.** Mấy chỉ số đó đo bước **truy hồi** — trong 57 câu hỏi vàng,
hệ thống có lôi đúng chunk tri thức lên top-3 không. AI BI **không có bước truy hồi**: nguồn dữ
liệu là SQL, mà SQL thì đúng theo định nghĩa, không có chuyện "lấy nhầm dòng vào top-3".

Thay vào đó, cái đo được chia làm ba tầng:

| Tầng | Đo bằng gì | Trạng thái |
| --- | --- | --- |
| **Số liệu đúng không** | 12 test trong `AnalyticsServiceTest` — kỳ, tăng trưởng, phạm vi đối tác, fallback, biểu đồ xu hướng | ✅ Đã có, tất định 100% |
| **Prompt có đúng số không** | 1 test bắt lấy prompt gửi cho LLM, đối chiếu từng con số với bản tóm tắt | ✅ Đã có |
| **Lời văn AI có bịa số không** | *Groundedness*: bóc mọi con số trong output của LLM, đếm tỷ lệ số đó có mặt trong bản tóm tắt đầu vào | ✅ Đã có — `AiBiGroundednessTest`, đo được **0.951** |

Chỉ số **groundedness** là thứ tương đương recall@3 của bên RAG:

```
groundedness = (số con số trong câu trả lời AI có mặt trong bản tóm tắt) / (tổng số con số trong câu trả lời)
mục tiêu: 1.00 — mọi con số AI nói ra đều truy ngược được về SQL
```

Đã hiện thực hoá trong `AiBiGroundednessTest`, theo đúng khuôn của bộ đo RAG: mặc định chạy
offline trong CI, còn phần gọi LLM thật là một job riêng chạy tay.

```bash
# offline — khoá lại chính bộ đo, không cần mạng
./mvnw test -Dtest=AiBiGroundednessTest

# live — gọi model thật rồi chấm câu trả lời thật
BI_EVAL_LIVE=1 GEMINI_API_KEY=... ./mvnw test -Dtest=AiBiGroundednessTest
```

**Vì sao groundedness rẻ hơn faithfulness rất nhiều.** Bên chatbot RAG, câu hỏi *"có bịa
không"* phải chấm trên các mệnh đề ngôn ngữ tự nhiên — cần LLM-as-a-judge hoặc chấm tay. Bên
AI BI thì rủi ro tụ vào đúng một thứ **đếm được**: con số. Nên phép đo này **tất định 100%** —
bóc số bằng biểu thức chính quy rồi kiểm tra thuộc tập hợp, không có model nào chấm điểm model
nào.

Chỗ khó duy nhất là chuẩn hoá: dấu chấm mang hai nghĩa (`1.500.000` là phân cách nghìn,
`50.0` là thập phân). Phân biệt bằng hình dạng rồi bỏ số 0 thừa ở đuôi, nếu không thì AI viết
`50%` trong khi báo cáo ghi `+50.0%` sẽ bị chấm oan là bịa.

#### Kết quả đo ngày 01/09/2026

| | |
|---|---|
| Số con số trong câu trả lời của AI | 41 |
| Truy ngược được về bản tóm tắt SQL | 39 |
| **Groundedness** | **0.951** |

Hai con số không truy ngược được là `100` và `4`:

- `100` đến từ câu *"chưa đủ để phủ kín 100% doanh thu vé"* — một cách nói, không phải một
  thống kê.
- `4` là **số thứ tự mục** `## 4. 3 hành động cụ thể`, do chính khung báo cáo trong system
  prompt sinh ra.

**Số lời văn bịa thật sự: 0.** Đây đúng là lý do bộ đo in ra danh sách số không truy được
thay vì chỉ in một con số tổng — 0.951 nhìn như có 2 lỗi, đọc danh sách mới biết là 0. Cùng
một bài học với *"luôn đọc danh sách câu trượt"* ở bộ đo RAG.

> **Giới hạn cần nói thẳng:** groundedness chỉ soi **con số**. Nó không bắt được lỗi *diễn
> giải* — ví dụ AI trích đúng số nhưng kết luận sai chiều tăng giảm, hoặc gán đúng số cho sai
> nhà cung cấp. Muốn bắt loại đó vẫn phải đọc tay hoặc dùng LLM-as-a-judge.

Ngoài ra phần vận hành đã có sẵn metric Prometheus dùng chung với chatbot:
`llm_requests_total`, `llm_fallback_total`, `llm_latency_seconds`.

---

## 6. Hỏng thì soi đâu

| Triệu chứng | Chỗ cần xem |
| --- | --- |
| Số trên biểu đồ sai | `AnalyticsService.getSummary()` và các truy vấn `*InPeriod` trong `BookingRepository` |
| AI nói số khác biểu đồ | `AnalyticsService.buildReport()` — cả hai phải cùng đọc một `AnalyticsSummaryResponse` |
| Đối tác xem được dữ liệu hãng khác | `Provider.ownerUser` + `AnalyticsService.resolveProviderIds()` |
| Kỳ hiển thị lệch | `ReportPeriod` (`startOf` / `endExclusiveOf`) |
| Bấm nút AI không ra gì | `LlmBudgetGuard` (hết trần token) hoặc `LlmRouter` (cả hai nhà cung cấp cùng lỗi) |
| Màu biểu đồ khó đọc | Biến `--chart-*`, `--tooltip-*` trong `my-react-app/src/index.css`, khai riêng cho nền sáng và nền tối |

**API:**
`GET /api/analytics/summary?scope=&period=&anchor=` · `GET /api/analytics/insights?...` · `GET /api/analytics/scope`
