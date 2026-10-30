import { Destination, type ViewSpec, Zone } from "@sincpro/web-composer";
import { BookOpen, FileText, Landmark, Receipt, Scale, UserRound } from "lucide-react";

import { contactoNombre, CONTACTOS, cuentaNombre, db, includes, later } from "./datos";
import {
  Apuntes,
  apuntesDeAsiento,
  asientoRef,
  Asientos,
  AsientoView,
  Candidatos,
  CONCILIAR,
  Conciliar,
  contactoRef,
  ContactoView,
  Elegir,
  FacturaNueva,
  Seguidor,
} from "./vistas";

/**
 * The accounting domain, declared the way any real one is: a `ViewSpec` per screen. Registering
 * it is the only thing the workspace needs — nothing in the composer knows these names.
 */
export const CONTABILIDAD: readonly ViewSpec[] = [
  {
    domain: "contabilidad",
    kind: "asientos",
    icon: Receipt,
    title: () => "Asientos",
    goto: true,
    load: async () => Asientos,
  },
  {
    domain: "contabilidad",
    kind: "apuntes",
    icon: BookOpen,
    title: (ref) =>
      ref.params?.["cuenta"] !== undefined
        ? `Apuntes · ${cuentaNombre(ref.params["cuenta"])}`
        : ref.params?.["asiento"] !== undefined
          ? `Apuntes de ${ref.params["asiento"]}`
          : "Apuntes",
    goto: true,
    preferredZone: Zone.Right,
    load: async () => Apuntes,
  },
  {
    domain: "contabilidad",
    kind: "asiento",
    icon: FileText,
    title: (ref) => ref.id ?? "Asiento",
    preferredZone: Zone.Right,
    actions: (ref) => [
      {
        id: "apuntes",
        label: "Ver los apuntes de este asiento",
        icon: BookOpen,
        keywords: ["lineas", "debe", "haber"],
        run: (api) => api.open(apuntesDeAsiento(ref.id ?? ""), { to: Destination.Side }),
      },
      {
        id: "conciliar",
        label: "Ir a la conciliación bancaria",
        icon: Scale,
        keywords: ["extracto", "banco"],
        run: (api) => api.open(CONCILIAR),
      },
    ],
    /* Slow on purpose: ⌘K must show it is still asking. */
    search: async (query) => {
      await later(null, 350);
      return db
        .get()
        .asientos.filter((a) =>
          includes(`${a.id} ${a.ref} ${contactoNombre(a.contacto)}`, query),
        )
        .map((a) => ({
          ref: asientoRef(a.id),
          label: a.id,
          detail: `${contactoNombre(a.contacto)} · ${a.fecha}`,
        }));
    },
    load: async () => AsientoView,
  },
  {
    domain: "contabilidad",
    kind: "conciliar",
    icon: Scale,
    title: () => "Conciliación bancaria",
    goto: true,
    load: async () => Conciliar,
  },
  {
    domain: "contabilidad",
    kind: "candidatos",
    icon: Landmark,
    title: () => "Con qué conciliar",
    preferredZone: Zone.Right,
    load: async () => Candidatos,
  },
  {
    domain: "contabilidad",
    kind: "seguidor",
    icon: FileText,
    title: () => "Asiento seleccionado",
    preferredZone: Zone.Right,
    load: async () => Seguidor,
  },
  {
    domain: "contabilidad",
    kind: "contacto",
    icon: UserRound,
    title: (ref) => contactoNombre(ref.id),
    preferredZone: Zone.Right,
    search: async (query) => {
      await later(null, 200);
      return CONTACTOS.filter((c) => includes(`${c.nombre} ${c.nit}`, query)).map((c) => ({
        ref: contactoRef(c.id),
        label: c.nombre,
        detail: `NIT ${c.nit}`,
      }));
    },
    load: async () => ContactoView,
  },
  {
    domain: "contabilidad",
    kind: "elegir",
    title: (ref) => (ref.params?.["de"] === "cuenta" ? "Elegir cuenta" : "Elegir contacto"),
    load: async () => Elegir,
  },
  {
    domain: "contabilidad",
    kind: "factura-nueva",
    icon: Receipt,
    title: () => "Factura nueva",
    goto: true,
    load: async () => FacturaNueva,
  },
];
