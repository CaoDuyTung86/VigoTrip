import React, { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { User, Lock, Award, Settings } from "lucide-react";

const API = "";

const MEMBERSHIP_CONFIG = {
  "Đồng":     { color: "#b45309", bg: "#fef3c7", icon: "🥉", next: "Bạc",      nextPoints: 100 },
  "Bạc":      { color: "#6b7280", bg: "#f3f4f6", icon: "🥈", next: "Vàng",     nextPoints: 500 },
  "Vàng":     { color: "#d97706", bg: "#fff7ed", icon: "🥇", next: "Kim Cương", nextPoints: 2000 },
  "Kim Cương":{ color: "#7c3aed", bg: "#f5f3ff", icon: "💎", next: null,        nextPoints: null },
};

const AccountPage = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

 
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const token = localStorage.getItem("authToken");
  const { isDark, toggleTheme } = useTheme();
  const { t } = useLanguage();

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(res.data);
      setFullName(res.data.fullName || "");
      setPhone(res.data.phone || "");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg(null);
    try {
      await axios.put(`${API}/api/users/me`, { fullName, phone }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfileMsg({ type: "success", text: t.acctProfileUpdateSuccess });
      fetchProfile();
    } catch (err) {
      setProfileMsg({ type: "error", text: err.response?.data?.message || t.acctProfileUpdateFailed });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: "error", text: t.acctPwdMismatch });
      return;
    }
    if (newPwd.length < 8) {
      setPwdMsg({ type: "error", text: t.acctPwdMinLength });
      return;
    }
    setPwdLoading(true);
    setPwdMsg(null);
    try {
      await axios.put(`${API}/api/users/me/password`, { oldPassword: oldPwd, newPassword: newPwd }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPwdMsg({ type: "success", text: t.acctPwdChangeSuccess });
      setOldPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      setPwdMsg({ type: "error", text: err.response?.data?.message || t.acctPwdChangeFailed });
    } finally {
      setPwdLoading(false);
    }
  };

  const tabStyle = (tab) => ({
    padding: "12px 22px",
    border: "none",
    borderBottom: activeTab === tab ? "3px solid #60a5fa" : "3px solid transparent",
    background: activeTab === tab ? "rgba(96, 165, 250, 0.1)" : "none",
    fontWeight: activeTab === tab ? 700 : 500,
    color: activeTab === tab ? "#60a5fa" : "var(--text-secondary)",
    textShadow: activeTab === tab ? "0 0 10px rgba(96, 165, 250, 0.5)" : "none",
    cursor: "pointer",
    fontSize: 15,
    display: "flex",
    alignItems: "center",
    gap: 8,
    transition: "all 0.2s",
  });

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 8, border: "1.5px solid var(--border-input)",
    fontSize: 15, outline: "none", boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text-main)",
  };

  const labelStyle = { display: "block", fontWeight: 600, fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 };

  const msgBox = (msg) => msg && (
    <div style={{
      padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600,
      background: msg.type === "success" ? "#dcfce7" : "#fee2e2",
      color: msg.type === "success" ? "#16a34a" : "#dc2626",
      border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
    }}>
      {msg.type === "success" ? "✅" : "⚠️ "}{msg.text}
    </div>
  );

  const renderMembership = () => {
    if (!profile) return null;
    const tierLabel = (name) => ({ "Đồng": t.acctTierBronze, "Bạc": t.acctTierSilver, "Vàng": t.acctTierGold, "Kim Cương": t.acctTierDiamond })[name] || name;
    const points = profile.points || 0;
    const level = profile.membershipLevel || "Đồng";
    const cfg = MEMBERSHIP_CONFIG[level] || MEMBERSHIP_CONFIG["Đồng"];
    const nextPoints = cfg.nextPoints;
    const prevPoints = level === "Đồng" ? 0 : level === "Bạc" ? 100 : level === "Vàng" ? 500 : 2000;
    const progress = nextPoints ? Math.min(100, ((points - prevPoints) / (nextPoints - prevPoints)) * 100) : 100;

    const tiers = [
      { name: "Đồng", icon: "🥉", min: 0, discount: "0%", color: "#b45309" },
      { name: "Bạc", icon: "🥈", min: 100, discount: "5%", color: "#6b7280" },
      { name: "Vàng", icon: "🥇", min: 500, discount: "10%", color: "#d97706" },
      { name: "Kim Cương", icon: "💎", min: 2000, discount: "15%", color: "#7c3aed" },
    ];

    return (
      <div>
        {/* Current Level Card */}
        <div style={{ background: cfg.bg, border: `2px solid ${cfg.color}30`, borderRadius: 16, padding: 24, marginBottom: 24, textAlign: "center" }}>
          <div style={{ fontSize: 56 }}>{cfg.icon}</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: cfg.color, margin: "8px 0 4px" }}>{t.acctRankLabel.replace('{level}', tierLabel(level))}</h2>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 16 }}>
            {t.acctYouHave} <strong style={{ color: "#4f46e5", fontSize: 18 }}>{points.toLocaleString()}</strong> {t.acctPointsUnit}
          </p>
          {cfg.next && (
            <>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
                {t.acctNeedMore} <strong>{(nextPoints - points).toLocaleString()}</strong> {t.acctPointsToNext} <strong>{tierLabel(cfg.next)} {MEMBERSHIP_CONFIG[cfg.next]?.icon}</strong>
              </div>
              <div style={{ background: "#e5e7eb", borderRadius: 99, height: 10, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}cc)`, height: "100%", borderRadius: 99, transition: "width 0.5s" }} />
              </div>
            </>
          )}
          {!cfg.next && <div style={{ color: "#7c3aed", fontWeight: 700, fontSize: 15 }}>{t.acctHighestRank}</div>}
        </div>

        {/* Tier Table */}
        <h3 style={{ fontWeight: 700, color: "var(--text-heading)", marginBottom: 12 }}>{t.acctTierTable}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {tiers.map(tier => (
            <div key={tier.name} style={{
              padding: "16px 12px", borderRadius: 12, textAlign: "center",
              background: tier.name === level ? `${tier.color}15` : "#f9fafb",
              border: tier.name === level ? `2px solid ${tier.color}` : "2px solid #e5e7eb",
              transition: "0.2s",
            }}>
              <div style={{ fontSize: 28 }}>{tier.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: tier.color, marginTop: 4 }}>{tierLabel(tier.name)}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>≥ {tier.min.toLocaleString()} {t.acctPointsUnit}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#16a34a", marginTop: 4 }}>{t.acctDiscount} {tier.discount}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, padding: 16, background: "var(--bg-accent)", borderRadius: 12, fontSize: 13, color: "#1e40af" }}>
          💡 <strong>{t.acctHowToEarn}</strong> {t.acctEarnEach} <strong>10,000đ</strong> {t.acctEarnFor} <strong>{t.acctEarnPoint}</strong>. {t.acctEarnSuffix}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-main)", transition: "background-color 0.3s" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 70 }}>
        <div style={{ maxWidth: 680, margin: "40px auto", width: "100%", padding: "0 20px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-heading)", marginBottom: 24 }}>{t.acctPageTitle}</h1>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-light)", marginBottom: 24, background: "var(--bg-card)", borderRadius: "12px 12px 0 0", overflow: "hidden", flexWrap: "wrap" }}>
            <button style={tabStyle("profile")} onClick={() => setActiveTab("profile")}>
              <User size={16} /> {t.acctTabInfo}
            </button>
            <button style={tabStyle("password")} onClick={() => setActiveTab("password")}>
              <Lock size={16} /> {t.password}
            </button>
            <button style={tabStyle("membership")} onClick={() => setActiveTab("membership")}>
              <Award size={16} /> {t.acctTabRank}
            </button>
            <button style={tabStyle("settings")} onClick={() => setActiveTab("settings")}>
              <Settings size={16} /> {t.acctTabSettings}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>{t.loadingCalendar}</div>
          ) : (
            <div style={{ background: "var(--bg-card)", borderRadius: "0 0 12px 12px", padding: 28, boxShadow: "var(--shadow-md)", transition: "background-color 0.3s" }}>

              {/* TAB: PROFILE */}
              {activeTab === "profile" && (
                <form onSubmit={handleUpdateProfile}>
                  <h2 style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, color: "var(--text-heading)" }}>{t.acctPersonalInfo}</h2>
                  {msgBox(profileMsg)}

                  <div style={{ marginBottom: 18 }}>
                    <label style={labelStyle}>Email</label>
                    <input style={{ ...inputStyle, background: "var(--bg-main)", color: "#6b7280" }} value={profile?.email || ""} readOnly />
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{t.acctEmailImmutable}</div>
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={labelStyle}>{t.acctFullName} <span style={{ color: "#ef4444" }}>*</span></label>
                    <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t.acctFullNamePlaceholder} required />
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <label style={labelStyle}>{t.acctPhoneLabel}</label>
                    <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="0xxxxxxxxx" />
                  </div>

                  <button disabled={profileLoading} type="submit" style={{
                    width: "100%", padding: "13px", borderRadius: 10, border: "none",
                    background: profileLoading ? "#a5b4fc" : "#4f46e5", color: "#fff",
                    fontWeight: 700, fontSize: 15, cursor: profileLoading ? "not-allowed" : "pointer",
                  }}>
                    {profileLoading ? t.acctSaving : t.acctSaveChanges}
                  </button>
                </form>
              )}

              {/* TAB: PASSWORD */}
              {activeTab === "password" && (
                <form onSubmit={handleChangePassword}>
                  <h2 style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, color: "var(--text-heading)" }}>
                    {profile?.hasPassword === false ? t.acctCreateNewPwd : t.acctChangePwd}
                  </h2>
                  {msgBox(pwdMsg)}

                  {[
                    ...(profile?.hasPassword !== false ? [{ label: t.acctCurrentPwd, val: oldPwd, set: setOldPwd, ph: t.acctCurrentPwdPh }] : []),
                    { label: t.acctNewPwd, val: newPwd, set: setNewPwd, ph: t.acctNewPwdPh },
                    { label: t.acctConfirmNewPwd, val: confirmPwd, set: setConfirmPwd, ph: t.acctConfirmNewPwdPh },
                  ].map(({ label, val, set, ph }) => (
                    <div key={label} style={{ marginBottom: 18 }}>
                      <label style={labelStyle}>{label} <span style={{ color: "#ef4444" }}>*</span></label>
                      <input type="password" style={inputStyle} value={val} onChange={e => set(e.target.value)} placeholder={ph} required />
                    </div>
                  ))}

                  <div style={{ fontSize: 13, color: "#6b7280", background: "#f0f9ff", padding: "10px 14px", borderRadius: 8, marginBottom: 20 }}>
                    🔒 {t.acctPwdReloginNotice}
                  </div>

                  <button disabled={pwdLoading} type="submit" style={{
                    width: "100%", padding: "13px", borderRadius: 10, border: "none",
                    background: pwdLoading ? "#a5b4fc" : "#4f46e5", color: "#fff",
                    fontWeight: 700, fontSize: 15, cursor: pwdLoading ? "not-allowed" : "pointer",
                  }}>
                    {pwdLoading ? t.processing : (profile?.hasPassword === false ? t.acctCreatePwd : t.acctChangePwd)}
                  </button>
                </form>
              )}

              {/* TAB: MEMBERSHIP */}
              {activeTab === "membership" && renderMembership()}

              {/* TAB: SETTINGS */}
              {activeTab === "settings" && (
                <div>
                  <h2 style={{ fontWeight: 800, fontSize: 17, marginBottom: 20, color: "var(--text-heading)" }}>{t.acctSettingsTitle}</h2>
                  
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "20px 24px", borderRadius: 12,
                    background: "var(--bg-input)", border: "1.5px solid var(--border-main)",
                    transition: "background-color 0.3s",
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)", marginBottom: 4 }}>
                        {isDark ? t.acctDarkMode : t.acctLightMode}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        {isDark ? t.acctDarkModeDesc : t.acctLightModeDesc}
                      </div>
                    </div>
                    <button
                      onClick={toggleTheme}
                      style={{
                        width: 56, height: 30, borderRadius: 15,
                        border: "none", cursor: "pointer",
                        background: isDark ? "var(--primary)" : "#ccc",
                        position: "relative", transition: "background 0.3s",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "var(--bg-card)", position: "absolute",
                        top: 3, left: isDark ? 29 : 3,
                        transition: "left 0.3s",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </div>

                  <div style={{ marginTop: 16, padding: 16, background: "var(--bg-accent)", borderRadius: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                    💡 {t.acctSettingsAutoSave}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountPage;
