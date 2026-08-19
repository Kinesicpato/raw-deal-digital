import json
from parse_r2f import docx_text, split_blocks, extract_card

text = docx_text(r'C:\Users\patri\Downloads\raw-deal\scripts\generated\r2f_sets\NoWayOut_19.0.docx')
blocks = split_blocks(text)
for b in blocks:
    if 'Shoot Punch' in b:
        print('BLOCK starts:', repr(b[:160]))
        ec = extract_card(b)
        print('EXTRACT:', ec)