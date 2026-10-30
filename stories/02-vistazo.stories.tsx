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
