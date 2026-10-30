import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { auditoria, Demo } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/07 · Auditar: el detalle sigue a la selección",
  parameters: {
    docs: {
      description: {
        component:
          "Auditar es recorrer apuntes y mirar su asiento. La **página** son todos los apuntes; el **panel de la derecha** muestra el asiento del apunte marcado, sin que ninguna de las dos vistas conozca a la otra: la lista **publica su selección** (`api.select`) y el panel la **lee del contexto**. Desde el panel, un clic en la cuenta abre su libro al lado, y el asiento se puede llevar a página.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const MarcarYVerElAsiento: Story = {
  render: () => <Demo initial={auditoria()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Marca un apunte/)).toBeVisible();

    const rows = await canvas.findAllByRole("checkbox");
    await userEvent.click(rows[1]!);
    const panel = within(await canvas.findByRole("region", { name: "Asiento seleccionado" }));
    await expect(await panel.findByText(/Cuentas por cobrar|Banco/)).toBeVisible();

    await userEvent.click(rows[1]!);
    await expect(await panel.findByText(/Marca un apunte/)).toBeVisible();
  },
};
