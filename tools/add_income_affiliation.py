import json, io, os, shutil

PATH = r"C:\Users\manat\OneDrive\New folder\Finance API.json"

d = json.load(io.open(PATH, encoding="utf-8"))
node = next(n for n in d["nodes"] if n.get("name") == "Code Income Record")
code = node["parameters"]["jsCode"]

repls = [
    # 1) list SELECT — add r.affiliation
    ("r.reference_no, r.description, r.note,",
     "r.reference_no, r.affiliation, r.description, r.note,"),
    # 2) header var
    ("  const refNo = esc(b.reference_no);\n  const desc = esc(b.description);",
     "  const refNo = esc(b.reference_no);\n  const affil = esc(b.affiliation);\n  const desc = esc(b.description);"),
    # 3a) INSERT columns
    ("     reference_no, description, note, discount_pct, vat_pct, wht_rate, wht_amount,",
     "     reference_no, affiliation, description, note, discount_pct, vat_pct, wht_rate, wht_amount,"),
    # 3b) INSERT SELECT values
    ("    ${refNo}, ${desc}, ${note}, ${discPct}, ${vatPct}, ${whtRate}, ${whtAmt},",
     "    ${refNo}, ${affil}, ${desc}, ${note}, ${discPct}, ${vatPct}, ${whtRate}, ${whtAmt},"),
    # 4) ON CONFLICT DO UPDATE SET
    ("    customer_address = EXCLUDED.customer_address,\n    description = EXCLUDED.description,",
     "    customer_address = EXCLUDED.customer_address,\n    affiliation = EXCLUDED.affiliation,\n    description = EXCLUDED.description,"),
    # 5) UPDATE branch SET
    ("    reference_no = ${refNo}, description = ${desc}, note = ${note},",
     "    reference_no = ${refNo}, affiliation = ${affil}, description = ${desc}, note = ${note},"),
]

for old, new in repls:
    c = code.count(old)
    if c != 1:
        raise SystemExit("EXPECTED 1 occurrence, found %d for:\n%s" % (c, old[:80]))
    code = code.replace(old, new)

node["parameters"]["jsCode"] = code

shutil.copyfile(PATH, PATH + ".bak-affiliation")
with io.open(PATH, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)

print("OK — income_record affiliation patched, backup .bak-affiliation written")
