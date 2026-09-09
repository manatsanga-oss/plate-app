// คำนำหน้าชื่อลูกค้า (user 2026-09-09: ชื่อจาก QR/LINE ไม่มีคำนำหน้า → เอกสารงานทะเบียนต้องมี)
export const TITLE_OPTIONS_TH = ["นาย", "นาง", "นางสาว"];
export const TITLE_OPTIONS_EN = ["MR.", "MRS.", "MS."];
export const TITLE_OPTIONS_ALL = [...TITLE_OPTIONS_TH, ...TITLE_OPTIONS_EN];
// มีคำนำหน้าแล้ว หรือเป็นนิติบุคคล/ร้าน (ไม่ต้องใส่)
const TITLE_RE = /^(?:(?:นางสาว|นาง|นาย|น\.ส\.|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|คุณ|พระ|ว่าที่|ร\.ต\.|จ\.ส\.|บริษัท|บจ\.|บจก\.|บมจ\.|หจก\.|ห้างหุ้นส่วน|ร้าน|โรงเรียน|วัด|องค์การ|สหกรณ์|มูลนิธิ|สมาคม)|(?:MR\.?|MRS\.?|MS\.?|MISS|MISTER|DR\.?)(?:\s|$))/i; // ไทยติดชื่อได้ (นางสาวพัชรา) · อังกฤษต้องมีช่องว่าง
export const hasNameTitle = (name) => TITLE_RE.test(String(name || "").trim());
// เดาคำนำหน้าจากเพศ + ภาษาของชื่อ (ชื่อไทย → นาย/นางสาว, ชื่ออังกฤษ → MR./MS.)
export const guessTitle = (name, gender) => {
  const g = String(gender || "").toLowerCase();
  const thai = /[\u0E00-\u0E7F]/.test(String(name || ""));
  if (g === "ชาย" || g === "male" || g === "m") return thai ? "นาย" : "MR.";
  if (g === "หญิง" || g === "female" || g === "f") return thai ? "นางสาว" : "MS.";
  return "";
};
export const withTitle = (title, name) => `${String(title || "").trim()} ${String(name || "").trim()}`.trim();
