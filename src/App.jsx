import { useMemo, useState } from "react";

const OCR_WEBHOOK_URL = "https://n8n-new-project-gwf2.onrender.com/webhook-test/094b8071-9478-4bc2-90e8-4c0d21660f0c";
const SAVE_WEBHOOK_URL = "https://n8n-new-project-gwf2.onrender.com/webhook-test/c577cfab-e904-4c2b-86e8-3a8296676ec5";

const DEFAULT_CATEGORY_OPTIONS = [
  "เครื่องเขียน",
  "กระดาษ",
  "อุปกรณ์ทำความสะอาด",
  "ของใช้สำนักงาน",
  "เครื่องดื่ม",
  "บรรจุภัณฑ์",
  "อื่นๆ",
];

function emptyHeader() {
  return {
    sellerName: "",
    sellerTaxId: "",
    sellerAddress: "",
    buyerName: "",
    buyerTaxId: "",
    buyerAddress: "",
    contactName: "",
    contactTel: "",
    docNo: "",
    docDate: "",
    dueDate: "",
    paymentType: "",
    soNo: "",
    pqNo: "",
    salesCode: "",
    customerId: "",
  };
}

function createEmptyRow(defaultCategory = "อื่นๆ") {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: "",
    ocrName: "",
    productName: "",
    category: defaultCategory || "อื่นๆ",
    qty: 0,
    unit: "",
    price: 0,
    total: 0,
    quantityInferred: false,
  };
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value) {
  const n = toNumber(value);
  return n.toLocaleString("th-TH");
}

function normalizeCategory(value) {
  const s = (value ?? "").toString().trim();
  return s || "อื่นๆ";
}

function uniqueTextList(values) {
  const seen = new Set();
  const out = [];

  for (const v of values) {
    const s = (v ?? "").toString().trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }

  return out;
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [header, setHeader] = useState(emptyHeader());
  const [items, setItems] = useState([]);

  const grandTotal = useMemo(() => {
    return items.reduce((sum, row) => sum + toNumber(row.total), 0);
  }, [items]);

  const categoryOptions = useMemo(() => {
    const itemCategories = items.map((row) => normalizeCategory(row.category));
    const merged = uniqueTextList([
      ...DEFAULT_CATEGORY_OPTIONS,
      ...itemCategories,
      "อื่นๆ",
    ]);

    const withoutOther = merged.filter((x) => x !== "อื่นๆ");
    return [...withoutOther, "อื่นๆ"];
  }, [items]);

  function resetAll() {
    setSelectedFile(null);
    setHeader(emptyHeader());
    setItems([]);
    setOcrStatus("");
    setErrorMessage("");
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setErrorMessage("");
  }

  function applyOCRResult(data) {
    setHeader({
      sellerName: data?.seller?.name_th || "",
      sellerTaxId: data?.seller?.tax_id || "",
      sellerAddress: data?.seller?.address_th || "",
      buyerName: data?.buyer?.name || "",
      buyerTaxId: data?.buyer?.tax_id || "",
      buyerAddress: data?.buyer?.address || "",
      contactName: data?.ship_to?.contact_name || "",
      contactTel: data?.ship_to?.tel || "",
      docNo: data?.document?.doc_no || "",
      docDate: data?.document?.date || "",
      dueDate: data?.document?.due_date || "",
      paymentType: data?.document?.payment_type || "",
      soNo: data?.document?.so_no || "",
      pqNo: data?.document?.pq_no || "",
      salesCode: data?.document?.sales_code || "",
      customerId: data?.document?.customer_id || "",
    });

    const rows = Array.isArray(data?.items)
      ? data.items.map((item, index) => {
          const qty = toNumber(item?.quantity);
          const price = toNumber(item?.unit_price);
          const amount = toNumber(item?.net_amount);
          const categoryFromApi = normalizeCategory(item?.["กลุ่มสินค้า"]);

          return {
            id: `${Date.now()}-${index}`,
            code: item?.code || "",
            ocrName: item?.description_raw || "",
            productName: item?.description_clean || item?.description_raw || "",
            category: categoryFromApi || "อื่นๆ",
            qty,
            unit: item?.unit || "",
            price,
            total: amount || qty * price,
            quantityInferred: Boolean(item?.quantity_inferred),
          };
        })
      : [];

    setItems(rows);
    setOcrStatus("อ่านข้อมูลแล้ว");
  }

  async function handleSendOCR() {
    if (!selectedFile) {
      alert("กรุณาเลือกไฟล์ก่อน");
      return;
    }

    try {
      setLoadingOCR(true);
      setErrorMessage("");
      setOcrStatus("กำลังส่ง OCR...");

      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch(OCR_WEBHOOK_URL, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`OCR request failed: HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log("OCR RESULT:", data);

      applyOCRResult(data);
    } catch (error) {
      console.error(error);
      setErrorMessage("ส่ง OCR ไม่สำเร็จ");
      setOcrStatus("เกิดข้อผิดพลาด");
    } finally {
      setLoadingOCR(false);
    }
  }

  function updateHeader(field, value) {
    setHeader((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function updateRow(index, patch) {
    setItems((prev) => {
      const next = [...prev];
      const row = {
        ...next[index],
        ...patch,
      };

      row.category = normalizeCategory(row.category);

      const qty = toNumber(row.qty);
      const price = toNumber(row.price);
      row.total = qty * price;

      next[index] = row;
      return next;
    });
  }

  function handleAddRow() {
    setItems((prev) => [...prev, createEmptyRow("อื่นๆ")]);
  }

  function handleDeleteRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setErrorMessage("");

      const payload = {
        success: true,
        header,
        items: items.map((row, index) => ({
          line_no: index + 1,
          product_code: row.code,
          product_name_from_ocr: row.ocrName,
          product_name: row.productName,
          กลุ่มสินค้า: normalizeCategory(row.category),
          qty: toNumber(row.qty),
          unit: row.unit,
          unit_price: toNumber(row.price),
          total: toNumber(row.total),
          quantity_inferred: Boolean(row.quantityInferred),
        })),
        summary: {
          item_count: items.length,
          grand_total: grandTotal,
          file_name: selectedFile?.name || "",
        },
      };

      const res = await fetch(SAVE_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Save request failed: HTTP ${res.status}`);
      }

      const result = await res.json();
      console.log("SAVE RESULT:", result);

      alert("บันทึกสำเร็จ");
    } catch (error) {
      console.error(error);
      setErrorMessage("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerBlock}>
          <h1 style={styles.title}>ระบบรับวัสดุสำนักงาน</h1>
          <p style={styles.subtitle}>
            อัปโหลดรูปใบกำกับภาษี → ส่งเข้า n8n OCR → ตรวจสอบข้อมูล → บันทึกเข้า Google Sheet
          </p>

          <div style={styles.topButtonRow}>
            <button style={styles.secondaryButton} type="button">
              ดูประวัติรับสินค้า
            </button>

            <button
              style={{
                ...styles.secondaryButton,
                opacity: saving ? 0.7 : 1,
                cursor: saving ? "not-allowed" : "pointer",
              }}
              type="button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "กำลังบันทึก..." : "บันทึกรับสินค้า"}
            </button>

            <button style={styles.secondaryButton} type="button" onClick={resetAll}>
              ล้างข้อมูลทั้งหมด
            </button>
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.leftColumn}>
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>1) อัปโหลดใบกำกับภาษี</h2>

              <div style={styles.uploadBox}>
                <div style={{ fontSize: 44 }}>📷</div>
                <div style={styles.uploadTitle}>เลือกรูปภาพ</div>
                <div style={styles.uploadHint}>รองรับ JPG, PNG, HEIC</div>

                <div style={styles.buttonRow}>
                  <label style={styles.primaryButton}>
                    เลือกไฟล์
                    <input
                      type="file"
                      accept="image/*,.heic"
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />
                  </label>

                  <button
                    type="button"
                    style={{
                      ...styles.primaryButton,
                      opacity: loadingOCR ? 0.7 : 1,
                      cursor: loadingOCR ? "not-allowed" : "pointer",
                    }}
                    onClick={handleSendOCR}
                    disabled={loadingOCR}
                  >
                    {loadingOCR ? "กำลังอ่าน..." : "ส่ง OCR"}
                  </button>
                </div>

                <div style={styles.fileText}>
                  ไฟล์: {selectedFile ? selectedFile.name : "-"}
                </div>

                <div style={styles.statusText}>
                  สถานะ OCR: {ocrStatus || "-"}
                </div>

                {errorMessage && <div style={styles.errorText}>{errorMessage}</div>}
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>2) ข้อมูลจาก OCR</h2>

              <div style={styles.formGrid}>
                <div>
                  <label style={styles.label}>ชื่อผู้ขาย</label>
                  <input
                    style={styles.input}
                    value={header.sellerName}
                    onChange={(e) => updateHeader("sellerName", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>เลขผู้เสียภาษีผู้ขาย</label>
                  <input
                    style={styles.input}
                    value={header.sellerTaxId}
                    onChange={(e) => updateHeader("sellerTaxId", e.target.value)}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.label}>ที่อยู่ผู้ขาย</label>
                  <input
                    style={styles.input}
                    value={header.sellerAddress}
                    onChange={(e) => updateHeader("sellerAddress", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>เลขเอกสาร</label>
                  <input
                    style={styles.input}
                    value={header.docNo}
                    onChange={(e) => updateHeader("docNo", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>วันที่เอกสาร</label>
                  <input
                    style={styles.input}
                    value={header.docDate}
                    onChange={(e) => updateHeader("docDate", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>ชื่อผู้ซื้อ</label>
                  <input
                    style={styles.input}
                    value={header.buyerName}
                    onChange={(e) => updateHeader("buyerName", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>เลขผู้เสียภาษีผู้ซื้อ</label>
                  <input
                    style={styles.input}
                    value={header.buyerTaxId}
                    onChange={(e) => updateHeader("buyerTaxId", e.target.value)}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.label}>ที่อยู่ผู้ซื้อ</label>
                  <input
                    style={styles.input}
                    value={header.buyerAddress}
                    onChange={(e) => updateHeader("buyerAddress", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>ผู้ติดต่อ</label>
                  <input
                    style={styles.input}
                    value={header.contactName}
                    onChange={(e) => updateHeader("contactName", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>เบอร์โทร</label>
                  <input
                    style={styles.input}
                    value={header.contactTel}
                    onChange={(e) => updateHeader("contactTel", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>กำหนดชำระ</label>
                  <input
                    style={styles.input}
                    value={header.dueDate}
                    onChange={(e) => updateHeader("dueDate", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>ประเภทชำระเงิน</label>
                  <input
                    style={styles.input}
                    value={header.paymentType}
                    onChange={(e) => updateHeader("paymentType", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>SO No.</label>
                  <input
                    style={styles.input}
                    value={header.soNo}
                    onChange={(e) => updateHeader("soNo", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>PQ No.</label>
                  <input
                    style={styles.input}
                    value={header.pqNo}
                    onChange={(e) => updateHeader("pqNo", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>Sales Code</label>
                  <input
                    style={styles.input}
                    value={header.salesCode}
                    onChange={(e) => updateHeader("salesCode", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>Customer ID</label>
                  <input
                    style={styles.input}
                    value={header.customerId}
                    onChange={(e) => updateHeader("customerId", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={styles.rightColumn}>
            <div style={styles.card}>
              <div style={styles.sectionHeaderRow}>
                <div>
                  <h2 style={styles.sectionTitle}>3) ตรวจสอบและแก้ไขรายการวัสดุ</h2>
                  <div style={styles.sectionDesc}>
                    ตรวจสอบชื่อสินค้า กลุ่มสินค้า จำนวน หน่วย และราคา ก่อนบันทึก
                  </div>
                </div>

                <div style={styles.buttonRow}>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={handleAddRow}
                  >
                    เพิ่มรายการเอง
                  </button>

                  <button
                    type="button"
                    style={{
                      ...styles.secondaryButton,
                      opacity: loadingOCR ? 0.7 : 1,
                      cursor: loadingOCR ? "not-allowed" : "pointer",
                    }}
                    onClick={handleSendOCR}
                    disabled={loadingOCR}
                  >
                    {loadingOCR ? "กำลังอ่าน..." : "ดึง OCR ใหม่"}
                  </button>
                </div>
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>รหัส</th>
                      <th style={styles.th}>ชื่อสินค้า</th>
                      <th style={styles.th}>กลุ่มสินค้า</th>
                      <th style={styles.th}>จำนวน</th>
                      <th style={styles.th}>หน่วย</th>
                      <th style={styles.th}>ราคา</th>
                      <th style={styles.th}>รวม</th>
                      <th style={styles.th}>จัดการ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={styles.emptyCell}>
                          ยังไม่มีรายการสินค้า กรุณาเลือกไฟล์แล้วกดส่ง OCR หรือเพิ่มรายการเอง
                        </td>
                      </tr>
                    ) : (
                      items.map((row, index) => {
                        const datalistId = `category-list-${row.id}`;

                        return (
                          <tr key={row.id}>
                            <td style={styles.td}>
                              <input
                                style={styles.tableInput}
                                value={row.code}
                                onChange={(e) => updateRow(index, { code: e.target.value })}
                              />
                            </td>

                            <td style={styles.td}>
                              <input
                                style={styles.tableInput}
                                value={row.productName}
                                onChange={(e) =>
                                  updateRow(index, { productName: e.target.value })
                                }
                              />
                            </td>

                            <td style={styles.td}>
                              <input
                                list={datalistId}
                                style={styles.tableInput}
                                value={normalizeCategory(row.category)}
                                placeholder="พิมพ์ค้นหาหรือเพิ่มกลุ่มสินค้า"
                                onChange={(e) =>
                                  updateRow(index, {
                                    category: normalizeCategory(e.target.value),
                                  })
                                }
                                onBlur={(e) =>
                                  updateRow(index, {
                                    category: normalizeCategory(e.target.value),
                                  })
                                }
                              />

                              <datalist id={datalistId}>
                                {categoryOptions.map((option) => (
                                  <option key={option} value={option} />
                                ))}
                              </datalist>

                              <div style={styles.categoryHint}>
                                ค้นหาได้ หรือพิมพ์ชื่อกลุ่มใหม่เอง
                              </div>
                            </td>

                            <td style={styles.td}>
                              <input
                                type="number"
                                style={styles.tableInput}
                                value={row.qty}
                                onChange={(e) => updateRow(index, { qty: e.target.value })}
                              />
                            </td>

                            <td style={styles.td}>
                              <input
                                style={styles.tableInput}
                                value={row.unit}
                                onChange={(e) => updateRow(index, { unit: e.target.value })}
                              />
                            </td>

                            <td style={styles.td}>
                              <input
                                type="number"
                                style={styles.tableInput}
                                value={row.price}
                                onChange={(e) => updateRow(index, { price: e.target.value })}
                              />
                            </td>

                            <td style={styles.tdRight}>{formatNumber(row.total)}</td>

                            <td style={styles.td}>
                              <button
                                type="button"
                                style={styles.deleteButton}
                                onClick={() => handleDeleteRow(index)}
                              >
                                ลบ
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div style={styles.summaryBar}>
                <div>จำนวนรายการ: {items.length}</div>
                <div>รวมทั้งสิ้น: {formatNumber(grandTotal)} บาท</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loadingOCR && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.loaderWrap}>
              <div style={styles.loaderRing}></div>
              <div style={styles.loaderDot}></div>
            </div>

            <div style={styles.modalTitle}>กำลังประมวลผล OCR</div>
            <div style={styles.modalText}>
              ระบบกำลังส่งรูปภาพไปอ่านข้อมูลจากใบกำกับภาษี
            </div>
            <div style={styles.modalSubText}>
              กรุณารอสักครู่ อย่าปิดหน้านี้
            </div>

            <div style={styles.progressFake}>
              <div style={styles.progressFakeBar}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#eef3f8",
    padding: 24,
    boxSizing: "border-box",
    fontFamily: "Tahoma, sans-serif",
    color: "#24324a",
  },
  container: {
    maxWidth: 1500,
    margin: "0 auto",
  },
  headerBlock: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 700,
    textAlign: "center",
  },
  subtitle: {
    margin: "8px 0 0 0",
    textAlign: "center",
    color: "#617089",
    fontSize: 18,
  },
  topButtonRow: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 18,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "420px 1fr",
    gap: 24,
    alignItems: "start",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  rightColumn: {
    display: "flex",
    flexDirection: "column",
  },
  card: {
    background: "#ffffff",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    textAlign: "center",
  },
  sectionDesc: {
    marginTop: 8,
    color: "#6c7a92",
    textAlign: "center",
    fontSize: 16,
  },
  uploadBox: {
    marginTop: 18,
    border: "2px dashed #c9d7ea",
    borderRadius: 24,
    padding: 28,
    textAlign: "center",
    background: "#f9fbff",
  },
  uploadTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginTop: 8,
  },
  uploadHint: {
    color: "#6c7a92",
    marginTop: 6,
    fontSize: 16,
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 16,
  },
  primaryButton: {
    background: "#1f6feb",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 16,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    background: "#ffffff",
    color: "#24324a",
    border: "1px solid #c8d2e1",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 16,
    cursor: "pointer",
  },
  deleteButton: {
    background: "#fff1f1",
    color: "#c62828",
    border: "1px solid #efb0b0",
    borderRadius: 8,
    padding: "8px 12px",
    cursor: "pointer",
  },
  fileText: {
    marginTop: 16,
    fontSize: 16,
  },
  statusText: {
    marginTop: 8,
    fontSize: 16,
    color: "#4b5870",
  },
  errorText: {
    marginTop: 8,
    color: "#c62828",
    fontWeight: 700,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginTop: 18,
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontWeight: 700,
    fontSize: 14,
    color: "#4d5b73",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #c8d2e1",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 15,
    outline: "none",
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #d9e2ee",
    borderRadius: 16,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 980,
    background: "#fff",
  },
  th: {
    background: "#f5f8fc",
    color: "#4a5870",
    textAlign: "left",
    padding: 12,
    fontSize: 15,
    borderBottom: "1px solid #d9e2ee",
    whiteSpace: "nowrap",
  },
  td: {
    padding: 10,
    borderBottom: "1px solid #edf2f8",
    verticalAlign: "top",
  },
  tdRight: {
    padding: 10,
    borderBottom: "1px solid #edf2f8",
    verticalAlign: "top",
    textAlign: "right",
    fontWeight: 700,
  },
  tableInput: {
    width: "100%",
    minWidth: 100,
    boxSizing: "border-box",
    border: "1px solid #c8d2e1",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 14,
    background: "#fff",
  },
  emptyCell: {
    textAlign: "center",
    padding: 28,
    color: "#697791",
  },
  categoryHint: {
    marginTop: 6,
    fontSize: 12,
    color: "#7a879d",
    lineHeight: 1.4,
  },
  summaryBar: {
    marginTop: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    fontWeight: 700,
    color: "#32425b",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 20,
  },
  modalBox: {
    width: "100%",
    maxWidth: 460,
    background: "#ffffff",
    borderRadius: 24,
    padding: "32px 28px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
    textAlign: "center",
  },
  loaderWrap: {
    position: "relative",
    width: 90,
    height: 90,
    margin: "0 auto 18px auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loaderRing: {
    width: 74,
    height: 74,
    borderRadius: "50%",
    border: "6px solid #dbe7ff",
    borderTop: "6px solid #1f6feb",
    animation: "spin 1s linear infinite",
  },
  loaderDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "#1f6feb",
    boxShadow: "0 0 16px rgba(31,111,235,0.45)",
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1f2d3d",
    marginBottom: 10,
  },
  modalText: {
    fontSize: 17,
    color: "#50627a",
    lineHeight: 1.6,
  },
  modalSubText: {
    fontSize: 15,
    color: "#7b8aa0",
    marginTop: 8,
    marginBottom: 20,
  },
  progressFake: {
    width: "100%",
    height: 10,
    background: "#eaf1fb",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFakeBar: {
    width: "45%",
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #1f6feb, #68a3ff)",
    animation: "loadingBar 1.6s ease-in-out infinite",
  },
};