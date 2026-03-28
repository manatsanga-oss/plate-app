#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate SQL import file for moto_bookings table from จองรถ.xlsx
"""

import pandas as pd
import numpy as np
from datetime import datetime, date
import sys

EXCEL_PATH = r'C:\Users\manat\plate-app\จองรถ_copy.xlsx'
OUTPUT_SQL = r'C:\Users\manat\plate-app\import_จองรถ.sql'

def fix_thai_year(dt):
    """Convert Thai Buddhist Era date to Christian Era (subtract 543 years)."""
    if pd.isna(dt):
        return None
    if isinstance(dt, (datetime, pd.Timestamp)):
        year = dt.year
        # If year looks like Thai BE (>= 2500), subtract 543
        if year >= 2500:
            year -= 543
        try:
            return date(year, dt.month, dt.day)
        except ValueError:
            return None
    return None

def fmt_date(dt):
    """Format date as SQL string or NULL."""
    d = fix_thai_year(dt)
    if d is None:
        return 'NULL'
    return f"'{d.strftime('%Y-%m-%d')}'"

def escape_str(val):
    """Escape a string value for SQL, returning NULL if empty."""
    if val is None:
        return 'NULL'
    if pd.isna(val):   # handles NaN, NaT, None
        return 'NULL'
    s = str(val).strip()
    if s == '' or s.lower() in ('nan', 'nat', 'none'):
        return 'NULL'
    # Escape single quotes
    s = s.replace("'", "''")
    return f"'{s}'"

def fmt_numeric(val):
    """Format numeric value or NULL."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return 'NULL'
    try:
        f = float(val)
        return str(f)
    except (ValueError, TypeError):
        return 'NULL'

def is_empty(val):
    """Check if a value is effectively empty/null."""
    if val is None:
        return True
    if isinstance(val, float) and np.isnan(val):
        return True
    if isinstance(val, str) and val.strip() == '':
        return True
    return False

# ── Read Excel ──────────────────────────────────────────────────────────────
print("Reading Excel file...")
xl = pd.ExcelFile(EXCEL_PATH)
sheet_names = xl.sheet_names
print(f"Sheet names: {sheet_names}")

# Sheet 1: main booking data (ชีต1)
df_main = xl.parse(sheet_names[0])
print(f"\nSheet1 shape: {df_main.shape}")
print(f"Sheet1 columns: {list(df_main.columns)}")
print(df_main.head(2).to_string())

# Sheet 2: invoice/sale data (ตารางราคาขรถจอง)
df_invoice = xl.parse(sheet_names[1])
print(f"\nSheet2 shape: {df_invoice.shape}")
print(f"Sheet2 columns: {list(df_invoice.columns)}")
print(df_invoice.head(2).to_string())

# Sheet 3: cancellation data (ยกเลิกการจอง)
df_cancel = xl.parse(sheet_names[2])
print(f"\nSheet3 shape: {df_cancel.shape}")
print(f"Sheet3 columns: {list(df_cancel.columns)}")
print(df_cancel.head(3).to_string())

# Sheet 4: color/model change data (แก้ไขแบบสี)
df_change = xl.parse(sheet_names[3])
print(f"\nSheet4 shape: {df_change.shape}")
print(f"Sheet4 columns: {list(df_change.columns)}")
print(df_change.head(3).to_string())

# ── Map column names ──────────────────────────────────────────────────────────
# Sheet1 columns by position (index-based to avoid encoding issues)
main_cols = list(df_main.columns)
# Expected: วันที่จอง, ร้าน, ยี่ห้อ, รุ่น, แบบ, สี, ชื่อลูกค้า, เบอร์โทรศัพท์,
#           ประเภทการซื้อ, เลขที่ใบมัดจำ, สถานะ, วันที่นัดหมาย, หมายเหตุ, เลขเครื่องรถที่คาดว่าจะได้รับ
COL_BOOKING_DATE   = main_cols[0]   # วันที่จอง
COL_BRANCH         = main_cols[1]   # ร้าน
COL_BRAND          = main_cols[2]   # ยี่ห้อ
COL_MARKETING_NAME = main_cols[3]   # รุ่น
COL_MODEL_CODE     = main_cols[4]   # แบบ
COL_COLOR_NAME     = main_cols[5]   # สี
COL_CUSTOMER_NAME  = main_cols[6]   # ชื่อลูกค้า
COL_PHONE          = main_cols[7]   # เบอร์โทรศัพท์
COL_PURCHASE_TYPE  = main_cols[8]   # ประเภทการซื้อ
COL_DEPOSIT_NO     = main_cols[9]   # เลขที่ใบมัดจำ
COL_STATUS         = main_cols[10]  # สถานะ
COL_APPT_DATE      = main_cols[11] if len(main_cols) > 11 else None   # วันที่นัดหมาย
COL_NOTES          = main_cols[12] if len(main_cols) > 12 else None   # หมายเหตุ
COL_ENGINE_NO      = main_cols[13] if len(main_cols) > 13 else None   # เลขเครื่องรถ

print(f"\nMain column mapping:")
print(f"  booking_date   <- col[0]: {COL_BOOKING_DATE}")
print(f"  branch         <- col[1]: {COL_BRANCH}")
print(f"  brand          <- col[2]: {COL_BRAND}")
print(f"  marketing_name <- col[3]: {COL_MARKETING_NAME}")
print(f"  model_code     <- col[4]: {COL_MODEL_CODE}")
print(f"  color_name     <- col[5]: {COL_COLOR_NAME}")
print(f"  customer_name  <- col[6]: {COL_CUSTOMER_NAME}")
print(f"  customer_phone <- col[7]: {COL_PHONE}")
print(f"  purchase_type  <- col[8]: {COL_PURCHASE_TYPE}")
print(f"  deposit_no     <- col[9]: {COL_DEPOSIT_NO}")
print(f"  status         <- col[10]: {COL_STATUS}")
print(f"  appointment_date <- col[11]: {COL_APPT_DATE}")
print(f"  notes          <- col[12]: {COL_NOTES}")
print(f"  engine_no      <- col[13]: {COL_ENGINE_NO}")

# Sheet2: invoice - cols: วันที่, ชื่อลูกค้า, เลขที่ใบขาย
inv_cols = list(df_invoice.columns)
INV_DATE     = inv_cols[0]  # วันที่ (sold_date)
INV_CUST     = inv_cols[1]  # ชื่อลูกค้า
INV_NO       = inv_cols[2]  # เลขที่ใบขาย

# Sheet3: cancel - cols: วันที่ยกเลิก, เลขที่มัดจำ(typo), เลขที่บัญชีธนาคาร, ธนาคาร, จำนวนเงิน
can_cols = list(df_cancel.columns)
CAN_DATE     = can_cols[0]  # วันที่ยกเลิก
CAN_DEPOSIT  = can_cols[1]  # เลขที่มัดจำ (match to deposit_no)
CAN_ACCT     = can_cols[2]  # เลขที่บัญชีธนาคาร
CAN_BANK     = can_cols[3]  # ธนาคาร
CAN_AMOUNT   = can_cols[4]  # จำนวนเงิน

# Sheet4: change - cols: วันที่, ชื่อลูกค้า, แบบ, สี
chg_cols = list(df_change.columns)
CHG_DATE     = chg_cols[0]  # วันที่
CHG_CUST     = chg_cols[1]  # ชื่อลูกค้า
CHG_MODEL    = chg_cols[2]  # แบบ (new_model_code)
CHG_COLOR    = chg_cols[3]  # สี (new_color_name)

print(f"\nCancel cols: {can_cols}")
print(f"Invoice cols: {inv_cols}")
print(f"Change cols: {chg_cols}")

# ── Build lookup dictionaries ─────────────────────────────────────────────────

# Invoice lookup by customer name -> (sold_date, invoice_no)
# Note: could have multiple rows per customer; take the most recent/first match
invoice_lookup = {}
for _, row in df_invoice.iterrows():
    cname = str(row[INV_CUST]).strip() if not is_empty(row[INV_CUST]) else None
    if cname:
        # Only add if not already present (keep first occurrence)
        if cname not in invoice_lookup:
            invoice_lookup[cname] = {
                'sold_date': row[INV_DATE],
                'invoice_no': row[INV_NO]
            }

print(f"\nInvoice lookup entries: {len(invoice_lookup)}")

# Cancel lookup by deposit_no -> cancel info
cancel_lookup = {}
for _, row in df_cancel.iterrows():
    dep_no = str(row[CAN_DEPOSIT]).strip() if not is_empty(row[CAN_DEPOSIT]) else None
    if dep_no:
        cancel_lookup[dep_no] = {
            'cancelled_date': row[CAN_DATE],
            'refund_account_no': row[CAN_ACCT],
            'refund_bank': row[CAN_BANK],
            'refund_amount': row[CAN_AMOUNT]
        }

print(f"Cancel lookup entries: {len(cancel_lookup)}")

# Change lookup by customer name -> (new_model_code, new_color_name)
change_lookup = {}
for _, row in df_change.iterrows():
    cname = str(row[CHG_CUST]).strip() if not is_empty(row[CHG_CUST]) else None
    if cname:
        change_lookup[cname] = {
            'new_model_code': row[CHG_MODEL],
            'new_color_name': row[CHG_COLOR]
        }

print(f"Change lookup entries: {len(change_lookup)}")

# ── Generate SQL ──────────────────────────────────────────────────────────────
lines = []

lines.append("-- Auto-generated SQL import for moto_bookings")
lines.append(f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
lines.append(f"-- Source: {EXCEL_PATH}")
lines.append("")
lines.append("SET client_encoding = 'UTF8';")
lines.append("")
lines.append("-- Add new columns if they don't exist")
lines.append("ALTER TABLE moto_bookings ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(50);")
lines.append("ALTER TABLE moto_bookings ADD COLUMN IF NOT EXISTS notes TEXT;")
lines.append("ALTER TABLE moto_bookings ADD COLUMN IF NOT EXISTS appointment_date DATE;")
lines.append("ALTER TABLE moto_bookings ADD COLUMN IF NOT EXISTS engine_no VARCHAR(100);")
lines.append("")
lines.append("-- Insert records from จองรถ.xlsx")
lines.append("")

insert_count = 0
sample_inserts = []

for idx, row in df_main.iterrows():
    # Skip empty rows
    if is_empty(row[COL_CUSTOMER_NAME]) and is_empty(row[COL_DEPOSIT_NO]):
        continue

    # Basic fields from sheet1
    booking_date   = fmt_date(row[COL_BOOKING_DATE])
    branch         = escape_str(row[COL_BRANCH])
    brand          = escape_str(row[COL_BRAND])
    marketing_name = escape_str(row[COL_MARKETING_NAME])
    model_code     = escape_str(row[COL_MODEL_CODE])
    color_name     = escape_str(row[COL_COLOR_NAME])
    customer_name  = escape_str(row[COL_CUSTOMER_NAME])
    customer_phone = escape_str(row[COL_PHONE])
    purchase_type  = escape_str(row[COL_PURCHASE_TYPE])
    deposit_no     = escape_str(row[COL_DEPOSIT_NO])
    # Empty status = จอง, รอ... = จอง, otherwise keep
    raw_status = str(row[COL_STATUS]).strip() if not is_empty(row[COL_STATUS]) else ''
    if raw_status == '' or raw_status.startswith('รอ'):
        status_val = "'จอง'"
    elif raw_status in ('ขาย', 'ยกเลิก'):
        status_val = f"'{raw_status}'"
    else:
        status_val = "'จอง'"

    appointment_date = fmt_date(row[COL_APPT_DATE]) if COL_APPT_DATE else 'NULL'
    notes            = escape_str(row[COL_NOTES]) if COL_NOTES else 'NULL'
    engine_no        = escape_str(row[COL_ENGINE_NO]) if COL_ENGINE_NO else 'NULL'

    # Enrichment from sheet2 (invoice) by customer name
    cname_raw = str(row[COL_CUSTOMER_NAME]).strip() if not is_empty(row[COL_CUSTOMER_NAME]) else ''
    inv_data = invoice_lookup.get(cname_raw, {})
    sold_date  = fmt_date(inv_data.get('sold_date')) if inv_data else 'NULL'
    invoice_no = escape_str(inv_data.get('invoice_no')) if inv_data else 'NULL'

    # Enrichment from sheet3 (cancel) by deposit_no
    dep_raw = str(row[COL_DEPOSIT_NO]).strip() if not is_empty(row[COL_DEPOSIT_NO]) else ''
    can_data = cancel_lookup.get(dep_raw, {})
    if can_data:
        cancelled_date    = fmt_date(can_data.get('cancelled_date'))
        refund_account_no = escape_str(can_data.get('refund_account_no'))
        refund_bank       = escape_str(can_data.get('refund_bank'))
        refund_amount     = fmt_numeric(can_data.get('refund_amount'))
        # deposit_action: 'คืนเงินมัดจำ' if refund_account_no is not null
        if can_data.get('refund_account_no') and not is_empty(can_data.get('refund_account_no')):
            deposit_action = "'คืนเงินมัดจำ'"
        else:
            deposit_action = "'ยึดเงินมัดจำ'"
    else:
        cancelled_date    = 'NULL'
        refund_account_no = 'NULL'
        refund_bank       = 'NULL'
        refund_amount     = 'NULL'
        deposit_action    = 'NULL'

    # Enrichment from sheet4 (model/color change) by customer name
    chg_data = change_lookup.get(cname_raw, {})
    if chg_data:
        new_model_code = escape_str(chg_data.get('new_model_code'))
        new_color_name = escape_str(chg_data.get('new_color_name'))
    else:
        new_model_code = 'NULL'
        new_color_name = 'NULL'

    sql = (
        f"INSERT INTO moto_bookings ("
        f"booking_date, branch, brand, marketing_name, model_code, color_name, "
        f"customer_name, customer_phone, purchase_type, deposit_no, status, "
        f"sold_date, cancelled_date, cancel_reason, "
        f"new_model_code, new_color_name, "
        f"deposit_action, refund_account_no, refund_bank, refund_amount, "
        f"invoice_no, notes, appointment_date, engine_no"
        f") VALUES ("
        f"{booking_date}, {branch}, {brand}, {marketing_name}, {model_code}, {color_name}, "
        f"{customer_name}, {customer_phone}, {purchase_type}, {deposit_no}, {status_val}, "
        f"{sold_date}, {cancelled_date}, NULL, "
        f"{new_model_code}, {new_color_name}, "
        f"{deposit_action}, {refund_account_no}, {refund_bank}, {refund_amount}, "
        f"{invoice_no}, {notes}, {appointment_date}, {engine_no}"
        f");"
    )

    lines.append(sql)
    insert_count += 1
    if insert_count <= 5:
        sample_inserts.append(sql)

lines.append("")
lines.append(f"-- Total: {insert_count} records inserted")

# ── Write SQL file ────────────────────────────────────────────────────────────
sql_content = '\n'.join(lines)
with open(OUTPUT_SQL, 'w', encoding='utf-8') as f:
    f.write(sql_content)

print(f"\n{'='*60}")
print(f"SQL file written: {OUTPUT_SQL}")
print(f"Total INSERT statements: {insert_count}")
print(f"\nFirst 5 INSERT statements:")
for i, s in enumerate(sample_inserts, 1):
    print(f"\n[{i}] {s}")
