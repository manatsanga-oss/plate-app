// POP UP ตอนเข้าระบบ — สลับวันละ 1 เรื่อง (user 2026-11-12)
//   วันที่ 12/11/69: ผลค่าคอมพิเศษเฉพาะรุ่น AEROX ก.ย.–ต.ค. + แจ้งเงินเข้า 10 ธ.ค. 69
//   วันถัดไป: ต่อแคมเปญ AEROX พ.ย.–ธ.ค. (ความคืบหน้ารอบใหม่)
//   วันถัดไป: ผลการแข่งขันฝึกตอบลูกค้ากับ AI ประจำสัปดาห์
//   แล้ววนสลับกันไปเรื่อย ๆ — เรื่องไหนหมดช่วงแล้วจะหลุดจากวงเอง:
//     ผล ก.ย.–ต.ค. ขึ้นถึงวันเงินเข้า (payoutDate) · ต่อแคมเปญขึ้นถึงวันสุดท้ายของแคมเปญ · ผล AI ขึ้นตามรอบสัปดาห์ของมันเอง
// เดิม (ก่อน 12/11/69) AEROX กับ AI ขึ้นแยกกันคนละเงื่อนไข อาจซ้อน 2 ป๊อปอัปในการเข้าระบบครั้งเดียว
import { AEROX_CAMPAIGNS, currentAeroxCampaign } from "./aeroxCampaign";
import { isAiSimAwardActive } from "../pages/AiSimAwardPopup";

const ROTATE_FROM = "2026-11-12"; // วันแรกของวง = ผลค่าคอมพิเศษเฉพาะรุ่น
const dayNo = (iso) => Math.round(new Date(iso + "T00:00:00").getTime() / 86400000);

/** แคมเปญที่จบแล้วและประกาศวันเงินเข้า แต่ยังไม่ถึงวันเงินเข้า → ขึ้นประกาศผล (เลือกรอบล่าสุด) */
export function aeroxResultCampaignFor(iso) {
  return [...AEROX_CAMPAIGNS].reverse().find((c) => c.payoutDate && iso > c.to && iso >= ROTATE_FROM && iso <= c.payoutDate) || null;
}

/** ป๊อปอัปของวันนี้: "aerox-result" | "aerox-campaign" | "ai-award" | null */
export function loginPopupFor(iso = new Date().toLocaleDateString("en-CA")) {
  const list = [];
  if (aeroxResultCampaignFor(iso)) list.push("aerox-result");
  if (currentAeroxCampaign(iso)) list.push("aerox-campaign");
  if (isAiSimAwardActive(iso)) list.push("ai-award");
  if (!list.length) return null;
  const n = dayNo(iso) - dayNo(ROTATE_FROM);
  return list[((n % list.length) + list.length) % list.length];
}
