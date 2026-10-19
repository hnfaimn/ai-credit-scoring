import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getAllAssessments, getAllUsers } from "../firebase";
import { STRINGS, t } from "../lang/strings";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from "recharts";



export default function Admin() {
  const { lang }                      = useAuth();
  const s                             = STRINGS[lang];
  const [assessments, setAssessments] = useState([]);
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState("overview");
  const [search, setSearch]           = useState("");

  useEffect(() => {
    const load = async () => {
      const [a, u] = await Promise.all([
        getAllAssessments(),
        getAllUsers()
      ]);
      setAssessments(a);
      setUsers(u);
      setLoading(false);
    };
    load();
  }, []);

  // ── Analytics calculations ────────────────────────────────────────────
  const total        = assessments.length;
  const approved     = assessments.filter(a => a.decision === "Approved").length;
  const rejected     = assessments.filter(a => a.decision === "Rejected").length;
  const approvalRate = total ? ((approved / total) * 100).toFixed(1) : 0;
  const avgScore     = total
    ? (assessments.reduce((a, b) => a + b.credit_score, 0) / total).toFixed(1)
    : 0;

  // Risk distribution
  const riskDist = [
    { name: lang==="en" ? "Low Risk"    : "Risiko Rendah",
      value: assessments.filter(a => a.credit_score >= 70).length,
      color: "#07C980" },
    { name: lang==="en" ? "Medium Risk" : "Risiko Sederhana",
      value: assessments.filter(a => a.credit_score >= 50 && a.credit_score < 70).length,
      color: "#f39c12" },
    { name: lang==="en" ? "High Risk"   : "Risiko Tinggi",
      value: assessments.filter(a => a.credit_score < 50).length,
      color: "#e74c3c" },
  ];

  // Decision pie
  const decisionPie = [
    { name: lang==="en" ? "Approved" : "Diluluskan", value: approved, color:"#07C980" },
    { name: lang==="en" ? "Rejected" : "Ditolak",    value: rejected, color:"#e74c3c" },
  ];

  // Monthly trend
  const monthlyMap = {};
  assessments.forEach(a => {
    if (!a.created_at) return;
    const month = new Date(a.created_at)
      .toLocaleDateString("en", { month:"short", year:"2-digit" });
    if (!monthlyMap[month]) monthlyMap[month] = { month, total:0, approved:0 };
    monthlyMap[month].total++;
    if (a.decision === "Approved") monthlyMap[month].approved++;
  });
  const monthlyTrend = Object.values(monthlyMap).slice(-6);

  // Fairness — approval by gender
  const genderStats = ["male","female"].map(g => {
    const group    = assessments.filter(a => a.gender === g);
    const appRate  = group.length
      ? ((group.filter(a => a.decision==="Approved").length / group.length)*100).toFixed(1)
      : 0;
    return {
      name       : g === "male"
        ? (lang==="en" ? "Male" : "Lelaki")
        : (lang==="en" ? "Female" : "Perempuan"),
      total      : group.length,
      approvalRate: Number(appRate),
    };
  });

  // Approval by employment
  const empStats = ["employed","self_employed","unemployed","retired"].map(e => {
    const group   = assessments.filter(a => a.employment_status === e);
    const appRate = group.length
      ? ((group.filter(a => a.decision==="Approved").length / group.length)*100).toFixed(1)
      : 0;
    return {
      name        : e.replace("_"," "),
      total       : group.length,
      approvalRate: Number(appRate),
    };
  }).filter(e => e.total > 0);

  // Score distribution
  const scoreDist = [
    { range:"0-20",  count: assessments.filter(a => a.credit_score < 20).length },
    { range:"20-40", count: assessments.filter(a => a.credit_score >= 20 && a.credit_score < 40).length },
    { range:"40-60", count: assessments.filter(a => a.credit_score >= 40 && a.credit_score < 60).length },
    { range:"60-80", count: assessments.filter(a => a.credit_score >= 60 && a.credit_score < 80).length },
    { range:"80-100",count: assessments.filter(a => a.credit_score >= 80).length },
  ];

  // CSV Export
  const handleExportCSV = () => {
    const headers = ["Date","Name","Age","Gender","Employment",
      "Loan Amount","Duration","Purpose","Credit Score","Decision","Risk Class"];
    const rows = assessments.map(a => [
      a.created_at ? new Date(a.created_at).toLocaleDateString() : "—",
      a.uid || "—", a.age, a.gender, a.employment_status,
      a.loan_amount, a.loan_duration, a.loan_purpose,
      a.credit_score, a.decision, a.risk_class
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `crediwise_assessments_${Date.now()}.csv`;
    a.click();
  };

  // Filter assessments
  const filtered = assessments.filter(a =>
    !search ||
    a.decision?.toLowerCase().includes(search.toLowerCase()) ||
    a.risk_class?.toLowerCase().includes(search.toLowerCase()) ||
    a.loan_purpose?.toLowerCase().includes(search.toLowerCase())
  );

  const Tab = ({ id, label }) => (
    <button
      className={`tab-btn ${activeTab === id ? "active" : ""}`}
      onClick={() => setActiveTab(id)}>
      {label}
    </button>
  );

  if (loading) return (
    <div className="page-container">
      <div className="card placeholder">
        <div className="placeholder-icon spinning">⏳</div>
        <p>Loading admin data...</p>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🔧 {t(s,"admin_title")}</h1>
        <p className="page-subtitle">
          {lang==="en"
            ? `${total} total assessments · ${users.length} registered users`
            : `${total} jumlah penilaian · ${users.length} pengguna berdaftar`}
        </p>
      </div>

      {/* Stats row */}
      <div className="history-stats" style={{ marginBottom:20 }}>
        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <div>
            <p className="stat-label">{t(s,"total_apps")}</p>
            <h3>{total}</h3>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">✅</span>
          <div>
            <p className="stat-label">{t(s,"approval_rate")}</p>
            <h3 style={{ color:"#07C980" }}>{approvalRate}%</h3>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📈</span>
          <div>
            <p className="stat-label">{t(s,"avg_score")}</p>
            <h3>{avgScore}%</h3>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">👥</span>
          <div>
            <p className="stat-label">
              {lang==="en" ? "Registered Users" : "Pengguna Berdaftar"}
            </p>
            <h3>{users.length}</h3>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom:20 }}>
        <Tab id="overview"     label={lang==="en" ? "📊 Overview"   : "📊 Gambaran"} />
        <Tab id="applications" label={lang==="en" ? "📋 Applications": "📋 Permohonan"} />
        <Tab id="fairness"     label={lang==="en" ? "⚖️ Fairness"    : "⚖️ Keadilan"} />
        <Tab id="users"        label={lang==="en" ? "👥 Users"       : "👥 Pengguna"} />
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
            {/* Decision pie */}
            <div className="card">
              <h2>{lang==="en" ? "Approval vs Rejection" : "Kelulusan vs Penolakan"}</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={decisionPie} dataKey="value"
                    nameKey="name" cx="50%" cy="50%"
                    outerRadius={75}
                    label={({name,value}) => `${name}: ${value}`}>
                    {decisionPie.map((e,i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Risk distribution */}
            <div className="card">
              <h2>{t(s,"risk_dist")}</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={riskDist} dataKey="value"
                    nameKey="name" cx="50%" cy="50%"
                    outerRadius={75}
                    label={({name,value}) => `${name}: ${value}`}>
                    {riskDist.map((e,i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly trend */}
          <div className="card" style={{ marginBottom:20 }}>
            <h2>{lang==="en" ? "Monthly Application Trend" : "Trend Permohonan Bulanan"}</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyTrend}
                margin={{ left:0, right:20, top:10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize:11 }} />
                <YAxis tick={{ fontSize:11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total"
                  stroke="#065663" strokeWidth={2}
                  name={lang==="en" ? "Total" : "Jumlah"} />
                <Line type="monotone" dataKey="approved"
                  stroke="#07C980" strokeWidth={2}
                  name={lang==="en" ? "Approved" : "Diluluskan"} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Score distribution */}
          <div className="card">
            <h2>{lang==="en" ? "Score Distribution" : "Taburan Skor"}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreDist}
                margin={{ left:0, right:20, top:10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ fontSize:11 }} />
                <YAxis tick={{ fontSize:11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#07C980" radius={4}
                  name={lang==="en" ? "Applications" : "Permohonan"} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── APPLICATIONS TAB ── */}
      {activeTab === "applications" && (
        <div className="card">
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
            <h2>📋 {t(s,"all_apps")}</h2>
            <div style={{ display:"flex", gap:10 }}>
              <input
                type="text"
                placeholder={lang==="en" ? "Search..." : "Cari..."}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding:"6px 12px", border:"1.5px solid #dde3f0",
                  borderRadius:8, fontSize:13, outline:"none" }}
              />
              <button className="btn-export" onClick={handleExportCSV}>
                📥 {t(s,"export_csv")}
              </button>
            </div>
          </div>

          <div style={{ overflowX:"auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{lang==="en" ? "Date" : "Tarikh"}</th>
                  <th>{lang==="en" ? "Age" : "Umur"}</th>
                  <th>{lang==="en" ? "Gender" : "Jantina"}</th>
                  <th>{lang==="en" ? "Loan (RM)" : "Pinjaman (RM)"}</th>
                  <th>{lang==="en" ? "Score" : "Skor"}</th>
                  <th>{lang==="en" ? "Decision" : "Keputusan"}</th>
                  <th>{lang==="en" ? "Risk" : "Risiko"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={i}>
                    <td>{a.created_at
                      ? new Date(a.created_at).toLocaleDateString()
                      : "—"}</td>
                    <td>{a.age}</td>
                    <td>{a.gender}</td>
                    <td>{a.loan_amount?.toLocaleString()}</td>
                    <td>
                      <span style={{
                        color: a.credit_score >= 70 ? "#07C980"
                          : a.credit_score >= 50 ? "#f39c12" : "#e74c3c",
                        fontWeight: 700
                      }}>
                        {a.credit_score}%
                      </span>
                    </td>
                    <td>
                      <span className={`badge-sm ${a.decision==="Approved"?"green":"red"}`}>
                        {a.decision==="Approved"
                          ? (lang==="en" ? "✅ Approved" : "✅ Diluluskan")
                          : (lang==="en" ? "❌ Rejected" : "❌ Ditolak")}
                      </span>
                    </td>
                    <td>{a.risk_class}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="section-hint" style={{ padding:20, textAlign:"center" }}>
                {lang==="en" ? "No results found." : "Tiada keputusan dijumpai."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── FAIRNESS TAB ── */}
      {activeTab === "fairness" && (
        <div>
          <div className="card" style={{ marginBottom:20 }}>
            <h2>⚖️ {lang==="en" ? "Approval Rate by Gender" : "Kadar Kelulusan Mengikut Jantina"}</h2>
            <p className="section-hint" style={{ marginBottom:16 }}>
              {lang==="en"
                ? "Monitors for potential gender bias in credit decisions."
                : "Memantau kemungkinan berat sebelah jantina dalam keputusan kredit."}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={genderStats}
                margin={{ left:0, right:20, top:10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize:12 }} />
                <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`}
                  tick={{ fontSize:11 }} />
                <Tooltip formatter={v=>[`${v}%`,"Approval Rate"]} />
                <Bar dataKey="approvalRate" fill="#07C980" radius={4} />
              </BarChart>
            </ResponsiveContainer>
            <div className="fairness-detail">
              {genderStats.map((g,i) => (
                <div key={i} className="fairness-item">
                  <span>{g.name}</span>
                  <span>{g.total} {lang==="en" ? "applicants" : "pemohon"}</span>
                  <span style={{ color:"#07C980", fontWeight:700 }}>
                    {g.approvalRate}% {lang==="en" ? "approved" : "diluluskan"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>💼 {lang==="en"
              ? "Approval Rate by Employment"
              : "Kadar Kelulusan Mengikut Pekerjaan"}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={empStats}
                margin={{ left:0, right:20, top:10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize:11 }} />
                <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`}
                  tick={{ fontSize:11 }} />
                <Tooltip formatter={v=>[`${v}%`,"Approval Rate"]} />
                <Bar dataKey="approvalRate" fill="#065663" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === "users" && (
        <div className="card">
          <h2>👥 {lang==="en" ? "Registered Users" : "Pengguna Berdaftar"}</h2>
          <div style={{ overflowX:"auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{lang==="en" ? "Name" : "Nama"}</th>
                  <th>{lang==="en" ? "Email" : "E-mel"}</th>
                  <th>{lang==="en" ? "Role" : "Peranan"}</th>
                  <th>{lang==="en" ? "Joined" : "Tarikh Daftar"}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={i}>
                    <td>{u.name || "—"}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge-sm ${u.role==="admin"?"green":"" }`}
                        style={{ background: u.role==="admin" ? "#d5f5e3"
                          : "#eaf0fb", color: u.role==="admin" ? "#065663" : "#333" }}>
                        {u.role || "applicant"}
                      </span>
                    </td>
                    <td>
                      {u.created_at?.seconds
                        ? new Date(u.created_at.seconds*1000).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}