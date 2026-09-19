import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const password = "Test123456!";
async function createTree(page: import("@playwright/test").Page) {
  const email = `ux.cut.${randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel(/Correo electrónico/i).fill(email);
  await page.getByLabel(/^Contraseña$/i).fill(password);
  await page.getByLabel(/Confirmar contraseña/i).fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/create-profile$/);
  await page.getByLabel(/Nombre del árbol/i).fill("Familia UX");
  await page.getByLabel(/Tu nombre/i).fill("Ana");
  await page.getByLabel(/^Apellido/i).fill("Prueba");
  await page.getByLabel(/Fecha de nacimiento/i).fill("1986-07-31");
  await page.getByRole("button", { name: "Crear mi árbol" }).click();
  await expect(page).toHaveURL(/\/tree$/);
}

test.describe("corte UX/UI imprescindible", () => {
  test("mantiene una vista utilizable en todos los viewports auditados", async ({ page }) => {
    await createTree(page);
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 375, height: 812 },
      { width: 320, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const mobile = viewport.width < 768;
      const main = page.locator("main");
      if (mobile) {
        await expect(page.getByRole("tab", { name: "Árbol" })).toBeVisible();
        await page.getByRole("tab", { name: "Árbol" }).click();
      }
      await expect(main).toBeVisible();
      expect(await main.boundingBox()).not.toBeNull();
      expect((await main.boundingBox())!.width).toBeGreaterThan(0);
      if (mobile) {
        await page.getByRole("tab", { name: "Panel" }).click();
        await expect(page.locator("aside")).toBeVisible();
      }
    }
  });

  test("asocia PersonFields, protege el borrador y devuelve foco desde diálogo", async ({ page }) => {
    await createTree(page);
    await page.getByRole("button", { name: "Agregar padre" }).click();
    const firstName = page.getByLabel("Nombre del padre");
    const lastName = page.getByRole("textbox", { name: "Apellido", exact: true });
    await expect(firstName).toHaveAttribute("required", "");
    await expect(firstName).toHaveAttribute("name", /firstName/);
    await expect(lastName).toHaveAttribute("required", "");
    await firstName.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByText("Ingresa apellido.")).toBeVisible();

    await firstName.fill("Padre");
    await lastName.fill("Prueba");
    await page.getByRole("button", { name: "Guardar padre" }).click();
    await expect(page.getByText("Padre agregado al árbol.")).toBeVisible();
    await page.getByRole("button", { name: "Editar persona" }).click();
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Borrador");
    await page.getByRole("combobox", { name: "Selecciona una persona" }).selectOption({ label: "Padre Prueba" });
    await expect(page.getByRole("alertdialog", { name: "Tienes cambios sin guardar" })).toBeVisible();
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("combobox", { name: "Selecciona una persona" }).selectOption({ label: "Padre Prueba" });
    const trigger = page.getByRole("button", { name: "Eliminar persona" });
    await trigger.focus();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "¿Eliminar a Padre Prueba?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});
