// ==UserScript==
// @name         E-Policy Autofill จากเลขที่ใบขาย (rvp.co.th)
// @namespace    plate-app.retail
// @version      0.2
// @description  ดึงข้อมูลลูกค้า+รถ จากเลขที่ใบขายปลีก (SCY..-MCSA-..) มาเติมฟอร์มออกกรมธรรม์ใหม่ใน E-Policy
// @match        https://epolicy4.rvp.co.th/Policy/New*
// @match        https://epolicy4.rvp.co.th/Policy/*
// @grant        GM_xmlhttpRequest
// @connect      n8n-new-project-gwf2.onrender.com
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";
  const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
  const log = (...a) => console.log("[EPolicy-Autofill]", ...a);

  // ============ แผนที่ช่อง E-Policy (id จริง) ============
  const MAP = {
    // ลูกค้า (ผู้เอาประกัน)
    idCardNo: "CardID", firstName: "Name", lastName: "Lname",
    birthDate: "Birthdate", email: "Email", mobile: "Tel",
    addrLine: "Address", zip: "Zipcode",
    prefix: "Prefix", province: "Changwat", district: "Amphur", subdistrict: "Tumbol",
    // รถเอาประกัน
    carTankNo: "CarTankNo", marque: "MARQUE", carModel: "CarModel", carColor: "CarColor", carSize: "CarSize",
  };

  // ดึงเลขซีซีจากชื่อรุ่น เช่น "WW160" -> "160", "WAVE110" -> "110"
  function ccFromModel(name) {
    const m = String(name || "").match(/(\d{2,4})/);
    return m ? m[1] : "";
  }

  // ---------- helpers ----------
  function setText(id, val) {
    if (!id || val == null || val === "") return false;
    const el = document.getElementById(id) || document.querySelector('[name="' + id + '"]');
    if (!el) { log("ไม่พบช่อง:", id); return false; }
    el.focus(); el.value = val;
    ["input", "keyup", "change", "blur"].forEach((ev) => el.dispatchEvent(new Event(ev, { bubbles: true })));
    return true;
  }
  const norm = (s) => String(s || "").replace(/\s+/g, "").replace(/^(จังหวัด|อำเภอ|เขต|ตำบล|แขวง)/, "").trim();
  function setSelectByText(id, text) {
    if (!id || !text) return false;
    const el = document.getElementById(id);
    if (!el || el.tagName !== "SELECT") return false;
    const t = norm(text);
    let opt = [...el.options].find((o) => norm(o.text) === t);
    if (!opt) opt = [...el.options].find((o) => norm(o.text) && (norm(o.text).includes(t) || t.includes(norm(o.text))));
    if (!opt) { log("ไม่พบตัวเลือก", id, ":", text); return false; }
    el.value = opt.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  // YYYY-MM-DD -> dd/mm/yyyy(พ.ศ.) — ถ้าปีที่เก็บมาเป็น พ.ศ. อยู่แล้ว (>=2400) ไม่บวกซ้ำ
  function toBuddhistDMY(iso) {
    const m = String(iso || "").match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    let y = parseInt(m[1], 10);
    if (y < 2400) y += 543; // ค.ศ. -> พ.ศ.
    return m[3] + "/" + m[2] + "/" + y;
  }
  function buildAddrLine(c) {
    return [
      c.addr_house_no,
      c.addr_moo ? "หมู่ " + c.addr_moo : "",
      c.addr_village,
      c.addr_soi ? "ซ." + c.addr_soi : "",
      c.addr_road ? "ถ." + c.addr_road : "",
    ].filter(Boolean).join(" ");
  }

  function fetchBySaleNo(saleNo) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST", url: RETAIL_API,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ action: "get_sale", sale_no: saleNo }),
        onload: (r) => { try { const d = JSON.parse(r.responseText || "{}"); resolve(Array.isArray(d) ? d[0] : d); } catch (e) { reject(e); } },
        onerror: reject,
      });
    });
  }

  // เลือก จังหวัด -> อำเภอ -> ตำบล (cascade + AJAX)
  function fillAddressCascade(c) {
    if (!setSelectByText(MAP.province, c.addr_province)) return;
    setTimeout(() => {
      if (!setSelectByText(MAP.district, c.addr_district)) return;
      setTimeout(() => {
        setSelectByText(MAP.subdistrict, c.addr_subdistrict);
        setText(MAP.zip, c.addr_postal_code);
      }, 1000);
    }, 1000);
  }
  // เลือก ยี่ห้อ -> รุ่น (cascade) + สี(ไทย) + ขนาด CC
  function fillVehicleCascade(row) {
    setSelectByText(MAP.carColor, row.color_name_th || row.color_name);
    setText(MAP.carSize, ccFromModel(row.model_name || row.model_code));
    if (setSelectByText(MAP.marque, row.brand)) {
      setTimeout(() => { setSelectByText(MAP.carModel, row.model_name || row.model_code); }, 1000);
    }
  }

  function fillForm(row) {
    const c = row.customer || {};
    // ลูกค้า
    const first = c.first_name || (row.customer_name || "").trim().split(/\s+/)[0] || "";
    const last = c.last_name || (row.customer_name || "").trim().split(/\s+/).slice(1).join(" ");
    const birth = toBuddhistDMY(c.birth_date);
    setText(MAP.idCardNo, c.id_number);
    setText(MAP.firstName, first);
    setText(MAP.lastName, last);
    setText(MAP.birthDate, birth);
    setText(MAP.email, c.email);
    setText(MAP.mobile, c.phone);
    setText(MAP.addrLine, buildAddrLine(c));
    setSelectByText(MAP.prefix, c.title);
    fillAddressCascade(c);
    // รถ
    setText(MAP.carTankNo, row.chassis_no);
    fillVehicleCascade(row);
    return {
      first, last, birth, title: c.title || "",
      prov: c.addr_province || "", amp: c.addr_district || "", tam: c.addr_subdistrict || "", zip: c.addr_postal_code || "",
      hasCust: !!row.customer,
      brand: row.brand || "", model: row.model_name || row.model_code || "",
      color: row.color_name_th || row.color_name || "", cc: ccFromModel(row.model_name || row.model_code),
      chassis: row.chassis_no || "",
    };
  }

  function discoverFields() {
    const list = [...document.querySelectorAll("input, select, textarea")]
      .map((el) => ({ tag: el.tagName.toLowerCase(), type: el.type || "", id: el.id || "", name: el.name || "", placeholder: el.placeholder || "" }))
      .filter((x) => x.id || x.name);
    const txt = JSON.stringify(list, null, 1);
    console.log("[EPolicy-Autofill] FIELDS:\n" + txt);
    try { navigator.clipboard.writeText(txt); } catch (e) { /* noop */ }
    return list.length;
  }

  function buildPanel() {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:999999;background:#fff;border:2px solid #06C755;border-radius:10px;padding:8px 12px;box-shadow:0 4px 16px rgba(0,0,0,.25);font-family:sans-serif;width:300px";
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer" id="epHead">' +
        '<span style="font-weight:700;color:#06934a">ดึงข้อมูลใบขาย → E-Policy</span>' +
        '<span id="epToggle" style="font-weight:700;color:#06934a;padding:0 6px">–</span>' +
      '</div>' +
      '<div id="epBody" style="margin-top:6px">' +
        '<input id="epRef" placeholder="SCY06-MCSA-2606-00001" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid #ccc;border-radius:6px;font-size:13px"/>' +
        '<button id="epGo" style="width:100%;margin-top:6px;padding:8px;background:#06C755;color:#fff;border:0;border-radius:6px;font-weight:700;cursor:pointer">ดึง + เติมฟอร์ม</button>' +
        '<button id="epDiscover" style="width:100%;margin-top:6px;padding:5px;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;border-radius:6px;font-weight:600;cursor:pointer;font-size:11px">🔍 แสดงชื่อช่อง</button>' +
        '<div id="epStatus" style="font-size:13px;color:#333;margin-top:8px"></div>' +
      '</div>';
    document.body.appendChild(box);
    const ref = box.querySelector("#epRef"), go = box.querySelector("#epGo"),
      disc = box.querySelector("#epDiscover"), st = box.querySelector("#epStatus"),
      head = box.querySelector("#epHead"), body = box.querySelector("#epBody"), toggle = box.querySelector("#epToggle");
    // ย่อ/ขยาย
    head.addEventListener("click", () => {
      const hidden = body.style.display === "none";
      body.style.display = hidden ? "block" : "none";
      toggle.textContent = hidden ? "–" : "+";
    });
    const setMsg = (h) => { st.innerHTML = h; };
    const vrow = (label, val) => '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:4px 8px;margin-top:4px;font-size:12px"><b>' + label + ':</b> ' + (val || "-") + '</div>';
    async function run() {
      const r = ref.value.trim();
      if (!r) { setMsg("กรอกเลขที่ใบขายก่อน"); return; }
      setMsg("กำลังดึงข้อมูล…");
      try {
        const row = await fetchBySaleNo(r);
        if (!row || !row.sale_no) { setMsg("❌ ไม่พบเลขที่ใบขายนี้ (หรือถูกยกเลิก)"); return; }
        const d = fillForm(row);
        setMsg('<div style="color:#067647;font-weight:700;margin-bottom:4px">✅ เติมข้อมูลแล้ว</div>' +
          (d.hasCust ? "" : '<div style="color:#b91c1c;font-size:12px">⚠️ ไม่พบรายละเอียดลูกค้า (เติมได้แค่ชื่อจากใบขาย)</div>') +
          '<div style="font-size:12px;color:#b54708;margin-top:2px">🏍️ รายละเอียดรถ (ตรวจ/เลือก dropdown เอง):</div>' +
          vrow("ยี่ห้อ", d.brand) + vrow("รุ่น", d.model) + vrow("สี", d.color) + vrow("ขนาด (CC)", d.cc) + vrow("เลขตัวถัง", d.chassis) +
          '<div style="font-size:11px;color:#6b7280;margin-top:6px;border-top:1px dashed #e5e7eb;padding-top:4px">👤 ' + d.first + ' ' + d.last + (d.birth ? ' · เกิด ' + d.birth : '') +
          '<br>📍 ' + (d.prov || "-") + " / " + (d.amp || "-") + " / " + (d.tam || "-") + ' · 📮 ' + (d.zip || "-") + '</div>');
      } catch (e) { setMsg("❌ ผิดพลาด: " + (e.message || e)); log(e); }
    }
    go.addEventListener("click", run);
    ref.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    disc.addEventListener("click", () => { const n = discoverFields(); setMsg("🔍 พบ " + n + " ช่อง — คัดลอกไป clipboard แล้ว"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildPanel);
  else buildPanel();
})();
