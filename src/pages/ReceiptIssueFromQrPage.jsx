import React, { useState } from "react";

// ============================================================================
// หน้าพนักงาน: ค้นหาคำขอด้วยเลขอ้างอิง (ref_no) ที่ลูกค้ากรอกผ่าน LIFF
// แล้วบันทึกเลขใบเสร็จที่ออกจริง (mark เป็น issued)
// ----------------------------------------------------------------------------
// ⚙️ ค่าที่ต้องใส่ทีหลัง (TODO): RECEIPT_API = webhook ของ n8n
// ============================================================================
const RECEIPT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/receipt-requests-api";

const text = (v) => (v ?? "").toString().trim();
const STATUS_LABEL = { pending: "รอลูกค้ากรอก", filled: "ลูกค้ากรอกแล้ว", issued: "ออกใบเสร็จแล้ว", cancelled: "ยกเลิก" };

async function apiPost(payload) {
  const res = await fetch(RECEIPT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  const data = raw.trim() ? JSON.parse(raw) : {};
  return Array.isArray(data) ? data[0] : data;
}

export default function ReceiptIssueFromQrPage({ currentUser }) {
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [record, setRecord] = useState(null);
  const [message, setMessage] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSearch() {
    const ref = text(keyword);
    if (!ref) { setMessage("❌ กรอกเลขอ้างอิง"); return; }
    setSearching(true);
    setMessage("");
    setRecord(null);
    try {
      const row = await apiPost({ action: "get_request", ref_no: ref });
      if (!row || !row.ref_no) { setMessage("ไม่พบเลขอ้างอิงนี้"); return; }
      setRecord(row);
      setInvoiceNo(row.invoice_no || "");
    } catch (e) {
      setMessage("ค้นหาไม่สำเร็จ: " + (e.message || e));
    } finally {
      setSearching(false);
    }
  }

  async function handleIssue() {
    if (!record) return;
    if (!text(invoiceNo)) { setMessage("❌ กรอกเลขใบเสร็จ"); return; }
    setSaving(true);
    setMessage("");
    try {
      const row = await apiPost({
        action: "mark_issued",
        ref_no: record.ref_no,
        invoice_no: text(invoiceNo),
        issued_by: currentUser?.username || currentUser?.name || "system",
      });
      if (row && row.error) throw new Error(row.error);
      setRecord((r) => ({ ...r, status: "issued", invoice_no: text(invoiceNo) }));
      setMessage("✅ บันทึกออกใบเสร็จเรียบร้อย");
    } catch (e) {
      setMessage("บันทึกไม่สำเร็จ: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>ออกใบเสร็จจากเลขอ้างอิง QR</h2>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <input
          style={{ flex: 1, padding: "10px 12px", fontSize: 15, border: "1px solid #d0d5dd", borderRadius: 8 }}
          placeholder="กรอก/สแกนเลขอ้างอิง เช่น RC-20260531-0001"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button onClick={handleSearch} disabled={searching} style={btn("#2563eb")}>
          {searching ? "ค้นหา…" : "🔍 ค้นหา"}
        </button>
      </div>

      {message && <div style={{ margin: "8px 0", color: message.startsWith("✅") ? "#067647" : "#b42318" }}>{message}</div>}

      {record && (
        <div style={{ border: "1px solid #e4e7ec", borderRadius: 12, padding: 20, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{record.ref_no}</div>
            <span style={statusChip(record.status)}>{STATUS_LABEL[record.status] || record.status}</span>
          </div>

          {record.status === "pending" ? (
            <div style={{ color: "#b54708", background: "#fffaeb", padding: 12, borderRadius: 8 }}>
              ⏳ ลูกค้ายังไม่ได้กรอกข้อมูล — กรุณาให้ลูกค้าสแกน QR และกรอกข้อมูลก่อน
            </div>
          ) : (
            <>
              <Row label="ชื่อ-นามสกุล / บริษัท" value={record.customer_name} />
              <Row label="เบอร์โทรศัพท์" value={record.phone} />
              <Row label="ที่อยู่" value={record.address} />
              <Row label="เลขผู้เสียภาษี" value={record.tax_id} />
              <Row label="ชื่อ LINE" value={record.line_display_name} />

              <div style={{ borderTop: "1px solid #eee", margin: "16px 0", paddingTop: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>เลขใบเสร็จที่ออก</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ flex: 1, padding: "10px 12px", fontSize: 15, border: "1px solid #d0d5dd", borderRadius: 8 }}
                    placeholder="เลขที่ใบเสร็จรับเงิน"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    disabled={record.status === "issued"}
                  />
                  <button onClick={handleIssue} disabled={saving || record.status === "issued"} style={btn("#06C755")}>
                    {record.status === "issued" ? "ออกแล้ว" : saving ? "บันทึก…" : "✅ บันทึกออกใบเสร็จ"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", padding: "6px 0", borderBottom: "1px solid #f2f4f7" }}>
      <div style={{ width: 160, color: "#667085", fontSize: 14 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 15 }}>{value || "-"}</div>
    </div>
  );
}

const btn = (bg) => ({ padding: "10px 18px", fontSize: 15, fontWeight: 700, color: "#fff", background: bg, border: "none", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" });
const statusChip = (status) => {
  const map = { pending: ["#b54708", "#fffaeb"], filled: ["#175cd3", "#eff8ff"], issued: ["#067647", "#ecfdf3"], cancelled: ["#667085", "#f2f4f7"] };
  const [color, bg] = map[status] || ["#667085", "#f2f4f7"];
  return { color, background: bg, padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600 };
};
