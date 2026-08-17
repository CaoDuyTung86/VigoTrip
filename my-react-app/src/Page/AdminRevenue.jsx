import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import Header from "../LayOut/Header";
import { useLanguage } from "../context/LanguageContext";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { Sparkles, DollarSign, TrendingUp } from 'lucide-react';

const AdminRevenue = () => {
  const { token } = useAuth();
  const [revenues, setRevenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { t } = useLanguage();

  const [aiInsights, setAiInsights] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);

  useEffect(() => {
    if (token) {
      fetchRevenue();
    }
  }, [token]);

  const fetchRevenue = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/revenue", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch revenue");
      const data = await res.json();
      setRevenues(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInsights = async (providerId) => {
    try {
      setAnalyzingId(providerId);
      setAiInsights(null);
      setShowAiModal(true);
      const res = await fetch(`/api/analytics/provider/${providerId}/ai-insights`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch AI insights");
      const data = await res.json();
      setAiInsights(data.insights);
    } catch (err) {
      setAiInsights(t.admAiLoadError.replace("{msg}", err.message));
    } finally {
      setAnalyzingId(null);
    }
  };

  const fetchSystemAIInsights = async () => {
    try {
      setAnalyzingId("system");
      setAiInsights(null);
      setShowAiModal(true);
      const res = await fetch(`/api/analytics/system/ai-insights`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch system AI insights");
      const data = await res.json();
      setAiInsights(data.insights);
    } catch (err) {
      setAiInsights(t.admAiLoadError.replace("{msg}", err.message));
    } finally {
      setAnalyzingId(null);
    }
  };

  const renderInsights = (text) => {
    if (!text) return null;
    return text.split("\n").map((line, idx) => {
      let trimmed = line.trim();
      if (!trimmed) return <div key={idx} style={{ height: 10 }} />;

      const parseBold = (str) => {
        const parts = str.split(/\*\*(.*?)\*\*/g);
        return parts.map((part, i) =>
          i % 2 === 1
            ? <strong key={i} style={{ color: "#a78bfa", fontWeight: 700 }}>{part}</strong>
            : part
        );
      };

      if (trimmed.startsWith("###")) {
        return <h4 key={idx} style={{ fontSize: 15, fontWeight: 700, color: "#c4b5fd", marginTop: 16, marginBottom: 6, letterSpacing: "0.02em" }}>{parseBold(trimmed.replace(/^###\s*/, ""))}</h4>;
      }
      if (trimmed.startsWith("##")) {
        return <h3 key={idx} style={{ fontSize: 17, fontWeight: 700, color: "var(--text-heading)", marginTop: 20, marginBottom: 8, borderBottom: "1px solid var(--border-light)", paddingBottom: 6 }}>{parseBold(trimmed.replace(/^##\s*/, ""))}</h3>;
      }
      if (trimmed.startsWith("#")) {
        return <h2 key={idx} style={{ fontSize: 18, fontWeight: 800, color: "var(--text-heading)", marginTop: 22, marginBottom: 10 }}>{parseBold(trimmed.replace(/^#\s*/, ""))}</h2>;
      }
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        return (
          <div key={idx} style={{ display: "flex", gap: 10, margin: "5px 0", paddingLeft: 8 }}>
            <span style={{ color: "#a78bfa", flexShrink: 0, marginTop: 2 }}>▸</span>
            <span style={{ flex: 1, color: "var(--text-main)" }}>{parseBold(trimmed.replace(/^[-*]\s*/, ""))}</span>
          </div>
        );
      }
      if (/^\d+\./.test(trimmed)) {
        const match = trimmed.match(/^(\d+)\.\s*(.*)/);
        return (
          <div key={idx} style={{ display: "flex", gap: 10, margin: "10px 0", background: "rgba(99, 102, 241, 0.08)", padding: "10px 14px", borderRadius: 10, borderLeft: "3px solid #818cf8" }}>
            <span style={{ fontWeight: 700, color: "#818cf8", flexShrink: 0 }}>{match[1]}.</span>
            <span style={{ flex: 1, color: "var(--text-main)" }}>{parseBold(match[2])}</span>
          </div>
        );
      }
      return <p key={idx} style={{ margin: "6px 0", color: "var(--text-main)", lineHeight: 1.75 }}>{parseBold(trimmed)}</p>;
    });
  };


  const totalRevenue = revenues.reduce((sum, item) => sum + (item.totalRevenue || 0), 0);

  const getMappedType = (type) => {
    const t_local = (type || "").toLowerCase();
    if (t_local.includes("flight") || t_local.includes("air") || t_local.includes("máy bay")) return t.flight;
    if (t_local.includes("bus") || t_local.includes("coach") || t_local.includes("xe khách")) return t.bus;
    return t.train;
  };

  const revenueByTypeMap = { [t.flight]: 0, [t.bus]: 0, [t.train]: 0 };
  revenues.forEach(item => {
    const t_type = getMappedType(item.providerType);
    revenueByTypeMap[t_type] += (item.totalRevenue || 0);
  });

  const pieData = [
    { name: t.flight, value: revenueByTypeMap[t.flight] },
    { name: t.bus, value: revenueByTypeMap[t.bus] },
    { name: t.train, value: revenueByTypeMap[t.train] }
  ].filter(d => d.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

  const topProviders = [...revenues]
    .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
    .slice(0, 5)
    .map(item => ({
      name: item.providerName,
      [t.revenueCol]: item.totalRevenue || 0
    }));

  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)", display: "flex", flexDirection: "column" }}>
      <Header setIsSidebarOpen={setIsSidebarOpen} />

      {showAiModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(6px)" }}>
          <div style={{ background: "var(--bg-card)", width: "100%", maxWidth: 820, maxHeight: "90vh", display: "flex", flexDirection: "column", borderRadius: 20, boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(99,102,241,0.2)", overflow: "hidden", animation: "modalFadeIn 0.3s ease-out" }}>
            {/* Header */}
            <div style={{ padding: "20px 28px", background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                <Sparkles size={22} /> {t.aiInsights}
              </h2>
              <button onClick={() => setShowAiModal(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, fontWeight: 700, transition: "0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.35)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}>×</button>
            </div>
            {/* Body - scrollable */}
            <div style={{ padding: "24px 30px", overflowY: "auto", flex: 1 }}>
              {analyzingId ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ width: 56, height: 56, border: "4px solid var(--border-light)", borderTopColor: "#818cf8", borderRadius: "50%", margin: "0 auto 20px", animation: "spin 1s linear infinite" }} />
                  <p style={{ color: "var(--text-secondary)", fontWeight: 600, fontSize: 17 }}>{t.aiAnalyzing}</p>
                  <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6 }}>{t.admPleaseWait}</p>
                </div>
              ) : (
                <div style={{ fontSize: 14.5, color: "var(--text-main)", lineHeight: 1.8 }}>
                  {renderInsights(aiInsights)}
                </div>
              )}
            </div>
            {/* Footer */}
            <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "flex-end", backgroundColor: "var(--bg-main)", flexShrink: 0 }}>
              <button onClick={() => setShowAiModal(false)} style={{ padding: "10px 28px", borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none", fontWeight: 700, color: "white", cursor: "pointer", fontSize: 14, boxShadow: "0 4px 14px rgba(99,102,241,0.35)", transition: "0.2s" }}>{t.admUnderstoodBtn}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="page-with-sidebar" style={{ display: "flex", flex: 1, marginTop: "70px" }}>
        <Sidebar isOpen={isSidebarOpen} />
        <div className={`page-main ${isSidebarOpen ? "with-sidebar" : ""}`} style={{ padding: "30px", flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-heading)", margin: 0 }}>{t.revenueTitle}</h1>
              <button
                onClick={fetchSystemAIInsights}
                style={{
                  padding: "10px 20px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(99, 102, 241, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                <Sparkles size={16} /> {t.admExecutiveAiReport}
              </button>
            </div>

            {error && <div style={{ padding: 16, background: "rgba(220, 38, 38, 0.1)", color: "var(--danger)", borderRadius: 8, marginBottom: 20, border: "1px solid rgba(220, 38, 38, 0.2)" }}>{error}</div>}

            {/* Total Revenue Summary Card */}
            <div style={{ background: "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)", padding: 30, borderRadius: 16, boxShadow: "0 10px 25px rgba(59, 130, 246, 0.2)", marginBottom: 30, display: "flex", alignItems: "center", gap: 24, color: "white" }}>
              <div style={{ width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}><TrendingUp size={36} /></div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, opacity: 0.9 }}>{t.totalRevenue.toUpperCase()}</div>
                <div style={{ fontSize: 40, fontWeight: 800 }}>{totalRevenue.toLocaleString("vi-VN")} đ</div>
              </div>
            </div>

            {/* Charts Section */}
            {!loading && revenues.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", marginBottom: "30px" }}>

                {/* Pie Chart: Revenue by Service Type */}
                <div style={{ background: "var(--bg-card)", padding: "24px", borderRadius: "16px", boxShadow: "var(--shadow-md)", border: "1px solid var(--border-light)" }}>
                  <h3 style={{ fontSize: "17px", fontWeight: "600", marginBottom: "20px", color: "var(--text-heading)", textAlign: "center" }}>{t.revenueByService}</h3>
                  <div style={{ height: "300px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#818cf8', '#34d399', '#fbbf24'][index % 3]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => formatCurrency(value)}
                          contentStyle={{ background: "rgba(30, 27, 75, 0.95)", border: "1px solid rgba(129,140,248,0.3)", borderRadius: 10, color: "#e2e8f0", fontSize: 13, backdropFilter: "blur(8px)" }}
                          itemStyle={{ color: "#c4b5fd" }}
                          labelStyle={{ color: "#94a3b8", fontWeight: 600 }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value) => <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar Chart: Top Providers */}
                <div style={{ background: "var(--bg-card)", padding: "24px", borderRadius: "16px", boxShadow: "var(--shadow-md)", border: "1px solid var(--border-light)" }}>
                  <h3 style={{ fontSize: "17px", fontWeight: "600", marginBottom: "20px", color: "var(--text-heading)" }}>{t.admTopProvidersTitle}</h3>
                  <div style={{ height: "300px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topProviders}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#818cf8" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(148,163,184,0.1)" />
                        <XAxis type="number" tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(148,163,184,0.15)' }} />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(value) => formatCurrency(value)}
                          cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                          contentStyle={{ background: "rgba(30, 27, 75, 0.95)", border: "1px solid rgba(129,140,248,0.3)", borderRadius: 10, color: "#e2e8f0", fontSize: 13, backdropFilter: "blur(8px)" }}
                          itemStyle={{ color: "#a78bfa" }}
                          labelStyle={{ color: "#cbd5e1", fontWeight: 600 }}
                        />
                        <Bar dataKey={t.revenueCol} fill="url(#barGradient)" radius={[0, 6, 6, 0]} barSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Data Table */}
            <div style={{ background: "var(--bg-card)", borderRadius: 16, boxShadow: "var(--shadow-md)", overflow: "hidden", border: "1px solid var(--border-light)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 10 }}>
                <DollarSign size={20} style={{ color: "#818cf8" }} />
                <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text-heading)", margin: 0 }}>{t.revenueByService}</h3>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(99,102,241,0.06)", textAlign: "left" }}>
                    <th style={{ padding: "14px 24px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.admProviderIdCol}</th>
                    <th style={{ padding: "14px 24px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.providerCol}</th>
                    <th style={{ padding: "14px 24px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.admServiceTypeCol}</th>
                    <th style={{ padding: "14px 24px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>{t.totalRevenue}</th>
                    <th style={{ padding: "14px 24px", fontWeight: 600, color: "#94a3b8", fontSize: 13, borderBottom: "1px solid var(--border-light)", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center" }}>{t.admActionCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>{t.admLoadingData}</td></tr>
                  ) : revenues.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>{t.admNoData}</td></tr>
                  ) : (
                    [...revenues]
                      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
                      .map((item) => {
                        const serviceType = getMappedType(item.providerType);
                        const isPlane = serviceType === t.flight;
                        const isBus = serviceType === t.bus;
                        const badgeBg = isPlane ? "rgba(99,102,241,0.15)" : isBus ? "rgba(52,211,153,0.15)" : "rgba(251,191,36,0.15)";
                        const badgeColor = isPlane ? "#a5b4fc" : isBus ? "#6ee7b7" : "#fcd34d";
                        return (
                          <tr key={item.providerId} style={{ borderBottom: "1px solid var(--border-light)", transition: "0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,0.04)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <td style={{ padding: "14px 24px", color: "#64748b", fontSize: "13px", fontWeight: "500", fontFamily: "monospace" }}>#{item.providerId}</td>
                            <td style={{ padding: "14px 24px", fontWeight: 600, color: "var(--text-heading)", fontSize: 14 }}>{item.providerName}</td>
                            <td style={{ padding: "14px 24px" }}>
                              <span style={{
                                padding: "4px 12px",
                                borderRadius: "20px",
                                fontSize: "12px",
                                fontWeight: "600",
                                backgroundColor: badgeBg,
                                color: badgeColor,
                                border: `1px solid ${badgeColor}33`
                              }}>
                                {serviceType}
                              </span>
                            </td>
                            <td style={{ padding: "14px 24px", fontWeight: 700, color: "#a5b4fc", textAlign: "right", fontSize: 14, fontFamily: "monospace" }}>
                              {formatCurrency(item.totalRevenue || 0)}
                            </td>
                            <td style={{ padding: "14px 24px", textAlign: "center" }}>
                              <button
                                onClick={() => fetchAIInsights(item.providerId)}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: "8px",
                                  border: "1px solid rgba(129,140,248,0.3)",
                                  background: "rgba(99,102,241,0.1)",
                                  color: "#a5b4fc",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  transition: "0.2s"
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.2)"; e.currentTarget.style.borderColor = "rgba(129,140,248,0.5)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.1)"; e.currentTarget.style.borderColor = "rgba(129,140,248,0.3)"; }}
                              >
                                <Sparkles size={13} /> {t.getAIInsights}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRevenue;
