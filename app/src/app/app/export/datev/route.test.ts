import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exportDatevCsv: vi.fn(),
  getSession: vi.fn(),
  requireFirmaSession: vi.fn(),
  zeitraumFromSearchParams: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
  requireFirmaSession: mocks.requireFirmaSession,
}));

vi.mock("@/modules/reporting", () => ({
  exportDatevCsv: mocks.exportDatevCsv,
  zeitraumFromSearchParams: mocks.zeitraumFromSearchParams,
}));

import { GET } from "./route";

describe("DATEV-Route mit Reverse Charge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ userId: "user-1" });
    mocks.requireFirmaSession.mockResolvedValue({ firmaId: "firma-1" });
    mocks.zeitraumFromSearchParams.mockReturnValue({
      von: "2026-01-01",
      bis: "2026-01-31",
    });
  });

  it("liefert bei RC keinen als vollständig bezeichneten Teilexport", async () => {
    const message =
      "DATEV light kann Reverse-Charge-Buchungen ohne verifizierte Konten- und BU-Schlüssel-Zuordnung nicht vollständig ausgeben. Verwenden Sie den vollständigen Journal-CSV-Export.";
    mocks.exportDatevCsv.mockRejectedValue(new Error(message));

    const response = await GET(
      new Request(
        "http://localhost/app/export/datev?von=2026-01-01&bis=2026-01-31",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe(message);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(response.headers.get("Content-Type")).not.toBe("text/csv");
  });
});
