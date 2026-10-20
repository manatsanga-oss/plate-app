import React from "react";
import TaxInvoiceUploadPage from "./TaxInvoiceUploadPage";
import OtherIncomeTaxUploadPage from "./OtherIncomeTaxUploadPage";
import DailyReceiptUploadPage from "./DailyReceiptUploadPage";
import VehiclePurchaseReceiptUploadPage from "./VehiclePurchaseReceiptUploadPage";
import PartTaxInvoiceUploadCard from "./PartTaxInvoiceUploadCard";
import AccountingExpenseUploadCard from "./AccountingExpenseUploadCard";
import FlowInputTaxUploadCard from "./FlowInputTaxUploadCard";
import VehicleDebitNoteUploadCard from "./VehicleDebitNoteUploadCard";
import PartServiceReceiptUploadCard from "./PartServiceReceiptUploadCard";
import DmsSalesTaxInvoiceUploadCard from "./DmsSalesTaxInvoiceUploadCard";

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
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>➕ ใบเพิ่มหนี้ขายรถ (Debit Note)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>ไฟล์ XLS รายงานการออกใบเพิ่มหนี้ จาก DMS (MCR06130) — เลือกสาขาแล้วเลือกไฟล์ อ่านอัตโนมัติ · UPSERT (สาขา + เลขที่ใบเพิ่มหนี้) · ยอดเข้ารายงานภาษีขายเป็นแหล่ง "ใบเพิ่มหนี้" · เก็บตาราง <code style={{ padding: "2px 8px", background: "#f3f4f6", borderRadius: 4, color: "#374151" }}>vehicle_debit_notes</code></div>
          <VehicleDebitNoteUploadCard currentUser={currentUser} />
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
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>💵 รายการรับชำระเงินค่าอะไหล่และบริการ (DMS · NIDS ขาย · NIDS บริการ)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>3 ไฟล์แยกกัน — DMS รายงานสรุปรายวันรับเงิน (xlsx) · NIDS รายงานรับชำระขายอะไหล่ (XLS) · NIDS รายงานรับชำระงานบริการ (XLS) — UPSERT เลขที่ใบเสร็จ อัปโหลดทับได้</div>
          <PartServiceReceiptUploadCard currentUser={currentUser} />
        </div>
        <div style={{ background: "#fff", boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden", padding: "16px 20px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>🧾 ใบกำกับภาษีขาย อะไหล่/บริการ (DMS ยามาฮ่า)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>แหล่งยอดภาษีขาย อะไหล่/บริการ ของสิงห์ชัยในเมนูรายงานภาษีขาย — เดือนไหน upload แล้ว รายงานจะอ้างอิงเลขที่/วันที่ใบกำกับจริง แทนการถอด VAT จากไฟล์งานซ่อม</div>
          <DmsSalesTaxInvoiceUploadCard currentUser={currentUser} />
        </div>
        <div style={{ background: "#fff", boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden", padding: "16px 20px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>🚗 รับรถเข้าจากการซื้อ (HONDA ป.เปา · YAMAHA สิงห์ชัย)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>ไฟล์ XLS รายงานรับรถเข้าจากการซื้อ จาก DMS — UPSERT ที่ chassis_no</div>
          <VehiclePurchaseReceiptUploadPage currentUser={currentUser} embeddable />
        </div>
        <div style={{ background: "#fff", boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden", padding: "16px 20px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>📒 ค่าใช้จ่ายงานบัญชี (Excel)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>ไฟล์รายงานค่าใช้จ่าย (Excel) — นำเข้าทุกแถว · เลือกสังกัด (ป.เปา / สิงห์ชัย) · ใส่ F- หน้าเลขเอกสาร เก็บแยกตาราง flow_expense_documents</div>
          <AccountingExpenseUploadCard currentUser={currentUser} />
        </div>
        <div style={{ background: "#fff", boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden", padding: "16px 20px", borderTop: "1px solid #f3f4f6" }}>
          {/* YAMAHA เอาออก (user 2026-10-20): ไฟล์รับอะไหล่ YAMAHA (NIDS) มีเลข/วันที่ใบกำกับ + ใบลดหนี้ครบในตัว รายงานภาษีซื้อไม่ต้องใช้ไฟล์ใบกำกับแยก
              ส่วน HONDA (DCS) ไฟล์รับอะไหล่ไม่มีวันที่ใบกำกับ/ยอดเงิน/ใบลดหนี้ ต้อง upload ไฟล์นี้ทุกเดือน ไม่งั้นใบคร่อมเดือนและใบลดหนี้หาย */}
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 14, textAlign: "center" }}>🧾 ใบกำกับภาษีซื้ออะไหล่ HONDA (DCS)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14, textAlign: "center" }}>ไฟล์ XLS รายงานใบกำกับภาษีซื้ออะไหล่จาก DCS — UPSERT ที่ tax_invoice_no · <b>ต้อง upload ทุกเดือน</b> คู่กับ "รายงานรับอะไหล่ HONDA" (หน้า Upload ข้อมูล) เพราะไฟล์รับอะไหล่ไม่มีวันที่ใบกำกับ/ใบลดหนี้ — ใบที่รับของเดือนถัดไปและใบลดหนี้จะเข้ารายงานภาษีซื้อได้จากไฟล์นี้เท่านั้น</div>
          <div style={{ border: "2px solid #dc2626", borderRadius: 12, padding: 16, maxWidth: 560, margin: "0 auto" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 10, textAlign: "center" }}>🔴 HONDA — อะไหล่</div>
            <PartTaxInvoiceUploadCard brand="HONDA" currentUser={currentUser} />
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: "0 0 14px 14px", boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden", padding: "16px 20px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#072d6b", marginBottom: 14, textAlign: "center" }}>📊 รายงานภาษีซื้อ ภ.พ.30 (FLOW ACC)</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14, textAlign: "center" }}>ไฟล์ Excel รายงานภาษีซื้อที่ export จาก FlowAccount (sheet "InputTaxReport") — นำเข้าแบบแทนที่ทั้งรอบยื่น (เลือกไฟล์แล้วอ่านอัตโนมัติ) · เก็บตาราง <code style={{ padding: "2px 8px", background: "#f3f4f6", borderRadius: 4, color: "#374151" }}>flow_input_tax_reports</code></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ border: "2px solid #dc2626", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 10, textAlign: "center" }}>🔴 ป.เปา</div>
              <FlowInputTaxUploadCard affiliation="ป.เปา" currentUser={currentUser} />
            </div>
            <div style={{ border: "2px solid #1e40af", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af", marginBottom: 10, textAlign: "center" }}>🔵 สิงห์ชัย</div>
              <FlowInputTaxUploadCard affiliation="สิงห์ชัย" currentUser={currentUser} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
