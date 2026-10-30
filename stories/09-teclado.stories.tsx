import { composerCopy } from "@sincpro/web-composer";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { Demo, soloLaLista } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/09 · Todo con el teclado",
  parameters: {
    docs: {
      description: {
        component:
          "Quien trabaja ocho horas al día no quiere soltar el teclado. Los atajos hablan con el **espacio de trabajo**, no con el campo en el que se escribe: dentro de un campo sólo sobrevive Escape (y ⌘K), para no robarle una tecla a quien está tipeando.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function Shortcuts() {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-b border-line bg-surface px-4 py-3 text-micro">
      {composerCopy().shortcuts.map((s) => (
        <div key={s.keys} className="contents">
          <dt className="font-mono text-ink">{s.keys}</dt>
          <dd className="text-muted">{s.action}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Abre un asiento, vuelve con Alt+←, abre ⌘K con Ctrl+K y lo cierra con Escape. */
export const AtajosDelEspacio: Story = {
  render: () => (
    <div>
      <Shortcuts />
      <Demo initial={soloLaLista()} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("FAC-2026-0012"));
    await canvas.findByText("Conciliado con");

    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await expect(await canvas.findByText("FAC-2026-0015")).toBeVisible();

    await userEvent.keyboard("{Control>}k{/Control}");
    await expect(await canvas.findByRole("combobox")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("combobox")).toBeNull();
  },
};
