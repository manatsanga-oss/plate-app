import React from "react";
import TaxInvoiceUploadPage from "./TaxInvoiceUploadPage";
import OtherIncomeTaxUploadPage from "./OtherIncomeTaxUploadPage";
import DailyReceiptUploadPage from "./DailyReceiptUploadPage";
import VehiclePurchaseReceiptUploadPage from "./VehiclePurchaseReceiptUploadPage";
import PartTaxInvoiceUploadCard from "./PartTaxInvoiceUploadCard";
import AccountingExpenseUploadCard from "./AccountingExpenseUploadCard";

export default function UploadAccountingPage({ currentUser } = {}) {
  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">Upload ข้อมูลทางบัญชี</div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", background: "#072d6b", padding: "10px 16px", borderRadius: "10px 10px 0 0", textAlign: "left" }}>
          UPLOAD ข้อมูลทางบัญชี
        </div>
        <div style={{ background: "#fff", borderRadius: 0, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden", padding: "16px 20px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>📄 ใบกำกับ HONDA (รถจักรยานยนต์)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>เลือกสาขา + เดือน + ไฟล์ใบกำกับภาษี & กำไรขั้นต้น (CSV TIS-620) — UPSERT</div>
          <TaxInvoiceUploadPage currentUser={currentUser} embeddable />
        </div>
        <div style={{ background: "#fff", borderRadius: 0, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden", padding: "16px 20px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 14, textAlign: "center" }}>💰 ใบกำกับรายรับอื่นๆ (ป.เปา + สิงห์ชัย)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14, textAlign: "center" }}>เลือกสาขา + ไฟล์ใบกำกับ TF (CSV TIS-620) — UPSERT</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ border: "2px solid #dc2626", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 10, textAlign: "center" }}>🔴 ป.เปา — NID-OTH</div>
              <OtherIncomeTaxUploadPage currentUser={currentUser} embeddable forceBranch="PAPAO" />
            </div>
            <div style={{ border: "2px solid #1e40af", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af", marginBottom: 10, textAlign: "center" }}>🔵 สิงห์ชัย — MIC-OTH</div>
              <OtherIncomeTaxUploadPage currentUser={currentUser} embeddable forceBranch="SINGCHAI" />
            </div>
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: 0, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden", padding: "16px 20px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>📥 ใบเสร็จรายวัน (รับเงิน EX)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>ไฟล์รายงานสรุปรับเงินรายวัน (CSV UTF-8 BOM, 48 columns) — JOIN ผ่านเลขที่ใบขายเพื่อ track ว่าใบกำกับใด ชำระครบหรือยัง</div>
          <DailyReceiptUploadPage currentUser={currentUser} embeddable />
        </div>
        <div style={{ background: "#fff", boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden", padding: "16px 20px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>🚗 รับรถเข้าจากการซื้อ (HONDA ป.เปา · YAMAHA สิงห์ชัย)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>ไฟล์ XLS รายงานรับรถเข้าจากการซื้อ จาก DMS — UPSERT ที่ chassis_no</div>
          <VehiclePurchaseReceiptUploadPage currentUser={currentUser} embeddable />
        </div>
        <div style={{ background: "#fff", boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden", padding: "16px 20px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>📒 ค่าใช้จ่ายงานบัญชี (Excel)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>ไฟล์รายงานค่าใช้จ่าย (Excel) — ข้ามแถวที่ mark "ไม่เอา" · เลือกสังกัด (ป.เปา / สิงห์ชัย) · นำเข้าเป็น "ร่าง" ไปแสดงที่หน้าบันทึกค่าใช้จ่าย</div>
          <AccountingExpenseUploadCard currentUser={currentUser} />
        </div>
        <div style={{ background: "#fff", borderRadius: "0 0 14px 14px", boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden", padding: "16px 20px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 14, textAlign: "center" }}>🧾 ใบกำกับภาษีซื้ออะไหล่ (HONDA · YAMAHA)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14, textAlign: "center" }}>ไฟล์รายงานใบกำกับภาษีซื้ออะไหล่ — UPSERT ที่ tax_invoice_no</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ border: "2px solid #dc2626", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 10, textAlign: "center" }}>🔴 HONDA — อะไหล่</div>
              <PartTaxInvoiceUploadCard brand="HONDA" currentUser={currentUser} />
            </div>
            <div style={{ border: "2px solid #1e40af", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af", marginBottom: 10, textAlign: "center" }}>🔵 YAMAHA — อะไหล่</div>
              <PartTaxInvoiceUploadCard brand="YAMAHA" currentUser={currentUser} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
