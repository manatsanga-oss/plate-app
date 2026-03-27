import React, { useEffect, useMemo, useState } from "react";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Sarabun', 'IBM Plex Sans Thai', sans-serif;
  }

  .issue-page {
    min-height: 100vh;
    background: #0f1623;
    background-image:
      radial-gradient(ellipse at 20% 10%, rgba(56, 189, 248, 0.07) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(99, 102, 241, 0.07) 0%, transparent 50%);
    padding: 32px 20px;
    color: #e2e8f0;
  }

  .issue-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  /* ─── HEADER ─── */
  .issue-header {
    text-align: center;
    margin-bottom: 36px;
  }

  .issue-header-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: 100px;
    padding: 6px 18px;
    font-size: 13px;
    color: #38bdf8;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 16px;
    font-weight: 600;
  }

  .issue-title {
    font-family: 'IBM Plex Sans Thai', sans-serif;
    font-size: 44px;
    font-weight: 700;
    background: linear-gradient(135deg, #e2e8f0 0%, #38bdf8 60%, #818cf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.2;
    margin-bottom: 8px;
  }

  .issue-subtitle {
    font-size: 16px;
    color: #64748b;
    font-weight: 400;
  }

  /* ─── USER INFO BAR ─── */
  .user-info-bar {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .user-info-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 100px;
    padding: 5px 14px;
    font-size: 13px;
    color: #94a3b8;
    font-weight: 500;
  }

  .user-info-chip.warn {
    background: rgba(239,68,68,0.08);
    border-color: rgba(239,68,68,0.25);
    color: #f87171;
  }

  .user-info-chip span { color: #e2e8f0; font-weight: 600; }

  /* ─── TOOLBAR ─── */
  .toolbar {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 28px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: none;
    border-radius: 12px;
    padding: 11px 24px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.18s ease;
    letter-spacing: 0.02em;
    position: relative;
    overflow: hidden;
  }

  .btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(255,255,255,0.08);
    opacity: 0;
    transition: opacity 0.15s;
  }

  .btn:hover::after { opacity: 1; }
  .btn:active { transform: scale(0.97); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn:disabled:active { transform: none; }

  .btn-primary {
    background: linear-gradient(135deg, #2563eb, #3b82f6);
    color: #fff;
    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.35);
  }

  .btn-success {
    background: linear-gradient(135deg, #059669, #10b981);
    color: #fff;
    box-shadow: 0 4px 16px rgba(5, 150, 105, 0.35);
  }

  .btn-neutral {
    background: rgba(255,255,255,0.07);
    color: #94a3b8;
    border: 1px solid rgba(255,255,255,0.1);
  }

  .btn-neutral:hover { color: #e2e8f0; }

  .btn-slate {
    background: rgba(99, 102, 241, 0.15);
    color: #818cf8;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .btn-slate:hover { background: rgba(99, 102, 241, 0.25); }

  .btn-icon { font-size: 17px; }

  /* ─── CARD ─── */
  .card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 24px;
    margin-bottom: 20px;
    backdrop-filter: blur(12px);
  }

  .card-title {
    font-size: 18px;
    font-weight: 700;
    color: #e2e8f0;
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .card-title-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }

  .card-title-icon.blue { background: rgba(56,189,248,0.15); }
  .card-title-icon.green { background: rgba(16,185,129,0.15); }
  .card-title-icon.indigo { background: rgba(129,140,248,0.15); }

  /* ─── SEARCH INPUT ─── */
  .search-wrap {
    position: relative;
    margin-bottom: 18px;
  }

  .search-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: #475569;
    font-size: 16px;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 12px 16px 12px 44px;
    font-size: 15px;
    color: #e2e8f0;
    font-family: inherit;
    transition: border-color 0.18s, box-shadow 0.18s;
    outline: none;
  }

  .search-input::placeholder { color: #475569; }
  .search-input:focus {
    border-color: rgba(56,189,248,0.4);
    box-shadow: 0 0 0 3px rgba(56,189,248,0.08);
  }

  /* ─── TABLE ─── */
  .table-wrap { overflow-x: auto; }

  .data-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  .data-table thead th {
    background: rgba(255,255,255,0.04);
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 12px 14px;
    text-align: center;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    white-space: nowrap;
  }

  .data-table thead th:first-child { border-radius: 10px 0 0 0; }
  .data-table thead th:last-child { border-radius: 0 10px 0 0; }

  .data-table tbody tr {
    transition: background 0.15s;
  }

  .data-table tbody tr:hover {
    background: rgba(255,255,255,0.03);
  }

  .data-table tbody td {
    padding: 13px 14px;
    font-size: 14px;
    text-align: center;
    color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    vertical-align: middle;
  }

  .data-table tbody tr:last-child td {
    border-bottom: none;
  }

  .empty-row td {
    color: #475569 !important;
    font-style: italic;
    padding: 32px !important;
  }

  /* ─── SKELETON LOADING ─── */
  @keyframes shimmer {
    0% { background-position: -600px 0; }
    100% { background-position: 600px 0; }
  }

  .skeleton-row td {
    padding: 13px 14px !important;
    border-bottom: 1px solid rgba(255,255,255,0.04) !important;
  }

  .skeleton-cell {
    height: 18px;
    border-radius: 6px;
    background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
    background-size: 600px 100%;
    animation: shimmer 1.4s infinite linear;
    margin: 0 auto;
  }

  /* ─── BADGE ─── */
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    padding: 3px 10px;
    font-size: 13px;
    font-weight: 600;
  }

  .badge-blue { background: rgba(59,130,246,0.15); color: #60a5fa; }
  .badge-green { background: rgba(16,185,129,0.12); color: #34d399; }
  .badge-red { background: rgba(239,68,68,0.12); color: #f87171; }

  /* ─── SMALL BUTTONS ─── */
  .tbl-btn {
    border: none;
    border-radius: 8px;
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .tbl-btn:hover { opacity: 0.85; transform: translateY(-1px); }
  .tbl-btn:active { transform: translateY(0); }
  .tbl-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .tbl-btn-open { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.25); }
  .tbl-btn-edit { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.25); }
  .tbl-btn-save { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.25); }
  .tbl-btn-del { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }

  .plus-btn {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    border: none;
    background: linear-gradient(135deg, #059669, #10b981);
    color: #fff;
    font-size: 22px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: auto;
    transition: all 0.15s;
    box-shadow: 0 3px 10px rgba(5,150,105,0.3);
  }

  .plus-btn:hover { transform: scale(1.1); box-shadow: 0 4px 14px rgba(5,150,105,0.45); }
  .plus-btn:active { transform: scale(0.95); }

  .plus-btn-disabled {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    border: none;
    background: rgba(255,255,255,0.06);
    color: #475569;
    font-size: 22px;
    cursor: not-allowed;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: auto;
  }

  /* ─── SMALL QTY INPUT ─── */
  .qty-input {
    width: 84px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    padding: 7px 10px;
    font-size: 14px;
    color: #e2e8f0;
    text-align: center;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .qty-input:focus {
    border-color: rgba(56,189,248,0.4);
    box-shadow: 0 0 0 3px rgba(56,189,248,0.08);
  }

  .qty-input.invalid {
    border-color: rgba(239,68,68,0.5);
    box-shadow: 0 0 0 3px rgba(239,68,68,0.08);
  }

  /* ─── SUMMARY BOX ─── */
  .summary-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .summary-tile {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 14px 16px;
    text-align: center;
  }

  .summary-tile-label {
    font-size: 11px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 6px;
    font-weight: 600;
  }

  .summary-tile-value {
    font-size: 28px;
    font-weight: 700;
    color: #38bdf8;
    font-family: 'IBM Plex Sans Thai', sans-serif;
  }

  /* ─── DETAIL GRID ─── */
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .detail-tile {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 14px 16px;
  }

  .detail-tile-label {
    font-size: 11px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 6px;
    font-weight: 600;
  }

  .detail-tile-value {
    font-size: 16px;
    font-weight: 600;
    color: #e2e8f0;
    word-break: break-word;
  }

  /* ─── BIG SAVE BUTTON ─── */
  .save-btn-big {
    width: 100%;
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    color: #fff;
    border: none;
    border-radius: 14px;
    padding: 16px;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    margin-top: 18px;
    transition: all 0.18s;
    box-shadow: 0 6px 20px rgba(5,150,105,0.3);
    letter-spacing: 0.02em;
  }

  .save-btn-big:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(5,150,105,0.4); }
  .save-btn-big:active { transform: translateY(0); }
  .save-btn-big:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* ─── PAGINATION ─── */
  .pager {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  .pager-btn {
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: #94a3b8;
    border-radius: 8px;
    padding: 7px 13px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .pager-btn:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; }

  .pager-btn-active {
    border: 1px solid #3b82f6;
    background: rgba(59,130,246,0.2);
    color: #60a5fa;
    border-radius: 8px;
    padding: 7px 13px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
  }

  .pager-btn-disabled {
    border: 1px solid rgba(255,255,255,0.05);
    background: transparent;
    color: #334155;
    border-radius: 8px;
    padding: 7px 13px;
    font-size: 13px;
    font-weight: 600;
    cursor: not-allowed;
    font-family: inherit;
  }

  /* ─── ACTION CELL ─── */
  .action-cell { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }

  /* ─── STATUS MSG ─── */
  .status-msg {
    text-align: center;
    font-size: 14px;
    color: #38bdf8;
    font-weight: 600;
    margin-top: 12px;
    padding: 10px;
    background: rgba(56,189,248,0.07);
    border-radius: 10px;
    border: 1px solid rgba(56,189,248,0.15);
  }

  /* ─── VALIDATION ERROR MSG ─── */
  .validation-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 16px;
    font-size: 14px;
    color: #f87171;
    font-weight: 500;
  }

  /* ─── EMPTY STATE ─── */
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #475569;
  }

  .empty-state-icon { font-size: 40px; margin-bottom: 12px; }
  .empty-state-text { font-size: 15px; font-weight: 500; }

  /* ─── POPUP ─── */
  .popup-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
    backdrop-filter: blur(4px);
  }

  .popup-box {
    width: 100%;
    max-width: 460px;
    background: #1e293b;
    border-radius: 22px;
    border: 1px solid rgba(255,255,255,0.1);
    overflow: hidden;
    animation: popIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 24px 60px rgba(0,0,0,0.5);
  }

  @keyframes popIn {
    from { opacity: 0; transform: scale(0.88) translateY(16px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .popup-header-success { background: linear-gradient(135deg, #059669, #34d399); }
  .popup-header-error { background: linear-gradient(135deg, #dc2626, #f87171); }
  .popup-header-info { background: linear-gradient(135deg, #2563eb, #60a5fa); }
  .popup-header-confirm { background: linear-gradient(135deg, #d97706, #fbbf24); }

  .popup-header {
    padding: 20px 24px;
    text-align: center;
    font-size: 18px;
    font-weight: 800;
    color: #fff;
    letter-spacing: 0.03em;
  }

  .popup-body {
    padding: 28px 24px 16px;
    text-align: center;
  }

  .popup-icon { font-size: 48px; margin-bottom: 14px; }

  .popup-title {
    font-size: 22px;
    font-weight: 800;
    color: #e2e8f0;
    margin-bottom: 10px;
  }

  .popup-msg {
    font-size: 15px;
    color: #94a3b8;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .popup-footer {
    padding: 16px 24px 24px;
    display: flex;
    justify-content: center;
    gap: 10px;
  }

  .popup-btn {
    min-width: 130px;
    border: none;
    border-radius: 12px;
    padding: 12px 24px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .popup-btn:hover { transform: translateY(-1px); opacity: 0.9; }
  .popup-btn-success { background: linear-gradient(135deg,#059669,#10b981); color:#fff; box-shadow:0 4px 14px rgba(5,150,105,0.3); }
  .popup-btn-error { background: linear-gradient(135deg,#dc2626,#ef4444); color:#fff; box-shadow:0 4px 14px rgba(220,38,38,0.3); }
  .popup-btn-info { background: linear-gradient(135deg,#2563eb,#3b82f6); color:#fff; box-shadow:0 4px 14px rgba(37,99,235,0.3); }
  .popup-btn-confirm { background: linear-gradient(135deg,#d97706,#f59e0b); color:#fff; box-shadow:0 4px 14px rgba(217,119,6,0.3); }
  .popup-btn-cancel { background: rgba(255,255,255,0.07); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }

  /* ─── DIVIDER ─── */
  .divider {
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin: 4px 0 18px;
  }

  /* ─── QTY EXCEED TOOLTIP ─── */
  .qty-exceed-hint {
    font-size: 11px;
    color: #f87171;
    margin-top: 3px;
    display: block;
  }

  /* responsive */
  @media (max-width: 600px) {
    .issue-title { font-size: 30px; }
    .toolbar { gap: 8px; }
    .btn { padding: 10px 16px; font-size: 14px; }
  }
`;

export default function IssuePage() {
  // ✅ FIX: เปลี่ยน webhook-test → webhook สำหรับ production
  const LOAD_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/4f649516-de04-4661-a6f5-caae15261e7f";
  const SAVE_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/4541d09a-88a3-4b45-877c-f148163cb8c3";
  const SEARCH_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/0d0939d3-4289-4c97-82df-60ce5ffaa2b7";
  const OPEN_ISSUE_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/ed288563-3318-46ce-8d11-b5093f3e65a4";
  // ⚠️ NOTE: URL นี้ยังเป็น /webhook-test/ — เปลี่ยนเป็น /webhook/ เมื่อ deploy จริง
  const UPDATE_ISSUE_URL = "https://n8n-new-project-gwf2.onrender.com/webhook-test/9607ab8d-0779-4892-880c-dc1b96b36202";

  const PAGE_SIZE = 10;

  const [mode, setMode] = useState("issue");
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
  const [popup, setPopup] = useState({ open: false, type: "success", title: "", message: "", confirm: null });

  const text = (v) => (v ?? "").toString().trim();
  const toNumber = (v) => {
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const openPopup = (type, title, popupMessage) =>
    setPopup({ open: true, type, title, message: popupMessage, confirm: null });

  // ✅ NEW: Confirm popup พร้อม callback
  const openConfirmPopup = (title, popupMessage, onConfirm) =>
    setPopup({ open: true, type: "confirm", title, message: popupMessage, confirm: onConfirm });

  const closePopup = () => setPopup((prev) => ({ ...prev, open: false, confirm: null }));

  const handlePopupConfirm = () => {
    if (popup.confirm) popup.confirm();
    closePopup();
  };

  const normalizeListResponse = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    return [];
  };

  // ✅ FIX: ครอบ localStorage ด้วย try-catch ทั้งหมด
  const getStorageItem = (storage, key) => {
    try { return storage.getItem(key); } catch { return null; }
  };

  const getUserFromStorage = () => {
    const candidates = [
      {
        username: getStorageItem(localStorage, "username"),
        branch: getStorageItem(localStorage, "branch"),
      },
      {
        username: getStorageItem(sessionStorage, "username"),
        branch: getStorageItem(sessionStorage, "branch"),
      },
    ];
    try {
      const userRaw = getStorageItem(localStorage, "user");
      if (userRaw) {
        const o = JSON.parse(userRaw);
        candidates.push({
          username: o?.username || o?.user_name || o?.name || "",
          branch: o?.branch || o?.branch_name || "",
        });
      }
    } catch {}
    try {
      const authRaw = getStorageItem(localStorage, "authUser");
      if (authRaw) {
        const o = JSON.parse(authRaw);
        candidates.push({
          username: o?.username || o?.user_name || o?.name || "",
          branch: o?.branch || o?.branch_name || "",
        });
      }
    } catch {}
    for (const c of candidates) {
      if (text(c.username) || text(c.branch))
        return { username: text(c.username), branch: text(c.branch) };
    }
    return { username: "", branch: "" };
  };

  useEffect(() => {
    const user = getUserFromStorage();
    setUsername(user.username);
    setBranch(user.branch);
  }, []);

  const getItemName = (item) =>
    text(item?.product_name) || text(item?.["ชื่อสินค้า"]) || text(item?.["ชื่อวัสดุ"]) ||
    text(item?.materialName) || text(item?.name) || "-";
  const getCode = (item) =>
    text(item?.product_id) || text(item?.product_code) || text(item?.["รหัส"]) || text(item?.itemCode) || "";
  const getUnit = (item) => text(item?.unit) || text(item?.["หน่วย"]) || "";
  const getRemainQty = (item) => {
    const v = item?.qty_on_hand ?? item?.["จำนวนคงเหลือใหม่"] ?? item?.["จำนวนคงเหลือ"] ??
      item?.["คงเหลือ"] ?? item?.remainQty ?? item?.stock ?? item?.qty ?? item?.quantity ?? null;
    if (v === null || v === undefined || v === "") return null;
    return toNumber(v);
  };
  const canAddItem = (item) => { const r = getRemainQty(item); return r === null || r > 0; };

  const formatDateDisplay = (value) => {
    if (!value) return "";
    const raw = String(value);
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const handleLoad = async () => {
    try {
      setMode("issue"); setLoading(true); setMessage(""); setCurrentPage(1);
      setFilterText(""); setIssueDetail(null);
      const res = await fetch(LOAD_URL, { method: "GET" });
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const data = await res.json();
      const list = normalizeListResponse(data);
      setMaterials(list); setHistoryRows([]);
      setMessage(`โหลดข้อมูลสำเร็จ ${list.length} รายการ`);
    } catch {
      setMaterials([]); setMessage("โหลดข้อมูลไม่สำเร็จ");
      openPopup("error", "โหลดข้อมูลไม่สำเร็จ", "ไม่สามารถโหลดรายการวัสดุได้");
    } finally { setLoading(false); }
  };

  const handleSearch = async () => {
    try {
      setMode("history"); setSearching(true); setMessage(""); setCurrentPage(1);
      setFilterText(""); setIssueDetail(null);
      const res = await fetch(SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`ค้นหาไม่สำเร็จ (${res.status})`);
      const data = await res.json();
      const list = normalizeListResponse(data).map((row) => ({
        issue_no: text(row.issue_no),
        issue_date: formatDateDisplay(row.issue_date || row.issueDate),
        requester_name: text(row.requester_name || row.requesterName),
        issue_branch: text(row.issue_branch || row.department),
        total_qty: toNumber(row.total_qty || row.totalQty),
      }));
      setHistoryRows(list); setMaterials([]);
      setMessage(`ค้นหาสำเร็จ ${list.length} รายการ`);
    } catch {
      setHistoryRows([]); setMessage("ค้นหาข้อมูลไม่สำเร็จ");
      openPopup("error", "ค้นหาไม่สำเร็จ", "ไม่สามารถค้นหาข้อมูลได้");
    } finally { setSearching(false); }
  };

  const handleOpenIssue = async (row) => {
    const issueNo = text(row?.issue_no);
    if (!issueNo) { openPopup("error", "เปิดใบเบิกไม่สำเร็จ", "ไม่พบเลขที่ใบเบิก"); return; }
    try {
      setOpeningIssue(true); setMessage("");
      const res = await fetch(OPEN_ISSUE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issue_no: issueNo }),
      });
      if (!res.ok) throw new Error(`เปิดใบเบิกไม่สำเร็จ (${res.status})`);
      const data = await res.json();
      const header = data?.header || data?.data?.header || data?.issue_header || data?.issue || data?.summary || {};
      const items = data?.items || data?.data?.items || data?.detail || data?.details || data?.lines || [];
      setIssueDetail({
        issue_no: text(header.issue_no || row.issue_no),
        issue_date: formatDateDisplay(header.issue_date || header.issueDate || row.issue_date),
        requester_name: text(header.requester_name || header.requesterName || row.requester_name),
        issue_branch: text(header.issue_branch || header.department || row.issue_branch),
        total_qty: toNumber(header.total_qty || header.totalQty || row.total_qty),
        note: text(header.note),
        items: Array.isArray(items) ? items.map((item, i) => ({
          line_no: item.line_no ?? i + 1,
          issue_item_id: text(item.issue_item_id || item.id),
          product_id: text(item.product_id || item.code || item.item_code),
          product_name: text(item.product_name || item.name || item.item_name || item["ชื่อสินค้า"]),
          unit: text(item.unit || item["หน่วย"]),
          qty_issue: toNumber(item.qty_issue || item.qty || item.quantity),
          isEditing: false,
        })) : [],
      });
      setMode("detail");
      setMessage(`เปิดรายละเอียดใบเบิก ${issueNo} สำเร็จ`);
    } catch {
      openPopup("error", "เปิดใบเบิกไม่สำเร็จ", "ไม่สามารถโหลดรายละเอียดใบเบิกได้");
    } finally { setOpeningIssue(false); }
  };

  const handleBackToHistory = () => { setMode("history"); setIssueDetail(null); setMessage(""); };
  const handleClear = () => {
    setMode("issue"); setFilterText(""); setSelectedItems([]);
    setMaterials([]); setHistoryRows([]); setIssueDetail(null);
    setCurrentPage(1); setMessage("");
  };

  const handleEditDetailItem = (index) => {
    setIssueDetail((prev) => {
      if (!prev) return prev;
      const next = [...prev.items];
      next[index] = { ...next[index], isEditing: true };
      return { ...prev, items: next };
    });
  };

  // ✅ FIX: Validate qty ไม่ให้ติดลบ
  const handleChangeDetailQty = (index, value) => {
    setIssueDetail((prev) => {
      if (!prev) return prev;
      const next = [...prev.items];
      const n = Math.max(0, toNumber(value));
      next[index] = { ...next[index], qty_issue: n };
      return { ...prev, items: next };
    });
  };

  const handleSaveDetailItem = (index) => {
    setIssueDetail((prev) => {
      if (!prev) return prev;
      const next = [...prev.items];
      next[index] = { ...next[index], isEditing: false };
      return {
        ...prev,
        items: next,
        total_qty: next.reduce((s, i) => s + toNumber(i.qty_issue), 0),
      };
    });
  };

  // ✅ NEW: ถามยืนยันก่อนลบ
  const handleDeleteDetailItem = (index) => {
    const itemName = issueDetail?.items?.[index]?.product_name || "รายการนี้";
    openConfirmPopup(
      "ยืนยันการลบ",
      `ต้องการลบ "${itemName}" ออกจากรายการใช่หรือไม่?`,
      () => {
        setIssueDetail((prev) => {
          if (!prev) return prev;
          const next = prev.items.filter((_, i) => i !== index);
          return { ...prev, items: next, total_qty: next.reduce((s, i) => s + toNumber(i.qty_issue), 0) };
        });
      }
    );
  };

  const handleUpdateIssue = async () => {
    if (!issueDetail || !text(issueDetail.issue_no)) {
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่พบข้อมูลใบเบิก"); return;
    }
    // ✅ FIX: ตรวจสอบว่ามีรายการที่ยัง isEditing อยู่
    const hasEditing = (issueDetail.items || []).some((i) => i.isEditing);
    if (hasEditing) {
      openPopup("error", "บันทึกไม่สำเร็จ", "กรุณากด ✔ บันทึก ในแต่ละแถวให้ครบก่อนบันทึก"); return;
    }
    const validItems = (issueDetail.items || []).filter((i) => toNumber(i.qty_issue) > 0);
    if (!validItems.length) {
      openPopup("error", "บันทึกไม่สำเร็จ", "ยังไม่มีรายการสำหรับแก้ไข"); return;
    }
    const payload = {
      issue_no: issueDetail.issue_no,
      issue_date: issueDetail.issue_date,
      requester_name: issueDetail.requester_name,
      issue_branch: issueDetail.issue_branch,
      total_qty: validItems.reduce((s, i) => s + toNumber(i.qty_issue), 0),
      note: issueDetail.note || "",
      updated_by: username || "",
      items: validItems.map((item, i) => ({
        line_no: i + 1,
        issue_item_id: item.issue_item_id || "",
        product_id: item.product_id || "",
        product_name: item.product_name || "",
        unit: item.unit || "",
        qty_issue: toNumber(item.qty_issue),
      })),
    };
    try {
      setUpdatingIssue(true); setMessage("");
      const res = await fetch(UPDATE_ISSUE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`อัปเดตใบเบิกไม่สำเร็จ (${res.status})`);
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw[0] : raw;
      const ok = data?.ok === true || data?.success === true || data?.status === "success";
      const msg = data?.message || (ok ? "บันทึกการแก้ไขรายการเบิกเรียบร้อย" : "บันทึกการแก้ไขไม่สำเร็จ");
      setMessage(msg);
      openPopup(ok ? "success" : "error", ok ? "บันทึกสำเร็จ" : "บันทึกไม่สำเร็จ", msg);
    } catch {
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่สามารถส่งข้อมูลแก้ไขไป n8n ได้");
    } finally { setUpdatingIssue(false); }
  };

  const filteredMaterials = useMemo(() => {
    const kw = filterText.toLowerCase().trim();
    if (!kw) return materials;
    return materials.filter((i) =>
      getItemName(i).toLowerCase().includes(kw) || getCode(i).toLowerCase().includes(kw)
    );
  }, [materials, filterText]);

  const filteredHistoryRows = useMemo(() => {
    const kw = filterText.toLowerCase().trim();
    if (!kw) return historyRows;
    return historyRows.filter((r) =>
      text(r.issue_no).toLowerCase().includes(kw) ||
      text(r.issue_date).toLowerCase().includes(kw) ||
      text(r.requester_name).toLowerCase().includes(kw) ||
      text(r.issue_branch).toLowerCase().includes(kw) ||
      String(r.total_qty).includes(kw)
    );
  }, [historyRows, filterText]);

  const activeRows = mode === "history" ? filteredHistoryRows : filteredMaterials;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const shownRows = useMemo(() => {
    const s = (currentPage - 1) * PAGE_SIZE;
    return activeRows.slice(s, s + PAGE_SIZE);
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
      const fi = prev.findIndex((x) => x._key === key);
      if (fi >= 0) {
        const next = [...prev];
        const cur = toNumber(next[fi].qty);
        if (remainQty === null || cur < remainQty) next[fi].qty = cur + 1;
        return next;
      }
      return [...prev, { _key: key, code, itemName, unit, remainQty, qty: 1, source: item }];
    });
  };

  // ✅ FIX: Validate qty ไม่ให้ติดลบหรือเกิน remainQty
  const updateSelectedQty = (key, qty) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item._key !== key) return item;
        let n = toNumber(qty);
        if (n < 0) n = 0;
        if (item.remainQty !== null && n > item.remainQty) n = item.remainQty;
        return { ...item, qty: n };
      })
    );
  };

  // ✅ NEW: ถามยืนยันก่อนลบในรายการที่เลือก
  const removeSelectedItem = (key) => {
    const item = selectedItems.find((i) => i._key === key);
    const itemName = item?.itemName || "รายการนี้";
    openConfirmPopup(
      "ยืนยันการลบ",
      `ต้องการลบ "${itemName}" ออกจากรายการใช่หรือไม่?`,
      () => setSelectedItems((prev) => prev.filter((i) => i._key !== key))
    );
  };

  const totalQty = selectedItems.reduce((s, i) => s + toNumber(i.qty), 0);

  // ✅ NEW: Validation ก่อน save พร้อมแสดง banner
  const [validationErrors, setValidationErrors] = useState([]);

  const handleSave = async () => {
    const errors = [];
    if (!text(username)) errors.push("ไม่พบ username กรุณาเข้าสู่ระบบใหม่");
    if (!text(branch)) errors.push("ไม่พบข้อมูล branch กรุณาเข้าสู่ระบบใหม่");
    const valid = selectedItems.filter((i) => toNumber(i.qty) > 0);
    if (!valid.length) errors.push("กรุณาเลือกรายการและระบุจำนวนที่ต้องการเบิก");
    const zeroItems = selectedItems.filter((i) => toNumber(i.qty) === 0);
    if (zeroItems.length > 0)
      errors.push(`มี ${zeroItems.length} รายการที่ยังไม่ได้ระบุจำนวน`);

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    const payload = {
      username,
      branch,
      items: valid.map((item, i) => ({
        line_no: i + 1,
        product_id: item.code,
        product_name: item.itemName,
        unit: item.unit,
        qty_issue: item.qty,
        qty_on_hand: item.remainQty,
        remain_qty: item.remainQty === null ? null : item.remainQty - item.qty,
      })),
    };
    try {
      setSaving(true); setMessage("");
      const res = await fetch(SAVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw[0] : raw;
      const ok = data?.ok === true || data?.success === true || data?.status === "success";
      const msg = data?.message || (ok ? "บันทึกรายการเบิกเรียบร้อย" : "บันทึกไม่สำเร็จ");
      setMessage(msg);
      if (ok) {
        setSelectedItems([]);
        openPopup("success", "บันทึกสำเร็จ", msg);
        await handleLoad();
      } else {
        openPopup("error", "บันทึกไม่สำเร็จ", msg);
      }
    } catch {
      setMessage("บันทึกไม่สำเร็จ");
      openPopup("error", "บันทึกไม่สำเร็จ", "ไม่สามารถเชื่อมต่อระบบได้");
    } finally { setSaving(false); }
  };

  const renderPagination = () => {
    if (mode === "detail" || activeRows.length <= PAGE_SIZE) return null;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    return (
      <div className="pager">
        <button
          className={currentPage === 1 ? "pager-btn-disabled" : "pager-btn"}
          onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
          disabled={currentPage === 1}
        >← ก่อน</button>
        {pages.map((p) => (
          <button
            key={p}
            className={p === currentPage ? "pager-btn-active" : "pager-btn"}
            onClick={() => setCurrentPage(p)}
          >{p}</button>
        ))}
        <button
          className={currentPage === totalPages ? "pager-btn-disabled" : "pager-btn"}
          onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >ถัดไป →</button>
      </div>
    );
  };

  // ✅ NEW: Skeleton loading rows
  const renderSkeletonRows = (cols) =>
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={`skel-${i}`} className="skeleton-row">
        {Array.from({ length: cols }).map((_, j) => (
          <td key={j}>
            <div className="skeleton-cell" style={{ width: j === 0 ? "80%" : "60%", opacity: 1 - i * 0.15 }} />
          </td>
        ))}
      </tr>
    ));

  const popupIcon =
    popup.type === "success" ? "✅" :
    popup.type === "error" ? "❌" :
    popup.type === "confirm" ? "⚠️" : "ℹ️";

  return (
    <>
      <style>{css}</style>
      <div className="issue-page">
        <div className="issue-container">

          {/* HEADER */}
          <div className="issue-header">
            <div className="issue-header-badge">📦 ระบบจัดการวัสดุ</div>
            <div className="issue-title">หน้าเบิกวัสดุ</div>
            <div className="issue-subtitle">ระบบเบิกวัสดุสำนักงาน</div>
          </div>

          {/* ✅ NEW: แสดง user info / warn ถ้าไม่มี */}
          <div className="user-info-bar">
            <div className={`user-info-chip ${!username ? "warn" : ""}`}>
              👤 ผู้ใช้: {username ? <span>{username}</span> : <span>ไม่พบข้อมูล</span>}
            </div>
            <div className={`user-info-chip ${!branch ? "warn" : ""}`}>
              🏢 สาขา: {branch ? <span>{branch}</span> : <span>ไม่พบข้อมูล</span>}
            </div>
          </div>

          {/* TOOLBAR */}
          <div className="toolbar">
            <button className="btn btn-primary" onClick={handleLoad} disabled={loading}>
              <span className="btn-icon">📋</span>
              {loading ? "กำลังโหลด..." : "เบิกวัสดุ"}
            </button>
            <button className="btn btn-success" onClick={handleSearch} disabled={searching}>
              <span className="btn-icon">🔍</span>
              {searching ? "กำลังค้นหา..." : "ค้นหาประวัติ"}
            </button>
            <button className="btn btn-neutral" onClick={handleClear}>
              <span className="btn-icon">🗑</span>ล้างข้อมูล
            </button>
            {mode === "detail" && (
              <button className="btn btn-slate" onClick={handleBackToHistory}>
                <span className="btn-icon">←</span>กลับไปประวัติ
              </button>
            )}
          </div>

          {/* MATERIAL / HISTORY TABLE */}
          {mode !== "detail" && (
            <div className="card">
              <div className="card-title">
                <div className={`card-title-icon ${mode === "history" ? "indigo" : "blue"}`}>
                  {mode === "history" ? "📜" : "🗂"}
                </div>
                {mode === "history" ? "ประวัติการเบิกวัสดุ" : "รายการวัสดุทั้งหมด"}
              </div>
              <div className="divider" />

              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input
                  className="search-input"
                  type="text"
                  placeholder={
                    mode === "history"
                      ? "ค้นหาเลขที่ใบเบิก / วันที่ / ชื่อผู้เบิก / สาขา"
                      : "ค้นหาชื่อสินค้า หรือ รหัสสินค้า"
                  }
                  value={filterText}
                  onChange={(e) => { setFilterText(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <div className="table-wrap">
                {mode === "history" ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>เลขที่ใบเบิก</th>
                        <th>วันที่เบิก</th>
                        <th>ชื่อผู้เบิก</th>
                        <th>สาขา</th>
                        <th>จำนวน</th>
                        <th>เปิด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searching ? renderSkeletonRows(6) :
                        shownRows.length > 0 ? shownRows.map((row, i) => (
                          <tr key={`${row.issue_no}-${i}`}>
                            <td><span className="badge badge-blue">{row.issue_no || "-"}</span></td>
                            <td>{row.issue_date || "-"}</td>
                            <td>{row.requester_name || "-"}</td>
                            <td>{row.issue_branch || "-"}</td>
                            <td><span className="badge badge-green">{row.total_qty ?? 0}</span></td>
                            <td>
                              <button
                                className="tbl-btn tbl-btn-open"
                                onClick={() => handleOpenIssue(row)}
                                disabled={openingIssue}
                              >เปิดดู</button>
                            </td>
                          </tr>
                        )) : (
                          <tr className="empty-row">
                            <td colSpan={6}>
                              <div className="empty-state">
                                <div className="empty-state-icon">📭</div>
                                <div className="empty-state-text">ไม่พบข้อมูล</div>
                              </div>
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ชื่อสินค้า</th>
                        <th>หน่วย</th>
                        <th>คงเหลือ</th>
                        <th>เลือก</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? renderSkeletonRows(4) :
                        shownRows.length > 0 ? shownRows.map((item, i) => {
                          const code = getCode(item);
                          const itemName = getItemName(item);
                          const unit = getUnit(item);
                          const remainQty = getRemainQty(item);
                          const allow = canAddItem(item);
                          return (
                            <tr key={`${code || itemName}-${i}`}>
                              <td style={{ textAlign: "left" }}>{itemName}</td>
                              <td>{unit || "-"}</td>
                              <td>
                                {remainQty === null
                                  ? <span style={{ color: "#475569" }}>-</span>
                                  : remainQty > 0
                                    ? <span className="badge badge-green">{remainQty}</span>
                                    : <span className="badge badge-red">หมด</span>}
                              </td>
                              <td>
                                {allow
                                  ? <button className="plus-btn" onClick={() => addToSelected(item)}>+</button>
                                  : <div className="plus-btn-disabled">+</div>}
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr className="empty-row">
                            <td colSpan={4}>
                              <div className="empty-state">
                                <div className="empty-state-icon">📭</div>
                                <div className="empty-state-text">ไม่พบข้อมูล</div>
                              </div>
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

          {/* DETAIL VIEW */}
          {mode === "detail" && issueDetail && (
            <div className="card">
              <div className="card-title">
                <div className="card-title-icon indigo">📄</div>
                รายละเอียดใบเบิกวัสดุ
              </div>
              <div className="divider" />

              <div className="detail-grid">
                {[
                  { label: "เลขที่ใบเบิก", value: issueDetail.issue_no || "-" },
                  { label: "วันที่เบิก", value: issueDetail.issue_date || "-" },
                  { label: "ชื่อผู้เบิก", value: issueDetail.requester_name || "-" },
                  { label: "สาขาที่เบิก", value: issueDetail.issue_branch || "-" },
                  { label: "จำนวนที่เบิก", value: issueDetail.total_qty ?? 0 },
                  { label: "หมายเหตุ", value: issueDetail.note || "-" },
                ].map((d) => (
                  <div key={d.label} className="detail-tile">
                    <div className="detail-tile-label">{d.label}</div>
                    <div className="detail-tile-value">{d.value}</div>
                  </div>
                ))}
              </div>

              {/* ✅ NEW: Warning ถ้ามี isEditing ค้างอยู่ */}
              {issueDetail.items?.some((i) => i.isEditing) && (
                <div className="validation-banner">
                  ⚠️ มีรายการที่ยังแก้ไขค้างอยู่ กรุณากด ✔ บันทึก ในแต่ละแถวก่อนบันทึก
                </div>
              )}

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>รหัสสินค้า</th>
                      <th>ชื่อสินค้า</th>
                      <th>หน่วย</th>
                      <th>จำนวนเบิก</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueDetail.items?.length > 0
                      ? issueDetail.items.map((item, i) => (
                        <tr key={`${item.issue_item_id || item.product_id || "item"}-${i}`}>
                          <td>{item.line_no ?? i + 1}</td>
                          <td><span className="badge badge-blue">{item.product_id || "-"}</span></td>
                          <td style={{ textAlign: "left" }}>{item.product_name || "-"}</td>
                          <td>{item.unit || "-"}</td>
                          <td>
                            {item.isEditing ? (
                              <div>
                                <input
                                  className={`qty-input ${toNumber(item.qty_issue) === 0 ? "invalid" : ""}`}
                                  type="number"
                                  min="0"
                                  value={item.qty_issue}
                                  onChange={(e) => handleChangeDetailQty(i, e.target.value)}
                                />
                                {toNumber(item.qty_issue) === 0 && (
                                  <span className="qty-exceed-hint">จำนวนต้องมากกว่า 0</span>
                                )}
                              </div>
                            ) : (
                              <span className="badge badge-green">{item.qty_issue ?? 0}</span>
                            )}
                          </td>
                          <td>
                            <div className="action-cell">
                              {item.isEditing
                                ? <button className="tbl-btn tbl-btn-save" onClick={() => handleSaveDetailItem(i)}>✔ บันทึก</button>
                                : <button className="tbl-btn tbl-btn-edit" onClick={() => handleEditDetailItem(i)}>✏ แก้ไข</button>}
                              <button className="tbl-btn tbl-btn-del" onClick={() => handleDeleteDetailItem(i)}>🗑 ลบ</button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr className="empty-row">
                          <td colSpan={6}>
                            <div className="empty-state">
                              <div className="empty-state-icon">📭</div>
                              <div className="empty-state-text">ไม่พบรายละเอียดรายการสินค้า</div>
                            </div>
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>

              <button
                className="save-btn-big"
                onClick={handleUpdateIssue}
                disabled={updatingIssue}
              >
                {updatingIssue ? "⏳ กำลังบันทึก..." : "💾 บันทึกรายการเบิก"}
              </button>
            </div>
          )}

          {/* SELECTED ITEMS */}
          {mode === "issue" && (
            <div className="card">
              <div className="card-title">
                <div className="card-title-icon green">🛒</div>
                รายการที่เลือก
              </div>
              <div className="divider" />

              <div className="summary-strip">
                <div className="summary-tile">
                  <div className="summary-tile-label">จำนวนรายการ</div>
                  <div className="summary-tile-value">{selectedItems.length}</div>
                </div>
                <div className="summary-tile">
                  <div className="summary-tile-label">จำนวนเบิกรวม</div>
                  <div className="summary-tile-value">{totalQty}</div>
                </div>
              </div>

              {/* ✅ NEW: แสดง validation errors */}
              {validationErrors.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {validationErrors.map((err, i) => (
                    <div key={i} className="validation-banner">⚠️ {err}</div>
                  ))}
                </div>
              )}

              {selectedItems.length === 0 ? (
                <div className="empty-state" style={{ padding: "32px 20px" }}>
                  <div className="empty-state-icon">🛒</div>
                  <div className="empty-state-text">ยังไม่มีรายการที่เลือก</div>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ชื่อสินค้า</th>
                        <th>หน่วย</th>
                        <th>คงเหลือ</th>
                        <th>จำนวนเบิก</th>
                        <th>ลบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item) => {
                        const qty = toNumber(item.qty);
                        const exceedsStock = item.remainQty !== null && qty > item.remainQty;
                        return (
                          <tr key={item._key}>
                            <td style={{ textAlign: "left" }}>{item.itemName}</td>
                            <td>{item.unit || "-"}</td>
                            <td>{item.remainQty === null ? "-" : item.remainQty}</td>
                            <td>
                              <input
                                className={`qty-input ${qty === 0 || exceedsStock ? "invalid" : ""}`}
                                type="number"
                                min="0"
                                max={item.remainQty === null ? undefined : item.remainQty}
                                value={item.qty}
                                onChange={(e) => {
                                  updateSelectedQty(item._key, e.target.value);
                                  setValidationErrors([]);
                                }}
                              />
                              {/* ✅ NEW: hint เมื่อ qty ไม่ถูกต้อง */}
                              {qty === 0 && (
                                <span className="qty-exceed-hint">ระบุจำนวน</span>
                              )}
                              {exceedsStock && (
                                <span className="qty-exceed-hint">เกินจำนวนคงเหลือ</span>
                              )}
                            </td>
                            <td>
                              <button
                                className="tbl-btn tbl-btn-del"
                                onClick={() => removeSelectedItem(item._key)}
                              >🗑 ลบ</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                className="save-btn-big"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "⏳ กำลังบันทึก..." : "💾 บันทึกรายการเบิก"}
              </button>
            </div>
          )}

          {!!message && <div className="status-msg">💬 {message}</div>}

        </div>
      </div>

      {/* POPUP */}
      {popup.open && (
        <div className="popup-overlay" onClick={closePopup}>
          <div className="popup-box" onClick={(e) => e.stopPropagation()}>
            <div className={`popup-header popup-header-${popup.type}`}>
              {popup.type === "success" ? "✅ บันทึกสำเร็จ"
                : popup.type === "error" ? "❌ เกิดข้อผิดพลาด"
                : popup.type === "confirm" ? "⚠️ ยืนยันการดำเนินการ"
                : "ℹ️ แจ้งเตือน"}
            </div>
            <div className="popup-body">
              <div className="popup-icon">{popupIcon}</div>
              <div className="popup-title">{popup.title}</div>
              <div className="popup-msg">{popup.message}</div>
            </div>
            <div className="popup-footer">
              {popup.type === "confirm" ? (
                <>
                  <button className="popup-btn popup-btn-cancel" onClick={closePopup}>ยกเลิก</button>
                  <button className="popup-btn popup-btn-confirm" onClick={handlePopupConfirm}>ยืนยัน</button>
                </>
              ) : (
                <button className={`popup-btn popup-btn-${popup.type}`} onClick={closePopup}>ตกลง</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
