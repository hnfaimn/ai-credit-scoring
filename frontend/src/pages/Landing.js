import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser, resetPassword } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { STRINGS, t } from "../lang/strings";
import { CheckCircle2, AlertCircle, Globe, Mail } from "lucide-react";

export default function Landing() {
  const [mode, setMode]         = useState("login"); // "login" | "register" | "forgot"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState("");
  const { lang, toggleLang }    = useAuth();
  const s                       = STRINGS[lang];
  const navigate                = useNavigate();

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await loginUser(email, password);
    if (res.success) {
      navigate("/dashboard/assess");
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await registerUser(email, password, name);
    if (res.success) {
      setSuccess("Account created! Please verify your email then login.");
      switchMode("login");
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    const res = await resetPassword(email);
    if (res.success) {
      setSuccess(t(s, "forgot_sent"));
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  return (
    <div className="landing">
      {/* Background */}
      <div className="landing-bg" />

      {/* Language toggle */}
      <button className="lang-toggle-landing" onClick={toggleLang} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Globe size={13} /> {lang === "en" ? "BM" : "EN"}
      </button>

      {/* Left side — branding */}
      <div className="landing-left">
        <img src="/favicon.ico" alt="CrediWise" className="landing-logo" />
        <h1 className="landing-title">CrediWise</h1>
      </div>

      {/* Right side — auth form */}
      <div className="landing-right">
        <div className="auth-card">

          {/* Tabs — only show for login/register */}
          {mode !== "forgot" && (
            <div className="auth-tabs">
              <button
                className={`auth-tab ${mode === "login" ? "active" : ""}`}
                onClick={() => switchMode("login")}>
                {t(s, "login")}
              </button>
              <button
                className={`auth-tab ${mode === "register" ? "active" : ""}`}
                onClick={() => switchMode("register")}>
                {t(s, "register")}
              </button>
            </div>
          )}

          {/* Forgot Password header */}
          {mode === "forgot" && (
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, background: "#e8faf4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Mail size={22} color="#07C980" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#065663", marginBottom: 6 }}>
                {t(s, "forgot_title")}
              </h2>
              <p style={{ fontSize: 13, color: "#888" }}>
                {t(s, "forgot_desc")}
              </p>
            </div>
          )}

          {/* Success / Error messages */}
          {success && (
            <p className="auth-success" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={16} /> {success}
            </p>
          )}
          {error && (
            <p className="auth-error" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <AlertCircle size={16} /> {error}
            </p>
          )}

          {/* LOGIN FORM */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="auth-field">
                <label>{t(s, "email")}</label>
                <input type="email" value={email} required
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" />
              </div>
              <div className="auth-field">
                <label>{t(s, "password")}</label>
                <input type="password" value={password} required
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" />
              </div>

              {/* Forgot Password link */}
              <div style={{ textAlign: "right", marginTop: -6, marginBottom: 12 }}>
                <span
                  onClick={() => switchMode("forgot")}
                  style={{ fontSize: 12, color: "#07C980", cursor: "pointer", fontWeight: 600 }}>
                  {t(s, "forgot_password")}
                </span>
              </div>

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Loading..." : t(s, "login_btn")}
              </button>
              <p className="auth-switch">
                {t(s, "no_account")}{" "}
                <span onClick={() => switchMode("register")}>
                  {t(s, "register")}
                </span>
              </p>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="auth-form">
              <div className="auth-field">
                <label>{t(s, "name")}</label>
                <input type="text" value={name} required
                  onChange={e => setName(e.target.value)}
                  placeholder="Ahmad bin Abdullah" />
              </div>
              <div className="auth-field">
                <label>{t(s, "email")}</label>
                <input type="email" value={email} required
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" />
              </div>
              <div className="auth-field">
                <label>{t(s, "password")}</label>
                <input type="password" value={password} required
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters" />
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Loading..." : t(s, "register_btn")}
              </button>
              <p className="auth-switch">
                {t(s, "have_account")}{" "}
                <span onClick={() => switchMode("login")}>
                  {t(s, "login")}
                </span>
              </p>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="auth-form">
              <div className="auth-field">
                <label>{t(s, "forgot_email_lbl")}</label>
                <input type="email" value={email} required
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" />
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Loading..." : t(s, "forgot_btn")}
              </button>
              <p className="auth-switch">
                <span onClick={() => switchMode("login")}>
                  ← {t(s, "forgot_back")}
                </span>
              </p>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}