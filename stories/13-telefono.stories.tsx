import { usePhone, type ViewProps, type Workspace } from "@sincpro/web-composer";
import { createRegistry, Destination, EMPTY, push } from "@sincpro/web-composer/domain/index";
import { Button } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { auditoria, Demo, facturaNueva } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/13 · En el teléfono",
  parameters: {
    docs: {
      description: {
        component:
          "Cuando el espacio de trabajo es **angosto** (menos de 640 px, `phoneBelow`) es **una sola pantalla**: la página la ocupa toda; una **ventana** o un **panel lateral** se abren **como página**, con su miga para volver; un **selector** se abre como **hoja desde abajo**, para que el formulario siga ahí; el **vistazo** ocupa todo el ancho. Los paneles que ya estaban abiertos **esperan** en «También abiertos». Las vistas no cambian nada: lo decide el composer.\n\nSi una vista quiere saberlo —para no ofrecer «abrir al lado» donde nada se abre al lado— lo pregunta con `usePhone(api)`. Cómo se **dibuja** a un ancho lo decide su CSS con `@container sc-view`: la página, un panel, el vistazo y el modal son contenedores, y un panel lateral es angosto también en el escritorio.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** El ancho de un teléfono. Inline porque el sistema de diseño no admite valores arbitrarios. */
const Telefono = ({ initial }: { initial: Workspace }) => (
  <div style={{ width: 380 }}>
    <Demo initial={initial} />
  </div>
);

/** «Abrir» la cuenta desde el formulario pide una ventana; en el teléfono es la página, con la
 *  miga para volver al formulario. */
export const UnaSolaPantalla: Story = {
  render: () => <Telefono initial={facturaNueva()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvasElement.querySelector(".sc-root")).toHaveAttribute("data-phone"),
    );
    await userEvent.click(await canvas.findByRole("button", { name: "Abrir Cuenta" }));

    await expect(await canvas.findByRole("link", { name: "Factura nueva" })).toBeVisible();
    await expect(canvas.queryByRole("region")).toBeNull();
    await expect(canvas.queryByRole("separator")).toBeNull();
  },
};

/** Buscar un contacto desde el formulario: una hoja desde abajo que responde al campo. */
export const ElegirEnUnaHoja: Story = {
  render: () => <Telefono initial={facturaNueva()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Buscar Contacto" }));

    const sheet = await canvas.findByRole("dialog", { name: "Elegir contacto" });
    await expect(sheet.closest(".sc-modal-scrim")).toHaveAttribute("data-phone");
    await userEvent.click(
      await within(sheet).findByRole("button", { name: "Elegir Initech Ltda." }),
    );
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
    await expect(canvas.getByRole("combobox", { name: "Contacto" })).toHaveValue(
      "Initech Ltda.",
    );
  },
};

/** El escritorio tenía un panel al lado: en el teléfono espera en «También abiertos», y un toque
 *  lo trae a la página. */
export const LosPanelesEsperan: Story = {
  render: () => <Telefono initial={auditoria()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dock = await canvas.findByRole("navigation", { name: "También abiertos" });
    await expect(canvas.queryByRole("region", { name: "Asiento seleccionado" })).toBeNull();

    await userEvent.click(within(dock).getByRole("button", { name: "Asiento seleccionado" }));
    await waitFor(() =>
      expect(canvas.queryByRole("navigation", { name: "También abiertos" })).toBeNull(),
    );
    await expect(
      await canvas.findByText("Marca un apunte y verás aquí su asiento."),
    ).toBeVisible();
    await expect(canvas.queryByRole("region")).toBeNull();
  },
};

/* ── Una vista que se adapta: lo que ofrece y cómo se dibuja ──────────── */

const FICHA = { domain: "ficha", kind: "ficha" };
const AL_LADO = { domain: "ficha", kind: "ficha", id: "al-lado" };

/** Dos columnas si SU ancho alcanza: la regla mira el contenedor de la vista, no la ventana. */
const COLUMNAS = `
.ficha-columnas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
@container sc-view (width < 640px) { .ficha-columnas { grid-template-columns: 1fr; } }
`;

function Ficha({ resource, api }: ViewProps) {
  const phone = usePhone(api);
  /* No el título del panel: su marco ya es una región con ese nombre. */
  const nombre = resource.id === undefined ? "Datos de la página" : "Datos del panel";
  return (
    <section aria-label={nombre} className="flex flex-col gap-3 p-4">
      <style href="ficha-columnas" precedence="default">
        {COLUMNAS}
      </style>
      <p>{phone ? "Una sola pantalla" : "Escritorio"}</p>
      <div className="ficha-columnas" data-columnas="">
        <span>Nombre</span>
        <span>Correo</span>
      </div>
      {phone || resource.id !== undefined ? null : (
        <Button onClick={() => api.open(AL_LADO, { to: Destination.Side })}>
          Abrir al lado
        </Button>
      )}
    </section>
  );
}

const FICHAS = createRegistry([
  {
    domain: "ficha",
    kind: "ficha",
    title: (ref) => (ref.id === undefined ? "Ficha" : "Ficha al lado"),
    load: async () => Ficha,
  },
]);

function Angostable() {
  const [ancho, setAncho] = useState(960);
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => setAncho(ancho === 960 ? 380 : 960)}>
        {ancho === 960 ? "Angostar" : "Ensanchar"}
      </Button>
      <div style={{ width: ancho }}>
        <Demo initial={push(EMPTY, FICHA)} registry={FICHAS} />
      </div>
    </div>
  );
}

const columnasDe = (vista: HTMLElement) =>
  getComputedStyle(vista.querySelector("[data-columnas]")!).gridTemplateColumns.split(" ")
    .length;

/** En el escritorio la ficha de la página va a dos columnas y ofrece «abrir al lado»; la del
 *  panel lateral, angosto, va a una columna aunque no sea un teléfono. Angostada, la de la página
 *  también va a una, y deja de ofrecer lo que en un teléfono no existe. */
export const LaVistaSeAdapta: Story = {
  render: () => <Angostable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const principal = await canvas.findByRole("region", { name: "Datos de la página" });
    await expect(within(principal).getByText("Escritorio")).toBeVisible();
    await expect(columnasDe(principal)).toBe(2);

    await userEvent.click(within(principal).getByRole("button", { name: "Abrir al lado" }));
    const lado = await canvas.findByRole("region", { name: "Datos del panel" });
    await expect(within(lado).getByText("Escritorio")).toBeVisible();
    await expect(columnasDe(lado)).toBe(1);

    await userEvent.click(canvas.getByRole("button", { name: "Angostar" }));
    await expect(await within(principal).findByText("Una sola pantalla")).toBeVisible();
    await expect(columnasDe(principal)).toBe(1);
    await expect(
      within(principal).queryByRole("button", { name: "Abrir al lado" }),
    ).toBeNull();
  },
};
