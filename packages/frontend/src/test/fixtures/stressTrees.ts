import type {
  ParentRole,
  PartnerRelationshipStatus,
  Person,
  Relationship,
} from "../../types/family";

export interface StressTreeFixture {
  name: string;
  persons: Person[];
  relationships: Relationship[];
  rootPersonId: string;
  selectionTargets: {
    deep: string;
    lateral: string;
  };
}

interface StressTreeBuilder {
  person(id: number, isRoot?: boolean): void;
  couple(
    first: number,
    second: number,
    status: PartnerRelationshipStatus
  ): void;
  children(parents: [number, number], children: number[]): void;
  singleParent(parent: number, children: number[]): void;
  fixture(
    name: string,
    selectionTargets: StressTreeFixture["selectionTargets"]
  ): StressTreeFixture;
}

function prefixFor(size: number): string {
  return `p${size}`;
}

function personId(size: number, index: number): string {
  return `${prefixFor(size)}-person-${String(index).padStart(3, "0")}`;
}

function createBuilder(size: number): StressTreeBuilder {
  const persons: Person[] = [];
  const relationships: Relationship[] = [];
  let relationshipIndex = 0;

  const nextRelationshipId = (): string => {
    relationshipIndex += 1;
    return `${prefixFor(size)}-rel-${String(relationshipIndex).padStart(3, "0")}`;
  };

  const addParent = (
    parent: number,
    child: number,
    parentRole: ParentRole
  ): void => {
    relationships.push({
      id: nextRelationshipId(),
      fromPersonId: personId(size, parent),
      toPersonId: personId(size, child),
      type: "PARENT_OF",
      parentRole,
    });
  };

  return {
    person(index, isRoot = false) {
      persons.push({
        id: personId(size, index),
        firstName: `Persona ${String(index).padStart(3, "0")}`,
        lastName: `Stress ${size}`,
        ...(isRoot ? { isRoot: true } : {}),
      });
    },
    couple(first, second, relationshipStatus) {
      relationships.push({
        id: nextRelationshipId(),
        fromPersonId: personId(size, first),
        toPersonId: personId(size, second),
        type: "PARTNER_OF",
        relationshipStatus,
      });
    },
    children(parents, children) {
      children.forEach((child) => {
        addParent(parents[0], child, "father");
        addParent(parents[1], child, "mother");
      });
    },
    singleParent(parent, children) {
      children.forEach((child) => addParent(parent, child, "father"));
    },
    fixture(name, selectionTargets) {
      return {
        name,
        persons,
        relationships,
        rootPersonId: personId(size, 9),
        selectionTargets,
      };
    },
  };
}

function addBase25(builder: StressTreeBuilder): void {
  for (let index = 1; index <= 25; index += 1) {
    builder.person(index, index === 9);
  }

  builder.couple(3, 4, "unknown");
  builder.children([3, 4], [2]);
  builder.couple(1, 2, "current");
  builder.children([1, 2], [5, 7]);
  builder.couple(5, 6, "current");
  builder.children([5, 6], [8, 9, 10]);
  builder.couple(9, 11, "current");
  builder.children([9, 11], [12, 13, 14]);
  builder.couple(9, 15, "former");
  builder.children([9, 15], [16]);
  builder.children([8, 17], [18]);
  builder.singleParent(10, [19, 20]);
  builder.couple(7, 21, "unknown");
  builder.children([7, 21], [22, 23]);
  builder.couple(12, 24, "current");
  builder.children([12, 24], [25]);
}

function addTo50(builder: StressTreeBuilder): void {
  for (let index = 26; index <= 50; index += 1) builder.person(index);

  builder.couple(13, 26, "current");
  builder.children([13, 26], [27, 28, 29]);
  builder.singleParent(14, [30]);
  builder.couple(16, 31, "unknown");
  builder.children([16, 31], [32, 33]);
  builder.couple(18, 34, "former");
  builder.children([18, 34], [35]);
  builder.children([19, 36], [37]);
  builder.couple(20, 38, "current");
  builder.children([20, 38], [39, 40, 41]);
  builder.singleParent(22, [42]);
  builder.couple(23, 43, "current");
  builder.children([23, 43], [44, 45]);
  builder.couple(25, 46, "unknown");
  builder.children([25, 46], [47, 48]);
  builder.singleParent(29, [49, 50]);
}

function addTo100(builder: StressTreeBuilder): void {
  for (let index = 51; index <= 100; index += 1) builder.person(index);

  builder.couple(27, 51, "current");
  builder.children([27, 51], [52, 53, 54, 55]);
  builder.children([28, 56], [57, 58, 59]);
  builder.couple(30, 60, "former");
  builder.children([30, 60], [61, 62]);
  builder.singleParent(32, [63, 64, 65]);
  builder.couple(33, 66, "current");
  builder.children([33, 66], [67, 68, 69, 70]);
  builder.children([35, 71], [72, 73]);
  builder.couple(37, 74, "unknown");
  builder.children([37, 74], [75, 76, 77]);
  builder.singleParent(39, [78, 79]);
  builder.couple(40, 80, "current");
  builder.children([40, 80], [81, 82, 83, 84]);
  builder.couple(41, 85, "former");
  builder.children([41, 85], [86]);
  builder.children([42, 87], [88, 89, 90]);
  builder.singleParent(44, [91]);
  builder.couple(45, 92, "current");
  builder.children([45, 92], [93, 94, 95]);
  builder.children([47, 96], [97, 98]);
  builder.couple(48, 99, "unknown");
  builder.children([48, 99], [100]);
}

function build25(): StressTreeFixture {
  const builder = createBuilder(25);
  addBase25(builder);
  return builder.fixture("P06 family layout — 25 persons", {
    deep: personId(25, 25),
    lateral: personId(25, 23),
  });
}

function build50(): StressTreeFixture {
  const builder = createBuilder(50);
  addBase25(builder);
  addTo50(builder);
  return builder.fixture("P06 family layout — 50 persons", {
    deep: personId(50, 48),
    lateral: personId(50, 45),
  });
}

function build100(): StressTreeFixture {
  const builder = createBuilder(100);
  addBase25(builder);
  addTo50(builder);
  addTo100(builder);
  return builder.fixture("P06 family layout — 100 persons", {
    deep: personId(100, 100),
    lateral: personId(100, 95),
  });
}

export const stressTree25 = build25();
export const stressTree50 = build50();
export const stressTree100 = build100();

export const stressTreeFixtures = [stressTree25, stressTree50, stressTree100];
