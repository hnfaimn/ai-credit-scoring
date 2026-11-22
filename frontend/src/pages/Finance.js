import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { saveExpense, updateExpense, getUserExpenses, saveSavingsGoal, getSavingsGoal } from "../firebase";
import { STRINGS, t } from "../lang/strings";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import {
  DollarSign,
  Receipt,
  Target,
  FileText,
  BarChart3,
  Link2,
  Plus,
  TrendingDown,
  PiggyBank,
  Calendar,
  Home,
  Zap,
  Loader2,
  Edit2
} from "lucide-react";

const CATEGORIES = {
  en: ["Food & Dining", "Transport", "Bills & Utilities", "Shopping", "Health", "Education", "Entertainment", "Others"],
  ms: ["Makanan", "Pengangkutan", "Bil & Utiliti", "Membeli-belah", "Kesihatan", "Pendidikan", "Hiburan", "Lain-lain"]
};

const CATEGORY_COLORS = [
  "#07C980","#065663","#f39c12","#e74c3c",
  "#9b59b6","#3498db","#1abc9c","#95a5a6"
];

export default function Finance() {
  const { user, lang }               = useAuth();
  const s                            = STRINGS[lang];
  const [expenses, setExpenses]      = useState([]);
  const [loading, setLoading]        = useState(true);
  const [activeTab, setActiveTab]    = useState("overview");
  const [goal, setGoal]              = useState(null);
  const [showExpForm, setShowExpForm]= useState(false);

  // Expense form
  const [expForm, setExpForm] = useState({
    category: CATEGORIES[lang][0],
    amount  : "",
    date    : new Date().toISOString().split("T")[0],
    note    : ""
  });

    const [editingId, setEditingId]    = useState(null);

  const handleEditClick = (exp) => {
    setEditingId(exp.id);
    setExpForm({
      category: exp.category,
      amount  : exp.amount,
      date    : exp.date ? new Date(exp.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      note    : exp.note || ""
    });
    setShowExpForm(true);
    // Scroll to form
    window.scrollTo({ top: 300, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setExpForm({
      category: CATEGORIES[lang][0],
      amount  : "",
      date    : new Date().toISOString().slice(0, 10),
      note    : ""
    });
    setShowExpForm(false);
  };

  // Goal form
  const [goalForm, setGoalForm] = useState({
    target  : "",
    current : "",
    deadline: ""
  });

  useEffect(() => {
    const load = async () => {
      if (user) {
        const [exp, g] = await Promise.all([
          getUserExpenses(user.uid),
          getSavingsGoal(user.uid)
        ]);
        setExpenses(exp);
        if (g) {
          setGoal(g);
          setGoalForm({
            target  : g.target   || "",
            current : g.current  || "",
            deadline: g.deadline || ""
          });
        }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Calculations
  const totalExpenses = expenses.reduce((a, b) => a + Number(b.amount), 0);

  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  });
  const thisMonthTotal = thisMonth.reduce((a, b) => a + Number(b.amount), 0);

  // Category breakdown
  const cats = CATEGORIES[lang];
  const categoryData = cats.map((cat, i) => {
    const total = expenses
      .filter(e => e.category === cat || e.category === CATEGORIES["en"][i])
      .reduce((a, b) => a + Number(b.amount), 0);
    return { name: cat, value: total, color: CATEGORY_COLORS[i] };
  }).filter(c => c.value > 0);

  // Monthly trend
  const monthlyData = {};
  expenses.forEach(e => {
    const month = new Date(e.date).toLocaleDateString("en", { month:"short", year:"numeric" });
    monthlyData[month] = (monthlyData[month] || 0) + Number(e.amount);
  });
  const monthlyChart = Object.entries(monthlyData)
    .slice(-6)
    .map(([month, total]) => ({ month, total }));

  // Save expense
  // Save or Update expense
  const handleSaveExpense = async () => {
    if (!expForm.amount || !expForm.date) return;
    let saved = false;
    if (editingId) {
      saved = await updateExpense(user.uid, editingId, {
        ...expForm,
        amount: Number(expForm.amount)
      });
    } else {
      saved = await saveExpense(user.uid, {
        ...expForm,
        amount: Number(expForm.amount)
      });
    }

    if (saved) {
      const updated = await getUserExpenses(user.uid);
      setExpenses(updated);
      handleCancelEdit();
    }
  };

  // Save goal
  const handleSaveGoal = async () => {
    if (!goalForm.target || !goalForm.current) return;
    const saved = await saveSavingsGoal(user.uid, {
      target  : Number(goalForm.target),
      current : Number(goalForm.current),
      deadline: goalForm.deadline
    });
    if (saved) {
      setGoal({
        target  : Number(goalForm.target),
        current : Number(goalForm.current),
        deadline: goalForm.deadline
      });
    }
  };

  const goalProgress = goal
    ? Math.min(100, (goal.current / goal.target) * 100).toFixed(1)
    : 0;

  const Tab = ({ id, label, icon: Icon }) => (
    <button
      className={`tab-btn ${activeTab === id ? "active" : ""}`}
      onClick={() => setActiveTab(id)}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      {Icon && <Icon size={15} />}
      {label}
    </button>
  );

  if (loading) return (
    <div className="page-container">
      <div className="card placeholder">
        <div className="placeholder-icon spinning">
          <Loader2 size={40} />
        </div>
        <p>{lang==="en" ? "Loading..." : "Memuatkan..."}</p>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{t(s, "fin_title")}</h1>
        <p className="page-subtitle">
          {lang==="en"
            ? "Track your expenses and savings to improve your credit profile"
            : "Jejak perbelanjaan dan simpanan anda untuk meningkatkan profil kredit"}
        </p>
      </div>

      {/* Stats row */}
      <div className="history-stats" style={{ marginBottom:20 }}>
        <div className="stat-card">
          <span className="stat-icon">
            <DollarSign size={24} color="#065663" />
          </span>
          <div>
            <p className="stat-label">
              {lang==="en" ? "This Month" : "Bulan Ini"}
            </p>
            <h3>RM {thisMonthTotal.toLocaleString()}</h3>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <Receipt size={24} color="#065663" />
          </span>
          <div>
            <p className="stat-label">
              {lang==="en" ? "Total Expenses" : "Jumlah Perbelanjaan"}
            </p>
            <h3>RM {totalExpenses.toLocaleString()}</h3>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <Target size={24} color="#07C980" />
          </span>
          <div>
            <p className="stat-label">
              {lang==="en" ? "Savings Goal" : "Sasaran Simpanan"}
            </p>
            <h3 style={{ color:"#07C980" }}>
              {goal ? `${goalProgress}%` : "—"}
            </h3>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <FileText size={24} color="#065663" />
          </span>
          <div>
            <p className="stat-label">
              {lang==="en" ? "Total Records" : "Jumlah Rekod"}
            </p>
            <h3>{expenses.length}</h3>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom:20 }}>
        <Tab id="overview" icon={BarChart3} label={lang==="en" ? "Overview" : "Gambaran"} />
        <Tab id="expenses" icon={Receipt}   label={lang==="en" ? "Expenses" : "Perbelanjaan"} />
        <Tab id="savings"  icon={Target}    label={lang==="en" ? "Savings Goal" : "Sasaran Simpanan"} />
        <Tab id="credit"   icon={Link2}     label={lang==="en" ? "Credit Link" : "Pautan Kredit"} />
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div>
          {expenses.length === 0 ? (
            <div className="card placeholder">
              <div className="placeholder-icon">
                <Receipt size={40} color="#065663" />
              </div>
              <p>{lang==="en" ? "No expenses recorded yet." : "Tiada perbelanjaan direkodkan."}</p>
              <button className="btn-primary"
                style={{ marginTop:16, width:"auto", padding:"10px 24px" }}
                onClick={() => setActiveTab("expenses")}>
                {lang==="en" ? "Add First Expense" : "Tambah Perbelanjaan Pertama"}
              </button>
            </div>
          ) : (
            <div className="charts-grid-2">
              {/* Pie chart */}
              <div className="card">
                <h2>{lang==="en" ? "Spending by Category" : "Perbelanjaan Mengikut Kategori"}</h2>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={categoryData} dataKey="value"
                        nameKey="name" cx="50%" cy="50%"
                        outerRadius={80} label={({name, percent}) =>
                          `${name} ${(percent*100).toFixed(0)}%`}>
                        {categoryData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => [`RM ${v.toLocaleString()}`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar chart with Legend & Guidance */}
              <div className="card">
                <h2>{lang==="en" ? "Monthly Spending Trend" : "Trend Perbelanjaan Bulanan"}</h2>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={monthlyChart}
                    margin={{ left:0, right:10, top:10, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize:10 }} />
                    <YAxis tick={{ fontSize:10 }}
                      tickFormatter={v => `RM${v}`} />
                    <Tooltip formatter={v => [`RM ${v.toLocaleString()}`, ""]} />
                    <Legend 
                      verticalAlign="top" 
                      height={32} 
                      formatter={() => (lang==="en" ? "Total Spending (RM)" : "Jumlah Perbelanjaan (RM)")} 
                    />
                    <Bar dataKey="total" fill="#07C980" radius={4} name="total" />
                  </BarChart>
                </ResponsiveContainer>

                {/* Trend Guidance Note */}
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0faf7", borderRadius: 8, fontSize: 12, color: "#065663", lineHeight: 1.5, borderLeft: "3px solid #07C980" }}>
                  <strong>💡 {lang==="en" ? "Trend Guidance:" : "Panduan Trend:"}</strong>{" "}
                  {lang==="en"
                    ? "Consistent or decreasing monthly spending reduces your Debt-to-Income (DTI) ratio, preserving healthy disposable income for credit approvals."
                    : "Perbelanjaan bulanan yang konsisten atau menurun mengurangkan nisbah DTI anda, mengekalkan baki pendapatan yang sihat untuk kelulusan kredit."}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EXPENSES TAB ── */}
      {activeTab === "expenses" && (
        <div>
          <div className="card">
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:16 }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Receipt size={20} color="#065663" />
                {lang==="en" ? "Expense Records" : "Rekod Perbelanjaan"}
              </h2>
              <button className="btn-sim"
                onClick={() => setShowExpForm(!showExpForm)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {showExpForm ? "✕" : (
                  <>
                    <Plus size={14} /> {t(s,"fin_expense")}
                  </>
                )}
              </button>
            </div>

            {/* Add / Edit expense form */}
            {showExpForm && (
              <div className="expense-form" style={{ background: editingId ? "#f4fbf8" : undefined, border: editingId ? "1.5px solid #07C980" : undefined, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, color: "#065663", fontWeight: 700 }}>
                    {editingId 
                      ? (lang==="en" ? "✏️ Edit Expense Record" : "✏️ Kemaskini Rekod Perbelanjaan")
                      : (lang==="en" ? "➕ Add New Expense" : "➕ Tambah Perbelanjaan Baharu")}
                  </h3>
                  {editingId && (
                    <button onClick={handleCancelEdit} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 12 }}>
                      {lang==="en" ? "Cancel" : "Batal"} ✕
                    </button>
                  )}
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>{t(s,"fin_category")}</label>
                    <select value={expForm.category}
                      onChange={e => setExpForm(f => ({...f, category:e.target.value}))}>
                      {CATEGORIES[lang].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>{t(s,"fin_amount")}</label>
                    <input type="number" min="0" placeholder="0.00"
                      value={expForm.amount}
                      onChange={e => setExpForm(f => ({...f, amount:e.target.value}))} />
                  </div>
                  <div className="field">
                    <label>{t(s,"fin_date")}</label>
                    <input type="date" value={expForm.date}
                      onChange={e => setExpForm(f => ({...f, date:e.target.value}))} />
                  </div>
                  <div className="field">
                    <label>{lang==="en" ? "Note (optional)" : "Nota (pilihan)"}</label>
                    <input type="text" placeholder={lang==="en" ? "e.g. Lunch at mamak" : "cth. Makan tengahari"}
                      value={expForm.note}
                      onChange={e => setExpForm(f => ({...f, note:e.target.value}))} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button className="btn-primary" onClick={handleSaveExpense}>
                    {editingId 
                      ? (lang==="en" ? "Update Expense" : "Kemaskini Perbelanjaan")
                      : t(s,"fin_save")}
                  </button>
                  {editingId && (
                    <button 
                      onClick={handleCancelEdit} 
                      style={{ padding: "10px 16px", background: "#f0f0f0", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#555" }}
                    >
                      {lang==="en" ? "Cancel" : "Batal"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Expense list */}
            {expenses.length === 0 ? (
              <p className="section-hint">
                {lang==="en" ? "No expenses yet." : "Tiada perbelanjaan lagi."}
              </p>
            ) : (
              <div className="expense-list">
                {expenses.map((exp, i) => (
                  <div key={i} className="expense-item">
                    <div className="exp-left">
                      <span className="exp-cat-dot"
                        style={{ background: CATEGORY_COLORS[
                          CATEGORIES[lang].indexOf(exp.category)] || "#888" }} />
                      <div>
                        <p className="exp-cat">{exp.category}</p>
                        {exp.note && <p className="exp-note">{exp.note}</p>}
                      </div>
                    </div>
                    <div className="exp-right">
                      <p className="exp-amount">RM {Number(exp.amount).toLocaleString()}</p>
                      <p className="exp-date">
                        {exp.date
                          ? new Date(exp.date).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
            )}
          </div>
        </div>
      )}

      {/* ── SAVINGS GOAL TAB ── */}
      {activeTab === "savings" && (
        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Target size={20} color="#065663" />
            {t(s,"fin_goal")}
          </h2>

          {goal && (
            <div className="goal-display">
              <div className="goal-progress-bar-bg">
                <div className="goal-progress-bar-fill"
                  style={{ width:`${goalProgress}%` }} />
              </div>
              <div className="goal-stats">
                <span>
                  RM {Number(goal.current).toLocaleString()} /
                  RM {Number(goal.target).toLocaleString()}
                </span>
                <span style={{ color:"#07C980", fontWeight:700 }}>
                  {goalProgress}%
                </span>
              </div>
              {goal.deadline && (
                <p className="section-hint" style={{ marginTop:8 }}>
                  {lang==="en" ? "Target date:" : "Tarikh sasaran:"}{" "}
                  {new Date(goal.deadline).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          <div className="form-grid" style={{ marginTop:20 }}>
            <div className="field">
              <label>{t(s,"fin_target")}</label>
              <input type="number" min="0" placeholder="50000"
                value={goalForm.target}
                onChange={e => setGoalForm(f => ({...f, target:e.target.value}))} />
            </div>
            <div className="field">
              <label>{t(s,"fin_current")}</label>
              <input type="number" min="0" placeholder="10000"
                value={goalForm.current}
                onChange={e => setGoalForm(f => ({...f, current:e.target.value}))} />
            </div>
            <div className="field full">
              <label>{t(s,"fin_deadline")}</label>
              <input type="date" value={goalForm.deadline}
                onChange={e => setGoalForm(f => ({...f, deadline:e.target.value}))} />
            </div>
          </div>
          <button className="btn-primary"
            style={{ marginTop:16 }} onClick={handleSaveGoal}>
            {lang==="en" ? "Save Goal" : "Simpan Sasaran"}
          </button>
        </div>
      )}

      {/* ── CREDIT LINK TAB ── */}
      {activeTab === "credit" && (
        <div>
          <div className="card" style={{ marginBottom:20 }}>
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link2 size={20} color="#065663" />
              {lang==="en"
                ? "How Your Spending Affects Your Credit"
                : "Bagaimana Perbelanjaan Anda Mempengaruhi Kredit"}
            </h2>
            <p className="section-hint" style={{ marginBottom:16 }}>
              {lang==="en"
                ? "Based on your recorded expenses, here is how your financial behaviour impacts your credit assessment."
                : "Berdasarkan perbelanjaan yang direkodkan, berikut adalah kesan tabiat kewangan anda terhadap penilaian kredit."}
            </p>

            {/* DTI from actual expenses */}
            {thisMonthTotal > 0 && (
              <div className="dti-banner" style={{ marginBottom:16 }}>
                <div className="dti-info">
                  <span className="dti-label">
                    {lang==="en"
                      ? "Estimated DTI from recorded expenses"
                      : "DTI anggaran daripada perbelanjaan direkodkan"}
                  </span>
                </div>
                <p className="section-hint">
                  {lang==="en"
                    ? `Your total recorded expenses this month: RM ${thisMonthTotal.toLocaleString()}. Enter your monthly income in the assessment form for an accurate DTI calculation.`
                    : `Jumlah perbelanjaan bulan ini: RM ${thisMonthTotal.toLocaleString()}. Masukkan pendapatan bulanan anda dalam borang penilaian untuk pengiraan DTI yang tepat.`}
                </p>
              </div>
            )}

            {/* Tips */}
            <div className="credit-tips">
              {[
                {
                  icon : <TrendingDown size={20} color="#e74c3c" />,
                  title: lang==="en" ? "Reduce Non-Essential Spending" : "Kurangkan Perbelanjaan Tidak Penting",
                  desc : lang==="en"
                    ? "High entertainment and shopping expenses increase your DTI ratio, which negatively impacts your credit score."
                    : "Perbelanjaan hiburan dan membeli-belah yang tinggi meningkatkan nisbah DTI anda, yang memberi kesan negatif kepada skor kredit."
                },
                {
                  icon : <PiggyBank size={20} color="#07C980" />,
                  title: lang==="en" ? "Build Emergency Fund" : "Bina Dana Kecemasan",
                  desc : lang==="en"
                    ? "Aim to save at least 3-6 months of expenses. Higher savings improve your credit assessment score."
                    : "Sasarkan simpanan sekurang-kurangnya 3-6 bulan perbelanjaan. Simpanan yang lebih tinggi meningkatkan skor penilaian kredit anda."
                },
                {
                  icon : <Calendar size={20} color="#065663" />,
                  title: lang==="en" ? "Pay Bills on Time" : "Bayar Bil Tepat Masa",
                  desc : lang==="en"
                    ? "Consistent on-time payments are the strongest positive factor in your credit assessment."
                    : "Pembayaran tepat masa yang konsisten adalah faktor positif terkuat dalam penilaian kredit anda."
                },
                {
                  icon : <Home size={20} color="#065663" />,
                  title: lang==="en" ? "Manage Housing Costs" : "Urus Kos Perumahan",
                  desc : lang==="en"
                    ? "Keep housing payments below 30% of your monthly income to maintain a healthy DTI ratio."
                    : "Pastikan bayaran perumahan di bawah 30% pendapatan bulanan untuk mengekalkan nisbah DTI yang sihat."
                },
              ].map((tip, i) => (
                <div key={i} className="credit-tip-item">
                  <span className="credit-tip-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {tip.icon}
                  </span>
                  <div>
                    <p className="tip-text">{tip.title}</p>
                    <p className="tip-reason">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop:20, textAlign:"center" }}>
              <a href="/dashboard/assess"
                style={{ textDecoration:"none" }}>
                <button className="btn-primary"
                  style={{ width:"auto", padding:"12px 32px", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Zap size={16} />
                  {lang==="en"
                    ? "Do a Credit Assessment Now"
                    : "Buat Penilaian Kredit Sekarang"}
                </button>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
