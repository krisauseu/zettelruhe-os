import { describe, expect, it } from "vitest";
import { isLockExpired, isLockHeldBy } from "./lock";

describe("job lock helpers", () => {
  const now = new Date("2026-08-12T12:00:00.000Z");

  it("isLockExpired bei abgelaufenem TTL", () => {
    expect(
      isLockExpired({ expires_at: "2026-08-12T11:00:00.000Z" }, now),
    ).toBe(true);
    expect(
      isLockExpired({ expires_at: "2026-08-12T13:00:00.000Z" }, now),
    ).toBe(false);
    expect(isLockExpired({ expires_at: "" }, now)).toBe(true);
  });

  it("isLockHeldBy prüft Holder und Ablauf", () => {
    const lock = {
      id: "1",
      key: "wiederkehrende_rechnungen",
      holder: "next-1",
      expires_at: "2026-08-12T13:00:00.000Z",
    };
    expect(isLockHeldBy(lock, "next-1", now)).toBe(true);
    expect(isLockHeldBy(lock, "other", now)).toBe(false);
    expect(
      isLockHeldBy(
        { ...lock, expires_at: "2026-08-12T11:00:00.000Z" },
        "next-1",
        now,
      ),
    ).toBe(false);
    expect(isLockHeldBy(null, "next-1", now)).toBe(false);
  });
});
