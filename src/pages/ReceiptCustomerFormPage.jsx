import React, { useEffect, useState } from "react";

// ============================================================================
// หน้าฟอร์มลูกค้า (เปิดผ่าน LINE LIFF) — ลูกค้าสแกน QR จากพนักงานแล้วมากรอกที่นี่
// หน้านี้ "ไม่ผ่าน login" — ถูกเรียกตรงจาก App.jsx เมื่อ path = /receipt-form
// ----------------------------------------------------------------------------
// ⚙️ ค่าที่ต้องใส่ทีหลัง (TODO):
//   - LIFF_ID     : เอาจาก LINE Developers Console > LIFF (รูปแบบ 1234567890-abcdABCD)
//   - RECEIPT_API : webhook ของ n8n สำหรับงานนี้
// ============================================================================
const LIFF_ID = "2010078995-B6jJD1OK";
const RECEIPT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/receipt-requests-api";
const LIFF_SDK_URL = "https://static.line-scdn.net/liff/edge/2/sdk.js";

const text = (v) => (v ?? "").toString().trim();

// โหลด LIFF SDK จาก CDN (ครั้งเดียว)
function loadLiffSdk() {
  return new Promise((resolve, reject) => {
    if (window.liff) return resolve(window.liff);
    const existing = document.getElementById("liff-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.liff));
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.id = "liff-sdk";
    s.src = LIFF_SDK_URL;
    s.charset = "utf-8";
    s.onload = () => resolve(window.liff);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function ReceiptCustomerFormPage() {
  const [phase, setPhase] = useState("loading"); // loading | form | submitting | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [refNo, setRefNo] = useState("");
  const [profile, setProfile] = useState(null);   // { userId, displayName }
  const [form, setForm] = useState({ customer_name: "", address: "", phone: "", tax_id: "" });

  // อ่าน ref จาก URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let ref = params.get("ref") || "";
    // LIFF บางกรณีส่งผ่าน liff.state -> เผื่ออ่านจากตรงนั้นด้วย
    if (!ref) {
      const state = params.get("liff.state");
      if (state) {
        try { ref = new URLSearchParams(state.replace(/^\?/, "")).get("ref") || ""; } catch { /* noop */ }
      }
    }
    setRefNo(ref);
  }, []);

  // init LIFF + ดึง profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const liff = await loadLiffSdk();
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login(); // เด้งไปหน้า login ของ LINE แล้ววนกลับมาที่ LIFF เดิม
          return;
        }
        const p = await liff.getProfile();
        if (cancelled) return;
        setProfile({ userId: p.userId, displayName: p.displayName });
        setPhase("form");
      } catch (e) {
        if (cancelled) return;
        // ถ้าเปิดนอก LINE (ทดสอบในเบราว์เซอร์ปกติ) ก็ยังให้กรอกได้ แต่ไม่มี line_user_id
        console.warn("LIFF init failed:", e);
        setPhase("form");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit() {
    if (!refNo) { setErrorMsg("ไม่พบเลขอ้างอิง (ref) — กรุณาสแกน QR ใหม่อีกครั้ง"); return; }
    if (!text(form.customer_name)) { setErrorMsg("กรุณากรอกชื่อ-นามสกุล"); return; }
    if (!text(form.phone)) { setErrorMsg("กรุณากรอกเบอร์โทรศัพท์"); return; }
    setErrorMsg("");
    setPhase("submitting");
    try {
      const payload = {
        action: "submit_customer",
        ref_no: refNo,
        customer_name: text(form.customer_name),
        address: text(form.address),
        phone: text(form.phone),
        tax_id: text(form.tax_id),
        line_user_id: profile?.userId || "",
        line_display_name: profile?.displayName || "",
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
      if (row && row.error) throw new Error(row.error);
      setPhase("done");
    } catch (e) {
      setErrorMsg("ส่งข้อมูลไม่สำเร็จ: " + (e.message || e) + " — กรุณาลองใหม่อีกครั้ง");
      setPhase("form");
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.header}>
          <div style={S.shopName}>กรอกข้อมูลเพื่อออกใบเสร็จ</div>
          {refNo && <div style={S.refBadge}>เลขอ้างอิง: {refNo}</div>}
        </div>

        {phase === "loading" && (
          <div style={S.center}>กำลังเชื่อมต่อ LINE…</div>
        )}

        {phase === "done" && (
          <div style={S.center}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 18, margin: "8px 0" }}>ส่งข้อมูลเรียบร้อยแล้ว</div>
            <div style={{ color: "#666", fontSize: 14 }}>
              กรุณาแจ้งเลขอ้างอิง <b>{refNo}</b> กับพนักงานเพื่อรับใบเสร็จ
            </div>
          </div>
        )}

        {(phase === "form" || phase === "submitting") && (
          <div style={S.body}>
            {profile && (
              <div style={S.lineInfo}>LINE: {profile.displayName}</div>
            )}
            <label style={S.label}>ชื่อ-นามสกุล / ชื่อบริษัท *</label>
            <input style={S.input} value={form.customer_name} onChange={setField("customer_name")} placeholder="เช่น นายสมชาย ใจดี" />

            <label style={S.label}>เบอร์โทรศัพท์ *</label>
            <input style={S.input} value={form.phone} onChange={setField("phone")} inputMode="tel" placeholder="08x-xxx-xxxx" />

            <label style={S.label}>ที่อยู่</label>
            <textarea style={{ ...S.input, minHeight: 80, resize: "vertical" }} value={form.address} onChange={setField("address")} placeholder="บ้านเลขที่ / ถนน / ตำบล / อำเภอ / จังหวัด / รหัสไปรษณีย์" />

            <label style={S.label}>เลขประจำตัวผู้เสียภาษี (ถ้ามี)</label>
            <input style={S.input} value={form.tax_id} onChange={setField("tax_id")} inputMode="numeric" placeholder="13 หลัก (กรณีนิติบุคคล)" />

            {errorMsg && <div style={S.error}>{errorMsg}</div>}

            <button style={{ ...S.submit, opacity: phase === "submitting" ? 0.6 : 1 }} disabled={phase === "submitting"} onClick={handleSubmit}>
              {phase === "submitting" ? "กำลังส่ง…" : "ส่งข้อมูล"}
            </button>
          </div>
        )}

        {phase === "error" && <div style={S.error}>{errorMsg}</div>}
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "#f0f2f5", display: "flex", justifyContent: "center", padding: "16px", boxSizing: "border-box", fontFamily: "system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif" },
  card: { width: "100%", maxWidth: 480, background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", overflow: "hidden", alignSelf: "flex-start" },
  header: { background: "#06C755", color: "#fff", padding: "18px 20px" },
  shopName: { fontSize: 18, fontWeight: 700 },
  refBadge: { fontSize: 13, marginTop: 4, opacity: 0.95 },
  body: { padding: 20 },
  center: { padding: "40px 20px", textAlign: "center", color: "#333" },
  lineInfo: { fontSize: 13, color: "#06934a", background: "#eafaf0", padding: "6px 10px", borderRadius: 8, marginBottom: 12 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#444", margin: "12px 0 4px" },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 15, border: "1px solid #d0d5dd", borderRadius: 8, outline: "none" },
  error: { marginTop: 12, color: "#d92d20", background: "#fef3f2", padding: "8px 12px", borderRadius: 8, fontSize: 14 },
  submit: { width: "100%", marginTop: 18, padding: "13px", fontSize: 16, fontWeight: 700, color: "#fff", background: "#06C755", border: "none", borderRadius: 10, cursor: "pointer" },
};
