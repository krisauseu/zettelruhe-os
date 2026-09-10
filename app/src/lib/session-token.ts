import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "zettelruhe_session";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 Tage

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: string;
  firmaId: string | null;
};

export function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET fehlt oder ist zu kurz (mind. 32 Zeichen).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : "",
      role: typeof payload.role === "string" ? payload.role : "",
      firmaId:
        typeof payload.firmaId === "string" ? payload.firmaId : null,
    };
  } catch {
    return null;
  }
}
