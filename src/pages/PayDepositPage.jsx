import React, { useEffect, useState, useMemo } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/grouplease-api";

const BRANCHES = [
  { code: "", name: "ทุกสาขา" },
  { code: "SCY01", name: "SCY01 สำนักงานใหญ่" },
  { code: "SCY04", name: "SCY04 สิงห์ชัยตลาดสีขวา" },
  { code: "SCY05", name: "SCY05 ป.เปานครหลวง" },
  { code: "SCY06", name: "SCY06 ป.เปาวังน้อย" },
  { code: "SCY07", name: "SCY07 สิงห์ชัยตลาด" },
];

// ดึงเลขที่สัญญาอัตโนมัติจาก description (หาเลข 8-14 หลักในข้อความ)
function extractContract(desc) {
  if (!desc) return "";
  const m = desc.match(/\b(\d{8,14})\b/);
  return m ? m[1] : "";
}

function fmt(n) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PayDepositPage({ currentUser }) {
  const [tab, setTab] = useState("pending");

  // ---- Tab Pending ----
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const [dateFrom, setDateFrom] = useState(`${ym}-01`);
  const [dateTo, setDateTo] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  const [branchFilter, setBranchFilter] = useState("");
  const [selected, setSelected] = useState({}); // { item_id: { contract_no, paid_amount } }

  // ---- Transfer modal ----
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    transaction_id: "",
    from_bank: "กสิกรไทย",
    from_account: "",
    to_account: "xxx-x-x1907-x",
    fee: 0,
    note: "",
    slip_image: "",
    slip_mime: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // ---- Tab History ----
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [historyFrom, setHistoryFrom] = useState(`${now.getFullYear()}-01-01`);
  const [historyTo, setHistoryTo] = useState(`${now.getFullYear()}-12-31`);
  const [detailPayment, setDetailPayment] = useState(null);

  // ---- Tab Report ----
  const [report, setReport] = useState([]);
  const [reportYear, setReportYear] = useState(String(now.getFullYear()));

  useEffect(() => {
    if (tab === "pending") fetchPending();
    if (tab === "history") fetchPayments();
    if (tab === "report") fetchReport();
  }, [tab]);

  async function fetchPending() {
    setPendingLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_pending_grouplease",
          date_from: dateFrom, date_to: dateTo, branch_code: branchFilter, include_paid: "false",
        }),
      });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : (data?.rows || data?.data || []);
      setPendingItems(rows);
      // reset selection, pre-fill contract_no from description
      const s = {};
      rows.forEach(r => {
        s[r.item_id] = {
          contract_no: extractContract(r.description),
          paid_amount: Number(r.line_amount) || 0,
          checked: false,
        };
      });
      setSelected(s);
    } catch (e) {
      setPendingItems([]);
    }
    setPendingLoading(false);
  }

  async function fetchPayments() {
    setPaymentsLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_glp_payments", date_from: historyFrom, date_to: historyTo }),
      });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : (data?.rows || data?.data || []);
      setPayments(rows);
    } catch { setPayments([]); }
    setPaymentsLoading(false);
  }

  async function fetchReport() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_glp_report", year: reportYear }),
      });
      const data = await res.json();
      setReport(Array.isArray(data) ? data : []);
    } catch { setReport([]); }
  }

  const selectedList = useMemo(() =>
    pendingItems.filter(r => selected[r.item_id]?.checked),
    [pendingItems, selected]
  );
  const totalSelected = selectedList.reduce(
    (sum, r) => sum + (Number(selected[r.item_id]?.paid_amount) || 0), 0
  );

  function toggleAll(check) {
    const s = { ...selected };
    pendingItems.forEach(r => { s[r.item_id] = { ...s[r.item_id], checked: !!check }; });
    setSelected(s);
  }

  function updateSelected(itemId, field, value) {
    setSelected({ ...selected, [itemId]: { ...selected[itemId], [field]: value } });
  }

  async function handleSlipUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("ไฟล์ใหญ่เกิน 5MB"); return; }
    const b64 = await new Promise(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(",")[1]);
      r.readAsDataURL(file);
    });
    setTransferForm({ ...transferForm, slip_image: b64, slip_mime: file.type });
  }

  function openTransfer() {
    if (selectedList.length === 0) { alert("เลือกรายการก่อน"); return; }
    // validate contract_no
    const missing = selectedList.filter(r => !(selected[r.item_id]?.contract_no || "").trim());
    if (missing.length > 0) { alert(`มี ${missing.length} รายการยังไม่ได้กรอกเลขที่สัญญา`); return; }
    setTransferForm({
      ...transferForm,
      payment_date: new Date().toISOString().slice(0, 10),
    });
    setShowTransfer(true);
  }

  async function submitTransfer() {
    if (!transferForm.payment_date) { alert("กรอกวันที่โอน"); return; }
    setSaving(true);
    setMessage("");
    try {
      const items = selectedList.map(r => ({
        source_item_id: r.item_id,
        source_receipt_no: r.receipt_no,
        contract_no: selected[r.item_id]?.contract_no || "",
        received_date: r.received_date ? r.received_date.slice(0, 10) : null,
        received_amount: Number(r.line_amount) || 0,
        paid_amount: Number(selected[r.item_id]?.paid_amount) || 0,
        customer_name: r.customer_name || "",
        branch_code: r.branch_code || "",
        remark: "",
      }));
      const body = {
        action: "save_glp_payment",
        ...transferForm,
        transfer_amount: totalSelected,
        status: "transferred",
        created_by: currentUser?.name || "",
        items,
      };
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data?.payment_no || data?.id) {
        setMessage(`✅ บันทึกแล้ว ${data.payment_no || ""}`);
        setShowTransfer(false);
        setTransferForm({ ...transferForm, transaction_id: "", slip_image: "", slip_mime: "", note: "" });
        // สร้าง payment object สำหรับพิมพ์ทันที (ไม่ต้องรอ fetch)
        const printObj = {
          payment_no: data.payment_no,
          payment_date: body.payment_date,
          items: body.items,
        };
        if (window.confirm("บันทึกสำเร็จ — ต้องการพิมพ์ใบโอนหรือไม่?")) {
          printPayment(printObj);
        }
        fetchPending();
      } else {
        setMessage("❌ บันทึกไม่สำเร็จ");
      }
    } catch (e) {
      setMessage("❌ " + e.message);
    }
    setSaving(false);
  }

  function printPayment(payment) {
    const items = Array.isArray(payment.items) ? payment.items : [];
    if (items.length === 0) { alert("ไม่มีรายการในใบโอนนี้"); return; }

    const MIN_ROWS = 25; // จำนวนแถวขั้นต่ำในตาราง (เพื่อให้เส้นตารางดูเต็มหน้า)
    const thMonths = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    const d = payment.payment_date ? new Date(payment.payment_date) : new Date();
    const thDate = `${d.getDate()} ${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`;

    const shopName = "ป.เปา มอเตอร์เซอร์วิส";

    const rows = items.map((i, idx) => `<tr>
      <td class="c">${idx + 1}</td>
      <td>${i.contract_no || ""}</td>
      <td>${i.customer_name || ""}</td>
      <td class="r">${fmt(i.paid_amount)}</td>
      <td>${i.remark || ""}</td>
    </tr>`).join("");

    let empty = "";
    for (let i = items.length; i < MIN_ROWS; i++) {
      empty += `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`;
    }

    const total = items.reduce((s, i) => s + (Number(i.paid_amount) || 0), 0);

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ใบชำระค่างวดกรุ๊ปลีส ${payment.payment_no || ""}</title>
      <style>
        body { font-family: "Sarabun", "Tahoma", sans-serif; padding: 20px; font-size: 14px; }
        .head { margin-bottom: 12px; line-height: 1.5; }
        .head b { font-size: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 4px 8px; font-size: 13px; }
        th { background: #f3f4f6; font-weight: bold; text-align: center; }
        td.c { text-align: center; }
        td.r { text-align: right; }
        tfoot td { font-weight: bold; background: #fef08a; }
        @media print { body { padding: 10px; } button { display: none; } }
      </style>
    </head><body>
      <div class="head">
        <div><b>บริษัท กรุ๊ปลีส จำกัด (มหาชน)</b></div>
        <div>ติดต่อเบอร์ Fax 0-2580-9278 โทร. 0-2580-7555 ต่อ 4405</div>
        <div>ธนาคารกสิกรไทย เลขที่บัญชี 7371019078 สาขาประชานิเวศน์ กระแสรายวัน</div>
        <div>ธนาคารไทยพาณิชย์ เลขที่บัญชี 0852062096 สาขาประชานิเวศน์ 1 ออมทรัพย์</div>
        <div>ธนาคารกรุงเทพ เลขที่บัญชี 1930380306 สาขาถนนประชาชื่น ออมทรัพย์</div>
        <div style="margin-top:6px">วันที่ &nbsp;&nbsp; ${thDate}</div>
        <div>ร้าน &nbsp;&nbsp;&nbsp;&nbsp; ${shopName}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:50px">ลำดับ</th>
            <th style="width:180px">เลขที่สัญญา</th>
            <th>ชื่อ-สกุล</th>
            <th style="width:130px">จำนวนเงิน</th>
            <th style="width:150px">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>${rows}${empty}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="r">รวมเงินทั้งหมด</td>
            <td class="r">${fmt(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <button onclick="window.print()" style="margin-top:20px;padding:10px 20px;background:#1e40af;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ พิมพ์</button>
    </body></html>`;

    const w = window.open("", "_blank", "width=900,height=800");
    w.document.write(html);
    w.document.close();
  }

  // พิมพ์จากรายการที่เลือก (ยังไม่บันทึก)
  function printSelected() {
    if (selectedList.length === 0) { alert("เลือกรายการก่อน"); return; }
    const items = selectedList.map(r => ({
      contract_no: selected[r.item_id]?.contract_no || "",
      customer_name: r.customer_name || "",
      paid_amount: Number(selected[r.item_id]?.paid_amount) || 0,
      remark: "",
    }));
    printPayment({
      payment_no: "",
      payment_date: new Date().toISOString().slice(0, 10),
      items,
    });
  }

  async function deletePayment(id) {
    if (!window.confirm("ลบรายการนี้?")) return;
    await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_glp_payment", id }),
    });
    fetchPayments();
  }

  // ====== RENDER ======
  return (
    <div className="pay-deposit" style={{ padding: 20 }}>
      <h2>ชำระเงินรับฝาก — ค่างวดกรุ๊ปลีส</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid #ccc" }}>
        {[
          ["pending", "📥 รับฝากค้างโอน"],
          ["history", "📋 ประวัติการโอน"],
          ["report", "📊 รายงาน"],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding: "8px 16px", border: "none", cursor: "pointer",
              background: tab === k ? "#1e40af" : "#e5e7eb",
              color: tab === k ? "#fff" : "#111",
              borderRadius: "4px 4px 0 0", fontWeight: "bold",
            }}>{label}</button>
        ))}
      </div>

      {message && (
        <div style={{ padding: 10, marginBottom: 10, background: "#dbeafe", borderRadius: 4 }}>{message}</div>
      )}

      {/* ============ TAB 1: PENDING ============ */}
      {tab === "pending" && (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <label>วันที่: </label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span>ถึง</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              {BRANCHES.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
            <button onClick={fetchPending} style={btnPrimary}>🔍 ค้นหา</button>
            <div style={{ flex: 1 }}></div>
            <div style={{ fontWeight: "bold" }}>
              เลือก: {selectedList.length} รายการ | รวม: {fmt(totalSelected)} บาท
            </div>
            <button onClick={printSelected} style={btnPrint} disabled={selectedList.length === 0}>🖨️ พิมพ์รายการ</button>
            <button onClick={openTransfer} style={btnSuccess} disabled={selectedList.length === 0}>💰 สร้างใบโอน</button>
          </div>

          {pendingLoading ? <p>กำลังโหลด...</p> : pendingItems.length === 0 ? (
            <p style={{ color: "#666" }}>ไม่มีรายการค้างโอน</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#1e40af", color: "#fff" }}>
                    <th><input type="checkbox" onChange={e => toggleAll(e.target.checked)} /></th>
                    <th>วันที่รับ</th>
                    <th>เลขใบเสร็จ</th>
                    <th>สาขา</th>
                    <th>ลูกค้า</th>
                    <th>รายการ</th>
                    <th style={{ textAlign: "right" }}>ยอดรับ</th>
                    <th>เลขที่สัญญา *</th>
                    <th style={{ textAlign: "right" }}>ยอดโอนจริง *</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map(r => {
                    const s = selected[r.item_id] || {};
                    return (
                      <tr key={r.item_id} style={s.checked ? { background: "#fef3c7" } : {}}>
                        <td><input type="checkbox" checked={!!s.checked}
                          onChange={e => updateSelected(r.item_id, "checked", e.target.checked)} /></td>
                        <td>{r.received_date ? r.received_date.slice(0, 10) : "-"}</td>
                        <td>{r.receipt_no}</td>
                        <td>{r.branch_code}</td>
                        <td>{r.customer_name || "-"}</td>
                        <td style={{ maxWidth: 280 }}>{r.description}</td>
                        <td style={{ textAlign: "right" }}>{fmt(r.line_amount)}</td>
                        <td><input type="text" value={s.contract_no || ""}
                          onChange={e => updateSelected(r.item_id, "contract_no", e.target.value)}
                          style={{ width: 140 }} /></td>
                        <td><input type="number" step="0.01" value={s.paid_amount || 0}
                          onChange={e => updateSelected(r.item_id, "paid_amount", e.target.value)}
                          style={{ width: 110, textAlign: "right" }} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ TAB 2: HISTORY ============ */}
      {tab === "history" && (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <label>วันที่โอน: </label>
            <input type="date" value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} />
            <span>ถึง</span>
            <input type="date" value={historyTo} onChange={e => setHistoryTo(e.target.value)} />
            <button onClick={fetchPayments} style={btnPrimary}>🔍 ค้นหา</button>
          </div>
          {paymentsLoading ? <p>กำลังโหลด...</p> : payments.length === 0 ? (
            <p style={{ color: "#666" }}>ไม่มีประวัติการโอน</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: "#1e40af", color: "#fff" }}>
                  <th>วันที่โอน</th>
                  <th>เลขใบ</th>
                  <th>Transaction ID</th>
                  <th style={{ textAlign: "right" }}>จำนวนสัญญา</th>
                  <th style={{ textAlign: "right" }}>ยอดรวม</th>
                  <th>Slip</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.payment_date ? p.payment_date.slice(0, 10) : "-"}</td>
                    <td>{p.payment_no}</td>
                    <td style={{ fontFamily: "monospace" }}>{p.transaction_id || "-"}</td>
                    <td style={{ textAlign: "right" }}>{(p.items || []).length}</td>
                    <td style={{ textAlign: "right" }}>{fmt(p.transfer_amount)}</td>
                    <td>{p.slip_image ? "✅" : "-"}</td>
                    <td>
                      <button onClick={() => setDetailPayment(p)} style={btnSmall}>ดูรายละเอียด</button>
                      <button onClick={() => printPayment(p)} style={{ ...btnSmall, background: "#7c3aed", color: "#fff" }}>🖨️ พิมพ์</button>
                      <button onClick={() => deletePayment(p.id)} style={{ ...btnSmall, background: "#dc2626", color: "#fff" }}>ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ============ TAB 3: REPORT ============ */}
      {tab === "report" && (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <label>ปี: </label>
            <input type="text" value={reportYear} onChange={e => setReportYear(e.target.value)} style={{ width: 80 }} />
            <button onClick={fetchReport} style={btnPrimary}>🔍 ค้นหา</button>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "#1e40af", color: "#fff" }}>
                <th>เดือน</th>
                <th style={{ textAlign: "right" }}>จำนวนรับ</th>
                <th style={{ textAlign: "right" }}>ยอดรับ</th>
                <th style={{ textAlign: "right" }}>จำนวนโอน</th>
                <th style={{ textAlign: "right" }}>ยอดโอน</th>
                <th style={{ textAlign: "right" }}>ค้างโอน</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r, i) => (
                <tr key={i} style={Number(r.pending_amount) > 0 ? { background: "#fee2e2" } : {}}>
                  <td>{r.ym}</td>
                  <td style={{ textAlign: "right" }}>{r.received_count}</td>
                  <td style={{ textAlign: "right" }}>{fmt(r.received_amount)}</td>
                  <td style={{ textAlign: "right" }}>{r.paid_count}</td>
                  <td style={{ textAlign: "right" }}>{fmt(r.paid_amount)}</td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>{fmt(r.pending_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ TRANSFER MODAL ============ */}
      {showTransfer && (
        <Modal onClose={() => setShowTransfer(false)}>
          <h3>สร้างใบโอนค่างวดกรุ๊ปลีส</h3>
          <div style={{ background: "#f3f4f6", padding: 10, borderRadius: 4, marginBottom: 10 }}>
            <div>รายการที่เลือก: <b>{selectedList.length}</b> รายการ</div>
            <div>ยอดรวม: <b style={{ color: "#dc2626", fontSize: 20 }}>{fmt(totalSelected)}</b> บาท</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>วันที่โอน *<br />
              <input type="date" value={transferForm.payment_date}
                onChange={e => setTransferForm({ ...transferForm, payment_date: e.target.value })}
                style={inputStyle} />
            </label>
            <label>Transaction ID<br />
              <input type="text" value={transferForm.transaction_id}
                placeholder="TRBS260420562992257"
                onChange={e => setTransferForm({ ...transferForm, transaction_id: e.target.value })}
                style={inputStyle} />
            </label>
            <label>ธนาคารผู้โอน<br />
              <input type="text" value={transferForm.from_bank}
                onChange={e => setTransferForm({ ...transferForm, from_bank: e.target.value })}
                style={inputStyle} />
            </label>
            <label>บัญชีผู้โอน<br />
              <input type="text" value={transferForm.from_account}
                placeholder="xxx-x-x0376-x"
                onChange={e => setTransferForm({ ...transferForm, from_account: e.target.value })}
                style={inputStyle} />
            </label>
            <label>บัญชีปลายทาง<br />
              <input type="text" value={transferForm.to_account}
                onChange={e => setTransferForm({ ...transferForm, to_account: e.target.value })}
                style={inputStyle} />
            </label>
            <label>ค่าธรรมเนียม<br />
              <input type="number" value={transferForm.fee}
                onChange={e => setTransferForm({ ...transferForm, fee: e.target.value })}
                style={inputStyle} />
            </label>
          </div>
          <label>หมายเหตุ<br />
            <textarea value={transferForm.note} onChange={e => setTransferForm({ ...transferForm, note: e.target.value })}
              style={{ ...inputStyle, minHeight: 40 }} />
          </label>
          <label>Slip โอน (image, ≤ 5MB)<br />
            <input type="file" accept="image/*" onChange={handleSlipUpload} />
            {transferForm.slip_image && <span> ✅ อัปโหลดแล้ว</span>}
          </label>
          <div style={{ marginTop: 15, textAlign: "right" }}>
            <button onClick={() => setShowTransfer(false)} style={{ ...btnSmall, marginRight: 8 }}>ยกเลิก</button>
            <button onClick={submitTransfer} disabled={saving} style={btnSuccess}>
              {saving ? "กำลังบันทึก..." : "✅ บันทึกการโอน"}
            </button>
          </div>
        </Modal>
      )}

      {/* ============ DETAIL MODAL ============ */}
      {detailPayment && (
        <Modal onClose={() => setDetailPayment(null)}>
          <h3>รายละเอียดใบโอน {detailPayment.payment_no}</h3>
          <div style={{ marginBottom: 10 }}>
            <div>วันที่โอน: <b>{detailPayment.payment_date?.slice(0, 10)}</b></div>
            <div>Transaction ID: <code>{detailPayment.transaction_id || "-"}</code></div>
            <div>ยอดรวม: <b>{fmt(detailPayment.transfer_amount)}</b> บาท</div>
            <div>ค่าธรรมเนียม: {fmt(detailPayment.fee)}</div>
            {detailPayment.note && <div>หมายเหตุ: {detailPayment.note}</div>}
          </div>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "#e5e7eb" }}>
                <th>เลขที่สัญญา</th>
                <th>ลูกค้า</th>
                <th>สาขา</th>
                <th>วันที่รับ</th>
                <th style={{ textAlign: "right" }}>ยอดรับ</th>
                <th style={{ textAlign: "right" }}>ยอดโอน</th>
              </tr>
            </thead>
            <tbody>
              {(detailPayment.items || []).map(i => (
                <tr key={i.item_id}>
                  <td>{i.contract_no}</td>
                  <td>{i.customer_name || "-"}</td>
                  <td>{i.branch_code}</td>
                  <td>{i.received_date?.slice(0, 10) || "-"}</td>
                  <td style={{ textAlign: "right" }}>{fmt(i.received_amount)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(i.paid_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {detailPayment.slip_image && (
            <div style={{ marginTop: 10 }}>
              <h4>Slip โอน</h4>
              <img src={`data:${detailPayment.slip_mime || "image/jpeg"};base64,${detailPayment.slip_image}`}
                style={{ maxWidth: "100%", maxHeight: 500, border: "1px solid #ccc" }} />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// --- Shared small components ---
function Modal({ children, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", padding: 20, borderRadius: 8, maxWidth: 900,
          width: "90%", maxHeight: "90vh", overflowY: "auto",
        }}>{children}</div>
    </div>
  );
}

const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const btnPrimary = { padding: "6px 14px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" };
const btnSuccess = { padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" };
const btnPrint = { padding: "8px 16px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" };
const btnSmall = { padding: "4px 10px", background: "#e5e7eb", border: "none", borderRadius: 4, cursor: "pointer", marginRight: 4, fontSize: 12 };
const inputStyle = { width: "100%", padding: 6, border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" };

// style th/td global — inline via CSS-in-JS? Use a small <style> block:
const _styleOnce = (() => {
  if (typeof document !== "undefined" && !document.getElementById("paydeposit-style")) {
    const st = document.createElement("style");
    st.id = "paydeposit-style";
    st.textContent = `
      .pay-deposit table th, .pay-deposit table td { padding: 6px 8px; border: 1px solid #ddd; }
    `;
    document.head.appendChild(st);
  }
})();
