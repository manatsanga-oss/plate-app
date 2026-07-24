// จุดกดบนรูปตัวรถ (bike hotspots) — key = `${model}|${page}` ของสีในสมุดภาพ
// NMAX ครบทุกสี: เจน BTF (รูปหันซ้าย) ใช้ตำแหน่งชุดแรก · เจน B1T/BBB (รูปหันขวา) ใช้ตำแหน่งชุดที่สอง
// เพิ่มรุ่นใหม่: วางรูปใน public/bike-photos + เพิ่ม entry (x,y เป็น % บนรูป; side: "ซ้าย"/"ขวา"; view = ด้านที่เห็นในรูป)
const BIKE_HOTSPOTS = {
 "NMAX|btf2a2": {
  "img": "/bike-photos/nmax_btf2a2.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 30,
    "y": 17,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "BLS-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 52,
    "y": 12,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BLS-F6280-00",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BLS-F6290-00",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 37,
    "y": 25,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "BLS-H3559-00-P0",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "BLS-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 47,
    "y": 21,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "BLS-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BLS-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "BLS-F6219-00",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 30,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง"
     },
     {
      "code": "1WD-F413B-01",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 29,
    "y": 41,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "BLS-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "BLS-F2865-00-P0",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 24,
    "y": 48,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "BLS-F8377-00-P2",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "BLS-F286F-10",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 19,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BLS-F1511-00",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "BLS-F1513-00-P2",
      "side": "ซ้าย",
      "name": "แสตย์บังโคลนซ้าย (STAY FENDER 1)"
     },
     {
      "code": "BLS-F1514-00-P2",
      "side": "ขวา",
      "name": "แสตย์บังโคลนขวา (STAY FENDER 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 57,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "BLS-F1731-00-P2",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "BLS-F1741-00-P2",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 43,
    "y": 41,
    "label": "บังลมใน",
    "items": [
     {
      "code": "BLS-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "BLS-F8312-00-P0",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 47,
    "y": 46,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "BLS-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 55,
    "y": 33,
    "label": "เบาะ",
    "items": [
     {
      "code": "BPA-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "BLS-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 64,
    "y": 46,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "BLS-F1711-00-P2",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "BLS-F1721-00-P2",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 71,
    "y": 39,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-50",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 68,
    "y": 26,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "BLS-F4773-00-P0",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     },
     {
      "code": "BLS-F171A-00",
      "side": null,
      "name": "ฝาครอบท้ายเบาะด้านบน (COVER TOP)"
     }
    ]
   },
   {
    "x": 79,
    "y": 32,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "BLS-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 55,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BLS-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "BLS-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 48,
    "y": 61,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BLS-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "BLS-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "BLS-F171L-00-P2",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "BLS-F171M-00-P2",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 71,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "BLS-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 62,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "BLS-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "BLS-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     },
     {
      "code": "B5P-F1569-K0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (GRAPHIC 1)"
     }
    ]
   },
   {
    "x": 74,
    "y": 66,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B6H-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|btf2a3": {
  "img": "/bike-photos/nmax_btf2a3.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 30,
    "y": 17,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "BLS-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 52,
    "y": 12,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BLS-F6280-00",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BLS-F6290-00",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 37,
    "y": 25,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "BLS-H3559-00-P0",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "BLS-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 47,
    "y": 21,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "BLS-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BLS-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "BLS-F6219-00",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 30,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง"
     },
     {
      "code": "1WD-F413B-01",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 29,
    "y": 41,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "BLS-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "BLS-F2865-00-P1",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 24,
    "y": 48,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "BLS-F8377-00-P3",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "BLS-F286F-10",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 19,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BLS-F1511-00",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "BLS-F1513-00-P3",
      "side": "ซ้าย",
      "name": "แสตย์บังโคลนซ้าย (STAY FENDER 1)"
     },
     {
      "code": "BLS-F1514-00-P3",
      "side": "ขวา",
      "name": "แสตย์บังโคลนขวา (STAY FENDER 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 57,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "BLS-F1731-00-P2",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "BLS-F1741-00-P2",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 43,
    "y": 41,
    "label": "บังลมใน",
    "items": [
     {
      "code": "BLS-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "BLS-F8312-00-P0",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 47,
    "y": 46,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "BLS-F74A8-00-P0",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 55,
    "y": 33,
    "label": "เบาะ",
    "items": [
     {
      "code": "BPA-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "BLS-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 64,
    "y": 46,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "BLS-F1711-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "BLS-F1721-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 71,
    "y": 39,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-00",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 68,
    "y": 26,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "BLS-F4773-00-P0",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     },
     {
      "code": "BLS-F171A-00",
      "side": null,
      "name": "ฝาครอบท้ายเบาะด้านบน (COVER TOP)"
     }
    ]
   },
   {
    "x": 79,
    "y": 32,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "BLS-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 55,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BLS-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "BLS-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 48,
    "y": 61,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BLS-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "BLS-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "BLS-F171L-00-P3",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "BLS-F171M-00-P3",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 71,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "BLS-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 62,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "BLS-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "BLS-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     },
     {
      "code": "B5P-F1569-K0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (GRAPHIC 1)"
     }
    ]
   },
   {
    "x": 74,
    "y": 66,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "BTF-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|btf2a4": {
  "img": "/bike-photos/nmax_btf2a4.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 30,
    "y": 17,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "BLS-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 52,
    "y": 12,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BLS-F6280-00",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BLS-F6290-00",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 37,
    "y": 25,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "BLS-H3559-00-P0",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "BLS-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 47,
    "y": 21,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "BLS-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BLS-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "BLS-F6219-00",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 30,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง"
     },
     {
      "code": "1WD-F413B-01",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 29,
    "y": 41,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "BLS-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "BLS-F2865-00-P1",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 24,
    "y": 48,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "BLS-F8377-00-P4",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "BLS-F286F-10",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 19,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BLS-F1511-00",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "BLS-F1513-00-P4",
      "side": "ซ้าย",
      "name": "แสตย์บังโคลนซ้าย (STAY FENDER 1)"
     },
     {
      "code": "BLS-F1514-00-P4",
      "side": "ขวา",
      "name": "แสตย์บังโคลนขวา (STAY FENDER 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 57,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "BLS-F1731-00-P1",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "BLS-F1741-00-P1",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 43,
    "y": 41,
    "label": "บังลมใน",
    "items": [
     {
      "code": "BLS-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "BLS-F8312-00-P0",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 47,
    "y": 46,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "BLS-F74A8-00-P0",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 55,
    "y": 33,
    "label": "เบาะ",
    "items": [
     {
      "code": "BPA-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "BLS-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 64,
    "y": 46,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "BLS-F1711-00-P4",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "BLS-F1721-00-P4",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 71,
    "y": 39,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-50",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 68,
    "y": 26,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "BLS-F4773-00-P0",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     },
     {
      "code": "BLS-F171A-00",
      "side": null,
      "name": "ฝาครอบท้ายเบาะด้านบน (COVER TOP)"
     }
    ]
   },
   {
    "x": 79,
    "y": 32,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "BLS-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 55,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BLS-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "BLS-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 48,
    "y": 61,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BLS-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "BLS-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "BLS-F171L-00-P4",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "BLS-F171M-00-P4",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 71,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "BLS-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 62,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "BLS-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "BLS-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     },
     {
      "code": "B5P-F1569-K0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (GRAPHIC 1)"
     }
    ]
   },
   {
    "x": 74,
    "y": 66,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "BTF-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|btf2a5": {
  "img": "/bike-photos/nmax_btf2a5.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 30,
    "y": 17,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "BLS-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 52,
    "y": 12,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BLS-F6280-00",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BLS-F6290-00",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 37,
    "y": 25,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "BLS-H3559-00-P0",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "BLS-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 47,
    "y": 21,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "BLS-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BLS-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "BLS-F6219-00",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 30,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง"
     },
     {
      "code": "1WD-F413B-01",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 29,
    "y": 41,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "BLS-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "BLS-F2865-00-P0",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 24,
    "y": 48,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "BLS-F8377-00-PG",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "BLS-F286F-10",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 19,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BLS-F1511-00",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "BLS-F1513-00-PG",
      "side": "ซ้าย",
      "name": "แสตย์บังโคลนซ้าย (STAY FENDER 1)"
     },
     {
      "code": "BLS-F1514-00-PG",
      "side": "ขวา",
      "name": "แสตย์บังโคลนขวา (STAY FENDER 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 57,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "BLS-F1741-00-P2",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 43,
    "y": 41,
    "label": "บังลมใน",
    "items": [
     {
      "code": "BLS-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "BLS-F8312-00-P0",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 47,
    "y": 46,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "BLS-F74A8-00-P0",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 55,
    "y": 33,
    "label": "เบาะ",
    "items": [
     {
      "code": "BPA-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "BLS-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 64,
    "y": 46,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "BLS-F1711-00-PG",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "BLS-F1721-00-PG",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 71,
    "y": 39,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-50",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 68,
    "y": 26,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "BLS-F4773-00-P0",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     },
     {
      "code": "BLS-F171A-00",
      "side": null,
      "name": "ฝาครอบท้ายเบาะด้านบน (COVER TOP)"
     }
    ]
   },
   {
    "x": 79,
    "y": 32,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "BLS-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 55,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BLS-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "BLS-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 48,
    "y": 61,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BLS-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "BLS-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "BLS-F171L-00-P6",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "BLS-F171M-00-P6",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 71,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "BLS-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 62,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "BLS-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "BLS-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     },
     {
      "code": "B5P-F1569-K0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (GRAPHIC 1)"
     }
    ]
   },
   {
    "x": 74,
    "y": 66,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "BTF-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|btf3p2": {
  "img": "/bike-photos/nmax_btf3p2.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 30,
    "y": 17,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "BLS-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 52,
    "y": 12,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BLS-F6280-00",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BLS-F6290-00",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 37,
    "y": 25,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "BLS-H3559-00-P0",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "BLS-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 47,
    "y": 21,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "BLS-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BLS-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "BLS-F6219-00",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 30,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง"
     },
     {
      "code": "1WD-F413B-01",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 29,
    "y": 41,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "BLS-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "BLS-F2865-00-P0",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 24,
    "y": 48,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "BLS-F8377-00-P6",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "BLS-F286F-10",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 19,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BLS-F1511-00",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "BLS-F1513-00-P0",
      "side": "ซ้าย",
      "name": "แสตย์บังโคลนซ้าย (STAY FENDER 1)"
     },
     {
      "code": "BLS-F1514-00-P0",
      "side": "ขวา",
      "name": "แสตย์บังโคลนขวา (STAY FENDER 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 57,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "BLS-F1741-00-P0",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 43,
    "y": 41,
    "label": "บังลมใน",
    "items": [
     {
      "code": "BLS-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "BLS-F8312-00-P3",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 47,
    "y": 46,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "BLS-F74A8-00-P3",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 55,
    "y": 33,
    "label": "เบาะ",
    "items": [
     {
      "code": "BLS-F4730-10",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "BLS-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 64,
    "y": 46,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "BLS-F1711-00-P6",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "BLS-F1721-00-P6",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 68,
    "y": 26,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "BLS-F4773-00-P1",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     },
     {
      "code": "BLS-F171A-00",
      "side": null,
      "name": "ฝาครอบท้ายเบาะด้านบน (COVER TOP)"
     }
    ]
   },
   {
    "x": 79,
    "y": 32,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "BLS-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 55,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BLS-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "BLS-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 48,
    "y": 61,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BLS-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "BLS-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "BLS-F171L-00-P6",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "BLS-F171M-00-P6",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 71,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "BLS-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 62,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "BLS-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "BLS-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t1_0582": {
  "img": "/bike-photos/nmax_b1t1_0582.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P3",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P3",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P3",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-P7",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "2DP-F173B-40",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-00-P2",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P3",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P3",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t1_1774": {
  "img": "/bike-photos/nmax_b1t1_1774.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P4",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P4",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P4",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-P9",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P4",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P4",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "2DP-F173B-00",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-00-P2",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P4",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P4",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t1_1258": {
  "img": "/bike-photos/nmax_b1t1_1258.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P5",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P5",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P5",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-P5",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P5",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P5",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "2DP-F173B-00",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-00-P2",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P5",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P5",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t1_1760": {
  "img": "/bike-photos/nmax_b1t1_1760.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P6",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P6",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P6",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PA",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P6",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P6",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "2DP-F173B-40",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-00-P2",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P6",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P6",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t3_1654": {
  "img": "/bike-photos/nmax_b1t3_1654.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P8",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P8",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P8",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PC",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P8",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P8",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-80",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-01-P2",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P8",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P8",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t3_1774": {
  "img": "/bike-photos/nmax_b1t3_1774.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P4",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P4",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P4",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-P9",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P4",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P4",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-00",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-01-P2",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P4",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P4",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t3_1258": {
  "img": "/bike-photos/nmax_b1t3_1258.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P5",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P5",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P5",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-P5",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P5",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P5",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-00",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-01-P2",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P5",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P5",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t4_1654": {
  "img": "/bike-photos/nmax_b1t4_1654.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P8",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P8",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P8",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PC",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-01",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P8",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P8",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-80",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-10",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P8",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P8",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-01",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-10",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t4_1774": {
  "img": "/bike-photos/nmax_b1t4_1774.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P4",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P4",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P4",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-P9",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P5",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P5",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-01",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P4",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P4",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-00",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-10",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P4",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P4",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-01",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-10",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t4_003e": {
  "img": "/bike-photos/nmax_b1t4_003e.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-3E",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-3E",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-3E",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-3E",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-01",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-3E",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-3E",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-00",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-10",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-3E",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-3E",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-01",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-10",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|bbb2_1725": {
  "img": "/bike-photos/nmax_bbb2_1725.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-PA",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-PA",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-PA",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PE",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-01",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-PA",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-PA",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-50",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-10",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-01",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-PA",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-PA",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-01",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "BBR-E4711-10",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|bbb2_1786": {
  "img": "/bike-photos/nmax_bbb2_1786.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P7",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P7",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P7",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PB",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P4",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P4",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-01",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P7",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P7",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-50",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-10",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-01",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P7",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P7",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-01",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "BBR-E4711-10",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|bbb2_1847": {
  "img": "/bike-photos/nmax_bbb2_1847.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-PB",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-PB",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-PB",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PF",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-01",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-PB",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-PB",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-50",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-10",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-01",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-PB",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-PB",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-01",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "BBR-E4711-10",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t5_1654": {
  "img": "/bike-photos/nmax_b1t5_1654.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P8",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P8",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P8",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PC",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-01",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P8",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P8",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-80",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-10",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-01",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P8",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P8",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-01",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-10",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t5_003e": {
  "img": "/bike-photos/nmax_b1t5_003e.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-3E",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-3E",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-3E",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-3E",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-01",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-3E",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-3E",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-00",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-10",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-01",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-3E",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-3E",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-01",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-10",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|b1t5_1600": {
  "img": "/bike-photos/nmax_b1t5_1600.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-3E",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-PD",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-PD",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PH",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P4",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P4",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-01",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-PD",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-PD",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-00",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-10",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-01",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-PD",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-PD",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-01",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "B1T-E4711-10",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|bbb1_1758": {
  "img": "/bike-photos/nmax_bbb1_1758.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P9",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P9",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P9",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PD",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P4",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P4",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P9",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P9",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-50",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-01-P5",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P9",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P9",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "BBR-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|bbb1_1786": {
  "img": "/bike-photos/nmax_bbb1_1786.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P7",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P7",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P7",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PB",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P4",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P4",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P7",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P7",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-50",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-01-P5",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-00",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P7",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P7",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-00",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "BBR-E4711-00",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|bbb5_1847": {
  "img": "/bike-photos/nmax_bbb5_1847.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-PB",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-PB",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-PB",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PB",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-01",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-PB",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-PB",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-50",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-10",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-01",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-PB",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-PB",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-01",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "BBR-E4711-10",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|bbb5_1786": {
  "img": "/bike-photos/nmax_bbb5_1786.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-P7",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-P7",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-P7",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PB",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P4",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P4",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-01",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-P7",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-P7",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-50",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-10",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-01",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-P7",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-P7",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-01",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "BBR-E4711-10",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 },
 "NMAX|bbb5_1725": {
  "img": "/bike-photos/nmax_bbb5_1725.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 66,
    "y": 15,
    "label": "หน้ากาก",
    "items": [
     {
      "code": "B1T-F61AA-00",
      "side": null,
      "name": "หน้ากาก (VISOR)"
     }
    ]
   },
   {
    "x": 55,
    "y": 8,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2DP-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2DP-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 60,
    "y": 22,
    "label": "เรือนไมล์",
    "items": [
     {
      "code": "B6H-H3559-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ด้านบน (COVER METER)"
     },
     {
      "code": "B6H-F837L-00",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (PANEL CONSOLE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 18,
    "label": "ฝาครอบแฮนด์",
    "items": [
     {
      "code": "B6H-F6143-00",
      "side": null,
      "name": "ฝาครอบแฮนด์บน 1 (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B6H-F6144-00",
      "side": null,
      "name": "ฝาครอบแฮนด์ล่าง (COVER HANDLEBAR LOWER 1)"
     },
     {
      "code": "B6H-F6219-00-P1",
      "side": null,
      "name": "ฝาแฮนด์บน (EMBLEM)"
     }
    ]
   },
   {
    "x": 74,
    "y": 36,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "2DP-F413B-00",
      "side": null,
      "name": "โลโก้ส้อมเสียง 3D (TUNING FORK 3D)"
     }
    ]
   },
   {
    "x": 78,
    "y": 27,
    "label": "แผงหน้า",
    "items": [
     {
      "code": "B6H-F837M-00",
      "side": null,
      "name": "ฝาครอบแผงหน้า (PANEL CONSOLE 2)"
     },
     {
      "code": "B6H-F2865-00-PA",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านบน (COVER FRONT)"
     }
    ]
   },
   {
    "x": 82,
    "y": 45,
    "label": "ฝาครอบไฟหน้าล่าง",
    "items": [
     {
      "code": "B6H-F8377-00-PA",
      "side": null,
      "name": "ฝาครอบไฟหน้าล่าง (BODY COWLING 2)"
     },
     {
      "code": "B6H-F286F-00-PA",
      "side": null,
      "name": "ฝาครอบไฟหน้าด้านล่าง (COVER FRONT 2)"
     }
    ]
   },
   {
    "x": 85,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "2DP-F1511-00-PE",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     }
    ]
   },
   {
    "x": 68,
    "y": 55,
    "label": "ฝาข้างด้านหน้า",
    "items": [
     {
      "code": "B6H-F1731-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้ายด้านหน้า (COVER SIDE 3)"
     },
     {
      "code": "B6H-F1741-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวาด้านหน้า (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 63,
    "y": 45,
    "label": "บังลมใน",
    "items": [
     {
      "code": "B6H-F8311-00",
      "side": null,
      "name": "บังลมใน (LEG SHIELD 1)"
     },
     {
      "code": "B6H-F8312-00-P1",
      "side": null,
      "name": "ฝาครอบบังลมใน (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 57,
    "y": 45,
    "label": "ฝาปิดถังน้ำมัน",
    "items": [
     {
      "code": "B6H-F74A8-00",
      "side": null,
      "name": "ฝาปิดถังน้ำมัน (LID FUEL)"
     }
    ]
   },
   {
    "x": 42,
    "y": 30,
    "label": "เบาะ",
    "items": [
     {
      "code": "B6H-F4730-01",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     },
     {
      "code": "B6H-F842M-00",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER 1)"
     }
    ]
   },
   {
    "x": 30,
    "y": 45,
    "label": "ฝาข้างใต้เบาะ",
    "items": [
     {
      "code": "B6H-F1711-00-PA",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 1)"
     },
     {
      "code": "B6H-F1721-00-PA",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 42,
    "label": "โลโก้ NMAX",
    "items": [
     {
      "code": "B6H-F173B-50",
      "side": null,
      "name": "โลโก้ NMAX 3D"
     }
    ]
   },
   {
    "x": 22,
    "y": 25,
    "label": "กันตกท้ายเบาะ",
    "items": [
     {
      "code": "B6H-F4773-10",
      "side": null,
      "name": "กันตกท้ายเบาะ (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 12,
    "y": 30,
    "label": "ฝาครอบไฟท้าย",
    "items": [
     {
      "code": "B6H-H4716-00",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER TAILLIGHT)"
     }
    ]
   },
   {
    "x": 10,
    "y": 52,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B6H-F1611-20",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     },
     {
      "code": "B6H-F1552-01",
      "side": null,
      "name": "บังโคลนหลังใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 50,
    "y": 62,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B6H-F7481-00",
      "side": "ซ้าย",
      "name": "แผ่นรองพักเท้าข้างซ้าย (BOARD FOOTREST 1)"
     },
     {
      "code": "B6H-F7488-00",
      "side": "ขวา",
      "name": "แผ่นรองพักเท้าข้างขวา (BOARD FOOTREST 2)"
     },
     {
      "code": "B6H-F171L-00-PA",
      "side": "ซ้าย",
      "name": "ฝาครอบแผงหน้าข้างซ้าย (MOLE SIDE COVER 1)"
     },
     {
      "code": "B6H-F171M-00-PA",
      "side": "ขวา",
      "name": "ฝาครอบแผงหน้าข้างขวา (MOLE SIDE COVER 2)"
     }
    ]
   },
   {
    "x": 52,
    "y": 72,
    "label": "ฝาครอบใต้ท้อง",
    "items": [
     {
      "code": "B6H-F8385-01",
      "side": null,
      "name": "ฝาครอบใต้ท้องรถ (COVER LOWER)"
     }
    ]
   },
   {
    "x": 32,
    "y": 58,
    "label": "ฝาข้างล่าง",
    "items": [
     {
      "code": "B6H-F171E-00",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 5)"
     },
     {
      "code": "B6H-F171X-00",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 6)"
     }
    ]
   },
   {
    "x": 20,
    "y": 68,
    "label": "ท่อไอเสีย (ฝั่งขวา)",
    "items": [
     {
      "code": "BBR-E4711-10",
      "side": "ขวา",
      "name": "ท่อไอเสีย (MUFFLER)"
     },
     {
      "code": "B6H-E4718-00",
      "side": "ขวา",
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER)"
     }
    ]
   }
  ]
 }
};

export default BIKE_HOTSPOTS;
