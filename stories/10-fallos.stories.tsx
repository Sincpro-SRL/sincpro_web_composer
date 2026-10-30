import {
  createRegistry,
  EMPTY,
  fromHash,
  openPanel,
  push,
  Zone,
} from "@sincpro/web-composer/domain/index";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Demo } from "./contabilidad/demo";
import { CONTABILIDAD } from "./contabilidad/dominio";
import { ASIENTOS } from "./contabilidad/vistas";

const meta: Meta = {
  title: "Casos de uso/10 · Cuando algo falla",
  parameters: {
    docs: {
      description: {
        component:
          "Un espacio de trabajo que la persona arma a su gusto **no puede romperse** por lo que otro dominio haga mal. Cada falla se queda en su propio panel y el resto sigue andando.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function Throws(): never {
  throw new Error("el dominio `roto` siempre lanza — a propósito");
}

const REGISTRY = createRegistry([
  ...CONTABILIDAD,
  {
    domain: "roto",
    kind: "cosa",
    title: () => "El dominio que lanza",
    load: async () => Throws,
  },
]);

/**
 * Un dominio que lanza al dibujarse y una referencia que nadie sabe resolver. La página sigue
 * funcionando. (Etiquetada `throws`: el smoke exige que falle, porque lo que documenta es el
 * aislamiento.)
 */
export const CadaFallaQuedaEnSuPanel: Story = {
  tags: ["throws"],
  render: () => {
    let w = push(EMPTY, ASIENTOS);
    w = openPanel(w, { domain: "roto", kind: "cosa" }, Zone.Right);
    w = openPanel(w, { domain: "nadie", kind: "cosa" }, Zone.Bottom);
    return <Demo initial={w} registry={REGISTRY} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Esta vista no se pudo dibujar")).toBeVisible();
    await expect(
      await canvas.findByText("Nadie sabe resolver esta referencia"),
    ).toBeVisible();
    await expect(await canvas.findByText("FAC-2026-0012")).toBeVisible();
  },
};

/** Un enlace viejo, cortado o editado a mano: se descarta lo inválido y se carga el resto. */
export const UnaUrlConBasuraSeCargaSinRomperse: Story = {
  render: () => (
    <Demo
      initial={fromHash(
        `#/w?p=contabilidad%3Aasiento%2FFAC-2026-0012&s=p1!%%%!r,1.00;p2!${encodeURIComponent("contabilidad:asientos")}!r,1.00&f=nope`,
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Conciliado con")).toBeVisible();
    await expect(await canvas.findByRole("region", { name: "Asientos" })).toBeVisible();
  },
};
