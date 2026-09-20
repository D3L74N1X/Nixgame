import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Kamera-Quelle für die Entität: ffmpeg greift die Webcam (DirectShow) ab und
 * liefert MJPEG-Frames, die als Binärnachrichten ans Overlay gehen. So braucht
 * die OBS-Browser-Source keine Kamera-Berechtigung — die bekommt sie ohnehin
 * nicht zuverlässig.
 *
 * Env: CAMERA=off deaktiviert, CAMERA="<Gerätename>" wählt explizit,
 *      FFMPEG=<Pfad> überschreibt die Binary, CAMERA_FPS / CAMERA_WIDTH tunen.
 */

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const FPS = Number(process.env.CAMERA_FPS ?? 15);
const WIDTH = Number(process.env.CAMERA_WIDTH ?? 640);

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);

function listVideoDevices(): Promise<string[]> {
  return new Promise((resolve) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']);
    let out = '';
    p.stderr.on('data', (d) => (out += d.toString()));
    p.on('error', () => resolve([]));
    p.on('close', () => {
      const names: string[] = [];
      for (const m of out.matchAll(/"([^"]+)" \(video\)/g)) names.push(m[1]);
      resolve(names);
    });
  });
}

export async function startCameraSource(onFrame: (jpeg: Buffer) => void): Promise<void> {
  const wanted = process.env.CAMERA;
  if (wanted === 'off') {
    console.log('[camera] deaktiviert (CAMERA=off)');
    return;
  }
  if (process.platform !== 'win32') {
    console.log('[camera] nur DirectShow/Windows unterstützt — Overlay nutzt getUserMedia/Geist');
    return;
  }

  let device = wanted;
  if (!device) {
    const devices = await listVideoDevices();
    // Virtuelle Kameras (OBS, VTube, Phone) überspringen, falls eine echte da ist.
    device =
      devices.find((d) => !/virtual|virtuell|obs|vtube/i.test(d)) ?? devices[0];
    if (!device) {
      console.warn('[camera] kein Videogerät gefunden — Overlay nutzt getUserMedia/Geist');
      return;
    }
  }
  console.log(`[camera] Gerät: "${device}" @ ${FPS} fps, ${WIDTH}px`);

  let retry = 2000;
  let proc: ChildProcess | null = null;

  const run = () => {
    let buf: Buffer = Buffer.alloc(0);
    let frames = 0;
    proc = spawn(FFMPEG, [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'dshow', '-rtbufsize', '64M', '-i', `video=${device}`,
      '-vf', `fps=${FPS},scale=${WIDTH}:-2`,
      '-f', 'mjpeg', '-q:v', '6', 'pipe:1',
    ]);
    proc.stdout!.on('data', (chunk: Buffer) => {
      buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
      // MJPEG-Strom in einzelne JPEGs schneiden (SOI … EOI)
      for (;;) {
        const start = buf.indexOf(SOI);
        if (start < 0) { buf = Buffer.alloc(0); break; }
        const end = buf.indexOf(EOI, start + 2);
        if (end < 0) { if (start > 0) buf = buf.subarray(start); break; }
        onFrame(buf.subarray(start, end + 2));
        buf = buf.subarray(end + 2);
        if (++frames === 1) console.log('[camera] erste Frames laufen');
      }
    });
    proc.stderr!.on('data', (d) => console.warn('[camera/ffmpeg]', d.toString().trim()));
    proc.on('error', (e) => console.error('[camera] ffmpeg nicht startbar:', e.message));
    proc.on('close', (code) => {
      console.warn(`[camera] ffmpeg beendet (code ${code}), Neustart in ${retry / 1000}s`);
      setTimeout(run, retry);
      retry = Math.min(retry * 2, 30_000);
    });
    if (frames > 0) retry = 2000;
  };
  run();

  process.on('exit', () => proc?.kill());
}
