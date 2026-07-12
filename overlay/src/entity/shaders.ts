/**
 * GLSL-Quellen der Entität. Drei Abstraktionsmodi über demselben
 * Video-/Fallback-Feed: Punktwolke, ASCII, Slit-Scan-Feedback.
 * Alles Silhouette statt Person: Luma-Schwelle schneidet den Körper
 * aus, Farbe kommt als Tint aus der Community (Hue des letzten Autors).
 */

export const QUAD_VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos;
  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Gemeinsame Helfer: Cover-Mapping (Video füllt Canvas) + Spiegelung. */
const COMMON = `
vec2 coverUv(vec2 uv, vec2 cover) {
  vec2 c = (uv - 0.5) * cover + 0.5;
  c.x = 1.0 - c.x; // Webcam spiegeln
  return c;
}
float lumaOf(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
`;

export const POINTS_VS = `#version 300 es
precision highp float;
in vec2 aPos;
uniform sampler2D uVideo;
uniform vec2 uCover;
uniform float uTime, uEnergy, uPulse, uPointScale;
out float vLuma;
${COMMON}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = coverUv(aPos, uCover);
  float luma = lumaOf(texture(uVideo, uv).rgb);
  vLuma = luma;
  float agitation = 0.003 + 0.02 * uPulse + 0.006 * uEnergy;
  vec2 jitter = (vec2(hash(aPos * 7.0 + uTime * 0.13),
                      hash(aPos * 13.0 - uTime * 0.11)) - 0.5)
                * agitation * smoothstep(0.15, 0.8, luma);
  vec2 pos = aPos + jitter;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = (1.0 + luma * (2.5 + 5.0 * uEnergy) + uPulse * 3.0) * uPointScale;
}`;

export const POINTS_FS = `#version 300 es
precision highp float;
in float vLuma;
uniform float uThreshold;
uniform vec3 uTint;
out vec4 outColor;
void main() {
  if (vLuma < uThreshold) discard;
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d);
  outColor = vec4(uTint * (0.35 + vLuma * 0.85), a * (0.3 + vLuma * 0.7));
}`;

export const ASCII_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVideo, uGlyphs;
uniform vec2 uCover, uCells;
uniform float uGlyphCount, uThreshold, uEnergy, uPulse;
uniform vec3 uTint;
out vec4 outColor;
${COMMON}
void main() {
  vec2 cell = floor(vUv * uCells);
  vec2 cellCenter = (cell + 0.5) / uCells;
  vec2 uv = coverUv(cellCenter, uCover);
  float luma = lumaOf(texture(uVideo, uv).rgb);
  float boosted = clamp(luma * (1.0 + uEnergy * 0.6 + uPulse * 0.4), 0.0, 0.999);
  float idx = floor(boosted * uGlyphCount);
  vec2 inCell = fract(vUv * uCells);
  float glyph = texture(uGlyphs, vec2((idx + inCell.x) / uGlyphCount, inCell.y)).a;
  float visible = step(uThreshold, luma);
  outColor = vec4(uTint * (0.4 + luma * 0.8), glyph * visible * 0.95);
}`;

/** Feedback-Pass: an der Scanlinie wird das Video eingeschrieben, der Rest verblasst langsam. */
export const SLIT_ACC_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVideo, uPrev;
uniform vec2 uCover;
uniform float uScanX, uPulse;
out vec4 outColor;
${COMMON}
void main() {
  vec3 prev = texture(uPrev, vUv).rgb * 0.995;
  vec3 vid = texture(uVideo, coverUv(vUv, uCover)).rgb;
  float band = smoothstep(0.015 + uPulse * 0.03, 0.0, abs(vUv.x - uScanX));
  outColor = vec4(mix(prev, vid, band), 1.0);
}`;

export const SLIT_SHOW_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uAcc;
uniform float uThreshold;
uniform vec3 uTint;
out vec4 outColor;
${COMMON}
void main() {
  vec3 c = texture(uAcc, vUv).rgb;
  float luma = lumaOf(c);
  float a = smoothstep(uThreshold * 0.6, 0.75, luma);
  outColor = vec4(uTint * (0.3 + luma * 0.9), a * 0.9);
}`;
