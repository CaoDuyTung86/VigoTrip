import React from 'react';

/**
 * Ảnh đại diện của trợ lý VigoTrip.
 *
 * Vẽ thẳng bằng SVG thay vì nhúng file ảnh: nó xuất hiện ở bảy chỗ với bảy kích thước và
 * hai nền khác nhau (nền xanh đậm ở đầu khung chat, nền sáng ở bong bóng tin nhắn), nên
 * dùng `currentColor` để nó tự ăn theo màu chữ của chỗ đang đứng — không cần hai file
 * sáng/tối, không có ảnh mờ khi phóng to.
 *
 * Mắt và miệng là LỖ THỦNG (fill-rule evenodd) chứ không phải hình tô màu nền: nhờ vậy
 * đặt lên nền nào cũng đúng, kể cả nền gradient của đầu khung chat.
 *
 * Lưới 16×16 và `shape-rendering="crispEdges"` là có chủ đích — nét pixel phải sắc, đừng
 * đổi sang bo góc mượt rồi thắc mắc sao trông nhòe ở cỡ 16px.
 */
const BotAvatar = ({ size = 20, className, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    fillRule="evenodd"
    shapeRendering="crispEdges"
    className={className}
    style={style}
    aria-hidden="true"
    focusable="false"
  >
    <path d="M7 1h2v3H7z M3 4h10v7H3z M1 6h2v3H1z M13 6h2v3h-2z M4 11h2v3H4z M10 11h2v3h-2z M5 6h2v2H5z M9 6h2v2H9z M6 9h4v1H6z" />
  </svg>
);

export default BotAvatar;
