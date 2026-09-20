# Nixgame

Ein TikTok-Live-Overlay, das die Rollen umdreht: **Die Zuschauer sind die Creator, der Streamer ist nur noch ein Artefakt.**

Der Bildschirm ist ein geteiltes Territorium — ein 16×8-Step-Sequencer, dessen Zellen die Zuschauer per Chat-Kommando beanspruchen. Ein Playhead wandert über das Grid und spielt, was die Community gebaut hat: Der Grid-Zustand wird live in [Strudel](https://strudel.cc)-Code übersetzt, sichtbar in ein REPL "getippt" und evaluiert. In der Mitte haust die **Entität**: das Kamerabild des Streamers, durch Shader entmenschlicht (Punktwolke, ASCII, Slit-Scan) — sichtbar als Silhouette, aber keine Person. Sie handelt nie, sie reagiert nur: Likes geben ihr Energie, Gifts lassen sie pulsieren, die Stimme des letzten Autors färbt sie.

## Architektur

```
TikTok LIVE ──(tiktok-live-connector)──▶ server ──(WebSocket)──▶ overlay (OBS Browser-Source)
                                          │                        ├─ Grid-Sequencer (Canvas 2D)
                                          │                        ├─ Strudel-REPL (<strudel-editor>)
                                          ├─ Mock-Generator        └─ Entität (WebGL2-Shader)
Webcam ──(ffmpeg/dshow, MJPEG)───────────▶┘                            ▲ JPEG-Frames (binär, WS)
```

- **`shared/`** — Typen, Kommando-DSL, User-Stimmen, Stil-Presets, Grid→Strudel-Codegen
- **`server/`** — Node: TikTok-Events (oder Mock), Grid-Zustand, WS-Broadcast, Persistenz, Kamera-Frames (ffmpeg → MJPEG)
- **`overlay/`** — Vite-App: transparente Overlay-Seite für OBS

**Sicherheit:** Zuschauertext erreicht nie das REPL. Chat wird gegen eine Whitelist-DSL geparst; Strudel-Code entsteht ausschließlich aus validierten Tokens des Grids und den Stil-Presets im Code.

## Quickstart (Entwicklung, ohne TikTok)

```sh
npm install
npm run dev:server    # Mock-Events + WS auf :8787
npm run dev:overlay   # Overlay auf http://localhost:5173
```

Seite öffnen, **„Entität wecken"** klicken (Autoplay-Policy: eine Geste für Audio + Kamera). Ohne Kamera erscheint ein prozeduraler Geist als Fallback. Der Mock-Generator simuliert Chat, Likes und Gifts.

## Live-Betrieb

```sh
TIKTOK_USERNAME=dein_handle npm run dev:server
```

Der Server verbindet sich über [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector) (inoffizielles Webcast-Protokoll — kann sich jederzeit ändern; bei Verbindungsfehlern reconnectet er mit Backoff).

### OBS-Einbindung

1. Browser-Source hinzufügen: `http://localhost:5173`. Für TikTok **720×1280** (Hochformat) — das Overlay erkennt die Ausrichtung per Media-Query und stapelt REPL, Hinweis, Ticker und Grid mit handytauglicher Schrift; 1920×1080 funktioniert weiterhin. Vorschau des Hochformats im Desktop-Browser: `http://localhost:5173/dev-portrait.html`.
2. **Kamera:** Die Browser-Source in OBS bekommt keinen zuverlässigen Kamerazugriff (auch nicht mit `--enable-media-stream`). Deshalb greift der **Server** die Webcam per [ffmpeg](https://ffmpeg.org) (DirectShow) ab und schickt JPEG-Frames über den WebSocket ans Overlay. `ffmpeg` muss im PATH liegen (z. B. `winget install Gyan.FFmpeg`). Ohne ffmpeg/Kamera versucht das Overlay getUserMedia, sonst erscheint der Fallback-Geist.
   - `CAMERA="<Gerätename>"` wählt ein Gerät explizit (Liste: `ffmpeg -list_devices true -f dshow -i dummy`); ohne Angabe wird die erste echte (nicht-virtuelle) Kamera genommen.
   - `CAMERA=off` deaktiviert die Server-Kamera; `CAMERA_FPS` (15) und `CAMERA_WIDTH` (640) tunen die Last.
   - Die Kamera darf gleichzeitig **nicht** als OBS-Videoquelle laufen (DirectShow-Exklusivzugriff).
3. „Control audio via OBS" aktivieren, damit der Strudel-Sound in den Stream gemischt wird.
4. Die Entität weckt sich in OBS automatisch (erkannt über `window.obsstudio`). In anderen Umgebungen ohne Klick-Geste hilft `?autostart=1` an der URL — vorausgesetzt, der Browser erlaubt Autoplay.

## Chat-Kommandos

| Kommando | Wirkung |
|---|---|
| `!drum bd 5` | Percussion in Spalte 5 (`bd sd hh oh` = feste Zeilen; `cp rim lt mt ht cr rd` → fx-Zeile) |
| `!note c3 5` | Note in Spalte 5, erste freie melodische Zeile (`c2`–`b5`, auch `#`/`b`) |
| `!cell 5 7 e4` | Direkte Zellen-Adressierung: Spalte, Zeile, Token |
| `!clear 5 7` | Eigene Zelle räumen |
| `!bpm 140` | Tempo 60–200 (15 s Cooldown) |

Regeln: Freie Zellen kann jeder beanspruchen, fremde Zellen sind tabu (Territorium!). Jeder Handle bekommt deterministisch eine persistente **Stimme** (GM-Timbre + Farbe) — Beiträge klingen und leuchten nach ihrem Autor, der Playhead kreditiert live („jetzt hörbar: @…").

**Hinweise:** Unter dem REPL rotiert alle 12 s eine Erklärzeile für Zuschauer (Kommandos, Regeln, Verfall). Solange das Grid leer ist, bleiben nur die beiden Einstiegs-Hints. Texte in `overlay/src/hud.ts` (`HINTS`).

**Verfall:** Zellen, die 4 Minuten unberührt bleiben, bröckeln weg (höchstens eine alle 20 s). Wer seine Zelle erneut setzt, frischt sie auf. So bleibt das Grid luftig und das Pattern in Bewegung.

## Klangkonzept

Der Codegen (`shared/src/codegen.ts`) erzeugt keinen Chiptune-Loop, sondern:

- **Drums** aus einer Drum-Machine-Bank (je Stil), tiefpass-gefiltert, mit leisen Hi-Hat-Akzenten, Fill alle 8 Takte und Kick-Aussetzer alle 16.
- **Harmonische Reise:** Alle 4 Takte wandert die Skala (je Stil, z. B. `C:lydian → G:major → D:mixolydian → …`), Zuschauer-Noten werden per `.scale()` darauf quantisiert — auch zufällige Eingaben klingen musikalisch, und derselbe Grid-Zustand klingt in jedem Durchlauf anders.
- **Stimmen** sind GM-Soundfonts und weiche Synths (Pads, E-Piano, Kalimba, Vibraphon, Sinus, …) mit Raum, tempo-synchronem Delay, langsam wanderndem Filter und gelegentlichen Oktavsprüngen.
- **Drone:** Grundton-Akkord als leiser Teppich, folgt der Skalenreise — die Entität summt, auch wenn das Grid leer ist.

## Gift-Eskalation

Bauen ist kostenlos. Gifts kaufen **Macht über das Territorium** — kumulativ, ein grosses Gift bekommt alles (Schwellen in `shared/src/constants.ts`):

| Diamanten | Wirkung |
|---|---|
| ≥ 1 (jedes Gift) | 🔒 Eigene Zellen 10 min gegen den Verfall versiegelt (heller Ring im Grid) |
| ≥ 100 | 🗡️ Pro 100 💎 ein **Diebstahl** (max. 5, 10 min gültig): das nächste Kommando auf eine fremde Zelle übernimmt sie |
| ≥ 1000 | ⚡ **Solo** 60 s: nur die eigenen Zellen spielen, fremde Melodien schweigen, fremde Drums laufen gedämpft; die Entität trägt die Farbe des Solisten, das Grid dimmt alle anderen |

Ein neues Solo löst das laufende ab. Likes geben der Entität weiterhin nur Energie.

## Streamer-Eingriffe (OBS „Interagieren")

Der Streamer ist Moderator: Territorium-Regel und BPM-Cooldown gelten für ihn nicht. Alles geht per Maus im OBS-Interact-Fenster (die Toolbar erscheint bei Mausbewegung und verschwindet nach 4 s):

| Eingabe | Wirkung |
|---|---|
| Linksklick auf leere Zelle | setzt den Zeilen-Sound bzw. die zuletzt benutzte Note |
| Linksklick auf belegte Zelle | nächster fx-Sound / nächster Halbton |
| Mausrad auf Zelle | fx-Sound bzw. Note hoch/runter |
| Rechtsklick | Zelle löschen (auch fremde) |
| Toolbar **Stil** | Preset wechseln (Tempo springt auf die Stil-Voreinstellung) |
| Toolbar **BPM −/+** | Tempo in 5er-Schritten |
| Toolbar **Territorium räumen** | zweimal klicken → Grid leer |
| Taste `1` / `2` / `3` | Entität: Punktwolke / ASCII / Slit-Scan (deaktiviert Auto-Zyklus) |
| Taste `a` | Auto-Zyklus an/aus (Moduswechsel alle 40 s) |

Die Kommandos laufen als Nachrichten Overlay → Server über denselben WebSocket; der Server lauscht deshalb nur auf `127.0.0.1` (`WS_HOST` überschreibt das).

## Stil-Presets

`shared/src/styles.ts` — ein Stil bündelt Drum-Bank, Stimmen-Set, Skalenreise, Drone und Effekt-Charakter. Zuschauer-Zellen bleiben beim Wechsel erhalten, klingen aber sofort anders. Klangrichtung durchweg **sanfte Elektronik**: Drums überall tiefpass-gefiltert, Hi-Hats und Snares zurückgenommen (`drums.hats`), Stimmen sind weiche Plucks, Pads, Sinus/Dreieck — keine klirrenden Leads.

| Stil | BPM | Drums | Charakter |
|---|---|---|---|
| **Dream** (Standard) | 92 | Oberheim DMX | Pads/Chor/Harfe mit langem Release, Lydisch/Dur, grosser Raum |
| **Minimal** | 124 | TR-909, gefiltert, Hats fast unhörbar | Sinus/Dreieck/E-Piano/Kalimba, Moll/Dorisch, Sinus-Sub-Drone, Dub-Delay |
| **IDM** | 98 | LinnDrum, weich; Hats stottern gelegentlich | E-Piano/Vibraphon/Music-Box/Flöte, Dorisch/Lydisch, langsames Stereo-Pendeln |
| **Dub** | 116 | TR-505, gefiltert | E-Piano/Clean-Gitarre/Pads, tiefer Filter, langes tempo-synchrones Echo mit hohem Feedback |

Die Drum-Bank muss alle Sounds `bd sd hh oh cp rim lt mt ht cr rd` enthalten — vollständig sind u. a. RolandTR909, LinnDrum, AkaiMPC60, EmuSP12, OberheimDMX, RolandTR505/626, RolandR8 (TR-808 fehlt `rd`).

## Gift-Eskalation

Bauen ist kostenlos. Gifts kaufen **Macht über das Territorium** — kumulativ, ein grosses Gift bekommt alles (Schwellen in `shared/src/constants.ts`):

| Diamanten | Wirkung |
|---|---|
| ≥ 1 (jedes Gift) | 🔒 Eigene Zellen 10 min gegen den Verfall versiegelt (heller Ring im Grid) |
| ≥ 100 | 🗡️ Pro 100 💎 ein **Diebstahl** (max. 5, 10 min gültig): das nächste Kommando auf eine fremde Zelle übernimmt sie |
| ≥ 1000 | ⚡ **Solo** 60 s: nur die eigenen Zellen spielen, fremde Melodien schweigen, fremde Drums laufen gedämpft; die Entität trägt die Farbe des Solisten, das Grid dimmt alle anderen |

Ein neues Solo löst das laufende ab. Likes geben der Entität weiterhin nur Energie.

## Streamer-Eingriffe (OBS „Interagieren")

Der Streamer ist Moderator: Territorium-Regel und BPM-Cooldown gelten für ihn nicht. Alles geht per Maus im OBS-Interact-Fenster (die Toolbar erscheint bei Mausbewegung und verschwindet nach 4 s):

| Eingabe | Wirkung |
|---|---|
| Linksklick auf leere Zelle | setzt den Zeilen-Sound bzw. die zuletzt benutzte Note |
| Linksklick auf belegte Zelle | nächster fx-Sound / nächster Halbton |
| Mausrad auf Zelle | fx-Sound bzw. Note hoch/runter |
| Rechtsklick | Zelle löschen (auch fremde) |
| Toolbar **Stil** | Preset wechseln (Tempo springt auf die Stil-Voreinstellung) |
| Toolbar **BPM −/+** | Tempo in 5er-Schritten |
| Toolbar **Territorium räumen** | zweimal klicken → Grid leer |
| Taste `1` / `2` / `3` | Entität: Punktwolke / ASCII / Slit-Scan (deaktiviert Auto-Zyklus) |
| Taste `a` | Auto-Zyklus an/aus (Moduswechsel alle 40 s) |

Die Kommandos laufen als Nachrichten Overlay → Server über denselben WebSocket; der Server lauscht deshalb nur auf `127.0.0.1` (`WS_HOST` überschreibt das).

## Stil-Presets

`shared/src/styles.ts` — ein Stil bündelt Drum-Bank, Stimmen-Set, Skalenreise, Drone und Effekt-Charakter. Zuschauer-Zellen bleiben beim Wechsel erhalten, klingen aber sofort anders.

| Stil | BPM | Drums | Charakter |
|---|---|---|---|
| **Deep** | 120 | TR-909 | GM-Plucks, Moll-Reise, Hall + Delay, leichter Swing |
| **Lo-Fi** | 84 | Akai MPC60 | E-Piano/Vibraphon/Nylon, Pentatonik/Dorisch, dumpfer Filter, `coarse`, starker Swing |
| **Rave** | 138 | E-mu SP-12 | Sawtooth/Square/Supersaw mit Filter-Envelope + Resonanz, Phrygisch, trocken, `shape` auf den Drums |
| **Dream** | 92 | Oberheim DMX | Pads/Chor/Harfe mit langem Release, Lydisch/Dur, grosser Raum, weiche Drums |

Die Drum-Bank muss alle Sounds `bd sd hh oh cp rim lt mt ht cr rd` enthalten — vollständig sind u. a. RolandTR909, LinnDrum, AkaiMPC60, EmuSP12, OberheimDMX, RolandTR505/626, RolandR8 (TR-808 fehlt `rd`).

Die Slit-Scan-Scanlinie läuft synchron zum Playhead des Grids.

## Roadmap

- REPL-Slot: 60 s echtes Live-Coding für Top-Gifter (sandboxed Whitelist)
- Archiv/Sediment: alte Patterns kehren als Geister-Echos zurück
