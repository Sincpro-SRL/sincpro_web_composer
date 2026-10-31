import { formatRef, push } from "@sincpro/web-composer/domain/index";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import { Demo, soloLaLista } from "./contabilidad/demo";
import { asientoRef, ASIENTOS } from "./contabilidad/vistas";

const meta: Meta = {
  title: "Casos de uso/14 · Un agente en el navegador (WebMCP)",
  parameters: {
    docs: {
      description: {
        component:
          "Con **WebMCP** la página le ofrece **herramientas** al agente del navegador. El composer ofrece las del espacio de trabajo (`<Composer agentTools>`: dónde estoy, abrir, buscar, hacer una acción) y cada vista las suyas (`useViewTool`), que viven mientras la vista está. El agente es una persona más en el escritorio: abre por el mismo camino y pregunta antes de tirar lo escrito. Sin WebMCP en el navegador no pasa nada. Esta historia instala un `document.modelContext` de mentira para mostrarlo.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type Tool = { name: string; execute: (input: object) => Promise<unknown> };
type Fake = { tools: Map<string, Tool> };

/** The browser's side of WebMCP, as the draft has it: register with a signal, abort to remove. */
function installModelContext(): () => void {
  const fake: Fake = { tools: new Map() };
  const modelContext = {
    registerTool: async (tool: Tool, options?: { signal?: AbortSignal }) => {
      fake.tools.set(tool.name, tool);
      options?.signal?.addEventListener("abort", () => fake.tools.delete(tool.name));
    },
  };
  Object.defineProperty(document, "modelContext", {
    value: modelContext,
    configurable: true,
  });
  (window as { fakeAgent?: Fake }).fakeAgent = fake;
  return () => {
    delete (document as { modelContext?: unknown }).modelContext;
    delete (window as { fakeAgent?: Fake }).fakeAgent;
  };
}

const agent = () => (window as unknown as { fakeAgent: Fake }).fakeAgent;
const PAGO = "registrar_pago.asiento-FAC-2026-0012";

export const HerramientasDelEscritorioYDeLaVista: Story = {
  beforeEach: installModelContext,
  render: () => (
    <Demo initial={push(soloLaLista(), asientoRef("FAC-2026-0012"))} agentTools />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(agent().tools.has(PAGO)).toBe(true));
    await expect([...agent().tools.keys()]).toEqual(
      expect.arrayContaining([
        "workspace.where",
        "workspace.open",
        "workspace.search",
        "workspace.act",
      ]),
    );

    const where = (await agent().tools.get("workspace.where")!.execute({})) as {
      page: { title: string };
    };
    await expect(where.page.title).toBe("FAC-2026-0012");

    await agent().tools.get(PAGO)!.execute({});
    await expect(
      await canvas.findByRole("dialog", { name: "Registrar pago de FAC-2026-0012" }),
    ).toBeVisible();

    await agent()
      .tools.get("workspace.open")!
      .execute({ ref: formatRef(ASIENTOS) });
    await waitFor(() => expect(agent().tools.has(PAGO)).toBe(false));
  },
};
