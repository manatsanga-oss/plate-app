// ==UserScript==
// @name         DMS Autofill จากเลข QR ใบเสร็จ (Yamaha DMS3)
// @namespace    plate-app.receipt
// @version      0.3
// @description  ดึงข้อมูลลูกค้าจากเลขอ้างอิง (RC-...) มาเติมฟอร์มเพิ่มข้อมูลลูกค้าใน Yamaha DMS
// @match        https://dms3.yamaha-motor.co.th/DMS3/Master/Customer*
// @grant        GM_xmlhttpRequest
// @connect      n8n-new-project-gwf2.onrender.com
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";
  const RECEIPT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/receipt-requests-api";
  const log = (...a) => console.log("[DMS-Autofill]", ...a);

  function setText(id, val) {
    if (val == null || val === "") return false;
    const el = document.getElementById(id) || document.querySelector('[name="' + id + '"]');
    if (!el) { log("ไม่พบช่อง:", id); return false; }
    el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }

  function clickRadio(id) {
    const el = document.getElementById(id);
    if (!el) { log("ไม่พบ radio:", id); return false; }
    el.checked = true;
    el.click();
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // YYYY-MM-DD -> dd/mm/yyyy(พ.ศ.)
  function toBuddhistDMY(iso) {
    const m = String(iso || "").match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    return m[3] + "/" + m[2] + "/" + (parseInt(m[1], 10) + 543);
  }

  function parseAddr(addr) {
    addr = (addr || "").trim();
    const zip = (addr.match(/(\d{5})(?!.*\d)/) || [])[1] || "";
    const bkk = /กรุงเทพ/.test(addr);
    let line = addr, prov = "", amp = "", tam = "";
    if (bkk) {
      tam = (addr.match(/แขวง(\S+)/) || [])[1] || "";
      amp = (addr.match(/เขต(\S+)/) || [])[1] || "";
      prov = "กรุงเทพมหานคร";
      line = addr.split(/\s*แขวง/)[0].trim();
    } else {
      tam = (addr.match(/ต\.(\S+)/) || [])[1] || "";
      amp = (addr.match(/อ\.(\S+)/) || [])[1] || "";
      prov = (addr.match(/จ\.(\S+)/) || [])[1] || "";
      line = addr.split(/\s*ต\./)[0].trim();
    }
    prov = prov.replace(/\d{5}$/, "").trim();
    return { line, tam, amp, prov, zip };
  }

  function fetchByRef(ref) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST", url: RECEIPT_API,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ action: "get_request", ref_no: ref }),
        onload: (r) => { try { const d = JSON.parse(r.responseText || "{}"); resolve(Array.isArray(d) ? d[0] : d); } catch (e) { reject(e); } },
        onerror: reject,
      });
    });
  }

  function fillTextFields(row) {
    const sp = (row.customer_name || "").trim().split(/\s+/);
    const first = sp.shift() || "";
    const last = sp.join(" ");
    const a = parseAddr(row.address);
    const birth = toBuddhistDMY(row.birth_date);
    log("parsed:", first, last, a, "gender:", row.gender, "birth:", birth);
    setText("txtMCM_FIRST_NAME", first);
    setText("txtMCM_FAMILY_NAME", last);
    if (row.tax_id) setText("txtMCM_ID_CARD_NO", row.tax_id);
    if (row.phone) setText("txtMCM_MOBILE", row.phone);
    setText("txtMCM_ADDR", a.line);
    if (a.zip) setText("txtMCM_ZIP", a.zip);
    // เพศ
    if (row.gender === "ชาย") clickRadio("rbSex_0");
    else if (row.gender === "หญิง") clickRadio("rbSex_1");
    // วันเกิด (dd/mm/yyyy พ.ศ.)
    if (birth) setText("dpMCM_BIRTH_DATE", birth);
    return { first, last, gender: row.gender || "", birth, ...a };
  }

  function buildPanel() {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:999999;background:#fff;border:2px solid #06C755;border-radius:10px;padding:10px 12px;box-shadow:0 4px 16px rgba(0,0,0,.25);font-family:sans-serif;width:280px";
    box.innerHTML =
      '<div style="font-weight:700;color:#06934a;margin-bottom:6px">ดึงข้อมูลลูกค้าจาก QR</div>' +
      '<input id="dmsRef" placeholder="RC-20260601-0002" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid #ccc;border-radius:6px;font-size:13px"/>' +
      '<button id="dmsGo" style="width:100%;margin-top:6px;padding:8px;background:#06C755;color:#fff;border:0;border-radius:6px;font-weight:700;cursor:pointer">ดึง + เติมฟอร์ม</button>' +
      '<div id="dmsStatus" style="font-size:13px;color:#333;margin-top:8px"></div>';
    document.body.appendChild(box);
    const ref = box.querySelector("#dmsRef"), go = box.querySelector("#dmsGo"), st = box.querySelector("#dmsStatus");
    const setMsg = (h) => { st.innerHTML = h; };
    const pickRow = (label, val) => '<div style="background:#fffaeb;border:1px solid #fde68a;border-radius:6px;padding:4px 8px;margin-top:4px"><b>' + label + ':</b> ' + (val || "-") + '</div>';
    async function run() {
      const r = ref.value.trim();
      if (!r) { setMsg("กรอกเลขอ้างอิงก่อน"); return; }
      setMsg("กำลังดึงข้อมูล…");
      try {
        const row = await fetchByRef(r);
        if (!row || !row.ref_no) { setMsg("❌ ไม่พบเลขอ้างอิงนี้"); return; }
        if (row.status === "pending") { setMsg("⏳ ลูกค้ายังไม่ได้กรอกข้อมูล"); return; }
        const d = fillTextFields(row);
        setMsg('<div style="color:#067647;font-weight:700;margin-bottom:4px">✅ เติมช่องข้อความแล้ว</div>' +
          '<div style="font-size:12px;color:#b54708">👉 เลือก 3 ช่องนี้เอง:</div>' +
          pickRow("จังหวัด", d.prov) + pickRow("อำเภอ", d.amp) + pickRow("ตำบล", d.tam) +
          '<div style="font-size:12px;color:#555;margin-top:6px">📮 ' + (d.zip || "-") + ' · ' + d.first + ' ' + d.last +
          (d.gender ? ' · เพศ ' + d.gender : '') + (d.birth ? ' · เกิด ' + d.birth : '') + '</div>');
      } catch (e) { setMsg("❌ ผิดพลาด: " + (e.message || e)); log(e); }
    }
    go.addEventListener("click", run);
    ref.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildPanel);
  else buildPanel();
})();
