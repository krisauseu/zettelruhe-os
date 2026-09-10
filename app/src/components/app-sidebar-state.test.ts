import { describe, expect, it } from "vitest";
import {
  isOffCanvasActive,
  isOffCanvasViewport,
  isSidebarInert,
  nextFocusIndex,
  nextOffCanvasOpen,
} from "./app-sidebar-state";

describe("nextOffCanvasOpen", () => {
  it("bleibt auf Desktop geschlossen", () => {
    expect(nextOffCanvasOpen(false, true, { type: "toggle" })).toBe(false);
    expect(nextOffCanvasOpen(false, true, { type: "open" })).toBe(false);
    expect(nextOffCanvasOpen(true, true, { type: "escape" })).toBe(false);
  });

  it("öffnet und schließt unter der Schwelle", () => {
    expect(nextOffCanvasOpen(false, false, { type: "toggle" })).toBe(true);
    expect(nextOffCanvasOpen(true, false, { type: "toggle" })).toBe(false);
    expect(nextOffCanvasOpen(false, false, { type: "open" })).toBe(true);
    expect(nextOffCanvasOpen(true, false, { type: "close" })).toBe(false);
    expect(nextOffCanvasOpen(true, false, { type: "escape" })).toBe(false);
    expect(nextOffCanvasOpen(true, false, { type: "overlay" })).toBe(false);
    expect(nextOffCanvasOpen(true, false, { type: "nav-link" })).toBe(false);
  });

  it("klappt beim Wechsel auf Desktop zu", () => {
    expect(
      nextOffCanvasOpen(true, false, { type: "viewport", isDesktop: true }),
    ).toBe(false);
    expect(
      nextOffCanvasOpen(true, false, { type: "viewport", isDesktop: false }),
    ).toBe(true);
  });
});

describe("flags", () => {
  it("trennt Desktop-Leiste und mobiles Off-Canvas", () => {
    expect(isOffCanvasViewport(true)).toBe(false);
    expect(isOffCanvasViewport(false)).toBe(true);
    expect(isSidebarInert(true, false)).toBe(false);
    expect(isSidebarInert(false, false)).toBe(true);
    expect(isSidebarInert(false, true)).toBe(false);
    expect(isOffCanvasActive(false, true)).toBe(true);
    expect(isOffCanvasActive(true, true)).toBe(false);
  });
});

describe("nextFocusIndex", () => {
  it("rotiert vorwärts und rückwärts", () => {
    expect(nextFocusIndex(4, 0, false)).toBe(1);
    expect(nextFocusIndex(4, 3, false)).toBe(0);
    expect(nextFocusIndex(4, 0, true)).toBe(3);
    expect(nextFocusIndex(4, 2, true)).toBe(1);
  });

  it("startet außerhalb der Liste am Rand", () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0);
    expect(nextFocusIndex(3, -1, true)).toBe(2);
    expect(nextFocusIndex(0, 0, false)).toBe(-1);
  });
});
