import React, { useState } from "react";

const REG_API = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

const text = (v) => (v ?? "").toString().trim();
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (v) => {
  if (!v) return "-";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${Number(m[1]) + 543}`;
  return String(v);
};
const daysSince = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

const FIELDS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "customer_name", label: "ชื่อลูกค้า" },
  { key: "engine_no", label: "เลขเครื่อง" },
  { key: "chassis_no", label: "เลขตัวถัง" },
  { key: "invoice_no", label: "เลขที่ใบขาย" },
];

export default function GiveawayReceiptPrintPage() {
  const [field, setField] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [docNo, setDocNo] = useState("");
  const [chk, setChk] = useState({ shirt: false, helmet: false, other: false });
  const [otherText, setOtherText] = useState("");

  const apiPost = async (url, payload) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    if (!raw.trim()) return [];
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : d?.data || d?.rows || [];
  };

  async function search() {
    if (!text(keyword)) return;
    try {
      setSearching(true); setSelected(null);
      const d = await apiPost(REG_API, { action: "search_registrations", source: "sale", field, keyword: text(keyword) });
      setRows(d);
    } catch { setRows([]); }
    finally { setSearching(false); }
  }

  function genDocNo() {
    const d = new Date();
    const yy = (d.getFullYear() + 543) % 100;
    return `RBG${pad(yy)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function pick(v) {
    setSelected(v);
    setDocNo(genDocNo());
    setChk({ shirt: false, helmet: false, other: false });
    setOtherText("");
  }

  function printDoc() {
    if (!selected) return;
    const v = selected;
    const box = (on) => (on ? "☑" : "☐");
    const days = daysSince(v.sale_date);
    const today = fmtDate(new Date().toISOString());
    const esc = (s) => String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบรับของแถม ${esc(docNo)}</title>
<style>
  *{box-sizing:border-box} body{font-family:"Sarabun","TH Sarabun New",sans-serif;color:#000;padding:32px;font-size:16px;line-height:1.7}
  .head{text-align:center;margin-bottom:6px} .title{font-size:22px;font-weight:800}
  .sub{text-align:center;color:#444;margin-bottom:18px}
  .meta{display:flex;justify-content:space-between;font-size:15px;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;margin:10px 0}
  td,th{border:1px solid #333;padding:8px 10px;text-align:left;vertical-align:top}
  .lbl{font-weight:700;width:32%;background:#f5f5f5}
  .chkrow{font-size:18px;margin:10px 0}
  .chkrow span{display:inline-block;margin-right:28px}
  .sign{display:flex;justify-content:space-around;margin-top:64px;text-align:center}
  .sign .line{border-top:1px dotted #333;width:230px;padding-top:6px}
  .note{margin-top:8px;font-size:14px;color:#555}
  @media print{ .noprint{display:none} @page{margin:14mm} }
  .btn{padding:10px 22px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer}
</style></head><body>
  <div class="head"><div class="title">ใบรับของแถม</div></div>
  <div class="sub">(กรณีรับของแถมเกิน 90 วัน นับจากวันที่ขาย)</div>
  <div class="meta"><div><b>เลขที่เอกสาร:</b> ${esc(docNo)}</div><div><b>วันที่พิมพ์:</b> ${today}</div></div>
  <table>
    <tr><td class="lbl">ชื่อลูกค้า</td><td>${esc(v.customer_name) || "-"}</td></tr>
    <tr><td class="lbl">เลขที่ใบขาย</td><td>${esc(v.sale_doc_no || v.invoice_no) || "-"}</td></tr>
    <tr><td class="lbl">วันที่ขาย</td><td>${fmtDate(v.sale_date)}${days != null ? `  (${days} วันที่ผ่านมา)` : ""}</td></tr>
    <tr><td class="lbl">ยี่ห้อ / รุ่น / สี</td><td>${esc(v.brand)} ${esc(v.model)} ${esc(v.color) ? "/ " + esc(v.color) : ""}</td></tr>
    <tr><td class="lbl">เลขเครื่อง</td><td>${esc(v.engine_no) || "-"}</td></tr>
    <tr><td class="lbl">เลขตัวถัง (VIN)</td><td>${esc(v.frame_no) || "-"}</td></tr>
  </table>
  <div style="font-weight:700;margin-top:14px">รายการของแถมที่รับ:</div>
  <div class="chkrow">
    <span>${box(chk.shirt)} เสื้อ</span>
    <span>${box(chk.helmet)} หมวกกันน็อก</span>
    <span>${box(chk.other)} อื่นๆ ${esc(otherText) ? esc(otherText) : "................................"}</span>
  </div>
  <div class="note">ข้าพเจ้าได้รับของแถมตามรายการข้างต้นครบถ้วนเรียบร้อยแล้ว</div>
  <div class="sign">
    <div class="line">ลงชื่อ ............................... ผู้รับของแถม<br>(...............................)<br>วันที่ ......./......./.......</div>
    <div class="line">ลงชื่อ ............................... ผู้จ่ายของแถม<br>(...............................)<br>วันที่ ......./......./.......</div>
  </div>
  <div class="noprint" style="margin-top:30px;text-align:center"><button class="btn" onclick="window.print()">🖨️ พิมพ์</button></div>
  <script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
</body></html>`;
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) { alert("กรุณาอนุญาต popup เพื่อพิมพ์เอกสาร"); return; }
    w.document.write(html);
    w.document.close();
  }

  const td = { padding: "7px 10px", borderBottom: "1px solid #eef2f7", fontSize: 13 };
  const th = { padding: "8px 10px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#374151" };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🎁 พิมพ์ใบรับของแถม (เกิน 90 วัน)</h2>
      </div>

      {/* SEARCH (moto_sales) */}
      <div className="form-card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={field} onChange={(e) => setField(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}>
            {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="🔎 ค้นหา: ชื่อลูกค้า / เลขเครื่อง / เลขตัวถัง / เลขที่ใบขาย"
            style={{ flex: 1, minWidth: 240, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }} />
          <button className="btn-primary" onClick={search} disabled={searching}>{searching ? "กำลังค้นหา..." : "🔍 ค้นหา"}</button>
        </div>
      </div>

      {/* RESULTS */}
      {rows.length > 0 && (
        <div className="form-card">
          <h3 style={{ margin: "0 0 10px", fontSize: 15, color: "#072d6b" }}>ผลการค้นหา ({rows.length})</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={th}>เลขที่ใบขาย</th><th style={th}>วันที่ขาย</th><th style={th}>ลูกค้า</th>
                  <th style={th}>รุ่น/สี</th><th style={th}>เลขเครื่อง</th><th style={th}>เลขตัวถัง</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v, i) => {
                  const days = daysSince(v.sale_date);
                  return (
                    <tr key={`${v.frame_no}-${i}`} style={{ background: selected && selected === v ? "#eff6ff" : "transparent" }}>
                      <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{text(v.sale_doc_no || v.invoice_no) || "-"}</td>
                      <td style={td}>{fmtDate(v.sale_date)}{days != null && <span style={{ color: days > 90 ? "#b91c1c" : "#64748b", fontSize: 11 }}> ({days}ว.)</span>}</td>
                      <td style={td}>{text(v.customer_name) || "-"}</td>
                      <td style={td}>{text(v.model)} {text(v.color)}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{text(v.engine_no) || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{text(v.frame_no) || "-"}</td>
                      <td style={td}><button className="btn-primary" style={{ padding: "4px 14px", fontSize: 12 }} onClick={() => pick(v)}>เลือก</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW / OPTIONS */}
      {selected && (
        <div className="form-card">
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#072d6b" }}>เตรียมพิมพ์ใบรับของแถม</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 14 }}>
            {[["เลขที่เอกสาร", docNo], ["ลูกค้า", text(selected.customer_name)], ["เลขที่ใบขาย", text(selected.sale_doc_no || selected.invoice_no)],
              ["วันที่ขาย", fmtDate(selected.sale_date)], ["เลขเครื่อง", text(selected.engine_no)], ["เลขตัวถัง", text(selected.frame_no)]].map(([l, val]) => (
              <div key={l} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{val || "-"}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontWeight: 700 }}>ของแถมที่รับ:</span>
            <label style={{ cursor: "pointer" }}><input type="checkbox" checked={chk.shirt} onChange={(e) => setChk({ ...chk, shirt: e.target.checked })} /> เสื้อ</label>
            <label style={{ cursor: "pointer" }}><input type="checkbox" checked={chk.helmet} onChange={(e) => setChk({ ...chk, helmet: e.target.checked })} /> หมวกกันน็อก</label>
            <label style={{ cursor: "pointer" }}><input type="checkbox" checked={chk.other} onChange={(e) => setChk({ ...chk, other: e.target.checked })} /> อื่นๆ</label>
            <input value={otherText} onChange={(e) => setOtherText(e.target.value)} placeholder="ระบุของแถมอื่นๆ"
              style={{ padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, minWidth: 200 }} disabled={!chk.other} />
          </div>
          <button className="btn-primary" style={{ padding: "10px 24px", fontSize: 15 }} onClick={printDoc}>🖨️ พิมพ์เอกสาร</button>
        </div>
      )}
    </div>
  );
}
