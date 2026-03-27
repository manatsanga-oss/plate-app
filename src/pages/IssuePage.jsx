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

      const stockGroup = ["SCY05","SCY06"].includes(branch) ? "ppao" : "singchai";
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

  /* ───────── STYLES ───────── */
  const S = {
    page: {
      width: "100%",
      minHeight: "100vh",
      background: "#f0f2f5",
      padding: "16px",
      boxSizing: "border-box",
      fontFamily: "Tahoma, Arial, sans-serif",
      fontSize: "14px",
      color: "#333",
    },
    container: { maxWidth: "1180px", margin: "0 auto" },
    card: {
      background: "#fff",
      border: "1px solid #d9d9d9",
      borderRadius: "4px",
      marginBottom: "12px",
    },
    cardHeader: {
      padding: "8px 14px",
      borderBottom: "1px solid #e8e8e8",
      fontSize: "14px",
      fontWeight: "700",
      color: "#1565C0",
      background: "#fafafa",
      borderRadius: "4px 4px 0 0",
    },
    cardBody: { padding: "12px 14px" },
    topBar: {
      display: "flex",
      gap: "6px",
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: "10px",
    },
    // buttons
    btn: (color = "#1565C0", outline = false) => ({
      background: outline ? "#fff" : color,
      color: outline ? color : "#fff",
      border: `1px solid ${color}`,
      borderRadius: "3px",
      padding: "5px 14px",
      fontSize: "13px",
      fontWeight: "600",
      cursor: "pointer",
      whiteSpace: "nowrap",
    }),
    btnGray: {
      background: "#fff",
      color: "#555",
      border: "1px solid #bbb",
      borderRadius: "3px",
      padding: "5px 14px",
      fontSize: "13px",
      fontWeight: "600",
      cursor: "pointer",
    },
    userInfo: {
      marginLeft: "auto",
      fontSize: "12px",
      color: "#555",
      background: "#f5f5f5",
      border: "1px solid #e0e0e0",
      borderRadius: "3px",
      padding: "4px 10px",
    },
    // search bar
    searchRow: { display: "flex", gap: "8px", marginBottom: "10px" },
    input: {
      border: "1px solid #d9d9d9",
      borderRadius: "3px",
      padding: "5px 10px",
      fontSize: "13px",
      flex: 1,
      color: "#333",
    },
    // table
    tableWrap: { overflowX: "auto" },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "13px",
    },
    th: {
      background: "#f0f0f0",
      color: "#333",
      padding: "7px 10px",
      fontWeight: "700",
      textAlign: "center",
      borderBottom: "2px solid #d0d0d0",
      borderRight: "1px solid #e0e0e0",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "6px 10px",
      textAlign: "center",
      borderBottom: "1px solid #ebebeb",
      borderRight: "1px solid #f0f0f0",
      verticalAlign: "middle",
      color: "#333",
    },
    tdLeft: {
      padding: "6px 10px",
      textAlign: "left",
      borderBottom: "1px solid #ebebeb",
      borderRight: "1px solid #f0f0f0",
      verticalAlign: "middle",
      color: "#333",
    },
    trHover: { background: "#fafafa" },
    // small buttons inside table
    plusBtn: {
      width: "26px",
      height: "26px",
      borderRadius: "3px",
      border: "1px solid #1565C0",
      background: "#1565C0",
      color: "#fff",
      fontSize: "16px",
      fontWeight: "700",
      cursor: "pointer",
      lineHeight: "1",
    },
    plusBtnDisabled: {
      width: "26px",
      height: "26px",
      borderRadius: "3px",
      border: "1px solid #ccc",
      background: "#f5f5f5",
      color: "#bbb",
      fontSize: "16px",
      fontWeight: "700",
      cursor: "not-allowed",
      lineHeight: "1",
    },
    openBtn: {
      background: "#1565C0",
      color: "#fff",
      border: "1px solid #1565C0",
      borderRadius: "3px",
      padding: "3px 10px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
    },
    editBtn: {
      background: "#fff",
      color: "#e67e00",
      border: "1px solid #e67e00",
      borderRadius: "3px",
      padding: "3px 8px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
    },
    saveRowBtn: {
      background: "#2e7d32",
      color: "#fff",
      border: "1px solid #2e7d32",
      borderRadius: "3px",
      padding: "3px 8px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
    },
    removeBtn: {
      background: "#fff",
      color: "#c62828",
      border: "1px solid #c62828",
      borderRadius: "3px",
      padding: "3px 8px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
    },
    smallInput: {
      width: "72px",
      border: "1px solid #d9d9d9",
      borderRadius: "3px",
      padding: "3px 6px",
      fontSize: "13px",
      textAlign: "center",
    },
    actionCell: { display: "flex", gap: "4px", justifyContent: "center" },
    // summary bar
    summaryBar: {
      display: "flex",
      gap: "24px",
      padding: "7px 12px",
      background: "#f8f9fa",
      border: "1px solid #e8e8e8",
      borderRadius: "3px",
      marginBottom: "10px",
      fontSize: "13px",
      color: "#333",
    },
    emptyBox: {
      padding: "24px",
      textAlign: "center",
      fontSize: "13px",
      color: "#aaa",
      border: "1px dashed #ddd",
      borderRadius: "3px",
      background: "#fafafa",
      marginTop: "8px",
    },
    saveBtn: {
      width: "100%",
      background: "#1565C0",
      color: "#fff",
      border: "none",
      borderRadius: "3px",
      padding: "9px",
      fontSize: "14px",
      fontWeight: "700",
      cursor: "pointer",
      marginTop: "10px",
    },
    message: {
      marginTop: "6px",
      textAlign: "center",
      fontSize: "12px",
      color: "#1565C0",
      fontWeight: "600",
    },
    // pagination
    pagerWrap: {
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: "3px",
      marginTop: "8px",
      fontSize: "12px",
    },
    pagerBtn: {
      border: "1px solid #d9d9d9",
      background: "#fff",
      color: "#333",
      borderRadius: "3px",
      padding: "3px 8px",
      fontSize: "12px",
      cursor: "pointer",
    },
    pagerBtnActive: {
      border: "1px solid #1565C0",
      background: "#1565C0",
      color: "#fff",
      borderRadius: "3px",
      padding: "3px 8px",
      fontSize: "12px",
      cursor: "pointer",
    },
    pagerBtnDisabled: {
      border: "1px solid #eee",
      background: "#f5f5f5",
      color: "#bbb",
      borderRadius: "3px",
      padding: "3px 8px",
      fontSize: "12px",
      cursor: "not-allowed",
    },
    // detail info grid
    detailGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: "8px",
      marginBottom: "10px",
    },
    detailCard: {
      background: "#fafafa",
      border: "1px solid #e8e8e8",
      borderRadius: "3px",
      padding: "7px 10px",
    },
    detailLabel: { fontSize: "11px", color: "#888", marginBottom: "2px" },
    detailValue: { fontSize: "13px", color: "#222", fontWeight: "700" },
    // popup
    popupOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px",
    },
    popupBox: {
      width: "100%",
      maxWidth: "380px",
      background: "#fff",
      borderRadius: "4px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      overflow: "hidden",
    },
    popupHeader: (type) => ({
      background:
        type === "success" ? "#2e7d32" : type === "error" ? "#c62828" : "#1565C0",
      color: "#fff",
      padding: "10px 18px",
      fontSize: "14px",
      fontWeight: "700",
      textAlign: "center",
    }),
    popupBody: { padding: "18px 20px 12px", textAlign: "center" },
    popupTitle: {
      fontSize: "16px",
      fontWeight: "700",
      color: "#222",
      marginBottom: "6px",
    },
    popupMsg: { fontSize: "13px", color: "#555", lineHeight: 1.6 },
    popupFooter: { padding: "0 20px 16px", display: "flex", justifyContent: "center" },
    popupBtn: (type) => ({
      minWidth: "90px",
      background:
        type === "success" ? "#2e7d32" : type === "error" ? "#c62828" : "#1565C0",
      color: "#fff",
      border: "none",
      borderRadius: "3px",
      padding: "7px 18px",
      fontSize: "13px",
      fontWeight: "700",
      cursor: "pointer",
    }),
  };

  /* ───────── PAGINATION ───────── */
  const renderPagination = () => {
    if (mode === "detail" || activeRows.length <= PAGE_SIZE) return null;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    return (
      <div style={S.pagerWrap}>
        <span style={{ color: "#666", marginRight: "4px" }}>
          หน้า {currentPage}/{totalPages}
        </span>
        <button
          style={currentPage === 1 ? S.pagerBtnDisabled : S.pagerBtn}
          onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ◀
        </button>
        {pages.map((p) => (
          <button
            key={p}
            style={p === currentPage ? S.pagerBtnActive : S.pagerBtn}
            onClick={() => setCurrentPage(p)}
          >
            {p}
          </button>
        ))}
        <button
          style={currentPage === totalPages ? S.pagerBtnDisabled : S.pagerBtn}
          onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          ▶
        </button>
      </div>
    );
  };

  /* ───────── RENDER ───────── */
  return (
    <>
      <div style={S.page}>
        <div style={S.container}>

          {/* ── TOP BAR ── */}
          <div style={S.card}>
            <div style={S.cardBody}>
              <div style={S.topBar}>
                <button
                  style={S.btn("#1565C0", mode === "issue")}
                  onClick={handleLoad}
                  disabled={loading}
                >
                  {loading ? "กำลังโหลด..." : "📋 เบิกวัสดุ"}
                </button>

                <button
                  style={S.btn("#2e7d32", mode === "history")}
                  onClick={handleSearch}
                  disabled={searching}
                >
                  {searching ? "กำลังค้นหา..." : "🔍 ประวัติการเบิก"}
                </button>

                <button style={S.btnGray} onClick={handleClear}>
                  ล้างข้อมูล
                </button>

                {mode === "detail" && (
                  <button style={S.btnGray} onClick={handleBackToHistory}>
                    ← กลับไปประวัติ
                  </button>
                )}

                <div style={S.userInfo}>
                  👤 {username || "-"} &nbsp;|&nbsp; 🏢 {branch || "-"}
                </div>
              </div>
            </div>
          </div>

          {/* ── MODE: ISSUE / HISTORY (TABLE) ── */}
          {mode !== "detail" && (
            <div style={S.card}>
              <div style={S.cardHeader}>
                {mode === "history" ? "ประวัติการเบิกวัสดุ" : "รายการวัสดุ"}
              </div>
              <div style={S.cardBody}>
                <div style={S.searchRow}>
                  <input
                    style={S.input}
                    type="text"
                    placeholder={
                      mode === "history"
                        ? "ค้นหาเลขที่ใบเบิก / วันที่ / ผู้เบิก / สาขา"
                        : "ค้นหาชื่อสินค้า หรือ รหัสสินค้า"
                    }
                    value={filterText}
                    onChange={(e) => {
                      setFilterText(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <div style={S.tableWrap}>
                  {mode === "history" ? (
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>เลขที่ใบเบิก</th>
                          <th style={S.th}>วันที่เบิก</th>
                          <th style={S.th}>ชื่อผู้เบิก</th>
                          <th style={S.th}>สาขาที่เบิก</th>
                          <th style={S.th}>จำนวน</th>
                          <th style={S.th}>เปิด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownRows.length > 0 ? (
                          shownRows.map((row, index) => (
                            <tr key={`${row.issue_no}-${index}`}>
                              <td style={S.td}>{row.issue_no || "-"}</td>
                              <td style={S.td}>{row.issue_date || "-"}</td>
                              <td style={S.tdLeft}>{row.requester_name || "-"}</td>
                              <td style={S.td}>{row.issue_branch || "-"}</td>
                              <td style={S.td}>{row.total_qty ?? 0}</td>
                              <td style={S.td}>
                                <button
                                  style={S.openBtn}
                                  onClick={() => handleOpenIssue(row)}
                                  disabled={openingIssue}
                                >
                                  เปิด
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td style={S.td} colSpan={6}>
                              ไม่พบข้อมูล
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={{ ...S.th, textAlign: "left" }}>ชื่อสินค้า</th>
                          <th style={S.th}>หน่วย</th>
                          <th style={S.th}>คงเหลือ</th>
                          <th style={S.th}>เลือก</th>
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
                                <td style={S.tdLeft}>{itemName}</td>
                                <td style={S.td}>{unit || "-"}</td>
                                <td style={S.td}>
                                  {remainQty === null ? "-" : remainQty}
                                </td>
                                <td style={S.td}>
                                  <button
                                    style={allowAdd ? S.plusBtn : S.plusBtnDisabled}
                                    onClick={() => addToSelected(item)}
                                    disabled={!allowAdd}
                                  >
                                    +
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td style={S.td} colSpan={4}>
                              ไม่พบข้อมูล
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
                {renderPagination()}
              </div>
            </div>
          )}

          {/* ── MODE: DETAIL ── */}
          {mode === "detail" && issueDetail && (
            <div style={S.card}>
              <div style={S.cardHeader}>
                รายละเอียดใบเบิกวัสดุ
              </div>
              <div style={S.cardBody}>
                <div style={S.detailGrid}>
                  {[
                    ["เลขที่ใบเบิก", issueDetail.issue_no],
                    ["วันที่เบิก", issueDetail.issue_date],
                    ["ชื่อผู้เบิก", issueDetail.requester_name],
                    ["สาขาที่เบิก", issueDetail.issue_branch],
                    ["จำนวนรวม", issueDetail.total_qty ?? 0],
                    ["หมายเหตุ", issueDetail.note || "-"],
                  ].map(([label, value]) => (
                    <div key={label} style={S.detailCard}>
                      <div style={S.detailLabel}>{label}</div>
                      <div style={S.detailValue}>{value || "-"}</div>
                    </div>
                  ))}
                </div>

                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>ลำดับ</th>
                        <th style={S.th}>รหัสสินค้า</th>
                        <th style={{ ...S.th, textAlign: "left" }}>ชื่อสินค้า</th>
                        <th style={S.th}>หน่วย</th>
                        <th style={S.th}>จำนวนเบิก</th>
                        <th style={S.th}>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issueDetail.items?.length > 0 ? (
                        issueDetail.items.map((item, index) => (
                          <tr
                            key={`${item.issue_item_id || item.product_id || "item"}-${index}`}
                          >
                            <td style={S.td}>{item.line_no ?? index + 1}</td>
                            <td style={S.td}>{item.product_id || "-"}</td>
                            <td style={S.tdLeft}>{item.product_name || "-"}</td>
                            <td style={S.td}>{item.unit || "-"}</td>
                            <td style={S.td}>
                              {item.isEditing ? (
                                <input
                                  style={S.smallInput}
                                  type="number"
                                  min="0"
                                  value={item.qty_issue}
                                  onChange={(e) =>
                                    handleChangeDetailQty(index, e.target.value)
                                  }
                                />
                              ) : (
                                item.qty_issue ?? 0
                              )}
                            </td>
                            <td style={S.td}>
                              <div style={S.actionCell}>
                                {item.isEditing ? (
                                  <button
                                    style={S.saveRowBtn}
                                    onClick={() => handleSaveDetailItem(index)}
                                  >
                                    บันทึก
                                  </button>
                                ) : (
                                  <button
                                    style={S.editBtn}
                                    onClick={() => handleEditDetailItem(index)}
                                  >
                                    แก้ไข
                                  </button>
                                )}
                                <button
                                  style={S.removeBtn}
                                  onClick={() => handleDeleteDetailItem(index)}
                                >
                                  ลบ
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td style={S.td} colSpan={6}>
                            ไม่พบรายการ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <button
                  style={S.saveBtn}
                  onClick={handleUpdateIssue}
                  disabled={updatingIssue}
                >
                  {updatingIssue ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </div>
          )}

          {/* ── SELECTED ITEMS (issue mode only) ── */}
          {mode === "issue" && (
            <div style={S.card}>
              <div style={S.cardHeader}>รายการที่เลือกเบิก</div>
              <div style={S.cardBody}>
                <div style={S.summaryBar}>
                  <span>จำนวนรายการ: <strong>{selectedItems.length}</strong></span>
                  <span>จำนวนเบิกรวม: <strong>{totalQty}</strong></span>
                </div>

                {selectedItems.length === 0 ? (
                  <div style={S.emptyBox}>ยังไม่มีรายการที่เลือก</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={{ ...S.th, textAlign: "left" }}>ชื่อสินค้า</th>
                          <th style={S.th}>หน่วย</th>
                          <th style={S.th}>คงเหลือ</th>
                          <th style={S.th}>จำนวนเบิก</th>
                          <th style={S.th}>ลบ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItems.map((item) => (
                          <tr key={item._key}>
                            <td style={S.tdLeft}>{item.itemName}</td>
                            <td style={S.td}>{item.unit || "-"}</td>
                            <td style={S.td}>
                              {item.remainQty === null ? "-" : item.remainQty}
                            </td>
                            <td style={S.td}>
                              <input
                                style={S.smallInput}
                                type="number"
                                min="0"
                                max={
                                  item.remainQty === null
                                    ? undefined
                                    : item.remainQty
                                }
                                value={item.qty}
                                onChange={(e) =>
                                  updateSelectedQty(item._key, e.target.value)
                                }
                              />
                            </td>
                            <td style={S.td}>
                              <button
                                style={S.removeBtn}
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

                <button
                  style={S.saveBtn}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "กำลังบันทึก..." : "บันทึกรายการเบิก"}
                </button>
              </div>
            </div>
          )}

          {!!message && <div style={S.message}>{message}</div>}
        </div>
      </div>

      {/* ── POPUP ── */}
      {popup.open && (
        <div style={S.popupOverlay} onClick={closePopup}>
          <div style={S.popupBox} onClick={(e) => e.stopPropagation()}>
            <div style={S.popupHeader(popup.type)}>
              {popup.type === "success"
                ? "✔ สำเร็จ"
                : popup.type === "error"
                ? "✖ เกิดข้อผิดพลาด"
                : "ℹ แจ้งเตือน"}
            </div>
            <div style={S.popupBody}>
              <div style={S.popupTitle}>{popup.title}</div>
              <div style={S.popupMsg}>{popup.message}</div>
            </div>
            <div style={S.popupFooter}>
              <button style={S.popupBtn(popup.type)} onClick={closePopup}>
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
