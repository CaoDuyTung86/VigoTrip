import React from "react";
import { Link } from "react-router-dom";

/**
 * Trang Điều khoản sử dụng và Chính sách quyền riêng tư.
 *
 * Lý do tồn tại: modal đăng nhập/đăng ký có câu "bạn được xem như đã đồng ý với Điều Kiện
 * Và Điều Khoản và Tuyên Bố Quyền Riêng Tư", nhưng hai liên kết đó vốn là href="#" —
 * bấm vào không đi đâu cả. Một trang thu thập họ tên, số điện thoại, email và thông tin
 * hành khách mà bắt người dùng "đồng ý" với một tài liệu không tồn tại thì lời đồng ý đó
 * vô nghĩa. Hai trang này mô tả đúng những gì hệ thống thực sự làm.
 *
 * Nội dung chỉ có tiếng Việt (giao diện hỗ trợ 4 ngôn ngữ): văn bản pháp lý cần bản dịch
 * được rà soát, dịch máy ở đây còn tệ hơn là không dịch.
 */

const LAST_UPDATED = "05/09/2026";
const SUPPORT_EMAIL = "support@vigotrip.vn";

// Header của app là position:fixed cao 64px — dùng padding cố định 40px thì link
// "← VigoTrip" chui xuống dưới nó và biến mất. Các trang khác cũng chừa chỗ theo
// biến --header-height này.
const LegalLayout = ({ title, children }) => (
  <div style={{
    background: "var(--bg-main)",
    minHeight: "100vh",
    padding: "calc(var(--header-height, 64px) + 28px) 20px 80px",
  }}>
    <div style={{ maxWidth: "820px", margin: "0 auto" }}>
      <Link
        to="/"
        style={{ color: "var(--primary)", fontSize: "14px", textDecoration: "none", fontWeight: 600 }}
      >
        ← VigoTrip
      </Link>

      <h1 style={{
        fontSize: "32px",
        fontWeight: 800,
        color: "var(--text-heading)",
        margin: "16px 0 8px",
      }}>
        {title}
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: "0 0 24px" }}>
        Cập nhật lần cuối: {LAST_UPDATED}
      </p>

      {/* Nói thẳng đây là bản thảo. Trưng một văn bản pháp lý chưa được rà soát như thể
          nó đã có hiệu lực còn tệ hơn là không có văn bản nào. */}
      <div style={{
        padding: "14px 18px",
        borderRadius: "12px",
        background: "rgba(245, 158, 11, 0.1)",
        border: "1px solid rgba(245, 158, 11, 0.35)",
        color: "var(--text-main)",
        fontSize: "13.5px",
        lineHeight: 1.7,
        marginBottom: "28px",
      }}>
        <strong>Bản thảo phục vụ đồ án tốt nghiệp.</strong> Tài liệu này mô tả trung thực cách
        hệ thống VigoTrip đang xử lý dữ liệu, nhưng chưa qua rà soát pháp lý và chưa có hiệu
        lực ràng buộc. Trước khi vận hành thương mại cần luật sư kiểm tra đối chiếu với Luật
        Bảo vệ dữ liệu cá nhân và các quy định về kinh doanh vận tải hiện hành.
      </div>

      <div style={{ color: "var(--text-main)", fontSize: "15px", lineHeight: 1.8 }}>
        {children}
      </div>

      <p style={{
        marginTop: "40px",
        paddingTop: "20px",
        borderTop: "1px solid var(--border-main)",
        color: "var(--text-secondary)",
        fontSize: "14px",
      }}>
        Câu hỏi về tài liệu này xin gửi tới{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--primary)" }}>{SUPPORT_EMAIL}</a>.
      </p>
    </div>
  </div>
);

const Section = ({ n, title, children }) => (
  <section style={{ marginBottom: "28px" }}>
    <h2 style={{
      fontSize: "18px",
      fontWeight: 700,
      color: "var(--text-heading)",
      margin: "0 0 10px",
    }}>
      {n}. {title}
    </h2>
    {children}
  </section>
);

const ulStyle = { margin: "8px 0 0", paddingLeft: "22px" };

export const Terms = () => (
  <LegalLayout title="Điều khoản sử dụng">
    <Section n="1" title="Phạm vi">
      <p style={{ margin: 0 }}>
        VigoTrip là nền tảng trung gian tìm kiếm và đặt vé máy bay, tàu hỏa và xe khách.
        Chúng tôi không trực tiếp vận hành phương tiện; hợp đồng vận chuyển được ký giữa bạn
        và nhà cung cấp dịch vụ vận tải. Việc bạn tạo tài khoản hoặc đặt vé đồng nghĩa với
        việc chấp nhận các điều khoản dưới đây.
      </p>
    </Section>

    <Section n="2" title="Tài khoản">
      <ul style={ulStyle}>
        <li>Mỗi địa chỉ email chỉ đăng ký được một tài khoản.</li>
        <li>Tài khoản đăng ký bằng email phải xác thực qua mã 6 số gửi tới hộp thư trước khi sử dụng được.</li>
        <li>Bạn chịu trách nhiệm giữ bí mật mật khẩu và mọi hoạt động phát sinh từ tài khoản của mình.</li>
        <li>
          Chúng tôi có quyền khóa tài khoản có dấu hiệu gian lận, đặt vé ảo, hoặc gây ảnh hưởng
          tới hoạt động của hệ thống. Tài khoản bị khóa không thể tự mở lại.
        </li>
      </ul>
    </Section>

    <Section n="3" title="Đặt vé và thanh toán">
      <ul style={ulStyle}>
        <li>Ghế được giữ tạm trong một khoảng thời gian giới hạn kể từ lúc bạn chọn; quá hạn ghế sẽ được trả lại cho người khác.</li>
        <li>Giá hiển thị đã bao gồm giảm giá theo hạng thành viên (nếu có), sau đó mới áp mã giảm giá.</li>
        <li>Thanh toán được xử lý qua cổng thanh toán của bên thứ ba. VigoTrip không lưu số thẻ hay thông tin thanh toán của bạn.</li>
        <li>Vé chỉ có hiệu lực sau khi giao dịch thanh toán được xác nhận thành công.</li>
      </ul>
    </Section>

    <Section n="4" title="Hủy vé và hoàn tiền">
      <p style={{ margin: 0 }}>
        Điều kiện hủy và mức hoàn tiền do nhà cung cấp vận tải quy định cho từng loại vé và
        được hiển thị trước khi bạn thanh toán. Yêu cầu hoàn tiền gửi qua mục quản lý vé và
        được nhà cung cấp duyệt; thời gian tiền về tài khoản phụ thuộc vào ngân hàng và cổng
        thanh toán.
      </p>
    </Section>

    <Section n="5" title="Điểm tích lũy, hạng thành viên và mã giảm giá">
      <ul style={ulStyle}>
        <li>Điểm tích lũy phát sinh từ các giao dịch thành công và quyết định hạng thành viên cùng mức giảm giá tương ứng.</li>
        <li>Điểm và mã giảm giá không có giá trị quy đổi thành tiền mặt và không chuyển nhượng được.</li>
        <li>Điểm phát sinh từ giao dịch bị hủy hoặc hoàn tiền có thể bị thu hồi.</li>
      </ul>
    </Section>

    <Section n="6" title="Trợ lý ảo">
      <p style={{ margin: 0 }}>
        Hệ thống có trợ lý ảo hỗ trợ tra cứu chuyến và hướng dẫn đặt vé. Câu trả lời của trợ
        lý mang tính tham khảo và có thể sai; thông tin ràng buộc là những gì hiển thị trên
        màn hình đặt vé và trong vé điện tử đã phát hành. Đừng cung cấp cho trợ lý ảo mật
        khẩu, số thẻ hay bất kỳ thông tin nhạy cảm nào.
      </p>
    </Section>

    <Section n="7" title="Hành vi không được phép">
      <ul style={ulStyle}>
        <li>Dùng công cụ tự động để đặt vé, giữ ghế hàng loạt hoặc thu thập dữ liệu từ hệ thống.</li>
        <li>Tạo tài khoản ảo nhằm trục lợi từ mã giảm giá hoặc chương trình tích điểm.</li>
        <li>Cố gắng truy cập dữ liệu của người dùng khác hoặc các chức năng quản trị.</li>
        <li>Đăng nội dung vi phạm pháp luật hoặc xúc phạm người khác trong phần đánh giá.</li>
      </ul>
    </Section>

    <Section n="8" title="Giới hạn trách nhiệm">
      <p style={{ margin: 0 }}>
        VigoTrip không chịu trách nhiệm về việc chậm, hủy chuyến hay thay đổi lịch trình do
        nhà cung cấp vận tải thực hiện, cũng như về thiệt hại phát sinh từ việc bạn để lộ
        thông tin đăng nhập. Chúng tôi cố gắng duy trì dịch vụ liên tục nhưng không cam kết
        hệ thống không bao giờ gián đoạn.
      </p>
    </Section>

    <Section n="9" title="Thay đổi điều khoản">
      <p style={{ margin: 0 }}>
        Điều khoản có thể được cập nhật. Ngày cập nhật gần nhất luôn hiển thị ở đầu trang;
        việc bạn tiếp tục sử dụng dịch vụ sau khi thay đổi được xem là chấp nhận nội dung mới.
      </p>
    </Section>

    <Section n="10" title="Liên hệ">
      <p style={{ margin: 0 }}>
        Mọi thắc mắc hoặc khiếu nại xin gửi về {SUPPORT_EMAIL}. Xem thêm{" "}
        <Link to="/chinh-sach-bao-mat" style={{ color: "var(--primary)" }}>
          Chính sách quyền riêng tư
        </Link>.
      </p>
    </Section>
  </LegalLayout>
);

export const PrivacyPolicy = () => (
  <LegalLayout title="Chính sách quyền riêng tư">
    <Section n="1" title="Dữ liệu chúng tôi thu thập">
      <ul style={ulStyle}>
        <li><strong>Khi đăng ký:</strong> họ tên, địa chỉ email, số điện thoại và mật khẩu.</li>
        <li><strong>Khi đặt vé:</strong> thông tin hành khách bạn nhập (họ tên, giấy tờ tùy thân nếu chuyến bay yêu cầu), hành trình, ghế và dịch vụ bổ sung.</li>
        <li><strong>Khi thanh toán:</strong> mã giao dịch và trạng thái thanh toán do cổng thanh toán trả về. Chúng tôi không nhận và không lưu số thẻ của bạn.</li>
        <li><strong>Khi dùng trợ lý ảo:</strong> nội dung hội thoại, chỉ khi bạn đồng ý lưu lịch sử. Bạn có thể tắt tùy chọn này và xóa lịch sử bất cứ lúc nào.</li>
        <li><strong>Khi đánh giá:</strong> nội dung và điểm đánh giá bạn để lại cho chuyến đi.</li>
        <li><strong>Tự động:</strong> số liệu truy cập ẩn danh phục vụ đo hiệu năng trang.</li>
      </ul>
    </Section>

    <Section n="2" title="Mục đích sử dụng">
      <p style={{ margin: 0 }}>
        Dữ liệu được dùng để tạo và quản lý tài khoản, phát hành vé, xử lý thanh toán và hoàn
        tiền, tính điểm tích lũy và hạng thành viên, gửi email xác thực và đặt lại mật khẩu,
        hỗ trợ khách hàng, và phát hiện gian lận. Chúng tôi không bán dữ liệu cá nhân của bạn.
      </p>
    </Section>

    <Section n="3" title="Đăng nhập bằng Google">
      <p style={{ margin: 0 }}>
        Nếu bạn chọn đăng nhập bằng Google, chúng tôi nhận từ Google địa chỉ email và họ tên
        của bạn để tạo hoặc nhận diện tài khoản. Chúng tôi không nhận được mật khẩu Google
        của bạn và không truy cập được bất kỳ dữ liệu nào khác trong tài khoản Google.
      </p>
    </Section>

    <Section n="4" title="Lưu trữ trên trình duyệt">
      <ul style={ulStyle}>
        <li><strong>localStorage:</strong> phiên đăng nhập (JWT) và thông tin hiển thị cơ bản, ngôn ngữ và giao diện sáng/tối bạn chọn. Xóa khi bạn đăng xuất.</li>
        <li><strong>sessionStorage:</strong> email đang gõ dở ở form đăng nhập, để không bắt bạn nhập lại. Xóa khi bạn đăng nhập xong hoặc đăng xuất, và tự mất khi đóng tab.</li>
        <li>Chúng tôi không dùng cookie theo dõi cho mục đích quảng cáo.</li>
      </ul>
    </Section>

    <Section n="5" title="Bên thứ ba">
      <p style={{ margin: "0 0 8px" }}>Dữ liệu của bạn được chia sẻ ở mức tối thiểu cần thiết với:</p>
      <ul style={ulStyle}>
        <li><strong>Nhà cung cấp vận tải</strong> — thông tin hành khách của chuyến bạn đặt, để họ phát hành và kiểm soát vé.</li>
        <li><strong>Cổng thanh toán</strong> — số tiền và mã đơn hàng; thông tin thẻ do bạn nhập trực tiếp trên hệ thống của họ.</li>
        <li><strong>Dịch vụ gửi email</strong> — địa chỉ email, để gửi mã xác thực và mã đặt lại mật khẩu.</li>
        <li><strong>Nhà cung cấp hạ tầng</strong> — hệ thống được vận hành trên nền tảng đám mây và có dịch vụ chống truy cập tự động; các dịch vụ này xử lý dữ liệu kỹ thuật như địa chỉ IP.</li>
      </ul>
    </Section>

    <Section n="6" title="Bảo mật">
      <ul style={ulStyle}>
        <li>Mật khẩu được băm bằng thuật toán một chiều (BCrypt) — chúng tôi không lưu và không khôi phục được mật khẩu gốc của bạn.</li>
        <li>Toàn bộ kết nối tới hệ thống dùng HTTPS.</li>
        <li>Phiên đăng nhập có thời hạn và sẽ bị hủy khi bạn đăng xuất.</li>
        <li>Không có hệ thống nào an toàn tuyệt đối; hãy dùng mật khẩu riêng cho tài khoản này và không chia sẻ cho người khác.</li>
      </ul>
    </Section>

    <Section n="7" title="Thời gian lưu trữ">
      <p style={{ margin: 0 }}>
        Thông tin tài khoản được lưu trong suốt thời gian tài khoản còn hoạt động. Dữ liệu đặt
        vé và thanh toán được giữ lại theo yêu cầu về chứng từ và giải quyết tranh chấp. Lịch
        sử hội thoại với trợ lý ảo bị xóa ngay khi bạn yêu cầu.
      </p>
    </Section>

    <Section n="8" title="Quyền của bạn">
      <ul style={ulStyle}>
        <li>Xem và sửa thông tin cá nhân trong trang tài khoản.</li>
        <li>Tắt việc lưu lịch sử hội thoại với trợ lý ảo, và xóa lịch sử đã lưu.</li>
        <li>Yêu cầu xóa tài khoản bằng cách liên hệ {SUPPORT_EMAIL}. Một số dữ liệu giao dịch có thể phải giữ lại theo quy định về chứng từ.</li>
      </ul>
    </Section>

    <Section n="9" title="Trẻ em">
      <p style={{ margin: 0 }}>
        Dịch vụ không dành cho người dưới 16 tuổi tự đăng ký tài khoản. Trẻ em đi cùng người
        lớn được khai báo như hành khách trong đơn đặt vé của người lớn đó.
      </p>
    </Section>

    <Section n="10" title="Liên hệ">
      <p style={{ margin: 0 }}>
        Mọi yêu cầu liên quan tới dữ liệu cá nhân xin gửi về {SUPPORT_EMAIL}. Xem thêm{" "}
        <Link to="/dieu-khoan" style={{ color: "var(--primary)" }}>Điều khoản sử dụng</Link>.
      </p>
    </Section>
  </LegalLayout>
);
