import React, { useState, useRef } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import { useAuth } from "../context/AuthContext";
import { saveAssessment } from "../firebase";
import { STRINGS, t } from "../lang/strings";
import {
  RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Cell
} from "recharts";
import {
  User,
  DollarSign,
  Landmark,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Sliders,
  Download,
  Check,
  X,
  Play,
  Loader2
} from "lucide-react";

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

function validateForm(form, s) {
  const errors = {};
  if (!form.age || form.age < 18 || form.age > 80)
    errors.age = t(s, "err_age");
  if (!form.monthly_income || form.monthly_income <= 0)
    errors.monthly_income = t(s, "err_income");
  if (!form.loan_amount || form.loan_amount <= 0)
    errors.loan_amount = t(s, "err_loan_amount");
  if (!form.loan_duration || form.loan_duration < 1 || form.loan_duration > 84)
    errors.loan_duration = t(s, "err_loan_duration");
  if (form.monthly_debt < 0)
    errors.monthly_debt = t(s, "err_monthly_debt");
  if (form.savings < 0)
    errors.savings = t(s, "err_savings");
  if (form.credit_card_balance < 0)
    errors.credit_card_balance = t(s, "err_cc_balance");
  if (form.monthly_housing_payment < 0)
    errors.monthly_housing_payment = t(s, "err_housing_payment");
  const totalDebt = form.monthly_debt + form.monthly_housing_payment;
  const dti = totalDebt / form.monthly_income;
  if (dti > 0.9)
    errors.monthly_income = t(s, "err_dti_high");
  return errors;
}

export default function Assess() {
  const { user, lang }                = useAuth();
  const s                             = STRINGS[lang] || STRINGS.en;
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
    if (score >= 70) return t(s, "low_risk");
    if (score >= 50) return t(s, "medium_risk");
    return t(s, "high_risk");
  };

  const totalMonthlyDebt = Number(form.monthly_debt || 0) + Number(form.monthly_housing_payment || 0);
  const dtiRatio = form.monthly_income > 0
    ? ((totalMonthlyDebt / form.monthly_income) * 100).toFixed(1) : 0;
  const dtiColor = dtiRatio <= 30 ? "#2ecc71"
    : dtiRatio <= 50 ? "#f39c12" : "#e74c3c";
  const dtiLabel = dtiRatio <= 30 ? t(s, "dti_healthy")
    : dtiRatio <= 50 ? t(s, "dti_moderate") : t(s, "dti_high_risk");

  // Translation helpers for dynamic backend responses
  const translateSentence = (exp) => {
    if (!exp) return "";
    if (lang !== "ms") return exp.sentence;
    const labelMap = {
      "checking account status": "status akaun semasa",
      "loan duration": "tempoh pinjaman",
      "credit amount requested": "jumlah kredit yang dipohon",
      "savings account status": "status akaun simpanan",
      "age": "umur",
      "loan purpose": "tujuan pinjaman",
      "housing situation": "situasi kediaman",
      "gender": "jantina",
      "job type": "jenis pekerjaan",
      "repayment history": "sejarah pembayaran balik"
    };
    const bmLabel = labelMap[exp.label?.toLowerCase()] || exp.label;
    const direction = exp.shap_val > 0 ? "meningkatkan" : "mengurangkan";
    const absVal = Math.abs(exp.shap_val);
    const strength = absVal > 0.5 ? "secara ketara" : absVal > 0.2 ? "secara sederhana" : "sedikit";
    return `Faktor ${bmLabel} anda ${strength} ${direction} risiko kredit anda (impak: ${exp.shap_val > 0 ? "+" : ""}${exp.shap_val.toFixed(3)}).`;
  };

  const translateTip = (tip) => {
    if (!tip || lang !== "ms") return tip;
    const tipMap = {
      "Open or maintain an active checking account with a positive balance.": "Buka atau kekalkan akaun semasa yang aktif dengan baki positif.",
      "Consider applying for a shorter loan duration.": "Pertimbangkan untuk memohon tempoh pinjaman yang lebih pendek.",
      "Apply for a lower credit amount relative to your income.": "Mohon jumlah kredit yang lebih rendah berbanding pendapatan anda.",
      "Build up your savings before reapplying.": "Tingkatkan simpanan anda sebelum memohon semula.",
      "Build a credit history through smaller loans first.": "Bina sejarah kredit melalui pinjaman kecil terlebih dahulu.",
      "Essential loan purposes are viewed more favourably.": "Tujuan pinjaman keperluan dinilai dengan lebih baik.",
      "Property ownership improves your credit profile.": "Pemilikan hartanah menambah baik profil kredit anda.",
      "Stable skilled employment improves your credit profile.": "Pekerjaan mahir yang stabil menambah baik profil kredit anda."
    };
    const reasonMap = {
      "Checking account status is the strongest predictor of credit risk.": "Status akaun semasa adalah peramal paling kuat bagi risiko kredit.",
      "Longer durations increase repayment risk.": "Tempoh pinjaman yang lebih lama meningkatkan risiko pembayaran balik.",
      "Higher amounts increase default risk.": "Jumlah pinjaman yang lebih tinggi meningkatkan risiko keingkaran.",
      "Low savings indicates financial vulnerability.": "Simpanan yang rendah menunjukkan kerentanan kewangan.",
      "Age reflects financial experience and stability.": "Umur mencerminkan pengalaman dan kestabilan kewangan.",
      "Loan purpose is associated with repayment intent.": "Tujuan pinjaman dikaitkan dengan niat pembayaran balik.",
      "Housing stability indicates financial responsibility.": "Kestabilan kediaman menunjukkan tanggungjawab kewangan.",
      "Employment type reflects repayment reliability.": "Jenis pekerjaan mencerminkan kebolehpercayaan pembayaran balik."
    };
    return {
      ...tip,
      tip: tipMap[tip.tip] || tip.tip,
      reason: reasonMap[tip.reason] || tip.reason,
      priorityLabel: tip.priority === "High" ? t(s, "high_priority")
        : tip.priority === "Medium" ? t(s, "medium_priority") : t(s, "low_priority")
    };
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errors = validateForm(form, s);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(t(s, "err_fix_errors"));
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
      const id = await saveAssessment(form, res.data, user?.uid);
      setSavedId(id);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    } catch {
      setError(t(s, "err_server_conn"));
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
      setError(t(s, "err_sim_failed"));
    } finally {
      setLoading(false);
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
        pdf.setDrawColor(220, 225, 235);
        pdf.line(10, y, pdfW - 10, y);
        y += 4;
      };

      // Header Banner
      pdf.setFillColor(27, 58, 107);
      pdf.rect(0, 0, pdfW, 26, "F");
      pdf.setFillColor(245, 166, 35);
      pdf.rect(0, 25, pdfW, 2, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.text("CrediWise — Credit Assessment Report", 14, 12);
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.text("Explainable AI-Based Pre-Approval & Risk Evaluation", 14, 18);
      pdf.setFontSize(8);
      pdf.text(new Date().toLocaleDateString("en-MY", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      }), pdfW - 14, 18, { align: "right" });

      y = 36;

      // Section 1: Executive Summary
      sectionTitle("EXECUTIVE SUMMARY");
      row("Assessment Decision", result.decision?.toUpperCase() === "APPROVED" ? "APPROVED" : "REJECTED", true);
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

      // Section 2: Applicant Information
      sectionTitle("APPLICANT INFORMATION");
      row("Age", `${form.age} years`, true);
      row("Gender", form.gender === "male" ? "Male" : "Female");
      row("Employment Status", form.employment_status.replace("_"," "), true);
      row("Employment Type", form.employment_type.replace("_"," "));
      row("Employment Duration", `${form.employment_duration} months`, true);
      row("Monthly Net Income", `RM ${Number(form.monthly_income || 0).toLocaleString()}`);
      row("Number of Dependents", String(form.dependents), true);
      row("Housing Status", form.housing_status);
      row("Monthly Housing Payment", `RM ${Number(form.monthly_housing_payment || 0).toLocaleString()}`, true);
      divider(); y += 2;

      // Section 3: Financial Information
      sectionTitle("FINANCIAL & CREDIT INFORMATION");
      row("Monthly Debt Commitments", `RM ${Number(form.monthly_debt || 0).toLocaleString()}`, true);
      row("Outstanding Financing", `RM ${Number(form.outstanding_financing || 0).toLocaleString()}`);
      row("Credit Card Balance", `RM ${Number(form.credit_card_balance || 0).toLocaleString()}`, true);
      row("Credit Card Limit", `RM ${Number(form.credit_card_limit || 0).toLocaleString()}`);
      row("Total Savings", `RM ${Number(form.savings || 0).toLocaleString()}`, true);
      row("Repayment History", form.repayment_history);
      divider(); y += 2;

      // Section 4: Loan Details
      sectionTitle("LOAN APPLICATION DETAILS");
      row("Loan Amount Requested", `RM ${Number(form.loan_amount || 0).toLocaleString()}`, true);
      row("Loan Duration", `${form.loan_duration} months`);
      row("Loan Purpose", form.loan_purpose, true);
      row("Estimated Monthly Payment",
        `RM ${Math.round(form.loan_amount / form.loan_duration).toLocaleString()}`);
      divider(); y += 2;

      // Section 5: Explanations
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
        pdf.setFillColor(isRisk ? 253 : 240, isRisk ? 237 : 253, isRisk ? 236 : 244);
        pdf.rect(10, y, pdfW - 20, 16, "F");
        pdf.setFillColor(isRisk ? 231 : 46, isRisk ? 76 : 204, isRisk ? 60 : 113);
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
        pdf.text("Confidential — AI Credit Assessment Report", 14, pdfH - 3.5);
        pdf.text(`Page ${p} of ${totalPages}`, pdfW - 14, pdfH - 3.5, { align: "right" });
      }

      pdf.save(`credit_report_${Date.now()}.pdf`);

    } catch (err) {
      console.error(err);
      setError(t(s, "err_pdf_failed"));
    } finally {
      setExportLoading(false);
    }
  };

  const Tab = ({ id, label, icon: IconComponent }) => (
    <button
      className={`tab-btn ${activeSection === id ? "active" : ""}`}
      onClick={() => setActiveSection(id)}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {IconComponent && <IconComponent size={16} />}
      {label}
    </button>
  );

  const FieldError = ({ name }) =>
    fieldErrors[name]
      ? <span className="field-error">⚠ {fieldErrors[name]}</span>
      : null;

  return (
    <div className="app">
      <div className="main">

        {/* ══ LEFT: FORM ══ */}
        <div className="card form-card">
          <h2>{t(s, "form_title")}</h2>
          <p className="form-hint">{t(s, "form_hint")}</p>

          {/* DTI Banner */}
          {form.monthly_income > 0 && (
            <div className="dti-banner" style={{ borderColor: dtiColor }}>
              <div className="dti-info">
                <span className="dti-label">{t(s, "dti_title")}</span>
                <span className="dti-value" style={{ color: dtiColor }}>
                  {dtiRatio}% — {dtiLabel}
                </span>
              </div>
              <div className="dti-bar-bg">
                <div className="dti-bar-fill"
                  style={{ width:`${Math.min(100, dtiRatio)}%`, background:dtiColor }} />
              </div>
              <p className="dti-note">
                {t(s, "dti_total_debt")}: RM {totalMonthlyDebt.toLocaleString()} /{" "}
                {t(s, "dti_income")}: RM {Number(form.monthly_income || 0).toLocaleString()}
                &nbsp;({t(s, "dti_ideal")})
              </p>
            </div>
          )}

          <div className="tabs">
            <Tab id="applicant" icon={User} label={t(s, "tab_applicant")} />
            <Tab id="financial" icon={DollarSign} label={t(s, "tab_financial")} />
            <Tab id="loan" icon={Landmark} label={t(s, "tab_loan")} />
          </div>

          {/* Tab 1: Applicant Information */}
          {activeSection === "applicant" && (
            <div className="form-section">
              <div className="section-label">{t(s, "sec_applicant")}</div>
              <div className="form-grid">
                <div className="field">
                  <label>{t(s, "lbl_age")} <span className="hint">({t(s, "lbl_years")})</span></label>
                  <input type="number" name="age" min="18" max="80"
                    className={fieldErrors.age ? "input-error" : ""}
                    value={form.age} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="age" />
                </div>
                <div className="field">
                  <label>{t(s, "lbl_gender")}</label>
                  <select name="gender" value={form.gender} onChange={handleChange}>
                    <option value="male">{t(s, "opt_male")}</option>
                    <option value="female">{t(s, "opt_female")}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t(s, "lbl_emp_status")}</label>
                  <select name="employment_status" value={form.employment_status}
                    onChange={handleChange}>
                    <option value="employed">{t(s, "opt_employed")}</option>
                    <option value="self_employed">{t(s, "opt_self_employed")}</option>
                    <option value="unemployed">{t(s, "opt_unemployed")}</option>
                    <option value="retired">{t(s, "opt_retired")}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t(s, "lbl_emp_type")}</label>
                  <select name="employment_type" value={form.employment_type}
                    onChange={handleChange}>
                    <option value="highly_skilled">{t(s, "opt_highly_skilled")}</option>
                    <option value="skilled">{t(s, "opt_skilled")}</option>
                    <option value="unskilled">{t(s, "opt_unskilled")}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t(s, "lbl_emp_duration")} <span className="hint">({t(s, "lbl_months")})</span></label>
                  <input type="number" name="employment_duration" min="0"
                    value={form.employment_duration} onChange={handleChange} onFocus={e => e.target.select()} />
                </div>
                <div className="field">
                  <label>{t(s, "lbl_monthly_income")} <span className="hint">(RM)</span></label>
                  <input type="number" name="monthly_income" min="0"
                    className={fieldErrors.monthly_income ? "input-error" : ""}
                    value={form.monthly_income} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="monthly_income" />
                </div>
                <div className="field">
                  <label>{t(s, "lbl_dependents")}</label>
                  <input type="number" name="dependents" min="0" max="10"
                    value={form.dependents} onChange={handleChange} onFocus={e => e.target.select()} />
                </div>
                <div className="field">
                  <label>{t(s, "lbl_housing_status")}</label>
                  <select name="housing_status" value={form.housing_status}
                    onChange={handleChange}>
                    <option value="own">{t(s, "opt_housing_own")}</option>
                    <option value="rent">{t(s, "opt_housing_rent")}</option>
                    <option value="free">{t(s, "opt_housing_free")}</option>
                  </select>
                </div>
                <div className="field full">
                  <label>{t(s, "lbl_housing_payment")} <span className="hint">(RM)</span></label>
                  <input type="number" name="monthly_housing_payment" min="0"
                    className={fieldErrors.monthly_housing_payment ? "input-error":""}
                    value={form.monthly_housing_payment} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="monthly_housing_payment" />
                </div>
              </div>
              <button className="btn-next"
                onClick={() => setActiveSection("financial")}>
                {t(s, "btn_next_financial")}
              </button>
            </div>
          )}

          {/* Tab 2: Financial Information */}
          {activeSection === "financial" && (
            <div className="form-section">
              <div className="section-label">{t(s, "sec_financial")}</div>
              <div className="form-grid">
                <div className="field">
                  <label>{t(s, "lbl_monthly_debt")} <span className="hint">(RM)</span></label>
                  <input type="number" name="monthly_debt" min="0"
                    className={fieldErrors.monthly_debt ? "input-error" : ""}
                    value={form.monthly_debt} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="monthly_debt" />
                </div>
                <div className="field">
                  <label>{t(s, "lbl_outstanding_financing")} <span className="hint">(RM)</span></label>
                  <input type="number" name="outstanding_financing" min="0"
                    value={form.outstanding_financing} onChange={handleChange} onFocus={e => e.target.select()} />
                </div>
                <div className="field">
                  <label>{t(s, "lbl_cc_balance")} <span className="hint">(RM)</span></label>
                  <input type="number" name="credit_card_balance" min="0"
                    className={fieldErrors.credit_card_balance ? "input-error":""}
                    value={form.credit_card_balance} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="credit_card_balance" />
                </div>
                <div className="field">
                  <label>{t(s, "lbl_cc_limit")} <span className="hint">(RM)</span></label>
                  <input type="number" name="credit_card_limit" min="0"
                    value={form.credit_card_limit} onChange={handleChange} onFocus={e => e.target.select()} />
                </div>
                <div className="field">
                  <label>{t(s, "lbl_savings")} <span className="hint">(RM)</span></label>
                  <input type="number" name="savings" min="0"
                    className={fieldErrors.savings ? "input-error" : ""}
                    value={form.savings} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="savings" />
                </div>
                <div className="field">
                  <label>{t(s, "lbl_repayment_history")}</label>
                  <select name="repayment_history" value={form.repayment_history}
                    onChange={handleChange}>
                    <option value="excellent">{t(s, "opt_rep_excellent")}</option>
                    <option value="good">{t(s, "opt_rep_good")}</option>
                    <option value="fair">{t(s, "opt_rep_fair")}</option>
                    <option value="poor">{t(s, "opt_rep_poor")}</option>
                  </select>
                </div>
              </div>
              <div className="btn-row">
                <button className="btn-back"
                  onClick={() => setActiveSection("applicant")}>{t(s, "btn_back")}</button>
                <button className="btn-next"
                  onClick={() => setActiveSection("loan")}>{t(s, "btn_next_loan")}</button>
              </div>
            </div>
          )}

          {/* Tab 3: Loan Application */}
          {activeSection === "loan" && (
            <div className="form-section">
              <div className="section-label">{t(s, "sec_loan")}</div>
              <div className="form-grid">
                <div className="field">
                  <label>{t(s, "lbl_loan_amount")} <span className="hint">(RM)</span></label>
                  <input type="number" name="loan_amount" min="100"
                    className={fieldErrors.loan_amount ? "input-error" : ""}
                    value={form.loan_amount} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="loan_amount" />
                </div>
                <div className="field">
                  <label>{t(s, "lbl_loan_duration")} <span className="hint">({t(s, "lbl_months")})</span></label>
                  <input type="number" name="loan_duration" min="1" max="84"
                    className={fieldErrors.loan_duration ? "input-error" : ""}
                    value={form.loan_duration} onChange={handleChange} onFocus={e => e.target.select()} />
                  <FieldError name="loan_duration" />
                </div>
                <div className="field full">
                  <label>{t(s, "lbl_loan_purpose")}</label>
                  <select name="loan_purpose" value={form.loan_purpose}
                    onChange={handleChange}>
                    <option value="car">{t(s, "Car")}</option>
                    <option value="furniture/equipment">{t(s, "Furniture")}</option>
                    <option value="education">{t(s, "Education")}</option>
                    <option value="business">{t(s, "Business")}</option>
                    <option value="repairs">{t(s, "Repairs")}</option>
                    <option value="vacation/others">{t(s, "Vacation")}</option>
                    <option value="vacation/others">{t(s, "Others")}</option>
                  </select>
                </div>
                <div className="field full">
                  <div className="loan-summary">
                    <div className="loan-sum-item">
                      <span>{t(s, "sum_loan_amount")}</span>
                      <strong>RM {Number(form.loan_amount || 0).toLocaleString()}</strong>
                    </div>
                    <div className="loan-sum-item">
                      <span>{t(s, "sum_duration")}</span>
                      <strong>{form.loan_duration} {t(s, "lbl_months")}</strong>
                    </div>
                    <div className="loan-sum-item">
                      <span>{t(s, "sum_est_monthly")}</span>
                      <strong>
                        RM {Math.round(form.loan_amount / form.loan_duration).toLocaleString()}
                      </strong>
                    </div>
                    <div className="loan-sum-item">
                      <span>{t(s, "sum_lti")}</span>
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
                  onClick={() => setActiveSection("financial")}>{t(s, "btn_back")}</button>
                <button className="btn-primary"
                  onClick={handleSubmit} disabled={loading}>
                  {loading ? t(s, "btn_analysing") : t(s, "assess_btn")}
                </button>
              </div>
            </div>
          )}

          {error && <p className="error" style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertCircle size={16} /> {error}</p>}
        </div>

        {/* ══ RIGHT: RESULTS ══ */}
        <div className="results">
          {!result && !loading && (
            <div className="card placeholder">
              <div className="placeholder-icon"><BarChart3 size={40} color="#065663" /></div>
              <p>{t(s, "placeholder_text")}</p>
            </div>
          )}

          {loading && (
            <div className="card placeholder">
              <div className="placeholder-icon spinning"><Loader2 size={40} color="#065663" /></div>
              <p>{t(s, "loading_profile")}</p>
              <p className="section-hint" style={{ marginTop: 8 }}>
                {t(s, "loading_hint")}
              </p>
            </div>
          )}

          {result && !loading && (
            <div ref={resultRef}>

              {/* Export + History bar */}
              <div className="export-bar">
                <span className="export-label">
                  {t(s, "assessment_complete")}
                  {savedId &&
                    <span className="saved-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={13} /> {t(s, "saved_to_cloud")}</span>}
                </span>
                <div className="export-btns">
                  <button className="btn-export"
                    onClick={handleExportPDF} disabled={exportLoading}>
                    {exportLoading ? <><Loader2 size={14} className="spinning" /> {t(s, "btn_exporting")}</> : <><Download size={14} /> {t(s, "btn_export_pdf")}</>}
                  </button>
                </div>
              </div>

              {/* Score Card */}
              <div className="card score-card">
                <h2>{t(s, "result_title")}</h2>
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
                      {result.decision==="Approved" ? <><Check size={16} /> {t(s, "approved")}</> : <><X size={16} /> {t(s, "rejected")}</>}
                    </div>
                    <p><strong>{t(s, "approval_prob")}:</strong> {result.credit_score}%</p>
                    <p><strong>{t(s, "risk_class")}:</strong> {riskLabel(result.credit_score)}</p>
                    <p><strong>{t(s, "dti_title")}:</strong>{" "}
                      <span style={{ color:dtiColor, fontWeight:600 }}>
                        {dtiRatio}% ({dtiLabel})
                      </span>
                    </p>
                    <p><strong>{t(s, "sum_lti")}:</strong>{" "}
                      {form.monthly_income > 0
                        ? `${(form.loan_amount/form.monthly_income).toFixed(1)}x`
                        : "—"}
                    </p>
                    <p className="score-note">
                      {t(s, "score_eligible_note")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Explanations */}
              <div className="card">
                <h2>{t(s, "why_title")}</h2>
                <p className="section-hint">
                  {t(s, "why_hint")}
                </p>
                {result.explanations?.map((exp, i) => (
                  <div key={i} className="explanation-item">
                    <div className="exp-bar" style={{
                      background : exp.shap_val > 0 ? "#e74c3c22" : "#2ecc7122",
                      borderLeft : `4px solid ${exp.shap_val>0 ? "#e74c3c" : "#2ecc71"}`
                    }}>
                      <p className="exp-sentence">{translateSentence(exp)}</p>
                      <span className="exp-badge"
                        style={{ background: exp.shap_val>0 ? "#e74c3c" : "#2ecc71" }}>
                        {exp.shap_val>0 ? `↑ ${t(s, "increases_risk")}` : `↓ ${t(s, "reduces_risk")}`}
                      </span>
                    </div>
                  </div>
                ))}
                {result.explanations?.length > 0 && (
                  <div style={{ marginTop:16 }}>
                    <p className="chart-title">{t(s, "chart_title")}</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={result.explanations.map(e=>({
                          name: e.label, value: e.shap_val
                        }))}
                        layout="vertical"
                        margin={{ left:20, right:20, top:5, bottom:5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name"
                          width={170} tick={{ fontSize:11 }} />
                        <Tooltip formatter={(v)=>[`${Number(v).toFixed(4)}`,"SHAP Impact"]} />
                        <Bar dataKey="value" radius={4}>
                          {result.explanations.map((e,i)=>(
                            <Cell key={i}
                              fill={e.shap_val>0 ? "#e74c3c" : "#2ecc71"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="chart-note">
                      <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:"#2ecc71", marginRight:4 }} /> {t(s, "chart_legend_green")} &nbsp;|&nbsp; <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:"#e74c3c", marginRight:4 }} /> {t(s, "chart_legend_red")}
                    </p>
                  </div>
                )}
              </div>

              {/* Recommendations */}
              <div className="card">
                <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><Lightbulb size={20} color="#065663" /> {t(s, "improve_title")}</h2>
                <p className="section-hint">
                  {t(s, "improve_hint")}
                </p>
                {result.recommendations?.length > 0
                  ? result.recommendations.map((rawTip, i) => {
                    const tip = translateTip(rawTip);
                    return (
                      <div key={i} className="tip-item">
                        <span className={`priority priority-${rawTip.priority.toLowerCase()}`}>
                          {tip.priorityLabel || `${rawTip.priority} ${t(s, "priority_suffix")}`}
                        </span>
                        <div>
                          <p className="tip-text">{tip.tip}</p>
                          <p className="tip-reason">{t(s, "why_prefix")}: {tip.reason}</p>
                        </div>
                      </div>
                    );
                  })
                  : <p className="good-msg">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={16} color="#07C980" /> {t(s, "profile_strong_msg")}</span>
                    </p>
                }
              </div>

              {/* Simulator */}
              <div className="card simulator-card">
                <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><Sliders size={20} color="#065663" /> {t(s, "sim_title")}</h2>
                <p className="sim-desc">
                  {t(s, "sim_desc")}
                </p>
                <div className="sim-controls">
                  <div className="field">
                    <label>{t(s, "sim_factor")}</label>
                    <select value={simFeature} onChange={handleSimFeatureChange}>
                      <option value="repayment_history">{t(s, "sim_feat_repayment")}</option>
                      <option value="savings">{t(s, "sim_feat_savings")}</option>
                      <option value="monthly_debt">{t(s, "sim_feat_debt")}</option>
                      <option value="housing_status">{t(s, "sim_feat_housing")}</option>
                      <option value="loan_purpose">{t(s, "sim_feat_purpose")}</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>{t(s, "sim_value")}</label>
                    {simFeature === "repayment_history" && (
                      <select value={simValue}
                        onChange={e => setSimValue(e.target.value)}>
                        <option value="excellent">{t(s, "opt_rep_excellent")}</option>
                        <option value="good">{t(s, "opt_rep_good")}</option>
                        <option value="fair">{t(s, "opt_rep_fair")}</option>
                        <option value="poor">{t(s, "opt_rep_poor")}</option>
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
                        <option value="own">{t(s, "opt_housing_own")}</option>
                        <option value="rent">{t(s, "opt_housing_rent")}</option>
                        <option value="free">{t(s, "opt_housing_free")}</option>
                      </select>
                    )}
                    {simFeature === "loan_purpose" && (
                      <select value={simValue}
                        onChange={e => setSimValue(e.target.value)}>
                        <option value="car">{t(s, "purpose_car")}</option>
                        <option value="education">{t(s, "purpose_education")}</option>
                        <option value="business">{t(s, "purpose_business")}</option>
                        <option value="repairs">{t(s, "purpose_repairs")}</option>
                        <option value="furniture/equipment">{t(s, "purpose_furniture")}</option>
                        <option value="vacation/others">{t(s, "purpose_vacation")}</option>
                      </select>
                    )}
                  </div>
                  <button className="btn-sim"
                    onClick={handleSimulate} disabled={loading}>
                    {loading ? "..." : <><Play size={14} /> {t(s, "sim_btn")}</>}
                  </button>
                </div>

                {simResult && (
                  <div className="sim-result">
                    <div className="sim-box current">
                      <p>{t(s, "sim_current")}</p>
                      <h3>{simResult.current_approval_prob}%</h3>
                      <span>{simResult.current_decision === "Approved" ? t(s, "approved") : t(s, "rejected")}</span>
                    </div>
                    <div className="sim-arrow">→</div>
                    <div className="sim-box new">
                      <p>{t(s, "sim_after")}</p>
                      <h3>{simResult.new_approval_prob}%</h3>
                      <span>{simResult.new_decision === "Approved" ? t(s, "approved") : t(s, "rejected")}</span>
                    </div>
                    <div className={`sim-box improvement
                      ${simResult.improvement >= 0 ? "positive" : "negative"}`}>
                      <p>{t(s, "sim_change")}</p>
                      <h3>{simResult.improvement > 0 ? "+" : ""}{simResult.improvement}%</h3>
                      <span>{simResult.improvement >= 0
                        ? t(s, "improved") : t(s, "decreased")}</span>
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