import re, json, os, glob, zipfile, unicodedata

OUT_DIR = os.path.join(os.path.dirname(__file__), 'generated', 'r2f_sets')


def docx_lines(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    runs = re.findall(r'<w:r[ >].*?</w:r>', xml, re.S)
    lines = []
    for r in runs:
        texts = re.findall(r'<w:t[^>]*>(.*?)</w:t>', r, re.S)
        txt = ''.join(texts).replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
        txt = txt.replace('\u00a0', ' ')
        if txt.strip():
            lines.append(txt.strip())
    return lines


# A line that begins a new card listing. Covers:
#  08/172 | 002/160 V1.1 Punch | #01/24 (FOIL) | 01/PR (NON-FOIL) | 1/TR (F) WWF ...
CARD_START = re.compile(r'^#?\d{1,3}/(\d{1,4}|\w+)\b')
FD_LINE = re.compile(r'^F:\s*([-]?\d+)\s+D:\s*([-]?\d+)(?:\s+SV:\s*(\d+))?$')
SV_LINE = re.compile(r'^SV:\s*(\d+)$')


def parse_set(f):
    lines = docx_lines(f)
    cards = []
    cur = None
    is_superstar = False
    for ln in lines:
        if CARD_START.match(ln):
            # start a new card; title may be at end of this line (format B) or at next non-paren line
            tail = re.sub(r'^#?\d{1,3}/\d{1,4}\s*', '', ln)
            tail = re.sub(r'\([^)]*\)\s*$', '', tail).strip()
            cur = {'num': ln, 'title': tail or '', 'type': '', 'body': [], 'fortitude': None, 'damage': None, 'stun': None}
            is_superstar = False
            cards.append(cur)
            continue
        mfd = FD_LINE.match(ln)
        if mfd:
            if cur:
                cur['fortitude'] = int(mfd.group(1))
                cur['damage'] = int(mfd.group(2))
                cur['stun'] = int(mfd.group(3)) if mfd.group(3) else cur['stun']
            continue
        msv = SV_LINE.match(ln)
        if msv:
            if cur:
                cur['stun'] = int(msv.group(1))
            continue
        if cur is None:
            continue
        # skip section headers and standalone rarity lines
        if not cur['title']:
            # if the line is a title-looking text (not "PROMO CARDS", "COMMON (2)" etc.)
            if re.match(r'^(COMMON|UNCOMMON|RARE|PREMIUM|STARTER|ULTRA|COMMO)', ln):
                continue
            if CARD_START.match(ln):
                continue
            cur['title'] = ln
            continue
        if 'Superstar Card' in ln:
            is_superstar = True
        if cur['type']:
            cur['body'].append(ln)
        else:
            cur['type'] = ln
    return cards


def norm(s):
    s = unicodedata.normalize('NFKD', s.replace('\ufffd', '')).encode('ascii', 'ignore').decode()
    s = s.lower().replace("'", '').replace('"', '').replace('!', '').replace('?', '')
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def main():
    all_cards = []
    for f in sorted(glob.glob(os.path.join(OUT_DIR, '*.docx'))):
        setname = os.path.basename(f)[:-5]
        cards = parse_set(f)
        for c in cards:
            c['set'] = setname
        all_cards.extend(cards)
        print(f'{setname}: {len(cards)} cards')
    out = os.path.join(os.path.dirname(__file__), 'generated', 'r2f_cards_raw.json')
    json.dump(all_cards, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    valid = [c for c in all_cards if c['fortitude'] is not None]
    print('Wrote', out, len(all_cards), 'cards;', len(valid), 'with F/D')


if __name__ == '__main__':
    main()