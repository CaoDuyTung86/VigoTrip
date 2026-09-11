import React, { useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Sidebar from "../components/Sidebar";
import { FaSearch, FaShieldAlt, FaExclamationTriangle } from "react-icons/fa";

/**
 * Tra cứu nhật ký giao dịch khi có tranh chấp thanh toán.
 *
 * CỐ Ý KHÔNG CÓ DANH SÁCH ĐỂ DUYỆT. Phải nhập trước mã giao dịch hoặc mã đơn mới ra dữ
 * liệu — xem Javadoc của AdminPaymentLogController để biết vì sao. Nếu sau này thấy màn
 * hình "bất tiện vì không xem được tất cả" thì đó là thiết kế đang hoạt động đúng, đừng
 * thêm nút "xem tất cả".
 */
const getChannelStyle = (channel, t) => {
  switch (channel) {
    case "IPN":
      return { bg: "rgba(59, 130, 246, 0.18)", color: "#60a5fa", label: t.chIpn || "IPN (server→server)" };
    case "RETURN":
      return { bg: "rgba(168, 85, 247, 0.18)", color: "#c084fc", label: t.chReturn || "Return (trình duyệt)" };
    case "QUERYDR":
      return { bg: "rgba(245, 158, 11, 0.18)", color: "#fbbf24", label: t.chQueryDr || "QueryDR (ta hỏi cổng)" };
    case "REFUND_APPROVE":
      return { bg: "rgba(34, 197, 94, 0.18)", color: "#4ade80", label: t.chRefundApprove || "Duyệt hoàn tiền" };
    case "REFUND_REJECT":
      return { bg: "rgba(239, 68, 68, 0.18)", color: "#fca5a5", label: t.chRefundReject || "Từ chối hoàn tiền" };
    default:
      return { bg: "var(--bg-input)", color: "var(--text-muted)", label: channel };
  }
};

const AdminPaymentLogs = () => {
  const { user, token, isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const [mode, setMode] = useState("transactionRef");
  const [keyword, setKeyword] = useState("");
  const [entries, setEntries] = useState(null); // null = chưa tra lần nào, [] = tra rồi mà rỗng
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAuthenticated && user?.role === "ROLE_ADMIN";

  const search = async (e) => {
    e?.preventDefault();
    const value = keyword.trim();
    if (!value) return;

    try {
      setLoading(true);
      setError("");
      const params = mode === "bookingId" ? { bookingId: value } : { transactionRef: value };
      const res = await axios.get("/api/admin/payment-logs", {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      setEntries(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || t.errLookupTxnFailed || "Không tra cứu được nhật ký giao dịch.");
      setEntries(null);
    } finally {
      setLoading(false);
    }
  };

  const signatureBadge = (value) => {
    if (value === true) return { bg: "rgba(34, 197, 94, 0.18)", color: "#4ade80", text: t.sigValid || "Chữ ký hợp lệ" };
    if (value === false) return { bg: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", text: t.sigInvalid || "CHỮ KÝ SAI" };
    return { bg: "var(--bg-input)", color: "var(--text-muted)", text: t.sigNone || "Không có chữ ký" };
  };

  const cardStyle = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-main)",
    borderRadius: 12,
    padding: 20,
  };

  const payloadStyle = {
    background: "var(--bg-input)",
    border: "1px solid var(--border-main)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 12,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    color: "var(--text-main)",
    margin: 0,
    // Payload có thể rất dài; cho cuộn trong khung thay vì đẩy cả trang giãn ngang.
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    maxHeight: 200,
    overflowY: "auto",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)", display: "flex", flexDirection: "column" }}>
      <div className="page-with-sidebar" style={{ display: "flex", flex: 1, marginTop: "var(--header-offset)" }}>
        <Sidebar isOpen={true} />
        <div className="page-main with-sidebar" style={{ padding: 30, flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>

            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: "var(--text-heading)" }}>
              {t.transactionLogTitle || "Nhật ký giao dịch"}
            </h1>
            <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 14 }}>
              {t.transactionLogSubtitle || "Dấu vết thô của mọi lần cổng thanh toán gọi về, mọi lần hệ thống hỏi lại cổng, và mọi quyết định hoàn tiền. Dùng khi khách khiếu nại đã trả tiền mà đơn chưa được xác nhận."}
            </p>

            {!isAdmin ? (
              <div style={{ ...cardStyle, textAlign: "center", color: "#fca5a5" }}>
                <FaExclamationTriangle style={{ marginRight: 8 }} />
                {t.admAdminOnly || "Vui lòng đăng nhập bằng tài khoản Admin."}
              </div>
            ) : (
              <>
                <form onSubmit={search} style={{ ...cardStyle, marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <select
                    value={mode}
                    onChange={(e) => { setMode(e.target.value); setEntries(null); }}
                    style={{
                      padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-main)",
                      background: "var(--bg-input)", color: "var(--text-main)", fontSize: 14, fontWeight: 600,
                    }}
                  >
                    <option value="transactionRef">{t.transactionRef || "Mã giao dịch"}</option>
                    <option value="bookingId">{t.bookingIdCode || "Mã đơn"}</option>
                  </select>

                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder={mode === "bookingId" ? (t.plhBookingId || "Ví dụ: 49") : (t.plhTxnRef || "Ví dụ: be76f754eb98")}
                    style={{
                      flex: 1, minWidth: 220, padding: "10px 12px", borderRadius: 8,
                      border: "1px solid var(--border-main)", background: "var(--bg-input)",
                      color: "var(--text-main)", fontSize: 14,
                    }}
                  />

                  <button
                    type="submit"
                    disabled={loading || !keyword.trim()}
                    style={{
                      padding: "10px 22px", borderRadius: 8, border: "none",
                      background: loading || !keyword.trim() ? "var(--bg-input)" : "var(--primary)",
                      color: loading || !keyword.trim() ? "var(--text-muted)" : "#fff",
                      fontWeight: 700, fontSize: 14,
                      cursor: loading || !keyword.trim() ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <FaSearch size={13} />
                    {loading ? (t.searchingTxn || "Đang tra...") : (t.lookupButton || "Tra cứu")}
                  </button>
                </form>

                {error && (
                  <div style={{ ...cardStyle, marginBottom: 20, color: "#fca5a5", borderColor: "rgba(239,68,68,0.3)" }}>
                    ⚠️ {error}
                  </div>
                )}

                {entries === null && !error && (
                  <div style={{ ...cardStyle, color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7 }}>
                    <FaShieldAlt style={{ marginRight: 8, color: "var(--primary)" }} />
                    {t.transactionLogNote || "Màn hình này chỉ tra theo mã, không có danh sách để duyệt — đó là chủ ý, nhằm hạn chế thiệt hại nếu một tài khoản quản trị bị chiếm. Mã giao dịch là chuỗi khách đọc được trong ứng dụng ngân hàng hoặc trong email xác nhận."}
                  </div>
                )}

                {entries !== null && entries.length === 0 && (
                  <div style={{ ...cardStyle, textAlign: "center", color: "var(--text-secondary)" }}>
                    {t.noTxnLogsMatch || "Không có dòng nào khớp. Nếu khách khẳng định đã trả tiền mà ở đây trống, nghĩa là cổng chưa từng gọi về — hãy đối chiếu với sao kê phía VNPay."}
                  </div>
                )}

                {entries !== null && entries.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                      {(t.txnRowsCount || "{count} dòng, theo thứ tự đã xảy ra.").replace("{count}", entries.length)}
                    </div>

                    {entries.map((entry) => {
                      const channel = getChannelStyle(entry.channel, t);
                      const sig = signatureBadge(entry.signatureValid);

                      return (
                        <div key={entry.id} style={{ ...cardStyle, borderLeft: `5px solid ${channel.color}` }}>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
                            <span style={{ background: channel.bg, color: channel.color, padding: "5px 12px", borderRadius: 16, fontSize: 12, fontWeight: 800 }}>
                              {channel.label}
                            </span>
                            <span style={{ background: sig.bg, color: sig.color, padding: "5px 12px", borderRadius: 16, fontSize: 12, fontWeight: 700 }}>
                              {sig.text}
                            </span>
                            <span style={{ color: "var(--text-muted)", fontSize: 13, marginLeft: "auto" }}>
                              {entry.createdAt?.replace("T", " ").slice(0, 19)}
                            </span>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
                            <Field label={t.colOutcome || "Kết luận"} value={entry.outcome} strong />
                            <Field label={t.colBookingId || "Mã đơn"} value={entry.bookingId ?? "—"} />
                            <Field label={t.colTxnRef || "Mã giao dịch"} value={entry.transactionRef ?? "—"} />
                            <Field label={t.colSourceIp || "IP gọi vào"} value={entry.sourceIp ?? "—"} />
                            {entry.actor && <Field label={t.colActor || "Người thực hiện"} value={entry.actor} />}
                          </div>

                          {entry.requestPayload && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 5 }}>
                                {t.payloadReceivedSent || "Nhận được / gửi đi"}
                              </div>
                              <pre style={payloadStyle}>{entry.requestPayload}</pre>
                            </div>
                          )}

                          {entry.responsePayload && (
                            <div>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 5 }}>
                                {t.payloadResponse || "Phản hồi"}
                              </div>
                              <pre style={payloadStyle}>{entry.responsePayload}</pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, strong }) => (
  <div>
    <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 3 }}>{label}</div>
    <div style={{
      fontSize: 14, color: "var(--text-main)", fontWeight: strong ? 800 : 600,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", wordBreak: "break-all",
    }}>
      {value}
    </div>
  </div>
);

export default AdminPaymentLogs;
