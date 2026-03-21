import React, { useState } from "react";

export default function UserPage() {
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "user",
    branch: "",
    status: "active",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (loading) return;

    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const res = await fetch(
        "https://n8n-new-project-gwf2.onrender.com/webhook/9c69cda0-c124-48c5-8e32-e24d72a7577e",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await res.json();

      if (data.success) {
        setMessage("บันทึกผู้ใช้สำเร็จ");
        setMessageType("success");

        setForm({
          name: "",
          username: "",
          password: "",
          role: "user",
          branch: "",
          status: "active",
        });
      } else {
        setMessage(data.message || "username ซ้ำ");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("เชื่อมต่อระบบไม่สำเร็จ");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>👤 กำหนดผู้ใช้งาน</h2>

      {message && (
        <div className={`form-message ${messageType}`}>
          {message}
        </div>
      )}

      <input name="name" placeholder="ชื่อ" value={form.name} onChange={handleChange} />
      <input name="username" placeholder="Username" value={form.username} onChange={handleChange} />
      <input name="password" placeholder="Password" value={form.password} onChange={handleChange} />

      <select name="branch" value={form.branch} onChange={handleChange}>
        <option value="">เลือกสาขา</option>
        <option>SCY01 สำนักงานใหญ่</option>
        <option>SCY04 สิงห์ชัย สี่ขวา</option>
        <option>SCY05 ป.เปา นครหลวง</option>
        <option>SCY06 ป.เปา วังน้อย</option>
        <option>SCY04 สิงห์ชัย ตลาด</option>
      </select>

      <select name="role" value={form.role} onChange={handleChange}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>

      <select name="status" value={form.status} onChange={handleChange}>
        <option value="active">ใช้งาน</option>
        <option value="inactive">ปิดใช้งาน</option>
      </select>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "กำลังบันทึก..." : "💾 บันทึก"}
      </button>
    </div>
  );
}