import { type Person, type Relationship, type Union } from "../types/family";

function canonPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function unionIdFor(a: string, b: string) {
  const [x, y] = canonPair(a, b);
  return `union:${x}:${y}`;
}

/**
 * Motor que identifica parejas y agrupa a los hijos.
 * Regla DoD:
 * - Hijos cuelgan desde la UNIÓN SOLO si existen 2 PARENT_OF (A->child y B->child)
 * - Hijos con 1 solo padre cuelgan desde un "single union" del padre (no desde una unión de pareja)
 */
export const buildUnions = (persons: Person[], relationships: Relationship[]): Union[] => {
  const personSet = new Set(persons.map(p => p.id));

  // --- Index: parent -> children (PARENT_OF) ---
  const parentToChildren = new Map<string, Set<string>>();
  for (const r of relationships) {
    if (r.type !== "PARENT_OF") continue;
    if (!personSet.has(r.fromPersonId) || !personSet.has(r.toPersonId)) continue;

    if (!parentToChildren.has(r.fromPersonId)) parentToChildren.set(r.fromPersonId, new Set());
    parentToChildren.get(r.fromPersonId)!.add(r.toPersonId);
  }

  // --- Index: child -> parents set ---
  const childToParents = new Map<string, Set<string>>();
  for (const r of relationships) {
    if (r.type !== "PARENT_OF") continue;
    if (!personSet.has(r.fromPersonId) || !personSet.has(r.toPersonId)) continue;

    if (!childToParents.has(r.toPersonId)) childToParents.set(r.toPersonId, new Set());
    childToParents.get(r.toPersonId)!.add(r.fromPersonId);
  }

  // --- Dedupe partner pairs (PARTNER_OF) ---
  const partnerPairs = new Map<string, { a: string; b: string }>();
  for (const r of relationships) {
    if (r.type !== "PARTNER_OF") continue;
    if (!personSet.has(r.fromPersonId) || !personSet.has(r.toPersonId)) continue;

    const [a, b] = canonPair(r.fromPersonId, r.toPersonId);
    const uid = unionIdFor(a, b);
    if (!partnerPairs.has(uid)) partnerPairs.set(uid, { a, b });
  }

  // --- Build partner unions with COMMON children only (intersection via childToParents) ---
  const unionsMap = new Map<string, Union>();
  for (const [uid, pair] of partnerPairs.entries()) {
    unionsMap.set(uid, {
      id: uid,
      partnerA: pair.a,
      partnerB: pair.b,
      children: [],
    });
  }

  // Track assigned children per parent to avoid "disappearing" kids when parent also has partner unions
  const assignedToPartnerUnionByParent = new Map<string, Set<string>>();

  for (const [childId, parentsSet] of childToParents.entries()) {
    const parents = Array.from(parentsSet);
    if (parents.length < 2) continue;

    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        const [a, b] = canonPair(parents[i], parents[j]);
        const uid = unionIdFor(a, b);
        const u = unionsMap.get(uid);
        if (!u) continue;

        if (!u.children.includes(childId)) u.children.push(childId);

        if (!assignedToPartnerUnionByParent.has(a)) assignedToPartnerUnionByParent.set(a, new Set());
        if (!assignedToPartnerUnionByParent.has(b)) assignedToPartnerUnionByParent.set(b, new Set());
        assignedToPartnerUnionByParent.get(a)!.add(childId);
        assignedToPartnerUnionByParent.get(b)!.add(childId);
      }
    }
  }

  // Determinismo: ordenar children + unions
  const unions: Union[] = Array.from(unionsMap.values());
  for (const u of unions) u.children.sort();
  unions.sort((x, y) => x.id.localeCompare(y.id));

  // --- Single unions: hijos de un padre que NO estén asignados a una unión de pareja ---
  for (const [parentId, childSet] of parentToChildren.entries()) {
    const assigned = assignedToPartnerUnionByParent.get(parentId) ?? new Set<string>();
    const remaining = Array.from(childSet).filter(childId => !assigned.has(childId)).sort();

    if (remaining.length > 0) {
      unions.push({
        id: `single:${parentId}`,
        partnerA: parentId,
        partnerB: "",
        children: remaining,
      });
    }
  }

  // Determinismo final
  unions.sort((x, y) => x.id.localeCompare(y.id));
  return unions;
};

/**
 * Utilidad para saber qué uniones pertenecen a una persona
 */
export const getUnionsByPerson = (unions: Union[]): Map<string, Union[]> => {
  const map = new Map<string, Union[]>();
  unions.forEach(u => {
    if (u.partnerA) {
      if (!map.has(u.partnerA)) map.set(u.partnerA, []);
      map.get(u.partnerA)!.push(u);
    }
    if (u.partnerB) {
      if (!map.has(u.partnerB)) map.set(u.partnerB, []);
      map.get(u.partnerB)!.push(u);
    }
  });
  return map;
};
