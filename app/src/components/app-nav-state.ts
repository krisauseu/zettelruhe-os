export type GroupableLink = {
  type?: "link";
  href: string;
  label: string;
};

export type GroupableGroup = {
  type: "group";
  label: string;
};

export type GroupableItem = GroupableLink | GroupableGroup;

export type NavSection<T extends GroupableLink = GroupableLink> = {
  id: string;
  label: string | null;
  items: T[];
};

export type NavPrefs = {
  collapsed: string[];
  favorites: string[];
  favoritesOnly: boolean;
};

export const NAV_STORAGE_KEY = "zettelruhe-nav";
export const NAV_STORAGE_EVENT = "zettelruhe-nav";

export const DEFAULT_NAV_PREFS: NavPrefs = {
  collapsed: [],
  favorites: [],
  favoritesOnly: false,
};

export function isNavGroup(item: GroupableItem): item is GroupableGroup {
  return item.type === "group";
}

/** Stable id from the visible group label (de-DE, umlauts, &). */
export function sectionIdFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/&/g, "und")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function groupNavItems<T extends GroupableLink>(
  items: Array<T | GroupableGroup>,
): NavSection<T>[] {
  const sections: NavSection<T>[] = [];
  let current: NavSection<T> = { id: "", label: null, items: [] };

  const pushCurrent = () => {
    if (current.items.length > 0 || current.label !== null) {
      sections.push(current);
    }
  };

  for (const item of items) {
    if (isNavGroup(item)) {
      pushCurrent();
      current = {
        id: sectionIdFromLabel(item.label),
        label: item.label,
        items: [],
      };
      continue;
    }
    current.items.push(item);
  }
  pushCurrent();
  return sections;
}

export function groupedSectionIds(sections: NavSection[]): string[] {
  return sections.map((section) => section.id).filter(Boolean);
}

export function parseNavPrefs(raw: string | null): NavPrefs {
  if (!raw) return DEFAULT_NAV_PREFS;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return DEFAULT_NAV_PREFS;
    const record = data as Record<string, unknown>;
    return {
      collapsed: stringList(record.collapsed),
      favorites: stringList(record.favorites),
      favoritesOnly: record.favoritesOnly === true,
    };
  } catch {
    return DEFAULT_NAV_PREFS;
  }
}

export function serializeNavPrefs(prefs: NavPrefs): string {
  return JSON.stringify({
    collapsed: uniqueStrings(prefs.collapsed),
    favorites: uniqueStrings(prefs.favorites),
    favoritesOnly: prefs.favoritesOnly === true,
  });
}

export function prefsEqual(a: NavPrefs, b: NavPrefs): boolean {
  return (
    a.favoritesOnly === b.favoritesOnly &&
    sameStringSet(a.collapsed, b.collapsed) &&
    sameStringSet(a.favorites, b.favorites)
  );
}

export function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findActiveSectionId(
  sections: NavSection[],
  pathname: string,
): string | null {
  for (const section of sections) {
    if (!section.id) continue;
    if (section.items.some((item) => isLinkActive(pathname, item.href))) {
      return section.id;
    }
  }
  return null;
}

/** Open the section of the current route and persist that open state. */
export function withAutoOpen(
  prefs: NavPrefs,
  activeSectionId: string | null,
): NavPrefs {
  if (!activeSectionId) return prefs;
  if (!prefs.collapsed.includes(activeSectionId)) return prefs;
  return {
    ...prefs,
    collapsed: prefs.collapsed.filter((id) => id !== activeSectionId),
  };
}

export function toggleCollapsed(prefs: NavPrefs, sectionId: string): NavPrefs {
  if (!sectionId) return prefs;
  const collapsed = prefs.collapsed.includes(sectionId)
    ? prefs.collapsed.filter((id) => id !== sectionId)
    : [...prefs.collapsed, sectionId];
  return { ...prefs, collapsed };
}

export function setAllCollapsed(
  prefs: NavPrefs,
  sectionIds: string[],
  collapsed: boolean,
): NavPrefs {
  return {
    ...prefs,
    collapsed: collapsed ? uniqueStrings(sectionIds.filter(Boolean)) : [],
  };
}

export function toggleFavorite(prefs: NavPrefs, href: string): NavPrefs {
  const favorites = prefs.favorites.includes(href)
    ? prefs.favorites.filter((item) => item !== href)
    : [...prefs.favorites, href];
  return { ...prefs, favorites };
}

export function setFavoritesOnly(
  prefs: NavPrefs,
  favoritesOnly: boolean,
): NavPrefs {
  return { ...prefs, favoritesOnly };
}

export function isFavorite(prefs: NavPrefs, href: string): boolean {
  return prefs.favorites.includes(href);
}

export function isItemVisible(
  item: GroupableLink,
  prefs: NavPrefs,
  pathname: string,
): boolean {
  if (!prefs.favoritesOnly) return true;
  return isFavorite(prefs, item.href) || isLinkActive(pathname, item.href);
}

/** Section header stays if any item survives the favorites filter. */
export function shouldRenderSection<T extends GroupableLink>(
  section: NavSection<T>,
  prefs: NavPrefs,
  pathname: string,
): boolean {
  return section.items.some((item) => isItemVisible(item, prefs, pathname));
}

/**
 * Favorites filter first; a collapsed section still shows the active route
 * so the current page never disappears from the sidebar.
 */
export function itemsToRender<T extends GroupableLink>(
  section: NavSection<T>,
  prefs: NavPrefs,
  pathname: string,
): T[] {
  const filtered = section.items.filter((item) =>
    isItemVisible(item, prefs, pathname),
  );
  if (!section.id || !prefs.collapsed.includes(section.id)) return filtered;
  return filtered.filter((item) => isLinkActive(pathname, item.href));
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.filter((item) => typeof item === "string"));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const other = new Set(b);
  return a.every((item) => other.has(item));
}
