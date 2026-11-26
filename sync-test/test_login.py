"""
Uni-Organizer Tom - Etappe 0: Login-Test fuer ILIAS und Portal2 (Uni Mannheim).

Fragt Uni-ID und Passwort im Fenster ab (Passwort ist unsichtbar beim Tippen).
Nichts wird gespeichert oder verschickt, ausser an ILIAS / Portal2 selbst.

Start:  python test_login.py
"""
import getpass
import re
import os
import sys

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Pakete fehlen. Bitte zuerst ausfuehren:  python -m pip install requests beautifulsoup4")
    sys.exit(1)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) uni-organizer-test"}
ILIAS = "https://ilias.uni-mannheim.de"
PORTAL = "https://portal2.uni-mannheim.de"


DEBUG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "debug")


def dump(name, r):
    """Speichert eine Seite lokal in sync-test/debug (ohne Passwort) zur Fehlersuche."""
    os.makedirs(DEBUG_DIR, exist_ok=True)
    with open(os.path.join(DEBUG_DIR, name + ".html"), "w", encoding="utf-8") as f:
        f.write(f"<!-- URL: {r.url} | Status: {r.status_code} -->\n" + r.text)


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
    """Shibboleth: Seiten mit SAMLResponse oder Zustimmung automatisch weiterschicken."""
    for _ in range(max_steps):
        page = soup(r)
        form = page.find("form")
        if not form:
            return r
        names = {i.get("name") for i in form.find_all("input")}
        action = requests.compat.urljoin(r.url, form.get("action") or r.url)
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


def shib_login(s, start_url, user, pw, host):
    """Login ueber den Uni-Mannheim-IdP (Shibboleth). Gibt (ok, response) zurueck."""
    r = s.get(start_url)
    if "idp.uni-mannheim.de" not in r.url:
        print("Unerwartet: keine Weiterleitung zum Uni-Login, sondern", r.url)
        return False, r
    form = soup(r).find("form")
    data = form_data(form)
    data.update({"j_username": user, "j_password": pw, "_eventId_proceed": ""})
    r = s.post(requests.compat.urljoin(r.url, form.get("action")), data=data)
    if "j_password" in r.text and "idp.uni-mannheim.de" in r.url:
        err = soup(r).select_one(".form-error, .alert, .error")
        print("Login FEHLGESCHLAGEN:", err.get_text(" ", strip=True) if err else "(Uni-ID/Passwort falsch?)")
        return False, r
    r = submit_auto_forms(s, r)
    if host not in r.url:
        print("Login unklar, gelandet auf:", r.url)
        return False, r
    return True, r


def test_ilias(user, pw):
    print("\n=== ILIAS ===")
    s = requests.Session()
    s.headers.update(UA)
    ok, r = shib_login(s, f"{ILIAS}/login.php", user, pw, "ilias.uni-mannheim.de")
    if not ok:
        return False
    print("Login OK  ->", r.url.split("?")[0])
    dump("ilias_nach_login", r)

    kurse = {}
    for url in (f"{ILIAS}/ilias.php?baseClass=ilmembershipoverviewgui",
                f"{ILIAS}/ilias.php?baseClass=ilDashboardGUI&cmd=jumpToMemberships",
                f"{ILIAS}/ilias.php?baseClass=ilDashboardGUI&cmd=show"):
        try:
            rr = s.get(url)
        except requests.RequestException:
            continue
        dump("ilias_" + re.sub(r"\W+", "_", url.split("baseClass=")[1])[:40], rr)
        p = soup(rr)
        for a in p.find_all("a", href=True):
            h, t = a["href"], a.get_text(" ", strip=True)
            m = re.search(r"(?:target=crs_|_crs_|crs_|goto.php/crs/)(\d+)", h)
            if m and t and len(t) > 3:
                kurse.setdefault(m.group(1), t)
        if kurse:
            break
    if kurse:
        print(f"{len(kurse)} Kurse gefunden, z. B.:")
        for t in list(kurse.values())[:10]:
            print("   -", t)
    else:
        print("Keine Kurse auf dem Dashboard erkannt (Login ging aber).")
    return True


def test_portal2(user, pw):
    print("\n=== Portal2 ===")
    s = requests.Session()
    s.headers.update(UA)
    start = f"{PORTAL}/portal2/pages/cs/sys/portal/hisinoneStartPage.faces"
    s.get(start)  # Session-Cookie holen
    ok, r = shib_login(s, f"{PORTAL}/portal2/api/identityprovider/redirect/4/login", user, pw,
                       "portal2.uni-mannheim.de")
    dump("portal2_nach_login", r)
    r = s.get(start)
    dump("portal2_startseite_danach", r)
    page = soup(r)
    if not ok:
        return False
    if page.find("input", {"name": "fdsa"}) is not None and "Abmelden" not in r.text:
        print("Login unklar: Startseite zeigt noch das Login-Formular.")
        return False
    print("Login OK  ->", r.url.split("?")[0])

    menue = []
    for a in page.find_all("a", href=True):
        t = a.get_text(" ", strip=True)
        if re.search(r"Stundenplan|Pr(ü|ue)fung|Leistung|Veranstaltung|Termine|Studium", t) and t not in menue:
            menue.append(t)
    if menue:
        print("Gefundene Menuepunkte (zum Weiterbauen):")
        for t in menue[:12]:
            print("   -", t)
    return True


def main():
    print("Login-Test Uni Mannheim (ILIAS + Portal2)")
    print("Deine Daten bleiben auf diesem PC und werden nicht gespeichert.\n")
    user = input("Uni-ID (z. B. tmuster): ").strip()
    pw = getpass.getpass("Passwort (wird beim Tippen nicht angezeigt): ")
    ok1 = ok2 = False
    try:
        ok1 = test_ilias(user, pw)
    except Exception as e:
        print("ILIAS-Fehler:", type(e).__name__, e)
    try:
        ok2 = test_portal2(user, pw)
    except Exception as e:
        print("Portal2-Fehler:", type(e).__name__, e)
    print("\n=== ERGEBNIS ===")
    print("ILIAS:  ", "OK" if ok1 else "NICHT OK")
    print("Portal2:", "OK" if ok2 else "NICHT OK")
    input("\nEnter druecken zum Schliessen ...")


if __name__ == "__main__":
    main()
