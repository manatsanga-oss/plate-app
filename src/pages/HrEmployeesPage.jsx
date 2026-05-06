import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const emptyForm = () => ({
  employee_name: "",
  team_name: "",
  branch_code: "",
  position: "",
  affiliation: "",
  weekly_day_off: "Sunday",
  monthly_day_off: "",
  laundry_allowance: 0,
  meal_allowance: 0,
  diligence_allowance: 0,
  sso_rate: 0.05,
  provident_fund_rate: 0,
  commission_method: false,
  special_commission: false,
  salary_per_period: 0,
  extra_bonus: 0,
  ot_workday: 0,
  kosor: 0,
  bank_account_no: "",
  bank_name: "",
  is_executive: false,
  status: "active",
});

export default function HrEmployeesPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [message, setMessage] = useState("");
  const [ttNames, setTtNames] = useState([]); // ชื่อพนักงานจาก time_tracking_records

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [includeInactive]);
  useEffect(() => { fetchTimeTrackingNames(); }, []);

  async function fetchTimeTrackingNames() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_employees" }),
      });
      const data = await res.json();
      const names = (Array.isArray(data) ? data : []).map(x => x.employee_name).filter(Boolean);
      // unique + sorted
      setTtNames([...new Set(names)].sort((a, b) => a.localeCompare(b, "th")));
    } catch { setTtNames([]); }
  }

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_hr_employees", include_inactive: String(includeInactive) }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.employee_name.trim()) { setMessage("❌ กรุณากรอกชื่อพนักงาน"); return; }
    setSaving(true); setMessage("");
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editTarget ? "update_hr_employee" : "save_hr_employee",
          ...(editTarget ? { employee_id: editTarget.employee_id } : {}),
          ...form,
        }),
      });
      setShowForm(false); setEditTarget(null); setForm(emptyForm());
      setMessage(`✅ ${editTarget ? "แก้ไข" : "เพิ่ม"}สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function toggleStatus(r) {
    const newStatus = r.status === "active" ? "inactive" : "active";
    if (!window.confirm(`${newStatus === "active" ? "เปิด" : "ปิด"}ใช้งาน "${r.employee_name}"?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_hr_employee", employee_id: r.employee_id, status: newStatus }),
      });
      setMessage(`✅ ${newStatus === "active" ? "เปิด" : "ปิด"}ใช้งาน "${r.employee_name}"`);
      fetchData();
    } catch { setMessage("❌ ไม่สำเร็จ"); }
  }

  function openEdit(r) {
    setForm({
      employee_name: r.employee_name || "",
      team_name: r.team_name || "",
      branch_code: r.branch_code || "",
      position: r.position || "",
      affiliation: r.affiliation || "",
      weekly_day_off: r.weekly_day_off || "Sunday",
      monthly_day_off: r.monthly_day_off || "",
      laundry_allowance: r.laundry_allowance || 0,
      meal_allowance: r.meal_allowance || 0,
      diligence_allowance: r.diligence_allowance || 0,
      sso_rate: r.sso_rate || 0.05,
      provident_fund_rate: r.provident_fund_rate || 0,
      commission_method: !!r.commission_method && r.commission_method !== "" && r.commission_method !== "false",
      special_commission: !!r.special_commission && r.special_commission !== "" && r.special_commission !== "false",
      salary_per_period: r.salary_per_period || 0,
      extra_bonus: r.extra_bonus || 0,
      ot_workday: r.ot_workday || 0,
      kosor: r.kosor || 0,
      bank_account_no: r.bank_account_no || "",
      bank_name: r.bank_name || "",
      is_executive: r.is_executive === true,
      status: r.status || "active",
    });
    setEditTarget(r);
    setShowForm(true);
  }

  function openAdd() {
    setForm(emptyForm()); setEditTarget(null); setShowForm(true);
  }

  function fmtNum(v) {
    return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!kw) return true;
    const hay = [r.employee_name, r.team_name, r.position, r.affiliation, r.branch_code]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">👥 ข้อมูลพนักงาน (HR Master)</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <input type="text" placeholder="🔍 ค้นหา (ชื่อ, ทีม, ตำแหน่ง, สังกัด)"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 280 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          แสดงที่ปิดใช้งาน
        </label>
        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 16px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          🔄 รีเฟรช
        </button>
        <button onClick={openAdd}
          style={{ padding: "7px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
          ➕ เพิ่มพนักงาน
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล — กด "➕ เพิ่มพนักงาน"</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>ชื่อ</th>
                <th style={th}>ทีม</th>
                <th style={th}>สาขา</th>
                <th style={th}>ตำแหน่ง</th>
                <th style={th}>สังกัด</th>
                <th style={{ ...th, textAlign: "right" }}>เงินเดือน/ครั้ง</th>
                <th style={{ ...th, textAlign: "right" }}>ค่าข้าว</th>
                <th style={{ ...th, textAlign: "right" }}>ซักเสื้อ</th>
                <th style={{ ...th, textAlign: "right" }}>เบี้ยขยัน</th>
                <th style={th}>วันหยุด</th>
                <th style={th}>ประกันสังคม</th>
                <th style={th}>ธนาคาร / บัญชี</th>
                <th style={th}>สถานะ</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.employee_id} style={{ borderTop: "1px solid #e5e7eb", opacity: r.status === "inactive" ? 0.5 : 1 }}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {r.employee_name}
                    {r.is_executive && <span style={{ marginLeft: 6, padding: "1px 6px", background: "#fde68a", color: "#92400e", fontSize: 10, borderRadius: 3 }}>ผู้บริหาร</span>}
                  </td>
                  <td style={td}>{r.team_name || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.branch_code || "-"}</td>
                  <td style={td}>{r.position || "-"}</td>
                  <td style={td}>{r.affiliation || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmtNum(r.salary_per_period)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{r.meal_allowance || 0}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{r.laundry_allowance || 0}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{r.diligence_allowance || 0}</td>
                  <td style={{ ...td, fontSize: 11 }}>{r.weekly_day_off || "-"}{r.monthly_day_off ? ` / ${r.monthly_day_off}` : ""}</td>
                  <td style={{ ...td, fontSize: 11 }}>{(Number(r.sso_rate || 0) * 100).toFixed(2)}%</td>
                  <td style={td}>
                    <div style={{ fontSize: 11 }}>{r.bank_name || "-"}</div>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#0369a1" }}>{r.bank_account_no || "-"}</div>
                  </td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: r.status === "active" ? "#d1fae5" : "#fee2e2", color: r.status === "active" ? "#065f46" : "#991b1b" }}>
                      {r.status === "active" ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td style={td}>
                    <button onClick={() => openEdit(r)} style={btnEdit}>✏️</button>
                    <button onClick={() => toggleStatus(r)} style={r.status === "active" ? btnDelete : btnReact}>
                      {r.status === "active" ? "ปิด" : "เปิด"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 800, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>{editTarget ? "✏️ แก้ไขพนักงาน" : "➕ เพิ่มพนักงานใหม่"}</h3>

            <Section title="ข้อมูลทั่วไป">
              <div style={grid3}>
                <Field label="ชื่อพนักงาน *">
                  <select value={form.employee_name}
                    onChange={e => setForm(f => ({ ...f, employee_name: e.target.value }))}
                    style={inp}>
                    <option value="">-- เลือกพนักงาน --</option>
                    {/* แสดงชื่อปัจจุบัน (กรณี edit) ถ้าไม่อยู่ใน list */}
                    {form.employee_name && !ttNames.includes(form.employee_name) && (
                      <option value={form.employee_name}>{form.employee_name}</option>
                    )}
                    {ttNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    📋 รายชื่อจากบันทึกเวลาทำงาน ({ttNames.length} คน)
                  </div>
                </Field>
                <Field label="ทีม">
                  <input value={form.team_name} onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))} style={inp} />
                </Field>
                <Field label="ตำแหน่ง">
                  <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} style={inp} />
                </Field>
                <Field label="รหัสร้าน">
                  <select value={form.branch_code} onChange={e => setForm(f => ({ ...f, branch_code: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }}>
                    <option value="">-- เลือกรหัสร้าน --</option>
                    <option value="SCY01">SCY01 — ศูนย์ยามาฮ่า</option>
                    <option value="SCY04">SCY04 — สีขวา</option>
                    <option value="SCY05">SCY05 — ป.เปา นครหลวง</option>
                    <option value="SCY06">SCY06 — ป.เปา วังน้อย</option>
                    <option value="SCY07">SCY07 — สิงห์ชัยตลาด</option>
                  </select>
                </Field>
                <Field label="สังกัด">
                  <select value={form.affiliation} onChange={e => setForm(f => ({ ...f, affiliation: e.target.value }))} style={inp}>
                    <option value="">-- เลือกสังกัด --</option>
                    <option value="ป.เปา">ป.เปา</option>
                    <option value="สิงห์ชัย">สิงห์ชัย</option>
                  </select>
                </Field>
                <Field label="สถานะ">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                    <option value="active">ใช้งาน</option>
                    <option value="inactive">ปิด</option>
                  </select>
                </Field>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_executive} onChange={e => setForm(f => ({ ...f, is_executive: e.target.checked }))} />
                เป็นผู้บริหาร (ใช้กฎคำนวณเงินเดือนต่างจากพนักงานทั่วไป)
              </label>
            </Section>

            <Section title="🗓️ วันหยุด">
              <div style={grid2}>
                <Field label="วันหยุดประจำสัปดาห์">
                  <select value={form.weekly_day_off} onChange={e => setForm(f => ({ ...f, weekly_day_off: e.target.value }))} style={inp}>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="วันหยุดกลางเดือน (ชื่อวัน)">
                  <select value={form.monthly_day_off} onChange={e => setForm(f => ({ ...f, monthly_day_off: e.target.value }))} style={inp}>
                    <option value="">-- ไม่มี --</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
              </div>
            </Section>

            <Section title="💰 เงินเดือนและ Allowance">
              <div style={grid3}>
                <Field label="เงินเดือน/ครั้ง">
                  <input type="number" step="0.01" value={form.salary_per_period} onChange={e => setForm(f => ({ ...f, salary_per_period: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="เงินเพิ่มพิเศษ">
                  <input type="number" step="0.01" value={form.extra_bonus} onChange={e => setForm(f => ({ ...f, extra_bonus: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="OT-วันทำงาน">
                  <input type="number" step="0.01" value={form.ot_workday} onChange={e => setForm(f => ({ ...f, ot_workday: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="ค่าข้าว">
                  <input type="number" value={form.meal_allowance} onChange={e => setForm(f => ({ ...f, meal_allowance: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="ค่าซักเสื้อ">
                  <input type="number" value={form.laundry_allowance} onChange={e => setForm(f => ({ ...f, laundry_allowance: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="ค่าเบี้ยขยัน">
                  <input type="number" value={form.diligence_allowance} onChange={e => setForm(f => ({ ...f, diligence_allowance: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
              </div>
            </Section>

            <Section title="📉 รายการหัก">
              <div style={grid3}>
                <Field label="ประกันสังคม (%, เช่น 0.05 = 5%)">
                  <input type="number" step="0.0001" value={form.sso_rate} onChange={e => setForm(f => ({ ...f, sso_rate: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="กองทุนสำรองเลี้ยงชีพ (%)">
                  <input type="number" step="0.0001" value={form.provident_fund_rate} onChange={e => setForm(f => ({ ...f, provident_fund_rate: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="ก.ย.ศ (จำนวนเงิน)">
                  <input type="number" step="0.01" value={form.kosor} onChange={e => setForm(f => ({ ...f, kosor: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
              </div>
            </Section>

            <Section title="🧮 คำนวณ Commission">
              <div style={grid2}>
                <Field label="คำนวณค่าคอมปกติ">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: form.commission_method ? "#dcfce7" : "#fff" }}>
                    <input type="checkbox" checked={!!form.commission_method}
                      onChange={e => setForm(f => ({ ...f, commission_method: e.target.checked }))}
                      style={{ width: 18, height: 18, cursor: "pointer" }} />
                    <span style={{ fontSize: 13 }}>{form.commission_method ? "✅ ได้" : "ไม่ได้"}</span>
                  </label>
                </Field>
                <Field label="คำนวณค่าคอมพิเศษ">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: form.special_commission ? "#dcfce7" : "#fff" }}>
                    <input type="checkbox" checked={!!form.special_commission}
                      onChange={e => setForm(f => ({ ...f, special_commission: e.target.checked }))}
                      style={{ width: 18, height: 18, cursor: "pointer" }} />
                    <span style={{ fontSize: 13 }}>{form.special_commission ? "✅ ได้" : "ไม่ได้"}</span>
                  </label>
                </Field>
              </div>
            </Section>

            <Section title="💳 บัญชีธนาคาร">
              <div style={grid2}>
                <Field label="ธนาคาร">
                  <input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} style={inp} />
                </Field>
                <Field label="เลขที่บัญชี">
                  <input value={form.bank_account_no} onChange={e => setForm(f => ({ ...f, bank_account_no: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
              </div>
            </Section>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowForm(false)} disabled={saving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving || !form.employee_name.trim()}
                style={{ padding: "8px 20px", background: saving ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 12, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3, color: "#374151" }}>{label}</label>
      {children}
    </div>
  );
}

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const grid3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 };
const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box", width: "100%" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const btnEdit = { padding: "4px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnDelete = { padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
const btnReact = { padding: "4px 10px", background: "#059669", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
