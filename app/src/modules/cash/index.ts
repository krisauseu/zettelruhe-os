/**
 * Modul: cash — Kassenbuch (Bareinnahmen/-ausgaben, fortlaufender Saldo)
 * Bauabschnitt 9: Festschreibung + Journal (quelle_typ=kasse), Storno light.
 * Getrennt von Bankkonten (Abschn. 11). Eine Kasse pro Firma in v1.
 */

export const MODULE_ID = "cash" as const;

export type {
  Buchungsrichtung,
  KassenbuchEintrag,
  KassenbuchEintragMitSaldo,
  KassenbuchFilter,
  KassenbuchInput,
  KassenbuchListResult,
  Steuersatz,
} from "./types";

export {
  assertCanStornieren,
  assertImmutableWriteBlocked,
  assertSaldoNichtNegativ,
  buildBuchungstextFromKasse,
  buildJournalInputFromKasse,
  buildKassenbuchStornoInput,
  compareKassenbuchChronologisch,
  computeRunningSaldo,
  festschreibungsZeitpunktUtc,
  IMMUTABLE_ERROR,
  invertRichtung,
  isValidIsoDate,
  NEGATIVER_SALDO_ERROR,
  saldoDelta,
  STORNO_BEREITS_ERROR,
  STORNO_VON_STORNO_ERROR,
  todayBerlin,
  validateKassenbuchInput,
} from "./invariants";

export {
  deleteKassenbuchEintrag,
  festschreibenKassenbuchEintrag,
  findKassenbuchStornoFuer,
  getKassenbuchEintrag,
  getKassenSaldo,
  getSaldoNachEintrag,
  listKassenbuch,
  listKassenbuchByIds,
  storniereKassenbuchEintrag,
  updateKassenbuchEintrag,
} from "./repository";

export {
  festschreibenKassenbuchAction,
  storniereKassenbuchAction,
} from "./actions";
