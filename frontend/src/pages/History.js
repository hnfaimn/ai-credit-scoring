import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserAssessments, clearUserHistory } from "../firebase";
import { STRINGS, t } from "../lang/strings";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer
} from "recharts";

export default function History() {
  const { user, lang }          = useAuth();
  const s                       = STRINGS[lang];
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (user) {
        const data = await getUserAssessments(user.uid);
        setHistory(data);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleClearHistory = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setClearing(true);
    const success = await clearUserHistory(user.uid);
    if (success) {
      setHistory([]);
      setConfirmClear(false);
    }
    setClearing(false);
  };

  const scoreColor = (score) => {
    if (score >= 70) return "#07C980";
    if (score >= 50) return "#f39c12";
    return "#e74c3c";
  };

  const chartData = [...history]
    .reverse()
    .map((rec, i) => ({
      name  : `#${i + 1}`,
      score : rec.credit_score,
      date  : rec.created_at
        ? new Date(rec.created_at).toLocaleDateString()
        : "—",
    }));

  return (
    // ✅ FIX: use page-container as outer wrapper (same as Trajectory.js)
    <div className="page-container">
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
        <div>
          <h1>{t(s, "history_title")}</h1>
          <p className="page-subtitle">
            {lang === "en"
              ? "View all your past credit assessments"
              : "Lihat semua penilaian kredit anda yang lepas"}
          </p>
        </div>
        {history.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
            <button
            className="btn-clear"
            onClick={handleClearHistory}
            disabled={clearing}>
             {clearing ? "⏳ Clearing..."
              : confirmClear
              ? (lang==="en" ? "⚠️ Confirm Clear?" : "⚠️ Sahkan Padam?")
              : (lang==="en" ? "🗑️ Clear History" : "🗑️ Padam Sejarah")}
            </button>
            {confirmClear && (
              <button
              style={{ fontSize:11, color:"#888", background:"none",
                border:"none", cursor:"pointer", padding:0 }}
              onClick={() => setConfirmClear(false)}>
                {lang==="en" ? "Cancel" : "Batal"}
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="card placeholder">
          <div className="placeholder-icon spinning">⏳</div>
          <p>{lang === "en" ? "Loading history..." : "Memuatkan sejarah..."}</p>
        </div>
      ) : history.length === 0 ? (
        <div className="card placeholder">
          <div className="placeholder-icon">📋</div>
          <p>{t(s, "no_history")}</p>
        </div>
      ) : (
        <>
          {/* Score trend mini chart */}
          {history.length > 1 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2>📈 {lang === "en" ? "Score Trend" : "Trend Skor"}</h2>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}
                  margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => [`${v}%`, "Credit Score"]}
                    labelFormatter={(l, p) => p?.[0]?.payload?.date || l}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#07C980"
                    strokeWidth={2.5}
                    dot={{ fill: "#07C980", r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Stats row */}
          <div className="history-stats">
            <div className="stat-card">
              <span className="stat-icon">📊</span>
              <div>
                <p className="stat-label">
                  {lang === "en" ? "Total Assessments" : "Jumlah Penilaian"}
                </p>
                <h3>{history.length}</h3>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">✅</span>
              <div>
                <p className="stat-label">
                  {lang === "en" ? "Approved" : "Diluluskan"}
                </p>
                <h3 style={{ color: "#07C980" }}>
                  {history.filter(h => h.decision === "Approved").length}
                </h3>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">📈</span>
              <div>
                <p className="stat-label">
                  {lang === "en" ? "Best Score" : "Skor Terbaik"}
                </p>
                <h3 style={{ color: "#07C980" }}>
                  {Math.max(...history.map(h => h.credit_score))}%
                </h3>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">⚖️</span>
              <div>
                <p className="stat-label">
                  {lang === "en" ? "Average Score" : "Skor Purata"}
                </p>
                <h3>
                  {(history.reduce((a, b) =>
                    a + b.credit_score, 0) / history.length).toFixed(1)}%
                </h3>
              </div>
            </div>
          </div>

          {/* Assessment list */}
          <div className="card">
            <h2>📋 {lang === "en" ? "All Assessments" : "Semua Penilaian"}</h2>
            {history.map((rec, i) => (
              <div key={rec.id || i}>
                <div
                  className={`history-item ${selected === i ? "selected" : ""}`}
                  onClick={() => setSelected(selected === i ? null : i)}
                >
                  <div className="history-left">
                    <span className={`badge-sm ${rec.decision === "Approved"
                      ? "green" : "red"}`}>
                      {rec.decision === "Approved" ? "✅" : "❌"}{" "}
                      {lang === "en"
                        ? rec.decision
                        : rec.decision === "Approved"
                          ? "Diluluskan" : "Ditolak"}
                    </span>
                    <span className="history-score">
                      {lang === "en" ? "Score:" : "Skor:"}{" "}
                      <strong style={{ color: scoreColor(rec.credit_score) }}>
                        {rec.credit_score}/100
                      </strong>
                    </span>
                    <span className="history-risk">{rec.risk_class}</span>
                  </div>
                  <div className="history-right">
                    <span className="history-detail">
                      {lang === "en" ? "Age" : "Umur"} {rec.age} ·{" "}
                      RM {rec.loan_amount?.toLocaleString()}{" "}
                      {lang === "en" ? "loan" : "pinjaman"}
                    </span>
                    <span className="history-date">
                      {rec.created_at
                        ? new Date(rec.created_at).toLocaleString()
                        : "—"}
                    </span>
                    <span style={{ fontSize: 11, color: "#07C980" }}>
                      {selected === i
                        ? (lang === "en" ? "▲ Hide details" : "▲ Sembunyikan")
                        : (lang === "en" ? "▼ View details" : "▼ Lihat details")}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {selected === i && (
                  <div className="history-detail-panel">
                    <div className="detail-grid">
                      <div className="detail-section">
                        <h4>
                          {lang === "en" ? "🔍 Why This Decision?" : "🔍 Mengapa Keputusan Ini?"}
                        </h4>
                        {rec.explanations?.map((exp, j) => (
                          <div key={j} className="exp-bar" style={{
                            background : exp.shap_val > 0 ? "#e74c3c22" : "#2ecc7122",
                            borderLeft : `4px solid ${exp.shap_val > 0 ? "#e74c3c" : "#07C980"}`,
                            marginBottom: 8
                          }}>
                            <p className="exp-sentence">{exp.sentence}</p>
                          </div>
                        ))}
                      </div>
                      <div className="detail-section">
                        <h4>
                          {lang === "en" ? "💡 Recommendations" : "💡 Cadangan"}
                        </h4>
                        {rec.recommendations?.map((tip, j) => (
                          <div key={j} className="tip-item" style={{ padding: "8px 0" }}>
                            <span className={`priority priority-${tip.priority?.toLowerCase()}`}>
                              {tip.priority}
                            </span>
                            <p className="tip-text" style={{ fontSize: 12 }}>
                              {tip.tip}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}