import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import Assess from "./pages/Assess";
import History from "./pages/History";
import Trajectory from "./pages/Trajectory";
import Finance from "./pages/Finance";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import "./App.css";

export default function Assess() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<Landing />} />
          <Route path="/"         element={<Navigate to="/login" replace />} />

          {/* Protected — Applicant */}
          <Route path="/dashboard/assess" element={
            <ProtectedRoute><Assess /></ProtectedRoute>
          } />
          <Route path="/dashboard/history" element={
            <ProtectedRoute><History /></ProtectedRoute>
          } />
          <Route path="/dashboard/trajectory" element={
            <ProtectedRoute><Trajectory /></ProtectedRoute>
          } />
          <Route path="/dashboard/finance" element={
            <ProtectedRoute><Finance /></ProtectedRoute>
          } />
          <Route path="/dashboard/profile" element={
            <ProtectedRoute><Profile /></ProtectedRoute>
          } />

          {/* Protected — Admin only */}
          <Route path="/admin" element={
            <ProtectedRoute adminOnly={true}><Admin /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}