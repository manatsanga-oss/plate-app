import React, { useState } from "react";

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        "https://n8n-new-project-gwf2.onrender.com/webhook/office-login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "login", ...form }),
        }
      );

      const data = await res.json();

      if (data.success && data.user_id) {
        const user = data.user || data;
        // ไม่เก็บ user ใน localStorage — บังคับ login ใหม่ทุกครั้งที่เข้า page
        onLogin(user);
      } else {
        setMessage(data.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }
    } catch (error) {
      setMessage("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>เข้าสู่ระบบ</h2>

        {message && <div className="form-message error">{message}</div>}

        <form onSubmit={handleSubmit} method="post" action="#" autoComplete="off">
          {/* dummy fields กัน Chrome autofill — Chrome จะ fill ใส่ field แรกที่เจอ */}
          <input type="text" name="fakeusernameremembered" style={{ display: "none" }} autoComplete="off" />
          <input type="password" name="fakepasswordremembered" style={{ display: "none" }} autoComplete="off" />

          <input
            name="username"
            type="text"
            autoComplete="off"
            readOnly
            onFocus={(e) => e.target.removeAttribute("readonly")}
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            required
          />

          <input
            name="password"
            type="password"
            autoComplete="new-password"
            readOnly
            onFocus={(e) => e.target.removeAttribute("readonly")}
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}