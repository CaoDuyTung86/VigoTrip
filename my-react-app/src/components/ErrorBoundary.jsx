// @ts-check
import { Component } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

/**
 * Chặn lỗi ở render-phase để một trang hỏng không kéo sập cả ứng dụng.
 *
 * Không có nó, mọi ReferenceError/TypeError lúc render đều khiến React gỡ toàn bộ cây
 * và người dùng chỉ thấy một màn hình trống trơn — không thông báo, không manh mối, URL
 * vẫn y nguyên nên nhìn hệt như "bấm nút không ăn". Muốn biết lỗi gì phải mở DevTools.
 *
 * Đặt bên trong Header/Footer nên khi một trang chết, thanh điều hướng vẫn còn để đi
 * chỗ khác. Chi tiết lỗi hiện luôn trên màn hình vì trên bản production đã minify,
 * bảo người dùng "mở Console chụp màn hình" là cách nhanh nhất để mất dấu lỗi.
 */
class ErrorBoundaryView extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error("Lỗi render:", error, info?.componentStack);
    }

    render() {
        const { error } = this.state;
        const { t, children } = this.props;
        if (!error) return children;

        return (
            <div style={{
                minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center",
                padding: "40px 20px", background: "var(--bg-main)"
            }}>
                <div style={{
                    maxWidth: 560, width: "100%", background: "var(--bg-card)", borderRadius: 16,
                    padding: 32, border: "1px solid var(--border-main)", boxShadow: "var(--shadow-md)"
                }}>
                    <h2 style={{ margin: "0 0 12px 0", fontSize: 20, fontWeight: 800, color: "var(--text-main)" }}>
                        {t.errBoundaryTitle}
                    </h2>
                    <p style={{ margin: "0 0 24px 0", fontSize: 14.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                        {t.errBoundaryDesc}
                    </p>

                    <button type="button" onClick={() => window.location.reload()} style={{
                        width: "100%", padding: "13px", borderRadius: 10, border: "none",
                        background: "var(--primary)", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer"
                    }}>
                        {t.errBoundaryReload}
                    </button>

                    <details style={{ marginTop: 20 }}>
                        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
                            {t.errBoundaryDetails}
                        </summary>
                        <pre style={{
                            marginTop: 10, padding: 12, borderRadius: 8, background: "var(--bg-input)",
                            color: "var(--text-main)", fontSize: 12, lineHeight: 1.6,
                            whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 200, overflow: "auto"
                        }}>
                            {String(error?.message || error)}
                        </pre>
                    </details>
                </div>
            </div>
        );
    }
}

/**
 * Gắn key theo pathname: chuyển sang trang khác là boundary được dựng lại từ đầu,
 * nếu không thì một lần lỗi sẽ dính luôn màn hình đó cho tới khi người dùng F5.
 */
export default function ErrorBoundary({ children }) {
    const location = useLocation();
    const { t } = useLanguage();
    return (
        <ErrorBoundaryView key={location.pathname} t={t}>
            {children}
        </ErrorBoundaryView>
    );
}
