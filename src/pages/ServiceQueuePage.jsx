import React, { useCallback, useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/service-queue-ticket-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api"; // สาขา (branch_master)

const STATUS = {
  waiting: { label: "รอเรียก", color: "#92400e", bg: "#fef3c7" },
  serving: { label: "กำลังบริการ", color: "#065f46", bg: "#d1fae5" },
  done: { label: "เสร็จแล้ว", color: "#374151", bg: "#e5e7eb" },
  skipped: { label: "ไม่มาตามเรียก", color: "#b91c1c", bg: "#fee2e2" },
};

const SERVICE_TYPES = ["เช็คระยะ", "เปลี่ยนถ่ายน้ำมันเครื่อง", "ซ่อมทั่วไป", "เคลมประกัน", "ติดตั้งอุปกรณ์", "อื่น ๆ"];

async function callApi(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export default function ServiceQueuePage({ currentUser }) {
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState("SCY01");
  const [tickets, setTickets] = useState([]);
  const [state, setState] = useState(null);
  const [form, setForm] = useState({ customer_name: "", plate_no: "", service_type: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(MASTER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_branches" }),
        });
        const data = await res.json();
        setBranches((Array.isArray(data) ? data : []).filter((b) => b && b.branch_code));
      } catch {
        setBranches([]);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [rows, st] = await Promise.all([
        callApi({ action: "list_tickets", branch_code: branch }),
        callApi({ action: "display_state", branch_code: branch }),
      ]);
      setTickets(rows);
      setState(st[0] || null);
    } catch {
      setMessage("โหลดข้อมูลคิวไม่สำเร็จ");
    }
  }, [branch]);

  // รีเฟรชอัตโนมัติ เผื่อมีพนักงานอีกเครื่องกดออกคิว/เรียกคิวพร้อมกัน
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [refresh]);

  async function run(body, okMsg) {
    setBusy(true);
    setMessage("");
    try {
      const rows = await callApi(body);
      await refresh();
      setMessage(typeof okMsg === "function" ? okMsg(rows[0]) : okMsg);
      return rows[0] || null;
    } catch {
      setMessage("ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function issueTicket() {
    const t = await run(
      { action: "issue_ticket", branch_code: branch, ...form },
      (r) => (r ? `ออกบัตรคิวที่ ${r.queue_no} แล้ว` : "ออกบัตรคิวไม่สำเร็จ")
    );
    if (t) {
      setForm({ customer_name: "", plate_no: "", service_type: "" });
      printTicket(t);
    }
  }

  function printTicket(t) {
    const w = window.open("", "_blank", "width=380,height=520");
    if (!w) return;
    const branchName = branches.find((b) => b.branch_code === branch)?.branch_name || branch;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>บัตรคิว ${t.queue_no}</title>
      <style>
        body{font-family:"Segoe UI",Tahoma,sans-serif;text-align:center;padding:24px 12px;margin:0}
        .shop{font-size:15px;color:#374151}
        .no{font-size:96px;font-weight:800;line-height:1.05;margin:14px 0}
        .lbl{font-size:16px;color:#6b7280}
        .info{font-size:15px;margin-top:14px;border-top:1px dashed #9ca3af;padding-top:12px;text-align:left}
        .info div{margin:4px 0}
      </style></head><body>
      <div class="shop">ศูนย์บริการ ${branchName}</div>
      <div class="lbl">หมายเลขคิวของท่าน</div>
      <div class="no">${t.queue_no}</div>
      <div class="info">
        <div>เวลาออกบัตร: ${t.issued_time || "-"}</div>
        <div>ชื่อ: ${t.customer_name || "-"}</div>
        <div>ทะเบียน: ${t.plate_no || "-"}</div>
        <div>ประเภทงาน: ${t.service_type || "-"}</div>
      </div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  const waiting = tickets.filter((t) => t.status === "waiting");
  const cardStyle = { flex: 1, minWidth: 150, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" };

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>🎫 คิวศูนย์บริการ</h2>
        <select value={branch} onChange={(e) => setBranch(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8 }}>
          {branches.length === 0 && <option value="SCY01">SCY01</option>}
          {branches.map((b) => (
            <option key={b.branch_code} value={b.branch_code}>
              {b.branch_code} — {b.branch_name || ""}
            </option>
          ))}
        </select>
        <button onClick={refresh} disabled={busy} style={{ padding: "6px 12px", borderRadius: 8 }}>
          รีเฟรช
        </button>
        {state?.clock && <span style={{ color: "#6b7280" }}>ข้อมูล ณ {state.clock} น.</span>}
      </div>

      {message && (
        <div style={{ marginBottom: 14, padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8 }}>
          {message}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ ...cardStyle, background: "#ecfdf5", borderColor: "#a7f3d0" }}>
          <div style={{ color: "#6b7280", fontSize: 13 }}>กำลังให้บริการ</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#065f46" }}>{state?.now_serving > 0 ? state.now_serving : "-"}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: "#6b7280", fontSize: 13 }}>คิวถัดไป</div>
          <div style={{ fontSize: 44, fontWeight: 800 }}>{state?.next_no > 0 ? state.next_no : "-"}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: "#6b7280", fontSize: 13 }}>รออยู่</div>
          <div style={{ fontSize: 44, fontWeight: 800 }}>{waiting.length}</div>
        </div>
        <button
          onClick={() => run({ action: "call_next", branch_code: branch }, (r) => (r ? `เรียกคิวที่ ${r.queue_no}` : "ไม่มีคิวที่รออยู่แล้ว"))}
          disabled={busy || waiting.length === 0}
          style={{
            flex: 1, minWidth: 200, fontSize: 22, fontWeight: 700, borderRadius: 12, border: "none", cursor: "pointer",
            background: waiting.length === 0 ? "#d1d5db" : "#2563eb", color: "#fff",
          }}
        >
          🔔 เรียกคิวถัดไป
        </button>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>ออกบัตรคิวใหม่</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            placeholder="ชื่อลูกค้า"
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            style={{ flex: 2, minWidth: 180, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
          <input
            placeholder="ทะเบียนรถ"
            value={form.plate_no}
            onChange={(e) => setForm({ ...form, plate_no: e.target.value })}
            style={{ flex: 1, minWidth: 130, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
          <select
            value={form.service_type}
            onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            style={{ flex: 1, minWidth: 160, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
          >
            <option value="">— ประเภทงาน —</option>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={issueTicket}
            disabled={busy}
            style={{ padding: "8px 20px", fontWeight: 700, borderRadius: 8, border: "none", background: "#059669", color: "#fff", cursor: "pointer" }}
          >
            ออกบัตรคิว + พิมพ์
          </button>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
        <thead>
          <tr style={{ background: "#f9fafb", textAlign: "left" }}>
            <th style={th}>คิว</th>
            <th style={th}>ลูกค้า</th>
            <th style={th}>ทะเบียน</th>
            <th style={th}>ประเภทงาน</th>
            <th style={th}>สถานะ</th>
            <th style={th}>ออกบัตร</th>
            <th style={th}>เรียก</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 && (
            <tr>
              <td colSpan={8} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 24 }}>
                ยังไม่มีคิววันนี้
              </td>
            </tr>
          )}
          {tickets.map((t) => {
            const st = STATUS[t.status] || STATUS.waiting;
            return (
              <tr key={t.id}>
                <td style={{ ...td, fontWeight: 800, fontSize: 18 }}>{t.queue_no}</td>
                <td style={td}>{t.customer_name || "-"}</td>
                <td style={td}>{t.plate_no || "-"}</td>
                <td style={td}>{t.service_type || "-"}</td>
                <td style={td}>
                  <span style={{ background: st.bg, color: st.color, padding: "3px 10px", borderRadius: 999, fontSize: 13 }}>{st.label}</span>
                </td>
                <td style={td}>{t.issued_time || "-"}</td>
                <td style={td}>{t.called_time || "-"}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  {t.status === "serving" && (
                    <button onClick={() => run({ action: "complete_ticket", id: t.id }, `ปิดคิวที่ ${t.queue_no} แล้ว`)} disabled={busy} style={btn}>
                      จบคิว
                    </button>
                  )}
                  {(t.status === "waiting" || t.status === "serving") && (
                    <button onClick={() => run({ action: "skip_ticket", id: t.id }, `ข้ามคิวที่ ${t.queue_no}`)} disabled={busy} style={btn}>
                      ไม่มา
                    </button>
                  )}
                  {t.status === "skipped" && (
                    <button onClick={() => run({ action: "recall_ticket", id: t.id }, `ดึงคิวที่ ${t.queue_no} กลับมารอ`)} disabled={busy} style={btn}>
                      ดึงกลับ
                    </button>
                  )}
                  <button onClick={() => printTicket(t)} style={btn}>พิมพ์</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th = { padding: "10px 12px", borderBottom: "1px solid #e5e7eb", fontSize: 13, color: "#6b7280" };
const td = { padding: "10px 12px", borderBottom: "1px solid #f3f4f6" };
const btn = { marginRight: 6, padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" };
