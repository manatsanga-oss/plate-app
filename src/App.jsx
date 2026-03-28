import React, { useEffect, useState } from "react";
import "./App.css";
import DashboardPage from "./pages/DashboardPage";
import ReceivePage from "./pages/ReceivePage";
import IssuePage from "./pages/IssuePage";
import UserPage from "./pages/UserPage";
import BookingPage from "./pages/BookingPage";
import MotoBookingPage from "./pages/MotoBookingPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("user");
      if (savedUser && savedUser !== "undefined") {
        setCurrentUser(JSON.parse(savedUser));
      }
    } catch {
      localStorage.removeItem("user");
    }
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    setCurrentUser(null);
    setActiveMenu("dashboard");
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  function canAccess(page) {
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    const pages = parseUserPages(currentUser.pages);
    return pages.includes(page);
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeMenu={activeMenu}
        onChange={setActiveMenu}
        currentUser={currentUser}
        onLogout={handleLogout}
        canAccess={canAccess}
      />

      <main className="main-content">
        {activeMenu === "dashboard" && canAccess("dashboard") && <DashboardPage currentUser={currentUser} />}
        {activeMenu === "receive" && canAccess("receive") && <ReceivePage currentUser={currentUser} />}
        {activeMenu === "issue" && canAccess("issue") && <IssuePage currentUser={currentUser} />}
        {activeMenu === "users" && canAccess("users") && (
          <UserPage currentUser={currentUser} />
        )}
        {activeMenu === "booking" && canAccess("booking") && (
          <BookingPage currentUser={currentUser} />
        )}
        {activeMenu === "moto" && canAccess("moto") && (
          <MotoBookingPage currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}

function parseUserPages(raw) {
  if (!raw) return ["dashboard", "receive", "issue", "users"];
  if (Array.isArray(raw)) return raw.length > 0 ? raw : ["dashboard", "receive", "issue", "users"];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ["dashboard", "receive", "issue", "users"];
  } catch { return ["dashboard", "receive", "issue", "users"]; }
}

function Sidebar({ activeMenu, onChange, currentUser, onLogout, canAccess }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">📦 ระบบวัสดุสำนักงาน</div>

      {canAccess("dashboard") && (
        <button
          className={`menu-btn ${activeMenu === "dashboard" ? "active" : ""}`}
          onClick={() => onChange("dashboard")}
        >
          📊 ภาพรวม
        </button>
      )}

      {canAccess("receive") && (
        <button
          className={`menu-btn ${activeMenu === "receive" ? "active" : ""}`}
          onClick={() => onChange("receive")}
        >
          📥 รับวัสดุ
        </button>
      )}

      {canAccess("issue") && (
        <button
          className={`menu-btn ${activeMenu === "issue" ? "active" : ""}`}
          onClick={() => onChange("issue")}
        >
          📤 เบิกวัสดุ
        </button>
      )}

      {canAccess("users") && (
        <button
          className={`menu-btn ${activeMenu === "users" ? "active" : ""}`}
          onClick={() => onChange("users")}
        >
          👤 กำหนดผู้ใช้งาน
        </button>
      )}

      {canAccess("booking") && (
        <button
          className={`menu-btn ${activeMenu === "booking" ? "active" : ""}`}
          onClick={() => onChange("booking")}
        >
          🚗 จองคนขับรถ
        </button>
      )}

      {canAccess("moto") && (
        <button
          className={`menu-btn ${activeMenu === "moto" ? "active" : ""}`}
          onClick={() => onChange("moto")}
        >
          🏍️ จองรถจักรยานยนต์
        </button>
      )}

      <div className="sidebar-user-box">
        <div className="sidebar-user-name">👋 {currentUser?.name || "-"}</div>
        <div className="sidebar-user-detail">{currentUser?.branch || "-"}</div>
        <div className="sidebar-user-detail">
          สิทธิ์: {currentUser?.role || "-"}
        </div>

        <button className="logout-btn" onClick={onLogout}>
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}