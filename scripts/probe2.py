import re, zipfile

def docx_text(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    texts = re.findall(r'<w:t[^>]*>(.*?)</w:t>', xml, re.S)
    return ''.join(texts).replace('&amp;', '&').replace('\u00a0', ' ')

text = docx_text(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_sets\NoWayOut_19.0.docx')
# locate Shoot Punch
i = text.find('Shoot Punch')
print(repr(text[i-200:i+800]))