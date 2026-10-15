import type { UpdateApi } from "@clockwyrks/simple-2d";
import type {
  BallState,
  CaromState,
  Mode,
  ObstacleState,
  PaddleState,
  StateView,
} from "./game";
import * as C from "./constants";
import { advanceBall } from "./physics";
import { clamp } from "./math";

export const drawSign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
export function parkedBall(): BallState {
  return {
    x: C.FIELD_CX,
    y: C.FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: C.HOLD_TIME,
    serveSign: drawSign(),
    trail: [],
  };
}
export function obstaclePose(index: number, t: number): ObstacleState {
  const base = C.OBSTACLE_CENTERS[index];
  if (!base || !Number.isInteger(index))
    throw new RangeError(`Unknown obstacle ${index}`);
  return {
    index,
    cx: base.x,
    cy:
      base.y +
      (index === 0 ? 1 : -1) *
        C.OBSTACLE_SWAY_AMP *
        Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    theta: C.OBSTACLE_SPIN_RATE * t,
  };
}
export function initialState(muted: boolean): CaromState {
  const paddle = (): PaddleState => ({
    cy: C.FIELD_CY,
    vy: 0,
    driven: false,
    drivenVy: 0,
  });
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: paddle(), right: paddle() },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parkedBall(),
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstaclePose(i, 0)),
    obstacleClock: 0,
    obstacleClockRunning: true,
    simTime: 0,
    muted,
  };
}
export function titleState(s: StateView): CaromState {
  return {
    ...initialState(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
export function startMatch(s: StateView, mode: Mode): CaromState {
  // Debug drivers and AI gates survive a restart; only reset releases them.
  return {
    ...s,
    screen: "countdown",
    mode,
    menuIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: parkedBall(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
    obstacleClock: 0,
    obstacleClockRunning: true,
    obstacles: s.obstacles.map((o) => obstaclePose(o.index, 0)),
    menuContacts: [],
  };
}
function integrate(p: PaddleState, velocity: number, dt: number): PaddleState {
  const raw = p.cy + velocity * dt;
  const cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : velocity };
}
function movePaddles(
  s: StateView,
  input: UpdateApi["input"],
  dt: number,
): CaromState["paddles"] {
  const up1 = input.value("p1-up") > 0;
  const down1 = input.value("p1-down") > 0;
  const up2 = input.value("p2-up") > 0;
  const down2 = input.value("p2-down") > 0;
  const leftVy =
    (Number(down1 || (s.mode === "solo" && down2)) -
      Number(up1 || (s.mode === "solo" && up2))) *
    C.PADDLE_SPEED;
  let rightVy = (Number(down2) - Number(up2)) * C.PADDLE_SPEED;
  if (s.mode === "solo") {
    const defend =
      s.ai.tracking &&
      s.screen === "playing" &&
      s.ball !== null &&
      s.ball.vx > 0;
    const target =
      defend && s.ball ? s.ball.y - s.ball.vy * C.AI_REACT : C.AI_HOME_Y;
    const diff = target - s.paddles.right.cy;
    const zone = defend ? C.AI_DEADZONE : C.AI_HOME_DEADZONE;
    rightVy =
      !s.ai.movement || Math.abs(diff) <= zone || dt <= 0
        ? 0
        : Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
  }
  return {
    left: integrate(
      s.paddles.left,
      s.paddles.left.driven ? s.paddles.left.drivenVy : leftVy,
      dt,
    ),
    right: integrate(
      s.paddles.right,
      s.paddles.right.driven ? s.paddles.right.drivenVy : rightVy,
      dt,
    ),
  };
}
export function advanceWorld(
  s: StateView,
  input: UpdateApi["input"],
  dt: number,
  cues: Set<string>,
): CaromState {
  if (s.screen !== "countdown" && s.screen !== "playing") return s;
  let next: CaromState = { ...s, paddles: movePaddles(s, input, dt) };
  let ball = s.ball;
  let screen = s.screen;
  if (ball && ball.held) {
    if (screen === "countdown") {
      const holdTimer = Math.max(0, ball.holdTimer - dt);
      ball = { ...ball, holdTimer };
      if (holdTimer <= 0) {
        ball = {
          ...ball,
          held: false,
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: ball.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
          trail: [],
        };
        screen = "playing";
      }
    }
  } else if (ball && screen === "playing") {
    ball = advanceBall(ball, next.paddles, s.obstacles, dt, cues);
  }
  if (ball)
    ball = {
      ...ball,
      trail: [
        ...ball.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
        { x: ball.x, y: ball.y, t: s.simTime },
      ],
    };
  const obstacleClock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  next = {
    ...next,
    screen,
    ball,
    obstacleClock,
    obstacles: s.obstacles.map((o) => obstaclePose(o.index, obstacleClock)),
  };
  if (
    ball &&
    !ball.held &&
    screen === "playing" &&
    (ball.x - C.BALL_R > C.FIELD_W || ball.x + C.BALL_R < 0)
  ) {
    const leftScored = ball.x > C.FIELD_W;
    const score = {
      p1: s.score.p1 + Number(leftScored),
      p2: s.score.p2 + Number(!leftScored),
    };
    cues.add(C.CUES.score);
    const won =
      Math.max(score.p1, score.p2) >= C.WIN_SCORE &&
      Math.abs(score.p1 - score.p2) >= C.WIN_LEAD;
    next = won
      ? {
          ...next,
          score,
          winner: leftScored ? "left" : "right",
          screen: "matchover",
          menuIndex: 0,
          menuContacts: [],
        }
      : {
          ...next,
          score,
          receiver: leftScored ? "right" : "left",
          screen: "countdown",
          ball: parkedBall(),
        };
  }
  return next;
}
