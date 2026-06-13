import React, { useEffect, useState } from "react";
import "./App.css";
import DashboardPage from "./pages/DashboardPage";
import ReceivePage from "./pages/ReceivePage";
import IssuePage from "./pages/IssuePage";
import ConvertPage from "./pages/ConvertPage";
import UserPage from "./pages/UserPage";
import BookingPage from "./pages/BookingPage";
import MotoBookingPage from "./pages/MotoBookingPage";
import CustomerPage from "./pages/CustomerPage";
import UploadPage from "./pages/UploadPage";
import UploadAccountingPage from "./pages/UploadAccountingPage";
import DirectorLoanPage from "./pages/DirectorLoanPage";
import PartWithdrawalPage from "./pages/PartWithdrawalPage";
import VehiclePurchaseReportPage from "./pages/VehiclePurchaseReportPage";
import StockTurnoverReportPage from "./pages/StockTurnoverReportPage";
import PartReceiptReportPage from "./pages/PartReceiptReportPage";
import PartOrderInquiryPage from "./pages/PartOrderInquiryPage";
import PartDispenseReportPage from "./pages/PartDispenseReportPage";
import ServiceHistorySearchPage from "./pages/ServiceHistorySearchPage";
import ServiceRateSearchPage from "./pages/ServiceRateSearchPage";
import ServiceRateImportPage from "./pages/ServiceRateImportPage";
import ServiceRateLookupPage from "./pages/ServiceRateLookupPage";
import TaxInvoiceReportPage from "./pages/TaxInvoiceReportPage";
import StockCheckPage from "./pages/StockCheckPage";
import DriverPage from "./pages/DriverPage";
import FinancePage from "./pages/FinancePage";
import MotoPricePage from "./pages/MotoPricePage";
import MotoModelPage from "./pages/MotoModelPage";
import GiveawayRulesPage from "./pages/GiveawayRulesPage";
import MotoPriceCheckPage from "./pages/MotoPriceCheckPage";
import MotoPriceQuotePage from "./pages/MotoPriceQuotePage";
import MotoExpensePage from "./pages/MotoExpensePage";
import SubunitPage from "./pages/SubunitPage";
import OfficeStockAdjustPage from "./pages/OfficeStockAdjustPage";
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
import DepositSeizePage from "./pages/DepositSeizePage";
import LoginPage from "./pages/LoginPage";
import SalesOverviewPage from "./pages/SalesOverviewPage";
import PartGiveawayReportPage from "./pages/PartGiveawayReportPage";
import GiveawayReceiptPrintPage from "./pages/GiveawayReceiptPrintPage";
import VehicleRegistrationPage from "./pages/VehicleRegistrationPage";
import RegistrationSubmitPage from "./pages/RegistrationSubmitPage";
import ReceiveRegistrationPage from "./pages/ReceiveRegistrationPage";
import ReceiveReceiptPage from "./pages/ReceiveReceiptPage";
import SearchReceiptWorkPage from "./pages/SearchReceiptWorkPage";
import BillingPage from "./pages/BillingPage";
import InsuranceBillingPage from "./pages/InsuranceBillingPage";
import RegistrationSubmitReceiptPage from "./pages/RegistrationSubmitReceiptPage";
import RegistrationReceiptEntryPage from "./pages/RegistrationReceiptEntryPage";
import SupplierPage from "./pages/SupplierPage";
import ServiceExpensePage from "./pages/ServiceExpensePage";
import GeneralExpensePage from "./pages/GeneralExpensePage";
import IncomeCategoryPage from "./pages/IncomeCategoryPage";
import ExpenseRecordPage from "./pages/ExpenseRecordPage";
import AdvanceExpensePage from "./pages/AdvanceExpensePage";
import IncomeRecordPage from "./pages/IncomeRecordPage";
import TimeTrackingPage from "./pages/TimeTrackingPage";
import HrEmployeesPage from "./pages/HrEmployeesPage";
import HrHolidaysPage from "./pages/HrHolidaysPage";
import HrMonthlyExtrasPage from "./pages/HrMonthlyExtrasPage";
import HrPayrollPage from "./pages/HrPayrollPage";
import HrPayrollPaymentPage from "./pages/HrPayrollPaymentPage";
import HrPayrollAccountsPage from "./pages/HrPayrollAccountsPage";
import BankAccountsPage from "./pages/BankAccountsPage";
import LoanAccountsPage from "./pages/LoanAccountsPage";
import LoanInterestPaymentPage from "./pages/LoanInterestPaymentPage";
import BankMovementsPage from "./pages/BankMovementsPage";
import BankTransferPage from "./pages/BankTransferPage";
import FinanceTransferPage from "./pages/FinanceTransferPage";
import ExpenseDocCheckPage from "./pages/ExpenseDocCheckPage";
import SalesByPaymentReportPage from "./pages/SalesByPaymentReportPage";
import OtherIncomeTaxReportPage from "./pages/OtherIncomeTaxReportPage";
import DeliveryFeePage from "./pages/DeliveryFeePage";
import SalePriceMarkupPage from "./pages/SalePriceMarkupPage";
import FinancePaymentMatchPage from "./pages/FinancePaymentMatchPage";
import BankDepositPage from "./pages/BankDepositPage";
import VehiclePaymentReceiptPage from "./pages/VehiclePaymentReceiptPage";
import MyMotoReportPage from "./pages/MyMotoReportPage";
import MyMotorRegisterPage from "./pages/MyMotorRegisterPage";
import ReportAdminPage from "./pages/ReportAdminPage";
import TrialBalanceReportPage from "./pages/TrialBalanceReportPage";
import CreditNoteReportPage from "./pages/CreditNoteReportPage";
import CarPaymentReportPage from "./pages/CarPaymentReportPage";
import RegistrationSummaryReportPage from "./pages/RegistrationSummaryReportPage";
import RetailSaleReportPage from "./pages/RetailSaleReportPage";
import ReceiptTransferReportPage from "./pages/ReceiptTransferReportPage";
import SalesExtraPayPage from "./pages/SalesExtraPayPage";
import SpecialCommissionReportPage from "./pages/SpecialCommissionReportPage";
import NormalCommissionReportPage from "./pages/NormalCommissionReportPage";
import SalesRecordForCommissionPage from "./pages/SalesRecordForCommissionPage";
import BranchMasterPage from "./pages/BranchMasterPage";
import YamahaRepairReportPage from "./pages/YamahaRepairReportPage";
import PartStatusInquiryPage from "./pages/PartStatusInquiryPage";
import HondaRepairReportPage from "./pages/HondaRepairReportPage";
import MotoInsuranceExtraExpensePage from "./pages/MotoInsuranceExtraExpensePage";
import ReceiptBillingPage from "./pages/ReceiptBillingPage";
import MotoInsurancePage from "./pages/MotoInsurancePage";
import CosmosInsurancePage from "./pages/CosmosInsurancePage";
import CosmosBillingPage from "./pages/CosmosBillingPage";
import PaymentPage from "./pages/PaymentPage";
import GoodsPaymentPage from "./pages/GoodsPaymentPage";
import ReceiptCustomerFormPage from "./pages/ReceiptCustomerFormPage";
import ReceiptQrPrintPage from "./pages/ReceiptQrPrintPage";
import ReceiptIssueFromQrPage from "./pages/ReceiptIssueFromQrPage";
import RetailSalePage from "./pages/RetailSalePage";
import BookingDepositPage from "./pages/BookingDepositPage";
import BookingQueueStatusPage from "./pages/BookingQueueStatusPage";

export default function App() {
  // หน้าฟอร์มลูกค้า (เปิดผ่าน LINE LIFF) — ต้องเข้าได้โดยไม่ผ่าน login/sidebar
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/receipt-form")) {
    return <ReceiptCustomerFormPage />;
  }
  // หน้าสถานะคิวจองรถสำหรับลูกค้า (เปิดจากปุ่มในการ์ด LINE) — public ไม่ต้อง login
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/booking-status")) {
    return <BookingQueueStatusPage />;
  }

  const [activeMenu, setActiveMenu] = useState("salesoverview");
  const [currentUser, setCurrentUser] = useState(null);

  // ลบ session เก่าทุกครั้งที่โหลด page — บังคับ login ใหม่ทุกครั้ง
  useEffect(() => {
    localStorage.removeItem("user");
  }, []);

  // listen หา request เปลี่ยน page จาก child components (เช่น ServiceRateLookupPage → ServiceRateSearchPage)
  useEffect(() => {
    const handler = (e) => {
      if (typeof e.detail === "string") setActiveMenu(e.detail);
    };
    window.addEventListener("nav-to-page", handler);
    return () => window.removeEventListener("nav-to-page", handler);
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
    // เมนู HR — เห็นเฉพาะ admin + SUKANYA + WARUT เท่านั้น
    const HR_PAGES = ["hremployees", "hrholidays", "hrmonthlyextras", "hrpayroll", "hrpayrollpayment", "hrpayrollaccounts", "hrtimetracking", "hrspecialcommission", "hrnormalcommission", "hrsalesrecord"];
    const HR_USERS = ["admin", "SUKANYA", "WARUT"];
    if (HR_PAGES.includes(page)) {
      return HR_USERS.includes(currentUser.username);
    }
    // เมนู Accounting — เห็นเฉพาะ admin + WARUT เท่านั้น
    const ACC_USERS = ["admin", "WARUT"];
    if (page === "accounting" || page.startsWith("acc")) {
      return ACC_USERS.includes(currentUser.username);
    }
    // รายงานงบทดลอง — เห็นเฉพาะ user "admin" คนเดียว (จำกัดก่อนเช็ค role admin ทั่วไป)
    if (page === "trialbalance") return currentUser.username === "admin";
    if (currentUser.role === "admin") return true;
    // ตั้งค่าค่าใช้จ่าย (การขาย/งานบริการ/ทั่วไป) — เฉพาะ admin เท่านั้น (override explicit pages)
    if (page === "motoexpense" || page === "serviceexpense" || page === "generalexpense") return false;
    // ถ้า user มี pages column เซ็ตชัดเจน → strict allowlist (เห็นเฉพาะที่ระบุเท่านั้น)
    const explicitPages = getExplicitUserPages(currentUser.pages);
    if (explicitPages) return explicitPages.includes(page);
    // booking และ moto เปิดให้ทุก user ที่ login แล้ว
    if (page === "salesoverview" || page === "booking" || page === "moto" || page === "pricequote" || page === "spareorder" || page === "hondadeposit" || page === "yamahaorder" || page === "yamahadeposit" || page === "repairdeposit" || page === "outsideorder" || page === "fastmoving" || page === "pettycash" || page === "postage" || page === "pettycashgeneral" || page === "pettycashoffering" || page === "claim" || page === "vehicleregistration" || page === "searchreceiptwork" || page === "bankdeposit" || page === "mymotoreport" || page === "mymotoregister" || page === "expensedoccheck" || page === "deliveryfee" || page === "pricemarkup" || page === "payment" || page === "receiptqr" || page === "receiptissue" || page === "retailsale" || page === "bookingdeposit" || page === "partgiveawayreport" || page === "hrspecialcommission" || page === "receiptentry") return true;
    // Vehicle Registration management — admin only (ยกเว้น vehicleregistration ที่เป็น search อย่างเดียว)
    if (page === "registrationsubmit" || page === "registrationsubmitreceipt" || page === "registrationreceive" || page === "receiptreceive" || page === "registrationbilling" || page === "receiptbilling" || page === "motoinsurance" || page === "motoinsuranceextra" || page === "cosmosinsurance" || page === "cosmosbilling" || page === "insurancebilling" || page === "hrtimetracking" || page === "hremployees" || page === "vehiclepayment") return false;
    // upload, master data, convert เฉพาะ admin
    if (page === "upload") return false;
    if (page === "uploadaccounting") return false;
    if (page === "taxinvoicereport") return false;
    if (page === "taxinvoicesalesreport") return false;
    if (page === "creditnotereport") return false;  // เฉพาะ admin (ใบลดหนี้รับ)
    if (page === "carpaymentreport") return false;   // เฉพาะ admin (รายงานรับชำระเงินรายคัน)
    if (page === "salesbypayment") return false;     // เฉพาะ admin (รายงานการขายตามการชำระเงิน)
    if (page === "otherincometaxreport") return false;  // เฉพาะ admin (รายงานใบกำกับรายได้อื่นๆ)
    if (page === "registrationsummaryreport") return false;  // เฉพาะ admin (รายงานสรุปใบปะหน้า คชจ. ขายรถ)
    if (page === "retailsalereport") return false;  // เฉพาะ admin (รายงานใบขายปลีก)
    if (page === "receipttransferreport") return false;       // เฉพาะ admin (รายงานสรุปรับชำระเงิน)
    if (page === "vehiclepurchasereport") return false;       // เฉพาะ admin (รายงานรับรถจักรยานยนต์)
    if (page === "stockturnover") return false;               // เฉพาะ admin (สินค้าคงเหลือ & turnover)
    if (page === "partreceiptreport") return false;           // เฉพาะ admin (รายงานรับอะไหล่)
    if (page === "yamaharepairreport") return true;           // ทุก user เห็นรายงานใบแจ้งซ่อม
    if (page === "hondarepairreport") return true;
    if (page === "partstatusinquiry") return false;           // เฉพาะ admin (สอบถามสถานะอะไหล่)
    if (page === "partwithdrawal") return true;               // บันทึกการเบิกอะไหล่ — เปิดให้ทุก user
    if (page === "partorderinquiry") return false;            // เฉพาะ admin (สอบถามรายการอะไหล่สั่งซื้อ)
    if (page === "partdispensereport") return false;          // เฉพาะ admin (รายงานการจ่ายอะไหล่รายตัว)
    if (page === "servicehistory") return true;                // ค้นหาประวัติงานบริการ — เปิดให้ทุก user
    if (page === "servicerate") return true;                   // ค้นหาค่าบริการ (FRT) — เปิดให้ทุก user
    if (page === "serviceratelookup") return true;             // ค้นหา FRT จากรุ่น/แบบ — เปิดให้ทุก user
    if (page === "servicerateimport") return false;            // เฉพาะ admin (นำเข้า FRT)
    if (page === "fastmovingstock") return false;             // เฉพาะ admin (ระบบจัดการสต๊อกอะไหล่หมุนเร็ว)
    if (page === "depositseize") return false;                 // เฉพาะ admin (ยึดเงินมัดจำ)
    if (page === "loaninterestpayment") return ["admin", "WARUT"].includes(currentUser.username);  // เฉพาะ admin + WARUT
    if (page === "financepayment") return false;
    if (page === "goodspayment") return false;        // เฉพาะ admin (บันทึกชำระค่าสินค้า)
    if (page === "convert") return false;
    if (page === "subunit") return false;
    if (page === "receive") return false;              // เฉพาะ admin (รับวัสดุ)
    if (page === "driver" || page === "finance" || page === "supplier" || page === "motoprice" || page === "motomodel" || page === "motoexpense" || page === "serviceexpense" || page === "generalexpense" || page === "incomecategory" || page === "expenserecord" || page === "advanceexpense" || page === "position" || page === "motostock" || page === "giveawayrules") return false;
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
        {activeMenu === "partgiveawayreport" && <PartGiveawayReportPage currentUser={currentUser} />}
        {activeMenu === "giveawayreceipt" && <GiveawayReceiptPrintPage currentUser={currentUser} />}
        {activeMenu === "mymotoreport" && <MyMotoReportPage currentUser={currentUser} />}
        {activeMenu === "mymotoregister" && <MyMotorRegisterPage currentUser={currentUser} />}
        {activeMenu === "reportadmin" && <ReportAdminPage currentUser={currentUser} />}
        {activeMenu === "vehiclepurchasereport" && canAccess("vehiclepurchasereport") && <VehiclePurchaseReportPage currentUser={currentUser} />}
        {activeMenu === "stockturnover" && canAccess("stockturnover") && <StockTurnoverReportPage currentUser={currentUser} />}
        {activeMenu === "partreceiptreport" && canAccess("partreceiptreport") && <PartReceiptReportPage currentUser={currentUser} />}
        {activeMenu === "trialbalance" && canAccess("trialbalance") && <TrialBalanceReportPage currentUser={currentUser} />}
        {activeMenu === "dashboard" && canAccess("dashboard") && <DashboardPage currentUser={currentUser} />}
        {activeMenu === "receive" && canAccess("receive") && <ReceivePage currentUser={currentUser} />}
        {activeMenu === "issue" && canAccess("issue") && <IssuePage currentUser={currentUser} />}
        {activeMenu === "convert" && canAccess("convert") && <ConvertPage currentUser={currentUser} />}
        {activeMenu === "subunit" && canAccess("subunit") && <SubunitPage currentUser={currentUser} />}
        {activeMenu === "officeadjust" && canAccess("officeadjust") && <OfficeStockAdjustPage currentUser={currentUser} />}
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
        {activeMenu === "uploadaccounting" && canAccess("uploadaccounting") && (
          <UploadAccountingPage currentUser={currentUser} />
        )}
        {activeMenu === "taxinvoicereport" && canAccess("taxinvoicereport") && (
          <TaxInvoiceReportPage currentUser={currentUser} />
        )}
        {activeMenu === "taxinvoicesalesreport" && canAccess("taxinvoicesalesreport") && (
          <TaxInvoiceReportPage currentUser={currentUser} />
        )}
        {activeMenu === "creditnotereport" && canAccess("creditnotereport") && (
          <CreditNoteReportPage currentUser={currentUser} />
        )}
        {activeMenu === "salesbypayment" && canAccess("salesbypayment") && (
          <SalesByPaymentReportPage currentUser={currentUser} />
        )}
        {activeMenu === "otherincometaxreport" && canAccess("otherincometaxreport") && (
          <OtherIncomeTaxReportPage currentUser={currentUser} />
        )}
        {activeMenu === "deliveryfee" && canAccess("deliveryfee") && (
          <DeliveryFeePage currentUser={currentUser} />
        )}
        {activeMenu === "pricemarkup" && canAccess("pricemarkup") && (
          <SalePriceMarkupPage currentUser={currentUser} />
        )}
        {activeMenu === "carpaymentreport" && canAccess("carpaymentreport") && (
          <CarPaymentReportPage currentUser={currentUser} />
        )}
        {activeMenu === "registrationsummaryreport" && canAccess("registrationsummaryreport") && (
          <RegistrationSummaryReportPage currentUser={currentUser} />
        )}
        {activeMenu === "retailsalereport" && canAccess("retailsalereport") && (
          <RetailSaleReportPage currentUser={currentUser} />
        )}
        {activeMenu === "receipttransferreport" && canAccess("receipttransferreport") && (
          <ReceiptTransferReportPage currentUser={currentUser} />
        )}
        {activeMenu === "salesextrapay" && canAccess("salesextrapay") && (
          <SalesExtraPayPage currentUser={currentUser} />
        )}
        {activeMenu === "branchmaster" && canAccess("branchmaster") && (
          <BranchMasterPage currentUser={currentUser} />
        )}
        {activeMenu === "yamaharepairreport" && canAccess("yamaharepairreport") && (
          <YamahaRepairReportPage currentUser={currentUser} />
        )}
        {activeMenu === "hondarepairreport" && canAccess("hondarepairreport") && (
          <HondaRepairReportPage currentUser={currentUser} />
        )}
        {activeMenu === "partstatusinquiry" && canAccess("partstatusinquiry") && (
          <PartStatusInquiryPage currentUser={currentUser} />
        )}
        {activeMenu === "partorderinquiry" && canAccess("partorderinquiry") && (
          <PartOrderInquiryPage currentUser={currentUser} />
        )}
        {activeMenu === "partdispensereport" && canAccess("partdispensereport") && (
          <PartDispenseReportPage currentUser={currentUser} />
        )}
        {activeMenu === "servicehistory" && canAccess("servicehistory") && (
          <ServiceHistorySearchPage currentUser={currentUser} />
        )}
        {activeMenu === "servicerate" && canAccess("servicerate") && (
          <ServiceRateSearchPage currentUser={currentUser} />
        )}
        {activeMenu === "serviceratelookup" && canAccess("serviceratelookup") && (
          <ServiceRateLookupPage currentUser={currentUser} />
        )}
        {activeMenu === "servicerateimport" && canAccess("servicerateimport") && (
          <ServiceRateImportPage currentUser={currentUser} />
        )}
        {activeMenu === "partwithdrawal" && canAccess("partwithdrawal") && (
          <PartWithdrawalPage currentUser={currentUser} />
        )}
        {activeMenu === "motoinsuranceextra" && canAccess("motoinsuranceextra") && (
          <MotoInsuranceExtraExpensePage currentUser={currentUser} />
        )}
        {activeMenu === "stockcheck" && canAccess("stockcheck") && (
          <StockCheckPage currentUser={currentUser} />
        )}
        {activeMenu === "customer" && canAccess("customer") && (
          <CustomerPage currentUser={currentUser} />
        )}
        {activeMenu === "driver" && canAccess("driver") && (
          <DriverPage currentUser={currentUser} />
        )}
        {activeMenu === "finance" && canAccess("finance") && (
          <FinancePage currentUser={currentUser} />
        )}
        {activeMenu === "expensedoccheck" && canAccess("expensedoccheck") && (
          <ExpenseDocCheckPage currentUser={currentUser} />
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
        {activeMenu === "giveawayrules" && canAccess("giveawayrules") && (
          <GiveawayRulesPage currentUser={currentUser} />
        )}
        {activeMenu === "motoexpense" && canAccess("motoexpense") && (
          <MotoExpensePage currentUser={currentUser} />
        )}
        {activeMenu === "serviceexpense" && canAccess("serviceexpense") && (
          <ServiceExpensePage currentUser={currentUser} />
        )}
        {activeMenu === "generalexpense" && canAccess("generalexpense") && (
          <GeneralExpensePage currentUser={currentUser} />
        )}
        {activeMenu === "incomecategory" && canAccess("incomecategory") && (
          <IncomeCategoryPage currentUser={currentUser} />
        )}
        {activeMenu === "bankdeposit" && canAccess("bankdeposit") && (
          <BankDepositPage currentUser={currentUser} />
        )}
        {activeMenu === "vehiclepayment" && canAccess("vehiclepayment") && (
          <VehiclePaymentReceiptPage currentUser={currentUser} />
        )}
        {activeMenu === "payment" && canAccess("payment") && (
          <PaymentPage currentUser={currentUser} />
        )}
        {activeMenu === "receiptqr" && canAccess("receiptqr") && (
          <ReceiptQrPrintPage currentUser={currentUser} />
        )}
        {activeMenu === "receiptissue" && canAccess("receiptissue") && (
          <ReceiptIssueFromQrPage currentUser={currentUser} />
        )}
        {activeMenu === "retailsale" && canAccess("retailsale") && (
          <RetailSalePage currentUser={currentUser} />
        )}
        {activeMenu === "bookingdeposit" && canAccess("bookingdeposit") && (
          <BookingDepositPage currentUser={currentUser} />
        )}
        {activeMenu === "expenserecord" && canAccess("expenserecord") && (
          <ExpenseRecordPage currentUser={currentUser} />
        )}
        {activeMenu === "advanceexpense" && canAccess("advanceexpense") && (
          <AdvanceExpensePage currentUser={currentUser} />
        )}
        {activeMenu === "otherincome" && canAccess("otherincome") && (
          <IncomeRecordPage currentUser={currentUser} />
        )}
        {activeMenu === "pricecheck" && canAccess("pricecheck") && (
          <MotoPriceCheckPage currentUser={currentUser} />
        )}
        {activeMenu === "pricequote" && canAccess("pricequote") && (
          <MotoPriceQuotePage currentUser={currentUser} />
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
        {activeMenu === "depositseize" && canAccess("depositseize") && (
          <DepositSeizePage currentUser={currentUser} />
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
        {activeMenu === "receiptreceive" && canAccess("receiptreceive") && (
          <ReceiveReceiptPage currentUser={currentUser} />
        )}
        {activeMenu === "receiptentry" && canAccess("receiptentry") && (
          <RegistrationReceiptEntryPage currentUser={currentUser} />
        )}
        {activeMenu === "searchreceiptwork" && canAccess("searchreceiptwork") && (
          <SearchReceiptWorkPage currentUser={currentUser} />
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
          <SpecialCommissionReportPage currentUser={currentUser} />
        )}
        {activeMenu === "hrnormalcommission" && canAccess("hrnormalcommission") && (
          <NormalCommissionReportPage currentUser={currentUser} />
        )}
        {activeMenu === "hrsalesrecord" && canAccess("hrsalesrecord") && (
          <SalesRecordForCommissionPage currentUser={currentUser} />
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
        {activeMenu === "accloanaccounts" && canAccess("accloanaccounts") && (
          <LoanAccountsPage currentUser={currentUser} />
        )}
        {activeMenu === "loaninterestpayment" && canAccess("loaninterestpayment") && (
          <LoanInterestPaymentPage currentUser={currentUser} />
        )}
        {activeMenu === "accbankmovements" && canAccess("accbankmovements") && (
          <BankMovementsPage currentUser={currentUser} />
        )}
        {activeMenu === "accbanktransfer" && canAccess("accbanktransfer") && (
          <BankTransferPage currentUser={currentUser} />
        )}
        {activeMenu === "accfinancetransfer" && canAccess("accfinancetransfer") && (
          <FinanceTransferPage currentUser={currentUser} />
        )}
        {activeMenu === "accdirectorloan" && canAccess("accdirectorloan") && (
          <DirectorLoanPage currentUser={currentUser} />
        )}
        {activeMenu === "financepayment" && canAccess("financepayment") && (
          <FinancePaymentMatchPage currentUser={currentUser} />
        )}
        {activeMenu === "goodspayment" && canAccess("goodspayment") && (
          <GoodsPaymentPage currentUser={currentUser} />
        )}
        {activeMenu === "hrpayroll" && canAccess("hrpayroll") && (
          <HrPayrollPage currentUser={currentUser} />
        )}
        {activeMenu === "hrpayrollpayment" && canAccess("hrpayrollpayment") && (
          <HrPayrollPaymentPage currentUser={currentUser} />
        )}
        {activeMenu === "hrpayrollaccounts" && canAccess("hrpayrollaccounts") && (
          <HrPayrollAccountsPage currentUser={currentUser} />
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

// คืนค่า pages เฉพาะเมื่อมีการเซ็ตชัดเจน (ไม่ fallback เป็น default)
function getExplicitUserPages(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.length > 0 ? raw : null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch { return null; }
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

function MenuSubGroup({ title, pages, activeMenu, children, canAccess }) {
  const isActive = pages.some(p => p === activeMenu);
  const [open, setOpen] = React.useState(isActive);
  // ถ้ามี canAccess และไม่มี page ใดเลยใน pages ที่เข้าได้ → ซ่อน sub-group
  if (canAccess && pages.length > 0 && !pages.some(p => canAccess(p))) return null;
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
  const salesPages = ["moto", "booking", "pricecheck", "pricequote", "stockcheck", "motostock", "customer", "deliveryfee", "pricemarkup", "receiptqr", "receiptissue", "retailsale", "bookingdeposit"];
  const sparePages = ["spareorder", "hondadeposit", "yamahaorder", "yamahadeposit", "repairdeposit", "outsideorder", "depositseize", "hondainventory", "yamahainventory", "fastmoving", "fastmovingstock", "productgroup", "claim"];
  const officePages = ["dashboard", "receive", "issue", "convert", "subunit", "officeadjust"];
  const masterPages = ["motomodel", "motoprice", "motoexpense", "giveawayrules", "serviceexpense", "generalexpense", "incomecategory", "finance", "supplier", "driver", "position", "users", "branchmaster"];
  const uploadPages = ["upload", "uploadaccounting"];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">Management</div>

      <MenuGroup title="Report" pages={["salesoverview","mymotoreport","mymotoregister","partgiveawayreport","giveawayreceipt","hrspecialcommission"]} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="salesoverview" label="สรุปภาพรวม" activeMenu={activeMenu} onChange={onChange} canAccess={() => true} />
        <MenuItem page="mymotoreport" label="รายงานลงทะเบียน MyMoto" activeMenu={activeMenu} onChange={onChange} canAccess={() => true} />
        <MenuItem page="mymotoregister" label="บันทึกลงทะเบียน MyMoto" activeMenu={activeMenu} onChange={onChange} canAccess={() => true} />
        <MenuItem page="partgiveawayreport" label="รายงานของแถม" activeMenu={activeMenu} onChange={onChange} canAccess={() => true} />
        <MenuItem page="giveawayreceipt" label="พิมพ์ใบรับของแถม (เกิน 90 วัน)" activeMenu={activeMenu} onChange={onChange} canAccess={() => true} />
        <MenuItem page="hrspecialcommission" label="รายงานค่าคอมพิเศษ" activeMenu={activeMenu} onChange={onChange} canAccess={() => true} />
      </MenuGroup>

      <MenuGroup title="Report Admin" pages={["reportadmin","retailsalereport","taxinvoicesalesreport","creditnotereport","carpaymentreport","salesbypayment","otherincometaxreport","registrationsummaryreport","receipttransferreport","vehiclepurchasereport","stockturnover","partreceiptreport","trialbalance"]} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="reportadmin" label="รายงานสรุปขายรถบันทึก FLOW ACC" activeMenu={activeMenu} onChange={onChange} canAccess={() => true} />
        <MenuItem page="retailsalereport" label="รายงานใบขายปลีก" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="taxinvoicesalesreport" label="รายงานการขายตามใบกำกับภาษี" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="creditnotereport" label="รายงานใบลดหนี้รับ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="carpaymentreport" label="รายงานรับชำระเงินรายคัน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="salesbypayment" label="รายงานการขายตามการชำระเงิน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="otherincometaxreport" label="รายงานใบกำกับภาษีรายได้อื่นๆ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="registrationsummaryreport" label="รายงานสรุปใบปะหน้า คชจ. ขายรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="receipttransferreport" label="รายงานสรุปรับชำระเงิน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="vehiclepurchasereport" label="รายงานรับรถจักรยานยนต์" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="stockturnover" label="สินค้าคงเหลือ & อัตราการหมุน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="partreceiptreport" label="รายงานรับอะไหล่" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="trialbalance" label="รายงานงบทดลอง" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Sales" pages={salesPages} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="moto" label="จองรถจักรยานยนต์" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="booking" label="จองคนขับรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="pricecheck" label="ตรวจสอบราคารถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="pricequote" label="คำนวณราคาขายรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="stockcheck" label="เช็คสต๊อก" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="motostock" label="Moto Stock Management" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="customer" label="บันทึกข้อมูลลูกค้า" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="deliveryfee" label="บันทึกค่านำพา" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="pricemarkup" label="ราคาขายบวกเพิ่ม" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="receiptqr" label="พิมพ์ QR ออกใบเสร็จ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="receiptissue" label="ออกใบเสร็จจาก QR" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuSubGroup title="ขายรถ" pages={["retailsale", "bookingdeposit"]} activeMenu={activeMenu} canAccess={canAccess}>
          <MenuItem page="retailsale" label="บันทึกขายปลีก" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="bookingdeposit" label="มัดจำจองรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
      </MenuGroup>

      <MenuGroup title="Spare Parts" pages={sparePages} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuSubGroup title="Order System" pages={["spareorder", "yamahaorder", "repairdeposit", "outsideorder", "depositseize"]} activeMenu={activeMenu}>
          <MenuItem page="spareorder" label="ระบบสั่งซื้ออะไหล่ HONDA" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="yamahaorder" label="ระบบสั่งซื้ออะไหล่ YAMAHA" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="outsideorder" label="ระบบสั่งซื้ออะไหล่นอกเงินมัดจำ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="depositseize" label="ยึดเงินมัดจำ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
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
        <MenuItem page="officeadjust" label="ปรับปรุงวัสดุคงเหลือ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Finance" pages={["pettycash", "postage", "pettycashgeneral", "pettycashoffering", "paydeposit", "expenserecord", "advanceexpense", "expensedoccheck", "bankdeposit", "vehiclepayment", "payment", "financepayment", "goodspayment", "otherincome", "loaninterestpayment"]} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuSubGroup title="เงินสดย่อย" pages={["pettycash", "postage", "pettycashgeneral", "pettycashoffering"]} activeMenu={activeMenu}>
          <MenuItem page="pettycash" label="ค่าน้ำมันรถใหม่" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="postage" label="ค่าไปรษณีย์" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="pettycashgeneral" label="ค่าใช้จ่ายทั่วไป" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="pettycashoffering" label="ค่าของไหว้" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
        <MenuItem page="paydeposit" label="ชำระเงินรับฝาก" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="payment" label="รับชำระเงิน (QR PromptPay)" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="bankdeposit" label="บันทึกรายการฝากเงิน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="vehiclepayment" label="บันทึกรับชำระเงินค่ารถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="expenserecord" label="บันทึกค่าใช้จ่าย" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="advanceexpense" label="ค่าใช้จ่ายจ่ายล่วงหน้า" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="goodspayment" label="บันทึกชำระค่าสินค้า" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="expensedoccheck" label="ตรวจสอบเอกสารค่าใช้จ่าย" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="financepayment" label="บันทึกรับชำระเงินไฟแนนท์" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="otherincome" label="บันทึกรายได้อื่น ๆ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="loaninterestpayment" label="บันทึกจ่ายดอกเบี้ยธนาคาร" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Vehicle Registration" pages={["vehicleregistration","registrationsubmit","registrationsubmitreceipt","registrationreceive","receiptreceive","receiptentry","searchreceiptwork","motoinsurance","cosmosinsurance","registrationbilling","receiptbilling","insurancebilling","cosmosbilling","motoinsuranceextra"]} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuSubGroup title="รับเรื่องงานทะเบียน" pages={["receiptentry"]} activeMenu={activeMenu} canAccess={canAccess}>
          <MenuItem page="receiptentry" label="📥 รับเรื่องงานทะเบียน (manual)" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
        <MenuSubGroup title="ส่งงานทะเบียน" pages={["registrationsubmit","registrationsubmitreceipt"]} activeMenu={activeMenu} canAccess={canAccess}>
          <MenuItem page="registrationsubmit" label="ส่งจดทะเบียนรถใหม่" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="registrationsubmitreceipt" label="ส่งงานทะเบียนรับเรื่อง" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
        <MenuSubGroup title="บันทึกงานทะเบียน/ประกัน" pages={["registrationreceive","receiptreceive","motoinsurance","cosmosinsurance"]} activeMenu={activeMenu} canAccess={canAccess}>
          <MenuItem page="registrationreceive" label="บันทึกรับ/ส่งคืนงานทะเบียนรถใหม่" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="receiptreceive" label="บันทึกรับ/ส่งคืน งานรับเรื่องงานทะเบียน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="motoinsurance" label="บันทึกงาน พรบ." activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="motoinsuranceextra" label="บันทึกค่าใช้จ่ายเพิ่มเติมงาน พรบ." activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="cosmosinsurance" label="บันทึกประกัน COSMOS" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
        <MenuSubGroup title="วางบิล" pages={["registrationbilling","receiptbilling","insurancebilling","cosmosbilling"]} activeMenu={activeMenu} canAccess={canAccess}>
          <MenuItem page="registrationbilling" label="วางบิลงานทะเบียน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="receiptbilling" label="วางบิลงานรับเรื่อง" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="insurancebilling" label="วางบิล งานพรบ." activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
          <MenuItem page="cosmosbilling" label="วางบิล ประกัน COSMOS" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        </MenuSubGroup>
        <MenuItem page="vehicleregistration" label="ค้นหาทะเบียนรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="searchreceiptwork" label="ค้นหางานทะเบียนรับเรื่อง" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Accounting" pages={["accbankaccounts","accloanaccounts","accbankmovements","accbanktransfer","accfinancetransfer","accdirectorloan"]} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="accbankaccounts" label="บัญชีธนาคาร" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="accloanaccounts" label="บัญชีเงินกู้ยืม" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="accbankmovements" label="รายงานการเคลื่อนไหว" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="accbanktransfer" label="โอนเงินระหว่างบัญชี" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="accfinancetransfer" label="บันทึกรับเงินโอนไฟแนนท์" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="accdirectorloan" label="บันทึกเงินให้กู้ยืมกรรมการ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Service" pages={["yamaharepairreport","hondarepairreport","partstatusinquiry","partorderinquiry","partwithdrawal","partdispensereport","servicehistory","servicerate","servicerateimport"]} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="yamaharepairreport" label="รายงานใบแจ้งซ่อม YAMAHA" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hondarepairreport" label="รายงานใบแจ้งซ่อม HONDA" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="partstatusinquiry" label="สอบถามสถานะอะไหล่" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="partorderinquiry" label="สอบถามรายการอะไหล่สั่งซื้อ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="partwithdrawal" label="บันทึกการเบิกอะไหล่" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="partdispensereport" label="รายงานการจ่ายอะไหล่รายตัว" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="servicehistory" label="ค้นหาประวัติงานบริการ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="servicerate" label="ค้นหาค่าบริการ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="servicerateimport" label="📤 นำเข้า FRT (Admin)" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="HR" pages={["hremployees","hrholidays","hrmonthlyextras","hrpayroll","hrpayrollpayment","hrpayrollaccounts","hrnormalcommission","hrsalesrecord","hrtimetracking"]} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="hremployees" label="ข้อมูลพนักงาน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hrholidays" label="ปฏิทินวันหยุด" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hrtimetracking" label="บันทึกเวลาทำงาน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hrmonthlyextras" label="กรอกรายเดือน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hrpayroll" label="คำนวณเงินเดือน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hrpayrollpayment" label="สรุปรายการเงินเดือน" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hrpayrollaccounts" label="ตั้งค่าบัญชีจ่าย" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="hrnormalcommission" label="รายงานค่าคอมปกติ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Upload" pages={uploadPages} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="upload" label="Upload ข้อมูล" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="uploadaccounting" label="Upload ข้อมูลทางบัญชี" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
      </MenuGroup>

      <MenuGroup title="Master Data" pages={masterPages} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess}>
        <MenuItem page="motomodel" label="ข้อมูลรุ่นรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="motoprice" label="บันทึกราคาขาย" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="motoexpense" label="ค่าใช้จ่ายการขาย" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="giveawayrules" label="บันทึกของแถม" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="serviceexpense" label="ค่าใช้จ่ายงานบริการ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="generalexpense" label="ค่าใช้จ่ายทั่วไป" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="incomecategory" label="หมวดรายได้" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="finance" label="บริษัทไฟแนนท์" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="supplier" label="Supplier (ผู้ขาย)" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="driver" label="พนักงานขับรถ" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="position" label="กำหนดตำแหน่ง" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="branchmaster" label="บันทึกข้อมูลสาขา" activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
        <MenuItem page="users" label={currentUser?.role === "admin" ? "กำหนดผู้ใช้งาน" : "เปลี่ยนรหัสผ่าน"} activeMenu={activeMenu} onChange={onChange} canAccess={canAccess} />
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