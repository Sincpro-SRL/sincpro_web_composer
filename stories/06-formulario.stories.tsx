import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Demo, facturaDesdeLaLista, facturaNueva } from "./contabilidad/demo";

const meta: Meta = {
  title: "Casos de uso/06 · En un formulario: relaciones",
  parameters: {
    docs: {
      description: {
        component:
          "**Many2one:** se elige tipeando; el botón **abrir** muestra el registro en una **ventana** sin salir del formulario (⇧clic: al lado); el botón **buscar** abre, en un **modal sobre el formulario**, una lista que **responde** al campo (`api.pick` / `api.answer`) y se cierra sola. Lo que ya se escribió en el formulario no se pierde mientras tanto.",
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
