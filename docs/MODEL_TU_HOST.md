# 🖥️ Model tự host — Ollama, quantize, và vì sao production vẫn gọi API

Tài liệu này trả lời một chùm câu hỏi hay đi cùng nhau:

- Ollama là cái gì, và dùng nó có phải chỉ vì *tiện* hơn tự tìm model trên GitHub không?
- Đang dùng model nào, vì sao cái này mà không phải cái kia?
- Không bị giới hạn phần cứng thì chọn model xịn hơn có tốt hơn không?
- Muốn deploy lên production thì cần "phần mềm để đựng model" nào?

Phần chatbot RAG xem [CHATBOT_AI.md](./CHATBOT_AI.md). Các lựa chọn công nghệ khác xem
[LUA_CHON_CONG_NGHE.md](./LUA_CHON_CONG_NGHE.md). Số đo trong tài liệu này lấy từ
`experiments.md` của repo `vi-rag-eval` — phòng thí nghiệm bằng Python, nơi mọi thay đổi được
đo trước khi port sang VigoTrip.

---

## 1. Câu trả lời ngắn, trước khi đi vào chi tiết

| Câu hỏi | Trả lời ngắn |
|---|---|
| Ollama tiện hơn thôi à? | Không. Cái nó cho không phải "tải model dễ hơn" mà là **một HTTP server nói giọng OpenAI** — nhờ đó code Java không cần biết gì về model. |
| Đang dùng model nào? | `qwen3.5:9b` bản Q4_K_M để sinh câu trả lời, `bge-m3` để nhúng vector. Cả hai chạy trên RTX 4060 8 GB. |
| Model xịn hơn thì sao? | Với việc "đọc 4 đoạn tài liệu rồi tóm lại", chất lượng **bão hoà rất nhanh**. Số đo cho thấy 9,7 tỷ tham số đã gần chạm trần của bài toán này. |
| Deploy thế nào? | Production **vẫn gọi Gemini/Groq qua API**. Model local là đường lui lúc phát triển và khi hết hạn mức, không phải thứ để đẩy lên Render. |

---

## 2. Ollama là gì — và "tự tìm model trên GitHub" thật ra là làm gì

Chỗ dễ nhầm nhất: **trọng số model không nằm trên GitHub.** GitHub để chứa code; trọng số là
file nhị phân hàng GB, nằm ở Hugging Face. Nên "tìm một open source model trên GitHub" thực tế
là tải trọng số từ Hugging Face rồi tự dựng phần chạy nó.

Tự dựng nghĩa là gì:

```
Trọng số (.safetensors, ~19 GB cho model 9B chưa nén)
        |
        +- Tokenizer        — cắt chữ thành token, đúng bảng của chính model đó
        +- Nạp vào GPU      — cần PyTorch + CUDA đúng phiên bản
        +- KV cache         — nhớ phần đã sinh, không thì mỗi token tính lại từ đầu
        +- Vòng sinh token  — sampling, temperature, top_p, điểm dừng
        +- Gộp lô request   — nhiều người hỏi cùng lúc
        +- Tầng HTTP        — và tự chọn một giao thức nào đó
```

Ollama gói trọn cụm đó lại. Nhưng cái đáng giá nhất **không phải** tiết kiệm công tải model —
mà là dòng cuối cùng: nó phục vụ ở `http://127.0.0.1:11434/v1` theo **đúng giao thức Chat
Completions của OpenAI**.

Hệ quả trực tiếp với VigoTrip: lớp `OpenAiCompatibleProvider` viết cho Gemini và Groq **dùng
lại được nguyên vẹn** cho model chạy trên máy mình. Không có lớp `OllamaProvider` nào cả — chỉ
thêm một khối trong `application.yml`.

Đổi một nhà cung cấp LLM thành việc sửa cấu hình, không phải sửa code — đó mới là giá trị thật.

### Còn cách nào khác không

| Công cụ | Điểm mạnh | Vì sao không chọn cho dự án này |
|---|---|---|
| **Ollama** | Một lệnh cài, tự nạp và giải phóng model khỏi VRAM, sẵn API giọng OpenAI, chạy Windows | — (đang dùng) |
| **llama.cpp** | Nhân thật sự chạy model; Ollama xây trên nó | Phải tự biên dịch, tự quản model, tự chạy server. Ollama = llama.cpp + phần quản lý |
| **vLLM** | Thông lượng cao nhất khi phục vụ nhiều người cùng lúc | Nhắm GPU lớn ở trung tâm dữ liệu, thực tế là Linux. Quá nặng cho một máy một người dùng |
| **LM Studio** | Có giao diện, hợp để thử tay | Hướng desktop, khó ghép vào script đo tự động |

Nói gọn: Ollama không phải "cách dễ", nó là **cách đúng cỡ** cho một máy, một người, cần một
endpoint ổn định để đo.

---

## 3. Quantization — vì sao 9,7 tỷ tham số vừa được 8 GB VRAM

Mỗi tham số là một con số. Bản gốc thường lưu 16 bit = 2 byte:

```
9,7 tỷ tham số x 2 byte  ~ 19 GB   -> KHÔNG vừa RTX 4060 8 GB
9,7 tỷ tham số x ~4 bit  ~ 5,5 GB  -> vừa, còn chỗ cho ngữ cảnh
```

Quantization là lưu mỗi tham số bằng ít bit hơn. Ký hiệu `Q4_K_M` nghĩa là khoảng 4 bit, theo
sơ đồ `K` (khối tham số quan trọng được giữ ở độ chính xác cao hơn), cỡ `M` (vừa).

Cái giá là mất một ít chất lượng — nhỏ ở Q4–Q5 và lớn dần khi xuống thấp hơn:

| Mức | Cỡ model 9B | Dùng khi |
|---|---|---|
| F16 (gốc) | ~19 GB | Có GPU trung tâm dữ liệu |
| Q8 | ~10 GB | Muốn sát bản gốc nhất có thể |
| Q5_K_M | ~6,8 GB | Còn dư VRAM |
| **Q4_K_M** | **~5,5 GB** | **Điểm cân bằng phổ biến nhất — đang dùng** |
| Q3 trở xuống | ~4 GB | Chỉ khi hết cách; suy giảm bắt đầu thấy rõ |

Một điểm hay quên: **trọng số không phải tất cả.** Ngữ cảnh càng dài thì KV cache càng lớn, nên
phải chừa khoảng 1–2 GB. `qwen3.5:9b` khai ngữ cảnh tối đa 262.144 token, nhưng Ollama thực tế
cấp 4.096 — đủ cho 4 đoạn tài liệu RAG cộng câu hỏi, và giữ VRAM trong tầm.

Kiểm chứng bằng lệnh, đây là số thật lúc đang chạy:

```
NAME          SIZE      PROCESSOR    CONTEXT
qwen3.5:9b    5.5 GB    100% GPU     4096
```

`100% GPU` là dòng đáng nhìn nhất: model nằm trọn trong VRAM. Tràn sang RAM thì Ollama ghi kiểu
`60%/40% CPU/GPU` và tốc độ tụt nhiều lần.

---

## 4. Hai model đang dùng

### `qwen3.5:9b` — sinh câu trả lời

| | |
|---|---|
| Tham số | 9,7 tỷ |
| Lượng tử hoá | Q4_K_M — 6,6 GB trên đĩa, 5,5 GB trong VRAM |
| Giấy phép | Apache 2.0 — dùng thương mại được, không ràng buộc |
| Khả năng | sinh văn bản, **gọi tool**, thị giác, **suy nghĩ** |

**Vì sao là nó:**

1. **Tiếng Việt.** Đây là ràng buộc số một và nó loại gần hết các ứng viên. Phần lớn model mở
   cỡ nhỏ được huấn luyện chủ yếu bằng tiếng Anh. Các model chỉ tiếng Anh như `nomic-embed-text`
   hay `all-MiniLM` bị loại thẳng từ đầu.
2. **Gọi được tool.** Tầng `CHAT` của VigoTrip không chỉ tóm tài liệu, nó còn phải gọi
   `search_trips`, `get_user_bookings`… Model không có khả năng `tools` thì không thay được
   Gemini dù viết hay đến mấy.
3. **Vừa 8 GB.** Model 12–14B bản Q4 tràn sang RAM trên RTX 4060 và chậm hẳn.
4. **Giấy phép sạch.** Apache 2.0 không kèm điều kiện về quy mô người dùng.

**Cái bẫy phải biết:** model này mặc định **bật suy nghĩ**. Gọi thẳng như với Gemini thì nó tiêu
hết 800 token ngân sách cho phần `reasoning` và trả `content` **rỗng**. Cách tắt: chỉ
`reasoning_effort: "none"` có tác dụng ở đường `/v1` — `think: false` và `chat_template_kwargs`
đều bị Ollama bỏ qua. Xem mục 7.

### `bge-m3` — nhúng vector, và nó đã **trượt**

| | |
|---|---|
| Tham số | 567 triệu |
| Số chiều | 1024 (cố định) |
| Giấy phép | MIT |
| VRAM | 664 MB · nhúng một câu p50 45 ms |

Đem so với `gemini-embedding-001` trên cùng bộ 132 câu vàng, kết quả: **không đạt tiêu chí,
không được dùng.** Lý do quyết định nằm ở một cột trong bảng:

| Bộ câu hỏi | Gemini | bge-m3 |
|---|---|---|
| Có dấu | 133/153 | 133/153 |
| **Không dấu** | ổn | **0/42** |

Khách VigoTrip gõ không dấu rất nhiều (19/104 câu người thật gõ). Tokenizer của `bge-m3` thấy
"huy ve" và "hủy vé" là hai thứ khác hẳn nhau. Hạ ngưỡng cosine về 0 cũng không cứu được — tức
là model thật sự không hiểu tiếng Việt không dấu, chứ không phải chọn ngưỡng sai.

**Đây là kết quả đáng giá nhất của cả hai thí nghiệm**, dù nó là kết quả "thua": nó cho thấy
*miễn phí và nhanh* không đủ để thay thế, và cho thấy vì sao phải đo trước khi đổi.

---

## 5. Số đo — model local kém Gemini bao nhiêu

Cùng 30 câu, **cùng các đoạn tài liệu đã truy hồi sẵn**, chỉ đổi model sinh câu trả lời:

| | Gemini Flash-Lite | qwen3.5:9b Q4 |
|---|---|---|
| Bịa (người chấm tay) | 1/30 | **2/30** |
| Từ chối thừa | 0 | 0 |
| Token/giây | — | 30,7 |
| Độ trễ p50 / p95 | 1125 / 1663 ms | 2150 / 3367 ms |
| VRAM | — | 5,5 GB, 100% GPU |

Bốn tiêu chí chốt **trước** khi chạy đều đạt. Chậm hơn Gemini khoảng hai lần nhưng vẫn dưới
ngưỡng 10 giây của tầng `CHAT`.

Điều thú vị nhất nằm ở **kiểu lỗi**, không phải số lượng. Hai câu bịa của qwen đều không phải
bịa từ hư không — cả hai đều là **nói mạnh hơn tài liệu**:

- Tài liệu: *"khách **nên** đăng ký tài khoản… không có tài khoản thì tra cứu khó hơn"*
  → Bot: *"muốn nhận mã QR hay hoàn tiền thì **bắt buộc** phải đăng ký"*
- Tài liệu: *dưới 2 tuổi miễn phí; 2–12 tuổi tính 75% và có ghế riêng*
  → Bot: *"trẻ **2 đến dưới 5 tuổi** được miễn vé, không có ghế riêng"* — trộn hai đoạn thành
  một chính sách không tồn tại

Cùng câu hỏi đó Gemini bám sát tài liệu. Đây là kiểu lỗi đáng sợ nhất trong RAG: **nghe rất trôi
chảy, sai ở con số** — và cũng là kiểu lỗi mà prompt có thể chữa được, rẻ hơn nhiều so với đổi
sang model to hơn.

---

## 6. Nếu không bị giới hạn phần cứng thì sao

Câu trả lời thẳng: **tốt hơn, nhưng ít hơn bạn nghĩ — với đúng bài toán này.**

| VRAM | Chạy được | Ai có |
|---|---|---|
| 8 GB | 7–9B Q4 | RTX 4060 — máy hiện tại |
| 24 GB | 27–32B Q4 | RTX 3090 / 4090 |
| 80 GB | 70B Q4, hoặc bản gốc F16 của model vừa | A100 / H100 thuê theo giờ |

Lý do chất lượng bão hoà nhanh: việc ở tầng `CHAT` là **đọc 4 đoạn văn bản ngắn rồi diễn đạt
lại**. Nó không cần kiến thức rộng — kiến thức nằm ở tài liệu, đó là toàn bộ ý nghĩa của RAG.
Model to giúp nhiều khi phải *nhớ* nhiều; ở đây nó không phải nhớ gì cả.

Số đo nói đúng điều đó: khoảng cách giữa 9,7 tỷ tham số và Gemini là **một câu trên ba mươi**.
Model 70B có thể lấy nốt câu đó, nhưng:

- thuê GPU 80 GB tốn khoảng **1–2 đô/giờ**, tức 700–1400 đô/tháng nếu chạy liên tục;
- hai câu sai đó là kiểu "nói mạnh hơn tài liệu" — thêm một ràng buộc vào prompt có thể sửa
  được, tốn 0 đồng;
- p95 sẽ tăng, mà tầng `CHAT` cần nhanh.

**Chỗ model to thật sự thắng** — và cũng là chỗ chưa đo:

- **Ngữ cảnh dài.** Tầng `ANALYSIS` nhét cả báo cáo doanh thu vào prompt. Kết luận ở trên
  **không** suy ra được cho `ANALYSIS`.
- **Suy luận nhiều bước.** Chuỗi kiểu "đọc đơn hàng xong mới biết phải tra thời tiết ở đâu"
  (`llm.tools.max-rounds = 3`).
- **Gọi tool khi có nhiều tool gần giống nhau** — đang đo bằng `ToolSelectionQualityTest`.

Nguyên tắc rút ra: **chọn model theo bài toán, không theo bảng xếp hạng.** Cách duy nhất biết
model nào đủ là chạy nó trên chính dữ liệu của mình rồi đếm.

---

## 7. Cắm model local vào VigoTrip

### Chuyện tưởng dễ mà không dễ

Kế hoạch ban đầu ghi: *"VigoTrip dùng `OpenAiCompatibleProvider`, nên cắm model local vào gần
như chỉ là sửa `application.yml`."* **Đúng với model thường, sai với model biết suy nghĩ.**

`OpenAiCompatibleProvider` dựng thân request cứng — chỉ `model`, `messages`, `max_tokens`,
`temperature`, `tools`. Không có đường đẩy `reasoning_effort` từ YAML xuống. Cắm thẳng vào thì
VigoTrip nhận `content` rỗng.

Lối vòng không đụng code — bake sẵn vào model bằng `ollama create` với `PARAMETER think false` —
cũng không đi được: Ollama trả `unknown parameter 'think'`.

### Cách đã chọn: `extra-body`

Thêm một trường vào `LlmProperties.Provider`, đổ vào thân request **trước** các trường cố định:

```java
Map<String, Object> body = new HashMap<>(config.getExtraBody());
body.put("model", config.getModel());
body.put("messages", messages);
// … các trường cố định ghi đè, nên một khoá gõ nhầm trong YAML
//    không thể đổi model hay nuốt mất messages
```

Nhờ vậy cấu hình trở thành:

```yaml
- name: ollama
  base-url: ${OLLAMA_BASE_URL:http://127.0.0.1:11434/v1}
  api-key: ${OLLAMA_API_KEY:}          # trống = bị loại lúc khởi động
  model: "${OLLAMA_CHAT_MODEL:qwen3.5:9b}"
  extra-body:
    reasoning_effort: none              # thiếu dòng này thì content rỗng
```

Ba điểm thiết kế đáng nói:

1. **Đứng cuối chuỗi `chat`**, sau Gemini và Groq — chỉ được dùng khi hai nhà kia hỏng.
2. **`api-key` trống thì bị loại lúc khởi động**, theo đúng cơ chế sẵn có. Không đặt
   `OLLAMA_API_KEY` thì hệ thống chạy y như trước khi có thay đổi này.
3. Ollama không kiểm khoá, nhưng `isConfigured()` loại nhà cung cấp có khoá rỗng — nên đặt giá
   trị bất kỳ khác rỗng, ví dụ `OLLAMA_API_KEY=ollama`.

### Chạy thử trên máy mình

```bash
ollama serve                    # server phải chạy trước
ollama ps                       # xem model nào đang nạp, chiếm bao nhiêu VRAM
```

Model tự rời VRAM sau 5 phút không ai gọi, nên lời gọi đầu sau khi nghỉ luôn lâu hơn — phải nạp
lại 5,5 GB từ ổ vào VRAM.

---

## 8. Deploy production: vì sao không thể "đẩy lên git rồi để Vercel/Render lo"

### Ba sự thật phải nắm

**Trọng số không nằm trong repo.** File 6,6 GB, và không nên nằm trong git. Repo chỉ chứa code
và `application.yml` — tức chỉ chứa *địa chỉ* của model, không chứa model.

**Vercel, Render, Neon đều không có GPU.** Vercel chạy React tĩnh, Render chạy Spring Boot, Neon
giữ Postgres. Không nơi nào chạy được model.

**Và đây mới là lý do sâu nhất: VRAM không chia sẻ được theo request.** Model chiếm 5,5 GB suốt
thời gian nó được nạp, dù không ai chat. Mô hình của Vercel/Render free tier thì ngược lại —
tính theo request, rảnh thì tắt tiến trình. Hai mô hình xung khắc về bản chất. Không có phần mềm
nào gỡ được mâu thuẫn đó.

### "Phần mềm để đựng" — có, nhưng nó không đẻ ra GPU

Có thật: image `ollama/ollama` trên Docker Hub, chạy với `--gpus all` qua NVIDIA Container
Toolkit; trọng số gắn vào bằng **volume** riêng chứ không bake vào image (bake vào thì image
nặng 7 GB, build và push rất chậm). Nhưng container chỉ đóng gói *cách chạy* — vẫn cần một cái
máy có GPU ở dưới.

### Ba đường thật sự

| | Làm gì | Chi phí | Hợp với |
|---|---|---|---|
| **1. Không deploy model local** | Production gọi Gemini/Groq qua API như hiện nay | Free tier | **VigoTrip, hiện tại** |
| **2. Serverless inference** | Together / Fireworks / Groq / OpenRouter host model mở, ta gọi API | Trả theo token | Khi cần model mở thật trên production |
| **3. Thuê GPU riêng** | RunPod / Vast.ai chạy Ollama, backend trỏ `OLLAMA_BASE_URL` sang đó | ~0,2–0,5 đô/giờ, tức **150–350 đô/tháng** nếu 24/7 | Lượng gọi rất lớn, GPU chạy gần kín |

Kinh tế học ở đây ngược trực giác: **tự host đắt hơn gọi API** cho tới khi lượng request đủ lớn
để GPU chạy gần kín. Với quy mô đồ án, Gemini free tier rẻ hơn mọi phương án tự host.

Đường 2 đáng chú ý — đó mới là "model mở chạy trên cloud" theo nghĩa thực dụng: model mở, nhưng
không phải mình quản GPU. Và vì `OpenAiCompatibleProvider` đã có, cắm vào chỉ là thêm một khối
YAML y hệt khối `ollama`. Groq trong cấu hình hiện tại chính là dạng này.

### Vậy giá trị của việc này ở đâu

**Ở con số, không ở cái deploy.** Giờ câu hỏi *"sao không tự host cho rẻ và khỏi lo hạn mức?"* có
câu trả lời bằng số đo trên chính dữ liệu VigoTrip, chứ không phải bằng cảm giác:

> Model 9,7 tỷ tham số bản Q4 chạy trên RTX 4060 bịa 2/30 câu so với 1/30 của Gemini Flash-Lite,
> đạt 30,7 token/giây với p95 3,4 giây. Đủ tốt để làm đường lui khi Gemini hết hạn mức — nhưng
> đưa lên production thì tốn 150–350 đô/tháng tiền GPU để thay thứ đang miễn phí.

Và kèm theo là một kiến trúc đúng: **một image, cấu hình khác nhau theo môi trường.** Máy có GPU
thì bật, không có thì khối đó tự bị loại lúc khởi động.

---

## 9. Bảng tra nhanh

| Hỏi | Đáp |
|---|---|
| Ollama chạy ở đâu | `http://127.0.0.1:11434`, đường tương thích OpenAI là `/v1` |
| Trọng số nằm đâu | Thư mục trỏ bởi biến môi trường `OLLAMA_MODELS`, không nằm trong repo |
| Xem model đang nạp | `ollama ps` — cột `SIZE` là VRAM, `PROCESSOR` phải là `100% GPU` |
| `nvidia-smi` khác gì | Nó nhìn toàn GPU, kể cả Windows và trình duyệt. Đo model thì đọc `ollama ps` |
| Model biến mất sau vài phút | Đúng thiết kế — tự rời VRAM sau 5 phút rảnh |
| `content` trả về rỗng | Model đang bật suy nghĩ. Thêm `extra-body: {reasoning_effort: none}` |
| Bật model local trong VigoTrip | Đặt `OLLAMA_API_KEY` khác rỗng và chạy `ollama serve` |
| Production có dùng model local không | **Không.** Khối `ollama` đứng cuối chuỗi và mặc định bị loại |
