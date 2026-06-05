import React, { useState, useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID, googleConfigured } from "../googleConfig";

const LOGIN_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/office-login";

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const googleBtnRef = useRef(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", ...form }),
      });
      const data = await res.json();
      if (data.success && data.user_id) {
        onLogin(data.user || data);
      } else {
        setMessage(data.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }
    } catch {
      setMessage("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  async function handleGoogleCredential(resp) {
    if (!resp || !resp.credential) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "google_login", id_token: resp.credential }),
      });
      const data = await res.json();
      if (data.success && data.user_id) {
        onLogin(data.user || data);
      } else {
        setMessage(data.message || "เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
      }
    } catch {
      setMessage("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  // โหลด Google Identity Services + render ปุ่ม (poll รอจนพร้อม กัน React StrictMode double-mount)
  useEffect(() => {
    if (!googleConfigured) return;

    // เพิ่มสคริปต์ GIS ครั้งเดียว
    if (!document.getElementById("google-gsi-script")) {
      const s = document.createElement("script");
      s.id = "google-gsi-script";
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
    }

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const gid = window.google?.accounts?.id;
      if (gid && googleBtnRef.current) {
        try {
          gid.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
          googleBtnRef.current.innerHTML = "";
          gid.renderButton(googleBtnRef.current, {
            theme: "outline",
            size: "large",
            width: 320,
            text: "continue_with",
            logo_alignment: "center",
          });
        } catch (e) {
          console.error("Google button render failed:", e);
        }
        clearInterval(timer);
      } else if (tries > 50) {
        clearInterval(timer); // ~10s แล้วยอมแพ้
      }
    }, 200);

    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 380 }}>
        <h2 style={{ color: "#1f9ad6", fontSize: 22 }}>ล็อกอินเข้าสู่ระบบ</h2>

        {message && <div className="form-message error">{message}</div>}

        <form onSubmit={handleSubmit} method="post" action="#" autoComplete="off">
          <input type="text" name="fakeusernameremembered" style={{ display: "none" }} autoComplete="off" />
          <input type="password" name="fakepasswordremembered" style={{ display: "none" }} autoComplete="off" />

          <label style={lblStyle}>ชื่อผู้ใช้</label>
          <input
            name="username"
            type="text"
            autoComplete="off"
            readOnly
            onFocus={(e) => e.target.removeAttribute("readonly")}
            placeholder="ชื่อผู้ใช้"
            value={form.username}
            onChange={handleChange}
            required
          />

          <label style={lblStyle}>รหัสผ่าน</label>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            readOnly
            onFocus={(e) => e.target.removeAttribute("readonly")}
            placeholder="กรอกรหัสผ่าน"
            value={form.password}
            onChange={handleChange}
            required
          />

          <button type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        {/* ── ตัวคั่น ── */}
        <div style={dividerWrap}>
          <span style={dividerLine} />
          <span style={{ color: "#9ca3af", fontSize: 13 }}>หรือ</span>
          <span style={dividerLine} />
        </div>

        {/* ── เข้าสู่ระบบด้วยโซเชียล ── */}
        {googleConfigured ? (
          <div style={{ display: "flex", justifyContent: "center" }} ref={googleBtnRef} />
        ) : (
          <button type="button" disabled style={{ ...socialBtn, opacity: 0.6, cursor: "not-allowed" }}>
            <GoogleIcon /> เข้าสู่ระบบด้วย Google (ยังไม่ตั้งค่า Client ID)
          </button>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" disabled style={{ ...socialBtnSm, opacity: 0.55, cursor: "not-allowed" }}>Facebook</button>
          <button type="button" disabled style={{ ...socialBtnSm, opacity: 0.55, cursor: "not-allowed" }}>Apple</button>
        </div>
        <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 11, marginTop: 8 }}>
          Facebook / Apple — เร็วๆ นี้
        </div>
      </div>
    </div>
  );
}

const lblStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 };
const dividerWrap = { display: "flex", alignItems: "center", gap: 10, margin: "16px 0" };
const dividerLine = { flex: 1, height: 1, background: "#e5e7eb" };
const socialBtn = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff",
  color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const socialBtnSm = {
  flex: 1, padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8,
  background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.3C29.6 34.8 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.5 5.3C41.9 35.6 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
