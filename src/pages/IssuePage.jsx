import React, { useEffect, useMemo, useState } from "react";

export default function IssuePage() {
  const LOAD_URL =
    "https://n8n-new-project-gwf2.onrender.com/webhook/4f649516-de04-4661-a6f5-caae15261e7f";

  const SAVE_URL =
    "https://n8n-new-project-gwf2.onrender.com/webhook/4541d09a-88a3-4b45-877c-f148163cb8c3";

  const SEARCH_URL =
    "https://n8n-new-project-gwf2.onrender.com/webhook/0d0939d3-4289-4c97-82df-60ce5ffaa2b7";

  const OPEN_ISSUE_URL =
    "https://n8n-new-project-gwf2.onrender.com/webhook/ed288563-3318-46ce-8d11-b5093f3e65a4";

  // เปลี่ยนเป็น webhook สำหรับแก้ไขใบเบิก
  const UPDATE_ISSUE_URL =
    "https://n8n-new-project-gwf2.onrender.com/webhook-test/9607ab8d-0779-4892-880c-dc1b96b36202";

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
    setPopup({
      open: true,
      type,
      title,
      message: popupMessage,
    });
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

  const getUserFromStorage = () => {
    const candidates = [
      {
        username: localStorage.getItem("username"),
        branch: localStorage.getItem("branch"),
      },
      {
        username: sessionStorage.getItem("username"),
        branch: sessionStorage.getItem("branch"),
      },
    ];

    try {
      const userRaw = localStorage.getItem("user");
      if (userRaw) {
        const userObj = JSON.parse(userRaw);
        candidates.push({
          username:
            userObj?.username ||
            userObj?.user_name ||
            userObj?.name ||
            "",
          branch: userObj?.branch || userObj?.branch_name || "",
        });
      }
    } catch {}

    try {
      const authRaw = localStorage.getItem("authUser");
      if (authRaw) {
        const authObj = JSON.parse(authRaw);
        candidates.push({
          username:
            authObj?.username ||
            authObj?.user_name ||
            authObj?.name ||
            "",
          branch: authObj?.branch || authObj?.branch_name || "",
        });
      }
    } catch {}

    for (const c of candidates) {
      if (text(c.username) || text(c.branch)) {
        return {
          username: text(c.username),
          branch: text(c.branch),
        };
      }
    }

    return {
      username: "",
      branch: "",
    };
  };

  useEffect(() => {
    const user = getUserFromStorage();
    setUsername(user.username);
    setBranch(user.branch);
  }, []);

  const getItemName = (item) => {
    return (
      text(item?.product_name) ||
      text(item?.["product_name"]) ||
      text(item?.["ชื่อสินค้า"]) ||
      text(item?.["ชื่อวัสดุ"]) ||
      text(item?.materialName) ||
      text(item?.name) ||
      "-"
    );
  };

  const getCode = (item) => {
    return (
      text(item?.product_id) ||
      text(item?.["product_id"]) ||
      text(item?.product_code) ||
      text(item?.["product_code"]) ||
      text(item?.["รหัส"]) ||
      text(item?.itemCode) ||
      ""
    );
  };

  const getUnit = (item) => {
    return (
      text(item?.unit) ||
      text(item?.["unit"]) ||
      text(item?.["หน่วย"]) ||
      ""
    );
  };

  const getRemainQty = (item) => {
    const v =
      item?.qty_on_hand ??
      item?.["qty_on_hand"] ??
      item?.["จำนวนคงเหลือใหม่"] ??
      item?.["จำนวนคงเหลือ"] ??
      item?.["คงเหลือ"] ??
      item?.remainQty ??
      item?.stock ??
      item?.qty ??
      item?.quantity ??
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
    if (matchThai) {
      return `${matchThai[3]}/${matchThai[2]}/${matchThai[1]}`;
    }

    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}`;
  };

  const handleLoad = async () => {
    try {
      setMode("issue");
      setLoading(true);
      setMessage("");
      setCurrentPage(1);
      setFilterText("");
      setIssueDetail(null);

      const res = await fetch(LOAD_URL, {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error("โหลดข้อมูลไม่สำเร็จ");
      }

      const data = await res.json();
      const list = normalizeListResponse(data);

      setMaterials(list);
      setHistoryRows([]);
      setMessage(`โหลดข้อมูลสำเร็จ ${list.length} รายการ`);
    } catch (error) {
      console.error("LOAD ERROR:", error);
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
      setFilterText("");
      setIssueDetail(null);

      const res = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`ค้นหาไม่สำเร็จ (${res.status})`);
      }

      const data = await res.json();
      const list = normalizeListResponse(data).map((row) => ({
        issue_no: text(row.issue_no),
        issue_date: formatDateDisplay(row.issue_date || row.issueDate),
        requester_name: text(row.requester_name || row.requesterName),
        issue_branch: text(row.issue_branch || row.department),
        total_qty: toNumber(row.total_qty || row.totalQty),
      }));

      setHistoryRows(list);
      setMaterials([]);
      setMessage(`ค้นหาสำเร็จ ${list.length} รายการ`);
    } catch (error) {
      console.error("SEARCH ERROR:", error);
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

      const res = await fetch(OPEN_ISSUE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          issue_no: issueNo,
        }),
      });

      if (!res.ok) {
        throw new Error(`เปิดใบเบิกไม่สำเร็จ (${res.status})`);
      }

      const data = await res.json();

      const header =
        data?.header ||
        data?.data?.header ||
        data?.issue_header ||
        data?.issue ||
        data?.summary ||
        {};

      const items =
        data?.items ||
        data?.data?.items ||
        data?.detail ||
        data?.details ||
        data?.lines ||
        [];

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
                item.product_name || item.name || item.item_name || item["ชื่อสินค้า"]
              ),
              unit: text(item.unit || item["หน่วย"]),
              qty_issue: toNumber(item.qty_issue || item.qty || item.quantity),
              isEditing: false,
            }))
          : [],
      };

      setIssueDetail(detailData);
      setMode("detail");
      setMessage(`เปิดรายละเอียดใบเบิก ${issueNo} สำเร็จ`);
    } catch (error) {
      console.error("OPEN ISSUE ERROR:", error);
      openPopup("error", "เปิดใบเบิกไม่สำเร็จ", "ไม่สามารถโหลดรายละเอียดใบเบิกได้");
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
      nextItems[index] = {
        ...nextItems[index],
        isEditing: true,
      };
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
      nextItems[index] = {
        ...nextItems[index],
        isEditing: false,
      };
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
      openPopup("error", "บันทึกไม่สำเร็จ", "ยังไม่มีรายการสำหรับแก้ไข");
      return;
    }

    const payload = {
      issue_no: issueDetail.issue_no,
      issue_date: issueDetail.issue_date,
      requester_name: issueDetail.requester_name,
      issue_branch: issueDetail.issue_branch,
      total_qty: validItems.reduce((sum, item) => sum + toNumber(item.qty_issue), 0),
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

      const res = await fetch(UPDATE_ISSUE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`อัปเดตใบเบิกไม่สำเร็จ (${res.status})`);
      }

      const raw = await res.json();
      const data = Array.isArray(raw) ? raw[0] : raw;

      const isSuccess =
        data?.ok === true ||
        data?.success === true ||
        data?.status === "success";

      if (isSuccess) {
        const msg = data?.message || "บันทึกการแก้ไขรายการเบิกเรียบร้อย";
        setMessage(msg);
        openPopup("success", "บันทึกสำเร็จ", msg);
      } else {
        const msg = data?.message || "บันทึกการแก้ไขไม่สำเร็จ";
        setMessage(msg);
        openPopup("error", "บันทึกไม่สำเร็จ", msg);
      }
    } catch (error) {
      console.error("UPDATE ISSUE ERROR:", error);
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่สามารถส่งข้อมูลแก้ไขไป n8n ได้");
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

    return historyRows.filter((row) => {
      return (
        text(row.issue_no).toLowerCase().includes(keyword) ||
        text(row.issue_date).toLowerCase().includes(keyword) ||
        text(row.requester_name).toLowerCase().includes(keyword) ||
        text(row.issue_branch).toLowerCase().includes(keyword) ||
        String(row.total_qty).includes(keyword)
      );
    });
  }, [historyRows, filterText]);

  const activeRows = mode === "history" ? filteredHistoryRows : filteredMaterials;

  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));

  const shownRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return activeRows.slice(start, start + PAGE_SIZE);
  }, [activeRows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
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

        if (remainQty === null) {
          next[foundIndex].qty = currentQty + 1;
        } else if (currentQty < remainQty) {
          next[foundIndex].qty = currentQty + 1;
        }

        return next;
      }

      return [
        ...prev,
        {
          _key: key,
          code,
          itemName,
          unit,
          remainQty,
          qty: 1,
          source: item,
        },
      ];
    });
  };

  const updateSelectedQty = (key, qty) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item._key !== key) return item;

        let newQty = toNumber(qty);
        if (newQty < 0) newQty = 0;

        if (item.remainQty !== null && newQty > item.remainQty) {
          newQty = item.remainQty;
        }

        return { ...item, qty: newQty };
      })
    );
  };

  const removeSelectedItem = (key) => {
    setSelectedItems((prev) => prev.filter((item) => item._key !== key));
  };

  const totalQty = selectedItems.reduce((sum, item) => sum + toNumber(item.qty), 0);

  const handleSave = async () => {
    const validItems = selectedItems.filter((item) => toNumber(item.qty) > 0);

    if (!text(username)) {
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่พบ username");
      return;
    }

    if (!text(branch)) {
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่พบ branch");
      return;
    }

    if (validItems.length === 0) {
      openPopup("error", "บันทึกไม่สำเร็จ", "ยังไม่มีรายการเบิก");
      return;
    }

    const payload = {
      username,
      branch,
      items: validItems.map((item, index) => ({
        line_no: index + 1,
        product_id: item.code,
        product_name: item.itemName,
        unit: item.unit,
        qty_issue: item.qty,
        qty_on_hand: item.remainQty,
        remain_qty: item.remainQty === null ? null : item.remainQty - item.qty,
      })),
    };

    try {
      setSaving(true);
      setMessage("");

      const res = await fetch(SAVE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("บันทึกไม่สำเร็จ");
      }

      const raw = await res.json();
      const data = Array.isArray(raw) ? raw[0] : raw;

      const isSuccess =
        data?.ok === true ||
        data?.success === true ||
        data?.status === "success";

      if (isSuccess) {
        const msg = data?.message || "บันทึกรายการเบิกเรียบร้อย";
        setMessage(msg);
        setSelectedItems([]);
        openPopup("success", "บันทึกสำเร็จ", msg);
        await handleLoad();
      } else {
        const msg = data?.message || "บันทึกไม่สำเร็จ";
        setMessage(msg);
        openPopup("error", "บันทึกไม่สำเร็จ", msg);
      }
    } catch (error) {
      console.error("SAVE ERROR:", error);
      setMessage("บันทึกไม่สำเร็จ");
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่สามารถเชื่อมต่อระบบได้");
    } finally {
      setSaving(false);
    }
  };

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
      maxWidth: "1180px",
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
    infoBtn: {
      background: "#64748b",
      color: "#fff",
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
    label: {
      fontSize: "18px",
      color: "#334155",
    },
    input: {
      border: "1px solid #b6c2da",
      borderRadius: "10px",
      padding: "12px 14px",
      fontSize: "16px",
      width: "100%",
      boxSizing: "border-box",
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
      whiteSpace: "nowrap",
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
    plusBtnDisabled: {
      width: "42px",
      height: "42px",
      borderRadius: "999px",
      border: "none",
      background: "#cbd5e1",
      color: "#ffffff",
      fontSize: "28px",
      fontWeight: "700",
      cursor: "not-allowed",
      lineHeight: 1,
    },
    openBtn: {
      background: "#2f6fe4",
      color: "#fff",
      border: "none",
      borderRadius: "10px",
      padding: "8px 16px",
      fontSize: "16px",
      fontWeight: "700",
      cursor: "pointer",
      minWidth: "72px",
    },
    editBtn: {
      background: "#f59e0b",
      color: "#fff",
      border: "none",
      borderRadius: "10px",
      padding: "8px 12px",
      fontSize: "15px",
      fontWeight: "700",
      cursor: "pointer",
      minWidth: "70px",
      marginRight: "8px",
    },
    saveRowBtn: {
      background: "#16a34a",
      color: "#fff",
      border: "none",
      borderRadius: "10px",
      padding: "8px 12px",
      fontSize: "15px",
      fontWeight: "700",
      cursor: "pointer",
      minWidth: "70px",
      marginRight: "8px",
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
    pagerWrap: {
      marginTop: "16px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
    },
    pagerBtn: {
      border: "1px solid #b6c2da",
      background: "#ffffff",
      color: "#1e3a5f",
      borderRadius: "10px",
      padding: "8px 14px",
      fontSize: "15px",
      fontWeight: "700",
      cursor: "pointer",
    },
    pagerBtnActive: {
      border: "1px solid #2f6fe4",
      background: "#2f6fe4",
      color: "#ffffff",
      borderRadius: "10px",
      padding: "8px 14px",
      fontSize: "15px",
      fontWeight: "700",
      cursor: "pointer",
    },
    pagerBtnDisabled: {
      border: "1px solid #cbd5e1",
      background: "#e2e8f0",
      color: "#94a3b8",
      borderRadius: "10px",
      padding: "8px 14px",
      fontSize: "15px",
      fontWeight: "700",
      cursor: "not-allowed",
    },
    detailGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "12px",
      marginBottom: "18px",
    },
    detailCard: {
      background: "#ffffff",
      border: "1px solid #dbe3f0",
      borderRadius: "14px",
      padding: "14px",
    },
    detailLabel: {
      fontSize: "15px",
      color: "#64748b",
      marginBottom: "6px",
    },
    detailValue: {
      fontSize: "20px",
      color: "#0f172a",
      fontWeight: "700",
      wordBreak: "break-word",
    },
    actionCell: {
      display: "flex",
      gap: "8px",
      justifyContent: "center",
      flexWrap: "wrap",
    },
    popupOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px",
    },
    popupBox: {
      width: "100%",
      maxWidth: "520px",
      background: "#ffffff",
      borderRadius: "22px",
      boxShadow: "0 18px 45px rgba(0,0,0,0.22)",
      overflow: "hidden",
      animation: "popupFadeIn 0.2s ease-out",
    },
    popupHeaderSuccess: {
      background: "linear-gradient(135deg, #16a34a, #22c55e)",
      color: "#fff",
      padding: "18px 24px",
      fontSize: "30px",
      fontWeight: "900",
      textAlign: "center",
      letterSpacing: "0.3px",
    },
    popupHeaderError: {
      background: "linear-gradient(135deg, #dc2626, #ef4444)",
      color: "#fff",
      padding: "18px 24px",
      fontSize: "30px",
      fontWeight: "900",
      textAlign: "center",
      letterSpacing: "0.3px",
    },
    popupHeaderInfo: {
      background: "linear-gradient(135deg, #2563eb, #3b82f6)",
      color: "#fff",
      padding: "18px 24px",
      fontSize: "30px",
      fontWeight: "900",
      textAlign: "center",
      letterSpacing: "0.3px",
    },
    popupBody: {
      padding: "28px 24px 18px",
      textAlign: "center",
    },
    popupTitle: {
      fontSize: "36px",
      fontWeight: "900",
      color: "#0f172a",
      marginBottom: "12px",
    },
    popupMessage: {
      fontSize: "22px",
      fontWeight: "700",
      color: "#334155",
      lineHeight: 1.7,
      wordBreak: "break-word",
      whiteSpace: "pre-wrap",
    },
    popupFooter: {
      padding: "0 24px 24px",
      display: "flex",
      justifyContent: "center",
    },
    popupBtnSuccess: {
      minWidth: "140px",
      background: "#16a34a",
      color: "#fff",
      border: "none",
      borderRadius: "14px",
      padding: "12px 24px",
      fontSize: "20px",
      fontWeight: "800",
      cursor: "pointer",
      boxShadow: "0 6px 16px rgba(22,163,74,0.25)",
    },
    popupBtnError: {
      minWidth: "140px",
      background: "#dc2626",
      color: "#fff",
      border: "none",
      borderRadius: "14px",
      padding: "12px 24px",
      fontSize: "20px",
      fontWeight: "800",
      cursor: "pointer",
      boxShadow: "0 6px 16px rgba(220,38,38,0.25)",
    },
    popupBtnInfo: {
      minWidth: "140px",
      background: "#2563eb",
      color: "#fff",
      border: "none",
      borderRadius: "14px",
      padding: "12px 24px",
      fontSize: "20px",
      fontWeight: "800",
      cursor: "pointer",
      boxShadow: "0 6px 16px rgba(37,99,235,0.25)",
    },
  };

  const renderPagination = () => {
    if (mode === "detail") return null;
    if (activeRows.length <= PAGE_SIZE) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);

    return (
      <div style={styles.pagerWrap}>
        <button
          style={currentPage === 1 ? styles.pagerBtnDisabled : styles.pagerBtn}
          onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ก่อนหน้า
        </button>

        {pages.map((page) => (
          <button
            key={page}
            style={page === currentPage ? styles.pagerBtnActive : styles.pagerBtn}
            onClick={() => setCurrentPage(page)}
          >
            {page}
          </button>
        ))}

        <button
          style={currentPage === totalPages ? styles.pagerBtnDisabled : styles.pagerBtn}
          onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          ถัดไป
        </button>
      </div>
    );
  };

  const popupHeaderStyle =
    popup.type === "success"
      ? styles.popupHeaderSuccess
      : popup.type === "error"
      ? styles.popupHeaderError
      : styles.popupHeaderInfo;

  const popupButtonStyle =
    popup.type === "success"
      ? styles.popupBtnSuccess
      : popup.type === "error"
      ? styles.popupBtnError
      : styles.popupBtnInfo;

  return (
    <>
      <style>
        {`
          @keyframes popupFadeIn {
            from {
              opacity: 0;
              transform: translateY(10px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>

      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.title}>หน้าเบิกวัสดุ</div>
          <div style={styles.subtitle}>ระบบเบิกวัสดุสำนักงาน</div>

          <div style={styles.buttonRow}>
            <button style={styles.primaryBtn} onClick={handleLoad} disabled={loading}>
              {loading ? "กำลังโหลด..." : "เบิก"}
            </button>

            <button
              style={styles.secondaryBtn}
              onClick={handleSearch}
              disabled={searching}
            >
              {searching ? "กำลังค้นหา..." : "ค้นหา"}
            </button>

            <button style={styles.dangerBtn} onClick={handleClear}>
              ล้างข้อมูล
            </button>

            {mode === "detail" && (
              <button style={styles.infoBtn} onClick={handleBackToHistory}>
                กลับไปประวัติ
              </button>
            )}
          </div>

          {mode !== "detail" && (
            <div style={styles.frame}>
              <div style={styles.frameTitle}>
                {mode === "history" ? "ประวัติการเบิกวัสดุ" : "รายการวัสดุ"}
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={styles.label}>
                  {mode === "history"
                    ? "ค้นหาเลขที่ใบเบิก / วันที่เบิก / ชื่อผู้เบิก / สาขาที่เบิก"
                    : "ค้นหา:"}
                </label>
                <div style={{ marginTop: "8px" }}>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder={
                      mode === "history"
                        ? "ค้นหาเลขที่ใบเบิก / วันที่เบิก / ชื่อผู้เบิก / สาขาที่เบิก"
                        : "ค้นหาชื่อสินค้า หรือ รหัสสินค้า"
                    }
                    value={filterText}
                    onChange={(e) => {
                      setFilterText(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>

              <div style={styles.tableWrap}>
                {mode === "history" ? (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>เลขที่ใบเบิก</th>
                        <th style={styles.th}>วันที่เบิก</th>
                        <th style={styles.th}>ชื่อผู้เบิก</th>
                        <th style={styles.th}>สาขาที่เบิก</th>
                        <th style={styles.th}>จำนวนที่เบิก</th>
                        <th style={styles.th}>เปิด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownRows.length > 0 ? (
                        shownRows.map((row, index) => (
                          <tr key={`${row.issue_no}-${index}`}>
                            <td style={styles.td}>{row.issue_no || "-"}</td>
                            <td style={styles.td}>{row.issue_date || "-"}</td>
                            <td style={styles.td}>{row.requester_name || "-"}</td>
                            <td style={styles.td}>{row.issue_branch || "-"}</td>
                            <td style={styles.td}>{row.total_qty ?? 0}</td>
                            <td style={styles.td}>
                              <button
                                style={styles.openBtn}
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
                          <td style={styles.td} colSpan={6}>
                            ไม่พบข้อมูล
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>ชื่อสินค้า</th>
                        <th style={styles.th}>หน่วย</th>
                        <th style={styles.th}>qty_on_hand</th>
                        <th style={styles.th}>เลือก</th>
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
                              <td style={styles.td}>{itemName}</td>
                              <td style={styles.td}>{unit || "-"}</td>
                              <td style={styles.td}>
                                {remainQty === null ? "-" : remainQty}
                              </td>
                              <td style={styles.td}>
                                <button
                                  style={allowAdd ? styles.plusBtn : styles.plusBtnDisabled}
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
                          <td style={styles.td} colSpan={4}>
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
          )}

          {mode === "detail" && issueDetail && (
            <div style={styles.frame}>
              <div style={styles.frameTitle}>รายละเอียดใบเบิกวัสดุ</div>

              <div style={styles.detailGrid}>
                <div style={styles.detailCard}>
                  <div style={styles.detailLabel}>เลขที่ใบเบิก</div>
                  <div style={styles.detailValue}>{issueDetail.issue_no || "-"}</div>
                </div>

                <div style={styles.detailCard}>
                  <div style={styles.detailLabel}>วันที่เบิก</div>
                  <div style={styles.detailValue}>{issueDetail.issue_date || "-"}</div>
                </div>

                <div style={styles.detailCard}>
                  <div style={styles.detailLabel}>ชื่อผู้เบิก</div>
                  <div style={styles.detailValue}>{issueDetail.requester_name || "-"}</div>
                </div>

                <div style={styles.detailCard}>
                  <div style={styles.detailLabel}>สาขาที่เบิก</div>
                  <div style={styles.detailValue}>{issueDetail.issue_branch || "-"}</div>
                </div>

                <div style={styles.detailCard}>
                  <div style={styles.detailLabel}>จำนวนที่เบิก</div>
                  <div style={styles.detailValue}>{issueDetail.total_qty ?? 0}</div>
                </div>

                <div style={styles.detailCard}>
                  <div style={styles.detailLabel}>หมายเหตุ</div>
                  <div style={styles.detailValue}>{issueDetail.note || "-"}</div>
                </div>
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>ลำดับ</th>
                      <th style={styles.th}>รหัสสินค้า</th>
                      <th style={styles.th}>ชื่อสินค้า</th>
                      <th style={styles.th}>หน่วย</th>
                      <th style={styles.th}>จำนวนเบิก</th>
                      <th style={styles.th}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueDetail.items?.length > 0 ? (
                      issueDetail.items.map((item, index) => (
                        <tr key={`${item.issue_item_id || item.product_id || "item"}-${index}`}>
                          <td style={styles.td}>{item.line_no ?? index + 1}</td>
                          <td style={styles.td}>{item.product_id || "-"}</td>
                          <td style={styles.td}>{item.product_name || "-"}</td>
                          <td style={styles.td}>{item.unit || "-"}</td>
                          <td style={styles.td}>
                            {item.isEditing ? (
                              <input
                                style={styles.smallInput}
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
                          <td style={styles.td}>
                            <div style={styles.actionCell}>
                              {item.isEditing ? (
                                <button
                                  style={styles.saveRowBtn}
                                  onClick={() => handleSaveDetailItem(index)}
                                >
                                  บันทึก
                                </button>
                              ) : (
                                <button
                                  style={styles.editBtn}
                                  onClick={() => handleEditDetailItem(index)}
                                >
                                  แก้ไข
                                </button>
                              )}

                              <button
                                style={styles.removeBtn}
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
                        <td style={styles.td} colSpan={6}>
                          ไม่พบรายละเอียดรายการสินค้า
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <button
                style={styles.saveBtn}
                onClick={handleUpdateIssue}
                disabled={updatingIssue}
              >
                {updatingIssue ? "กำลังบันทึกรายการเบิก..." : "บันทึกรายการเบิก"}
              </button>
            </div>
          )}

          {mode === "issue" && (
            <div style={styles.frame}>
              <div style={styles.frameTitle}>รายการที่เลือก</div>

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
                        <th style={styles.th}>หน่วย</th>
                        <th style={styles.th}>qty_on_hand</th>
                        <th style={styles.th}>จำนวนเบิก</th>
                        <th style={styles.th}>ลบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item) => (
                        <tr key={item._key}>
                          <td style={styles.td}>{item.itemName}</td>
                          <td style={styles.td}>{item.unit || "-"}</td>
                          <td style={styles.td}>
                            {item.remainQty === null ? "-" : item.remainQty}
                          </td>
                          <td style={styles.td}>
                            <input
                              style={styles.smallInput}
                              type="number"
                              min="0"
                              max={item.remainQty === null ? undefined : item.remainQty}
                              value={item.qty}
                              onChange={(e) => updateSelectedQty(item._key, e.target.value)}
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
            </div>
          )}

          {!!message && <div style={styles.message}>{message}</div>}
        </div>
      </div>

      {popup.open && (
        <div style={styles.popupOverlay} onClick={closePopup}>
          <div style={styles.popupBox} onClick={(e) => e.stopPropagation()}>
            <div style={popupHeaderStyle}>
              {popup.type === "success"
                ? "บันทึกสำเร็จ"
                : popup.type === "error"
                ? "เกิดข้อผิดพลาด"
                : "แจ้งเตือน"}
            </div>

            <div style={styles.popupBody}>
              <div style={styles.popupTitle}>{popup.title}</div>
              <div style={styles.popupMessage}>{popup.message}</div>
            </div>

            <div style={styles.popupFooter}>
              <button style={popupButtonStyle} onClick={closePopup}>
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}