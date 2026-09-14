// รวม "คู่มือรายการอะไหล่" (สมุดภาพอะไหล่รายบล็อก E-1..F-34) ทุกรุ่น — auto-detect ทุกไฟล์ใน ./partsbooks/*_parts_book.json
// เพิ่มรุ่นใหม่ = รัน tools/build_parts_book.py กับไฟล์ PL-*.PDF แล้ววาง JSON+รูป ไม่ต้องแก้โค้ดนี้
const modules = import.meta.glob("./partsbooks/*_parts_book.json", { eager: true });

const partsBooks = Object.keys(modules)
  .sort()
  .map((k) => modules[k].default ?? modules[k]);

export default partsBooks;
