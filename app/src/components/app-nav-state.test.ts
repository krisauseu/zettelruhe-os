import { describe, expect, it } from "vitest";
import {
  DEFAULT_NAV_PREFS,
  findActiveSectionId,
  groupNavItems,
  groupedSectionIds,
  isItemVisible,
  isLinkActive,
  itemsToRender,
  parseNavPrefs,
  prefsEqual,
  sectionIdFromLabel,
  serializeNavPrefs,
  setAllCollapsed,
  setFavoritesOnly,
  shouldRenderSection,
  toggleCollapsed,
  toggleFavorite,
  withAutoOpen,
  type GroupableItem,
  type NavPrefs,
} from "./app-nav-state";

const NAV: GroupableItem[] = [
  { href: "/app", label: "Übersicht" },
  { href: "/app/suche", label: "Suche" },
  { type: "group", label: "Stammdaten" },
  { href: "/app/kontakte", label: "Kontakte" },
  { href: "/app/katalog", label: "Katalog" },
  { href: "/app/firma", label: "Firma" },
  { type: "group", label: "Zeit & Fahrten" },
  { href: "/app/zeiten", label: "Zeiten" },
  { href: "/app/fahrten", label: "Fahrten" },
  { type: "group", label: "Verkauf" },
  { href: "/app/angebote", label: "Angebote" },
  { href: "/app/rechnungen", label: "Rechnungen" },
];

const sections = groupNavItems(NAV);

describe("sectionIdFromLabel", () => {
  it("normalisiert de-DE-Labels zu stabilen Ids", () => {
    expect(sectionIdFromLabel("Stammdaten")).toBe("stammdaten");
    expect(sectionIdFromLabel("Zeit & Fahrten")).toBe("zeit-und-fahrten");
    expect(sectionIdFromLabel("Belege & Kasse")).toBe("belege-und-kasse");
    expect(sectionIdFromLabel("Auswertungen")).toBe("auswertungen");
    expect(sectionIdFromLabel("Größe & Größe")).toBe("groesse-und-groesse");
  });
});

describe("groupNavItems", () => {
  it("hält ungruppierte Einträge oben und gruppiert den Rest", () => {
    expect(sections).toHaveLength(4);
    expect(sections[0]).toMatchObject({
      id: "",
      label: null,
      items: [
        { href: "/app", label: "Übersicht" },
        { href: "/app/suche", label: "Suche" },
      ],
    });
    expect(sections[1]?.id).toBe("stammdaten");
    expect(sections[1]?.items.map((item) => item.href)).toEqual([
      "/app/kontakte",
      "/app/katalog",
      "/app/firma",
    ]);
    expect(groupedSectionIds(sections)).toEqual([
      "stammdaten",
      "zeit-und-fahrten",
      "verkauf",
    ]);
  });
});

describe("isLinkActive", () => {
  it("matcht Übersicht nur exakt", () => {
    expect(isLinkActive("/app", "/app")).toBe(true);
    expect(isLinkActive("/app/kontakte", "/app")).toBe(false);
  });

  it("matcht Unterrouten der übrigen Einträge", () => {
    expect(isLinkActive("/app/rechnungen", "/app/rechnungen")).toBe(true);
    expect(isLinkActive("/app/rechnungen/abc", "/app/rechnungen")).toBe(true);
    expect(isLinkActive("/app/rechnungen", "/app/angebote")).toBe(false);
  });
});

describe("parseNavPrefs / serializeNavPrefs", () => {
  it("fällt bei leerem oder ungültigem Speicher auf Defaults zurück", () => {
    expect(parseNavPrefs(null)).toEqual(DEFAULT_NAV_PREFS);
    expect(parseNavPrefs("nope")).toEqual(DEFAULT_NAV_PREFS);
    expect(parseNavPrefs("[]")).toEqual(DEFAULT_NAV_PREFS);
  });

  it("liest nur bekannte Felder und dedupliziert", () => {
    expect(
      parseNavPrefs(
        JSON.stringify({
          collapsed: ["verkauf", "verkauf", 1],
          favorites: ["/app/belege", "/app/belege"],
          favoritesOnly: "yes",
          extra: true,
        }),
      ),
    ).toEqual({
      collapsed: ["verkauf"],
      favorites: ["/app/belege"],
      favoritesOnly: false,
    });
    expect(
      parseNavPrefs(JSON.stringify({ favoritesOnly: true })),
    ).toMatchObject({ favoritesOnly: true });
  });

  it("serialisiert rund", () => {
    const prefs: NavPrefs = {
      collapsed: ["verkauf", "verkauf"],
      favorites: ["/app/belege"],
      favoritesOnly: true,
    };
    expect(parseNavPrefs(serializeNavPrefs(prefs))).toEqual({
      collapsed: ["verkauf"],
      favorites: ["/app/belege"],
      favoritesOnly: true,
    });
  });
});

describe("collapse + auto-open", () => {
  it("klappt zu und auf", () => {
    const closed = toggleCollapsed(DEFAULT_NAV_PREFS, "verkauf");
    expect(closed.collapsed).toEqual(["verkauf"]);
    expect(toggleCollapsed(closed, "verkauf").collapsed).toEqual([]);
  });

  it("öffnet den Abschnitt der aktiven Route und speichert das", () => {
    const closed = setAllCollapsed(
      DEFAULT_NAV_PREFS,
      groupedSectionIds(sections),
      true,
    );
    expect(closed.collapsed).toContain("verkauf");
    expect(findActiveSectionId(sections, "/app/rechnungen/xyz")).toBe(
      "verkauf",
    );
    const opened = withAutoOpen(
      closed,
      findActiveSectionId(sections, "/app/rechnungen/xyz"),
    );
    expect(opened.collapsed).not.toContain("verkauf");
    expect(opened.collapsed).toContain("stammdaten");
    expect(prefsEqual(withAutoOpen(opened, "verkauf"), opened)).toBe(true);
  });

  it("öffnet und schließt alle Gruppen", () => {
    const ids = groupedSectionIds(sections);
    const allClosed = setAllCollapsed(DEFAULT_NAV_PREFS, ids, true);
    expect(allClosed.collapsed).toEqual(ids);
    expect(setAllCollapsed(allClosed, ids, false).collapsed).toEqual([]);
  });
});

describe("favorites filter", () => {
  const favorited = toggleFavorite(
    toggleFavorite(DEFAULT_NAV_PREFS, "/app/kontakte"),
    "/app/rechnungen",
  );
  const only = setFavoritesOnly(favorited, true);

  it("zeigt ohne Filter alles", () => {
    expect(
      isItemVisible(sections[1]!.items[1]!, DEFAULT_NAV_PREFS, "/app"),
    ).toBe(true);
  });

  it("hält Favoriten und die aktive Seite sichtbar", () => {
    expect(isItemVisible({ href: "/app/kontakte", label: "Kontakte" }, only, "/app")).toBe(
      true,
    );
    expect(isItemVisible({ href: "/app/katalog", label: "Katalog" }, only, "/app")).toBe(
      false,
    );
    expect(
      isItemVisible(
        { href: "/app/katalog", label: "Katalog" },
        only,
        "/app/katalog",
      ),
    ).toBe(true);
  });

  it("blendet Gruppen ohne Treffer aus", () => {
    expect(shouldRenderSection(sections[1]!, only, "/app")).toBe(true);
    expect(shouldRenderSection(sections[2]!, only, "/app")).toBe(false);
    expect(shouldRenderSection(sections[3]!, only, "/app")).toBe(true);
  });

  it("zeigt in zugeklappten Abschnitten nur die aktive Seite", () => {
    const collapsedVerkauf = toggleCollapsed(DEFAULT_NAV_PREFS, "verkauf");
    const rendered = itemsToRender(
      sections[3]!,
      collapsedVerkauf,
      "/app/rechnungen/abc",
    );
    expect(rendered.map((item) => item.href)).toEqual(["/app/rechnungen"]);

    expect(
      itemsToRender(sections[3]!, collapsedVerkauf, "/app/kontakte"),
    ).toEqual([]);
  });
});
