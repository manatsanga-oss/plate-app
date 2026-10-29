import React, { useEffect, useRef, useState } from "react";

// จอประชาสัมพันธ์หน้าร้าน (Android signage 49" แนวตั้ง 1080x1920 ที่ ป.เปา 2 จอ — user 2026-10-28)
// public ไม่ต้อง login: /signage?branch=SCY06 — เปิดด้วยเบราว์เซอร์คีออสบนเครื่องป้าย
// สไลด์: image (รูปโปรโมชั่นอัปโหลดจากเมนู CRM → จอประชาสัมพันธ์หน้าร้าน) · vehicle (รุ่นแนะนำ รูปสี + ราคาเงินสดสดจาก master)
//        · queue (บัตรคิวศูนย์บริการ + รถในช่องซ่อมจากกล้อง) · line (QR เพิ่มเพื่อน OA) · text (ประกาศข้อความ)
const SIGNAGE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/signage-api";
const SIGNAGE_IMG = "https://n8n-new-project-gwf2.onrender.com/webhook/signage-image?id="; // รูปสไลด์เป็น JPEG ตรง (WebView ป้าย 972S จอดำเมื่อฝัง base64 ใหญ่ในหน้า 2026-10-28)
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
  const screen = (params.get("screen") || "all").trim();   // ร้านมีจอ 2 ขนาด: ?screen=1 / 2 → เอาสไลด์ "ทุกจอ" + ของจอนั้น
  const priceGroup = ["SCY05", "SCY06"].includes(branch) ? "ป.เปา" : "สิงห์ชัย";

  const [items, setItems] = useState([]);
  const [pos, setPos] = useState({ idx: 0, n: 1, cur: null });   // ตำแหน่งสไลด์ปัจจุบัน (โหมดเต็มจอ) สำหรับจุดบอกลำดับ/ดีบัก
  const [images, setImages] = useState({});        // id -> dataURL (key id@updated_at)
  const [master, setMaster] = useState({ priceTypes: [], prices: [], colors: [] });
  const [colorImgs, setColorImgs] = useState({});  // color_id -> dataURL
  const [queue, setQueue] = useState({ tickets: [], bays: [] });
  const [clock, setClock] = useState(new Date());
  const [cursorOn, setCursorOn] = useState(false);   // ซ่อนเมาส์เมื่อนิ่งเกิน 3 วิ (จอป้ายไม่ให้ลูกศรค้าง) — ขยับแล้วโผล่ ใช้บนคอมได้
  // โหมดดีบักบนจอป้าย (?debug=1): โชว์ UA/ขนาดจอ/log โหลดรูป — ป้าย 972S โหลดรูปไม่ขึ้น (2026-10-28) ดูสาเหตุจากหน้าจอได้โดยไม่ต้องต่อ ADB
  const debug = !!params.get("debug");
  const sound = !!params.get("sound");   // ?sound=1 เปิดเสียงวิดีโอ (ค่าเริ่มต้นปิดเสียง — autoplay ใน WebView ต้อง muted)
  const [dbg, setDbg] = useState([]);
  const log = (m) => { if (debug) setDbg((p) => [...p.slice(-9), new Date().toLocaleTimeString("th-TH") + " " + m]); };
  useEffect(() => {
    let t = null;
    const onMove = () => { setCursorOn(true); clearTimeout(t); t = setTimeout(() => setCursorOn(false), 3000); };
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); clearTimeout(t); };
  }, []);

  // รายการสไลด์ (เฉพาะ active + อยู่ในช่วงวันที่) — refresh ทุก 1 นาที
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const d = parseList(await post(SIGNAGE_API, { action: "list_items", branch_code: branch, for_display: true, screen: screen === "all" ? undefined : screen }).catch(() => null));
      if (alive && Array.isArray(d)) setItems(d);
    };
    load();
    const t = setInterval(load, RELOAD_ITEMS_MS);
    return () => { alive = false; clearInterval(t); };
  }, [branch, screen]);

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

  // รูปสไลด์ image: ใช้ลิงก์ JPEG ตรงจาก webhook (v=updated_at กัน cache เก่า) — preload ล่วงหน้าทุกใบ
  useEffect(() => {
    items.filter((it) => (it.kind === "image" || it.kind === "video") && it.has_image).forEach((it) => {
      const key = `${it.id}@${it.updated_at}`;
      if (images[key] !== undefined) return;
      const url = SIGNAGE_IMG + it.id + "&v=" + encodeURIComponent(String(it.updated_at || ""));
      setImages((p) => ({ ...p, [key]: url }));
      if (it.kind === "image") { const pre = new Image(); pre.src = url; }
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
  // ตรวจเวอร์ชันใหม่ทุก 10 นาที: โหลด index.html สด เทียบชื่อไฟล์ bundle — เปลี่ยน = deploy ใหม่ → reload ทันที (ป้ายไม่ต้องรอตี 3 / ไม่ต้องส่งโปรแกรมซ้ำ 2026-10-29)
  useEffect(() => {
    const current = [...document.scripts].map((s) => s.src).find((s) => /\/assets\/index-.*\.js/.test(s)) || "";
    if (!current) return;
    const check = async () => {
      try {
        const html = await (await fetch("/index.html?v=" + Date.now(), { cache: "no-store" })).text();
        const m = html.match(/assets\/index-[^"']+\.js/);
        if (m && !current.endsWith(m[0])) window.location.reload();
      } catch { /* เน็ตหลุด ข้าม */ }
    };
    const t = setInterval(check, 10 * 60000);
    return () => clearInterval(t);
  }, []);

  // รายการสไลด์ — ?demo=1 = สไลด์ตัวอย่างไว้ดู layout ก่อนมีข้อมูลจริง
  const demo = params.get("demo") ? [
    { id: -1, kind: "text", title: "ยินดีต้อนรับ", payload: { text: "ป.เปามอเตอร์เซอร์วิส\nศูนย์บริการฮอนด้า วังน้อย" }, duration_sec: 6, zone: 1 },
    { id: -2, kind: "vehicle", title: "HONDA PCX160", payload: { promo: "ดาวน์ 0 บาท", note: "ราคาไม่รวมค่าจดทะเบียน", sub: "สีดำ" }, duration_sec: 6, zone: 1 },
    { id: -3, kind: "queue", title: "คิวรับบริการวันนี้", duration_sec: 8, zone: 1 },
    { id: -4, kind: "line", duration_sec: 6, zone: 1 },
    { id: -5, kind: "text", title: "ประกาศ", payload: { text: "ศูนย์บริการเปิดทุกวัน 08:00–17:30 น. โทร 035-271146" }, duration_sec: 8, zone: 3 },
    { id: -6, kind: "text", title: "โปรโมชั่นเดือนนี้", payload: { text: "เปลี่ยนถ่ายน้ำมันเครื่อง ฟรีค่าแรง" }, duration_sec: 8, zone: 3 },
  ] : null;
  const list = demo || items;
  // แบ่งจอ (user 2026-10-29 จอ 2): ?split=3 → ส่วน 1 = สไลด์หลักด้านบน (75%) · ส่วน 2 = รูปเล็กมุมขวาบน (PiP) · ส่วน 3 = ข้อความด้านล่าง (25%)
  // ?split=2 → บน/ล่างครึ่งเท่ากัน; ส่วนที่ย่อใช้ CSS zoom ให้ layout เดิม (หน่วย vh/vw) พอดีความสูงของส่วน
  const split = Math.max(1, Math.min(3, Number(params.get("split")) || 1));
  const bands = split === 2 ? [0.5, 0.5] : [1];
  // split=3: ความสูงแถบข้อความล่างเป็น % ของจอ (?bottom=18, ค่าเริ่มต้น 18, 10–50) — user 2026-10-29 "ส่วนข้อความเล็กลง"; ส่วนหลัก = ที่เหลือ
  const bottomPct = Math.max(10, Math.min(50, Number(params.get("bottom")) || 18));
  const MAIN_H = 1 - bottomPct / 100;
  const zoneItems = (z) => list.filter((it) => (Number(it.zone) || 1) === z);
  const shared = { images, setImages, colorImgs, queue, log, sound, cashPrice: (id) => cashPrice(id), colorRow: (id) => colorRow(id) };

  // ราคาเงินสดของกลุ่มสาขา สำหรับ color_id
  const cashPrice = (colorId) => {
    const row = master.colors.find((c) => String(c.color_id) === String(colorId));
    if (!row) return null;
    const pt = master.priceTypes.find((p) => { const n = text(p.type_name); return n.includes(priceGroup) && n.includes("เงินสด"); });
    if (!pt) return null;
    const ptId = pt.price_type_id || pt.type_id;
    const pr = master.prices.find((x) => String(x.type_id) === String(row.type_id) && String(x.price_type_id) === String(ptId));
    return pr ? Number(pr.amount || 0) : null;
  };
  const colorRow = (colorId) => master.colors.find((c) => String(c.color_id) === String(colorId)) || null;

  const timeStr = clock.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const dateStr = clock.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b1220", color: "#fff", overflow: "hidden", fontFamily: "'Noto Sans Thai', 'Sarabun', Tahoma, sans-serif", cursor: cursorOn ? "default" : "none" }}>
      {split === 1 ? (
        <Rotator items={list} shared={shared} onIndex={(idx, n, cur) => setPos({ idx, n, cur })} />
      ) : split === 3 ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${MAIN_H * 100}%`, overflow: "hidden", background: "#0b1220" }}>
            <div style={{ zoom: MAIN_H, width: `${100 / MAIN_H}vw`, height: "100vh", position: "relative" }}>
              <Rotator items={zoneItems(1)} shared={shared} />
            </div>
          </div>
          <BottomText items={zoneItems(3)} top={MAIN_H} scale={bottomPct / 25} />
          <Pip items={zoneItems(2)} images={images} />
        </>
      ) : bands.map((f, i) => {
        const top = bands.slice(0, i).reduce((a, b) => a + b, 0);
        return (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: `${top * 100}%`, height: `${f * 100}%`, overflow: "hidden", borderBottom: i < bands.length - 1 ? "0.4vh solid #111827" : "none", background: "#0b1220" }}>
            <div style={{ zoom: f, width: `${100 / f}vw`, height: "100vh", position: "relative" }}>
              <Rotator items={zoneItems(i + 1)} shared={shared} />
            </div>
          </div>
        );
      })}
      {debug && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "rgba(0,0,0,.75)", color: "#9ae6b4", fontSize: "1.6vh", fontFamily: "monospace", padding: "0.8vh 1vw", whiteSpace: "pre-wrap", wordBreak: "break-all", zIndex: 9 }}>
          {`UA: ${navigator.userAgent}\nwin ${window.innerWidth}x${window.innerHeight} dpr ${window.devicePixelRatio} · slides ${list.length} · split ${split} · cur #${pos.cur?.id} ${pos.cur?.kind}\n`}{dbg.join("\n")}
        </div>
      )}
      {/* แถบล่าง: เวลา/วันที่ + จุดบอกลำดับสไลด์ (จุดเฉพาะโหมดเต็มจอ) */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "1.2vh 2.5vw", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(transparent, rgba(0,0,0,.55))", fontSize: "2.2vh", pointerEvents: "none" }}>
        <span style={{ opacity: .9 }}>{dateStr}</span>
        <span style={{ display: "flex", gap: "0.6vh" }}>
          {split === 1 && Array.from({ length: pos.n }).map((_, i) => <span key={i} style={{ width: "1.1vh", height: "1.1vh", borderRadius: "50%", background: i === pos.idx ? "#fbbf24" : "rgba(255,255,255,.35)" }} />)}
        </span>
        <span style={{ fontWeight: 700, fontSize: "3vh" }}>{timeStr} น.</span>
      </div>
    </div>
  );
}

// หมุนรายการตาม duration_sec ของแต่ละสไลด์ (ไม่ใช้ fade — WebView ป้าย 972S ค้างจอดำหลังเฟด 2026-10-28)
function useRotation(list) {
  const [idx, setIdx] = useState(0);
  const cur = list[Math.min(idx, Math.max(0, list.length - 1))];
  useEffect(() => {
    if (!list.length) return;
    const sec = Math.max(3, Number(cur?.duration_sec) || 10);
    const t = setTimeout(() => setIdx((i) => (i + 1) % list.length), sec * 1000);
    return () => clearTimeout(t);
  }, [idx, list.length, cur?.duration_sec]);
  useEffect(() => { if (idx >= list.length) setIdx(0); }, [list.length]); // eslint-disable-line
  const next = () => setIdx((i) => (i + 1) % Math.max(1, list.length));
  return { cur, idx: Math.min(idx, Math.max(0, list.length - 1)), n: list.length, next };
}

// ส่วนหลัก: หมุนสไลด์ทุกชนิด; ไม่มีสไลด์ → หน้า idle ชื่อร้าน
function Rotator({ items, shared, onIndex }) {
  const list = items.length ? items : [{ id: 0, kind: "idle", duration_sec: 30 }];
  const { cur, idx, next } = useRotation(list);
  useEffect(() => { onIndex && onIndex(idx, list.length, cur); }, [idx, list.length]); // eslint-disable-line
  const { images, setImages, colorImgs, queue, log, sound, cashPrice, colorRow } = shared;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {cur.kind === "image" && <ImageSlide it={cur} src={images[`${cur.id}@${cur.updated_at}`]} log={log} onFallback={(dataUrl) => setImages((p) => ({ ...p, [`${cur.id}@${cur.updated_at}`]: dataUrl }))} />}
      {cur.kind === "video" && <VideoSlide it={cur} src={cur.has_image ? images[`${cur.id}@${cur.updated_at}`] : text(cur.payload?.url)} sound={sound} log={log} onEnded={list.length > 1 ? next : undefined} />}
      {cur.kind === "vehicle" && <VehicleSlide it={cur} img={colorImgs[cur.color_id]} price={cashPrice(cur.color_id)} row={colorRow(cur.color_id)} />}
      {cur.kind === "queue" && <QueueSlide it={cur} queue={queue} />}
      {cur.kind === "line" && <LineSlide it={cur} />}
      {cur.kind === "text" && <TextSlide it={cur} />}
      {cur.kind === "idle" && <IdleSlide />}
    </div>
  );
}

// ส่วน 3 (split=3): แถบข้อความด้านล่าง — สไลด์ชนิด "ประกาศข้อความ" ที่ใส่ในเมนู หมุนทีละข้อความ (ชนิดอื่นในส่วนนี้แสดงเป็นหัวข้อ)
function BottomText({ items, top, scale = 1 }) {
  const { cur } = useRotation(items);
  const body = cur ? (cur.kind === "text" ? text(cur.payload?.text) : "") : "";
  const title = cur ? text(cur.title) : "";
  const fs = (v) => `${(v * Math.max(0.6, Math.min(1.3, scale))).toFixed(2)}vh`;   // ขนาดตัวอักษรตามความสูงแถบ
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: `${top * 100}%`, bottom: 0, background: "linear-gradient(180deg, #7c2d12, #431407)", borderTop: "0.5vh solid #fbbf24", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "1.2vh 4vw 6vh", overflow: "hidden" }}>
      {!cur && <div style={{ fontSize: fs(2.4), opacity: .5 }}>— ใส่ "ประกาศข้อความ" เลือกส่วน "ข้อความด้านล่าง" ในเมนู —</div>}
      {title && <div style={{ fontSize: fs(4.2), fontWeight: 900, lineHeight: 1.3, marginBottom: body ? "0.8vh" : 0 }}>{title}</div>}
      {body && <div style={{ fontSize: fs(3.4), lineHeight: 1.4, whiteSpace: "pre-wrap", fontWeight: 600 }}>{body}</div>}
    </div>
  );
}

// ส่วน 2 (split=3): รูปเล็กมุมขวาบน — เฉพาะสไลด์รูปภาพในส่วนนี้ หมุนตามเวลา
function Pip({ items, images }) {
  const imgs = items.filter((it) => it.kind === "image" && it.has_image);
  const { cur } = useRotation(imgs);
  if (!cur) return null;
  const src = images[`${cur.id}@${cur.updated_at}`];
  return (
    <div style={{ position: "absolute", top: "1.5vh", right: "1.5vw", width: "30vw", height: "22vh", background: "#000", border: "0.4vh solid rgba(255,255,255,.85)", borderRadius: "1.5vh", overflow: "hidden", boxShadow: "0 1vh 3vh rgba(0,0,0,.6)", zIndex: 5 }}>
      {src && <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
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

function ImageSlide({ it, src, log, onFallback }) {
  if (src === "none") return <TextSlide it={{ title: it.title, payload: { text: "ไม่มีรูป" } }} />;
  // ลิงก์ตรงโหลดไม่ได้ (WebView เก่า/ใบรับรอง) → สำรอง: ดึง base64 ผ่าน POST get_image แล้วใส่เป็น data URL
  const onError = async () => {
    log && log(`img #${it.id} ERROR ${String(src).slice(0, 60)}`);
    if (String(src).startsWith("data:")) return;
    try {
      const r = await post(SIGNAGE_API, { action: "get_image", id: it.id });
      const rec = Array.isArray(r) ? r[0] : r;
      if (rec?.image_base64) { onFallback && onFallback("data:image/jpeg;base64," + rec.image_base64.replace(/^data:[^,]+,/, "")); log && log(`img #${it.id} fallback base64 ${Math.round(rec.image_base64.length / 1024)}KB`); }
      else log && log(`img #${it.id} fallback: no data`);
    } catch (e) { log && log(`img #${it.id} fallback failed ${e?.message || e}`); }
  };
  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      {src ? <img src={src} alt="" onLoad={(e) => log && log(`img #${it.id} loaded ${e.currentTarget.naturalWidth}x${e.currentTarget.naturalHeight}`)} onError={onError} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} /> : <div style={{ display: "grid", placeItems: "center", height: "100%", opacity: .6, fontSize: "3vh" }}>กำลังโหลดรูป…</div>}
      {it.title && <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "2vh 3vw", fontSize: "4vh", fontWeight: 800, textShadow: "0 2px 12px #000", background: "linear-gradient(rgba(0,0,0,.55), transparent)" }}>{it.title}</div>}
    </div>
  );
}

// สไลด์วิดีโอ (user 2026-10-29): ไฟล์ในระบบผ่าน webhook signage-image (video/mp4) หรือลิงก์ภายนอก payload.url
// เล่นจบ → ไปสไลด์ถัดไปทันที (ถ้ามีสไลด์เดียวเล่นวน); ตัวจับเวลาของ useRotation ยังเดินตาม duration_sec เป็นเพดานกันค้างเมื่อโหลดไม่ขึ้น
function VideoSlide({ it, src, sound, log, onEnded }) {
  const [errSrc, setErrSrc] = useState(null);   // src ที่เล่นไม่ได้ (เปลี่ยน src = ลองใหม่)
  const [state, setState] = useState("loading");   // loading | playing | blocked
  const [lines, setLines] = useState([]);   // log ของวิดีโอนี้ โชว์ใต้ข้อความกำลังโหลด (ถ่ายรูปจอส่งมาดูได้ ไม่ต้องเปิด debug)
  const ref = useRef(null);
  const err = !!src && errSrc === src;
  // ป้าย 972S (WebView Android 9) จอดำตรงสไลด์วิดีโอ 2026-10-29 → บังคับ muted เป็น attribute + สั่ง play() เอง + log เหตุผลที่เล่นไม่ได้; ไม่เล่นใน 20 วิ → ข้าม
  useEffect(() => {
    const el = ref.current; if (!el || !src || err) return;
    const log0 = log; log = (m) => { log0 && log0(m); setLines((p) => [...p.slice(-3), new Date().toLocaleTimeString("th-TH") + " " + m.replace(`video #${it.id} `, "")]); };
    el.muted = !sound; if (!sound) el.setAttribute("muted", ""); el.defaultMuted = !sound;
    let done = false;
    const tryPlay = (why) => { const pr = el.play(); if (pr && pr.catch) pr.catch((e) => { log && log(`video #${it.id} play() ${why} rejected: ${e?.name || e}`); if (e?.name === "NotAllowedError") setState("blocked"); }); };
    const onPlaying = () => { done = true; setState("playing"); log && log(`video #${it.id} playing ${el.videoWidth}x${el.videoHeight} rs=${el.readyState}`); };
    const onMeta = () => { log && log(`video #${it.id} metadata ${el.videoWidth}x${el.videoHeight} dur=${Math.round(el.duration || 0)}`); };
    const onCanPlay = () => { log && log(`video #${it.id} canplay rs=${el.readyState}`); if (el.paused) tryPlay("canplay"); };
    const onStall = (ev) => log && log(`video #${it.id} ${ev.type} rs=${el.readyState} ns=${el.networkState} t=${el.currentTime.toFixed(1)}`);
    el.addEventListener("playing", onPlaying); el.addEventListener("loadedmetadata", onMeta); el.addEventListener("canplay", onCanPlay);
    el.addEventListener("stalled", onStall); el.addEventListener("waiting", onStall); el.addEventListener("suspend", onStall);
    tryPlay("mount");
    const watchdog = setTimeout(() => {
      if (done) return;
      log && log(`video #${it.id} watchdog: not playing after 20s rs=${el.readyState} ns=${el.networkState} err=${el.error?.code || 0} → skip`);
      onEnded && onEnded();
    }, 20000);
    return () => { clearTimeout(watchdog); el.removeEventListener("playing", onPlaying); el.removeEventListener("loadedmetadata", onMeta); el.removeEventListener("canplay", onCanPlay); el.removeEventListener("stalled", onStall); el.removeEventListener("waiting", onStall); el.removeEventListener("suspend", onStall); };
  }, [src, err]); // eslint-disable-line
  if (!src || err) return <TextSlide it={{ title: it.title || "วิดีโอ", payload: { text: err ? "เล่นวิดีโอไม่ได้" : "กำลังโหลดวิดีโอ…" } }} />;
  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      <video key={src} ref={ref} src={src} autoPlay muted={!sound} playsInline loop={!onEnded} preload="auto"
        onEnded={() => { log && log(`video #${it.id} ended`); onEnded && onEnded(); }}
        onError={(e) => { const er = e.currentTarget.error; log && log(`video #${it.id} ERROR code=${er?.code} ${er?.message || ""} ${String(src).slice(0, 60)}`); setErrSrc(src); }}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      {state !== "playing" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: "0 6vw" }}>
          <div>
            <div style={{ fontSize: "4.5vh", fontWeight: 800 }}>{it.title || "วิดีโอ"}</div>
            <div style={{ fontSize: "3vh", opacity: .75, marginTop: "1.5vh" }}>{state === "blocked" ? "เครื่องนี้ไม่อนุญาตให้เล่นวิดีโออัตโนมัติ" : "กำลังโหลดวิดีโอ…"}</div>
            <div style={{ fontSize: "1.6vh", opacity: .5, marginTop: "3vh", fontFamily: "monospace", textAlign: "left", whiteSpace: "pre-wrap" }}>{lines.join("\n")}</div>
          </div>
        </div>
      )}
      {it.title && state === "playing" && <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "2vh 3vw", fontSize: "4vh", fontWeight: 800, textShadow: "0 2px 12px #000", background: "linear-gradient(rgba(0,0,0,.55), transparent)" }}>{it.title}</div>}
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
