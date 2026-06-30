import React from "react";

// เตรียมแบบภาษีรายเดือน — placeholder (เฟสถัดไป: สรุปยอดภาษีซื้อ/ขาย ออกแบบ ภ.พ.30 รายเดือน)
export default function TaxFormMonthlyPage() {
  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📄 เตรียมแบบภาษีรายเดือน</h2>
      </div>
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280", background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🚧</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#374151", marginBottom: 6 }}>กำลังพัฒนา</div>
        <div style={{ fontSize: 14 }}>หน้านี้จะใช้สรุปยอดภาษีซื้อ/ภาษีขาย และเตรียมแบบ ภ.พ.30 รายเดือน</div>
      </div>
    </div>
  );
}
