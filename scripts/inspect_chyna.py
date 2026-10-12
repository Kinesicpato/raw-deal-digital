#!/usr/bin/env python3
"""Extract absolute positions of each VML image in Chyna.docx to map pages."""
import re

xml = open(r'Decks\Chyna_extracted\word\document.xml', encoding='utf-8').read()
rels_xml = open(r'Decks\Chyna_extracted\word\_rels\document.xml.rels', encoding='utf-8').read()

rid_to_target = {}
for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels_xml):
    if 'media' in m.group(2):
        rid_to_target[m.group(1)] = m.group(2)

# Each v:shape contains style with margin-left/top and v:imagedata r:id
for m in re.finditer(
    r'<v:shape[^>]*style="([^"]+)"[^>]*>\s*<v:imagedata r:id="(rId\d+)"',
    xml,
):
    style, rid = m.group(1), m.group(2)
    target = rid_to_target.get(rid, rid)
    ml = re.search(r'margin-left:([\d.]+)pt', style)
    mt = re.search(r'margin-top:([\d.]+)pt', style)
    w = re.search(r'width:([\d.]+)pt', style)
    h = re.search(r'height:([\d.]+)pt', style)
    left = float(ml.group(1)) if ml else 0
    top = float(mt.group(1)) if mt else 0
    width = float(w.group(1)) if w else 0
    height = float(h.group(1)) if h else 0
    # US Letter at 72pt/inch: page height 20160 twips = 14in = 1008pt
    page_h = 1008.0
    page = int(top // page_h) + 1
    within = top - (page - 1) * page_h
    print(f'{target:22s} page={page} left={left:7.1f}pt top={top:7.1f}pt (within-page {within:6.1f}pt) {width:.0f}x{height:.0f}pt')
