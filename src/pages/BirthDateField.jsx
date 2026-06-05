import React from "react";

// ============================================================================
// ช่องวันเกิดแบบ dropdown วัน / เดือน / ปี(พ.ศ.) + แสดงอายุ
// เก็บค่าใน form.birth_date เป็น ISO ค.ศ. (YYYY-MM-DD) เหมือนเดิม — แปลง พ.ศ. → ค.ศ. ให้อัตโนมัติ
// props: form, setForm, inp (style)
// ============================================================================
const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function calcAge(iso) {
  const m = String(iso || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const today = new Date();
  const b = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  let age = today.getFullYear() - b.getFullYear();
  const md = today.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < b.getDate())) age--;
  return String(age);
}

export default function BirthDateField({ form, setForm, inp }) {
  const iso = String(form.birth_date || "").slice(0, 10);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dd = m ? parseInt(m[3], 10) : "";
  const mm = m ? parseInt(m[2], 10) : "";
  const beYear = m ? parseInt(m[1], 10) + 543 : "";

  const nowBE = new Date().getFullYear() + 543;
  const years = [];
  for (let y = nowBE; y >= nowBE - 120; y--) years.push(y);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  function update(d, mo, be) {
    if (d && mo && be) {
      const ce = parseInt(be, 10) - 543;
      const isoNew = `${ce}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      setForm({ ...form, birth_date: isoNew, age: calcAge(isoNew) });
    } else {
      setForm({ ...form, birth_date: "", age: "" });
    }
  }

  const sel = { ...inp, flex: 1, minWidth: 0 };

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select value={dd} onChange={e => update(e.target.value, mm, beYear)} style={sel}>
        <option value="">วัน</option>
        {days.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={mm} onChange={e => update(dd, e.target.value, beYear)} style={{ ...sel, flex: 1.6 }}>
        <option value="">เดือน</option>
        {TH_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </select>
      <select value={beYear} onChange={e => update(dd, mm, e.target.value)} style={{ ...sel, flex: 1.2 }}>
        <option value="">ปี (พ.ศ.)</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <input value={form.age} readOnly placeholder="อายุ" style={{ ...inp, width: 60, textAlign: "center", background: "#f9fafb" }} />
      <span style={{ alignSelf: "center", fontSize: 12, color: "#6b7280" }}>ปี</span>
    </div>
  );
}
