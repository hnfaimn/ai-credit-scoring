import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logoutUser } from "../firebase";
import { STRINGS, t } from "../lang/strings";

export default function Navbar() {
  const { user, profile, lang, toggleLang, isAdmin } = useAuth();
  const navigate        = useNavigate();
  const location        = useLocation();
  const s               = STRINGS[lang];
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  const isActive = (path) =>
    location.pathname === path ? "nav-link active" : "nav-link";

  const isActiveTab = (path) =>
    location.pathname === path ? "bottom-tab active" : "bottom-tab";

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
      {/* ══ TOP NAVBAR ══ */}
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

        {/* Desktop links — hidden on mobile */}
        <div className="nav-links">
          {navItems.map(item => (
            <Link key={item.path} to={item.path}
              className={isActive(item.path)}>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right side — desktop */}
        <div className="nav-right">
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

        {/* Mobile right — hamburger for profile/lang/logout only */}
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span /><span />
        </button>
      </nav>

      {/* ══ MOBILE MINI MENU (profile/lang/logout only) ══ */}
      {menuOpen && (
        <>
          <div className="mini-overlay" onClick={() => setMenuOpen(false)} />
          <div className="mini-menu">
            <div className="mini-user">
              <div className="mini-avatar">
                {(profile?.name || user.email || "U")[0].toUpperCase()}
              </div>
              <div>
                <p className="mini-name">{profile?.name || "User"}</p>
                <p className="mini-email">{user.email}</p>
              </div>
            </div>
            <div className="mini-divider" />
            <button className="mini-item" onClick={() => { toggleLang(); setMenuOpen(false); }}>
              {lang === "en" ? "🇲🇾 Switch to BM" : "🇬🇧 Switch to EN"}
            </button>
            <Link to="/dashboard/profile" className="mini-item"
              onClick={() => setMenuOpen(false)}>
              👤 {t(s,"nav_profile")}
            </Link>
            <div className="mini-divider" />
            <button className="mini-item logout" onClick={handleLogout}>
              🚪 {t(s,"nav_logout")}
            </button>
          </div>
        </>
      )}

      {/* ══ MOBILE BOTTOM TAB BAR ══ */}
      <div className="bottom-tabs">
        {navItems.map(item => (
          <Link key={item.path} to={item.path}
            className={isActiveTab(item.path)}>
            <span className="bottom-tab-icon">{item.icon}</span>
            <span className="bottom-tab-label">{item.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}