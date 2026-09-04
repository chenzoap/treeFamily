import {expect, test, type Locator, type Page} from "@playwright/test";

const PASSWORD = "Test123456!";

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 100000)}@example.com`;
}

function personSelector(page: Page): Locator {
  return page.getByRole("combobox", {name: "Selecciona una persona"});
}

function relationshipRow(page: Page, label: string): Locator {
  return page.getByRole("listitem").filter({hasText: label});
}

async function createIsolatedTree(
  page: Page,
  prefix: string,
  rootFirstName: string,
  rootLastName: string
): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel(/Correo electrónico/i).fill(uniqueEmail(prefix));
  await page.getByLabel(/^Contraseña$/i).fill(PASSWORD);
  await page.getByLabel(/Confirmar contraseña/i).fill(PASSWORD);
  await page.getByRole("button", {name: "Crear cuenta"}).click();

  await expect(page).toHaveURL(/\/create-profile$/);
  await page.getByLabel(/Nombre del árbol/i).fill(`Familia ${prefix}`);
  await page.getByLabel(/Tu nombre/i).fill(rootFirstName);
  await page.getByLabel(/^Apellido/i).fill(rootLastName);
  await page.getByLabel(/Fecha de nacimiento/i).fill("1990-01-15");
  await page.getByRole("button", {name: "Crear mi árbol"}).click();

  await expect(page).toHaveURL(/\/tree$/);
  await expect(page.getByRole("heading", {name: /Mi árbol familiar/i})).toBeVisible();
  await expect(personSelector(page).locator("option:checked")).toHaveText(
    `${rootFirstName} ${rootLastName}`
  );
}

async function fillRelative(page: Page, firstName: string, lastName: string): Promise<void> {
  await page.getByPlaceholder("Nombre *", {exact: true}).fill(firstName);
  await page.getByPlaceholder("Apellido *", {exact: true}).fill(lastName);
}

async function addParent(
  page: Page,
  role: "padre" | "madre",
  firstName: string,
  lastName: string
): Promise<void> {
  const action = role === "padre" ? "Agregar padre" : "Agregar madre";
  const save = role === "padre" ? "Guardar padre" : "Guardar madre";
  const notice = role === "padre" ? "Padre agregado al árbol." : "Madre agregada al árbol.";

  await page.getByRole("button", {name: action}).click();
  await fillRelative(page, firstName, lastName);
  await page.getByRole("button", {name: save}).click();
  await expect(page.getByText(notice)).toBeVisible();
  await expect(personSelector(page).locator("option", {hasText: `${firstName} ${lastName}`})).toHaveCount(1);
}

async function addPartner(
  page: Page,
  firstName: string,
  lastName: string
): Promise<void> {
  await page.getByRole("button", {name: "Agregar pareja"}).click();
  await page.getByLabel("Estado de la relación").selectOption("current");
  await fillRelative(page, firstName, lastName);
  await page.getByRole("button", {name: "Crear y relacionar pareja"}).click();
  await expect(page.getByText("Pareja actual agregada al árbol.")).toBeVisible();
  await expect(personSelector(page).locator("option", {hasText: `${firstName} ${lastName}`})).toHaveCount(1);
}

async function selectPerson(page: Page, name: string): Promise<void> {
  await personSelector(page).selectOption({label: name});
  await expect(personSelector(page).locator("option:checked")).toHaveText(name);
}

test.describe("Mantenimiento seguro de Etapa 8", () => {
  test("edita una persona y conserva la selección", async ({page}) => {
    const rootName = "Raiz Edicion";
    const originalName = "Padre Original";
    const updatedName = "Padre Actualizado";

    await createIsolatedTree(page, "stage8.edit", "Raiz", "Edicion");
    await addParent(page, "padre", "Padre", "Original");
    await selectPerson(page, originalName);

    await page.getByRole("button", {name: "Editar persona"}).click();
    await page.getByLabel(/^Nombre$/).fill("Padre");
    await page.getByLabel(/^Apellido$/).fill("Actualizado");
    await page.getByRole("button", {name: "Guardar cambios"}).click();

    await expect(page.getByText("Información actualizada correctamente.")).toBeVisible();
    await expect(personSelector(page).locator("option:checked")).toHaveText(updatedName);
    await expect(personSelector(page).locator("option", {hasText: originalName})).toHaveCount(0);
    await expect(personSelector(page).locator("option", {hasText: rootName})).toHaveCount(1);
  });

  test("elimina una persona no-root y protege la raíz", async ({page}) => {
    const rootName = "Raiz Eliminacion";
    const deletedName = "Familiar Eliminable";

    await createIsolatedTree(page, "stage8.delete-person", "Raiz", "Eliminacion");
    await addParent(page, "padre", "Familiar", "Eliminable");
    await selectPerson(page, deletedName);

    await page.getByRole("button", {name: "Eliminar persona"}).click();
    const dialog = page.getByRole("dialog", {name: `¿Eliminar a ${deletedName}?`});
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", {name: "Eliminar persona"}).click();

    await expect(page.getByText("Persona eliminada correctamente.")).toBeVisible();
    await expect(personSelector(page).locator("option", {hasText: deletedName})).toHaveCount(0);
    await expect(personSelector(page).locator("option:checked")).toHaveText(rootName);
    await expect(page.locator("svg title").filter({hasText: deletedName})).toHaveCount(0);
    await expect(page.locator("svg title").filter({hasText: rootName})).toHaveCount(1);
    await expect(page.getByRole("button", {name: "Eliminar persona"})).toBeDisabled();
    await expect(page.getByText("La persona principal del árbol no puede eliminarse.")).toBeVisible();
  });

  test("quita una filiación sin eliminar personas", async ({page}) => {
    const rootName = "Hija Filiacion";
    const fatherName = "Padre Filiacion";
    const motherName = "Madre Filiacion";
    const fatherLabel = `Hijo/a de ${fatherName}`;
    const motherLabel = `Hijo/a de ${motherName}`;

    await createIsolatedTree(page, "stage8.unlink-parent", "Hija", "Filiacion");
    await addParent(page, "padre", "Padre", "Filiacion");
    await addParent(page, "madre", "Madre", "Filiacion");

    const fatherRow = relationshipRow(page, fatherLabel);
    await fatherRow.getByRole("button", {name: "Quitar relación"}).click();
    let dialog = page.getByRole("dialog", {name: new RegExp(`Quitar a ${fatherName} como padre`)});
    await dialog.getByRole("button", {name: "Cancelar"}).click();
    await expect(dialog).toHaveCount(0);
    await expect(relationshipRow(page, fatherLabel)).toBeVisible();

    await relationshipRow(page, fatherLabel).getByRole("button", {name: "Quitar relación"}).click();
    dialog = page.getByRole("dialog", {name: new RegExp(`Quitar a ${fatherName} como padre`)});
    await dialog.getByRole("button", {name: "Quitar relación"}).click();

    await expect(page.getByText("Relación eliminada correctamente.")).toBeVisible();
    await expect(relationshipRow(page, fatherLabel)).toHaveCount(0);
    await expect(relationshipRow(page, motherLabel)).toBeVisible();
    await expect(personSelector(page).locator("option", {hasText: fatherName})).toHaveCount(1);
    await expect(personSelector(page).locator("option", {hasText: motherName})).toHaveCount(1);
    await expect(personSelector(page).locator("option:checked")).toHaveText(rootName);
    await expect(page.locator("svg title").filter({hasText: "Un solo progenitor registrado"})).toHaveCount(1);
  });

  test("quita una pareja y conserva la coparentalidad", async ({page}) => {
    const childName = "Hija Coparental";
    const fatherName = "Padre Coparental";
    const motherName = "Madre Coparental";

    await createIsolatedTree(page, "stage8.unlink-partner", "Hija", "Coparental");
    await addParent(page, "padre", "Padre", "Coparental");
    await addParent(page, "madre", "Madre", "Coparental");
    await page.getByRole("button", {name: "Conectarlos"}).click();
    await expect(page.getByText("Padre y madre conectados como pareja.")).toBeVisible();
    await selectPerson(page, fatherName);

    const partnerLabel = `Pareja de ${motherName}`;
    await expect(relationshipRow(page, partnerLabel)).toBeVisible();
    await expect(page.locator("svg title").filter({hasText: "Pareja registrada"})).toHaveCount(1);
    await relationshipRow(page, partnerLabel).getByRole("button", {name: "Quitar relación"}).click();
    const dialog = page.getByRole("dialog", {name: /Quitar la relación de pareja/});
    await dialog.getByRole("button", {name: "Quitar relación"}).click();

    await expect(page.getByText("Relación eliminada correctamente.")).toBeVisible();
    await expect(relationshipRow(page, partnerLabel)).toHaveCount(0);
    await expect(relationshipRow(page, `Padre de ${childName}`)).toBeVisible();
    await expect(personSelector(page).locator("option", {hasText: fatherName})).toHaveCount(1);
    await expect(personSelector(page).locator("option", {hasText: motherName})).toHaveCount(1);
    await expect(personSelector(page).locator("option", {hasText: childName})).toHaveCount(1);
    await expect(personSelector(page).locator("option:checked")).toHaveText(fatherName);
    await expect(page.locator("svg title").filter({hasText: "Pareja registrada"})).toHaveCount(0);
    await expect(page.locator("svg title").filter({hasText: "Coprogenitores: comparten hijos, sin relación de pareja"})).toHaveCount(1);

    await selectPerson(page, motherName);
    await expect(relationshipRow(page, `Madre de ${childName}`)).toBeVisible();
  });

  test("reasigna un progenitor existente sin eliminar personas ni parejas", async ({page}) => {
    const childName = "Hija Reasignacion";
    const oldFatherName = "Padre Anterior";
    const motherName = "Madre Permanente";
    const newFatherName = "Padre Nuevo";

    await createIsolatedTree(page, "stage8.reassign", "Hija", "Reasignacion");
    await addParent(page, "padre", "Padre", "Anterior");
    await addParent(page, "madre", "Madre", "Permanente");
    await addPartner(page, "Padre", "Nuevo");

    const oldFatherRow = relationshipRow(page, `Hijo/a de ${oldFatherName}`);
    await oldFatherRow.getByRole("button", {name: "Cambiar progenitor"}).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName(`Cambiar progenitor de ${childName}`);
    await dialog.getByLabel("Nuevo progenitor").selectOption({label: newFatherName});
    await expect(dialog).toHaveAccessibleName(
      `¿Cambiar a ${oldFatherName} por ${newFatherName} como padre de ${childName}?`
    );
    await dialog.getByRole("button", {name: "Cambiar progenitor"}).click();

    await expect(page.getByText("Progenitor actualizado correctamente.")).toBeVisible();
    await expect(relationshipRow(page, `Hijo/a de ${oldFatherName}`)).toHaveCount(0);
    await expect(relationshipRow(page, `Hijo/a de ${newFatherName}`)).toBeVisible();
    await expect(relationshipRow(page, `Hijo/a de ${motherName}`)).toBeVisible();
    await expect(relationshipRow(page, `Pareja de ${newFatherName}`)).toBeVisible();
    await expect(personSelector(page).locator("option", {hasText: oldFatherName})).toHaveCount(1);
    await expect(personSelector(page).locator("option", {hasText: newFatherName})).toHaveCount(1);
    await expect(personSelector(page).locator("option:checked")).toHaveText(childName);
  });

  test("actualiza el estado de pareja sin eliminar la relación", async ({page}) => {
    const rootName = "Raiz Estado";
    const partnerName = "Pareja Estado";
    const partnerLabel = `Pareja de ${partnerName}`;

    await createIsolatedTree(page, "stage8.partner-status", "Raiz", "Estado");
    await addPartner(page, "Pareja", "Estado");

    let row = relationshipRow(page, partnerLabel);
    await expect(row).toContainText("Actual");
    await expect(row.getByRole("button", {name: "Quitar relación"})).toBeVisible();
    await row.getByRole("button", {name: "Cambiar estado"}).click();
    const dialog = page.getByRole("dialog", {name: `Cambiar estado de relación con ${partnerName}`});
    await dialog.getByLabel("Estado de la relación").selectOption("former");
    await dialog.getByRole("button", {name: "Cambiar estado"}).click();

    await expect(page.getByText("Estado de la relación actualizado correctamente.")).toBeVisible();
    row = relationshipRow(page, partnerLabel);
    await expect(row).toContainText("Anterior");
    await expect(row.getByRole("button", {name: "Quitar relación"})).toBeVisible();
    await expect(personSelector(page).locator("option:checked")).toHaveText(rootName);
    await expect(page.locator("svg title").filter({hasText: "Pareja registrada"})).toHaveCount(1);

    await selectPerson(page, partnerName);
    const inverseRow = relationshipRow(page, `Pareja de ${rootName}`);
    await expect(inverseRow).toContainText("Anterior");
    await expect(inverseRow.getByRole("button", {name: "Cambiar estado"})).toBeVisible();
  });
});
