import React, { useEffect, useState } from "react";

const API = "https://n8n-new-project-gwf2.onrender.com/webhook/outside-deposit-api";
const PAGE_SIZE = 15;

async function api(action, extra = {}) {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    return await res.json();
  } catch (e) {
    console.error("api error", action, e);
    return null;
  }
}

function norm(d) {
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.rows)) return d.rows;
  return [];
}

const emptyItem = () => ({ part_code: "", part_name: "", quantity: 1 });

const emptyForm = () => ({
  order_id: null,
  doc_no: "",
  customer_name: "",
  customer_phone: "",
  job_no: "",
  technician: "",
  model_name: "",
  status: "รอดำเนินการ",
  items: [emptyItem()],
});

export default function OutsideDepositOrderPage({ currentUser }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState(null); // {order, items}

  const loadOrders = async () => {
    setLoading(true);
    const res = await api("get_orders");
    setOrders(norm(res));
    setLoading(false);
  };

  useEffect(() => { loadOrders(); }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = async (o) => {
    const res = await api("get_order_detail", { order_id: o.order_id });
    const items = norm(res);
    setForm({
      order_id: o.order_id,
      doc_no: o.doc_no || "",
      customer_name: o.customer_name || "",
      customer_phone: o.customer_phone || "",
      job_no: o.job_no || "",
      technician: o.technician || "",
      model_name: o.model_name || "",
      status: o.status || "รอดำเนินการ",
      items: items.length ? items.map(i => ({
        part_code: i.part_code || "",
        part_name: i.part_name || "",
        quantity: Number(i.quantity) || 1,
      })) : [emptyItem()],
    });
    setShowForm(true);
  };

  const openDetail = async (o) => {
    const res = await api("get_order_detail", { order_id: o.order_id });
    setDetail({ order: o, items: norm(res) });
  };

  const updateItem = (idx, key, val) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [key]: val };
      return { ...f, items };
    });
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx) => setForm(f => ({
    ...f,
    items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items,
  }));

  const save = async () => {
    if (!form.customer_name.trim()) {
      alert("กรุณากรอกชื่อลูกค้า");
      return;
    }
    const validItems = form.items.filter(i => (i.part_code || i.part_name));
    if (!validItems.length) {
      alert("กรุณาเพิ่มรายการอะไหล่อย่างน้อย 1 รายการ");
      return;
    }
    setSaving(true);
    const action = form.order_id ? "update_order" : "save_order";
    const payload = {
      ...form,
      items: validItems,
      created_by: currentUser?.name || "",
      branch: currentUser?.branch || "",
    };
    const res = await api(action, payload);
    setSaving(false);
    if (res && (res.success || res.ok || res.order_id || res.status === "ok")) {
      setShowForm(false);
      await loadOrders();
    } else {
      alert("บันทึกไม่สำเร็จ");
    }
  };

  const remove = async (o) => {
    if (!window.confirm(`ลบใบสั่งซื้อ ${o.doc_no || o.order_id}?`)) return;
    const res = await api("delete_order", { order_id: o.order_id });
    if (res && (res.success || res.ok || res.status === "ok")) {
      await loadOrders();
    } else {
      alert("ลบไม่สำเร็จ");
    }
  };

  const filtered = orders.filter(o => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (o.doc_no || "").toLowerCase().includes(s) ||
      (o.customer_name || "").toLowerCase().includes(s) ||
      (o.customer_phone || "").toLowerCase().includes(s) ||
      (o.job_no || "").toLowerCase().includes(s) ||
      (o.technician || "").toLowerCase().includes(s) ||
      (o.model_name || "").toLowerCase().includes(s)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageData = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">ระบบสั่งซื้ออะไหล่นอกเงินมัดจำ</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="ค้นหา เลขที่ / ลูกค้า / เบอร์ / ใบงาน / ช่าง / รุ่นรถ"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ minWidth: 320 }}
          />
          <button className="btn-primary" onClick={openCreate}>+ สร้างใบสั่งซื้อ</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>กำลังโหลด...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>เลขที่ใบสั่งซื้อ</th>
                <th>ชื่อลูกค้า</th>
                <th>เบอร์โทรศัพท์</th>
                <th>เลขที่ใบงาน/ใบขาย</th>
                <th>ช่างซ่อม</th>
                <th>รุ่นรถ</th>
                <th>สถานะ</th>
                <th>วันที่สร้าง</th>
                <th style={{ width: 200 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 16 }}>ไม่มีข้อมูล</td></tr>
              ) : pageData.map(o => (
                <tr key={o.order_id}>
                  <td>{o.doc_no || "-"}</td>
                  <td>{o.customer_name || "-"}</td>
                  <td>{o.customer_phone || "-"}</td>
                  <td>{o.job_no || "-"}</td>
                  <td>{o.technician || "-"}</td>
                  <td>{o.model_name || "-"}</td>
                  <td>{o.status || "-"}</td>
                  <td>{o.created_at ? String(o.created_at).slice(0, 16).replace("T", " ") : "-"}</td>
                  <td>
                    <button className="btn-sm" onClick={() => openDetail(o)}>ดู</button>{" "}
                    <button className="btn-sm" onClick={() => openEdit(o)}>แก้ไข</button>{" "}
                    <button className="btn-sm" style={{ color: "#dc2626" }} onClick={() => remove(o)}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: 12 }}>
            <button className="btn-sm" disabled={curPage <= 1} onClick={() => setPage(p => p - 1)}>ก่อนหน้า</button>
            <span style={{ alignSelf: "center" }}>{curPage} / {totalPages}</span>
            <button className="btn-sm" disabled={curPage >= totalPages} onClick={() => setPage(p => p + 1)}>ถัดไป</button>
          </div>
        )}
      </div>

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={form.order_id ? "แก้ไขใบสั่งซื้อ" : "สร้างใบสั่งซื้อใหม่"}>
          <div className="form-grid">
            <Field label="เลขที่ใบสั่งซื้อ">
              <input className="input" value={form.doc_no} onChange={e => setForm(f => ({ ...f, doc_no: e.target.value }))} placeholder="ปล่อยว่างเพื่อให้ระบบสร้างอัตโนมัติ" />
            </Field>
            <Field label="ชื่อลูกค้า *">
              <input className="input" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
            </Field>
            <Field label="เบอร์โทรศัพท์">
              <input className="input" value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} />
            </Field>
            <Field label="เลขที่ใบงาน/ใบขาย">
              <input className="input" value={form.job_no} onChange={e => setForm(f => ({ ...f, job_no: e.target.value }))} />
            </Field>
            <Field label="ช่างซ่อม">
              <input className="input" value={form.technician} onChange={e => setForm(f => ({ ...f, technician: e.target.value }))} />
            </Field>
            <Field label="รุ่นรถ">
              <input className="input" value={form.model_name} onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))} />
            </Field>
          </div>

          <div style={{ marginTop: 16, fontWeight: 600 }}>รายการอะไหล่</div>
          <table className="data-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>รหัสสินค้า</th>
                <th>ชื่ออะไหล่</th>
                <th style={{ width: 100 }}>จำนวน</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td><input className="input" value={it.part_code} onChange={e => updateItem(idx, "part_code", e.target.value)} placeholder="รหัสสินค้า" /></td>
                  <td><input className="input" value={it.part_name} onChange={e => updateItem(idx, "part_name", e.target.value)} placeholder="ชื่ออะไหล่" /></td>
                  <td><input className="input" type="number" min={1} value={it.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value) || 0)} /></td>
                  <td>
                    <button className="btn-sm" style={{ color: "#dc2626" }} onClick={() => removeItem(idx)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8 }}>
            <button className="btn-sm" onClick={addItem}>+ เพิ่มรายการ</button>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button className="btn-sm" onClick={() => setShowForm(false)}>ยกเลิก</button>
            <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal onClose={() => setDetail(null)} title={`ใบสั่งซื้อ ${detail.order.doc_no || detail.order.order_id}`}>
          <div className="form-grid">
            <Info label="ชื่อลูกค้า" value={detail.order.customer_name} />
            <Info label="เบอร์โทรศัพท์" value={detail.order.customer_phone} />
            <Info label="เลขที่ใบงาน/ใบขาย" value={detail.order.job_no} />
            <Info label="ช่างซ่อม" value={detail.order.technician} />
            <Info label="รุ่นรถ" value={detail.order.model_name} />
            <Info label="สถานะ" value={detail.order.status} />
          </div>
          <div style={{ marginTop: 16, fontWeight: 600 }}>รายการอะไหล่</div>
          <table className="data-table" style={{ marginTop: 8 }}>
            <thead>
              <tr><th>#</th><th>รหัสสินค้า</th><th>ชื่ออะไหล่</th><th>จำนวน</th></tr>
            </thead>
            <tbody>
              {detail.items.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center" }}>ไม่มีรายการ</td></tr>
              ) : detail.items.map((it, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{it.part_code || "-"}</td>
                  <td>{it.part_name || "-"}</td>
                  <td>{it.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 8, padding: 20,
        maxWidth: 900, width: "92%", maxHeight: "90vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn-sm" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 13, color: "#555" }}>{label}</label>
      {children}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#777" }}>{label}</div>
      <div style={{ fontWeight: 500 }}>{value || "-"}</div>
    </div>
  );
}
