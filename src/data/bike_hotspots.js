// จุดกดบนรูปตัวรถ (bike hotspots) — key = `${model}|${page}` ของสีในสมุดภาพ
// NMAX ครบทุกสี: เจน BTF (รูปหันซ้าย) / เจน B1T/BBB (รูปหันขวา, view ขวา)
// Grand Filano ครบทุกสี (หันซ้าย) · GIORNO+ ครบทุกสี (หันขวา)
// Yamaha แมปรหัสข้ามเจนด้วยท่อนกลาง · Honda ใช้เลข 5 หลักหน้า
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
      "code": "BLS-F8351-00-P2",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "BLS-F8377-00-P2",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "BLS-F8351-00-P3",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "BLS-F8377-00-P3",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "BLS-F8351-00-P4",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "BLS-F8377-00-P4",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "BLS-F8351-00-PG",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "BLS-F8377-00-PG",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "BLS-F8351-00-P6",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "BLS-F8377-00-P6",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P3",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P3",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P4",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P4",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P5",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P5",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P6",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P6",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P8",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P8",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P4",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P4",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P5",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P5",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P8",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P8",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P4",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P4",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-3E",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-3E",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-PA",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-PA",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P7",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P7",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-PB",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-PB",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P8",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P8",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-3E",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-3E",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-PD",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-PD",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P9",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P9",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P7",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P7",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-PB",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-PB",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-P7",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-P7",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
      "code": "B6H-F8351-00-PA",
      "side": "ซ้าย",
      "name": "ฝาครอบไฟหน้าซ้าย (BODY COWLING)"
     },
     {
      "code": "B6H-F8377-00-PA",
      "side": "ขวา",
      "name": "ฝาครอบไฟหน้าขวา (BODY COWLING 2)"
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
 "Grand Filano|bjkcd3": {
  "img": "/bike-photos/gf_bjkcd3.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 26,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F62D0-50",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F62E0-50",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 27,
    "y": 14,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P1",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 42,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-10-PC",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-10-PC",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 26,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-P5",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P1",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 21,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-PW",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-PW",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-PX",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 32,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-10",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 13,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-PW",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     },
     {
      "code": "BF6-F1578-J0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (EMBLEM)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 60,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-40",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 91,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 88,
    "y": 48,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-R0",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 93,
    "y": 43,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P1",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 81,
    "y": 51,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-PW",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-01-PX",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-10",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-10",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 60,
    "y": 53,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-PW",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173E-R0",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 54,
    "y": 61,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-PW",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-PW",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 62,
    "y": 74,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 46,
    "y": 72,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 91,
    "y": 66,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-10",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjkcd4": {
  "img": "/bike-photos/gf_bjkcd4.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 26,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F62D0-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F62E0-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 27,
    "y": 14,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P1",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 42,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-10-PE",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-10-PE",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 26,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-P5",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P1",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 21,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-PY",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-PY",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-S0",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 32,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-10",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 13,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-PY",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     },
     {
      "code": "BF6-F1578-E0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (EMBLEM)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 60,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-60",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 91,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 88,
    "y": 48,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-PY",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 93,
    "y": 43,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P1",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 81,
    "y": 51,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-PY",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-01-S0",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-10",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-10",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 60,
    "y": 53,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-PY",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173E-T0",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 54,
    "y": 61,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-PY",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-PY",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 62,
    "y": 74,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 46,
    "y": 72,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 91,
    "y": 66,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-10",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjkcd5": {
  "img": "/bike-photos/gf_bjkcd5.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 26,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F62D0-20",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F62E0-20",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 27,
    "y": 14,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P1",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 42,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-00-P6",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-00-P6",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 26,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-P8",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P1",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 21,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-P9",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-P9",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-S1",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 32,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-30",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 13,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-P9",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 60,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-60",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 91,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 88,
    "y": 48,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-U0",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 93,
    "y": 43,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P1",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 81,
    "y": 51,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-P9",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-01-P9",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-30",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-30",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 60,
    "y": 53,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-P9",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173E-60",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 54,
    "y": 61,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-P9",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-P9",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 62,
    "y": 74,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 46,
    "y": 72,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 91,
    "y": 66,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjkcd6": {
  "img": "/bike-photos/gf_bjkcd6.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 26,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F62D0-00",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F62E0-00",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 27,
    "y": 14,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P1",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 42,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-10-PH",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-10-PH",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 26,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-P5",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P1",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 21,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-S2",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-S2",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-S3",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 32,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-10",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 13,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-S2",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     },
     {
      "code": "BF6-F1578-E0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (EMBLEM)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 60,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-60",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 91,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 88,
    "y": 48,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-S0",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 93,
    "y": 43,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P1",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 81,
    "y": 51,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-S2",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-01-S3",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-10",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-10",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 60,
    "y": 53,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-S2",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173E-S0",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 54,
    "y": 61,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-S2",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-P2",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 62,
    "y": 74,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 46,
    "y": 72,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 91,
    "y": 66,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-10",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjkcd7": {
  "img": "/bike-photos/gf_bjkcd7.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 26,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F6280-R0",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F6290-R0",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 27,
    "y": 14,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P1",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 42,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-00-PH",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-00-PH",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 26,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-PL",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P1",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 21,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-PU",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-PU",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-PV",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 32,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-00",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 13,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-PU",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 60,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-50",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 91,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 88,
    "y": 48,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-PU",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 93,
    "y": 43,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P1",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 81,
    "y": 51,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-PU",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-01-PV",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-00",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-00",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 60,
    "y": 53,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-PU",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173E-K0",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 54,
    "y": 61,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-PU",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-PU",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 62,
    "y": 74,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 46,
    "y": 72,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 91,
    "y": 66,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjkcd8": {
  "img": "/bike-photos/gf_bjkcd8.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 26,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F6280-S0",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F6290-S0",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 27,
    "y": 14,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P1",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 42,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-00-PE",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-00-PE",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 26,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-P4",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P1",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 21,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-P5",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-P5",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-P5",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 32,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-20",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 13,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-P5",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 60,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-50",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 91,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 88,
    "y": 48,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-P5",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 93,
    "y": 43,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P1",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 81,
    "y": 51,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-P5",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-01-P5",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-20",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-20",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 60,
    "y": 53,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-P5",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173E-L0",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 54,
    "y": 61,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-P5",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-P5",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 62,
    "y": 74,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 46,
    "y": 72,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 91,
    "y": 66,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjkcd9": {
  "img": "/bike-photos/gf_bjkcd9.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 26,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F6280-T0",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F6290-T0",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 27,
    "y": 14,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P1",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 42,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-00-PF",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-00-PF",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 26,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-PJ",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P1",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 21,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-PR",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-PR",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-PS",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 32,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-10",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 13,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-PR",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 60,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-50",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 91,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 88,
    "y": 48,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-PR",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 93,
    "y": 43,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P1",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 81,
    "y": 51,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-PR",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-01-PU",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-10",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-10",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 60,
    "y": 53,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-PR",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173E-M0",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 54,
    "y": 61,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-PR",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-PR",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 62,
    "y": 74,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 46,
    "y": 72,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 91,
    "y": 66,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjkcd10": {
  "img": "/bike-photos/gf_bjkcd10.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 26,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F6280-E0",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F6290-E0",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 27,
    "y": 14,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-3E",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 42,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-3E",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-00-P8",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-00-P8",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 26,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-PA",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-3E",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "BJM-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 21,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-PG",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-PG",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 37,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-PH",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 32,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-10",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 13,
    "y": 63,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-PG",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 60,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-50",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 91,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 88,
    "y": 48,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-PG",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 93,
    "y": 43,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-3E",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 81,
    "y": 51,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-PG",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-01-PG",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-10",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-10",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 60,
    "y": 53,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-PG",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173E-N0",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 54,
    "y": 61,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-PG",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-PG",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 62,
    "y": 74,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 46,
    "y": 72,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 91,
    "y": 66,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b6_0903": {
  "img": "/bike-photos/gf_b8b6_0903.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 28,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2BL-F6280-L0",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2BL-F6290-L0",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P0",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 43,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-P6",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-P6",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P0",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 29,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-P6",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P0",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-P6",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-P6",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 40,
    "y": 38,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-P6",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P0",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-70",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 18,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-P6",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 28,
    "y": 55,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 65,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-90",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 86,
    "y": 31,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-PB",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 85,
    "y": 46,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-P6",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 89,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-P6",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P1",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 78,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-P6",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-P6",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P0",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P0",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 58,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-P6",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-P6",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-P6",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-P2",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-P2",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 60,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-P2",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-P2",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 68,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 86,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 77,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b6_1610": {
  "img": "/bike-photos/gf_b8b6_1610.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 28,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2BL-F6280-90",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2BL-F6290-90",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P1",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 43,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-PH",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-PH",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P1",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 29,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-PH",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P1",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-PH",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-PH",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 40,
    "y": 38,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-PH",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P1",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-B0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 18,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-PH",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 28,
    "y": 55,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 65,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-A0",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 86,
    "y": 31,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-PJ",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 85,
    "y": 46,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-PH",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 89,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-PH",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P0",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 78,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-PH",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-PH",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P1",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P1",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 58,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-PH",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-PH",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-PH",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-PE",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-PE",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 60,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-PE",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-PE",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 68,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 86,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 77,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b6_1565": {
  "img": "/bike-photos/gf_b8b6_1565.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 28,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2BL-F6280-M0",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2BL-F6290-M0",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P1",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 43,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-PJ",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-PJ",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P1",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 29,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-PJ",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P1",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-PJ",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-PJ",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 40,
    "y": 38,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-PJ",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P1",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-C0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 18,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-PJ",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 28,
    "y": 55,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 65,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-B0",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 86,
    "y": 31,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-PK",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 85,
    "y": 46,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-PJ",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 89,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-PJ",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P0",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 78,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-PJ",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-PJ",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P1",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P1",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 58,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-PJ",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-PJ",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-PJ",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-PF",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-PF",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 60,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-PF",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-PF",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 68,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 86,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 77,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b6_1754": {
  "img": "/bike-photos/gf_b8b6_1754.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 28,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2BL-F6280-N0",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2BL-F6290-N0",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P1",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 43,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-PK",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-PK",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P1",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 29,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-PK",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P1",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-PK",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-PK",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 40,
    "y": 38,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-PK",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P1",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-70",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 18,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-PK",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 28,
    "y": 55,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 65,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-A0",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 86,
    "y": 31,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-PL",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 85,
    "y": 46,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-PK",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 89,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-PK",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P0",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 78,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-PK",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-PK",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P1",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P1",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 58,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-PK",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-PK",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-PK",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-PG",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-PG",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 60,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-PG",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-PG",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 68,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 86,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 77,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b7_1651": {
  "img": "/bike-photos/gf_b8b7_1651.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 28,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2BL-F6280-P0",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2BL-F6290-P0",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P0",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 43,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-PL",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-PL",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P0",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 29,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-PL",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P0",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-PL",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-PL",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 40,
    "y": 38,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-PL",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P1",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-D0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 18,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-PL",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     },
     {
      "code": "BF6-F1578-A0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (EMBLEM)"
     }
    ]
   },
   {
    "x": 28,
    "y": 55,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 65,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-80",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 86,
    "y": 31,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-PM",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 85,
    "y": 46,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-PL",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 89,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-PL",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P0",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 78,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-PL",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-PL",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P1",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P1",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 58,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-PL",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-PL",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-PL",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-PH",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-PH",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 60,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-PH",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-PH",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 68,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 86,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-10",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 77,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b7_1783": {
  "img": "/bike-photos/gf_b8b7_1783.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 28,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2BL-F6280-R0",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2BL-F6290-R0",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P0",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 43,
    "y": 17,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-PM",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-PM",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P0",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 29,
    "y": 25,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-PM",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P0",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 44,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-PM",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-PM",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 40,
    "y": 38,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-PM",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P1",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-E0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 18,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-PM",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     },
     {
      "code": "BF6-F1578-B0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (EMBLEM)"
     }
    ]
   },
   {
    "x": 28,
    "y": 55,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 65,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-70",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 86,
    "y": 31,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-PN",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 85,
    "y": 46,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-PM",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 89,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-PM",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P0",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 78,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-PM",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-PM",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P1",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P1",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 58,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-PM",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-PM",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-PM",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-PJ",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-PJ",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 60,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-PJ",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-PJ",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 68,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 86,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-10",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 77,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b8_1862": {
  "img": "/bike-photos/gf_b8b8_1862.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 29,
    "y": 7,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "B8B-F6280-00",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "B8B-F6290-00",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 32,
    "y": 16,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P0",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 45,
    "y": 20,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-PP",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-PP",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P0",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 30,
    "y": 27,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-PP",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P0",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836D-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 47,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-PP",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-PP",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 41,
    "y": 42,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-PP",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 36,
    "y": 31,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P1",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-70",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 16,
    "y": 58,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-PP",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 27,
    "y": 58,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 62,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-C0",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 84,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-PR",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 83,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-PP",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 87,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-PP",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P0",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-PP",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-PP",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P1",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P1",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 57,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-PP",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-PP",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-PP",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-PL",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-PL",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 58,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-PL",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-PL",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 67,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 83,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 75,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b8_1579": {
  "img": "/bike-photos/gf_b8b8_1579.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 29,
    "y": 7,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "B8B-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "B8B-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 32,
    "y": 16,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P3",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 45,
    "y": 20,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-PA",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-PA",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P3",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 30,
    "y": 27,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-PA",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P3",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836D-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 47,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-PA",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-PA",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 41,
    "y": 42,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-PA",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 36,
    "y": 31,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P2",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-90",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 16,
    "y": 58,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-PA",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 27,
    "y": 58,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 62,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-D0",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 84,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-PA",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 83,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-PA",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 87,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-PA",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P3",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-PA",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-PA",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P2",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P2",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 57,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-PA",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-PA",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-PA",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-P7",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-P7",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 58,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-P7",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-P7",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 67,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 83,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 75,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b8_1763": {
  "img": "/bike-photos/gf_b8b8_1763.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 29,
    "y": 7,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "2BL-F6280-K0",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "2BL-F6290-K0",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 32,
    "y": 16,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P1",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 45,
    "y": 20,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-P8",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-P8",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P1",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 30,
    "y": 27,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-P8",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P1",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836D-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 47,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-P8",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-P8",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 41,
    "y": 42,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-P8",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 36,
    "y": 31,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P0",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-70",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 16,
    "y": 58,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-P8",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 27,
    "y": 58,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 62,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-D0",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 84,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-P8",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 83,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-P8",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 87,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-P8",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P1",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-P8",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-P8",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P0",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P0",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 57,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-P8",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-P8",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-P8",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-P5",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-P5",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 58,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-P5",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-P5",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 67,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 83,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 75,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b8_1705": {
  "img": "/bike-photos/gf_b8b8_1705.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 29,
    "y": 7,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "B8B-F6280-20",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "B8B-F6290-20",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 32,
    "y": 16,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P0",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 45,
    "y": 20,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-PE",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-PE",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P0",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 30,
    "y": 27,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-PE",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P0",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836D-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 47,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-PE",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-PE",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 41,
    "y": 42,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-PE",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 36,
    "y": 31,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P1",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-F0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 16,
    "y": 58,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-PE",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 27,
    "y": 58,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 62,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-E0",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 84,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-PF",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 83,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-PE",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 87,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-PE",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P0",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-PE",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-PE",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P1",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P1",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 57,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-PE",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-PE",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-PE",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-PB",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-PB",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 58,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-PB",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-PB",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 67,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 83,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 75,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b8_1864": {
  "img": "/bike-photos/gf_b8b8_1864.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 29,
    "y": 7,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "B8B-F6280-30",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "B8B-F6290-30",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 32,
    "y": 16,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P0",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 45,
    "y": 20,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-PN",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-PN",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P0",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 30,
    "y": 27,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-PN",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P0",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836D-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 47,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-PN",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-PN",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 41,
    "y": 42,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-PN",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 36,
    "y": 31,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P1",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-G0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 16,
    "y": 58,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-PN",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 27,
    "y": 58,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 62,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-E0",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 84,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-PP",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 83,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-PN",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 87,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-PN",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P0",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-PN",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-PN",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P1",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P1",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 57,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-PN",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-PN",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-PN",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-PK",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-PK",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 58,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-PK",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-PK",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 67,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 83,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 75,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b9_1864": {
  "img": "/bike-photos/gf_b8b9_1864.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 29,
    "y": 7,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "B8B-F6280-30",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "B8B-F6290-30",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 32,
    "y": 16,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P0",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 45,
    "y": 20,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-PN",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-PN",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P0",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 30,
    "y": 27,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-PN",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P0",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836D-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 47,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-PN",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-PN",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 41,
    "y": 42,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-PN",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 36,
    "y": 31,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P1",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-G0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 16,
    "y": 58,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-PN",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     },
     {
      "code": "BF6-F1578-D0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (EMBLEM)"
     }
    ]
   },
   {
    "x": 27,
    "y": 58,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 62,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-F0",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 84,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-PP",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 83,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-PN",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 87,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-PN",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P0",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-PN",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-PN",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P1",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P1",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 57,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-PN",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-PN",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-PN",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-PK",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-PK",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 58,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-PK",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-PK",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 67,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 83,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-10",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 75,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|b8b9_1863": {
  "img": "/bike-photos/gf_b8b9_1863.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 29,
    "y": 7,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "B8B-F6280-40",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "B8B-F6290-40",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 32,
    "y": 16,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "B8B-F835A-10-P0",
      "side": null,
      "name": "ขอบไฟหน้า (RIM HEADLIGHT)"
     }
    ]
   },
   {
    "x": 45,
    "y": 20,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "B8B-F6143-00-PR",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "B8B-F6145-00-PR",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     },
     {
      "code": "B8B-H3559-10-P0",
      "side": null,
      "name": "ฝาครอบไมล์ (COVER METER)"
     }
    ]
   },
   {
    "x": 30,
    "y": 27,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "B8B-F8309-00-PR",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "B8B-F3391-10-P0",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836D-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 24,
    "y": 47,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F8311-00-PR",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "B8B-F8312-00-PR",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 41,
    "y": 42,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "B8B-F831A-00-PR",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 36,
    "y": 31,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "B8B-F839B-10-P1",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "B8B-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "B8B-F6192-70",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 16,
    "y": 58,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "B8B-F1511-00-PR",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     },
     {
      "code": "BF6-F1578-E0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (EMBLEM)"
     }
    ]
   },
   {
    "x": 27,
    "y": 58,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "B8B-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 62,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "B8B-F4730-G0",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 84,
    "y": 33,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "B8B-F4773-00-PS",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 83,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "B8B-F171E-00-PR",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 87,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "B8B-F1741-00-PR",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     },
     {
      "code": "B8B-H4715-10-P0",
      "side": null,
      "name": "ขอบไฟท้าย (RIM TAILLIGHT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F1721-00-PR",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "B8B-F1731-00-PR",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "B8B-F173B-10-P1",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "B8B-F174B-10-P1",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 57,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "B8B-F1711-00-PN",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     }
    ]
   },
   {
    "x": 52,
    "y": 58,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171L-00-PR",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "B8B-F171M-00-PR",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     },
     {
      "code": "B8B-F8345-00-PM",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (MOLE 1)"
     },
     {
      "code": "B8B-F8346-00-PM",
      "side": "ขวา",
      "name": "แฟริ่งขวา (MOLE 2)"
     },
     {
      "code": "B8B-F172A-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้าย (PANEL 1)"
     },
     {
      "code": "B8B-F172F-00",
      "side": "ขวา",
      "name": "แฟริ่งขวา (PANEL 2)"
     }
    ]
   },
   {
    "x": 58,
    "y": 68,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "B8B-F171N-00-PM",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "B8B-F171R-00-PM",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 45,
    "y": 67,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "B8B-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 83,
    "y": 62,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "B8B-F1611-10",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 75,
    "y": 60,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-00",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BL-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjk1_1878": {
  "img": "/bike-photos/gf_bjk1_1878.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 27,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F6280-00",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F6290-00",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P0",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 43,
    "y": 18,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P0",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-00-P0",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-00-P0",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 28,
    "y": 26,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-P0",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P0",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 22,
    "y": 45,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-P0",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-P0",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 38,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-P0",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-00",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 14,
    "y": 60,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-P0",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 55,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 77,
    "y": 32,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-P0",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 80,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P0",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 70,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-P0",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-00-P0",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-00",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-00",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 53,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-P0",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173E-00",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 48,
    "y": 60,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-P0",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-P0",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 55,
    "y": 72,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 42,
    "y": 70,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 68,
    "y": 62,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjk1_1218": {
  "img": "/bike-photos/gf_bjk1_1218.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 27,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F6280-10",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F6290-10",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P0",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 43,
    "y": 18,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P0",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-00-P1",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-00-P1",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 28,
    "y": 26,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-P1",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P0",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 22,
    "y": 45,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-P1",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-P1",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 38,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-P1",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-00",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 14,
    "y": 60,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-P1",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 55,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 77,
    "y": 32,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-P1",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 80,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P0",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 70,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-P1",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-00-P1",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-00",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-00",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 53,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-P1",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173E-10",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 48,
    "y": 60,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-P1",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-P1",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 55,
    "y": 72,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 42,
    "y": 70,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 68,
    "y": 62,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjk1_0775": {
  "img": "/bike-photos/gf_bjk1_0775.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 27,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F6280-20",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F6290-20",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P0",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 43,
    "y": 18,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P0",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-00-P2",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-00-P2",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 28,
    "y": 26,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-P2",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P0",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 22,
    "y": 45,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-P2",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-P2",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 38,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-P2",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-00",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 14,
    "y": 60,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-P2",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 55,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 77,
    "y": 32,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-P2",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 80,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P0",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 70,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-P2",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-00-P2",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-00",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-00",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 53,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-P2",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173E-20",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 48,
    "y": 60,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-P2",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-P2",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 55,
    "y": 72,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 42,
    "y": 70,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 68,
    "y": 62,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjk1_1760": {
  "img": "/bike-photos/gf_bjk1_1760.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 27,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F6280-30",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F6290-30",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P1",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 43,
    "y": 18,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P1",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-00-P3",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-00-P3",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 28,
    "y": 26,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-P3",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P1",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 22,
    "y": 45,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-P3",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-P3",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 38,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-P3",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-10",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 14,
    "y": 60,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-P3",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 55,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-00",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 77,
    "y": 32,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-P3",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 80,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P1",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 70,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-P3",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-00-P3",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-10",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-10",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 53,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-P3",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173E-30",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 48,
    "y": 60,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-P3",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-P3",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 55,
    "y": 72,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 42,
    "y": 70,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-00",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 68,
    "y": 62,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjk2_0752": {
  "img": "/bike-photos/gf_bjk2_0752.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 27,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F6280-40",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F6290-40",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P2",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 43,
    "y": 18,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P2",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-10-P0",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-10-P0",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 28,
    "y": 26,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-P4",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P2",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 22,
    "y": 45,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-P4",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-P4",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 38,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-P4",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-20",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 14,
    "y": 60,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-P4",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     },
     {
      "code": "BF6-F1578-E0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (EMBLEM)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 55,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-10",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 77,
    "y": 32,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-P4",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 80,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P2",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 70,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-P4",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-00-P4",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-20",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-20",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 53,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-P4",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173F-00",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 48,
    "y": 60,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-P4",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-P4",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 55,
    "y": 72,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 42,
    "y": 70,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-10",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 68,
    "y": 62,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjk2_0903": {
  "img": "/bike-photos/gf_bjk2_0903.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 27,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F6280-50",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F6290-50",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P2",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 43,
    "y": 18,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P2",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-10-P1",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-10-P1",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 28,
    "y": 26,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-P5",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P2",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 22,
    "y": 45,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-P5",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-P5",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 38,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-P5",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-20",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 14,
    "y": 60,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-P5",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     },
     {
      "code": "BF6-F1578-E0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (EMBLEM)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 55,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-10",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 77,
    "y": 32,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-P5",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 80,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P2",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 70,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-P5",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-00-P5",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-20",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-20",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 53,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-P5",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173F-10",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 48,
    "y": 60,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-P5",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-P5",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 55,
    "y": 72,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 42,
    "y": 70,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-10",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 68,
    "y": 62,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "Grand Filano|bjk2_1651": {
  "img": "/bike-photos/gf_bjk2_1651.jpg",
  "view": "ซ้าย",
  "hotspots": [
   {
    "x": 27,
    "y": 6,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "BJK-F6280-60",
      "side": "ซ้าย",
      "name": "กระจกมองหลังข้างซ้าย"
     },
     {
      "code": "BJK-F6290-60",
      "side": "ขวา",
      "name": "กระจกมองหลังข้างขวา"
     }
    ]
   },
   {
    "x": 30,
    "y": 15,
    "label": "ไฟหน้า / ขอบไฟหน้า",
    "items": [
     {
      "code": "BJK-F6231-00-P2",
      "side": null,
      "name": "ฝาครอบไฟหน้า (COVER HANDLE FRONT 1)"
     }
    ]
   },
   {
    "x": 43,
    "y": 18,
    "label": "ฝาครอบแฮนด์ / เรือนไมล์",
    "items": [
     {
      "code": "BJK-F6213-00-P2",
      "side": null,
      "name": "ฝาเรือนไมล์ตัวบน (COVER HANDLE UPPER)"
     },
     {
      "code": "BJK-F6143-10-P2",
      "side": null,
      "name": "ฝาครอบแฮนด์หน้า (COVER HANDLE UPPER 1)"
     },
     {
      "code": "BJK-F6145-10-P2",
      "side": null,
      "name": "ฝาครอบเรือนไมล์ (COVER HANDLE 2)"
     }
    ]
   },
   {
    "x": 28,
    "y": 26,
    "label": "กระจังหน้า / ฝาครอบแตร",
    "items": [
     {
      "code": "BJK-F8339-00-P4",
      "side": null,
      "name": "กระจังหน้า (MOLD LEG SHIELD)"
     },
     {
      "code": "BJK-F8336-00-P2",
      "side": null,
      "name": "ฝาครอบแตร (PLATE)"
     },
     {
      "code": "B8B-F836B-00",
      "side": null,
      "name": "ฝาปิดพร้อมโลโก้ส้อมเสียง (TUNNING FORK MARK)"
     }
    ]
   },
   {
    "x": 22,
    "y": 45,
    "label": "บังลม (แผงหน้าซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F8311-00-P6",
      "side": "ซ้าย",
      "name": "บังลมซ้าย (LEG SHIELD 1)"
     },
     {
      "code": "BJK-F8312-00-P6",
      "side": "ขวา",
      "name": "บังลมขวา (LEG SHIELD 2)"
     }
    ]
   },
   {
    "x": 38,
    "y": 40,
    "label": "บังลมตัวใน",
    "items": [
     {
      "code": "BJK-F831A-00-P6",
      "side": null,
      "name": "บังลมตัวใน (BODY COWLING)"
     }
    ]
   },
   {
    "x": 33,
    "y": 33,
    "label": "โลโก้หน้ารถ",
    "items": [
     {
      "code": "BJK-F839B-20",
      "side": null,
      "name": "โลโก้ GRAND FILANO 3D"
     },
     {
      "code": "BKF-F6167-00",
      "side": null,
      "name": "โลโก้ BLUE CORE HYBRID"
     },
     {
      "code": "BJK-F8368-00",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้"
     }
    ]
   },
   {
    "x": 14,
    "y": 60,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "BJK-F1511-00-P6",
      "side": null,
      "name": "บังโคลนหน้า (FENDER FRONT)"
     },
     {
      "code": "B8B-F1556-00",
      "side": null,
      "name": "บังโคลนหน้าตัวใน (FENDER FRONT 2)"
     },
     {
      "code": "BF6-F1578-A0",
      "side": null,
      "name": "สติ๊กเกอร์โลโก้ ABS (EMBLEM)"
     }
    ]
   },
   {
    "x": 25,
    "y": 57,
    "label": "บังโคลนตัวใน",
    "items": [
     {
      "code": "BJK-F1552-00",
      "side": null,
      "name": "บังโคลนตัวใน (FENDER INNER)"
     }
    ]
   },
   {
    "x": 55,
    "y": 38,
    "label": "เบาะ",
    "items": [
     {
      "code": "BJK-F4730-10",
      "side": null,
      "name": "ชุดเบาะ (DOUBLE SEAT ASSY)"
     }
    ]
   },
   {
    "x": 77,
    "y": 32,
    "label": "กันตก (ราวจับท้าย)",
    "items": [
     {
      "code": "BJK-F4773-00-P0",
      "side": null,
      "name": "กันตก (HANDLE SEAT)"
     }
    ]
   },
   {
    "x": 76,
    "y": 47,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "BJK-F171E-00-P6",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ (COVER SIDE 5)"
     }
    ]
   },
   {
    "x": 80,
    "y": 44,
    "label": "ไฟท้าย",
    "items": [
     {
      "code": "BJK-F1741-00-P2",
      "side": null,
      "name": "ฝาครอบไฟท้าย (COVER SIDE 4)"
     }
    ]
   },
   {
    "x": 70,
    "y": 50,
    "label": "ฝาข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F1721-00-P6",
      "side": "ซ้าย",
      "name": "ฝาข้างซ้าย (COVER SIDE 2)"
     },
     {
      "code": "BJK-F1731-00-P6",
      "side": "ขวา",
      "name": "ฝาข้างขวา (COVER SIDE 3)"
     },
     {
      "code": "BJK-F173B-20",
      "side": "ซ้าย",
      "name": "โลโก้ฝาข้างซ้าย GRAND FILANO 3D"
     },
     {
      "code": "BJK-F174B-20",
      "side": "ขวา",
      "name": "โลโก้ฝาข้างขวา GRAND FILANO 3D"
     }
    ]
   },
   {
    "x": 53,
    "y": 52,
    "label": "ฝาครอบใต้เบาะ",
    "items": [
     {
      "code": "BJK-F1711-00-P6",
      "side": null,
      "name": "ฝาครอบใต้เบาะ (COVER SIDE 1)"
     },
     {
      "code": "BJK-F173F-20",
      "side": "ซ้าย",
      "name": "สติ๊กเกอร์ฝาครอบใต้เบาะด้านซ้าย"
     }
    ]
   },
   {
    "x": 48,
    "y": 60,
    "label": "แฟริ่งตัวบน (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7496-00-P6",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวบน (MOLE SIDE 1)"
     },
     {
      "code": "BJK-F7497-00-P6",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวบน (MOLE SIDE 2)"
     }
    ]
   },
   {
    "x": 55,
    "y": 72,
    "label": "แฟริ่งตัวล่าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "BJK-F7413-00",
      "side": "ซ้าย",
      "name": "แฟริ่งซ้ายตัวล่าง (COVER FOOTREST)"
     },
     {
      "code": "BJK-F7423-00",
      "side": "ขวา",
      "name": "แฟริ่งขวาตัวล่าง (COVER FOOTREST 2)"
     }
    ]
   },
   {
    "x": 42,
    "y": 70,
    "label": "แผ่นรองพักเท้า",
    "items": [
     {
      "code": "BJK-F7481-00",
      "side": null,
      "name": "แผ่นรองพักเท้า (BOARD FOOTREST)"
     }
    ]
   },
   {
    "x": 78,
    "y": 63,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "BJK-F1611-10",
      "side": null,
      "name": "บังโคลนหลัง (FENDER REAR)"
     }
    ]
   },
   {
    "x": 68,
    "y": 62,
    "label": "ท่อไอเสีย / แผงกันท่อ",
    "items": [
     {
      "code": "B8B-E4711-20",
      "side": null,
      "name": "ท่อไอเสีย (MUFFLER 1)"
     },
     {
      "code": "2BM-E4718-00",
      "side": null,
      "name": "แผงกันท่อไอเสีย (PROTECTOR MUFFLER 1)"
     },
     {
      "code": "2BL-E4728-00",
      "side": null,
      "name": "แผงกันท่อไอเสียตัวนอก (PROTECTOR MUFFLER 2)"
     }
    ]
   }
  ]
 },
 "GIORNO+|2": {
  "img": "/bike-photos/giorno_2.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZQ",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZQ",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T70ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T10ZM",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZV",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZC",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T11",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZT",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T70ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T10",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZT",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZT",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T90ZA",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T90ZA",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZQ",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZU",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T10",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T70ZC",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T70ZC",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-K3M-T90ZA",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZT",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZT",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZF",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZV",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZV",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T70",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T70",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T70",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T70ZF",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T90ZD",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T90ZD",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|3": {
  "img": "/bike-photos/giorno_3.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZP",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZP",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T70ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T10ZL",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZU",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZC",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T11",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZS",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T70ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T10",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZS",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZS",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T90ZB",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T90ZA",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZP",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZT",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T10",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T70ZD",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T70ZD",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-MGZ-D10ZB",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZS",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZS",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZF",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZU",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZU",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T70",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T70",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T70",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T70ZE",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T90ZC",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T90ZC",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|4": {
  "img": "/bike-photos/giorno_4.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZD",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZD",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T70ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T10ZE",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZC",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T11",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T70ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T10",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZK",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZG",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T50ZE",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T90ZA",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZF",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T10",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T00ZA",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-MGZ-D10ZC",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZK",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZK",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZF",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZK",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T70",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T70",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T70",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T70ZC",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T90ZB",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T90ZB",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|5": {
  "img": "/bike-photos/giorno_5.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZM",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZM",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T70ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T10ZK",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZC",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T11",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T70ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T10",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T90ZC",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T90ZA",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZM",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T10",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T70ZE",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T70ZE",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-MGZ-D10ZC",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZF",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T70",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T70",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T70",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T70ZA",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T90ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T90ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|6": {
  "img": "/bike-photos/giorno_6.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZF",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZF",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T70ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZC",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T01",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T70ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZE",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZE",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T30ZC",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZB",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZK",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T70ZF",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T70ZF",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-K2S-T00ZB",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZE",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZE",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZE",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T70",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T70",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T70",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T70ZG",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|7": {
  "img": "/bike-photos/giorno_7.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZL",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZL",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T70ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T00ZP",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZQ",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZC",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T01",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZQ",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T70ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZQ",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZQ",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T70ZC",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZB",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZK",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZR",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T70ZH",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T70ZH",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-K2S-T00ZB",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZQ",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZQ",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZQ",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZQ",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T70",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T70",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T70",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T70ZD",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|8": {
  "img": "/bike-photos/giorno_8.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZN",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZN",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T70ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T00ZN",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZT",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZC",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T01",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZR",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T70ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZR",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZR",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T70ZB",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZB",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZK",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZS",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T70ZG",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T70ZG",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-K2S-T00ZB",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZR",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZR",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZT",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZT",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T70",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T70",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T70",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T70ZB",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gs1": {
  "img": "/bike-photos/giorno_gs1.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZK",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZK",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T10",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T30ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T10ZH",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZP",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T11",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZP",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T30ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T10",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZP",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZP",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T50ZA",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZA",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZG",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZQ",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T10",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T30ZA",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T30ZA",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZB",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-MGZ-D10ZA",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZP",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZP",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZP",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZP",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZP",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gs2": {
  "img": "/bike-photos/giorno_gs2.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZL",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZL",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T10",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T30ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T10ZJ",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZQ",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T11",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZQ",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T30ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T10",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZQ",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZQ",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T50ZB",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZA",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZG",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZR",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T10",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T30ZB",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T30ZB",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZB",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-MGZ-D10ZC",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZQ",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZQ",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZQ",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZQ",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZQ",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gs3": {
  "img": "/bike-photos/giorno_gs3.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZD",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZD",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T10",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T30ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T10ZE",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T11",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T30ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T10",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZK",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZG",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T50ZE",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZA",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZG",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T10",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T30ZE",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T30ZE",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZB",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-MGZ-D10ZC",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZK",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZK",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZK",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZK",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gs4": {
  "img": "/bike-photos/giorno_gs4.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZG",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZG",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T10",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T30ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T10ZF",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZL",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T11",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZL",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T30ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T10",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZL",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZL",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T50ZD",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZA",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZG",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZL",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T10",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T30ZD",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T30ZD",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZB",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-MGZ-D10ZC",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZL",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZL",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZL",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZL",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZL",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gs5": {
  "img": "/bike-photos/giorno_gs5.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZF",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZF",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T30ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T01",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T30ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZE",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZE",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T30ZC",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZB",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZG",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T30ZG",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T30ZG",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T30ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-K2S-T00ZB",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZE",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZE",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZE",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZE",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gs6": {
  "img": "/bike-photos/giorno_gs6.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZK",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZK",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T30ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T00ZL",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZP",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T01",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZP",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T30ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZP",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZP",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T30ZE",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZB",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZG",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZQ",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T30ZK",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T30ZK",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T30ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-K2S-T00ZC",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZP",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZP",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZP",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZP",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZP",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gs7": {
  "img": "/bike-photos/giorno_gs7.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZH",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZH",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T30ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZM",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K3M-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T01",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K3M-T01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZM",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T30ZA",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZM",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZM",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T30ZD",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZB",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZG",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZM",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T30ZH",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T30ZH",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T30ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-K2S-T00ZB",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZM",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZM",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZM",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZM",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZM",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gr1": {
  "img": "/bike-photos/giorno_gr1.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZE",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZE",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T10",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T10ZB",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K2S-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T11",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K2S-N01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T00ZB",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T10",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZC",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZC",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T10ZC",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZA",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZC",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T10",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T00ZC",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T00ZC",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-MGZ-D10ZB",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZC",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZC",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZC",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZC",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gr2": {
  "img": "/bike-photos/giorno_gr2.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZD",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZD",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T10",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T10ZE",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K2S-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T11",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K2S-N01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T00ZB",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T10",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZK",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZG",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T10ZA",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZA",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZF",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T10",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T00ZA",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-MGZ-D10ZC",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZK",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZK",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZK",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZK",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gr3": {
  "img": "/bike-photos/giorno_gr3.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZB",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZB",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T10",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T10ZD",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZH",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K2S-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T11",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K2S-N01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZH",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T00ZB",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T10",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZH",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZJ",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T10ZD",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZA",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZE",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZH",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T10",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T00ZB",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T00ZB",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-MGZ-D10ZC",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZH",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZH",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZH",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZH",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZH",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gr4": {
  "img": "/bike-photos/giorno_gr4.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZF",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZF",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T00ZC",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K2S-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T01",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K2S-N01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T00ZB",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZE",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZE",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T00ZH",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZB",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZG",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T00ZG",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T00ZG",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZB",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-K2S-T00ZB",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZE",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZE",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZE",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZE",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gr5": {
  "img": "/bike-photos/giorno_gr5.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZD",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZD",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T00ZG",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K2S-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T01",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K2S-N01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T00ZB",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZK",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZG",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T00ZA",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZB",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZG",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T00ZD",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T00ZD",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZB",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-K2S-T00ZB",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZK",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZK",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZK",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZK",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZK",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gr6": {
  "img": "/bike-photos/giorno_gr6.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZC",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZC",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T00ZF",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZJ",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K2S-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T01",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K2S-N01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZJ",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T00ZB",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZJ",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZH",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T00ZG",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZB",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZG",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZJ",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T00ZE",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T00ZE",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZB",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-K2S-T00ZB",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZJ",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZJ",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZJ",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZJ",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZJ",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 },
 "GIORNO+|gr7": {
  "img": "/bike-photos/giorno_gr7.jpg",
  "view": "ขวา",
  "hotspots": [
   {
    "x": 75,
    "y": 5,
    "label": "กระจกมองหลัง",
    "items": [
     {
      "code": "88210-K3M-T01ZA",
      "side": "ขวา",
      "name": "กระจกมองหลังด้านขวา"
     },
     {
      "code": "88220-K3M-T01ZA",
      "side": "ซ้าย",
      "name": "กระจกมองหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 73,
    "y": 16,
    "label": "ไฟหน้า / ฝาครอบไฟหน้า",
    "items": [
     {
      "code": "53208-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบไฟหน้า"
     },
     {
      "code": "86101-K3M-T00ZA",
      "side": null,
      "name": "เครื่องหมาย HONDA 65 มม."
     }
    ]
   },
   {
    "x": 56,
    "y": 13,
    "label": "เรือนไมล์ / ฝาครอบแฮนด์",
    "items": [
     {
      "code": "53205-K3M-T00ZE",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหน้า"
     },
     {
      "code": "53206-K3M-T00ZG",
      "side": null,
      "name": "ฝาครอบแฮนด์ด้านหลัง"
     },
     {
      "code": "53210-K3M-T00ZB",
      "side": null,
      "name": "ชุดฝาครอบเรือนไมล์"
     },
     {
      "code": "37213-K2S-T01",
      "side": null,
      "name": "ชุดเรือนมาตรวัดความเร็ว"
     },
     {
      "code": "37210-K3M-T01",
      "side": null,
      "name": "แผงมาตรวัดความเร็ว"
     },
     {
      "code": "37212-K2S-N01",
      "side": null,
      "name": "เลนส์มาตรวัดความเร็ว"
     }
    ]
   },
   {
    "x": 78,
    "y": 36,
    "label": "ฝาครอบด้านหน้า (แผงหน้า)",
    "items": [
     {
      "code": "64301-K3M-T00ZG",
      "side": null,
      "name": "ฝาครอบด้านหน้า"
     },
     {
      "code": "64300-K3M-T00ZB",
      "side": null,
      "name": "ชุดตกแต่งฝาครอบด้านหน้า"
     },
     {
      "code": "64305-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบชุดตกแต่งด้านหน้า"
     }
    ]
   },
   {
    "x": 85,
    "y": 45,
    "label": "ฝาครอบหน้าด้านข้าง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64501-K3M-T00ZG",
      "side": "ขวา",
      "name": "ฝาครอบหน้าด้านขวา"
     },
     {
      "code": "64601-K3M-T00ZK",
      "side": "ซ้าย",
      "name": "ฝาครอบหน้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 89,
    "y": 57,
    "label": "บังโคลนหน้า",
    "items": [
     {
      "code": "61200-K3M-T00ZC",
      "side": null,
      "name": "ชุดบังโคลนหน้า"
     }
    ]
   },
   {
    "x": 30,
    "y": 35,
    "label": "เบาะนั่ง",
    "items": [
     {
      "code": "77200-K3M-T00ZB",
      "side": null,
      "name": "เบาะนั่งทั้งชุด"
     }
    ]
   },
   {
    "x": 12,
    "y": 31,
    "label": "เหล็กท้ายเบาะ",
    "items": [
     {
      "code": "84100-K3M-T00ZG",
      "side": null,
      "name": "เหล็กท้ายเบาะ"
     }
    ]
   },
   {
    "x": 11,
    "y": 40,
    "label": "ฝาครอบท้ายเบาะ",
    "items": [
     {
      "code": "83750-K3M-T00ZG",
      "side": null,
      "name": "ฝาครอบท้ายเบาะ"
     }
    ]
   },
   {
    "x": 8,
    "y": 45,
    "label": "ไฟท้าย / ฝาครอบตกแต่ง",
    "items": [
     {
      "code": "83760-K3M-T00ZB",
      "side": null,
      "name": "ฝาครอบตกแต่งไฟท้าย"
     },
     {
      "code": "80102-K3M-T00",
      "side": null,
      "name": "ฝาครอบไฟส่องป้ายทะเบียน"
     }
    ]
   },
   {
    "x": 20,
    "y": 48,
    "label": "ฝาครอบท้ายด้านข้าง + เครื่องหมาย",
    "items": [
     {
      "code": "83550-K3M-T00ZF",
      "side": "ขวา",
      "name": "ชุดฝาครอบท้ายด้านขวา"
     },
     {
      "code": "83650-K3M-T00ZF",
      "side": "ซ้าย",
      "name": "ชุดฝาครอบท้ายด้านซ้าย"
     },
     {
      "code": "86836-K3M-T00ZB",
      "side": null,
      "name": "เครื่องหมาย GIORNO+"
     },
     {
      "code": "86611-K2S-T00ZB",
      "side": null,
      "name": "เครื่องหมาย ABS"
     },
     {
      "code": "86170-K0R-V00",
      "side": null,
      "name": "เครื่องหมาย ESP"
     }
    ]
   },
   {
    "x": 18,
    "y": 59,
    "label": "บังโคลนหลัง",
    "items": [
     {
      "code": "80100-K3M-T00",
      "side": null,
      "name": "บังโคลนหลัง"
     },
     {
      "code": "80107-K3M-T00",
      "side": null,
      "name": "บังโคลนหลังตัวใน"
     }
    ]
   },
   {
    "x": 28,
    "y": 60,
    "label": "ฝาครอบพักเท้าหลัง (ซ้าย-ขวา)",
    "items": [
     {
      "code": "83511-K3M-T00ZA",
      "side": "ขวา",
      "name": "ฝาครอบพักเท้าหลังด้านขวา"
     },
     {
      "code": "83611-K3M-T00ZA",
      "side": "ซ้าย",
      "name": "ฝาครอบพักเท้าหลังด้านซ้าย"
     }
    ]
   },
   {
    "x": 45,
    "y": 62,
    "label": "ฝาครอบข้างที่วางเท้า (ซ้าย-ขวา)",
    "items": [
     {
      "code": "64431-K3M-T00ZG",
      "side": "ขวา",
      "name": "ฝาครอบข้างที่วางเท้าด้านขวา"
     },
     {
      "code": "64432-K3M-T00ZG",
      "side": "ซ้าย",
      "name": "ฝาครอบข้างที่วางเท้าด้านซ้าย"
     }
    ]
   },
   {
    "x": 50,
    "y": 70,
    "label": "ที่วางเท้า / ฝาครอบตัวล่าง",
    "items": [
     {
      "code": "64310-K3M-T00ZC",
      "side": null,
      "name": "ที่วางเท้า"
     },
     {
      "code": "64315-K3M-T00",
      "side": null,
      "name": "ฝาครอบตัวล่าง"
     },
     {
      "code": "64320-K3M-T00",
      "side": null,
      "name": "ฝาครอบกลางตัวล่าง"
     }
    ]
   },
   {
    "x": 60,
    "y": 48,
    "label": "ฝาครอบตัวกลาง / ใต้เบาะ",
    "items": [
     {
      "code": "80151-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวกลาง"
     },
     {
      "code": "81140-K3M-T00ZG",
      "side": null,
      "name": "ฝาครอบตัวในด้านบน"
     },
     {
      "code": "81145-K3M-T00ZG",
      "side": null,
      "name": "ฝาปิดสวิตช์เปิดเบาะนั่งในกรณีฉุกเฉิน"
     },
     {
      "code": "81250-K3M-T00",
      "side": null,
      "name": "กล่องเก็บของอเนกประสงค์"
     },
     {
      "code": "81142-K3M-T00",
      "side": null,
      "name": "กล่องตัวใน"
     },
     {
      "code": "81143-K3M-T00",
      "side": null,
      "name": "หูยึดกล่องตัวใน"
     },
     {
      "code": "81160-K3M-T00ZG",
      "side": null,
      "name": "ชุดฝาปิดกล่องเก็บของตัวใน"
     },
     {
      "code": "81150-K3M-T00ZA",
      "side": null,
      "name": "ฝาครอบตัวในด้านล่าง"
     },
     {
      "code": "80160-K3M-T00ZA",
      "side": null,
      "name": "ฝาปิดช่องเติมน้ำมันเชื้อเพลิง"
     }
    ]
   },
   {
    "x": 14,
    "y": 58,
    "label": "ท่อไอเสีย",
    "items": [
     {
      "code": "18300-K3M-T00",
      "side": null,
      "name": "ท่อไอเสีย"
     },
     {
      "code": "18318-K3M-T00",
      "side": null,
      "name": "แผ่นกันความร้อนท่อไอเสีย"
     }
    ]
   }
  ]
 }
};

export default BIKE_HOTSPOTS;
