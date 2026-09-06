/* =============================================================================
 * Chốt chặn chống trùng giao dịch ở tầng cơ sở dữ liệu
 * -----------------------------------------------------------------------------
 * Chạy TAY, một lần, trên TỪNG môi trường. Dự án chạy hai loại DB khác nhau —
 * PostgreSQL (Neon) và SQL Server — nên file này có hai phần lệnh riêng. Chạy
 * đúng phần của môi trường đang thao tác; hai phần KHÔNG thay thế nhau được.
 *
 * PHẠM VI: file này chỉ tạo index chống trùng. Bảng nhật ký giao dịch
 * (nhat_ky_thanh_toan) KHÔNG cần lệnh nào ở đây — Hibernate ddl-auto=update tự
 * tạo nó lúc ứng dụng khởi động.
 *
 * VÌ SAO CẦN: chống xử lý trùng callback hiện nằm hoàn toàn ở tầng ứng dụng —
 * PaymentService khóa dòng đơn rồi kiểm tra vnp_TxnRef đã có kết quả chưa. Nó chạy
 * đúng, nhưng nó chỉ đúng CHỪNG NÀO code còn viết đúng. Index này là lớp cuối cùng,
 * không phụ thuộc vào điều đó: nó chặn cả khi chạy nhiều instance, khi ai đó sửa dữ
 * liệu bằng tay, hay khi một thay đổi sau này vô tình bỏ mất phép kiểm tra kia.
 * Tiền đã thu nhầm thì không có lần thứ hai để sửa.
 *
 * VÌ SAO "WHERE transaction_ref IS NOT NULL": SQL Server coi các giá trị NULL là
 * TRÙNG NHAU trong một ràng buộc UNIQUE, nên một ràng buộc UNIQUE thường sẽ chỉ cho
 * phép ĐÚNG MỘT dòng có transaction_ref rỗng trong cả bảng. Mà cột này có thể rỗng
 * thật: một callback chữ ký hợp lệ nhưng thiếu vnp_TxnRef vẫn được ghi lại. Không có
 * mệnh đề WHERE thì dòng thứ hai như vậy làm hỏng nguyên một luồng thanh toán.
 * PostgreSQL coi các NULL là KHÁC nhau nên ở đó mệnh đề này không bắt buộc — vẫn giữ
 * để hai môi trường có cùng một hình dạng index và cùng một tên trong thông báo lỗi.
 *
 * TÊN INDEX LÀ MỘT PHẦN CỦA CODE: PaymentService.isDuplicateTransactionRef nhận ra
 * lỗi này bằng cách tìm đúng chuỗi 'ux_thanh_toan_transaction_ref' trong thông báo
 * lỗi của JDBC. Đổi tên ở đây mà quên đổi trong code thì hệ thống mất khả năng trả
 * lời "đơn này đã xử lý rồi" và sẽ trả lỗi 500 cho cổng.
 * ============================================================================= */


/* =============================================================================
 * BƯỚC 1 — Tìm dữ liệu trùng TRƯỚC KHI tạo index. (chạy trên MỌI loại DB)
 *
 * Lệnh CREATE ở bước 2 sẽ THẤT BẠI nếu bảng đang có sẵn hai dòng cùng mã giao dịch.
 * Trả về rỗng là đường thông, sang thẳng bước 2. Có dòng nào thì phải xử lý xong
 * mới được đi tiếp — xem BƯỚC 1B.
 * ============================================================================= */
SELECT transaction_ref, COUNT(*) AS so_dong
FROM thanh_toan
WHERE transaction_ref IS NOT NULL
GROUP BY transaction_ref
HAVING COUNT(*) > 1;


/* =============================================================================
 * BƯỚC 1B — Xử lý các mã giao dịch bị trùng. (chỉ khi bước 1 trả về dòng)
 *
 * Dữ liệu trùng ở đây KHÔNG vô hại và không nên coi là rác dọn cho gọn:
 * PaymentRepository.findByTransactionRef khai báo trả về đúng một kết quả, nên hễ có
 * callback nào tới cho một mã đang bị trùng là Spring ném IncorrectResultSizeData-
 * AccessException và lượt xử lý chết giữa chừng.
 *
 * Trước hết, nhìn xem từng cặp là gì (thay danh sách mã bằng kết quả bước 1):
 * --------------------------------------------------------------------------- */
SELECT p.payment_id, p.booking_id, p.transaction_ref, p.payment_status,
       p.amount, p.payment_date, b.status AS booking_status
FROM thanh_toan p
LEFT JOIN dat_ve b ON b.booking_id = p.booking_id
WHERE p.transaction_ref IN ('thay_bang_ma_thu_nhat', 'thay_bang_ma_thu_hai')
ORDER BY p.transaction_ref, p.payment_id;

/* LUẬT XỬ LÝ — đọc kỹ trước khi xoá bất cứ dòng nào:
 *
 * (a) Một dòng INITIATED + một dòng có kết quả (SUCCESS / FAILED /
 *     SUCCESS_NEEDS_REFUND)  ->  XOÁ dòng INITIATED.
 *     INITIATED chỉ là bản ghi "đã mở cổng thanh toán", không mang thông tin về
 *     tiền đã thu. Bỏ nó không mất gì, và dòng có kết quả mới là dòng thật.
 *
 * (b) Cả hai dòng đều có kết quả  ->  DỪNG LẠI, ĐỪNG XOÁ.
 *     Đây là trường hợp có thể khách đã bị trừ tiền hai lần. Đối chiếu với sao kê
 *     VNPay xem thực tế cổng thu mấy lần rồi mới quyết định, và nếu thu thật hai
 *     lần thì phải mở yêu cầu hoàn tiền chứ không phải xoá một dòng cho hết trùng.
 *
 * Lệnh xoá cho trường hợp (a) — CHỈ chạy sau khi đã tự mắt xác nhận đúng dạng đó.
 * Điều kiện payment_status = 'INITIATED' là chốt an toàn: nếu nhìn nhầm dạng thì
 * lệnh này không xoá gì cả thay vì xoá nhầm một khoản tiền thật.
 * --------------------------------------------------------------------------- */
-- DELETE FROM thanh_toan
-- WHERE transaction_ref IN ('thay_bang_ma_thu_nhat', 'thay_bang_ma_thu_hai')
--   AND payment_status = 'INITIATED';

/* Chạy lại BƯỚC 1 để xác nhận đã sạch, rồi mới sang bước 2. */


/* =============================================================================
 * BƯỚC 2 — Tạo index.
 *
 * >>> PHẦN A: PostgreSQL / Neon <<<
 *
 * IF NOT EXISTS có sẵn trong cú pháp nên chạy lại nhiều lần cũng không sao.
 * Postgres không có chuyện SET OPTIONS như SQL Server, nên xong lệnh này là xong,
 * KHÔNG cần bước 3.
 * ============================================================================= */
CREATE UNIQUE INDEX IF NOT EXISTS ux_thanh_toan_transaction_ref
    ON thanh_toan (transaction_ref)
    WHERE transaction_ref IS NOT NULL;

/* Kiểm chứng đã tạo được:
 *   SELECT indexname FROM pg_indexes
 *   WHERE tablename = 'thanh_toan' AND indexname = 'ux_thanh_toan_transaction_ref';
 *
 * Đường lùi (chỉ dùng khi cần gỡ bỏ):
 *   DROP INDEX IF EXISTS ux_thanh_toan_transaction_ref;
 */


/* =============================================================================
 * >>> PHẦN B: SQL Server (máy dev, docker-compose) <<<
 * ============================================================================= */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'ux_thanh_toan_transaction_ref'
      AND object_id = OBJECT_ID('dbo.thanh_toan')
)
    CREATE UNIQUE INDEX ux_thanh_toan_transaction_ref
        ON dbo.thanh_toan (transaction_ref)
        WHERE transaction_ref IS NOT NULL;


/* -----------------------------------------------------------------------------
 * BƯỚC 3 — Kiểm chứng ngay sau khi tạo. CHỈ ÁP DỤNG CHO SQL SERVER, đừng bỏ qua.
 *
 * SQL Server đòi một bộ SET OPTIONS nhất định mới cho phép GHI vào bảng có index
 * lọc; sai một tuỳ chọn thì mọi lệnh INSERT/UPDATE vào thanh_toan sẽ hỏng với lỗi
 * 1934 — nghĩa là toàn bộ thanh toán chết, chứ không phải chỉ mất một lớp phòng thủ.
 *
 * Trong thực tế driver mssql-jdbc bật sẵn ANSI_WARNINGS, và từ compatibility level 90
 * trở lên thì ANSI_WARNINGS ON kéo theo ARITHABORT ON, nên đường mặc định là an toàn.
 * Nhưng "trong thực tế" không phải là bằng chứng: chạy đúng một lệnh ghi thử dưới đây
 * ngay sau khi tạo index để tự nhìn thấy nó chạy được. Báo "1 row affected" là đạt.
 *
 * Nếu lệnh này báo lỗi 1934: xoá index (xem BƯỚC 4), hệ thống trở lại y như trước,
 * rồi tìm hiểu SET OPTIONS của kết nối trước khi thử lại.
 * --------------------------------------------------------------------------- */
BEGIN TRANSACTION;
    UPDATE TOP (1) thanh_toan SET payment_status = payment_status;
ROLLBACK TRANSACTION;


/* -----------------------------------------------------------------------------
 * BƯỚC 4 — Đường lùi cho SQL Server. Chỉ chạy khi bước 3 báo lỗi.
 *
 * Xoá index là hệ thống quay về đúng hành vi trước khi có thay đổi này: chống trùng
 * vẫn còn nguyên ở tầng ứng dụng, chỉ mất lớp cuối. Không mất dữ liệu, không cần
 * deploy lại code.
 * --------------------------------------------------------------------------- */
-- DROP INDEX ux_thanh_toan_transaction_ref ON dbo.thanh_toan;


/* =============================================================================
 * GHI CHÚ — H2 (bộ test)
 *
 * H2 KHÔNG có index này: schema test do Hibernate sinh ra từ entity. Nhánh xử lý lỗi
 * trùng vì vậy được phủ bằng unit test bơm sẵn DataIntegrityViolationException (xem
 * PaymentServiceTest), chứ không bằng một lần trùng thật.
 * ============================================================================= */
