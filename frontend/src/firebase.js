import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, 
         orderBy, query, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey           : "AIzaSyBlUdSaKMw-QwwggdgjqCZ3n1eAAmVdLpg",
  authDomain       : "ai-credit-scoring-2bf4b.firebaseapp.com",
  projectId        : "ai-credit-scoring-2bf4b",
  storageBucket    : "ai-credit-scoring-2bf4b.firebasestorage.app",
  messagingSenderId: "1023272794340",
  appId            : "1:1023272794340:web:088004a313981ca89894f1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ── Save assessment to Firestore ─────────────────────────────────────────
export const saveAssessment = async (form, result) => {
  try {
    const docRef = await addDoc(collection(db, "assessments"), {
      // Applicant info
      age                    : form.age,
      gender                 : form.gender,
      employment_status      : form.employment_status,
      employment_type        : form.employment_type,
      employment_duration    : form.employment_duration,
      monthly_income         : form.monthly_income,
      dependents             : form.dependents,
      housing_status         : form.housing_status,
      monthly_housing_payment: form.monthly_housing_payment,

      // Financial info
      monthly_debt           : form.monthly_debt,
      outstanding_financing  : form.outstanding_financing,
      credit_card_balance    : form.credit_card_balance,
      credit_card_limit      : form.credit_card_limit,
      savings                : form.savings,
      repayment_history      : form.repayment_history,

      // Loan info
      loan_amount            : form.loan_amount,
      loan_duration          : form.loan_duration,
      loan_purpose           : form.loan_purpose,

      // Results
      credit_score           : result.credit_score,
      decision               : result.decision,
      risk_class             : result.credit_score >= 70 ? "Low Risk"
                               : result.credit_score >= 50 ? "Medium Risk"
                               : "High Risk",
      explanations           : result.explanations || [],
      recommendations        : result.recommendations || [],

      // Metadata
      timestamp              : serverTimestamp(),
      created_at             : new Date().toISOString(),
    });
    console.log("✅ Assessment saved:", docRef.id);
    return docRef.id;
  } catch (err) {
    console.error("❌ Failed to save:", err);
    return null;
  }
};

// ── Get all past assessments ─────────────────────────────────────────────
export const getAssessments = async () => {
  try {
    const q    = query(
      collection(db, "assessments"),
      orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("❌ Failed to fetch:", err);
    return [];
  }
};