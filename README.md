# Carom

**Bend the ball. Bank the shot.** Carom is a browser-based paddle duel with a
twist: moving your paddle at contact puts spin on the ball, curving its flight.
Two swaying, rotating amber obstacles turn each rally into a bank-shot puzzle.
Play against the machine in Solo or share a keyboard in local Versus. First to
11 points wins, with a two-point lead required.

## Play locally

Requires Node.js 22.18+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. Everything is drawn on canvas; sound is
synthesized by the Simple 2D engine. The game needs no backend, external assets,
or runtime network services.

## Controls

| Control | Action |
| --- | --- |
| W / S | Move the left paddle |
| ↑ / ↓ | Move the right paddle in Versus; also move the left paddle in Solo |
| Enter / Space | Confirm a menu selection |
| W / S or ↑ / ↓ | Navigate menus |
| P / Escape | Pause or resume |
| Escape | Back from instructions or match results |
| M | Toggle sound |
| Backtick | Toggle the engine's debug overlay |

Menus also accept mouse clicks and touch taps. On a touchscreen, the engine
provides two vertical paddle sliders and menu controls. Audio unlocks on the first
key press or pointer contact.

Hit near a paddle's edge to change the outgoing angle. Move while striking to add
spin; the trail shows the resulting curve. Wall and obstacle bounces preserve
spin, and every paddle hit increases speed up to the cap.

## Production build

```sh
npm ci
npm run build
npm run preview
```

The complete static site is emitted into `dist/`, with `index.html` at its root.
Serve that directory at the root of any static web server.

## Development checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The tests run the actual engine over a Node canvas with counted clock steps.
They cover the simulation, AI, menus, pointer and touch gestures, audio events,
debug poses, and agreement between different frame lengths. Coverage is written
to `coverage/`.

`src/game.ts` declares the immutable state and game interface. Simulation,
collision resolution, menus, drawing, and debugging live in focused neighboring
modules. The engine owns the clock, input, sound, scaling, recorder, and overlay;
its documentation is in `engine/`. The complete game specification is in
`specs/`. Player-facing screenshots and a recorded rally are in `showcase/`.
