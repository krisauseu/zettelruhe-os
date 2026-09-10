import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isSetupRequired } from "@/lib/pb";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (await isSetupRequired()) {
    redirect("/setup");
  }
  const session = await getSession();
  if (session) {
    redirect("/app");
  }
  redirect("/login");
}
