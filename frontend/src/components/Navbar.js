import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logoutUser } from "../firebase";
import { STRINGS, t } from "../lang/strings";

export default function Navbar() {
  const { user, profile, lang, toggleLang, isAdmin } = useAuth();
  const navigate     = useNavigate();
  const location     = useLocation();
  const s            = STRINGS[lang];
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  const isActive = (path) =>
    location.pathname === path ? "nav-link active" : "nav-link";

  const navItems = [
    { path:"/dashboard/assess",     icon:"⚡", label:t(s,"nav_assess") },
    { path:"/dashboard/history",    icon:"📋", label:t(s,"nav_history") },
    { path:"/dashboard/trajectory", icon:"📈", label:t(s,"nav_trajectory") },
    { path:"/dashboard/finance",    icon:"💰", label:t(s,"nav_finance") },
    ...(isAdmin ? [{ path:"/admin", icon:"🔧", label:t(s,"nav_admin") }] : []),
  ];

  if (!user) return null;

  return (
    <>
      <nav className="navbar">
        {/* Brand */}
        <div className="nav-brand">
          <img src="/favicon.ico" alt="CrediWise" className="nav-logo" />
          <div className="nav-brand-text">
            <span className="nav-title">CrediWise</span>
            <span className="nav-tagline">
              Helping people make wiser financial and loan decisions
            </span>
          </div>
        </div>

        {/* Desktop links */}
        <div className="nav-links desktop-only">
          {navItems.map(item => (
            <Link key={item.path} to={item.path}
              className={isActive(item.path)}>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Desktop right */}
        <div className="nav-right desktop-only">
          <button className="lang-toggle" onClick={toggleLang}>
            {lang === "en" ? "🇲🇾 BM" : "🇬🇧 EN"}
          </button>
          <div className="nav-user">
            <span className="nav-user-name">
              👤 {profile?.name || user.email}
            </span>
            <div className="nav-dropdown">
              <Link to="/dashboard/profile" className="dropdown-item">
                {t(s,"nav_profile")}
              </Link>
              <button onClick={handleLogout} className="dropdown-item logout">
                {t(s,"nav_logout")}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile hamburger */}
        <button className="hamburger mobile-only" onClick={() => setOpen(true)}>
          <span /><span /><span />
        </button>
      </nav>

      {/* ── Mobile Drawer ── */}
      {open && (
        <div className="drawer-overlay" onClick={() => setOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>

            {/* User info */}
            <div className="drawer-user">
              <div className="drawer-avatar">
                {(profile?.name || user.email || "U")[0].toUpperCase()}
              </div>
              <div>
                <p className="drawer-name">{profile?.name || "User"}</p>
                <p className="drawer-email">{user.email}</p>
              </div>
            </div>

            <div className="drawer-divider" />

            {/* Nav items */}
            <div className="drawer-nav">
              {navItems.map(item => (
                <Link key={item.path} to={item.path}
                  className={`drawer-link ${location.pathname === item.path ? "active" : ""}`}
                  onClick={() => setOpen(false)}>
                  <span className="drawer-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="drawer-divider" />

            {/* Bottom actions */}
            <div className="drawer-actions">
              <button className="drawer-action-btn" onClick={() => { toggleLang(); }}>
                {lang === "en" ? "🇲🇾 Switch to BM" : "🇬🇧 Switch to EN"}
              </button>
              <Link to="/dashboard/profile"
                className="drawer-action-btn"
                onClick={() => setOpen(false)}>
                👤 {t(s,"nav_profile")}
              </Link>
              <button className="drawer-action-btn logout"
                onClick={handleLogout}>
                🚪 {t(s,"nav_logout")}
              </button>
            </div>

            {/* Close button */}
            <button className="drawer-close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}