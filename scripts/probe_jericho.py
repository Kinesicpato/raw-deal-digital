import json, sys
sys.stdout.reconfigure(encoding="utf-8")

d = json.load(open(r"scripts\generated\r2f_cards_raw.json", encoding="utf-8"))
want = ["Walls of Jericho", "Roll the Footage, Monkeys!", "My Obscenely Expensive Jeri-tron 5000",
        "Don't Try This at Home", "Superior Acrobatics", "Happy You're Here, Happier You're Gone"]
for c in d:
    if c["title"] in want:
        print("=" * 70)
        print(c["set"], c["num"], "|", c["title"], "| type:", c["type"])
        print("F=", c["fortitude"], "D=", c["damage"], "S=", c["stun"])
        print("BODY:", " ".join(c["body"]))