import { useState } from "react";

const MATERIAL_WEBHOOK_URL =
  "https://n8n-new-project-gwf2.onrender.com/webhook-test/4f649516-de04-4661-a6f5-caae15261e7f";

export default function IssuePage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const loadMaterials = async () => {
    try {
      setLoading(true);
      setErrorText("");

      console.log("กำลังเรียก n8n test webhook...");

      const res = await fetch(MATERIAL_WEBHOOK_URL, {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log("n8n data:", data);

      setMaterials(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("โหลดข้อมูลไม่สำเร็จ:", err);
      setErrorText(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-box">
      <h2>หน้าเบิกวัสดุ</h2>
      <p>ทดสอบเรียก n8n ผ่าน webhook-test</p>

      <button className="btn btn-primary" onClick={loadMaterials}>
        โหลดข้อมูลจาก TEST
      </button>

      {loading && <p>กำลังโหลดข้อมูล...</p>}
      {errorText && <p style={{ color: "red" }}>{errorText}</p>}

      <table>
        <thead>
          <tr>
            <th>รหัส</th>
            <th>ชื่อสินค้า</th>
            <th>กลุ่มสินค้า</th>
            <th>จำนวน</th>
            <th>หน่วย</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((item, index) => (
            <tr key={index}>
              <td>{item.product_code}</td>
              <td>{item.product_name}</td>
              <td>{item["กลุ่มสินค้า"]}</td>
              <td>{item.qty}</td>
              <td>{item.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}