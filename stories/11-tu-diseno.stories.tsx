import { type ComposerSkin } from "@sincpro/web-composer";
import { Peek } from "@sincpro/web-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppWindow, ArrowLeft, Eye, PanelRight, Search, X } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";

import { auditoria, Demo } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/11 · Tu diseño sobre el composer",
  parameters: {
    docs: {
      description: {
        component:
          "El composer pone el **comportamiento** y una piel mínima para funcionar solo. El **diseño es de la app**: los colores van por variables `--sc-*`, y con `skin` se cambian los íconos y las piezas — acá, los íconos de lucide y el cajón `Peek` de web-ui. Lo que no se pasa queda como viene. El composer no importa nada de esto: lo recibe.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** La piel de una app que dibuja con web-ui y lucide. Una pieza por vez; el resto, por defecto. */
const SKIN: ComposerSkin = {
  icons: {
    close: X,
    back: ArrowLeft,
    search: Search,
    peek: Eye,
    right: PanelRight,
    window: AppWindow,
  },
  Peek: ({ title, onClose, actions, children }) => (
    <Peek open title={title} onClose={onClose} actions={actions}>
      {children}
    </Peek>
  ),
};

export const ConLaPielDeLaApp: Story = {
  render: () => <Demo initial={auditoria()} skin={SKIN} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = await canvas.findByRole("region", { name: "Asiento seleccionado" });
    await expect(frame.querySelector("svg.lucide")).not.toBeNull();

    const [link] = await canvas.findAllByRole("button", { name: /^FAC-2026-0012$/ });
    link!.focus();
    await userEvent.keyboard(" ");
    const drawer = await canvas.findByRole("complementary");
    await expect(within(drawer).getByText("vista previa")).toBeInTheDocument();
  },
};
