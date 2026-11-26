import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "sync"))
import ilias_sync as s

hier = os.path.join(os.path.dirname(__file__), "fixtures")
p = s.pruefungen_aus(open(os.path.join(hier, "portal2_belegungen.html"), encoding="utf-8").read())
print(json.dumps(p, ensure_ascii=False, indent=1))
assert len(p) == 3
assert p[0] == {"nummer": "132-BWL-BA-0-P", "titel": "CC 303 Quantitative Methoden", "datum": "2026-12-18", "von": "16:00", "bis": "16:45", "raum": None, "form": "Klausur (nicht anonymisiert)", "status": "zugelassen", "versuch": "1"}, p[0]
assert p[1]["raum"] == "A 001 Großer Hörsaal (B 6, 23-25 Bauteil A)" and p[1]["datum"] == "2026-12-17" and p[1]["von"] == "11:00"
assert p[2]["form"] == "Bring-Your-Own-Device-Prüfung (BYOD)" and p[2]["raum"].startswith("SO 108")
l = s.leistungen_aus(open(os.path.join(hier, "portal2_leistungen.html"), encoding="utf-8").read())
print(json.dumps(l, ensure_ascii=False, indent=1))
fm = [x for x in l if x["nummer"] == "131-BWL-BA-0-P"][0]
assert fm["note"] == 2.0 and fm["ects"] == 3.0 and fm["status"] == "BE" and fm["freigabe"].startswith("10.11.2026"), fm
k = [x for x in l if x["nummer"].endswith("-K")][0]
assert k["note"] == 2.0 and k["ects"] == 3.0, k
print("OK")
