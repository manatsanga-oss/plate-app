import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./App.css";

export default function Result() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!state?.file) {
      navigate("/");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        setResult(null);

        const formData = new FormData();
        formData.append("file", state.file);

        const res = await fetch("https://n8n-new-project-gwf2.onrender.com/webhook-test/094b8071-9478-4bc2-90e8-4c0d21660f0c", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error("ส่งข้อมูลไม่สำเร็จ");
        }

        const data = await res.json();
        setResult(data);
      } catch (err) {
        console.error(err);
        setError("ค้นหาไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [state, navigate]);

  return (
    <div className="page">
      <div className="card">
        <h1>ผลการค้นหา</h1>

        {loading && <p>กำลังประมวลผล...</p>}

        {error && <div className="alert error">{error}</div>}

        {result && (
          <div className="resultBox">
            <div className="resultHeader">ผลลัพธ์</div>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}

        <button type="button" onClick={() => navigate("/")}>
          กลับหน้าค้นหา
        </button>
      </div>
    </div>
  );
}