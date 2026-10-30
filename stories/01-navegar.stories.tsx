import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { Demo, soloLaLista } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/01 · Navegar: de la lista al asiento y al apunte",
  parameters: {
    docs: {
      description: {
        component:
          "**N registros → UN registro → una de sus líneas → otro registro.** Es la capa más simple y la que usa todo el mundo: abrir algo es una **página** y la **miga** que dibuja la propia vista (`List.Crumbs`, `Record.Crumbs`) guarda el camino. Un clic en cualquier nivel vuelve a él. Sin paneles, sin ventanas: el composer es sólo navegación.\n\nLa vista recibe el camino con `api.crumbs()`; no sabe qué hay detrás de cada miga.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** Asientos → FAC-2026-0014 → su pago (conciliado con él) → y de vuelta por la miga. */
export const DeLaListaAlAsientoYDeVuelta: Story = {
  render: () => <Demo initial={soloLaLista()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("FAC-2026-0014"));
    await expect(await canvas.findByText("Conciliado con")).toBeVisible();

    await userEvent.click(await canvas.findByRole("button", { name: "PAG-2026-0007" }));
    await expect(await canvas.findByRole("link", { name: "FAC-2026-0014" })).toBeVisible();
    await expect(await canvas.findByRole("link", { name: "Asientos" })).toBeVisible();

    await userEvent.click(await canvas.findByRole("link", { name: "Asientos" }));
    await expect(await canvas.findByText("FAC-2026-0015")).toBeVisible();
  },
};
