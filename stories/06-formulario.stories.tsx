import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Demo, facturaNueva } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/06 · En un formulario: relaciones",
  parameters: {
    docs: {
      description: {
        component:
          "**Many2one:** se elige tipeando; el botón **abrir** muestra el registro en una **ventana** sin salir del formulario (⇧clic: al lado); el botón **buscar** abre una lista que **responde** al campo (`api.pick` / `api.answer`) y se cierra sola. Lo que ya se escribió en el formulario no se pierde mientras tanto.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const ElegirAbrirYBuscar: Story = {
  render: () => <Demo initial={facturaNueva()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText("Notas"), "Servicio de octubre");

    const field = await canvas.findByRole("combobox", { name: "Contacto" });
    await userEvent.click(field);
    await userEvent.type(field, "glob");
    await userEvent.click(await canvas.findByRole("option", { name: /Globex/ }));
    await expect(field).toHaveValue("Globex Bolivia");

    await userEvent.click(canvas.getByRole("button", { name: "Abrir Contacto" }));
    await expect(await canvas.findByRole("region", { name: "Globex Bolivia" })).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Buscar Contacto" }));
    await userEvent.click(
      await canvas.findByRole("button", { name: "Elegir Initech Ltda." }),
    );
    await expect(field).toHaveValue("Initech Ltda.");
    await waitFor(() =>
      expect(canvas.queryByRole("region", { name: "Elegir contacto" })).toBeNull(),
    );
    await expect(canvas.getByLabelText("Notas")).toHaveValue("Servicio de octubre");
  },
};

/** Abrir la cuenta de ingresos muestra su libro de apuntes — también como ventana. */
export const AbrirLaCuenta: Story = {
  render: () => <Demo initial={facturaNueva()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Abrir Cuenta" }));
    await expect(
      await canvas.findByRole("region", { name: /Apuntes · Ingresos/ }),
    ).toBeVisible();
  },
};
