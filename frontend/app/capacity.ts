// The Pis that take apps, measured in small-tier apps (512MB, 0.5 CPU, docs/architecture.md).
// Pi #5 is a builder (NoSchedule), so four Pis take apps. Each has 4 cores, so CPU
// caps it at eight small apps, though its 8GB would hold sixteen.

export const PIS = 4;
export const SLOTS = 8;

export type Spot = { pi: number; slot: number };
export type Placement = Spot & { app: string };

const count = (ps: Placement[], pi: number) => ps.reduce((n, p) => n + (p.pi === pi ? 1 : 0), 0);

export const ownerAt = (ps: Placement[], pi: number, slot: number) => ps.find(p => p.pi === pi && p.slot === slot);

/** The least busy Pi with room, and its first free slot. Null when the cluster is full. */
export function place(ps: Placement[]): Spot | null {
  const order = Array.from({ length: PIS }, (_, pi) => pi).sort((a, b) => count(ps, a) - count(ps, b) || a - b);
  for (const pi of order) {
    if (count(ps, pi) >= SLOTS) continue;
    for (let slot = 0; slot < SLOTS; slot++) if (!ownerAt(ps, pi, slot)) return { pi, slot };
  }
  return null;
}
