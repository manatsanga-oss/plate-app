import base64
import zipfile
import re

path = r'C:\Users\manat\OneDrive\ระบบเงินเดือน\ค่าคอมมิชั้นV.2.xlsx'

with zipfile.ZipFile(path, 'r') as z:
    with z.open('customXml/item1.xml') as f:
        raw = f.read()

# decode utf-16
text = raw.decode('utf-16-le', errors='ignore') if raw[:2] == b'\xff\xfe' else raw.decode('utf-8', errors='ignore')
# หา base64 content
m = re.search(r'>([A-Za-z0-9+/=\s]+)<', text, re.DOTALL)
if not m:
    # fallback: take all chars between >...<
    start = text.find('>')
    end = text.rfind('<')
    b64 = text[start+1:end]
else:
    b64 = m.group(1)
b64 = re.sub(r'\s+', '', b64)
print(f"Base64 length: {len(b64)}")

# decode base64
data = base64.b64decode(b64)
print(f"Decoded length: {len(data)}")

# DataMashup format: first 4 bytes = version, then ZIP archive
# Skip the 4-byte header and look for ZIP signature
zip_start = data.find(b'PK\x03\x04')
print(f"ZIP starts at offset: {zip_start}")

if zip_start >= 0:
    import io
    zip_data = data[zip_start:]
    # อาจมี trailing data หลัง zip
    with open(r'C:\Users\manat\plate-app\pq_inner.zip', 'wb') as f:
        f.write(zip_data)

    # try to open
    try:
        with zipfile.ZipFile(io.BytesIO(zip_data)) as zi:
            print("\n=== Files in DataMashup ZIP ===")
            for n in zi.namelist():
                print(f"  {n} ({zi.getinfo(n).file_size} bytes)")

            # Section1.m holds Power Query M code
            for n in zi.namelist():
                if n.endswith('.m') or 'Section' in n or 'Formula' in n:
                    print(f"\n=== Content of {n} ===")
                    with zi.open(n) as f:
                        content = f.read().decode('utf-8', errors='ignore')
                        print(content)
    except Exception as e:
        print(f"Error opening inner ZIP: {e}")
        # binary search for M code
        m_start = zip_data.find(b'section ')
        if m_start >= 0:
            print(f"M code starts at offset {m_start}")
            print(zip_data[m_start:m_start+5000].decode('utf-8', errors='ignore'))
