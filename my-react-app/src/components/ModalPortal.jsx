// @ts-check
import React, { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Lớp phủ modal dùng chung cho các trang quản trị.
 *
 * Vì sao phải portal ra thẳng <body>: các trang đều nằm trong .page-main, mà class
 * này chạy animation fadeInUp có transform. Một phần tử đang (hoặc đã) giữ giá trị
 * transform sẽ trở thành containing block cho mọi con position:fixed — modal vì thế
 * bị canh giữa theo CHIỀU DÀI CẢ TRANG chứ không phải theo màn hình, nên bấm sửa/xóa
 * ở cuối bảng thì hộp thoại hiện tít trên đầu và phải cuộn ngược lên mới thấy.
 * Render ngoài body thì không còn ancestor nào can thiệp được nữa.
 *
 * Kèm luôn các thứ một modal cần có: bấm nền hoặc Esc để đóng, khóa cuộn trang nền,
 * và tự cuộn được khi nội dung cao hơn màn hình.
 */
const ModalPortal = ({
  children,
  onClose,
  zIndex = 9999,
  backdrop = "rgba(0,0,0,0.5)",
  blur = 4,
  closeOnBackdrop = true,
}) => {
  useEffect(() => {
    if (!onClose) return undefined;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Khóa cuộn nền, bù đúng bề rộng thanh cuộn để trang không bị giật ngang khi mở.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  // Chỉ đóng khi bấm đúng vào nền, không đóng khi con trỏ nhả chuột từ trong hộp ra.
  const handleBackdrop = (e) => {
    if (!closeOnBackdrop || !onClose) return;
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      onMouseDown={handleBackdrop}
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        background: backdrop,
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        display: "flex",
        padding: 20,
        overflowY: "auto",
        overscrollBehavior: "contain",
        animation: "modalOverlayIn 0.18s ease-out",
      }}
    >
      <div
        onMouseDown={handleBackdrop}
        style={{
          margin: "auto",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          animation: "modalCardIn 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default ModalPortal;
