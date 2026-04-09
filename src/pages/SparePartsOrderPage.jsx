import React, { useEffect, useState, useRef } from "react";

const API = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api";
const USER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/office-login";

async function api(action, extra = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
}

const emptyItem = () => ({ part_code: "", part_name: "", quantity: 1 });

const emptyForm = () => ({
  order_type: "ปกติ",
  ref_order_id: "",
  deposit_doc_no: "",
  customer_code: "",
  customer_name: "",
  vin: "",
  deposit_amount: 0,
  technician: "",
  customer_phone: "",
  license_plate: "",
  model_name: "",
  parking_status: "จอดร้าน",
  items: [emptyItem()],
});

export default function SparePartsOrderPage({ currentUser }) {
  const [orders, setOrders] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [models, setModels] = useState([]);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMenuOpen, setOcrMenuOpen] = useState(false);
  const ocrMenuRef = useRef(null);
  const [editId, setEditId] = useState(null);
  const [showPOModal, setShowPOModal] = useState(null);
  const [poNumber, setPoNumber] = useState("");
  const [savingPO, setSavingPO] = useState(false);
  const [showJobModal, setShowJobModal] = useState(null);
  const [jobNumber, setJobNumber] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [savingJob, setSavingJob] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterParking, setFilterParking] = useState("all");
  const [editParkingId, setEditParkingId] = useState(null);
  const [filterDepType, setFilterDepType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;
  const [dcsMismatchIds, setDcsMismatchIds] = useState(new Set());
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [repairDeposits, setRepairDeposits] = useState([]);
  const [repairDocNo, setRepairDocNo] = useState("");
  const [estimateNo, setEstimateNo] = useState("");
  const [savingRepair, setSavingRepair] = useState(false);
  const [partSubstitutes, setPartSubstitutes] = useState([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    // แยก request แต่ละตัว ถ้าตัวใดพัง ตัวอื่นยังทำงานได้
    try {
      const r = await api("get_spare_orders");
      const allOrders = norm(r);
      setOrders(allOrders);
      // เช็ค DCS อัตโนมัติสำหรับใบที่สถานะ "สั่งซื้อแล้ว"
      const toCheck = allOrders.filter(o => (o.status === "สั่งซื้อแล้ว" || o.status === "มาครบ") && o.vendor_po_no);
      const mismatchSet = new Set();
      for (const o of toCheck) {
        try {
          const dcsRes = await api("search_dcs_orders", { vendor_po_no: o.vendor_po_no });
          const dcsItems = norm(dcsRes);
          const detailRes = await api("get_spare_order_detail", { order_id: o.order_id });
          const items = norm(detailRes);
          const strip = s => (s || "").replace(/-/g, "").toUpperCase().trim();
          const orderCodes = items.map(it => strip(it.part_code));
          const invalidDcs = dcsItems.filter(d => !orderCodes.includes(strip(d.part_number)));
          const allCorrect = invalidDcs.length === 0 && dcsItems.length > 0;
          // เช็ค backorder
          let hasBackorder = false;
          try {
            const boRes = await api("search_dcs_backorders", { vendor_po_no: o.vendor_po_no });
            const boItems = norm(boRes).filter(b => Number(b.backorder_qty || 0) > 0);
            hasBackorder = boItems.length > 0;
          } catch {}
          if (dcsItems.length > 0 && o.status === "สั่งซื้อแล้ว") {
            const newStatus = hasBackorder ? "อะไหล่ค้างส่ง" : "มาครบ";
            await api("update_order_status", { order_id: o.order_id, status: newStatus });
          } else if (hasBackorder && o.status === "มาครบ") {
            // เปลี่ยนจาก "มาครบ" เป็น "อะไหล่ค้างส่ง" ถ้าพบ backorder
            await api("update_order_status", { order_id: o.order_id, status: "อะไหล่ค้างส่ง" });
          }
          if (!allCorrect && dcsItems.length > 0) {
            mismatchSet.add(o.order_id);
          }
        } catch {}
      }
      setDcsMismatchIds(mismatchSet);
      // โหลดใหม่ถ้ามีการอัปเดต
      if (toCheck.length > 0) {
        try { const r2 = await api("get_spare_orders"); setOrders(norm(r2)); } catch {}
      }
    } catch {}
    try { const r = await api("get_honda_deposits"); setDeposits(norm(r)); } catch {}
    try { const r = await api("get_repair_deposits"); setRepairDeposits(norm(r)); } catch {}
    try { const r = await api("get_part_substitutes"); setPartSubstitutes(norm(r)); } catch {}
    try { const r = await api("get_car_model_names"); console.log("models:", r); setModels(norm(r)); } catch (e) { console.error("models err:", e); }
    try {
      const r = await fetch(USER_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_users" }),
      }).then(res => res.json());
      console.log("users raw:", r);
      const allUsers = norm(r);
      console.log("allUsers:", allUsers.length, "role:", currentUser?.role, "branch:", currentUser?.branch);
      const myBranch = currentUser?.branch || "";
      setTechs(allUsers.filter(u => u.branch === myBranch && (u.position || "").includes("ช่าง")));
    } catch (e) { console.error("users err:", e); }
    setLoading(false);
  }

  async function handleSaveRepairDeposit() {
    if (!repairDocNo) { setMessage("กรุณาเลือกใบมัดจำ"); return; }
    if (!estimateNo.trim()) { setMessage("กรุณากรอกเลขที่ใบประเมิน"); return; }
    setSavingRepair(true);
    setMessage("");
    try {
      const dep = deposits.find(d => d.deposit_doc_no === repairDocNo);
      await api("save_repair_deposit", {
        deposit_doc_no: repairDocNo,
        estimate_no: estimateNo.trim(),
        customer_name: dep?.customer_name || "",
        created_by: currentUser?.name || "",
      });
      setShowRepairModal(false);
      setRepairDocNo("");
      setEstimateNo("");
      setMessage("บันทึกมัดจำตีราคาซ่อมสำเร็จ");
      loadAll();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSavingRepair(false);
  }

  function norm(d) {
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d?.items)) return d.items;
    if (Array.isArray(d?.rows)) return d.rows;
    return [];
  }

  function openNew() {
    setEditId(null);
    setForm(emptyForm());
    setShowForm(true);
    setMessage("");
  }

  async function openEdit(order) {
    try {
      const res = await api("get_spare_order_detail", { order_id: order.order_id });
      const items = norm(res);
      setEditId(order.order_id);
      setForm({
        order_type: order.order_type || "ปกติ",
        ref_order_id: order.ref_order_id || "",
        deposit_doc_no: order.deposit_doc_no || "",
        customer_code: order.customer_code || "",
        customer_name: order.customer_name || "",
        vin: order.vin || "",
        deposit_amount: Number(order.deposit_amount || 0),
        technician: order.technician || "",
        customer_phone: order.customer_phone || "",
        license_plate: order.license_plate || "",
        model_name: order.model_name || "",
        parking_status: order.parking_status || "จอดร้าน",
        items: items.length > 0 ? items.map(it => ({ part_code: it.part_code || "", part_name: it.part_name || "", quantity: Number(it.quantity || 1) })) : [emptyItem()],
      });
      setShowForm(true);
      setMessage("");
    } catch { setMessage("โหลดข้อมูลไม่สำเร็จ"); }
  }

  function handleTypeChange(type) {
    const f = emptyForm();
    f.order_type = type;
    setForm(f);
  }

  function handleDepositSelect(docNo) {
    const dep = deposits.find(d => d.deposit_doc_no === docNo);
    if (dep) {
      const isNotDEPD = !docNo.startsWith("DEPD");
      setForm(prev => ({
        ...prev,
        deposit_doc_no: docNo,
        customer_code: dep.customer_code || "",
        customer_name: dep.customer_name || "",
        vin: dep.vin || "",
        deposit_amount: Number(dep.remaining_amount || 0),
        technician: isNotDEPD ? (currentUser?.name || "") : prev.technician,
      }));
    }
  }

  function handleAddDepositSelect(docNo) {
    const dep = deposits.find(d => d.deposit_doc_no === docNo);
    if (!dep) return;
    // หาใบสั่งซื้อเดิมของลูกค้าคนนี้ (ใบล่าสุด)
    const prevOrder = orders
      .filter(o => o.customer_code === dep.customer_code)
      .sort((a, b) => (b.order_id || 0) - (a.order_id || 0))[0];
    setForm(prev => ({
      ...prev,
      deposit_doc_no: docNo,
      ref_order_id: prevOrder ? prevOrder.order_id : "",
      customer_code: dep.customer_code || "",
      customer_name: dep.customer_name || "",
      vin: dep.vin || prevOrder?.vin || "",
      deposit_amount: Number(dep.remaining_amount || 0),
      // copy ข้อมูลจากใบเดิม
      technician: prevOrder?.technician || prev.technician,
      model_name: prevOrder?.model_name || prev.model_name,
      parking_status: prevOrder?.parking_status || prev.parking_status,
      customer_phone: prevOrder?.customer_phone || prev.customer_phone,
      license_plate: prevOrder?.license_plate || prev.license_plate,
      items: [emptyItem()],
    }));
  }

  function handleRefOrderSelect(orderId) {
    const ref = orders.find(o => String(o.order_id) === String(orderId));
    if (ref) {
      setForm(prev => ({
        ...prev,
        ref_order_id: orderId,
        deposit_doc_no: ref.deposit_doc_no || "",
        customer_code: ref.customer_code || "",
        customer_name: ref.customer_name || "",
        vin: ref.vin || "",
        deposit_amount: Number(ref.deposit_amount || 0),
        technician: ref.technician || "",
        model_name: ref.model_name || "",
        parking_status: ref.parking_status || "จอดร้าน",
        items: [emptyItem()],
      }));
    }
  }

  function updateItem(idx, field, val) {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: val };
      return { ...prev, items };
    });
  }

  function addItem() {
    setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }));
  }

  function removeItem(idx) {
    setForm(prev => {
      const items = prev.items.filter((_, i) => i !== idx);
      return { ...prev, items: items.length ? items : [emptyItem()] };
    });
  }

  async function handleSave() {
    if (!form.deposit_doc_no) {
      setMessage(form.order_type === "สั่งเพิ่ม" ? "กรุณาเลือกใบมัดจำเพิ่ม" : "กรุณาเลือกเลขที่มัดจำ");
      return;
    }
    if (!form.customer_phone.trim()) { setMessage("กรุณากรอกเบอร์โทรลูกค้า"); return; }
    if (form.parking_status === "จอดร้าน" && !form.license_plate.trim()) { setMessage("กรุณากรอกทะเบียนรถ (จอดร้าน)"); return; }
    if (!form.technician.trim()) { setMessage("กรุณาเลือกช่าง"); return; }
    if (!form.model_name) { setMessage("กรุณาเลือกรุ่นรถ"); return; }
    const validItems = form.items.filter(it => (it.part_code || "").trim() || (it.part_name || "").trim());
    if (validItems.length === 0) { setMessage("กรุณาเพิ่มรายการอะไหล่อย่างน้อย 1 รายการ"); return; }

    setSaving(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        items: validItems,
        created_by: currentUser?.name || "",
        branch: currentUser?.branch || "",
      };
      const action = editId ? "update_spare_order" : "save_spare_order";
      if (editId) payload.order_id = editId;
      const res = await api(action, payload);
      if (res?.success || res?.order_id) {
        setMessage(editId ? "แก้ไขสำเร็จ" : "บันทึกสำเร็จ");
        setEditId(null);
        setShowForm(false);
        loadAll();
      } else {
        setMessage(res?.message || "บันทึกไม่สำเร็จ");
      }
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function checkDCSStatus() {
    if (!showDetail?.vendor_po_no || !showDetail?.items) { setMessage("ไม่มีเลขที่ใบรับสั่งซื้อ"); return; }
    setMessage("กำลังตรวจสอบ DCS...");
    try {
      const res = await api("search_dcs_orders", { vendor_po_no: showDetail.vendor_po_no });
      const dcsItems = norm(res);
      // เทียบ: DCS ทุกรายการต้องมีอยู่ในใบสั่งซื้อ (ใบสั่งซื้อมีมากกว่าได้)
      const strip = s => (s || "").replace(/-/g, "").toUpperCase().trim();
      const orderCodes = showDetail.items.map(it => strip(it.part_code));
      // ตรวจว่า DCS มีรายการที่ไม่อยู่ในใบสั่งซื้อหรือไม่
      const invalidDcs = dcsItems.filter(d => !orderCodes.includes(strip(d.part_number)));
      const statusList = showDetail.items.map(it => {
        const found = dcsItems.find(d => strip(d.part_number) === strip(it.part_code));
        return { part_code: it.part_code, part_name: it.part_name, qty: it.quantity, status: found ? "ตรงกัน" : "รอ" };
      });
      const allCorrect = invalidDcs.length === 0 && dcsItems.length > 0;
      // รายการใบสั่งซื้อที่ไม่ match กับ DCS
      const unmatchedOrders = showDetail.items.filter(it => !dcsItems.find(d => strip(d.part_number) === strip(it.part_code)));
      // ถ้าถูกต้องทั้งหมด อัปเดตสถานะใน DB
      if (allCorrect) {
        try { await api("update_order_status", { order_id: showDetail.order_id, status: "มาครบ" }); } catch {}
      }
      setShowDetail(prev => ({ ...prev, dcsStatus: { items: statusList, allCorrect, invalidDcs, dcsItems, unmatchedOrders }, status: allCorrect ? "มาครบ" : prev.status }));
      if (allCorrect) loadAll();
    } catch { /* silent */ }
  }

  async function handleApproveSubstitute() {
    if (!showDetail?.dcsStatus?.invalidDcs) return;
    if (partSubstitutes.some(ps => ps.order_id === showDetail.order_id)) {
      setMessage("ใบสั่งซื้อนี้เคยอนุมัติอะไหล่ใช้แทนกันแล้ว");
      setShowDetail(prev => ({ ...prev, alreadyApproved: true }));
      return;
    }
    setMessage("กำลังบันทึกอะไหล่ใช้แทนกัน...");
    try {
      const strip = s => (s || "").replace(/-/g, "").toUpperCase().trim();
      const dcsMatchedCodes = (showDetail.dcsStatus.dcsItems || [])
        .filter(d => showDetail.items.some(it => strip(it.part_code) === strip(d.part_number)))
        .map(d => strip(d.part_number));
      const waitingItems = showDetail.items.filter(it => !dcsMatchedCodes.includes(strip(it.part_code)));
      // จับคู่ invalidDcs กับ waitingItems โดยเทียบ prefix รหัส (ตัด 2 หลักสุดท้าย) หรือชื่อ
      const usedWaiting = new Set();
      const pairs = showDetail.dcsStatus.invalidDcs.map(dcs => {
        const dcsCode = strip(dcs.part_number);
        const dcsPrefix = dcsCode.length >= 8 ? dcsCode.substring(0, dcsCode.length - 2) : dcsCode;
        let bestIdx = -1;
        let bestScore = 0;
        waitingItems.forEach((it, idx) => {
          if (usedWaiting.has(idx)) return;
          const orderCode = strip(it.part_code);
          const orderPrefix = orderCode.length >= 8 ? orderCode.substring(0, orderCode.length - 2) : orderCode;
          // เทียบ prefix รหัส
          if (dcsPrefix === orderPrefix) { bestScore = 100; bestIdx = idx; return; }
          // เทียบชื่อ
          const dcsName = (dcs.part_description || "").toLowerCase();
          const name = (it.part_name || "").toLowerCase();
          const score = [...name].filter((c, ci) => dcsName[ci] === c).length;
          if (score > bestScore) { bestScore = score; bestIdx = idx; }
        });
        if (bestIdx >= 0) usedWaiting.add(bestIdx);
        const matched = bestIdx >= 0 ? waitingItems[bestIdx] : null;
        return {
          original_code: matched?.part_code || "",
          substitute_code: dcs.part_number || "",
          original_name: matched?.part_name || "",
          substitute_name: dcs.part_description || "",
        };
      });
      await api("save_part_substitutes", {
        order_id: showDetail.order_id,
        pairs,
        approved_by: currentUser?.name || "",
      });
      await api("update_order_status", { order_id: showDetail.order_id, status: "มาครบ" });
      setShowDetail(prev => ({ ...prev, status: "มาครบ", dcsStatus: { ...prev.dcsStatus, approved: true } }));
      setMessage("อนุมัติอะไหล่ใช้แทนกันสำเร็จ");
      loadAll();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
  }

  async function handleRejectSubstitute() {
    try {
      await api("update_order_status", { order_id: showDetail.order_id, status: "อะไหล่ค้างส่ง" });
      setShowDetail(prev => ({ ...prev, status: "อะไหล่ค้างส่ง" }));
      setMessage("บันทึกไม่อนุมัติสำเร็จ");
      loadAll();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
  }

  async function handleSaveJob() {
    const isDEPD = (showJobModal.deposit_doc_no || "").startsWith("DEPD");
    if (isDEPD && !jobNumber.trim()) { setMessage("กรุณากรอกเลขที่ใบงาน"); return; }
    if (!isDEPD && !appointmentDate) { setMessage("กรุณาเลือกวันที่นัดหมาย"); return; }
    setSavingJob(true);
    setMessage("");
    try {
      await api("save_job_no", { order_id: showJobModal.order_id, job_no: jobNumber.trim() || null, appointment_date: appointmentDate || null });
      setShowJobModal(null);
      setJobNumber("");
      setAppointmentDate("");
      setMessage(isDEPD ? "บันทึกเลขที่ใบงานสำเร็จ" : "บันทึกนัดหมายสำเร็จ");
      loadAll();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSavingJob(false);
  }

  async function handleParkingChange(orderId, newStatus) {
    try {
      await api("update_parking_status", { order_id: orderId, parking_status: newStatus });
      setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, parking_status: newStatus } : o));
    } catch { setMessage("อัปเดตสถานะจอดไม่สำเร็จ"); }
    setEditParkingId(null);
  }

  async function handleConfirmOrder() {
    if (!poNumber.trim()) { setMessage("กรุณากรอกเลขที่ใบรับสั่งซื้อ"); return; }
    setSavingPO(true);
    setMessage("");
    try {
      await api("confirm_spare_order", { order_id: showPOModal.order_id, vendor_po_no: poNumber.trim() });
      setShowPOModal(null);
      setPoNumber("");
      setMessage("บันทึกการสั่งซื้อสำเร็จ");
      loadAll();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSavingPO(false);
  }

  async function viewDetail(order) {
    try {
      const res = await api("get_spare_order_detail", { order_id: order.order_id });
      const items = norm(res);
      // ค้นสต๊อกแต่ละรายการ
      const itemsWithStock = await Promise.all(items.map(async (it) => {
        const code = (it.part_code || "").replace(/-/g, "").trim();
        if (!code) return it;
        try {
          const sr = await api("search_inventory", { code });
          const found = norm(sr);
          if (found.length > 0) {
            // รวมทุกสาขาที่มีสต็อก แสดงเป็น "ป.เปา(2), ห้าห้อง(1)"
            const parts = found.filter(f => Number(f.quantity || 0) > 0);
            const stockName = parts.map(f => `${f.source || "-"}(${Number(f.quantity || 0)})`).join(", ");
            const totalQty = parts.reduce((s, f) => s + Number(f.quantity || 0), 0);
            const locations = [...new Set(parts.map(f => f.location).filter(Boolean))].join(", ");
            return { ...it, stock_name: stockName || "-", stock_qty: totalQty, stock_location: locations || "-" };
          }
        } catch {}
        return it;
      }));
      // ดึงอะไหล่ค้างส่ง
      let boItems = [];
      if (order.vendor_po_no) {
        try {
          const boRes = await api("search_dcs_backorders", { vendor_po_no: order.vendor_po_no });
          boItems = norm(boRes);
        } catch {}
      }
      const alreadyApproved = partSubstitutes.some(ps => ps.order_id === order.order_id);
      // เช็คว่าอะไหล่ครบทุกรายการ (stock_qty >= quantity)
      const allInStock = itemsWithStock.length > 0 && itemsWithStock.every(
        it => Number(it.stock_qty || 0) >= Number(it.quantity || 0)
      );
      let finalStatus = order.status;
      if (allInStock && order.status !== "มาครบ" && order.status !== "เปิดงาน" && order.status !== "ปิดงานซ่อม") {
        try {
          await api("update_order_status", { order_id: order.order_id, status: "มาครบ" });
          finalStatus = "มาครบ";
          // อัปเดตใน list ด้วย
          setOrders(prev => prev.map(o => o.order_id === order.order_id ? { ...o, status: "มาครบ" } : o));
        } catch {}
      }
      setShowDetail({ ...order, status: finalStatus, items: itemsWithStock, dcsStatus: null, boItems, alreadyApproved });
    } catch { setMessage("โหลดรายละเอียดไม่สำเร็จ"); }
  }

  const filtered = orders.filter(o => {
    if (filterStatus === "ตีราคาซ่อม") {
      if (!repairDeposits.some(rd => rd.deposit_doc_no === o.deposit_doc_no)) return false;
    } else if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (filterParking !== "all" && o.parking_status !== filterParking) return false;
    if (filterDepType === "repair" && !(o.deposit_doc_no || "").startsWith("DEPD")) return false;
    if (filterDepType === "purchase" && (o.deposit_doc_no || "").startsWith("DEPD")) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (o.customer_name || "").toLowerCase().includes(s) ||
      (o.deposit_doc_no || "").toLowerCase().includes(s) ||
      (o.vin || "").toLowerCase().includes(s) ||
      (o.technician || "").toLowerCase().includes(s) ||
      String(o.order_id).includes(s)
    );
  }).sort((a, b) => {
    const depA = deposits.find(d => d.deposit_doc_no === a.deposit_doc_no);
    const depB = deposits.find(d => d.deposit_doc_no === b.deposit_doc_no);
    // ปิด job (ไม่มี deposit) อยู่ล่างสุด
    if (!depA && depB) return 1;
    if (depA && !depB) return -1;
    if (!depA && !depB) return 0;
    return new Date(depB.deposit_date) - new Date(depA.deposit_date);
  });



  // Close OCR menu when clicking outside
  useEffect(() => {
    if (!ocrMenuOpen) return;
    function handleClickOutside(e) {
      if (ocrMenuRef.current && !ocrMenuRef.current.contains(e.target)) setOcrMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ocrMenuOpen]);

  async function handleOCR(e, type) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setOcrMenuOpen(false);
    setOcrLoading(true);
    try {
      const formData = new FormData();
      if (type === "image") {
        formData.append("image", file, file.name);
      } else {
        formData.append("pdf", file, file.name);
      }
      const res = await fetch("https://n8n-new-project-gwf2.onrender.com/webhook/ocr-pdf-spare-parts", {
        method: "POST",
        body: formData,
      }).then(r => r.json());
      const ocrItems = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : Array.isArray(res?.data) ? res.data : [];
      if (ocrItems.length > 0) {
        const newItems = ocrItems.map(it => ({
          part_code: it.part_code || it.product_code || it.code || "",
          part_name: it.part_name || it.product_name || it.name || "",
          quantity: Number(it.quantity || it.qty || 1),
        }));
        setForm(prev => ({
          ...prev,
          items: [...prev.items.filter(it => it.part_name || it.part_code), ...newItems],
        }));
        setMessage("OCR สำเร็จ: " + ocrItems.length + " รายการ");
      } else {
        setMessage("OCR ไม่พบรายการอะไหล่");
      }
    } catch { setMessage("OCR เกิดข้อผิดพลาด"); }
    setOcrLoading(false);
  }

  function printTable() {
    const w = window.open("", "_blank", "width=1200,height=800");
    const filterLabel = (filterStatus === "all" ? "ทั้งหมด" : filterStatus) + (filterParking !== "all" ? ` / ${filterParking}` : "");
    const rows = filtered.map((o, i) => {
      const dep = deposits.find(d => d.deposit_doc_no === o.deposit_doc_no);
      const depDate = dep ? fmtDate(dep.deposit_date) : "ปิด Job";
      return `<tr>
        <td>${i + 1}</td>
        <td>${o.order_type}</td>
        <td>${depDate}</td>
        <td>${o.deposit_doc_no}</td>
        <td>${o.customer_name}</td>
        <td>${(o.technician || "").split(" ")[0]}</td>
        <td>${o.model_name || "-"}</td>
        <td>${o.parking_status}</td>
        <td>${o.status}</td>
        <td>${o.vendor_po_no || "-"}</td>
        <td>${o.appointment_date ? fmtDate(o.appointment_date) : "-"}</td>
      </tr>`;
    }).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายการสั่งซื้ออะไหล่</title>
<style>
  body { font-family: 'Tahoma', 'Sarabun', sans-serif; padding: 16px; font-size: 11px; }
  h2 { margin: 0 0 4px; font-size: 16px; }
  .info { font-size: 12px; color: #555; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
  th { background: #072d6b; color: #fff; font-size: 10px; }
  @media print { body { padding: 0; } }
</style></head><body>
<h2>ระบบสั่งซื้ออะไหล่</h2>
<div class="info">ตัวกรอง: ${filterLabel} | จำนวน: ${filtered.length} รายการ | พิมพ์: ${new Date().toLocaleString("th-TH")}</div>
<table>
  <thead><tr>
    <th>#</th><th>ประเภท</th><th>วันที่มัดจำ</th><th>เลขที่มัดจำ</th><th>ลูกค้า</th><th>ช่าง</th><th>รุ่นรถ</th><th>สถานะจอด</th><th>สถานะ</th><th>เลขที่ใบรับสั่งซื้อ</th><th>วันที่นัดหมาย</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`);
    w.document.close();
    w.print();
  }

  function printOrder(order) {
    const items = order.items || [];
    const w = window.open("", "_blank", "width=800,height=600");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบสั่งซื้อ ${order.order_no || '#' + order.order_id}</title>
<style>
  body { font-family: 'Tahoma', 'Sarabun', sans-serif; padding: 24px; font-size: 13px; color: #222; }
  h2 { text-align: center; margin-bottom: 4px; }
  .sub { text-align: center; color: #666; margin-bottom: 20px; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 16px; }
  .info b { min-width: 90px; display: inline-block; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; }
  th { background: #f1f5f9; font-weight: 600; }
  .right { text-align: right; }
  .center { text-align: center; }
  .stock { background: #f0f9ff; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; }
  .sig { text-align: center; width: 200px; }
  .sig-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 4px; }
  @media print { body { padding: 0; } }
</style></head><body>
<h2>ใบสั่งซื้ออะไหล่</h2>
<div class="sub">เลขที่: ${order.order_no || '#' + order.order_id} | ประเภท: สั่งซื้อ${order.order_type} ${order.ref_order_id ? '(อ้างอิงใบ #' + order.ref_order_id + ')' : ''}</div>
<div class="info">
  <div><b>เลขมัดจำ:</b> ${order.deposit_doc_no || '-'}</div>
  <div><b>วันที่:</b> ${fmtDate(order.created_at)}</div>
  <div><b>ลูกค้า:</b> ${order.customer_code || ''} - ${order.customer_name || ''}</div>
  <div><b>ยอดมัดจำ:</b> ${fmt(order.deposit_amount)}</div>
  <div><b>VIN:</b> ${order.vin || '-'}</div>
  <div><b>รุ่นรถ:</b> ${order.model_name || '-'}</div>
  <div><b>ช่าง:</b> ${order.technician || '-'}</div>
  <div><b>สถานะจอด:</b> ${order.parking_status || '-'}</div>
  <div><b>ผู้สร้าง:</b> ${order.created_by || '-'}</div>
  <div><b>สาขา:</b> ${order.branch || '-'}</div>
</div>
<table>
  <thead><tr><th class="center">#</th><th>รหัสสินค้า</th><th>ชื่ออะไหล่</th><th class="center">จำนวน</th><th class="stock">สต๊อก</th><th class="stock center">คงเหลือ</th><th class="stock">ที่เก็บ</th></tr></thead>
  <tbody>
    ${items.length === 0 ? '<tr><td colspan="7" class="center">ไม่มีรายการ</td></tr>' : items.map((it, i) => `<tr><td class="center">${i + 1}</td><td>${it.part_code || ''}</td><td>${it.part_name || ''}</td><td class="center">${it.quantity || 0}</td><td class="stock">${it.stock_name || '-'}</td><td class="stock center">${it.stock_qty != null ? it.stock_qty : '-'}</td><td class="stock">${it.stock_location || '-'}</td></tr>`).join('')}
  </tbody>
</table>
<div class="footer">
  <div class="sig"><div class="sig-line">ผู้สั่งซื้อ</div></div>
  <div class="sig"><div class="sig-line">ผู้อนุมัติ</div></div>
</div>
</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">ระบบสั่งซื้ออะไหล่</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" onClick={openNew} style={{ padding: "8px 20px", fontSize: 13 }}>
            + สร้างใบสั่งซื้อ
          </button>
          <button onClick={() => { setShowRepairModal(true); setRepairDocNo(""); setEstimateNo(""); setMessage(""); }}
            style={{ padding: "8px 16px", fontSize: 13, background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
            บันทึกมัดจำตีราคาซ่อม
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <input
          placeholder="ค้นหา ลูกค้า / เลขมัดจำ / VIN / ช่าง"
          value={search} onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />
        <button onClick={loadAll} className="btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>Refresh</button>
        <button onClick={printTable} style={{ padding: "8px 16px", fontSize: 13, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>พิมพ์</button>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{filtered.length} รายการ</span>
      </div>

      {/* ===== Filter สถานะ ===== */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {["all", "รอดำเนินการ", "สั่งซื้อแล้ว", "มาครบ", "อะไหล่ค้างส่ง", "เปิดงาน", "ปิดงานซ่อม", "ตีราคาซ่อม"].map(s => {
          const count = s === "all" ? orders.length : s === "ตีราคาซ่อม" ? repairDeposits.length : orders.filter(o => o.status === s).length;
          const active = filterStatus === s;
          return (
            <button key={s} onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
              style={{ padding: "4px 14px", fontSize: 12, borderRadius: 20, border: active ? "none" : "1px solid #d1d5db",
                background: s === "ปิดงานซ่อม" ? "#dc2626" : active ? "#072d6b" : "#fff",
                color: s === "ปิดงานซ่อม" ? "#fff" : active ? "#fff" : "#374151",
                cursor: "pointer", fontWeight: (active || s === "ปิดงานซ่อม") ? 700 : 400 }}>
              {s === "all" ? "ทั้งหมด" : s} ({count})
            </button>
          );
        })}
      </div>

      {/* ===== Filter จอดร้าน + ประเภทมัดจำ ===== */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {["all", "จอดร้าน", "ไม่จอดร้าน"].map(s => {
          const count = s === "all" ? orders.length : orders.filter(o => o.parking_status === s).length;
          const active = filterParking === s;
          return (
            <button key={s} onClick={() => { setFilterParking(s); setCurrentPage(1); }}
              style={{ padding: "4px 14px", fontSize: 12, borderRadius: 20, border: active ? "none" : "1px solid #d1d5db", background: active ? "#f59e0b" : "#fff", color: active ? "#fff" : "#374151", cursor: "pointer", fontWeight: active ? 700 : 400 }}>
              {s === "all" ? "ทั้งหมด" : s} ({count})
            </button>
          );
        })}
        <span style={{ borderLeft: "2px solid #d1d5db", height: 24, margin: "0 4px" }}></span>
        {[
          { key: "all", label: "ทั้งหมด", bg: "#6b7280" },
          { key: "repair", label: "มัดจำซ่อม", bg: "#7c3aed" },
          { key: "purchase", label: "มัดจำซื้อ", bg: "#3b82f6" },
        ].map(f => {
          const count = f.key === "all" ? orders.length : f.key === "repair" ? orders.filter(o => (o.deposit_doc_no || "").startsWith("DEPD")).length : orders.filter(o => !(o.deposit_doc_no || "").startsWith("DEPD")).length;
          const active = filterDepType === f.key;
          return (
            <button key={f.key} onClick={() => { setFilterDepType(f.key); setCurrentPage(1); }}
              style={{ padding: "4px 14px", fontSize: 12, borderRadius: 20, border: active ? "none" : "1px solid #d1d5db", background: active ? f.bg : "#fff", color: active ? "#fff" : "#374151", cursor: "pointer", fontWeight: active ? 700 : 400 }}>
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {message && !showForm && <div style={{ color: message.includes("สำเร็จ") ? "#15803d" : "#b91c1c", marginBottom: 8, fontSize: 13 }}>{message}</div>}

      {/* ===== ตารางตีราคาซ่อม ===== */}
      {filterStatus === "ตีราคาซ่อม" ? (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#072d6b", color: "#fff" }}>
                <th style={th}>#</th>
                <th style={th}>เลขที่มัดจำ</th>
                <th style={th}>เลขที่ใบประเมิน</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>ผู้บันทึก</th>
                <th style={th}>วันที่บันทึก</th>
              </tr>
            </thead>
            <tbody>
              {repairDeposits.length === 0 ? (
                <tr><td colSpan={6} style={center}>ไม่พบข้อมูล</td></tr>
              ) : repairDeposits.map((rd, i) => (
                <tr key={rd.id || i} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{rd.deposit_doc_no}</td>
                  <td style={td}>{rd.estimate_no}</td>
                  <td style={td}>{rd.customer_name}</td>
                  <td style={td}>{rd.created_by || "-"}</td>
                  <td style={td}>{fmtDate(rd.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
      /* ===== ตารางรายการสั่งซื้อ ===== */
      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={th}>ประเภท</th>
              <th style={th}>วันที่มัดจำ</th>
              <th style={th}>เลขที่มัดจำ</th>
              <th style={th}>ลูกค้า</th>
              <th style={th}>ช่าง</th>
              <th style={th}>รุ่นรถ</th>
              <th style={th}>ทะเบียนรถ</th>
              <th style={th}>สถานะจอด</th>
              <th style={th}>สถานะ</th>
              <th style={th}>เลขที่ใบรับสั่งซื้อ</th>
              <th style={th}>วันที่</th>
              <th style={th}>วันที่นัดหมาย</th>
              <th style={th}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} style={center}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={13} style={center}>ไม่พบข้อมูล</td></tr>
            ) : filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((o, i) => (
              <tr key={o.order_id} style={{ borderBottom: "1px solid #e5e7eb", background: dcsMismatchIds.has(o.order_id) ? "#fef9c3" : i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={td}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: o.order_type === "ปกติ" ? "#dbeafe" : "#fef3c7",
                    color: o.order_type === "ปกติ" ? "#1e40af" : "#92400e",
                  }}>{o.order_type}</span>
                </td>
                <td style={td}>{(() => { const dep = deposits.find(d => d.deposit_doc_no === o.deposit_doc_no); return dep ? fmtDate(dep.deposit_date) : <span style={{ color: "#ef4444", fontWeight: 600 }}>ปิด Job</span>; })()}</td>
                <td style={td}>{o.deposit_doc_no}</td>
                <td style={td}>{o.customer_name}</td>
                <td style={td}>{(o.technician || "").split(" ")[0]}</td>
                <td style={td}>{o.model_name}</td>
                <td style={td}>{o.license_plate || "-"}</td>
                <td style={td}>{o.status === "เปิดงาน" && editParkingId === o.order_id ? (
                  <select defaultValue={o.parking_status} autoFocus onBlur={() => setEditParkingId(null)}
                    onChange={e => handleParkingChange(o.order_id, e.target.value)}
                    style={{ fontSize: 12, padding: "2px 4px", borderRadius: 4 }}>
                    <option value="จอดร้าน">จอดร้าน</option>
                    <option value="ไม่จอดร้าน">ไม่จอดร้าน</option>
                  </select>
                ) : (
                  <span onClick={() => o.status === "เปิดงาน" && setEditParkingId(o.order_id)}
                    style={{ cursor: o.status === "เปิดงาน" ? "pointer" : "default", textDecoration: o.status === "เปิดงาน" ? "underline" : "none" }}>
                    {o.parking_status}
                  </span>
                )}</td>
                <td style={td}>{(() => {
                  const hasDep = deposits.some(d => d.deposit_doc_no === o.deposit_doc_no);
                  if (!hasDep) return <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, background: "#dc2626", color: "#fff", fontWeight: 600 }}>ปิดซ่อม</span>;
                  const s = o.status;
                  return <span style={{
                    padding: "2px 8px", borderRadius: 6, fontSize: 11,
                    background: s === "ปิดงานซ่อม" ? "#dc2626" : s === "อะไหล่ค้างส่ง" ? "#f97316" : s === "เปิดงาน" ? "#ec4899" : s === "มาครบ" ? "#dbeafe" : s === "สั่งซื้อแล้ว" ? "#d1fae5" : "#fef3c7",
                    color: s === "ปิดงานซ่อม" ? "#fff" : s === "อะไหล่ค้างส่ง" ? "#fff" : s === "เปิดงาน" ? "#fff" : s === "มาครบ" ? "#1e40af" : s === "สั่งซื้อแล้ว" ? "#065f46" : "#92400e",
                  }}>{s}</span>;
                })()}</td>
                <td style={td}>{o.vendor_po_no || "-"}</td>
                <td style={td}>{fmtDate(o.created_at)}</td>
                <td style={td}>{o.appointment_date ? fmtDate(o.appointment_date) : "-"}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  <button onClick={() => viewDetail(o)} style={{ background: "#072d6b", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", marginRight: 4 }}>ดู</button>
                  {(() => {
                    // ถ้าไม่พบเลขมัดจำใน deposits = ปิดซ่อม → ดูได้อย่างเดียว
                    const hasDepAct = deposits.some(d => d.deposit_doc_no === o.deposit_doc_no);
                    if (!hasDepAct) return null;
                    return (
                      <>
                        {o.status === "รอดำเนินการ" && (
                          <>
                            <button onClick={() => openEdit(o)} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", marginRight: 4 }}>แก้ไข</button>
                            <button onClick={() => { setShowPOModal(o); setPoNumber(o.vendor_po_no || ""); setMessage(""); }} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>สั่ง</button>
                          </>
                        )}
                        {(o.status === "มาครบ" || o.status === "เปิดงาน") && (() => {
                          const isDEPD = (o.deposit_doc_no || "").startsWith("DEPD");
                          const label = o.status === "เปิดงาน" ? (isDEPD ? "แก้ไข Job" : "แก้ไขนัด") : (isDEPD ? "เปิดงาน" : "นัดหมาย");
                          return (
                            <button onClick={() => { setShowJobModal(o); setJobNumber(o.job_no || ""); setAppointmentDate(o.appointment_date || ""); setMessage(""); }}
                              style={{ background: isDEPD ? "#7c3aed" : "#f59e0b", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>{label}</button>
                          );
                        })()}
                      </>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* ===== Pagination ===== */}
      {filtered.length > PAGE_SIZE && (
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 12 }}>
          {Array.from({ length: Math.ceil(filtered.length / PAGE_SIZE) }, (_, i) => (
            <button key={i} onClick={() => setCurrentPage(i + 1)}
              style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: currentPage === i + 1 ? "none" : "1px solid #d1d5db", background: currentPage === i + 1 ? "#072d6b" : "#fff", color: currentPage === i + 1 ? "#fff" : "#374151", cursor: "pointer" }}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* ===== Modal ฟอร์มสร้าง ===== */}
      {showForm && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>{editId ? "แก้ไขใบสั่งซื้ออะไหล่" : "สร้างใบสั่งซื้ออะไหล่"}</h3>
              <button onClick={() => setShowForm(false)} style={closeBtn}>&times;</button>
            </div>

            {message && <div style={{ color: "#b91c1c", marginBottom: 8, fontSize: 13 }}>{message}</div>}

            {/* ประเภท */}
            <div style={row}>
              <label style={labelStyle}>ประเภท</label>
              <div style={{ display: "flex", gap: 16 }}>
                {["ปกติ", "สั่งเพิ่ม"].map(t => (
                  <label key={t} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                    <input type="radio" name="order_type" checked={form.order_type === t} onChange={() => handleTypeChange(t)} />
                    สั่งซื้อ{t}
                  </label>
                ))}
              </div>
            </div>

            {/* ถ้าปกติ: เลือกมัดจำ */}
            {form.order_type === "ปกติ" && (
              <div style={row}>
                <label style={labelStyle}>เลขที่มัดจำ</label>
                <select
                  value={form.deposit_doc_no}
                  onChange={e => handleDepositSelect(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">-- เลือกใบมัดจำ --</option>
                  {(() => {
                    // filter ก่อน แล้วเลือกใบเก่าสุดต่อลูกค้า
                    const eligible = deposits.filter(d =>
                      !orders.some(o => o.deposit_doc_no === d.deposit_doc_no)
                      && !orders.some(o => o.customer_code === d.customer_code && o.status !== "ปิดงานซ่อม")
                      && !repairDeposits.some(rd => rd.deposit_doc_no === d.deposit_doc_no)
                    );
                    // จัดกลุ่มตามลูกค้า เลือกใบเก่าสุด (วันที่น้อยสุด)
                    const byCustomer = {};
                    for (const d of eligible) {
                      const key = d.customer_code;
                      if (!byCustomer[key] || new Date(d.deposit_date) < new Date(byCustomer[key].deposit_date)) {
                        byCustomer[key] = d;
                      }
                    }
                    return Object.values(byCustomer);
                  })().map(d => (
                    <option key={d.deposit_doc_no} value={d.deposit_doc_no}>
                      {d.deposit_doc_no} | {d.customer_name} | คงเหลือ {fmt(d.remaining_amount)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ถ้าสั่งเพิ่ม: เลือกใบมัดจำที่ 2 (ลูกค้าที่สั่งไปแล้ว) */}
            {form.order_type === "สั่งเพิ่ม" && (
              <div style={row}>
                <label style={labelStyle}>เลขที่มัดจำ (เพิ่ม)</label>
                <select
                  value={form.deposit_doc_no}
                  onChange={e => handleAddDepositSelect(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">-- เลือกใบมัดจำเพิ่ม --</option>
                  {deposits
                    .filter(d =>
                      // ลูกค้ามีงานเดิมที่ยังไม่ปิด
                      orders.some(o => o.customer_code === d.customer_code && o.status !== "ปิดงานซ่อม")
                      // ใบมัดจำนี้ยังไม่ถูกสั่งซื้อ
                      && !orders.some(o => o.deposit_doc_no === d.deposit_doc_no)
                      // ไม่ใช่ตีราคาซ่อม
                      && !repairDeposits.some(rd => rd.deposit_doc_no === d.deposit_doc_no)
                      // มียอดคงเหลือ
                      && Number(d.remaining_amount || 0) > 0
                    )
                    .map(d => (
                      <option key={d.deposit_doc_no} value={d.deposit_doc_no}>
                        {d.deposit_doc_no} | {d.customer_name} | คงเหลือ {fmt(d.remaining_amount)}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* ข้อมูลลูกค้า (auto fill) */}
            {form.deposit_doc_no && (
              <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
                <div><b>ลูกค้า:</b> {form.customer_code} - {form.customer_name}</div>
                {form.vin && <div><b>เลขตัวถัง:</b> {form.vin}</div>}
                <div><b>ยอดมัดจำคงเหลือ:</b> <span style={{ color: "#072d6b", fontWeight: 700 }}>{fmt(form.deposit_amount)}</span></div>
              </div>
            )}

            {/* เบอร์โทรลูกค้า */}
            <div style={row}>
              <label style={labelStyle}>เบอร์โทร</label>
              <input
                value={form.customer_phone}
                onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))}
                placeholder="เบอร์โทรลูกค้า"
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>

            {/* ทะเบียนรถ */}
            <div style={row}>
              <label style={labelStyle}>ทะเบียนรถ</label>
              <input
                value={form.license_plate}
                onChange={e => setForm(p => ({ ...p, license_plate: e.target.value }))}
                placeholder="ทะเบียนรถ"
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>

            {/* ช่าง */}
            <div style={row}>
              <label style={labelStyle}>ช่าง</label>
              {form.deposit_doc_no && !form.deposit_doc_no.startsWith("DEPD") ? (
                <input
                  value={form.technician}
                  readOnly
                  style={{ ...inputStyle, flex: 1, background: "#f8fafc" }}
                />
              ) : (
                <select
                  value={form.technician}
                  onChange={e => setForm(p => ({ ...p, technician: e.target.value }))}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">-- เลือกช่าง --</option>
                  {techs.map(u => (
                    <option key={u.user_id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* รุ่นรถ */}
            <div style={row}>
              <label style={labelStyle}>รุ่นรถ</label>
              <select
                value={form.model_name}
                onChange={e => setForm(p => ({ ...p, model_name: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}
              >
                <option value="">-- เลือกรุ่นรถ --</option>
                {models.map((m, i) => (
                  <option key={i} value={m.marketing_name || m.name}>{m.marketing_name || m.name}</option>
                ))}
              </select>
            </div>

            {/* สถานะจอดรถ */}
            <div style={row}>
              <label style={labelStyle}>สถานะ</label>
              <div style={{ display: "flex", gap: 16 }}>
                {["จอดร้าน", "ไม่จอดร้าน"].map(s => (
                  <label key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                    <input type="radio" name="parking" checked={form.parking_status === s} onChange={() => setForm(p => ({ ...p, parking_status: s }))} />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            {/* รายการอะไหล่ */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontWeight: 600, fontSize: 14, color: "#072d6b" }}>รายการอะไหล่</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <div ref={ocrMenuRef} style={{ position: "relative", display: "inline-block" }}>
                    <button onClick={() => setOcrMenuOpen(!ocrMenuOpen)} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>
                      ดึงข้อมูล OCR ▾
                    </button>
                    {ocrMenuOpen && (
                      <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 100, minWidth: 160, overflow: "hidden" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, color: "#334155", borderBottom: "1px solid #f1f5f9" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                          onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                          📄 ไฟล์ PDF
                          <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={e => handleOCR(e, "pdf")} />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, color: "#334155" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                          onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                          🖼️ รูปภาพ
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleOCR(e, "image")} />
                        </label>
                      </div>
                    )}
                  </div>
                  <button onClick={addItem} style={{ background: "#072d6b", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>+ เพิ่มรายการ</button>
                </div>
              </div>
              {ocrLoading && <div style={{ color: "#f59e0b", fontSize: 12, marginBottom: 8 }}>กำลังประมวลผล OCR...</div>}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ ...th, width: "5%", textAlign: "center" }}>#</th>
                    <th style={{ ...th, width: "23%" }}>รหัสสินค้า</th>
                    <th style={{ ...th, width: "47%" }}>ชื่ออะไหล่</th>
                    <th style={{ ...th, width: "15%", textAlign: "center" }}>จำนวน</th>
                    <th style={{ ...th, width: "10%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 4, textAlign: "center", fontSize: 12, color: "#6b7280" }}>{idx + 1}</td>
                      <td style={{ padding: 4 }}>
                        <input value={it.part_code} onChange={e => updateItem(idx, "part_code", e.target.value.toUpperCase())} placeholder="รหัสสินค้า" style={{ ...inputStyle, width: "100%", fontSize: 12 }} />
                      </td>
                      <td style={{ padding: 4 }}>
                        <input value={it.part_name} onChange={e => updateItem(idx, "part_name", e.target.value)} placeholder="ชื่ออะไหล่" style={{ ...inputStyle, width: "100%", fontSize: 12 }} />
                      </td>
                      <td style={{ padding: 4 }}>
                        <input type="number" min={1} value={it.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} style={{ ...inputStyle, width: "100%", textAlign: "center", fontSize: 12 }} />
                      </td>
                      <td style={{ padding: 4, textAlign: "center" }}>
                        <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: 16 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ปุ่มบันทึก */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "8px 20px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: "8px 24px", fontSize: 13 }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal ดูรายละเอียด ===== */}
      {showDetail && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>ใบสั่งซื้อ {showDetail.order_no || `#${showDetail.order_id}`}</h3>
              <button onClick={() => setShowDetail(null)} style={closeBtn}>&times;</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", fontSize: 13, marginBottom: 16 }}>
              <div><b>ประเภท:</b> สั่งซื้อ{showDetail.order_type}</div>
              {showDetail.ref_order_id && <div><b>อ้างอิงใบ:</b> #{showDetail.ref_order_id}</div>}
              <div><b>เลขมัดจำ:</b> {showDetail.deposit_doc_no}</div>
              <div><b>ลูกค้า:</b> {showDetail.customer_code} - {showDetail.customer_name}</div>
              <div><b>VIN:</b> {showDetail.vin}</div>
              <div><b>ยอดมัดจำ:</b> {fmt(showDetail.deposit_amount)}</div>
              <div><b>ช่าง:</b> {showDetail.technician}</div>
              <div><b>รุ่นรถ:</b> {showDetail.model_name}</div>
              <div><b>เบอร์โทร:</b> {showDetail.customer_phone || "-"}</div>
              <div><b>ทะเบียนรถ:</b> {showDetail.license_plate || "-"}</div>
              <div><b>สถานะจอด:</b> {showDetail.parking_status}</div>
              <div><b>สถานะ:</b> {showDetail.status}</div>
              {showDetail.vendor_po_no && <div><b>เลขที่ใบรับสั่งซื้อ:</b> <span style={{ color: "#10b981", fontWeight: 700 }}>{showDetail.vendor_po_no}</span></div>}
              {showDetail.job_no && <div><b>เลขที่ Job:</b> <span style={{ color: "#7c3aed", fontWeight: 700 }}>{showDetail.job_no}</span></div>}
              {showDetail.appointment_date && <div><b>วันที่นัดหมาย:</b> {fmtDate(showDetail.appointment_date)}</div>}
              <div><b>ผู้สร้าง:</b> {showDetail.created_by}</div>
              <div><b>วันที่:</b> {fmtDate(showDetail.created_at)}</div>
            </div>

            <label style={{ fontWeight: 600, fontSize: 14, color: "#072d6b" }}>รายการอะไหล่</label>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={th}>#</th>
                  <th style={th}>รหัสสินค้า</th>
                  <th style={th}>ชื่ออะไหล่</th>
                  <th style={{ ...th, textAlign: "center" }}>จำนวน</th>
                  <th style={{ ...th, textAlign: "center" }}>สต๊อก</th>
                </tr>
              </thead>
              <tbody>
                {(showDetail.items || []).length === 0 ? (
                  <tr><td colSpan={5} style={center}>ไม่มีรายการ</td></tr>
                ) : showDetail.items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}>{it.part_code}</td>
                    <td style={td}>{it.part_name}</td>
                    <td style={{ ...td, textAlign: "center" }}>{it.quantity}</td>
                    <td style={{ ...td, textAlign: "center", color: it.stock_qty > 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>{it.stock_qty != null ? it.stock_qty : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* รายการอะไหล่ค้างส่ง DCS */}
            {showDetail.boItems && showDetail.boItems.length > 0 && (
              <div style={{ marginTop: 16, padding: 12, background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8 }}>
                <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8 }}>⚠ อะไหล่ค้างส่ง DCS ({showDetail.boItems.length} รายการ)</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#fde68a" }}>
                      <th style={th}>#</th>
                      <th style={th}>รหัสสินค้า</th>
                      <th style={th}>ชื่ออะไหล่</th>
                      <th style={{ ...th, textAlign: "center" }}>ค้างส่ง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showDetail.boItems.map((bo, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #fde68a" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={td}>{bo.part_number}</td>
                        <td style={td}>{bo.part_description}</td>
                        <td style={{ ...td, textAlign: "center", color: "#dc2626", fontWeight: 700 }}>{bo.backorder_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ตรวจสอบสถานะ DCS */}
            {showDetail.vendor_po_no && (
              <div style={{ marginTop: 16 }}>
                {!showDetail.dcsStatus ? (
                  <div></div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <label style={{ fontWeight: 600, fontSize: 14, color: "#072d6b" }}>สถานะ DCS ({showDetail.vendor_po_no})</label>
                      <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: showDetail.dcsStatus.allCorrect ? "#dbeafe" : "#fee2e2", color: showDetail.dcsStatus.allCorrect ? "#1e40af" : "#991b1b" }}>
                        {showDetail.dcsStatus.allCorrect ? "สั่งซื้อถูกต้อง" : "ไม่ถูกต้อง"}
                      </span>
                    </div>
                    {showDetail.dcsStatus.invalidDcs && showDetail.dcsStatus.invalidDcs.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, color: "#991b1b", fontWeight: 600, marginBottom: 4 }}>รายการที่ไม่ตรงกัน (ใบสั่งซื้อ vs DCS):</div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "#fee2e2" }}>
                              <th style={th}>#</th>
                              <th style={th}>รหัสใบสั่งซื้อ</th>
                              <th style={th}>ชื่อ (ใบสั่งซื้อ)</th>
                              <th style={th}>→</th>
                              <th style={th}>รหัส DCS</th>
                              <th style={th}>ชื่อ (DCS)</th>
                              <th style={{ ...th, textAlign: "center" }}>จำนวน</th>
                            </tr>
                          </thead>
                          <tbody>
                            {showDetail.dcsStatus.invalidDcs.map((d, i) => {
                              const unmatched = showDetail.dcsStatus.unmatchedOrders || [];
                              const stripCode = s => (s || "").replace(/-/g, "").toUpperCase().trim();
                              const dcsPrefix = stripCode(d.part_number).slice(0, -2);
                              const orderItem = unmatched.find(it => stripCode(it.part_code).slice(0, -2) === dcsPrefix)
                                || unmatched.find(it => (it.part_name || "").toLowerCase().includes((d.part_description || "").toLowerCase().substring(0, 4)))
                                || unmatched[i] || {};
                              return (
                                <tr key={i} style={{ borderBottom: "1px solid #fecaca" }}>
                                  <td style={td}>{i + 1}</td>
                                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#1e40af" }}>{orderItem.part_code || "-"}</td>
                                  <td style={td}>{orderItem.part_name || "-"}</td>
                                  <td style={{ ...td, textAlign: "center", fontSize: 14 }}>→</td>
                                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#991b1b" }}>{d.part_number}</td>
                                  <td style={td}>{d.part_description}</td>
                                  <td style={{ ...td, textAlign: "center" }}>{d.order_qty}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {/* ปุ่มอนุมัติ / ไม่อนุมัติ */}
                    {!showDetail.dcsStatus.allCorrect && !showDetail.dcsStatus.approved && !showDetail.alreadyApproved && (
                      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                        <button onClick={handleApproveSubstitute}
                          style={{ padding: "8px 20px", fontSize: 13, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                          อนุมัติ (อะไหล่ใช้แทนกัน)
                        </button>
                        <button onClick={handleRejectSubstitute}
                          style={{ padding: "8px 20px", fontSize: 13, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                          ไม่อนุมัติ
                        </button>
                      </div>
                    )}
                    {(showDetail.dcsStatus.approved || showDetail.alreadyApproved) && (
                      <div style={{ marginTop: 12, padding: "8px 14px", background: "#d1fae5", borderRadius: 8, fontSize: 13, color: "#065f46", fontWeight: 600 }}>
                        อนุมัติแล้ว - บันทึกเป็นอะไหล่ใช้แทนกัน
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              {showDetail.vendor_po_no && !showDetail.dcsStatus && (
                <button type="button" onClick={() => checkDCSStatus()} style={{ padding: "8px 20px", fontSize: 13, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>ตรวจสอบสถานะ DCS</button>
              )}
              <button type="button" onClick={() => printOrder(showDetail)} style={{ padding: "8px 20px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>พิมพ์ใบสั่งซื้อ</button>
              <button type="button" onClick={() => setShowDetail(null)} style={{ padding: "8px 20px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal บันทึกเลขที่ใบรับสั่งซื้อ ===== */}
      {showPOModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0, color: "#072d6b" }}>บันทึกการสั่งซื้อ</h3>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
              <div>ใบสั่งซื้อ: <b>{showPOModal.order_no || `#${showPOModal.order_id}`}</b></div>
              <div>ลูกค้า: <b>{showPOModal.customer_name}</b></div>
              <div>เลขมัดจำ: <b>{showPOModal.deposit_doc_no}</b></div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>เลขที่ใบรับการสั่งซื้อ (Vendor) *</label>
              <input value={poNumber} onChange={e => setPoNumber(e.target.value)}
                placeholder="เลขที่ใบรับจาก Vendor"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleConfirmOrder} disabled={savingPO}
                style={{ flex: 1, padding: "9px 0", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {savingPO ? "กำลังบันทึก..." : "ยืนยันสั่งซื้อ"}
              </button>
              <button onClick={() => { setShowPOModal(null); setPoNumber(""); }}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal เปิดงาน / นัดหมาย ===== */}
      {showJobModal && (() => {
        const isDEPD = (showJobModal.deposit_doc_no || "").startsWith("DEPD");
        return (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: 420 }}>
            <h3 style={{ margin: "0 0 16px", color: "#072d6b" }}>{isDEPD ? "เปิดงาน" : "นัดหมาย"} - {showJobModal.order_no || showJobModal.order_id}</h3>
            {message && <div style={{ color: "#b91c1c", marginBottom: 8, fontSize: 13 }}>{message}</div>}
            {isDEPD && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>เลขที่ใบงาน</label>
              <input value={jobNumber} onChange={e => setJobNumber(e.target.value)} placeholder="กรอกเลขที่ใบงาน" style={{ ...inputStyle, width: "100%" }} />
            </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>วันที่นัดหมาย</label>
              <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSaveJob} disabled={savingJob}
                style={{ flex: 1, padding: "9px 0", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {savingJob ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => { setShowJobModal(null); setJobNumber(""); setAppointmentDate(""); }}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ===== Modal บันทึกมัดจำตีราคาซ่อม ===== */}
      {showRepairModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0, color: "#8b5cf6" }}>บันทึกมัดจำตีราคาซ่อม</h3>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>เลือกใบมัดจำ *</label>
              <select value={repairDocNo} onChange={e => setRepairDocNo(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}>
                <option value="">-- เลือกใบมัดจำ --</option>
                {deposits
                  .filter(d => !repairDeposits.some(rd => rd.deposit_doc_no === d.deposit_doc_no)
                    && !orders.some(o => o.deposit_doc_no === d.deposit_doc_no))
                  .map(d => (
                    <option key={d.deposit_doc_no} value={d.deposit_doc_no}>
                      {d.deposit_doc_no} | {d.customer_name} | {fmt(d.deposit_amount)}
                    </option>
                  ))}
              </select>
            </div>

            {repairDocNo && (() => {
              const dep = deposits.find(d => d.deposit_doc_no === repairDocNo);
              return dep ? (
                <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
                  <div><b>ลูกค้า:</b> {dep.customer_name}</div>
                  <div><b>ยอดมัดจำ:</b> {fmt(dep.deposit_amount)}</div>
                  <div><b>คงเหลือ:</b> {fmt(dep.remaining_amount)}</div>
                </div>
              ) : null;
            })()}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>เลขที่ใบประเมิน *</label>
              <input value={estimateNo} onChange={e => setEstimateNo(e.target.value)}
                placeholder="กรอกเลขที่ใบประเมิน"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSaveRepairDeposit} disabled={savingRepair}
                style={{ flex: 1, padding: "9px 0", background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {savingRepair ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => setShowRepairModal(false)}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12 };
const td = { padding: "8px", whiteSpace: "nowrap" };
const center = { textAlign: "center", padding: 24, color: "#9ca3af" };
const fmt = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
const inputStyle = { padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 };
const labelStyle = { fontWeight: 600, fontSize: 13, minWidth: 120, color: "#374151" };
const row = { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: 40, zIndex: 999, overflow: "auto" };
const modal = { background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 800, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", marginBottom: 40 };
const closeBtn = { background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#6b7280" };

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear() + 543;
  return `${dd}/${mm}/${yy}`;
}
