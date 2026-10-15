import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import type { CaromDebugApi, CaromState, StateView } from "./game";
import * as C from "./constants";

const engines: Engine<CaromState, CaromDebugApi>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
  vi.restoreAllMocks();
});

async function setup(ms = 8) {
  const target = new EventTarget();
  const engine = createEngine({
    canvas: createCanvas(C.FIELD_W, C.FIELD_H) as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    background: BACKGROUND,
    game,
    layout: C.LAYOUT,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  engines.push(engine);
  await engine.initialize();
  const d = engine.debug;
  const pose = (fn: (s: StateView) => CaromState) => engine.apply(fn);
  const key = (code: string, type = "keydown") =>
    target.dispatchEvent(
      Object.assign(new Event(type), { code, repeat: false }),
    );
  const press = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, "keyup");
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) =>
    target.dispatchEvent(
      Object.assign(new Event(`pointer${type}`), {
        clientX: x,
        clientY: y,
        pointerId: id,
        pointerType: device,
        isPrimary: true,
        button: 0,
        buttons: type === "up" ? 0 : 1,
      }),
    );
  const flight = (x: number, y: number, vx: number, vy: number, spin = 0) => {
    pose((s) => d.clearWorld(s));
    pose((s) => d.spawnBall(s));
    pose((s) => d.setScreen(s, "playing"));
    pose((s) => d.setMode(s, "versus"));
    pose((s) => d.setBallHeld(s, false));
    pose((s) => d.setBallPosition(s, x, y));
    pose((s) => d.setBallVelocity(s, vx, vy));
    pose((s) => d.setBallSpin(s, spin));
  };
  const cues: string[] = [];
  engine.events.on("cue:played", (event) => cues.push(event.cue));
  return {
    engine,
    d,
    pose,
    key,
    press,
    pointer,
    flight,
    cues,
    get s() {
      return engine.state;
    },
  };
}

describe("screens and input through the engine", () => {
  it("initializes a complete title state and read-only diagnostics", async () => {
    const h = await setup();
    expect(h.s.screen).toBe("title");
    expect(h.s.ball?.held).toBe(true);
    expect(h.s.obstacles).toHaveLength(2);
    expect(h.d.version).toBe(C.CAROM_DEBUG_VERSION);
    const before = h.d.snapshot(h.s);
    expect(h.engine.diagnostics().every((r) => !r.error)).toBe(true);
    expect(h.d.snapshot(h.s)).toEqual(before);
    const openingBall = h.s.ball;
    await h.engine.advance(4);
    expect(h.s.simTime).toBeCloseTo(0.032);
    expect(h.s.obstacleClock).toBe(0);
    expect(h.s.ball).toEqual(openingBall);
  });
  it("wraps menus, prioritizes up over down and movement over confirm", async () => {
    const h = await setup();
    h.key("KeyW");
    h.key("KeyS");
    h.key("Enter");
    await h.engine.advance(1);
    expect(h.s.menuIndex).toBe(2);
    expect(h.s.screen).toBe("title");
    h.key("KeyW", "keyup");
    h.key("KeyS", "keyup");
    h.key("Enter", "keyup");
    await h.press("Enter");
    expect(h.s.screen).toBe("howto");
    expect(h.s.titleIndex).toBe(2);
    await h.press("Escape");
    expect(h.s.screen).toBe("title");
    expect(h.s.menuIndex).toBe(2);
  });
  it("starts versus, freezes countdown on Escape, resumes exactly once", async () => {
    const h = await setup();
    await h.press("ArrowDown");
    await h.press("Enter");
    expect(h.s.mode).toBe("versus");
    expect(h.s.screen).toBe("countdown");
    await h.press("Escape");
    expect(h.s.screen).toBe("paused");
    const b = h.s.ball,
      clock = h.s.obstacleClock;
    await h.engine.advance(12);
    expect(h.s.ball).toEqual(b);
    expect(h.s.obstacleClock).toBe(clock);
    await h.press("Escape");
    expect(h.s.screen).toBe("countdown");
    expect(h.s.ball!.holdTimer).toBeLessThan(b!.holdTimer);
    await h.press("KeyP");
    await h.press("ArrowDown");
    await h.press("Enter");
    expect(h.s.score).toEqual({ p1: 0, p2: 0 });
    expect(h.s.screen).toBe("countdown");
    await h.press("KeyP");
    await h.press("KeyW");
    await h.press("Enter");
    expect(h.s.screen).toBe("title");
    expect(h.s.menuIndex).toBe(1);
  });
  it("requires pointer down and up on the same menu item across frames", async () => {
    const h = await setup();
    const a = h.d.menuItemRect(h.s, 0)!,
      b = h.d.menuItemRect(h.s, 1)!;
    h.pointer("down", a.x + 30, a.y + 20);
    await h.engine.advance(1);
    h.pointer("up", b.x + 30, b.y + 20);
    await h.engine.advance(1);
    expect(h.s.screen).toBe("title");
    expect(h.s.menuIndex).toBe(1);
    h.pointer("down", b.x + 30, b.y + 20);
    await h.engine.advance(1);
    h.pointer("up", b.x + 30, b.y + 20);
    await h.engine.advance(1);
    expect(h.s.screen).toBe("countdown");
    expect(h.s.mode).toBe("versus");
  });
  it("accepts a same-frame touch tap and gives keyboard confirmation priority", async () => {
    const h = await setup();
    const b = h.d.menuItemRect(h.s, 1)!;
    h.key("Enter");
    h.pointer("down", b.x + 10, b.y + 10, 4, "touch");
    h.pointer("up", b.x + 10, b.y + 10, 4, "touch");
    await h.engine.advance(1);
    expect(h.s.mode).toBe("solo");
    h.pose((s) => h.d.reset(s));
    h.key("Enter", "keyup");
    h.pointer("down", b.x + 10, b.y + 10, 5, "touch");
    h.pointer("up", b.x + 10, b.y + 10, 5, "touch");
    await h.engine.advance(1);
    expect(h.s.mode).toBe("versus");
  });
  it("serves on the elapsed timer frame without advancing the ball", async () => {
    const h = await setup(10);
    await h.press("Enter");
    h.pose((s) => h.d.setBallServeSign(s, -1));
    h.pose((s) => h.d.setBallHoldTimer(s, 0.01));
    await h.engine.advance(1);
    expect(h.s.screen).toBe("playing");
    expect(h.s.ball!.x).toBe(C.FIELD_CX);
    expect(h.s.ball!.vx).toBeCloseTo(-C.SERVE_SPEED * Math.cos(C.SERVE_ANGLE));
    expect(h.s.ball!.vy).toBeLessThan(0);
    expect(h.s.ball!.serveSign).toBe(-1);
    await h.engine.advance(1);
    expect(h.s.ball!.x).toBeLessThan(C.FIELD_CX);
  });
});

describe("paddles, spin, and collisions", () => {
  it("merges both key pairs in solo and keeps versus controls independent", async () => {
    const h = await setup(10);
    await h.press("Enter");
    h.key("KeyW");
    h.key("ArrowUp");
    await h.engine.advance(1);
    expect(h.s.paddles.left.vy).toBe(-C.PADDLE_SPEED);
    expect(h.s.paddles.right.vy).toBe(0);
    h.pose((s) => h.d.setMode(s, "versus"));
    await h.engine.advance(1);
    expect(h.s.paddles.right.vy).toBe(-C.PADDLE_SPEED);
    h.key("KeyS");
    await h.engine.advance(1);
    expect(h.s.paddles.left.vy).toBe(0);
  });
  it("integrates driven paddles and reports actual velocity at bounds", async () => {
    const h = await setup(10);
    await h.press("Enter");
    h.pose((s) => h.d.setPaddleCy(s, "left", C.PADDLE_MIN_CY + 2));
    h.pose((s) => h.d.setPaddleVy(s, "left", -500));
    expect(h.s.paddles.left.vy).toBe(0);
    h.pose((s) => h.d.setPaddleDriven(s, "left", true));
    await h.engine.advance(1);
    expect(h.s.paddles.left.cy).toBe(C.PADDLE_MIN_CY);
    expect(h.s.paddles.left.vy).toBe(-200);
    await h.engine.advance(1);
    expect(h.s.paddles.left.vy).toBe(0);
    expect(h.s.paddles.left.drivenVy).toBe(-500);
  });
  it.each(["left", "right"] as const)(
    "bounces off the %s paddle at speed cap and transfers spin",
    async (side) => {
      const h = await setup(8);
      const left = side === "left";
      h.flight(
        left ? C.P1_X1 + C.BALL_R + 2 : C.P2_X0 - C.BALL_R - 2,
        C.FIELD_CY,
        left ? -C.SPEED_CAP : C.SPEED_CAP,
        0,
      );
      h.pose((s) => h.d.setPaddleDriven(s, side, true));
      h.pose((s) => h.d.setPaddleVy(s, side, 200));
      await h.engine.advance(1);
      expect(Math.hypot(h.s.ball!.vx, h.s.ball!.vy)).toBeCloseTo(C.SPEED_CAP);
      expect(Math.sign(h.s.ball!.vx)).toBe(left ? 1 : -1);
      expect(h.s.ball!.spin).toBeGreaterThan(160);
      expect(h.cues).toEqual([C.CUES.paddleHit]);
    },
  );
  it.each([1, -1])(
    "turns velocity with signed spin %s and preserves speed while decaying",
    async (sign) => {
      const h = await setup(8);
      h.flight(600, 360, 400, 0, sign * 600);
      await h.engine.advance(100);
      expect(Math.hypot(h.s.ball!.vx, h.s.ball!.vy)).toBeCloseTo(400);
      expect(h.s.ball!.spin).toBeCloseTo(sign * 300);
      expect(Math.sign(h.s.ball!.vy)).toBe(sign);
      expect(
        h.s.ball!.trail.every((p) => h.s.simTime - p.t <= C.TRAIL_TIME + 1e-9),
      ).toBe(true);
    },
  );
  it.each([false, true])(
    "reflects at the %s wall without changing spin except decay",
    async (bottom) => {
      const h = await setup(8);
      h.flight(
        700,
        bottom ? C.FIELD_H - C.BALL_R - 1 : C.BALL_R + 1,
        100,
        bottom ? 600 : -600,
        50,
      );
      await h.engine.advance(1);
      expect(Math.sign(h.s.ball!.vy)).toBe(bottom ? -1 : 1);
      expect(h.s.ball!.y).toBeGreaterThanOrEqual(C.BALL_R);
      expect(h.s.ball!.y).toBeLessThanOrEqual(C.FIELD_H - C.BALL_R);
      expect(h.cues).toEqual([C.CUES.wallBounce]);
    },
  );
  it("resolves paddle end caps as walls", async () => {
    const h = await setup(8);
    h.flight(
      C.P1_X0 + C.PADDLE_W / 2,
      C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 1,
      0,
      400,
      0,
    );
    await h.engine.advance(1);
    expect(h.s.ball!.vy).toBe(-400);
    expect(h.cues).toEqual([C.CUES.wallBounce]);
  });
  it.each([0, Math.PI / 4, Math.PI / 2])(
    "reflects against an oriented obstacle at %s radians",
    async (theta) => {
      const h = await setup(4);
      h.flight(0, 0, 0, 0);
      h.pose((s) => h.d.setObstacleClock(s, theta / C.OBSTACLE_SPIN_RATE));
      h.pose((s) => h.d.setObstacleClockRunning(s, false));
      h.pose((s) => h.d.spawnObstacle(s, 0));
      const o = h.s.obstacles[0];
      const nx = Math.cos(theta),
        ny = Math.sin(theta);
      h.pose((s) =>
        h.d.setBallPosition(
          s,
          o.cx + nx * (C.OBSTACLE_HW + C.BALL_R + 1),
          o.cy + ny * (C.OBSTACLE_HW + C.BALL_R + 1),
        ),
      );
      h.pose((s) => h.d.setBallVelocity(s, -nx * 500, -ny * 500));
      await h.engine.advance(1);
      expect(h.s.ball!.vx).toBeCloseTo(nx * 500);
      expect(h.s.ball!.vy).toBeCloseTo(ny * 500);
      expect(h.cues).toEqual([C.CUES.obstacleBounce]);
    },
  );
  it("advances obstacle poses in anti-phase and freezes their clock", async () => {
    const h = await setup(10);
    await h.press("Enter");
    await h.engine.advance(30);
    const [a, b] = h.s.obstacles;
    expect(a.cx + b.cx).toBe(C.FIELD_W);
    expect(a.cy + b.cy).toBeCloseTo(C.FIELD_H);
    expect(a.theta).toBeCloseTo(h.s.obstacleClock * C.OBSTACLE_SPIN_RATE);
    h.pose((s) => h.d.setObstacleClockRunning(s, false));
    const before = h.s.obstacles;
    await h.engine.advance(10);
    expect(h.s.obstacles).toEqual(before);
  });
});

describe("AI, scoring, and debug contract", () => {
  it("gates AI tracking and movement separately", async () => {
    const h = await setup(10);
    h.flight(800, 150, 300, 100);
    h.pose((s) => h.d.setMode(s, "solo"));
    await h.engine.advance(1);
    expect(h.s.paddles.right.vy).toBe(-C.AI_SPEED);
    h.pose((s) => h.d.setAiMovement(s, false));
    await h.engine.advance(1);
    expect(h.s.paddles.right.vy).toBe(0);
    h.pose((s) => h.d.setAiMovement(s, true));
    h.pose((s) => h.d.setAiTracking(s, false));
    h.pose((s) => h.d.setPaddleCy(s, "right", 500));
    await h.engine.advance(1);
    expect(h.s.paddles.right.vy).toBe(-C.AI_SPEED);
    h.pose((s) => h.d.setPaddleCy(s, "right", C.AI_HOME_Y + 5));
    await h.engine.advance(1);
    expect(h.s.paddles.right.vy).toBe(0);
  });
  it.each([true, false])(
    "scores through goal %s, parks, and serves toward receiver",
    async (right) => {
      const h = await setup();
      h.flight(
        right ? C.FIELD_W + C.BALL_R : -C.BALL_R,
        100,
        right ? 300 : -300,
        0,
      );
      await h.engine.advance(1);
      expect(h.s.score).toEqual({ p1: Number(right), p2: Number(!right) });
      expect(h.s.receiver).toBe(right ? "right" : "left");
      expect(h.s.ball!.held).toBe(true);
      expect(h.s.ball!.trail).toEqual([]);
      expect(h.cues).toEqual([C.CUES.score]);
    },
  );
  it("requires a two-point lead, then shows matchover and supports replay/menu", async () => {
    const h = await setup();
    h.flight(C.FIELD_W + 20, 100, 200, 0);
    h.pose((s) => h.d.setScore(s, 10, 10));
    await h.engine.advance(1);
    expect(h.s.screen).toBe("countdown");
    expect(h.s.score.p1).toBe(11);
    h.flight(C.FIELD_W + 20, 100, 200, 0);
    await h.engine.advance(1);
    expect(h.s.screen).toBe("matchover");
    expect(h.s.winner).toBe("left");
    await h.press("Enter");
    expect(h.s.screen).toBe("countdown");
    expect(h.s.score.p1).toBe(0);
    h.flight(-30, 100, -200, 0);
    h.pose((s) => h.d.setScore(s, 0, 10));
    await h.engine.advance(1);
    expect(h.s.winner).toBe("right");
    await h.press("Escape");
    expect(h.s.screen).toBe("title");
  });
  it("clears entities, rejects absent-ball operations, and reconciles without simulation", async () => {
    const h = await setup();
    h.pose((s) => h.d.clearWorld(s));
    expect(h.d.snapshot(h.s).ball).toBeNull();
    expect(h.s.obstacles).toEqual([]);
    expect(() => h.d.setBallSpin(h.s, 10)).toThrow();
    expect(() => h.d.spawnObstacle(h.s, 2)).toThrow();
    expect(() => h.d.drawBallServeSign(h.s)).toThrow();
    h.pose((s) => h.d.setScreen(s, "playing"));
    await h.engine.advance(2);
    expect(h.s.score.p1).toBe(0);
    h.pose((s) => h.d.spawnBall(s));
    h.pose((s) => h.d.setBallPosition(s, C.P1_X0, 360));
    h.pose((s) => h.d.setBallVelocity(s, 3, 4));
    const before = h.d.snapshot(h.s);
    h.pose((s) => h.d.reconcile(s));
    h.pose((s) => h.d.reconcile(s));
    expect(h.d.snapshot(h.s)).toEqual(before);
    expect(before.ball!.speed).toBe(5);
    h.pose((s) => h.d.setMuted(s, true));
    h.pose((s) => h.d.reset(s));
    expect(h.s.muted).toBe(true);
    expect(h.s.simTime).toBe(0);
    expect(h.s.screen).toBe("title");
  });
  it("poses individual fields without side effects and returns detached snapshots", async () => {
    const h = await setup();
    const old = h.s;
    h.pose((s) => h.d.setTitleIndex(s, 2));
    h.pose((s) => h.d.setMenuIndex(s, 1));
    h.pose((s) => h.d.setResumeScreen(s, "countdown"));
    h.pose((s) => h.d.setWinner(s, "right"));
    h.pose((s) => h.d.setReceiver(s, "right"));
    h.pose((s) => h.d.setBallHoldTimer(s, 0.3));
    h.pose((s) => h.d.setBallServeSign(s, -1));
    h.pose((s) => h.d.setObstacleClock(s, 1.2));
    h.pose((s) => h.d.spawnObstacle(s, 1));
    const snap = h.d.snapshot(h.s);
    expect(snap).toMatchObject({
      titleIndex: 2,
      menuIndex: 1,
      resumeScreen: "countdown",
      winner: "right",
      receiver: "right",
      ball: { holdTimer: 0.3, serveSign: -1 },
      obstacleClock: 1.2,
    });
    expect(snap.paddles).not.toBe(h.s.paddles);
    expect(old.titleIndex).toBe(0);
    expect(h.d.menuItemRect(h.s, -1)).toBeNull();
    h.pose((s) => h.d.setScreen(s, "playing"));
    expect(h.d.menuItemRect(h.s, 0)).toBeNull();
  });
  it("draws both serve signs independently of their previous value", async () => {
    const h = await setup();
    const random = vi.spyOn(Math, "random");
    random.mockReturnValue(0.1);
    h.pose((s) => h.d.drawBallServeSign(s));
    expect(h.s.ball!.serveSign).toBe(-1);
    random.mockReturnValue(0.9);
    h.pose((s) => h.d.drawBallServeSign(s));
    expect(h.s.ball!.serveSign).toBe(1);
  });
  it("mutes cue gain on every screen while preserving physics", async () => {
    const h = await setup();
    await h.press("KeyM");
    expect(h.s.muted).toBe(true);
    const gains: number[] = [];
    h.engine.events.on("cue:played", (e) => gains.push(e.gain));
    h.flight(800, C.BALL_R + 1, 0, -600);
    await h.engine.advance(1);
    expect(gains).toEqual([0]);
    expect(h.s.ball!.vy).toBeGreaterThan(0);
    await h.press("KeyM");
    expect(h.s.muted).toBe(false);
  });
  it("agrees on contacts, speed, direction, and score with 2ms and 16ms frames", async () => {
    const run = async (ms: number) => {
      const h = await setup(ms);
      h.flight(500, 360, -500, 0);
      await h.engine.advance(1600 / ms);
      return {
        ball: h.s.ball!,
        cues: h.cues,
        score: h.s.score,
        time: h.s.simTime,
      };
    };
    const a = await run(2),
      b = await run(16);
    expect(a.cues).toEqual(b.cues);
    expect(a.cues).toContain(C.CUES.paddleHit);
    expect(a.score).toEqual(b.score);
    expect(Math.hypot(a.ball.vx, a.ball.vy)).toBeCloseTo(
      Math.hypot(b.ball.vx, b.ball.vy),
    );
    expect(Math.sign(a.ball.vx)).toBe(Math.sign(b.ball.vx));
    expect(a.time).toBeCloseTo(b.time);
  });
});
