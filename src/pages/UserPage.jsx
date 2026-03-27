import React, { useState } from "react";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Sarabun', sans-serif;
    background: #0f1117;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .page-wrap {
    width: 100%;
    max-width: 480px;
  }

  .card {
    background: #181c27;
    border: 1px solid #2a2f3e;
    border-radius: 16px;
    padding: 36px 32px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
    position: relative;
    overflow: hidden;
  }

  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4);
  }

  .card-header {
    margin-bottom: 28px;
  }

  .card-header h2 {
    font-size: 1.4rem;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.02em;
  }

  .card-header p {
    font-size: 0.85rem;
    color: #64748b;
    margin-top: 4px;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .field label .required {
    color: #f87171;
    margin-left: 3px;
  }

  .field input,
  .field select {
    background: #0f1117;
    border: 1.5px solid #2a2f3e;
    border-radius: 10px;
    padding: 11px 14px;
    color: #f1f5f9;
    font-family: 'Sarabun', sans-serif;
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    width: 100%;
    appearance: none;
    -webkit-appearance: none;
  }

  .field input::placeholder { color: #3f4a5e; }

  .field input:focus,
  .field select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
  }

  .field.has-error input,
  .field.has-error select {
    border-color: #f87171;
    box-shadow: 0 0 0 3px rgba(248,113,113,0.1);
  }

  .field-error {
    font-size: 0.78rem;
    color: #f87171;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .field-error::before { content: '⚠'; }

  .select-wrap {
    position: relative;
  }

  .select-wrap::after {
    content: '▾';
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #64748b;
    font-size: 0.8rem;
    pointer-events: none;
  }

  .field select option { background: #181c27; }

  .row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .divider {
    border: none;
    border-top: 1px solid #2a2f3e;
    margin: 4px 0;
  }

  .alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 500;
    animation: fadeSlide 0.25s ease;
  }

  .alert.success {
    background: rgba(16,185,129,0.1);
    border: 1px solid rgba(16,185,129,0.3);
    color: #6ee7b7;
  }

  .alert.error {
    background: rgba(248,113,113,0.1);
    border: 1px solid rgba(248,113,113,0.3);
    color: #fca5a5;
  }

  .alert-icon { font-size: 1rem; flex-shrink: 0; }

  .btn-submit {
    width: 100%;
    padding: 13px;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-family: 'Sarabun', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 20px rgba(59,130,246,0.3);
    margin-top: 4px;
  }

  .btn-submit:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(59,130,246,0.4);
  }

  .btn-submit:active:not(:disabled) { transform: translateY(0); }

  .btn-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .password-wrap { position: relative; }

  .password-wrap input { padding-right: 44px; }

  .toggle-pw {
    position: absolute;
    right: 12px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none;
    color: #64748b; cursor: pointer;
    font-size: 1rem; padding: 4px;
    transition: color 0.2s;
  }

  .toggle-pw:hover { color: #94a3b8; }

  .pw-strength {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }

  .pw-bar {
    height: 3px;
    border-radius: 2px;
    flex: 1;
    background: #2a2f3e;
    transition: background 0.3s;
  }

  .pw-bar.weak   { background: #f87171; }
  .pw-bar.medium { background: #fbbf24; }
  .pw-bar.strong { background: #34d399; }

  .pw-label {
    font-size: 0.72rem;
    color: #64748b;
    margin-top: 4px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

const BRANCHES = [
  "SCY01 สำนักงานใหญ่",
  "SCY04 สิงห์ชัย สี่ขวา",
  "SCY04 สิงห์ชัย ตลาด",
  "SCY05 ป.เปา นครหลวง",
  "SCY06 ป.เปา วังน้อย",
];

function getPasswordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) || /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "กรุณากรอกชื่อ";
  if (!form.username.trim()) {
    errors.username = "กรุณากรอก Username";
  } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) {
    errors.username = "Username: ตัวอักษร a-z, 0-9, _ (3-20 ตัว)";
  }
  if (!form.password) {
    errors.password = "กรุณากรอก Password";
  } else if (form.password.length < 6) {
    errors.password = "Password ต้องมีอย่างน้อย 6 ตัวอักษร";
  }
  if (!form.branch) errors.branch = "กรุณาเลือกสาขา";
  return errors;
}

export default function UserPage() {
  const [form, setForm] = useState({
    name: "", username: "", password: "",
    role: "user", branch: "", status: "active",
  });
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState("");
  const [msgType, setMsgType]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [touched, setTouched]   = useState({});

  const pwStrength = getPasswordStrength(form.password);
  const strengthLabels = ["", "อ่อน", "พอใช้", "ดี", "แข็งแกร่ง"];
  const strengthClass  = ["", "weak", "medium", "strong", "strong"];

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);
    if (touched[name]) {
      const newErrs = validate(updated);
      setErrors(prev => ({ ...prev, [name]: newErrs[name] }));
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const newErrs = validate(form);
    setErrors(prev => ({ ...prev, [name]: newErrs[name] }));
  };

  const handleSubmit = async () => {
    if (loading) return;
    const allTouched = { name:true, username:true, password:true, branch:true };
    setTouched(allTouched);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setMessage("");
    setMsgType("");

    try {
      const res = await fetch(
        "https://n8n-new-project-gwf2.onrender.com/webhook/9c69cda0-c124-48c5-8e32-e24d72a7577e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        setMessage("✓ บันทึกผู้ใช้สำเร็จ");
        setMsgType("success");
        setForm({ name:"", username:"", password:"", role:"user", branch:"", status:"active" });
        setTouched({});
        setErrors({});
      } else {
        setMessage(data.message || "Username นี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น");
        setMsgType("error");
      }
    } catch {
      setMessage("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="page-wrap">
        <div className="card">
          <div className="card-header">
            <h2>👤 กำหนดผู้ใช้งาน</h2>
            <p>เพิ่มบัญชีผู้ใช้ใหม่เข้าสู่ระบบ</p>
          </div>

          {message && (
            <div className={`alert ${msgType}`} style={{ marginBottom: 20 }}>
              <span className="alert-icon">{msgType === "success" ? "✓" : "✕"}</span>
              <span>{message}</span>
            </div>
          )}

          <div className="form-grid">
            {/* ชื่อ */}
            <div className={`field ${errors.name ? "has-error" : ""}`}>
              <label>ชื่อ-นามสกุล <span className="required">*</span></label>
              <input
                name="name"
                placeholder="ชื่อจริง นามสกุล"
                value={form.name}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            {/* Username */}
            <div className={`field ${errors.username ? "has-error" : ""}`}>
              <label>Username <span className="required">*</span></label>
              <input
                name="username"
                placeholder="เช่น john_doe"
                value={form.username}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="off"
              />
              {errors.username && <span className="field-error">{errors.username}</span>}
            </div>

            {/* Password */}
            <div className={`field ${errors.password ? "has-error" : ""}`}>
              <label>Password <span className="required">*</span></label>
              <div className="password-wrap">
                <input
                  name="password"
                  type={showPw ? "text" : "password"}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={form.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="new-password"
                />
                <button
                  className="toggle-pw"
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
              {form.password && (
                <>
                  <div className="pw-strength">
                    {[1,2,3,4].map(i => (
                      <div
                        key={i}
                        className={`pw-bar ${i <= pwStrength ? strengthClass[pwStrength] : ""}`}
                      />
                    ))}
                  </div>
                  <div className="pw-label">
                    ความแข็งแกร่ง: {strengthLabels[pwStrength]}
                  </div>
                </>
              )}
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <hr className="divider" />

            {/* สาขา */}
            <div className={`field ${errors.branch ? "has-error" : ""}`}>
              <label>สาขา <span className="required">*</span></label>
              <div className="select-wrap">
                <select name="branch" value={form.branch} onChange={handleChange} onBlur={handleBlur}>
                  <option value="">— เลือกสาขา —</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {errors.branch && <span className="field-error">{errors.branch}</span>}
            </div>

            {/* Role + Status */}
            <div className="row-2">
              <div className="field">
                <label>สิทธิ์การใช้งาน</label>
                <div className="select-wrap">
                  <select name="role" value={form.role} onChange={handleChange}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>สถานะ</label>
                <div className="select-wrap">
                  <select name="status" value={form.status} onChange={handleChange}>
                    <option value="active">ใช้งาน</option>
                    <option value="inactive">ปิดใช้งาน</option>
                  </select>
                </div>
              </div>
            </div>

            <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <><div className="spinner" /> กำลังบันทึก...</>
              ) : (
                <>💾 บันทึกผู้ใช้งาน</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
