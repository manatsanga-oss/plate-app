# -*- coding: utf-8 -*-
"""
แก้บั๊ก: เมนู Upload "รายการสินค้าของแถม" ใส่ข้อมูลสลับระหว่างชื่อลูกค้ากับที่อยู่

สาเหตุ: โหนด "Build SQL PG" ใน Part_Giveaway_Upload.json แมปคอลัมน์ "ตามตำแหน่ง (index)"
ด้วย layout ที่เดาผิด (10=customer_code, 13=name, 18=address) แต่รายงานจริง
"รายงานการขายอะไหล่แสดงชื่อที่อยู่" มี layout:
   10=ชื่อลูกค้า  11=บัตรประชาชน  12=โทรศัพท์  13=ที่อยู่
   14=ตำบล 15=อำเภอ 16=จังหวัด 17=รหัสไปรษณีย์ 18=ประเภทลูกค้า 19=บริษัทไฟแนนซ์
ผลคือ ชื่อ -> customer_code, ที่อยู่ -> customer_name (สลับกัน)

วิธีแก้: แมปคอลัมน์ "ตามชื่อหัวคอลัมน์ (header)" แทน index (โหนด Extract PG อ่าน xlsx
โดยใช้แถวแรกเป็น header อยู่แล้ว) + เพิ่มฟิลด์ลูกค้าใน ON CONFLICT DO UPDATE
เพื่อให้ re-upload แก้ข้อมูลเก่าที่สลับอยู่ให้ถูกต้อง
"""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Part_Giveaway_Upload.json")
wf = json.loads(src.read_text(encoding='utf-8'))

NEW_JS = r"""// Part Giveaway upload — กรองเฉพาะรายการที่ ประเภทการขาย = 'ของแถม'
// แมปคอลัมน์ตาม "ชื่อหัวคอลัมน์" (header row ของ XLSX) แทนการอ้างตำแหน่ง index
// เพื่อกันคอลัมน์ขยับ/สลับ (รายงาน: รายงานการขายอะไหล่แสดงชื่อที่อยู่)
const raw = $input.all().map(i => i.json);
const uploadedBy = ($input.first().json && $input.first().json.uploaded_by) || '';
if (!raw.length) return [{ json: { query: "SELECT 'no data' AS message", count: 0 } }];

function esc(v){if(v===null||v===undefined)return'NULL';const s=String(v).trim();if(!s||s==='-'||s==='nan')return'NULL';return"'"+s.replace(/'/g,"''")+"'";}
function num(v){if(v===null||v===undefined)return'NULL';const s=String(v).replace(/[,\s]/g,'');if(!s||s==='-'||s==='nan')return'NULL';const n=Number(s);return isFinite(n)?String(n):'NULL';}
function makeDateSql(y,m,d){if(!y||!m||!d)return 'NULL'; const yy=Number(y), mm=Number(m), dd=Number(d); if(!yy||!mm||!dd) return 'NULL'; return `'${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}'::date`;}

// ดึงค่าตามชื่อหัวคอลัมน์ (normalize ด้วย trim กัน whitespace)
function makeGetter(row){
  const map = {};
  for (const k of Object.keys(row)) map[String(k).trim()] = row[k];
  return (name) => { const v = map[name]; return (v===null||v===undefined) ? '' : v; };
}

const items = [];
for (const r of raw) {
  const g = makeGetter(r);
  // filter เฉพาะ ของแถม
  const saleCategory = String(g('ประเภทการขาย')||'').trim();
  if (!saleCategory.includes('แถม')) continue;
  const saleDoc = String(g('เลขที่ใบขาย')||'').trim();
  const partCode = String(g('รหัสอะไหล่')||'').trim();
  if (!saleDoc || !partCode) continue;
  items.push({
    sale_doc_no: saleDoc,
    sale_day: g('วันที่ขาย'), sale_month: g('เดือนที่ขาย'), sale_year: g('ปีที่ขาย'),
    branch_code: g('BRANCH_CODE'), branch_name: g('BRANCH_NAME'),
    sale_type: g('ประเภทใบขาย'), sale_status: g('สถานะใบขาย'),
    customer_code: '',                       // รายงานนี้ไม่มีคอลัมน์รหัสลูกค้า
    customer_id_card: g('บัตรประชาชน'),
    customer_prefix: '',                     // คำนำหน้ารวมอยู่ในชื่อลูกค้าแล้ว
    customer_name: g('ชื่อลูกค้า'),
    customer_subdistrict: g('ตำบล'), customer_district: g('อำเภอ'),
    customer_province: g('จังหวัด'), customer_postcode: g('รหัสไปรษณีย์'),
    customer_address: g('ที่อยู่'),
    brand_label: g('ยี่ห้อ'),
    part_code: partCode, part_code2: g('รหัสอะไหล่2'), part_name: g('ชื่ออะไหล่'),
    part_group: g('กลุ่มอะไหล่'), part_type: g('ประเภท'),
    vat_rate: g('อัตราภาษี'), qty: g('QTY'),
    unit_cost: g('ต้นทุนต่อหน่วย'), unit_cost_vat: g('ภาษีของต้นทุนต่อหน่วย'),
    sale_unit_price: g('ราคาขาย'), discount: g('ส่วนลดรวม'), sale_net_price: g('ราคาขายรวมหลังหักส่วนลด'),
    sale_category: saleCategory,
    yamaha_price: g('ราคาขาย_YAMAHA'),
    claim_doc_no: g('เลขที่ใบเบิก'), claim_day: g('วันที่ใบเบิก'), claim_month: g('เดือนใบเบิก'), claim_year: g('ปีใบเบิก'), claim_status: g('สถานะใบเบิก'),
    tax_invoice_no: g('เลขที่ใบกำกับภาษี'), tax_inv_day: g('วันที่ใบกำกับภาษี'), tax_inv_month: g('เดือนใบกำกับภาษี'), tax_inv_year: g('ปีใบกำกับภาษี'), tax_invoice_status: g('สถานะใบกำกับภาษี'),
    leasing_no: g('LEASING_NO'), salesperson: g('พนักงานขาย'), outstanding_amount: g('จำนวนเงินคงค้าง'),
  });
}
if (!items.length) return [{ json: { query: "SELECT 'no giveaway items found' AS message", count: 0 } }];

// dedupe ภายใน batch ตาม (sale_doc_no, part_code) เก็บรายการล่าสุด
const dedupMap = new Map();
for (const it of items) dedupMap.set(`${it.sale_doc_no}|${it.part_code}`, it);
const deduped = Array.from(dedupMap.values());

const values = deduped.map(it => `(${esc(it.sale_doc_no)}, ${num(it.sale_day)}, ${num(it.sale_month)}, ${num(it.sale_year)}, ${makeDateSql(it.sale_year, it.sale_month, it.sale_day)}, ${esc(it.branch_code)}, ${esc(it.branch_name)}, ${esc(it.sale_type)}, ${esc(it.sale_status)}, ${esc(it.customer_code)}, ${esc(it.customer_id_card)}, ${esc(it.customer_prefix)}, ${esc(it.customer_name)}, ${esc(it.customer_subdistrict)}, ${esc(it.customer_district)}, ${esc(it.customer_province)}, ${esc(it.customer_postcode)}, ${esc(it.customer_address)}, ${esc(it.brand_label)}, ${esc(it.part_code)}, ${esc(it.part_code2)}, ${esc(it.part_name)}, ${esc(it.part_group)}, ${esc(it.part_type)}, ${num(it.vat_rate)}, ${num(it.qty)}, ${num(it.unit_cost)}, ${num(it.unit_cost_vat)}, ${num(it.sale_unit_price)}, ${num(it.discount)}, ${num(it.sale_net_price)}, ${esc(it.sale_category)}, ${num(it.yamaha_price)}, ${esc(it.claim_doc_no)}, ${makeDateSql(it.claim_year, it.claim_month, it.claim_day)}, ${esc(it.claim_status)}, ${esc(it.tax_invoice_no)}, ${makeDateSql(it.tax_inv_year, it.tax_inv_month, it.tax_inv_day)}, ${esc(it.tax_invoice_status)}, ${esc(it.leasing_no)}, ${esc(it.salesperson)}, ${num(it.outstanding_amount)}, 'PART_GIVEAWAY_XLSX', ${esc(uploadedBy)})`).join(',\n');

const query = `INSERT INTO part_giveaway_items (sale_doc_no, sale_day, sale_month, sale_year, sale_date, branch_code, branch_name, sale_type, sale_status, customer_code, customer_id_card, customer_prefix, customer_name, customer_subdistrict, customer_district, customer_province, customer_postcode, customer_address, brand_label, part_code, part_code2, part_name, part_group, part_type, vat_rate, qty, unit_cost, unit_cost_vat, sale_unit_price, discount, sale_net_price, sale_category, yamaha_price, claim_doc_no, claim_date, claim_status, tax_invoice_no, tax_invoice_date, tax_invoice_status, leasing_no, salesperson, outstanding_amount, source_file, uploaded_by) VALUES ${values}\nON CONFLICT (sale_doc_no, part_code) DO UPDATE SET\n  sale_date = EXCLUDED.sale_date,\n  customer_code = EXCLUDED.customer_code,\n  customer_id_card = EXCLUDED.customer_id_card,\n  customer_prefix = EXCLUDED.customer_prefix,\n  customer_name = EXCLUDED.customer_name,\n  customer_subdistrict = EXCLUDED.customer_subdistrict,\n  customer_district = EXCLUDED.customer_district,\n  customer_province = EXCLUDED.customer_province,\n  customer_postcode = EXCLUDED.customer_postcode,\n  customer_address = EXCLUDED.customer_address,\n  part_name = EXCLUDED.part_name,\n  qty = EXCLUDED.qty,\n  unit_cost = EXCLUDED.unit_cost,\n  sale_unit_price = EXCLUDED.sale_unit_price,\n  sale_net_price = EXCLUDED.sale_net_price,\n  sale_category = EXCLUDED.sale_category,\n  tax_invoice_no = EXCLUDED.tax_invoice_no,\n  tax_invoice_date = EXCLUDED.tax_invoice_date,\n  uploaded_by = EXCLUDED.uploaded_by,\n  updated_at = NOW();`;
return [{ json: { query, count: deduped.length, raw_count: items.length } }];"""

found = False
for n in wf['nodes']:
    if n['name'] == 'Build SQL PG':
        n['parameters']['jsCode'] = NEW_JS
        found = True
        break

if not found:
    print("ERROR: ไม่พบโหนด 'Build SQL PG'")
    sys.exit(1)

src.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print("OK: อัปเดต jsCode ของโหนด 'Build SQL PG' (แมปตามชื่อหัวคอลัมน์ + ขยาย ON CONFLICT)")
print(f"OK: บันทึก {src}")
