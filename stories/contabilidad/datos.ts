import { useSyncExternalStore } from "react";

/**
 * The accounting data every story reads. A tiny in-memory «backend»: conciliating changes it,
 * and every view that shows it redraws — exactly what a real server and a query cache do.
 * Nothing in the composer knows it exists.
 */

export type Tipo = "factura" | "pago" | "extracto";
export type Estado = "borrador" | "publicado" | "conciliado";

/** Un asiento contable: una factura, un pago o una línea de extracto bancario. */
export type Asiento = {
  id: string;
  tipo: Tipo;
  fecha: string;
  contacto: string;
  ref: string;
  estado: Estado;
  total: number;
  /** El asiento con el que quedó conciliado. */
  conciliadoCon?: string;
};

/** Un apunte: una línea de un asiento. Débito y crédito de UNA cuenta. */
export type Apunte = {
  id: string;
  asiento: string;
  cuenta: string;
  etiqueta: string;
  debe: number;
  haber: number;
};

export type Cuenta = { id: string; nombre: string };
export type Contacto = { id: string; nombre: string; nit: string };

export const CUENTAS: readonly Cuenta[] = [
  { id: "1.1.1", nombre: "Banco" },
  { id: "1.1.2", nombre: "Cuentas por cobrar" },
  { id: "1.1.9", nombre: "Cuenta transitoria" },
  { id: "2.1.3", nombre: "IVA débito fiscal" },
  { id: "4.1.1", nombre: "Ingresos por servicios" },
];

export const CONTACTOS: readonly Contacto[] = [
  { id: "acme", nombre: "Acme S.R.L.", nit: "1020304050" },
  { id: "globex", nombre: "Globex Bolivia", nit: "2030405060" },
  { id: "initech", nombre: "Initech Ltda.", nit: "3040506070" },
];

const IVA = 0.13;
const round = (n: number) => Math.round(n * 100) / 100;

const asiento = (a: Omit<Asiento, "ref"> & { ref?: string }): Asiento => ({
  ref: a.id,
  ...a,
});

const ASIENTOS: readonly Asiento[] = [
  asiento({
    id: "FAC-2026-0012",
    tipo: "factura",
    fecha: "2026-10-02",
    contacto: "acme",
    estado: "publicado",
    total: 1250,
  }),
  asiento({
    id: "FAC-2026-0013",
    tipo: "factura",
    fecha: "2026-10-05",
    contacto: "globex",
    estado: "publicado",
    total: 980.5,
  }),
  asiento({
    id: "FAC-2026-0014",
    tipo: "factura",
    fecha: "2026-10-07",
    contacto: "acme",
    estado: "conciliado",
    total: 3400,
    conciliadoCon: "PAG-2026-0007",
  }),
  asiento({
    id: "FAC-2026-0015",
    tipo: "factura",
    fecha: "2026-10-12",
    contacto: "initech",
    estado: "borrador",
    total: 560,
  }),
  asiento({
    id: "PAG-2026-0007",
    tipo: "pago",
    fecha: "2026-10-09",
    contacto: "acme",
    estado: "conciliado",
    total: 3400,
    conciliadoCon: "FAC-2026-0014",
  }),
  asiento({
    id: "EXT-2026-0031",
    tipo: "extracto",
    fecha: "2026-10-14",
    contacto: "acme",
    estado: "publicado",
    total: 1250,
    ref: "TRANSF. ACME OCT",
  }),
  asiento({
    id: "EXT-2026-0032",
    tipo: "extracto",
    fecha: "2026-10-15",
    contacto: "globex",
    estado: "publicado",
    total: 980.5,
    ref: "DEP. GLOBEX",
  }),
  asiento({
    id: "EXT-2026-0033",
    tipo: "extracto",
    fecha: "2026-10-16",
    contacto: "initech",
    estado: "publicado",
    total: 700,
    ref: "DEP. SIN DETALLE",
  }),
];

/** The lines of an entry, derived from its type: what bookkeeping makes of each document. */
function apuntesDe(a: Asiento): readonly Apunte[] {
  const line = (
    n: number,
    cuenta: string,
    etiqueta: string,
    debe: number,
    haber: number,
  ): Apunte => ({
    id: `${a.id}#${n}`,
    asiento: a.id,
    cuenta,
    etiqueta,
    debe,
    haber,
  });
  if (a.tipo === "factura") {
    const iva = round(a.total * IVA);
    return [
      line(1, "1.1.2", "Cuentas por cobrar", a.total, 0),
      line(2, "4.1.1", "Servicios prestados", 0, round(a.total - iva)),
      line(3, "2.1.3", "IVA 13 %", 0, iva),
    ];
  }
  if (a.tipo === "pago")
    return [
      line(1, "1.1.1", "Cobro recibido", a.total, 0),
      line(2, "1.1.2", "Cancela la factura", 0, a.total),
    ];
  return [
    line(1, "1.1.1", a.ref, a.total, 0),
    line(2, "1.1.9", "Pendiente de conciliar", 0, a.total),
  ];
}

export const APUNTES: readonly Apunte[] = ASIENTOS.flatMap(apuntesDe);

/* ── The mutable part: reconciliation ────────────────────────────────── */

type Snapshot = { asientos: readonly Asiento[] };

let snapshot: Snapshot = { asientos: ASIENTOS };
const listeners = new Set<() => void>();

export const db = {
  get: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Concilia dos asientos entre sí. */
  reconcile(a: string, b: string) {
    snapshot = {
      asientos: snapshot.asientos.map((x) =>
        x.id === a
          ? { ...x, estado: "conciliado", conciliadoCon: b }
          : x.id === b
            ? { ...x, estado: "conciliado", conciliadoCon: a }
            : x,
      ),
    };
    for (const l of listeners) l();
  },
  /** Vuelve a los datos de partida: cada story empieza igual. */
  reset() {
    snapshot = { asientos: ASIENTOS };
    for (const l of listeners) l();
  },
};

export const useAsientos = () => useSyncExternalStore(db.subscribe, db.get, db.get).asientos;

/* ── Helpers ─────────────────────────────────────────────────────────── */

export const asientoById = (all: readonly Asiento[], id: string | undefined) =>
  all.find((a) => a.id === id);
export const contactoNombre = (id: string | undefined) =>
  CONTACTOS.find((c) => c.id === id)?.nombre ?? id ?? "—";
export const cuentaNombre = (id: string) => CUENTAS.find((c) => c.id === id)?.nombre ?? id;

export const money = (value: number) =>
  `Bs. ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const TIPO_LABEL: Record<Tipo, string> = {
  factura: "factura",
  pago: "pago",
  extracto: "extracto bancario",
};
export const ESTADO_LABEL: Record<Estado, string> = {
  borrador: "borrador",
  publicado: "publicado",
  conciliado: "conciliado",
};

export const includes = (text: string, query: string) => {
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  return fold(text).includes(fold(query));
};

/** A server that takes its time: ⌘K shows «searching…» while it answers. */
export const later = <T>(value: T, ms: number) =>
  new Promise<T>((done) => setTimeout(() => done(value), ms));
