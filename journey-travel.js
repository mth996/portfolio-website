// Movement for the 3D journey: one controller owns where the guide is along the route.
// Scrolling is travel distance: the guide rides after the scroll along the road, and every station is a mandatory
// stop. Scroll input can never carry the guide past the next station; it brakes into it, the camera frames the content,
// and for a short dwell all scroll input is ignored. A gesture that was already under way (trackpad momentum included)
// stays ignored until it ends, so leaving a station always takes fresh input. When scrolling stops between stations,
// the guide rides on to the next one if it has committed to it, or rolls back to the one it left.
// The camera, the panel and the progress bar all read from here, never from the scroll itself, so nothing can run
// ahead of the guide. Teleports exist only for deliberate shortcuts (far progress ticks, Home, End), never for scrolling.
// The guide's look (the procedural scans today, a rigged character later) only receives position, speed and heading.

export const TRAVEL = {
  MAX_SPEED: 5.2,           // m/s: an easy jog
  ACCEL: 6,                 // m/s² when speeding up
  BRAKE: 7,                 // m/s² when slowing down
  RESPONSE: 0.9,            // m/s of extra speed per metre the scroll is ahead: short scrolls walk, long ones jog
  MIN_SPEED: 0.7,           // m/s floor while closing the last metres, so the guide arrives instead of creeping
  NOTCHES_PER_STATION: 8,   // mouse-wheel notches that cover a typical gap between two stations
  NOTCH_PIXELS: 100,        // pixels one wheel notch reports (Chromium on Windows); trackpads send their own pixel amounts
  MAX_LAG: 6,               // metres the scroll may run ahead of (or behind) the guide; input beyond this is discarded
  COMMIT: 0.3,              // fraction of the way to the next station that commits to it when scrolling stops
  SETTLE_DELAY: 220,        // ms without accepted input before the guide settles (rides on or rolls back)
  GESTURE_GAP: 160,         // ms of quiet that ends a scroll gesture; a new gesture is needed to leave a station
  DWELL: 1500,              // ms a station holds after arrival, ignoring scroll input
  TELEPORT_DISTANCE: 36     // shortcut jumps longer than this teleport instead of riding (one stop is ~22-32 m)
};

const AT = 0.01; // metres: closer than this counts as being at a station

export function createTravel({ THREE, count, standPoint }) {
  const points = [];
  const dist = [0];
  for (let i = 0; i < count; i++) points.push(standPoint(i, new THREE.Vector3()));
  for (let i = 1; i < count; i++) dist.push(dist[i - 1] + points[i - 1].distanceTo(points[i]));
  const total = dist[count - 1];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // phase: "rest" at a station, "ride" between stations, "dwell" just arrived (scroll ignored)
  // from: the station the guide last stood at; intent: how far the scrolling asked to go (never past the stations
  // either side), which decides whether it commits; request: the point the guide chases, kept within MAX_LAG of it;
  // goal: where the guide is heading now; blocked: the current gesture is being ignored
  const state = {
    s: 0, v: 0, goal: 0, request: 0, intent: 0, target: 0, from: 0, phase: "rest",
    dwellEnd: 0, lastEvent: -Infinity, lastAccepted: -Infinity, blocked: false, settling: false
  };

  function nearestStop(at) {
    let best = 0;
    for (let i = 1; i < count; i++) if (Math.abs(dist[i] - at) < Math.abs(dist[best] - at)) best = i;
    return best;
  }
  function stationAt(at) {
    const i = nearestStop(at);
    return Math.abs(dist[i] - at) < AT ? i : -1;
  }
  function segmentAt(at) {
    let i = 0;
    while (i < count - 2 && dist[i + 1] <= at) i++;
    return i;
  }
  // How far scrolling may take the guide: from a station, as far as either neighbour; once it has left, only on to
  // the next station or back to the one it left. It can never be carried past a station, however the input is timed.
  function bounds() {
    const prev = dist[Math.max(0, state.from - 1)], here = dist[state.from], next = dist[Math.min(count - 1, state.from + 1)];
    const away = state.s - here;
    return away > AT ? [here, next] : away < -AT ? [prev, here] : [prev, next];
  }
  function startDwell(now) {
    state.phase = "dwell";
    state.dwellEnd = now + TRAVEL.DWELL;
    state.blocked = true;      // whatever gesture brought the guide here is spent
  }
  // Scroll gestures: events closer together than GESTURE_GAP belong to one gesture. A gesture that began during a
  // dwell, or was still going when the guide arrived, is ignored to its end.
  function gate(now) {
    const fresh = now - state.lastEvent > TRAVEL.GESTURE_GAP;
    state.lastEvent = now;
    if (fresh) state.blocked = state.phase === "dwell";
    return !state.blocked;
  }

  return {
    get s() { return state.s; },
    get v() { return state.v; },
    get speed() { return Math.abs(state.v); },
    get phase() { return state.phase; },
    // The stop the guide is heading for (or resting at)
    get target() { return state.target; },
    get nearest() { return nearestStop(state.s); },
    // 0 → 1 over the dwell after an arrival (1 when not dwelling)
    dwellProgress(now) { return state.phase === "dwell" ? clamp(1 - (state.dwellEnd - now) / TRAVEL.DWELL, 0, 1) : 1; },
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
    // Facing while moving: along the route, turned around when going back
    heading() {
      const i = segmentAt(state.s);
      const a = points[i], b = points[Math.min(count - 1, i + 1)];
      const sign = state.v < 0 ? -1 : 1;
      return Math.atan2((b.x - a.x) * sign, (b.z - a.z) * sign);
    },
    // Whether a scroll event may move the guide (also used for reduced-motion steps)
    gate,
    // Scroll and swipe input, in metres along the route
    nudge(metres, now) {
      if (!gate(now)) return;
      if (state.phase === "rest") {
        const here = stationAt(state.s);
        if (here >= 0) state.from = here;
        state.phase = "ride";
        state.request = state.intent = state.s;
      } else if (state.settling) state.request = state.intent = state.s;   // new input after settling starts afresh
      state.settling = false;
      state.lastAccepted = now;
      // Never past the stations either side, and the guide never chases more than MAX_LAG ahead: the rest is discarded
      const [lo, hi] = bounds();
      state.intent = clamp(state.intent + metres, lo, hi);
      state.request = clamp(clamp(state.request + metres, state.s - TRAVEL.MAX_LAG, state.s + TRAVEL.MAX_LAG), lo, hi);
      state.goal = state.request;
      state.target = nearestStop(state.intent);
    },
    // Deliberate shortcut to a stop (keys, ticks): rides to a neighbouring stop even during a dwell;
    // returns false when it is too far and the caller should teleport instead
    goTo(i) {
      i = clamp(Math.round(i), 0, count - 1);
      if (Math.abs(dist[i] - state.s) > TRAVEL.TELEPORT_DISTANCE) return false;
      const here = stationAt(state.s);
      if (here >= 0) state.from = here;
      state.target = i;
      state.phase = "ride";
      state.settling = true;   // ride all the way; scrolling can still take over
      state.goal = state.request = state.intent = dist[i];
      return true;
    },
    // Place the guide at a stop at once (start, teleports, reduced-motion cuts); dwell: treat it as an arrival
    jumpTo(i, now = 0, dwell = false) {
      i = clamp(Math.round(i), 0, count - 1);
      state.s = state.goal = state.request = state.intent = dist[i];
      state.v = 0;
      state.target = state.from = i;
      state.settling = false;
      if (dwell) startDwell(now);
      else state.phase = "rest";
    },
    // cap: optional speed limit (m/s), e.g. while the headset goes on
    update(dt, now, cap = TRAVEL.MAX_SPEED) {
      if (state.phase === "dwell") {
        state.v = 0;
        if (now >= state.dwellEnd) state.phase = "rest";
        return;
      }
      if (state.phase === "rest") return;

      // Scrolling stopped between stations: if the scroll went far enough to commit, ride straight on to the next
      // station; otherwise finish the small move the scroll asked for, then roll back to the station it left
      if (!state.settling && now - state.lastAccepted > TRAVEL.SETTLE_DELAY) {
        const travelled = state.intent - dist[state.from];
        const next = clamp(state.from + Math.sign(travelled), 0, count - 1);
        const span = Math.abs(dist[next] - dist[state.from]);
        const committed = next !== state.from && span > 0 && Math.abs(travelled) / span >= TRAVEL.COMMIT;
        const caughtUp = Math.abs(state.request - state.s) < AT && Math.abs(state.v) < 0.3;
        if (committed || caughtUp) {
          const stop = committed ? next : state.from;
          state.goal = state.request = state.intent = dist[stop];
          state.target = stop;
          state.settling = true;
        }
      }

      const seconds = dt / 1000;
      const gap = state.goal - state.s;
      if (Math.abs(gap) < AT && Math.abs(state.v) < 0.3) {
        state.s = state.goal;
        state.v = 0;
        const here = stationAt(state.s);
        if (here >= 0) {
          // Reaching a station is a mandatory stop with a dwell; only the automatic roll-back after an uncommitted
          // scroll (the guide never really left) comes to rest without one
          if (state.settling && here === state.from) state.phase = "rest";
          else startDwell(now);
          state.from = state.target = here;
          state.settling = false;
        }
        return;
      }
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
