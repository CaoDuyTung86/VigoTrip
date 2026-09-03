import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  Bot, ThumbsUp, ThumbsDown, Timer, AlertTriangle, BookOpen, ShieldCheck, RefreshCw,
} from "lucide-react";

/**
 * Bảng điều khiển vận hành chatbot.
 *
 * Trả lời đúng ba câu hỏi mà người trực hằng ngày cần: chatbot có đang chạy không (độ trễ,
 * tỉ lệ lỗi), người dùng có hài lòng không (👍/👎), và nếu không thì hỏng ở đâu (lý do bị
 * chê, tỉ lệ câu hỏi không có tài liệu để dựa vào).
 *
 * Số liệu ở đây là ẩn danh — không email, không session, không nội dung — trừ đúng một
 * bảng "câu hỏi bị chê" ở cuối, chỉ admin thấy và chỉ gồm câu hỏi của người đã bật đồng ý
 * lưu hội thoại. Đối tác (provider) gọi /ops/summary được nhưng /ops/issues thì không.
 */

const RANGE_OPTIONS = [7, 30, 90];

const REASON_LABELS = {
  WRONG_INFO: "Thông tin sai",
  NOT_UNDERSTOOD: "Không hiểu câu hỏi",
  INCOMPLETE: "Trả lời thiếu",
  OFF_TOPIC: "Lạc đề",
  OTHER: "Lý do khác",
  NONE: "Không nêu lý do",
};

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** "2026-09-03" -> "03/09" cho trục biểu đồ. */
const shortDate = (iso) => {
  const parts = String(iso || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : iso;
};

const AdminChatbot = () => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const tr = useCallback((key, fallback) => t?.[key] || fallback, [t]);

  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = useMemo(
    () => String(user?.role || "").toUpperCase().includes("ADMIN"),
    [user?.role]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/ops/summary?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSummary(await res.json());

      // Đối tác không có quyền xem phần này. Gọi và bỏ qua khi bị từ chối thay vì đoán
      // quyền ở client: server mới là nơi giữ quy tắc.
      if (isAdmin) {
        const issuesRes = await fetch(`/api/chat/ops/issues?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIssues(issuesRes.ok ? await issuesRes.json() : []);
      } else {
        setIssues([]);
      }
    } catch (e) {
      console.error(e);
      setError(tr("adminChatbotLoadFailed", "Không tải được số liệu chatbot."));
    } finally {
      setLoading(false);
    }
  }, [days, token, isAdmin, tr]);

  useEffect(() => { load(); }, [load]);

  const totals = summary?.totals || {};
  const feedback = summary?.feedback || { up: 0, down: 0 };
  const rated = (feedback.up || 0) + (feedback.down || 0);
  const turns = totals.turns || 0;

  const chartData = useMemo(
    () => (summary?.daily || []).map((d) => ({
      ...d,
      label: shortDate(d.date),
    })),
    [summary?.daily]
  );

  const reasonData = useMemo(
    () => (summary?.reasons || []).map((r) => ({
      ...r,
      label: REASON_LABELS[r.reason] || r.reason,
    })),
    [summary?.reasons]
  );

  const cards = [
    {
      icon: <Bot size={18} />,
      label: tr("adminChatbotTurns", "Lượt hỏi"),
      value: turns.toLocaleString("vi-VN"),
      hint: `${(totals.memberTurns || 0).toLocaleString("vi-VN")} thành viên · ${(totals.guestTurns || 0).toLocaleString("vi-VN")} khách`,
      color: "#60a5fa",
    },
    {
      icon: <ThumbsUp size={18} />,
      label: tr("adminChatbotSatisfaction", "Tỉ lệ hài lòng"),
      value: rated > 0 ? `${pct(feedback.up, rated)}%` : "—",
      hint: rated > 0
        ? `${feedback.up} 👍 · ${feedback.down} 👎 trên ${rated} lượt đánh giá`
        : tr("adminChatbotNoRatings", "Chưa có ai đánh giá"),
      color: "#34d399",
    },
    {
      icon: <Timer size={18} />,
      label: tr("adminChatbotLatency", "Độ trễ trung bình"),
      value: `${(totals.avgLatencyMs || 0).toLocaleString("vi-VN")} ms`,
      hint: `cao nhất ${(totals.maxLatencyMs || 0).toLocaleString("vi-VN")} ms`,
      color: "#fbbf24",
    },
    {
      icon: <AlertTriangle size={18} />,
      label: tr("adminChatbotFailRate", "Tỉ lệ lỗi"),
      value: `${pct(totals.failedTurns || 0, turns)}%`,
      hint: `${(totals.failedTurns || 0).toLocaleString("vi-VN")} lượt không trả lời được`,
      color: "#f87171",
    },
    {
      icon: <BookOpen size={18} />,
      label: tr("adminChatbotRagHit", "Có tài liệu để dựa vào"),
      value: `${pct(totals.ragHitTurns || 0, turns)}%`,
      hint: turns > 0
        ? `${(turns - (totals.ragHitTurns || 0)).toLocaleString("vi-VN")} lượt phải trả lời chay`
        : "—",
      color: "#a78bfa",
    },
  ];

  return (
    // Bọc y như AdminReviews: marginTop để không nằm khuất dưới header cố định, và KHÔNG
    // dùng <Sidebar /> — thanh đó là điều hướng đặt vé cho khách, không liên quan tới
    // màn hình quản trị, mà lại phủ đè lên nội dung.
    <div style={{ padding: "32px 40px", marginTop: 80, background: "var(--bg-main)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
              <Bot size={22} style={{ color: "var(--primary)" }} />
              {tr("adminChatbotTitle", "Vận hành chatbot")}
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              {tr("adminChatbotSubtitle", "Số đo ẩn danh của trợ lý AI — không kèm danh tính người dùng.")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setDays(option)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: days === option ? "var(--primary)" : "var(--border-main)",
                  background: days === option ? "var(--primary)" : "var(--bg-card)",
                  color: days === option ? "#fff" : "var(--text-secondary)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >{option} {tr("adminChatbotDays", "ngày")}</button>
            ))}
            <button
              onClick={load}
              disabled={loading}
              title={tr("adminChatbotRefresh", "Tải lại")}
              style={{
                padding: "6px 10px", borderRadius: 8,
                border: "1px solid var(--border-main)", background: "var(--bg-card)",
                color: "var(--text-secondary)", cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center",
              }}
            ><RefreshCw size={15} /></button>
          </div>
        </div>

        {error && (
          <div style={{ margin: "16px 0", padding: 14, borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171", fontSize: 14 }}>
            {error}
          </div>
        )}

        {loading && !summary ? (
          <div style={{ padding: 40, color: "var(--text-muted)" }}>{tr("adminChatbotLoading", "Đang tải…")}</div>
        ) : (
          <>
            {/* Hàng chỉ số */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginTop: 20 }}>
              {cards.map((card) => (
                <div key={card.label} style={{
                  background: "var(--bg-card)", border: "1px solid var(--border-main)",
                  borderRadius: 14, padding: "16px 18px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: card.color, marginBottom: 10 }}>
                    {card.icon}
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>{card.label}</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-heading)", lineHeight: 1.1 }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{card.hint}</div>
                </div>
              ))}
            </div>

            {turns === 0 && rated === 0 && (
              <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: "var(--bg-accent)", fontSize: 13.5, color: "var(--text-secondary)" }}>
                {tr("adminChatbotEmpty", "Chưa có lượt chat nào trong kỳ này. Số liệu bắt đầu được ghi từ lượt hỏi tiếp theo.")}
              </div>
            )}

            {/* Lưu lượng & đánh giá theo ngày */}
            {chartData.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginTop: 20 }}>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-main)", borderRadius: 14, padding: 18 }}>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-heading)", margin: "0 0 14px" }}>
                    {tr("adminChatbotDailyTurns", "Lượt hỏi & đánh giá theo ngày")}
                  </h3>
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-main)", borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="turns" name={tr("adminChatbotTurns", "Lượt hỏi")} fill="#60a5fa" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="down" name="👎" fill="#f87171" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="up" name="👍" fill="#34d399" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-main)", borderRadius: 14, padding: 18 }}>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-heading)", margin: "0 0 14px" }}>
                    {tr("adminChatbotDailyLatency", "Độ trễ trung bình theo ngày (ms)")}
                  </h3>
                  <ResponsiveContainer width="100%" height={230}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                      <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-main)", borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="avgLatencyMs" name="ms" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Lý do bị chê — danh sách việc cần làm */}
            {reasonData.length > 0 && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-main)", borderRadius: 14, padding: 18, marginTop: 14 }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-heading)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
                  <ThumbsDown size={15} style={{ color: "#f87171" }} />
                  {tr("adminChatbotReasons", "Người dùng chê điều gì")}
                </h3>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
                  {tr("adminChatbotReasonsHint", "Xếp theo số lượt — đây là thứ tự nên sửa.")}
                </div>
                {reasonData.map((r) => {
                  const total = reasonData.reduce((sum, x) => sum + x.count, 0);
                  return (
                    <div key={r.reason} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-main)", marginBottom: 4 }}>
                        <span>{r.label}</span>
                        <span style={{ color: "var(--text-muted)" }}>{r.count} ({pct(r.count, total)}%)</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: "var(--bg-input)", overflow: "hidden" }}>
                        <div style={{ width: `${pct(r.count, total)}%`, height: "100%", background: "#f87171", borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Câu hỏi bị chê — chỉ admin, chỉ với người đã đồng ý lưu hội thoại */}
            {isAdmin && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-main)", borderRadius: 14, padding: 18, marginTop: 14 }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-heading)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
                  <ShieldCheck size={15} style={{ color: "var(--primary)" }} />
                  {tr("adminChatbotIssues", "Câu hỏi bị đánh giá xấu")}
                </h3>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
                  {tr("adminChatbotIssuesHint", "Chỉ gồm câu hỏi của người dùng đã bật đồng ý lưu hội thoại. Không kèm danh tính, không kèm câu trả lời của bot.")}
                </div>
                {issues.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {tr("adminChatbotNoIssues", "Không có câu hỏi nào bị chê trong kỳ này.")}
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 12 }}>
                          <th style={{ padding: "8px 10px", fontWeight: 600 }}>{tr("adminChatbotColQuestion", "Câu hỏi")}</th>
                          <th style={{ padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{tr("adminChatbotColReason", "Lý do")}</th>
                          <th style={{ padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{tr("adminChatbotColTime", "Thời điểm")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {issues.map((issue, idx) => (
                          <tr key={idx} style={{ borderTop: "1px solid var(--border-light)", color: "var(--text-main)" }}>
                            <td style={{ padding: "10px" }}>{issue.question}</td>
                            <td style={{ padding: "10px", whiteSpace: "nowrap", color: "#f87171" }}>
                              {REASON_LABELS[issue.reason] || issue.reason}
                            </td>
                            <td style={{ padding: "10px", whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                              {String(issue.createdAt).replace("T", " ").slice(0, 16)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminChatbot;
