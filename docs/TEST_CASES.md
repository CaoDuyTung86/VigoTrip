# TEST CASES & CHECKLIST — Frontend ↔ Backend

Tài liệu này dành cho tester thực hiện kiểm thử tích hợp giữa frontend và backend (booking, seat lock, payment, QR check-in, realtime).

> Lưu ý trước khi test
> - Yêu cầu từ dev/ops: staging URL, test accounts (user, admin), hướng dẫn VNPay sandbox hoặc mock endpoint, cách reset DB (snapshot/reset script) nếu cần.
> - Nếu không có test data cụ thể (tripId, seatId), hỏi dev cung cấp dữ liệu test.

---

## DANH SÁCH TEST CASES (Critical / High)

### TC-01 — Booking: Happy path (end-to-end)
- Mô tả: Người dùng đăng nhập, tìm chuyến, chọn ghế, thanh toán thành công, nhận vé + QR.
- Tiền đề: User test account, trip có ghế trống.
- Các bước:
  1. Đăng nhập bằng tài khoản test.
  2. Tìm chuyến (từ → đến, ngày).
  3. Mở seat map, chọn ghế (ví dụ seat 12).
  4. Nhấn Lock/Reserve, đi đến trang thanh toán.
  5. Thực hiện thanh toán bằng VNPay sandbox hoặc simulate callback.
  6. Kiểm tra trang Ticket/Bookings để thấy vé và QR.
- Dữ liệu mẫu: user=test01@example.com / pwd=test123; tripId=TRIP123; seatId=12
- Kết quả mong đợi: Thanh toán thành công, vé được tạo, QR code hiển thị cùng chi tiết booking.
- Priority: Critical
- Type: Manual → automate (Playwright)

### TC-02 — Seat lock concurrency (double-book prevention)
- Mô tả: Hai user cùng cố gắng đặt cùng 1 ghế gần như đồng thời.
- Tiền đề: Hai browser/contexts, cùng 1 trip/seat còn trống.
- Các bước:
  1. Mở seat map ở User A và User B (incognito khác nhau).
  2. Cả hai cùng chọn seat 12 và gửi yêu cầu lock/book gần cùng thời điểm.
  3. Quan sát kết quả ở cả hai.
- Kết quả mong đợi: Chỉ một user thành công; user thứ hai nhận lỗi “seat unavailable” hoặc thông báo seat đã bị lock.
- Priority: Critical
- Type: Manual + Automated (k6 hoặc Playwright multi-context)
- Ghi chú: Ghi lại timestamps, request/response bodies, server logs nếu có double-book xảy ra.

### TC-03 — Seat lock broadcast via WebSocket (real-time)
- Mô tả: Khi user A lock ghế, user B nhìn thấy cập nhật trong < 3s.
- Tiền đề: WebSocket/STOMP hoạt động.
- Các bước:
  1. User A lock seat.
  2. Quan sát UI của User B (tự động hoặc nhấn refresh).
- Kết quả mong đợi: User B thấy seat trạng thái “Locked” trong thời gian thực.
- Priority: High
- Type: Manual + Automated (Playwright with two contexts)
- Ghi chú: Nếu không hiển thị, thu WebSocket frames (DevTools) để debug.

### TC-04 — Payment failure rollback
- Mô tả: Thanh toán thất bại → reservation được release, không tạo vé.
- Tiền đề: Có cách simulate payment fail (VNPay sandbox or backend mock).
- Các bước:
  1. Thực hiện booking tới payment.
  2. Simulate payment failure.
  3. Kiểm tra seat map & booking list.
- Kết quả mong đợi: Reservation bị huỷ/ghế released; không có ticket được tạo; user thấy thông báo lỗi rõ ràng.
- Priority: Critical
- Type: Manual + Automated
- Ghi chú: Kiểm tra log server về transaction rollback.

### TC-05 — Refund flow
- Mô tả: Yêu cầu refund sau khi vé phát hành → refund thành công.
- Tiền đề: Ticket có thể refund; sandbox hỗ trợ refund flow/ API mock.
- Các bước:
  1. Đăng nhập admin hoặc user có quyền refund.
  2. Tìm booking đã thanh toán.
  3. Thực hiện refund; kiểm tra trạng thái.
- Kết quả mong đợi: Refund thành công, trạng thái booking cập nhật “Refunded”, log transaction rõ ràng.
- Priority: High
- Type: Manual

### TC-06 — Seat lock timeout (auto-release)
- Mô tả: Ghế lock có timeout (ví dụ 5 phút) nếu không thanh toán → released.
- Tiền đề: Giá trị timeout biết được.
- Các bước:
  1. Lock seat nhưng không thanh toán.
  2. Chờ hết thời gian timeout.
  3. Refresh seat map.
- Kết quả mong đợi: Ghế trở về trạng thái available.
- Priority: High
- Type: Manual (hoặc automated nếu test env cho giảm timeout).

### TC-07 — Session / Token expiry behavior
- Mô tả: Khi token expired, hệ thống xử lý đúng (redirect login hoặc refresh token flow).
- Tiền đề: Có method để expire token nhanh (test account) hoặc short-lived token.
- Các bước:
  1. Đăng nhập, lưu token.
  2. Expire token (simulate).
  3. Thực hiện action (ví dụ book, load seat map).
- Kết quả mong đợi: Ứng dụng yêu cầu login lại hoặc thực hiện refresh token; không có lỗi 500.
- Priority: High
- Type: Manual

### TC-08 — QR check-in validation
- Mô tả: Quét QR trả về thông tin đúng và trạng thái hợp lệ.
- Tiền đề: Có QR scanner page (camera hoặc simulate payload).
- Các bước:
  1. Lấy QR từ ticket.
  2. Trên check-in page, scan/submit QR.
- Kết quả mong đợi: Ticket validated, chi tiết hiện đúng, mark as checked-in.
- Priority: High
- Type: Manual

### TC-09 — Edit / Cancel booking (user flow)
- Mô tả: Người dùng huỷ hoặc chỉnh sửa booking.
- Tiền đề: Booking có quyền hủy theo policy.
- Các bước:
  1. My Bookings -> chọn booking -> Cancel.
  2. Xác nhận.
- Kết quả mong đợi: Booking chuyển trạng thái “Cancelled”, ghế released, nếu có refund thì refund initiated.
- Priority: Medium
- Type: Manual

### TC-10 — Search & filter correctness
- Mô tả: Tìm chuyến theo từ/đến/ngày/filter hoạt động đúng.
- Tiền đề: Có sample trips seeded.
- Các bước:
  1. Nhập filter (company, time-range, price).
  2. Kiểm tra kết quả hiển thị.
- Kết quả mong đợi: Kết quả phù hợp với filter.
- Priority: Medium
- Type: Manual

---

## ADDITIONAL / EDGE TESTS
- TC-11 UI responsiveness (mobile) — kiểm tra seat map và checkout trên mobile viewports.
- TC-12 Offline during payment — mô phỏng mất mạng giữa thanh toán, đảm bảo không tạo trạng thái inconsistent.
- TC-13 Accessibility basics — keyboard navigation, aria labels, run axe-core.
- TC-14 Seat map rendering correctness (large seat counts) — performance check.
- TC-15 Notification / Email sent on booking — verify email content via Mailtrap.
- TC-16 Admin: forcible seat release / override — verify permission controls.
- TC-17 Prevent duplicate booking requests (idempotency) — ensure retries không tạo duplicate.
- TC-18 Search/Chatbot RAG response format — validate format & no PII leakage.
- TC-19 Rate limiting & throttle behavior — server trả 429 cho burst requests.
- TC-20 Data privacy: no sensitive info in client logs — kiểm tra console & network.

---

## TEST RUN CHECKLIST (per test session)
- [ ] Staging URL & environment accessible
- [ ] Test accounts credentials available
- [ ] DB reset / seed performed (if required)
- [ ] VNPay sandbox/mocks available
- [ ] Tools ready: browser devtools, HAR recorder, Playwright (if automating), k6 (for load)
- [ ] Screenshot & video capture ready
- [ ] Logging instructions for dev (how to access server logs)
- [ ] Bug template ready

---

## BUG REPORT TEMPLATE
- Title:
- Environment: staging URL, browser/version, device
- Preconditions: account, tripId, seatId, DB state/snapshot
- Steps to reproduce: (numbered)
- Actual result:
- Expected result:
- Attachments: screenshots, HAR, console logs, WebSocket frames, Playwright trace/video
- Timestamp (UTC):
- Severity: Critical/High/Medium/Low
- Notes:

---

## HOW TO COLLECT ARTIFACTS
- Browser console: DevTools → Console → save logs
- Network HAR: DevTools → Network → Save all as HAR
- Playwright: enable trace/video: npx playwright test --trace on
- WebSocket frames: DevTools → Network → WS → copy frames

---

## QUICK GUIDE: chạy Playwright local (minimal)
- Prereqs: Node 16+/18+, staging URL từ dev
- Commands:
  1. cd frontend
  2. npm ci
  3. npx playwright install --with-deps
  4. export BASE_URL="https://staging.example"  (PowerShell: $env:BASE_URL="https://staging.example")
  5. npx playwright test

---

Nếu muốn, mình sẽ commit file này vào repo trên branch `qa/add-test-cases` và push — sau đó bạn có thể tạo PR hoặc nhờ maintainer review. Viết "OK" để mình tạo branch và push file này.