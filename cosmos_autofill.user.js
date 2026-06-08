// ==UserScript==
// @name         ป.เปา: ขายปลีก → Cosmos (ตรวจสอบประวัติ + สมัครสมาชิก)
// @namespace    papao-motor
// @version      1.1
// @description  ดึงข้อมูลลูกค้า/รถ จากหน้าขายปลีก (plate-app) เติมอัตโนมัติในหน้า Cosmos ตรวจสอบประวัติ + สมัครโครงการสมาชิก (ที่อยู่ + จังหวัด/อำเภอ cascade)
// @author       ป.เปา
// @match        https://plate-app-y1z1.onrender.com/*
// @match        http://localhost:5173/*
// @match        https://siamcosmos.net/pg_Main/CheckMember.aspx*
// @match        https://siamcosmos.net/pg_Main/Member_AE.aspx*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";
  const KEY = "papao_cosmos_customer";
  const PENDING = "papao_member_pending";
  const host = location.hostname;

  // ============ ฝั่งขายปลีก (plate-app): จับข้อมูลลูกค้า+รถ เก็บไว้ ============
  if (host.indexOf("plate-app") >= 0 || host.indexOf("localhost") >= 0) {
    let last = "";
    setInterval(function () {
      const el = document.getElementById("retail-cosmos");
      if (!el) return;
      const d = {
        fullname: el.dataset.fullname || "", idcard: el.dataset.idcard || "", code: el.dataset.code || "",
        address: el.dataset.address || "", phone: el.dataset.phone || "", birthdate: el.dataset.birthdate || "",
        gender: el.dataset.gender || "", price: el.dataset.price || "", chassis: el.dataset.chassis || "",
        engine: el.dataset.engine || "", model: el.dataset.model || "", color: el.dataset.color || "",
      };
      const sig = JSON.stringify(d);
      if (d.fullname && sig !== last) { last = sig; GM_setValue(KEY, d); toast("📋 เก็บข้อมูล “" + d.fullname + "” ไว้ส่ง Cosmos แล้ว"); }
    }, 1500);
    return;
  }
  if (host.indexOf("siamcosmos") < 0) return;

  // ============ ฝั่ง Cosmos ============
  const path = location.pathname;
  const isCheck = /CheckMember\.aspx/i.test(path);
  const isMember = /Member_AE\.aspx/i.test(path);

  // สร้าง/คงปุ่มไว้ — เช็คซ้ำทุก 1.5 วิ กันปุ่มหายตอนหน้า re-render/postback
  function ensureButton() {
    try {
      if (isMember) addButton("📋 เติมข้อมูล จากขายปลีก", "#2e7d32", fillMemberAddress);
      else if (isCheck) addButton("📋 เติมจากขายปลีก", "#1565c0", fillCheckMember);
    } catch (e) { console.error("[papao] addButton error", e); }
  }
  ensureButton();
  setInterval(ensureButton, 1500);

  if (isMember) {
    // resume หลัง postback (เลือกจังหวัดแล้ว reload → มาเลือกอำเภอ + ย้ำ text)
    const pend = sessionStorage.getItem(PENDING);
    if (pend) {
      let d; try { d = JSON.parse(pend); } catch (e) { d = null; }
      if (d) setTimeout(function () {
        applyMember(d);          // ย้ำ text + เบอร์ + วันเกิด + เพศ (เผื่อ postback ล้าง)
        selectAmphur(d, 0);      // เลือกอำเภอ (รอโหลดถ้ายังไม่มา)
        sessionStorage.removeItem(PENDING);
        toast("✅ เติมข้อมูลครบแล้ว — ตรวจ อำเภอ/วันเกิด อีกครั้ง");
      }, 900);
    }
  }

  // ----- หน้า CheckMember: ชื่อ/นามสกุล/เลขบัตร -----
  function fillCheckMember() {
    const r = GM_getValue(KEY, null);
    if (!r || !r.fullname) return noData();
    const p = parseName(r.fullname);
    setText("MainContent_txt_user_firstname", p.first);
    setText("MainContent_txt_user_lastname", p.last);
    setText("MainContent_txt_IDCard", digits(r.idcard));
    setSelVal("MainContent_ddl_CustomerType", "1");
    if (p.prefix) setSelText("MainContent_ddl_Prefix", p.prefix);
    alert("เติมแล้ว ✓\n" + (p.prefix ? p.prefix + " " : "") + p.first + " " + p.last + "\nเลขบัตร: " + (r.idcard || "-") + "\n\n⚠️ ตรวจ คำนำหน้า/ประเภทลูกค้า ก่อนกดตรวจสอบ");
  }

  // ----- หน้า Member_AE: ที่อยู่ + เบอร์ + วันเกิด + เพศ (cascade จังหวัด→อำเภอ) -----
  function fillMemberAddress() {
    const r = GM_getValue(KEY, null);
    if (!r) return noData();
    const a = parseAddr(r.address || "");
    a.phone = r.phone || ""; a.birthdate = r.birthdate || ""; a.gender = r.gender || "";
    a.price = r.price || ""; a.chassis = r.chassis || ""; a.engine = r.engine || "";
    applyMember(a);

    const prov = document.getElementById("ctl00_MainContent_ddl_Province");
    const pm = matchOpt(prov, a.province);
    if (pm && prov.value !== pm.value) {
      sessionStorage.setItem(PENDING, JSON.stringify(a)); // จำไว้ ไป fill อำเภอ/ย้ำข้อมูลหลัง reload
      prov.value = pm.value;
      toast("⏳ เลือกจังหวัด “" + pm.text.trim() + "” กำลังโหลดอำเภอ…");
      prov.dispatchEvent(new Event("change", { bubbles: true })); // ⚡ postback → reload
      return;
    }
    selectAmphur(a, 0);
    alert("เติมข้อมูลแล้ว ✓\nที่อยู่: " + a.line + " ต." + a.subdistrict + " อ." + a.district + " จ." + a.province + " " + a.zip +
      "\nเบอร์: " + (a.phone || "-") + " | วันเกิด: " + (a.birthdate || "-") +
      "\nราคาขาย: " + (a.price || "-") +
      "\nเลขถัง(9ท้าย): " + (a.chassis ? String(a.chassis).replace(/[^A-Za-z0-9]/g, "").slice(-9) : "-") +
      " | เลขเครื่อง(หลังขีด): " + (a.engine && a.engine.indexOf("-") >= 0 ? a.engine.split("-").slice(1).join("") : (a.engine || "-")) +
      "\n\n⚠️ เลือก รุ่น/ประเภท/สี + prefix เลขถัง/เครื่อง เอง (cascade) แล้วตรวจ serial");
  }

  // เติม text + เบอร์ + วันเกิด + เพศ (ส่วนที่ไม่ใช่ cascade)
  function applyMember(a) {
    setText("ctl00_MainContent_txt_Address", a.line);
    setText("ctl00_MainContent_txt_District", a.subdistrict); // ตำบล = text
    setText("ctl00_MainContent_txt_ZipCode", a.zip);
    if (a.phone) setText("ctl00_MainContent_txt_Telephone", String(a.phone).replace(/[^0-9]/g, ""));
    if (a.gender) setSelText("ctl00_MainContent_ddL_Gender", a.gender);
    fillBirth(a.birthdate);
    // ข้อมูลรถ + ราคา (text พิมพ์ได้ตรงๆ — dropdown prefix เลือกตามรุ่นเอง)
    if (a.price) setText("ctl00_MainContent_txt_Sell_Price", String(a.price).replace(/[^0-9.]/g, ""));
    // เลขถัง serial = 9 ตัวท้าย (ตัด prefix ที่อยู่ใน dropdown)
    if (a.chassis) setText("ctl00_MainContent_txt_ChassisSerial", String(a.chassis).replace(/[^A-Za-z0-9]/g, "").slice(-9));
    // เลขเครื่อง serial = หลังขีด (เลขล้วน)
    if (a.engine) { const ep = String(a.engine).split("-"); setText("ctl00_MainContent_txt_EngineSerial", (ep.length > 1 ? ep.slice(1).join("") : ep[0]).replace(/[^0-9]/g, "")); }
  }

  // วันเกิด: iso "YYYY-MM-DD" (ค.ศ.) -> วัน/เดือน/ปี(พ.ศ.) — ตั้ง value ไม่ยิง postback
  function fillBirth(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return;
    const p = iso.slice(0, 10).split("-").map(Number);
    const y = p[0], m = p[1], d = p[2], be = y + 543;
    const TH = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    selByNum("ctl00_MainContent_ddl_day_BD", d);
    selMonth("ctl00_MainContent_ddl_month_BD", m, TH[m]);
    selByNum("ctl00_MainContent_ddl_year_BD", be) || selByNum("ctl00_MainContent_ddl_year_BD", y);
  }
  function selByNum(id, n) {
    const e = el(id); if (!e) return false;
    for (let i = 0; i < e.options.length; i++) { const o = e.options[i]; if (parseInt(o.value, 10) === n || parseInt(o.text, 10) === n) { e.value = o.value; return true; } }
    return false;
  }
  function selMonth(id, n, name) {
    const e = el(id); if (!e) return;
    for (let i = 0; i < e.options.length; i++) { if (parseInt(e.options[i].value, 10) === n) { e.value = e.options[i].value; return; } }
    for (let i = 0; i < e.options.length; i++) { if (name && e.options[i].text.indexOf(name) >= 0) { e.value = e.options[i].value; return; } }
    selByNum(id, n);
  }

  function selectAmphur(a, tries) {
    const amp = document.getElementById("ctl00_MainContent_ddl_Amphur");
    if (!amp) return;
    const m = matchOpt(amp, a.district);
    if (m) { amp.value = m.value; toast("✅ เลือกอำเภอ: " + m.text.trim()); return; }
    if (tries < 12) setTimeout(function () { selectAmphur(a, tries + 1); }, 500); // ยังไม่ match -> รอโหลด/ลองใหม่
  }

  // ----- parsers -----
  function parseName(full) {
    const PRE = ["นางสาว", "เด็กชาย", "เด็กหญิง", "ด.ช.", "ด.ญ.", "นาง", "นาย", "น.ส."];
    let name = String(full || "").trim(), prefix = "";
    for (let i = 0; i < PRE.length; i++) { if (name.indexOf(PRE[i]) === 0) { prefix = PRE[i]; name = name.slice(PRE[i].length).trim(); break; } }
    const parts = name.split(/\s+/).filter(Boolean);
    return { prefix: prefix, first: parts.shift() || "", last: parts.join(" ") };
  }
  function parseAddr(s) {
    s = String(s || "").trim();
    const zip = (s.match(/(\d{5})(?!\d)/) || [])[1] || "";
    let rest = s.replace(/(\d{5})(?!\d)/, "").trim();
    let m;
    let province = "";
    m = rest.match(/(?:จ\.|จังหวัด)\s*([^\s]+)/); if (m) province = m[1];
    else if (rest.indexOf("กรุงเทพ") >= 0) province = "กรุงเทพมหานคร";
    let district = ""; m = rest.match(/(?:อ\.|อำเภอ|เขต)\s*([^\s]+)/); if (m) district = m[1];
    let subdistrict = ""; m = rest.match(/(?:ต\.|ตำบล|แขวง)\s*([^\s]+)/); if (m) subdistrict = m[1];
    let line = rest.split(/ต\.|ตำบล|แขวง/)[0].trim();
    return { line: line, subdistrict: subdistrict, district: district, province: province, zip: zip };
  }

  // ----- helpers -----
  function el(id) { return document.getElementById(id); }
  function setText(id, v) { const e = el(id); if (!e) return; e.value = v == null ? "" : v; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }
  function setIfEmpty(id, v) { const e = el(id); if (e && !String(e.value || "").trim()) setText(id, v); }
  function setSelVal(id, val) { const e = el(id); if (e) e.value = val; } // ไม่ยิง change กัน autopostback
  function setSelText(id, txt) { const e = el(id); if (!e) return; const m = matchOpt(e, txt); if (m) e.value = m.value; }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function nrm(s) { return String(s || "").replace(/\s|\./g, "").replace(/^(จังหวัด|อำเภอ|ตำบล|แขวง|เขต|จ|อ|ต)/, ""); }
  function matchOpt(sel, name) {
    if (!sel || !name) return null;
    const n = nrm(name); let best = null;
    for (let i = 0; i < sel.options.length; i++) {
      const o = sel.options[i], t = nrm(o.text); if (!t) continue;
      if (t === n) return o;
      if ((t.indexOf(n) >= 0 || n.indexOf(t) >= 0) && !best) best = o;
    }
    return best;
  }
  function noData() { alert("ยังไม่มีข้อมูล\n→ เปิดหน้า “ขายปลีก” ที่มีลูกค้าก่อน (รอ 1-2 วิ) แล้วกลับมากดใหม่"); }
  function addButton(label, color, fn) {
    if (document.getElementById("papao-fill-btn")) return;
    const b = document.createElement("button");
    b.id = "papao-fill-btn"; b.type = "button"; b.textContent = label;
    css(b, { position: "fixed", right: "18px", bottom: "18px", zIndex: 999999, padding: "12px 18px", background: color, color: "#fff", border: "none", borderRadius: "8px", fontSize: "15px", cursor: "pointer", fontFamily: "Tahoma", boxShadow: "0 2px 10px rgba(0,0,0,.35)" });
    b.onclick = fn; document.body.appendChild(b);
  }
  function css(e, s) { for (const k in s) e.style[k] = s[k]; }
  function toast(msg) {
    let t = document.getElementById("papao-toast");
    if (!t) { t = document.createElement("div"); t.id = "papao-toast"; css(t, { position: "fixed", right: "18px", bottom: "70px", zIndex: 999999, padding: "10px 16px", background: "#37474f", color: "#fff", borderRadius: "8px", fontFamily: "Tahoma", fontSize: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.35)", transition: "opacity .4s", maxWidth: "320px" }); document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = "1"; clearTimeout(t._h); t._h = setTimeout(function () { t.style.opacity = "0"; }, 3000);
  }
})();
