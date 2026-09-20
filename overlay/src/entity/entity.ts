import {
  ASCII_FS,
  POINTS_FS,
  POINTS_VS,
  QUAD_VS,
  SLIT_ACC_FS,
  SLIT_SHOW_FS,
} from './shaders.js';

export type EntityMode = 'points' | 'ascii' | 'slitscan';
const MODES: EntityMode[] = ['points', 'ascii', 'slitscan'];

const GLYPHS = ' .:-=+*#%@';
const POINT_COLS = 140;
const POINT_ROWS = 80;
const ACC_W = 640;
const ACC_H = 360;
const AUTO_CYCLE_MS = 40_000;

function hueToRgb(hue: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return 0.62 - 0.42 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/**
 * Die Entität: das Kamerabild (oder ein prozeduraler Geist als Fallback),
 * durch Shader entmenschlicht. Sie handelt nie — sie reagiert nur auf
 * Energie (Likes/Gifts) und den Puls des Playheads.
 */
export class Entity {
  private gl: WebGL2RenderingContext;
  private video: HTMLVideoElement | null = null;
  private frame: ImageBitmap | null = null;
  private frameAt = 0;
  private frameDirty = false;
  private decoding = false;
  private fallback = document.createElement('canvas');
  private fallbackCtx: CanvasRenderingContext2D;
  private videoTex: WebGLTexture;
  private glyphTex: WebGLTexture;
  private quadVao: WebGLVertexArrayObject;
  private pointsVao: WebGLVertexArrayObject;
  private progPoints: WebGLProgram;
  private progAscii: WebGLProgram;
  private progAcc: WebGLProgram;
  private progShow: WebGLProgram;
  private accTex: [WebGLTexture, WebGLTexture];
  private accFbo: [WebGLFramebuffer, WebGLFramebuffer];
  private accIndex = 0;
  private sourceSize = { w: 320, h: 180 };

  mode: EntityMode = 'points';
  autoCycle = true;
  private lastCycle = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL2 nicht verfügbar');
    this.gl = gl;

    this.fallback.width = 320;
    this.fallback.height = 180;
    this.fallbackCtx = this.fallback.getContext('2d')!;

    this.progPoints = this.link(POINTS_VS, POINTS_FS);
    this.progAscii = this.link(QUAD_VS, ASCII_FS);
    this.progAcc = this.link(QUAD_VS, SLIT_ACC_FS);
    this.progShow = this.link(QUAD_VS, SLIT_SHOW_FS);

    this.quadVao = this.makeQuadVao(this.progAscii);
    this.pointsVao = this.makePointsVao();

    this.videoTex = this.makeTexture();
    this.glyphTex = this.makeGlyphAtlas();

    this.accTex = [this.makeTexture(ACC_W, ACC_H), this.makeTexture(ACC_W, ACC_H)];
    this.accFbo = [gl.createFramebuffer()!, gl.createFramebuffer()!];
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.accFbo[i]);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.accTex[i], 0,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    window.addEventListener('keydown', (e) => {
      if (e.key >= '1' && e.key <= '3') {
        this.mode = MODES[Number(e.key) - 1];
        this.autoCycle = false;
      } else if (e.key === 'a') {
        this.autoCycle = !this.autoCycle;
      }
    });
  }

  /**
   * Kamera-Frame vom Server (JPEG). Hat Vorrang vor getUserMedia — in OBS
   * bekommt die Browser-Source keine Kamera, der Server aber schon.
   */
  pushFrame(jpeg: Blob): void {
    if (this.decoding) return; // Rückstau: Frame verwerfen, den nächsten nehmen
    this.decoding = true;
    // UNPACK_FLIP_Y_WEBGL greift bei ImageBitmap nicht — Flip hier beim Dekodieren.
    createImageBitmap(jpeg, { imageOrientation: 'flipY' })
      .then((bmp) => {
        this.frame?.close();
        this.frame = bmp;
        this.frameAt = performance.now();
        this.frameDirty = true;
      })
      .catch(() => {})
      .finally(() => (this.decoding = false));
  }

  private get serverFrameLive(): boolean {
    return this.frame !== null && performance.now() - this.frameAt < 2000;
  }

  /** Kamera anfordern; ohne Kamera haust ein prozeduraler Geist im Artefakt. */
  async start(): Promise<void> {
    if (this.serverFrameLive) {
      console.log('[entity] Kamera kommt vom Server');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 360 },
        audio: false,
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      this.video = video;
      console.log('[entity] Kamera aktiv');
    } catch (e) {
      console.warn('[entity] keine Kamera — prozeduraler Fallback:', e);
    }
  }

  render(tSec: number, energy: number, pulse: number, hue: number, scanX: number): void {
    const gl = this.gl;
    this.fitCanvas();
    this.uploadSource(tSec, energy, pulse);

    if (this.autoCycle && tSec - this.lastCycle > AUTO_CYCLE_MS / 1000) {
      this.lastCycle = tSec;
      this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
    }

    const cover = this.coverScale();
    const tint = hueToRgb(hue);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this.mode === 'points') {
      gl.useProgram(this.progPoints);
      this.bindTex(this.progPoints, 'uVideo', this.videoTex, 0);
      this.uniform2(this.progPoints, 'uCover', cover);
      this.uniform1(this.progPoints, 'uTime', tSec);
      this.uniform1(this.progPoints, 'uEnergy', energy);
      this.uniform1(this.progPoints, 'uPulse', pulse);
      this.uniform1(this.progPoints, 'uPointScale', window.devicePixelRatio || 1);
      this.uniform1(this.progPoints, 'uThreshold', 0.16);
      this.uniform3(this.progPoints, 'uTint', tint);
      gl.bindVertexArray(this.pointsVao);
      gl.drawArrays(gl.POINTS, 0, POINT_COLS * POINT_ROWS);
    } else if (this.mode === 'ascii') {
      gl.useProgram(this.progAscii);
      this.bindTex(this.progAscii, 'uVideo', this.videoTex, 0);
      this.bindTex(this.progAscii, 'uGlyphs', this.glyphTex, 1);
      this.uniform2(this.progAscii, 'uCover', cover);
      this.uniform2(this.progAscii, 'uCells', [96, 54]);
      this.uniform1(this.progAscii, 'uGlyphCount', GLYPHS.length);
      this.uniform1(this.progAscii, 'uThreshold', 0.14);
      this.uniform1(this.progAscii, 'uEnergy', energy);
      this.uniform1(this.progAscii, 'uPulse', pulse);
      this.uniform3(this.progAscii, 'uTint', tint);
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      // Feedback-Pass in den Akkumulator (Scanline läuft mit dem Playhead)
      const src = this.accIndex;
      const dst = 1 - this.accIndex;
      this.accIndex = dst;
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.accFbo[dst]);
      gl.viewport(0, 0, ACC_W, ACC_H);
      gl.useProgram(this.progAcc);
      this.bindTex(this.progAcc, 'uVideo', this.videoTex, 0);
      this.bindTex(this.progAcc, 'uPrev', this.accTex[src], 1);
      this.uniform2(this.progAcc, 'uCover', cover);
      this.uniform1(this.progAcc, 'uScanX', scanX);
      this.uniform1(this.progAcc, 'uPulse', pulse);
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.enable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(this.progShow);
      this.bindTex(this.progShow, 'uAcc', this.accTex[dst], 0);
      this.uniform1(this.progShow, 'uThreshold', 0.12);
      this.uniform3(this.progShow, 'uTint', tint);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.bindVertexArray(null);
  }

  // --- Quelle -------------------------------------------------------------

  private uploadSource(t: number, energy: number, pulse: number): void {
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
    if (this.serverFrameLive) {
      const f = this.frame!;
      this.sourceSize = { w: f.width, h: f.height };
      if (this.frameDirty) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, f);
        this.frameDirty = false;
      }
    } else if (this.video && this.video.readyState >= 2) {
      this.sourceSize = { w: this.video.videoWidth, h: this.video.videoHeight };
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
    } else {
      this.drawFallback(t, energy, pulse);
      this.sourceSize = { w: this.fallback.width, h: this.fallback.height };
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.fallback);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  /** Prozeduraler "Geist": atmende Silhouette aus weichen Ellipsen + Korn. */
  private drawFallback(t: number, energy: number, pulse: number): void {
    const ctx = this.fallbackCtx;
    const { width: w, height: h } = this.fallback;
    ctx.filter = 'none';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const breathe = 1 + 0.06 * Math.sin(t * 1.1) + 0.12 * energy + 0.2 * pulse;
    const cx = w * (0.5 + 0.02 * Math.sin(t * 0.5));
    ctx.filter = 'blur(6px)';
    ctx.fillStyle = 'rgba(235,235,235,0.9)';
    // Kopf
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.3, w * 0.055 * breathe, w * 0.06 * breathe, 0, 0, Math.PI * 2);
    ctx.fill();
    // Torso
    ctx.beginPath();
    ctx.ellipse(
      cx, h * 0.85,
      w * 0.11 * breathe, h * 0.42 * (1 + 0.03 * Math.sin(t * 0.8)),
      0, 0, Math.PI * 2,
    );
    ctx.fill();

    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 220; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }

  // --- GL-Plumbing ----------------------------------------------------------

  private fitCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /** Sichtbarer Ausschnitt der Quelle bei "cover"-Füllung des Canvas. */
  private coverScale(): [number, number] {
    const ca = this.canvas.width / Math.max(1, this.canvas.height);
    const va = this.sourceSize.w / Math.max(1, this.sourceSize.h);
    return ca > va ? [1, va / ca] : [ca / va, 1];
  }

  private link(vsSrc: string, fsSrc: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(`Shader: ${gl.getShaderInfoLog(sh)}`);
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program: ${gl.getProgramInfoLog(prog)}`);
    }
    return prog;
  }

  private makeQuadVao(prog: WebGLProgram): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private makePointsVao(): WebGLVertexArrayObject {
    const gl = this.gl;
    const pts = new Float32Array(POINT_COLS * POINT_ROWS * 2);
    let i = 0;
    for (let y = 0; y < POINT_ROWS; y++) {
      for (let x = 0; x < POINT_COLS; x++) {
        pts[i++] = (x + 0.5) / POINT_COLS;
        pts[i++] = (y + 0.5) / POINT_ROWS;
      }
    }
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, pts, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.progPoints, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private makeTexture(w?: number, h?: number): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w && h) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    return tex;
  }

  private makeGlyphAtlas(): WebGLTexture {
    const gl = this.gl;
    const cell = 32;
    const canvas = document.createElement('canvas');
    canvas.width = cell * GLYPHS.length;
    canvas.height = cell;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = `${cell - 6}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < GLYPHS.length; i++) {
      ctx.fillText(GLYPHS[i], i * cell + cell / 2, cell / 2 + 2);
    }
    const tex = this.makeTexture();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return tex;
  }

  private bindTex(prog: WebGLProgram, name: string, tex: WebGLTexture, unit: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }

  private uniform1(prog: WebGLProgram, name: string, v: number): void {
    this.gl.uniform1f(this.gl.getUniformLocation(prog, name), v);
  }

  private uniform2(prog: WebGLProgram, name: string, v: [number, number] | number[]): void {
    this.gl.uniform2f(this.gl.getUniformLocation(prog, name), v[0], v[1]);
  }

  private uniform3(prog: WebGLProgram, name: string, v: [number, number, number]): void {
    this.gl.uniform3f(this.gl.getUniformLocation(prog, name), v[0], v[1], v[2]);
  }
}
