"""
Uni-Organizer Tom - ILIAS-Sync (Etappe 2)

Holt neue/geänderte Dateien und Lernmodule aus deinen ILIAS-Kursen und lädt sie in die App.
Meldet außerdem Tests, Übungen, Weblinks und externe Lerntools (Liste "Lerntools & Links").
Liest aus Portal2 deine Prüfungsanmeldungen (Termin, Raum, Form) und Noten.

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
import logging
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
logging.getLogger("pypdf").setLevel(logging.ERROR)  # keine "wrong pointing object"-Meldungen
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
    return re.sub(r"a?amp;", "&", _dateiname_aus(resp, fallback))


def _dateiname_aus(resp, fallback):
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
# Weitere ILIAS-Objekte, die Lerntools sein können (Tests, Übungen, Weblinks, externe Tools ...)
OBJEKT = re.compile(r"goto\.php(?:/|\?target=)(tst|exc|webr|lti|xxco|cmix|sahs|htlm|copa|glo|xlvo|svy|poll|mcst|xvid)[/_](\d+)")
WEBLINK = re.compile(r"baseClass=ilLinkResourceHandlerGUI.*?ref_id=(\d+)", re.I)


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
            continue
        desc = item.select_one(".il_Description")
        beschreibung = desc.get_text(" ", strip=True) if desc else ""
        m = WEBLINK.search(href)
        if m:
            out.append(("objekt", m.group(1), titel, href, {"typ": "webr", "beschreibung": beschreibung}))
            continue
        m = OBJEKT.search(href)
        if m:
            out.append(("objekt", m.group(2), titel, href, {"typ": m.group(1), "beschreibung": beschreibung}))
            continue
        if href.startswith("http") and "ilias.uni-mannheim.de" not in href:
            out.append(("objekt", href, titel, href, {"typ": "extern", "ziel": href, "beschreibung": beschreibung}))
    return out


def weblink_ziel(s, href):
    """Wohin führt ein ILIAS-Weblink? (ILIAS leitet per HTTP-Redirect weiter)"""
    try:
        r = s.get(href, allow_redirects=False, timeout=30)
        ziel = r.headers.get("location", "")
        if ziel and "ilias.uni-mannheim.de" not in urljoin(href, ziel):
            return urljoin(href, ziel)
        if r.status_code == 200 and "calldirectlink" not in href:
            # Weblink-Sammlung: erster externer Link auf der Seite
            for a in soup(r).select("#ilContentContainer a[href^=http]"):
                if "ilias.uni-mannheim.de" not in a["href"]:
                    return a["href"]
    except requests.RequestException:
        pass
    return None


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
    objekte = []
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
            elif art == "objekt":
                o = {"typ": extra["typ"], "id": rid, "titel": titel, "url": href, "ordner": ordner,
                     "beschreibung": extra.get("beschreibung", "")}
                if extra["typ"] == "webr":
                    o["ziel"] = weblink_ziel(s, href)
                elif extra.get("ziel"):
                    o["ziel"] = extra["ziel"]
                objekte.append(o)
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
    if objekte:
        try:
            app.post(aktion="objekte", kurs_id=kurs["id"], objekte=objekte)
            log(f"  {len(objekte)} Tests/Übungen/Links gemeldet")
        except Exception as e:
            log("  Lerntools konnten nicht gemeldet werden:", e)


def kursliste(s):
    r = s.get(f"{ILIAS}/ilias.php?baseClass=ilmembershipoverviewgui")
    kurse = {}
    for a in soup(r).find_all("a", href=True):
        m = re.search(r"goto\.php/(crs|grp)/(\d+)", a["href"])
        t = a.get_text(" ", strip=True)
        if m and t and len(t) > 3:
            kurse.setdefault(f"{m.group(1)}/{m.group(2)}", t)
    return [{"ref": k, "name": v} for k, v in kurse.items()]


# ---------------------------------------------------------------- Portal2 (Prüfungsanmeldungen, Noten)

PORTAL2 = "https://portal2.uni-mannheim.de/portal2"
P2_BELEGUNGEN = PORTAL2 + "/pages/cm/exa/enrollment/info/start.xhtml?_flowId=searchOwnEnrollmentInfo-flow&navigationPosition=hisinoneMeinStudium%2ChisinoneOwnEnrollmentList&recordRequest=true"
P2_LEISTUNGEN = PORTAL2 + "/pages/sul/examAssessment/personExamsReadonly.xhtml?_flowId=examsOverviewForPerson-flow&navigationPosition=hisinoneMeinStudium%2CexamAssessmentForStudent&recordRequest=true"


def portal2_login(s, user, pw):
    """Meldet die (schon bei ILIAS angemeldete) Sitzung auch bei Portal2 an, gleicher Uni-Login."""
    r = s.get(PORTAL2 + "/api/identityprovider/redirect/4/login")
    if "idp.uni-mannheim.de" in r.url and "j_password" in r.text:
        form = soup(r).find("form")
        data = form_data(form)
        data.update({"j_username": user, "j_password": pw, "_eventId_proceed": ""})
        r = s.post(urljoin(r.url, form.get("action")), data=data)
    r = submit_auto_forms(s, r)
    if "portal2.uni-mannheim.de" not in r.url:
        raise RuntimeError("Portal2-Login unklar, gelandet auf " + r.url)
    return s


def _text(html):
    b = BeautifulSoup(html, "html.parser")
    for t in b(["script", "style"]):
        t.decompose()
    return re.sub(r"\s+", " ", b.get_text(" "))


def pruefungen_aus(html):
    """Liest die Prüfungsanmeldungen aus der Seite "Belegungen"."""
    text = _text(html)
    out = []
    for block in re.split(r"Prüfung\s*:\s*", text)[1:]:
        kopf = re.match(r"(\S+-P)\s+(.+?)\s+Termine und Räume", block)
        if not kopf:
            continue
        p = {"nummer": kopf.group(1), "titel": kopf.group(2).strip()}
        t = re.search(r"\w+,\s*(\d{2})\.(\d{2})\.(\d{2,4})\s+von\s+(\d{1,2}:\d{2})\s+bis\s+(\d{1,2}:\d{2})(?:\s*in Raum\s+(.+?))?\s*(?=Prüfungsform|Prüfer|Ihr aktueller|$)", block)
        if t:
            jahr = t.group(3) if len(t.group(3)) == 4 else "20" + t.group(3)
            p.update(datum=f"{jahr}-{t.group(2)}-{t.group(1)}", von=t.group(4), bis=t.group(5), raum=(t.group(6) or "").strip() or None)
        for feld, muster in (("form", r"Prüfungsform:\s*(.+?)\s*(?=Prüfungsformat|Prüfer|Ihr aktueller|$)"),
                             ("status", r"Ihr aktueller Status:\s*(\S+)"),
                             ("versuch", r"Aktueller Versuch:\s*(\d+)")):
            m = re.search(muster, block)
            if m:
                p[feld] = m.group(1).strip()
        out.append(p)
    return out


def leistungen_aus(html):
    """Liest Noten/ECTS aus "Meine Leistungen" (aufgeklappt)."""
    b = BeautifulSoup(html, "html.parser")
    out = []
    for tr in b.find_all("tr"):
        if tr.find("tr"):
            continue
        zellen = [re.sub(r"\s+", " ", td.get_text(" ")).strip() for td in tr.find_all("td")]
        if not zellen or not re.fullmatch(r"\d+(\.\d+)+", zellen[0]):
            continue
        rest = zellen[1:]
        while rest and not rest[0]:
            rest.pop(0)
        if len(rest) < 7 or not re.search(r"-(P|K)$", rest[1]):
            continue
        zahl = lambda x: float(x.replace(",", ".")) if re.fullmatch(r"\d+[.,]?\d*", x or "") else None
        freigabe = next((z for z in reversed(rest) if re.match(r"\d{2}\.\d{2}\.\d{4}", z)), None)
        out.append({"titel": rest[0], "nummer": rest[1], "versuch": rest[2], "note": zahl(rest[4]), "ects": zahl(rest[5]),
                    "status": rest[7] if len(rest) > 7 else None, "freigabe": freigabe})
    return out


def portal2_sync(s, user, pw, app):
    portal2_login(s, user, pw)
    r = s.get(P2_BELEGUNGEN)
    pruefungen = pruefungen_aus(r.text)
    # Leistungen: Seite laden und "Alle aufklappen" als normales Formular abschicken
    r = s.get(P2_LEISTUNGEN)
    leistungen = []
    btn = soup(r).find(id=re.compile(r"expandAll"))
    form = btn.find_parent("form") if btn else None
    if form:
        data = form_data(form)
        data[btn.get("name")] = btn.get("value", "")
        r = s.post(urljoin(r.url, form.get("action")), data=data)
    leistungen = leistungen_aus(r.text)
    if not pruefungen and not leistungen:
        log("Portal2: nichts gefunden (Seite geändert?)")
        return
    app.post(aktion="portal2", pruefungen=pruefungen, leistungen=leistungen)
    log(f"Portal2: {len(pruefungen)} Prüfungsanmeldungen, {len(leistungen)} Leistungen")


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
    # Links in Datei-Texten suchen (Lerntools wie CoTutor stehen oft nur in den Folien)
    try:
        for _ in range(30):
            r = app.post(aktion="links_scan")
            if not r.get("rest"):
                break
    except Exception as e:
        log("Link-Suche übersprungen:", e)
    try:
        portal2_sync(s, user, pw, app)
    except Exception as e:
        log("Portal2 übersprungen:", e)
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
