import { type Person, type Union, type TreeNode } from "../types/family";

export const buildAncestry = (
  personId: string,
  allPersons: Person[],
  allUnions: Union[],
  visited = new Set<string>()
): TreeNode | null => {
  const person = allPersons.find((candidate) => candidate.id === personId);

  if (!person || visited.has(personId)) return null;

  const nextVisited = new Set(visited);
  nextVisited.add(personId);

  const node: TreeNode = {
    id: person.id,
    type: "person",
    data: person,
    children: [],
  };

  const parentUnions = allUnions.filter((union) =>
    union.children.includes(personId)
  );

  parentUnions.forEach((union) => {
    const unionNode: TreeNode = {
      id: union.id,
      type: "union",
      data: union,
      children: [],
    };

    [union.partnerA, union.partnerB].forEach((parentId) => {
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
  const person = allPersons.find((candidate) => candidate.id === personId);

  if (!person || visited.has(personId)) return null;

  const nextVisited = new Set(visited);
  nextVisited.add(personId);

  const node: TreeNode = {
    id: person.id,
    type: "person",
    data: person,
    children: [],
  };

  const personUnions = allUnions.filter(
    (union) =>
      union.partnerA === personId || union.partnerB === personId
  );

  personUnions.forEach((union) => {
    const unionNode: TreeNode = {
      id: union.id,
      type: "union",
      data: union,
      children: [],
    };

    union.children.forEach((childId) => {
      const childHierarchy = buildDescendants(
        childId,
        allPersons,
        allUnions,
        nextVisited
      );

      if (childHierarchy) {
        unionNode.children?.push(childHierarchy);
      }
    });

    node.children?.push(unionNode);
  });

  return node;
};
