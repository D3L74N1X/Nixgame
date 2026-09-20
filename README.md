# Nixgame

Ein TikTok-Live-Overlay, das die Rollen umdreht: **Die Zuschauer sind die Creator, der Streamer ist nur noch ein Artefakt.**

Der Bildschirm ist ein geteiltes Territorium — ein 16×8-Step-Sequencer, dessen Zellen die Zuschauer per Chat-Kommando beanspruchen. Ein Playhead wandert über das Grid und spielt, was die Community gebaut hat: Der Grid-Zustand wird live in [Strudel](https://strudel.cc)-Code übersetzt, sichtbar in ein REPL "getippt" und evaluiert. In der Mitte haust die **Entität**: das Kamerabild des Streamers, durch Shader entmenschlicht (Punktwolke, ASCII, Slit-Scan) — sichtbar als Silhouette, aber keine Person. Sie handelt nie, sie reagiert nur: Likes geben ihr Energie, Gifts lassen sie pulsieren, die Stimme des letzten Autors färbt sie.

## Architektur

```
TikTok LIVE ──(tiktok-live-connector)──▶ server ──(WebSocket)──▶ overlay (OBS Browser-Source)
                                          │                        ├─ Grid-Sequencer (Canvas 2D)
                                          │                        ├─ Strudel-REPL (<strudel-editor>)
                                          └─ Mock-Generator        └─ Entität (WebGL2-Shader)
```

- **`shared/`** — Typen, Kommando-DSL, User-Stimmen, Grid→Strudel-Codegen
- **`server/`** — Node: TikTok-Events (oder Mock), Grid-Zustand, WS-Broadcast, Persistenz
- **`overlay/`** — Vite-App: transparente Overlay-Seite für OBS

**Sicherheit:** Zuschauertext erreicht nie das REPL. Chat wird gegen eine Whitelist-DSL geparst; Strudel-Code entsteht ausschließlich aus validierten Tokens des Grids.

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

1. Browser-Source hinzufügen: `http://localhost:5173`, 1920×1080.
2. **OBS ≥ 30:** In den Source-Eigenschaften *Page permissions* auf „Allow access to camera/microphone" stellen, sonst bekommt die Entität kein Kamerabild (Fallback-Geist erscheint).
3. „Control audio via OBS" aktivieren, damit der Strudel-Sound in den Stream gemischt wird.
4. Die Entität weckt sich in OBS automatisch (erkannt über `window.obsstudio`). In anderen Umgebungen ohne Klick-Geste hilft `?autostart=1` an der URL — vorausgesetzt, der Browser erlaubt Autoplay.

## Chat-Kommandos

| Kommando | Wirkung |
|---|---|
| `!drum bd 5` | Percussion in Spalte 5 (`bd sd hh oh` = feste Zeilen; `cp rim lt mt ht click perc` → fx-Zeile) |
| `!note c3 5` | Note in Spalte 5, erste freie melodische Zeile (`c2`–`b5`, auch `#`/`b`) |
| `!cell 5 7 e4` | Direkte Zellen-Adressierung: Spalte, Zeile, Token |
| `!clear 5 7` | Eigene Zelle räumen |
| `!bpm 140` | Tempo 60–200 (15 s Cooldown) |

Regeln: Freie Zellen kann jeder beanspruchen, fremde Zellen sind tabu (Territorium!). Jeder Handle bekommt deterministisch eine persistente **Stimme** (Synth + Farbe) — Beiträge klingen und leuchten nach ihrem Autor, der Playhead kreditiert live („jetzt hörbar: @…").

## Entität steuern (Streamer)

| Taste | Wirkung |
|---|---|
| `1` / `2` / `3` | Punktwolke / ASCII / Slit-Scan (deaktiviert Auto-Zyklus) |
| `a` | Auto-Zyklus an/aus (Moduswechsel alle 40 s) |

Die Slit-Scan-Scanlinie läuft synchron zum Playhead des Grids.

## Roadmap

- Gift-Eskalation: Zellen "stehlen", Effekt-Layer, REPL-Slot (60 s echtes Live-Coding für Top-Gifter, sandboxed)
- Archiv/Sediment: alte Patterns kehren als Geister-Echos zurück
- Verfall: unbespielte Zellen erodieren langsam
