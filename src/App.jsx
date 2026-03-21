import React, { useEffect, useState } from "react";
import "./App.css";
import ReceivePage from "./pages/ReceivePage";
import IssuePage from "./pages/IssuePage";
import UserPage from "./pages/UserPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  const [activeMenu, setActiveMenu] = useState("receive");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    setCurrentUser(null);
    setActiveMenu("receive");
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeMenu={activeMenu}
        onChange={setActiveMenu}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {activeMenu === "receive" && <ReceivePage currentUser={currentUser} />}
        {activeMenu === "issue" && <IssuePage currentUser={currentUser} />}
        {activeMenu === "users" && currentUser.role === "admin" && (
          <UserPage currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}

function Sidebar({ activeMenu, onChange, currentUser, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">📦 ระบบวัสดุสำนักงาน</div>

      <button
        className={`menu-btn ${activeMenu === "receive" ? "active" : ""}`}
        onClick={() => onChange("receive")}
      >
        📥 รับวัสดุ
      </button>

      <button
        className={`menu-btn ${activeMenu === "issue" ? "active" : ""}`}
        onClick={() => onChange("issue")}
      >
        📤 เบิกวัสดุ
      </button>

      {currentUser?.role === "admin" && (
        <button
          className={`menu-btn ${activeMenu === "users" ? "active" : ""}`}
          onClick={() => onChange("users")}
        >
          👤 กำหนดผู้ใช้งาน
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