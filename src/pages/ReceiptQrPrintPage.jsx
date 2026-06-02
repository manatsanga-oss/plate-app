import React, { useState } from "react";

// ============================================================================
// หน้าพนักงาน: สร้างเลขอ้างอิง (ref_no) + พิมพ์ QR ให้ลูกค้าสแกน
// ลูกค้าสแกน QR -> เปิด LIFF -> กรอกข้อมูล (ดูหน้า ReceiptCustomerFormPage)
// ----------------------------------------------------------------------------
// ⚙️ ค่าที่ต้องใส่ทีหลัง (TODO):
//   - LIFF_ID     : เอาจาก LINE Developers Console > LIFF (ตัวเดียวกับหน้าฟอร์มลูกค้า)
//   - RECEIPT_API : webhook ของ n8n สำหรับงานนี้
// ============================================================================
const LIFF_ID = "2010078995-B6jJD1OK";
const RECEIPT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/receipt-requests-api";

// URL ที่ฝังลงใน QR — เปิด LIFF พร้อมแนบ ref
const liffUrl = (refNo) => `https://liff.line.me/${LIFF_ID}?ref=${encodeURIComponent(refNo)}`;
// รูป QR (ใช้บริการสร้างรูปฟรี ไม่ต้องลง dependency เพิ่ม)
const qrImageUrl = (data, size = 280) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;

export default function ReceiptQrPrintPage({ currentUser }) {
  const [refNo, setRefNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setLoading(true);
    setError("");
    setRefNo("");
    try {
      const payload = {
        action: "create_ref",
        created_by: currentUser?.username || currentUser?.name || "system",
        branch_code: currentUser?.branch_code || currentUser?.branch || "",
        branch_name: currentUser?.branch || "",
      };
      const res = await fetch(RECEIPT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      const data = raw.trim() ? JSON.parse(raw) : {};
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.ref_no) throw new Error(row?.error || "ไม่ได้รับเลขอ้างอิงจากระบบ");
      setRefNo(row.ref_no);
    } catch (e) {
      setError("สร้างเลขอ้างอิงไม่สำเร็จ: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @media print {
          @page { margin: 0; }
          body * { visibility: hidden; }
          #receipt-qr-print, #receipt-qr-print * { visibility: visible; }
          #receipt-qr-print {
            position: absolute; top: 0; left: 0; right: 0;
            margin: 0 auto !important;
            width: 72mm !important;
            border: none !important;
            padding: 4mm 0 !important;
            box-sizing: border-box;
            text-align: center;
          }
          #receipt-qr-print img { width: 62mm !important; height: 62mm !important; margin: 0 auto !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <h2 style={{ marginTop: 0 }}>พิมพ์ QR ให้ลูกค้ากรอกข้อมูลออกใบเสร็จ</h2>
      <p style={{ color: "#666", marginTop: -8 }}>
        กดปุ่ม "สร้าง QR ใหม่" → ได้เลขอ้างอิง 1 ใบ → พิมพ์ให้ลูกค้าสแกนเข้า LINE ของร้านเพื่อกรอกชื่อ/ที่อยู่/เบอร์โทร
      </p>

      <div className="no-print" style={{ display: "flex", gap: 12, margin: "16px 0" }}>
        <button onClick={handleCreate} disabled={loading} style={btn("#06C755")}>
          {loading ? "กำลังสร้าง…" : "➕ สร้าง QR ใหม่"}
        </button>
        {refNo && (
          <button onClick={handlePrint} style={btn("#2563eb")}>🖨️ พิมพ์</button>
        )}
      </div>

      {error && <div style={{ color: "#d92d20", background: "#fef3f2", padding: "10px 14px", borderRadius: 8, maxWidth: 420 }}>{error}</div>}

      {refNo && (
        <div id="receipt-qr-print" style={card}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>สแกนเพื่อออกใบเสร็จ</div>
          <div style={{ color: "#555", fontSize: 14, marginBottom: 16 }}>
            สแกน QR นี้ด้วยกล้องมือถือ → เพิ่มเพื่อน LINE ร้าน → กรอกข้อมูลของท่าน
          </div>
          <img src={qrImageUrl(liffUrl(refNo))} alt="QR" width={280} height={280} style={{ display: "block", margin: "0 auto" }} />
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1, marginTop: 14 }}>{refNo}</div>
          <div style={{ color: "#888", fontSize: 12, marginTop: 6 }}>กรุณาแจ้งเลขอ้างอิงนี้กับพนักงาน</div>
        </div>
      )}
    </div>
  );
}

const btn = (bg) => ({ padding: "10px 18px", fontSize: 15, fontWeight: 700, color: "#fff", background: bg, border: "none", borderRadius: 8, cursor: "pointer" });
const card = { marginTop: 8, padding: 28, width: 360, textAlign: "center", border: "2px dashed #cbd5e1", borderRadius: 16, background: "#fff" };
