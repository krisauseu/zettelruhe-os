import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";
import {
  hatRecht,
  istInstanzEigentuemer,
  MITGLIEDSCHAFT_ROLLEN,
  type MitgliedschaftRolle,
} from "@/modules/platform/rechte";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/firma" }));
vi.mock("@/modules/platform/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/modules/platform/firma-switcher", () => ({ FirmaSwitcher: () => null }));

afterEach(() => vi.unstubAllEnvs());

function renderNav(instanceRole: string, rolle: MitgliedschaftRolle) {
  const shell = AppShell({
    session: {
      userId: "test-user", email: "test@example.invalid", name: "Test",
      role: instanceRole, firmaId: "test-firma",
    },
    firmen: [],
    children: createElement("main"),
    kannFirmaAnlegen: istInstanzEigentuemer(instanceRole),
    kannVerwalten: hatRecht(rolle, "verwalten"),
    kannSchreiben: hatRecht(rolle, "schreiben"),
    mitgliedschaftRolle: rolle,
  });
  // Die Sidebar verwendet dieses Nav-Element auch für die mobile Navigation.
  return renderToStaticMarkup(shell.props.nav);
}

describe("AppShell: Mailversand-Navigation", () => {
  for (const mode of ["cloud", "self-hosted"]) {
    for (const instanceRole of ["eigentuemer", "nutzer"]) {
      it.each(MITGLIEDSCHAFT_ROLLEN)(`${mode}, ${instanceRole}, Firma %s`, (rolle) => {
        vi.stubEnv("INSTANCE_MODE", mode);
        const html = renderNav(instanceRole, rolle);
        const mailVisible = mode === "cloud" && instanceRole === "eigentuemer";

        expect(html.includes('href="/app/mail-einstellungen"')).toBe(mailVisible);
        expect(html.includes("Mailversand")).toBe(mailVisible);
        expect(html.includes('href="/app/nutzer"')).toBe(rolle === "eigentuemer");
        expect(html).toContain('href="/app/firma"');
      });
    }
  }

  it("blendet Mailversand auch ohne INSTANCE_MODE im Self-Hosting aus", () => {
    vi.stubEnv("INSTANCE_MODE", undefined);
    expect(renderNav("eigentuemer", "eigentuemer")).not.toContain("Mailversand");
  });
});
