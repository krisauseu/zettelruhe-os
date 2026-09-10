import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

async function logout() {
  await clearSessionCookie();
  const appUrl = process.env.APP_URL || "http://localhost";
  return NextResponse.redirect(new URL("/login", appUrl), 303);
}

export async function POST() {
  return logout();
}

export async function GET() {
  return logout();
}
