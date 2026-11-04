import { EMPTY, push } from "@sincpro/web-composer/domain/index";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Demo, facturaDesdeLaLista, facturaNueva } from "./contabilidad/demo";
import { elegir } from "./contabilidad/vistas";

const meta: Meta = {
  title: "Casos de uso/06 · En un formulario: relaciones",
  parameters: {
    docs: {
      description: {
        component:
          "**Many2one:** se elige tipeando; el botón **abrir** muestra el registro en una **ventana** sin salir del formulario (⇧clic: al lado); el botón **buscar** abre, en un **modal sobre el formulario**, una lista que **responde** al campo (`api.pick` / `api.answer`) y se cierra sola. La lista **sabe que la abrieron para elegir** (`api.choosing`) y qué le preguntan (`question`: el valor actual), sin nada en la URL; abierta con un enlace, es una lista para mirar. Lo que ya se escribió en el formulario no se pierde mientras tanto.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const ElegirAbrirYBuscar: Story = {
  render: () => <Demo initial={facturaNueva()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText("Notas"), "Servicio de octubre");

    const field = await canvas.findByRole("combobox", { name: "Contacto" });
    await userEvent.click(field);
    await userEvent.type(field, "glob");
    await userEvent.click(await canvas.findByRole("option", { name: /Globex/ }));
    await expect(field).toHaveValue("Globex Bolivia");

    await userEvent.click(canvas.getByRole("button", { name: "Abrir Contacto" }));
    const record = await canvas.findByRole("region", { name: "Globex Bolivia" });
    await expect(record).toBeVisible();
    await expect(record.parentElement!.style.width).toBe("560px");

    await userEvent.click(canvas.getByRole("button", { name: "Buscar Contacto" }));
    await userEvent.click(
      await canvas.findByRole("button", { name: "Elegir Initech Ltda." }),
    );
    await expect(field).toHaveValue("Initech Ltda.");
    await waitFor(() =>
      expect(canvas.queryByRole("dialog", { name: "Elegir contacto" })).toBeNull(),
    );
    await expect(canvas.getByLabelText("Notas")).toHaveValue("Servicio de octubre");
  },
};

/** El buscador sabe que lo abrieron para elegir, y el campo le dijo qué valor tiene: lo marca
 *  como «actual» en vez de ofrecerlo otra vez. Nada de eso viaja en la referencia. */
export const ElBuscadorSabeQueElige: Story = {
  render: () => <Demo initial={facturaNueva()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole("combobox", { name: "Contacto" });
    await userEvent.click(field);
    await userEvent.type(field, "glob");
    await userEvent.click(await canvas.findByRole("option", { name: /Globex/ }));

    await userEvent.click(canvas.getByRole("button", { name: "Buscar Contacto" }));
    const modal = within(await canvas.findByRole("dialog", { name: "Elegir contacto" }));
    await expect(await modal.findByText("actual")).toBeVisible();
    await expect(modal.queryByRole("button", { name: "Elegir Globex Bolivia" })).toBeNull();
    await expect(modal.getByRole("button", { name: "Elegir Initech Ltda." })).toBeVisible();
    await expect(modal.queryByRole("button", { name: /^Abrir / })).toBeNull();
  },
};

/** La misma lista abierta con un enlace — o tras recargar — no tiene a quién responder: nadie
 *  espera. Es una lista para mirar, y cada fila abre su registro. */
export const LaMismaListaParaMirar: Story = {
  render: () => <Demo initial={push(EMPTY, elegir("contacto"))} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Abrir Initech Ltda." }));
    await expect(await canvas.findByRole("region", { name: "Initech Ltda." })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /^Elegir / })).toBeNull();
  },
};

/** Abrir la cuenta de ingresos muestra su libro de apuntes — también como ventana. */
export const AbrirLaCuenta: Story = {
  render: () => <Demo initial={facturaNueva()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Abrir Cuenta" }));
    await expect(
      await canvas.findByRole("region", { name: /Apuntes · Ingresos/ }),
    ).toBeVisible();
  },
};

/** Un formulario a medio llenar no se pierde con un clic en la miga: el espacio pregunta antes. */
export const FormularioSucioPregunta: Story = {
  render: () => <Demo initial={facturaDesdeLaLista()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.type(await canvas.findByLabelText("Notas"), "Servicio de octubre");

    await userEvent.click(canvas.getByRole("link", { name: "Asientos" }));
    const ask = await page.findByRole("dialog", { name: "¿Descartar los cambios?" });
    await userEvent.click(within(ask).getByRole("button", { name: "Seguir editando" }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    await expect(canvas.getByLabelText("Notas")).toHaveValue("Servicio de octubre");

    await userEvent.click(canvas.getByRole("button", { name: "Descartar" }));
    await userEvent.click(
      within(await page.findByRole("dialog")).getByRole("button", { name: "Descartar" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "Asientos contables" }),
    ).toBeVisible();
  },
};

/** Un alta no tiene nombre hasta que se llena: con el contacto elegido, la miga que dibuja el
 *  propio formulario dice a quién es la factura, en vez de «Factura nueva». */
export const ElNombreLlegaALaMiga: Story = {
  render: () => <Demo initial={facturaDesdeLaLista()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const here = () => canvasElement.querySelector('[data-page] [aria-current="page"]');
    await waitFor(() => expect(here()).toHaveTextContent("Factura nueva"));

    const field = await canvas.findByRole("combobox", { name: "Contacto" });
    await userEvent.click(field);
    await userEvent.type(field, "glob");
    await userEvent.click(await canvas.findByRole("option", { name: /Globex/ }));

    await waitFor(() => expect(here()).toHaveTextContent("Factura a Globex Bolivia"));
    await expect(canvas.getByRole("link", { name: "Asientos" })).toBeVisible();
  },
};
