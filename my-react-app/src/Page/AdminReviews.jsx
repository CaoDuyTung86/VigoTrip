import React, { useEffect, useState } from "react";
import axios from "axios";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const AdminReviews = () => {
  const { t } = useLanguage();
  const { user, token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isAuthenticated || (user?.role !== "ROLE_PROVIDER" && user?.role !== "ROLE_ADMIN")) {
      navigate("/");
      return;
    }

    const fetchReviews = async () => {
      try {
        const res = await axios.get("/api/reviews/all", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setReviews(res.data);
      } catch (err) {
        console.error(err);
        setError(t.admReviewsLoadError);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [isAuthenticated, user, token, navigate]);

  const filteredReviews = reviews.filter(r => 
    (r.providerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.tripOrigin || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.tripDestination || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.comment || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: "40px", marginTop: "80px", background: "var(--bg-main)", minHeight: "100vh" }}>
      <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "20px", color: "var(--text-main)" }}>
        {t.providerReviews}
      </h2>
      
      <div style={{ marginBottom: "20px" }}>
        <input 
          type="text" 
          placeholder={t.searchPlaceholder} 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ padding: "10px", width: "300px", borderRadius: "8px", border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-main)" }}
        />
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
      
      {loading ? (
        <p>{t.admLoading}</p>
      ) : (
        <div style={{ background: "var(--bg-card)", borderRadius: "12px", boxShadow: "var(--shadow-md)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-hover)", textAlign: "left", color: "var(--text-muted)", fontSize: "14px" }}>
                <th style={{ padding: "16px", borderBottom: "1px solid var(--border-light)" }}>ID</th>
                <th style={{ padding: "16px", borderBottom: "1px solid var(--border-light)" }}>{t.userCol}</th>
                <th style={{ padding: "16px", borderBottom: "1px solid var(--border-light)" }}>{t.providerCol}</th>
                <th style={{ padding: "16px", borderBottom: "1px solid var(--border-light)" }}>{t.journeyCol}</th>
                <th style={{ padding: "16px", borderBottom: "1px solid var(--border-light)" }}>{t.rating}</th>
                <th style={{ padding: "16px", borderBottom: "1px solid var(--border-light)" }}>{t.commentText}</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>{t.noReviews}</td></tr>
              ) : (
                filteredReviews.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border-light)", fontSize: "14px", color: "var(--text-main)" }}>
                    <td style={{ padding: "16px" }}>#{r.id}</td>
                    <td style={{ padding: "16px", fontWeight: 600 }}>{r.userName}</td>
                    <td style={{ padding: "16px", color: "#ff6b00", fontWeight: 600 }}>{r.providerName || "N/A"}</td>
                    <td style={{ padding: "16px" }}>{r.tripOrigin} → {r.tripDestination}</td>
                    <td style={{ padding: "16px", color: "#f59e0b", fontWeight: "bold" }}>{"⭐".repeat(r.rating)}</td>
                    <td style={{ padding: "16px", maxWidth: "300px" }}>{r.comment}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminReviews;
