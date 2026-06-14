import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// หน้า "สินค้าคงเหลือ รถจักรยานยนต์ (รถใหม่)" — เมนู Report (USER เห็น)
// ----------------------------------------------------------------------------
// สต๊อกรถใหม่คงเหลือ ณ วันที่เลือก = รับรถ (รถใหม่ + ยอดยกมา) − ขายแล้ว
//   ขายแล้ว = sold_at (ขายปลีก) ≤ วันที่  หรือ  อยู่ใน moto_sales / retail_sales (match เลขเครื่อง/เลขถัง) sale_date ≤ วันที่
// backend: stock-turnover-api action `stock_on_hand` { brand, as_of, new_only, deduct_sales }
//   - new_only=true  → เฉพาะ product_type/vehicle_type = 'รถใหม่'
//   - deduct_sales=true → ตัดที่ขายผ่าน moto_sales / retail_sales ด้วย
// ============================================================================
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-turnover-api";

const BRANDS = [
  { key: "HONDA", label: "HONDA (ป.เปา)", color: "#e10600" },
  { key: "YAMAHA", label: "YAMAHA (สิงห์ชัย)", color: "#0a4aa8" },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtN(n) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(n) {
  return Number(n || 0).toLocaleString("th-TH");
}
function fmtDateTH(iso) {
  const m = String(iso || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${parseInt(m[1], 10) + 543}` : "-";
}

async function postJson(body) {
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return raw.trim() ? JSON.parse(raw) : [];
}
const asArray = (d) => (Array.isArray(d) ? d : d?.data || d?.rows || []);

export default function MotoStockOnHandReportPage() {
  const [brand, setBrand] = useState("HONDA");
  const [asOf, setAsOf] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loadedInfo, setLoadedInfo] = useState({ brand: "", asOf: "" });
  const [search, setSearch] = useState("");

  async function loadReport(b = brand, date = asOf) {
    setLoading(true); setMessage("");
    try {
      const data = asArray(await postJson({ action: "stock_on_hand", brand: b, as_of: date, new_only: true, deduct_sales: true }));
      setRows(Array.isArray(data) ? data.filter((r) => r && r.id != null) : []);
      setLoadedInfo({ brand: b, asOf: date });
    } catch (e) {
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + (e.message || e));
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => { loadReport(); /* eslint-disable-next-line */ }, []);

  const kw = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!kw) return rows;
    return rows.filter((r) => [r.model, r.model_type, r.color, r.engine_no, r.chassis_no]
      .some((v) => String(v || "").toLowerCase().includes(kw)));
  }, [rows, kw]);

  const totalCost = filtered.reduce((s, r) => s + Number(r.unit_cost || 0), 0);

  // สรุปตามรุ่น/แบบ
  const byModel = useMemo(() => {
    const m = new Map();
    filtered.forEach((r) => {
      const key = [r.model, r.model_type].filter(Boolean).join(" · ") || "-";
      if (!m.has(key)) m.set(key, { key, qty: 0, cost: 0 });
      const g = m.get(key); g.qty += 1; g.cost += Number(r.unit_cost || 0);
    });
    return [...m.values()].sort((a, b) => b.qty - a.qty || b.cost - a.cost);
  }, [filtered]);

  const brandObj = BRANDS.find((x) => x.key === brand) || BRANDS[0];

  return (
    <div className="page-container">
      <style>{`
        @media print {
          .no-print, .no-print * { display:none !important; }
          .sidebar, aside.sidebar, .page-topbar { display:none !important; }
          body,html,#root,.page-container { background:#fff !important; margin:0 !important; padding:0 !important; }
          .soh-table { font-size:11px !important; } .soh-table th,.soh-table td { padding:3px 6px !important; }
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>

      <div className="page-topbar">
        <div className="page-title">📦 สินค้าคงเหลือ รถจักรยานยนต์ (รถใหม่)</div>
      </div>

      {/* Brand toggle */}
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {BRANDS.map((b) => (
          <button key={b.key} onClick={() => { setBrand(b.key); loadReport(b.key, asOf); }}
            style={{ padding: "8px 18px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700,
              background: brand === b.key ? b.color : "#e5e7eb", color: brand === b.key ? "#fff" : "#374151" }}>
            ● {b.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={lbl}>📅 คงเหลือ ณ วันที่</label>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ ...inp, minWidth: 160 }} />
          </div>
          <button onClick={() => loadReport()} disabled={loading}
            style={{ padding: "8px 18px", background: loading ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
            🔄 {loading ? "กำลังคิดยอด..." : "ดูสินค้าคงเหลือ"}
          </button>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา รุ่น/แบบ/สี/เลขเครื่อง/เลขถัง"
            style={{ ...inp, flex: 1, minWidth: 220 }} />
          <button onClick={() => window.print()} disabled={loading || rows.length === 0}
            style={{ padding: "8px 14px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>🖨️ พิมพ์</button>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
          คงเหลือ = รับรถใหม่ (รวมยอดยกมา) − ขายแล้ว (ขายปลีก + moto_sales) นับวันที่ขาย ≤ วันที่เลือก
        </div>
        {message && <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12 }}>{message}</div>}
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        <Card color="#dbeafe" textColor="#1e40af" label="คงเหลือ" value={fmtInt(filtered.length)} suffix="คัน" />
        <Card color="#dcfce7" textColor="#065f46" label="รวมต้นทุน" value={fmtN(totalCost)} suffix="บาท" />
        <Card color="#fef3c7" textColor="#92400e" label={`${brandObj.label.split(" ")[0]} · ณ`} value={fmtDateTH(loadedInfo.asOf || asOf)} text />
      </div>

      {/* By model */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>📊 สรุปตามรุ่น/แบบ ({byModel.length})</div>
        {byModel.length === 0 ? <div style={{ color: "#9ca3af", padding: 8 }}>—</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {byModel.map((g) => (
              <div key={g.key} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{g.key}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{fmtInt(g.qty)} คัน · {fmtN(g.cost)} บาท</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail list */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>ไม่มีสินค้าคงเหลือ</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="soh-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#072d6b", color: "#fff" }}>
                  <th style={th}>#</th>
                  <th style={{ ...th, textAlign: "left" }}>รับเมื่อ</th>
                  <th style={{ ...th, textAlign: "left" }}>รุ่น/แบบ</th>
                  <th style={th}>type</th>
                  <th style={{ ...th, textAlign: "left" }}>สี</th>
                  <th style={{ ...th, textAlign: "left" }}>เลขเครื่อง</th>
                  <th style={{ ...th, textAlign: "left" }}>เลขถัง</th>
                  <th style={{ ...th, textAlign: "right" }}>อายุ (วัน)</th>
                  <th style={{ ...th, textAlign: "right" }}>ต้นทุน</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDateTH(r.received_date)}</td>
                    <td style={td}>{r.model || "-"}</td>
                    <td style={{ ...td, textAlign: "center" }}>{r.model_type || "-"}</td>
                    <td style={td}>{r.color || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.engine_no || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                    <td style={{ ...td, textAlign: "right" }}>{r.age_days != null ? fmtInt(r.age_days) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmtN(r.unit_cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f1f5f9", fontWeight: 700, color: "#072d6b" }}>
                  <td colSpan={8} style={{ ...td, textAlign: "right" }}>รวม {fmtInt(filtered.length)} คัน</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmtN(totalCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ color, textColor, label, value, suffix, text }) {
  return (
    <div style={{ padding: "12px 16px", background: color, borderRadius: 10 }}>
      <div style={{ fontSize: 12, color: textColor, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: text ? 18 : 22, color: textColor, fontWeight: 700, marginTop: 4 }}>
        {value}{suffix && <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 6 }}>{suffix}</span>}
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 3 };
const inp = { padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const th = { padding: "8px 9px", textAlign: "center", fontWeight: 600 };
const td = { padding: "6px 9px", verticalAlign: "top" };
