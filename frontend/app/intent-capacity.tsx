"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { PIS, SLOTS, ownerAt, place, type Placement } from "./capacity";
import { useMotionPaused } from "./use-scene";

type Stage = "schedule" | "provision" | "work";
type Run = { ps: Placement[]; current: Placement; stage: Stage; byVisitor: boolean };

// Sample apps for the demo loop.
const APPS = ["portfolio", "blog-api", "notes", "cache", "link-shortener", "guestbook", "photo-store", "status-page"];
const SEED = 5;
// How long each stage holds, in ms. The app travels its arrow during "schedule".
const HOLD: Record<Stage, number> = { schedule: 1700, provision: 1100, work: 2600 };
const NEXT: Record<Stage, Stage | null> = { schedule: "provision", provision: "work", work: null };
const STEPS: [Stage, string][] = [
  ["schedule", "It hits the scheduler."],
  ["provision", "It gets its own slot on a Pi."],
  ["work", "It gets to work."],
];
// Arrows bend this far above a Pi and stop this far short of it.
const BEND = 26;
const ARROW_GAP = 6;
const host = (p: Placement) => `pi-${p.pi + 1}`;

/** The scheduler places the app; a full cluster starts over so the demo keeps running. */
function deploy(ps: Placement[], app: string): { ps: Placement[]; current: Placement } {
  const spot = place(ps);
  const base = spot ? ps : [];
  const current = { app, ...(spot ?? place([])!) };
  return { ps: [...base, current], current };
}

function seed(): Run {
  let ps: Placement[] = [], current!: Placement;
  for (const app of APPS.slice(0, SEED)) ({ ps, current } = deploy(ps, app));
  return { ps, current, stage: "work", byVisitor: false };
}

/** One arrow per Pi: down the centre gutter from the scheduler, across, and into the Pi's top edge. */
function useRoutes(body: RefObject<HTMLDivElement | null>) {
  const [routes, setRoutes] = useState<string[]>([]);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const from = el.querySelector(".scheduler")!.getBoundingClientRect();
      const x0 = from.left + from.width / 2 - box.left, y0 = from.bottom - box.top;
      setRoutes(Array.from(el.querySelectorAll(".capacity-pi"), pi => {
        const r = pi.getBoundingClientRect(), x = r.left + r.width / 2 - box.left, top = r.top - box.top;
        return `M${x0} ${y0} V${top - BEND} H${x} V${top - ARROW_GAP}`;
      }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [body]);
  return routes;
}

/** Small by intention: an app hits the scheduler, gets its own slot on a Pi, and gets to work. */
export default function IntentCapacity() {
  const [run, setRun] = useState(seed);
  const [visible, setVisible] = useState(false);
  const [reduce, setReduce] = useState(false);
  const paused = useMotionPaused();
  const body = useRef<HTMLDivElement>(null);
  const next = useRef(SEED);
  const routes = useRoutes(body);
  const marker = useId().replace(/:/g, "");
  const still = paused || reduce;
  const { ps, current, stage } = run;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(query.matches);
    sync();
    query.addEventListener("change", sync);
    const el = body.current;
    if (!el) return () => query.removeEventListener("change", sync);
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => { io.disconnect(); query.removeEventListener("change", sync); };
  }, []);

  // Step through the stages; after "work", the loop deploys the next sample app.
  useEffect(() => {
    if (still || (!visible && !run.byVisitor)) return;
    const timer = window.setTimeout(() => setRun(prev => {
      const stageAfter = NEXT[prev.stage];
      if (stageAfter) return { ...prev, stage: stageAfter };
      return { ...deploy(prev.ps, APPS[next.current++ % APPS.length]), stage: "schedule", byVisitor: false };
    }), HOLD[stage]);
    return () => window.clearTimeout(timer);
  }, [run, stage, still, visible]);

  function deployYours() {
    setRun(prev => ({ ...deploy(prev.ps, "your-app"), stage: still ? "work" : "schedule", byVisitor: true }));
  }

  const chosen = routes[current.pi];
  const status = stage === "schedule" ? "Finding the least busy Pi" : stage === "provision" ? `Sent to ${host(current)}` : `Running on ${host(current)}`;

  return (
    <>
      <div className="provision-panel">
        <ol className="provision-steps">
          {STEPS.map(([id, title]) => <li key={id} aria-current={id === stage ? "step" : undefined}>{title}</li>)}
        </ol>
        <button type="button" className="provision-deploy" onClick={deployYours}>Deploy an app</button>
        <p className="visually-hidden" aria-live="polite">{run.byVisitor && stage === "work" ? `your-app is running on ${host(current)}.` : ""}</p>
      </div>

      <figure className="capacity-figure" data-stage={stage}>
        <div ref={body} className="provision-field" role="img" aria-label={`A scheduler above four Raspberry Pis. ${current.app} is sent to ${host(current)}.`}>
          <div className="scheduler">
            <p className="scheduler-name">Scheduler</p>
            <p className="scheduler-app"><span className="app-chip" />{current.app}</p>
            <p className="scheduler-status">{status}</p>
          </div>

          <svg className="provision-routes" aria-hidden="true">
            <defs>
              {["off", "on"].map(state => (
                <marker key={state} id={`${marker}-${state}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L10 5 L0 10 z" className={`route-head ${state}`} />
                </marker>
              ))}
            </defs>
            {routes.map((d, pi) => pi !== current.pi && <path key={pi} d={d} className="route" markerEnd={`url(#${marker}-off)`} />)}
            {chosen && <path d={chosen} className="route on" markerEnd={`url(#${marker}-on)`} />}
          </svg>
          {chosen && stage === "schedule" && !still && (
            <span key={`${current.app}-${ps.length}`} className="provision-packet" style={{ offsetPath: `path("${chosen}")` }} aria-hidden="true" />
          )}

          <div className="capacity-field">
            {Array.from({ length: PIS }, (_, pi) => (
              <div key={pi} className="capacity-node" data-chosen={pi === current.pi || undefined}>
                <div className="capacity-pi">
                  {Array.from({ length: SLOTS }, (_, slot) => {
                    const owner = ownerAt(ps, pi, slot);
                    const state = !owner ? "off" : owner !== current ? "run" : stage === "schedule" ? "off" : stage;
                    return <span key={slot} data-state={state} />;
                  })}
                </div>
                <p>pi-{pi + 1}</p>
              </div>
            ))}
          </div>
        </div>
        <figcaption>A Scheduler (planned k3s) provisions four Raspberry Pis to take and host apps</figcaption>
      </figure>
    </>
  );
}
