// กลุ่มราคาขายรายสาขา (ป.เปา/สิงห์ชัย) แบบมีวันเริ่มใช้ — เก็บใน branch_price_groups ผ่าน master-data-api
// กติกา: กลุ่ม ณ วัน D = แถว effective_date ล่าสุดที่ <= D ของสาขานั้น
// ไม่มีแถว (หรือวันก่อนแถวแรก) = กติกาเดิมในโค้ด: SCY05/SCY06 = ป.เปา, อื่น ๆ = สิงห์ชัย
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

export async function fetchPriceBranchGroups() {
  try {
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_price_branch_groups" }) });
    const data = await res.json();
    return Array.isArray(data) ? data.filter(r => r && r.branch_code) : [];
  } catch { return []; }
}

export function priceGroupOf(branchCode, rows, onDate) {
  const bc = String(branchCode || "").toUpperCase().slice(0, 5);
  const d = String(onDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const hit = (rows || [])
    .filter(r => String(r.branch_code || "").toUpperCase() === bc && String(r.effective_date) <= d)
    .sort((a, b) => (String(a.effective_date) < String(b.effective_date) ? 1 : -1))[0];
  if (hit && (hit.price_group === "ป.เปา" || hit.price_group === "สิงห์ชัย")) return hit.price_group;
  return ["SCY05", "SCY06"].includes(bc) ? "ป.เปา" : "สิงห์ชัย";
}
