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
import MotoPriceCheckPage from "./pages/MotoPriceCheckPage";
import MotoExpensePage from "./pages/MotoExpensePage";
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
    if (page === "booking" || page === "moto" || page === "pricecheck") return true;
    // upload, master data, convert เฉพาะ admin
    if (page === "upload") return false;
    if (page === "convert") return false;
    if (page === "driver" || page === "finance" || page === "motoprice" || page === "motomodel" || page === "motoexpense") return false;
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
        {activeMenu === "motoexpense" && canAccess("motoexpense") && (
          <MotoExpensePage currentUser={currentUser} />
        )}
        {activeMenu === "pricecheck" && canAccess("pricecheck") && (
          <MotoPriceCheckPage currentUser={currentUser} />
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

function MenuGroup({ title, pages, activeMenu, onChange, canAccess, children, defaultOpen }) {
  const isActive = pages.some(p => p === activeMenu);
  const hasAccess = pages.some(p => canAccess(p));
  const [open, setOpen] = React.useState(defaultOpen || isActive);
  if (!hasAccess) return null;
  return (
    <div className="menu-group">
      <button className={`menu-group-header ${isActive ? "active" : ""}`} onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        <span className="menu-arrow">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="menu-group-items">{children}</div>}
    </div>
  );
}

function MenuItem({ page, label, activeMenu, onChange, canAccess }) {
  if (!canAccess(page)) return null;
  return (
    <button className={`menu-item ${activeMenu === page ? "active" : ""}`} onClick={() => onChange(page)}>
      {label}
    </button>
  );
}

function Sidebar({ activeMenu, onChange, currentUser, onLogout, canAccess }) {
  const salesPages = ["moto", "booking", "pricecheck", "stockcheck"];
  const sparePages = ["dashboard", "receive", "issue", "convert"];
  const masterPages = ["motomodel", "motoprice", "motoexpense", "finance", "driver", "users"];
  const uploadPages = ["upload"];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">Management</div>

      <MenuGroup title="Sales" pages={salesPages} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="moto" label="จองรถจักรยานยนต์" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="booking" label="จองคนขับรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="pricecheck" label="ตรวจสอบราคารถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="stockcheck" label="เช็คสต๊อก" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Spare Parts / วัสดุ" pages={sparePages} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="dashboard" label="ภาพรวม" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="receive" label="รับวัสดุ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="issue" label="เบิกวัสดุ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="convert" label="แปลงหน่วยบรรจุ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Master Data" pages={masterPages} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="motomodel" label="ข้อมูลรุ่นรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="motoprice" label="บันทึกราคาขาย" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="motoexpense" label="ค่าใช้จ่ายการขาย" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="finance" label="บริษัทไฟแนนท์" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="driver" label="พนักงานขับรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="users" label={currentUser?.role === "admin" ? "กำหนดผู้ใช้งาน" : "เปลี่ยนรหัสผ่าน"} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Upload" pages={uploadPages} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="upload" label="Upload ข้อมูล" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <div className="sidebar-user-box">
        <div className="sidebar-user-name">{currentUser?.name || "-"}</div>
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