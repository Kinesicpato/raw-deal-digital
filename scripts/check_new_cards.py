import re, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
with open(os.path.join(ROOT, 'src', 'data', 'cards.ts'), 'r', encoding='utf-8') as f:
    content = f.read()

names = re.findall(r"name:\s*'([^']+)'", content)
ids = re.findall(r"id:\s*'([^']+)'", content)
print(f'Total cards in game: {len(names)}')

# Mid Match Virtual backlash cards
midmatch_virtual = [
    ('sustained-damage', 'Sustained Damage'),
    ('you-think-you-know-me', 'You Think You Know Me?'),
    ('mr-monday-night', 'Mr. Monday Night'),
    ('dude-nice-hang-time', 'Dude, Nice Hang Time!'),
    ('when-you-thought-you-had-all-the-answers', 'When You Thought You Had All the Answers...'),
    ('the-ref-takes-control', 'The Ref Takes Control'),
]

# Set 9-09 cards
set909 = [
    ('edge', 'Edge'),
    ('counter-assault', 'Counter Assault'),
    ('atomic-lariat', 'Atomic Lariat'),
    ('booby-trap', 'Booby Trap'),
    ('the-raw-deal-revolution', 'The RAW DEAL Revolution'),
    ('takedown', 'Takedown'),
    ('youre-just-a-puppet', "You're Just a Puppet"),
    ('thats-how-i-roll', "That's How I Roll"),
    ('sharmell-sizzling-spouse', 'Sharmell: Sizzling Spouse'),
    ('a-revolution-of-the-mind', 'A Revolution of the Mind'),
    ('counter-throw', 'Counter Throw'),
    ('downward-spiral', 'Downward Spiral'),
    ('once-is-enough', 'Once is Enough'),
    ('edges-running-spear', "Edge's Running Spear"),
    ('edges-spear', "Edge's Spear"),
    ('edge-o-matic', 'Edge-O-Matic'),
    ('scream-if-you-want-it', 'Scream If You Want It'),
    ('running-spinebuster', 'Running Spinebuster'),
    ('precision-kick', 'Precision Kick'),
    ('precision-haymaker', 'Precision Haymaker'),
    ('spine-buster', 'Spine Buster'),
    ('shoot-lock-up', 'Shoot Lock-up'),
    ('listen-you-reekazoid', 'Listen, You Reekazoid!'),
    ('pump-kick', 'Pump Kick'),
    ('death-valley-driver', 'Death Valley Driver'),
    ('the-rated-r-superstar', 'The Rated R Superstar'),
    ('edge-auction', 'Edge-auction'),
    ('its-great-to-be-back-here-in', "It's Great To Be Back Here In..."),
    ('manager-interferes', 'Manager Interferes'),
    ('edge-kick', 'Edge Kick'),
    ('sodas-rule', 'Sodas Rule!'),
    ('all-talk-no-action', 'All Talk, No Action!'),
    ('beating-the-odds', 'Beating the Odds'),
    ('enough-with-the-trash-talk', 'Enough With the Trash Talk'),
]

print('\n=== MID MATCH VIRTUAL (backlash) ===')
for cid, name in midmatch_virtual:
    status = 'EXISTS' if cid in ids or name in names else 'NEW'
    print(f'  [{status}] {name} (id: {cid})')

print('\n=== SET 9-09 ===')
for cid, name in set909:
    status = 'EXISTS' if cid in ids or name in names else 'NEW'
    print(f'  [{status}] {name} (id: {cid})')
