import { describe, expect, it, beforeAll } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

const sample: SessionPayload = {
  userId: "user_abc",
  email: "eigentuemer@example.com",
  name: "Alex Beispiel",
  role: "eigentuemer",
  firmaId: "firma_xyz",
};

describe("session token", () => {
  beforeAll(() => {
    process.env.SESSION_SECRET =
      "test-secret-at-least-32-characters-long!!";
  });

  it("erzeugt und verifiziert ein Token", async () => {
    const token = await createSessionToken(sample);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const payload = await verifySessionToken(token);
    expect(payload).toEqual(sample);
  });

  it("lehnt ungültige Tokens ab", async () => {
    expect(await verifySessionToken("not.a.jwt")).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
  });

  it("lehnt Tokens mit anderer Signatur ab", async () => {
    const token = await createSessionToken(sample);
    process.env.SESSION_SECRET =
      "other-secret-at-least-32-characters-long!";
    expect(await verifySessionToken(token)).toBeNull();
    process.env.SESSION_SECRET =
      "test-secret-at-least-32-characters-long!!";
  });
});
