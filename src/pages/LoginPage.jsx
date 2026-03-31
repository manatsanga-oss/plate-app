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

  const handleSubmit = async () => {
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
        localStorage.setItem("user", JSON.stringify(user));
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

        <input
          name="username"
          placeholder="Username"
          value={form.username}
          onChange={handleChange}
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
        />

        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </div>
    </div>
  );
}