import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, within } from "storybook/test";

import { auditoria, Demo, soloLaLista } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/05 · Ventana libre",
  parameters: {
    docs: {
      description: {
        component:
          "Para **ver o hacer algo rápido** sin dejar lo que miro: una **ventana** que se arrastra por el título **a cualquier parte**, se redimensiona por los bordes y la esquina, se minimiza, se agranda — y, si resulta que hay que trabajar ahí, **crece a página**: el asiento pasa a ser la página y la miga recuerda de dónde venía.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const place = (el: HTMLElement) => ({
  left: parseFloat(el.style.left),
  top: parseFloat(el.style.top),
  width: parseFloat(el.style.width),
  height: parseFloat(el.style.height),
});

/** Abre una ventana desde el ícono de la fila, la arrastra por el título y la redimensiona por la esquina. */
export const MoverRedimensionarYAgrandar: Story = {
  render: () => <Demo initial={soloLaLista()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      (await canvas.findAllByRole("button", { name: /ventana|window/i }))[0]!,
    );

    const frame = await canvas.findByRole("region", { name: "FAC-2026-0012" });
    const slot = frame.parentElement!;
    const before = place(slot);

    const title = within(frame).getAllByText("FAC-2026-0012")[0]!;
    fireEvent.pointerDown(title, { pointerId: 1, clientX: 300, clientY: 100, button: 0 });
    fireEvent.pointerMove(title, { pointerId: 1, clientX: 520, clientY: 220 });
    fireEvent.pointerUp(title, { pointerId: 1, clientX: 520, clientY: 220 });
    const moved = place(slot);
    await expect(moved.left).toBeGreaterThan(before.left + 100);
    await expect(moved.top).toBeGreaterThan(before.top + 60);

    const grip = slot.querySelector<HTMLElement>('[data-grip="se"]')!;
    fireEvent.pointerDown(grip, { pointerId: 2, clientX: 900, clientY: 500, button: 0 });
    fireEvent.pointerMove(grip, { pointerId: 2, clientX: 1000, clientY: 560 });
    fireEvent.pointerUp(grip, { pointerId: 2, clientX: 1000, clientY: 560 });
    await expect(place(slot).width).toBeGreaterThan(before.width + 50);

    await userEvent.click(
      await within(frame).findByRole("button", { name: "Agrandar a página" }),
    );
    await expect(await canvas.findByRole("link", { name: "Asientos" })).toBeVisible();
  },
};

/** Dos ventanas a la vez: la que se toca sube al frente. */
export const VariasVentanas: Story = {
  render: () => <Demo initial={soloLaLista()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const windows = await canvas.findAllByRole("button", { name: /ventana|window/i });
    await userEvent.click(windows[0]!);
    await userEvent.click(windows[1]!);

    const a = (await canvas.findByRole("region", { name: "FAC-2026-0012" })).parentElement!;
    const b = (await canvas.findByRole("region", { name: "FAC-2026-0013" })).parentElement!;
    await expect(Number(b.style.zIndex)).toBeGreaterThan(Number(a.style.zIndex));

    await userEvent.click(within(a).getAllByText("FAC-2026-0012")[0]!);
    await expect(Number(a.style.zIndex)).toBeGreaterThanOrEqual(Number(b.style.zIndex));
  },
};

/** Minimizar el único panel de un costado lo deja en un riel de 36 px: la página recupera el lugar
 *  y no queda un hueco. Restaurarlo le devuelve su ancho. */
export const MinimizarDejaUnRiel: Story = {
  render: () => <Demo initial={auditoria()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = await canvas.findByRole("region", { name: "Asiento seleccionado" });
    const slot = frame.parentElement!;
    const before = slot.getBoundingClientRect().width;

    await userEvent.click(within(frame).getByRole("button", { name: "Minimizar" }));
    await expect(Math.round(slot.getBoundingClientRect().width)).toBe(36);
    await expect(canvas.queryByRole("separator", { name: /zona derecha/ })).toBeNull();

    await userEvent.click(within(frame).getByRole("button", { name: "Restaurar" }));
    await expect(Math.round(slot.getBoundingClientRect().width)).toBe(Math.round(before));
  },
};
