import { useMemo, useState } from "react";

const OCR_WEBHOOK_URL =
  "https://n8n-new-project-gwf2.onrender.com/webhook/094b8071-9478-4bc2-90e8-4c0d21660f0c";

const SAVE_WEBHOOK_URL =
  "https://n8n-new-project-gwf2.onrender.com/webhook/c577cfab-e904-4c2b-86e8-3a8296676ec5";

// ดึงรายการจากชีต "หัวตาราง"
const HISTORY_WEBHOOK_URL =
  "https://n8n-new-project-gwf2.onrender.com/webhook/50a16073-d606-479c-aba3-91ae9b877dec";

// รับ docNo แล้วดึง header + items กลับมา
const DOC_DETAIL_WEBHOOK_URL =
  "https://n8n-new-project-gwf2.onrender.com/webhook/bbaae286-5879-48cb-9746-9c51bba6d3ae";

const DEFAULT_CATEGORY_OPTIONS = [
  "เครื่องเขียน",
  "กระดาษ",
  "อุปกรณ์ทำความสะอาด",
  "ของใช้สำนักงาน",
  "เครื่องดื่ม",
  "บรรจุภัณฑ์",
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

function createEmptyRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: "",
    ocrName: "",
    productName: "",
    category: "",
    qty: "",
    unit: "",
    price: "",
    total: 0,
    quantityInferred: false,
  };
}

function T(v) {
  return (v ?? "").toString().trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value, digits = 2) {
  const n = toNumber(value);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatQty(value) {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function normalizeCategory(value) {
  const s = T(value);
  if (!s) return "";

  const normalized = s.replace(/\s+/g, "").toLowerCase();

  if (
    normalized === "อื่นๆ" ||
    normalized === "อื่น" ||
    normalized === "other" ||
    normalized === "others"
  ) {
    return "";
  }

  return s;
}

function uniqueTextList(values) {
  const seen = new Set();
  const out = [];

  for (const v of values) {
    const s = normalizeCategory(v);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }

  return out;
}

function inputNumberOnFocus(value) {
  if (value === "" || value === null || value === undefined) return "";
  const n = toNumber(value);
  return Number.isFinite(n) ? String(n) : "";
}

export default function App() {
  const [mode, setMode] = useState("form"); // form | history

  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [historyKeyword, setHistoryKeyword] = useState("");

  const [header, setHeader] = useState(emptyHeader());
  const [items, setItems] = useState([]);

  const grandTotal = useMemo(() => {
    return items.reduce((sum, row) => sum + toNumber(row.total), 0);
  }, [items]);

  const categoryOptions = useMemo(() => {
    const itemCategories = items.map((row) => row.category);
    return uniqueTextList([...DEFAULT_CATEGORY_OPTIONS, ...itemCategories]);
  }, [items]);

  const filteredHistoryRows = useMemo(() => {
    const q = T(historyKeyword).toLowerCase();
    if (!q) return historyRows;

    return historyRows.filter((row) => {
      const docNo = T(row.docNo).toLowerCase();
      const docDate = T(row.docDate).toLowerCase();
      const sellerName = T(row.sellerName).toLowerCase();
      return (
        docNo.includes(q) ||
        docDate.includes(q) ||
        sellerName.includes(q)
      );
    });
  }, [historyRows, historyKeyword]);

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

  function calcRowTotal(row) {
    const qty = toNumber(row.qty);
    const price = toNumber(row.price);
    return qty * price;
  }

  function setFormFromDocumentData(data) {
    const headerData = data?.header || {};

    setHeader({
      sellerName: headerData.sellerName || data?.seller?.name_th || "",
      sellerTaxId: headerData.sellerTaxId || data?.seller?.tax_id || "",
      sellerAddress: headerData.sellerAddress || data?.seller?.address_th || "",
      buyerName: headerData.buyerName || data?.buyer?.name || "",
      buyerTaxId: headerData.buyerTaxId || data?.buyer?.tax_id || "",
      buyerAddress: headerData.buyerAddress || data?.buyer?.address || "",
      contactName: headerData.contactName || data?.ship_to?.contact_name || "",
      contactTel: headerData.contactTel || data?.ship_to?.tel || "",
      docNo: headerData.docNo || data?.document?.doc_no || "",
      docDate: headerData.docDate || data?.document?.date || "",
      dueDate: headerData.dueDate || data?.document?.due_date || "",
      paymentType: headerData.paymentType || data?.document?.payment_type || "",
      soNo: headerData.soNo || data?.document?.so_no || "",
      pqNo: headerData.pqNo || data?.document?.pq_no || "",
      salesCode: headerData.salesCode || data?.document?.sales_code || "",
      customerId: headerData.customerId || data?.document?.customer_id || "",
    });

    const sourceItems = Array.isArray(data?.items) ? data.items : [];

    const rows = sourceItems.map((item, index) => {
      const qty = toNumber(
        item?.quantity ?? item?.qty
      );
      const price = toNumber(
        item?.unit_price ?? item?.price
      );
      const amount = toNumber(
        item?.net_amount ?? item?.total
      );

      const categoryFromApi = normalizeCategory(
        item?.["กลุ่มสินค้า"] ||
          item?.category ||
          item?.category_name ||
          ""
      );

      return {
        id: `${Date.now()}-${index}`,
        code: item?.code || item?.product_code || "",
        ocrName: item?.description_raw || item?.product_name_from_ocr || "",
        productName:
          item?.description_clean ||
          item?.product_name ||
          item?.description_raw ||
          item?.product_name_from_ocr ||
          "",
        category: categoryFromApi,
        qty: qty ? String(qty) : "",
        unit: item?.unit || "",
        price: price ? formatNumber(price) : "",
        total: amount || qty * price,
        quantityInferred: Boolean(item?.quantity_inferred),
      };
    });

    setItems(rows);
    setOcrStatus("โหลดข้อมูลแล้ว");
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

      setFormFromDocumentData(data);
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
      row.total = calcRowTotal(row);

      next[index] = row;
      return next;
    });
  }

  function handleAddRow() {
    setItems((prev) => [...prev, createEmptyRow()]);
  }

  function handleDeleteRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleQtyBlur(index) {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      row.qty = row.qty === "" ? "" : formatQty(row.qty);
      row.total = calcRowTotal(row);
      next[index] = row;
      return next;
    });
  }

  function handlePriceBlur(index) {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      row.price = row.price === "" ? "" : formatNumber(row.price);
      row.total = calcRowTotal(row);
      next[index] = row;
      return next;
    });
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

  async function handleOpenHistory() {
    try {
      setMode("history");
      setHistoryLoading(true);
      setHistoryError("");
      setHistoryRows([]);

      const res = await fetch(HISTORY_WEBHOOK_URL, {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error(`History request failed: HTTP ${res.status}`);
      }

      const data = await res.json();
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      setHistoryRows(rows);
    } catch (error) {
      console.error(error);
      setHistoryError("โหลดประวัติไม่สำเร็จ");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSelectHistoryRow(row) {
    try {
      setLoadingOCR(true);
      setErrorMessage("");

      const res = await fetch(DOC_DETAIL_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          docNo: row.docNo,
        }),
      });

      if (!res.ok) {
        throw new Error(`Doc detail request failed: HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log("DOC DETAIL:", data);

      setFormFromDocumentData(data);
      setMode("form");
    } catch (error) {
      console.error(error);
      setErrorMessage("โหลดข้อมูลเอกสารไม่สำเร็จ");
    } finally {
      setLoadingOCR(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerBlock}>
          <h1 style={styles.title}>ระบบรับวัสดุสำนักงาน</h1>

          <div style={styles.topButtonRow}>
            <button
              style={styles.secondaryButton}
              type="button"
              onClick={handleOpenHistory}
            >
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

        {mode === "history" ? (
          <div style={styles.card}>
            <div style={styles.sectionHeaderRow}>
              <div style={{ flex: 1 }}>
                <h2 style={styles.sectionTitleLeft}>ประวัติรับสินค้า</h2>
                <div style={styles.sectionDescLeft}>
                  เลือกเอกสารที่ต้องการเปิดขึ้นมาแก้ไข
                </div>
              </div>

              <div style={styles.buttonRowNoMargin}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setMode("form")}
                >
                  กลับหน้าหลัก
                </button>
              </div>
            </div>

            <div style={styles.historySearchWrap}>
              <input
                style={styles.historySearchInput}
                placeholder="ค้นหาเลขที่เอกสาร / วันที่ / ชื่อผู้ขาย"
                value={historyKeyword}
                onChange={(e) => setHistoryKeyword(e.target.value)}
              />
            </div>

            {historyLoading ? (
              <div style={styles.emptyBox}>กำลังโหลดข้อมูล...</div>
            ) : historyError ? (
              <div style={styles.errorText}>{historyError}</div>
            ) : filteredHistoryRows.length === 0 ? (
              <div style={styles.emptyBox}>ไม่พบข้อมูลประวัติ</div>
            ) : (
              <div style={styles.historyTableWrap}>
                <table style={styles.historyTable}>
                  <thead>
                    <tr>
                      <th style={styles.th}>เลขที่เอกสาร</th>
                      <th style={styles.th}>วันที่</th>
                      <th style={styles.th}>ผู้ขาย</th>
                      <th style={styles.th}>จำนวนรายการ</th>
                      <th style={styles.th}>ยอดรวม</th>
                      <th style={styles.th}>เปิด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistoryRows.map((row, index) => (
                      <tr key={`${row.docNo}-${index}`}>
                        <td style={styles.td}>{row.docNo}</td>
                        <td style={styles.td}>{row.docDate}</td>
                        <td style={styles.td}>{row.sellerName}</td>
                        <td style={styles.td}>{formatQty(row.item_count)}</td>
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          {formatNumber(row.grandTotal)}
                        </td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            style={styles.primaryButton}
                            onClick={() => handleSelectHistoryRow(row)}
                          >
                            เปิด
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.stack}>
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

            <div style={styles.card}>
              <div style={styles.sectionHeaderRow}>
                <div>
                  <h2 style={styles.sectionTitleLeft}>3) ตรวจสอบและแก้ไขรายการวัสดุ</h2>
                  <div style={styles.sectionDescLeft}>
                    ตรวจสอบชื่อสินค้า กลุ่มสินค้า จำนวน หน่วย และราคา ก่อนบันทึก
                  </div>
                </div>

                <div style={styles.buttonRowNoMargin}>
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

              {items.length === 0 ? (
                <div style={styles.emptyBox}>
                  ยังไม่มีรายการสินค้า กรุณาเลือกไฟล์แล้วกดส่ง OCR หรือเปิดจากประวัติ
                </div>
              ) : (
                <div style={styles.itemList}>
                  {items.map((row, index) => {
                    const datalistId = `category-list-${row.id}`;
                    const categoryEmpty = !T(row.category);

                    return (
                      <div key={row.id} style={styles.itemCard}>
                        <div style={styles.itemCardHeader}>
                          <div style={styles.itemIndex}>รายการที่ {index + 1}</div>
                          <button
                            type="button"
                            style={styles.deleteButton}
                            onClick={() => handleDeleteRow(index)}
                          >
                            ลบ
                          </button>
                        </div>

                        <div style={styles.itemGrid}>
                          <div>
                            <label style={styles.label}>รหัส</label>
                            <input
                              style={styles.tableInput}
                              value={row.code}
                              onChange={(e) =>
                                updateRow(index, { code: e.target.value })
                              }
                            />
                          </div>

                          <div style={styles.productNameCol}>
                            <label style={styles.label}>ชื่อสินค้า</label>
                            <input
                              style={styles.productNameInput}
                              value={row.productName}
                              onChange={(e) =>
                                updateRow(index, { productName: e.target.value })
                              }
                            />
                          </div>

                          <div>
                            <label style={styles.label}>กลุ่มสินค้า</label>
                            <input
                              list={datalistId}
                              style={{
                                ...styles.tableInput,
                                ...(categoryEmpty ? styles.categoryInputEmpty : {}),
                              }}
                              value={row.category}
                              placeholder=""
                              onChange={(e) =>
                                updateRow(index, {
                                  category: e.target.value,
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
                          </div>

                          <div>
                            <label style={styles.label}>จำนวน</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              style={styles.tableInput}
                              value={row.qty}
                              onFocus={(e) => {
                                e.target.value = inputNumberOnFocus(row.qty);
                              }}
                              onChange={(e) =>
                                updateRow(index, { qty: e.target.value })
                              }
                              onBlur={() => handleQtyBlur(index)}
                            />
                          </div>

                          <div>
                            <label style={styles.label}>หน่วย</label>
                            <input
                              style={styles.tableInput}
                              value={row.unit}
                              onChange={(e) =>
                                updateRow(index, { unit: e.target.value })
                              }
                            />
                          </div>

                          <div>
                            <label style={styles.label}>ราคา</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              style={styles.tableInput}
                              value={row.price}
                              onFocus={(e) => {
                                e.target.value = inputNumberOnFocus(row.price);
                              }}
                              onChange={(e) =>
                                updateRow(index, { price: e.target.value })
                              }
                              onBlur={() => handlePriceBlur(index)}
                            />
                          </div>

                          <div>
                            <label style={styles.label}>รวม</label>
                            <div style={styles.totalBox}>
                              {formatNumber(row.total)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={styles.summaryBar}>
                <div>จำนวนรายการ: {formatQty(items.length)}</div>
                <div>รวมทั้งสิ้น: {formatNumber(grandTotal)} บาท</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {loadingOCR && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.loaderWrap}>
              <div style={styles.loaderRing}></div>
              <div style={styles.loaderDot}></div>
            </div>

            <div style={styles.modalTitle}>กำลังประมวลผลข้อมูล</div>
            <div style={styles.modalText}>
              ระบบกำลังโหลดหรืออ่านข้อมูลเอกสาร
            </div>
            <div style={styles.modalSubText}>กรุณารอสักครู่ อย่าปิดหน้านี้</div>

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
    maxWidth: 1360,
    margin: "0 auto",
  },
  headerBlock: {
    background: "#ffffff",
    borderRadius: 22,
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
  topButtonRow: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 18,
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  card: {
    background: "#ffffff",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    textAlign: "center",
  },
  sectionTitleLeft: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    textAlign: "left",
  },
  sectionDescLeft: {
    marginTop: 8,
    color: "#6c7a92",
    textAlign: "left",
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
  buttonRowNoMargin: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
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
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: 16,
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
    gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
    gap: 14,
    marginTop: 18,
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontWeight: 700,
    fontSize: 14,
    color: "#4d5b73",
    textAlign: "center",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #c8d2e1",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 16,
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
  emptyBox: {
    border: "1px solid #d9e2ee",
    background: "#f8fbff",
    borderRadius: 18,
    padding: 28,
    textAlign: "center",
    color: "#697791",
    fontSize: 16,
  },
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  itemCard: {
    border: "1px solid #d9e2ee",
    borderRadius: 20,
    padding: 18,
    background: "#fcfdff",
    overflow: "hidden",
  },
  itemCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  itemIndex: {
    fontSize: 20,
    fontWeight: 700,
    color: "#24324a",
  },
  itemGrid: {
    display: "grid",
    gridTemplateColumns:
      "130px minmax(220px, 2fr) minmax(160px, 1.2fr) 90px 110px 120px 150px",
    gap: 12,
    alignItems: "end",
    minWidth: 0,
  },
  productNameCol: {
    minWidth: 0,
  },
  tableInput: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    border: "1px solid #c8d2e1",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 18,
    background: "#fff",
    outline: "none",
  },
  productNameInput: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    border: "1px solid #c8d2e1",
    borderRadius: 10,
    padding: "13px 14px",
    fontSize: 18,
    background: "#fff",
    outline: "none",
    fontWeight: 600,
  },
  categoryInputEmpty: {
    background: "#fff4a8",
    border: "1px solid #e0bf2f",
  },
  totalBox: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d7e0ec",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 22,
    fontWeight: 700,
    color: "#17325c",
    background: "#f7faff",
    textAlign: "right",
    minHeight: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  summaryBar: {
    marginTop: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    fontWeight: 700,
    color: "#32425b",
    fontSize: 20,
    background: "#f5f8fc",
    borderRadius: 16,
    padding: "16px 18px",
  },
  historySearchWrap: {
    marginBottom: 16,
  },
  historySearchInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #c8d2e1",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 16,
    outline: "none",
  },
  historyTableWrap: {
    overflowX: "auto",
    border: "1px solid #d9e2ee",
    borderRadius: 16,
    background: "#fff",
  },
  historyTable: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 900,
  },
  th: {
    background: "#f3f7fc",
    color: "#32425b",
    fontWeight: 700,
    fontSize: 15,
    padding: "12px 14px",
    borderBottom: "1px solid #d9e2ee",
    textAlign: "left",
  },
  td: {
    padding: "12px 14px",
    borderBottom: "1px solid #eef2f7",
    fontSize: 15,
    color: "#24324a",
    verticalAlign: "middle",
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