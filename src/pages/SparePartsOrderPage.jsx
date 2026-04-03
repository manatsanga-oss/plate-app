import React, { useEffect, useState } from "react";

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

const emptyItem = () => ({ part_name: "", quantity: 1, unit_price: 0, total_price: 0 });

const emptyForm = () => ({
  order_type: "ปกติ",
  ref_order_id: "",
  deposit_doc_no: "",
  customer_code: "",
  customer_name: "",
  vin: "",
  deposit_amount: 0,
  technician: "",
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

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    // แยก request แต่ละตัว ถ้าตัวใดพัง ตัวอื่นยังทำงานได้
    try { const r = await api("get_spare_orders"); setOrders(norm(r)); } catch {}
    try { const r = await api("get_honda_deposits"); setDeposits(norm(r)); } catch {}
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
      setTechs(allUsers.filter(u => u.branch === myBranch));
    } catch (e) { console.error("users err:", e); }
    setLoading(false);
  }

  function norm(d) {
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d?.items)) return d.items;
    if (Array.isArray(d?.rows)) return d.rows;
    return [];
  }

  function openNew() {
    setForm(emptyForm());
    setShowForm(true);
    setMessage("");
  }

  function handleTypeChange(type) {
    const f = emptyForm();
    f.order_type = type;
    setForm(f);
  }

  function handleDepositSelect(docNo) {
    const dep = deposits.find(d => d.deposit_doc_no === docNo);
    if (dep) {
      setForm(prev => ({
        ...prev,
        deposit_doc_no: docNo,
        customer_code: dep.customer_code || "",
        customer_name: dep.customer_name || "",
        vin: dep.vin || "",
        deposit_amount: Number(dep.remaining_amount || 0),
      }));
    }
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
      if (field === "quantity" || field === "unit_price") {
        items[idx].total_price = Number(items[idx].quantity || 0) * Number(items[idx].unit_price || 0);
      }
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
    if (!form.deposit_doc_no && form.order_type === "ปกติ") {
      setMessage("กรุณาเลือกเลขที่มัดจำ"); return;
    }
    if (!form.ref_order_id && form.order_type === "สั่งเพิ่ม") {
      setMessage("กรุณาเลือกใบสั่งซื้อเดิม"); return;
    }
    if (!form.technician.trim()) { setMessage("กรุณาเลือกช่าง"); return; }
    if (!form.model_name) { setMessage("กรุณาเลือกรุ่นรถ"); return; }
    const validItems = form.items.filter(it => it.part_name.trim());
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
      const res = await api("save_spare_order", payload);
      if (res?.success || res?.order_id) {
        setMessage("บันทึกสำเร็จ");
        setShowForm(false);
        loadAll();
      } else {
        setMessage(res?.message || "บันทึกไม่สำเร็จ");
      }
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function viewDetail(order) {
    try {
      const res = await api("get_spare_order_detail", { order_id: order.order_id });
      const items = norm(res);
      setShowDetail({ ...order, items });
    } catch { setMessage("โหลดรายละเอียดไม่สำเร็จ"); }
  }

  const filtered = orders.filter(o => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (o.customer_name || "").toLowerCase().includes(s) ||
      (o.deposit_doc_no || "").toLowerCase().includes(s) ||
      (o.vin || "").toLowerCase().includes(s) ||
      (o.technician || "").toLowerCase().includes(s) ||
      String(o.order_id).includes(s)
    );
  });

  const itemsTotal = form.items.reduce((s, it) => s + Number(it.total_price || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">ระบบสั่งซื้ออะไหล่</div>
        <button className="btn-primary" onClick={openNew} style={{ padding: "8px 20px", fontSize: 13 }}>
          + สร้างใบสั่งซื้อ
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <input
          placeholder="ค้นหา ลูกค้า / เลขมัดจำ / VIN / ช่าง"
          value={search} onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />
        <button onClick={loadAll} className="btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>Refresh</button>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{filtered.length} รายการ</span>
      </div>

      {message && !showForm && <div style={{ color: message.includes("สำเร็จ") ? "#15803d" : "#b91c1c", marginBottom: 8, fontSize: 13 }}>{message}</div>}

      {/* ===== ตารางรายการ ===== */}
      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={th}>#</th>
              <th style={th}>ประเภท</th>
              <th style={th}>เลขที่มัดจำ</th>
              <th style={th}>ลูกค้า</th>
              <th style={th}>VIN</th>
              <th style={th}>ช่าง</th>
              <th style={th}>รุ่นรถ</th>
              <th style={th}>สถานะจอด</th>
              <th style={th}>สถานะ</th>
              <th style={th}>วันที่</th>
              <th style={th}>ดู</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={center}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} style={center}>ไม่พบข้อมูล</td></tr>
            ) : filtered.map((o, i) => (
              <tr key={o.order_id} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={td}>{o.order_id}</td>
                <td style={td}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: o.order_type === "ปกติ" ? "#dbeafe" : "#fef3c7",
                    color: o.order_type === "ปกติ" ? "#1e40af" : "#92400e",
                  }}>{o.order_type}</span>
                </td>
                <td style={td}>{o.deposit_doc_no}</td>
                <td style={td}>{o.customer_name}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{o.vin}</td>
                <td style={td}>{o.technician}</td>
                <td style={td}>{o.model_name}</td>
                <td style={td}>{o.parking_status}</td>
                <td style={td}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 6, fontSize: 11,
                    background: o.status === "รอดำเนินการ" ? "#fef3c7" : "#d1fae5",
                    color: o.status === "รอดำเนินการ" ? "#92400e" : "#065f46",
                  }}>{o.status}</span>
                </td>
                <td style={td}>{fmtDate(o.created_at)}</td>
                <td style={td}>
                  <button onClick={() => viewDetail(o)} style={{ background: "#072d6b", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>ดู</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== Modal ฟอร์มสร้าง ===== */}
      {showForm && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>สร้างใบสั่งซื้ออะไหล่</h3>
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
                  {deposits.map(d => (
                    <option key={d.deposit_doc_no} value={d.deposit_doc_no}>
                      {d.deposit_doc_no} | {d.customer_name} | คงเหลือ {fmt(d.remaining_amount)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ถ้าสั่งเพิ่ม: เลือกใบเดิม */}
            {form.order_type === "สั่งเพิ่ม" && (
              <div style={row}>
                <label style={labelStyle}>ใบสั่งซื้อเดิม</label>
                <select
                  value={form.ref_order_id}
                  onChange={e => handleRefOrderSelect(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">-- เลือกใบสั่งซื้อเดิม --</option>
                  {orders.map(o => (
                    <option key={o.order_id} value={o.order_id}>
                      #{o.order_id} | {o.deposit_doc_no} | {o.customer_name}
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

            {/* ช่าง */}
            <div style={row}>
              <label style={labelStyle}>ช่าง</label>
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
                <button onClick={addItem} style={{ background: "#072d6b", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>+ เพิ่มรายการ</button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ ...th, width: "40%" }}>ชื่ออะไหล่</th>
                    <th style={{ ...th, width: "15%", textAlign: "center" }}>จำนวน</th>
                    <th style={{ ...th, width: "20%", textAlign: "right" }}>ราคา/ชิ้น</th>
                    <th style={{ ...th, width: "20%", textAlign: "right" }}>รวม</th>
                    <th style={{ ...th, width: "5%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 4 }}>
                        <input value={it.part_name} onChange={e => updateItem(idx, "part_name", e.target.value)} placeholder="ชื่ออะไหล่" style={{ ...inputStyle, width: "100%" }} />
                      </td>
                      <td style={{ padding: 4 }}>
                        <input type="number" min={1} value={it.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} style={{ ...inputStyle, width: "100%", textAlign: "center" }} />
                      </td>
                      <td style={{ padding: 4 }}>
                        <input type="number" min={0} step={0.01} value={it.unit_price} onChange={e => updateItem(idx, "unit_price", Number(e.target.value))} style={{ ...inputStyle, width: "100%", textAlign: "right" }} />
                      </td>
                      <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>{fmt(it.total_price)}</td>
                      <td style={{ padding: 4, textAlign: "center" }}>
                        <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: 16 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f0f9ff" }}>
                    <td colSpan={3} style={{ padding: 8, textAlign: "right", fontWeight: 600, color: "#072d6b" }}>รวมทั้งสิ้น</td>
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "#072d6b", fontSize: 15 }}>{fmt(itemsTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
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
              <h3 style={{ margin: 0, color: "#072d6b" }}>ใบสั่งซื้อ #{showDetail.order_id}</h3>
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
              <div><b>สถานะจอด:</b> {showDetail.parking_status}</div>
              <div><b>สถานะ:</b> {showDetail.status}</div>
              <div><b>ผู้สร้าง:</b> {showDetail.created_by}</div>
              <div><b>วันที่:</b> {fmtDate(showDetail.created_at)}</div>
            </div>

            <label style={{ fontWeight: 600, fontSize: 14, color: "#072d6b" }}>รายการอะไหล่</label>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={th}>#</th>
                  <th style={th}>ชื่ออะไหล่</th>
                  <th style={{ ...th, textAlign: "center" }}>จำนวน</th>
                  <th style={{ ...th, textAlign: "right" }}>ราคา/ชิ้น</th>
                  <th style={{ ...th, textAlign: "right" }}>รวม</th>
                </tr>
              </thead>
              <tbody>
                {(showDetail.items || []).length === 0 ? (
                  <tr><td colSpan={5} style={center}>ไม่มีรายการ</td></tr>
                ) : showDetail.items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}>{it.part_name}</td>
                    <td style={{ ...td, textAlign: "center" }}>{it.quantity}</td>
                    <td style={{ ...td, textAlign: "right" }}>{fmt(it.unit_price)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt(it.total_price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f0f9ff" }}>
                  <td colSpan={4} style={{ padding: 8, textAlign: "right", fontWeight: 600, color: "#072d6b" }}>รวมทั้งสิ้น</td>
                  <td style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "#072d6b", fontSize: 15 }}>
                    {fmt((showDetail.items || []).reduce((s, it) => s + Number(it.total_price || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowDetail(null)} style={{ padding: "8px 20px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", cursor: "pointer" }}>ปิด</button>
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
