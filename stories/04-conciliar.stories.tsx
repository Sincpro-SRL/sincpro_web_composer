import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { conciliacion, Demo } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/04 · Dos contextos a la vez: conciliar",
  parameters: {
    docs: {
      description: {
        component:
          "La página es el **extracto bancario** (N líneas); al lado hay un **panel con lo pendiente de cobrar** que no sabe de dónde viene la línea: lee del contexto la **referencia** marcada. Marcar una línea cambia el panel; conciliar actualiza las dos listas. Dos vistas, quizá de dos equipos, hablando sólo por referencias.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** The checkbox of the row that shows `line`. web-ui names every one «Elegir la fila», so the
 *  row — not the name — says which line it is. */
async function lineCheckbox(canvasElement: HTMLElement, line: string) {
  const cell = await within(canvasElement).findByText(line);
  return within(cell.closest("tr")!).getByRole("checkbox");
}

/** Marca la línea de 1.250,00: el panel propone la factura de ACME que coincide; conciliar las saca de lo pendiente. */
export const MarcarYConciliar: Story = {
  render: () => <Demo initial={conciliacion()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Marca una línea/)).toBeVisible();

    await userEvent.click(await lineCheckbox(canvasElement, "EXT-2026-0031"));
    await expect(await canvas.findByText("coincide")).toBeVisible();

    await userEvent.click(
      await canvas.findByRole("button", { name: "Conciliar con FAC-2026-0012" }),
    );
    await waitFor(() => expect(canvas.queryByText("EXT-2026-0031")).toBeNull());
    await expect(await canvas.findByText(/Marca una línea/)).toBeVisible();
  },
};

/** La línea de 700,00 no tiene con qué conciliarse. */
export const SinCoincidencias: Story = {
  render: () => <Demo initial={conciliacion()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await lineCheckbox(canvasElement, "EXT-2026-0033"));
    await expect((await canvas.findAllByText(/700,00/)).length).toBeGreaterThan(0);
    await expect(canvas.queryByText("coincide")).toBeNull();
  },
};
