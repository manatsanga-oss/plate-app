import React, { useState } from "react";
import "./App.css";
import ReceivePage from "./pages/ReceivePage";
import IssuePage from "./pages/IssuePage";

export default function App() {
  const [activeMenu, setActiveMenu] = useState("receive");

  return (
    <div className="app-layout">
      <Sidebar activeMenu={activeMenu} onChange={setActiveMenu} />

      <main className="main-content">
        {activeMenu === "receive" && <ReceivePage />}

        {activeMenu === "issue" && <IssuePage />}

        {activeMenu === "users" && (
          <div className="page-box">
            <h2>หน้ากำหนดผู้ใช้งาน</h2>
            <p>หน้านี้ไว้จัดการผู้ใช้งาน</p>
          </div>
        )}
      </main>
    </div>
  );
}

function Sidebar({ activeMenu, onChange }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        📦 ระบบวัสดุสำนักงาน
      </div>

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

      <button
        className={`menu-btn ${activeMenu === "users" ? "active" : ""}`}
        onClick={() => onChange("users")}
      >
        👤 กำหนดผู้ใช้งาน
      </button>
    </aside>
  );
}