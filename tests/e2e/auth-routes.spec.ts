import { expect, test } from "@playwright/test";

test.describe("Auth routes", () => {
  test("muestra las páginas de signup y login", async ({ page }) => {
    await page.goto("/signup");

    await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible();
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/^Contraseña$/i)).toBeVisible();
    await expect(page.getByLabel(/Confirmar contraseña/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();

    await page.getByRole("link", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Inicia sesión" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Crear cuenta" })).toBeVisible();
  });

  test("redirige a login cuando un usuario no autenticado intenta entrar a tree", async ({ page }) => {
    await page.goto("/tree");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Inicia sesión" })).toBeVisible();
  });
});
