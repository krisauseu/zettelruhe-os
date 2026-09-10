import { afterEach, describe, expect, it } from "vitest";
import {
  assertSmtpConfigured,
  getSmtpConfig,
  isSmtpConfigured,
  resetSmtpCache,
  SMTP_NOT_CONFIGURED_ERROR,
} from "./smtp";

const ENV_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> =
  {};

function snapshotEnv() {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
  }
}

function restoreEnv() {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  resetSmtpCache();
}

describe("SMTP config guard", () => {
  snapshotEnv();
  afterEach(() => {
    restoreEnv();
  });

  it("ohne SMTP_HOST: nicht konfiguriert", () => {
    delete process.env.SMTP_HOST;
    expect(getSmtpConfig()).toBeNull();
    expect(isSmtpConfigured()).toBe(false);
    expect(() => assertSmtpConfigured()).toThrow(SMTP_NOT_CONFIGURED_ERROR);
  });

  it("mit SMTP_HOST: konfiguriert", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "u";
    process.env.SMTP_PASSWORD = "p";
    process.env.SMTP_FROM = "from@example.com";
    const cfg = getSmtpConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.host).toBe("smtp.example.com");
    expect(cfg!.port).toBe(587);
    expect(cfg!.from).toBe("from@example.com");
    expect(cfg!.secure).toBe(false);
    expect(isSmtpConfigured()).toBe(true);
  });

  it("Port 465 → secure", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "465";
    const cfg = getSmtpConfig();
    expect(cfg!.secure).toBe(true);
  });
});
