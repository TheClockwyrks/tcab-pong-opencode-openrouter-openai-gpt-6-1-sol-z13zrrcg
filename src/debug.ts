import type {
  BallState,
  CaromDebugApi,
  CaromState,
  PaddleState,
  Side,
  StateView,
} from "./game";
import { CAROM_DEBUG_VERSION } from "./constants";
import { drawSign, initialState, obstaclePose, parkedBall } from "./simulation";
import { menuItemRect } from "./menus";

function withBall(s: StateView, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("Carom: no ball on the field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function withPaddle(
  s: StateView,
  side: Side,
  patch: Partial<PaddleState>,
): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}

export function createDebug(): CaromDebugApi {
  return {
    version: CAROM_DEBUG_VERSION,
    clearWorld: (s) => ({ ...s, ball: null, obstacles: [] }),
    spawnBall: (s) => ({ ...s, ball: parkedBall() }),
    spawnObstacle: (s, index) => ({
      ...s,
      obstacles: [
        ...s.obstacles.filter((o) => o.index !== index),
        obstaclePose(index, s.obstacleClock),
      ].sort((a, b) => a.index - b.index),
    }),
    reset: (s) => initialState(s.muted),
    reconcile: (s) => ({
      ...s,
      obstacles: s.obstacles.map((o) => obstaclePose(o.index, s.obstacleClock)),
    }),
    setScreen: (s, screen) => ({ ...s, screen }),
    setMode: (s, mode) => ({ ...s, mode }),
    setMenuIndex: (s, menuIndex) => ({ ...s, menuIndex }),
    setTitleIndex: (s, titleIndex) => ({ ...s, titleIndex }),
    setResumeScreen: (s, resumeScreen) => ({ ...s, resumeScreen }),
    setScore: (s, p1, p2) => ({ ...s, score: { p1, p2 } }),
    setWinner: (s, winner) => ({ ...s, winner }),
    setReceiver: (s, receiver) => ({ ...s, receiver }),
    setPaddleCy: (s, side, cy) => withPaddle(s, side, { cy }),
    setPaddleVy: (s, side, drivenVy) => withPaddle(s, side, { drivenVy }),
    setPaddleDriven: (s, side, driven) => withPaddle(s, side, { driven }),
    setBallPosition: (s, x, y) => withBall(s, { x, y }),
    setBallVelocity: (s, vx, vy) => withBall(s, { vx, vy }),
    setBallSpin: (s, spin) => withBall(s, { spin }),
    setBallHeld: (s, held) => withBall(s, { held }),
    setBallHoldTimer: (s, holdTimer) => withBall(s, { holdTimer }),
    setBallServeSign: (s, serveSign) => withBall(s, { serveSign }),
    drawBallServeSign: (s) => {
      if (!s.ball) throw new Error("Carom: no ball on the field");
      return withBall(s, { serveSign: drawSign() });
    },
    setAiTracking: (s, tracking) => ({ ...s, ai: { ...s.ai, tracking } }),
    setAiMovement: (s, movement) => ({ ...s, ai: { ...s.ai, movement } }),
    setMuted: (s, muted) => ({ ...s, muted }),
    setObstacleClock: (s, obstacleClock) => ({
      ...s,
      obstacleClock,
      obstacles: s.obstacles.map((o) => obstaclePose(o.index, obstacleClock)),
    }),
    setObstacleClockRunning: (s, obstacleClockRunning) => ({
      ...s,
      obstacleClockRunning,
    }),
    snapshot: (s) => {
      const { menuContacts: _contacts, ball, ...rest } = s;
      return structuredClone({
        ...rest,
        version: CAROM_DEBUG_VERSION,
        ball: ball ? { ...ball, speed: Math.hypot(ball.vx, ball.vy) } : null,
      });
    },
    menuItemRect,
  };
}
