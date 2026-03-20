import { useMemo, useState } from "react";

// ===============================
// CONFIGcm
// ===============================
const MATERIAL_WEBHOOK_URL =
  "https://n8n-new-project-gwf2.onrender.com/webhook/4f649516-de04-4661-a6f5-caae15261e7f";

// เปลี่ยนเป็น webhook จริงตอนใช้งานจริง
const SAVE_ISSUE_WEBHOOK_URL =
  "https://n8n-new-project-gwf2.onrender.com/webhook-test/4541d09a-88a3-4b45-877c-f148163cb8c3";

// ===============================
// HELPERS
// ===============================
function T(v) {
  return (v ?? "").toString().trim();
}

function toNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeMaterialRow(row, index = 0) {
  const code =
    T(row["รหัส"]) ||
    T(row["material_code"]) ||
    T(row["product_code"]) ||
    T(row["code"]) ||
    `ITEM-${index + 1}`;

  const name =
    T(row["ชื่อวัสดุ"]) ||
    T(row["ชื่อสินค้า"]) ||
    T(row["product_name"]) ||
    T(row["material_name"]) ||
    T(row["item_name"]) ||
    "-";

  const category =
    T(row["กลุ่มสินค้า"]) ||
    T(row["category"]) ||
    T(row["product_group"]) ||
    "ไม่ระบุกลุ่ม";

  const unit =
    T(row["หน่วย"]) ||
    T(row["unit"]) ||
    T(row["unit_name"]) ||
    "-";

  const qtyReceive =
    toNum(row["จำนวนรับเข้า"]) ||
    toNum(row["qty_receive"]) ||
    toNum(row["receive_qty"]);

  const qtyIssue =
    toNum(row["จำนวนจ่ายออก"]) ||
    toNum(row["qty_issue"]) ||
    toNum(row["issue_qty"]);

  let qtyBalance =
    toNum(row["จำนวนคงเหลือ"]) ||
    toNum(row["qty_balance"]) ||
    toNum(row["balance_qty"]);

  // ถ้าไม่ได้ส่งคงเหลือมา แต่มีรับเข้า/จ่ายออก
  if (!qtyBalance && (qtyReceive || qtyIssue)) {
    qtyBalance = qtyReceive - qtyIssue;
  }

  return {
    id: code,
    code,
    name,
    category,
    unit,
    qtyReceive,
    qtyIssue,
    qtyBalance,
    raw: row,
  };
}

function formatNumber(value) {
  const n = toNum(value);
  return n.toLocaleString("th-TH");
}

// ===============================
// COMPONENT
// ===============================
export default function IssuePage() {
  const [materials, setMaterials] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const [searchText, setSearchText] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [currentPage, setCurrentPage] = useState(1);

  const [requesterName, setRequesterName] = useState("จักรพงศ์ พ่อมือ");
  const [department, setDepartment] = useState("กลุ่มงาน 1");
  const [note, setNote] = useState("");

  // -------------------------------
  // LOAD MATERIALS
  // -------------------------------
  const loadMaterials = async () => {
    try {
      setLoading(true);
      setErrorText("");
      setSuccessText("");

      const res = await fetch(MATERIAL_WEBHOOK_URL, {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error(`โหลดข้อมูลไม่สำเร็จ (${res.status})`);
      }

      const data = await res.json();

      let rows = [];
      if (Array.isArray(data)) {
        rows = data;
      } else if (Array.isArray(data?.data)) {
        rows = data.data;
      } else if (Array.isArray(data?.items)) {
        rows = data.items;
      } else if (Array.isArray(data?.materials)) {
        rows = data.materials;
      } else {
        throw new Error("รูปแบบข้อมูลที่ได้รับไม่ถูกต้อง");
      }

      const normalized = rows.map((row, index) =>
        normalizeMaterialRow(row, index)
      );

      setMaterials(normalized);
      setCurrentPage(1);
      setSelectedItems([]);
    } catch (err) {
      setErrorText(err.message || "โหลดข้อมูลไม่สำเร็จ");
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  // FILTER + PAGINATION
  // -------------------------------
  const filteredMaterials = useMemo(() => {
    const q = T(searchText).toLowerCase();

    if (!q) return materials;

    return materials.filter((item) => {
      return (
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.unit.toLowerCase().includes(q)
      );
    });
  }, [materials, searchText]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMaterials.length / rowsPerPage)
  );

  const pagedMaterials = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredMaterials.slice(start, start + rowsPerPage);
  }, [filteredMaterials, currentPage, rowsPerPage]);

  // -------------------------------
  // SELECT / UPDATE / REMOVE
  // -------------------------------
  const addToIssueList = (material) => {
    setSuccessText("");
    setErrorText("");

    setSelectedItems((prev) => {
      const found = prev.find((x) => x.code === material.code);
      if (found) {
        return prev.map((x) =>
          x.code === material.code
            ? {
                ...x,
                qtyRequest: Math.min(x.qtyRequest + 1, material.qtyBalance || 1),
              }
            : x
        );
      }

      return [
        ...prev,
        {
          code: material.code,
          name: material.name,
          category: material.category,
          unit: material.unit,
          qtyBalance: material.qtyBalance,
          qtyRequest: material.qtyBalance > 0 ? 1 : 0,
        },
      ];
    });
  };

  const updateQtyRequest = (code, value) => {
    const num = Math.max(0, Math.floor(toNum(value)));

    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.code !== code) return item;

        const capped = Math.min(num, item.qtyBalance);
        return {
          ...item,
          qtyRequest: capped,
        };
      })
    );
  };

  const removeItem = (code) => {
    setSelectedItems((prev) => prev.filter((item) => item.code !== code));
  };

  // -------------------------------
  // SUMMARY
  // -------------------------------
  const totalSelectedLines = selectedItems.length;

  const totalSelectedQty = selectedItems.reduce(
    (sum, item) => sum + toNum(item.qtyRequest),
    0
  );

  // -------------------------------
  // SAVE
  // -------------------------------
  const saveIssue = async () => {
    try {
      setSaving(true);
      setErrorText("");
      setSuccessText("");

      const validItems = selectedItems.filter((item) => toNum(item.qtyRequest) > 0);

      if (!validItems.length) {
        throw new Error("ยังไม่มีรายการเบิก");
      }

      const payload = {
        docType: "ISSUE_MATERIAL",
        issueDate: todayISO(),
        requesterName: T(requesterName),
        department: T(department),
        note: T(note),
        totalItems: validItems.length,
        totalQty: validItems.reduce((sum, item) => sum + toNum(item.qtyRequest), 0),
        items: validItems.map((item, index) => ({
          line_no: index + 1,
          รหัส: item.code,
          ชื่อวัสดุ: item.name,
          กลุ่มสินค้า: item.category,
          หน่วย: item.unit,
          จำนวนคงเหลือเดิม: toNum(item.qtyBalance),
          จำนวนเบิก: toNum(item.qtyRequest),
          จำนวนคงเหลือใหม่: toNum(item.qtyBalance) - toNum(item.qtyRequest),
        })),
      };

      console.log("payload saveIssue =", payload);

      const res = await fetch(SAVE_ISSUE_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`บันทึกไม่สำเร็จ (${res.status})`);
      }

      let result = null;
      try {
        result = await res.json();
      } catch {
        result = { ok: true };
      }

      console.log("save result =", result);

      setSuccessText("บันทึกรายการเบิกเรียบร้อยแล้ว");
      setSelectedItems([]);

      // โหลดคงเหลือใหม่อีกครั้ง
      await loadMaterials();
    } catch (err) {
      setErrorText(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------
  // UI
  // -------------------------------
  return (
    <div
      style={{
        background: "#eef2f7",
        minHeight: "100vh",
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          }}
        >
          <h2
            style={{
              margin: 0,
              marginBottom: 8,
              textAlign: "center",
              fontSize: 32,
              fontWeight: 700,
              color: "#1f2a44",
            }}
          >
            หน้าเบิกวัสดุ
          </h2>

          <div
            style={{
              textAlign: "center",
              marginBottom: 16,
              color: "#5b657a",
              fontSize: 22,
            }}
          >
            ทดสอบเรียก n8n ผ่าน webhook-test
          </div>

          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <button
              onClick={loadMaterials}
              disabled={loading}
              style={{
                padding: "10px 22px",
                fontSize: 18,
                borderRadius: 10,
                border: "1px solid #2d6cdf",
                background: loading ? "#dbe7ff" : "#2d6cdf",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {loading ? "กำลังโหลด..." : "โหลดข้อมูลจาก TEST"}
            </button>
          </div>

          {errorText ? (
            <div
              style={{
                marginBottom: 16,
                background: "#ffe5e5",
                color: "#b42318",
                padding: 12,
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              {errorText}
            </div>
          ) : null}

          {successText ? (
            <div
              style={{
                marginBottom: 16,
                background: "#e7f8ec",
                color: "#067647",
                padding: 12,
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              {successText}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr",
              gap: 20,
              alignItems: "start",
            }}
          >
            {/* LEFT PANEL */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #d9e2f0",
                borderRadius: 16,
                padding: 18,
                minHeight: 560,
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#26324b",
                  marginBottom: 12,
                }}
              >
                รายการวัสดุ
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 16 }}>แสดง</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #c8d3e5",
                      fontSize: 16,
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={7}>7</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                  </select>
                  <span style={{ fontSize: 16 }}>แถว</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <label style={{ fontSize: 16 }}>ค้นหา:</label>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="รหัส / ชื่อวัสดุ / กลุ่มสินค้า"
                    style={{
                      width: 260,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #c8d3e5",
                      fontSize: 15,
                    }}
                  />
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 15,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f5f8fc" }}>
                      <th style={thStyle}>รหัส</th>
                      <th style={thStyle}>ชื่อวัสดุ</th>
                      <th style={thStyle}>กลุ่มสินค้า</th>
                      <th style={thStyle}>หน่วย</th>
                      <th style={thStyle}>คงเหลือ</th>
                      <th style={thStyle}>ขอเบิก</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedMaterials.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: "center",
                            padding: 24,
                            color: "#6b7280",
                            borderBottom: "1px solid #eef2f7",
                          }}
                        >
                          ยังไม่มีข้อมูล
                        </td>
                      </tr>
                    ) : (
                      pagedMaterials.map((item) => (
                        <tr key={item.id}>
                          <td style={tdStyle}>{item.code}</td>
                          <td style={tdStyle}>{item.name}</td>
                          <td style={tdStyle}>{item.category}</td>
                          <td style={tdStyle}>{item.unit}</td>
                          <td style={tdStyle}>{formatNumber(item.qtyBalance)}</td>
                          <td style={tdStyleCenter}>
                            <button
                              onClick={() => addToIssueList(item)}
                              disabled={toNum(item.qtyBalance) <= 0}
                              title="เพิ่มรายการเบิก"
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                border: "none",
                                background:
                                  toNum(item.qtyBalance) <= 0 ? "#cbd5e1" : "#0f9d74",
                                color: "#fff",
                                fontSize: 22,
                                fontWeight: 700,
                                cursor:
                                  toNum(item.qtyBalance) <= 0
                                    ? "not-allowed"
                                    : "pointer",
                                lineHeight: 1,
                              }}
                            >
                              +
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  color: "#4b5563",
                }}
              >
                <div>
                  แสดง{" "}
                  {filteredMaterials.length === 0
                    ? 0
                    : (currentPage - 1) * rowsPerPage + 1}{" "}
                  ถึง{" "}
                  {Math.min(currentPage * rowsPerPage, filteredMaterials.length)} จาก{" "}
                  {filteredMaterials.length} แถว
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={pageButtonStyle(currentPage === 1)}
                  >
                    ก่อนหน้า
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(
                      Math.max(0, currentPage - 2),
                      Math.max(0, currentPage - 2) + 5
                    )
                    .map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        style={{
                          ...pageButtonStyle(false),
                          background: page === currentPage ? "#2d6cdf" : "#fff",
                          color: page === currentPage ? "#fff" : "#1f2937",
                          border:
                            page === currentPage
                              ? "1px solid #2d6cdf"
                              : "1px solid #cbd5e1",
                        }}
                      >
                        {page}
                      </button>
                    ))}

                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    style={pageButtonStyle(currentPage === totalPages)}
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #d9e2f0",
                borderRadius: 16,
                padding: 18,
                minHeight: 560,
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#26324b",
                  marginBottom: 4,
                }}
              >
                รายการเบิก
              </div>

              <div style={{ color: "#0f9d74", fontWeight: 700, marginBottom: 4 }}>
                {requesterName} {department}
              </div>

              <div style={{ color: "#6b7280", marginBottom: 14 }}>
                โปรดเลือกรายการ
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <input
                  type="text"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  placeholder="ชื่อผู้เบิก"
                  style={inputStyle}
                />
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="หน่วยงาน/กลุ่มงาน"
                  style={inputStyle}
                />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="หมายเหตุ"
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div
                style={{
                  background: "#f8fbff",
                  border: "1px solid #dbe5f1",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  จำนวนรายการ: <b>{formatNumber(totalSelectedLines)}</b>
                </div>
                <div>
                  จำนวนเบิกรวม: <b>{formatNumber(totalSelectedQty)}</b>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  maxHeight: 320,
                  overflowY: "auto",
                  paddingRight: 4,
                  marginBottom: 16,
                }}
              >
                {selectedItems.length === 0 ? (
                  <div
                    style={{
                      color: "#9aa3b2",
                      border: "1px dashed #cbd5e1",
                      borderRadius: 12,
                      padding: 20,
                      textAlign: "center",
                    }}
                  >
                    ยังไม่มีรายการเบิก
                  </div>
                ) : (
                  selectedItems.map((item) => (
                    <div
                      key={item.code}
                      style={{
                        border: "1px solid #dbe5f1",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#1f2937",
                          marginBottom: 6,
                        }}
                      >
                        {item.name}
                      </div>

                      <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 8 }}>
                        {item.code} | {item.category} | หน่วย {item.unit} | คงเหลือ{" "}
                        {formatNumber(item.qtyBalance)}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span>จำนวนเบิก</span>
                        <input
                          type="number"
                          min="0"
                          max={item.qtyBalance}
                          value={item.qtyRequest}
                          onChange={(e) =>
                            updateQtyRequest(item.code, e.target.value)
                          }
                          style={{
                            width: 100,
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #c8d3e5",
                            fontSize: 15,
                          }}
                        />
                        <button
                          onClick={() => removeItem(item.code)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #ef4444",
                            background: "#fff5f5",
                            color: "#dc2626",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={saveIssue}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "12px 18px",
                  borderRadius: 12,
                  border: "none",
                  background: saving ? "#94a3b8" : "#16a34a",
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "กำลังบันทึก..." : "บันทึกรายการเบิก"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===============================
// STYLES
// ===============================
const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #dbe5f1",
  color: "#334155",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "12px 10px",
  borderBottom: "1px solid #eef2f7",
  color: "#1f2937",
  verticalAlign: "middle",
};

const tdStyleCenter = {
  ...tdStyle,
  textAlign: "center",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #c8d3e5",
  fontSize: 15,
  outline: "none",
};

function pageButtonStyle(disabled) {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: disabled ? "#f1f5f9" : "#fff",
    color: disabled ? "#94a3b8" : "#1f2937",
    cursor: disabled ? "not-allowed" : "pointer",
    minWidth: 44,
  };
}