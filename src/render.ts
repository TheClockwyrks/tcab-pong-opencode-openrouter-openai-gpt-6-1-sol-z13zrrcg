import type { RenderApi } from "@clockwyrks/simple-2d";
import type { MenuRect, StateView } from "./game";
import * as C from "./constants";
import { menuItemRect, menuItems } from "./menus";

const INK = "#edf5ed";
const MUTED = "#7c929b";
const LINE = "#24343d";
const MINT = "#94f5cc";
const CORAL = "#ff8a79";
const GOLD = "#eac078";
const MONO = '"Courier New", monospace';
const SANS = '"Arial", sans-serif';

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 14,
  color = INK,
  align: CanvasTextAlign = "left",
  weight = 400,
  mono = false,
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${mono ? MONO : SANS}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}
function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = LINE,
  width = 1,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function round(
  ctx: CanvasRenderingContext2D,
  r: MenuRect,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fill();
}
function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}
function arrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  line(ctx, x - 16, y, x + 5, y, color, 1.5);
  line(ctx, x, y - 5, x + 5, y, color, 1.5);
  line(ctx, x, y + 5, x + 5, y, color, 1.5);
}
function grid(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#192730";
  for (let x = 32; x < C.FIELD_W; x += 32)
    for (let y = 32; y < C.FIELD_H; y += 32) ctx.fillRect(x, y, 1, 1);
}
function brand(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  line(ctx, x, y - 8, x, y + 8, MINT, 3);
  line(ctx, x + 21, y - 8, x + 21, y + 8, CORAL, 3);
  dot(ctx, x + 11, y, 3, INK);
}
function footer(
  s: StateView,
  ctx: CanvasRenderingContext2D,
  menu: boolean,
): void {
  line(ctx, 48, 666, C.FIELD_W - 48, 666);
  text(
    ctx,
    menu
      ? "W / S  OR  ↑ / ↓   SELECT     ENTER  PLAY"
      : s.mode === "solo"
        ? "W / S  OR  ↑ / ↓   MOVE"
        : "W / S   PLAYER 01       ↑ / ↓   PLAYER 02",
    48,
    692,
    11,
    MUTED,
    "left",
    400,
    true,
  );
  text(
    ctx,
    `${menu ? "" : "P / ESC  PAUSE    "}M  SOUND ${s.muted ? "OFF" : "ON"}`,
    C.FIELD_W - 48,
    692,
    11,
    MUTED,
    "right",
    400,
    true,
  );
}
function menu(s: StateView, ctx: CanvasRenderingContext2D): void {
  const descriptions =
    s.screen === "title"
      ? [
          "You against the machine",
          "Two players. One keyboard.",
          "Learn to bend the rally",
        ]
      : [];
  for (const [index, label] of menuItems(s).entries()) {
    const r = menuItemRect(s, index);
    if (!r) continue;
    const selected = index === s.menuIndex;
    if (selected) round(ctx, r, 5, MINT);
    else {
      line(ctx, r.x, r.y + r.h, r.x + r.w, r.y + r.h);
    }
    text(
      ctx,
      label,
      r.x + 20,
      r.y + r.h / 2,
      16,
      selected ? "#10261f" : INK,
      "left",
      700,
    );
    if (s.screen === "title" && index < 2)
      text(
        ctx,
        `0${index + 1}`,
        r.x + r.w - 51,
        r.y + r.h / 2,
        11,
        selected ? "#346c55" : MUTED,
        "right",
        400,
        true,
      );
    arrow(ctx, r.x + r.w - 22, r.y + r.h / 2, selected ? "#10261f" : MUTED);
    if (selected && descriptions[index])
      text(ctx, descriptions[index], r.x, 607, 13, MUTED);
  }
}
function titleArt(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  const cx = 916,
    cy = 340;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  for (const radius of [115, 190, 255]) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  line(ctx, cx - 273, cy, cx + 273, cy);
  line(ctx, cx, cy - 270, cx, cy + 270);
  ctx.setLineDash([3, 7]);
  line(ctx, 696, 130, 696, 556);
  line(ctx, 1136, 130, 1136, 556);
  ctx.setLineDash([]);
  round(ctx, { x: 682, y: 379, w: C.PADDLE_W, h: C.PADDLE_H }, 8, MINT);
  round(ctx, { x: 1134, y: 200, w: C.PADDLE_W, h: C.PADDLE_H }, 8, CORAL);
  ctx.save();
  ctx.translate(842, 239);
  ctx.rotate(-0.42);
  round(
    ctx,
    { x: -C.OBSTACLE_HW, y: -C.OBSTACLE_HH, w: C.OBSTACLE_W, h: C.OBSTACLE_H },
    7,
    GOLD,
  );
  ctx.restore();
  ctx.save();
  ctx.translate(990, 441);
  ctx.rotate(-0.42);
  round(
    ctx,
    { x: -C.OBSTACLE_HW, y: -C.OBSTACLE_HH, w: C.OBSTACLE_W, h: C.OBSTACLE_H },
    7,
    GOLD,
  );
  ctx.restore();
  ctx.strokeStyle = "#689f92";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.moveTo(706, 421);
  ctx.bezierCurveTo(758, 392, 790, 306, 825, 267);
  ctx.bezierCurveTo(900, 313, 993, 297, 1081, 225);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = MINT;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(997, 282);
  ctx.quadraticCurveTo(1048, 261, 1081, 225);
  ctx.stroke();
  ctx.shadowColor = MINT;
  ctx.shadowBlur = 25;
  dot(ctx, 1081, 225, C.BALL_R, INK);
  ctx.shadowBlur = 0;
  dot(ctx, 825, 267, 5, INK);
  text(ctx, "01 / ADD A LITTLE SPIN", 756, 593, 11, MINT, "left", 400, true);
  text(
    ctx,
    "CHANGE THE ANGLE. CHANGE THE GAME.",
    756,
    615,
    10,
    MUTED,
    "left",
    400,
    true,
  );
  ctx.restore();
}
function title(s: StateView, ctx: CanvasRenderingContext2D): void {
  brand(ctx, 113, 80);
  text(
    ctx,
    "THE PADDLE DUEL, WITH A TWIST.",
    156,
    80,
    11,
    MUTED,
    "left",
    400,
    true,
  );
  text(ctx, C.TITLE_TEXT, 104, 216, 112, INK, "left", 900);
  round(ctx, { x: 113, y: 289, w: 29, h: 3 }, 1, MINT);
  text(ctx, "Bend the ball. Bank the shot.", 155, 290, 18, INK);
  text(ctx, "Make the next move impossible to read.", 113, 320, 15, MUTED);
  titleArt(ctx);
  menu(s, ctx);
  footer(s, ctx, true);
}
function furniture(s: StateView, ctx: CanvasRenderingContext2D): void {
  ctx.setLineDash([5, 14]);
  line(ctx, C.NET_X, 110, C.NET_X, 640, "#2a3a43");
  ctx.setLineDash([]);
  line(ctx, 0, 1, C.FIELD_W, 1, "#40535b", 2);
  line(ctx, 0, C.FIELD_H - 1, C.FIELD_W, C.FIELD_H - 1, "#40535b", 2);
  for (const [x, color, p] of [
    [C.P1_X0, MINT, s.paddles.left],
    [C.P2_X0, CORAL, s.paddles.right],
  ] as const) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    round(
      ctx,
      { x, y: p.cy - C.PADDLE_HALF, w: C.PADDLE_W, h: C.PADDLE_H },
      8,
      color,
    );
    ctx.shadowBlur = 0;
    line(ctx, x + 5, p.cy - 12, x + 5, p.cy + 12, "#ffffff80", 2);
  }
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 12;
    round(
      ctx,
      {
        x: -C.OBSTACLE_HW,
        y: -C.OBSTACLE_HH,
        w: C.OBSTACLE_W,
        h: C.OBSTACLE_H,
      },
      6,
      GOLD,
    );
    ctx.shadowBlur = 0;
    for (const y of [-12, 0, 12]) line(ctx, -4, y, 4, y, "#806745", 1.5);
    ctx.restore();
  }
  const b = s.ball;
  if (b) {
    ctx.lineCap = "round";
    for (let i = 1; i < b.trail.length; i++) {
      const a = b.trail[i - 1],
        p = b.trail[i];
      const alpha = Math.max(0, 1 - (s.simTime - p.t) / C.TRAIL_TIME);
      ctx.globalAlpha = alpha * 0.65;
      line(ctx, a.x, a.y, p.x, p.y, MINT, C.BALL_R * 1.5 * alpha);
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = MINT;
    ctx.shadowBlur = 19;
    dot(ctx, b.x, b.y, C.BALL_R, INK);
    ctx.shadowBlur = 0;
    if (b.held) {
      ctx.strokeStyle = "#94f5cc66";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        b.x,
        b.y,
        27,
        -Math.PI / 2,
        -Math.PI / 2 + 2 * Math.PI * Math.max(0, b.holdTimer / C.HOLD_TIME),
      );
      ctx.stroke();
    }
  }
}
function hud(s: StateView, ctx: CanvasRenderingContext2D): void {
  brand(ctx, 48, 38);
  text(ctx, C.TITLE_TEXT, 87, 39, 17, INK, "left", 800);
  text(
    ctx,
    s.mode === "solo" ? "SOLO / HUMAN VS MACHINE" : "VERSUS / LOCAL DUEL",
    C.FIELD_W - 48,
    38,
    11,
    MUTED,
    "right",
    400,
    true,
  );
  text(ctx, "PLAYER 01", C.FIELD_CX - 104, 27, 10, MINT, "right", 400, true);
  text(
    ctx,
    s.mode === "solo" ? "MACHINE" : "PLAYER 02",
    C.FIELD_CX + 104,
    27,
    10,
    CORAL,
    "left",
    400,
    true,
  );
  text(
    ctx,
    String(s.score.p1).padStart(2, "0"),
    C.FIELD_CX - 102,
    73,
    58,
    MINT,
    "right",
    700,
    true,
  );
  text(
    ctx,
    String(s.score.p2).padStart(2, "0"),
    C.FIELD_CX + 102,
    73,
    58,
    CORAL,
    "left",
    700,
    true,
  );
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE}`,
    C.FIELD_CX,
    43,
    9,
    MUTED,
    "center",
    400,
    true,
  );
  text(
    ctx,
    `WIN BY ${C.WIN_LEAD}`,
    C.FIELD_CX,
    62,
    9,
    MUTED,
    "center",
    400,
    true,
  );
  if (s.screen === "countdown") {
    text(ctx, "GET READY", C.FIELD_CX, 415, 14, MINT, "center", 700, true);
    text(
      ctx,
      `SERVING TO PLAYER ${s.receiver === "left" ? "01" : "02"}`,
      C.FIELD_CX,
      439,
      10,
      MUTED,
      "center",
      400,
      true,
    );
  }
  footer(s, ctx, false);
}
function howto(s: StateView, ctx: CanvasRenderingContext2D): void {
  brand(ctx, 80, 60);
  text(ctx, "FIELD GUIDE / 01", 124, 60, 12, MUTED, "left", 400, true);
  text(ctx, "A simple game. A new angle.", 80, 132, 44, INK, "left", 800);
  text(
    ctx,
    `First to ${C.WIN_SCORE}. Lead by ${C.WIN_LEAD}. Send the ball past the other paddle to score.`,
    82,
    185,
    17,
    MUTED,
  );
  const columns = [80, 490, 900];
  for (const [i, x] of columns.entries()) {
    line(ctx, x, 234, x + 300, 234);
    text(
      ctx,
      `0${i + 1}`,
      x,
      268,
      13,
      [MINT, CORAL, GOLD][i],
      "left",
      400,
      true,
    );
  }
  text(ctx, "FIND YOUR RHYTHM", 80, 311, 18, INK, "left", 700);
  text(ctx, "W / S", 80, 362, 28, MINT, "left", 700, true);
  text(ctx, "Left paddle", 80, 398, 15, MUTED);
  text(ctx, "↑ / ↓", 252, 362, 28, CORAL, "left", 700, true);
  text(ctx, "Right paddle", 252, 398, 15, MUTED);
  text(ctx, "In Solo, either pair moves you.", 80, 451, 14, MUTED);
  text(ctx, "Touch? Use the edge sliders.", 80, 477, 14, MUTED);
  text(ctx, "PUT SOME SPIN ON IT", 490, 311, 18, INK, "left", 700);
  ctx.strokeStyle = MINT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(490, 402);
  ctx.quadraticCurveTo(575, 408, 636, 350);
  ctx.stroke();
  dot(ctx, 636, 350, C.BALL_R, INK);
  text(ctx, "Move your paddle as you strike.", 490, 451, 14, MUTED);
  text(ctx, "Your motion curves the ball's flight.", 490, 477, 14, MUTED);
  text(ctx, "WORK THE ANGLES", 900, 311, 18, INK, "left", 700);
  ctx.save();
  ctx.translate(1000, 376);
  ctx.rotate(0.55);
  round(ctx, { x: -8, y: -42, w: 16, h: 84 }, 5, GOLD);
  ctx.restore();
  text(ctx, "The amber bars sway and rotate.", 900, 451, 14, MUTED);
  text(ctx, "Bank a shot. Surprise your opponent.", 900, 477, 14, MUTED);
  text(
    ctx,
    "P / ESC  PAUSE     M  TOGGLE SOUND",
    C.FIELD_CX,
    550,
    12,
    MUTED,
    "center",
    400,
    true,
  );
  menu(s, ctx);
  footer(s, ctx, true);
}
export function drawGame(s: StateView, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  grid(ctx);
  if (s.screen === "title") title(s, ctx);
  else if (s.screen === "howto") howto(s, ctx);
  else {
    furniture(s, ctx);
    hud(s, ctx);
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "#0b141bed";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
      text(
        ctx,
        s.screen === "paused" ? "TAKE A BREATHER" : "THAT'S A MATCH",
        C.FIELD_CX,
        174,
        11,
        MINT,
        "center",
        400,
        true,
      );
      text(
        ctx,
        s.screen === "paused"
          ? "Paused."
          : s.winner === "left"
            ? "Player 01 wins."
            : s.mode === "solo"
              ? "Machine wins."
              : "Player 02 wins.",
        C.FIELD_CX,
        242,
        58,
        INK,
        "center",
        800,
      );
      text(
        ctx,
        s.screen === "paused"
          ? "The next angle can wait."
          : `${s.score.p1}  —  ${s.score.p2}   /   WELL PLAYED`,
        C.FIELD_CX,
        301,
        16,
        MUTED,
        "center",
        400,
        s.screen === "matchover",
      );
      menu(s, ctx);
      footer(s, ctx, true);
    }
  }
  ctx.restore();
}
