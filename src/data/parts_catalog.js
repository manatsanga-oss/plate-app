// รวมสมุดรูปภาพชุดสีทุกรุ่น — auto-detect ทุกไฟล์ใน ./models/*_color_parts.json
// เพิ่มรุ่นใหม่ = แค่วางไฟล์ JSON ในโฟลเดอร์ models (รัน tools/build_color_book.bat) ไม่ต้องแก้โค้ดนี้
const modules = import.meta.glob("./models/*_color_parts.json", { eager: true });

const catalog = Object.keys(modules)
  .sort() // เรียงตามชื่อไฟล์ให้ลำดับคงที่
  .map((k) => modules[k].default ?? modules[k]);

export default catalog;
