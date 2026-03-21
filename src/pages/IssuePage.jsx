import React, { useMemo, useState } from "react";

export default function IssuePage() {
  // =========================
  // URL n8n
  // =========================
  const LOAD_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/4f649516-de04-4661-a6f5-caae15261e7f";
  const SAVE_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/4541d09a-88a3-4b45-877c-f148163cb8c3";

  // =========================
  // State
  // =========================
  const [materials, setMaterials] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);

  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");

  const [requesterName, setRequesterName] = useState("จักรพงศ์ พ่อมือ");
  const [requesterTeam, setRequesterTeam] = useState("กลุ่มงาน 1");
  const [remark, setRemark] = useState("");

  const [rowsPerPage, setRowsPerPage] = useState(7);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // =========================
  // Helpers
  // =========================
  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getItemName = (item) => {
    return (
      item["กลุ่มสินค้า"] ||
      item["ชื่อสินค้า"] ||
      item["ชื่อวัสดุ"] ||
      item["materialName"] ||
      "-"
    );
  };

  const getRemainQty = (item) => {
    return toNumber(
      item["จำนวนคงเหลือใหม่"] ??
        item["จำนวนคงเหลือ"] ??
        item["คงเหลือ"] ??
        item["remainQty"] ??
        0
    );
  };

  const getCode = (item) => {
    return item["รหัส"] || item["itemCode"] || "";
  };

  // =========================
  // โหลดข้อมูล
  // =========================
  const handleLoad = async () => {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(LOAD_URL, {
        method: "GET",
      });

      const data = await res.json();

      let list = [];

      if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray(data.items)) {
        list = data.items;
      } else if (Array.isArray(data.data)) {
        list = data.data;
      }

      setMaterials(list);
      setMessage(`โหลดข้อมูลสำเร็จ ${list.length} รายการ`);
    } catch (err) {
      console.error(err);
      setMessage("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // ค้นหา
  // =========================
  const handleSearch = () => {
    setSearchKeyword(searchInput.trim());
  };

  // =========================
  // ล้างข้อมูล
  // =========================
  const handleClear = () => {
    setSearchInput("");
    setSearchKeyword("");
    setMaterials([]);
    setSelectedItems([]);
    setRemark("");
    setMessage("");
  };

  // =========================
  // filter
  // =========================
  const filteredMaterials = useMemo(() => {
    const keyword = searchKeyword.toLowerCase().trim();
    let list = [...materials];

    if (keyword) {
      list = list.filter((item) => {
        const code = String(getCode(item)).toLowerCase();
        const itemName = String(getItemName(item)).toLowerCase();
        return code.includes(keyword) || itemName.includes(keyword);
      });
    }

    return list;
  }, [materials, searchKeyword]);

  const shownMaterials = useMemo(() => {
    return filteredMaterials.slice(0, rowsPerPage);
  }, [filteredMaterials, rowsPerPage]);

  // =========================
  // เพิ่มรายการที่เลือก
  // =========================
  const addToSelected = (item) => {
    const code = getCode(item);
    const itemName = getItemName(item);
    const remainQty = getRemainQty(item);

    const key = code || itemName;

    const foundIndex = selectedItems.findIndex((x) => x._key === key);

    if (foundIndex >= 0) {
      const next = [...selectedItems];
      const currentQty = toNumber(next[foundIndex].qty);
      if (currentQty < remainQty) {
        next[foundIndex].qty = currentQty + 1;
      }
      setSelectedItems(next);
      return;
    }

    setSelectedItems((prev) => [
      ...prev,
      {
        _key: key,
        code,
        itemName,
        remainQty,
        qty: remainQty > 0 ? 1 : 0,
        source: item,
      },
    ]);
  };

  const updateSelectedQty = (key, qty) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item._key !== key) return item;

        let newQty = toNumber(qty);
        if (newQty < 0) newQty = 0;
        if (newQty > item.remainQty) newQty = item.remainQty;

        return { ...item, qty: newQty };
      })
    );
  };

  const removeSelectedItem = (key) => {
    setSelectedItems((prev) => prev.filter((item) => item._key !== key));
  };

  const totalQty = selectedItems.reduce((sum, item) => sum + toNumber(item.qty), 0);

  // =========================
  // บันทึก
  // =========================
  const handleSave = async () => {
    const validItems = selectedItems.filter((item) => toNumber(item.qty) > 0);

    if (!requesterName.trim()) {
      alert("กรุณากรอกชื่อผู้เบิก");
      return;
    }

    if (!requesterTeam.trim()) {
      alert("กรุณากรอกกลุ่มงาน");
      return;
    }

    if (validItems.length === 0) {
      alert("ยังไม่มีรายการเบิก");
      return;
    }

    const payload = {
      requesterName,
      requesterTeam,
      remark,
      items: validItems.map((item, index) => ({
        line_no: index + 1,
        รหัส: item.code,
        ชื่อสินค้า: item.itemName,
        กลุ่มสินค้า: item.itemName,
        จำนวนคงเหลือเดิม: item.remainQty,
        จำนวนเบิก: item.qty,
        จำนวนคงเหลือใหม่: item.remainQty - item.qty,
      })),
    };

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(SAVE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("SAVE RESPONSE:", data);

      if (data?.ok) {
        setMessage(data?.message || "บันทึกรายการเบิกเรียบร้อย");
        alert(data?.message || "บันทึกรายการเบิกเรียบร้อย");

        setSelectedItems([]);
        setRemark("");
      } else {
        setMessage(data?.message || "บันทึกไม่สำเร็จ");
        alert(data?.message || "บันทึกไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
      setMessage("บันทึกไม่สำเร็จ");
      alert("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // Styles
  // =========================
  const styles = {
    page: {
      width: "100%",
      minHeight: "100vh",
      background: "#eef3f9",
      padding: "24px",
      boxSizing: "border-box",
      fontFamily: "Tahoma, sans-serif",
    },
    container: {
      maxWidth: "1100px",
      margin: "0 auto",
      background: "#ffffff",
      borderRadius: "24px",
      padding: "24px",
      boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
    },
    title: {
      fontSize: "42px",
      fontWeight: "700",
      textAlign: "center",
      color: "#1c2d5a",
      marginBottom: "8px",
    },
    subtitle: {
      textAlign: "center",
      fontSize: "18px",
      color: "#5d6b8a",
      marginBottom: "18px",
    },
    buttonRow: {
      display: "flex",
      gap: "12px",
      justifyContent: "center",
      flexWrap: "wrap",
      marginBottom: "24px",
    },
    primaryBtn: {
      background: "#2f6fe4",
      color: "#fff",
      border: "none",
      borderRadius: "12px",
      padding: "12px 26px",
      fontSize: "18px",
      fontWeight: "700",
      cursor: "pointer",
    },
    secondaryBtn: {
      background: "#0ea55b",
      color: "#fff",
      border: "none",
      borderRadius: "12px",
      padding: "12px 26px",
      fontSize: "18px",
      fontWeight: "700",
      cursor: "pointer",
    },
    dangerBtn: {
      background: "#e5e7eb",
      color: "#1f2937",
      border: "none",
      borderRadius: "12px",
      padding: "12px 26px",
      fontSize: "18px",
      fontWeight: "700",
      cursor: "pointer",
    },
    frame: {
      border: "1px solid #d7dfef",
      borderRadius: "20px",
      padding: "20px",
      marginBottom: "20px",
      background: "#fbfcff",
    },
    frameTitle: {
      fontSize: "28px",
      fontWeight: "700",
      textAlign: "center",
      color: "#1c2d5a",
      marginBottom: "18px",
    },
    controlRow: {
      display: "flex",
      gap: "12px",
      alignItems: "center",
      flexWrap: "wrap",
      marginBottom: "16px",
    },
    label: {
      fontSize: "18px",
      color: "#334155",
    },
    select: {
      border: "1px solid #b6c2da",
      borderRadius: "10px",
      padding: "10px 12px",
      fontSize: "16px",
      minWidth: "90px",
    },
    input: {
      border: "1px solid #b6c2da",
      borderRadius: "10px",
      padding: "12px 14px",
      fontSize: "16px",
      width: "100%",
      boxSizing: "border-box",
    },
    textarea: {
      border: "1px solid #b6c2da",
      borderRadius: "10px",
      padding: "12px 14px",
      fontSize: "16px",
      width: "100%",
      boxSizing: "border-box",
      minHeight: "90px",
      resize: "vertical",
    },
    tableWrap: {
      overflowX: "auto",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      background: "#fff",
      borderRadius: "12px",
      overflow: "hidden",
    },
    th: {
      background: "#eef2f7",
      color: "#1e3a5f",
      padding: "14px 10px",
      fontSize: "20px",
      textAlign: "center",
      borderBottom: "1px solid #dbe3f0",
    },
    td: {
      padding: "14px 10px",
      fontSize: "18px",
      textAlign: "center",
      borderBottom: "1px solid #edf1f7",
      verticalAlign: "middle",
    },
    plusBtn: {
      width: "42px",
      height: "42px",
      borderRadius: "999px",
      border: "none",
      background: "#0ea55b",
      color: "#fff",
      fontSize: "28px",
      fontWeight: "700",
      cursor: "pointer",
      lineHeight: 1,
    },
    smallInput: {
      width: "90px",
      border: "1px solid #b6c2da",
      borderRadius: "10px",
      padding: "8px 10px",
      fontSize: "16px",
      textAlign: "center",
    },
    removeBtn: {
      background: "#ef4444",
      color: "#fff",
      border: "none",
      borderRadius: "10px",
      padding: "8px 12px",
      fontSize: "15px",
      cursor: "pointer",
      fontWeight: "700",
    },
    summaryBox: {
      marginTop: "16px",
      border: "1px solid #d6dfef",
      borderRadius: "14px",
      background: "#f7f9fc",
      padding: "16px",
      textAlign: "center",
      fontSize: "18px",
      color: "#334155",
      lineHeight: 1.8,
    },
    emptyBox: {
      marginTop: "16px",
      border: "1px dashed #cdd7e7",
      borderRadius: "14px",
      background: "#ffffff",
      padding: "18px",
      textAlign: "center",
      fontSize: "20px",
      color: "#94a3b8",
      fontWeight: "700",
    },
    saveBtn: {
      width: "100%",
      background: "#17a34a",
      color: "#fff",
      border: "none",
      borderRadius: "14px",
      padding: "16px",
      fontSize: "28px",
      fontWeight: "700",
      cursor: "pointer",
      marginTop: "18px",
    },
    message: {
      marginTop: "10px",
      textAlign: "center",
      fontSize: "16px",
      color: "#2563eb",
      fontWeight: "700",
    },
    formGrid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "12px",
      marginBottom: "16px",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.title}>หน้าเบิกวัสดุ</div>
        <div style={styles.subtitle}>ระบบเบิกวัสดุสำนักงาน</div>

        <div style={styles.buttonRow}>
          <button style={styles.primaryBtn} onClick={handleLoad} disabled={loading}>
            {loading ? "กำลังโหลด..." : "เบิก"}
          </button>

          <button style={styles.secondaryBtn} onClick={handleSearch}>
            ค้นหา
          </button>

          <button style={styles.dangerBtn} onClick={handleClear}>
            ล้างข้อมูล
          </button>
        </div>

        <div style={styles.frame}>
          <div style={styles.frameTitle}>รายการวัสดุ</div>

          <div style={styles.controlRow}>
            <span style={styles.label}>แสดง</span>
            <select
              style={styles.select}
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={7}>7</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
            <span style={styles.label}>แถว</span>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={styles.label}>ค้นหา:</label>
            <div style={{ marginTop: "8px" }}>
              <input
                style={styles.input}
                type="text"
                placeholder="ค้นหาชื่อสินค้า"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
              />
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ชื่อสินค้า</th>
                  <th style={styles.th}>คงเหลือ</th>
                  <th style={styles.th}>ขอเบิก</th>
                </tr>
              </thead>
              <tbody>
                {shownMaterials.length > 0 ? (
                  shownMaterials.map((item, index) => {
                    const itemName = getItemName(item);
                    const remainQty = getRemainQty(item);

                    return (
                      <tr key={`${itemName}-${index}`}>
                        <td style={styles.td}>{itemName}</td>
                        <td style={styles.td}>{remainQty}</td>
                        <td style={styles.td}>
                          <button
                            style={styles.plusBtn}
                            onClick={() => addToSelected(item)}
                            disabled={remainQty <= 0}
                            title="เพิ่มรายการ"
                          >
                            +
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td style={styles.td} colSpan={3}>
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={styles.frame}>
          <div style={styles.frameTitle}>รายการที่เลือก</div>

          <div style={styles.formGrid}>
            <input
              style={styles.input}
              type="text"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              placeholder="ชื่อผู้เบิก"
            />

            <input
              style={styles.input}
              type="text"
              value={requesterTeam}
              onChange={(e) => setRequesterTeam(e.target.value)}
              placeholder="กลุ่มงาน"
            />

            <textarea
              style={styles.textarea}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="หมายเหตุ"
            />
          </div>

          <div style={styles.summaryBox}>
            <div>จำนวนรายการ: {selectedItems.length}</div>
            <div>จำนวนเบิกรวม: {totalQty}</div>
          </div>

          {selectedItems.length === 0 ? (
            <div style={styles.emptyBox}>ยังไม่มีรายการที่เลือก</div>
          ) : (
            <div style={{ marginTop: "16px", overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ชื่อสินค้า</th>
                    <th style={styles.th}>คงเหลือ</th>
                    <th style={styles.th}>จำนวนเบิก</th>
                    <th style={styles.th}>ลบ</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item) => (
                    <tr key={item._key}>
                      <td style={styles.td}>{item.itemName}</td>
                      <td style={styles.td}>{item.remainQty}</td>
                      <td style={styles.td}>
                        <input
                          style={styles.smallInput}
                          type="number"
                          min="0"
                          max={item.remainQty}
                          value={item.qty}
                          onChange={(e) =>
                            updateSelectedQty(item._key, e.target.value)
                          }
                        />
                      </td>
                      <td style={styles.td}>
                        <button
                          style={styles.removeBtn}
                          onClick={() => removeSelectedItem(item._key)}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "กำลังบันทึก..." : "บันทึกรายการเบิก"}
          </button>

          {!!message && <div style={styles.message}>{message}</div>}
        </div>
      </div>
    </div>
  );
}