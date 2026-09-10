import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = process.env.INSTANCE_MODE === "cloud" ? "__Host-zettelruhe_session" : "zettelruhe_session";
export type SessionBinding = { tenantId: string; sessionVersion: number; sessionSecret: string };

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 Tage

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: string;
  firmaId: string | null;
};

export function getSessionSecret(binding?: SessionBinding): Uint8Array {
  const secret = binding?.sessionSecret ?? (process.env.INSTANCE_MODE === "cloud" ? undefined : process.env.SESSION_SECRET);
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET fehlt oder ist zu kurz (mind. 32 Zeichen).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload,
  binding?: SessionBinding,
): Promise<string> {
  return new SignJWT({ ...payload, ...(binding ? { tenantId: binding.tenantId, sessionVersion: binding.sessionVersion } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret(binding));
}

export async function verifySessionToken(
  token: string,
  binding?: SessionBinding,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(binding), { algorithms: ["HS256"] });
    if (binding && (payload.tenantId !== binding.tenantId || payload.sessionVersion !== binding.sessionVersion)) return null;
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
