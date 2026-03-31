import React, { useEffect, useMemo, useState } from "react";

export default function IssuePage({ currentUser }) {
  const ISSUE_API_URL =
    "https://n8n-new-project-gwf2.onrender.com/webhook/office-api";

  const PAGE_SIZE = 10;

  const [mode, setMode] = useState("issue"); // issue | history | detail

  const [materials, setMaterials] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [issueDetail, setIssueDetail] = useState(null);

  const [filterText, setFilterText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [username, setUsername] = useState("");
  const [branch, setBranch] = useState("");

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingIssue, setOpeningIssue] = useState(false);
  const [updatingIssue, setUpdatingIssue] = useState(false);
  const [message, setMessage] = useState("");

  const [popup, setPopup] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  const text = (v) => (v ?? "").toString().trim();

  const toNumber = (v) => {
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const openPopup = (type, title, popupMessage) => {
    setPopup({ open: true, type, title, message: popupMessage });
  };

  const closePopup = () => {
    setPopup((prev) => ({ ...prev, open: false }));
  };

  const normalizeListResponse = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    return [];
  };

  useEffect(() => {
    if (currentUser) {
      setUsername(text(currentUser.name || currentUser.username || ""));
      setBranch(text(currentUser.branch || ""));
    }
  }, [currentUser]);

  const getItemName = (item) =>
    text(item?.product_name) ||
    text(item?.["ชื่อสินค้า"]) ||
    text(item?.["ชื่อวัสดุ"]) ||
    text(item?.name) ||
    "-";

  const getCode = (item) =>
    text(item?.product_id) ||
    text(item?.product_code) ||
    text(item?.["รหัส"]) ||
    "";

  const getUnit = (item) =>
    text(item?.unit) || text(item?.["หน่วย"]) || "";

  const getRemainQty = (item) => {
    const v =
      item?.qty_on_hand ??
      item?.["จำนวนคงเหลือ"] ??
      item?.["คงเหลือ"] ??
      item?.remainQty ??
      item?.stock ??
      null;
    if (v === null || v === undefined || v === "") return null;
    return toNumber(v);
  };

  const canAddItem = (item) => {
    const remainQty = getRemainQty(item);
    if (remainQty === null) return true;
    return remainQty > 0;
  };

  const formatDateDisplay = (value) => {
    if (!value) return "";
    const raw = String(value);
    const matchThai = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (matchThai) return `${matchThai[3]}/${matchThai[2]}/${matchThai[1]}`;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}`;
  };

  const apiPost = async (payload) => {
    const res = await fetch(ISSUE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const handleLoad = async () => {
    try {
      setMode("issue");
      setLoading(true);
      setMessage("");
      setCurrentPage(1);
      setFilterText("");
      setIssueDetail(null);
      setSelectedItems([]);

      const stockGroup = /^SCY0[56]/.test(branch) ? "ppao" : "singchai";
      const data = await apiPost({ action: "load_materials", stock_group: stockGroup });
      const list = normalizeListResponse(data);
      setMaterials(list);
      setHistoryRows([]);
      setMessage(`โหลดข้อมูลสำเร็จ ${list.length} รายการ`);
    } catch (error) {
      setMaterials([]);
      setMessage("โหลดข้อมูลไม่สำเร็จ");
      openPopup("error", "โหลดข้อมูลไม่สำเร็จ", "ไม่สามารถโหลดรายการวัสดุได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setMode("history");
      setSearching(true);
      setMessage("");
      setCurrentPage(1);
      setSelectedItems([]);
      setFilterText("");
      setIssueDetail(null);

      const data = await apiPost({ action: "search_issues" });
      const list = normalizeListResponse(data).map((row) => ({
        issue_no: text(row.issue_no),
        issue_date: formatDateDisplay(row.issue_date || row.issueDate),
        requester_name: text(row.requester_name || row.requesterName || row.created_by),
        issue_branch: text(row.issue_branch || row.department || row.branch),
        total_qty: toNumber(row.total_qty || row.totalQty),
      }));

      setHistoryRows(list);
      setMaterials([]);
      setMessage(`ค้นหาสำเร็จ ${list.length} รายการ`);
    } catch (error) {
      setHistoryRows([]);
      setMessage("ค้นหาข้อมูลไม่สำเร็จ");
      openPopup("error", "ค้นหาไม่สำเร็จ", "ไม่สามารถค้นหาข้อมูลได้");
    } finally {
      setSearching(false);
    }
  };

  const handleOpenIssue = async (row) => {
    const issueNo = text(row?.issue_no);
    if (!issueNo) {
      openPopup("error", "เปิดใบเบิกไม่สำเร็จ", "ไม่พบเลขที่ใบเบิก");
      return;
    }
    try {
      setOpeningIssue(true);
      setMessage("");

      const data = await apiPost({ action: "open_issue", issue_no: issueNo });

      const header =
        data?.header || data?.data?.header || data?.issue || {};
      const items =
        data?.items || data?.data?.items || data?.detail || data?.details || [];

      const detailData = {
        issue_no: text(header.issue_no || row.issue_no),
        issue_date: formatDateDisplay(
          header.issue_date || header.issueDate || row.issue_date
        ),
        requester_name: text(
          header.requester_name || header.requesterName || row.requester_name
        ),
        issue_branch: text(
          header.issue_branch || header.department || row.issue_branch
        ),
        total_qty: toNumber(header.total_qty || header.totalQty || row.total_qty),
        note: text(header.note),
        items: Array.isArray(items)
          ? items.map((item, index) => ({
              line_no: item.line_no ?? index + 1,
              issue_item_id: text(item.issue_item_id || item.id),
              product_id: text(item.product_id || item.code || item.item_code),
              product_name: text(
                item.product_name || item.name || item["ชื่อสินค้า"]
              ),
              unit: text(item.unit || item["หน่วย"]),
              qty_issue: toNumber(item.qty_issue || item.qty || item.quantity),
              isEditing: false,
            }))
          : [],
      };

      setIssueDetail(detailData);
      setMode("detail");
      setMessage(`เปิดใบเบิก ${issueNo} สำเร็จ`);
    } catch (error) {
      openPopup("error", "เปิดใบเบิกไม่สำเร็จ", "ไม่สามารถโหลดรายละเอียดได้");
    } finally {
      setOpeningIssue(false);
    }
  };

  const handleBackToHistory = () => {
    setMode("history");
    setIssueDetail(null);
    setMessage("");
  };

  const handleClear = () => {
    setMode("issue");
    setFilterText("");
    setSelectedItems([]);
    setMaterials([]);
    setHistoryRows([]);
    setIssueDetail(null);
    setCurrentPage(1);
    setMessage("");
  };

  const handleEditDetailItem = (index) => {
    setIssueDetail((prev) => {
      if (!prev) return prev;
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], isEditing: true };
      return { ...prev, items: nextItems };
    });
  };

  const handleChangeDetailQty = (index, value) => {
    setIssueDetail((prev) => {
      if (!prev) return prev;
      const nextItems = [...prev.items];
      nextItems[index] = {
        ...nextItems[index],
        qty_issue: Math.max(0, toNumber(value)),
      };
      return { ...prev, items: nextItems };
    });
  };

  const handleSaveDetailItem = (index) => {
    setIssueDetail((prev) => {
      if (!prev) return prev;
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], isEditing: false };
      const totalQty = nextItems.reduce(
        (sum, item) => sum + toNumber(item.qty_issue),
        0
      );
      return { ...prev, items: nextItems, total_qty: totalQty };
    });
  };

  const handleDeleteDetailItem = (index) => {
    setIssueDetail((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.filter((_, i) => i !== index);
      const totalQty = nextItems.reduce(
        (sum, item) => sum + toNumber(item.qty_issue),
        0
      );
      return { ...prev, items: nextItems, total_qty: totalQty };
    });
  };

  const handleUpdateIssue = async () => {
    if (!issueDetail) {
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่พบข้อมูลใบเบิก");
      return;
    }
    if (!text(issueDetail.issue_no)) {
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่พบเลขที่ใบเบิก");
      return;
    }
    const validItems = (issueDetail.items || []).filter(
      (item) => toNumber(item.qty_issue) > 0
    );
    if (validItems.length === 0) {
      if (!window.confirm("ไม่มีรายการ — ยืนยันการบันทึก (จะเป็นการยกเลิกรายการเบิกทั้งหมด)?")) return;
    }

    const payload = {
      action: "update_issue",
      issue_no: issueDetail.issue_no,
      issue_date: issueDetail.issue_date,
      requester_name: issueDetail.requester_name,
      issue_branch: issueDetail.issue_branch,
      total_qty: validItems.reduce(
        (sum, item) => sum + toNumber(item.qty_issue),
        0
      ),
      note: issueDetail.note || "",
      updated_by: username || "",
      items: validItems.map((item, index) => ({
        line_no: index + 1,
        issue_item_id: item.issue_item_id || "",
        product_id: item.product_id || "",
        product_name: item.product_name || "",
        unit: item.unit || "",
        qty_issue: toNumber(item.qty_issue),
      })),
    };

    try {
      setUpdatingIssue(true);
      setMessage("");
      const raw = await apiPost(payload);
      const data = Array.isArray(raw) ? raw[0] : raw;
      const isSuccess =
        data?.ok === true || data?.success === true || data?.status === "success";

      if (isSuccess) {
        const msg = data?.message || "บันทึกการแก้ไขรายการเบิกเรียบร้อย";
        setMessage(msg);
        openPopup("success", "บันทึกสำเร็จ", msg);
      } else {
        const msg = data?.message || "บันทึกการแก้ไขไม่สำเร็จ";
        openPopup("error", "บันทึกไม่สำเร็จ", msg);
      }
    } catch (error) {
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่สามารถส่งข้อมูลแก้ไขไปยังระบบได้");
    } finally {
      setUpdatingIssue(false);
    }
  };

  const filteredMaterials = useMemo(() => {
    const keyword = filterText.toLowerCase().trim();
    if (!keyword) return materials;
    return materials.filter((item) => {
      const itemName = getItemName(item).toLowerCase();
      const code = getCode(item).toLowerCase();
      return itemName.includes(keyword) || code.includes(keyword);
    });
  }, [materials, filterText]);

  const filteredHistoryRows = useMemo(() => {
    const keyword = filterText.toLowerCase().trim();
    if (!keyword) return historyRows;
    return historyRows.filter((row) =>
      text(row.issue_no).toLowerCase().includes(keyword) ||
      text(row.issue_date).toLowerCase().includes(keyword) ||
      text(row.requester_name).toLowerCase().includes(keyword) ||
      text(row.issue_branch).toLowerCase().includes(keyword)
    );
  }, [historyRows, filterText]);

  const activeRows = mode === "history" ? filteredHistoryRows : filteredMaterials;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));

  const shownRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return activeRows.slice(start, start + PAGE_SIZE);
  }, [activeRows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const addToSelected = (item) => {
    const code = getCode(item);
    const itemName = getItemName(item);
    const unit = getUnit(item);
    const remainQty = getRemainQty(item);
    const key = code || itemName;

    setSelectedItems((prev) => {
      const foundIndex = prev.findIndex((x) => x._key === key);
      if (foundIndex >= 0) {
        const next = [...prev];
        const currentQty = toNumber(next[foundIndex].qty);
        if (remainQty === null || currentQty < remainQty) {
          next[foundIndex].qty = currentQty + 1;
        }
        return next;
      }
      return [
        ...prev,
        { _key: key, code, itemName, unit, remainQty, qty: 1, source: item },
      ];
    });
  };

  const updateSelectedQty = (key, qty) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item._key !== key) return item;
        let newQty = toNumber(qty);
        if (newQty < 0) newQty = 0;
        if (item.remainQty !== null && newQty > item.remainQty)
          newQty = item.remainQty;
        return { ...item, qty: newQty };
      })
    );
  };

  const removeSelectedItem = (key) => {
    setSelectedItems((prev) => prev.filter((item) => item._key !== key));
  };

  const totalQty = selectedItems.reduce(
    (sum, item) => sum + toNumber(item.qty),
    0
  );

  const handleSave = async () => {
    const validItems = selectedItems.filter((item) => toNumber(item.qty) > 0);

    if (!text(username)) {
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่พบข้อมูลผู้ใช้งาน");
      return;
    }
    if (!text(branch)) {
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่พบข้อมูลสาขา");
      return;
    }
    if (validItems.length === 0) {
      openPopup("error", "บันทึกไม่สำเร็จ", "ยังไม่มีรายการเบิก");
      return;
    }

    const payload = {
      action: "save_issue",
      username,
      branch,
      items: validItems.map((item, index) => ({
        line_no: index + 1,
        product_id: item.code,
        product_name: item.itemName,
        unit: item.unit,
        qty_issue: item.qty,
        qty_on_hand: item.remainQty,
        remain_qty:
          item.remainQty === null ? null : item.remainQty - item.qty,
      })),
    };

    try {
      setSaving(true);
      setMessage("");
      const raw = await apiPost(payload);
      const data = Array.isArray(raw) ? raw[0] : raw;
      const isSuccess =
        data?.ok === true || data?.success === true || data?.status === "success";

      if (isSuccess) {
        const msg = data?.message || "บันทึกรายการเบิกเรียบร้อย";
        setSelectedItems([]);
        openPopup("success", "บันทึกสำเร็จ", msg);
        await handleLoad();
      } else {
        const msg = data?.message || "บันทึกไม่สำเร็จ";
        openPopup("error", "บันทึกไม่สำเร็จ", msg);
      }
    } catch (error) {
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่สามารถเชื่อมต่อระบบได้");
    } finally {
      setSaving(false);
    }
  };

  /* ───────── PAGINATION ───────── */
  const renderPagination = () => {
    if (mode === "detail" || activeRows.length <= PAGE_SIZE) return null;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    const pagerBtn = (active, disabled) => ({
      border: active ? "none" : "1px solid #cbd5e1",
      background: active ? "#072d6b" : disabled ? "#f8fafc" : "#fff",
      color: active ? "#fff" : disabled ? "#94a3b8" : "#374151",
      borderRadius: 6, padding: "3px 8px", fontSize: 12,
      cursor: disabled ? "not-allowed" : "pointer",
    });
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 10, fontSize: 13 }}>
        <span style={{ color: "#64748b", marginRight: 4 }}>หน้า {currentPage}/{totalPages}</span>
        <button style={pagerBtn(false, currentPage === 1)} onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>◀</button>
        {pages.map((p) => (
          <button key={p} style={pagerBtn(p === currentPage, false)} onClick={() => setCurrentPage(p)}>{p}</button>
        ))}
        <button style={pagerBtn(false, currentPage === totalPages)} onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}>▶</button>
      </div>
    );
  };

  const smallQtyInput = { width: 72, border: "1px solid #cbd5e1", borderRadius: 6, padding: "3px 6px", fontSize: 13, textAlign: "center" };
  const actionBtn = (color, outline = false) => ({
    background: outline ? "#fff" : color, color: outline ? color : "#fff",
    border: `1px solid ${color}`, borderRadius: 6, padding: "3px 10px",
    fontSize: 12, fontWeight: 600, cursor: "pointer",
  });

  /* ───────── RENDER ───────── */
  return (
    <>
      <div className="page-container">

        {/* TOP BAR */}
        <div className="page-topbar">
          <h2 className="page-title">📤 เบิกวัสดุ</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              className={mode === "issue" ? "btn-primary" : "btn-secondary"}
              onClick={handleLoad}
              disabled={loading}
            >
              {loading ? "กำลังโหลด..." : "📋 เบิกวัสดุ"}
            </button>
            <button
              className={mode === "history" ? "btn-primary" : "btn-secondary"}
              onClick={handleSearch}
              disabled={searching}
            >
              {searching ? "กำลังค้นหา..." : "🔍 ประวัติการเบิก"}
            </button>
            <button className="btn-secondary" onClick={handleClear}>ล้างข้อมูล</button>
            {mode === "detail" && (
              <button className="btn-secondary" onClick={handleBackToHistory}>← กลับไปประวัติ</button>
            )}
            <div style={{ fontSize: 13, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 12px" }}>
              👤 {username || "-"} &nbsp;|&nbsp; 🏢 {branch || "-"}
            </div>
          </div>
        </div>

        {/* MATERIAL / HISTORY TABLE */}
        {mode !== "detail" && (
          <div className="form-card">
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16, color: "#072d6b" }}>
              {mode === "history" ? "ประวัติการเบิกวัสดุ" : "รายการวัสดุ"}
            </h3>
            <input
              className="form-input"
              style={{ width: "100%", marginBottom: 14, boxSizing: "border-box" }}
              type="text"
              placeholder={mode === "history" ? "ค้นหาเลขที่ใบเบิก / วันที่ / ผู้เบิก / สาขา" : "ค้นหาชื่อสินค้า หรือ รหัสสินค้า"}
              value={filterText}
              onChange={(e) => { setFilterText(e.target.value); setCurrentPage(1); }}
            />
            <div style={{ overflowX: "auto" }}>
              {mode === "history" ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>เลขที่ใบเบิก</th>
                      <th>วันที่เบิก</th>
                      <th style={{ textAlign: "left" }}>ชื่อผู้เบิก</th>
                      <th>สาขาที่เบิก</th>
                      <th>จำนวน</th>
                      <th>เปิด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.length > 0 ? (
                      shownRows.map((row, index) => (
                        <tr key={`${row.issue_no}-${index}`}>
                          <td>{row.issue_no || "-"}</td>
                          <td>{row.issue_date || "-"}</td>
                          <td style={{ textAlign: "left" }}>{row.requester_name || "-"}</td>
                          <td>{row.issue_branch || "-"}</td>
                          <td>{row.total_qty ?? 0}</td>
                          <td>
                            <button
                              className="btn-primary"
                              style={{ padding: "4px 12px", fontSize: 12 }}
                              onClick={() => handleOpenIssue(row)}
                              disabled={openingIssue}
                            >เปิด</button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={6}>ไม่พบข้อมูล</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>ชื่อสินค้า</th>
                      <th>หน่วย</th>
                      <th>คงเหลือ</th>
                      <th>เลือก</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.length > 0 ? (
                      shownRows.map((item, index) => {
                        const code = getCode(item);
                        const itemName = getItemName(item);
                        const unit = getUnit(item);
                        const remainQty = getRemainQty(item);
                        const allowAdd = canAddItem(item);
                        return (
                          <tr key={`${code || itemName}-${index}`}>
                            <td style={{ textAlign: "left" }}>{itemName}</td>
                            <td>{unit || "-"}</td>
                            <td>{remainQty === null ? "-" : remainQty}</td>
                            <td>
                              <button
                                style={{
                                  width: 28, height: 28, borderRadius: 6, border: "none",
                                  background: allowAdd ? "#072d6b" : "#e5e7eb",
                                  color: allowAdd ? "#fff" : "#9ca3af",
                                  fontSize: 18, fontWeight: 700,
                                  cursor: allowAdd ? "pointer" : "not-allowed", lineHeight: 1,
                                }}
                                onClick={() => addToSelected(item)}
                                disabled={!allowAdd}
                              >+</button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan={4}>ไม่พบข้อมูล</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            {renderPagination()}
          </div>
        )}

        {/* DETAIL VIEW */}
        {mode === "detail" && issueDetail && (
          <div className="form-card">
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16, color: "#072d6b" }}>รายละเอียดใบเบิกวัสดุ</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
              {[
                ["เลขที่ใบเบิก", issueDetail.issue_no],
                ["วันที่เบิก", issueDetail.issue_date],
                ["ชื่อผู้เบิก", issueDetail.requester_name],
                ["สาขาที่เบิก", issueDetail.issue_branch],
                ["จำนวนรวม", issueDetail.total_qty ?? 0],
                ["หมายเหตุ", issueDetail.note || "-"],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 700 }}>{value || "-"}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>รหัสสินค้า</th>
                    <th style={{ textAlign: "left" }}>ชื่อสินค้า</th>
                    <th>หน่วย</th>
                    <th>จำนวนเบิก</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {issueDetail.items?.length > 0 ? (
                    issueDetail.items.map((item, index) => (
                      <tr key={`${item.issue_item_id || item.product_id || "item"}-${index}`}>
                        <td>{item.line_no ?? index + 1}</td>
                        <td>{item.product_id || "-"}</td>
                        <td style={{ textAlign: "left" }}>{item.product_name || "-"}</td>
                        <td>{item.unit || "-"}</td>
                        <td>
                          {item.isEditing ? (
                            <input
                              type="number" min="0" value={item.qty_issue}
                              style={smallQtyInput}
                              onChange={(e) => handleChangeDetailQty(index, e.target.value)}
                            />
                          ) : (item.qty_issue ?? 0)}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            {item.isEditing ? (
                              <button style={actionBtn("#10b981")} onClick={() => handleSaveDetailItem(index)}>บันทึก</button>
                            ) : (
                              <button style={actionBtn("#f59e0b", true)} onClick={() => handleEditDetailItem(index)}>แก้ไข</button>
                            )}
                            <button style={actionBtn("#ef4444", true)} onClick={() => handleDeleteDetailItem(index)}>ลบ</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6}>ไม่พบรายการ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <button
              className="btn-primary"
              style={{ width: "100%", marginTop: 16, padding: 11, fontSize: 15, fontWeight: 700, borderRadius: 8 }}
              onClick={handleUpdateIssue}
              disabled={updatingIssue}
            >
              {updatingIssue ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </div>
        )}

        {/* SELECTED ITEMS */}
        {mode === "issue" && (
          <div className="form-card">
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16, color: "#072d6b" }}>รายการที่เลือกเบิก</h3>
            <div style={{ display: "flex", gap: 24, padding: "8px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12, fontSize: 13, color: "#374151" }}>
              <span>จำนวนรายการ: <strong>{selectedItems.length}</strong></span>
              <span>จำนวนเบิกรวม: <strong>{totalQty}</strong></span>
            </div>

            {selectedItems.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#94a3b8", border: "1px dashed #cbd5e1", borderRadius: 8, background: "#f8fafc" }}>
                ยังไม่มีรายการที่เลือก
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>ชื่อสินค้า</th>
                      <th>หน่วย</th>
                      <th>คงเหลือ</th>
                      <th>จำนวนเบิก</th>
                      <th>ลบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map((item) => (
                      <tr key={item._key}>
                        <td style={{ textAlign: "left" }}>{item.itemName}</td>
                        <td>{item.unit || "-"}</td>
                        <td>{item.remainQty === null ? "-" : item.remainQty}</td>
                        <td>
                          <input
                            type="number" min="0"
                            max={item.remainQty === null ? undefined : item.remainQty}
                            value={item.qty}
                            style={smallQtyInput}
                            onChange={(e) => updateSelectedQty(item._key, e.target.value)}
                          />
                        </td>
                        <td>
                          <button style={actionBtn("#ef4444", true)} onClick={() => removeSelectedItem(item._key)}>ลบ</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              className="btn-primary"
              style={{ width: "100%", marginTop: 16, padding: 11, fontSize: 15, fontWeight: 700, borderRadius: 8 }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "กำลังบันทึก..." : "บันทึกรายการเบิก"}
            </button>
          </div>
        )}

        {!!message && (
          <div style={{ padding: "10px 16px", background: "#fef3c7", borderRadius: 8, marginBottom: 14, color: "#92400e", textAlign: "center" }}>
            {message}
          </div>
        )}
      </div>

      {/* POPUP */}
      {popup.open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}
          onClick={closePopup}
        >
          <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: popup.type === "success" ? "#10b981" : popup.type === "error" ? "#ef4444" : "#072d6b", color: "#fff", padding: "12px 18px", fontSize: 15, fontWeight: 700, textAlign: "center" }}>
              {popup.type === "success" ? "✔ สำเร็จ" : popup.type === "error" ? "✖ เกิดข้อผิดพลาด" : "ℹ แจ้งเตือน"}
            </div>
            <div style={{ padding: "18px 20px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#222", marginBottom: 6 }}>{popup.title}</div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{popup.message}</div>
            </div>
            <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "center" }}>
              <button
                style={{ minWidth: 90, background: popup.type === "success" ? "#10b981" : popup.type === "error" ? "#ef4444" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                onClick={closePopup}
              >ตกลง</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
