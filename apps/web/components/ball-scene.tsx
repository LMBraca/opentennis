'use client';

/**
 * The hero scene: three tennis balls, the Open Tennis mark in motion.
 *
 * ogl rather than three.js — about 10% of the bundle for what this needs,
 * which is three spheres and one fragment shader. three would be the right
 * call the moment this wants loaded models or real lighting.
 *
 * Tiering, in order:
 *   off  — this component renders nothing and the libraries are never
 *          imported. Reduced motion costs the user no bytes.
 *   lite — a CSS gradient stand-in. No WebGL context on a weak device.
 *   full — the scene below.
 *
 * It also stops when off-screen or on a hidden tab. A hero animation that
 * keeps burning GPU while someone reads the draws below is a battery bug.
 */

import { useEffect, useRef, useState } from 'react';
import { readMotionTier, type MotionTier } from '@/lib/motion/tier';
import styles from './ball-scene.module.css';

/**
 * The felt seam. A tennis ball's seam is two mirrored arcs; approximating it
 * with a sine wave across the sphere's UV is close enough at this size and
 * costs one trig call instead of a texture fetch.
 */
const FRAGMENT = /* glsl */ `
precision highp float;

varying vec3 vNormal;
varying vec2 vUv;

uniform vec3 uFelt;
uniform vec3 uSeam;
uniform float uTime;

void main() {
  // Lambert against a fixed key light. Enough shaping to read as a sphere
  // without the cost of a real light rig.
  vec3 light = normalize(vec3(0.4, 0.8, 0.6));
  float lambert = clamp(dot(normalize(vNormal), light), 0.0, 1.0);
  float shade = 0.55 + 0.45 * lambert;

  // Two mirrored seam curves, the way the felt is actually cut.
  float wave = sin(vUv.x * 6.2831853 * 2.0) * 0.17;
  float a = abs(vUv.y - 0.5 - wave);
  float b = abs(vUv.y - 0.5 + wave);
  float seam = 1.0 - smoothstep(0.012, 0.03, min(a, b));

  // Fuzz: cheap value noise so the felt is not a flat plastic ball.
  float fuzz = fract(sin(dot(vUv * 420.0, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 felt = uFelt * shade + (fuzz - 0.5) * 0.045;

  vec3 color = mix(felt, uSeam, seam * 0.9);

  // Rim light lifts the silhouette off the page.
  float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.5);
  color += rim * 0.12;

  gl_FragColor = vec4(color, 1.0);
}
`;

const VERTEX = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

varying vec3 vNormal;
varying vec2 vUv;

void main() {
  vNormal = normalMatrix * normal;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
      const { Renderer, Camera, Transform, Program, Mesh, Sphere, Vec3 } = await import('ogl');
      if (disposed) return;

      const renderer = new Renderer({
        alpha: true,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio, 2), // 3x on a phone is wasted fill rate
      });
      const gl = renderer.gl;
      gl.canvas.classList.add(styles.canvas as string);
      host.appendChild(gl.canvas);

      // Dolly, not scale: framing is the one thing about this scene that
      // depends on layout. Wide screens give the cluster its own column, so
      // the camera comes in and the balls carry weight. Narrow screens put it
      // behind the headline, where the same framing would be a wall of felt —
      // so the camera pulls back and it becomes texture instead.
      // 900px is the same breakpoint ball-scene.module.css switches on. It
      // keys off the VIEWPORT, not the host box — the host is full-bleed on
      // phones and a half-width column on desktop, so its own width crosses
      // 900 in the opposite direction and would invert the framing.
      const cameraZ = (): number => (window.innerWidth < 900 ? 12 : 7.4);
      const camera = new Camera(gl, { fov: 32 });
      camera.position.set(0, 0, cameraZ());

      const scene = new Transform();
      const geometry = new Sphere(gl, { radius: 1, widthSegments: 48, heightSegments: 32 });

      const program = new Program(gl, {
        vertex: VERTEX,
        fragment: FRAGMENT,
        uniforms: {
          uFelt: { value: new Vec3(0.36, 0.44, 0.21) },  // brand olive #526430
          uSeam: { value: new Vec3(0.97, 0.97, 0.95) },  // the painted line
          uTime: { value: 0 },
        },
      });

      // Three balls, arranged like the mark: one up, two below.
      const balls = [
        { mesh: new Mesh(gl, { geometry, program }), base: [0, 1.15, 0], spin: 0.22 },
        { mesh: new Mesh(gl, { geometry, program }), base: [-1.25, -0.72, 0.3], spin: -0.17 },
        { mesh: new Mesh(gl, { geometry, program }), base: [1.25, -0.72, -0.3], spin: 0.19 },
      ];
      for (const b of balls) {
        b.mesh.position.set(b.base[0] as number, b.base[1] as number, b.base[2] as number);
        b.mesh.setParent(scene);
      }

      const resize = (): void => {
        const rect = host.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height);
        camera.position.z = cameraZ(); // re-framed on rotate, not just on load
        camera.perspective({ aspect: rect.width / Math.max(rect.height, 1) });
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

        scene.rotation.y = easedX * 0.28;
        scene.rotation.x = easedY * 0.18;

        for (const b of balls) {
          b.mesh.rotation.y += b.spin * dt;
          b.mesh.rotation.x += b.spin * 0.35 * dt;
          // A slow bob, out of phase per ball, so the group never looks rigid.
          b.mesh.position.y =
            (b.base[1] as number) + Math.sin(t * 0.7 + (b.base[0] as number)) * 0.07;
        }

        program.uniforms['uTime']!.value = t;
        renderer.render({ scene, camera });
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
      aria-hidden="true"  /* decorative: it carries no information */
    />
  );
}
