import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, getDocs,
  orderBy, query, doc, setDoc, getDoc,
  serverTimestamp, deleteDoc
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

// Helper to safely extract milliseconds timestamp from Firestore docs
export const parseDocTime = (docData) => {
  if (!docData) return 0;
  if (docData.timestamp?.toMillis) {
    return docData.timestamp.toMillis();
  }
  if (docData.timestamp?.seconds) {
    return docData.timestamp.seconds * 1000;
  }
  if (docData.created_at) {
    const t = new Date(docData.created_at).getTime();
    if (!isNaN(t)) return t;
  }
  if (docData.timestamp && typeof docData.timestamp === "string") {
    const t = new Date(docData.timestamp).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
};

export const sortAssessmentsDesc = (list) => {
  return [...list].sort((a, b) => parseDocTime(b) - parseDocTime(a));
};

// ── AUTH FUNCTIONS ────────────────────────────────────────────────────────

export const registerUser = async (email, password, name, role="applicant") => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await sendEmailVerification(cred.user);
    // Save user profile to Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
      uid       : cred.user.uid,
      name,
      email,
      role,
      created_at: serverTimestamp(),
      language  : "en",
    }, { merge: true });
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
    console.error("getUserProfile error:", err);
    return null;
  }
};

// ── ASSESSMENT FUNCTIONS ──────────────────────────────────────────────────

export const saveAssessment = async (form, result, uid=null) => {
  try {
    const currentUid = uid || auth.currentUser?.uid || "anonymous";
    const currentEmail = auth.currentUser?.email || form.email || null;

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
      uid             : currentUid,
      email           : currentEmail,
    };

    // Save to global collection
    const ref = await addDoc(collection(db, "assessments"), data);

    // Also save under user's personal collection if logged in
    if (currentUid && currentUid !== "anonymous") {
      try {
        await addDoc(
          collection(db, "users", currentUid, "assessments"), 
          { ...data, id: ref.id }
        );
      } catch (subErr) {
        console.warn("Could not write to user subcollection:", subErr);
      }
    }
    return ref.id;
  } catch (err) {
    console.error("Save assessment failed:", err);
    return null;
  }
};

export const getUserAssessments = async (uid, email = null) => {
  if (!uid) return [];
  const resultsMap = new Map();

  // 1. Check user subcollection (try ordered first, fallback to unordered)
  try {
    let subSnap;
    try {
      const q = query(
        collection(db, "users", uid, "assessments"),
        orderBy("timestamp", "desc")
      );
      subSnap = await getDocs(q);
    } catch {
      subSnap = await getDocs(collection(db, "users", uid, "assessments"));
    }
    if (subSnap && !subSnap.empty) {
      subSnap.docs.forEach(d => {
        resultsMap.set(d.id, { id: d.id, ...d.data() });
      });
    }
  } catch (err) {
    console.warn("Error fetching user subcollection assessments:", err);
  }

  // 2. Also check global assessments collection for any records tied to this uid or email
  try {
    let rootSnap;
    try {
      const q = query(
        collection(db, "assessments"),
        orderBy("timestamp", "desc")
      );
      rootSnap = await getDocs(q);
    } catch {
      rootSnap = await getDocs(collection(db, "assessments"));
    }
    if (rootSnap && !rootSnap.empty) {
      rootSnap.docs.forEach(d => {
        const data = d.data();
        const matchesUid = data.uid === uid || data.userId === uid || data.user_id === uid;
        const matchesEmail = email && data.email && data.email.toLowerCase() === email.toLowerCase();
        if (matchesUid || matchesEmail) {
          if (!resultsMap.has(d.id)) {
            resultsMap.set(d.id, { id: d.id, ...data });
          }
        }
      });
    }
  } catch (err) {
    console.warn("Error fetching root assessments for user:", err);
  }

  return sortAssessmentsDesc(Array.from(resultsMap.values()));
};

export const getAllAssessments = async () => {
  try {
    let snap;
    try {
      const q = query(
        collection(db, "assessments"),
        orderBy("timestamp", "desc")
      );
      snap = await getDocs(q);
    } catch (orderErr) {
      console.warn("getAllAssessments: orderBy failed, falling back to unordered getDocs:", orderErr);
      snap = await getDocs(collection(db, "assessments"));
    }
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return sortAssessmentsDesc(list);
  } catch (err) {
    console.error("getAllAssessments failed:", err);
    return [];
  }
};

export const getAllUsers = async () => {
  try {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("getAllUsers failed:", err);
    return [];
  }
};

// ── FINANCE FUNCTIONS ─────────────────────────────────────────────────────

export const saveExpense = async (uid, expense) => {
  try {
    await addDoc(collection(db, "users", uid, "expenses"), {
      ...expense,
      timestamp: serverTimestamp(),
      created_at: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error("saveExpense error:", err);
    return false;
  }
};

export const getUserExpenses = async (uid) => {
  try {
    let snap;
    try {
      const q = query(
        collection(db, "users", uid, "expenses"),
        orderBy("timestamp", "desc")
      );
      snap = await getDocs(q);
    } catch {
      snap = await getDocs(collection(db, "users", uid, "expenses"));
    }
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return sortAssessmentsDesc(list);
  } catch (err) {
    console.error("getUserExpenses error:", err);
    return [];
  }
};

export const saveSavingsGoal = async (uid, goal) => {
  try {
    await setDoc(doc(db, "users", uid, "goals", "savings"), {
      ...goal,
      updated_at: serverTimestamp(),
      updated_at_str: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.error("saveSavingsGoal error:", err);
    return false;
  }
};

export const getSavingsGoal = async (uid) => {
  try {
    const snap = await getDoc(doc(db, "users", uid, "goals", "savings"));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("getSavingsGoal error:", err);
    return null;
  }
};

export const clearUserHistory = async (uid) => {
  try {
    const q = query(collection(db, "users", uid, "assessments"));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    return true;
  } catch (err) {
    console.error("Clear failed:", err);
    return false;
  }
};
