import { useState } from "react";

export default function App() {
  const [plate, setPlate] = useState("");
  const [result, setResult] = useState(null);

  const searchPlate = async () => {
    const res = await fetch("https://n8n-new-project-gwf2.onrender.com/webhook-test/094b8071-9478-4bc2-90e8-4c0d21660f0c", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plate }),
    });

    const data = await res.json();
    setResult(data);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>🔍 ค้นหาทะเบียนรถ</h2>

      <input
        value={plate}
        onChange={(e) => setPlate(e.target.value)}
        placeholder="กรอกทะเบียน"
      />

      <button onClick={searchPlate}>ค้นหา</button>

      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}
