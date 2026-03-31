import React, { useEffect, useState } from "react";
import "./App.css";
import DashboardPage from "./pages/DashboardPage";
import ReceivePage from "./pages/ReceivePage";
import IssuePage from "./pages/IssuePage";
import ConvertPage from "./pages/ConvertPage";
import UserPage from "./pages/UserPage";
import BookingPage from "./pages/BookingPage";
import MotoBookingPage from "./pages/MotoBookingPage";
import UploadPage from "./pages/UploadPage";
import StockCheckPage from "./pages/StockCheckPage";
import DriverPage from "./pages/DriverPage";
import FinancePage from "./pages/FinancePage";
import MotoPricePage from "./pages/MotoPricePage";
import MotoModelPage from "./pages/MotoModelPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("user");
      if (savedUser && savedUser !== "undefined") {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.user_id) {
          setCurrentUser(parsed);
        } else {
          localStorage.removeItem("user");
        }
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
    // booking และ moto เปิดให้ทุก user ที่ login แล้ว
    if (page === "booking" || page === "moto") return true;
    // upload, master data, convert เฉพาะ admin
    if (page === "upload") return false;
    if (page === "convert") return false;
    if (page === "driver" || page === "finance" || page === "motoprice" || page === "motomodel") return false;
    if (page === "users") return true;
    if (page === "stockcheck") return true;
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
        {activeMenu === "convert" && canAccess("convert") && <ConvertPage currentUser={currentUser} />}
        {activeMenu === "users" && canAccess("users") && (
          <UserPage currentUser={currentUser} />
        )}
        {activeMenu === "booking" && canAccess("booking") && (
          <BookingPage currentUser={currentUser} />
        )}
        {activeMenu === "moto" && canAccess("moto") && (
          <MotoBookingPage currentUser={currentUser} />
        )}
        {activeMenu === "upload" && canAccess("upload") && (
          <UploadPage currentUser={currentUser} />
        )}
        {activeMenu === "stockcheck" && canAccess("stockcheck") && (
          <StockCheckPage currentUser={currentUser} />
        )}
        {activeMenu === "driver" && canAccess("driver") && (
          <DriverPage currentUser={currentUser} />
        )}
        {activeMenu === "finance" && canAccess("finance") && (
          <FinancePage currentUser={currentUser} />
        )}
        {activeMenu === "motoprice" && canAccess("motoprice") && (
          <MotoPricePage currentUser={currentUser} />
        )}
        {activeMenu === "motomodel" && canAccess("motomodel") && (
          <MotoModelPage currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}

const DEFAULT_PAGES = ["dashboard", "receive", "issue", "booking", "moto"];

function parseUserPages(raw) {
  if (!raw) return DEFAULT_PAGES;
  if (Array.isArray(raw)) return raw.length > 0 ? raw : DEFAULT_PAGES;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PAGES;
  } catch { return DEFAULT_PAGES; }
}

function Sidebar({ activeMenu, onChange, currentUser, onLogout, canAccess }) {
  const supplyPages = ["dashboard", "receive", "issue", "convert"];
  const supplyActive = supplyPages.includes(activeMenu);
  const [supplyOpen, setSupplyOpen] = React.useState(supplyActive);

  const masterPages = ["driver", "finance", "motomodel", "motoprice"];
  const masterActive = masterPages.includes(activeMenu);
  const [masterOpen, setMasterOpen] = React.useState(masterActive);

  const hasSupply = supplyPages.some((p) => canAccess(p));
  const hasMaster = masterPages.some((p) => canAccess(p));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">📦 ระบบวัสดุสำนักงาน</div>

      {hasSupply && (
        <>
          <button
            className={`menu-btn menu-group-btn ${supplyActive ? "active" : ""}`}
            onClick={() => setSupplyOpen((o) => !o)}
          >
            📦 ระบบวัสดุสำนักงาน
            <span className="menu-arrow">{supplyOpen ? "▾" : "▸"}</span>
          </button>

          {supplyOpen && (
            <div className="submenu">
              {canAccess("dashboard") && (
                <button
                  className={`menu-btn submenu-btn ${activeMenu === "dashboard" ? "active" : ""}`}
                  onClick={() => onChange("dashboard")}
                >
                  📊 ภาพรวม
                </button>
              )}
              {canAccess("receive") && (
                <button
                  className={`menu-btn submenu-btn ${activeMenu === "receive" ? "active" : ""}`}
                  onClick={() => onChange("receive")}
                >
                  📥 รับวัสดุ
                </button>
              )}
              {canAccess("issue") && (
                <button
                  className={`menu-btn submenu-btn ${activeMenu === "issue" ? "active" : ""}`}
                  onClick={() => onChange("issue")}
                >
                  📤 เบิกวัสดุ
                </button>
              )}
              {canAccess("convert") && (
                <button
                  className={`menu-btn submenu-btn ${activeMenu === "convert" ? "active" : ""}`}
                  onClick={() => onChange("convert")}
                >
                  🔄 แปลงหน่วยบรรจุ
                </button>
              )}
            </div>
          )}
        </>
      )}

      {canAccess("users") && (
        <button
          className={`menu-btn ${activeMenu === "users" ? "active" : ""}`}
          onClick={() => onChange("users")}
        >
          {currentUser?.role === "admin" ? "👤 กำหนดผู้ใช้งาน" : "🔑 เปลี่ยนรหัสผ่าน"}
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

      {canAccess("upload") && (
        <button
          className={`menu-btn ${activeMenu === "upload" ? "active" : ""}`}
          onClick={() => onChange("upload")}
        >
          ⬆ ระบบ Upload ข้อมูล
        </button>
      )}

      {canAccess("stockcheck") && (
        <button
          className={`menu-btn ${activeMenu === "stockcheck" ? "active" : ""}`}
          onClick={() => onChange("stockcheck")}
        >
          📋 ระบบเช็คสต๊อก
        </button>
      )}

      {hasMaster && (
        <>
          <button
            className={`menu-btn menu-group-btn ${masterActive ? "active" : ""}`}
            onClick={() => setMasterOpen((o) => !o)}
          >
            🗂️ ข้อมูลหลัก
            <span className="menu-arrow">{masterOpen ? "▾" : "▸"}</span>
          </button>

          {masterOpen && (
            <div className="submenu">
              {canAccess("driver") && (
                <button
                  className={`menu-btn submenu-btn ${activeMenu === "driver" ? "active" : ""}`}
                  onClick={() => onChange("driver")}
                >
                  👷 ข้อมูลพนักงานขับรถ
                </button>
              )}
              {canAccess("finance") && (
                <button
                  className={`menu-btn submenu-btn ${activeMenu === "finance" ? "active" : ""}`}
                  onClick={() => onChange("finance")}
                >
                  🏢 ข้อมูลบริษัทไฟแนนท์
                </button>
              )}
              {canAccess("motomodel") && (
                <button
                  className={`menu-btn submenu-btn ${activeMenu === "motomodel" ? "active" : ""}`}
                  onClick={() => onChange("motomodel")}
                >
                  📋 ข้อมูลรุ่นรถ
                </button>
              )}
              {canAccess("motoprice") && (
                <button
                  className={`menu-btn submenu-btn ${activeMenu === "motoprice" ? "active" : ""}`}
                  onClick={() => onChange("motoprice")}
                >
                  💰 บันทึกราคาขาย
                </button>
              )}
            </div>
          )}
        </>
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