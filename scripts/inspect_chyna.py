import re
xml = open(r'Decks\Chyna_extracted\word\document.xml', encoding='utf-8').read()
rels = open(r'Decks\Chyna_extracted\word\_rels\document.xml.rels', encoding='utf-8').read()
rid = {}
for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels):
    if 'media' in m.group(2):
        rid[m.group(1)] = m.group(2).split('/')[-1]
for m in re.finditer(r'<v:shape[^>]*style="([^"]+)"[^>]*>\s*<v:imagedata r:id="(rId\d+)"', xml):
    style, r = m.group(1), m.group(2)
    fn = rid.get(r, r)
    ml = re.search(r'margin-left:([\d.]+)pt', style)
    mt = re.search(r'margin-top:([\d.]+)pt', style)
    w = re.search(r'width:([\d.]+)pt', style)
    h = re.search(r'height:([\d.]+)pt', style)
    left = float(ml.group(1)) if ml else 0
    top = float(mt.group(1)) if mt else 0
    width = float(w.group(1)) if w else 0
    height = float(h.group(1)) if h else 0
    page = int(top // 1008.0) + 1
    print(f'{fn:16s} page={page} L={left:6.1f} T={top:7.1f} {width:.0f}x{height:.0f}pt')
