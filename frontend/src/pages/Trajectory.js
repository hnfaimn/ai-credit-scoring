import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserAssessments } from "../firebase";
import { STRINGS, t } from "../lang/strings";
import {
  XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
  Area, AreaChart
} from "recharts";

export default function Trajectory() {
  const { user, lang }        = useAuth();
  const s                     = STRINGS[lang];
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Build chart data oldest → newest
  const chartData = [...history].reverse().map((rec, i) => ({
    index     : i + 1,
    name      : `#${i + 1}`,
    score     : rec.credit_score,
    decision  : rec.decision,
    date      : rec.created_at
      ? new Date(rec.created_at).toLocaleDateString()
      : "—",
    risk      : rec.risk_class,
  }));

  // Stats
  const latest   = history[0];
  const oldest   = history[history.length - 1];
  const best     = history.length
    ? Math.max(...history.map(h => h.credit_score)) : 0;
  const avg = history.length
    ? (history.reduce((a, b) => a + b.credit_score, 0) / history.length).toFixed(1)
    : 0;
  const improved = history.length >= 2
    ? (latest.credit_score - oldest.credit_score).toFixed(1)
    : 0;
  const approvalRate = history.length
    ? ((history.filter(h => h.decision === "Approved").length
        / history.length) * 100).toFixed(0)
    : 0;

  // Milestone badges
  const milestones = [];
  if (history.length >= 1)  milestones.push({ icon:"🏁", label: lang==="en" ? "First Assessment" : "Penilaian Pertama" });
  if (best >= 70)           milestones.push({ icon:"🟢", label: lang==="en" ? "Reached Low Risk" : "Capai Risiko Rendah" });
  if (best >= 80)           milestones.push({ icon:"⭐", label: lang==="en" ? "Score Above 80%" : "Skor Melebihi 80%" });
  if (history.filter(h => h.decision==="Approved").length >= 1)
                            milestones.push({ icon:"✅", label: lang==="en" ? "First Approval" : "Kelulusan Pertama" });
  if (history.length >= 5)  milestones.push({ icon:"🔥", label: lang==="en" ? "5 Assessments Done" : "5 Penilaian Selesai" });
  if (Number(improved) > 0) milestones.push({ icon:"📈", label: lang==="en" ? "Score Improved" : "Skor Meningkat" });

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      const d = payload[0].payload;
      return (
        <div className="traj-tooltip">
          <p className="tt-date">{d.date}</p>
          <p className="tt-score" style={{
            color: d.score >= 70 ? "#07C980"
              : d.score >= 50 ? "#f39c12" : "#e74c3c"
          }}>
            {lang==="en" ? "Score" : "Skor"}: <strong>{d.score}%</strong>
          </p>
          <p className="tt-decision" style={{
            color: d.decision === "Approved" ? "#07C980" : "#e74c3c"
          }}>
            {d.decision === "Approved"
              ? (lang==="en" ? "✅ Approved" : "✅ Diluluskan")
              : (lang==="en" ? "❌ Rejected" : "❌ Ditolak")}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{t(s, "traj_title")}</h1>
        <p className="page-subtitle">{t(s, "traj_sub")}</p>
      </div>

      {loading ? (
        <div className="card placeholder">
          <div className="placeholder-icon spinning">⏳</div>
          <p>{lang==="en" ? "Loading trajectory..." : "Memuatkan trajektori..."}</p>
        </div>
      ) : history.length < 2 ? (
        <div className="card placeholder">
          <div className="placeholder-icon">📈</div>
          <p>{t(s, "traj_empty")}</p>
          <a href="/dashboard/assess" className="btn-primary"
            style={{ display:"inline-block", marginTop:16, textDecoration:"none",
              padding:"10px 24px", borderRadius:8, color:"white",
              background:"linear-gradient(135deg,#065663,#07C980)" }}>
            {lang==="en" ? "Do an Assessment" : "Buat Penilaian"}
          </a>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="history-stats" style={{ marginBottom:20 }}>
            <div className="stat-card">
              <span className="stat-icon">📊</span>
              <div>
                <p className="stat-label">
                  {lang==="en" ? "Total Assessments" : "Jumlah Penilaian"}
                </p>
                <h3>{history.length}</h3>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">🏆</span>
              <div>
                <p className="stat-label">
                  {lang==="en" ? "Best Score" : "Skor Terbaik"}
                </p>
                <h3 style={{ color:"#07C980" }}>{best}%</h3>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">
                {Number(improved) >= 0 ? "📈" : "📉"}
              </span>
              <div>
                <p className="stat-label">
                  {lang==="en" ? "Overall Change" : "Perubahan Keseluruhan"}
                </p>
                <h3 style={{ color: Number(improved) >= 0 ? "#07C980" : "#e74c3c" }}>
                  {Number(improved) >= 0 ? "+" : ""}{improved}%
                </h3>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">✅</span>
              <div>
                <p className="stat-label">
                  {lang==="en" ? "Approval Rate" : "Kadar Kelulusan"}
                </p>
                <h3 style={{ color:"#07C980" }}>{approvalRate}%</h3>
              </div>
            </div>
          </div>

          {/* Main trajectory chart */}
          <div className="card" style={{ marginBottom:20 }}>
            <h2>
              📈 {lang==="en"
                ? "Credit Score Over Time"
                : "Skor Kredit Mengikut Masa"}
            </h2>
            <p className="section-hint" style={{ marginBottom:16 }}>
              {lang==="en"
                ? "Each point represents one credit assessment. Hover for details."
                : "Setiap titik mewakili satu penilaian kredit. Layangkan tetikus untuk butiran."}
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}
                margin={{ left:0, right:20, top:10, bottom:0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#07C980" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#07C980" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8f5f0" />
                <XAxis dataKey="name" tick={{ fontSize:11 }} />
                <YAxis domain={[0,100]} tick={{ fontSize:11 }}
                  tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                {/* Reference lines */}
                <ReferenceLine y={70} stroke="#07C980" strokeDasharray="4 4"
                  label={{ value:"Low Risk", position:"right",
                    fontSize:10, fill:"#07C980" }} />
                <ReferenceLine y={50} stroke="#f39c12" strokeDasharray="4 4"
                  label={{ value:"Approved", position:"right",
                    fontSize:10, fill:"#f39c12" }} />
                <Area type="monotone" dataKey="score"
                  stroke="#07C980" strokeWidth={2.5}
                  fill="url(#scoreGrad)"
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const color = payload.score >= 70 ? "#07C980"
                      : payload.score >= 50 ? "#f39c12" : "#e74c3c";
                    return (
                      <circle key={payload.name}
                        cx={cx} cy={cy} r={6}
                        fill={color} stroke="white" strokeWidth={2} />
                    );
                  }}
                  activeDot={{ r:8, fill:"#065663" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Milestones */}
          {milestones.length > 0 && (
            <div className="card" style={{ marginBottom:20 }}>
              <h2>🏅 {lang==="en" ? "Your Milestones" : "Pencapaian Anda"}</h2>
              <div className="milestones-grid">
                {milestones.map((m, i) => (
                  <div key={i} className="milestone-badge">
                    <span className="milestone-icon">{m.icon}</span>
                    <span className="milestone-label">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvement tips based on latest score */}
          {latest && (
            <div className="card">
              <h2>
                💡 {lang==="en"
                  ? "Based on Your Latest Assessment"
                  : "Berdasarkan Penilaian Terkini Anda"}
              </h2>
              <div className="traj-latest">
                <div className="traj-score-circle" style={{
                  borderColor: latest.credit_score >= 70 ? "#07C980"
                    : latest.credit_score >= 50 ? "#f39c12" : "#e74c3c"
                }}>
                  <span style={{
                    color: latest.credit_score >= 70 ? "#07C980"
                      : latest.credit_score >= 50 ? "#f39c12" : "#e74c3c",
                    fontSize: 28, fontWeight: 700
                  }}>
                    {latest.credit_score}%
                  </span>
                  <span style={{ fontSize:11, color:"#888" }}>
                    {lang==="en" ? "Latest Score" : "Skor Terkini"}
                  </span>
                </div>
                <div className="traj-tips">
                  {latest.recommendations?.length > 0
                    ? latest.recommendations.map((tip, i) => (
                      <div key={i} className="tip-item">
                        <span className={`priority priority-${tip.priority?.toLowerCase()}`}>
                          {tip.priority}
                        </span>
                        <div>
                          <p className="tip-text">💡 {tip.tip}</p>
                          <p className="tip-reason">📌 {tip.reason}</p>
                        </div>
                      </div>
                    ))
                    : <p className="good-msg">
                        ✅ {lang==="en"
                          ? "Your profile looks strong — keep it up!"
                          : "Profil anda kelihatan kukuh — teruskan!"}
                      </p>
                  }
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}