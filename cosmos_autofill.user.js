// ==UserScript==
// @name         ป.เปา: ขายปลีก → Cosmos ตรวจสอบประวัติลูกค้า
// @namespace    papao-motor
// @version      1.0
// @description  ดึง ชื่อ/นามสกุล/เลขบัตร จากหน้าขายปลีก (plate-app) แล้วเติมอัตโนมัติในหน้า Cosmos "ตรวจสอบประวัติลูกค้า"
// @author       ป.เปา
// @match        https://plate-app-y1z1.onrender.com/*
// @match        http://localhost:5173/*
// @match        https://siamcosmos.net/pg_Main/CheckMember.aspx*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";
  const KEY = "papao_cosmos_customer";
  const host = location.hostname;

  // ============ ฝั่งขายปลีก (plate-app): จับข้อมูลลูกค้าที่กำลังเปิดอยู่เก็บไว้ ============
  if (host.indexOf("plate-app") >= 0 || host.indexOf("localhost") >= 0) {
    let last = "";
    setInterval(function () {
      const el = document.getElementById("retail-cosmos");
      if (!el) return;
      const data = {
        fullname: el.dataset.fullname || "",
        idcard: el.dataset.idcard || "",
        code: el.dataset.code || "",
      };
      const sig = JSON.stringify(data);
      if (data.fullname && sig !== last) {
        last = sig;
        GM_setValue(KEY, data);
        toast("📋 เก็บข้อมูล “" + data.fullname + "” ไว้ส่ง Cosmos แล้ว");
      }
    }, 1500);
    return;
  }

  // ============ ฝั่ง Cosmos: ปุ่มเติมข้อมูลลงฟอร์ม ============
  if (host.indexOf("siamcosmos") >= 0) {
    addButton();
  }

  function addButton() {
    if (document.getElementById("papao-fill-btn")) return;
    const b = document.createElement("button");
    b.id = "papao-fill-btn";
    b.type = "button";
    b.textContent = "📋 เติมจากขายปลีก";
    style(b, {
      position: "fixed", right: "18px", bottom: "18px", zIndex: 999999,
      padding: "12px 18px", background: "#1565c0", color: "#fff", border: "none",
      borderRadius: "8px", fontSize: "15px", cursor: "pointer", fontFamily: "Tahoma",
      boxShadow: "0 2px 10px rgba(0,0,0,.35)",
    });
    b.onclick = fillForm;
    document.body.appendChild(b);
  }

  function fillForm() {
    const d = GM_getValue(KEY, null);
    if (!d || !d.fullname) {
      alert("ยังไม่มีข้อมูล\n→ เปิดหน้า “ขายปลีก” ที่มีลูกค้าก่อน (รอ 1-2 วินาที) แล้วกลับมากดปุ่มนี้ใหม่");
      return;
    }
    // แยก คำนำหน้า + ชื่อ + นามสกุล จากชื่อเต็ม
    const PREFIXES = ["นางสาว", "เด็กชาย", "เด็กหญิง", "ด.ช.", "ด.ญ.", "นาง", "นาย", "น.ส."];
    let name = String(d.fullname || "").trim();
    let prefix = "";
    for (let i = 0; i < PREFIXES.length; i++) {
      if (name.indexOf(PREFIXES[i]) === 0) { prefix = PREFIXES[i]; name = name.slice(PREFIXES[i].length).trim(); break; }
    }
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts.shift() || "";
    const last = parts.join(" ");

    setText("MainContent_txt_user_firstname", first);
    setText("MainContent_txt_user_lastname", last);
    setText("MainContent_txt_IDCard", String(d.idcard || "").replace(/\D/g, ""));
    // ประเภทลูกค้า: ตั้งเป็น "ในประเทศ" (1) เป็นค่าเริ่มต้น — ไม่ยิง postback
    setSelectValue("MainContent_ddl_CustomerType", "1");
    // คำนำหน้า: match ตามข้อความ (ถ้าชื่อมีคำนำหน้า)
    if (prefix) setSelectByText("MainContent_ddl_Prefix", prefix);

    alert(
      "เติมข้อมูลแล้ว ✓\n" +
      "คำนำหน้า: " + (prefix || "(ไม่พบ — เลือกเอง)") + "\n" +
      "ชื่อ: " + first + "\nนามสกุล: " + last + "\n" +
      "เลขบัตร: " + (d.idcard || "(ไม่มี)") + "\n\n" +
      "⚠️ ตรวจ คำนำหน้า / ประเภทลูกค้า ให้ถูกก่อนกด “ตรวจสอบ”"
    );
  }

  // ----- helpers -----
  function setText(id, v) {
    const e = document.getElementById(id);
    if (!e) return;
    e.value = v;
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }
  // ตั้งค่า select โดยไม่ยิง change → กัน ASP.NET AutoPostBack ไม่ให้ refresh ลบค่าที่เพิ่งเติม
  function setSelectValue(id, val) {
    const e = document.getElementById(id);
    if (e) e.value = val;
  }
  function setSelectByText(id, txt) {
    const e = document.getElementById(id);
    if (!e) return;
    const norm = (s) => String(s).replace(/\s|\./g, "");
    for (let i = 0; i < e.options.length; i++) {
      const o = e.options[i];
      if (norm(o.text) === norm(txt) || o.text.indexOf(txt) >= 0) { e.value = o.value; return; }
    }
  }
  function style(el, s) { for (const k in s) el.style[k] = s[k]; }
  function toast(msg) {
    let t = document.getElementById("papao-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "papao-toast";
      style(t, {
        position: "fixed", right: "18px", bottom: "18px", zIndex: 999999, padding: "10px 16px",
        background: "#2e7d32", color: "#fff", borderRadius: "8px", fontFamily: "Tahoma",
        fontSize: "14px", boxShadow: "0 2px 10px rgba(0,0,0,.35)", transition: "opacity .4s",
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.style.opacity = "0"; }, 2500);
  }
})();
