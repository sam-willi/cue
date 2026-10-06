"use client";

import { useEffect, useRef, useState } from "react";
import { CONFIRMS, PATTERNS, type ConfirmPattern, type CuePattern } from "@/lib/cue/patterns";

/**
 * The behind-the-ear (BTE) device, from its CAD (hardware/rev0/democad.step on the hardware-rev0 branch → public/cad/cue-bte.glb via
 * scripts/cad-to-glb.mjs),
 * with each haptic drawn where it really happens: rings leave the LRA motor's skin-side face in
 * the cue's rhythm (one, two, or one long), and the motor glows while it's driven. Confirmations
 * from the touch controls are a neutral swell with no rings, so they never read as a cue
 * (DESIGN.md §11: a breath, not an alarm; no shaking).
 */

type Buzz = { n: number; label: string; pattern: CuePattern } | null;
type Confirm = { n: number; pattern: ConfirmPattern } | null;
type Noticed = { n: number; label: string } | null;

/** One visual pulse: a ring and/or glow, timed on performance.now() (ms). */
interface Pulse {
  at: number;
  /** How long the motor is on, ms (drives the glow). */
  on: number;
  ring: boolean;
  /** Ring life, ms, and how far it travels (× motor radius). */
  life: number;
  reach: number;
  width: number;
  tone: "cue" | "neutral";
  strength: number;
}

const MODEL_URL = "/cad/cue-bte.glb";

/** A vibrate array ([on, off, on, …] ms) as the start and length of each on-segment. */
function segments(vibrate: number[]) {
  const out: { at: number; on: number }[] = [];
  let t = 0;
  vibrate.forEach((ms, i) => {
    if (i % 2 === 0) out.push({ at: t, on: ms });
    t += ms;
  });
  return out;
}

function pulsesFor(
  now: number,
  buzz: Buzz,
  confirm: Confirm,
  noticed: Noticed,
  which: "buzz" | "confirm" | "noticed",
): Pulse[] {
  if (which === "buzz" && buzz) {
    // One ring per pulse; a sustained pulse (the hum, the long push) sends a slower, wider one.
    return segments(PATTERNS[buzz.pattern].vibrate).map<Pulse>((s) => {
      const long = s.on >= 200;
      return {
        at: now + s.at,
        on: s.on,
        ring: true,
        life: long ? 1300 : 700,
        reach: long ? 4.6 : 3.6,
        width: long ? 0.22 : 0.14,
        tone: "cue",
        strength: 1,
      };
    });
  }
  if (which === "confirm" && confirm) {
    // Ramps: the glow follows the swelling (or fading) on-times; no rings.
    const segs = segments(CONFIRMS[confirm.pattern].vibrate);
    const peak = Math.max(...segs.map((s) => s.on));
    return segs.map<Pulse>((s) => ({
      at: now + s.at,
      on: Math.max(s.on, 40),
      ring: false,
      life: 0,
      reach: 0,
      width: 0,
      tone: "neutral",
      strength: 0.35 + 0.65 * (s.on / peak),
    }));
  }
  if (which === "noticed" && noticed) {
    return [{ at: now, on: 0, ring: true, life: 900, reach: 2.4, width: 0.1, tone: "neutral", strength: 0.45 }];
  }
  return [];
}

export default function DeviceModel({
  buzz,
  confirm,
  noticed,
  className = "",
}: {
  buzz: Buzz;
  confirm: Confirm;
  noticed: Noticed;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pulses = useRef<Pulse[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  // Queue pulses when a new cue, confirmation, or noticed filler arrives.
  useEffect(() => {
    if (buzz) pulses.current.push(...pulsesFor(performance.now(), buzz, null, null, "buzz"));
  }, [buzz?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (confirm) pulses.current.push(...pulsesFor(performance.now(), null, confirm, null, "confirm"));
  }, [confirm?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (noticed) pulses.current.push(...pulsesFor(performance.now(), null, null, noticed, "noticed"));
  }, [noticed?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
      if (disposed) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        setState("unavailable");
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.domElement.style.touchAction = "pan-y";
      renderer.domElement.setAttribute("aria-hidden", "true");
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.9;
      const key = new THREE.DirectionalLight(0xfff4e6, 1.6); // warm studio key (DESIGN.md §15)
      key.position.set(40, 60, 80);
      scene.add(key, new THREE.HemisphereLight(0xffffff, 0xd8d2c8, 0.6));

      const camera = new THREE.PerspectiveCamera(30, 1, 1, 1000);

      let gltf: Awaited<ReturnType<InstanceType<typeof GLTFLoader>["loadAsync"]>>;
      try {
        gltf = await new GLTFLoader().loadAsync(MODEL_URL);
      } catch {
        renderer.dispose();
        renderer.domElement.remove();
        if (!disposed) setState("unavailable");
        return;
      }
      if (disposed) return;

      // CAD is in mm. Center it, then tilt so the skin side (where the motor fires) is in view.
      const model = gltf.scene;
      const motorInfo = (gltf.scene.userData?.motor ?? gltf.parser.json.scenes?.[0]?.extras?.motor) as
        { center: number[]; normal: number[]; diameter: number } | undefined;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      model.position.sub(center);

      const pivot = new THREE.Group(); // user + idle rotation
      const pose = new THREE.Group(); // fixed presentation angle
      pose.add(model);
      pivot.add(pose);
      scene.add(pivot);
      pose.rotation.set(0.2, Math.PI * 0.78, 0.18);

      // Haptics live in the model's frame, on the motor's skin-side face.
      // (CAD coordinates: the group is a child of the model.)
      const motorNormal = new THREE.Vector3(...(motorInfo?.normal ?? [0, 0, -1]));
      const motorRadius = (motorInfo?.diameter ?? 8) / 2;
      const haptics = new THREE.Group();
      haptics.position.set(...((motorInfo?.center ?? [center.x, center.y, box.min.z]) as [number, number, number]));
      haptics.position.addScaledVector(motorNormal, 0.05);
      haptics.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), motorNormal);
      model.add(haptics);

      const css = getComputedStyle(document.documentElement);
      const colors = {
        cue: new THREE.Color(css.getPropertyValue("--cue").trim() || "#2437d8"),
        neutral: new THREE.Color(css.getPropertyValue("--neutral").trim() || "#5f5b56"),
      };

      const glowMat = new THREE.MeshBasicMaterial({
        color: colors.cue,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      });
      const glow = new THREE.Mesh(new THREE.CircleGeometry(motorRadius * 0.9, 48), glowMat);
      glow.renderOrder = 10;
      haptics.add(glow);

      // Unit rings, scaled as they travel: a thin one for taps, a broader one for the long pulse.
      const ringShapes = { thin: new THREE.RingGeometry(0.9, 1, 96), broad: new THREE.RingGeometry(0.84, 1, 96) };
      const ringPool: import("three").Mesh<import("three").RingGeometry, import("three").MeshBasicMaterial>[] = [];
      const ringFor = (k: number) => {
        while (ringPool.length <= k) {
          const m = new THREE.Mesh(
            ringShapes.thin,
            new THREE.MeshBasicMaterial({
              color: colors.cue,
              transparent: true,
              opacity: 0,
              depthTest: false,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          );
          m.renderOrder = 11;
          haptics.add(m);
          ringPool.push(m);
        }
        return ringPool[k];
      };

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

      // Drag to turn; it eases back to a slow idle sway.
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let userYaw = 0;
      let userPitch = 0;
      const el = renderer.domElement;
      const onDown = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        el.setPointerCapture(e.pointerId);
        el.style.cursor = "grabbing";
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        userYaw += (e.clientX - lastX) * 0.01;
        userPitch = Math.max(-1, Math.min(1, userPitch + (e.clientY - lastY) * 0.01));
        lastX = e.clientX;
        lastY = e.clientY;
      };
      const onUp = () => {
        dragging = false;
        el.style.cursor = "grab";
      };
      el.style.cursor = "grab";
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);

      const resize = () => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;
        // Fit the model's diagonal with a little air, in either orientation.
        const fov = THREE.MathUtils.degToRad(camera.fov);
        const fitH = (size * 0.5) / Math.tan(fov / 2);
        const fitW = fitH / Math.min(1, camera.aspect);
        camera.position.set(0, 0, Math.max(fitH, fitW));
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(mount);
      resize();

      const scheme = window.matchMedia("(prefers-color-scheme: dark)");
      const recolor = () => {
        const s = getComputedStyle(document.documentElement);
        colors.cue.set(s.getPropertyValue("--cue").trim() || "#2437d8");
        colors.neutral.set(s.getPropertyValue("--neutral").trim() || "#5f5b56");
      };
      scheme.addEventListener("change", recolor);

      const start = performance.now();
      let raf = 0;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const still = reduceMotion.matches;
        if (!dragging) {
          userYaw *= 0.94;
          userPitch *= 0.94;
        }
        const sway = still ? 0 : Math.sin((now - start) / 4200) * 0.35;
        pivot.rotation.set(userPitch, sway + userYaw, 0);

        // Haptics: glow while the motor is on; rings travel outward and fade.
        pulses.current = pulses.current.filter((p) => now < p.at + Math.max(p.on + 250, p.life));
        let glowLevel = 0;
        let glowTone: "cue" | "neutral" = "cue";
        let k = 0;
        for (const p of pulses.current) {
          const t = now - p.at;
          if (t < 0) continue;
          // Glow: quick attack, held while on, soft release.
          const g = t < p.on ? Math.min(1, t / 30) : Math.max(0, 1 - (t - p.on) / 250);
          if (g * p.strength > glowLevel) {
            glowLevel = g * p.strength;
            glowTone = p.tone;
          }
          if (!p.ring || t > p.life) continue;
          const ring = ringFor(k++);
          const u = t / p.life;
          const ease = 1 - Math.pow(1 - u, 3);
          const r = still ? motorRadius * 1.6 : motorRadius * (1 + (p.reach - 1) * ease);
          ring.scale.setScalar(r);
          ring.geometry = p.width > 0.15 ? ringShapes.broad : ringShapes.thin;
          ring.material.color.copy(colors[p.tone]);
          ring.material.opacity = p.strength * 0.85 * (1 - u);
        }
        for (; k < ringPool.length; k++) ringPool[k].material.opacity = 0;
        glowMat.color.copy(colors[glowTone]);
        glowMat.opacity = glowLevel * 0.75;

        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);
      setState("ready");

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        scheme.removeEventListener("change", recolor);
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
        ringShapes.thin.dispose();
        ringShapes.broad.dispose();
        scene.traverse((o) => {
          const m = o as import("three").Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          mats.forEach((x) => x.dispose());
        });
        scene.environment?.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div ref={mountRef} className="absolute inset-0" />
      {state === "loading" && (
        <p className="absolute inset-0 grid place-items-center text-body-sm text-muted">Loading the device…</p>
      )}
      {state === "unavailable" && (
        <p className="absolute inset-0 grid place-items-center px-6 text-center text-body-sm text-muted">
          The 3D device can’t be shown in this browser.
        </p>
      )}
    </div>
  );
}
