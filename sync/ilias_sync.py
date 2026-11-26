"""
Uni-Organizer Tom - ILIAS-Sync (Etappe 2)

Holt neue/geänderte Dateien und Lernmodule aus deinen ILIAS-Kursen und lädt sie in die App.

Einmal einrichten (fragt Uni-ID, Passwort und Sync-Schlüssel ab, speichert sie im
Windows-Anmeldeinformationsspeicher, NICHT in einer Datei):
    python ilias_sync.py --einrichten
Sync von Hand starten:
    python ilias_sync.py
Automatisch alle 3 Stunden (Windows-Aufgabenplanung):
    python ilias_sync.py --aufgabe
"""
import argparse
import datetime as dt
import getpass
import hashlib
import io
import os
import re
import subprocess
import sys
import time
from urllib.parse import unquote, urljoin

try:
    import keyring
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Pakete fehlen. Bitte zuerst ausführen:\n  python -m pip install requests beautifulsoup4 keyring pypdf")
    sys.exit(1)

APP = "https://uni-organizer-tom-ufyt.vercel.app"
ILIAS = "https://ilias.uni-mannheim.de"
KR = "uni-organizer"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) uni-organizer-sync"}
MAX_MB = 45  # Supabase Free erlaubt max. 50 MB pro Datei
HIER = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HIER, "sync.log")


def log(*teile):
    zeile = f"{dt.datetime.now():%Y-%m-%d %H:%M:%S} " + " ".join(str(t) for t in teile)
    try:
        print(zeile)
    except Exception:
        pass
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(zeile + "\n")


# ---------------------------------------------------------------- Login (wie im Test)

def soup(r):
    return BeautifulSoup(r.text, "html.parser")


def form_data(form):
    data = {}
    for inp in form.find_all("input"):
        name = inp.get("name")
        if not name or inp.get("type") in ("checkbox", "submit", "button"):
            continue
        data[name] = inp.get("value", "")
    return data


def submit_auto_forms(s, r, max_steps=5):
    for _ in range(max_steps):
        form = soup(r).find("form")
        if not form:
            return r
        names = {i.get("name") for i in form.find_all("input")}
        action = urljoin(r.url, form.get("action") or r.url)
        if "SAMLResponse" in names:
            r = s.post(action, data=form_data(form))
            continue
        if "_shib_idp_consentOptions" in names or "_eventId_AttributeReleaseAccept" in names:
            data = form_data(form)
            data["_shib_idp_consentOptions"] = "_shib_idp_rememberConsent"
            data["_eventId_proceed"] = ""
            r = s.post(action, data=data)
            continue
        return r
    return r


def ilias_login(user, pw):
    s = requests.Session()
    s.headers.update(UA)
    r = s.get(f"{ILIAS}/login.php")
    if "idp.uni-mannheim.de" not in r.url:
        raise RuntimeError("Keine Weiterleitung zum Uni-Login: " + r.url)
    form = soup(r).find("form")
    data = form_data(form)
    data.update({"j_username": user, "j_password": pw, "_eventId_proceed": ""})
    r = s.post(urljoin(r.url, form.get("action")), data=data)
    if "j_password" in r.text and "idp.uni-mannheim.de" in r.url:
        raise RuntimeError("Login fehlgeschlagen (Uni-ID/Passwort falsch?)")
    r = submit_auto_forms(s, r)
    if "ilias.uni-mannheim.de" not in r.url:
        raise RuntimeError("Login unklar, gelandet auf " + r.url)
    return s


# ---------------------------------------------------------------- App-Schnittstelle

class App:
    def __init__(self, token):
        self.h = {"Authorization": f"Bearer {token}", **UA}

    def post(self, **body):
        r = requests.post(f"{APP}/api/sync", json=body, headers=self.h, timeout=60)
        if r.status_code >= 400:
            raise RuntimeError(f"App-Fehler {r.status_code}: {r.text[:300]}")
        return r.json()

    def hochladen(self, kurs_id, ilias_id, version, ordner, dateiname, daten, inhalt, content_type):
        up = self.post(aktion="upload", kurs_id=kurs_id, ilias_id=ilias_id, dateiname=dateiname)
        r = requests.put(up["url"], data=daten, headers={"content-type": content_type or "application/octet-stream", "x-upsert": "true"}, timeout=300)
        if r.status_code >= 400:
            raise RuntimeError(f"Upload-Fehler {r.status_code}: {r.text[:300]}")
        self.post(aktion="fertig", kurs_id=kurs_id, ilias_id=ilias_id, version=version, ordner=ordner,
                  dateiname=dateiname, groesse=len(daten), path=up["path"], inhalt=inhalt)


# ---------------------------------------------------------------- Text aus Dateien

def text_aus(dateiname, daten):
    endung = dateiname.lower().rsplit(".", 1)[-1] if "." in dateiname else ""
    try:
        if endung == "pdf":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(daten))
            return "\n".join((p.extract_text() or "") for p in reader.pages)
        if endung in ("txt", "md", "csv"):
            return daten.decode("utf-8", errors="replace")
        if endung == "pptx":
            try:
                from pptx import Presentation
            except ImportError:
                return None
            prs = Presentation(io.BytesIO(daten))
            teile = []
            for i, folie in enumerate(prs.slides, 1):
                teile.append(f"--- Folie {i} ---")
                for sh in folie.shapes:
                    if getattr(sh, "has_text_frame", False) and sh.has_text_frame:
                        teile.append(sh.text_frame.text)
            return "\n".join(teile)
    except Exception as e:
        log("  Text konnte nicht gelesen werden:", dateiname, type(e).__name__)
    return None


def dateiname_aus(resp, fallback):
    cd = resp.headers.get("content-disposition", "")
    m = re.search(r"filename\*\s*=\s*[^']*''([^;]+)", cd)
    if m:
        return unquote(m.group(1)).strip('"')
    m = re.search(r'filename\s*=\s*"?([^";]+)"?', cd)
    if m:
        try:
            return m.group(1).encode("latin-1").decode("utf-8")
        except Exception:
            return m.group(1)
    return fallback


# ---------------------------------------------------------------- ILIAS durchsuchen

CONTAINER = re.compile(r"goto\.php/(fold|grp|sess|crs)/(\d+)")
SENDFILE = re.compile(r"cmd=sendfile.*?ref_id=(\d+)(?:.*?[?&]v=(\d+))?")
LM = re.compile(r"goto\.php/lm/(\d+)")


def eintraege(s, url):
    """Liest eine Kurs-/Ordnerseite und liefert (art, id, titel, url, extra)."""
    r = s.get(url)
    p = soup(r)
    out = []
    for item in p.select(".ilContainerListItemOuter"):
        a = item.select_one("a.il_ContainerItemTitle") or item.select_one("h3 a")
        if not a or not a.get("href"):
            continue
        href = urljoin(r.url, a["href"])
        titel = a.get_text(" ", strip=True)
        props = [x.get_text(" ", strip=True) for x in item.select(".il_ItemProperty")]
        m = SENDFILE.search(href)
        if m:
            out.append(("datei", m.group(1), titel, href, {"v": m.group(2) or "1", "props": props}))
            continue
        m = CONTAINER.search(href)
        if m:
            out.append((m.group(1), m.group(2), titel, href, {}))
            continue
        m = LM.search(href)
        if m:
            out.append(("lm", m.group(1), titel, href, {}))
    return out


def lernmodul_text(s, ref):
    r = s.get(f"{ILIAS}/goto.php/lm/{ref}")
    p = soup(r)
    ids = []
    for a in p.find_all("a", href=True):
        m = re.search(rf"cmd=layout&(?:amp;)?ref_id={ref}&(?:amp;)?obj_id=(\d+)", a["href"])
        if m and m.group(1) != "0" and m.group(1) not in ids:
            ids.append(m.group(1))
    teile, gesehen = [], set()
    for oid in ids:
        rr = s.get(f"{ILIAS}/ilias.php?baseClass=illmpresentationgui&cmd=layout&ref_id={ref}&obj_id={oid}")
        c = soup(rr).select_one("#ilLMPageContent")
        if not c:
            continue
        txt = c.get_text("\n", strip=True)
        h = hashlib.sha1(txt.encode()).hexdigest()
        if h in gesehen or not txt:
            continue
        gesehen.add(h)
        teile.append(txt)
        time.sleep(0.2)
    return "\n\n=====\n\n".join(teile)


def sync_kurs(s, app, kurs, bekannt, besucht, stat):
    start = f"{ILIAS}/goto.php/{kurs['ilias_ref']}"
    stapel = [(start, "")]
    while stapel:
        url, ordner = stapel.pop()
        try:
            liste = eintraege(s, url)
        except requests.RequestException as e:
            log("  Seite nicht ladbar:", url, e)
            continue
        for art, rid, titel, href, extra in liste:
            if art in ("fold", "grp", "sess", "crs"):
                if art == "crs" or rid in besucht:
                    continue
                besucht.add(rid)
                stapel.append((href, f"{ordner}/{titel}".strip("/")))
            elif art == "datei":
                iid = f"file_{rid}"
                groesse = next((x for x in extra["props"] if re.search(r"\d\s*(KB|MB|GB|Bytes)", x)), "")
                version = f"v{extra['v']}|{groesse}"
                if bekannt.get(iid) == version:
                    continue
                if "GB" in groesse or (groesse.endswith("MB") and float(groesse.split()[0].replace(",", ".")) > MAX_MB):
                    log("  zu groß, übersprungen:", titel, groesse)
                    continue
                try:
                    resp = s.get(href, timeout=300)
                    resp.raise_for_status()
                    name = dateiname_aus(resp, titel)
                    daten = resp.content
                    app.hochladen(kurs["id"], iid, version, ordner, name, daten, text_aus(name, daten),
                                  resp.headers.get("content-type", "").split(";")[0])
                    stat["dateien"] += 1
                    log("  +", ordner + "/" + name if ordner else name)
                except Exception as e:
                    stat["fehler"] += 1
                    log("  Fehler bei", titel, ":", e)
            elif art == "lm":
                iid = f"lm_{rid}"
                try:
                    txt = lernmodul_text(s, rid)
                    if not txt:
                        continue
                    version = "t" + hashlib.sha1(txt.encode()).hexdigest()[:16]
                    if bekannt.get(iid) == version:
                        continue
                    name = re.sub(r'[\\/:*?"<>|]+', "_", titel) + " (Lernmodul).txt"
                    app.hochladen(kurs["id"], iid, version, ordner, name, txt.encode("utf-8"), txt, "text/plain; charset=utf-8")
                    stat["dateien"] += 1
                    log("  + Lernmodul", titel)
                except Exception as e:
                    stat["fehler"] += 1
                    log("  Fehler bei Lernmodul", titel, ":", e)


def kursliste(s):
    r = s.get(f"{ILIAS}/ilias.php?baseClass=ilmembershipoverviewgui")
    kurse = {}
    for a in soup(r).find_all("a", href=True):
        m = re.search(r"goto\.php/(crs|grp)/(\d+)", a["href"])
        t = a.get_text(" ", strip=True)
        if m and t and len(t) > 3:
            kurse.setdefault(f"{m.group(1)}/{m.group(2)}", t)
    return [{"ref": k, "name": v} for k, v in kurse.items()]


def sync():
    user = keyring.get_password(KR, "uni_id")
    pw = keyring.get_password(KR, "uni_passwort") if user else None
    token = keyring.get_password(KR, "sync_token")
    if not (user and pw and token):
        print("Noch nicht eingerichtet. Bitte zuerst:  python ilias_sync.py --einrichten")
        return 1
    log("=== Sync startet ===")
    s = ilias_login(user, pw)
    app = App(token)
    kurse = kursliste(s)
    log(f"{len(kurse)} Kurse/Gruppen in ILIAS")
    antwort = app.post(aktion="start", kurse=kurse)
    bekannt = antwort["dateien"]
    besucht = set()
    stat = {"dateien": 0, "fehler": 0}
    fertig = []
    # Kurse zuerst, dann Gruppen (Gruppen in Kursen werden dort schon mitgenommen)
    for kurs in sorted(antwort["kurse"], key=lambda k: (not k["ilias_ref"].startswith("crs"), k["name"])):
        rid = kurs["ilias_ref"].split("/")[1]
        if kurs["ausgeblendet"] or rid in besucht:
            continue
        besucht.add(rid)
        log("Kurs:", kurs["name"])
        sync_kurs(s, app, kurs, bekannt, besucht, stat)
        fertig.append(kurs["id"])
    app.post(aktion="ende", kurs_ids=fertig)
    log(f"=== Fertig: {stat['dateien']} neu/geändert, {stat['fehler']} Fehler ===")
    return 0


def einrichten():
    print("Einrichtung: Die Angaben landen im Windows-Anmeldeinformationsspeicher, nicht in einer Datei.\n")
    user = input("Uni-ID (z. B. tkuster): ").strip()
    pw = getpass.getpass("Uni-Passwort (unsichtbar beim Tippen): ")
    token = input("Sync-Schlüssel aus der App (Einstellungen -> PC-Sync): ").strip()
    keyring.set_password(KR, "uni_id", user)
    keyring.set_password(KR, "uni_passwort", pw)
    keyring.set_password(KR, "sync_token", token)
    print("\nGespeichert. Teste jetzt den Login ...")
    try:
        ilias_login(user, pw)
        App(token).post(aktion="start", kurse=[])
        print("ILIAS-Login und App-Verbindung OK. Starte jetzt den ersten Sync mit:  python ilias_sync.py")
    except Exception as e:
        print("Problem:", e)


def aufgabe():
    pyw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    exe = pyw if os.path.exists(pyw) else sys.executable
    cmd = ["schtasks", "/Create", "/F", "/SC", "HOURLY", "/MO", "3", "/TN", "Uni-Organizer Sync",
           "/TR", f'"{exe}" "{os.path.abspath(__file__)}"']
    r = subprocess.run(cmd, capture_output=True, text=True)
    print(r.stdout or r.stderr)
    if r.returncode == 0:
        print("Fertig: Der Sync läuft ab jetzt alle 3 Stunden, solange du angemeldet bist und der PC an ist.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--einrichten", action="store_true")
    ap.add_argument("--aufgabe", action="store_true")
    a = ap.parse_args()
    if a.einrichten:
        einrichten()
    elif a.aufgabe:
        aufgabe()
    else:
        try:
            sys.exit(sync())
        except Exception as e:
            log("ABBRUCH:", e)
            sys.exit(1)
