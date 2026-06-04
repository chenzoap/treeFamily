import { expect, test } from "@playwright/test";

const PASSWORD = "Test123456!";

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 100000)}@example.com`;
}

async function signup(page: import("@playwright/test").Page, email: string, password = PASSWORD) {
  await page.goto("/signup");
  await page.getByLabel(/Correo electrónico/i).fill(email);
  await page.getByLabel(/^Contraseña$/i).fill(password);
  await page.getByLabel(/Confirmar contraseña/i).fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

async function login(page: import("@playwright/test").Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel(/Correo electrónico/i).fill(email);
  await page.getByLabel(/Contraseña/i).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

async function createProfile(page: import("@playwright/test").Page) {
  await expect(page).toHaveURL(/\/create-profile$/);

  await page.getByLabel(/Nombre del árbol/i).fill("Familia E2E");
  await page.getByLabel(/Tu nombre/i).fill("Belgica");
  await page.getByLabel(/^Apellido/i).fill("Aragon");
  await page.getByLabel(/Fecha de nacimiento/i).fill("1986-07-31");
  await page.getByRole("button", { name: "Crear mi árbol" }).click();

  await expect(page).toHaveURL(/\/tree$/);
  await expect(page.getByRole("heading", { name: /Mi árbol familiar/i })).toBeVisible();
}

async function addParent(
  page: import("@playwright/test").Page,
  role: "padre" | "madre",
  firstName: string,
  lastName: string
) {
  const actionButtonName = role === "padre" ? "Agregar padre" : "Agregar madre";
  const saveButtonName = role === "padre" ? "Guardar padre" : "Guardar madre";
  const firstNamePlaceholder = role === "padre" ? "Nombre del padre *" : "Nombre de la madre *";

  await page.getByRole("button", { name: actionButtonName }).click();
  await page.getByPlaceholder(firstNamePlaceholder).fill(firstName);
  await page.getByPlaceholder("Apellido *").fill(lastName);
  await page.getByRole("button", { name: saveButtonName }).click();

  const successMessage = role === "padre" ? "Padre agregado al árbol." : "Madre agregada al árbol.";
  await expect(page.getByText(successMessage)).toBeVisible();
}

test.describe("MVP onboarding flow", () => {
  test("usuario nuevo crea perfil, agrega padres, los conecta e inicia sesión nuevamente", async ({ page }) => {
    const email = uniqueEmail("mvp.flow");

    await signup(page, email);
    await createProfile(page);

    await expect(page.getByText(/Tu árbol empezó contigo/i).first()).toBeVisible();

    await addParent(page, "padre", "Fernando", "Aragon");
    await addParent(page, "madre", "Palomino", "Salazar");

    await expect(page.getByText(/Ya agregaste padre y madre para Belgica Aragon/i)).toBeVisible();
    await expect(page.getByText(/Quieres conectar a Fernando Aragon y Palomino Salazar/i)).toBeVisible();
    await expect(page.getByText("Persona no encontrada")).toHaveCount(0);

    await page.getByRole("button", { name: "Conectarlos" }).click();
    await expect(page.getByText("Padre y madre conectados como pareja.")).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await login(page, email);
    await expect(page).toHaveURL(/\/tree$/);

    await expect(page.getByRole("heading", { name: /Mi árbol familiar/i })).toBeVisible();
    await expect(page.getByText("Persona no encontrada")).toHaveCount(0);
    await expect(page.getByLabel("Persona seleccionada")).toContainText(/Belgica Aragon/i);
  });

  test("signup con email repetido muestra error y no crea otro árbol", async ({ page }) => {
    const email = uniqueEmail("duplicate.email");

    await signup(page, email);
    await expect(page).toHaveURL(/\/create-profile$/);

    await page.goto("/signup");
    await page.getByLabel(/Correo electrónico/i).fill(email);
    await page.getByLabel(/^Contraseña$/i).fill(PASSWORD);
    await page.getByLabel(/Confirmar contraseña/i).fill(PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByText("Ya existe una cuenta con este correo. Inicia sesión.")).toBeVisible();
  });
});
