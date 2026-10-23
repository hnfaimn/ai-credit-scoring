import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { STRINGS, t } from "../lang/strings";
import { CheckCircle2, AlertCircle, Globe } from "lucide-react";

export default function Landing() {
  const [mode, setMode]         = useState("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState("");
  const { lang, toggleLang }    = useAuth();
  const s                       = STRINGS[lang];
  const navigate                = useNavigate();

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
      setMode("login");
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
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode==="login" ? "active" : ""}`}
              onClick={() => { setMode("login"); setError(""); }}>
              {t(s,"login")}
            </button>
            <button
              className={`auth-tab ${mode==="register" ? "active" : ""}`}
              onClick={() => { setMode("register"); setError(""); }}>
              {t(s,"register")}
            </button>
          </div>

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

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="auth-field">
                <label>{t(s,"email")}</label>
                <input type="email" value={email} required
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" />
              </div>
              <div className="auth-field">
                <label>{t(s,"password")}</label>
                <input type="password" value={password} required
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" />
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Loading..." : t(s,"login_btn")}
              </button>
              <p className="auth-switch">
                {t(s,"no_account")}{" "}
                <span onClick={() => setMode("register")}>
                  {t(s,"register")}
                </span>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="auth-form">
              <div className="auth-field">
                <label>{t(s,"name")}</label>
                <input type="text" value={name} required
                  onChange={e => setName(e.target.value)}
                  placeholder="Ahmad bin Abdullah" />
              </div>
              <div className="auth-field">
                <label>{t(s,"email")}</label>
                <input type="email" value={email} required
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" />
              </div>
              <div className="auth-field">
                <label>{t(s,"password")}</label>
                <input type="password" value={password} required
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters" />
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Loading..." : t(s,"register_btn")}
              </button>
              <p className="auth-switch">
                {t(s,"have_account")}{" "}
                <span onClick={() => setMode("login")}>
                  {t(s,"login")}
                </span>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}