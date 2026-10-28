import React, { useEffect, useMemo, useRef, useState } from "react";

// จอประชาสัมพันธ์หน้าร้าน (Android signage 49" แนวตั้ง 1080x1920 ที่ ป.เปา 2 จอ — user 2026-10-28)
// public ไม่ต้อง login: /signage?branch=SCY06 — เปิดด้วยเบราว์เซอร์คีออสบนเครื่องป้าย
// สไลด์: image (รูปโปรโมชั่นอัปโหลดจากเมนู CRM → จอประชาสัมพันธ์หน้าร้าน) · vehicle (รุ่นแนะนำ รูปสี + ราคาเงินสดสดจาก master)
//        · queue (บัตรคิวศูนย์บริการ + รถในช่องซ่อมจากกล้อง) · line (QR เพิ่มเพื่อน OA) · text (ประกาศข้อความ)
const SIGNAGE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/signage-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const TICKET_API = "https://n8n-new-project-gwf2.onrender.com/webhook/service-queue-ticket-api";
const SQ_API = "https://n8n-new-project-gwf2.onrender.com/webhook/service-queue-api";
const LINE_OA = { id: "975ltwhp", name: "ป.เปามอเตอร์เซอร์วิส" }; // OA ป.เปา (@975ltwhp)
const RELOAD_ITEMS_MS = 60000;  // ดึงรายการสไลด์ใหม่ทุก 1 นาที (แก้ในเมนูแล้วจอเปลี่ยนเอง)
const PRICE_REFRESH_MS = 30 * 60000;

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json().catch(() => null);
}
const asArray = (d) => (Array.isArray(d) ? d : d ? [d] : []);
const text = (v) => String(v == null ? "" : v).trim();
const parseList = (d) => { try { return typeof d?.listjson === "string" ? JSON.parse(d.listjson) : Array.isArray(d) ? d : []; } catch { return []; } };
const fmtBaht = (n) => (n == null ? "-" : Number(n).toLocaleString("th-TH"));

export default function SignageDisplayPage() {
  const params = new URLSearchParams(window.location.search);
  const branch = (params.get("branch") || "SCY06").toUpperCase();
  const priceGroup = ["SCY05", "SCY06"].includes(branch) ? "ป.เปา" : "สิงห์ชัย";

  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [images, setImages] = useState({});        // id -> dataURL (key id@updated_at)
  const [master, setMaster] = useState({ priceTypes: [], prices: [], colors: [] });
  const [colorImgs, setColorImgs] = useState({});  // color_id -> dataURL
  const [queue, setQueue] = useState({ tickets: [], bays: [] });
  const [clock, setClock] = useState(new Date());
  const [fade, setFade] = useState(true);
  const timerRef = useRef(null);

  // รายการสไลด์ (เฉพาะ active + อยู่ในช่วงวันที่) — refresh ทุก 1 นาที
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const d = parseList(await post(SIGNAGE_API, { action: "list_items", branch_code: branch, for_display: true }).catch(() => null));
      if (alive && Array.isArray(d)) setItems(d);
    };
    load();
    const t = setInterval(load, RELOAD_ITEMS_MS);
    return () => { alive = false; clearInterval(t); };
  }, [branch]);

  // ราคา/สี จาก master (สำหรับสไลด์รถแนะนำ) — refresh ทุก 30 นาที
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [pt, pr, c] = await Promise.all([
          post(MASTER_API, { action: "get_price_types" }), post(MASTER_API, { action: "get_moto_prices" }), post(MASTER_API, { action: "get_colors" }),
        ]);
        if (alive) setMaster({ priceTypes: asArray(pt), prices: asArray(pr), colors: asArray(c) });
      } catch { /* คงค่าเดิม */ }
    };
    load();
    const t = setInterval(load, PRICE_REFRESH_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // รูปสไลด์ image: โหลดเมื่อมีในรายการ (cache ตาม updated_at)
  useEffect(() => {
    items.filter((it) => it.kind === "image" && it.has_image).forEach((it) => {
      const key = `${it.id}@${it.updated_at}`;
      if (images[key] !== undefined) return;
      setImages((p) => ({ ...p, [key]: null }));
      post(SIGNAGE_API, { action: "get_image", id: it.id }).then((r) => {
        const rec = Array.isArray(r) ? r[0] : r;
        setImages((p) => ({ ...p, [key]: rec?.image_base64 ? (rec.image_base64.startsWith("data:") ? rec.image_base64 : "data:image/jpeg;base64," + rec.image_base64) : "none" }));
      }).catch(() => setImages((p) => ({ ...p, [key]: "none" })));
    });
  }, [items]); // eslint-disable-line

  // รูปสีรถ (moto_color_images)
  useEffect(() => {
    items.filter((it) => it.kind === "vehicle" && it.color_id).forEach((it) => {
      if (colorImgs[it.color_id] !== undefined) return;
      setColorImgs((p) => ({ ...p, [it.color_id]: null }));
      post(MASTER_API, { action: "get_color_image", color_id: it.color_id }).then((res) => {
        const rec = Array.isArray(res) ? res[0] : res;
        setColorImgs((p) => ({ ...p, [it.color_id]: rec?.image_data || "none" }));
      }).catch(() => setColorImgs((p) => ({ ...p, [it.color_id]: "none" })));
    });
  }, [items]); // eslint-disable-line

  // คิวศูนย์บริการ + รถในช่องซ่อม — โหลดเมื่อมีสไลด์ queue ทุก 20 วิ
  const hasQueue = items.some((it) => it.kind === "queue") || !!params.get("demo");
  useEffect(() => {
    if (!hasQueue) return;
    let alive = true;
    const load = async () => {
      try {
        const [t, b] = await Promise.all([
          post(TICKET_API, { action: "list_tickets", branch_code: branch }), post(SQ_API, { action: "list_bays" }),
        ]);
        if (alive) setQueue({ tickets: asArray(t).filter((x) => x && x.queue_no), bays: Array.isArray(b?.bays) ? b.bays : [] });
      } catch { /* คงค่าเดิม */ }
    };
    load();
    const tm = setInterval(load, 20000);
    return () => { alive = false; clearInterval(tm); };
  }, [hasQueue, branch]);

  // นาฬิกา + reload ตัวเองตี 3 (รับ deploy ใหม่)
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date(); setClock(d);
      if (d.getHours() === 3 && d.getMinutes() === 0 && d.getSeconds() < 30) window.location.reload();
    }, 15000);
    return () => clearInterval(t);
  }, []);

  // หมุนสไลด์ตาม duration_sec ของแต่ละสไลด์ (fade เปลี่ยนภาพ) — ?demo=1 = สไลด์ตัวอย่างไว้ดู layout ก่อนมีข้อมูลจริง
  const demo = params.get("demo") ? [
    { id: -1, kind: "text", title: "ยินดีต้อนรับ", payload: { text: "ป.เปามอเตอร์เซอร์วิส\nศูนย์บริการฮอนด้า วังน้อย" }, duration_sec: 6 },
    { id: -2, kind: "vehicle", title: "HONDA PCX160", payload: { promo: "ดาวน์ 0 บาท", note: "ราคาไม่รวมค่าจดทะเบียน", sub: "สีดำ" }, duration_sec: 6 },
    { id: -3, kind: "queue", title: "คิวรับบริการวันนี้", duration_sec: 8 },
    { id: -4, kind: "line", duration_sec: 6 },
  ] : null;
  const list = demo || (items.length ? items : [{ id: 0, kind: "idle", duration_sec: 30 }]);
  const cur = list[Math.min(idx, list.length - 1)];
  useEffect(() => {
    clearTimeout(timerRef.current);
    const sec = Math.max(3, Number(cur?.duration_sec) || 10);
    timerRef.current = setTimeout(() => {
      setFade(false);
      setTimeout(() => { setIdx((i) => (i + 1) % list.length); setFade(true); }, 400);
    }, sec * 1000);
    return () => clearTimeout(timerRef.current);
  }, [idx, list.length, cur?.duration_sec]);
  useEffect(() => { if (idx >= list.length) setIdx(0); }, [list.length]); // eslint-disable-line

  // ราคาเงินสดของกลุ่มสาขา สำหรับ color_id
  const cashPrice = useMemo(() => (colorId) => {
    const row = master.colors.find((c) => String(c.color_id) === String(colorId));
    if (!row) return null;
    const pt = master.priceTypes.find((p) => { const n = text(p.type_name); return n.includes(priceGroup) && n.includes("เงินสด"); });
    if (!pt) return null;
    const ptId = pt.price_type_id || pt.type_id;
    const pr = master.prices.find((x) => String(x.type_id) === String(row.type_id) && String(x.price_type_id) === String(ptId));
    return pr ? Number(pr.amount || 0) : null;
  }, [master, priceGroup]);
  const colorRow = (colorId) => master.colors.find((c) => String(c.color_id) === String(colorId)) || null;

  const timeStr = clock.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const dateStr = clock.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b1220", color: "#fff", overflow: "hidden", fontFamily: "'Noto Sans Thai', 'Sarabun', Tahoma, sans-serif", cursor: "none" }}>
      <div style={{ position: "absolute", inset: 0, opacity: fade ? 1 : 0, transition: "opacity .4s" }}>
        {cur.kind === "image" && <ImageSlide it={cur} src={images[`${cur.id}@${cur.updated_at}`]} />}
        {cur.kind === "vehicle" && <VehicleSlide it={cur} img={colorImgs[cur.color_id]} price={cashPrice(cur.color_id)} row={colorRow(cur.color_id)} />}
        {cur.kind === "queue" && <QueueSlide it={cur} queue={queue} />}
        {cur.kind === "line" && <LineSlide it={cur} />}
        {cur.kind === "text" && <TextSlide it={cur} />}
        {cur.kind === "idle" && <IdleSlide />}
      </div>
      {/* แถบล่าง: เวลา/วันที่ + จุดบอกลำดับสไลด์ */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "1.2vh 2.5vw", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(transparent, rgba(0,0,0,.55))", fontSize: "2.2vh" }}>
        <span style={{ opacity: .9 }}>{dateStr}</span>
        <span style={{ display: "flex", gap: "0.6vh" }}>
          {list.map((_, i) => <span key={i} style={{ width: "1.1vh", height: "1.1vh", borderRadius: "50%", background: i === idx ? "#fbbf24" : "rgba(255,255,255,.35)" }} />)}
        </span>
        <span style={{ fontWeight: 700, fontSize: "3vh" }}>{timeStr} น.</span>
      </div>
    </div>
  );
}

function Title({ children, sub }) {
  return (
    <div style={{ textAlign: "center", padding: "3vh 3vw 1vh" }}>
      <div style={{ fontSize: "5.2vh", fontWeight: 800, letterSpacing: .5, lineHeight: 1.35 }}>{children}</div>
      {sub && <div style={{ fontSize: "2.6vh", opacity: .8, marginTop: "0.5vh", lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

function ImageSlide({ it, src }) {
  if (src === "none") return <TextSlide it={{ title: it.title, payload: { text: "ไม่มีรูป" } }} />;
  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ display: "grid", placeItems: "center", height: "100%", opacity: .6, fontSize: "3vh" }}>กำลังโหลดรูป…</div>}
      {it.title && <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "2vh 3vw", fontSize: "4vh", fontWeight: 800, textShadow: "0 2px 12px #000", background: "linear-gradient(rgba(0,0,0,.55), transparent)" }}>{it.title}</div>}
    </div>
  );
}

function VehicleSlide({ it, img, price, row }) {
  const name = it.title || [it.brand_name, it.series_name].filter(Boolean).join(" ");
  const color = row ? text(row.color_name) : "";
  const promo = it.payload?.promo || "";
  return (
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 35%, #1e3a8a 0%, #0b1220 70%)", display: "flex", flexDirection: "column" }}>
      <Title sub={color ? `สี${color.replace(/^สี/, "")}` : it.payload?.sub}>{name}</Title>
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "0 4vw" }}>
        {img && img !== "none" ? <img src={img} alt="" style={{ maxWidth: "92vw", maxHeight: "48vh", objectFit: "contain", filter: "drop-shadow(0 20px 30px rgba(0,0,0,.6))" }} />
          : <div style={{ opacity: .5, fontSize: "3vh" }}>{img === "none" || !it.color_id ? "ไม่มีรูปสีนี้" : "กำลังโหลดรูป…"}</div>}
      </div>
      <div style={{ textAlign: "center", padding: "0 3vw 9vh" }}>
        {price != null ? (
          <>
            <div style={{ fontSize: "2.8vh", opacity: .85 }}>ราคาเงินสด</div>
            <div style={{ fontSize: "9vh", fontWeight: 900, color: "#fbbf24", lineHeight: 1.1 }}>{fmtBaht(price)}<span style={{ fontSize: "3.5vh", marginLeft: "1vw" }}>บาท</span></div>
          </>
        ) : <div style={{ fontSize: "3vh", opacity: .6 }}>สอบถามราคาที่พนักงานขาย</div>}
        {promo && <div style={{ marginTop: "1.5vh", display: "inline-block", background: "#dc2626", padding: "1vh 3vw", borderRadius: "5vh", fontSize: "3.2vh", fontWeight: 800 }}>{promo}</div>}
        {it.payload?.note && <div style={{ marginTop: "1vh", fontSize: "2.2vh", opacity: .7 }}>{it.payload.note}</div>}
      </div>
    </div>
  );
}

function QueueSlide({ it, queue }) {
  const STATUS = { waiting: ["รอเรียก", "#fbbf24"], serving: ["กำลังบริการ", "#34d399"], done: ["เสร็จแล้ว", "#9ca3af"], skipped: ["ไม่มาตามเรียก", "#f87171"] };
  const tickets = queue.tickets.filter((t) => ["waiting", "serving"].includes(t.status)).slice(0, 10);
  const bays = queue.bays.filter((b) => b.occupied !== false);
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #082f49, #0b1220)", display: "flex", flexDirection: "column" }}>
      <Title sub="ศูนย์บริการ">{it.title || "คิวรับบริการวันนี้"}</Title>
      <div style={{ padding: "0 3vw", flex: 1, display: "flex", flexDirection: "column", gap: "1.5vh" }}>
        <div style={{ background: "rgba(255,255,255,.07)", borderRadius: "2vh", padding: "1.5vh 2vw", flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: "2.8vh", fontWeight: 700, marginBottom: "1vh", opacity: .9 }}>🎫 บัตรคิว</div>
          {tickets.length === 0 && <div style={{ opacity: .6, fontSize: "2.6vh", padding: "2vh 0" }}>ยังไม่มีคิวรอ</div>}
          {tickets.map((t) => {
            const st = STATUS[t.status] || STATUS.waiting;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "2vw", padding: "1vh 0", borderBottom: "1px solid rgba(255,255,255,.08)", fontSize: "2.8vh" }}>
                <span style={{ fontSize: "4.2vh", fontWeight: 900, minWidth: "9vw", color: st[1] }}>{t.queue_no}</span>
                <span style={{ flex: 1 }}>{t.plate_no || t.customer_name || "-"}<span style={{ opacity: .6, fontSize: "2.2vh", marginLeft: "1vw" }}>{t.service_type || ""}</span></span>
                <span style={{ color: st[1], fontWeight: 700 }}>{st[0]}</span>
              </div>
            );
          })}
        </div>
        <div style={{ background: "rgba(255,255,255,.07)", borderRadius: "2vh", padding: "1.5vh 2vw", flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: "2.8vh", fontWeight: 700, marginBottom: "1vh", opacity: .9 }}>🔧 รถที่กำลังซ่อมในช่องซ่อม</div>
          {bays.length === 0 && <div style={{ opacity: .6, fontSize: "2.6vh", padding: "2vh 0" }}>ไม่มีรถในช่องซ่อมตอนนี้</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2vh" }}>
            {bays.map((b) => (
              <div key={b.zone_source} style={{ background: "rgba(0,0,0,.35)", borderRadius: "1.5vh", padding: "1.2vh 1.5vw" }}>
                <div style={{ fontSize: "4vh", fontWeight: 900, fontFamily: "monospace", color: b.plate_no ? "#fff" : "#9ca3af" }}>{b.plate_no || "ไม่ทราบทะเบียน"}</div>
                <div style={{ fontSize: "2.2vh", opacity: .75 }}>{b.zone_name} · เข้า {b.since_local || "-"} น. ({b.minutes} นาที)</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ height: "8vh" }} />
    </div>
  );
}

function LineSlide({ it }) {
  const id = it.payload?.line_id || LINE_OA.id;
  const name = it.payload?.line_name || LINE_OA.name;
  const url = `https://line.me/R/ti/p/@${id}`;
  const qr = `https://qr-official.line.me/gs/M_${id}_GW.png`;
  const fallback = `https://api.qrserver.com/v1/create-qr-code/?size=700x700&data=${encodeURIComponent(url)}`;
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #06c755, #065f46)", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Title sub={it.payload?.sub || "สแกน QR เพิ่มเพื่อน รับข่าวโปรโมชั่น นัดหมายซ่อม ส่งใบเสร็จทาง LINE"}>{it.title || `เพิ่มเพื่อน LINE ${name}`}</Title>
      <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
        <div style={{ background: "#fff", padding: "3vh", borderRadius: "3vh" }}>
          <img src={qr} alt="QR" onError={(e) => { if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback; }} style={{ width: "60vw", height: "60vw", maxWidth: "50vh", maxHeight: "50vh", display: "block" }} />
        </div>
      </div>
      <div style={{ fontSize: "4vh", fontWeight: 800, paddingBottom: "10vh" }}>LINE ID: @{id}</div>
    </div>
  );
}

function TextSlide({ it }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #7c2d12, #0b1220)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4vh 5vw", textAlign: "center" }}>
      {it.title && <div style={{ fontSize: "6vh", fontWeight: 900, marginBottom: "3vh" }}>{it.title}</div>}
      <div style={{ fontSize: "4.2vh", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{it.payload?.text || ""}</div>
    </div>
  );
}

function IdleSlide() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <div style={{ fontSize: "6vh", fontWeight: 900, lineHeight: 1.35, padding: "0 4vw" }}>ป.เปามอเตอร์เซอร์วิส</div>
        <div style={{ fontSize: "2.6vh", opacity: .6, marginTop: "2vh", lineHeight: 1.4, padding: "0 4vw" }}>ยังไม่มีสไลด์ — เพิ่มได้ที่เมนู CRM → จอประชาสัมพันธ์หน้าร้าน</div>
      </div>
    </div>
  );
}
