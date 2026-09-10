import { isCloud, requireIngress, resolveInstance } from "@/lib/instance-context";
import { verifySessionToken } from "@/lib/session-token";
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/session-token";

/**
 * Eingangsschutz im Node-Proxy; die Session wird im Datenzugriff erneut geprüft.
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

export async function proxy(request: NextRequest) {
  if (isCloud()) {
    try {
      const context = await resolveInstance(requireIngress(request.headers));
      const path = request.nextUrl.pathname;
      if (path === "/setup" || path.startsWith("/setup/") || (path === "/logout" && request.method === "GET")) {
        return new NextResponse("Nicht verfügbar.", { status: 403, headers: { "Cache-Control": "private, no-store" } });
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.headers.get("origin") !== context.appUrl) {
        return new NextResponse("Origin abgewiesen.", { status: 403, headers: { "Cache-Control": "private, no-store" } });
      }
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      const session = token ? await verifySessionToken(token, context) : null;
      if (path.startsWith("/app") && !session) {
        const response = NextResponse.redirect(new URL("/login", context.appUrl));
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
      const response = NextResponse.next();
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch (error) {
      console.error("[instance] ingress failed", error instanceof Error && /^INSTANCE_[A-Z_]+$/.test(error.message) ? error.message : "INSTANCE_UNAVAILABLE");
      return new NextResponse("Instanz nicht verfügbar.", { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }
  }
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
  matcher: ["/:path*"],
};
