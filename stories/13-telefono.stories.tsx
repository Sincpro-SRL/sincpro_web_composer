import type { Workspace } from "@sincpro/web-composer";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { auditoria, Demo, facturaNueva } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/13 · En el teléfono",
  parameters: {
    docs: {
      description: {
        component:
          "Cuando el espacio de trabajo es **angosto** (menos de 640 px, `phoneBelow`) es **una sola pantalla**: la página la ocupa toda; una **ventana** o un **panel lateral** se abren **como página**, con su miga para volver; un **selector** se abre como **hoja desde abajo**, para que el formulario siga ahí; el **vistazo** ocupa todo el ancho. Los paneles que ya estaban abiertos **esperan** en «También abiertos». Las vistas no cambian nada: lo decide el composer.",
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
