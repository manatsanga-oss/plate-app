import React, { useEffect, useState } from "react";

const API = "https://n8n-new-project-gwf2.onrender.com/webhook/outside-deposit-api";
const SPARE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api";
const USER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/office-login";
const PAGE_SIZE = 15;

async function callApi(url, action, extra = {}) {
  try {
    const res = await fetch(url, {
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
const api = (action, extra) => callApi(API, action, extra);

function norm(d) {
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.rows)) return d.rows;
  return [];
}

function isOk(res) {
  const r = Array.isArray(res) ? res[0] : res;
  if (!r) return false;
  return !!(r.success || r.ok || r.order_id || r.status === "ok");
}

const emptyItem = () => ({ part_code: "", part_name: "", quantity: 1 });

const emptyForm = () => ({
  order_id: null,
  doc_no: "",
  customer_name: "",
  customer_phone: "",
  license_plate: "",
  job_no: "",
  technician: "",
  model_name: "",
  parking_status: "จอดร้าน",
  status: "รอดำเนินการ",
  note: "",
  items: [emptyItem()],
});

export default function OutsideDepositOrderPage({ currentUser }) {
  const [orders, setOrders] = useState([]);
  const [techs, setTechs] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [detail, setDetail] = useState(null);

  const loadOrders = async () => {
    setLoading(true);
    const res = await api("get_orders");
    setOrders(norm(res));
    setLoading(false);
  };

  const loadDropdowns = async () => {
    try {
      const r = await callApi(SPARE_API, "get_car_model_names");
      setModels(norm(r));
    } catch {}
    try {
      const r = await fetch(USER_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_users" }),
      }).then(res => res.json());
      const allUsers = norm(r);
      const myBranch = currentUser?.branch || "";
      setTechs(allUsers.filter(u => u.branch === myBranch && (u.position || "").includes("ช่าง")));
    } catch {}
  };

  useEffect(() => { loadOrders(); loadDropdowns(); }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setMessage("");
    setShowForm(true);
  };

  const openEdit = async (o) => {
    if ((o.status || "").includes("อนุมัติ")) {
      alert("ใบสั่งซื้อนี้อนุมัติแล้ว ไม่สามารถแก้ไขได้");
      return;
    }
    const res = await api("get_order_detail", { order_id: o.order_id });
    const items = norm(res);
    setForm({
      order_id: o.order_id,
      doc_no: o.doc_no || "",
      customer_name: o.customer_name || "",
      customer_phone: o.customer_phone || "",
      license_plate: o.license_plate || "",
      job_no: o.job_no || "",
      technician: o.technician || "",
      model_name: o.model_name || "",
      parking_status: o.parking_status || "จอดร้าน",
      status: o.status || "รอดำเนินการ",
      note: o.note || "",
      items: items.length ? items.map(i => ({
        part_code: i.part_code || "",
        part_name: i.part_name || "",
        quantity: Number(i.quantity) || 1,
      })) : [emptyItem()],
    });
    setMessage("");
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
    if (!form.customer_name.trim()) { setMessage("กรุณากรอกชื่อลูกค้า"); return; }
    if (!form.technician.trim()) { setMessage("กรุณาเลือกช่าง"); return; }
    if (!form.model_name) { setMessage("กรุณาเลือกรุ่นรถ"); return; }
    const validItems = form.items.filter(i => (i.part_code || i.part_name));
    if (!validItems.length) { setMessage("กรุณาเพิ่มรายการอะไหล่อย่างน้อย 1 รายการ"); return; }

    setSaving(true);
    setMessage("");
    const action = form.order_id ? "update_order" : "save_order";
    const payload = {
      ...form,
      items: validItems,
      created_by: currentUser?.name || "",
      branch: currentUser?.branch || "",
    };
    const res = await api(action, payload);
    setSaving(false);
    if (isOk(res)) {
      setShowForm(false);
      await loadOrders();
    } else {
      setMessage("บันทึกไม่สำเร็จ");
    }
  };

  const printOrder = async (o) => {
    const res = await api("get_order_detail", { order_id: o.order_id });
    const items = norm(res);
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const rows = items.map((it, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${it.part_code || "-"}</td>
        <td>${it.part_name || "-"}</td>
        <td style="text-align:center">${it.quantity || 0}</td>
      </tr>`).join("");
    w.document.write(`
      <html><head><meta charset="utf-8"><title>${o.doc_no || ""}</title>
      <style>
        body{font-family:'Tahoma',sans-serif;padding:20px;font-size:14px;}
        h2{text-align:center;margin:0 0 16px;}
        table{width:100%;border-collapse:collapse;margin-top:12px;}
        th,td{border:1px solid #333;padding:6px 8px;}
        th{background:#eee;}
        .info{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin-top:8px;}
        .info div{padding:2px 0;}
        .label{color:#555;font-weight:bold;}
      </style></head><body>
      <h2>ใบสั่งซื้ออะไหล่นอกเงินมัดจำ</h2>
      <div><span class="label">เลขที่ใบสั่งซื้อ:</span> ${o.doc_no || "-"}</div>
      <div><span class="label">วันที่:</span> ${o.created_at ? String(o.created_at).slice(0, 16).replace("T", " ") : "-"}</div>
      <div class="info">
        <div><span class="label">ชื่อลูกค้า:</span> ${o.customer_name || "-"}</div>
        <div><span class="label">เบอร์โทร:</span> ${o.customer_phone || "-"}</div>
        <div><span class="label">ทะเบียนรถ:</span> ${o.license_plate || "-"}</div>
        <div><span class="label">ใบงาน/ใบขาย:</span> ${o.job_no || "-"}</div>
        <div><span class="label">ช่าง:</span> ${o.technician || "-"}</div>
        <div><span class="label">รุ่นรถ:</span> ${o.model_name || "-"}</div>
        <div><span class="label">สถานะจอด:</span> ${o.parking_status || "-"}</div>
        <div><span class="label">สถานะ:</span> ${o.status || "-"}</div>
      </div>
      <table>
        <thead><tr><th style="width:40px">#</th><th>รหัสสินค้า</th><th>ชื่ออะไหล่</th><th style="width:80px">จำนวน</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" style="text-align:center">ไม่มีรายการ</td></tr>'}</tbody>
      </table>
      <div style="margin-top:40px;display:flex;justify-content:space-around;">
        <div style="text-align:center">.................................<br/>ผู้สั่งซื้อ</div>
        <div style="text-align:center">.................................<br/>ผู้อนุมัติ</div>
      </div>
      <script>window.onload=()=>window.print();</script>
      </body></html>`);
    w.document.close();
  };

  const approve = async (o) => {
    if (!window.confirm(`อนุมัติใบสั่งซื้อ ${o.doc_no || o.order_id}? (หลังอนุมัติจะแก้ไข/ลบไม่ได้)`)) return;
    const res = await api("approve_order", {
      order_id: o.order_id,
      approved_by: currentUser?.name || "",
    });
    if (isOk(res)) {
      await loadOrders();
    } else {
      alert("อนุมัติไม่สำเร็จ");
    }
  };

  const isApproved = (o) => (o.status || "").includes("อนุมัติ");

  const remove = async (o) => {
    if (isApproved(o)) { alert("ใบสั่งซื้อนี้อนุมัติแล้ว ไม่สามารถลบได้"); return; }
    if (!window.confirm(`ลบใบสั่งซื้อ ${o.doc_no || o.order_id}?`)) return;
    const res = await api("delete_order", { order_id: o.order_id });
    if (isOk(res)) {
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
      (o.license_plate || "").toLowerCase().includes(s) ||
      (o.job_no || "").toLowerCase().includes(s) ||
      (o.technician || "").toLowerCase().includes(s) ||
      (o.model_name || "").toLowerCase().includes(s)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageData = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  // ===== styles =====
  const labelStyle = { fontWeight: 600, color: "#333", textAlign: "right", paddingRight: 12, alignSelf: "center" };
  const rowStyle = { display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, marginBottom: 12, alignItems: "center" };
  const inputStyle = {
    width: "100%", padding: "8px 12px", borderRadius: 6,
    border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box",
  };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">ระบบสั่งซื้ออะไหล่นอกเงินมัดจำ</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...inputStyle, minWidth: 320 }}
            placeholder="ค้นหา เลขที่ / ลูกค้า / เบอร์ / ทะเบียน / ใบงาน / ช่าง / รุ่นรถ"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <button className="btn-primary" onClick={openCreate}>+ สร้างใบสั่งซื้อ</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>กำลังโหลด...</div>
        ) : (
          <table className="data-table" style={{ whiteSpace: "nowrap", width: "100%" }}>
            <thead>
              <tr>
                <th>เลขที่ใบสั่งซื้อ</th>
                <th>ชื่อลูกค้า</th>
                <th>เบอร์โทร</th>
                <th>ทะเบียนรถ</th>
                <th>ใบงาน/ใบขาย</th>
                <th>ช่าง</th>
                <th>รุ่นรถ</th>
                <th>จอด</th>
                <th>สถานะ</th>
                <th>วันที่</th>
                <th style={{ width: 200 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: "center", padding: 16 }}>ไม่มีข้อมูล</td></tr>
              ) : pageData.map(o => (
                <tr key={o.order_id}>
                  <td>{o.doc_no || "-"}</td>
                  <td>{o.customer_name || "-"}</td>
                  <td>{o.customer_phone || "-"}</td>
                  <td>{o.license_plate || "-"}</td>
                  <td>{o.job_no || "-"}</td>
                  <td>{(o.technician || "-").split(" ")[0]}</td>
                  <td>{o.model_name || "-"}</td>
                  <td>{o.parking_status || "-"}</td>
                  <td>{o.status || "-"}</td>
                  <td>{o.created_at ? String(o.created_at).slice(0, 16).replace("T", " ") : "-"}</td>
                  <td>
                    <button className="btn-sm" onClick={() => openDetail(o)}>ดู</button>{" "}
                    <button className="btn-sm" disabled={isApproved(o)} onClick={() => openEdit(o)}>แก้ไข</button>{" "}
                    <button className="btn-sm" disabled={isApproved(o)}
                      style={{ color: isApproved(o) ? "#999" : "#fff", background: isApproved(o) ? "#e5e7eb" : "#10b981", border: "none" }}
                      onClick={() => approve(o)}>
                      {isApproved(o) ? "✓ บันทึกแล้ว" : "📝 บันทึกใบสั่งซื้อ"}
                    </button>{" "}
                    <button className="btn-sm" disabled={isApproved(o)} style={{ color: isApproved(o) ? "#999" : "#dc2626" }} onClick={() => remove(o)}>ลบ</button>
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
          {/* Header form */}
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            {form.order_id && form.doc_no && (
              <div style={rowStyle}>
                <label style={labelStyle}>เลขที่ใบสั่งซื้อ</label>
                <div style={{ fontWeight: 600 }}>{form.doc_no}</div>
              </div>
            )}

            <div style={rowStyle}>
              <label style={labelStyle}>ชื่อลูกค้า</label>
              <input style={inputStyle} value={form.customer_name}
                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                placeholder="ชื่อลูกค้า" />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>เบอร์โทร</label>
              <input style={inputStyle} value={form.customer_phone}
                onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                placeholder="เบอร์โทรลูกค้า" />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>ทะเบียนรถ</label>
              <input style={inputStyle} value={form.license_plate}
                onChange={e => setForm(f => ({ ...f, license_plate: e.target.value }))}
                placeholder="ทะเบียนรถ" />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>ใบงาน/ใบขาย</label>
              <input style={inputStyle} value={form.job_no}
                onChange={e => setForm(f => ({ ...f, job_no: e.target.value }))}
                placeholder="เลขที่ใบงาน/ใบขาย" />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>ช่าง</label>
              <select style={inputStyle} value={form.technician}
                onChange={e => setForm(f => ({ ...f, technician: e.target.value }))}>
                <option value="">-- เลือกช่าง --</option>
                {techs.map((t, i) => (
                  <option key={`${t.user_id || t.name || i}`} value={t.name || ""}>{t.name || ""}</option>
                ))}
              </select>
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>รุ่นรถ</label>
              <select style={inputStyle} value={form.model_name}
                onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))}>
                <option value="">-- เลือกรุ่นรถ --</option>
                {models.map((m, i) => {
                  const name = typeof m === "string" ? m : (m?.marketing_name || m?.model_name || m?.name || "");
                  if (!name) return null;
                  return <option key={`${name}-${i}`} value={name}>{name}</option>;
                })}
              </select>
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>หมายเหตุ</label>
              <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="หมายเหตุ" />
            </div>

            <div style={rowStyle}>
              <label style={labelStyle}>สถานะ</label>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input type="radio" name="parking" value="จอดร้าน"
                    checked={form.parking_status === "จอดร้าน"}
                    onChange={() => setForm(f => ({ ...f, parking_status: "จอดร้าน" }))} />
                  จอดร้าน
                </label>
                <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input type="radio" name="parking" value="ไม่จอดร้าน"
                    checked={form.parking_status === "ไม่จอดร้าน"}
                    onChange={() => setForm(f => ({ ...f, parking_status: "ไม่จอดร้าน" }))} />
                  ไม่จอดร้าน
                </label>
              </div>
            </div>
          </div>

          {/* Items */}
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
                  <td><input style={{ ...inputStyle, textTransform: "uppercase" }} value={it.part_code} onChange={e => updateItem(idx, "part_code", e.target.value.toUpperCase())} placeholder="รหัสสินค้า" /></td>
                  <td><input style={inputStyle} value={it.part_name} onChange={e => updateItem(idx, "part_name", e.target.value)} placeholder="ชื่ออะไหล่" /></td>
                  <td><input style={inputStyle} type="number" min={1} value={it.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value) || 0)} /></td>
                  <td><button className="btn-sm" style={{ color: "#dc2626" }} onClick={() => removeItem(idx)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8 }}>
            <button className="btn-sm" onClick={addItem}>+ เพิ่มรายการ</button>
          </div>

          {message && <div style={{ marginTop: 12, color: "#dc2626", textAlign: "center" }}>{message}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            {form.order_id && (
              <>
                <button className="btn-sm" onClick={() => printOrder({
                  order_id: form.order_id, doc_no: form.doc_no, customer_name: form.customer_name,
                  customer_phone: form.customer_phone, license_plate: form.license_plate,
                  job_no: form.job_no, technician: form.technician, model_name: form.model_name,
                  parking_status: form.parking_status, status: form.status,
                })}>พิมพ์</button>
                {!String(form.status || "").includes("อนุมัติ") && (
                  <button className="btn-sm" style={{ color: "#10b981", borderColor: "#10b981" }}
                    onClick={async () => {
                      await approve({ order_id: form.order_id, doc_no: form.doc_no });
                      setShowForm(false);
                    }}>อนุมัติ</button>
                )}
              </>
            )}
            <button className="btn-sm" onClick={() => setShowForm(false)}>ยกเลิก</button>
            <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal onClose={() => setDetail(null)} title={`ใบสั่งซื้อ ${detail.order.doc_no || detail.order.order_id}`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Info label="ชื่อลูกค้า" value={detail.order.customer_name} />
            <Info label="เบอร์โทร" value={detail.order.customer_phone} />
            <Info label="ทะเบียนรถ" value={detail.order.license_plate} />
            <Info label="ใบงาน/ใบขาย" value={detail.order.job_no} />
            <Info label="ช่าง" value={detail.order.technician} />
            <Info label="รุ่นรถ" value={detail.order.model_name} />
            <Info label="จอด" value={detail.order.parking_status} />
            <Info label="สถานะ" value={detail.order.status} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Info label="หมายเหตุ" value={detail.order.note} />
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn-sm" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
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
