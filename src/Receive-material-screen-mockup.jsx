import { useMemo, useRef, useState } from "react";

export default function ReceiveMaterialScreenMockup() {
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [vendor, setVendor] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("ยังไม่ได้อ่านข้อมูล");
  const [docNo] = useState("RCV-20260319-001");

  const [items, setItems] = useState([
    {
      id: 1,
      rawName: "กระดาษถ่ายเอกสาร A4",
      productName: "กระดาษ A4 80 แกรม",
      category: "กระดาษ",
      qty: 10,
      unitPrice: 120,
      confidence: 92,
    },
    {
      id: 2,
      rawName: "ปากกาลูกลื่น น้ำเงิน",
      productName: "ปากกาลูกลื่น สีน้ำเงิน",
      category: "เครื่องเขียน",
      qty: 24,
      unitPrice: 15,
      confidence: 71,
    },
    {
      id: 3,
      rawName: "แฟ้มเอกสาร",
      productName: "",
      category: "",
      qty: 5,
      unitPrice: 45,
      confidence: 48,
    },
  ]);

  const computedItems = useMemo(() => {
    return items.map((item) => ({
      ...item,
      amount: Number(item.qty || 0) * Number(item.unitPrice || 0),
    }));
  }, [items]);

  const stats = useMemo(() => {
    const totalItems = computedItems.length;
    const pendingFix = computedItems.filter(
      (x) => !x.productName || !x.category || Number(x.confidence || 0) < 80
    ).length;
    const total = computedItems.reduce((sum, x) => sum + Number(x.amount || 0), 0);

    return {
      totalItems,
      pendingFix,
      total,
    };
  }, [computedItems]);

  const triggerSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleChooseFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setOcrStatus("เลือกไฟล์แล้ว");
  };

  const handleUploadToN8n = async () => {
    if (!selectedFile) {
      alert("กรุณาเลือกไฟล์รูปก่อน");
      return;
    }

    setLoading(true);
    setOcrStatus("กำลังส่งไฟล์ไป OCR...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      // เปลี่ยน URL นี้เป็น webhook OCR ของคุณ
      const res = await fetch("https://n8n-new-project-gwf2.onrender.com/webhook-test/094b8071-9478-4bc2-90e8-4c0d21660f0c", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
      }

      const data = await res.json();
      console.log("OCR RESULT:", data);

      setVendor(data.vendor_name || "");
      setInvoiceDate(data.invoice_date || "");
      setTotalAmount(data.total_amount || "");

      if (Array.isArray(data.items)) {
        setItems(
          data.items.map((x, index) => ({
            id: index + 1,
            rawName: x.rawName || x.name || "",
            productName: x.productName || x.name || "",
            category: x.category || "",
            qty: Number(x.qty || 0),
            unitPrice: Number(x.unitPrice || x.price || 0),
            confidence: Number(x.confidence || 80),
          }))
        );
      }

      setOcrStatus("อ่านข้อมูลแล้ว");
    } catch (error) {
      console.error(error);
      setOcrStatus("อ่านข้อมูลไม่สำเร็จ");
      alert("ส่งไฟล์ไป n8n ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === "qty" || field === "unitPrice"
                  ? Number(value || 0)
                  : value,
            }
          : item
      )
    );
  };

  const addNewItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        rawName: "",
        productName: "",
        category: "",
        qty: 1,
        unitPrice: 0,
        confidence: 100,
      },
    ]);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveToN8n = async () => {
    if (!vendor) {
      alert("กรุณาระบุชื่อผู้ขาย");
      return;
    }

    const hasInvalidRow = computedItems.some(
      (item) => !item.productName || !item.category || !item.qty
    );

    if (hasInvalidRow) {
      alert("กรุณากรอกชื่อสินค้า กลุ่มสินค้า และจำนวนให้ครบ");
      return;
    }

    const payload = {
      doc_no: docNo,
      vendor_name: vendor,
      invoice_date: invoiceDate,
      total_amount: totalAmount || stats.total,
      file_name: selectedFile?.name || "",
      items: computedItems,
    };

    console.log("SAVE PAYLOAD:", payload);

    try {
      // เปลี่ยน URL นี้เป็น webhook save ของคุณ
      const res = await fetch("https://YOUR-N8N-URL/webhook/save-material", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

      const result = await res.json().catch(() => ({}));
      console.log("SAVE RESULT:", result);

      alert("บันทึกรับสินค้าเรียบร้อย");
    } catch (error) {
      console.error(error);
      alert("บันทึกไม่สำเร็จ");
    }
  };

  const getStatusText = (item) => {
    if (!item.productName || !item.category) return "ยังไม่ครบ";
    if (Number(item.confidence || 0) < 80) return "ควรตรวจสอบ";
    return "พร้อมบันทึก";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: 24 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: 24,
            marginBottom: 24,
            boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: 14, color: "#64748b" }}>ระบบรับวัสดุสำนักงาน</div>
          <h1 style={{ margin: "8px 0", fontSize: 40 }}>รับวัสดุจากใบกำกับภาษี</h1>
          <div style={{ color: "#64748b", marginBottom: 16 }}>
            อัปโหลดรูปใบกำกับภาษี → ส่งเข้า n8n OCR → ตรวจสอบข้อมูล → บันทึกเข้า Google Sheet
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button">ดูประวัติรับสินค้า</button>
            <button type="button" onClick={handleSaveToN8n}>
              บันทึกรับสินค้า
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                background: "#fff",
                borderRadius: 24,
                padding: 24,
                boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
              }}
            >
              <h2>1) อัปโหลดใบกำกับภาษี</h2>

              <div
                style={{
                  border: "2px dashed #cbd5e1",
                  borderRadius: 20,
                  background: "#f8fafc",
                  padding: 24,
                  textAlign: "center",
                  marginTop: 16,
                }}
              >
                <div style={{ fontSize: 36 }}>📷</div>
                <div style={{ fontWeight: 600, marginTop: 8 }}>เลือกไฟล์รูปภาพ</div>
                <div style={{ color: "#64748b", marginTop: 6 }}>รองรับ JPG, PNG, HEIC</div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleChooseFile}
                />

                <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  <button type="button" onClick={triggerSelectFile}>
                    เลือกไฟล์
                  </button>

                  <button type="button" onClick={handleUploadToN8n} disabled={loading}>
                    {loading ? "กำลังส่ง..." : "ส่ง OCR"}
                  </button>
                </div>

                <div style={{ marginTop: 12, color: "#334155" }}>
                  {selectedFile ? `ไฟล์: ${selectedFile.name}` : "ยังไม่ได้เลือกไฟล์"}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div>สถานะ OCR: {ocrStatus}</div>
                <div>เลขเอกสาร: {docNo}</div>
              </div>
            </div>

            <div
              style={{
                background: "#fff",
                borderRadius: 24,
                padding: 24,
                boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
              }}
            >
              <h2>2) ข้อมูลจาก OCR</h2>

              <div style={{ marginTop: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <div>ชื่อผู้ขาย</div>
                  <input
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    style={{ width: "100%", padding: 10 }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div>วันที่เอกสาร</div>
                  <input
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    style={{ width: "100%", padding: 10 }}
                  />
                </div>

                <div>
                  <div>ยอดรวม</div>
                  <input
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    style={{ width: "100%", padding: 10 }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                background: "#fff",
                borderRadius: 24,
                padding: 24,
                boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
              }}
            >
              <h2>สรุปตรวจสอบ</h2>
              <div style={{ marginTop: 12 }}>รายการทั้งหมด: {stats.totalItems} รายการ</div>
              <div>รอตรวจ/แก้ไข: {stats.pendingFix} รายการ</div>
              <div>มูลค่ารวม: {stats.total.toLocaleString()} บาท</div>
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2>3) ตรวจสอบและแก้ไขรายการวัสดุ</h2>
                <div style={{ color: "#64748b" }}>
                  ชื่อสินค้าไม่ถูกต้องสามารถแก้ไขได้ แล้วเลือกกลุ่มสินค้าให้ครบก่อนบันทึก
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={addNewItem}>
                  เพิ่มรายการเอง
                </button>
                <button type="button" onClick={() => alert("ปุ่มนี้ไว้ให้ยิง OCR ใหม่ภายหลัง")}>
                  ดึง OCR ใหม่
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>สถานะ</th>
                    <th style={th}>ชื่อจาก OCR</th>
                    <th style={th}>ชื่อสินค้า</th>
                    <th style={th}>กลุ่มสินค้า</th>
                    <th style={th}>จำนวน</th>
                    <th style={th}>ราคา</th>
                    <th style={th}>รวม</th>
                    <th style={th}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {computedItems.map((item) => (
                    <tr key={item.id}>
                      <td style={td}>{getStatusText(item)}</td>
                      <td style={td}>
                        <div>{item.rawName}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          OCR {item.confidence}%
                        </div>
                      </td>
                      <td style={td}>
                        <input
                          value={item.productName}
                          onChange={(e) => updateItem(item.id, "productName", e.target.value)}
                          style={{ width: 180, padding: 8 }}
                        />
                      </td>
                      <td style={td}>
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(item.id, "category", e.target.value)}
                          style={{ width: 150, padding: 8 }}
                        >
                          <option value="">เลือกกลุ่มสินค้า</option>
                          <option value="กระดาษ">กระดาษ</option>
                          <option value="เครื่องเขียน">เครื่องเขียน</option>
                          <option value="แฟ้ม/เอกสาร">แฟ้ม/เอกสาร</option>
                          <option value="อุปกรณ์ทำความสะอาด">อุปกรณ์ทำความสะอาด</option>
                          <option value="อุปกรณ์ไอที">อุปกรณ์ไอที</option>
                        </select>
                      </td>
                      <td style={td}>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateItem(item.id, "qty", e.target.value)}
                          style={{ width: 70, padding: 8 }}
                        />
                      </td>
                      <td style={td}>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                          style={{ width: 90, padding: 8 }}
                        />
                      </td>
                      <td style={td}>{Number(item.amount).toLocaleString()}</td>
                      <td style={td}>
                        <button type="button" onClick={() => removeItem(item.id)}>
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                marginTop: 16,
                background: "#f8fafc",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div style={{ fontWeight: 600 }}>เงื่อนไขก่อนบันทึก</div>
              <div style={{ color: "#64748b", marginTop: 6 }}>
                ต้องระบุชื่อสินค้า กลุ่มสินค้า จำนวน และราคาให้ครบทุกแถว
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => alert("บันทึกรายการที่แก้ไขแล้ว")}>
                  บันทึกรายการที่แก้ไข
                </button>
                <button type="button" onClick={handleSaveToN8n}>
                  ยืนยันรับสินค้าและส่งเข้า n8n
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const th = {
  textAlign: "left",
  borderBottom: "1px solid #cbd5e1",
  padding: 10,
};

const td = {
  borderBottom: "1px solid #e2e8f0",
  padding: 10,
  verticalAlign: "top",
};