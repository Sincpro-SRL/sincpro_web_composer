import { Composer, useSection, useWorkspace, type Workspace } from "@sincpro/web-composer";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { REGISTRY, soloLaLista } from "./contabilidad/demo";
import { APUNTES_REF, ASIENTOS } from "./contabilidad/vistas";

const meta: Meta = {
  title: "Casos de uso/15 · El menú sabe dónde estás",
  parameters: {
    docs: {
      description: {
        component:
          "El menú es de la aplicación —sus grupos, sus íconos, lo que cada quien puede ver—; el composer sólo le dice **bajo qué entrada está la persona**: `useSection(workspace, entradas)`. Un menú **empieza** su entrada (`workspace.start`), así que la entrada sigue marcada mientras la persona entra más hondo: un asiento, uno de sus apuntes. Otra entrada empieza de nuevo. Un enlace directo a un registro no está bajo ninguna.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const MENU = [
  { label: "Asientos", ref: ASIENTOS },
  { label: "Apuntes", ref: APUNTES_REF },
];
/* Las mismas referencias del menú: `useSection` devuelve una de ellas, y se compara por identidad. */
const ENTRADAS = MENU.map((m) => m.ref);

function ConMenu({ initial }: { initial: Workspace }) {
  const workspace = useWorkspace({ initial });
  const actual = useSection(workspace, ENTRADAS);
  return (
    <div
      style={{ height: "42rem" }}
      className="flex flex-col overflow-hidden border-y border-line-strong"
    >
      <nav aria-label="Menú" className="flex gap-1 border-b border-line p-2">
        {MENU.map((m) => (
          <button
            key={m.label}
            type="button"
            aria-current={actual === m.ref ? "page" : undefined}
            onClick={() => workspace.start(m.ref)}
            className={`rounded-pill px-3 py-1 ${actual === m.ref ? "bg-primary/12 text-primary" : "text-muted"}`}
          >
            {m.label}
          </button>
        ))}
      </nav>
      <Composer workspace={workspace} registry={REGISTRY} />
    </div>
  );
}

/** Asientos → un asiento → el menú sigue en «Asientos»; «Apuntes» empieza de nuevo, sin miga. */
export const LaEntradaSigueMarcada: Story = {
  render: () => <ConMenu initial={soloLaLista()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const menu = await canvas.findByRole("navigation", { name: "Menú" });
    const asientos = within(menu).getByRole("button", { name: "Asientos" });
    const apuntes = within(menu).getByRole("button", { name: "Apuntes" });
    await expect(asientos).toHaveAttribute("aria-current", "page");

    await userEvent.click(await canvas.findByText("FAC-2026-0014"));
    await expect(await canvas.findByText("Conciliado con")).toBeVisible();
    await expect(asientos).toHaveAttribute("aria-current", "page");

    await userEvent.click(apuntes);
    await expect(apuntes).toHaveAttribute("aria-current", "page");
    await expect(asientos).not.toHaveAttribute("aria-current");
    await expect(canvas.queryByRole("link", { name: "Asientos" })).toBeNull();
  },
};
