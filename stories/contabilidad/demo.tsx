import {
  Composer,
  type ComposerProps,
  useWorkspace,
  type Workspace,
} from "@sincpro/web-composer";
import {
  createRegistry,
  EMPTY,
  openPanel,
  push,
  Zone,
} from "@sincpro/web-composer/domain/index";
import { Button } from "@sincpro/web-ui";
import { type ReactNode, useEffect } from "react";

import { db } from "./datos";
import { CONTABILIDAD } from "./dominio";
import { APUNTES_REF, apuntesDeCuenta, ASIENTOS, CONCILIAR, FACTURA_NUEVA } from "./vistas";

export const REGISTRY = createRegistry(CONTABILIDAD);

/* ── Starting points: each story begins where a person would ───────────── */

/** La lista de asientos, sola. Es la capa más simple: páginas y migas. */
export const soloLaLista = (): Workspace => push(EMPTY, ASIENTOS);

/** El libro de apuntes de una cuenta. */
export const libroDeApuntes = (cuenta = "1.1.2"): Workspace =>
  push(EMPTY, apuntesDeCuenta(cuenta));

/** Todos los apuntes, con el detalle del asiento al lado que sigue lo que se marca. */
export const auditoria = (): Workspace =>
  openPanel(
    push(EMPTY, APUNTES_REF),
    { domain: "contabilidad", kind: "seguidor" },
    Zone.Right,
  );

/** Dos contextos: el extracto en la página y, al lado, con qué conciliarlo. */
export const conciliacion = (): Workspace =>
  openPanel(
    push(EMPTY, CONCILIAR),
    { domain: "contabilidad", kind: "candidatos" },
    Zone.Right,
  );

/** Un formulario por llenar. */
export const facturaNueva = (): Workspace => push(EMPTY, FACTURA_NUEVA);

/* ── The frame every story draws the workspace in ─────────────────────── */

export function Demo({
  initial,
  children,
  ...props
}: { initial: Workspace; children?: ReactNode } & Partial<ComposerProps>) {
  /* Every story starts from the same books: conciliating in one must not leak into the next. */
  useEffect(() => db.reset(), []);
  const workspace = useWorkspace({ initial });

  return (
    /* The workspace fills what it is given, so the story gives it a height. Inline and not a
       Tailwind class: the design system allows no arbitrary values. */
    <div
      style={{ height: "42rem" }}
      className="flex flex-col overflow-hidden border-y border-line-strong"
    >
      <Composer
        workspace={workspace}
        registry={REGISTRY}
        empty={
          <Button role="primary" size="md" onClick={() => workspace.push(ASIENTOS)}>
            Abrir los asientos
          </Button>
        }
        {...props}
      />
      {children}
    </div>
  );
}
