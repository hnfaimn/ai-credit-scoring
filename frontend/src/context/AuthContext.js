import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, getUserProfile } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang]       = useState("en");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const prof = await getUserProfile(firebaseUser.uid);
        setProfile(prof);
        if (prof?.language) setLang(prof.language);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const toggleLang = () => {
    setLang(prev => prev === "en" ? "ms" : "en");
  };

  return (
    <AuthContext.Provider value={{
      user, profile, loading, lang, toggleLang,
      isAdmin        : profile?.role === "admin",
      isLoanOfficer  : profile?.role === "loan_officer",
      isApplicant    : profile?.role === "applicant",
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};