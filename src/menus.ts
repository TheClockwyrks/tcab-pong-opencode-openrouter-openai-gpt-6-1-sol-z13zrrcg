import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { CaromState, MenuRect, StateView } from "./game";
import {
  ACTIONS,
  TITLE_ITEMS,
  PAUSE_ITEMS,
  MATCHOVER_ITEMS,
} from "./constants";
import { startMatch, titleState } from "./simulation";

export function menuItems(s: StateView): readonly string[] {
  switch (s.screen) {
    case "title":
      return TITLE_ITEMS;
    case "paused":
      return PAUSE_ITEMS;
    case "matchover":
      return MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: StateView, index: number): MenuRect | null {
  if (!Number.isInteger(index) || index < 0 || index >= menuItems(s).length)
    return null;
  if (s.screen === "title")
    return { x: 112, y: 368 + index * 72, w: 390, h: 58 };
  if (s.screen === "howto") return { x: 440, y: 591, w: 400, h: 58 };
  return { x: 440, y: 362 + index * 72, w: 400, h: 58 };
}
function hit(s: StateView, x: number, y: number): number {
  return menuItems(s).findIndex((_, index) => {
    const r = menuItemRect(s, index);
    return (
      r !== null && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
    );
  });
}
function confirm(s: StateView): CaromState {
  switch (s.screen) {
    case "title": {
      const remembered = { ...s, titleIndex: s.menuIndex, menuContacts: [] };
      return s.menuIndex === 2
        ? { ...remembered, screen: "howto", menuIndex: 0 }
        : startMatch(remembered, s.menuIndex === 0 ? "solo" : "versus");
    }
    case "howto":
      return titleState(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen, menuContacts: [] }
        : s.menuIndex === 1
          ? startMatch(s, s.mode)
          : titleState(s);
    case "matchover":
      return s.menuIndex === 0 ? startMatch(s, s.mode) : titleState(s);
    default:
      return s;
  }
}

export function readControls(s: StateView, api: UpdateApi): CaromState {
  const edges = Object.fromEntries(
    ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  // Read ordered samples once. They include mouse, pen, and all touch contacts.
  const samples = api.input.pointerSamples();
  api.input.pointer();
  api.input.pointerContacts();
  let next: CaromState = { ...s, muted: edges.mute ? !s.muted : s.muted };
  if (s.screen === "playing" || s.screen === "countdown") {
    return edges.pause
      ? {
          ...next,
          screen: "paused",
          resumeScreen: s.screen,
          menuIndex: 0,
          menuContacts: [],
        }
      : next;
  }
  if (s.screen === "paused" && (edges.pause || edges.back))
    return { ...next, screen: s.resumeScreen, menuContacts: [] };
  if ((s.screen === "howto" || s.screen === "matchover") && edges.back)
    return titleState(next);
  const count = menuItems(s).length;
  const up = edges["p1-up"] || edges["p2-up"];
  const down = edges["p1-down"] || edges["p2-down"];
  if (up) next = { ...next, menuIndex: (next.menuIndex + count - 1) % count };
  else if (down) next = { ...next, menuIndex: (next.menuIndex + 1) % count };
  // A keyboard confirm owns this frame, even if a pointer also confirms.
  const keyboardConfirm = edges.confirm && !up && !down;
  const keyboardItem = next.menuIndex;
  let contacts = [...(s.menuContacts ?? [])];
  let pointerConfirm = false;
  for (const sample of samples) {
    if (sample.button !== null && sample.button !== "primary") continue;
    const index = hit(s, sample.x, sample.y);
    if (index >= 0) next = { ...next, menuIndex: index };
    if (sample.type === "down")
      contacts = [
        ...contacts.filter((c) => c.id !== sample.id),
        { id: sample.id, index },
      ];
    if (sample.type === "up") {
      const pressed = contacts.find((c) => c.id === sample.id);
      if (index >= 0 && pressed?.index === index) pointerConfirm = true;
      contacts = contacts.filter((c) => c.id !== sample.id);
    }
  }
  next = { ...next, menuContacts: contacts };
  if (keyboardConfirm) return confirm({ ...next, menuIndex: keyboardItem });
  return pointerConfirm ? confirm(next) : next;
}
