import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, getDocs,
  orderBy, query, doc, setDoc, getDoc,
  serverTimestamp
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  updateProfile
} from "firebase/auth";

const firebaseConfig = {
  apiKey           : "AIzaSyBlUdSaKMw-QwwggdgjqCZ3n1eAAmVdLpg",
  authDomain       : "ai-credit-scoring-2bf4b.firebaseapp.com",
  projectId        : "ai-credit-scoring-2bf4b",
  storageBucket    : "ai-credit-scoring-2bf4b.firebasestorage.app",
  messagingSenderId: "1023272794340",
  appId            : "1:1023272794340:web:088004a313981ca89894f1"
};

const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// ── AUTH FUNCTIONS ────────────────────────────────────────────────────────

export const registerUser = async (email, password, name, role="applicant") => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await sendEmailVerification(cred.user);
    // Save user profile to Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
      uid      : cred.user.uid,
      name,
      email,
      role,
      created_at: serverTimestamp(),
      language : "en",
    });
    return { success: true, user: cred.user };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const loginUser = async (email, password) => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: cred.user };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const getUserProfile = async (uid) => {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    return null;
  }
};

// ── ASSESSMENT FUNCTIONS ──────────────────────────────────────────────────

export const saveAssessment = async (form, result, uid=null) => {
  try {
    const data = {
      ...form,
      credit_score    : result.credit_score,
      decision        : result.decision,
      risk_class      : result.credit_score >= 70 ? "Low Risk"
                        : result.credit_score >= 50 ? "Medium Risk"
                        : "High Risk",
      explanations    : result.explanations    || [],
      recommendations : result.recommendations || [],
      timestamp       : serverTimestamp(),
      created_at      : new Date().toISOString(),
      uid             : uid || "anonymous",
    };

    // Save to global collection
    const ref = await addDoc(collection(db, "assessments"), data);

    // Also save under user's personal collection if logged in
    if (uid) {
      await addDoc(
        collection(db, "users", uid, "assessments"), 
        { ...data, id: ref.id }
      );
    }
    return ref.id;
  } catch (err) {
    console.error("Save failed:", err);
    return null;
  }
};

export const getUserAssessments = async (uid) => {
  try {
    const q    = query(
      collection(db, "users", uid, "assessments"),
      orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    return [];
  }
};

export const getAllAssessments = async () => {
  try {
    const q    = query(
      collection(db, "assessments"),
      orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    return [];
  }
};

export const getAllUsers = async () => {
  try {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    return [];
  }
};

// ── FINANCE FUNCTIONS ─────────────────────────────────────────────────────

export const saveExpense = async (uid, expense) => {
  try {
    await addDoc(collection(db, "users", uid, "expenses"), {
      ...expense,
      timestamp: serverTimestamp(),
    });
    return true;
  } catch (err) {
    return false;
  }
};

export const getUserExpenses = async (uid) => {
  try {
    const q    = query(
      collection(db, "users", uid, "expenses"),
      orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    return [];
  }
};

export const saveSavingsGoal = async (uid, goal) => {
  try {
    await setDoc(doc(db, "users", uid, "goals", "savings"), {
      ...goal,
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    return false;
  }
};

export const getSavingsGoal = async (uid) => {
  try {
    const snap = await getDoc(doc(db, "users", uid, "goals", "savings"));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    return null;
  }
};