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
        address: el.dataset.address || "", chassis: el.dataset.chassis || "", engine: el.dataset.engine || "",
        model: el.dataset.model || "", color: el.dataset.color || "",
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
      if (isMember) addButton("📋 เติมที่อยู่ จากขายปลีก", "#2e7d32", fillMemberAddress);
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
        setIfEmpty("ctl00_MainContent_txt_Address", d.line);
        setIfEmpty("ctl00_MainContent_txt_District", d.subdistrict);
        setIfEmpty("ctl00_MainContent_txt_ZipCode", d.zip);
        selectAmphur(d, 0);
        sessionStorage.removeItem(PENDING);
        toast("✅ เติมที่อยู่ครบแล้ว — ตรวจ อำเภอ/จังหวัด อีกครั้ง");
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

  // ----- หน้า Member_AE: ที่อยู่ (cascade จังหวัด→อำเภอ) -----
  function fillMemberAddress() {
    const r = GM_getValue(KEY, null);
    if (!r) return noData();
    if (!r.address) { alert("ใบขายนี้ไม่มีข้อมูลที่อยู่ลูกค้า\n(ลูกค้าต้องเลือกจากระบบ/QR ที่มีที่อยู่)"); return; }
    const a = parseAddr(r.address);
    a.line = a.line; // เผื่อ debug
    setText("ctl00_MainContent_txt_Address", a.line);
    setText("ctl00_MainContent_txt_District", a.subdistrict); // ตำบล = text
    setText("ctl00_MainContent_txt_ZipCode", a.zip);

    const prov = document.getElementById("ctl00_MainContent_ddl_Province");
    const pm = matchOpt(prov, a.province);
    if (pm && prov.value !== pm.value) {
      sessionStorage.setItem(PENDING, JSON.stringify(a)); // จำไว้ ไป fill อำเภอหลัง reload
      prov.value = pm.value;
      toast("⏳ เลือกจังหวัด “" + pm.text.trim() + "” กำลังโหลดอำเภอ…");
      prov.dispatchEvent(new Event("change", { bubbles: true })); // ⚡ postback → reload
      return;
    }
    // จังหวัดถูกอยู่แล้ว → เลือกอำเภอเลย
    selectAmphur(a, 0);
    alert("เติมที่อยู่แล้ว ✓\nที่อยู่: " + a.line + "\nตำบล: " + a.subdistrict + "\nอำเภอ: " + a.district + "\nจังหวัด: " + a.province + "\nไปรษณีย์: " + a.zip + "\n\n⚠️ ตรวจ อำเภอ/จังหวัด + กรอกเบอร์ติดต่อเอง");
  }

  function selectAmphur(a, tries) {
    const amp = document.getElementById("ctl00_MainContent_ddl_Amphur");
    if (!amp) return;
    const m = matchOpt(amp, a.district);
    if (m) { amp.value = m.value; return; }
    if (amp.options.length <= 1 && tries < 10) { setTimeout(function () { selectAmphur(a, tries + 1); }, 500); }
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
