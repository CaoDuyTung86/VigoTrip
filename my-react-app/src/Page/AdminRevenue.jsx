import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import Header from "../LayOut/Header";
import { useLanguage } from "../context/LanguageContext";
import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Sparkles, TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight,
  Ticket, Receipt, Wallet, Info, X,
} from "lucide-react";
import {
  shiftAnchor, currentAnchor, isAtEarliestPeriod, isAtLatestPeriod,
} from "../utils/reportPeriod";

/**
 * Màn hình BI doanh thu.
 *
 * Bản cũ đọc /api/admin/revenue — doanh thu ALL-TIME theo nhà cung cấp — nhưng nút "Phân
 * tích AI" lại gọi một endpoint dựng báo cáo từ bộ truy vấn khác, nên con số AI nói ra có
 * thể chỏi với chính biểu đồ bên cạnh. Giờ cả hai cùng ăn /api/analytics/summary với đúng
 * một kỳ, nên không còn cửa lệch.
 */

const PERIOD_OPTIONS = [
  { id: "MONTH", labelKey: "biPeriodMonth", fallback: "Tháng" },
  { id: "QUARTER", labelKey: "biPeriodQuarter", fallback: "Quý" },
  { id: "YEAR", labelKey: "biPeriodYear", fallback: "Năm" },
];

const VEHICLE_LABELS = {
  PLANE: "Vé máy bay",
  BUS: "Xe khách",
  TRAIN: "Vé tàu hỏa",
};

const CHART_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--chart-6)",
];

const formatVnd = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

/** Rút gọn cho trục biểu đồ: 12.400.000 -> "12,4 tr". Số đầy đủ vẫn có trong tooltip. */
const formatCompact = (value) => {
  const n = Number(value || 0);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(".", ",")} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} k`;
  return String(n);
};

const AdminRevenue = () => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const tr = useCallback((key, fallback) => t?.[key] || fallback, [t]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [scope, setScope] = useState(null);
  const [ownedProviders, setOwnedProviders] = useState([]);
  const [period, setPeriod] = useState("MONTH");
  const [anchor, setAnchor] = useState(currentAnchor);

  const [summary, setSummary] = useState(null);

  /**
   * Thông báo "kỳ bạn chọn trống, đang hiện kỳ khác" — giữ riêng chứ không đọc thẳng
   * `summary.fallbackApplied`.
   *
   * Vì mốc neo đã được đồng bộ theo kỳ backend chốt, lần gọi ngay sau đó hỏi đúng kỳ CÓ
   * dữ liệu nên cờ fallback tắt, và banner sẽ chớp lên rồi tắt ngóm — người xem chỉ kịp
   * thấy số liệu của một kỳ khác kỳ mình vừa bấm mà không có lời giải thích nào. Thông
   * báo chỉ mất khi chính người dùng chuyển kỳ.
   */
  const [fallbackNotice, setFallbackNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // Dải kỳ đi lại được, chặn ở cả hai đầu: dưới là kỳ chứa giao dịch xa nhất, trên là kỳ
  // hiện tại. Trước đây chỉ có chặn trên, nên nút lùi đi được vô hạn vào quá khứ rỗng.
  const atEarliest = isAtEarliestPeriod(anchor, period, summary?.earliestDataDate);
  const atLatest = isAtLatestPeriod(anchor, period);

  // Mọi thao tác chuyển kỳ do người dùng chủ động đều xoá thông báo fallback cũ: nó nói về
  // kỳ vừa rời đi, để lại là chú thích sai cho màn hình mới.
  const goPeriod = (direction) => {
    setFallbackNotice(null);
    setAnchor((a) => shiftAnchor(a, period, direction));
  };
  const choosePeriod = (id) => {
    setFallbackNotice(null);
    setPeriod(id);
  };

  // Hỏi trước xem tài khoản này xem được phạm vi nào, thay vì gọi thử scope=SYSTEM rồi ăn 403.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/analytics/scope", { headers: authHeaders });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        setScope(data.canViewSystem ? "SYSTEM" : "PROVIDER");
        setOwnedProviders(data.ownedProviders || []);
      } catch {
        if (!cancelled) setScope("PROVIDER");
      }
    })();
    return () => { cancelled = true; };
  }, [token, authHeaders]);

  useEffect(() => {
    if (!token || !scope) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ scope, period, anchor });
        const res = await fetch(`/api/analytics/summary?${params}`, { headers: authHeaders });
        if (!res.ok) throw new Error(tr("biLoadError", "Không tải được số liệu doanh thu"));
        const data = await res.json();
        if (cancelled) return;
        setSummary(data);

        // Backend đã lùi về kỳ khác thì kéo con trỏ kỳ theo nó. Không đồng bộ thì `anchor`
        // cứ trôi tiếp mỗi lần bấm trong khi màn hình đứng yên ở kỳ fallback, và để quay
        // lại người dùng phải bấm ngược đúng bằng số lần đã bấm xuôi mới thấy giao diện
        // nhúc nhích. Vòng lặp tự dừng: kỳ fallback theo định nghĩa là kỳ CÓ dữ liệu, nên
        // lần gọi lại sẽ không bật cờ này nữa.
        if (data.fallbackApplied) {
          setFallbackNotice({
            requested: data.requestedPeriodLabel,
            shown: data.periodLabel,
          });
          if (data.periodStart && data.periodStart !== anchor) {
            setAnchor(data.periodStart);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, scope, period, anchor, authHeaders, tr]);

  const fetchInsights = async () => {
    try {
      setAiLoading(true);
      setShowAiModal(true);
      setAiInsights(null);
      const params = new URLSearchParams({ scope, period, anchor });
      const res = await fetch(`/api/analytics/insights?${params}`, { headers: authHeaders });
      if (!res.ok) throw new Error(tr("biAiError", "Không lấy được nhận định từ AI"));
      const data = await res.json();
      setAiInsights(data.insights);
    } catch (e) {
      setAiInsights(`⚠️ ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const typeData = useMemo(() => (summary?.revenueByVehicleType || []).map((item) => ({
    name: VEHICLE_LABELS[item.name] || item.name,
    value: Number(item.amount || 0),
    share: item.sharePct,
  })), [summary]);

  const providerData = useMemo(() => (summary?.revenueByProvider || []).slice(0, 6).map((item) => ({
    name: item.name,
    value: Number(item.amount || 0),
    share: item.sharePct,
  })), [summary]);

  const trendData = useMemo(() => (summary?.trend || []).map((point) => ({
    label: point.label,
    value: Number(point.amount || 0),
    bookings: point.bookings,
  })), [summary]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-main)", display: "flex", flexDirection: "column" }}>
      <Header setIsSidebarOpen={setIsSidebarOpen} />

      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .bi-card { background: var(--bg-card); border: 1px solid var(--border-main); border-radius: 14px; box-shadow: var(--shadow-sm); }
        .bi-seg { border: 1px solid var(--border-input); background: var(--bg-card); border-radius: 10px; overflow: hidden; display: flex; }
        .bi-seg button { border: none; background: transparent; color: var(--text-secondary); font-weight: 600; font-size: 13px; padding: 8px 16px; cursor: pointer; transition: 0.15s; }
        .bi-seg button:hover { background: var(--bg-hover); }
        .bi-seg button[data-active="true"] { background: var(--primary); color: var(--text-on-primary); }
        .bi-nav { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 9px; border: 1px solid var(--border-input); background: var(--bg-card); color: var(--text-secondary); cursor: pointer; transition: 0.15s; }
        .bi-nav:hover { background: var(--bg-hover); color: var(--text-main); }
        .bi-nav:disabled { opacity: 0.4; cursor: not-allowed; }
        .bi-table { width: 100%; border-collapse: collapse; }
        .bi-table th { text-align: left; font-size: 11.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); font-weight: 700; padding: 12px 16px; border-bottom: 1px solid var(--border-main); }
        .bi-table td { padding: 14px 16px; border-bottom: 1px solid var(--border-light); color: var(--text-main); font-size: 14px; }
        .bi-table tr:last-child td { border-bottom: none; }
        .bi-table tbody tr:hover { background: var(--bg-hover); }
      `}</style>

      <div className="page-with-sidebar" style={{ display: "flex", flex: 1, marginTop: "70px" }}>
        <Sidebar isOpen={isSidebarOpen} />
        <div className={`page-main ${isSidebarOpen ? "with-sidebar" : ""}`} style={{ padding: "28px", flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>

            {/* ── Đầu trang: tiêu đề + bộ chọn kỳ ── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-heading)", margin: 0, letterSpacing: "-0.02em" }}>
                  {tr("revenueTitle", "Thống kê doanh thu")}
                </h1>
                <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 13.5 }}>
                  {scope === "SYSTEM"
                    ? tr("biScopeSystem", "Toàn hệ thống VigoTrip")
                    : ownedProviders.length > 0
                      ? `${tr("biScopeProvider", "Thương hiệu bạn vận hành")}: ${ownedProviders.join(" · ")}`
                      : tr("biScopeNone", "Tài khoản chưa được gán thương hiệu nào")}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div className="bi-seg">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      data-active={period === opt.id}
                      onClick={() => choosePeriod(opt.id)}
                    >
                      {tr(opt.labelKey, opt.fallback)}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="bi-nav"
                    onClick={() => goPeriod(-1)}
                    disabled={atEarliest}
                    aria-label="Kỳ trước"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <span style={{
                    minWidth: 118, textAlign: "center", fontWeight: 700, fontSize: 14,
                    color: "var(--text-heading)",
                  }}>
                    {summary?.periodLabel || "…"}
                  </span>
                  <button
                    className="bi-nav"
                    onClick={() => goPeriod(1)}
                    disabled={atLatest}
                    aria-label="Kỳ sau"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>

                <button
                  onClick={fetchInsights}
                  disabled={!summary?.hasData}
                  style={{
                    padding: "9px 18px", borderRadius: 10, border: "none",
                    background: summary?.hasData
                      ? "linear-gradient(135deg, var(--chart-1), var(--chart-6))"
                      : "var(--bg-tag)",
                    color: summary?.hasData ? "#fff" : "var(--text-muted)",
                    fontSize: 13.5, fontWeight: 700,
                    cursor: summary?.hasData ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", gap: 8, transition: "0.2s",
                  }}
                >
                  <Sparkles size={15} /> {tr("admExecutiveAiReport", "Báo cáo AI")}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: "12px 16px", background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                color: "var(--danger)", borderRadius: 10, marginBottom: 18,
                border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)", fontSize: 14,
              }}>{error}</div>
            )}

            {/* Kỳ được chọn trống nên hệ thống đã tự lùi — nói thẳng ra, đừng để người xem
                tưởng số liệu này là của kỳ họ vừa bấm. */}
            {fallbackNotice && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px",
                background: "var(--accent-soft)", border: "1px solid var(--border-main)",
                borderRadius: 10, marginBottom: 18, fontSize: 13.5, color: "var(--text-main)",
              }}>
                <Info size={17} style={{ color: "var(--accent-strong)", flexShrink: 0, marginTop: 1 }} />
                <span>
                  <b>{fallbackNotice.requested}</b> {tr("biFallbackNote", "chưa có giao dịch nào. Đang hiển thị số liệu của")}{" "}
                  <b>{fallbackNotice.shown}</b> — {tr("biFallbackHint", "kỳ gần nhất có dữ liệu.")}
                </span>
              </div>
            )}

            {loading && (
              <div style={{ padding: 60, textAlign: "center", color: "var(--text-secondary)" }}>
                <div style={{
                  width: 34, height: 34, border: "3px solid var(--border-main)",
                  borderTopColor: "var(--primary)", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite", margin: "0 auto 14px",
                }} />
                {tr("loading", "Đang tải…")}
              </div>
            )}

            {!loading && summary && !summary.hasData && (
              <div className="bi-card" style={{ padding: 56, textAlign: "center" }}>
                <Receipt size={38} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
                <h3 style={{ margin: "0 0 6px", color: "var(--text-heading)", fontSize: 17 }}>
                  {tr("biNoDataTitle", "Chưa có giao dịch trong kỳ này")}
                </h3>
                <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
                  {ownedProviders.length === 0 && scope === "PROVIDER"
                    ? tr("biNoProviderHint", "Tài khoản chưa được gán thương hiệu nào để thống kê.")
                    : tr("biNoDataHint", "Hãy chọn kỳ khác bằng mũi tên phía trên.")}
                </p>
              </div>
            )}

            {!loading && summary?.hasData && (
              <>
                {/* ── Bốn chỉ số chính ── */}
                <div style={{
                  display: "grid", gap: 16, marginBottom: 22,
                  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                }}>
                  <KpiCard
                    icon={<Wallet size={18} />}
                    label={tr("biKpiRevenue", "Doanh thu thực thu")}
                    value={formatVnd(summary.totalRevenue)}
                    growth={summary.revenueGrowthPct}
                    comparison={`${tr("biVsPrev", "so với")} ${summary.previousPeriodLabel}`}
                    accent="var(--chart-1)"
                    highlight
                  />
                  <KpiCard
                    icon={<Receipt size={18} />}
                    label={tr("biKpiBookings", "Số đơn đặt vé")}
                    value={summary.totalBookings.toLocaleString("vi-VN")}
                    growth={summary.bookingGrowthPct}
                    comparison={`${tr("biVsPrev", "so với")} ${summary.previousPeriodLabel}`}
                    accent="var(--chart-2)"
                  />
                  <KpiCard
                    icon={<Ticket size={18} />}
                    label={tr("biKpiTickets", "Số vé bán ra")}
                    value={summary.totalTickets.toLocaleString("vi-VN")}
                    comparison={tr("biTicketsHint", "Vé đã xuất trong kỳ")}
                    accent="var(--chart-3)"
                  />
                  <KpiCard
                    icon={<TrendingUp size={18} />}
                    label={tr("biKpiTicketRevenue", "Doanh thu vé")}
                    value={formatVnd(summary.ticketRevenue)}
                    comparison={tr("biTicketRevenueHint", "Phần quy được về từng hãng & tuyến")}
                    accent="var(--chart-6)"
                  />
                </div>

                <ReconciliationBar summary={summary} tr={tr} />

                {/* ── Xu hướng trong kỳ ── */}
                <div className="bi-card" style={{ padding: "20px 22px 12px", marginBottom: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-heading)" }}>
                      {tr("biTrendTitle", "Diễn biến doanh thu")}
                    </h3>
                    <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                      {summary.periodStart} → {summary.periodEnd}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={trendData} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="biTrendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "var(--chart-axis)", fontSize: 11.5 }}
                        axisLine={{ stroke: "var(--chart-grid)" }} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tickFormatter={formatCompact} tick={{ fill: "var(--chart-axis)", fontSize: 11.5 }}
                        axisLine={false} tickLine={false} width={58} />
                      <Tooltip
                        cursor={{ stroke: "var(--chart-1)", strokeWidth: 1, strokeDasharray: "4 4" }}
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "var(--tooltip-label)", fontWeight: 600, marginBottom: 4 }}
                        formatter={(value, _name, item) => [
                          `${formatVnd(value)} · ${item?.payload?.bookings ?? 0} đơn`,
                          tr("biKpiRevenue", "Doanh thu"),
                        ]}
                      />
                      <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2.2}
                        fill="url(#biTrendFill)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* ── Cơ cấu ── */}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 1.6fr)", gap: 20, marginBottom: 22 }}>
                  <div className="bi-card" style={{ padding: "20px 22px" }}>
                    <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "var(--text-heading)" }}>
                      {tr("revenueByService", "Cơ cấu theo dịch vụ")}
                    </h3>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-muted)" }}>
                      {tr("biShareNote", "Tỷ trọng tính trên doanh thu vé")}
                    </p>
                    <ResponsiveContainer width="100%" height={210}>
                      <PieChart>
                        <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82}
                          paddingAngle={2} stroke="var(--bg-card)" strokeWidth={2}>
                          {typeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatVnd(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                      {typeData.map((item, i) => (
                        <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}>
                          <span style={{
                            width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }} />
                          <span style={{ color: "var(--text-main)", flex: 1 }}>{item.name}</span>
                          <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                            {item.share?.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bi-card" style={{ padding: "20px 22px" }}>
                    <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--text-heading)" }}>
                      {scope === "SYSTEM"
                        ? tr("admTopProvidersTitle", "Doanh thu theo nhà cung cấp")
                        : tr("biMyBrands", "Doanh thu theo thương hiệu")}
                    </h3>
                    <ResponsiveContainer width="100%" height={Math.max(210, providerData.length * 46)}>
                      <BarChart data={providerData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                        <XAxis type="number" tickFormatter={formatCompact}
                          tick={{ fill: "var(--chart-axis)", fontSize: 11.5 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={132}
                          tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: "var(--chart-track)" }} contentStyle={tooltipStyle}
                          formatter={(v) => [formatVnd(v), tr("biKpiRevenue", "Doanh thu")]} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                          {providerData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ── Top tuyến ── */}
                <div className="bi-card" style={{ overflow: "hidden" }}>
                  <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border-main)" }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-heading)" }}>
                      {tr("biTopRoutes", "Tuyến hiệu quả nhất trong kỳ")}
                    </h3>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="bi-table">
                      <thead>
                        <tr>
                          <th style={{ width: 56 }}>#</th>
                          <th>{tr("biRoute", "Tuyến")}</th>
                          <th style={{ textAlign: "right" }}>{tr("biTickets", "Số vé")}</th>
                          <th style={{ textAlign: "right" }}>{tr("biRevenue", "Doanh thu vé")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.topRoutes.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: 28 }}>
                            {tr("biNoRoutes", "Chưa có vé nào được bán trong kỳ.")}
                          </td></tr>
                        ) : summary.topRoutes.map((route, i) => (
                          <tr key={`${route.origin}-${route.destination}`}>
                            <td style={{ color: "var(--text-muted)", fontWeight: 700 }}>{i + 1}</td>
                            <td style={{ fontWeight: 600 }}>
                              {route.origin} <span style={{ color: "var(--text-muted)" }}>→</span> {route.destination}
                            </td>
                            <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>{route.tickets}</td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "var(--accent-strong)" }}>
                              {formatVnd(route.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p style={{ margin: "16px 2px 0", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  {tr("biFootnote",
                    "Doanh thu thực thu tính trên đơn đặt vé (đã gồm dịch vụ cộng thêm, đã trừ voucher) nên luôn lệch so với doanh thu vé — phần duy nhất quy được về từng hãng và từng tuyến.")}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {showAiModal && (
        <AiModal
          loading={aiLoading}
          content={aiInsights}
          periodLabel={summary?.periodLabel}
          onClose={() => setShowAiModal(false)}
          tr={tr}
        />
      )}
    </div>
  );
};

const tooltipStyle = {
  background: "var(--tooltip-bg)",
  border: "1px solid var(--tooltip-border)",
  borderRadius: 10,
  color: "var(--tooltip-text)",
  fontSize: 13,
  boxShadow: "var(--shadow-md)",
  padding: "8px 12px",
};

/** Một ô chỉ số, kèm mũi tên tăng/giảm so với kỳ liền trước. */
/**
 * Đẳng thức nối "Doanh thu thực thu" với "Doanh thu vé".
 *
 * Hai thẻ KPI đó chênh nhau vài trăm nghìn tới vài triệu và trước đây nằm cạnh nhau không
 * một lời giải thích — người xem chỉ có thể đoán là sai số. Bày thẳng đẳng thức ra thì
 * không còn gì để đoán, và cũng chặn trước đúng câu hỏi đầu tiên mà người đọc báo cáo sẽ hỏi.
 *
 * discountTotal âm nghĩa là đơn có vé huỷ lẻ đã hoàn tiền: tiền vé còn hiệu lực tụt xuống
 * trong khi tổng tiền đã thu của đơn giữ nguyên. Đảo dấu và đổi nhãn chứ không hiện
 * "giảm giá -2.000đ", vì dấu trừ của một khoản vốn đã mang nghĩa trừ thì đọc thành cộng.
 */
const ReconciliationBar = ({ summary, tr }) => {
  const discount = Number(summary.discountTotal || 0);
  const refundLike = discount < 0;

  const parts = [
    { label: tr("biKpiTicketRevenue", "Doanh thu vé"), value: summary.ticketRevenue, op: null },
    { label: tr("biServiceRevenue", "Dịch vụ bổ sung"), value: summary.serviceRevenue, op: "+" },
    {
      label: refundLike
        ? tr("biRefundAdjust", "Điều chỉnh vé huỷ")
        : tr("biDiscountTotal", "Giảm giá & voucher"),
      value: Math.abs(discount),
      op: refundLike ? "+" : "−",
    },
  ];

  return (
    <div className="bi-card" style={{
      padding: "13px 18px", marginBottom: 22, display: "flex", alignItems: "center",
      gap: 12, flexWrap: "wrap", rowGap: 8,
    }}>
      <Info size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>
        {tr("biReconTitle", "Đối soát")}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 6 }}>
        {parts.map((part) => (
          <React.Fragment key={part.label}>
            {part.op && (
              <span style={{ color: "var(--text-muted)", fontSize: 15, fontWeight: 700 }}>{part.op}</span>
            )}
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {part.label}{" "}
              <b style={{ color: "var(--text-main)", fontWeight: 700 }}>{formatVnd(part.value)}</b>
            </span>
          </React.Fragment>
        ))}
        <span style={{ color: "var(--text-muted)", fontSize: 15, fontWeight: 700 }}>=</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {tr("biKpiRevenue", "Doanh thu thực thu")}{" "}
          <b style={{ color: "var(--chart-1)", fontWeight: 800 }}>{formatVnd(summary.totalRevenue)}</b>
        </span>
      </div>
    </div>
  );
};

const KpiCard = ({ icon, label, value, growth, comparison, accent, highlight }) => {
  const hasGrowth = growth !== null && growth !== undefined;
  const up = hasGrowth && growth > 0;
  const flat = hasGrowth && growth === 0;
  const color = !hasGrowth ? "var(--text-muted)" : up ? "var(--positive)" : flat ? "var(--text-muted)" : "var(--negative)";
  const GrowthIcon = !hasGrowth || flat ? Minus : up ? TrendingUp : TrendingDown;

  return (
    <div className="bi-card" style={{ padding: "18px 20px", position: "relative", overflow: "hidden" }}>
      <span style={{ position: "absolute", inset: "0 auto 0 0", width: 3, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 9, display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          background: "var(--accent-soft)", color: accent,
        }}>{icon}</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{
        fontSize: highlight ? 25 : 22, fontWeight: 800, color: "var(--text-heading)",
        letterSpacing: "-0.02em", lineHeight: 1.15,
      }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, fontSize: 12.5 }}>
        <GrowthIcon size={14} style={{ color }} />
        <span style={{ color, fontWeight: 700 }}>
          {hasGrowth ? `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%` : "—"}
        </span>
        <span style={{ color: "var(--text-muted)" }}>{comparison}</span>
      </div>
    </div>
  );
};

/**
 * Nhận định AI. Bản cũ tô các sắc tím nhạt (#a78bfa, #c4b5fd) cắm cứng — đọc được trên nền
 * tối nhưng gần như chìm hẳn khi giao diện ở tông sáng. Giờ mọi màu đều lấy từ biến chủ đề.
 */
const AiModal = ({ loading, content, periodLabel, onClose, tr }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)",
      backdropFilter: "blur(3px)", zIndex: 3000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 720, maxWidth: "100%", maxHeight: "86vh", background: "var(--bg-modal)",
        borderRadius: 16, border: "1px solid var(--border-main)", boxShadow: "var(--shadow-lg)",
        display: "flex", flexDirection: "column", animation: "modalFadeIn 0.22s ease",
      }}
    >
      <div style={{
        padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "linear-gradient(135deg, var(--chart-1), var(--chart-6))", color: "#fff",
        borderRadius: "15px 15px 0 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Sparkles size={19} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{tr("admExecutiveAiReport", "Báo cáo AI")}</div>
            {periodLabel && <div style={{ fontSize: 12.5, opacity: 0.85 }}>{periodLabel}</div>}
          </div>
        </div>
        <button onClick={onClose} aria-label="Đóng" style={{
          background: "rgba(255,255,255,0.18)", border: "none", color: "#fff",
          width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><X size={17} /></button>
      </div>

      <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
        {loading ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{
              width: 34, height: 34, border: "3px solid var(--border-main)",
              borderTopColor: "var(--chart-1)", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 14px",
            }} />
            <p style={{ color: "var(--text-secondary)", fontWeight: 600, fontSize: 15, margin: 0 }}>
              {tr("aiAnalyzing", "AI đang phân tích…")}
            </p>
          </div>
        ) : (
          <div style={{ fontSize: 14.5, color: "var(--text-main)", lineHeight: 1.8 }}>
            {renderMarkdown(content)}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border-main)", textAlign: "right" }}>
        <button onClick={onClose} style={{
          padding: "9px 24px", borderRadius: 10, border: "none", cursor: "pointer",
          background: "var(--primary)", color: "var(--text-on-primary)", fontWeight: 700, fontSize: 13.5,
        }}>{tr("admUnderstoodBtn", "Đã hiểu")}</button>
      </div>
    </div>
  </div>
);

const renderBold = (str) => str.split(/\*\*(.*?)\*\*/g).map((part, i) =>
  i % 2 === 1
    ? <strong key={i} style={{ color: "var(--accent-strong)", fontWeight: 700 }}>{part}</strong>
    : <React.Fragment key={i}>{part}</React.Fragment>);

const renderMarkdown = (text) => (text || "").split("\n").map((line, idx) => {
  const trimmed = line.trim();
  if (!trimmed) return <div key={idx} style={{ height: 8 }} />;

  if (trimmed.startsWith("###")) {
    return <h4 key={idx} style={{ fontSize: 14.5, fontWeight: 700, color: "var(--accent-strong)", margin: "16px 0 6px" }}>
      {renderBold(trimmed.replace(/^#+\s*/, ""))}
    </h4>;
  }
  if (trimmed.startsWith("##")) {
    return <h3 key={idx} style={{
      fontSize: 16, fontWeight: 700, color: "var(--text-heading)", margin: "20px 0 8px",
      borderBottom: "1px solid var(--border-light)", paddingBottom: 6,
    }}>{renderBold(trimmed.replace(/^#+\s*/, ""))}</h3>;
  }
  if (trimmed.startsWith("#")) {
    return <h2 key={idx} style={{ fontSize: 17.5, fontWeight: 800, color: "var(--text-heading)", margin: "20px 0 10px" }}>
      {renderBold(trimmed.replace(/^#+\s*/, ""))}
    </h2>;
  }
  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
    return <div key={idx} style={{ display: "flex", gap: 9, margin: "5px 0" }}>
      <span style={{ color: "var(--chart-1)", flexShrink: 0 }}>▸</span>
      <span style={{ flex: 1 }}>{renderBold(trimmed.slice(2))}</span>
    </div>;
  }
  const numbered = trimmed.match(/^(\d+)\.\s*(.*)/);
  if (numbered) {
    return <div key={idx} style={{ display: "flex", gap: 9, margin: "5px 0" }}>
      <span style={{ fontWeight: 700, color: "var(--chart-1)", flexShrink: 0 }}>{numbered[1]}.</span>
      <span style={{ flex: 1 }}>{renderBold(numbered[2])}</span>
    </div>;
  }
  return <p key={idx} style={{ margin: "6px 0" }}>{renderBold(trimmed)}</p>;
});

export default AdminRevenue;
