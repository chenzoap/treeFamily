import * as z from "zod";
import type { Person } from "../types/family";

const optionalTrimmedString = z.string().transform((value) => value.trim());

export const editPersonSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresa el nombre."),
  middleName: optionalTrimmedString,
  lastName: z.string().trim().min(1, "Ingresa el apellido."),
  secondLastName: optionalTrimmedString,
  birthDate: optionalTrimmedString,
  birthPlace: optionalTrimmedString,
});

export type EditPersonData = z.infer<typeof editPersonSchema>;

export type UpdatePersonPayload = {
  treeId: string;
  personId: string;
  personData: EditPersonData;
};

export type UpdatePersonCall = (
  payload: UpdatePersonPayload
) => Promise<unknown>;

export function personToEditValues(person: Person): EditPersonData {
  return {
    firstName: person.firstName ?? "",
    middleName: person.middleName ?? "",
    lastName: person.lastName ?? "",
    secondLastName: person.secondLastName ?? "",
    birthDate: person.birthDate ?? "",
    birthPlace: person.birthPlace ?? "",
  };
}

export function buildUpdatePersonPayload(
  treeId: string,
  personId: string,
  data: EditPersonData
): UpdatePersonPayload {
  return {
    treeId,
    personId,
    personData: editPersonSchema.parse(data),
  };
}

export function updatePersonErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error ?
      String(error.code).replace(/^functions\//, "") :
      "";

  if (code === "unauthenticated") {
    return "Tu sesión ya no es válida. Inicia sesión nuevamente.";
  }
  if (code === "invalid-argument") return "Revisa los datos obligatorios.";
  if (code === "permission-denied") {
    return "No tienes permiso para editar esta persona.";
  }
  if (code === "not-found") return "La persona ya no existe.";
  return "No pudimos guardar los cambios. Inténtalo nuevamente.";
}

export async function submitPersonUpdate({
  call,
  treeId,
  personId,
  data,
  onSaved,
}: {
  call: UpdatePersonCall;
  treeId: string;
  personId: string;
  data: EditPersonData;
  onSaved: () => void;
}): Promise<void> {
  await call(buildUpdatePersonPayload(treeId, personId, data));
  onSaved();
}
