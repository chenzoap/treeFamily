import { type Person, type Union, type TreeNode } from "../types/family";

export const buildAncestry = (
  personId: string,
  allPersons: Person[],
  allUnions: Union[],
  visited = new Set<string>()
): TreeNode | null => {
  const person = allPersons.find(p => p.id === personId);
  if (!person || visited.has(personId)) return null;
  visited.add(personId);

  const node: TreeNode = { id: person.id, type: 'person', data: person, children: [] };

  // Buscamos uniones donde esta persona es HIJO
  const parentUnions = allUnions.filter(u => u.children.includes(personId));
  parentUnions.forEach(union => {
    [union.partnerA, union.partnerB].forEach(parentId => {
      if (parentId && parentId !== "") {
        const parentHierarchy = buildAncestry(parentId, allPersons, allUnions, visited);
        if (parentHierarchy) node.children?.push(parentHierarchy);
      }
    });
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

  const node: TreeNode = { id: person.id, type: 'person', data: person, children: [] };

  const personUnions = allUnions.filter(u => u.partnerA === personId || u.partnerB === personId);
  personUnions.forEach(union => {
    const unionNode: TreeNode = { id: union.id, type: 'union', data: union, children: [] };
    union.children.forEach(childId => {
      const childHierarchy = buildDescendants(childId, allPersons, allUnions, visited);
      if (childHierarchy) unionNode.children?.push(childHierarchy);
    });
    node.children?.push(unionNode);
  });
  return node;
};