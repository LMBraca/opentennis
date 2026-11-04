'use client';

/**
 * The hero scene: three tennis balls, the Open Tennis mark in motion.
 *
 * NO MESHES. The balls are ray-traced analytically in a fragment shader on a
 * single full-screen triangle.
 *
 * The first version used ogl's Sphere geometry, and its outline was visibly
 * jagged. That was not pixel aliasing — it was the silhouette of a 48×32
 * polygon sphere, a 32-gon outline about 180px across, so every facet was
 * roughly six pixels of straight edge. Subdividing further only pushes the
 * problem below the noise floor and costs vertices to do it; MSAA does not
 * help, because the geometry really is that shape.
 *
 * Intersecting a ray with a sphere gives the exact silhouette instead, and
 * coverage can be derived from the ray's closest approach to the centre and
 * feathered across exactly one pixel. The edge is then mathematically smooth
 * at any resolution and does not depend on the context granting MSAA. It is
 * also cheaper: one draw call, three vertices, no geometry upload.
 *
 * Tiering, in order:
 *   off  — renders nothing and never imports ogl. Reduced motion costs the
 *          user no bytes, rather than merely holding still.
 *   lite — a CSS wash. No WebGL context on a weak device.
 *   full — the scene below.
 *
 * It also stops when off-screen or on a hidden tab. A hero animation that
 * keeps burning GPU while someone reads the draws below is a battery bug.
 */

import { useEffect, useRef, useState } from 'react';
import { readMotionTier, type MotionTier } from '@/lib/motion/tier';
import styles from './ball-scene.module.css';

const BALL_COUNT = 3;

/** Cluster layout, echoing the three balls in the Open Tennis mark. */
const BASES: readonly (readonly [number, number, number])[] = [
  [0, 1.15, 0],
  [-1.25, -0.72, 0.3],
  [1.25, -0.72, -0.3],
];
const SPINS: readonly number[] = [0.30, -0.24, 0.26];

/**
 * THE SEAM, as a closed polyline on the unit sphere.
 *
 * This is the real tennis-ball curve, not an approximation:
 *
 *     x = a·cos t + b·cos 3t
 *     y = a·sin t − b·sin 3t
 *     z = c·sin 2t          with c² = 4ab, which is what puts it on the sphere
 *
 * The previous version used a made-up implicit field, polar = 90° +
 * A·sin(2·azimuth). That family CANNOT represent this curve, because the real
 * seam doubles back — it is multivalued in azimuth — and it swings 60° off
 * the equator where the approximation reached only 35°. The visible symptom
 * was a sharp corner where the seam turned, which no amount of antialiasing
 * could fix because it was the shape that was wrong, not the shading.
 *
 * 96 segments: the chord sags from the true arc by s²/8 ≈ 0.003 rad, about
 * 6% of the seam's soft edge, so the facets are not resolvable.
 */
const SEAM_SEGMENTS = 96;

function seamPolyline(): number[] {
  const a = 0.75;
  const b = 0.25;
  const c = Math.sqrt(4 * a * b);
  const out: number[] = [];
  // <= so the last point repeats the first and the loop needs no wraparound.
  for (let i = 0; i <= SEAM_SEGMENTS; i++) {
    const t = (2 * Math.PI * i) / SEAM_SEGMENTS;
    out.push(
      a * Math.cos(t) + b * Math.cos(3 * t),
      a * Math.sin(t) - b * Math.sin(3 * t),
      c * Math.sin(2 * t),
    );
  }
  return out;
}

/**
 * Swing a point around the origin: yaw about Y, then pitch about X.
 *
 * This is the pointer parallax, and it has to be a ROTATION of the cluster.
 * An earlier rewrite translated all three balls by the same small offset
 * instead, which moves the group rigidly and therefore reads as no motion at
 * all — the thing that makes parallax legible is the balls changing position
 * RELATIVE to each other as the group turns.
 */
function orbit(
  base: readonly [number, number, number],
  yaw: number,
  pitch: number,
): [number, number, number] {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  const x1 = base[0] * cy + base[2] * sy;
  const z1 = -base[0] * sy + base[2] * cy;

  return [x1, base[1] * cp - z1 * sp, base[1] * sp + z1 * cp];
}

const VERTEX = /* glsl */ `
precision highp float;

attribute vec2 position;
attribute vec2 uv;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uCamZ;
uniform float uTanHalfFov;
uniform float uRadius;
uniform vec3 uCenters[${BALL_COUNT}];
uniform vec3 uRot[${BALL_COUNT}];
uniform vec3 uFelt;
uniform vec3 uSeamColor;
uniform vec3 uSeamPts[${SEAM_SEGMENTS + 1}];

float hash31(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

/* Value noise in 3D, so the nap is anchored to the ball and does not swim
   across the surface as it turns. */
float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i),                       hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

/* Column-major, as GLSL expects: mat3(col0, col1, col2). */
mat3 rotation(vec3 e) {
  float cx = cos(e.x), sx = sin(e.x);
  float cy = cos(e.y), sy = sin(e.y);
  float cz = cos(e.z), sz = sin(e.z);
  mat3 rx = mat3(1.0, 0.0, 0.0,   0.0, cx, sx,   0.0, -sx, cx);
  mat3 ry = mat3(cy, 0.0, -sy,    0.0, 1.0, 0.0,  sy, 0.0, cy);
  mat3 rz = mat3(cz, sz, 0.0,    -sz, cz, 0.0,    0.0, 0.0, 1.0);
  return rz * ry * rx;
}

/*
 * Distance from a surface point to the seam, as a chord length.
 *
 * Chord rather than arc on purpose: 2·sin(θ/2) differs from θ by under one
 * part in ten thousand at the width of this seam, and it costs no acos.
 *
 * Because this is a true distance, the seam needs no gradient correction and
 * no pole guard — both of which the old implicit field required, and the
 * pole guard existed only to paper over an atan(0,0) NaN.
 */
#define SEAM_HALF_WIDTH 0.060
/* Feather width in buffer pixels. >1 because the buffer is supersampled and
   then downscaled, so one buffer pixel is less than one screen pixel. */
#define AA_PIXELS 1.3

float seamDistance(vec3 o) {
  float best = 1e9;
  for (int i = 0; i < ${SEAM_SEGMENTS}; i++) {
    vec3 p = uSeamPts[i];
    vec3 e = uSeamPts[i + 1] - p;
    float h = clamp(dot(o - p, e) / max(dot(e, e), 1e-9), 0.0, 1.0);
    best = min(best, length(o - p - e * h));
  }
  return best;
}

vec3 felt(vec3 n, vec3 o, float arcPerPixel) {
  /*
   * The feather has a FLOOR proportional to the stroke, not just a one-pixel
   * antialiasing margin. A seam is a groove between two pieces of felt and
   * its edge is fibres, not ink; a hard-edged maximum-contrast line on a
   * tight curve reads as ragged however correct the coverage is.
   */
  float feather = max(arcPerPixel * AA_PIXELS, SEAM_HALF_WIDTH * 0.42);
  float seam = 1.0 - smoothstep(
    SEAM_HALF_WIDTH - feather,
    SEAM_HALF_WIDTH + feather,
    seamDistance(o));

  /* Wrapped diffuse rather than plain Lambert. Felt scatters, so a hard
     terminator reads as polished plastic. */
  vec3 key = normalize(vec3(-0.35, 0.62, 0.70));
  float wrapped = clamp((dot(n, key) + 0.40) / 1.40, 0.0, 1.0);
  vec3 color = uFelt * (0.46 + 0.54 * wrapped);

  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0);
  /* One octave. noise3 costs eight sin calls and a second octave was detail
     the downscale averages away. */
  float nap = noise3(o * 52.0);
  color += (nap - 0.5) * (0.075 + 0.26 * rim);
  /* Fibres catch the light at the edge, so the silhouette lifts rather than
     ending on a hard circle. */
  color += rim * 0.06;

  return mix(color, uSeamColor, seam);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  vec3 ro = vec3(0.0, 0.0, uCamZ);
  vec3 rd = normalize(vec3(ndc.x * uTanHalfFov * aspect, ndc.y * uTanHalfFov, -1.0));

  float bestT = 1e9;
  float coverage = 0.0;
  vec3 bestCenter = vec3(0.0);
  vec3 bestRot = vec3(0.0);

  for (int i = 0; i < ${BALL_COUNT}; i++) {
    vec3 toCenter = uCenters[i] - ro;
    float along = dot(toCenter, rd);
    if (along <= 0.0) continue;

    float perp2 = dot(toCenter, toCenter) - along * along;
    float perp = sqrt(max(perp2, 0.0));

    /* One pixel in world units at this depth. Feathering coverage across
       exactly that width is what makes the outline smooth — no MSAA, no
       supersampling, and correct at any device pixel ratio. */
    float px = AA_PIXELS * 2.0 * uTanHalfFov * along / max(uResolution.y, 1.0);
    float cover = 1.0 - smoothstep(uRadius - px, uRadius + px, perp);
    if (cover <= 0.0) continue;

    /* Deliberately not called "half" — that is a reserved keyword in GLSL ES
       1.00, so the shader fails to compile. ogl reports that through
       console.warn and then returns early from the Program constructor, which
       leaves uniformLocations undefined; the first visible symptom is a
       TypeError once per frame, nowhere near the actual cause. */
    float halfChord = sqrt(max(uRadius * uRadius - perp2, 0.0));
    float t = along - halfChord;
    if (t >= bestT) continue;

    bestT = t;
    coverage = cover;
    bestCenter = uCenters[i];
    bestRot = uRot[i];
  }

  if (coverage <= 0.0) discard;

  vec3 hit = ro + rd * bestT;
  vec3 n = normalize(hit - bestCenter);
  /* n * R is transpose(R) * n — the inverse of a rotation. GLSL ES 1.00 has
     no transpose(), and this needs no temporary. */
  vec3 o = n * rotation(bestRot);

  /*
   * How much surface a single pixel covers at this point. Straight on it is
   * just the projected pixel size; at grazing angles the surface is raked
   * away from the viewer and one pixel spans far more of it, which is where
   * a fixed-width seam falls apart. The clamp caps the blur near the
   * silhouette instead of letting it divide by nearly zero.
   */
  float pixelWorld = 2.0 * uTanHalfFov * bestT / max(uResolution.y, 1.0);
  float arcPerPixel = pixelWorld / max(abs(dot(n, rd)), 0.08);

  gl_FragColor = vec4(felt(n, o, arcPerPixel), coverage);
}
`;

export function BallScene(): React.ReactElement | null {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [tier, setTier] = useState<MotionTier | null>(null);

  // Read the tier after mount: it depends on APIs that do not exist during
  // SSR, and guessing would mean a flash of the wrong treatment.
  useEffect(() => {
    setTier(readMotionTier());
  }, []);

  useEffect(() => {
    if (tier !== 'full') return;
    const host = hostRef.current;
    if (host === null) return;

    let disposed = false;
    let cleanup = (): void => {};

    void (async () => {
      // Dynamic import: the WebGL library is only fetched at the full tier.
      const { Renderer, Program, Mesh, Triangle } = await import('ogl');
      if (disposed) return;

      const renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: false,
        // The silhouette is antialiased analytically in the shader, so MSAA
        // would only cost fill rate for an edge that is already smooth.
        antialias: false,
        dpr: Math.min(window.devicePixelRatio, 2),
      });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.canvas.classList.add(styles.canvas as string);
      host.appendChild(gl.canvas);

      // Dolly, not scale: framing is the one thing about this scene that
      // depends on layout. Wide screens give the cluster its own column, so
      // the camera comes in and the balls carry weight. Narrow screens put it
      // behind the headline, where the same framing would be a wall of felt —
      // so the camera pulls back and it becomes texture instead.
      //
      // 900px is the same breakpoint ball-scene.module.css switches on, and
      // it keys off the VIEWPORT, not the host box: the host is full-bleed on
      // phones and a half-width column on desktop, so its own width crosses
      // 900 in the opposite direction and would invert the framing.
      const cameraZ = (): number => (window.innerWidth < 900 ? 12 : 7.4);

      /*
       * Plain arrays, NOT Float32Array. ogl decides whether a uniform is an
       * array by calling Array.isArray on its value, which is false for
       * typed arrays — so a Float32Array here is silently skipped with
       * "Active uniform uCenters[0] has not been supplied" and the balls
       * render at the origin.
       */
      const centers: number[] = new Array<number>(BALL_COUNT * 3).fill(0);
      const rotations: number[] = new Array<number>(BALL_COUNT * 3).fill(0);

      const program = new Program(gl, {
        vertex: VERTEX,
        fragment: FRAGMENT,
        /*
         * NO BLENDING. The scene is a single pass over a transparent clear,
         * so the fragment's alpha IS the coverage and can go straight into
         * the canvas.
         *
         * With transparent:true ogl enables SRC_ALPHA/ONE_MINUS_SRC_ALPHA,
         * which makes a half-covered edge pixel write RGB*0.5 — premultiplied
         * — while the context is declared premultipliedAlpha:false, so the
         * compositor multiplies by alpha a SECOND time. Every antialiased
         * edge then composites too dark, and a dark fringe around a white
         * ball on a green band reads as a jagged outline.
         */
        transparent: false,
        uniforms: {
          uResolution: { value: [1, 1] },
          uCamZ: { value: cameraZ() },
          uTanHalfFov: { value: Math.tan((32 * Math.PI) / 180 / 2) },
          uRadius: { value: 1 },
          uCenters: { value: centers },
          uRot: { value: rotations },
          /*
           * White felt, dark seam — the Open Tennis mark exactly, which is
           * white balls with the green showing through the seam.
           *
           * The previous pairing was olive felt on an olive band: almost no
           * contrast, so what you saw was a vague shape with a white squiggle
           * rather than a ball. This also sidesteps the optic-yellow rule in
           * the design system, where that colour means "live right now" and
           * must never be decorative.
           */
          uFelt: { value: [0.957, 0.957, 0.933] }, // #f4f4ee
          uSeamColor: { value: [0.231, 0.29, 0.129] }, // --clay-700
          uSeamPts: { value: seamPolyline() },
        },
      });

      const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

      /*
       * SUPERSAMPLING.
       *
       * MSAA is useless here: it antialiases geometry edges, and this scene
       * is one triangle covering the whole canvas, so every ball edge is
       * interior to it. The only hardware lever left is to render the buffer
       * larger than it is displayed and let the browser downscale it, which
       * is plain SSAA.
       *
       * The analytic coverage already handles edges on its own; this is belt
       * and braces, and it costs fill rate, so the factor is capped and the
       * total buffer is kept under a pixel budget. On a 2x display a 640x207
       * hero lands around 1.9M pixels rather than 530K.
       */
      // Lower than before: the seam is now a true distance field, which
      // antialiases far better than the old implicit field, and the shader
      // got heavier (96 segment tests per pixel) so the fill rate has to
      // come back down.
      const PIXEL_BUDGET = 1_900_000;
      const MAX_SUPERSAMPLE = 1.4;

      const resize = (): void => {
        const rect = host.getBoundingClientRect();
        const base = Math.min(window.devicePixelRatio || 1, 2);
        const area = Math.max(rect.width * rect.height * base * base, 1);
        renderer.dpr =
          base * Math.min(MAX_SUPERSAMPLE, Math.max(1, Math.sqrt(PIXEL_BUDGET / area)));
        renderer.setSize(rect.width, rect.height);
        const res = program.uniforms['uResolution']!.value as number[];
        res[0] = gl.drawingBufferWidth;
        res[1] = gl.drawingBufferHeight;
        program.uniforms['uCamZ']!.value = cameraZ();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(host);

      // Pointer parallax, eased. Raw pointer values make a scene twitch.
      let pointerX = 0;
      let pointerY = 0;
      let easedX = 0;
      let easedY = 0;
      const onPointer = (e: PointerEvent): void => {
        pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
        pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('pointermove', onPointer, { passive: true });

      // Only run while actually visible. Off-screen or on a background tab
      // the loop stops rather than burning GPU behind the draws.
      let visible = true;
      const io = new IntersectionObserver(
        ([entry]) => {
          visible = entry?.isIntersecting ?? false;
          if (visible) tick(performance.now());
        },
        { threshold: 0.01 },
      );
      io.observe(host);
      const onVisibility = (): void => {
        visible = document.visibilityState === 'visible';
        if (visible) tick(performance.now());
      };
      document.addEventListener('visibilitychange', onVisibility);

      let frame = 0;
      let last = performance.now();
      const start = last;

      function tick(now: number): void {
        if (disposed || !visible) return;
        frame = requestAnimationFrame(tick);

        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const t = (now - start) / 1000;

        easedX += (pointerX - easedX) * Math.min(dt * 3, 1);
        easedY += (pointerY - easedY) * Math.min(dt * 3, 1);

        // The cluster turns with the pointer, the way a parent Transform
        // used to. Same angles as the mesh version: +/-16 degrees of yaw.
        const yaw = easedX * 0.28;
        const pitch = easedY * 0.18;

        for (let i = 0; i < BALL_COUNT; i++) {
          const base = BASES[i]!;
          const spin = SPINS[i]!;
          const [x, y, z] = orbit(base, yaw, pitch);

          centers[i * 3] = x;
          // A slow bob, out of phase per ball, so the group never looks rigid.
          centers[i * 3 + 1] = y + Math.sin(t * 0.7 + base[0]) * 0.07;
          centers[i * 3 + 2] = z;

          // Self-spin derived from elapsed time rather than accumulated per
          // frame: no drift, identical motion whatever the frame rate. The
          // parallax angles are added here too, so each ball's seam swings
          // with the group instead of the group sliding past static balls.
          rotations[i * 3] = t * spin * 0.35 + pitch;
          rotations[i * 3 + 1] = t * spin + yaw;
        }

        renderer.render({ scene: mesh });
      }
      tick(last);

      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        io.disconnect();
        window.removeEventListener('pointermove', onPointer);
        document.removeEventListener('visibilitychange', onVisibility);
        gl.canvas.remove();
        // Drop the GL context explicitly: browsers cap how many may exist,
        // and client navigation would otherwise leak one per visit.
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [tier]);

  if (tier === null || tier === 'off') return null;

  return (
    <div
      ref={hostRef}
      className={styles.host}
      data-tier={tier}
      aria-hidden="true" /* decorative: it carries no information */
    />
  );
}
