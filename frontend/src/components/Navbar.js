import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logoutUser } from "../firebase";
import { STRINGS, t } from "../lang/strings";

export default function Navbar() {
  const { user, profile, lang, toggleLang, isAdmin } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const s         = STRINGS[lang];

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  const isActive = (path) =>
    location.pathname === path ? "nav-link active" : "nav-link";

  if (!user) return null;

  return (
      <nav className="navbar">
        <div className="nav-brand">
          <img src="/favicon.ico" alt="CrediWise" className="nav-logo" />
          <div className="nav-brand-text">
            <span className="nav-title">CrediWise</span>
            <span className="nav-tagline">
              Helping people make wiser financial and loan decisions
            </span>
          </div>
        </div>

        <div className="nav-links">
          <Link to="/dashboard/assess"
            className={isActive("/dashboard/assess")}>
            {t(s,"nav_assess")}
          </Link>
          <Link to="/dashboard/history"
            className={isActive("/dashboard/history")}>
            {t(s,"nav_history")}
          </Link>
          <Link to="/dashboard/trajectory"
            className={isActive("/dashboard/trajectory")}>
            {t(s,"nav_trajectory")}
          </Link>
          <Link to="/dashboard/finance"
            className={isActive("/dashboard/finance")}>
           {t(s,"nav_finance")}
          </Link>
          {isAdmin && (
            <Link to="/admin" className={isActive("/admin")}>
              {t(s,"nav_admin")}
            </Link>
          )}
        </div>

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
      </nav>
    );
}