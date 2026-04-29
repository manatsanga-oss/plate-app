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
import SubunitPage from "./pages/SubunitPage";
import FastMovingStockPage from "./pages/FastMovingStockPage";
import HondaDepositPage from "./pages/HondaDepositPage";
import SparePartsOrderPage from "./pages/SparePartsOrderPage";
import PositionPage from "./pages/PositionPage";
import YamahaDepositPage from "./pages/YamahaDepositPage";
import YamahaOrderPage from "./pages/YamahaOrderPage";
import FastMovingPage from "./pages/FastMovingPage";
import MotoStockPage from "./pages/MotoStockPage";
import PettyCashFuelPage from "./pages/PettyCashFuelPage";
import PettyCashPostagePage from "./pages/PettyCashPostagePage";
import PettyCashGeneralPage from "./pages/PettyCashGeneralPage";
import PettyCashOfferingPage from "./pages/PettyCashOfferingPage";
import PayDepositPage from "./pages/PayDepositPage";
import ClaimPage from "./pages/ClaimPage";
import RepairDepositPage from "./pages/RepairDepositPage";
import ProductGroupPage from "./pages/ProductGroupPage";
import OutsideDepositOrderPage from "./pages/OutsideDepositOrderPage";
import LoginPage from "./pages/LoginPage";
import SalesOverviewPage from "./pages/SalesOverviewPage";
import VehicleRegistrationPage from "./pages/VehicleRegistrationPage";
import RegistrationSubmitPage from "./pages/RegistrationSubmitPage";
import ReceiveRegistrationPage from "./pages/ReceiveRegistrationPage";
import BillingPage from "./pages/BillingPage";
import InsuranceBillingPage from "./pages/InsuranceBillingPage";
import RegistrationSubmitReceiptPage from "./pages/RegistrationSubmitReceiptPage";
import SupplierPage from "./pages/SupplierPage";
import ServiceExpensePage from "./pages/ServiceExpensePage";
import TimeTrackingPage from "./pages/TimeTrackingPage";
import HrEmployeesPage from "./pages/HrEmployeesPage";
import HrHolidaysPage from "./pages/HrHolidaysPage";
import HrMonthlyExtrasPage from "./pages/HrMonthlyExtrasPage";
import HrPayrollPage from "./pages/HrPayrollPage";
import BankAccountsPage from "./pages/BankAccountsPage";
import BankMovementsPage from "./pages/BankMovementsPage";
import MyMotoReportPage from "./pages/MyMotoReportPage";
import ReceiptBillingPage from "./pages/ReceiptBillingPage";
import MotoInsurancePage from "./pages/MotoInsurancePage";
import CosmosInsurancePage from "./pages/CosmosInsurancePage";
import CosmosBillingPage from "./pages/CosmosBillingPage";

export default function App() {
  const [activeMenu, setActiveMenu] = useState("salesoverview");
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
    setActiveMenu("salesoverview");
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  function canAccess(page) {
    if (!currentUser) return false;
    // เมนู HR — เห็นเฉพาะ admin + SUKANYA เท่านั้น
    const HR_PAGES = ["hremployees", "hrholidays", "hrmonthlyextras", "hrpayroll", "hrtimetracking", "hrspecialcommission"];
    const HR_USERS = ["admin", "SUKANYA"];
    if (HR_PAGES.includes(page)) {
      return HR_USERS.includes(currentUser.username);
    }
    // เมนู Accounting — เห็นเฉพาะ admin + WARUT เท่านั้น
    const ACC_USERS = ["admin", "WARUT"];
    if (page === "accounting" || page.startsWith("acc")) {
      return ACC_USERS.includes(currentUser.username);
    }
    if (currentUser.role === "admin") return true;
    // booking และ moto เปิดให้ทุก user ที่ login แล้ว
    if (page === "salesoverview" || page === "booking" || page === "moto" || page === "pricecheck" || page === "spareorder" || page === "hondadeposit" || page === "yamahaorder" || page === "yamahadeposit" || page === "repairdeposit" || page === "outsideorder" || page === "fastmoving" || page === "fastmovingstock" || page === "pettycash" || page === "postage" || page === "pettycashgeneral" || page === "pettycashoffering" || page === "claim" || page === "vehicleregistration") return true;
    // Vehicle Registration management — admin only (ยกเว้น vehicleregistration ที่เป็น search อย่างเดียว)
    if (page === "registrationsubmit" || page === "registrationsubmitreceipt" || page === "registrationreceive" || page === "registrationbilling" || page === "receiptbilling" || page === "motoinsurance" || page === "cosmosinsurance" || page === "cosmosbilling" || page === "insurancebilling" || page === "hrspecialcommission" || page === "hrtimetracking" || page === "hremployees") return false;
    // upload, master data, convert เฉพาะ admin
    if (page === "upload") return false;
    if (page === "convert") return false;
    if (page === "subunit") return false;
    if (page === "driver" || page === "finance" || page === "supplier" || page === "motoprice" || page === "motomodel" || page === "motoexpense" || page === "serviceexpense" || page === "position" || page === "motostock") return false;
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
        {activeMenu === "salesoverview" && <SalesOverviewPage currentUser={currentUser} />}
        {activeMenu === "mymotoreport" && <MyMotoReportPage currentUser={currentUser} />}
        {activeMenu === "dashboard" && canAccess("dashboard") && <DashboardPage currentUser={currentUser} />}
        {activeMenu === "receive" && canAccess("receive") && <ReceivePage currentUser={currentUser} />}
        {activeMenu === "issue" && canAccess("issue") && <IssuePage currentUser={currentUser} />}
        {activeMenu === "convert" && canAccess("convert") && <ConvertPage currentUser={currentUser} />}
        {activeMenu === "subunit" && canAccess("subunit") && <SubunitPage currentUser={currentUser} />}
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
        {activeMenu === "supplier" && canAccess("supplier") && (
          <SupplierPage currentUser={currentUser} />
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
        {activeMenu === "serviceexpense" && canAccess("serviceexpense") && (
          <ServiceExpensePage currentUser={currentUser} />
        )}
        {activeMenu === "pricecheck" && canAccess("pricecheck") && (
          <MotoPriceCheckPage currentUser={currentUser} />
        )}
        {activeMenu === "hondadeposit" && canAccess("hondadeposit") && (
          <HondaDepositPage currentUser={currentUser} />
        )}
        {activeMenu === "spareorder" && canAccess("spareorder") && (
          <SparePartsOrderPage currentUser={currentUser} />
        )}
        {activeMenu === "position" && canAccess("position") && (
          <PositionPage currentUser={currentUser} />
        )}
        {activeMenu === "yamahaorder" && canAccess("yamahaorder") && (
          <YamahaOrderPage currentUser={currentUser} />
        )}
        {activeMenu === "yamahadeposit" && canAccess("yamahadeposit") && (
          <YamahaDepositPage currentUser={currentUser} />
        )}
        {activeMenu === "repairdeposit" && canAccess("repairdeposit") && (
          <RepairDepositPage currentUser={currentUser} />
        )}
        {activeMenu === "fastmovingstock" && canAccess("fastmovingstock") && <FastMovingStockPage />}
        {activeMenu === "motostock" && canAccess("motostock") && <MotoStockPage />}
        {activeMenu === "pettycash" && canAccess("pettycash") && <PettyCashFuelPage currentUser={currentUser} />}
        {activeMenu === "postage" && canAccess("postage") && <PettyCashPostagePage currentUser={currentUser} />}
        {activeMenu === "pettycashgeneral" && canAccess("pettycashgeneral") && <PettyCashGeneralPage currentUser={currentUser} />}
        {activeMenu === "pettycashoffering" && canAccess("pettycashoffering") && <PettyCashOfferingPage currentUser={currentUser} />}
        {activeMenu === "paydeposit" && canAccess("paydeposit") && <PayDepositPage currentUser={currentUser} />}
        {activeMenu === "claim" && canAccess("claim") && <ClaimPage currentUser={currentUser} />}
        {activeMenu === "fastmoving" && canAccess("fastmoving") && (
          <FastMovingPage />
        )}
        {activeMenu === "productgroup" && canAccess("productgroup") && (
          <ProductGroupPage currentUser={currentUser} />
        )}
        {activeMenu === "outsideorder" && canAccess("outsideorder") && (
          <OutsideDepositOrderPage currentUser={currentUser} />
        )}
        {activeMenu === "vehicleregistration" && canAccess("vehicleregistration") && (
          <VehicleRegistrationPage currentUser={currentUser} />
        )}
        {activeMenu === "cosmosinsurance" && canAccess("cosmosinsurance") && (
          <CosmosInsurancePage currentUser={currentUser} />
        )}
        {activeMenu === "cosmosbilling" && canAccess("cosmosbilling") && (
          <CosmosBillingPage currentUser={currentUser} />
        )}
        {activeMenu === "registrationsubmit" && canAccess("registrationsubmit") && (
          <RegistrationSubmitPage currentUser={currentUser} />
        )}
        {activeMenu === "registrationsubmitreceipt" && canAccess("registrationsubmitreceipt") && (
          <RegistrationSubmitReceiptPage currentUser={currentUser} />
        )}
        {activeMenu === "registrationreceive" && canAccess("registrationreceive") && (
          <ReceiveRegistrationPage currentUser={currentUser} />
        )}
        {activeMenu === "registrationbilling" && canAccess("registrationbilling") && (
          <BillingPage currentUser={currentUser} />
        )}
        {activeMenu === "receiptbilling" && canAccess("receiptbilling") && (
          <ReceiptBillingPage currentUser={currentUser} />
        )}
        {activeMenu === "motoinsurance" && canAccess("motoinsurance") && (
          <MotoInsurancePage currentUser={currentUser} />
        )}
        {activeMenu === "insurancebilling" && canAccess("insurancebilling") && (
          <InsuranceBillingPage currentUser={currentUser} />
        )}
        {activeMenu === "hrspecialcommission" && canAccess("hrspecialcommission") && (
          <div className="page-container">
            <div className="page-topbar"><h2 className="page-title">💰 รายงานค่าคอมพิเศษ</h2></div>
            <div style={{ padding: 20, color: "#6b7280" }}>หน้านี้ยังไม่ได้สร้าง — ระบุรายละเอียดที่ต้องการ</div>
          </div>
        )}
        {activeMenu === "hrtimetracking" && canAccess("hrtimetracking") && (
          <TimeTrackingPage currentUser={currentUser} />
        )}
        {activeMenu === "hremployees" && canAccess("hremployees") && (
          <HrEmployeesPage currentUser={currentUser} />
        )}
        {activeMenu === "hrholidays" && canAccess("hrholidays") && (
          <HrHolidaysPage currentUser={currentUser} />
        )}
        {activeMenu === "hrmonthlyextras" && canAccess("hrmonthlyextras") && (
          <HrMonthlyExtrasPage currentUser={currentUser} />
        )}
        {activeMenu === "accbankaccounts" && canAccess("accbankaccounts") && (
          <BankAccountsPage currentUser={currentUser} />
        )}
        {activeMenu === "accbankmovements" && canAccess("accbankmovements") && (
          <BankMovementsPage currentUser={currentUser} />
        )}
        {activeMenu === "hrpayroll" && canAccess("hrpayroll") && (
          <HrPayrollPage currentUser={currentUser} />
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
  const hasAccess = pages.length === 0 || pages.some(p => canAccess(p));
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

function MenuSubGroup({ title, pages, activeMenu, children }) {
  const isActive = pages.some(p => p === activeMenu);
  const [open, setOpen] = React.useState(isActive);
  return (
    <div style={{ marginTop: 2 }}>
      <button
        className={`menu-item ${isActive ? "active" : ""}`}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "bold" }}
        onClick={() => setOpen(o => !o)}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={{ paddingLeft: 12 }}>{children}</div>}
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
  const salesPages = ["moto", "booking", "pricecheck", "stockcheck", "motostock"];
  const sparePages = ["spareorder", "hondadeposit", "yamahaorder", "yamahadeposit", "repairdeposit", "outsideorder", "hondainventory", "yamahainventory", "fastmoving", "fastmovingstock", "productgroup", "claim"];
  const officePages = ["dashboard", "receive", "issue", "convert", "subunit"];
  const masterPages = ["motomodel", "motoprice", "motoexpense", "serviceexpense", "finance", "supplier", "driver", "position", "users"];
  const uploadPages = ["upload"];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">Management</div>

      <MenuGroup title="Report" pages={["salesoverview","mymotoreport"]} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="salesoverview" label="สรุปภาพรวม" activeMenu={activeMenu} onChange={onChange} canAccess={() => true} />
        <MenuItem page="mymotoreport" label="รายงานลงทะเบียน MyMoto" activeMenu={activeMenu} onChange={onChange} canAccess={() => true} />
      </MenuGroup>

      <MenuGroup title="Sales" pages={salesPages} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="moto" label="จองรถจักรยานยนต์" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="booking" label="จองคนขับรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="pricecheck" label="ตรวจสอบราคารถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="stockcheck" label="เช็คสต๊อก" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="motostock" label="Moto Stock Management" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Spare Parts" pages={sparePages} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuSubGroup title="Order System" pages={["spareorder", "hondadeposit", "yamahaorder", "yamahadeposit", "repairdeposit", "outsideorder"]} activeMenu={activeMenu}>
          <MenuItem page="spareorder" label="ระบบสั่งซื้ออะไหล่ HONDA" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="hondadeposit" label="รายงานเงินมัดจำคงเหลือ HONDA" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="yamahaorder" label="ระบบสั่งซื้ออะไหล่ YAMAHA" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="yamahadeposit" label="รายงานเงินมัดจำคงเหลือ YAMAHA" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="outsideorder" label="ระบบสั่งซื้ออะไหล่นอกเงินมัดจำ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
        <MenuSubGroup title="Spare Inventory" pages={["fastmoving", "fastmovingstock"]} activeMenu={activeMenu}>
          <MenuItem page="fastmoving" label="รายงานอะไหล่หมุนเร็ว" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="fastmovingstock" label="ระบบจัดการสต๊อกอะไหล่หมุนเร็ว" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
        <MenuSubGroup title="Claim System" pages={["claim"]} activeMenu={activeMenu}>
          <MenuItem page="claim" label="ระบบการเคลม" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
        <MenuSubGroup title="ข้อมูลหลัก" pages={["productgroup"]} activeMenu={activeMenu}>
          <MenuItem page="productgroup" label="กลุ่มสินค้า" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
      </MenuGroup>

      <MenuGroup title="Office Supplies" pages={officePages} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="dashboard" label="ภาพรวม" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="receive" label="รับวัสดุ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="issue" label="เบิกวัสดุ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="convert" label="แปลงหน่วยบรรจุ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="subunit" label="บันทึกเพิ่มหน่วยย่อย" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Finance" pages={["pettycash", "postage", "pettycashgeneral", "pettycashoffering", "paydeposit"]} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuSubGroup title="เงินสดย่อย" pages={["pettycash", "postage", "pettycashgeneral", "pettycashoffering"]} activeMenu={activeMenu}>
          <MenuItem page="pettycash" label="ค่าน้ำมันรถใหม่" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="postage" label="ค่าไปรษณีย์" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="pettycashgeneral" label="ค่าใช้จ่ายทั่วไป" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="pettycashoffering" label="ค่าของไหว้" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
        <MenuItem page="paydeposit" label="ชำระเงินรับฝาก" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Master Data" pages={masterPages} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="motomodel" label="ข้อมูลรุ่นรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="motoprice" label="บันทึกราคาขาย" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="motoexpense" label="ค่าใช้จ่ายการขาย" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="serviceexpense" label="ค่าใช้จ่ายงานบริการ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="finance" label="บริษัทไฟแนนท์" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="supplier" label="Supplier (ผู้ขาย)" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="driver" label="พนักงานขับรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="position" label="กำหนดตำแหน่ง" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="users" label={currentUser?.role === "admin" ? "กำหนดผู้ใช้งาน" : "เปลี่ยนรหัสผ่าน"} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Vehicle Registration" pages={["vehicleregistration","registrationsubmit","registrationsubmitreceipt","registrationreceive","motoinsurance","cosmosinsurance","registrationbilling","receiptbilling","insurancebilling","cosmosbilling"]} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuSubGroup title="ส่งงานทะเบียน" pages={["registrationsubmit","registrationsubmitreceipt"]} activeMenu={activeMenu}>
          <MenuItem page="registrationsubmit" label="ส่งจดทะเบียนรถใหม่" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="registrationsubmitreceipt" label="ส่งงานทะเบียนรับเรื่อง" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
        <MenuSubGroup title="บันทึกงานทะเบียน/ประกัน" pages={["registrationreceive","motoinsurance","cosmosinsurance"]} activeMenu={activeMenu}>
          <MenuItem page="registrationreceive" label="บันทึกรับ/ส่งคืนงานทะเบียน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="motoinsurance" label="บันทึก พรบ.รถใหม่" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="cosmosinsurance" label="บันทึกประกัน COSMOS" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
        <MenuSubGroup title="วางบิล" pages={["registrationbilling","receiptbilling","insurancebilling","cosmosbilling"]} activeMenu={activeMenu}>
          <MenuItem page="registrationbilling" label="วางบิลงานทะเบียน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="receiptbilling" label="วางบิลงานรับเรื่อง" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="insurancebilling" label="วางบิล งานพรบ." activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="cosmosbilling" label="วางบิล ประกัน COSMOS" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
        <MenuItem page="vehicleregistration" label="ค้นหาทะเบียนรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Accounting" pages={["accbankaccounts","accbankmovements"]} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="accbankaccounts" label="บัญชีธนาคาร" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="accbankmovements" label="รายงานการเคลื่อนไหว" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="HR" pages={["hremployees","hrholidays","hrmonthlyextras","hrpayroll","hrspecialcommission","hrtimetracking"]} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="hremployees" label="ข้อมูลพนักงาน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hrholidays" label="ปฏิทินวันหยุด" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hrtimetracking" label="บันทึกเวลาทำงาน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hrmonthlyextras" label="กรอกรายเดือน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hrpayroll" label="คำนวณเงินเดือน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hrspecialcommission" label="รายงานค่าคอมพิเศษ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
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