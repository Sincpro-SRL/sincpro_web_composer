import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Demo, soloLaLista } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/08 · Buscar sin salir de donde estoy: ⌘K",
  parameters: {
    docs: {
      description: {
        component:
          "Una sola búsqueda para todo: **Ir a** (las pantallas), **Hacer** (las acciones del registro en el que estoy) y **Encontrado** (lo que cada dominio halla; la búsqueda de asientos tarda un poco a propósito para ver «searching…»). El destino lo eliges al confirmar: **Enter** la página, **⌥Enter** un vistazo, **⇧Enter** al lado, **⌘Enter** una ventana.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** The palette searches after a pause and answers from a promise: state changes that no `act`
 *  can wrap. The browser does not care; the test harness warns. Turn its alarm off for these. */
const inBrowserMode = () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
};

/** Confirm with Enter as the browser delivers it. The harness wraps `userEvent.keyboard` in a
 *  synchronous `act`, inside which a lazily loaded view suspends — a warning no user can see. */
function confirm(
  canvas: ReturnType<typeof within>,
  mods: { altKey?: boolean; shiftKey?: boolean; ctrlKey?: boolean } = {},
) {
  canvas.getByRole("combobox").dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
      ...mods,
    }),
  );
}

async function open(canvas: ReturnType<typeof within>, query: string) {
  inBrowserMode();
  await userEvent.keyboard("{Control>}k{/Control}");
  await userEvent.type(await canvas.findByRole("combobox"), query);
}

export const EnterAbreLaPagina: Story = {
  render: () => <Demo initial={soloLaLista()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await open(canvas, "0013");
    await canvas.findByRole("option", { name: /FAC-2026-0013/ });
    confirm(canvas);
    await expect(await canvas.findByText("Conciliado con")).toBeVisible();
    await expect(await canvas.findByRole("link", { name: "Asientos" })).toBeVisible();
  },
};

export const ElDestinoSeEligeAlConfirmar: Story = {
  render: () => <Demo initial={soloLaLista()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await open(canvas, "0012");
    await canvas.findByRole("option", { name: /FAC-2026-0012/ });
    confirm(canvas, { altKey: true });
    await expect(await canvas.findByRole("complementary")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await open(canvas, "0013");
    await canvas.findByRole("option", { name: /FAC-2026-0013/ });
    confirm(canvas, { shiftKey: true });
    await expect(await canvas.findByRole("region", { name: "FAC-2026-0013" })).toBeVisible();

    await open(canvas, "0014");
    await canvas.findByRole("option", { name: /FAC-2026-0014/ });
    confirm(canvas, { ctrlKey: true });
    await expect(await canvas.findByRole("region", { name: "FAC-2026-0014" })).toBeVisible();
  },
};

/** Estando en un asiento, ⌘K ofrece lo que se puede HACER con él. */
export const AccionesDelRegistroEnFoco: Story = {
  render: () => <Demo initial={soloLaLista()} />,
  play: async ({ canvasElement }) => {
    inBrowserMode();
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("FAC-2026-0012"));
    await canvas.findByText("Conciliado con");
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.click(
      await canvas.findByRole("option", { name: /Ver los apuntes de este asiento/ }),
    );
    await waitFor(async () =>
      expect(
        await canvas.findByRole("region", { name: /Apuntes de FAC-2026-0012/ }),
      ).toBeVisible(),
    );
  },
};
