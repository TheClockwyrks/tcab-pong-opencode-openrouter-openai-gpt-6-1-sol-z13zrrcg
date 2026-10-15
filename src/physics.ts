import type { BallState, CaromState, ObstacleState, PaddleState } from "./game";
import * as C from "./constants";
import { clamp } from "./math";

type MovingBall = { -readonly [K in keyof BallState]: BallState[K] };

function paddleContact(
  b: MovingBall,
  p: PaddleState,
  left: boolean,
  cues: Set<string>,
): void {
  const x0 = left ? C.P1_X0 : C.P2_X0;
  const x1 = left ? C.P1_X1 : C.P2_X1;
  const y0 = p.cy - C.PADDLE_HALF;
  const y1 = p.cy + C.PADDLE_HALF;
  if (
    b.x <= x0 - C.BALL_R ||
    b.x >= x1 + C.BALL_R ||
    b.y <= y0 - C.BALL_R ||
    b.y >= y1 + C.BALL_R
  )
    return;
  const depths = [
    b.x - (x0 - C.BALL_R),
    x1 + C.BALL_R - b.x,
    b.y - (y0 - C.BALL_R),
    y1 + C.BALL_R - b.y,
  ];
  const face = depths.indexOf(Math.min(...depths));
  if (face < 2) {
    const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
    const angle =
      clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
    b.vx = (left ? 1 : -1) * speed * Math.cos(angle);
    b.vy = speed * Math.sin(angle);
    b.spin = clamp(
      b.spin + p.vy * C.SPIN_FROM_PADDLE,
      -C.SPIN_CLAMP,
      C.SPIN_CLAMP,
    );
    b.x = left ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
    cues.add(C.CUES.paddleHit);
  } else {
    b.y = face === 2 ? y0 - C.BALL_R : y1 + C.BALL_R;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
  }
}

function obstacleContact(
  b: MovingBall,
  o: ObstacleState,
  cues: Set<string>,
): void {
  const cos = Math.cos(o.theta),
    sin = Math.sin(o.theta);
  const dx = b.x - o.cx,
    dy = b.y - o.cy;
  const lx = dx * cos + dy * sin,
    ly = -dx * sin + dy * cos;
  let qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW);
  let qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const distance = Math.hypot(lx - qx, ly - qy);
  if (distance >= C.BALL_R) return;
  let nlx: number, nly: number;
  if (distance > 0) {
    nlx = (lx - qx) / distance;
    nly = (ly - qy) / distance;
  } else if (C.OBSTACLE_HW - Math.abs(lx) <= C.OBSTACLE_HH - Math.abs(ly)) {
    nlx = lx < 0 ? -1 : 1;
    nly = 0;
    qx = nlx * C.OBSTACLE_HW;
  } else {
    nlx = 0;
    nly = ly < 0 ? -1 : 1;
    qy = nly * C.OBSTACLE_HH;
  }
  const nx = nlx * cos - nly * sin,
    ny = nlx * sin + nly * cos;
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) {
    b.vx -= 2 * dot * nx;
    b.vy -= 2 * dot * ny;
    cues.add(C.CUES.obstacleBounce);
  }
  const px = qx + nlx * C.BALL_R,
    py = qy + nly * C.BALL_R;
  b.x = o.cx + px * cos - py * sin;
  b.y = o.cy + px * sin + py * cos;
}

/** Mutate only a fresh local value; no state handed to the core is changed. */
export function advanceBall(
  ball: BallState,
  paddles: CaromState["paddles"],
  obstacles: readonly ObstacleState[],
  dt: number,
  cues: Set<string>,
): BallState {
  const b: MovingBall = { ...ball };
  const count = Math.max(
    1,
    Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
  );
  const h = dt / count;
  for (let i = 0; i < count; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const angle = (b.spin / speed) * h;
      const vx = b.vx * Math.cos(angle) - b.vy * Math.sin(angle);
      b.vy = b.vx * Math.sin(angle) + b.vy * Math.cos(angle);
      b.vx = vx;
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    paddleContact(b, paddles.left, true, cues);
    paddleContact(b, paddles.right, false, cues);
    for (const obstacle of obstacles) obstacleContact(b, obstacle, cues);
  }
  return b;
}
