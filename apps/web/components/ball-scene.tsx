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
const SPINS: readonly number[] = [0.22, -0.17, 0.19];

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
uniform vec3 uSeam;

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
 * THE SEAM. A tennis ball's cover is two congruent dumbbell-shaped pieces,
 * so the boundary between them is ONE closed curve that rises and falls
 * twice as it wraps the ball:
 *
 *     polar angle = 90° + A·sin(2 · azimuth)
 *
 * An earlier version drew that curve AND its mirror image. Two curves cross
 * four times, which produces an X across the face — a beach ball, not a
 * tennis ball. That single extra line was most of why these did not read.
 */
#define SEAM_AMPLITUDE 0.62
#define SEAM_HALF_WIDTH 0.052

vec3 felt(vec3 n, vec3 o, float arcPerPixel) {
  float phi = atan(o.z, o.x);
  float seamField = o.y + sin(SEAM_AMPLITUDE * sin(2.0 * phi));

  /*
   * seamField is an implicit function, not a distance, and its gradient
   * varies by better than 2x across the curve. Feathering it with a fixed
   * smoothstep — which is what the first version did — makes the edge
   * sub-pixel wherever the gradient is steep or the surface is near grazing,
   * and that is exactly what jagged seams are.
   *
   * Dividing by the analytic gradient converts the field into an ARC
   * distance along the ball's surface. The seam is then a constant-width
   * stroke, and it can be feathered by one pixel's worth of arc the same way
   * the silhouette is.
   */
  float sinT = max(length(o.xz), 1e-3);
  float dTheta = -sinT;
  float dPhi = 2.0 * SEAM_AMPLITUDE * cos(2.0 * phi)
             * cos(SEAM_AMPLITUDE * sin(2.0 * phi));
  float gradient = sqrt(dTheta * dTheta + (dPhi / sinT) * (dPhi / sinT));

  float arcToSeam = abs(seamField) / max(gradient, 1e-3);
  float seam = 1.0 - smoothstep(
    SEAM_HALF_WIDTH - arcPerPixel,
    SEAM_HALF_WIDTH + arcPerPixel,
    arcToSeam);

  /* Wrapped diffuse rather than plain Lambert. Felt scatters, so a hard
     terminator reads as polished plastic. */
  vec3 key = normalize(vec3(-0.35, 0.62, 0.70));
  float wrapped = clamp((dot(n, key) + 0.40) / 1.40, 0.0, 1.0);
  vec3 color = uFelt * (0.46 + 0.54 * wrapped);

  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0);
  /* Two octaves. One fine octave alone sat below the antialiasing floor at
     this size and averaged out to flat white, which is why these read as
     ping-pong balls rather than felt. */
  float nap = noise3(o * 46.0) * 0.62 + noise3(o * 115.0) * 0.38;
  color += (nap - 0.5) * (0.055 + 0.22 * rim);
  /* Fibres catch the light at the edge, so the silhouette lifts rather than
     ending on a hard circle. */
  color += rim * 0.06;

  return mix(color, uSeam, seam);
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
    float px = 2.0 * uTanHalfFov * along / max(uResolution.y, 1.0);
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
        transparent: true,
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
          uSeam: { value: [0.231, 0.29, 0.129] }, // --clay-700
        },
      });

      const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

      const resize = (): void => {
        const rect = host.getBoundingClientRect();
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

        for (let i = 0; i < BALL_COUNT; i++) {
          const base = BASES[i]!;
          const spin = SPINS[i]!;

          // Parallax moves the cluster, not the camera: shifting the camera
          // would also change the perspective of the balls against a
          // background that has none, which reads as a wobble.
          centers[i * 3] = base[0] + easedX * 0.22;
          // A slow bob, out of phase per ball, so the group never looks rigid.
          centers[i * 3 + 1] =
            base[1] + Math.sin(t * 0.7 + base[0]) * 0.07 - easedY * 0.14;
          centers[i * 3 + 2] = base[2];

          // Derived from elapsed time rather than accumulated per frame: no
          // drift, and identical motion whatever the frame rate.
          rotations[i * 3] = t * spin * 0.35;
          rotations[i * 3 + 1] = t * spin;
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
