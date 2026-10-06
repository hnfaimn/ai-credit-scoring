import React, { useState, useRef } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import { saveAssessment, getAssessments } from "./firebase";
import {
  RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Cell
} from "recharts";
import "./App.css";

const API = "https://ai-credit-scoring-gurz.onrender.com";

const INITIAL_FORM = {
  age: 30,
  gender: "male",
  employment_status: "employed",
  employment_type: "skilled",
  employment_duration: 24,
  monthly_income: 3000,
  dependents: 0,
  housing_status: "own",
  monthly_housing_payment: 500,
  monthly_debt: 300,
  outstanding_financing: 0,
  credit_card_balance: 200,
  credit_card_limit: 5000,
  savings: 2000,
  repayment_history: "good",
  loan_amount: 10000,
  loan_duration: 24,
  loan_purpose: "car",
};

const SIM_DEFAULTS = {
  repayment_history: "excellent",
  savings          : 20000,
  monthly_debt     : 100,
  housing_status   : "own",
  loan_purpose     : "education",
};

function validateForm(form) {
  const errors = {};
  if (!form.age || form.age < 18 || form.age > 80)
    errors.age = "Age must be between 18 and 80.";
  if (!form.monthly_income || form.monthly_income <= 0)
    errors.monthly_income = "Monthly income must be greater than 0.";
  if (!form.loan_amount || form.loan_amount <= 0)
    errors.loan_amount = "Loan amount must be greater than 0.";
  if (!form.loan_duration || form.loan_duration < 1 || form.loan_duration > 84)
    errors.loan_duration = "Loan duration must be between 1 and 84 months.";
  if (form.monthly_debt < 0)
    errors.monthly_debt = "Monthly debt cannot be negative.";
  if (form.savings < 0)
    errors.savings = "Savings cannot be negative.";
  if (form.credit_card_balance < 0)
    errors.credit_card_balance = "Credit card balance cannot be negative.";
  if (form.monthly_housing_payment < 0)
    errors.monthly_housing_payment = "Housing payment cannot be negative.";
  const totalDebt = form.monthly_debt + form.monthly_housing_payment;
  const dti = totalDebt / form.monthly_income;
  if (dti > 0.9)
    errors.monthly_income = "Your debt-to-income ratio is extremely high. Please review your figures.";
  return errors;
}

export default function App() {
  const [form, setForm]               = useState(INITIAL_FORM);
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [simFeature, setSimFeature]   = useState("repayment_history");
  const [simValue, setSimValue]       = useState("excellent");
  const [simResult, setSimResult]     = useState(null);
  const [activeSection, setActiveSection]   = useState("applicant");
  const [exportLoading, setExportLoading]   = useState(false);
  const [savedId, setSavedId]               = useState(null);
  const [history, setHistory]               = useState([]);
  const [showHistory, setShowHistory]       = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const resultRef = useRef(null);

  const NUM_FIELDS = [
    "age","employment_duration","monthly_income","dependents",
    "monthly_housing_payment","monthly_debt","outstanding_financing",
    "credit_card_balance","credit_card_limit","savings",
    "loan_amount","loan_duration"
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (NUM_FIELDS.includes(name)) {
    // Allow empty string while typing
      if (value === "" || value === "-") {
        setForm(f => ({ ...f, [name]: value }));
      } else {
        setForm(f => ({ ...f, [name]: Number(value) }));
      }
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
    if (fieldErrors[name]) {
      setFieldErrors(prev => { const n = {...prev}; delete n[name]; return n; });
    }
  };

  const handleSimFeatureChange = (e) => {
    const feat = e.target.value;
    setSimFeature(feat);
    setSimValue(SIM_DEFAULTS[feat]);
  };

  const scoreColor = (score) => {
    if (score >= 70) return "#2ecc71";
    if (score >= 50) return "#f39c12";
    return "#e74c3c";
  };

  const riskLabel = (score) => {
    if (score >= 70) return "🟢 Low Risk";
    if (score >= 50) return "🟡 Medium Risk";
    return "🔴 High Risk";
  };

  const totalMonthlyDebt = form.monthly_debt + form.monthly_housing_payment;
  const dtiRatio = form.monthly_income > 0
    ? ((totalMonthlyDebt / form.monthly_income) * 100).toFixed(1) : 0;
  const dtiColor = dtiRatio <= 30 ? "#2ecc71"
    : dtiRatio <= 50 ? "#f39c12" : "#e74c3c";
  const dtiLabel = dtiRatio <= 30 ? "Healthy ✅"
    : dtiRatio <= 50 ? "Moderate ⚠️" : "High Risk 🔴";

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Please fix the errors above before submitting.");
      return;
    }
    setLoading(true); setError(null); setResult(null);
    setSimResult(null); setFieldErrors({}); setSavedId(null);

   // Wake up Render first
    try {
      await axios.get(`${API}/health`, { timeout: 60000 });
    } catch {
    // ignore, just waking up
    }

    try {
      const res = await axios.post(`${API}/explain`, form, { timeout: 60000 });
      setResult(res.data);
      const id = await saveAssessment(form, res.data);
      setSavedId(id);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    } catch {
      setError("Unable to connect — make sure the Flask server is running.");
    } finally {
      setLoading(false);
    }
  };

  // ── Simulate ──────────────────────────────────────────────────────────
  const handleSimulate = async () => {
    setLoading(true); setError(null);
    try {
      const res = await axios.post(`${API}/simulate`, {
        ...form,
        feature_to_change: simFeature,
        new_value: simValue
      }, { timeout: 60000 });
      setSimResult(res.data);
    } catch {
      setError("Simulation failed — make sure Flask is running.");
    } finally {
      setLoading(false);
    }
  };

  // ── Load History ──────────────────────────────────────────────────────
  const handleLoadHistory = async () => {
    setHistoryLoading(true);
    setShowHistory(true);
    try {
      const data = await getAssessments();
      setHistory(data);
    } catch {
      setError("Failed to load history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Export PDF ────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!result) return;
    setExportLoading(true);
    try {
      const pdf  = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      let y = 0;

      const addPage = () => {
        pdf.addPage();
        y = 20;
        pdf.setFillColor(27, 58, 107);
        pdf.rect(0, 0, pdfW, 10, "F");
      };

      const checkY = (needed = 20) => {
        if (y + needed > pdfH - 15) addPage();
      };

      const sectionTitle = (text) => {
        checkY(14);
        pdf.setFillColor(27, 58, 107);
        pdf.rect(10, y, pdfW - 20, 8, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.text(text, 14, y + 5.5);
        y += 12;
        pdf.setTextColor(30, 30, 50);
      };

      const row = (label, value, highlight = false) => {
        checkY(8);
        if (highlight) {
          pdf.setFillColor(240, 244, 250);
          pdf.rect(10, y, pdfW - 20, 7, "F");
        }
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(80, 80, 100);
        pdf.text(label, 14, y + 5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(27, 58, 107);
        pdf.text(String(value), pdfW - 14, y + 5, { align: "right" });
        y += 8;
        pdf.setTextColor(30, 30, 50);
      };

      const divider = () => {
        checkY(4);
        pdf.setDrawColor(220, 227, 240);
        pdf.line(10, y, pdfW - 10, y);
        y += 4;
      };

      // Header
      pdf.setFillColor(27, 58, 107);
      pdf.rect(0, 0, pdfW, 28, "F");
      pdf.setFillColor(245, 166, 35);
      pdf.rect(0, 28, pdfW, 2, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("AI Credit Scoring Report", 14, 14);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        "Explainable AI-Based Credit Assessment & Financial Recommendation",
        14, 22);
      pdf.text(`Generated: ${new Date().toLocaleString()}`,
        pdfW - 14, 22, { align: "right" });
      y = 36;

      // Section 1: Result
      sectionTitle("CREDIT ASSESSMENT RESULT");
      const approved = result.decision === "Approved";
      pdf.setFillColor(
        approved ? 213 : 250,
        approved ? 245 : 219,
        approved ? 227 : 216
      );
      pdf.rect(10, y, pdfW - 20, 14, "F");
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(
        approved ? 30  : 192,
        approved ? 132 : 57,
        approved ? 73  : 43
      );
      pdf.text(
        approved ? "APPROVED" : "REJECTED",
        pdfW / 2, y + 9, { align: "center" }
      );
      y += 18;
      pdf.setTextColor(30, 30, 50);
      row("Credit Score",         `${result.credit_score} / 100`, true);
      row("Approval Probability", `${result.credit_score}%`);
      row("Risk Classification",
        result.credit_score >= 70 ? "Low Risk"
        : result.credit_score >= 50 ? "Medium Risk" : "High Risk", true);
      row("Debt-to-Income Ratio", `${dtiRatio}% (${dtiLabel})`);
      row("Loan-to-Income Ratio",
        form.monthly_income > 0
          ? `${(form.loan_amount / form.monthly_income).toFixed(1)}x`
          : "N/A", true);
      divider(); y += 2;

      // Section 2: Applicant
      sectionTitle("APPLICANT INFORMATION");
      row("Age",                    `${form.age} years`, true);
      row("Gender",                 form.gender === "male" ? "Male" : "Female");
      row("Employment Status",      form.employment_status.replace("_"," "), true);
      row("Employment Type",        form.employment_type.replace("_"," "));
      row("Employment Duration",    `${form.employment_duration} months`, true);
      row("Monthly Net Income",     `RM ${form.monthly_income.toLocaleString()}`);
      row("Number of Dependents",   String(form.dependents), true);
      row("Housing Status",         form.housing_status);
      row("Monthly Housing Payment",`RM ${form.monthly_housing_payment.toLocaleString()}`, true);
      divider(); y += 2;

      // Section 3: Financial
      sectionTitle("FINANCIAL & CREDIT INFORMATION");
      row("Monthly Debt Commitments", `RM ${form.monthly_debt.toLocaleString()}`, true);
      row("Outstanding Financing",    `RM ${form.outstanding_financing.toLocaleString()}`);
      row("Credit Card Balance",      `RM ${form.credit_card_balance.toLocaleString()}`, true);
      row("Credit Card Limit",        `RM ${form.credit_card_limit.toLocaleString()}`);
      row("Total Savings",            `RM ${form.savings.toLocaleString()}`, true);
      row("Repayment History",        form.repayment_history);
      divider(); y += 2;

      // Section 4: Loan
      sectionTitle("LOAN APPLICATION DETAILS");
      row("Loan Amount Requested",    `RM ${form.loan_amount.toLocaleString()}`, true);
      row("Loan Duration",            `${form.loan_duration} months`);
      row("Loan Purpose",             form.loan_purpose, true);
      row("Estimated Monthly Payment",
        `RM ${Math.round(form.loan_amount / form.loan_duration).toLocaleString()}`);
      divider(); y += 2;

      // Section 5: Explanation
      sectionTitle("AI EXPLANATION — WHY THIS DECISION?");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(80, 80, 100);
      const introLines = pdf.splitTextToSize(
        "The following factors were identified by the AI model (XGBoost + SHAP) " +
        "as the most influential in determining your credit assessment result.",
        pdfW - 28);
      pdf.text(introLines, 14, y);
      y += introLines.length * 5 + 4;

      result.explanations?.forEach((exp, i) => {
        checkY(20);
        const isRisk = exp.shap_val > 0;
        pdf.setFillColor(
          isRisk ? 253 : 240,
          isRisk ? 237 : 253,
          isRisk ? 236 : 244
        );
        pdf.rect(10, y, pdfW - 20, 16, "F");
        pdf.setFillColor(
          isRisk ? 231 : 46,
          isRisk ? 76  : 204,
          isRisk ? 60  : 113
        );
        pdf.rect(10, y, 3, 16, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(27, 58, 107);
        pdf.text(`${i + 1}. ${exp.label.toUpperCase()}`, 16, y + 6);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(60, 60, 80);
        const lines = pdf.splitTextToSize(exp.sentence, pdfW - 36);
        pdf.text(lines, 16, y + 12);
        y += 20 + (lines.length - 1) * 4;
      });

      divider(); y += 2;

      // Section 6: Recommendations
      checkY(20);
      sectionTitle("FINANCIAL IMPROVEMENT RECOMMENDATIONS");
      if (result.recommendations?.length > 0) {
        result.recommendations.forEach((tip, i) => {
          checkY(28);
          const colors = {
            High  : [[250,219,216],[192,57,43]],
            Medium: [[254,249,231],[214,137,16]],
            Low   : [[213,245,227],[30,132,73]]
          };
          const [bg, tc] = colors[tip.priority] || [[240,244,250],[27,58,107]];
          pdf.setFillColor(...bg);
          pdf.rect(10, y, pdfW - 20, 22, "F");
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(...tc);
          pdf.text(`${tip.priority.toUpperCase()} PRIORITY`, 14, y + 5);
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(27, 58, 107);
          const tipLines = pdf.splitTextToSize(`${i+1}. ${tip.tip}`, pdfW - 30);
          pdf.text(tipLines, 14, y + 10);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.5);
          pdf.setTextColor(100, 100, 120);
          const reasonLines = pdf.splitTextToSize(`Why: ${tip.reason}`, pdfW - 30);
          pdf.text(reasonLines, 14, y + 10 + tipLines.length * 4);
          y += 26;
        });
      } else {
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(30, 132, 73);
        pdf.text(
          "Your financial profile looks strong — keep maintaining good habits!",
          14, y);
        y += 10;
      }

      // Footer
      const totalPages = pdf.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFillColor(245, 166, 35);
        pdf.rect(0, pdfH - 10, pdfW, 10, "F");
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(27, 58, 107);
        pdf.text("Confidential — AI Credit Assessment Report",
          14, pdfH - 3.5);
        pdf.text(`Page ${p} of ${totalPages}`,
          pdfW - 14, pdfH - 3.5, { align: "right" });
      }

      pdf.save(`credit_report_${Date.now()}.pdf`);

    } catch (err) {
      console.error(err);
      setError("PDF export failed. Please try again.");
    } finally {
      setExportLoading(false);
    }
  };

  const Tab = ({ id, label }) => (
    <button
      className={`tab-btn ${activeSection === id ? "active" : ""}`}
      onClick={() => setActiveSection(id)}>
      {label}
    </button>
  );

  const FieldError = ({ name }) =>
    fieldErrors[name]
      ? <span className="field-error">⚠ {fieldErrors[name]}</span>
      : null;

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <img src="/favicon.ico" alt="CrediWise Logo" className="header-logo" />
          <div className="header-text">
            <h1>CrediWise</h1>
            <p>Explainable AI-Based Credit Assessment &amp; Financial Recommendation</p>
          </div>
        </div>
      </header>

      <div className="main">

        {/* ══ LEFT: FORM ══ */}
        <div className="card form-card">
          <h2>📋 Loan Application Form</h2>
          <p className="form-hint">Complete all sections for an accurate assessment.</p>

          {/* DTI Banner */}
          {form.monthly_income > 0 && (
            <div className="dti-banner" style={{ borderColor: dtiColor }}>
              <div className="dti-info">
                <span className="dti-label">Debt-to-Income Ratio</span>
                <span className="dti-value" style={{ color: dtiColor }}>
                  {dtiRatio}% — {dtiLabel}
                </span>
              </div>
              <div className="dti-bar-bg">
                <div className="dti-bar-fill"
                  style={{ width:`${Math.min(100, dtiRatio)}%`, background:dtiColor }} />
              </div>
              <p className="dti-note">
                Total monthly debt: RM {totalMonthlyDebt.toLocaleString()} /
                Income: RM {form.monthly_income.toLocaleString()}
                &nbsp;(Ideal: below 30%)
              </p>
            </div>
          )}

          <div className="tabs">
            <Tab id="applicant" label="👤 Applicant" />
            <Tab id="financial" label="💰 Financial" />
            <Tab id="loan"      label="🏦 Loan" />
          </div>

          {/* Tab 1 */}
          {activeSection === "applicant" && (
            <div className="form-section">
              <div className="section-label">Applicant Information</div>
              <div className="form-grid">
                <div className="field">
                  <label>Age <span className="hint">(years)</span></label>
                  <input type="number" name="age" min="18" max="80"
                    className={fieldErrors.age ? "input-error" : ""}
                    value={form.age} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="age" />
                </div>
                <div className="field">
                  <label>Gender</label>
                  <select name="gender" value={form.gender} onChange={handleChange}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div className="field">
                  <label>Employment Status</label>
                  <select name="employment_status" value={form.employment_status}
                    onChange={handleChange}>
                    <option value="employed">Employed</option>
                    <option value="self_employed">Self-Employed</option>
                    <option value="unemployed">Unemployed</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
                <div className="field">
                  <label>Employment Type</label>
                  <select name="employment_type" value={form.employment_type}
                    onChange={handleChange}>
                    <option value="highly_skilled">Highly Skilled / Management</option>
                    <option value="skilled">Skilled Employee</option>
                    <option value="unskilled">Unskilled</option>
                  </select>
                </div>
                <div className="field">
                  <label>Employment Duration <span className="hint">(months)</span></label>
                  <input type="number" name="employment_duration" min="0"
                    value={form.employment_duration} onChange={handleChange} onFocus={e => e.target.select()} />
                </div>
                <div className="field">
                  <label>Monthly Net Income <span className="hint">(RM)</span></label>
                  <input type="number" name="monthly_income" min="0"
                    className={fieldErrors.monthly_income ? "input-error" : ""}
                    value={form.monthly_income} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="monthly_income" />
                </div>
                <div className="field">
                  <label>Number of Dependents</label>
                  <input type="number" name="dependents" min="0" max="10"
                    value={form.dependents} onChange={handleChange} onFocus={e => e.target.select()} />
                </div>
                <div className="field">
                  <label>Housing Status</label>
                  <select name="housing_status" value={form.housing_status}
                    onChange={handleChange}>
                    <option value="own">Own Property</option>
                    <option value="rent">Renting</option>
                    <option value="free">Living Rent-Free</option>
                  </select>
                </div>
                <div className="field full">
                  <label>Monthly Housing Payment <span className="hint">(RM)</span></label>
                  <input type="number" name="monthly_housing_payment" min="0"
                    className={fieldErrors.monthly_housing_payment ? "input-error":""}
                    value={form.monthly_housing_payment} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="monthly_housing_payment" />
                </div>
              </div>
              <button className="btn-next"
                onClick={() => setActiveSection("financial")}>
                Next: Financial Info →
              </button>
            </div>
          )}

          {/* Tab 2 */}
          {activeSection === "financial" && (
            <div className="form-section">
              <div className="section-label">Financial &amp; Credit Information</div>
              <div className="form-grid">
                <div className="field">
                  <label>Monthly Debt Commitments <span className="hint">(RM)</span></label>
                  <input type="number" name="monthly_debt" min="0"
                    className={fieldErrors.monthly_debt ? "input-error" : ""}
                    value={form.monthly_debt} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="monthly_debt" />
                </div>
                <div className="field">
                  <label>Outstanding Financing <span className="hint">(RM)</span></label>
                  <input type="number" name="outstanding_financing" min="0"
                    value={form.outstanding_financing} onChange={handleChange} onFocus={e => e.target.select()} />
                </div>
                <div className="field">
                  <label>Credit Card Balance <span className="hint">(RM)</span></label>
                  <input type="number" name="credit_card_balance" min="0"
                    className={fieldErrors.credit_card_balance ? "input-error":""}
                    value={form.credit_card_balance} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="credit_card_balance" />
                </div>
                <div className="field">
                  <label>Credit Card Limit <span className="hint">(RM)</span></label>
                  <input type="number" name="credit_card_limit" min="0"
                    value={form.credit_card_limit} onChange={handleChange} onFocus={e => e.target.select()} />
                </div>
                <div className="field">
                  <label>Total Savings <span className="hint">(RM)</span></label>
                  <input type="number" name="savings" min="0"
                    className={fieldErrors.savings ? "input-error" : ""}
                    value={form.savings} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="savings" />
                </div>
                <div className="field">
                  <label>Repayment History</label>
                  <select name="repayment_history" value={form.repayment_history}
                    onChange={handleChange}>
                    <option value="excellent">Excellent — No missed payments</option>
                    <option value="good">Good — Rarely missed</option>
                    <option value="fair">Fair — Occasionally missed</option>
                    <option value="poor">Poor — Frequently missed</option>
                  </select>
                </div>
              </div>
              <div className="btn-row">
                <button className="btn-back"
                  onClick={() => setActiveSection("applicant")}>← Back</button>
                <button className="btn-next"
                  onClick={() => setActiveSection("loan")}>Next: Loan Details →</button>
              </div>
            </div>
          )}

          {/* Tab 3 */}
          {activeSection === "loan" && (
            <div className="form-section">
              <div className="section-label">Loan Application</div>
              <div className="form-grid">
                <div className="field">
                  <label>Loan Amount <span className="hint">(RM)</span></label>
                  <input type="number" name="loan_amount" min="100"
                    className={fieldErrors.loan_amount ? "input-error" : ""}
                    value={form.loan_amount} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="loan_amount" />
                </div>
                <div className="field">
                  <label>Loan Duration <span className="hint">(months)</span></label>
                  <input type="number" name="loan_duration" min="1" max="84"
                    className={fieldErrors.loan_duration ? "input-error" : ""}
                    value={form.loan_duration} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="loan_duration" />
                </div>
                <div className="field full">
                  <label>Loan Purpose</label>
                  <select name="loan_purpose" value={form.loan_purpose}
                    onChange={handleChange}>
                    <option value="car">Purchase a Car</option>
                    <option value="furniture/equipment">Furniture / Home Equipment</option>
                    <option value="education">Education</option>
                    <option value="business">Business</option>
                    <option value="repairs">Home Repairs</option>
                    <option value="vacation/others">Vacation / Others</option>
                  </select>
                </div>
                <div className="field full">
                  <div className="loan-summary">
                    <div className="loan-sum-item">
                      <span>Loan Amount</span>
                      <strong>RM {form.loan_amount.toLocaleString()}</strong>
                    </div>
                    <div className="loan-sum-item">
                      <span>Duration</span>
                      <strong>{form.loan_duration} months</strong>
                    </div>
                    <div className="loan-sum-item">
                      <span>Est. Monthly Payment</span>
                      <strong>
                        RM {Math.round(form.loan_amount / form.loan_duration).toLocaleString()}
                      </strong>
                    </div>
                    <div className="loan-sum-item">
                      <span>Loan-to-Income Ratio</span>
                      <strong style={{
                        color: (form.loan_amount / form.monthly_income) <= 10
                          ? "#2ecc71" : "#e74c3c"
                      }}>
                        {form.monthly_income > 0
                          ? `${(form.loan_amount / form.monthly_income).toFixed(1)}x`
                          : "—"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
              <div className="btn-row">
                <button className="btn-back"
                  onClick={() => setActiveSection("financial")}>← Back</button>
                <button className="btn-primary"
                  onClick={handleSubmit} disabled={loading}>
                  {loading ? "⏳ Analysing..." : "⚡ Assess My Credit"}
                </button>
              </div>
            </div>
          )}

          {error && <p className="error">⚠️ {error}</p>}
        </div>

        {/* ══ RIGHT: RESULTS ══ */}
        <div className="results">
          {!result && !loading && (
            <div className="card placeholder">
              <div className="placeholder-icon">📊</div>
              <p>Complete the form and click <strong>Assess My Credit</strong> to
                receive your credit score, AI explanation, and personalised financial tips.</p>
            </div>
          )}

          {loading && (
            <div className="card placeholder">
              <div className="placeholder-icon spinning">⏳</div>
              <p>Analysing your profile, please wait...</p>
              <p className="section-hint" style={{ marginTop: 8 }}>
                First request may take up to 60 seconds to wake the server.
              </p>
            </div>
          )}

          {result && !loading && (
            <div ref={resultRef}>

              {/* Export + History bar */}
              <div className="export-bar">
                <span className="export-label">
                  📄 Assessment complete
                  {savedId &&
                    <span className="saved-badge">✅ Saved to cloud</span>}
                </span>
                <div className="export-btns">
                  <button className="btn-history"
                    onClick={handleLoadHistory} disabled={historyLoading}>
                    {historyLoading ? "⏳ Loading..." : "📋 View History"}
                  </button>
                  <button className="btn-export"
                    onClick={handleExportPDF} disabled={exportLoading}>
                    {exportLoading ? "⏳ Exporting..." : "⬇️ Export PDF"}
                  </button>
                </div>
              </div>

              {/* History Panel */}
              {showHistory && (
                <div className="card history-card">
                  <div className="history-header">
                    <h2>📋 Assessment History</h2>
                    <button className="btn-close"
                      onClick={() => setShowHistory(false)}>✕ Close</button>
                  </div>
                  {historyLoading
                    ? <p className="section-hint">Loading records...</p>
                    : history.length === 0
                    ? <p className="section-hint">No past assessments found.</p>
                    : history.map((rec) => (
                      <div key={rec.id} className="history-item">
                        <div className="history-left">
                          <span className={`badge-sm ${rec.decision==="Approved"?"green":"red"}`}>
                            {rec.decision==="Approved" ? "✅" : "❌"} {rec.decision}
                          </span>
                          <span className="history-score">
                            Score: <strong>{rec.credit_score}/100</strong>
                          </span>
                          <span className="history-risk">{rec.risk_class}</span>
                        </div>
                        <div className="history-right">
                          <span className="history-detail">
                            Age {rec.age} · {rec.employment_type} ·
                            RM {rec.loan_amount?.toLocaleString()} loan
                          </span>
                          <span className="history-date">
                            {rec.created_at
                              ? new Date(rec.created_at).toLocaleString()
                              : "Unknown date"}
                          </span>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}

              {/* Score Card */}
              <div className="card score-card">
                <h2>Credit Assessment Result</h2>
                <div className="score-layout">
                  <div className="gauge">
                    <RadialBarChart
                      width={200} height={200} cx={100} cy={100}
                      innerRadius={60} outerRadius={90}
                      startAngle={180} endAngle={0}
                      data={[{ value: result.credit_score }]}>
                      <PolarAngleAxis type="number" domain={[0,100]} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={8}
                        fill={scoreColor(result.credit_score)} />
                    </RadialBarChart>
                    <div className="gauge-label">
                      <span className="score-num"
                        style={{ color: scoreColor(result.credit_score) }}>
                        {result.credit_score}
                      </span>
                      <span className="score-sub">/ 100</span>
                    </div>
                  </div>
                  <div className="decision-info">
                    <div className={`badge ${result.decision==="Approved"?"green":"red"}`}>
                      {result.decision==="Approved" ? "✅ APPROVED" : "❌ REJECTED"}
                    </div>
                    <p><strong>Approval Probability:</strong> {result.credit_score}%</p>
                    <p><strong>Risk Class:</strong> {riskLabel(result.credit_score)}</p>
                    <p><strong>Debt-to-Income:</strong>{" "}
                      <span style={{ color:dtiColor, fontWeight:600 }}>
                        {dtiRatio}% ({dtiLabel})
                      </span>
                    </p>
                    <p><strong>Loan-to-Income:</strong>{" "}
                      {form.monthly_income > 0
                        ? `${(form.loan_amount/form.monthly_income).toFixed(1)}x`
                        : "—"}
                    </p>
                    <p className="score-note">
                      Score above 50% = eligible for approval consideration.
                    </p>
                  </div>
                </div>
              </div>

              {/* Explanations */}
              <div className="card">
                <h2>Why Was This Decision Made?</h2>
                <p className="section-hint">
                  Top factors our AI identified that influenced your result.
                </p>
                {result.explanations?.map((exp, i) => (
                  <div key={i} className="explanation-item">
                    <div className="exp-bar" style={{
                      background : exp.shap_val > 0 ? "#e74c3c22" : "#2ecc7122",
                      borderLeft : `4px solid ${exp.shap_val>0 ? "#e74c3c" : "#2ecc71"}`
                    }}>
                      <p className="exp-sentence">{exp.sentence}</p>
                      <span className="exp-badge"
                        style={{ background: exp.shap_val>0 ? "#e74c3c" : "#2ecc71" }}>
                        {exp.shap_val>0 ? "↑ Increases Risk" : "↓ Reduces Risk"}
                      </span>
                    </div>
                  </div>
                ))}
                {result.explanations?.length > 0 && (
                  <div style={{ marginTop:16 }}>
                    <p className="chart-title">Feature Impact Chart</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={result.explanations.map(e=>({
                          name:e.label, value:e.shap_val
                        }))}
                        layout="vertical"
                        margin={{ left:20, right:20, top:5, bottom:5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name"
                          width={170} tick={{ fontSize:11 }} />
                        <Tooltip formatter={(v)=>[`${v.toFixed(4)}`,"SHAP Impact"]} />
                        <Bar dataKey="value" radius={4}>
                          {result.explanations.map((e,i)=>(
                            <Cell key={i}
                              fill={e.shap_val>0 ? "#e74c3c" : "#2ecc71"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="chart-note">
                      🟢 Green = reduces risk &nbsp;|&nbsp; 🔴 Red = increases risk
                    </p>
                  </div>
                )}
              </div>

              {/* Recommendations */}
              <div className="card">
                <h2>💡 How to Improve Your Score</h2>
                <p className="section-hint">
                  Personalised steps based on your financial profile.
                </p>
                {result.recommendations?.length > 0
                  ? result.recommendations.map((tip,i) => (
                    <div key={i} className="tip-item">
                      <span className={`priority priority-${tip.priority.toLowerCase()}`}>
                        {tip.priority} Priority
                      </span>
                      <div>
                        <p className="tip-text">💡 {tip.tip}</p>
                        <p className="tip-reason">📌 Why: {tip.reason}</p>
                      </div>
                    </div>
                  ))
                  : <p className="good-msg">
                      ✅ Your financial profile looks strong — keep it up!
                    </p>
                }
              </div>

              {/* Simulator */}
              <div className="card simulator-card">
                <h2>What-If Financial Simulator</h2>
                <p className="sim-desc">
                  See how improving a financial factor would change your
                  approval chances instantly.
                </p>
                <div className="sim-controls">
                  <div className="field">
                    <label>Factor to Improve</label>
                    <select value={simFeature} onChange={handleSimFeatureChange}>
                      <option value="repayment_history">Repayment History</option>
                      <option value="savings">Total Savings (RM)</option>
                      <option value="monthly_debt">Monthly Debt (RM)</option>
                      <option value="housing_status">Housing Status</option>
                      <option value="loan_purpose">Loan Purpose</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Simulated New Value</label>
                    {simFeature === "repayment_history" && (
                      <select value={simValue}
                        onChange={e => setSimValue(e.target.value)}>
                        <option value="excellent">Excellent — No missed payments</option>
                        <option value="good">Good — Rarely missed</option>
                        <option value="fair">Fair — Occasionally missed</option>
                        <option value="poor">Poor — Frequently missed</option>
                      </select>
                    )}
                    {simFeature === "savings" && (
                      <select value={simValue}
                        onChange={e => setSimValue(Number(e.target.value))}>
                        <option value={500}>RM 500</option>
                        <option value={1000}>RM 1,000</option>
                        <option value={5000}>RM 5,000</option>
                        <option value={10000}>RM 10,000</option>
                        <option value={20000}>RM 20,000</option>
                        <option value={50000}>RM 50,000</option>
                      </select>
                    )}
                    {simFeature === "monthly_debt" && (
                      <select value={simValue}
                        onChange={e => setSimValue(Number(e.target.value))}>
                        <option value={100}>RM 100</option>
                        <option value={300}>RM 300</option>
                        <option value={500}>RM 500</option>
                        <option value={1000}>RM 1,000</option>
                        <option value={2000}>RM 2,000</option>
                        <option value={3000}>RM 3,000</option>
                      </select>
                    )}
                    {simFeature === "housing_status" && (
                      <select value={simValue}
                        onChange={e => setSimValue(e.target.value)}>
                        <option value="own">Own Property</option>
                        <option value="rent">Renting</option>
                        <option value="free">Living Rent-Free</option>
                      </select>
                    )}
                    {simFeature === "loan_purpose" && (
                      <select value={simValue}
                        onChange={e => setSimValue(e.target.value)}>
                        <option value="car">Purchase a Car</option>
                        <option value="education">Education</option>
                        <option value="business">Business</option>
                        <option value="repairs">Home Repairs</option>
                        <option value="furniture/equipment">Furniture / Equipment</option>
                        <option value="vacation/others">Vacation / Others</option>
                      </select>
                    )}
                  </div>
                  <button className="btn-sim"
                    onClick={handleSimulate} disabled={loading}>
                    {loading ? "..." : "▶ Simulate"}
                  </button>
                </div>

                {simResult && (
                  <div className="sim-result">
                    <div className="sim-box current">
                      <p>Current Probability</p>
                      <h3>{simResult.current_approval_prob}%</h3>
                      <span>{simResult.current_decision}</span>
                    </div>
                    <div className="sim-arrow">→</div>
                    <div className="sim-box new">
                      <p>After Change</p>
                      <h3>{simResult.new_approval_prob}%</h3>
                      <span>{simResult.new_decision}</span>
                    </div>
                    <div className={`sim-box improvement
                      ${simResult.improvement >= 0 ? "positive" : "negative"}`}>
                      <p>Net Change</p>
                      <h3>{simResult.improvement > 0 ? "+" : ""}{simResult.improvement}%</h3>
                      <span>{simResult.improvement >= 0
                        ? "Improved ✅" : "Decreased ⚠️"}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}