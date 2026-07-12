import {
  type CoParentsUnion,
  type CoupleUnion,
  type PartnerRelationshipStatus,
  type Person,
  type Relationship,
  type SingleParentUnion,
  type Union,
} from "../types/family";

export type GraphIntegrityIssueSeverity = "warning" | "error";

export type GraphIntegrityIssueCode =
  | "MISSING_FROM_PERSON"
  | "MISSING_TO_PERSON"
  | "SELF_RELATIONSHIP"
  | "DUPLICATE_PARENT_RELATIONSHIP"
  | "DUPLICATE_PARTNER_RELATIONSHIP";

export interface GraphIntegrityIssue {
  code: GraphIntegrityIssueCode;
  severity: GraphIntegrityIssueSeverity;
  relationshipId: string;
  message: string;
  fromPersonId?: string;
  toPersonId?: string;
}

export interface BuildUnionsResult {
  unions: Union[];
  issues: GraphIntegrityIssue[];
}

function canonPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function unionIdFor(a: string, b: string): string {
  const [x, y] = canonPair(a, b);
  return `union:${x}:${y}`;
}

function normalizePartnerRelationshipStatus(
  value: PartnerRelationshipStatus | undefined
): PartnerRelationshipStatus {
  if (value === "current" || value === "former") {
    return value;
  }

  return "unknown";
}

function createIssue(
  relationship: Relationship,
  code: GraphIntegrityIssueCode,
  severity: GraphIntegrityIssueSeverity,
  message: string
): GraphIntegrityIssue {
  return {
    code,
    severity,
    relationshipId: relationship.id,
    message,
    fromPersonId: relationship.fromPersonId,
    toPersonId: relationship.toPersonId,
  };
}

/**
 * Construye las uniones válidas del árbol y devuelve diagnósticos de
 * integridad para relaciones que no pueden representarse de forma segura.
 *
 * Estado del Bloque 4B:
 * - PARTNER_OF crea una unión kind="couple".
 * - Un único progenitor crea una unión kind="singleParent".
 * - Dos progenitores que comparten hijos sin PARTNER_OF crean una unión
 *   kind="coParents".
 *
 * Reglas defensivas:
 * - Una relación que referencia una persona inexistente se ignora.
 * - Una relación de una persona consigo misma se ignora.
 * - Las relaciones duplicadas se reportan y se deduplican.
 * - Un hijo con un solo padre válido se mantiene en una unión monoparental.
 */
export const buildUnionsWithDiagnostics = (
  persons: Person[],
  relationships: Relationship[]
): BuildUnionsResult => {
  const personSet = new Set(persons.map((person) => person.id));
  const issues: GraphIntegrityIssue[] = [];
  const validRelationships: Relationship[] = [];

  for (const relationship of relationships) {
    const fromExists = personSet.has(relationship.fromPersonId);
    const toExists = personSet.has(relationship.toPersonId);

    if (!fromExists) {
      issues.push(
        createIssue(
          relationship,
          "MISSING_FROM_PERSON",
          "error",
          `La relación ${relationship.id} referencia una persona de origen inexistente: ${relationship.fromPersonId}.`
        )
      );
    }

    if (!toExists) {
      issues.push(
        createIssue(
          relationship,
          "MISSING_TO_PERSON",
          "error",
          `La relación ${relationship.id} referencia una persona de destino inexistente: ${relationship.toPersonId}.`
        )
      );
    }

    if (!fromExists || !toExists) {
      continue;
    }

    if (relationship.fromPersonId === relationship.toPersonId) {
      issues.push(
        createIssue(
          relationship,
          "SELF_RELATIONSHIP",
          "error",
          `La relación ${relationship.id} conecta a una persona consigo misma.`
        )
      );
      continue;
    }

    validRelationships.push(relationship);
  }

  const parentToChildren = new Map<string, Set<string>>();
  const childToParents = new Map<string, Set<string>>();
  const seenParentRelationships = new Map<string, string>();

  for (const relationship of validRelationships) {
    if (relationship.type !== "PARENT_OF") continue;

    const key = `${relationship.fromPersonId}->${relationship.toPersonId}`;
    const existingRelationshipId = seenParentRelationships.get(key);

    if (existingRelationshipId) {
      issues.push(
        createIssue(
          relationship,
          "DUPLICATE_PARENT_RELATIONSHIP",
          "warning",
          `La relación PARENT_OF ${relationship.id} duplica a ${existingRelationshipId}.`
        )
      );
      continue;
    }

    seenParentRelationships.set(key, relationship.id);

    if (!parentToChildren.has(relationship.fromPersonId)) {
      parentToChildren.set(relationship.fromPersonId, new Set());
    }

    parentToChildren
      .get(relationship.fromPersonId)!
      .add(relationship.toPersonId);

    if (!childToParents.has(relationship.toPersonId)) {
      childToParents.set(relationship.toPersonId, new Set());
    }

    childToParents
      .get(relationship.toPersonId)!
      .add(relationship.fromPersonId);
  }

  const partnerPairs = new Map<
    string,
    {
      a: string;
      b: string;
      relationshipId: string;
      relationshipStatus: PartnerRelationshipStatus;
    }
  >();

  for (const relationship of validRelationships) {
    if (relationship.type !== "PARTNER_OF") continue;

    const [a, b] = canonPair(
      relationship.fromPersonId,
      relationship.toPersonId
    );
    const unionId = unionIdFor(a, b);
    const existingPair = partnerPairs.get(unionId);

    if (existingPair) {
      issues.push(
        createIssue(
          relationship,
          "DUPLICATE_PARTNER_RELATIONSHIP",
          "warning",
          `La relación PARTNER_OF ${relationship.id} duplica a ${existingPair.relationshipId}.`
        )
      );
      continue;
    }

    partnerPairs.set(unionId, {
      a,
      b,
      relationshipId: relationship.id,
      relationshipStatus: normalizePartnerRelationshipStatus(
        relationship.relationshipStatus
      ),
    });
  }

  const unionsMap = new Map<
    string,
    CoupleUnion | CoParentsUnion
  >();

  for (const [unionId, pair] of partnerPairs.entries()) {
    unionsMap.set(unionId, {
      id: unionId,
      kind: "couple",
      partnerA: pair.a,
      partnerB: pair.b,
      relationshipStatus: pair.relationshipStatus,
      children: [],
    });
  }

  const assignedToPartnerUnionByParent = new Map<string, Set<string>>();

  for (const [childId, parentsSet] of childToParents.entries()) {
    const parents = Array.from(parentsSet).sort();

    // En el MVP una persona puede tener como máximo dos progenitores.
    // Los casos con más de dos se dejan sin agrupar aquí para que el
    // validador los reporte y no se inventen combinaciones de uniones.
    if (parents.length !== 2) continue;

    const [a, b] = canonPair(parents[0], parents[1]);
    const unionId = unionIdFor(a, b);
    let union = unionsMap.get(unionId);

    if (!union) {
      union = {
        id: unionId,
        kind: "coParents",
        partnerA: a,
        partnerB: b,
        children: [],
      };

      unionsMap.set(unionId, union);
    }

    if (!union.children.includes(childId)) {
      union.children.push(childId);
    }

    if (!assignedToPartnerUnionByParent.has(a)) {
      assignedToPartnerUnionByParent.set(a, new Set());
    }

    if (!assignedToPartnerUnionByParent.has(b)) {
      assignedToPartnerUnionByParent.set(b, new Set());
    }

    assignedToPartnerUnionByParent.get(a)!.add(childId);
    assignedToPartnerUnionByParent.get(b)!.add(childId);
  }

  const unions: Union[] = Array.from(unionsMap.values());

  for (const union of unions) {
    union.children.sort();
  }

  for (const [parentId, childSet] of parentToChildren.entries()) {
    const assignedChildren =
      assignedToPartnerUnionByParent.get(parentId) ?? new Set<string>();

    const remainingChildren = Array.from(childSet)
      .filter((childId) => !assignedChildren.has(childId))
      .sort();

    if (remainingChildren.length === 0) continue;

    const singleParentUnion: SingleParentUnion = {
      id: `single:${parentId}`,
      kind: "singleParent",
      partnerA: parentId,
      partnerB: "",
      children: remainingChildren,
    };

    unions.push(singleParentUnion);
  }

  unions.sort((left, right) => left.id.localeCompare(right.id));

  return { unions, issues };
};

/**
 * API compatible con el código existente.
 * Para obtener diagnósticos, usar buildUnionsWithDiagnostics.
 */
export const buildUnions = (
  persons: Person[],
  relationships: Relationship[]
): Union[] => buildUnionsWithDiagnostics(persons, relationships).unions;

/**
 * Utilidad para saber qué uniones pertenecen a una persona.
 */
export const getUnionsByPerson = (
  unions: Union[]
): Map<string, Union[]> => {
  const map = new Map<string, Union[]>();

  unions.forEach((union) => {
    if (!map.has(union.partnerA)) {
      map.set(union.partnerA, []);
    }

    map.get(union.partnerA)!.push(union);

    if (union.partnerB) {
      if (!map.has(union.partnerB)) {
        map.set(union.partnerB, []);
      }

      map.get(union.partnerB)!.push(union);
    }
  });

  return map;
};
