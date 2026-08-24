import type {Person} from "../types/family";

export function reconcileSelectedPersonId(
  selectedPersonId: string | null,
  rootPersonId: string | null,
  persons: readonly Person[]
): string | null {
  if (!selectedPersonId) return selectedPersonId;
  if (persons.some((person) => person.id === selectedPersonId)) {
    return selectedPersonId;
  }
  if (rootPersonId && persons.some((person) => person.id === rootPersonId)) {
    return rootPersonId;
  }
  return selectedPersonId;
}
