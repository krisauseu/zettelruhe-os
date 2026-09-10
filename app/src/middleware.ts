import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/session-token";

/**
 * Leichtgewichtiges Session-Gate im Edge-Middleware.
 * Vollständige Payload-Prüfung und PB-Calls bleiben in Server Components/Actions.
 */

function secretKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const key = secretKey();
  if (!key) return false;
  try {
    await jwtVerify(token, key);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = await hasValidSession(request);

  if (pathname.startsWith("/app")) {
    if (!authed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if ((pathname === "/login" || pathname === "/setup") && authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/app/:path*",
    "/login",
    "/login/submit",
    "/setup",
    "/setup/submit",
    "/logout",
  ],
};
