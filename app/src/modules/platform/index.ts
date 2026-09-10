/**
 * Modul: platform
 * Auth, Session-Gate, Setup, App-Shell — Bauabschnitt 1.
 */
export const MODULE_ID = "platform" as const;
export { loginAction, logoutAction, setupAction } from "./auth-actions";
export { aendereEigenesPasswortAction } from "./passwort-actions";
export {
  createFirmaAction,
  switchFirmaAction,
  updateFirmaAction,
} from "./firma-actions";
export {
  aendereRolleAction,
  einladenNutzerAction,
  entferneMitgliedschaftAction,
  setzePasswortAction,
} from "./nutzer-actions";
export {
  hatRecht,
  istInstanzEigentuemer,
  type MitgliedschaftRolle,
  type Recht,
} from "./rechte";
