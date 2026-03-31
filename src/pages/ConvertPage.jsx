import React, { useEffect, useState } from "react";

export default function ConvertPage({ currentUser }) {
  const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/office-api";

  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("convert"); // convert | history

  // Form state
  const [srcId, setSrcId] = useState("");
  const [srcQty, setSrcQty] = useState("");
  const [tgtId, setTgtId] = useState("");
  const [tgtQty, setTgtQty] = useState("");
  const [convDate, setConvDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_convert_data" }),
      });
      const data = await res.json();
      if (data.success) setProducts(data.data || []);
    } catch (e) {
      setMessage("โหลดข้อมูลไม่สำเร็จ");
    }
    setLoading(false);
  }

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_conversion_history" }),
      });
      const data = await res.json();
      if (data.success) setHistory(data.data || []);
    } catch (e) {
      setMessage("โหลดประวัติไม่สำเร็จ");
    }
    setLoading(false);
  }

  function handleTabChange(t) {
    setTab(t);
    if (t === "history") loadHistory();
  }

  const srcProduct = products.find((p) => p.product_id === srcId);
  const tgtProduct = products.find((p) => p.product_id === tgtId);

  const srcCostPerUnit = srcProduct ? parseFloat(srcProduct.avg_cost_per_unit) || 0 : 0;
  const srcQtyNum = parseFloat(srcQty) || 0;
  const tgtQtyNum = parseFloat(tgtQty) || 0;
  const tgtCostPerUnit =
    srcQtyNum > 0 && tgtQtyNum > 0
      ? Math.round((srcCostPerUnit * srcQtyNum / tgtQtyNum) * 10000) / 10000
      : 0;
  const srcQtyOnHand = srcProduct ? parseFloat(srcProduct.qty_on_hand) || 0 : 0;
  const srcQtyAfter = srcQtyOnHand - srcQtyNum;
  const tgtQtyOnHand = tgtProduct ? parseFloat(tgtProduct.qty_on_hand) || 0 : 0;
  const tgtQtyAfter = tgtQtyOnHand + tgtQtyNum;

  async function handleSave() {
    if (!srcId) { setMessage("กรุณาเลือกสินค้าต้นทาง"); return; }
    if (!tgtId) { setMessage("กรุณาเลือกสินค้าปลายทาง"); return; }
    if (srcId === tgtId) { setMessage("สินค้าต้นทางและปลายทางต้องไม่ใช่รายการเดียวกัน"); return; }
    if (srcQtyNum <= 0) { setMessage("กรุณาระบุจำนวนที่ต้องการแปลง"); return; }
    if (tgtQtyNum <= 0) { setMessage("กรุณาระบุจำนวนที่ได้รับหลังแปลง"); return; }
    if (srcQtyNum > srcQtyOnHand) {
      setMessage(`สต๊อกต้นทางไม่พอ (มี ${srcQtyOnHand} ${srcProduct?.unit})`);
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_conversion",
          conversion_date: convDate,
          source_product_id: srcId,
          source_product_name: srcProduct?.product_name || "",
          source_unit: srcProduct?.unit || "",
          source_qty: srcQtyNum,
          source_cost_per_unit: srcCostPerUnit,
          target_product_id: tgtId,
          target_product_name: tgtProduct?.product_name || "",
          target_unit: tgtProduct?.unit || "",
          target_qty: tgtQtyNum,
          note,
          created_by: currentUser?.name || "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`บันทึกสำเร็จ เลขที่: ${data.conversion_no}`);
        setSrcId(""); setSrcQty(""); setTgtId(""); setTgtQty(""); setNote("");
        loadData();
      } else {
        setMessage("บันทึกไม่สำเร็จ: " + (data.message || "unknown error"));
      }
    } catch (e) {
      setMessage("เกิดข้อผิดพลาด: " + e.message);
    }
    setSaving(false);
  }

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "16px" }}>🔄 แปลงหน่วยบรรจุ</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {["convert", "history"].map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            style={{
              padding: "8px 20px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              background: tab === t ? "#1976d2" : "#e0e0e0",
              color: tab === t ? "#fff" : "#333",
              fontWeight: tab === t ? "bold" : "normal",
            }}
          >
            {t === "convert" ? "📦 แปลงหน่วย" : "📋 ประวัติการแปลง"}
          </button>
        ))}
      </div>

      {message && (
        <div
          style={{
            padding: "10px 16px",
            marginBottom: "16px",
            borderRadius: "6px",
            background: message.startsWith("บันทึกสำเร็จ") ? "#e8f5e9" : "#fff3e0",
            color: message.startsWith("บันทึกสำเร็จ") ? "#2e7d32" : "#e65100",
            border: `1px solid ${message.startsWith("บันทึกสำเร็จ") ? "#a5d6a7" : "#ffcc80"}`,
          }}
        >
          {message}
        </div>
      )}

      {/* Convert Form */}
      {tab === "convert" && (
        <div style={{ background: "#fff", borderRadius: "10px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>กำลังโหลด...</div>
          ) : (
            <>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>วันที่แปลง</label>
                <input
                  type="date"
                  value={convDate}
                  onChange={(e) => setConvDate(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px" }}
                />
              </div>

              {/* Source Section */}
              <div style={{ background: "#f3f8ff", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
                <h4 style={{ marginBottom: "12px", color: "#1565c0" }}>📤 สินค้าต้นทาง (หน่วยใหญ่)</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "bold" }}>สินค้า</label>
                    <select
                      value={srcId}
                      onChange={(e) => { setSrcId(e.target.value); setSrcQty(""); }}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px" }}
                    >
                      <option value="">-- เลือกสินค้า --</option>
                      {products.map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.product_name} ({p.unit}) | คงเหลือ: {parseFloat(p.qty_on_hand).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "bold" }}>
                      จำนวนที่แปลง ({srcProduct?.unit || "-"})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={srcQty}
                      onChange={(e) => setSrcQty(e.target.value)}
                      placeholder="0"
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                {srcProduct && (
                  <div style={{ marginTop: "10px", fontSize: "13px", color: "#555", display: "flex", gap: "24px" }}>
                    <span>สต๊อกปัจจุบัน: <b>{srcQtyOnHand.toLocaleString()} {srcProduct.unit}</b></span>
                    <span>ต้นทุนเฉลี่ย/หน่วย: <b>{srcCostPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</b></span>
                    {srcQtyNum > 0 && (
                      <span style={{ color: srcQtyAfter < 0 ? "#c62828" : "#2e7d32" }}>
                        คงเหลือหลังแปลง: <b>{srcQtyAfter.toLocaleString()} {srcProduct.unit}</b>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div style={{ textAlign: "center", fontSize: "24px", margin: "8px 0" }}>⬇</div>

              {/* Target Section */}
              <div style={{ background: "#f3fff5", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
                <h4 style={{ marginBottom: "12px", color: "#2e7d32" }}>📥 สินค้าปลายทาง (หน่วยเล็ก)</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "bold" }}>สินค้า</label>
                    <select
                      value={tgtId}
                      onChange={(e) => setTgtId(e.target.value)}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px" }}
                    >
                      <option value="">-- เลือกสินค้า --</option>
                      {products.filter((p) => p.product_id !== srcId).map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.product_name} ({p.unit}) | คงเหลือ: {parseFloat(p.qty_on_hand).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "bold" }}>
                      จำนวนที่ได้รับ ({tgtProduct?.unit || "-"})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tgtQty}
                      onChange={(e) => setTgtQty(e.target.value)}
                      placeholder="0"
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                {tgtProduct && (
                  <div style={{ marginTop: "10px", fontSize: "13px", color: "#555", display: "flex", gap: "24px" }}>
                    <span>สต๊อกปัจจุบัน: <b>{tgtQtyOnHand.toLocaleString()} {tgtProduct.unit}</b></span>
                    {tgtQtyNum > 0 && srcQtyNum > 0 && (
                      <>
                        <span style={{ color: "#2e7d32" }}>
                          คงเหลือหลังแปลง: <b>{tgtQtyAfter.toLocaleString()} {tgtProduct.unit}</b>
                        </span>
                        <span>
                          ต้นทุน/หน่วยใหม่: <b>{tgtCostPerUnit.toLocaleString(undefined, { minimumFractionDigits: 4 })} บาท</b>
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Conversion Summary */}
              {srcProduct && tgtProduct && srcQtyNum > 0 && tgtQtyNum > 0 && (
                <div style={{ background: "#fffde7", border: "1px solid #ffe082", borderRadius: "8px", padding: "14px", marginBottom: "16px", fontSize: "14px" }}>
                  <b>สรุปการแปลง:</b> {srcProduct.product_name} {srcQtyNum} {srcProduct.unit} →{" "}
                  {tgtProduct.product_name} {tgtQtyNum} {tgtProduct.unit}
                  <span style={{ marginLeft: "16px" }}>
                    (อัตรา 1 {srcProduct.unit} = {(tgtQtyNum / srcQtyNum).toFixed(4)} {tgtProduct.unit})
                  </span>
                </div>
              )}

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "bold" }}>หมายเหตุ</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น แกลอนน้ำยาล้างจาน 1 แกลอน แบ่งใส่ขวด 6 ขวด"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "10px 32px",
                  background: saving ? "#999" : "#1976d2",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "15px",
                  fontWeight: "bold",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "กำลังบันทึก..." : "💾 บันทึกการแปลง"}
              </button>
            </>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div style={{ background: "#fff", borderRadius: "10px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>กำลังโหลด...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#aaa" }}>ยังไม่มีประวัติการแปลง</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    {["เลขที่", "วันที่", "ต้นทาง", "จำนวน", "ต้นทุน/หน่วย", "ปลายทาง", "จำนวน", "ต้นทุน/หน่วย", "หมายเหตุ", "บันทึกโดย"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #e0e0e0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((r, i) => (
                    <tr key={r.conversion_id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{r.conversion_no}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{r.conversion_date?.slice(0,10)}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{r.source_product_name}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", textAlign: "right" }}>{parseFloat(r.source_qty).toLocaleString()} {r.source_unit}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", textAlign: "right" }}>{parseFloat(r.source_cost_per_unit || 0).toFixed(2)}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{r.target_product_name}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", textAlign: "right" }}>{parseFloat(r.target_qty).toLocaleString()} {r.target_unit}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", textAlign: "right" }}>{parseFloat(r.target_cost_per_unit || 0).toFixed(4)}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{r.note || "-"}</td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>{r.created_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
