import { type Person, type Union, type TreeNode } from "../types/family";

export const buildAncestry = (
  personId: string,
  allPersons: Person[],
  allUnions: Union[],
  visited = new Set<string>()
): TreeNode | null => {
  const person = allPersons.find(p => p.id === personId);
  if (!person || visited.has(personId)) return null;

  const nextVisited = new Set(visited);
  nextVisited.add(personId);

  const node: TreeNode = {
    id: person.id,
    type: "person",
    data: person,
    children: [],
  };

  // Buscamos las uniones donde esta persona aparece como hijo/a.
  // Ejemplo: si Fernando es hijo de Jose + Rosa, aquí obtenemos esa unión.
  const parentUnions = allUnions.filter(u => u.children.includes(personId));

  parentUnions.forEach(union => {
    // En ancestros NO agregamos padre y madre directamente al nodo persona.
    // Creamos primero un nodo de unión para que el render pueda mostrar
    // visualmente el punto azul entre ambos padres.
    const unionNode: TreeNode = {
      id: union.id,
      type: "union",
      data: union,
      children: [],
    };

    [union.partnerA, union.partnerB].forEach(parentId => {
      if (!parentId) return;

      const parentHierarchy = buildAncestry(
        parentId,
        allPersons,
        allUnions,
        nextVisited
      );

      if (parentHierarchy) {
        unionNode.children?.push(parentHierarchy);
      }
    });

    // Solo agregamos la unión si tiene al menos un padre/madre válido.
    if ((unionNode.children?.length ?? 0) > 0) {
      node.children?.push(unionNode);
    }
  });

  return node;
};

export const buildDescendants = (
  personId: string,
  allPersons: Person[],
  allUnions: Union[],
  visited = new Set<string>()
): TreeNode | null => {
  const person = allPersons.find(p => p.id === personId);
  if (!person || visited.has(personId)) return null;
  visited.add(personId);

  const node: TreeNode = {
    id: person.id,
    type: "person",
    data: person,
    children: [],
  };

  const personUnions = allUnions.filter(
    u => u.partnerA === personId || u.partnerB === personId
  );

  personUnions.forEach(union => {
    const unionNode: TreeNode = {
      id: union.id,
      type: "union",
      data: union,
      children: [],
    };

    union.children.forEach(childId => {
      const childHierarchy = buildDescendants(
        childId,
        allPersons,
        allUnions,
        visited
      );

      if (childHierarchy) {
        unionNode.children?.push(childHierarchy);
      }
    });

    node.children?.push(unionNode);
  });

  return node;
};