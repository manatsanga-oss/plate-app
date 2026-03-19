import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

export default function Home() {
  const [file, setFile] = useState(null);
  const navigate = useNavigate();

  const handleSearch = () => {
    if (!file) {
      alert("กรุณาเลือกไฟล์ก่อน");
      return;
    }

    navigate("/result", { state: { file } });
  };

  return (
    <div className="page">
      <div className="card">
        <h1>หน้า Home ใหม่</h1>
        <p className="subtitle">ทดสอบ Router</p>

        <div className="searchRow">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button type="button" onClick={handleSearch}>
            ไปหน้า result
          </button>
        </div>
      </div>
    </div>
  );
}