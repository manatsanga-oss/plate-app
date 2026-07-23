import React, { useEffect, useMemo, useState } from "react";

// ปรับเงินเดือน/เกรดพนักงาน (ปีละ 2 รอบ)
// เงินเพิ่ม = เกรด(0-5)% × เงินเดือนเก่า
// FRONT OFFICE: เงินเพิ่มเติมเข้า OT วันปกติก่อนจนถึงเพดาน (26 × OT/วันตามกฎหมาย) ส่วนเกินเข้าเงินเดือน
// อื่น ๆ: เข้าเงินเดือนทั้งหมด
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";

async function api(action, extra = {}) {
  const res = await fetch(API_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json().catch(() => null);
}
const asArray = d => Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
const fmtNum = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = v => Math.round(Number(v || 0) * 100) / 100;
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
const thisThaiYear = new Date().getFullYear() + 543;

export default function HrSalaryAdjustPage({ currentUser }) {
  const [tab, setTab] = useState("adjust"); // adjust | history
  const [employees, setEmployees] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  // รอบปรับ
  const [roundYear, setRoundYear] = useState(String(thisThaiYear));
  const [roundNo, setRoundNo] = useState("1");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [otHours, setOtHours] = useState("0.5"); // ตัวคูณต่อวันที่ใช้คิดเพดาน OT (เพดาน = เงินเดือน/30/8 × ค่านี้ × 26)
  const [grades, setGrades] = useState({}); // employee_id → เกรด (string)
  const [search, setSearch] = useState("");

  const roundLabel = `${roundYear} ครั้งที่ ${roundNo}`;

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [emp, adj] = await Promise.all([
        api("list_hr_employees").then(asArray),
        api("list_salary_adjustments").then(asArray),
      ]);
      setEmployees(emp.filter(e => (e.status || "active") === "active"));
      setAdjustments(adj);
    } catch { setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }

  // พนักงานที่ปรับในรอบนี้ไปแล้ว (active)
  const adjustedInRound = useMemo(() => {
    const s = new Set();
    for (const a of adjustments) if (a.status === "active" && a.round_label === roundLabel) s.add(String(a.employee_id));
    return s;
  }, [adjustments, roundLabel]);

  // รายการล่าสุด (active) ของแต่ละพนักงาน — ใช้เช็คว่ายกเลิกได้ไหม
  const latestActiveByEmp = useMemo(() => {
    const m = {};
    for (const a of adjustments) {
      if (a.status !== "active") continue;
      const k = String(a.employee_id);
      if (!m[k] || Number(a.adjustment_id) > Number(m[k].adjustment_id)) m[k] = a;
    }
    return m;
  }, [adjustments]);

  const isFront = e => String(e.office_type || "").toUpperCase().includes("FRONT");
  // เงื่อนไขเติมเข้า OT: ต้องเป็น FRONT OFFICE + สังกัด ป.เปา หรือ ป.เปา นครหลวง เท่านั้น (สิงห์ชัย/อื่น ๆ เข้าเงินเดือนทั้งหมด)
  const otEligible = e => isFront(e) && String(e.affiliation || "").trim().startsWith("ป.เปา");

  // คำนวณผลการปรับของพนักงาน 1 คนจากเกรดที่กรอก
  function calcRow(e) {
    const grade = Number(grades[e.employee_id]);
    if (!isFinite(grade) || grade <= 0) return null;
    const oldSalary = Number(e.salary_per_period || 0);
    const oldOt = Number(e.ot_workday || 0);
    const raise = r2(oldSalary * grade / 100);
    const hours = Number(otHours) || 0;
    const otDaily = r2(oldSalary / 30 / 8 * 1.5 * hours);
    const otCap = r2(otDaily * 26);
    let toOt = 0, toSalary = raise;
    if (otEligible(e)) {
      const gap = Math.max(0, r2(otCap - oldOt));
      toOt = Math.min(raise, gap);
      toSalary = r2(raise - toOt);
    }
    return {
      employee_id: e.employee_id, employee_name: e.employee_name, office_type: e.office_type || "",
      grade, old_salary: oldSalary, old_ot_workday: oldOt,
      raise_amount: raise, ot_daily_rate: otDaily, ot_cap: otCap,
      to_ot: r2(toOt), to_salary: r2(toSalary),
      new_salary: r2(oldSalary + toSalary), new_ot_workday: r2(oldOt + toOt),
    };
  }

  const kw = search.trim().toLowerCase();
  const shownEmployees = employees.filter(e => {
    if (!kw) return true;
    return [e.employee_name, e.department, e.branch_code, e.position, e.team_name].filter(Boolean).join(" ").toLowerCase().includes(kw);
  });

  const pendingRows = employees.map(calcRow).filter(Boolean).filter(r => !adjustedInRound.has(String(r.employee_id)));

  async function handleSave() {
    if (!pendingRows.length) { setMessage("⚠️ ยังไม่ได้กรอกเกรดของพนักงานที่จะปรับ"); return; }
    const list = pendingRows.map(r => `${r.employee_name} เกรด ${r.grade} → +${fmtNum(r.raise_amount)} (OT +${fmtNum(r.to_ot)} / เงินเดือน +${fmtNum(r.to_salary)})`).join("\n");
    if (!window.confirm(`บันทึกการปรับเงินเดือนรอบ ${roundLabel} จำนวน ${pendingRows.length} คน?\n\n${list}\n\nระบบจะอัปเดตเงินเดือน + OT ในข้อมูลพนักงานทันที`)) return;
    setSaving(true); setMessage("");
    try {
      const res = await api("save_salary_adjustments", {
        round_label: roundLabel,
        effective_date: effectiveDate,
        ot_hours_per_day: Number(otHours) || 0,
        created_by: currentUser?.username || currentUser?.name || "system",
        rows: pendingRows,
      });
      const saved = asArray(res)[0]?.saved;
      if (!saved) { setMessage("⚠️ ไม่ได้รับการยืนยันจากระบบ — กดรีเฟรชเช็คก่อนบันทึกซ้ำ"); }
      else setMessage(`✅ บันทึกการปรับ ${saved} คน (รอบ ${roundLabel}) เรียบร้อย`);
      setGrades({});
      await loadAll();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function handleCancel(a) {
    if (!window.confirm(`ยกเลิกการปรับของ ${a.employee_name} (รอบ ${a.round_label})?\nเงินเดือน/OT จะถูกคืนเป็นค่าเดิม: ${fmtNum(a.old_salary)} / ${fmtNum(a.old_ot_workday)}`)) return;
    try {
      const res = await api("cancel_salary_adjustment", { adjustment_id: a.adjustment_id });
      const ok = asArray(res).some(r => r.reverted_employee_id);
      setMessage(ok ? `✅ ยกเลิกและคืนค่าเดิมของ ${a.employee_name} แล้ว` : "⚠️ ยกเลิกไม่ได้ — ต้องเป็นรายการล่าสุดของพนักงานคนนั้น");
      await loadAll();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  const th = { padding: "9px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12, background: "#072d6b", color: "#fff" };
  const td = { padding: "7px 8px", borderBottom: "1px solid #e5e7eb", fontSize: 13, whiteSpace: "nowrap" };
  const tdNum = { ...td, textAlign: "right", fontFamily: "monospace" };
  const inputStyle = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };

  // ===== ประวัติ: จัดกลุ่มตามรอบ =====
  const historyRounds = useMemo(() => {
    const m = {};
    for (const a of adjustments) (m[a.round_label || "-"] = m[a.round_label || "-"] || []).push(a);
    return Object.entries(m).sort((x, y) => String(y[1][0]?.created_at || "").localeCompare(String(x[1][0]?.created_at || "")));
  }, [adjustments]);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📈 ปรับเงินเดือน / เกรดพนักงาน</h2>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["adjust", "บันทึกปรับรอบใหม่"], ["history", `ประวัติการปรับ (${adjustments.length})`]].map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
              background: tab === k ? "#072d6b" : "#e5e7eb", color: tab === k ? "#fff" : "#374151" }}>
            {lbl}
          </button>
        ))}
        <button onClick={loadAll} disabled={loading}
          style={{ padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fef3c7", color: message.startsWith("✅") ? "#065f46" : "#92400e", fontSize: 13, whiteSpace: "pre-wrap" }}>
          {message}
        </div>
      )}

      {tab === "adjust" && (
        <>
          {/* ตั้งค่ารอบ */}
          <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 10, padding: "12px 14px", background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>ปี (พ.ศ.)</div>
              <input value={roundYear} onChange={e => setRoundYear(e.target.value.replace(/[^0-9]/g, ""))} style={{ ...inputStyle, width: 80 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>ครั้งที่ (ปีละ 2 รอบ)</div>
              <select value={roundNo} onChange={e => setRoundNo(e.target.value)} style={inputStyle}>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>วันที่มีผล</div>
              <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>ชม. OT/วัน (คิดเพดาน ×1.5)</div>
              <input type="number" step="0.5" min="0" value={otHours} onChange={e => setOtHours(e.target.value)} style={{ ...inputStyle, width: 90, textAlign: "right" }} />
            </div>
            <div style={{ fontSize: 12, color: "#1e40af", maxWidth: 440 }}>
              เงินเพิ่ม = เกรด% × เงินเดือนเก่า · FRONT OFFICE <b>สังกัด ป.เปา / ป.เปา นครหลวง</b> เติมเข้า OT ก่อนจนถึงเพดาน
              (เงินเดือนเก่า ÷30 ÷8 × 1.5 × {otHours || 0} ชม. × 26 วัน) ส่วนเกินเข้าเงินเดือน · สิงห์ชัย/อื่น ๆ เข้าเงินเดือนทั้งหมด
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหาชื่อ / แผนก / สาขา"
              style={{ ...inputStyle, minWidth: 260 }} />
            <div style={{ flex: 1 }} />
            <button onClick={handleSave} disabled={saving || pendingRows.length === 0}
              style={{ padding: "9px 20px", background: saving || pendingRows.length === 0 ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "wait" : "pointer", fontWeight: 700, fontSize: 14 }}>
              {saving ? "กำลังบันทึก..." : `💾 บันทึกการปรับ (${pendingRows.length} คน) — รอบ ${roundLabel}`}
            </button>
          </div>

          <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 36 }}>#</th>
                  <th style={th}>ชื่อพนักงาน</th>
                  <th style={th}>แผนก / สาขา</th>
                  <th style={th}>Office</th>
                  <th style={{ ...th, textAlign: "right" }}>เงินเดือนปัจจุบัน</th>
                  <th style={{ ...th, textAlign: "right" }}>OT ปัจจุบัน</th>
                  <th style={{ ...th, textAlign: "center" }}>เกรด (0-5)</th>
                  <th style={{ ...th, textAlign: "right" }}>เงินเพิ่ม</th>
                  <th style={{ ...th, textAlign: "right" }}>เพดาน OT</th>
                  <th style={{ ...th, textAlign: "right" }}>เข้า OT</th>
                  <th style={{ ...th, textAlign: "right" }}>เข้าเงินเดือน</th>
                  <th style={{ ...th, textAlign: "right" }}>เงินเดือนใหม่</th>
                  <th style={{ ...th, textAlign: "right" }}>OT ใหม่</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={13} style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</td></tr>
                ) : shownEmployees.length === 0 ? (
                  <tr><td colSpan={13} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่พบพนักงาน</td></tr>
                ) : shownEmployees.map((e, i) => {
                  const done = adjustedInRound.has(String(e.employee_id));
                  const c = done ? null : calcRow(e);
                  return (
                    <tr key={e.employee_id} style={{ background: done ? "#f0fdf4" : c ? "#fefce8" : i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                      <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{e.employee_name}</td>
                      <td style={{ ...td, fontSize: 12, color: "#475569" }}>
                        {[e.department, e.branch_code].filter(Boolean).join(" / ") || "-"}
                        {e.affiliation && <span style={{ marginLeft: 5, color: "#9ca3af" }}>· {e.affiliation}</span>}
                      </td>
                      <td style={{ ...td, fontSize: 11 }}>
                        {isFront(e)
                          ? <span title={otEligible(e) ? "FRONT + ป.เปา — เงินเพิ่มเติมเข้า OT ก่อน" : "FRONT แต่ไม่ใช่สังกัด ป.เปา — เข้าเงินเดือนทั้งหมด"}
                              style={{ padding: "2px 6px", background: otEligible(e) ? "#dbeafe" : "#f3f4f6", color: otEligible(e) ? "#1e40af" : "#6b7280", borderRadius: 8, fontWeight: 700 }}>FRONT{otEligible(e) ? "" : "*"}</span>
                          : <span style={{ padding: "2px 6px", background: "#f3f4f6", color: "#6b7280", borderRadius: 8 }}>{e.office_type ? "BACK" : "-"}</span>}
                      </td>
                      <td style={tdNum}>{fmtNum(e.salary_per_period)}</td>
                      <td style={tdNum}>{fmtNum(e.ot_workday)}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {done ? (
                          <span style={{ color: "#059669", fontWeight: 700, fontSize: 12 }}>✓ ปรับแล้ว</span>
                        ) : (
                          <input type="number" min="0" max="5" step="0.5" value={grades[e.employee_id] ?? ""}
                            onChange={ev => {
                              const v = ev.target.value;
                              if (v !== "" && (Number(v) < 0 || Number(v) > 5)) return;
                              setGrades(p => ({ ...p, [e.employee_id]: v }));
                            }}
                            style={{ width: 64, padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db", textAlign: "center", fontWeight: 700 }} />
                        )}
                      </td>
                      <td style={{ ...tdNum, color: c ? "#059669" : "#9ca3af", fontWeight: c ? 700 : 400 }}>{c ? fmtNum(c.raise_amount) : "-"}</td>
                      <td style={{ ...tdNum, color: "#6b7280" }}>{c && otEligible(e) ? fmtNum(c.ot_cap) : "-"}</td>
                      <td style={{ ...tdNum, color: c && c.to_ot > 0 ? "#d97706" : "#9ca3af" }}>{c ? fmtNum(c.to_ot) : "-"}</td>
                      <td style={{ ...tdNum, color: c && c.to_salary > 0 ? "#1e40af" : "#9ca3af" }}>{c ? fmtNum(c.to_salary) : "-"}</td>
                      <td style={{ ...tdNum, fontWeight: c ? 700 : 400 }}>{c ? fmtNum(c.new_salary) : "-"}</td>
                      <td style={{ ...tdNum, fontWeight: c ? 700 : 400 }}>{c ? fmtNum(c.new_ot_workday) : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "history" && (
        historyRounds.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>ยังไม่มีประวัติการปรับเงินเดือน</div>
        ) : historyRounds.map(([round, list]) => (
          <div key={round} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#072d6b", marginBottom: 6 }}>
              รอบ {round} <span style={{ fontWeight: 400, fontSize: 12, color: "#6b7280" }}>· มีผล {fmtDate(list[0]?.effective_date)} · {list.filter(a => a.status === "active").length} คน</span>
            </div>
            <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>ชื่อพนักงาน</th>
                    <th style={{ ...th, textAlign: "center" }}>เกรด</th>
                    <th style={{ ...th, textAlign: "right" }}>เงินเดือนเดิม</th>
                    <th style={{ ...th, textAlign: "right" }}>OT เดิม</th>
                    <th style={{ ...th, textAlign: "right" }}>เงินเพิ่ม</th>
                    <th style={{ ...th, textAlign: "right" }}>เข้า OT</th>
                    <th style={{ ...th, textAlign: "right" }}>เข้าเงินเดือน</th>
                    <th style={{ ...th, textAlign: "right" }}>เงินเดือนใหม่</th>
                    <th style={{ ...th, textAlign: "right" }}>OT ใหม่</th>
                    <th style={th}>บันทึกโดย</th>
                    <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
                    <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a, i) => {
                    const cancellable = a.status === "active" && latestActiveByEmp[String(a.employee_id)]?.adjustment_id === a.adjustment_id;
                    return (
                      <tr key={a.adjustment_id} style={{ background: a.status === "cancelled" ? "#fef2f2" : i % 2 === 0 ? "#fff" : "#f9fafb", opacity: a.status === "cancelled" ? 0.6 : 1 }}>
                        <td style={{ ...td, fontWeight: 600 }}>{a.employee_name}</td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{Number(a.grade || 0)}</td>
                        <td style={tdNum}>{fmtNum(a.old_salary)}</td>
                        <td style={tdNum}>{fmtNum(a.old_ot_workday)}</td>
                        <td style={{ ...tdNum, color: "#059669", fontWeight: 600 }}>{fmtNum(a.raise_amount)}</td>
                        <td style={{ ...tdNum, color: "#d97706" }}>{fmtNum(a.to_ot)}</td>
                        <td style={{ ...tdNum, color: "#1e40af" }}>{fmtNum(a.to_salary)}</td>
                        <td style={{ ...tdNum, fontWeight: 700 }}>{fmtNum(a.new_salary)}</td>
                        <td style={{ ...tdNum, fontWeight: 700 }}>{fmtNum(a.new_ot_workday)}</td>
                        <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{a.created_by || "-"}</td>
                        <td style={{ ...td, textAlign: "center", fontSize: 11 }}>
                          {a.status === "cancelled"
                            ? <span style={{ color: "#991b1b", fontWeight: 700 }}>ยกเลิกแล้ว</span>
                            : <span style={{ color: "#065f46", fontWeight: 700 }}>ใช้งาน</span>}
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          {cancellable && (
                            <button onClick={() => handleCancel(a)} title="ยกเลิกและคืนเงินเดือน/OT เป็นค่าเดิม (ได้เฉพาะรายการล่าสุดของพนักงาน)"
                              style={{ padding: "3px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                              ยกเลิก
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
