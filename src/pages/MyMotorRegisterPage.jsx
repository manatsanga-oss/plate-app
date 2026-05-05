import React, { useState, useRef } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/mymotor-report";

// ตาราง mapping branch_code → ชื่อสาขา
const BRANCH_MAP = {
  SCY01: "ศูนย์ยามาฮ่า",
  SCY04: "สีขวา",
  SCY05: "ป.เปา นครหลวง",
  SCY06: "ป.เปา วังน้อย",
  SCY07: "สิงห์ชัยตลาด",
};

// ดึง branch_code จาก currentUser.branch (เช่น "SCY01 สำนักงานใหญ่" → "SCY01")
function getUserBranchCode(currentUser) {
  const raw = String(currentUser?.branch_code || currentUser?.branch || "").trim();
  const m = raw.match(/^(SCY\d+)/i);
  return m ? m[1].toUpperCase() : raw;
}

function getUserBranchName(currentUser) {
  const code = getUserBranchCode(currentUser);
  return BRANCH_MAP[code] || code || "-";
}

export default function MyMotorRegisterPage({ currentUser }) {
  const [chassis, setChassis] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saleData, setSaleData] = useState(null);   // ผลค้นหาจาก moto_sales
  const [duplicate, setDuplicate] = useState(null); // ข้อมูลที่ซ้ำในตาราง vehicle_registrations
  const [message, setMessage] = useState("");
  const inputRef = useRef(null);

  function fmtDate(s) {
    if (!s) return "-";
    const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    return `${m[3]}/${m[2]}/${parseInt(m[1], 10) + 543}`;
  }

  async function lookupChassis(e) {
    e?.preventDefault?.();
    const c = chassis.trim();
    if (!c) { setMessage("⚠️ กรุณากรอกเลขถัง"); return; }
    setSearching(true);
    setMessage("");
    setSaleData(null);
    setDuplicate(null);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup_chassis_for_register", chassis_no: c }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data ? [data] : []);
      if (arr.length === 0 || !arr[0]?.sale_id) {
        setMessage(`❌ ไม่พบเลขถัง "${c}" ในตารางการขาย — ตรวจสอบเลขถังอีกครั้ง`);
        return;
      }
      const r = arr[0];
      setSaleData(r);
      // ถ้าเคยลงทะเบียนแล้ว → แสดง popup ซ้ำ
      if (r.already_registered) {
        setDuplicate(r.existing_registration || { chassis_no: r.chassis_no });
        setMessage(`⚠️ เลขถังนี้เคยลงทะเบียนแล้ว — ไม่สามารถบันทึกซ้ำได้`);
      }
    } catch (err) {
      setMessage("❌ ค้นหาไม่สำเร็จ: " + err.message);
    }
    setSearching(false);
  }

  async function saveRegistration() {
    if (!saleData) return;
    if (saleData.already_registered) {
      setDuplicate(saleData.existing_registration || { chassis_no: saleData.chassis_no });
      return;
    }
    if (!window.confirm(`ยืนยันการลงทะเบียน MyMotor\n\nเลขถัง: ${saleData.chassis_no}\nเลขเครื่อง: ${saleData.engine_no || "-"}\nลูกค้า: ${saleData.customer_name || "-"}\nรุ่น: ${saleData.model_name || "-"}`)) return;
    setSaving(true);
    setMessage("");
    try {
      // branch_name = ตาม USER ที่ login (mapping จาก branch_code)
      const userBranchName = getUserBranchName(currentUser);

      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_vehicle_registration",
          chassis_no: saleData.chassis_no,
          engine_no: saleData.engine_no,
          brand: saleData.brand,
          model_name: saleData.model_name,
          customer_name: saleData.customer_name,
          color: saleData.color,
          branch_name: userBranchName,            // ตาม user ที่ login
          sale_invoice_no: saleData.sale_invoice_no,
          registration_type: "mymotor",            // ← ใช้ registration_type (ตามคอลัมน์จริง)
          line_user_id: "manual:" + (currentUser?.username || currentUser?.user_id || "system"),
          source_page: "manual_chassis_register",
          registration_date: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.id) {
        setMessage(`✅ ลงทะเบียนสำเร็จ — เลขถัง ${result.chassis_no} (id: ${result.id})`);
        setChassis("");
        setSaleData(null);
        setDuplicate(null);
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        setMessage("❌ บันทึกไม่สำเร็จ — ลองอีกครั้ง");
      }
    } catch (err) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + err.message);
    }
    setSaving(false);
  }

  function clearAll() {
    setChassis("");
    setSaleData(null);
    setDuplicate(null);
    setMessage("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📝 บันทึกลงทะเบียน MyMotor</h2>
      </div>

      {/* Search */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 2px 12px rgba(7,45,107,0.08)", marginBottom: 14 }}>
        <form onSubmit={lookupChassis}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#072d6b", marginBottom: 6 }}>
            🔢 เลขถัง (VIN/Chassis No.)
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <input ref={inputRef} value={chassis}
              onChange={e => setChassis(e.target.value.toUpperCase())}
              placeholder="เช่น MLHJC9326T5851009"
              autoFocus
              style={{ flex: 1, padding: "12px 14px", border: "2px solid #d1d5db", borderRadius: 8, fontFamily: "monospace", fontSize: 16, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }} />
            <button type="submit" disabled={searching || !chassis.trim()}
              style={{ padding: "0 28px", background: searching ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: searching ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700 }}>
              🔍 {searching ? "กำลังค้นหา..." : "ค้นหา"}
            </button>
            {(saleData || message) && (
              <button type="button" onClick={clearAll}
                style={{ padding: "0 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                เคลียร์
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
            💡 พิมพ์เลขถัง → กด Enter หรือคลิกค้นหา → ระบบดึงรายละเอียดการขายมาแสดงให้ตรวจสอบ
          </div>
        </form>
      </div>

      {message && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8,
          background: message.startsWith("✅") ? "#dcfce7" : message.startsWith("⚠️") ? "#fef3c7" : "#fee2e2",
          color: message.startsWith("✅") ? "#15803d" : message.startsWith("⚠️") ? "#92400e" : "#991b1b",
          fontSize: 14, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Sale data preview */}
      {saleData && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 2px 12px rgba(7,45,107,0.08)", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: saleData.already_registered ? "#dc2626" : "#15803d", marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid " + (saleData.already_registered ? "#fecaca" : "#bbf7d0") }}>
            {saleData.already_registered ? "🚫 รถคันนี้เคยลงทะเบียนแล้ว" : "✅ พบข้อมูลในตารางการขาย"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px", fontSize: 13 }}>
            <Field label="เลขถัง" value={saleData.chassis_no} mono />
            <Field label="เลขเครื่อง" value={saleData.engine_no} mono />
            <Field label="เลขที่ใบขาย" value={saleData.sale_invoice_no} mono color="#0369a1" />
            <Field label="วันที่ขาย" value={fmtDate(saleData.sale_date)} />
            <Field label="ลูกค้า" value={saleData.customer_name} bold />
            <Field label="ไฟแนนท์" value={saleData.finance_company || "ขายเงินสด"} />
            <Field label="ยี่ห้อ" value={saleData.brand} />
            <Field label="รุ่น" value={saleData.model_name} />
            <Field label="สี" value={saleData.color} />
            <Field label="สาขา" value={saleData.branch_code} />
          </div>
          {!saleData.already_registered && (
            <div style={{ marginTop: 18, textAlign: "center" }}>
              <button onClick={saveRegistration} disabled={saving}
                style={{ padding: "14px 40px", background: saving ? "#9ca3af" : "#15803d", color: "#fff", border: "none", borderRadius: 10, cursor: saving ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700 }}>
                💾 {saving ? "กำลังบันทึก..." : "บันทึกลงทะเบียน MyMotor"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Duplicate popup */}
      {duplicate && (
        <div onClick={() => setDuplicate(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: 24, width: "min(480px, 96vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 50, textAlign: "center" }}>🚫</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626", textAlign: "center", marginBottom: 8 }}>
              เลขถังนี้ลงทะเบียนแล้ว!
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 16 }}>
              ไม่สามารถบันทึกซ้ำได้ — ตรวจสอบเลขถังอีกครั้งหรือดูในรายงานลงทะเบียน
            </div>
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13 }}>
              <div style={{ marginBottom: 4 }}><strong>เลขถัง:</strong> <code>{duplicate.chassis_no || saleData?.chassis_no}</code></div>
              {duplicate.registration_date && <div style={{ marginBottom: 4 }}><strong>วันที่ลงทะเบียน:</strong> {fmtDate(duplicate.registration_date)}</div>}
              {duplicate.branch_name && <div style={{ marginBottom: 4 }}><strong>สาขา:</strong> {duplicate.branch_name}</div>}
              {duplicate.brand && <div style={{ marginBottom: 4 }}><strong>ยี่ห้อ:</strong> {duplicate.brand}</div>}
              {duplicate.customer_name && <div><strong>ลูกค้า:</strong> {duplicate.customer_name}</div>}
            </div>
            <button onClick={() => { setDuplicate(null); clearAll(); }}
              style={{ width: "100%", padding: "12px 0", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              เข้าใจแล้ว — เคลียร์
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono, bold, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>{label}</div>
      <div style={{
        fontFamily: mono ? "monospace" : undefined,
        fontWeight: bold ? 700 : 600,
        color: color || "#072d6b",
        fontSize: 14,
      }}>{value || "-"}</div>
    </div>
  );
}
