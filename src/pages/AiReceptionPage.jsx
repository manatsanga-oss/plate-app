import React, { useEffect, useMemo, useRef, useState } from "react";

// พนักงานต้อนรับ AI สำหรับลูกค้า (public ไม่ต้อง login) — เปิดบนแท็บเล็ตหน้าร้าน: /ai-reception?branch=SCY06
// เปิดมาเป็นมาสคอตร้าน (ภาพ public/mascot-pp.webp) เต็มจอ ขยับปาก/กะพริบตาตามที่พูด · ลูกค้ากดไมค์แล้วพูด (Chrome แปลงเสียงไทย) หรือแตะคำถามยอดนิยม
// คำตอบมาจาก n8n webhook ai-reception-api (Claude + ข้อมูลร้าน) — ถ้ายังไม่เชื่อมต่อ จะตอบแบบสาธิต
const AI_API = "https://n8n-new-project-gwf2.onrender.com/webhook/ai-reception-api";

const BRANCH_INFO = {
  SCY01: { shop: "สิงห์ชัย", name: "น้องสิงห์" },
  SCY06: { shop: "ป.เปา มอเตอร์", name: "น้องปอเปา" },
};
const QUICK = ["ราคารถรุ่นใหม่", "โปรโมชั่นเดือนนี้", "เช็กสถานะรถซ่อม", "ร้านเปิดกี่โมง", "ออกรถใช้เอกสารอะไร"];

// รูปปาก (viseme) บนภาพมาสคอตจริง (พิกัดตามภาพ public/mascot-pp.webp 860x940): ขอบบน = เส้นยิ้มเดิมของตัวการ์ตูน แล้วอ้าลงด้านล่าง
const SMILE_TOP = "M 310 482 Q 358 532 453 474";
const MOUTHS = {
  rest: null, closed: null,                                   // ปากปิด = ใช้รอยยิ้มเดิมในภาพ
  mid: SMILE_TOP + " Q 366 578 310 482 Z",
  open: SMILE_TOP + " Q 370 646 310 482 Z",
  wide: SMILE_TOP + " Q 366 604 310 482 Z",
  round: "M 352 500 Q 380 486 408 498 Q 420 526 384 548 Q 346 530 352 500 Z",
};
function visemeOf(ch) {
  if (!ch || /[\s.,!?…]/.test(ch)) return "closed";
  if ("มบปพภผฟ".includes(ch)) return "closed";
  if ("าะัๅ".includes(ch)) return "open";
  if ("อโูุวํ".includes(ch)) return "round";
  if ("ีิึืเแไใ็".includes(ch)) return "wide";
  if (/[aAอ]/.test(ch)) return "open";
  if (/[oOuUwW]/.test(ch)) return "round";
  if (/[eEiIyY]/.test(ch)) return "wide";
  return "mid";
}

// มาสคอตร้าน (ภาพจริง) + ปากขยับ/กะพริบตาวาดทับ — พิกัดตามภาพ 860x940
function Face({ mouth, blink, mood }) {
  const d = MOUTHS[mouth];
  return (
    <svg viewBox="0 0 860 940" className="air-face" style={{ height: "auto", filter: "drop-shadow(0 14px 26px rgba(0,0,0,.35))", animation: mood === "speaking" ? "mascotTalk 1.6s ease-in-out infinite" : "mascotIdle 4s ease-in-out infinite" }}>
      <defs>
        <clipPath id="mouthClip">{d && <path d={d} />}</clipPath>
        <radialGradient id="lid" cx="50%" cy="35%" r="70%"><stop offset="0" stopColor="#f0b98c" /><stop offset="1" stopColor="#dc9c6c" /></radialGradient>
      </defs>
      <image href="/mascot-pp.webp" x="0" y="0" width="860" height="940" />
      {/* ปาก: ช่องปากสีเข้ม + ฟันบน + ลิ้น (ตัดขอบตามรูปปาก) */}
      {d && (
        <g>
          <path d={d} fill="#5a1418" stroke="#7b2a22" strokeWidth="4" strokeLinejoin="round" />
          <g clipPath="url(#mouthClip)">
            <path d="M 318 486 Q 360 524 446 482 L 446 498 Q 366 536 318 500 Z" fill="#fffaf2" />
            <ellipse cx="380" cy={mouth === "open" ? 592 : 566} rx="44" ry="26" fill="#e2616a" />
          </g>
        </g>
      )}
      {/* กะพริบตา: เปลือกตาสีผิวปิดทับ + เส้นขนตา */}
      {blink && (
        <g>
          <ellipse cx="300" cy="386" rx="50" ry="46" fill="url(#lid)" />
          <ellipse cx="466" cy="380" rx="56" ry="50" fill="url(#lid)" />
          <path d="M 256 396 Q 300 420 344 392" stroke="#5a3520" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M 416 392 Q 466 418 516 386" stroke="#5a3520" strokeWidth="7" fill="none" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

export default function AiReceptionPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  // branch อาจมาเป็นรหัส (SCY06) หรือชื่อสาขา/ค่าที่ไม่รู้จัก → จัดเข้าร้านให้ถูก (ไม่รู้จัก = ป.เปา)
  const rawBranch = (params.get("branch") || "").trim().toUpperCase();
  const isCode = /^SCY\d+$/.test(rawBranch);
  const branch = isCode ? rawBranch : (/สิงห์|SING/.test(rawBranch) ? "SCY01" : "SCY06");
  const info = BRANCH_INFO[branch] || (/^SCY0[56]$/.test(branch) || !isCode ? BRANCH_INFO.SCY06 : BRANCH_INFO.SCY01);
  const aiName = params.get("name") || info.name;

  const [started, setStarted] = useState(false);
  const [mood, setMood] = useState("idle");          // idle | listening | thinking | speaking
  const [mouth, setMouth] = useState("rest");
  const [blink, setBlink] = useState(false);
  const [heard, setHeard] = useState("");
  const [answer, setAnswer] = useState("");
  const [demo, setDemo] = useState(false);
  const [showType, setShowType] = useState(false);   // ช่องพิมพ์คำถาม (เมื่อไมค์ใช้ไม่ได้)
  const [typed, setTyped] = useState("");
  const recRef = useRef(null);
  const lipTimer = useRef(null);
  const historyRef = useRef([]);
  const sessionId = useMemo(() => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), []);

  // กะพริบตาแบบสุ่ม
  useEffect(() => {
    let t; const loop = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 140); loop(); }, 2200 + Math.random() * 2600); };
    loop(); return () => clearTimeout(t);
  }, []);
  useEffect(() => () => { window.speechSynthesis?.cancel(); clearInterval(lipTimer.current); try { recRef.current?.abort(); } catch { /* ignore */ } }, []);

  // ขยับปากตามข้อความที่กำลังพูด: ไล่ตัวอักษรตามความเร็วพูด (ถ้าเบราว์เซอร์ส่ง boundary event จะปรับตำแหน่งให้ตรงคำ)
  function startLip(text, rate) {
    clearInterval(lipTimer.current);
    const chars = Array.from(text); let i = 0; const cps = 13 * rate;       // ภาษาไทย ~13 ตัวอักษร/วิ ที่ rate 1
    lipTimer.current = setInterval(() => { if (i >= chars.length) { i = chars.length - 1; } setMouth(visemeOf(chars[i])); i++; }, 1000 / cps);
    return (charIndex) => { if (typeof charIndex === "number" && charIndex > i) i = charIndex; };
  }
  function stopLip() { clearInterval(lipTimer.current); setMouth("rest"); }

  function speak(text) {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth) { setAnswer(text); resolve(); return; }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      const th = voices.find(v => /th[-_]TH/i.test(v.lang) && /male|ชาย|Niwat|Pattara/i.test(v.name)) || voices.find(v => /th[-_]TH/i.test(v.lang));
      if (th) u.voice = th;
      u.lang = "th-TH"; u.rate = 1.05; u.pitch = 1.25;   // เสียงเด็กผู้ชายสดใส (มาสคอต)
      let sync = null;
      u.onstart = () => { setMood("speaking"); sync = startLip(text, u.rate); };
      u.onboundary = (e) => { if (sync) sync(e.charIndex); };
      const done = () => { stopLip(); setMood("idle"); resolve(); };
      u.onend = done; u.onerror = done;
      setAnswer(text);
      synth.speak(u);
    });
  }

  // คำตอบสาธิต (ใช้เมื่อ webhook ยังไม่พร้อม)
  function demoAnswer(q) {
    if (/เปิด|ปิด|กี่โมง/.test(q)) return "ร้านเปิดทุกวัน แปดโมงครึ่งถึงห้าโมงเย็นครับ ศูนย์บริการรับรถคันสุดท้ายสี่โมงครึ่งนะครับ";
    if (/เอกสาร|ออกรถ/.test(q)) return "ออกรถใช้บัตรประชาชนตัวจริงกับทะเบียนบ้านครับ ถ้าผ่อนไฟแนนซ์ เพิ่มสลิปเงินเดือนหรือหลักฐานรายได้ด้วยนะครับ";
    if (/โปร|ของแถม/.test(q)) return "เดือนนี้มีโปรโมชั่นหลายรุ่นเลยครับ เดี๋ยวพนักงานขายจะแจ้งรายละเอียดของแถมและดาวน์ให้นะครับ";
    if (/ซ่อม|คิว|สถานะ/.test(q)) return "ขอทราบเลขทะเบียนรถ และเบอร์โทรสี่ตัวท้ายได้ไหมครับ จะเช็กสถานะงานซ่อมให้ครับ";
    if (/ราคา/.test(q)) return "สนใจรุ่นไหนครับ บอกชื่อรุ่นได้เลย จะแจ้งราคาและสีที่มีให้ครับ";
    return "ขออภัยครับ ตอนนี้ระบบข้อมูลยังเชื่อมต่อไม่ครบ เดี๋ยวเรียกพนักงานมาดูแลให้นะครับ";
  }

  async function ask(q) {
    const question = (q || "").trim(); if (!question) return;
    window.speechSynthesis?.cancel(); stopLip();
    setHeard(question); setAnswer(""); setMood("thinking"); setMouth("closed");
    let text = "";
    try {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(AI_API, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({ action: "ask", branch_code: branch, session_id: sessionId, question, history: historyRef.current.slice(-8) }) });
      clearTimeout(to);
      if (!res.ok) throw new Error("http " + res.status);
      const data = await res.json(); const row = Array.isArray(data) ? data[0] : data;
      text = String(row?.answer || "").trim();
      if (!text) throw new Error("empty");
      setDemo(false);
    } catch {
      text = demoAnswer(question); setDemo(true);
    }
    historyRef.current.push({ role: "user", content: question }, { role: "assistant", content: text });
    await speak(text);
  }

  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setShowType(true); setAnswer("เบราว์เซอร์นี้ไม่รองรับการฟังเสียง (เช่น เปิดจากในแอป LINE) กรุณาเปิดลิงก์ด้วย Chrome หรือพิมพ์คำถามด้านล่างครับ"); return; }
    if (mood === "listening") { try { recRef.current?.stop(); } catch { /* ignore */ } return; }
    window.speechSynthesis?.cancel(); stopLip();
    const rec = new SR(); recRef.current = rec;
    rec.lang = "th-TH"; rec.interimResults = true; rec.maxAlternatives = 1;
    let finalText = ""; let lastText = ""; let failed = false;
    rec.onstart = () => { setMood("listening"); setHeard(""); setAnswer(""); };
    rec.onresult = (e) => { let s = ""; for (const r of e.results) s += r[0].transcript; lastText = s; setHeard(s); if (e.results[e.results.length - 1].isFinal) finalText = s; };
    rec.onerror = (e) => {
      const code = e?.error || "";
      if (code === "aborted") return;
      failed = true; setMood("idle");
      if (code === "no-speech") { setAnswer("ไม่ได้ยินเสียงครับ กดไมค์แล้วพูดอีกครั้งนะครับ"); return; }
      setShowType(true);
      if (code === "not-allowed" || code === "service-not-allowed") setAnswer("ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน กรุณากดอนุญาตไมค์ของเว็บนี้ในเบราว์เซอร์ หรือพิมพ์คำถามด้านล่างครับ");
      else if (code === "audio-capture") setAnswer("ไม่พบไมโครโฟนในเครื่องนี้ พิมพ์คำถามด้านล่างได้เลยครับ");
      else if (code === "network") setAnswer("ระบบฟังเสียงเชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง หรือพิมพ์คำถามด้านล่างครับ");
      else setAnswer(`ใช้ไมค์ไม่ได้ (${code || "ไม่ทราบสาเหตุ"}) พิมพ์คำถามด้านล่างได้เลยครับ`);
    };
    rec.onend = () => { const t = (finalText || lastText).trim(); if (failed) return; if (t) ask(t); else setMood("idle"); };
    try { rec.start(); } catch (err) { setMood("idle"); setShowType(true); setAnswer(`เปิดไมค์ไม่ได้ (${err?.name || "error"}) พิมพ์คำถามด้านล่างได้เลยครับ`); }
  }

  async function start() {
    setStarted(true);
    window.speechSynthesis?.getVoices();
    await speak(`สวัสดีครับ ${aiName} ยินดีต้อนรับสู่ ${info.shop} ครับ มีอะไรให้ช่วยไหมครับ กดปุ่มไมค์แล้วพูดได้เลยครับ`);
  }

  const statusText = mood === "listening" ? "กำลังฟัง... พูดได้เลยครับ" : mood === "thinking" ? "กำลังหาคำตอบ..." : mood === "speaking" ? "" : "กดไมค์แล้วพูด หรือแตะคำถามด้านล่าง";
  const btn = { border: "none", borderRadius: 999, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div style={{ height: "100dvh", background: "radial-gradient(circle at 50% 30%, #1e4d8f 0%, #0b2447 60%, #061528 100%)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden", fontFamily: "'Sarabun','Leelawadee UI',sans-serif", userSelect: "none" }}>
      <style>{".air-face{width:min(52vh,84vw)}.air-shop{font-size:22px}.air-sub{font-size:16px}.air-heard,.air-status{font-size:20px}.air-answer{font-size:26px}.air-chips{flex-wrap:wrap;justify-content:center}.air-chip{font-size:18px;padding:10px 18px}.air-mic{width:92px;height:92px;font-size:40px}.air-start{font-size:30px;padding:16px 36px}"
        + "@media (max-width:640px),(max-height:560px){.air-face{width:min(42dvh,76vw)}.air-shop{font-size:17px}.air-sub{font-size:12px}.air-heard,.air-status{font-size:15px}.air-answer{font-size:17px}.air-chips{flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;width:100%;scrollbar-width:none}.air-chips::-webkit-scrollbar{display:none}.air-chip{font-size:15px;padding:8px 14px}.air-mic{width:68px;height:68px;font-size:30px}.air-start{font-size:20px;padding:14px 24px}}"
        + "@keyframes mascotIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes mascotTalk{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-4px) rotate(-1deg)}75%{transform:translateY(-2px) rotate(1deg)}}"}</style>
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", gap: 10, boxSizing: "border-box", flexShrink: 0 }}>
        <div className="air-shop" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{info.shop}</div>
        <div className="air-sub" style={{ opacity: .8, textAlign: "right" }}>{aiName} · ผู้ช่วยต้อนรับ{demo ? " (โหมดสาธิต)" : ""}</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", position: "relative" }}>
        <div style={{ flexShrink: 0, transform: mood === "listening" ? "scale(1.03)" : "scale(1)", transition: "transform .3s" }}>
          <Face mouth={mouth} blink={blink} mood={mood} />
        </div>
        {/* กล่องข้อความ: สิ่งที่ได้ยิน + คำตอบ */}
        <div style={{ width: "min(900px, 92vw)", minHeight: 48, flex: "0 1 auto", overflowY: "auto", marginTop: 6, textAlign: "center" }}>
          {heard && <div className="air-heard" style={{ opacity: .75, marginBottom: 6 }}>“{heard}”</div>}
          {answer && <div className="air-answer" style={{ lineHeight: 1.45, background: "rgba(255,255,255,.1)", borderRadius: 18, padding: "12px 20px", display: "inline-block" }}>{answer}</div>}
          {!answer && statusText && <div className="air-status" style={{ opacity: .7 }}>{statusText}</div>}
        </div>
      </div>

      <div style={{ width: "100%", padding: "8px 14px calc(14px + env(safe-area-inset-bottom))", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div className="air-chips" style={{ display: "flex", gap: 10 }}>
          {QUICK.map(q => (
            <button key={q} onClick={() => ask(q)} disabled={mood === "thinking"} className="air-chip" style={{ ...btn, whiteSpace: "nowrap", flexShrink: 0, background: "rgba(255,255,255,.14)", color: "#fff" }}>{q}</button>
          ))}
        </div>
        {showType && (
          <form onSubmit={(e) => { e.preventDefault(); const t = typed; setTyped(""); ask(t); }} style={{ display: "flex", gap: 8, width: "min(560px, 100%)" }}>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="พิมพ์คำถามที่นี่..." style={{ flex: 1, minWidth: 0, fontSize: 16, padding: "10px 14px", borderRadius: 999, border: "none", fontFamily: "inherit", userSelect: "text" }} />
            <button type="submit" disabled={mood === "thinking" || !typed.trim()} style={{ ...btn, padding: "10px 18px", fontSize: 16, background: "#2e7d32", color: "#fff" }}>ถาม</button>
          </form>
        )}
        <button onClick={listen} disabled={mood === "thinking"} className="air-mic" style={{ ...btn, flexShrink: 0, color: "#fff", background: mood === "listening" ? "#e53935" : "#2e7d32", boxShadow: mood === "listening" ? "0 0 0 12px rgba(229,57,53,.25)" : "0 6px 18px rgba(0,0,0,.4)", transition: "all .2s" }} title="กดแล้วพูด">
          {mood === "listening" ? "■" : "🎤"}
        </button>
      </div>

      {!started && (
        <div onClick={start} style={{ position: "fixed", inset: 0, background: "rgba(6,21,40,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "12vh", cursor: "pointer" }}>
          <div className="air-start" style={{ fontWeight: 700, background: "#2e7d32", borderRadius: 999, textAlign: "center", margin: "0 16px", boxShadow: "0 8px 24px rgba(0,0,0,.45)" }}>แตะหน้าจอเพื่อเริ่มคุยกับ{aiName}</div>
        </div>
      )}
    </div>
  );
}
