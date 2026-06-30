import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// ฟิลด์ที่อยู่ไทยแบบ dropdown ต่อกัน: จังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์ (เติมอัตโนมัติ)
// เก็บค่าเป็น "ชื่อไทย" ลงใน form.addr_province / addr_district / addr_subdistrict / addr_postal_code
// props: form, setForm, Field (component), inp (style)
// ใช้ชุดข้อมูลเดียวกับหน้า LIFF ออกใบเสร็จ (kongvut/thai-province-data)
// ============================================================================
const GEO_URL = "https://cdn.jsdelivr.net/gh/kongvut/thai-province-data@master/api/latest/province_with_district_and_sub_district.json";

// cache ระดับโมดูล — โหลดครั้งเดียวต่อ session, แชร์ทุกฟอร์ม
let GEO_CACHE = null;
let GEO_PROMISE = null;
function loadGeo() {
  if (GEO_CACHE) return Promise.resolve(GEO_CACHE);
  if (GEO_PROMISE) return GEO_PROMISE;
  GEO_PROMISE = (async () => {
    const res = await fetch(GEO_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data?.data || []);
    list.sort((a, b) => (a.name_th || "").localeCompare(b.name_th || "", "th"));
    GEO_CACHE = list;
    return list;
  })();
  return GEO_PROMISE;
}

const byThai = (arr) => [...arr].sort((a, b) => (a.name_th || "").localeCompare(b.name_th || "", "th"));

// keys: ปรับชื่อ field ในฟอร์มได้ (default = addr_* ของหน้าลูกค้า)
// required: ใส่ * ท้าย label หรือไม่ (default true)
const DEFAULT_KEYS = { province: "addr_province", district: "addr_district", subdistrict: "addr_subdistrict", postal: "addr_postal_code" };

export default function ThaiAddressFields({ form, setForm, Field, inp, keys, required = true }) {
  const K = { ...DEFAULT_KEYS, ...(keys || {}) };
  const star = required ? " *" : "";
  const [provinces, setProvinces] = useState(GEO_CACHE || []);
  const [geoErr, setGeoErr] = useState(false);

  useEffect(() => {
    if (GEO_CACHE) { setProvinces(GEO_CACHE); return; }
    let cancelled = false;
    loadGeo()
      .then((list) => { if (!cancelled) setProvinces(list); })
      .catch((e) => { if (!cancelled) { console.warn("load geo failed:", e); setGeoErr(true); } });
    return () => { cancelled = true; };
  }, []);

  const selProvince = useMemo(
    () => provinces.find((p) => p.name_th === form[K.province]) || null,
    [provinces, form, K.province]
  );
  const districts = useMemo(() => byThai(selProvince?.districts || []), [selProvince]);
  const selDistrict = useMemo(
    () => districts.find((d) => d.name_th === form[K.district]) || null,
    [districts, form, K.district]
  );
  const subdistricts = useMemo(() => byThai(selDistrict?.sub_districts || []), [selDistrict]);

  const isBkk = selProvince?.name_th === "กรุงเทพมหานคร";

  // ถ้าข้อมูลเดิมไม่ตรงกับชุดข้อมูล (เคยพิมพ์มือ) ให้ยังแสดงค่าเดิมไว้ ไม่หาย
  const provNotInList = form[K.province] && !selProvince;
  const distNotInList = form[K.district] && selProvince && !selDistrict;
  const subNotInList = form[K.subdistrict] && selDistrict && !subdistricts.some((s) => s.name_th === form[K.subdistrict]);

  function onProvince(e) {
    setForm((f) => ({ ...f, [K.province]: e.target.value, [K.district]: "", [K.subdistrict]: "", [K.postal]: "" }));
  }
  function onDistrict(e) {
    setForm((f) => ({ ...f, [K.district]: e.target.value, [K.subdistrict]: "", [K.postal]: "" }));
  }
  function onSubdistrict(e) {
    const name = e.target.value;
    const sub = subdistricts.find((s) => s.name_th === name);
    setForm((f) => ({ ...f, [K.subdistrict]: name, [K.postal]: sub ? String(sub.zip_code || "") : f[K.postal] }));
  }

  // กรณีโหลดข้อมูลไม่ได้ — fallback เป็น input พิมพ์มือ (ไม่ให้ฟอร์มพัง)
  if (geoErr) {
    return (
      <>
        <Field label={"ตำบล/แขวง" + star}><input value={form[K.subdistrict]} onChange={e => setForm((f) => ({ ...f, [K.subdistrict]: e.target.value }))} style={inp} /></Field>
        <Field label={"จังหวัด" + star}><input value={form[K.province]} onChange={e => setForm((f) => ({ ...f, [K.province]: e.target.value }))} style={inp} /></Field>
        <Field label={"อำเภอ/เขต" + star}><input value={form[K.district]} onChange={e => setForm((f) => ({ ...f, [K.district]: e.target.value }))} style={inp} /></Field>
        <Field label={"รหัสไปรษณีย์" + star}><input value={form[K.postal]} onChange={e => setForm((f) => ({ ...f, [K.postal]: e.target.value }))} style={inp} /></Field>
      </>
    );
  }

  const loading = !provinces.length;

  return (
    <>
      <Field label={"จังหวัด" + star}>
        <select value={form[K.province] || ""} onChange={onProvince} style={inp} disabled={loading}>
          <option value="">{loading ? "กำลังโหลด…" : "— เลือกจังหวัด —"}</option>
          {provNotInList && <option value={form[K.province]}>{form[K.province]}</option>}
          {provinces.map((p) => <option key={p.id} value={p.name_th}>{p.name_th}</option>)}
        </select>
      </Field>
      <Field label={(isBkk ? "เขต" : "อำเภอ/เขต") + star}>
        <select value={form[K.district] || ""} onChange={onDistrict} style={inp} disabled={!form[K.province]}>
          <option value="">{form[K.province] ? "— เลือกอำเภอ/เขต —" : "เลือกจังหวัดก่อน"}</option>
          {distNotInList && <option value={form[K.district]}>{form[K.district]}</option>}
          {districts.map((d) => <option key={d.id} value={d.name_th}>{d.name_th}</option>)}
        </select>
      </Field>
      <Field label={(isBkk ? "แขวง" : "ตำบล/แขวง") + star}>
        <select value={form[K.subdistrict] || ""} onChange={onSubdistrict} style={inp} disabled={!form[K.district]}>
          <option value="">{form[K.district] ? "— เลือกตำบล/แขวง —" : "เลือกอำเภอก่อน"}</option>
          {subNotInList && <option value={form[K.subdistrict]}>{form[K.subdistrict]}</option>}
          {subdistricts.map((s) => <option key={s.id} value={s.name_th}>{s.name_th}</option>)}
        </select>
      </Field>
      <Field label={"รหัสไปรษณีย์" + star}>
        <input value={form[K.postal] || ""} onChange={e => setForm((f) => ({ ...f, [K.postal]: e.target.value }))} style={inp} placeholder="เลือกตำบลแล้วเติมอัตโนมัติ" />
      </Field>
    </>
  );
}
