import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/office-api";

const BRANCHES = [
  "SCY01 สำนักงานใหญ่",
  "SCY05 ป.เปา นครหลวง",
  "SCY06 ป.เปา วังน้อย",
  "SCY07 สิงห์ชัย ตลาด",
];

const emptyForm = () => ({
  name: "",
  username: "",
  password: "",
  role: "user",
  branch: "",
  status: "active",
});

export default function UserPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [mode, setMode] = useState("list");
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [searchText, setSearchText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

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

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setMode("form");
  };

  const handleEdit = (user) => {
    setEditId(user.user_id || user.id || user.username);
    setForm({
      name: user.name || "",
      username: user.username || "",
      password: "",
      role: user.role || "user",
      branch: user.branch || "",
      status: user.status || "active",
    });
    setMode("form");
  };

  const handleSave = async () => {
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

  const filtered = users.filter((u) => {
    const q = searchText.toLowerCase();
    return (
      !q ||
      (u.name || "").toLowerCase().includes(q) ||
      (u.username || "").toLowerCase().includes(q) ||
      (u.branch || "").toLowerCase().includes(q)
    );
  });

  /* ── STYLES ── */
  const S = {
    page: {
      padding: "20px",
      background: "#f5f5f5",
      minHeight: "100vh",
      fontFamily: "Tahoma, Arial, sans-serif",
      fontSize: "14px",
      color: "#333",
    },
    card: {
      background: "#fff",
      borderRadius: "6px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
      padding: "20px",
      marginBottom: "16px",
    },
    cardHeader: {
      fontSize: "15px",
      fontWeight: "700",
      color: "#333",
      marginBottom: "16px",
      paddingBottom: "10px",
      borderBottom: "2px solid #e0e0e0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    topRow: {
      display: "flex",
      gap: "8px",
      marginBottom: "14px",
      alignItems: "center",
    },
    input: {
      border: "1px solid #d9d9d9",
      borderRadius: "4px",
      padding: "7px 10px",
      fontSize: "14px",
      boxSizing: "border-box",
      width: "100%",
      color: "#333",
      outline: "none",
    },
    btnPrimary: {
      background: "#1976d2",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      padding: "8px 18px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
      whiteSpace: "nowrap",
    },
    btnGray: {
      background: "#757575",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      padding: "8px 16px",
      cursor: "pointer",
      fontSize: "13px",
      whiteSpace: "nowrap",
    },
    btnEdit: {
      background: "#f57c00",
      color: "#fff",
      border: "none",
      borderRadius: "3px",
      padding: "5px 12px",
      cursor: "pointer",
      fontSize: "12px",
      marginRight: "4px",
    },
    btnDelete: {
      background: "#d32f2f",
      color: "#fff",
      border: "none",
      borderRadius: "3px",
      padding: "5px 12px",
      cursor: "pointer",
      fontSize: "12px",
    },
    btnSave: {
      background: "#1976d2",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      padding: "9px 28px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
    },
    table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
    th: {
      background: "#f0f0f0",
      padding: "9px 12px",
      textAlign: "left",
      borderBottom: "2px solid #ddd",
      fontWeight: "700",
      color: "#555",
      whiteSpace: "nowrap",
    },
    thCenter: {
      background: "#f0f0f0",
      padding: "9px 12px",
      textAlign: "center",
      borderBottom: "2px solid #ddd",
      fontWeight: "700",
      color: "#555",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "9px 12px",
      borderBottom: "1px solid #ebebeb",
      color: "#333",
      verticalAlign: "middle",
    },
    tdCenter: {
      padding: "9px 12px",
      borderBottom: "1px solid #ebebeb",
      color: "#333",
      verticalAlign: "middle",
      textAlign: "center",
    },
    badge: (c) => ({
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: "10px",
      fontSize: "12px",
      fontWeight: "600",
      background:
        c === "green" ? "#e8f5e9" : c === "red" ? "#ffebee" : "#e3f2fd",
      color:
        c === "green" ? "#2e7d32" : c === "red" ? "#c62828" : "#1565c0",
    }),
    msgBox: (t) => ({
      padding: "10px 16px",
      borderRadius: "4px",
      marginBottom: "12px",
      background: t === "success" ? "#e8f5e9" : "#ffebee",
      color: t === "success" ? "#2e7d32" : "#c62828",
      fontSize: "13px",
      fontWeight: "600",
    }),
    formGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "14px",
    },
    formRow: { display: "flex", flexDirection: "column", gap: "4px" },
    label: { fontSize: "13px", color: "#555", fontWeight: "600" },
    formActions: {
      display: "flex",
      gap: "8px",
      marginTop: "18px",
      paddingTop: "14px",
      borderTop: "1px solid #eee",
    },
    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    },
    dialog: {
      background: "#fff",
      borderRadius: "6px",
      padding: "24px",
      maxWidth: "360px",
      width: "90%",
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    },
  };

  /* ── FORM VIEW ── */
  if (mode === "form") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span>{editId ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งานใหม่"}</span>
          </div>
          {msg.text && <div style={S.msgBox(msg.type)}>{msg.text}</div>}
          <div style={S.formGrid}>
            <div style={S.formRow}>
              <label style={S.label}>ชื่อ - นามสกุล *</label>
              <input
                style={S.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ชื่อ นามสกุล"
              />
            </div>
            <div style={S.formRow}>
              <label style={S.label}>Username *</label>
              <input
                style={{ ...S.input, background: editId ? "#f5f5f5" : "#fff" }}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="username"
                disabled={!!editId}
              />
            </div>
            <div style={S.formRow}>
              <label style={S.label}>
                รหัสผ่าน {editId ? "(เว้นว่างถ้าไม่เปลี่ยน)" : "*"}
              </label>
              <input
                style={S.input}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="รหัสผ่าน"
              />
            </div>
            <div style={S.formRow}>
              <label style={S.label}>สาขา *</label>
              <select
                style={S.input}
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
              >
                <option value="">-- เลือกสาขา --</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div style={S.formRow}>
              <label style={S.label}>สิทธิ์การใช้งาน</label>
              <select
                style={S.input}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={S.formRow}>
              <label style={S.label}>สถานะ</label>
              <select
                style={S.input}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">ใช้งาน</option>
                <option value="inactive">ปิดใช้งาน</option>
              </select>
            </div>
          </div>
          <div style={S.formActions}>
            <button style={S.btnSave} onClick={handleSave} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button style={S.btnGray} onClick={() => setMode("list")}>
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── LIST VIEW ── */
  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span>กำหนดผู้ใช้งาน</span>
          <button style={S.btnPrimary} onClick={handleAdd}>
            + เพิ่มผู้ใช้
          </button>
        </div>

        {msg.text && <div style={S.msgBox(msg.type)}>{msg.text}</div>}

        <div style={S.topRow}>
          <input
            style={{ ...S.input, maxWidth: "300px" }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="ค้นหาชื่อ / username / สาขา"
          />
          <button style={S.btnGray} onClick={loadUsers} disabled={loading}>
            {loading ? "..." : "รีเฟรช"}
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>#</th>
                <th style={S.th}>ชื่อ - นามสกุล</th>
                <th style={S.th}>Username</th>
                <th style={S.th}>สาขา</th>
                <th style={S.thCenter}>สิทธิ์</th>
                <th style={S.thCenter}>สถานะ</th>
                <th style={S.thCenter}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ ...S.tdCenter, color: "#999", padding: "24px" }}
                  >
                    กำลังโหลด...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ ...S.tdCenter, color: "#999", padding: "24px" }}
                  >
                    ไม่มีข้อมูลผู้ใช้งาน
                  </td>
                </tr>
              ) : (
                filtered.map((u, i) => (
                  <tr
                    key={u.user_id || u.username || i}
                    style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                  >
                    <td style={S.td}>{i + 1}</td>
                    <td style={S.td}>{u.name || "-"}</td>
                    <td style={S.td}>{u.username || "-"}</td>
                    <td style={S.td}>{u.branch || "-"}</td>
                    <td style={S.tdCenter}>
                      <span style={S.badge(u.role === "admin" ? "blue" : "")}>
                        {u.role === "admin" ? "Admin" : "User"}
                      </span>
                    </td>
                    <td style={S.tdCenter}>
                      <span
                        style={S.badge(
                          u.status === "active" ? "green" : "red"
                        )}
                      >
                        {u.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </td>
                    <td style={S.tdCenter}>
                      <button style={S.btnEdit} onClick={() => handleEdit(u)}>
                        แก้ไข
                      </button>
                      <button
                        style={S.btnDelete}
                        onClick={() => setConfirmDelete(u)}
                        disabled={
                          deleting === (u.user_id || u.id)
                        }
                      >
                        {deleting === (u.user_id || u.id) ? "..." : "ลบ"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Confirm Delete Dialog ── */}
      {confirmDelete && (
        <div style={S.overlay}>
          <div style={S.dialog}>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "700",
                marginBottom: "10px",
                color: "#333",
              }}
            >
              ยืนยันการลบ
            </div>
            <p style={{ color: "#555", marginBottom: "18px", lineHeight: 1.6 }}>
              ต้องการลบผู้ใช้{" "}
              <strong>{confirmDelete.name || confirmDelete.username}</strong>{" "}
              ออกจากระบบใช่หรือไม่?
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                style={S.btnDelete}
                onClick={() => handleDelete(confirmDelete)}
              >
                ยืนยัน ลบ
              </button>
              <button
                style={S.btnGray}
                onClick={() => setConfirmDelete(null)}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
