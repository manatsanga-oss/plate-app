import React, { useEffect, useMemo, useRef, useState } from "react";

// พนักงานต้อนรับ AI สำหรับลูกค้า (public ไม่ต้อง login) — เปิดบนแท็บเล็ตหน้าร้าน: /ai-reception?branch=SCY06
// เปิดมาเป็นมาสคอตร้าน (ภาพ public/mascot-pp.webp) เต็มจอ ขยับปาก/กะพริบตาตามที่พูด · ลูกค้ากดไมค์แล้วพูด (Chrome แปลงเสียงไทย) หรือแตะคำถามยอดนิยม
// คำตอบมาจาก n8n webhook ai-reception-api (OpenAI + ข้อมูลร้าน) — ถ้ายังไม่เชื่อมต่อ จะตอบแบบสาธิต
// โหมดเริ่มต้น (user 2026-10-02) = "ลูกค้าจำลอง": น้องเปาเปาสวมบทลูกค้า ถามพนักงานขายทีละคำถาม (action sim_next) แล้วเก็บคำตอบพนักงานลง ai_reception_sim_logs
// โหมดเดิม (ตอบคำถามลูกค้า) เปิดด้วย ?mode=answer
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const AI_API = "https://n8n-new-project-gwf2.onrender.com/webhook/ai-reception-api";

const BRANCH_INFO = {
  SCY01: { shop: "สิงห์ชัย", shopEn: "Singchai Motor", name: "น้องสิงห์" },
  SCY06: { shop: "ป.เปา มอเตอร์", shopEn: "P.Pao Motor", name: "น้องเปาเปา" },
};

// ภาษา (user 2026-10-10): ไทย/อังกฤษ/จีน/พม่า — เปลี่ยนทั้งเสียงฟัง (stt) เสียงพูด (tts) และภาษาคำตอบของ AI (ส่ง lang ไป ai-reception-api)
// เสียงพูดขึ้นกับเครื่อง: ถ้าเครื่องไม่มีเสียงภาษานั้น (มักเป็นพม่า) จะแสดงเป็นข้อความอย่างเดียว · cps = ตัวอักษร/วินาที ใช้ขยับปาก
const LANGS = [
  { id: "th", flag: "🇹🇭", label: "ไทย", tts: "th-TH", stt: "th-TH", voice: /^th[-_]/i, cps: 13 },
  { id: "en", flag: "🇬🇧", label: "English", tts: "en-US", stt: "en-US", voice: /^en[-_]/i, cps: 14 },
  { id: "zh", flag: "🇨🇳", label: "中文", tts: "zh-CN", stt: "cmn-Hans-CN", voice: /^(zh[-_](CN|Hans)|cmn)/i, cps: 5 },
  { id: "my", flag: "🇲🇲", label: "မြန်မာ", tts: "my-MM", stt: "my-MM", voice: /^my[-_]/i, cps: 10 },
];
const LANG_BY = Object.fromEntries(LANGS.map(l => [l.id, l]));

// ข้อความบนจอโหมดตอบลูกค้า (โหมดฝึกพนักงานใช้ภาษาไทยเสมอ เปลี่ยนแค่ภาษาของลูกค้าจำลอง)
const T = {
  th: {
    quick: ["ราคารถรุ่นใหม่", "โปรโมชั่นเดือนนี้", "เช็กสถานะรถซ่อม", "ร้านเปิดกี่โมง", "ออกรถใช้เอกสารอะไร"],
    greet: (ai, info) => `สวัสดีครับ ${ai} ยินดีต้อนรับสู่ ${info.shop} ครับ มีอะไรให้ช่วยไหมครับ กดปุ่มไมค์แล้วพูดได้เลยครับ`,
    start: (ai) => `แตะหน้าจอเพื่อเริ่มคุยกับ${ai}`,
    listening: "กำลังฟัง... พูดได้เลยครับ", thinking: "กำลังหาคำตอบ...", idle: "กดไมค์แล้วพูด หรือแตะคำถามด้านล่าง",
    typePh: "พิมพ์คำถามที่นี่...", askBtn: "ถาม", micTitle: "กดแล้วพูด", sub: "ผู้ช่วยต้อนรับ", demo: " (โหมดสาธิต)",
    noSpeech: "ไม่ได้ยินเสียงครับ กดไมค์แล้วพูดอีกครั้งนะครับ",
    noMic: "ใช้ไมค์ไม่ได้ในเครื่องนี้ พิมพ์คำถามด้านล่างได้เลยครับ",
    noSR: "เบราว์เซอร์นี้ไม่รองรับการฟังเสียง (เช่น เปิดจากในแอป LINE) กรุณาเปิดลิงก์ด้วย Chrome หรือพิมพ์คำถามด้านล่างครับ",
    baht: "บาท", colors: "สี", noImg: "ไม่มีรูป", loading: "กำลังโหลด...",
    pick: (x) => `สนใจ ${x.series} รุ่นย่อย ${x.type}`,
    fallback: "ขออภัยครับ ตอนนี้ระบบข้อมูลยังเชื่อมต่อไม่ครบ เดี๋ยวเรียกพนักงานมาดูแลให้นะครับ",
  },
  en: {
    quick: ["New model prices", "This month's promotions", "Repair status", "Opening hours", "Documents to buy a bike"],
    greet: (ai, info) => `Hello and welcome to ${info.shopEn}! How can I help you? Press the microphone button and speak.`,
    start: () => "Tap the screen to start",
    listening: "Listening... go ahead and speak", thinking: "Finding an answer...", idle: "Press the mic and speak, or tap a question below",
    typePh: "Type your question here...", askBtn: "Ask", micTitle: "Press and speak", sub: "Reception assistant", demo: " (demo mode)",
    noSpeech: "I didn't hear anything. Please press the mic and try again.",
    noMic: "The microphone isn't available on this device. Please type your question below.",
    noSR: "This browser can't listen to speech (e.g. inside the LINE app). Please open it in Chrome or type your question below.",
    baht: "baht", colors: "Colors", noImg: "No image", loading: "Loading...",
    pick: (x) => `I'm interested in the ${x.series} ${x.type}`,
    fallback: "Sorry, the system isn't fully connected right now. Let me call a staff member to help you.",
  },
  zh: {
    quick: ["新车价格", "本月促销", "维修进度", "营业时间", "购车需要什么证件"],
    greet: (ai, info) => `您好，欢迎光临 ${info.shopEn}！请问有什么可以帮您？请按麦克风按钮说话。`,
    start: () => "点击屏幕开始",
    listening: "正在听，请说话……", thinking: "正在查找答案……", idle: "按麦克风说话，或点击下方问题",
    typePh: "请在这里输入问题……", askBtn: "提问", micTitle: "按下说话", sub: "接待助手", demo: "（演示模式）",
    noSpeech: "没有听到声音，请再按麦克风说一次。",
    noMic: "此设备无法使用麦克风，请在下方输入问题。",
    noSR: "此浏览器不支持语音识别（例如在 LINE 应用内打开），请用 Chrome 打开或在下方输入问题。",
    baht: "泰铢", colors: "颜色", noImg: "暂无图片", loading: "加载中……",
    pick: (x) => `我对 ${x.series} ${x.type} 感兴趣`,
    fallback: "抱歉，系统暂时未完全连接，我请工作人员来为您服务。",
  },
  my: {
    quick: ["မော်တော်ဆိုင်ကယ်အသစ် ဈေးနှုန်း", "ဒီလ ပရိုမိုးရှင်း", "ပြုပြင်မှု အခြေအနေ", "ဆိုင်ဖွင့်ချိန်", "ဝယ်ရန် လိုအပ်သောစာရွက်စာတမ်း"],
    greet: (ai, info) => `မင်္ဂလာပါ ${info.shopEn} မှ ကြိုဆိုပါတယ်။ ဘာကူညီပေးရမလဲ။ မိုက်ခလုတ်ကိုနှိပ်ပြီး ပြောနိုင်ပါတယ်။`,
    start: () => "စတင်ရန် မျက်နှာပြင်ကို နှိပ်ပါ",
    listening: "နားထောင်နေပါတယ်... ပြောပါ", thinking: "အဖြေရှာနေပါတယ်...", idle: "မိုက်ကိုနှိပ်ပြီးပြောပါ သို့မဟုတ် အောက်ကမေးခွန်းကို နှိပ်ပါ",
    typePh: "မေးခွန်းကို ဒီမှာ ရိုက်ပါ...", askBtn: "မေးမည်", micTitle: "နှိပ်ပြီးပြောပါ", sub: "ဧည့်ကြိုလက်ထောက်", demo: " (စမ်းသပ်မုဒ်)",
    noSpeech: "အသံမကြားရပါ။ မိုက်ကိုနှိပ်ပြီး ထပ်ပြောပါ။",
    noMic: "ဒီစက်မှာ မိုက်သုံးလို့မရပါ။ အောက်မှာ မေးခွန်းရိုက်ပါ။",
    noSR: "ဒီဘရောက်ဆာက အသံမသိနိုင်ပါ (ဥပမာ LINE အက်ပ်ထဲ)။ Chrome ဖြင့်ဖွင့်ပါ သို့မဟုတ် အောက်မှာ ရိုက်ပါ။",
    baht: "ဘတ်", colors: "အရောင်", noImg: "ပုံမရှိ", loading: "ဖွင့်နေသည်...",
    pick: (x) => `${x.series} ${x.type} ကို စိတ်ဝင်စားပါတယ်`,
    fallback: "စိတ်မကောင်းပါဘူး၊ စနစ်က အပြည့်မချိတ်ဆက်ရသေးပါ။ ဝန်ထမ်းကို ခေါ်ပေးပါမယ်။",
  },
};

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
function Face({ mouth, blink, mood, small }) {
  const d = MOUTHS[mouth];
  return (
    <svg viewBox="0 0 860 940" className={"air-face" + (small ? " small" : "")} style={{ height: "auto", filter: "drop-shadow(0 14px 26px rgba(0,0,0,.35))", animation: mood === "speaking" ? "mascotTalk 1.6s ease-in-out infinite" : "mascotIdle 4s ease-in-out infinite" }}>
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

// ภาพรุ่นย่อย: ใช้รูปสีรถจาก moto_color_images (master-data-api get_color_image) โหลดครั้งเดียวต่อ color_id
const _imgCache = new Map(); // color_id → data URL | "none" | Promise
function VariantCard({ item, onPick, disabled, t }) {
  const [img, setImg] = useState(() => { const v = item.color_id ? _imgCache.get(item.color_id) : "none"; return typeof v === "string" ? v : null; });
  useEffect(() => {
    let alive = true;
    if (!item.color_id) return;
    const cached = _imgCache.get(item.color_id);
    if (typeof cached === "string") return;
    const pr = cached || fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_color_image", color_id: item.color_id }) })
      .then(r => r.json()).then(res => { const rec = Array.isArray(res) ? res[0] : res; const v = rec?.image_data || "none"; _imgCache.set(item.color_id, v); return v; })
      .catch(() => { _imgCache.set(item.color_id, "none"); return "none"; });
    if (!cached) _imgCache.set(item.color_id, pr);
    pr.then(v => { if (alive) setImg(v); });
    return () => { alive = false; };
  }, [item.color_id]);
  const price = item.price === null || item.price === undefined ? "" : Number(item.price).toLocaleString("en-US", { maximumFractionDigits: 0 }) + " " + t.baht;
  return (
    <button onClick={() => onPick(item)} disabled={disabled} className="air-card" style={{ border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0, background: "#fff", color: "#0b2447", borderRadius: 16, padding: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, boxShadow: "0 6px 16px rgba(0,0,0,.35)" }}>
      <div className="air-card-img" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f5f8", borderRadius: 10, overflow: "hidden" }}>
        {img && img !== "none" ? <img src={img} alt={item.type} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 13, opacity: .5 }}>{img === "none" ? t.noImg : t.loading}</span>}
      </div>
      <div className="air-card-name" style={{ fontWeight: 700, lineHeight: 1.2 }}>{[item.model, item.type].filter(Boolean).join(" ")}</div>
      {item.colors && <div style={{ fontSize: 11, opacity: .7, lineHeight: 1.2, maxHeight: 27, overflow: "hidden" }}>{t.colors}: {item.colors}</div>}
      {price && <div className="air-card-price" style={{ color: "#c62828", fontWeight: 700 }}>{price}</div>}
    </button>
  );
}

export default function AiReceptionPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  // branch อาจมาเป็นรหัส (SCY06) หรือชื่อสาขา/ค่าที่ไม่รู้จัก → จัดเข้าร้านให้ถูก (ไม่รู้จัก = ป.เปา)
  // ลิงก์จาก CRM อาจเป็น "SCY01 สำนักงานใหญ่" → ดึงรหัส SCY.. ออกมาก่อน
  const rawBranch = (params.get("branch") || "").trim().toUpperCase();
  const codeMatch = rawBranch.match(/SCY\d+/);
  const isCode = !!codeMatch;
  const branch = isCode ? codeMatch[0] : (/สิงห์|SING/.test(rawBranch) ? "SCY01" : "SCY06");
  const info = BRANCH_INFO[branch] || (/^SCY0[56]$/.test(branch) || !isCode ? BRANCH_INFO.SCY06 : BRANCH_INFO.SCY01);
  const aiName = params.get("name") || info.name;
  const sim = (params.get("mode") || "sim") !== "answer";   // sim = น้องเปาเปาเป็นลูกค้า ถามพนักงาน

  const [started, setStarted] = useState(false);
  const [mood, setMood] = useState("idle");          // idle | listening | thinking | speaking
  const [mouth, setMouth] = useState("rest");
  const [blink, setBlink] = useState(false);
  const [heard, setHeard] = useState("");
  const [answer, setAnswer] = useState("");
  const [demo, setDemo] = useState(false);
  const [items, setItems] = useState([]);            // รุ่นย่อยที่ AI ให้โชว์ภาพ
  const [showType, setShowType] = useState(false);   // ช่องพิมพ์คำถาม (เมื่อไมค์ใช้ไม่ได้)
  const [typed, setTyped] = useState("");
  const [lang, setLangState] = useState(() => (LANG_BY[params.get("lang")] ? params.get("lang") : "th"));
  const langRef = useRef(lang);                       // ใช้ใน callback เสียง (กันค่าเก่าค้างใน closure)
  const t = sim ? T.th : T[lang];
  const recRef = useRef(null);
  const lipTimer = useRef(null);
  const historyRef = useRef([]);
  const sessionId = useMemo(() => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), []);
  // ── โหมดลูกค้าจำลอง ──
  // ชื่อพนักงานที่ตอบ = ผู้ใช้ที่ login (เมนู CRM เขียน localStorage air_staff ก่อนเปิดหน้านี้) — ไม่ให้พิมพ์เอง
  const [staffName] = useState(() => { let v = params.get("staff") || ""; try { v = v || localStorage.getItem("air_staff") || ""; } catch { /* ignore */ } return v; });
  const [simDone, setSimDone] = useState(false);
  const [simTurn, setSimTurn] = useState(0);         // ลำดับคำถามของลูกค้าคนปัจจุบัน
  const [simCount, setSimCount] = useState(1);       // ลูกค้าคนที่เท่าไร
  const simRef = useRef({ session: "", scenario: "", history: [], lastQ: "" });
  const stopRef = useRef(false);
  const [lastScore, setLastScore] = useState(null);  // { score, comment } ของคำตอบล่าสุด (AI ให้คะแนน)

  // กะพริบตาแบบสุ่ม
  useEffect(() => {
    let t; const loop = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 140); loop(); }, 2200 + Math.random() * 2600); };
    loop(); return () => clearTimeout(t);
  }, []);
  useEffect(() => () => { window.speechSynthesis?.cancel(); clearInterval(lipTimer.current); try { recRef.current?.abort(); } catch { /* ignore */ } }, []);

  // ขยับปากตามข้อความที่กำลังพูด: ไล่ตัวอักษรตามความเร็วพูด (ถ้าเบราว์เซอร์ส่ง boundary event จะปรับตำแหน่งให้ตรงคำ)
  function startLip(text, rate) {
    clearInterval(lipTimer.current);
    const chars = Array.from(text); let i = 0; const cps = LANG_BY[langRef.current].cps * rate;   // ไทย ~13 ตัวอักษร/วิ ที่ rate 1
    lipTimer.current = setInterval(() => { if (i >= chars.length) { i = chars.length - 1; } setMouth(visemeOf(chars[i])); i++; }, 1000 / cps);
    return (charIndex) => { if (typeof charIndex === "number" && charIndex > i) i = charIndex; };
  }
  function stopLip() { clearInterval(lipTimer.current); setMouth("rest"); }

  function speak(text) {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth) { setAnswer(text); resolve(); return; }
      synth.cancel();
      const L = LANG_BY[langRef.current];
      const voices = synth.getVoices();
      const voice = voices.find(v => L.voice.test(v.lang) && /male|ชาย|Niwat|Pattara/i.test(v.name)) || voices.find(v => L.voice.test(v.lang));
      // เครื่องไม่มีเสียงภาษานี้ (เช่น พม่า) → แสดงข้อความอย่างเดียว ไม่ให้เบราว์เซอร์อ่านผิดภาษา
      if (!voice && voices.length && L.id !== "th") { setAnswer(text); setMood("idle"); resolve(); return; }
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = L.tts; u.rate = 1.05; u.pitch = 1.25;   // เสียงเด็กผู้ชายสดใส (มาสคอต)
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
    if (langRef.current !== "th") return T[langRef.current].fallback;
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
    let text = ""; let its = [];
    try {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(AI_API, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({ action: "ask", branch_code: branch, session_id: sessionId, lang: langRef.current, question, history: historyRef.current.slice(-8) }) });
      clearTimeout(to);
      if (!res.ok) throw new Error("http " + res.status);
      const data = await res.json(); const row = Array.isArray(data) ? data[0] : data;
      text = String(row?.answer || "").trim();
      if (!text) throw new Error("empty");
      its = Array.isArray(row?.items) ? row.items : [];
      setDemo(false);
    } catch {
      text = demoAnswer(question); setDemo(true);
    }
    setItems(its);
    historyRef.current.push({ role: "user", content: question }, { role: "assistant", content: text });
    await speak(text);
  }

  // ── โหมดลูกค้าจำลอง: ส่งคำตอบพนักงาน (ถ้ามี) → รับคำถามถัดไปของลูกค้า ──
  async function simNext(staffAnswer, source) {
    const st = simRef.current; const ans = (staffAnswer || "").trim();
    window.speechSynthesis?.cancel(); stopLip();
    setMood("thinking"); setMouth("closed"); setAnswer(""); if (ans) setHeard(ans);
    const history = ans ? [...st.history, { role: "staff", content: ans }] : st.history;
    try {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(AI_API, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({ action: "sim_next", branch_code: branch, session_id: st.session, lang: langRef.current, staff_name: staffName.trim(), scenario: st.scenario, history, last_question: st.lastQ, staff_answer: ans, answer_source: source || "" }) });
      clearTimeout(to);
      if (!res.ok) throw new Error("http " + res.status);
      const data = await res.json(); const row = Array.isArray(data) ? data[0] : data;
      const say = String(row?.say || "").trim();
      if (!say) throw new Error("empty");
      st.scenario = row.scenario || st.scenario; st.history = [...history, { role: "customer", content: say }]; st.lastQ = say;
      setLastScore(ans && row.score !== null && row.score !== undefined ? { score: Number(row.score), comment: String(row.comment || "") } : null);
      setSimDone(!!row.done); setSimTurn(st.history.filter(h => h.role === "customer").length); setHeard("");
      await speak(say);
    } catch {
      setMood("idle");
      setAnswer(ans ? "ส่งคำตอบไม่สำเร็จ (เชื่อมต่อระบบไม่ได้) กรุณาตอบอีกครั้งครับ" : "เชื่อมต่อระบบไม่ได้ กด \"ลูกค้าคนใหม่\" เพื่อลองอีกครั้งครับ");
    }
  }
  function simNewCustomer(first) {
    try { recRef.current?.abort(); } catch { /* ignore */ }
    simRef.current = { session: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), scenario: "", history: [], lastQ: "" };
    setSimDone(false); setSimTurn(0); setHeard(""); setLastScore(null); if (!first) setSimCount(c => c + 1);
    simNext("", "");
  }
  // ฟังคำตอบพนักงาน: พูดยาว/เว้นจังหวะได้ — เครื่องตัดเสียงเองเมื่อเงียบ จึงเปิดฟังต่ออัตโนมัติและสะสมข้อความ จนกว่าพนักงานจะกดปุ่มหยุด
  function listenSim() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setAnswer("เบราว์เซอร์นี้ไม่รองรับการฟังเสียง (เช่น เปิดจากในแอป LINE) กรุณาเปิดด้วย Chrome หรือพิมพ์คำตอบด้านล่างครับ"); return; }
    if (mood === "listening") { stopRef.current = true; try { recRef.current?.stop(); } catch { /* ignore */ } return; }
    window.speechSynthesis?.cancel(); stopLip();
    stopRef.current = false; let accum = "";
    const question = simRef.current.lastQ;
    const run = () => {
      const rec = new SR(); recRef.current = rec;
      rec.lang = LANG_BY[langRef.current].stt; rec.interimResults = true; rec.maxAlternatives = 1;   // พนักงานตอบเป็นภาษาเดียวกับลูกค้าจำลอง
      let finalText = ""; let lastText = ""; let fatal = false;
      rec.onstart = () => { setMood("listening"); setAnswer(question); };
      rec.onresult = (e) => { let t = ""; for (const r of e.results) t += r[0].transcript; lastText = t; setHeard((accum + " " + t).trim()); if (e.results[e.results.length - 1].isFinal) finalText = t; };
      rec.onerror = (e) => {
        const code = e?.error || "";
        if (code === "no-speech" || code === "aborted") return;
        fatal = true; setMood("idle");
        if (code === "not-allowed" || code === "service-not-allowed") setAnswer("ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน กรุณากดอนุญาตไมค์ของเว็บนี้ หรือพิมพ์คำตอบด้านล่างครับ");
        else setAnswer(`ใช้ไมค์ไม่ได้ (${code || "ไม่ทราบสาเหตุ"}) พิมพ์คำตอบด้านล่างได้เลยครับ`);
      };
      rec.onend = () => {
        if (fatal) return;
        accum = (accum + " " + (finalText || lastText)).trim(); setHeard(accum);
        if (!stopRef.current) { try { run(); } catch { setMood("idle"); } return; }
        if (accum) simNext(accum, "voice"); else setMood("idle");
      };
      rec.start();
    };
    try { setHeard(""); run(); } catch (err) { setMood("idle"); setAnswer(`เปิดไมค์ไม่ได้ (${err?.name || "error"}) พิมพ์คำตอบด้านล่างได้เลยครับ`); }
  }

  function listen() {
    if (sim) { listenSim(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setShowType(true); setAnswer(t.noSR); return; }
    if (mood === "listening") { try { recRef.current?.stop(); } catch { /* ignore */ } return; }
    window.speechSynthesis?.cancel(); stopLip();
    const rec = new SR(); recRef.current = rec;
    rec.lang = LANG_BY[langRef.current].stt; rec.interimResults = true; rec.maxAlternatives = 1;
    let finalText = ""; let lastText = ""; let failed = false;
    rec.onstart = () => { setMood("listening"); setHeard(""); setAnswer(""); setItems([]); };
    rec.onresult = (e) => { let s = ""; for (const r of e.results) s += r[0].transcript; lastText = s; setHeard(s); if (e.results[e.results.length - 1].isFinal) finalText = s; };
    rec.onerror = (e) => {
      const code = e?.error || "";
      if (code === "aborted") return;
      failed = true; setMood("idle");
      if (code === "no-speech") { setAnswer(t.noSpeech); return; }
      setShowType(true);
      if (langRef.current !== "th") setAnswer(`${t.noMic} (${code || "error"})`);
      else if (code === "not-allowed" || code === "service-not-allowed") setAnswer("ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน กรุณากดอนุญาตไมค์ของเว็บนี้ในเบราว์เซอร์ หรือพิมพ์คำถามด้านล่างครับ");
      else if (code === "audio-capture") setAnswer("ไม่พบไมโครโฟนในเครื่องนี้ พิมพ์คำถามด้านล่างได้เลยครับ");
      else if (code === "network") setAnswer("ระบบฟังเสียงเชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง หรือพิมพ์คำถามด้านล่างครับ");
      else setAnswer(`ใช้ไมค์ไม่ได้ (${code || "ไม่ทราบสาเหตุ"}) พิมพ์คำถามด้านล่างได้เลยครับ`);
    };
    rec.onend = () => { const s = (finalText || lastText).trim(); if (failed) return; if (s) ask(s); else setMood("idle"); };
    try { rec.start(); } catch (err) { setMood("idle"); setShowType(true); setAnswer(`${t.noMic} (${err?.name || "error"})`); }
  }

  // เปลี่ยนภาษา: โหมดตอบลูกค้า = ทักทายใหม่ด้วยภาษานั้น (ล้างประวัติคุย) · โหมดฝึก = เริ่มลูกค้าจำลองคนใหม่ที่พูดภาษานั้น
  function changeLang(id) {
    if (id === langRef.current || mood === "thinking") return;
    langRef.current = id; setLangState(id);
    try { recRef.current?.abort(); } catch { /* ignore */ }
    window.speechSynthesis?.cancel(); stopLip(); setMood("idle");
    if (!started) return;
    if (sim) { simNewCustomer(false); return; }
    historyRef.current = []; setItems([]); setHeard("");
    speak(T[id].greet(aiName, info));
  }

  async function start() {
    if (sim) {
      if (!staffName.trim()) return;
      setStarted(true); window.speechSynthesis?.getVoices();
      simNewCustomer(true); return;
    }
    setStarted(true);
    window.speechSynthesis?.getVoices();
    await speak(T[langRef.current].greet(aiName, info));
  }

  const simStatus = mood === "listening" ? "กำลังฟังคำตอบ... ตอบจบแล้วกดปุ่มสีแดง" : mood === "thinking" ? "ลูกค้ากำลังคิด..." : mood === "speaking" ? "" : simDone ? "จบการสนทนากับลูกค้าคนนี้แล้ว กด \"ลูกค้าคนต่อไป\"" : "กดไมค์แล้วตอบลูกค้า (หรือพิมพ์คำตอบ)";
  const statusText = sim ? simStatus : mood === "listening" ? t.listening : mood === "thinking" ? t.thinking : mood === "speaking" ? "" : t.idle;
  const btn = { border: "none", borderRadius: 999, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div style={{ height: "100dvh", background: "radial-gradient(circle at 50% 30%, #1e4d8f 0%, #0b2447 60%, #061528 100%)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden", fontFamily: "'Sarabun','Leelawadee UI',sans-serif", userSelect: "none" }}>
      <style>{".air-face{width:min(52vh,84vw);transition:width .3s}.air-face.small{width:min(26vh,44vw)}.air-cards{display:flex;gap:12px;overflow-x:auto;max-width:96vw;padding:6px 8px;scrollbar-width:none}.air-cards::-webkit-scrollbar{display:none}.air-card{width:190px}.air-card-img{height:130px}.air-card-name{font-size:16px}.air-card-price{font-size:17px}.air-shop{font-size:22px}.air-sub{font-size:16px}.air-heard,.air-status{font-size:20px}.air-answer{font-size:26px}.air-chips{flex-wrap:wrap;justify-content:center}.air-chip{font-size:18px;padding:10px 18px}.air-mic{width:92px;height:92px;font-size:40px}.air-start{font-size:30px;padding:16px 36px}"
        + "@media (max-width:640px),(max-height:560px){.air-face{width:min(42dvh,76vw)}.air-face.small{width:min(20dvh,40vw)}.air-card{width:138px}.air-card-img{height:92px}.air-card-name{font-size:13px}.air-card-price{font-size:14px}.air-shop{font-size:17px}.air-sub{font-size:12px}.air-heard,.air-status{font-size:15px}.air-answer{font-size:17px}.air-chips{flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;width:100%;scrollbar-width:none}.air-chips::-webkit-scrollbar{display:none}.air-chip{font-size:15px;padding:8px 14px}.air-mic{width:68px;height:68px;font-size:30px}.air-start{font-size:20px;padding:14px 24px}}"
        + "@keyframes mascotIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes mascotTalk{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-4px) rotate(-1deg)}75%{transform:translateY(-2px) rotate(1deg)}}"}</style>
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", gap: 10, boxSizing: "border-box", flexShrink: 0 }}>
        <div className="air-shop" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{lang === "th" || sim ? info.shop : info.shopEn}</div>
        <div className="air-sub" style={{ opacity: .8, textAlign: "right" }}>{sim ? `ฝึกตอบลูกค้า · ${staffName || "-"}${started ? ` · ลูกค้าคนที่ ${simCount} · คำถามที่ ${simTurn}` : ""}` : `${lang === "th" ? aiName + " · " : ""}${t.sub}${demo ? t.demo : ""}`}</div>
      </div>
      {/* เลือกภาษา — อยู่เหนือหน้าจอ "แตะเพื่อเริ่ม" ให้เลือกก่อนเริ่มได้ */}
      <div style={{ position: "relative", zIndex: 5, display: "flex", alignItems: "center", gap: 6, padding: "0 16px", flexWrap: "wrap", justifyContent: "center", flexShrink: 0 }}>
        {sim && <span className="air-sub" style={{ opacity: .75 }}>ภาษาลูกค้า:</span>}
        {LANGS.map(l => (
          <button key={l.id} onClick={() => changeLang(l.id)} disabled={mood === "thinking"} className="air-lang"
            style={{ ...btn, padding: "5px 12px", fontSize: 15, background: lang === l.id ? "#f9a825" : "rgba(255,255,255,.14)", color: lang === l.id ? "#1b1b1b" : "#fff", fontWeight: lang === l.id ? 700 : 400 }}>
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", position: "relative" }}>
        <div style={{ flexShrink: 0, transform: mood === "listening" ? "scale(1.03)" : "scale(1)", transition: "transform .3s" }}>
          <Face mouth={mouth} blink={blink} mood={mood} small={items.length > 0} />
        </div>
        {items.length > 0 && (
          <div className="air-cards">
            {items.map(it => <VariantCard key={it.type_id} item={it} t={t} disabled={mood === "thinking"} onPick={(x) => ask(t.pick(x))} />)}
          </div>
        )}
        {/* กล่องข้อความ: สิ่งที่ได้ยิน + คำตอบ */}
        <div style={{ width: "min(900px, 92vw)", minHeight: 48, flex: "0 1 auto", overflowY: "auto", marginTop: 6, textAlign: "center" }}>
          {!sim && heard && <div className="air-heard" style={{ opacity: .75, marginBottom: 6 }}>“{heard}”</div>}
          {answer && <div className="air-answer" style={{ lineHeight: 1.45, background: "rgba(255,255,255,.1)", borderRadius: 18, padding: "12px 20px", display: "inline-block" }}>{answer}</div>}
          {sim && heard && <div className="air-heard" style={{ marginTop: 8, color: "#c8f7c5" }}>คำตอบของคุณ: “{heard}”</div>}
          {sim && lastScore && mood !== "listening" && (
            <div className="air-status" style={{ marginTop: 8 }}>
              <span style={{ background: lastScore.score >= 8 ? "#2e7d32" : lastScore.score >= 5 ? "#ef6c00" : "#c62828", borderRadius: 999, padding: "2px 12px", fontWeight: 700 }}>คะแนนคำตอบที่แล้ว {lastScore.score}/10</span>
              {lastScore.comment && <span style={{ opacity: .85 }}> {lastScore.comment}</span>}
            </div>
          )}
          {(sim || !answer) && statusText && <div className="air-status" style={{ opacity: .7, marginTop: sim ? 6 : 0 }}>{statusText}</div>}
        </div>
      </div>

      <div style={{ width: "100%", padding: "8px 14px calc(14px + env(safe-area-inset-bottom))", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {sim ? (
          <>
            <div className="air-chips" style={{ display: "flex", gap: 10 }}>
              <button onClick={() => simRef.current.lastQ && speak(simRef.current.lastQ)} disabled={mood === "thinking" || mood === "listening" || !simTurn} className="air-chip" style={{ ...btn, whiteSpace: "nowrap", flexShrink: 0, background: "rgba(255,255,255,.14)", color: "#fff" }}>🔁 ฟังคำถามอีกครั้ง</button>
              <button onClick={() => simNewCustomer(false)} disabled={mood === "thinking" || mood === "listening"} className="air-chip" style={{ ...btn, whiteSpace: "nowrap", flexShrink: 0, background: simDone ? "#f9a825" : "rgba(255,255,255,.14)", color: simDone ? "#1b1b1b" : "#fff", fontWeight: simDone ? 700 : 400 }}>{simDone ? "➡ ลูกค้าคนต่อไป" : "⏭ ลูกค้าคนใหม่"}</button>
            </div>
            {!simDone && (
              <form onSubmit={(e) => { e.preventDefault(); const t = typed; if (!t.trim()) return; setTyped(""); simNext(t, "text"); }} style={{ display: "flex", gap: 8, width: "min(640px, 100%)" }}>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="หรือพิมพ์คำตอบที่นี่..." disabled={mood === "listening"} style={{ flex: 1, minWidth: 0, fontSize: 16, padding: "10px 14px", borderRadius: 999, border: "none", fontFamily: "inherit", userSelect: "text" }} />
                <button type="submit" disabled={mood === "thinking" || mood === "listening" || !typed.trim()} style={{ ...btn, padding: "10px 18px", fontSize: 16, background: "#2e7d32", color: "#fff" }}>ส่งคำตอบ</button>
              </form>
            )}
          </>
        ) : (
        <div className="air-chips" style={{ display: "flex", gap: 10 }}>
          {t.quick.map(q => (
            <button key={q} onClick={() => ask(q)} disabled={mood === "thinking"} className="air-chip" style={{ ...btn, whiteSpace: "nowrap", flexShrink: 0, background: "rgba(255,255,255,.14)", color: "#fff" }}>{q}</button>
          ))}
        </div>
        )}
        {!sim && showType && (
          <form onSubmit={(e) => { e.preventDefault(); const t = typed; setTyped(""); ask(t); }} style={{ display: "flex", gap: 8, width: "min(560px, 100%)" }}>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t.typePh} style={{ flex: 1, minWidth: 0, fontSize: 16, padding: "10px 14px", borderRadius: 999, border: "none", fontFamily: "inherit", userSelect: "text" }} />
            <button type="submit" disabled={mood === "thinking" || !typed.trim()} style={{ ...btn, padding: "10px 18px", fontSize: 16, background: "#2e7d32", color: "#fff" }}>{t.askBtn}</button>
          </form>
        )}
        <button onClick={listen} disabled={mood === "thinking" || (sim && (simDone || !simTurn))} className="air-mic" style={{ ...btn, flexShrink: 0, color: "#fff", background: mood === "listening" ? "#e53935" : "#2e7d32", boxShadow: mood === "listening" ? "0 0 0 12px rgba(229,57,53,.25)" : "0 6px 18px rgba(0,0,0,.4)", transition: "all .2s", opacity: sim && (simDone || !simTurn) ? .4 : 1 }} title={t.micTitle}>
          {mood === "listening" ? "■" : "🎤"}
        </button>
      </div>

      {!started && sim && (
        <div onClick={start} style={{ position: "fixed", inset: 0, background: "rgba(6,21,40,.55)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 10, paddingBottom: "12vh", cursor: staffName.trim() ? "pointer" : "default" }}>
          {staffName.trim()
            ? <>
                <div className="air-start" style={{ fontWeight: 700, background: "#2e7d32", borderRadius: 999, textAlign: "center", margin: "0 16px", boxShadow: "0 8px 24px rgba(0,0,0,.45)" }}>แตะหน้าจอเพื่อเริ่มรับลูกค้า</div>
                <div className="air-status" style={{ opacity: .85 }}>พนักงาน: {staffName}</div>
              </>
            : <div className="air-start" style={{ fontWeight: 700, background: "#c62828", borderRadius: 20, textAlign: "center", margin: "0 16px" }}>ไม่พบชื่อผู้ใช้ กรุณาเข้าสู่ระบบ แล้วเปิดหน้านี้จากเมนู CRM</div>}
        </div>
      )}
      {!started && !sim && (
        <div onClick={start} style={{ position: "fixed", inset: 0, background: "rgba(6,21,40,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "12vh", cursor: "pointer" }}>
          <div className="air-start" style={{ fontWeight: 700, background: "#2e7d32", borderRadius: 999, textAlign: "center", margin: "0 16px", boxShadow: "0 8px 24px rgba(0,0,0,.45)" }}>{t.start(aiName)}</div>
        </div>
      )}
    </div>
  );
}
