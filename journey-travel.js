// Movement for the 3D journey: one controller owns where the guide is along the route.
// Scrolling moves a goal along the route; the guide walks or jogs after it with eased acceleration and braking, and
// settles on a stop once the visitor stops scrolling. The camera, the panel and the progress bar all read from here,
// never from the scroll itself, so nothing can run ahead of the guide.
// The guide's look (the procedural scans today, a rigged character later) only receives position, speed and heading.

export const TRAVEL = {
  MAX_SPEED: 5.2,         // m/s: an easy jog
  ACCEL: 6,               // m/s² when speeding up
  BRAKE: 7,               // m/s² when slowing down
  RESPONSE: 0.9,          // m/s of extra speed per metre the goal is ahead: short scrolls walk, long ones jog
  MIN_SPEED: 0.7,         // m/s floor while closing the last metres, so the guide arrives instead of creeping
  LEAD: 14,               // metres the guide chases ahead of (or behind) itself while the visitor is still scrolling
  SNAP_DELAY: 220,        // ms without input before settling on a stop
  COMMIT: 2.5,            // metres beyond a stop that commit to the next one when settling
  TELEPORT_DISTANCE: 36   // jumps longer than this teleport instead of walking (one stop is ~22-32 m)
};

export function createTravel({ THREE, count, standPoint }) {
  const points = [];
  const dist = [0];
  for (let i = 0; i < count; i++) points.push(standPoint(i, new THREE.Vector3()));
  for (let i = 1; i < count; i++) dist.push(dist[i - 1] + points[i - 1].distanceTo(points[i]));
  const total = dist[count - 1];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // request: where the scrolling asks to be (all input is kept, so fast or reversed scrolling adds up correctly);
  // goal: where the guide is heading right now (the request, held within LEAD of the guide until scrolling stops)
  const state = { s: 0, v: 0, goal: 0, request: 0, target: 0, anchor: 0, lastInput: -Infinity, settled: true, jump: null };

  function nearestStop(at) {
    let best = 0;
    for (let i = 1; i < count; i++) if (Math.abs(dist[i] - at) < Math.abs(dist[best] - at)) best = i;
    return best;
  }
  function segmentAt(at) {
    let i = 0;
    while (i < count - 2 && dist[i + 1] <= at) i++;
    return i;
  }

  return {
    get s() { return state.s; },
    get v() { return state.v; },
    get speed() { return Math.abs(state.v); },
    // The stop the guide is heading for (or resting at)
    get target() { return state.target; },
    get nearest() { return nearestStop(state.s); },
    // Fractional stop index: 3.5 is halfway between stops 3 and 4
    get k() {
      if (count < 2) return 0;
      const i = segmentAt(state.s);
      const seg = dist[i + 1] - dist[i];
      return i + (seg > 0 ? clamp((state.s - dist[i]) / seg, 0, 1) : 0);
    },
    distanceTo(i) { return Math.abs(dist[i] - state.s); },
    position(out) {
      if (count < 2) return out.copy(points[0]);
      const i = segmentAt(state.s);
      const seg = dist[i + 1] - dist[i];
      return out.lerpVectors(points[i], points[i + 1], seg > 0 ? clamp((state.s - dist[i]) / seg, 0, 1) : 0);
    },
    // Facing while moving: along the route, turned around when walking back
    heading() {
      const i = segmentAt(state.s);
      const a = points[i], b = points[Math.min(count - 1, i + 1)];
      const sign = state.v < 0 ? -1 : 1;
      return Math.atan2((b.x - a.x) * sign, (b.z - a.z) * sign);
    },
    // Scroll and swipe input, in metres along the route
    nudge(metres, now) {
      // A new gesture starts from where the guide is headed, so scrolling back by the same amount undoes it
      if (state.settled) { state.anchor = state.target; state.request = state.goal; state.settled = false; }
      state.request = clamp(state.request + metres, 0, total);
      state.goal = clamp(state.request, state.s - TRAVEL.LEAD, state.s + TRAVEL.LEAD);
      state.lastInput = now;
      state.target = nearestStop(state.request);
    },
    // A stop the visitor scrolled too far to walk to: the caller teleports there (returns null when there is none)
    takeJump() {
      const jump = state.jump;
      state.jump = null;
      return jump;
    },
    // Walk to a stop; returns false when it is too far and the caller should teleport instead
    goTo(i) {
      i = clamp(Math.round(i), 0, count - 1);
      state.target = i;
      state.settled = true;
      if (Math.abs(dist[i] - state.s) > TRAVEL.TELEPORT_DISTANCE) { state.goal = state.request = state.s; return false; }
      state.goal = state.request = dist[i];
      return true;
    },
    jumpTo(i) {
      i = clamp(Math.round(i), 0, count - 1);
      state.s = state.goal = state.request = dist[i];
      state.jump = null;
      state.v = 0;
      state.target = i;
      state.settled = true;
    },
    // cap: optional speed limit (m/s), e.g. while the headset goes on
    update(dt, now, cap = TRAVEL.MAX_SPEED) {
      if (!state.settled && now - state.lastInput > TRAVEL.SNAP_DELAY) {
        // Settle on the stop nearest the request; a deliberate push past the starting stop commits to the next one
        let stop = nearestStop(state.request);
        const pushed = state.request - dist[state.anchor];
        if (stop === state.anchor && Math.abs(pushed) > TRAVEL.COMMIT) stop = clamp(state.anchor + Math.sign(pushed), 0, count - 1);
        state.target = stop;
        state.settled = true;
        // Too far to walk: hold here and let the caller teleport, as a far progress tick does
        if (Math.abs(dist[stop] - state.s) > TRAVEL.TELEPORT_DISTANCE) { state.goal = state.request = state.s; state.jump = stop; }
        else state.goal = state.request = dist[stop];
      } else if (!state.settled) state.goal = clamp(state.request, state.s - TRAVEL.LEAD, state.s + TRAVEL.LEAD);
      const seconds = dt / 1000;
      const gap = state.goal - state.s;
      if (Math.abs(gap) < 0.01 && Math.abs(state.v) < 0.3) { state.s = state.goal; state.v = 0; return; }
      // Speed follows how far the goal is ahead, never faster than it can still brake in time
      const want = Math.sign(gap) * Math.min(cap, TRAVEL.MAX_SPEED, Math.sqrt(2 * TRAVEL.BRAKE * Math.abs(gap)), TRAVEL.MIN_SPEED + TRAVEL.RESPONSE * Math.abs(gap));
      const speedingUp = Math.sign(want) === Math.sign(state.v) && Math.abs(want) > Math.abs(state.v);
      const rate = (speedingUp ? TRAVEL.ACCEL : TRAVEL.BRAKE * 1.6) * seconds;
      state.v += clamp(want - state.v, -rate, rate);
      const before = state.s;
      state.s = clamp(state.s + state.v * seconds, 0, total);
      // Don't overshoot the goal
      if (Math.sign(state.goal - state.s) !== Math.sign(state.goal - before) && state.s !== state.goal) { state.s = state.goal; state.v = 0; }
    }
  };
}
