import React, { useState, useEffect } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/office-api";

export default function SubunitPage({ currentUser }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const [parentId, setParentId] = useState("");
  const [subUnit, setSubUnit] = useState("");

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_products_for_subunit" }),
      });
      const data = await res.json();
      if (data.success) setProducts(data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  const parentProduct = products.find((p) => p.product_id === parentId);

  async function handleSave() {
    if (!parentId || !subUnit.trim()) {
      setMessage("กรุณากรอกข้อมูลให้ครบ");
      setSuccess(false);
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_subunit",
          parent_product_id: parentId,
          parent_product_name: parentProduct?.product_name || "",
          parent_unit: parentProduct?.unit || "",
          sub_unit: subUnit.trim(),
          created_by: currentUser?.name || "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setMessage(`บันทึกสำเร็จ: ${data.product_name} (${data.product_id})`);
        setParentId("");
        setSubUnit("");
        loadProducts();
      } else {
        setSuccess(false);
        setMessage(data.message || "เกิดข้อผิดพลาด");
      }
    } catch {
      setSuccess(false);
      setMessage("ไม่สามารถเชื่อมต่อระบบได้");
    }
    setSaving(false);
  }

  const subunits = products.filter((p) => p.parent_product_id);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">บันทึกเพิ่มหน่วยย่อย</h2>
      </div>

      <div className="form-card" style={{ maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>เพิ่มหน่วยย่อยให้สินค้า</h3>

        <div className="form-row">
          <label>เลือกสินค้าหลัก (หน่วยใหญ่) <span style={{ color: "#ef4444" }}>*</span></label>
          <select className="form-input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">-- เลือกสินค้า --</option>
            {products
              .filter((p) => !p.parent_product_id)
              .map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} ({p.unit})
                </option>
              ))}
          </select>
        </div>

        {parentProduct && (
          <div style={{ padding: "8px 12px", background: "#eff6ff", borderRadius: 8, marginBottom: 12, fontSize: 13, color: "#1e40af" }}>
            สินค้า: <strong>{parentProduct.product_name}</strong> | หน่วย: <strong>{parentProduct.unit}</strong>
          </div>
        )}

        <div className="form-row">
          <label>ชื่อหน่วยย่อย <span style={{ color: "#ef4444" }}>*</span></label>
          <input
            className="form-input"
            placeholder="เช่น ขวด, ซอง, ชิ้น"
            value={subUnit}
            onChange={(e) => setSubUnit(e.target.value)}
          />
        </div>

        {parentProduct && subUnit && (
          <div style={{ padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, marginBottom: 12, fontSize: 13, color: "#166534", border: "1px solid #86efac" }}>
            รหัสสินค้าใหม่: <strong>{parentId}-{subUnit}</strong>
            <br />
            ชื่อสินค้าใหม่: <strong>{parentProduct.product_name} ({subUnit})</strong>
          </div>
        )}

        {message && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, marginBottom: 12,
            background: success ? "#f0fdf4" : "#fef2f2",
            color: success ? "#15803d" : "#dc2626",
            border: `1px solid ${success ? "#86efac" : "#fca5a5"}`,
          }}>
            {message}
          </div>
        )}

        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "10px 0", fontSize: 15 }}>
          {saving ? "กำลังบันทึก..." : "บันทึกหน่วยย่อย"}
        </button>
      </div>

      {subunits.length > 0 && (
        <div className="form-card" style={{ maxWidth: 700, marginTop: 16 }}>
          <h4 style={{ margin: "0 0 12px" }}>หน่วยย่อยที่บันทึกแล้ว ({subunits.length} รายการ)</h4>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={thStyle}>รหัสสินค้า</th>
                <th style={thStyle}>ชื่อสินค้า</th>
                <th style={thStyle}>หน่วย</th>
                <th style={thStyle}>สินค้าหลัก</th>
              </tr>
            </thead>
            <tbody>
              {subunits.map((p, i) => {
                const parent = products.find((pp) => pp.product_id === p.parent_product_id);
                return (
                  <tr key={p.product_id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={tdStyle}>{p.product_id}</td>
                    <td style={tdStyle}>{p.product_name}</td>
                    <td style={tdStyle}>{p.unit}</td>
                    <td style={tdStyle}>{parent?.product_name || p.parent_product_id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: "6px 10px", textAlign: "left", fontWeight: 600 };
const tdStyle = { padding: "6px 10px" };
