import React, { useEffect, useState } from "react";
import { quoteApi, quoteDocHTML, recordToQuoteData } from "./quotePrint";

// หน้า public เปิดจากลิงก์ใน LINE — แสดงใบประเมินราคาเต็ม (/quote-view?no=...)
export default function QuoteViewPage() {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const no = new URLSearchParams(window.location.search).get("no");
    if (!no) { setError("ไม่พบเลขที่ใบประเมิน"); return; }
    quoteApi({ action: "get_quote", quote_no: no })
      .then((r) => {
        const rows = Array.isArray(r) ? r : r?.data || [];
        if (!rows.length) { setError("ไม่พบใบประเมิน " + no); return; }
        setHtml(quoteDocHTML(recordToQuoteData(rows[0])));
      })
      .catch((e) => setError("โหลดไม่สำเร็จ: " + (e.message || e)));
  }, []);

  if (error) return <div style={{ padding: 24, textAlign: "center", color: "#b91c1c", fontFamily: "Tahoma,sans-serif" }}>{error}</div>;
  if (html == null) return <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontFamily: "Tahoma,sans-serif" }}>กำลังโหลดใบประเมินราคา...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "8px 0" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
        <iframe title="ใบประเมินราคา" srcDoc={html} style={{ width: "100%", height: "1180px", border: "none" }} />
      </div>
      <div style={{ textAlign: "center", margin: "10px 0 20px" }}>
        <button onClick={() => { const w = window.open("", "_blank"); w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }}
          style={{ padding: "10px 24px", fontSize: 15, background: "#b21f7a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          🖨️ พิมพ์ / บันทึก PDF
        </button>
      </div>
    </div>
  );
}
