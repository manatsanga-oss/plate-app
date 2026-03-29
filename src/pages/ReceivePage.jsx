import { useMemo, useRef, useState } from "react";

const API_URL =
  "https://n8n-new-project-gwf2.onrender.com/webhook/office-api";

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function emptyHeader() {
  return {
    receive_id: "",
    doc_no: "",
    receive_no: "",
    receive_date: todayStr(),
    vendor_name: "",
    buyerName: "",
    created_by: "",
  };
}

function createEmptyRow(receiveId = "", lineNo = 1) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    receive_item_id: "",
    receive_id: receiveId,
    line_no: lineNo,
    product_code: "",
    product_name_from_ocr: "",
    product_id: "",
    product_name: "",
    qty: "",
    unit: "",
    unit_price: "",
    amount: 0,
    quantity_inferred: false,
    match_status: "UNMATCHED",
    match_score: "",
    key: "",
    created_at: "",
    updated_at: "",
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

function inputNumberOnFocus(value) {
  if (value === "" || value === null || value === undefined) return "";
  const n = toNumber(value);
  return Number.isFinite(n) ? String(n) : "";
}

function getCurrentUserId() {
  return (
    localStorage.getItem("user_id") ||
    localStorage.getItem("employee_id") ||
    localStorage.getItem("staff_id") ||
    localStorage.getItem("admin_id") ||
    localStorage.getItem("id") ||
    localStorage.getItem("username") ||
    ""
  );
}

function getCurrentUserName() {
  return (
    localStorage.getItem("user_name") ||
    localStorage.getItem("employee_name") ||
    localStorage.getItem("staff_name") ||
    localStorage.getItem("admin_name") ||
    localStorage.getItem("full_name") ||
    localStorage.getItem("display_name") ||
    localStorage.getItem("name") ||
    localStorage.getItem("username") ||
    localStorage.getItem("email") ||
    ""
  );
}

function normalizeText(value) {
  return T(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value) {
  return T(value).replace(/[\s\-_.//]/g, "").toUpperCase();
}

function firstNotEmpty(...vals) {
  for (const v of vals) {
    if (T(v) !== "") return v;
  }
  return "";
}

export default function ReceivePage({ currentUser }) {
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState("form");
  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [historyKeyword, setHistoryKeyword] = useState("");

  const [header, setHeader] = useState({
    ...emptyHeader(),
    created_by: getCurrentUserName() || getCurrentUserId(),
  });

  const [items, setItems] = useState([]);

  // เก็บสินค้าในระบบทั้งหมดจาก n8n
  const [productsMaster, setProductsMaster] = useState([]);
  const [productAliases, setProductAliases] = useState([]);

  const grandTotal = useMemo(() => {
    return items.reduce((sum, row) => sum + toNumber(row.amount), 0);
  }, [items]);

  const filteredHistoryRows = useMemo(() => {
    const q = T(historyKeyword).toLowerCase();
    if (!q) return historyRows;

    return historyRows.filter((row) => {
      const receiveNo = T(row.receive_no).toLowerCase();
      const receiveDate = T(row.receive_date).toLowerCase();
      const vendorName = T(row.vendor_name).toLowerCase();

      return (
        receiveNo.includes(q) ||
        receiveDate.includes(q) ||
        vendorName.includes(q)
      );
    });
  }, [historyRows, historyKeyword]);

  const productSearchIndex = useMemo(() => {
    const map = new Map();

    for (const p of productsMaster) {
      const product = {
        product_id: T(p.product_id),
        product_name: T(p.product_name),
        product_code: T(firstNotEmpty(p.product_code, p.code)),
        unit: T(firstNotEmpty(p.unit, p.uom)),
        product_group: T(firstNotEmpty(p.product_group, p.category)),
        product_alias: T(firstNotEmpty(p.product_alias, p.alias)),
        keywords: T(firstNotEmpty(p.keywords, p.keyword)),
      };

      if (!product.product_id && !product.product_name) continue;

      map.set(
        product.product_id || `${product.product_name}|${product.product_code}`,
        product
      );
    }

    return Array.from(map.values());
  }, [productsMaster]);

  const productSuggestionList = useMemo(() => {
    return productSearchIndex.map((p) => {
      const aliasTexts = productAliases
        .filter((a) => T(a.product_id) === T(p.product_id))
        .map((a) =>
          T(
            firstNotEmpty(
              a.alias_name,
              a.product_name_from_ocr,
              a.alias,
              a["ชื่อจาก OCR"]
            )
          )
        )
        .filter(Boolean);

      return {
        ...p,
        search_blob: normalizeText(
          [
            p.product_name,
            p.product_code,
            p.unit,
            p.product_alias,
            p.keywords,
            ...aliasTexts,
          ].join(" ")
        ),
      };
    });
  }, [productSearchIndex, productAliases]);

  function getSuggestions(query, limit = 8) {
    const q = normalizeText(query);
    if (!q || q.length < 2) return [];

    return productSuggestionList
      .filter((p) => p.search_blob.includes(q))
      .slice(0, limit);
  }

  function findProductByExactNameOrCode(value) {
    const qText = normalizeText(value);
    const qCode = normalizeCode(value);

    return (
      productSuggestionList.find(
        (p) =>
          normalizeText(p.product_name) === qText ||
          normalizeCode(p.product_code) === qCode
      ) || null
    );
  }

  function resetAll() {
    setSelectedFile(null);
    setHeader({
      ...emptyHeader(),
      created_by: getCurrentUserName() || getCurrentUserId(),
    });
    setItems([]);
    setProductsMaster([]);
    setProductAliases([]);
    setOcrStatus("");
    setErrorMessage("");
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setErrorMessage("");
  }

  function calcRowAmount(row) {
    const qty = toNumber(row.qty);
    const price = toNumber(row.unit_price);
    return +(qty * price).toFixed(2);
  }

  function setFormFromDocumentData(data) {
    const headerData = data?.header || {};

    setHeader({
      receive_id: headerData.receive_id || "",
      doc_no: headerData.doc_no || "",
      receive_no: headerData.receive_no || "",
      receive_date: headerData.receive_date || todayStr(),
      vendor_name: headerData.vendor_name || "",
      buyerName: headerData.buyerName || headerData.buyer_name || "",
      created_by:
        headerData.created_by || getCurrentUserName() || getCurrentUserId(),
    });

    // รับสินค้าทั้งระบบจาก n8n
    setProductsMaster(Array.isArray(data?.products_master) ? data.products_master : []);
    setProductAliases(Array.isArray(data?.product_aliases) ? data.product_aliases : []);

    const sourceItems = Array.isArray(data?.items) ? data.items : [];

    const rows = sourceItems.map((item, index) => {
      const qty = toNumber(item?.qty);
      const unitPrice = toNumber(item?.unit_price);
      const amount = toNumber(item?.amount ?? item?.total);

      const matchedName = T(item?.product_name) || "";

      return {
        id: `${Date.now()}-${index}`,
        receive_item_id: item?.receive_item_id || "",
        receive_id: item?.receive_id || headerData.receive_id || "",
        line_no: item?.line_no || index + 1,
        product_code: item?.product_code || item?.code || "",
        product_name_from_ocr:
          item?.product_name_from_ocr || item?.description_raw || "",
        product_id: item?.product_id || "",
        product_name: matchedName,
        qty: qty ? String(qty) : "",
        unit: item?.unit || "",
        unit_price: unitPrice ? formatNumber(unitPrice) : "",
        amount: amount || +(qty * unitPrice).toFixed(2),
        quantity_inferred: Boolean(item?.quantity_inferred),
        match_status:
          item?.match_status || (item?.product_id ? "MATCHED" : "UNMATCHED"),
        match_score: item?.match_score ?? "",
        key: item?.key || "",
        created_at: item?.created_at || "",
        updated_at: item?.updated_at || "",
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

      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ocr_invoice",
          image_base64: base64,
          filename: selectedFile.name,
        }),
      });

      if (!res.ok) {
        throw new Error(`OCR request failed: HTTP ${res.status}`);
      }

      const rawData = await res.json();
      const data = Array.isArray(rawData) ? rawData[0] : rawData;
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

      row.amount = calcRowAmount(row);
      next[index] = row;
      return next;
    });
  }

  function applySelectedProduct(index, product, typedValue = "") {
    if (!product) {
      updateRow(index, {
        product_name: typedValue,
        product_id: "",
        match_status: T(typedValue) ? "UNMATCHED" : "UNMATCHED",
        match_score: "",
      });
      return;
    }

    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      row.product_id = product.product_id || "";
      row.product_name = product.product_name || typedValue || "";
      row.product_code = product.product_code || row.product_code || "";
      row.unit = product.unit || row.unit || "";
      row.match_status = "MATCHED";
      row.match_score = 1;
      row.amount = calcRowAmount(row);
      next[index] = row;
      return next;
    });
  }

  function handleProductNameChange(index, value) {
    updateRow(index, { product_name: value });

    const exact = findProductByExactNameOrCode(value);
    if (exact) {
      applySelectedProduct(index, exact, value);
    }
  }

  function handleProductNameBlur(index, value) {
    const exact = findProductByExactNameOrCode(value);
    if (exact) {
      applySelectedProduct(index, exact, value);
      return;
    }

    updateRow(index, {
      product_name: value,
      product_id: "",
      match_status: T(value) ? "UNMATCHED" : "UNMATCHED",
      match_score: "",
    });
  }

  function handleAddRow() {
    setItems((prev) => [
      ...prev,
      createEmptyRow(header.receive_id || "", prev.length + 1),
    ]);
  }

  function handleDeleteRow(index) {
    setItems((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((row, idx) => ({
          ...row,
          line_no: idx + 1,
        }))
    );
  }

  function handleQtyBlur(index) {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      row.qty = row.qty === "" ? "" : formatQty(row.qty);
      row.amount = calcRowAmount(row);
      next[index] = row;
      return next;
    });
  }

  function handlePriceBlur(index) {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      row.unit_price = row.unit_price === "" ? "" : formatNumber(row.unit_price);
      row.amount = calcRowAmount(row);
      next[index] = row;
      return next;
    });
  }

  async function handleSave() {
    try {
      setSaving(true);
      setErrorMessage("");

      if (!T(header.receive_no)) {
        alert("กรุณากรอกเลขที่รับสินค้า");
        return;
      }

      if (!T(header.receive_date)) {
        alert("กรุณากรอกวันที่รับสินค้า");
        return;
      }

      if (!T(header.vendor_name)) {
        alert("กรุณากรอกชื่อผู้ขาย");
        return;
      }

      if (!T(header.buyerName)) {
        alert("กรุณาเลือกผู้ซื้อ");
        return;
      }

      if (!items.length) {
        alert("ยังไม่มีรายการสินค้า");
        return;
      }

      for (let i = 0; i < items.length; i++) {
        const row = items[i];
        if (!T(row.product_name)) {
          alert(`กรุณากรอกชื่อสินค้า บรรทัดที่ ${i + 1}`);
          return;
        }
        if (toNumber(row.qty) <= 0) {
          alert(`จำนวนต้องมากกว่า 0 บรรทัดที่ ${i + 1}`);
          return;
        }
      }

      // ส่ง "ชื่อผู้ใช้" แทน id
      const currentUserName = getCurrentUserName() || getCurrentUserId();
      const stockGroup = header.buyerName === "ป.เปา มอเตอร์เซอร์วิส" ? "ppao" : "singchai";

      const payload = {
        success: true,
        header: {
          receive_id: header.receive_id || "",
          receive_no: header.receive_no,
          receive_date: header.receive_date,
          vendor_name: header.vendor_name,
          buyerName: header.buyerName,
          stock_group: stockGroup,
          created_by: currentUserName,
        },
        items: items.map((row, index) => ({
          receive_item_id: row.receive_item_id || "",
          receive_id: row.receive_id || header.receive_id || "",
          line_no: index + 1,
          product_code: row.product_code || "",
          product_name_from_ocr: row.product_name_from_ocr || "",
          product_id: row.product_id || "",
          product_name: row.product_name || "",
          qty: toNumber(row.qty),
          unit: row.unit || "",
          unit_price: toNumber(row.unit_price),
          amount: calcRowAmount(row),
          quantity_inferred: Boolean(row.quantity_inferred),
          is_new: !row.product_id && T(row.product_name) ? true : false,
          match_status: T(row.product_name) ? "MATCHED" : "UNMATCHED",
          match_score:
            row.match_score === "" || row.match_score === null
              ? ""
              : toNumber(row.match_score),
          key:
            row.key ||
            `${header.receive_no || ""}${row.product_code || ""}${String(
              index + 1
            ).padStart(3, "0")}`,
        })),
        summary: {
          item_count: items.length,
          grand_total: grandTotal,
          file_name: selectedFile?.name || "",
        },
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "save_receive", ...payload }),
      });

      if (!res.ok) {
        throw new Error(`Save request failed: HTTP ${res.status}`);
      }

      const result = await res.json();
      console.log("SAVE RESULT:", result);

      if (result.doc_no) {
        setHeader(prev => ({ ...prev, doc_no: result.doc_no }));
      }

      alert("บันทึกรับสินค้าเรียบร้อย");
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

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_receive_history" }),
      });

      if (!res.ok) {
        throw new Error(`History request failed: HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log("HISTORY RESULT:", data);

      const rows = Array.isArray(data) ? data : data?.data || [];
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

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "get_receive_detail",
          receive_no: row.receive_no,
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
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <div className="page-topbar" style={{ marginBottom: 0 }}>
              <h2 className="page-title">📥 รับวัสดุ</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button style={styles.primaryButton} type="button" onClick={resetAll}>📋 รับวัสดุ</button>
                <button style={styles.secondaryButton} type="button" onClick={handleOpenHistory}>🔍 ประวัติรับสินค้า</button>
                <button
                  style={{ ...styles.secondaryButton, opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}
                  type="button" onClick={handleSave} disabled={saving}
                >
                  {saving ? "กำลังบันทึก..." : "💾 บันทึกรับสินค้า"}
                </button>
                <div style={styles.userInfo}>
                  👤 {currentUser?.name || currentUser?.username || getCurrentUserName() || "-"}
                  &nbsp;|&nbsp;
                  🏢 {currentUser?.branch || "-"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {mode === "history" ? (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>ประวัติรับสินค้า</span>
                <button type="button" style={styles.secondaryButton} onClick={() => setMode("form")}>
                  ← กลับ
                </button>
              </div>
            </div>
            <div style={styles.cardBody}>
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
                      <th style={styles.th}>เลขที่รับสินค้า</th>
                      <th style={styles.th}>วันที่รับ</th>
                      <th style={styles.th}>ผู้ขาย</th>
                      <th style={styles.th}>ผู้ซื้อ</th>
                      <th style={styles.th}>เปิด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistoryRows.map((row, index) => (
                      <tr key={`${row.receive_no}-${index}`}>
                        <td style={styles.td}>{row.receive_no}</td>
                        <td style={styles.td}>{row.receive_date ? new Date(row.receive_date).toLocaleDateString('th-TH', {day:'2-digit',month:'2-digit',year:'numeric'}) : ''}</td>
                        <td style={styles.td}>{row.vendor_name}</td>
                        <td style={styles.td}>{row.buyer_name || row.buyerName || ''}</td>
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
            </div>{/* cardBody */}
          </div>
        ) : (
          <div style={styles.stack}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>1) อัปโหลดใบกำกับภาษี</div>
              <div style={styles.cardBody}>

              <div style={styles.uploadBox}>
                <div style={{ fontSize: 44 }}>📷</div>
                <div style={styles.uploadTitle}>เลือกรูปภาพ</div>
                <div style={styles.uploadHint}>รองรับ JPG, PNG, HEIC</div>

                <div style={styles.buttonRow}>
                  <label style={styles.primaryButton}>
                    เลือกไฟล์
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.heic,.pdf"
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
              </div>{/* cardBody */}
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>2) รายละเอียดหัวเอกสาร</div>
              <div style={styles.cardBody}>
              <div style={styles.formGridHeaderSmall}>
                <div>
                  <label style={styles.label}>รหัสรับสินค้า</label>
                  <input
                    style={{...styles.input, background:"#f5f5f5"}}
                    value={header.doc_no || (header.receive_id ? "REC........." : "")}
                    readOnly
                  />
                </div>

                <div>
                  <label style={styles.label}>เลขที่เอกสาร</label>
                  <input
                    style={styles.input}
                    value={header.receive_no}
                    onChange={(e) => updateHeader("receive_no", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>วันที่รับ</label>
                  <input
                    type="date"
                    style={styles.input}
                    value={header.receive_date ? header.receive_date.split('T')[0] : ''}
                    onChange={(e) => updateHeader("receive_date", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>ชื่อผู้ขาย</label>
                  <input
                    style={styles.input}
                    value={header.vendor_name}
                    onChange={(e) => updateHeader("vendor_name", e.target.value)}
                  />
                </div>

                <div>
                  <label style={styles.label}>ผู้ซื้อ *</label>
                  <select
                    style={{
                      ...styles.input,
                      color: header.buyerName ? "#1a1a2e" : "#999",
                    }}
                    value={header.buyerName}
                    onChange={(e) => updateHeader("buyerName", e.target.value)}
                    required
                  >
                    <option value="">-- กรุณาเลือกผู้ซื้อ --</option>
                    <option value="สิงห์ชัย สยามยนต์">สิงห์ชัย สยามยนต์</option>
                    <option value="ป.เปา มอเตอร์เซอร์วิส">ป.เปา มอเตอร์เซอร์วิส</option>
                  </select>
                </div>
              </div>
              </div>{/* cardBody */}
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>3) ตรวจสอบและแก้ไขรายการวัสดุ</span>
                  <button type="button" style={styles.secondaryButton} onClick={handleAddRow}>
                    + เพิ่มรายการ
                  </button>
                </div>
              </div>
              <div style={styles.cardBody}>

              {items.length === 0 ? (
                <div style={styles.emptyBox}>
                  ยังไม่มีรายการสินค้า กรุณาเลือกไฟล์แล้วกดส่ง OCR หรือเปิดจากประวัติ
                </div>
              ) : (
                <div style={styles.rowList}>
                  <div style={styles.rowHeader}>
                    <div>รหัสสินค้า OCR</div>
                    <div>ชื่อสินค้าจาก OCR</div>
                    <div>ชื่อสินค้า</div>
                    <div>จำนวน</div>
                    <div>หน่วย</div>
                    <div>ราคาต่อหน่วย</div>
                    <div>รวม</div>
                    <div>ลบ</div>
                  </div>

                  {items.map((row, index) => {
                    const needManualName = !T(row.product_name);
                    const suggestions = getSuggestions(T(row.product_name), 8);
                    const datalistId = `product-suggestions-${row.id}`;

                    return (
                      <div key={row.id} style={styles.rowItemWrap}>
                        <div style={styles.rowGrid}>
                          <input
                            style={{...styles.tableInput, background:"#f5f5f5", color:"#555"}}
                            value={row.product_code}
                            readOnly
                            placeholder="รหัสสินค้า OCR"
                          />

                          <input
                            style={styles.tableInput}
                            value={row.product_name_from_ocr}
                            onChange={(e) =>
                              updateRow(index, {
                                product_name_from_ocr: e.target.value,
                              })
                            }
                            placeholder="ชื่อสินค้าจาก OCR"
                          />

                          <div style={styles.autoCompleteWrap}>
                            <input
                              list={datalistId}
                              style={{
                                ...styles.productNameInput,
                                ...(needManualName ? styles.categoryInputEmpty : {}),
                              }}
                              value={row.product_name}
                              onChange={(e) =>
                                handleProductNameChange(index, e.target.value)
                              }
                              onBlur={(e) =>
                                handleProductNameBlur(index, e.target.value)
                              }
                              placeholder={
                                needManualName
                                  ? "พิมพ์ชื่อสินค้าเพื่อค้นหา"
                                  : "ชื่อสินค้า"
                              }
                            />
                            <datalist id={datalistId}>
                              {suggestions.map((p) => (
                                <option
                                  key={`${datalistId}-${p.product_id}-${p.product_code}`}
                                  value={p.product_name}
                                >
                                  {`${p.product_code ? `[${p.product_code}] ` : ""}${
                                    p.product_name
                                  }${p.unit ? ` / ${p.unit}` : ""}`}
                                </option>
                              ))}
                            </datalist>
                          </div>

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
                            placeholder="จำนวน"
                          />

                          <input
                            style={styles.tableInput}
                            value={row.unit}
                            onChange={(e) =>
                              updateRow(index, { unit: e.target.value })
                            }
                            placeholder="หน่วย"
                          />

                          <input
                            type="text"
                            inputMode="decimal"
                            style={styles.tableInput}
                            value={row.unit_price}
                            onFocus={(e) => {
                              e.target.value = inputNumberOnFocus(row.unit_price);
                            }}
                            onChange={(e) =>
                              updateRow(index, { unit_price: e.target.value })
                            }
                            onBlur={() => handlePriceBlur(index)}
                            placeholder="ราคาต่อหน่วย"
                          />

                          <div style={styles.totalBoxSmall}>
                            {formatNumber(row.amount)}
                          </div>

                          <button
                            type="button"
                            style={styles.deleteButtonSmall}
                            onClick={() => handleDeleteRow(index)}
                          >
                            ลบ
                          </button>
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
              </div>{/* cardBody */}
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
    background: "#f3f4f6",
    padding: "20px",
    boxSizing: "border-box",
    fontFamily: "Tahoma, Arial, sans-serif",
    fontSize: "13px",
    color: "#333",
  },
  container: { width: "100%", maxWidth: 1360, margin: "0 auto" },
  card: {
    background: "#fff",
    border: "none",
    borderRadius: "14px",
    marginBottom: "16px",
    overflow: "hidden",
    boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
  },
  cardHeader: {
    padding: "10px 18px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "14px",
    fontWeight: "700",
    color: "#072d6b",
    background: "#fff",
  },
  cardBody: { padding: "14px 18px" },
  topBar: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  userInfo: {
    marginLeft: "auto",
    fontSize: "13px",
    color: "#475569",
    padding: "6px 12px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
  },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#072d6b" },
  headerBlock: {
    background: "#fff",
    borderRadius: "14px",
    padding: "12px 18px",
    marginBottom: "16px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
  },
  topButtonRow: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginTop: 6 },
  stack: { display: "flex", flexDirection: "column", gap: "16px" },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: "#072d6b" },
  sectionTitleLeft: { margin: 0, fontSize: 14, fontWeight: 700, color: "#072d6b" },
  sectionDescLeft: { marginTop: 3, color: "#94a3b8", textAlign: "left", fontSize: 12 },
  uploadBox: {
    marginTop: 10,
    border: "2px dashed #cbd5e1",
    borderRadius: "10px",
    padding: "20px",
    textAlign: "center",
    background: "#f8fafc",
  },
  uploadTitle: { fontSize: 13, fontWeight: 700, marginTop: 4, color: "#374151" },
  uploadHint: { color: "#94a3b8", marginTop: 3, fontSize: 12 },
  buttonRow: { display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginTop: 10 },
  buttonRowNoMargin: { display: "flex", gap: "8px", alignItems: "center" },
  primaryButton: {
    background: "#072d6b",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "7px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#e5e7eb",
    color: "#374151",
    border: "none",
    borderRadius: "8px",
    padding: "7px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  fileText: { marginTop: 8, fontSize: 12, color: "#475569" },
  statusText: { marginTop: 4, fontSize: 12, color: "#475569" },
  errorText: { marginTop: 6, color: "#ef4444", fontWeight: 700, fontSize: 12 },
  formGridHeaderSmall: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(160px, 1fr))",
    gap: 10,
    marginTop: 10,
    alignItems: "end",
  },
  label: {
    display: "block",
    marginBottom: 4,
    fontWeight: 700,
    fontSize: 12,
    color: "#64748b",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 13,
    outline: "none",
    minWidth: 0,
    fontFamily: "Tahoma, Arial, sans-serif",
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  emptyBox: {
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    borderRadius: 8,
    padding: "20px",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
  },
  rowList: { display: "flex", flexDirection: "column", gap: 6, width: "100%" },
  rowHeader: {
    display: "grid",
    gridTemplateColumns: "100px minmax(180px,1.7fr) minmax(180px,1.5fr) 80px 70px 100px 100px 60px",
    gap: 6,
    alignItems: "center",
    fontWeight: 700,
    color: "#64748b",
    fontSize: 12,
    padding: "6px 10px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
  },
  rowItemWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "8px 10px",
    background: "#fff",
    width: "100%",
    boxSizing: "border-box",
  },
  rowGrid: {
    display: "grid",
    gridTemplateColumns: "100px minmax(180px,1.7fr) minmax(180px,1.5fr) 80px 70px 100px 100px 60px",
    gap: 6,
    alignItems: "center",
    width: "100%",
  },
  autoCompleteWrap: { width: "100%", minWidth: 0 },
  tableInput: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 12,
    background: "#fff",
    outline: "none",
    fontFamily: "Tahoma, Arial, sans-serif",
  },
  productNameInput: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 12,
    background: "#fff",
    outline: "none",
    fontWeight: 600,
    fontFamily: "Tahoma, Arial, sans-serif",
  },
  categoryInputEmpty: { background: "#fef9c3", border: "1px solid #fde047" },
  totalBoxSmall: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 700,
    color: "#072d6b",
    background: "#f0f4ff",
    textAlign: "right",
    minHeight: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  deleteButtonSmall: {
    background: "#fff1f2",
    color: "#ef4444",
    border: "1px solid #fca5a5",
    borderRadius: 6,
    padding: "3px 8px",
    cursor: "pointer",
    fontSize: 12,
    minHeight: 26,
  },
  summaryBar: {
    marginTop: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
    fontWeight: 700,
    color: "#1e3a5f",
    fontSize: 13,
    background: "#f0f4ff",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    padding: "8px 14px",
  },
  historySearchWrap: { marginBottom: 10 },
  historySearchInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 13,
    outline: "none",
    fontFamily: "Tahoma, Arial, sans-serif",
  },
  historyTableWrap: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    background: "#fff",
  },
  historyTable: { width: "100%", borderCollapse: "collapse", minWidth: 600 },
  th: {
    background: "#072d6b",
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    padding: "10px 14px",
    textAlign: "left",
  },
  td: {
    padding: "10px 14px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 13,
    color: "#374151",
    verticalAlign: "middle",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 20,
  },
  modalBox: {
    width: "100%",
    maxWidth: 420,
    background: "#fff",
    borderRadius: 12,
    padding: "24px 20px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
    textAlign: "center",
  },
  loaderWrap: {
    position: "relative",
    width: 64,
    height: 64,
    margin: "0 auto 12px auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loaderRing: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    border: "5px solid #dbeafe",
    borderTop: "5px solid #072d6b",
    animation: "spin 1s linear infinite",
  },
  loaderDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#072d6b",
  },
  modalTitle: { fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 6 },
  modalText: { fontSize: 13, color: "#475569", lineHeight: 1.5 },
  modalSubText: { fontSize: 12, color: "#94a3b8", marginTop: 6, marginBottom: 12 },
  progressFake: {
    width: "100%",
    height: 6,
    background: "#e0e7ff",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
  },
  progressFakeBar: {
    width: "45%",
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #072d6b, #3b82f6)",
    animation: "loadingBar 1.6s ease-in-out infinite",
  },
};