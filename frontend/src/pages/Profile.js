import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { STRINGS, t } from "../lang/strings";

export default function Profile() {
  const { user, profile, lang } = useAuth();
  const s                       = STRINGS[lang];

  const [form, setForm]       = useState({
    name    : profile?.name     || "",
    phone   : profile?.phone    || "",
    ic      : profile?.ic       || "",
    address : profile?.address  || "",
  });
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError]     = useState("");

  const handleSave = async () => {
    setSaving(true); setSuccess(""); setError("");
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name   : form.name,
        phone  : form.phone,
        ic     : form.ic,
        address: form.address,
      });
      setSuccess(lang==="en"
        ? "Profile updated successfully!"
        : "Profil berjaya dikemaskini!");
    } catch {
      setError(lang==="en"
        ? "Failed to update profile."
        : "Gagal mengemaskini profil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>👤 {t(s,"nav_profile")}</h1>
        <p className="page-subtitle">
          {lang==="en"
            ? "Manage your personal information"
            : "Urus maklumat peribadi anda"}
        </p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:24 }}>

        {/* Left — Avatar & Info */}
        <div>
          <div className="card" style={{ textAlign:"center" }}>
            <div className="profile-avatar">
              {(profile?.name || user?.email || "U")[0].toUpperCase()}
            </div>
            <h3 className="profile-name">{profile?.name || "—"}</h3>
            <p className="profile-email">{user?.email}</p>
            <span className="profile-role-badge">
              {profile?.role || "applicant"}
            </span>
          </div>

          {/* Account info */}
          <div className="card" style={{ marginTop:16 }}>
            <h2>{lang==="en" ? "Account Info" : "Maklumat Akaun"}</h2>
            <div className="profile-info-row">
              <span>📧 {lang==="en" ? "Email" : "E-mel"}</span>
              <span>{user?.email}</span>
            </div>
            <div className="profile-info-row">
              <span>🔐 {lang==="en" ? "Role" : "Peranan"}</span>
              <span style={{ textTransform:"capitalize" }}>
                {profile?.role || "applicant"}
              </span>
            </div>
            <div className="profile-info-row">
              <span>✅ {lang==="en" ? "Email Verified" : "E-mel Disahkan"}</span>
              <span style={{ color: user?.emailVerified ? "#07C980" : "#e74c3c" }}>
                {user?.emailVerified
                  ? (lang==="en" ? "Yes" : "Ya")
                  : (lang==="en" ? "No" : "Tidak")}
              </span>
            </div>
          </div>
        </div>

        {/* Right — Edit form */}
        <div className="card">
          <h2>{lang==="en" ? "Edit Profile" : "Edit Profil"}</h2>

          {success && <p className="auth-success" style={{ marginBottom:12 }}>✅ {success}</p>}
          {error   && <p className="auth-error"   style={{ marginBottom:12 }}>⚠️ {error}</p>}

          <div className="form-grid">
            <div className="field full">
              <label>{lang==="en" ? "Full Name" : "Nama Penuh"}</label>
              <input type="text"
                value={form.name}
                onChange={e => setForm(f => ({...f, name:e.target.value}))}
                placeholder={lang==="en" ? "Ahmad bin Abdullah" : "Ahmad bin Abdullah"} />
            </div>
            <div className="field">
              <label>{lang==="en" ? "Phone Number" : "Nombor Telefon"}</label>
              <input type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({...f, phone:e.target.value}))}
                placeholder="01X-XXXXXXXX" />
            </div>
            <div className="field">
              <label>{lang==="en" ? "IC Number" : "Nombor IC"}</label>
              <input type="text"
                value={form.ic}
                onChange={e => setForm(f => ({...f, ic:e.target.value}))}
                placeholder="XXXXXX-XX-XXXX" />
            </div>
            <div className="field full">
              <label>{lang==="en" ? "Address" : "Alamat"}</label>
              <input type="text"
                value={form.address}
                onChange={e => setForm(f => ({...f, address:e.target.value}))}
                placeholder={lang==="en"
                  ? "No. X, Jalan XX, XXXXX Kuala Lumpur"
                  : "No. X, Jalan XX, XXXXX Kuala Lumpur"} />
            </div>
          </div>

          <button className="btn-primary"
            style={{ marginTop:20 }}
            onClick={handleSave} disabled={saving}>
            {saving
              ? (lang==="en" ? "Saving..." : "Menyimpan...")
              : (lang==="en" ? "Save Changes" : "Simpan Perubahan")}
          </button>
        </div>
      </div>
    </div>
  );
}