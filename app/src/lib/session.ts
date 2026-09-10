import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { MitgliedschaftRolle } from "@/modules/platform/rechte";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

export {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

export type FirmaSession = SessionPayload & {
  firmaId: string;
  mitgliedschaftRolle: MitgliedschaftRolle;
  kannSchreiben: boolean;
  kannVerwalten: boolean;
  kannFirmaAnlegen: boolean;
};

/** Secure-Flag nur bei HTTPS-APP_URL (Self-hosted oft HTTP hinter Caddy) */
function cookieSecure(): boolean {
  return (process.env.APP_URL ?? "").startsWith("https://");
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  return session;
}

/**
 * Session + aktive Firma mit Mitgliedschaft (ADR-0025).
 * firmaId nur, wenn die Nutzer:in Mitglied ist; sonst erste Mitgliedschaft.
 */
export async function requireFirmaSession(): Promise<FirmaSession> {
  const session = await requireSession();
  const { resolveMitgliedschaftFuerSession } = await import(
    "@/modules/platform/mitgliedschaft"
  );
  const {
    hatRecht,
    istInstanzEigentuemer,
    KEIN_FIRMA_MITGLIED_ERROR,
  } = await import("@/modules/platform/rechte");
  const mitgliedschaft = await resolveMitgliedschaftFuerSession(
    session.userId,
    session.firmaId,
  );
  if (!mitgliedschaft) {
    throw new Error(KEIN_FIRMA_MITGLIED_ERROR);
  }
  return {
    ...session,
    firmaId: mitgliedschaft.firmaId,
    mitgliedschaftRolle: mitgliedschaft.rolle,
    kannSchreiben: hatRecht(mitgliedschaft.rolle, "schreiben"),
    kannVerwalten: hatRecht(mitgliedschaft.rolle, "verwalten"),
    kannFirmaAnlegen: istInstanzEigentuemer(session.role),
  };
}

export async function requireSchreibenSession(): Promise<FirmaSession> {
  const session = await requireFirmaSession();
  if (!session.kannSchreiben) {
    const { KEINE_AENDERUNG_ERROR } = await import(
      "@/modules/platform/rechte"
    );
    redirect(`/app?error=${encodeURIComponent(KEINE_AENDERUNG_ERROR)}`);
  }
  return session;
}

export async function requireVerwaltenSession(): Promise<FirmaSession> {
  const session = await requireFirmaSession();
  if (!session.kannVerwalten) {
    const { KEINE_VERWALTUNG_ERROR } = await import(
      "@/modules/platform/rechte"
    );
    redirect(`/app?error=${encodeURIComponent(KEINE_VERWALTUNG_ERROR)}`);
  }
  return session;
}

export async function requireInstanzEigentuemerSession(): Promise<SessionPayload> {
  const session = await requireSession();
  const { istInstanzEigentuemer, KEINE_FIRMA_ANLEGEN_ERROR } = await import(
    "@/modules/platform/rechte"
  );
  if (!istInstanzEigentuemer(session.role)) {
    redirect(`/app/firma?error=${encodeURIComponent(KEINE_FIRMA_ANLEGEN_ERROR)}`);
  }
  return session;
}

/** Aktive Firma in der Session setzen und als users.firma merken. */
export async function activateFirma(
  session: SessionPayload,
  firmaId: string,
): Promise<void> {
  await setSessionCookie({
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    firmaId,
  });
  const { setUserFirma } = await import("./pb");
  await setUserFirma(session.userId, firmaId);
}
