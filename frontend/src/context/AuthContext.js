import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db, getUserProfile } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// ONLY the designated master administrator account
export const ADMIN_EMAILS = [
  "hanifaiman390@gmail.com",
  "rohanaadmin@gmail.com"
  
];

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang]       = useState("en");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const emailLower = (firebaseUser.email || "").toLowerCase();
        const isMasterAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === emailLower);

        try {
          let prof = await getUserProfile(firebaseUser.uid);

          if (!prof) {
            prof = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || (isMasterAdmin ? "Admin" : "Applicant"),
              role: isMasterAdmin ? "admin" : "applicant",
              language: "en"
            };
            try {
              await setDoc(doc(db, "users", firebaseUser.uid), prof, { merge: true });
            } catch (saveErr) {
              console.warn("Could not persist initial profile:", saveErr);
            }
          } else if (isMasterAdmin && prof.role !== "admin") {
            // Ensure master admin always has role: "admin"
            prof = { ...prof, role: "admin" };
            try {
              await setDoc(doc(db, "users", firebaseUser.uid), { role: "admin" }, { merge: true });
            } catch (saveErr) {
              console.warn("Could not update admin role in Firestore:", saveErr);
            }
          } else if (!isMasterAdmin && prof.role === "admin") {
            // Automatically reset non-admin accounts that previously got marked as admin
            prof = { ...prof, role: "applicant" };
            try {
              await setDoc(doc(db, "users", firebaseUser.uid), { role: "applicant" }, { merge: true });
            } catch (saveErr) {
              console.warn("Could not reset role in Firestore:", saveErr);
            }
          }

          setProfile(prof);
          if (prof?.language) setLang(prof.language);
        } catch (err) {
          console.error("Error loading user profile:", err);
          if (isMasterAdmin) {
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || "Admin",
              role: "admin",
              language: "en"
            });
          }
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const toggleLang = () => {
    setLang(prev => (prev === "en" ? "ms" : "en"));
  };

  const emailLower = (user?.email || "").toLowerCase();
  const isMasterAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === emailLower);
  const isAdmin = isMasterAdmin || profile?.role === "admin";

  return (
    <AuthContext.Provider value={{
      user, profile, loading, lang, toggleLang,
      isAdmin,
      isLoanOfficer  : profile?.role === "loan_officer",
      isApplicant    : !isAdmin,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
