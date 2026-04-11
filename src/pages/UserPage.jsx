import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/office-login";
const MASTER_API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

const BRANCHES = [
  "SCY01 สำนักงานใหญ่",
  "SCY04 สิงห์ชัย ตลาดสีขวา",
  "SCY05 ป.เปา นครหลวง",
  "SCY06 ป.เปา วังน้อย",
  "SCY07 สิงห์ชัย ตลาด",
];

const PAGE_OPTIONS = [
  { key: "dashboard", label: "📊 ภาพรวม" },
  { key: "receive",   label: "📥 รับวัสดุ" },
  { key: "issue",     label: "📤 เบิกวัสดุ" },
  { key: "users",     label: "👤 กำหนดผู้ใช้งาน" },
  { key: "booking",   label: "🚗 จองคนขับรถ" },
  { key: "moto",     label: "🏍️ จองรถจักรยานยนต์" },
  { key: "fastmoving", label: "⚡ รายงานอะไหล่หมุนเร็ว" },
  { key: "pettycash", label: "💰 เงินสดย่อย" },
];

const DEFAULT_PAGES = ["dashboard", "receive", "issue"];

const emptyForm = () => ({
  name: "",
  username: "",
  password: "",
  role: "user",
  branch: "",
  position: "",
  status: "active",
  pages: [...DEFAULT_PAGES],
});

function parsePages(raw) {
  if (!raw) return [...DEFAULT_PAGES];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return [...DEFAULT_PAGES]; }
}

export default function UserPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [mode, setMode] = useState("list");
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [editingOtherAdmin, setEditingOtherAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [searchText, setSearchText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [positions, setPositions] = useState([]);

  const isAdmin = currentUser?.role === "admin";
  const currentUserId = String(currentUser?.user_id || "");

  const api = async (action, payload = {}) => {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const showMsg = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 3000);
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api("get_users");
      const list = Array.isArray(data) ? data : data?.users || data?.data || [];
      setUsers(list);
    } catch {
      showMsg("โหลดข้อมูลไม่สำเร็จ", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadPositions = async () => {
    try {
      const res = await fetch(MASTER_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_positions" }),
      });
      const data = await res.json();
      setPositions(Array.isArray(data) ? data.filter(p => p.status === "active") : []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadUsers();
    loadPositions();
  }, []);

  const handleAdd = () => {
    setEditId(null);
    setEditingOtherAdmin(false);
    setForm(emptyForm());
    setMode("form");
  };

  const handleEdit = (user) => {
    const targetId = String(user.user_id || user.id || user.username);
    const isOtherAdmin = user.role === "admin" && targetId !== currentUserId;
    setEditId(targetId);
    setEditingOtherAdmin(isOtherAdmin);
    setForm({
      name: user.name || "",
      username: user.username || "",
      password: "",
      role: user.role || "user",
      branch: user.branch || "",
      position: user.position || "",
      status: user.status || "active",
      pages: parsePages(user.pages),
    });
    setMode("form");
  };

  const handleSave = async () => {
    // User role: only update password
    if (!isAdmin) {
      if (!form.password.trim()) return showMsg("กรุณาระบุรหัสผ่านใหม่", "error");
      try {
        setSaving(true);
        const raw = await api("update_user", { user_id: editId, password: form.password });
        const data = Array.isArray(raw) ? raw[0] : raw;
        if (data?.success || data?.ok || data?.user_id) {
          showMsg("แก้ไขรหัสผ่านสำเร็จ");
          setMode("list");
        } else {
          showMsg(data?.message || "บันทึกไม่สำเร็จ", "error");
        }
      } catch {
        showMsg("ไม่สามารถเชื่อมต่อระบบได้", "error");
      } finally {
        setSaving(false);
      }
      return;
    }

    // Admin role: full save
    if (!form.name.trim()) return showMsg("กรุณาระบุชื่อ-นามสกุล", "error");
    if (!form.username.trim()) return showMsg("กรุณาระบุ Username", "error");
    if (!editId && !form.password.trim()) return showMsg("กรุณาระบุรหัสผ่าน", "error");
    if (!form.branch) return showMsg("กรุณาเลือกสาขา", "error");

    try {
      setSaving(true);
      const action = editId ? "update_user" : "save_user";
      const payload = editId
        ? { ...form, user_id: editId, pages: JSON.stringify(form.pages) }
        : { ...form, pages: JSON.stringify(form.pages) };
      if (editingOtherAdmin) delete payload.password;
      const raw = await api(action, payload);
      const data = Array.isArray(raw) ? raw[0] : raw;
      if (data?.success || data?.ok || data?.user_id) {
        showMsg(editId ? "แก้ไขผู้ใช้สำเร็จ" : "เพิ่มผู้ใช้สำเร็จ");
        setMode("list");
        await loadUsers();
      } else {
        showMsg(data?.message || "บันทึกไม่สำเร็จ", "error");
      }
    } catch {
      showMsg("ไม่สามารถเชื่อมต่อระบบได้", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    const id = user.user_id || user.id;
    try {
      setDeleting(id);
      const raw = await api("delete_user", { user_id: id });
      const data = Array.isArray(raw) ? raw[0] : raw;
      if (data?.success || data?.ok) {
        showMsg("ลบผู้ใช้สำเร็จ");
        await loadUsers();
      } else {
        showMsg(data?.message || "ลบไม่สำเร็จ", "error");
      }
    } catch {
      showMsg("ไม่สามารถลบได้", "error");
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  // User role: show only own account; Admin: show all
  const visibleUsers = isAdmin
    ? users
    : users.filter((u) => String(u.user_id || u.id) === currentUserId);

  const filtered = visibleUsers.filter((u) => {
    const q = searchText.toLowerCase();
    return (
      !q ||
      (u.name || "").toLowerCase().includes(q) ||
      (u.username || "").toLowerCase().includes(q) ||
      (u.branch || "").toLowerCase().includes(q)
    );
  });

  const badge = (c) => ({
    display: "inline-block", padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: c === "green" ? "#d1fae5" : c === "red" ? "#fee2e2" : "#dbeafe",
    color: c === "green" ? "#065f46" : c === "red" ? "#991b1b" : "#1e40af",
  });
  const msgBox = (t) => ({
    padding: "10px 16px", borderRadius: 8, marginBottom: 12,
    background: t === "success" ? "#d1fae5" : "#fee2e2",
    color: t === "success" ? "#065f46" : "#991b1b",
    fontSize: 13, fontWeight: 600,
  });
  const actionBtn = (color) => ({
    background: color, color: "#fff", border: "none", borderRadius: 6,
    padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600,
  });

  const fieldDisabled = !isAdmin;
  const passwordDisabled = isAdmin && editingOtherAdmin;

  /* ── FORM VIEW ── */
  if (mode === "form") {
    return (
      <div className="page-container">
        <div className="form-card">
          <div className="page-topbar" style={{ marginBottom: 20 }}>
            <h2 className="page-title">
              {!isAdmin ? "แก้ไขรหัสผ่าน" : editId ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งานใหม่"}
            </h2>
            <button className="btn-secondary" onClick={() => setMode("list")}>← กลับ</button>
          </div>
          {msg.text && <div style={msgBox(msg.type)}>{msg.text}</div>}
          {editingOtherAdmin && (
            <div style={{ padding: "10px 16px", borderRadius: 8, marginBottom: 12, background: "#fef3c7", color: "#92400e", fontSize: 13, fontWeight: 600 }}>
              ไม่สามารถแก้ไขรหัสผ่านของ Admin คนอื่นได้
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-row">
              <label>ชื่อ - นามสกุล {isAdmin && "*"}</label>
              <input className="form-input" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ชื่อ นามสกุล" disabled={fieldDisabled}
                style={{ background: fieldDisabled ? "#f8fafc" : "#fff" }} />
            </div>
            <div className="form-row">
              <label>Username</label>
              <input className="form-input" value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="username" disabled={!!editId || fieldDisabled}
                style={{ background: "#f8fafc" }} autoComplete="off" />
            </div>
            <div className="form-row">
              <label>รหัสผ่าน {editId ? "(เว้นว่างถ้าไม่เปลี่ยน)" : "*"}</label>
              <input className="form-input" type="password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={passwordDisabled ? "ไม่สามารถแก้ไขได้" : "รหัสผ่าน"}
                disabled={passwordDisabled}
                style={{ background: passwordDisabled ? "#f8fafc" : "#fff" }}
                autoComplete="new-password" />
            </div>
            <div className="form-row">
              <label>สาขา {isAdmin && "*"}</label>
              <select className="form-input" value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                disabled={fieldDisabled}
                style={{ background: fieldDisabled ? "#f8fafc" : "#fff" }}>
                <option value="">-- เลือกสาขา --</option>
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {isAdmin && (
              <div className="form-row">
                <label>ตำแหน่ง</label>
                <select className="form-input" value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}>
                  <option value="">-- เลือกตำแหน่ง --</option>
                  {positions.map((p) => (
                    <option key={p.position_id} value={p.position_name}>{p.position_name}</option>
                  ))}
                </select>
              </div>
            )}
            {isAdmin && (
              <>
                <div className="form-row">
                  <label>สิทธิ์การใช้งาน</label>
                  <select className="form-input" value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-row">
                  <label>สถานะ</label>
                  <select className="form-input" value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="active">ใช้งาน</option>
                    <option value="inactive">ปิดใช้งาน</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {isAdmin && form.role !== "admin" && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 13, color: "#374151", fontWeight: 600, marginBottom: 10 }}>สิทธิ์การเข้าใช้หน้า</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {PAGE_OPTIONS.map((p) => {
                  const checked = (form.pages || []).includes(p.key);
                  return (
                    <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                      <input type="checkbox" checked={checked} onChange={(e) => {
                        const newPages = e.target.checked
                          ? [...(form.pages || []), p.key]
                          : (form.pages || []).filter((x) => x !== p.key);
                        setForm({ ...form, pages: newPages });
                      }} />
                      {p.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 20, paddingTop: 14, borderTop: "1px solid #e5e7eb" }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button className="btn-secondary" onClick={() => setMode("list")}>ยกเลิก</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── LIST VIEW ── */
  return (
    <div className="page-container">
      <div className="form-card">
        <div className="page-topbar" style={{ marginBottom: 16 }}>
          <h2 className="page-title">กำหนดผู้ใช้งาน</h2>
          {isAdmin && (
            <button className="btn-primary" onClick={handleAdd}>+ เพิ่มผู้ใช้</button>
          )}
        </div>

        {msg.text && <div style={msgBox(msg.type)}>{msg.text}</div>}

        {isAdmin && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
            <input
              className="form-input"
              style={{ maxWidth: 300 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="ค้นหาชื่อ / username / สาขา"
            />
            <button className="btn-secondary" onClick={loadUsers} disabled={loading}>
              {loading ? "..." : "รีเฟรช"}
            </button>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th style={{ textAlign: "left" }}>ชื่อ - นามสกุล</th>
                <th style={{ textAlign: "left" }}>Username</th>
                <th style={{ textAlign: "left" }}>สาขา</th>
                {isAdmin && <th style={{ textAlign: "left" }}>ตำแหน่ง</th>}
                {isAdmin && <th>สิทธิ์</th>}
                {isAdmin && <th>สถานะ</th>}
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 8 : 5} style={{ textAlign: "center", color: "#9ca3af", padding: 24 }}>กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={isAdmin ? 8 : 5} style={{ textAlign: "center", color: "#9ca3af", padding: 24 }}>ไม่มีข้อมูลผู้ใช้งาน</td></tr>
              ) : (
                filtered.map((u, i) => {
                  const isOtherAdmin = u.role === "admin" && String(u.user_id || u.id) !== currentUserId;
                  return (
                    <tr key={u.user_id || u.username || i}>
                      <td>{i + 1}</td>
                      <td style={{ textAlign: "left", color: "#072d6b", fontWeight: 600 }}>{u.name || "-"}</td>
                      <td style={{ textAlign: "left" }}>{u.username || "-"}</td>
                      <td style={{ textAlign: "left" }}>{u.branch || "-"}</td>
                      {isAdmin && <td style={{ textAlign: "left" }}>{u.position || "-"}</td>}
                      {isAdmin && <td><span style={badge(u.role === "admin" ? "blue" : "")}>{u.role === "admin" ? "Admin" : "User"}</span></td>}
                      {isAdmin && <td><span style={badge(u.status === "active" ? "green" : "red")}>{u.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}</span></td>}
                      <td>
                        <button style={{ ...actionBtn("#f59e0b"), marginRight: 4 }} onClick={() => handleEdit(u)}>แก้ไข</button>
                        {isAdmin && !isOtherAdmin && (
                          <button style={actionBtn("#ef4444")} onClick={() => setConfirmDelete(u)}
                            disabled={deleting === (u.user_id || u.id)}>
                            {deleting === (u.user_id || u.id) ? "..." : "ลบ"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 24, maxWidth: 360, width: "90%", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: "#1e293b" }}>ยืนยันการลบ</div>
            <p style={{ color: "#475569", marginBottom: 18, lineHeight: 1.6 }}>
              ต้องการลบผู้ใช้ <strong>{confirmDelete.name || confirmDelete.username}</strong> ออกจากระบบใช่หรือไม่?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" style={{ background: "#ef4444" }} onClick={() => handleDelete(confirmDelete)}>ยืนยัน ลบ</button>
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
