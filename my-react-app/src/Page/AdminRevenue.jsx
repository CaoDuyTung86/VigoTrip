import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import Header from "../LayOut/Header";
import { useLanguage } from "../context/LanguageContext";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
      setAiInsights("Lỗi khi tải nhận định từ AI: " + err.message);
    } finally {
      setAnalyzingId(null);
    }
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
      "Doanh thu": item.totalRevenue || 0
    }));

  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-main)", display: "flex", flexDirection: "column" }}>
      <Header setIsSidebarOpen={setIsSidebarOpen} />
      
      {showAiModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--bg-card)", width: "100%", maxWidth: 700, borderRadius: 24, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", overflow: "hidden", animation: "modalFadeIn 0.3s ease-out" }}>
            <div style={{ padding: "24px 30px", background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>✨</span> {t.aiInsights}
              </h2>
              <button onClick={() => setShowAiModal(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.3)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}>×</button>
            </div>
            <div style={{ padding: 40, maxHeight: "65vh", overflowY: "auto" }}>
              {analyzingId ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div className="ai-loader" style={{ width: 60, height: 60, border: "5px solid #f1f5f9", borderTopColor: "#6366f1", borderRadius: "50%", margin: "0 auto 24px", animation: "spin 1s linear infinite" }}></div>
                  <p style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 18 }}>{t.aiAnalyzing}</p>
                  <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 8 }}>Vui lòng đợi trong giây lát</p>
                </div>
              ) : (
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, color: "var(--text-main)", fontSize: 16, textAlign: "justify" }}>
                  {aiInsights}
                </div>
              )}
            </div>
            <div style={{ padding: "20px 30px", borderTop: "1px solid var(--border-light)", textAlign: "right", backgroundColor: "var(--bg-hover)" }}>
              <button onClick={() => setShowAiModal(false)} style={{ padding: "12px 30px", borderRadius: 12, background: "var(--primary)", border: "none", fontWeight: 700, color: "white", cursor: "pointer", boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)" }}>Đã hiểu</button>
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
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, color: "var(--text-heading)" }}>{t.revenueTitle}</h1>
            
            {error && <div style={{ padding: 16, background: "rgba(220, 38, 38, 0.1)", color: "var(--danger)", borderRadius: 8, marginBottom: 20, border: "1px solid rgba(220, 38, 38, 0.2)" }}>{error}</div>}
            
            {/* Total Revenue Summary Card */}
            <div style={{ background: "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)", padding: 30, borderRadius: 16, boxShadow: "0 10px 25px rgba(59, 130, 246, 0.2)", marginBottom: 30, display: "flex", alignItems: "center", gap: 24, color: "white" }}>
              <div style={{ width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>💰</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, opacity: 0.9 }}>{t.totalRevenue.toUpperCase()}</div>
                <div style={{ fontSize: 40, fontWeight: 800 }}>{totalRevenue.toLocaleString("vi-VN")} đ</div>
              </div>
            </div>

            {/* Charts Section */}
            {!loading && revenues.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", marginBottom: "30px" }}>
                
                {/* Pie Chart: Revenue by Service Type */}
                <div style={{ background: "var(--bg-card)", padding: "24px", borderRadius: "16px", boxShadow: "var(--shadow-md)" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "var(--text-heading)", textAlign: "center" }}>{t.revenueByService}</h3>
                  <div style={{ height: "300px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar Chart: Top Providers */}
                <div style={{ background: "var(--bg-card)", padding: "24px", borderRadius: "16px", boxShadow: "var(--shadow-md)" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "var(--text-heading)" }}>Top 5 Nhà cung cấp doanh thu cao nhất</h3>
                  <div style={{ height: "300px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topProviders}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border-light)" />
                        <XAxis type="number" tickFormatter={(val) => `${(val/1000000).toFixed(1)}M`} stroke="var(--text-muted)" />
                        <YAxis dataKey="name" type="category" width={100} tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
                        <Tooltip formatter={(value) => formatCurrency(value)} cursor={{fill: 'transparent'}} />
                        <Bar dataKey="Doanh thu" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Data Table */}
            <div style={{ background: "var(--bg-card)", borderRadius: 16, boxShadow: "var(--shadow-md)", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-light)" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-heading)", margin: 0 }}>{t.revenueByService}</h3>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-hover)", textAlign: "left" }}>
                    <th style={{ padding: "16px 24px", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)" }}>Mã NCC</th>
                    <th style={{ padding: "16px 24px", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)" }}>{t.providerCol}</th>
                    <th style={{ padding: "16px 24px", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)" }}>Loại dịch vụ</th>
                    <th style={{ padding: "16px 24px", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)", textAlign: "right" }}>{t.totalRevenue}</th>
                    <th style={{ padding: "16px 24px", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border-light)", textAlign: "center" }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Đang tải dữ liệu...</td></tr>
                  ) : revenues.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Không có dữ liệu</td></tr>
                  ) : (
                    [...revenues]
                      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
                      .map((item, index) => (
                        <tr key={item.providerId} style={{ borderBottom: "1px solid var(--border-light)", transition: "0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "16px 24px", color: "var(--text-muted)", fontSize: "14px", fontWeight: "600" }}>ID_{item.providerId}</td>
                        <td style={{ padding: "16px 24px", fontWeight: 600, color: "var(--text-heading)" }}>{item.providerName}</td>
                        <td style={{ padding: "16px 24px", color: "#64748b" }}>
                          <span style={{ 
                            padding: "4px 10px", 
                            borderRadius: "20px", 
                            fontSize: "12px", 
                            fontWeight: "500",
                            backgroundColor: getMappedType(item.providerType) === t.flight ? "#dbeafe" : getMappedType(item.providerType) === t.bus ? "#dcfce7" : "#fef3c7",
                            color: getMappedType(item.providerType) === t.flight ? "#1e40af" : getMappedType(item.providerType) === t.bus ? "#166534" : "#b45309"
                          }}>
                            {getMappedType(item.providerType)}
                          </span>
                        </td>
                        <td style={{ padding: "16px 24px", fontWeight: 700, color: "var(--text-heading)", textAlign: "right" }}>
                          {formatCurrency(item.totalRevenue || 0)}
                        </td>
                        <td style={{ padding: "16px 24px", textAlign: "center" }}>
                          <button 
                            onClick={() => fetchAIInsights(item.providerId)}
                            style={{ 
                              padding: "6px 12px", 
                              borderRadius: "8px", 
                              border: "none", 
                              background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", 
                              color: "white", 
                              fontSize: "12px", 
                              fontWeight: "600", 
                              cursor: "pointer",
                              boxShadow: "0 2px 4px rgba(99, 102, 241, 0.2)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <span>✨</span> {t.getAIInsights}
                          </button>
                        </td>
                      </tr>
                    ))
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
