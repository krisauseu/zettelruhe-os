import { afterEach, describe, expect, it } from "vitest";
import { checkRuntimeEnv } from "./env";

const KEYS = [
  "SESSION_SECRET",
  "PB_URL",
  "PB_SUPERUSER_EMAIL",
  "PB_SUPERUSER_PASSWORD",
  "APP_URL",
] as const;

const snapshot: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

function saveEnv() {
  for (const k of KEYS) {
    snapshot[k] = process.env[k];
  }
}

function restoreEnv() {
  for (const k of KEYS) {
    const v = snapshot[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("checkRuntimeEnv", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("meldet Fehler bei fehlendem SESSION_SECRET", () => {
    saveEnv();
    process.env.SESSION_SECRET = "kurz";
    process.env.PB_URL = "http://pocketbase:8090";
    process.env.PB_SUPERUSER_EMAIL = "a@b.c";
    process.env.PB_SUPERUSER_PASSWORD = "sehr-langes-einzigartiges-passwort-xyz";
    process.env.APP_URL = "http://localhost";

    const r = checkRuntimeEnv();
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("SESSION_SECRET"))).toBe(true);
  });

  it("ok bei vollständigen, nicht-platzhalterhaften Werten", () => {
    saveEnv();
    process.env.SESSION_SECRET =
      "x".repeat(40) + "-kein-platzhalter-zufall-abc";
    process.env.PB_URL = "http://pocketbase:8090";
    process.env.PB_SUPERUSER_EMAIL = "ops@mein-host.local";
    process.env.PB_SUPERUSER_PASSWORD = "einzigartiges-ops-passwort-42!";
    process.env.APP_URL = "https://buchhaltung.mein-host.local";

    const r = checkRuntimeEnv();
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("warnt bei change-me-Platzhaltern", () => {
    saveEnv();
    process.env.SESSION_SECRET =
      "change-me-to-a-long-random-string-at-least-32-chars";
    process.env.PB_URL = "http://pocketbase:8090";
    process.env.PB_SUPERUSER_EMAIL = "admin@example.com";
    process.env.PB_SUPERUSER_PASSWORD = "change-me-superuser";
    process.env.APP_URL = "http://localhost";

    const r = checkRuntimeEnv();
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
