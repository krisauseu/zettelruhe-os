import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createRechnung: vi.fn(), updateRechnung: vi.fn(), createAngebot: vi.fn(), updateAngebot: vi.fn() }));
vi.mock("./repository", () => mocks);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));
vi.mock("@/lib/session", () => ({ requireSchreibenSession: async () => ({ firmaId: "f1" }) }));
import { createRechnungAction, updateRechnungAction, createAngebotAction, updateAngebotAction } from "./actions";

describe("Positionsdetails im Formularpayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRechnung.mockResolvedValue({ id: "r1" });
    mocks.createAngebot.mockResolvedValue({ id: "a1" });
  });
  it.each([
    [createRechnungAction, mocks.createRechnung, false],
    [updateRechnungAction, mocks.updateRechnung, true],
    [createAngebotAction, mocks.createAngebot, false],
    [updateAngebotAction, mocks.updateAngebot, true],
  ] as const)("überträgt leere und mehrzeilige Details indexgleich", async (action, repository, edit) => {
    const form = new FormData();
    form.set("id", "d1");
    for (const [name, description] of [["Hosting", ""], ["Beratung", " example.test\nSeptember 2026 "]]) {
      form.append("position_bezeichnung", name);
      form.append("position_description", description);
      form.append("position_menge", "1");
      form.append("position_einzelpreis", "25");
    }
    await expect(action(form)).rejects.toThrow("NEXT_REDIRECT");
    const payload = repository.mock.calls[0][edit ? 2 : 1];
    expect(payload.positionen).toMatchObject([
      { bezeichnung: "Hosting", description: "" },
      { bezeichnung: "Beratung", description: "example.test\nSeptember 2026" },
    ]);
  });
});
