import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Demo, soloLaLista } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/02 · Revisar sin abrir: el vistazo",
  parameters: {
    docs: {
      description: {
        component:
          "Revisar treinta asientos no debería ser abrir treinta páginas. El control de **mirar** de cada fila abre un **vistazo**: un cajón de lectura que no tapa la lista. Desde él se puede **abrir como página** o **fijarlo al lado**. Esc lo cierra.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const MirarYDecidir: Story = {
  render: () => <Demo initial={soloLaLista()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [first] = await canvas.findAllByRole("button", { name: /^vistazo$/i });
    await userEvent.click(first!);
    const drawer = within(await canvas.findByRole("complementary"));
    await expect(await drawer.findByText("Conciliado con")).toBeInTheDocument();

    await userEvent.click(await drawer.findByRole("button", { name: "Abrir como página" }));
    await waitFor(() => expect(canvas.queryByRole("complementary")).toBeNull());
    await expect(await canvas.findByRole("link", { name: "Asientos" })).toBeVisible();
  },
};

/** El vistazo es un cajón sobre ESTA página: si la página pasa a otro asiento, se cierra. */
export const SeCierraAlCambiarLaPagina: Story = {
  render: () => <Demo initial={soloLaLista()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [first] = await canvas.findAllByRole("button", { name: /^vistazo$/i });
    await userEvent.click(first!);
    await canvas.findByRole("complementary");

    const names = await canvas.findAllByRole("button", { name: /^FAC-2026-0013$/ });
    await userEvent.click(names[0]!);
    await waitFor(() => expect(canvas.queryByRole("complementary")).toBeNull());
    await expect(await canvas.findByRole("link", { name: "Asientos" })).toBeVisible();
  },
};

/** Dentro del vistazo un clic ENTRA en el cajón, y «Volver a…» regresa: leer no saca de la lista. */
export const EntrarYVolverEnElVistazo: Story = {
  render: () => <Demo initial={soloLaLista()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = await canvas.findAllByRole("button", { name: /^vistazo$/i });
    await userEvent.click(rows[2]!);
    const drawer = within(await canvas.findByRole("complementary"));
    const title = () => drawer.getAllByRole("heading", { level: 2 })[0]!;
    await waitFor(() => expect(title()).toHaveTextContent("FAC-2026-0014"));

    await userEvent.click(await drawer.findByRole("button", { name: "PAG-2026-0007" }));
    await waitFor(() => expect(title()).toHaveTextContent("PAG-2026-0007"));

    await userEvent.click(drawer.getByRole("button", { name: "Volver a FAC-2026-0014" }));
    await waitFor(() => expect(title()).toHaveTextContent("FAC-2026-0014"));
    await expect(
      await canvas.findByRole("heading", { name: "Asientos contables" }),
    ).toBeVisible();
  },
};

/** Escape cierra lo de más adentro: el menú dentro del vistazo primero, el vistazo después. */
export const EscapeSobreUnMenuDelVistazo: Story = {
  render: () => <Demo initial={soloLaLista()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const [first] = await canvas.findAllByRole("button", { name: /^vistazo$/i });
    await userEvent.click(first!);
    const drawer = within(await canvas.findByRole("complementary"));

    await userEvent.click(await drawer.findByRole("button", { name: /Más del asiento/ }));
    await page.findByRole("menu");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("menu")).toBeNull());
    await expect(canvas.getByRole("complementary")).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.queryByRole("complementary")).toBeNull());
  },
};
