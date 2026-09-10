import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  archiveERechnung: vi.fn(),
  createBelegFromERechnungSafe: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireSchreibenSession: vi.fn(),
  uploadERechnung: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/session", () => ({
  requireSchreibenSession: mocks.requireSchreibenSession,
}));

vi.mock("./repository", () => ({
  archiveERechnung: mocks.archiveERechnung,
  createBelegFromERechnungSafe: mocks.createBelegFromERechnungSafe,
  uploadERechnung: mocks.uploadERechnung,
}));

import { createBelegFromERechnungAction } from "./actions";

function redirectError(path: string): Error & { digest: string } {
  return Object.assign(new Error("NEXT_REDIRECT"), {
    digest: `NEXT_REDIRECT;push;${path};303;`,
  });
}

describe("createBelegFromERechnungAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireSchreibenSession.mockResolvedValue({ firmaId: "firma-1" });
    mocks.redirect.mockImplementation((path: string) => {
      throw redirectError(path);
    });
  });

  it("leitet einen erfolgreich angelegten Beleg weiter, ohne den Redirect als Fehler zu behandeln", async () => {
    mocks.createBelegFromERechnungSafe.mockResolvedValue({
      beleg: { id: "beleg-1" },
    });
    const formData = new FormData();
    formData.set("id", "empfang-1");
    formData.set("lieferant", "kontakt-1");

    await expect(createBelegFromERechnungAction(formData)).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;push;/app/belege/beleg-1;303;",
    });

    expect(mocks.createBelegFromERechnungSafe).toHaveBeenCalledWith(
      "firma-1",
      "empfang-1",
      { lieferantId: "kontakt-1" },
    );
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith("/app/belege/beleg-1");
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/app/e-rechnungen"],
      ["/app/e-rechnungen/empfang-1"],
      ["/app/belege"],
    ]);
  });

  it("meldet einen echten Repository-Fehler am E-Rechnungs-Empfang", async () => {
    mocks.createBelegFromERechnungSafe.mockRejectedValue(
      new Error("Beleg konnte nicht angelegt werden."),
    );
    const formData = new FormData();
    formData.set("id", "empfang-1");

    await expect(createBelegFromERechnungAction(formData)).rejects.toMatchObject({
      digest:
        "NEXT_REDIRECT;push;/app/e-rechnungen/empfang-1?error=Beleg%20konnte%20nicht%20angelegt%20werden.;303;",
    });

    expect(mocks.redirect).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
