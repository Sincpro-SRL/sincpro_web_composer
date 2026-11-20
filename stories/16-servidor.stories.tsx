import { Composer, useWorkspace } from "@sincpro/web-composer";
import { EMPTY, push, toHash } from "@sincpro/web-composer/domain/index";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, waitFor, within } from "storybook/test";

import { auditoria, Demo, REGISTRY } from "./contabilidad/demo";
import { asientoRef, ASIENTOS } from "./contabilidad/vistas";

const meta: Meta = {
  title: "Casos de uso/16 · Dibujado en el servidor",
  parameters: {
    docs: {
      description: {
        component:
          "Una aplicación con **render en el servidor** (Next.js, cualquier SSR) dibuja el espacio de trabajo en el servidor y el navegador **hidrata** ese HTML: su primer dibujo tiene que ser el del servidor. Pero el servidor **no ve el hash** de la URL, así que un enlace (`#/w?p=…`) no puede estar en ese primer dibujo.\n\n`useWorkspace({ hash: true, serverRendered: true })` empieza donde dibujó el servidor —`initial`— y toma el lugar del enlace **una vez montado**: sin diferencias al hidratar, y con su miga si fue una recarga. Una aplicación de una sola página sigue con `useWorkspace({ hash: true })`, que lee la URL al crearse y muestra el enlace en su primer cuadro.\n\nAquí el «servidor» es `renderToString` sin el hash, y el navegador, `hydrateRoot` con el enlace en la URL.\n\nArrastrar paneles se carga **en el navegador**, cuando algo se monta, nunca al importar: el servidor no lo toca, y en el navegador un panel se arrastra a otro borde como siempre.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const ENLACE = toHash(push(EMPTY, asientoRef("FAC-2026-0014")));

/** La aplicación: la misma en el servidor y en el navegador. Llegar sin enlace abre los asientos,
 *  como una aplicación abre su inicio: el efecto ya ve el lugar del enlace. */
function Aplicacion() {
  const workspace = useWorkspace({ hash: true, serverRendered: true });
  useEffect(() => {
    if (workspace.get().page === null) workspace.start(ASIENTOS);
  }, [workspace]);
  return (
    /* Inline y no una clase: el sistema de diseño no admite valores arbitrarios. */
    <div
      style={{ height: "42rem" }}
      className="flex flex-col overflow-hidden border-y border-line-strong"
    >
      <Composer
        workspace={workspace}
        registry={REGISTRY}
        empty={<p className="p-4">Nada abierto todavía.</p>}
      />
    </div>
  );
}

/**
 * Lo que vive una aplicación con render en el servidor, en una sola página: el servidor la dibuja
 * sin el hash; el navegador abre el enlace e hidrata ese HTML. Dice si React encontró diferencias.
 */
function DelServidorAlNavegador() {
  const host = useRef<HTMLDivElement>(null);
  const [diferencias, setDiferencias] = useState<readonly string[] | null>(null);

  useEffect(() => {
    const el = host.current;
    if (el === null) return;
    const antes = { url: window.location.href, state: window.history.state as unknown };

    const pagina = document.createElement("div");
    pagina.innerHTML = renderToString(<Aplicacion />);
    /* La hoja del composer va al <head>, como en el documento entero que dibuja un servidor:
       dentro de la página se iría con ella, y la historia siguiente quedaría sin estilos. */
    document.head.append(...pagina.querySelectorAll("style[data-precedence]"));
    el.append(pagina);
    window.history.replaceState(null, "", ENLACE);

    const vistas: string[] = [];
    const raiz = hydrateRoot(pagina, <Aplicacion />, {
      onRecoverableError: (error) => {
        vistas.push(error instanceof Error ? error.message : String(error));
        setDiferencias([...vistas]);
      },
    });
    setDiferencias([]);
    return () => {
      window.history.replaceState(antes.state, "", antes.url);
      /* Después: desmontar otra raíz mientras React desmonta ésta es una carrera. */
      setTimeout(() => {
        raiz.unmount();
        pagina.remove();
      });
    };
  }, []);

  return (
    <>
      <p role="status" className="p-2 text-meta text-muted">
        {diferencias === null
          ? "Hidratando…"
          : diferencias.length === 0
            ? "Hidratado sin diferencias con el servidor"
            : `Difiere del servidor: ${diferencias.join(" · ")}`}
      </p>
      <div ref={host} />
    </>
  );
}

/** Un enlace a FAC-2026-0014: el servidor dibuja el espacio vacío, el navegador hidrata eso
 *  mismo y después abre el asiento — sin escribir nada sobre el enlace. */
export const UnEnlaceSinDiferencias: Story = {
  render: () => <DelServidorAlNavegador />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Conciliado con")).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Hidratado sin diferencias con el servidor",
    );
    await expect(window.location.hash).toBe(ENLACE);
  },
};

const arrastrar = (el: Element, type: string, data: DataTransfer) =>
  el.dispatchEvent(
    new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
  );

/** Montado, arrastrar ya está: el detalle del asiento, acoplado a la derecha, se lleva al borde
 *  izquierdo por su título. */
export const ArrastrarSeCargaEnElNavegador: Story = {
  render: () => <Demo initial={auditoria()} />,
  play: async ({ canvasElement }) => {
    const panel = await within(canvasElement).findByRole("region", {
      name: "Asiento seleccionado",
    });
    const titulo = panel.querySelector(".sc-header");
    const izquierda = canvasElement.querySelector(".sc-drop");
    const espacio = canvasElement.querySelector(".sc-root")?.getBoundingClientRect();
    if (titulo === null || izquierda === null || espacio === undefined)
      throw new Error("sin título, sin borde o sin espacio de trabajo");
    const mitad = espacio.left + espacio.width / 2;
    await waitFor(() => expect(panel.getBoundingClientRect().left).toBeGreaterThan(mitad));
    await waitFor(() => expect(titulo).toHaveAttribute("draggable", "true"));

    const datos = new DataTransfer();
    arrastrar(titulo, "dragstart", datos);
    await waitFor(() => expect(izquierda).toHaveAttribute("data-armed"));
    arrastrar(izquierda, "dragenter", datos);
    arrastrar(izquierda, "dragover", datos);
    await waitFor(() => expect(izquierda).toHaveAttribute("data-over"));
    arrastrar(izquierda, "drop", datos);
    arrastrar(titulo, "dragend", datos);

    await waitFor(() => expect(panel.getBoundingClientRect().left).toBeLessThan(mitad));
  },
};
