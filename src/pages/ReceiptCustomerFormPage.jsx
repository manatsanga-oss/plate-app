import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// หน้าฟอร์มลูกค้า (เปิดผ่าน LINE LIFF) — ลูกค้าสแกน QR จากพนักงานแล้วมากรอกที่นี่
// หน้านี้ "ไม่ผ่าน login" — ถูกเรียกตรงจาก App.jsx เมื่อ path = /receipt-form
// รองรับ 3 ภาษา: ไทย / English / မြန်မာ
// ============================================================================
const LIFF_ID = "2010078995-B6jJD1OK";
const RECEIPT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/receipt-requests-api";
const LIFF_SDK_URL = "https://static.line-scdn.net/liff/edge/2/sdk.js";
// ข้อมูลที่อยู่ไทย (จังหวัด/อำเภอ/ตำบล + รหัสไปรษณีย์) — โหลดจาก CDN (gzip)
const GEO_URL = "https://cdn.jsdelivr.net/gh/kongvut/thai-province-data@master/api/latest/province_with_district_and_sub_district.json";

const text = (v) => (v ?? "").toString().trim();

// ---- คำแปล 3 ภาษา ----------------------------------------------------------
const T = {
  th: {
    langName: "ไทย",
    title: "กรอกข้อมูลเพื่อออกใบเสร็จ", ref: "เลขอ้างอิง", connecting: "กำลังเชื่อมต่อ LINE…",
    doneTitle: "ส่งข้อมูลเรียบร้อยแล้ว", doneDescPre: "กรุณาแจ้งเลขอ้างอิง", doneDescPost: "กับพนักงานเพื่อรับใบเสร็จ",
    name: "ชื่อ-นามสกุล / ชื่อบริษัท", namePh: "เช่น นายสมชาย ใจดี",
    phone: "เบอร์โทรศัพท์", phonePh: "08x-xxx-xxxx",
    houseLine: "บ้านเลขที่ / หมู่ / ถนน", houseLinePh: "เช่น 189-191 หมู่ 7 ถ.พหลโยธิน",
    province: "จังหวัด", amphoe: "อำเภอ", tambon: "ตำบล", khet: "เขต", khwaeng: "แขวง",
    zip: "รหัสไปรษณีย์", zipPh: "เลือกตำบลแล้วเติมให้อัตโนมัติ",
    taxId: "เลขประจำตัวผู้เสียภาษี (ถ้ามี)", taxIdPh: "13 หลัก (กรณีนิติบุคคล)",
    addrManual: "ที่อยู่", addrManualPh: "บ้านเลขที่ / ถนน / ตำบล / อำเภอ / จังหวัด / รหัสไปรษณีย์",
    selSelect: "— เลือก —", selLoading: "กำลังโหลด…", firstProvince: "เลือกจังหวัดก่อน", firstDistrict: "เลือกอำเภอก่อน",
    submit: "ส่งข้อมูล", submitting: "กำลังส่ง…",
    errName: "กรุณากรอกชื่อ-นามสกุล", errPhone: "กรุณากรอกเบอร์โทรศัพท์",
    errHouse: "กรุณากรอกบ้านเลขที่ / หมู่ / ถนน", errAddr: "กรุณาเลือกจังหวัด / อำเภอ / ตำบล ให้ครบ",
    errRef: "ไม่พบเลขอ้างอิง — กรุณาสแกน QR ใหม่อีกครั้ง", errSubmit: "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  },
  en: {
    langName: "EN",
    title: "Fill in details for receipt", ref: "Ref", connecting: "Connecting to LINE…",
    doneTitle: "Submitted successfully", doneDescPre: "Please show ref", doneDescPost: "to our staff to get your receipt",
    name: "Full name / Company", namePh: "e.g. John Smith",
    phone: "Phone number", phonePh: "08x-xxx-xxxx",
    houseLine: "House no. / Moo / Road", houseLinePh: "e.g. 189-191 Moo 7 Phahonyothin Rd.",
    province: "Province", amphoe: "District", tambon: "Subdistrict", khet: "District", khwaeng: "Subdistrict",
    zip: "Postal code", zipPh: "Auto-filled after selecting subdistrict",
    taxId: "Tax ID (if any)", taxIdPh: "13 digits (for companies)",
    addrManual: "Address", addrManualPh: "House no. / Road / Subdistrict / District / Province / Postal code",
    selSelect: "— Select —", selLoading: "Loading…", firstProvince: "Select province first", firstDistrict: "Select district first",
    submit: "Submit", submitting: "Submitting…",
    errName: "Please enter your name", errPhone: "Please enter your phone number",
    errHouse: "Please enter house no. / Moo / Road", errAddr: "Please select Province / District / Subdistrict",
    errRef: "Reference not found — please scan the QR again", errSubmit: "Submit failed, please try again",
  },
  my: {
    langName: "မြန်မာ",
    title: "ပြေစာထုတ်ရန် အချက်အလက်ဖြည့်ပါ", ref: "ကိုးကားနံပါတ်", connecting: "LINE နှင့် ချိတ်ဆက်နေသည်…",
    doneTitle: "အချက်အလက် ပေးပို့ပြီးပါပြီ", doneDescPre: "ပြေစာရယူရန် ဝန်ထမ်းအား ကိုးကားနံပါတ်", doneDescPost: "ကို ပြသပါ",
    name: "အမည် / ကုမ္ပဏီအမည်", namePh: "ဥပမာ - John Smith",
    phone: "ဖုန်းနံပါတ်", phonePh: "08x-xxx-xxxx",
    houseLine: "အိမ်အမှတ် / ရပ်ကွက် / လမ်း", houseLinePh: "ဥပမာ - 189-191 Moo 7 Phahonyothin Rd.",
    province: "ခရိုင် (จังหวัด)", amphoe: "မြို့နယ် (อำเภอ)", tambon: "ကျေးရွာအုပ်စု (ตำบล)", khet: "မြို့နယ်", khwaeng: "ရပ်ကွက်",
    zip: "စာတိုက်ကုဒ်", zipPh: "ကျေးရွာအုပ်စုရွေးပြီးပါက အလိုအလျောက်ဖြည့်မည်",
    taxId: "အခွန်ထမ်းနံပါတ် (ရှိလျှင်)", taxIdPh: "ဂဏန်း ၁၃ လုံး (ကုမ္ပဏီအတွက်)",
    addrManual: "လိပ်စာ", addrManualPh: "အိမ်အမှတ် / လမ်း / ตำบล / อำเภอ / จังหวัด / စာတိုက်ကုဒ်",
    selSelect: "— ရွေးချယ်ပါ —", selLoading: "ဖွင့်နေသည်…", firstProvince: "ခရိုင်အရင်ရွေးပါ", firstDistrict: "မြို့နယ်အရင်ရွေးပါ",
    submit: "ပေးပို့မည်", submitting: "ပေးပို့နေသည်…",
    errName: "အမည်ဖြည့်ပါ", errPhone: "ဖုန်းနံပါတ်ဖြည့်ပါ",
    errHouse: "အိမ်အမှတ် / ရပ်ကွက် / လမ်း ဖြည့်ပါ", errAddr: "ခရိုင် / မြို့နယ် / ကျေးရွာအုပ်စု ရွေးပါ",
    errRef: "ကိုးကားနံပါတ် မတွေ့ပါ — QR ကို ပြန်စကင်ဖတ်ပါ", errSubmit: "ပေးပို့မအောင်မြင်ပါ၊ ထပ်ကြိုးစားပါ",
  },
};
const LANGS = ["th", "en", "my"];

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
  const [lang, setLang] = useState("th");
  const t = T[lang];

  const [phase, setPhase] = useState("loading"); // loading | form | submitting | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [refNo, setRefNo] = useState("");
  const [profile, setProfile] = useState(null);   // { userId, displayName }
  const [form, setForm] = useState({ customer_name: "", phone: "", tax_id: "" });

  // ที่อยู่: บ้านเลขที่/ถนน + จังหวัด/อำเภอ/ตำบล (id) + zip (auto)
  const [addr, setAddr] = useState({ line: "", provinceId: "", districtId: "", subdistrictId: "", zip: "" });
  const [provinces, setProvinces] = useState([]);
  const [geoErr, setGeoErr] = useState(false);

  // อ่าน ref จาก URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let ref = params.get("ref") || "";
    if (!ref) {
      const state = params.get("liff.state");
      if (state) {
        try { ref = new URLSearchParams(state.replace(/^\?/, "")).get("ref") || ""; } catch { /* noop */ }
      }
    }
    setRefNo(ref);
  }, []);

  // โหลดข้อมูลที่อยู่ไทย
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(GEO_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : (data?.data || []);
        list.sort((a, b) => (a.name_th || "").localeCompare(b.name_th || "", "th"));
        setProvinces(list);
      } catch (e) {
        if (cancelled) return;
        console.warn("load geo failed:", e);
        setGeoErr(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // init LIFF + ดึง profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const liff = await loadLiffSdk();
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const p = await liff.getProfile();
        if (cancelled) return;
        setProfile({ userId: p.userId, displayName: p.displayName });
        setPhase("form");
      } catch (e) {
        if (cancelled) return;
        console.warn("LIFF init failed:", e);
        setPhase("form");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const selProvince = useMemo(() => provinces.find((p) => String(p.id) === addr.provinceId) || null, [provinces, addr.provinceId]);
  const districts = useMemo(() => {
    const ds = selProvince?.districts || [];
    return [...ds].sort((a, b) => (a.name_th || "").localeCompare(b.name_th || "", "th"));
  }, [selProvince]);
  const selDistrict = useMemo(() => districts.find((d) => String(d.id) === addr.districtId) || null, [districts, addr.districtId]);
  const subdistricts = useMemo(() => {
    const ss = selDistrict?.sub_districts || [];
    return [...ss].sort((a, b) => (a.name_th || "").localeCompare(b.name_th || "", "th"));
  }, [selDistrict]);

  const isBkk = selProvince?.name_th === "กรุงเทพมหานคร";
  // ชื่อที่แสดงใน dropdown ตามภาษา (อังกฤษใช้ name_en, ที่เหลือใช้ไทย)
  const optLabel = (x) => (lang === "en" && x?.name_en) ? x.name_en : x?.name_th;
  // label ของช่อง อำเภอ/ตำบล (ไทยเท่านั้นที่แยก เขต/แขวง สำหรับ กทม.)
  const districtLabel = (lang === "th" && isBkk) ? t.khet : t.amphoe;
  const subdistrictLabel = (lang === "th" && isBkk) ? t.khwaeng : t.tambon;

  function onProvince(e) { setAddr((a) => ({ ...a, provinceId: e.target.value, districtId: "", subdistrictId: "", zip: "" })); }
  function onDistrict(e) { setAddr((a) => ({ ...a, districtId: e.target.value, subdistrictId: "", zip: "" })); }
  function onSubdistrict(e) {
    const id = e.target.value;
    const sub = subdistricts.find((s) => String(s.id) === id);
    setAddr((a) => ({ ...a, subdistrictId: id, zip: sub ? String(sub.zip_code || "") : "" }));
  }

  // ประกอบที่อยู่เป็นข้อความเดียว — บันทึกเป็น "ภาษาไทยเสมอ" เพื่อออกใบเสร็จ
  function composeAddress() {
    if (geoErr || !selProvince) return text(addr.line);
    const parts = [text(addr.line)];
    const sub = subdistricts.find((s) => String(s.id) === addr.subdistrictId);
    if (sub) parts.push((isBkk ? "แขวง" : "ต.") + sub.name_th);
    if (selDistrict) parts.push((isBkk ? "เขต" : "อ.") + selDistrict.name_th);
    parts.push((isBkk ? "" : "จ.") + selProvince.name_th);
    if (addr.zip) parts.push(addr.zip);
    return parts.filter(Boolean).join(" ");
  }

  async function handleSubmit() {
    if (!refNo) { setErrorMsg(t.errRef); return; }
    if (!text(form.customer_name)) { setErrorMsg(t.errName); return; }
    if (!text(form.phone)) { setErrorMsg(t.errPhone); return; }
    if (!geoErr) {
      if (!text(addr.line)) { setErrorMsg(t.errHouse); return; }
      if (!addr.provinceId || !addr.districtId || !addr.subdistrictId) { setErrorMsg(t.errAddr); return; }
    }
    setErrorMsg("");
    setPhase("submitting");
    try {
      const payload = {
        action: "submit_customer",
        ref_no: refNo,
        customer_name: text(form.customer_name),
        address: composeAddress(),
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
      setErrorMsg(t.errSubmit);
      setPhase("form");
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.header}>
          <div style={S.headerTop}>
            <div style={S.shopName}>{t.title}</div>
            <div style={S.langRow}>
              {LANGS.map((lc) => (
                <button key={lc} onClick={() => setLang(lc)} style={{ ...S.langBtn, ...(lang === lc ? S.langBtnActive : {}) }}>
                  {T[lc].langName}
                </button>
              ))}
            </div>
          </div>
          {refNo && <div style={S.refBadge}>{t.ref}: {refNo}</div>}
        </div>

        {phase === "loading" && <div style={S.center}>{t.connecting}</div>}

        {phase === "done" && (
          <div style={S.center}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 18, margin: "8px 0" }}>{t.doneTitle}</div>
            <div style={{ color: "#666", fontSize: 14 }}>
              {t.doneDescPre} <b>{refNo}</b> {t.doneDescPost}
            </div>
          </div>
        )}

        {(phase === "form" || phase === "submitting") && (
          <div style={S.body}>
            {profile && <div style={S.lineInfo}>LINE: {profile.displayName}</div>}

            <label style={S.label}>{t.name} *</label>
            <input style={S.input} value={form.customer_name} onChange={setField("customer_name")} placeholder={t.namePh} />

            <label style={S.label}>{t.phone} *</label>
            <input style={S.input} value={form.phone} onChange={setField("phone")} inputMode="tel" placeholder={t.phonePh} />

            {geoErr ? (
              <>
                <label style={S.label}>{t.addrManual}</label>
                <textarea style={{ ...S.input, minHeight: 80, resize: "vertical" }} value={addr.line} onChange={(e) => setAddr((a) => ({ ...a, line: e.target.value }))} placeholder={t.addrManualPh} />
              </>
            ) : (
              <>
                <label style={S.label}>{t.houseLine} *</label>
                <input style={S.input} value={addr.line} onChange={(e) => setAddr((a) => ({ ...a, line: e.target.value }))} placeholder={t.houseLinePh} />

                <label style={S.label}>{t.province} *</label>
                <select style={S.input} value={addr.provinceId} onChange={onProvince} disabled={!provinces.length}>
                  <option value="">{provinces.length ? t.selSelect : t.selLoading}</option>
                  {provinces.map((p) => <option key={p.id} value={p.id}>{optLabel(p)}</option>)}
                </select>

                <label style={S.label}>{districtLabel} *</label>
                <select style={S.input} value={addr.districtId} onChange={onDistrict} disabled={!addr.provinceId}>
                  <option value="">{addr.provinceId ? t.selSelect : t.firstProvince}</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{optLabel(d)}</option>)}
                </select>

                <label style={S.label}>{subdistrictLabel} *</label>
                <select style={S.input} value={addr.subdistrictId} onChange={onSubdistrict} disabled={!addr.districtId}>
                  <option value="">{addr.districtId ? t.selSelect : t.firstDistrict}</option>
                  {subdistricts.map((s) => <option key={s.id} value={s.id}>{optLabel(s)}</option>)}
                </select>

                <label style={S.label}>{t.zip}</label>
                <input style={{ ...S.input, background: "#f7f8fa" }} value={addr.zip} readOnly placeholder={t.zipPh} />
              </>
            )}

            <label style={S.label}>{t.taxId}</label>
            <input style={S.input} value={form.tax_id} onChange={setField("tax_id")} inputMode="numeric" placeholder={t.taxIdPh} />

            {errorMsg && <div style={S.error}>{errorMsg}</div>}

            <button style={{ ...S.submit, opacity: phase === "submitting" ? 0.6 : 1 }} disabled={phase === "submitting"} onClick={handleSubmit}>
              {phase === "submitting" ? t.submitting : t.submit}
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
  header: { background: "#06C755", color: "#fff", padding: "16px 20px" },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  shopName: { fontSize: 18, fontWeight: 700, flex: 1 },
  langRow: { display: "flex", gap: 4, flexShrink: 0 },
  langBtn: { padding: "3px 8px", fontSize: 12, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 6, cursor: "pointer" },
  langBtnActive: { background: "#fff", color: "#06934a", borderColor: "#fff" },
  refBadge: { fontSize: 13, marginTop: 8, opacity: 0.95 },
  body: { padding: 20 },
  center: { padding: "40px 20px", textAlign: "center", color: "#333" },
  lineInfo: { fontSize: 13, color: "#06934a", background: "#eafaf0", padding: "6px 10px", borderRadius: 8, marginBottom: 12 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#444", margin: "12px 0 4px" },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 15, border: "1px solid #d0d5dd", borderRadius: 8, outline: "none" },
  error: { marginTop: 12, color: "#d92d20", background: "#fef3f2", padding: "8px 12px", borderRadius: 8, fontSize: 14 },
  submit: { width: "100%", marginTop: 18, padding: "13px", fontSize: 16, fontWeight: 700, color: "#fff", background: "#06C755", border: "none", borderRadius: 10, cursor: "pointer" },
};
