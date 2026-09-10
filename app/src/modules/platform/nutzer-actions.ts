"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireVerwaltenSession } from "@/lib/session";
import { isMitgliedschaftRolle } from "./rechte";
import { sendeEinladungPerMail } from "./einladung-mail";
import {
  aendereMitgliedschaftRolle,
  einladenNutzer,
  entferneMitgliedschaft,
  setzeNutzerPasswort,
} from "./mitgliedschaft";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function einladenNutzerAction(formData: FormData): Promise<void> {
  const session = await requireVerwaltenSession();
  const rolleRaw = formString(formData, "rolle");
  let eingeladen: Awaited<ReturnType<typeof einladenNutzer>>;
  try {
    eingeladen = await einladenNutzer({
      firmaId: session.firmaId,
      name: formString(formData, "name"),
      email: formString(formData, "email"),
      password: formString(formData, "password"),
      rolle: rolleRaw,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Einladen fehlgeschlagen.";
    redirect(`/app/nutzer?error=${encodeURIComponent(msg)}`);
  }

  const rolle = isMitgliedschaftRolle(rolleRaw) ? rolleRaw : "bearbeiten";
  let mailOk = false;
  let mailFehler = "";
  try {
    const sent = await sendeEinladungPerMail({
      to: eingeladen.user.email,
      empfaengerName: eingeladen.user.name,
      firmaId: session.firmaId,
      rolle,
      einladendeName: session.name,
    });
    mailOk = Boolean(sent);
  } catch (e) {
    mailFehler =
      e instanceof Error ? e.message : "E-Mail-Versand fehlgeschlagen.";
  }

  revalidatePath("/app/nutzer");
  if (mailFehler) {
    redirect(
      `/app/nutzer?created=1&error=${encodeURIComponent(
        `Zugang angelegt. E-Mail nicht gesendet: ${mailFehler}`,
      )}`,
    );
  }
  redirect(mailOk ? "/app/nutzer?created=1&mail=1" : "/app/nutzer?created=1");
}

export async function aendereRolleAction(formData: FormData): Promise<void> {
  const session = await requireVerwaltenSession();
  const id = formString(formData, "id");
  if (!id) {
    redirect("/app/nutzer");
  }
  try {
    await aendereMitgliedschaftRolle({
      handelndeUserId: session.userId,
      mitgliedschaftId: id,
      firmaId: session.firmaId,
      neueRolle: formString(formData, "rolle"),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Rolle konnte nicht geändert werden.";
    redirect(`/app/nutzer?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/nutzer");
  redirect("/app/nutzer?saved=1");
}

export async function entferneMitgliedschaftAction(
  formData: FormData,
): Promise<void> {
  const session = await requireVerwaltenSession();
  const id = formString(formData, "id");
  if (!id) {
    redirect("/app/nutzer");
  }
  try {
    await entferneMitgliedschaft({
      handelndeUserId: session.userId,
      mitgliedschaftId: id,
      firmaId: session.firmaId,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Entfernen fehlgeschlagen.";
    redirect(`/app/nutzer?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/nutzer");
  redirect("/app/nutzer?deleted=1");
}

export async function setzePasswortAction(formData: FormData): Promise<void> {
  const session = await requireVerwaltenSession();
  const zielUserId = formString(formData, "userId");
  const password = formString(formData, "password");
  const passwordConfirm = formString(formData, "passwordConfirm");
  if (!zielUserId) {
    redirect("/app/nutzer");
  }
  if (password !== passwordConfirm) {
    redirect(
      `/app/nutzer?error=${encodeURIComponent("Passwörter stimmen nicht überein.")}`,
    );
  }
  try {
    await setzeNutzerPasswort({
      handelndeUserId: session.userId,
      zielUserId,
      password,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Passwort konnte nicht gesetzt werden.";
    redirect(`/app/nutzer?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/nutzer");
  redirect("/app/nutzer?saved=1");
}
