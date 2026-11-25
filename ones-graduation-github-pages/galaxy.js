import { createProgram } from './webgl.js';

// Shader from the supplied React Bits Galaxy component.
const VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
#define PALETTE
precision highp float;
precision highp int;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uFocal;
uniform vec2 uRotation;
uniform float uGloss;
uniform float uDepth;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uStarGlow;
uniform float uFlareGain;
uniform float uSquash;
uniform float uSaturation;
uniform float uMouseRepulsion;
uniform float uTwinkleIntensity;
uniform float uRotationAngle;
uniform float uRepulsionStrength;
uniform float uMouseActiveFactor;
uniform float uAutoCenterRepulsion;
uniform int uLayers;
uniform vec3 uColors[4];
uniform int uColorCount;
uniform float uWarp;
uniform float uReveal;
uniform float uMode;
uniform vec3 uBackground;
uniform float uOpacity;
out vec4 outColor;

#define STAR_COLOR_CUTOFF 0.2
#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float tri(float x) {
  return abs(fract(x) * 2.0 - 1.0);
}

float tris(float x) {
  float t = fract(x);
  return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
}

float trisn(float x) {
  float t = fract(x);
  return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float Star(vec2 uv, float flare, vec2 radial, float invReach) {
#ifdef WARP
  float along = dot(uv, radial);
  float d = sqrt(max(dot(uv, uv) - uSquash * along * along, 0.0));
#else
  float d = length(uv);
#endif
  float m = uStarGlow / d;
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare * uFlareGain;
  uv *= MAT45;
  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare * uFlareGain;
  m *= smoothstep(1.0, 0.2, d * invReach);
#ifdef WARP
  m *= mix(1.0, smoothstep(1.0, 0.55, length(uv) * invReach), min(uWarp * 4.0, 1.0));
#endif
  return m;
}

vec3 StarLayer(vec2 uv, vec2 radial, vec2 repelAt, float pushCells, float spread) {
  vec3 col = vec3(0.0);
  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 si = id + offset;
      float seed = Hash21(si);
      float size = fract(seed * 345.32);
      float glossLocal = tri(uGloss / (PERIOD * seed + 1.0));
      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

#ifdef PALETTE
      float pick = Hash21(si + 7.0) * float(uColorCount);
      vec3 base = uColors[int(min(floor(pick), float(uColorCount - 1)))];
#else
      float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
      float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
      float grn = min(red, blu) * seed;
      vec3 base = vec3(red, grn, blu);
      float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
      hue = fract(hue + uHueShift / 360.0);
      float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
      float val = max(max(base.r, base.g), base.b);
      base = hsv2rgb(vec3(hue, sat, val));
#endif

      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;
      vec2 shift = vec2(0.0);
      float invReach = 1.0;
#ifdef REPEL
      vec2 away = si + 0.5 + pad - repelAt;
      float dist = length(away);
      float q = dist * spread;
      float cells = pushCells * exp(-q * q);
      float moved = cells * inversesqrt(1.0 + cells * cells * 2.78);
      shift = away * (moved / max(dist, 0.0001));
      invReach = 1.0 / (1.0 - moved);
#endif
      float star = Star(gv - offset - pad - shift, flareSize, radial, invReach);
      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
      twinkle = mix(1.0, twinkle, uTwinkleIntensity);
      col += star * twinkle * size * base;
    }
  }
  return col;
}

void main() {
  vec2 focalPx = uFocal * uResolution;
  vec2 uv = (gl_FragCoord.xy - focalPx) / uResolution.y;
  vec2 mouseNorm = uMouse - vec2(0.5);

  vec2 repelAt = vec2(0.0);
  float strength = 0.0;
  float push = 0.0;
  if (uAutoCenterRepulsion > 0.0) {
    strength = uAutoCenterRepulsion;
    push = strength * 0.05;
  } else if (uMouseRepulsion > 0.5) {
    repelAt = (uMouse * uResolution - focalPx) / uResolution.y;
    strength = max(uRepulsionStrength, 0.0);
    push = strength * 0.05 * uMouseActiveFactor;
  } else {
    uv += mouseNorm * 0.1 * uMouseActiveFactor;
  }
  float radius = 0.16 + 0.04 * strength;

  vec2 radial = length(uv) > 0.0001 ? normalize(uv) : vec2(1.0, 0.0);
  float angle = uRotationAngle;
  uv = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * uv;
  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;
  radial = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * radial;
  radial = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * radial;
  repelAt = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * repelAt;
  repelAt = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * repelAt;

  vec3 col = vec3(0.0);
  float layers = float(uLayers);
  for (int k = 0; k < 3; k++) {
    if (k >= uLayers) break;
    float i = float(k) / layers;
    float depth = fract(i + uDepth);
    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
    float fade = depth * smoothstep(1.0, 0.9, depth);
    vec2 offset = vec2(i * 453.32);
    col += StarLayer(uv * scale + offset, radial, repelAt * scale + offset, push * scale, 1.0 / (scale * radius)) * fade;
  }
  col *= uReveal;

  if (uMode > 1.5) {
    vec3 lit = col * smoothstep(0.0, 0.3, length(col));
    float energy = max(max(lit.r, lit.g), lit.b);
    vec3 tint = lit / max(energy, 0.0001);
    vec3 ink = tint * (0.16 / max(dot(tint, vec3(0.2126, 0.7152, 0.0722)), 0.16));
    float coverage = pow(min(energy * 1.3, 1.0), 1.3) * 0.92 * uOpacity;
    outColor = uMode > 2.5 ? vec4(ink * coverage, coverage) : vec4(mix(uBackground, ink, coverage), 1.0);
  } else if (uMode > 0.5) {
    float alpha = min(smoothstep(0.0, 0.3, length(col)), 1.0) * uOpacity;
    outColor = vec4(col * alpha, alpha);
  } else {
    outColor = vec4(mix(uBackground, col, uOpacity), 1.0);
  }
}`;

function createShaderRenderer(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
  });
  if (!gl) return;

  const program = createProgram(gl, VERTEX, FRAGMENT);
  if (!program) return;
  const triangles = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, triangles);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  const uniforms = {};
  for (let index = 0; index < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); index += 1) {
    const name = gl.getActiveUniform(program, index).name;
    uniforms[name.replace('[0]', '')] = gl.getUniformLocation(program, name);
  }
  const set = (name, value) => gl.uniform1f(uniforms[name] ?? null, value);

  gl.useProgram(program);
  gl.uniform2f(uniforms.uFocal, 0.52, 0.5);
  gl.uniform2f(uniforms.uRotation, 1, 0);
  gl.uniform3fv(uniforms.uColors, new Float32Array([
    0.88, 0.93, 1,
    0.43, 0.65, 0.98,
    0.65, 0.77, 0.98,
    0.52, 0.64, 0.90,
  ]));
  gl.uniform1i(uniforms.uColorCount, 4);
  gl.uniform1i(uniforms.uLayers, 3);
  set('uDensity', 0.89);
  set('uSpeed', 0.52);
  set('uStarGlow', 0.014);
  set('uFlareGain', 0.1);
  set('uTwinkleIntensity', 0.32);
  set('uMode', 1);
  set('uOpacity', 0.86);
  set('uReveal', 1);

  return function draw(time) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    set('uTime', time);
    set('uGloss', time * 0.043);
    set('uDepth', 0.31 + time * 0.028);
    set('uRotationAngle', time * 0.011);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

function createStarRenderer(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return null;
  const colors = ['#e5eeff', '#a8c5f1', '#8aace6', '#becff9'];
  const stars = Array.from({ length: 148 }, (_, index) => ({
    x: Math.random() - 0.5,
    y: Math.random() - 0.5,
    depth: Math.random(),
    size: 0.38 + Math.random() * 0.78,
    phase: Math.random() * 6.28,
    flare: index % 19 === 0,
    color: colors[index % colors.length],
  }));

  return function draw(time) {
    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);
    const angle = time * 0.011;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    stars.forEach((star) => {
      const depth = (star.depth + time * 0.026) % 1;
      const scale = 0.88 + depth * 0.36;
      const x = width * (0.5 + (star.x * cosine - star.y * sine) * scale);
      const y = height * (0.5 + (star.x * sine + star.y * cosine) * scale);
      const edgeFade = Math.min(1, depth * 8, (1 - depth) * 8);
      const brightness = (0.50 + Math.sin(time * 1.12 + star.phase) * 0.26) * edgeFade;
      const radius = star.size * (0.65 + depth * 0.65);
      context.fillStyle = star.color;
      context.globalAlpha = brightness;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();

      if (star.flare) {
        context.globalAlpha = brightness * 0.27;
        context.fillRect(x - radius * 2.1, y - 0.23, radius * 4.2, 0.46);
        context.fillRect(x - 0.23, y - radius * 2.1, 0.46, radius * 4.2);
      }
    });
    context.globalAlpha = 1;
  };
}

export function initGalaxy(canvas, motionPreference) {
  let draw = createShaderRenderer(canvas);
  if (!draw) {
    const replacement = canvas.cloneNode();
    canvas.replaceWith(replacement);
    canvas = replacement;
    draw = createStarRenderer(canvas);
  }
  if (!draw) return;

  let frame = 0;
  let previous = 0;
  let time = 1.1;

  function wake() {
    if (!frame && !document.hidden && !motionPreference.matches) frame = requestAnimationFrame(step);
  }

  function step(now) {
    frame = 0;
    if (document.hidden || motionPreference.matches) {
      previous = 0;
      return;
    }
    if (now - previous >= 32) {
      time += previous ? Math.min((now - previous) / 1000, 0.07) : 0;
      previous = now;
      draw(time);
    }
    wake();
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const pixelRatio = Math.min(1, 860 / Math.max(width, height, 1));
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    draw(time);
    wake();
  }

  new ResizeObserver(resize).observe(canvas);
  document.addEventListener('visibilitychange', () => {
    previous = 0;
    wake();
  });
  motionPreference.addEventListener('change', wake);
  canvas.classList.add('has-galaxy');
  resize();
}
