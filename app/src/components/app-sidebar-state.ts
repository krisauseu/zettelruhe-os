/** Desktop-Schwelle: darunter Off-Canvas, darüber feste Tinte-Sidebar. */
export const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

export const SIDEBAR_ID = "app-sidebar";

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export type OffCanvasAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "toggle" }
  | { type: "escape" }
  | { type: "overlay" }
  | { type: "nav-link" }
  | { type: "viewport"; isDesktop: boolean };

/** Off-Canvas nur unter der Desktop-Schwelle. Desktop bleibt immer „zu“ (CSS zeigt die Leiste). */
export function nextOffCanvasOpen(
  open: boolean,
  isDesktop: boolean,
  action: OffCanvasAction,
): boolean {
  if (action.type === "viewport") {
    return action.isDesktop ? false : open;
  }
  if (isDesktop) return false;
  switch (action.type) {
    case "open":
      return true;
    case "close":
    case "escape":
    case "overlay":
    case "nav-link":
      return false;
    case "toggle":
      return !open;
  }
}

export function isOffCanvasViewport(isDesktop: boolean): boolean {
  return !isDesktop;
}

/** Geschlossene mobile Leiste nicht in den Tab-Fluss / die AT. */
export function isSidebarInert(isDesktop: boolean, open: boolean): boolean {
  return !isDesktop && !open;
}

export function isOffCanvasActive(isDesktop: boolean, open: boolean): boolean {
  return !isDesktop && open;
}

/** Tab-Zyklus im offenen Off-Canvas. `currentIndex < 0` = Fokus liegt außerhalb der Liste. */
export function nextFocusIndex(
  count: number,
  currentIndex: number,
  shiftKey: boolean,
): number {
  if (count <= 0) return -1;
  if (currentIndex < 0) return shiftKey ? count - 1 : 0;
  if (shiftKey) return currentIndex <= 0 ? count - 1 : currentIndex - 1;
  return currentIndex >= count - 1 ? 0 : currentIndex + 1;
}

/** Ein Link in der Sidebar schließt; Gruppe/Favorit/Theme sind Buttons. */
export function isSidebarNavLinkClick(
  target: EventTarget | null,
  root: ParentNode | null,
): boolean {
  if (!(target instanceof Element) || !root) return false;
  const link = target.closest("a[href]");
  return Boolean(link && root.contains(link));
}
