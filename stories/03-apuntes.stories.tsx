import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { Demo, libroDeApuntes } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/03 · Los apuntes: otra manera de ver los mismos asientos",
  parameters: {
    docs: {
      description: {
        component:
          "Los **asientos** son documentos (una factura, un pago, un extracto). Los **apuntes** son sus **líneas**, todas juntas: sirven para mirar el sistema contable por **cuenta** y ver cuánto se debitó y cuánto se acreditó. Cada fila de apuntes viene de un asiento, así que abrirla lleva a su asiento — como página, o en un vistazo sin perder el libro.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** El libro de «Cuentas por cobrar»: los totales de débito y crédito, y un apunte que abre su asiento. */
export const LibroDeUnaCuenta: Story = {
  render: () => <Demo initial={libroDeApuntes("1.1.2")} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Apuntes de 1\.1\.2/)).toBeVisible();
    await userEvent.click((await canvas.findAllByText("FAC-2026-0012"))[0]!);
    await expect(await canvas.findByText("Conciliado con")).toBeVisible();
    await expect(await canvas.findByRole("link", { name: /Apuntes/ })).toBeVisible();
  },
};
