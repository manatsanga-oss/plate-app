import React, { useEffect, useState } from "react";

// ============================================================================
// หน้าตอบกลับข่าวกิจกรรม (ลูกค้า) — เปิดจากปุ่มในการ์ด LINE ที่ส่งจากเมนู CRM ประชาสัมพันธ์กิจกรรม
// URL: /crm-reply?c=<campaign_id>&u=<line_user_id>&r=interest|no   (public ไม่ต้อง login — เรียกตรงจาก App.jsx)
// r=no → บันทึก "ไม่สนใจ" ทันที · r=interest → ให้ใส่เบอร์โทร แล้วบันทึก "สนใจ" (crm-api reply_campaign)
// ============================================================================
const CRM_API = "https://n8n-new-project-gwf2.onrender.com/webhook/crm-api";

async function post(body) {
  const res = await fetch(CRM_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return {}; }
}
const first = (d) => (Array.isArray(d) ? d[0] : d) || {};

export default function CrmReplyPage() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const cid = Number(params.get("c")) || 0;
  const uid = String(params.get("u") || "").trim();
  const r = String(params.get("r") || "").trim();
  const [info, setInfo] = useState(null);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState("loading"); // loading | form | saving | done | error
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      if (!cid || !uid) { setErr("ลิงก์ไม่ถูกต้อง"); setState("error"); return; }
      try {
        const d = first(await post({ action: "get_campaign_public", campaign_id: cid, line_user_id: uid }));
        if (!d.campaign_id) throw new Error("ไม่พบกิจกรรมนี้");
        setInfo(d);
        setPhone(d.response_phone || d.phone || "");
        if (r === "no") {
          setState("saving");
          const s = first(await post({ action: "reply_campaign", campaign_id: cid, line_user_id: uid, response: "ไม่สนใจ" }));
          if (!s.id) throw new Error(s.__error || "บันทึกไม่สำเร็จ");
          setResult(s); setState("done");
        } else {
          setState("form");
        }
      } catch (e) { setErr(e.message || String(e)); setState("error"); }
    })();
  }, []); // eslint-disable-line

  async function submitInterest() {
    const p = phone.replace(/[^0-9]/g, "");
    if (p.length < 9) { setErr("กรุณาใส่เบอร์โทรให้ครบ"); return; }
    setErr(""); setState("saving");
    try {
      const s = first(await post({ action: "reply_campaign", campaign_id: cid, line_user_id: uid, response: "สนใจ", phone: p, note: note.trim() }));
      if (!s.id) throw new Error(s.__error || "บันทึกไม่สำเร็จ");
      setResult(s); setState("done");
    } catch (e) { setErr(e.message || String(e)); setState("form"); }
  }

  const wrap = { fontFamily: "Tahoma, sans-serif", minHeight: "100vh", background: "#f1f5f9", display: "flex", justifyContent: "center", padding: "24px 12px", boxSizing: "border-box" };
  const card = { width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16, boxShadow: "0 4px 16px rgba(0,0,0,.08)", overflow: "hidden", alignSelf: "flex-start" };
  const inp = { width: "100%", padding: "12px 14px", border: "1.5px solid #cbd5e1", borderRadius: 10, fontSize: 18, fontFamily: "inherit", boxSizing: "border-box" };
  const btn = (bg) => ({ width: "100%", padding: "14px 0", border: "none", borderRadius: 12, background: bg, color: "#fff", fontSize: 17, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" });

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ background: "#072d6b", color: "#fff", padding: "16px 18px" }}>
          <div style={{ fontSize: 13, opacity: .85 }}>📣 ข่าวกิจกรรมจากร้าน</div>
          <div style={{ fontSize: 19, fontWeight: 700, marginTop: 4 }}>{info?.title || "กิจกรรม"}</div>
        </div>
        <div style={{ padding: 18 }}>
          {info?.message && <div style={{ fontSize: 14, color: "#475569", whiteSpace: "pre-wrap", marginBottom: 14, lineHeight: 1.6 }}>{info.message}</div>}
          {(info?.preview_file_id || (info?.file_id && String(info.file_mime || "").startsWith("image/"))) && (
            <a href={`https://n8n-new-project-gwf2.onrender.com/webhook/crm-file?id=${info.file_id || info.preview_file_id}`} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 14 }}>
              <img src={`https://n8n-new-project-gwf2.onrender.com/webhook/crm-file?id=${info.preview_file_id || info.file_id}`} alt="" style={{ width: "100%", borderRadius: 10, border: "1px solid #e5e7eb" }} />
            </a>
          )}

          {state === "loading" && <div style={{ textAlign: "center", color: "#64748b", padding: 20 }}>กำลังโหลด...</div>}
          {state === "saving" && <div style={{ textAlign: "center", color: "#64748b", padding: 20 }}>กำลังบันทึก...</div>}
          {state === "error" && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: 12 }}>❌ {err}</div>}

          {state === "form" && (
            <>
              <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 15, color: "#065f46", fontWeight: 700 }}>
                ✅ สนใจกิจกรรมนี้ — ใส่เบอร์โทรเพื่อให้ทางร้านติดต่อกลับ
              </div>
              {info?.customer_name && <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>คุณ {info.customer_name}</div>}
              <label style={{ fontSize: 14, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>เบอร์โทรติดต่อกลับ *</label>
              <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" style={inp} />
              <label style={{ fontSize: 14, fontWeight: 700, color: "#334155", display: "block", margin: "12px 0 6px" }}>ข้อความถึงร้าน (ไม่บังคับ)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="เช่น สะดวกให้โทรช่วงเย็น" style={{ ...inp, fontSize: 15, resize: "vertical" }} />
              {err && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>❌ {err}</div>}
              <div style={{ marginTop: 16 }}>
                <button onClick={submitInterest} style={btn("#0f766e")}>ส่งข้อมูล</button>
              </div>
              {info?.response && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 10, textAlign: "center" }}>เคยตอบไว้: {info.response}{info.response_phone ? ` (${info.response_phone})` : ""} — ส่งใหม่จะบันทึกทับ</div>}
            </>
          )}

          {state === "done" && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ fontSize: 44 }}>{result?.response === "สนใจ" ? "🎉" : "🙏"}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#072d6b", marginTop: 6 }}>
                {result?.response === "สนใจ" ? "ขอบคุณที่สนใจกิจกรรม" : "ขอบคุณสำหรับคำตอบ"}
              </div>
              <div style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>
                {result?.response === "สนใจ" ? `ทางร้านจะติดต่อกลับที่เบอร์ ${result.response_phone || phone}` : "หากเปลี่ยนใจสามารถกดปุ่ม \"สนใจกิจกรรม\" ในข้อความ LINE ได้อีกครั้ง"}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 14 }}>ปิดหน้านี้ได้เลย</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
