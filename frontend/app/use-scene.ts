"use client";

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

// One switch for every animated scene on the page. The hero's button flips it.
let paused = false;
const listeners = new Set<() => void>();
export const motion = {
  paused: () => paused,
  toggle() {
    paused = !paused;
    listeners.forEach(fn => fn());
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
export const useMotionPaused = () => useSyncExternalStore(motion.subscribe, motion.paused, () => false);

export type Frame = {
  w: number;
  h: number;
  /** Seconds of animation time. Holds still while motion is paused or reduced. */
  t: number;
  /** 0 to 1 as the scroll target enters the viewport (1 with reduced motion). */
  enter: number;
  /** True while nothing should move: reduced motion or the pause button. */
  still: boolean;
  /** Device pixels per CSS pixel. */
  density: number;
};

export type SceneSpec<S> = {
  animated?: boolean;
  /** Track scroll progress into `Frame.enter`. */
  scroll?: boolean;
  /** How much of the target's height it takes to reach `enter = 1`. */
  span?: number;
  scrollTarget?: (canvas: HTMLCanvasElement) => Element | null;
  /** Time used for the still frame. */
  stillTime?: number;
  /** Runs after every resize; return whatever the draw needs. */
  setup: (canvas: HTMLCanvasElement, frame: Frame) => S;
  draw: (ctx: CanvasRenderingContext2D, frame: Frame, state: S) => void;
};

export type SceneHandle = { redraw: () => void; resetup: () => void; time: () => number };

const FRAME_MS = 1000 / 30;

export function enterProgress(el: Element, span = 0.75) {
  const r = el.getBoundingClientRect(), vh = window.innerHeight;
  return Math.max(0, Math.min(1, (vh - r.top) / (Math.min(r.height, vh) * span + vh * 0.15)));
}

/** Pre-render a static layer at device resolution. */
export function makeLayer(frame: Frame, paint: (ctx: CanvasRenderingContext2D) => void) {
  const layer = document.createElement("canvas");
  layer.width = Math.round(frame.w * frame.density);
  layer.height = Math.round(frame.h * frame.density);
  const ctx = layer.getContext("2d")!;
  ctx.setTransform(frame.density, 0, 0, frame.density, 0, 0);
  paint(ctx);
  return layer;
}

/** Drives a halftone canvas: resizing, visibility, 30fps animation, scroll progress, reduced motion. */
export function useScene<S>(ref: RefObject<HTMLCanvasElement | null>, spec: SceneSpec<S>): RefObject<SceneHandle> {
  const specRef = useRef(spec);
  specRef.current = spec;
  const handle = useRef<SceneHandle>({ redraw() {}, resetup() {}, time: () => 0 });

  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frame: Frame = { w: 0, h: 0, t: specRef.current.stillTime ?? 3, enter: 0, still: false, density: 1 };
    let state: S | undefined, ready = false;
    let visible = false, raf = 0, previous = performance.now(), lastDraw = 0;

    const isStill = () => reduce.matches || motion.paused();
    function render() {
      if (!ready || !frame.w || !ctx) return;
      frame.still = isStill();
      ctx.setTransform(frame.density, 0, 0, frame.density, 0, 0);
      ctx.clearRect(0, 0, frame.w, frame.h);
      specRef.current.draw(ctx, frame, state as S);
      canvas!.dataset.rendered = "true";
    }
    function resize() {
      const w = canvas!.clientWidth, h = canvas!.clientHeight;
      if (!w || !h) return;
      frame.density = Math.min(window.devicePixelRatio || 1, 2);
      frame.w = w; frame.h = h;
      canvas!.width = Math.round(w * frame.density);
      canvas!.height = Math.round(h * frame.density);
      frame.still = isStill();
      state = specRef.current.setup(canvas!, frame);
      ready = true;
      updateEnter();
      render();
    }
    function updateEnter() {
      const s = specRef.current;
      if (!s.scroll) return false;
      const target = s.scrollTarget?.(canvas!) ?? canvas!;
      const e = reduce.matches ? 1 : enterProgress(target, s.span);
      if (Math.abs(e - frame.enter) < 0.001) return false;
      frame.enter = e;
      return true;
    }
    function tick(now: number) {
      raf = 0;
      const dt = Math.min(now - previous, 64) / 1000;
      previous = now;
      let dirty = updateEnter();
      const moving = specRef.current.animated && !isStill();
      if (moving) { frame.t += dt; if (now - lastDraw >= FRAME_MS) dirty = true; }
      if (dirty) { render(); lastDraw = now; }
      if (visible && (moving || specRef.current.scroll)) raf = requestAnimationFrame(tick);
    }
    function sync() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (visible && !document.hidden) { previous = performance.now(); raf = requestAnimationFrame(tick); }
      render();
    }

    handle.current = { redraw: render, resetup: resize, time: () => frame.t };
    const resizeObserver = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { rootMargin: "120px" });
    resizeObserver.observe(canvas);
    intersection.observe(canvas);
    reduce.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    const unsubscribe = motion.subscribe(sync);
    document.fonts?.ready.then(resize);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      reduce.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      unsubscribe();
    };
  }, [ref]);

  return handle;
}
