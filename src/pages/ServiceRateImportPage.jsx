import React, { useMemo, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/service-rate-api";

export default function ServiceRateImportPage() {
  const [file, setFile] = useState(null);
  const [sql, setSql] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    if (!sql) return null;
    const lines = sql.split("\n");
    const inserts = lines.filter((l) => /^\s*INSERT\s+INTO\s+service_flat_rates/i.test(l)).length;
    const deletes = lines.filter((l) => /^\s*DELETE\s+FROM\s+service_flat_rates/i.test(l)).length;
    const others = lines.filter((l) => {
      const t = l.trim();
      if (!t || t.startsWith("--")) return false;
      return !/^\s*(INSERT\s+INTO\s+service_flat_rates|DELETE\s+FROM\s+service_flat_rates)/i.test(t);
    });
    return { total: lines.length, inserts, deletes, others };
  }, [sql]);

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError("");
    const text = await f.text();
    setSql(text);
  }

  async function upload() {
    if (!sql) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_sql", sql }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.success) {
        setResult(data);
      } else {
        setError(data?.error || "นำเข้าไม่สำเร็จ");
      }
    } catch (e) {
      setError("ส่งข้อมูลไม่สำเร็จ: " + (e.message || e));
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setFile(null);
    setSql("");
    setResult(null);
    setError("");
  }

  const preview = sql.split("\n").slice(0, 8).join("\n");
  const blocked = stats && stats.others.length > 0;

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📤 นำเข้า Service Rate (FRT)</h2>
      </div>

      <div className="form-card">
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
          เลือกไฟล์ <code>.sql</code> ที่ได้จาก <code>tools/extract_service_frt.py</code> เพื่อนำเข้าข้อมูล FRT ของรุ่นใหม่
          <br />
          ระบบรับเฉพาะ <strong>INSERT INTO service_flat_rates</strong> และ <strong>DELETE FROM service_flat_rates</strong> เท่านั้น
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="file"
            accept=".sql,text/plain"
            onChange={handleFile}
            disabled={uploading}
          />
          {file && (
            <button className="btn-secondary" onClick={reset} disabled={uploading}>
              ล้าง
            </button>
          )}
        </div>

        {file && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <div><strong>ไฟล์:</strong> {file.name} ({Math.round(file.size / 1024)} KB)</div>
            {stats && (
              <div style={{ marginTop: 6 }}>
                <span style={{ marginRight: 14 }}>📝 บรรทัดรวม: <strong>{stats.total}</strong></span>
                <span style={{ marginRight: 14, color: "#059669" }}>➕ INSERT: <strong>{stats.inserts}</strong></span>
                <span style={{ marginRight: 14, color: "#dc2626" }}>🗑️ DELETE: <strong>{stats.deletes}</strong></span>
                {stats.others.length > 0 && (
                  <span style={{ color: "#dc2626" }}>⚠️ บรรทัดที่ไม่อนุญาต: <strong>{stats.others.length}</strong></span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {sql && (
        <div className="form-card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>ตัวอย่าง 8 บรรทัดแรก</div>
          <pre
            style={{
              background: "#0f172a",
              color: "#e2e8f0",
              padding: 12,
              borderRadius: 6,
              fontSize: 12,
              overflowX: "auto",
              maxHeight: 240,
            }}
          >
{preview}
          </pre>
        </div>
      )}

      {blocked && (
        <div className="form-card" style={{ color: "#b91c1c" }}>
          ⚠️ ไฟล์มีบรรทัดที่ไม่ใช่ INSERT/DELETE ของ <code>service_flat_rates</code> — ระบบจะปฏิเสธไฟล์นี้ ตรวจสอบเนื้อหาก่อน
          <ul style={{ marginTop: 8, fontSize: 12 }}>
            {stats.others.slice(0, 5).map((l, i) => (
              <li key={i}><code>{l.trim().substring(0, 100)}</code></li>
            ))}
          </ul>
        </div>
      )}

      {sql && !blocked && (
        <div className="form-card">
          <button
            className="btn-primary"
            onClick={upload}
            disabled={uploading || !sql}
            style={{ minWidth: 200 }}
          >
            {uploading ? "กำลังนำเข้า..." : "🚀 นำเข้าสู่ database"}
          </button>
          {uploading && (
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
              ⏳ กำลังประมวลผล อาจใช้เวลาหลายวินาทีถ้าไฟล์ใหญ่
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="form-card" style={{ color: "#b91c1c" }}>
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="form-card" style={{ background: "#f0fdf4", borderColor: "#86efac" }}>
          <div style={{ fontWeight: 600, color: "#15803d", marginBottom: 6 }}>
            ✅ นำเข้าสำเร็จ
          </div>
          <div style={{ fontSize: 14 }}>
            <div>➕ INSERT: <strong>{result.inserts}</strong> แถว</div>
            <div>🗑️ DELETE: <strong>{result.deletes}</strong> ครั้ง</div>
            <div>📦 จำนวน statements: <strong>{result.statements}</strong></div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
            ลองเข้าหน้า "ค้นหาค่าบริการ (FRT)" เพื่อตรวจสอบข้อมูล
          </div>
        </div>
      )}
    </div>
  );
}
