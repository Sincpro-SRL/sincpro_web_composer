import {
  openModal,
  openPanel,
  PEEK,
  peek,
  push,
  Zone,
} from "@sincpro/web-composer/domain/index";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";

import { Demo, soloLaLista } from "./contabilidad/demo";
import { asientoRef, FACTURA_NUEVA, pagoNuevo } from "./contabilidad/vistas";

const meta: Meta = {
  title: "Casos de uso/12 · Modal sobre una superficie",
  parameters: {
    docs: {
      description: {
        component:
          "Un **modal** es una ventanita sobre **la superficie que lo pidió** —la página, una ventana, un panel lateral o el vistazo— y bloquea **sólo esa**: el resto del espacio sigue respondiendo. Se **mueve por el título**, sin salirse de lo que cubre. Sabe **sobre qué está abierto** (`api.over`); lo que comparte con quien lo abrió viaja en su referencia y vuelve con `api.answer`. El desenfoque es opcional (`{ blur: true }`) y está apagado por defecto.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/** El formulario está en una ventana; buscar el contacto abre un modal SOBRE ESA ventana. La
 *  lista de la página sigue usable mientras tanto, el modal se mueve, y elegir llena el campo. */
export const SobreUnaVentana: Story = {
  render: () => <Demo initial={openPanel(soloLaLista(), FACTURA_NUEVA, Zone.Floating)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = await canvas.findByRole("region", { name: "Factura nueva" });
    await userEvent.click(within(frame).getByRole("button", { name: "Buscar Contacto" }));

    const modal = await within(frame).findByRole("dialog", { name: "Elegir contacto" });
    await expect(modal).toHaveFocus();
    await expect(frame.querySelector(".sc-body")).toHaveAttribute("inert");
    await expect(modal.closest(".sc-modal-scrim")).not.toHaveAttribute("data-blur");

    const page = canvasElement.querySelector<HTMLElement>("[data-page]")!;
    await expect(page).not.toHaveAttribute("inert");

    const title = within(modal).getByRole("heading", { name: "Elegir contacto" });
    fireEvent.pointerDown(title, { pointerId: 1, clientX: 300, clientY: 200, button: 0 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 340, clientY: 230 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 340, clientY: 230 });
    await expect(modal.style.transform).not.toBe("translate(0px, 0px)");

    await userEvent.click(
      within(modal).getByRole("button", { name: "Elegir Globex Bolivia" }),
    );
    await waitFor(() => expect(within(frame).queryByRole("dialog")).toBeNull());
    await expect(within(frame).getByRole("combobox", { name: "Contacto" })).toHaveValue(
      "Globex Bolivia",
    );
    await expect(frame.querySelector(".sc-body")).not.toHaveAttribute("inert");
  },
};

/** Un trámite corto sobre el registro de la página: el modal sabe sobre qué asiento está, puede
 *  desenfocar lo que cubre si la vista lo pide, y Escape lo cierra. */
export const SobreLaPaginaConDesenfoque: Story = {
  render: () => <Demo initial={push(soloLaLista(), asientoRef("FAC-2026-0012"))} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Registrar pago" }));

    const modal = await canvas.findByRole("dialog", {
      name: "Registrar pago de FAC-2026-0012",
    });
    await expect(await within(modal).findByText(/^Sobre FAC-2026-0012/)).toBeVisible();
    await expect(modal.closest(".sc-modal-scrim")).toHaveAttribute("data-blur");
    await expect(canvasElement.querySelector("[data-page]")).toHaveAttribute("inert");

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
    await expect(canvasElement.querySelector("[data-page]")).not.toHaveAttribute("inert");
    await expect(canvas.getByRole("button", { name: "Registrar pago" })).toHaveFocus();
  },
};

/** Sobre el vistazo: el modal cubre la página sobre la que está el cajón —el cajón no tiene un
 *  marco donde ponerlo— y el cajón queda bloqueado hasta que se cierra. Empieza abierto: lo que
 *  se mira acá es dónde se dibuja y qué bloquea. */
export const SobreElVistazo: Story = {
  render: () => (
    <Demo
      initial={openModal(
        peek(soloLaLista(), asientoRef("FAC-2026-0012")),
        PEEK,
        pagoNuevo("FAC-2026-0012"),
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const drawer = await canvas.findByRole("complementary");
    const modal = await canvas.findByRole("dialog", {
      name: "Registrar pago de FAC-2026-0012",
    });
    await expect(await within(modal).findByText(/^Sobre FAC-2026-0012/)).toBeVisible();
    await expect(drawer.parentElement).toHaveAttribute("inert");
    await expect(canvasElement.querySelector("[data-page]")).not.toHaveAttribute("inert");

    await userEvent.click(within(modal).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
    await expect(drawer.parentElement).not.toHaveAttribute("inert");
  },
};
