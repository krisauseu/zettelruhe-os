/**
 * Modul: projects — optionale Projekte je Kund:in (light Stammdaten)
 * Bauabschnitt 7
 */

export const MODULE_ID = "projects" as const;

export type {
  Projekt,
  ProjektFilter,
  ProjektInput,
  ProjektListResult,
} from "./types";

export { validateProjektInput } from "./invariants";
export type { ValidatedProjektInput } from "./invariants";

export {
  createProjekt,
  deleteProjekt,
  getProjekt,
  listProjekte,
  listProjekteForKunde,
  updateProjekt,
} from "./repository";

export {
  createProjektAction,
  deleteProjektAction,
  updateProjektAction,
} from "./actions";
