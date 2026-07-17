import {
  type FamilyUnionKind,
  type Person,
  type Union,
} from "../types/family";

export const FAMILY_LAYOUT = {
  personWidth: 176,
  personHeight: 64,
  minimumHorizontalGap: 72,
  generationGap: 230,
  coupleDistance: 250,
  singleUnionDrop: 78,
  unionMarkerRadius: 7,
  familyBlockGap: 96,
  unionBlockGap: 88,
  childBranchGap: 72,
  familyConnectorLaneGap: 48,
  familyConnectorTopClearance: 22,
  familyConnectorBottomClearance: 30,
  markerToPartnerCenter: 126,
} as const;

export type LayoutPersonRole = "root" | "selected" | "person";

export interface LayoutPersonNode {
  id: string;
  key: string;
  person: Person;
  role: LayoutPersonRole;
  level: number;
  x: number;
  y: number;
}

export interface LayoutUnionNode {
  id: string;
  union: Union;
  level: number;
  x: number;
  y: number;
  childrenCenterX: number;
  /** Tipo semántico real de la unión; no determina su geometría. */
  kind: FamilyUnionKind;
  partnerAId: string;
  partnerBId: string | null;
  childIds: string[];
}

export interface LayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface FamilyLayoutResult {
  rootPersonId: string;
  selectedPersonId: string | null;
  persons: LayoutPersonNode[];
  unions: LayoutUnionNode[];
  bounds: LayoutBounds;
  warnings: string[];
  collisions: string[];
  detachedPersonIds: string[];
}

type RelativePersonNode = Omit<LayoutPersonNode, "x" | "y" | "level"> & {
  x: number;
  y: number;
  level: number;
};

type RelativeUnionNode = Omit<LayoutUnionNode, "x" | "y" | "level"> & {
  x: number;
  y: number;
  level: number;
};

interface PersonBranch {
  rootPersonId: string;
  persons: RelativePersonNode[];
  unions: RelativeUnionNode[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface UnionUnit {
  union: Union;
  // Clasificación geométrica; la semántica real vive en union.kind.
  kind: "couple" | "single";
  partnerId: string | null;
  partnerBranch: PersonBranch | null;
  children: PersonBranch[];
  childSpan: number;
  width: number;
  side: -1 | 0 | 1;
  sideRank: number;
  centerX: number;
  markerX: number;
}

const PERSON_HALF_WIDTH = FAMILY_LAYOUT.personWidth / 2;
const PERSON_HALF_HEIGHT = FAMILY_LAYOUT.personHeight / 2;

function createBounds(persons: LayoutPersonNode[]): LayoutBounds {
  if (persons.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
    };
  }

  const minX = Math.min(...persons.map((node) => node.x - PERSON_HALF_WIDTH));
  const maxX = Math.max(...persons.map((node) => node.x + PERSON_HALF_WIDTH));
  const minY = Math.min(...persons.map((node) => node.y - PERSON_HALF_HEIGHT));
  const maxY = Math.max(...persons.map((node) => node.y + PERSON_HALF_HEIGHT));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function detectCollisions(persons: LayoutPersonNode[]): string[] {
  const collisions: string[] = [];
  const horizontalMinimum =
    FAMILY_LAYOUT.personWidth + FAMILY_LAYOUT.minimumHorizontalGap / 2;
  const verticalMinimum = FAMILY_LAYOUT.personHeight + 20;

  for (let firstIndex = 0; firstIndex < persons.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < persons.length;
      secondIndex += 1
    ) {
      const first = persons[firstIndex];
      const second = persons[secondIndex];

      const overlapsHorizontally =
        Math.abs(first.x - second.x) < horizontalMinimum;
      const overlapsVertically =
        Math.abs(first.y - second.y) < verticalMinimum;

      if (overlapsHorizontally && overlapsVertically) {
        collisions.push(
          `Posible superposición entre ${first.person.firstName} (${first.id}) y ${second.person.firstName} (${second.id}).`
        );
      }
    }
  }

  return collisions;
}

function branchWidth(branch: PersonBranch): number {
  return branch.maxX - branch.minX;
}

function translateBranch(
  branch: PersonBranch,
  offsetX: number,
  offsetY: number,
  levelOffset: number
): PersonBranch {
  return {
    rootPersonId: branch.rootPersonId,
    persons: branch.persons.map((node) => ({
      ...node,
      x: node.x + offsetX,
      y: node.y + offsetY,
      level: node.level + levelOffset,
    })),
    unions: branch.unions.map((node) => ({
      ...node,
      x: node.x + offsetX,
      y: node.y + offsetY,
      childrenCenterX: node.childrenCenterX + offsetX,
      level: node.level + levelOffset,
    })),
    minX: branch.minX + offsetX,
    maxX: branch.maxX + offsetX,
    minY: branch.minY + offsetY,
    maxY: branch.maxY + offsetY,
  };
}

function mergeBranches(branches: PersonBranch[]): PersonBranch {
  if (branches.length === 0) {
    return {
      rootPersonId: "",
      persons: [],
      unions: [],
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }

  return {
    rootPersonId: branches[0].rootPersonId,
    persons: branches.flatMap((branch) => branch.persons),
    unions: branches.flatMap((branch) => branch.unions),
    minX: Math.min(...branches.map((branch) => branch.minX)),
    maxX: Math.max(...branches.map((branch) => branch.maxX)),
    minY: Math.min(...branches.map((branch) => branch.minY)),
    maxY: Math.max(...branches.map((branch) => branch.maxY)),
  };
}

function unionKey(union: Union): string {
  return union.id;
}

function requiredOutwardShift(
  movingBranch: PersonBranch,
  movingOffsetX: number,
  movingOffsetY: number,
  stationaryBranches: PersonBranch[],
  direction: -1 | 1
): number {
  const horizontalMinimum =
    FAMILY_LAYOUT.personWidth + FAMILY_LAYOUT.minimumHorizontalGap;
  const verticalMinimum = FAMILY_LAYOUT.personHeight + 20;
  const stationaryPersons = stationaryBranches.flatMap(
    (branch) => branch.persons
  );
  let requiredShift = 0;

  movingBranch.persons.forEach((movingPerson) => {
    const movingX = movingPerson.x + movingOffsetX;
    const movingY = movingPerson.y + movingOffsetY;

    stationaryPersons.forEach((stationaryPerson) => {
      if (
        Math.abs(movingY - stationaryPerson.y) >= verticalMinimum
      ) {
        return;
      }

      if (direction === 1) {
        requiredShift = Math.max(
          requiredShift,
          stationaryPerson.x + horizontalMinimum - movingX
        );
      } else {
        requiredShift = Math.max(
          requiredShift,
          movingX - (stationaryPerson.x - horizontalMinimum)
        );
      }
    });
  });

  return Math.max(0, requiredShift);
}

export function buildFamilyLayout(
  rootPersonId: string,
  selectedPersonId: string | null,
  persons: Person[],
  unions: Union[]
): FamilyLayoutResult {
  const warnings: string[] = [];
  const personsById = new Map(persons.map((person) => [person.id, person]));

  if (!personsById.has(rootPersonId)) {
    return {
      rootPersonId,
      selectedPersonId: null,
      persons: [],
      unions: [],
      bounds: createBounds([]),
      warnings: [`La persona principal no existe: ${rootPersonId}`],
      collisions: [],
      detachedPersonIds: persons.map((person) => person.id),
    };
  }

  const validSelectedPersonId =
    selectedPersonId &&
    selectedPersonId !== rootPersonId &&
    personsById.has(selectedPersonId)
      ? selectedPersonId
      : null;

  const validUnions = unions
    .filter((union) => {
      if (!personsById.has(union.partnerA)) {
        warnings.push(
          `Se ignoró ${union.id}: partnerA no existe (${union.partnerA}).`
        );
        return false;
      }

      if (union.partnerB && !personsById.has(union.partnerB)) {
        warnings.push(
          `Se ignoró ${union.id}: partnerB no existe (${union.partnerB}).`
        );
        return false;
      }

      return true;
    })
    .map((union) => ({
      ...union,
      children: union.children.filter((childId) => {
        const exists = personsById.has(childId);

        if (!exists) {
          warnings.push(
            `Se ignoró el hijo ${childId} dentro de ${union.id} porque la persona no existe.`
          );
        }

        return exists;
      }),
    }))
    .sort((first, second) => first.id.localeCompare(second.id));

  const unionsByPartner = new Map<string, Union[]>();
  const unionsByChild = new Map<string, Union[]>();

  validUnions.forEach((union) => {
    const partnerAUnions = unionsByPartner.get(union.partnerA) ?? [];
    partnerAUnions.push(union);
    unionsByPartner.set(union.partnerA, partnerAUnions);

    if (union.partnerB) {
      const partnerBUnions = unionsByPartner.get(union.partnerB) ?? [];
      partnerBUnions.push(union);
      unionsByPartner.set(union.partnerB, partnerBUnions);
    }

    union.children.forEach((childId) => {
      const parentUnions = unionsByChild.get(childId) ?? [];
      parentUnions.push(union);
      unionsByChild.set(childId, parentUnions);
    });
  });

  unionsByPartner.forEach((personUnions) => {
    personUnions.sort((first, second) => first.id.localeCompare(second.id));
  });

  unionsByChild.forEach((personUnions) => {
    personUnions.sort((first, second) => first.id.localeCompare(second.id));
  });

  const parentUnionsForRoot = unionsByChild.get(rootPersonId) ?? [];
  const rootParentUnion =
    parentUnionsForRoot.find((union) => Boolean(union.partnerB)) ??
    parentUnionsForRoot[0] ??
    null;

  if (parentUnionsForRoot.length > 1) {
    warnings.push(
      `La persona principal pertenece a ${parentUnionsForRoot.length} uniones parentales. Se usará ${rootParentUnion?.id ?? "ninguna"} como unión principal.`
    );
  }

  const claimedUnions = new Set<string>();
  const recursionStack = new Set<string>();
  const ancestorClaimedUnions = new Set<string>();
  const ancestorRecursionStack = new Set<string>();

  const roleFor = (personId: string): LayoutPersonRole => {
    if (personId === rootPersonId) return "root";
    if (personId === validSelectedPersonId) return "selected";
    return "person";
  };

  const buildPersonBranch = (
    personId: string,
    incomingUnionId: string | null
  ): PersonBranch => {
    const person = personsById.get(personId);

    if (!person) {
      return {
        rootPersonId: personId,
        persons: [],
        unions: [],
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      };
    }

    if (recursionStack.has(personId)) {
      warnings.push(
        `Se detuvo una rama circular al intentar volver a ${personId}.`
      );

      return {
        rootPersonId: personId,
        persons: [
          {
            id: personId,
            key: `person:${personId}`,
            person,
            role: roleFor(personId),
            level: 0,
            x: 0,
            y: 0,
          },
        ],
        unions: [],
        minX: -PERSON_HALF_WIDTH,
        maxX: PERSON_HALF_WIDTH,
        minY: -PERSON_HALF_HEIGHT,
        maxY: PERSON_HALF_HEIGHT,
      };
    }

    recursionStack.add(personId);

    const ownUnions = (unionsByPartner.get(personId) ?? []).filter(
      (union) =>
        union.id !== incomingUnionId &&
        union.id !== rootParentUnion?.id &&
        !claimedUnions.has(unionKey(union))
    );

    const units: UnionUnit[] = ownUnions.map((union) => {
      claimedUnions.add(unionKey(union));

      const partnerId =
        union.partnerA === personId ? union.partnerB || null : union.partnerA;

      // Una pareja o coprogenitor puede tener otras familias propias.
      // Ejemplo: Leonilda–Víctor comparten a Elvis, mientras Víctor también
      // tiene a Dani y Mariela como hijos monoparentales. La rama adicional
      // del segundo miembro debe conservarse visible y no quedar separada del
      // componente principal al convertir coParents en couple.
      const partnerBranch = partnerId
        ? buildPersonBranch(partnerId, union.id)
        : null;

      const childBranches = union.children
        .filter((childId) => childId !== personId)
        .map((childId) => buildPersonBranch(childId, union.id));

      const validChildren = childBranches.filter(
        (branch) => branch.persons.length > 0
      );
      const childSpan =
        validChildren.length === 0
          ? 0
          : validChildren.reduce(
              (sum, branch) => sum + branchWidth(branch),
              0
            ) +
            FAMILY_LAYOUT.childBranchGap * (validChildren.length - 1);

      const partnerSpan = partnerId
        ? FAMILY_LAYOUT.markerToPartnerCenter +
          Math.max(
            PERSON_HALF_WIDTH * 2,
            partnerBranch ? branchWidth(partnerBranch) : 0
          )
        : FAMILY_LAYOUT.personWidth;

      return {
        union,
        kind: partnerId ? "couple" : "single",
        partnerId,
        partnerBranch,
        children: validChildren,
        childSpan,
        width: Math.max(
          FAMILY_LAYOUT.personWidth,
          partnerSpan,
          childSpan
        ),
        side: 0,
        sideRank: 1,
        centerX: 0,
        markerX: 0,
      };
    });

    const singleUnits = units.filter((unit) => unit.kind === "single");
    const coupleUnits = units.filter((unit) => unit.kind === "couple");

    singleUnits.forEach((unit) => {
      unit.side = 0;
      unit.sideRank = 1;
      unit.markerX = 0;
    });

    coupleUnits.forEach((unit, index) => {
      if (coupleUnits.length === 1 && singleUnits.length === 0) {
        unit.side = 1;
      } else {
        unit.side = index % 2 === 0 ? -1 : 1;
      }
    });

    const leftCouples = coupleUnits.filter((unit) => unit.side === -1);
    const rightCouples = coupleUnits.filter((unit) => unit.side === 1);

    leftCouples.forEach((unit, index) => {
      unit.sideRank = index + 1;
    });

    rightCouples.forEach((unit, index) => {
      unit.sideRank = index + 1;
    });

    let centerMinX = -PERSON_HALF_WIDTH;
    let centerMaxX = PERSON_HALF_WIDTH;

    singleUnits.forEach((unit) => {
      centerMinX = Math.min(centerMinX, -unit.width / 2);
      centerMaxX = Math.max(centerMaxX, unit.width / 2);
      unit.centerX = 0;
    });

    let currentLeft = centerMinX - FAMILY_LAYOUT.unionBlockGap;
    let currentRight = centerMaxX + FAMILY_LAYOUT.unionBlockGap;

    coupleUnits
      .filter((unit) => unit.side === -1)
      .forEach((unit) => {
        unit.centerX = currentLeft - unit.width / 2;
        currentLeft -= unit.width + FAMILY_LAYOUT.unionBlockGap;

        const markerOffset =
          FAMILY_LAYOUT.coupleDistance / 2 +
          (unit.sideRank - 1) *
            (FAMILY_LAYOUT.personWidth +
              FAMILY_LAYOUT.minimumHorizontalGap);

        unit.markerX = -markerOffset;
      });

    coupleUnits
      .filter((unit) => unit.side === 1)
      .forEach((unit) => {
        unit.centerX = currentRight + unit.width / 2;
        currentRight += unit.width + FAMILY_LAYOUT.unionBlockGap;

        const markerOffset =
          FAMILY_LAYOUT.coupleDistance / 2 +
          (unit.sideRank - 1) *
            (FAMILY_LAYOUT.personWidth +
              FAMILY_LAYOUT.minimumHorizontalGap);

        unit.markerX = markerOffset;
      });

    /*
     * Cuando una persona tiene una sola familia descendente, no necesitamos
     * separar el centro reservado del bloque y el marcador de pareja.
     *
     * Alinear ambos puntos produce esta geometría:
     *
     * Persona A — unión — Persona B
     *                │
     *          barra de hijos
     *
     * El ancho completo de los hijos sigue formando parte de los límites de
     * la rama, por lo que los ancestros y las ramas vecinas reservan espacio
     * suficiente sin introducir un tronco diagonal.
     */
    if (
      units.length === 1 &&
      coupleUnits.length === 1 &&
      singleUnits.length === 0
    ) {
      coupleUnits[0].centerX = coupleUnits[0].markerX;
    }

    const personNode: RelativePersonNode = {
      id: personId,
      key: `person:${personId}`,
      person,
      role: roleFor(personId),
      level: 0,
      x: 0,
      y: 0,
    };

    const branchParts: PersonBranch[] = [
      {
        rootPersonId: personId,
        persons: [personNode],
        unions: [],
        minX: -PERSON_HALF_WIDTH,
        maxX: PERSON_HALF_WIDTH,
        minY: -PERSON_HALF_HEIGHT,
        maxY: PERSON_HALF_HEIGHT,
      },
    ];

    units.forEach((unit) => {
      const unionY =
        unit.kind === "single" ? FAMILY_LAYOUT.singleUnionDrop : 0;
      const relativeUnion: RelativeUnionNode = {
        id: unit.union.id,
        union: unit.union,
        level: 0,
        x: unit.kind === "couple" ? unit.markerX : 0,
        y: unionY,
        childrenCenterX: unit.centerX,
        kind: unit.union.kind,
        partnerAId: personId,
        partnerBId: unit.partnerId,
        childIds: unit.children.map((branch) => branch.rootPersonId),
      };

      const unitPersons: RelativePersonNode[] = [];
      const unitPartnerUnions: RelativeUnionNode[] = [];
      let unitMinX = unit.centerX - unit.width / 2;
      let unitMaxX = unit.centerX + unit.width / 2;
      let unitMinY = Math.min(-PERSON_HALF_HEIGHT, unionY);
      let unitMaxY = Math.max(PERSON_HALF_HEIGHT, unionY);

      if (unit.partnerId) {
        const partnerX =
          unit.kind === "couple" ? unit.markerX * 2 : unit.centerX;

        if (unit.partnerBranch && unit.partnerBranch.persons.length > 0) {
          const translatedPartnerBranch = translateBranch(
            unit.partnerBranch,
            partnerX,
            0,
            0
          );

          unitPersons.push(...translatedPartnerBranch.persons);
          unitPartnerUnions.push(...translatedPartnerBranch.unions);
          unitMinX = Math.min(unitMinX, translatedPartnerBranch.minX);
          unitMaxX = Math.max(unitMaxX, translatedPartnerBranch.maxX);
          unitMinY = Math.min(unitMinY, translatedPartnerBranch.minY);
          unitMaxY = Math.max(unitMaxY, translatedPartnerBranch.maxY);
        } else {
          const partner = personsById.get(unit.partnerId);

          if (partner) {
            unitPersons.push({
              id: partner.id,
              key: `person:${partner.id}`,
              person: partner,
              role: roleFor(partner.id),
              level: 0,
              x: partnerX,
              y: 0,
            });

            unitMinX = Math.min(unitMinX, partnerX - PERSON_HALF_WIDTH);
            unitMaxX = Math.max(unitMaxX, partnerX + PERSON_HALF_WIDTH);
          }
        }
      }

      const childBranches: PersonBranch[] = [];
      let childCursor = unit.centerX - unit.childSpan / 2;

      unit.children.forEach((childBranch) => {
        const translated = translateBranch(
          childBranch,
          childCursor - childBranch.minX,
          FAMILY_LAYOUT.generationGap,
          1
        );

        childBranches.push(translated);
        childCursor =
          translated.maxX + FAMILY_LAYOUT.childBranchGap;
      });

      if (childBranches.length > 0) {
        unitMinX = Math.min(
          unitMinX,
          ...childBranches.map((branch) => branch.minX)
        );
        unitMaxX = Math.max(
          unitMaxX,
          ...childBranches.map((branch) => branch.maxX)
        );
        unitMinY = Math.min(
          unitMinY,
          ...childBranches.map((branch) => branch.minY)
        );
        unitMaxY = Math.max(
          unitMaxY,
          ...childBranches.map((branch) => branch.maxY)
        );
      }

      branchParts.push({
        rootPersonId: personId,
        persons: [
          ...unitPersons,
          ...childBranches.flatMap((branch) => branch.persons),
        ],
        unions: [
          relativeUnion,
          ...unitPartnerUnions,
          ...childBranches.flatMap((branch) => branch.unions),
        ],
        minX: unitMinX,
        maxX: unitMaxX,
        minY: unitMinY,
        maxY: unitMaxY,
      });
    });

    recursionStack.delete(personId);

    return mergeBranches(branchParts);
  };


  /**
   * Construye las familias descendentes adicionales de un ancestro.
   *
   * Ejemplo: al dibujar a Juana desde la unión Leonilda–Gregorio, esta
   * función incorpora también la unión Leonilda–Víctor y a sus hijos.
   * Así una unión coParents no deja fuera del componente a medios hermanos
   * que pertenecen a otra combinación de progenitores.
   */
  const buildAdditionalAncestorFamilyBranches = (
    anchorPersonId: string,
    excludedUnionId: string,
    outwardSide: -1 | 1
  ): PersonBranch[] => {
    const extraUnions = (unionsByPartner.get(anchorPersonId) ?? [])
      .filter(
        (union) =>
          union.id !== excludedUnionId &&
          union.id !== rootParentUnion?.id &&
          !claimedUnions.has(unionKey(union))
      )
      .sort((first, second) => first.id.localeCompare(second.id));

    const excludedFamily = validUnions.find(
      (candidate) => candidate.id === excludedUnionId
    );
    const collateralSiblingCount = Math.max(
      0,
      (excludedFamily?.children.length ?? 1) - 1
    );
    let occupiedOutwardDistance =
      PERSON_HALF_WIDTH +
      FAMILY_LAYOUT.minimumHorizontalGap +
      collateralSiblingCount *
        (FAMILY_LAYOUT.personWidth + FAMILY_LAYOUT.childBranchGap);
    let hasPlacedAdditionalFamily = false;

    return extraUnions.map((union, unionIndex) => {
      claimedUnions.add(unionKey(union));

      const partnerId =
        union.partnerA === anchorPersonId
          ? union.partnerB || null
          : union.partnerA;
      const partnerBranch = partnerId
        ? buildPersonBranch(partnerId, union.id)
        : null;
      const childBranches = union.children
        .filter((childId) => childId !== anchorPersonId)
        .map((childId) => buildPersonBranch(childId, union.id))
        .filter((branch) => branch.persons.length > 0);
      const childSpan =
        childBranches.length === 0
          ? FAMILY_LAYOUT.personWidth
          : childBranches.reduce(
              (sum, branch) => sum + branchWidth(branch),
              0
            ) +
            FAMILY_LAYOUT.childBranchGap *
              Math.max(0, childBranches.length - 1);
      const rankGap =
        unionIndex *
        (FAMILY_LAYOUT.personWidth +
          FAMILY_LAYOUT.minimumHorizontalGap);
      const minimumMarkerDistance = partnerId
        ? FAMILY_LAYOUT.coupleDistance / 2 + rankGap
        : FAMILY_LAYOUT.personWidth / 2 +
          FAMILY_LAYOUT.minimumHorizontalGap +
          rankGap;
      const additionalFamilyGap = hasPlacedAdditionalFamily
        ? 0
        : FAMILY_LAYOUT.familyBlockGap;
      const childClearanceDistance =
        occupiedOutwardDistance +
        additionalFamilyGap +
        childSpan / 2;
      const markerDistance = Math.max(
        minimumMarkerDistance,
        childClearanceDistance
      );
      const partnerOuterExtent = partnerBranch
        ? Math.max(
            Math.abs(partnerBranch.minX),
            Math.abs(partnerBranch.maxX)
          )
        : PERSON_HALF_WIDTH;
      const familyOuterDistance = partnerId
        ? Math.max(
            markerDistance + childSpan / 2,
            markerDistance * 2 + partnerOuterExtent
          )
        : markerDistance + childSpan / 2;

      occupiedOutwardDistance =
        familyOuterDistance + FAMILY_LAYOUT.minimumHorizontalGap;
      const markerX = outwardSide * markerDistance;
      const unionY = partnerId ? 0 : FAMILY_LAYOUT.singleUnionDrop;
      const childY = FAMILY_LAYOUT.generationGap;
      const childStartX = markerX - childSpan / 2;
      const branchParts: PersonBranch[] = [];
      let childCursor = childStartX;

      childBranches.forEach((branch) => {
        const translated = translateBranch(
          branch,
          childCursor - branch.minX,
          childY,
          1
        );

        branchParts.push(translated);
        childCursor =
          translated.maxX + FAMILY_LAYOUT.childBranchGap;
      });

      const familyPersons: RelativePersonNode[] = [];
      const familyPartnerUnions: RelativeUnionNode[] = [];
      let familyMinX = markerX - FAMILY_LAYOUT.unionMarkerRadius;
      let familyMaxX = markerX + FAMILY_LAYOUT.unionMarkerRadius;
      let familyMinY = unionY - FAMILY_LAYOUT.unionMarkerRadius;
      let familyMaxY = unionY + FAMILY_LAYOUT.unionMarkerRadius;

      if (partnerId) {
        const partnerX = markerX * 2;

        if (partnerBranch && partnerBranch.persons.length > 0) {
          const translatedPartnerBranch = translateBranch(
            partnerBranch,
            partnerX,
            0,
            0
          );

          familyPersons.push(...translatedPartnerBranch.persons);
          familyPartnerUnions.push(...translatedPartnerBranch.unions);
          familyMinX = Math.min(
            familyMinX,
            translatedPartnerBranch.minX
          );
          familyMaxX = Math.max(
            familyMaxX,
            translatedPartnerBranch.maxX
          );
          familyMinY = Math.min(
            familyMinY,
            translatedPartnerBranch.minY
          );
          familyMaxY = Math.max(
            familyMaxY,
            translatedPartnerBranch.maxY
          );
        } else {
          const partner = personsById.get(partnerId);

          if (partner) {
            familyPersons.push({
              id: partner.id,
              key: `person:${partner.id}`,
              person: partner,
              role: roleFor(partner.id),
              level: 0,
              x: partnerX,
              y: 0,
            });

            familyMinX = Math.min(
              familyMinX,
              partnerX - PERSON_HALF_WIDTH
            );
            familyMaxX = Math.max(
              familyMaxX,
              partnerX + PERSON_HALF_WIDTH
            );
            familyMinY = Math.min(familyMinY, -PERSON_HALF_HEIGHT);
            familyMaxY = Math.max(familyMaxY, PERSON_HALF_HEIGHT);
          }
        }
      }

      const familyUnion: RelativeUnionNode = {
        id: union.id,
        union,
        level: 0,
        x: markerX,
        y: unionY,
        childrenCenterX: markerX,
        kind: union.kind,
        partnerAId: anchorPersonId,
        partnerBId: partnerId,
        childIds: childBranches.map((branch) => branch.rootPersonId),
      };

      branchParts.push({
        rootPersonId: anchorPersonId,
        persons: familyPersons,
        unions: [familyUnion, ...familyPartnerUnions],
        minX: familyMinX,
        maxX: familyMaxX,
        minY: familyMinY,
        maxY: familyMaxY,
      });

      hasPlacedAdditionalFamily = true;
      return mergeBranches(branchParts);
    });
  };


  /**
   * Construye los ancestros directos de una persona de forma recursiva.
   *
   * Reglas visuales:
   * - Una unión de pareja se muestra como un bloque parental conjunto.
   * - Dos relaciones parentales independientes se muestran como dos bloques
   *   separados; no se inventa una relación de pareja inexistente.
   * - Todos los padres válidos se conservan. El validador puede advertir más
   *   de dos, pero el layout no oculta información.
   * - Cada rama parental mide primero el espacio de sus propios ancestros y
   *   después reserva un intervalo horizontal antes de posicionarse.
   */
  const buildAncestorBranch = (
    personId: string,
    preferredCollateralSide: -1 | 0 | 1 = 0,
    excludedParentUnionIds: ReadonlySet<string> = new Set<string>()
  ): PersonBranch => {
    const person = personsById.get(personId);

    if (!person) {
      return {
        rootPersonId: personId,
        persons: [],
        unions: [],
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      };
    }

    const rootOnlyBranch = (): PersonBranch => ({
      rootPersonId: personId,
      persons: [
        {
          id: personId,
          key: `person:${personId}`,
          person,
          role: roleFor(personId),
          level: 0,
          x: 0,
          y: 0,
        },
      ],
      unions: [],
      minX: -PERSON_HALF_WIDTH,
      maxX: PERSON_HALF_WIDTH,
      minY: -PERSON_HALF_HEIGHT,
      maxY: PERSON_HALF_HEIGHT,
    });

    if (ancestorRecursionStack.has(personId)) {
      warnings.push(
        `Se detuvo una rama circular de ancestros al volver a ${personId}.`
      );
      return rootOnlyBranch();
    }

    const candidateParentUnions = (unionsByChild.get(personId) ?? [])
      .filter(
        (union) =>
          !excludedParentUnionIds.has(union.id) &&
          !ancestorClaimedUnions.has(union.id)
      )
      .sort((first, second) => {
        const firstIsCouple = Boolean(first.partnerB);
        const secondIsCouple = Boolean(second.partnerB);

        if (firstIsCouple !== secondIsCouple) {
          return firstIsCouple ? -1 : 1;
        }

        return first.id.localeCompare(second.id);
      });

    if (candidateParentUnions.length === 0) {
      return rootOnlyBranch();
    }

    if (candidateParentUnions.length > 2) {
      warnings.push(
        `${person.firstName} tiene ${candidateParentUnions.length} uniones parentales. Se mostrarán todas; revisa el modelo familiar si no es intencional.`
      );
    }

    ancestorRecursionStack.add(personId);
    candidateParentUnions.forEach((union) => {
      ancestorClaimedUnions.add(union.id);
    });

    type ParentUnit = {
      union: Union;
      // Clasificación geométrica; la semántica real vive en union.kind.
      kind: "couple" | "single";
      parentA: Person;
      parentB: Person | null;
      parentABranch: PersonBranch;
      parentAExtraFamilyBranches: PersonBranch[];
      parentBBranch: PersonBranch | null;
      parentBExtraFamilyBranches: PersonBranch[];
      collateralBranches: PersonBranch[];
      width: number;
      minX: number;
      maxX: number;
      parentAX: number;
      parentBX: number | null;
      markerX: number;
      centerX: number;
    };

    const parentUnits: ParentUnit[] = [];

    candidateParentUnions.forEach((parentUnion) => {
      const parentA = personsById.get(parentUnion.partnerA);
      const parentB = parentUnion.partnerB
        ? personsById.get(parentUnion.partnerB) ?? null
        : null;

      if (!parentA) {
        warnings.push(
          `No se pudo dibujar la unión parental ${parentUnion.id}: falta ${parentUnion.partnerA}.`
        );
        return;
      }

      const parentAOutwardSide =
        preferredCollateralSide !== 0 ? preferredCollateralSide : -1;
      /*
       * La rama ancestral principal y las familias descendentes adicionales
       * del progenitor se conservan separadas durante la colocación.
       *
       * Si se fusionan antes de ubicar a los hermanos de la unión actual,
       * los hijos de otras uniones se convierten en obstáculos y expulsan a
       * los hermanos legítimos fuera de su propio bloque familiar.
       */
      const parentABranch = buildAncestorBranch(
        parentA.id,
        parentAOutwardSide
      );
      const parentAExtraFamilyBranches =
        buildAdditionalAncestorFamilyBranches(
          parentA.id,
          parentUnion.id,
          parentAOutwardSide
        );
      const collateralBranches = Array.from(new Set(parentUnion.children))
        .filter((childId) => childId !== personId)
        .map((childId) => {
          const descendantBranch = buildPersonBranch(
            childId,
            parentUnion.id
          );
          const alternativeParentBranch = buildAncestorBranch(
            childId,
            preferredCollateralSide,
            new Set([parentUnion.id])
          );

          return mergeBranches([
            descendantBranch,
            alternativeParentBranch,
          ]);
        })
        .filter((branch) => branch.persons.length > 0)
        .sort((first, second) => {
          const firstHasAlternativeParent =
            first.minY < -PERSON_HALF_HEIGHT;
          const secondHasAlternativeParent =
            second.minY < -PERSON_HALF_HEIGHT;

          if (firstHasAlternativeParent !== secondHasAlternativeParent) {
            return firstHasAlternativeParent ? 1 : -1;
          }

          return branchWidth(first) - branchWidth(second);
        });
      // Los hermanos colaterales reservan espacio en su propia generación,
      // pero no deben separar artificialmente a los progenitores del hijo.
      // La anchura del bloque parental se calcula solo con sus ancestros.
      if (!parentB) {
        const minX = parentABranch.minX;
        const maxX = parentABranch.maxX;

        parentUnits.push({
          union: parentUnion,
          kind: "single",
          parentA,
          parentB: null,
          parentABranch,
          parentAExtraFamilyBranches,
          parentBBranch: null,
          parentBExtraFamilyBranches: [],
          collateralBranches,
          width: Math.max(FAMILY_LAYOUT.personWidth, maxX - minX),
          minX,
          maxX,
          parentAX: 0,
          parentBX: null,
          markerX: 0,
          centerX: 0,
        });
        return;
      }

      const parentBOutwardSide =
        preferredCollateralSide !== 0 ? preferredCollateralSide : 1;
      const parentBBranch = buildAncestorBranch(
        parentB.id,
        parentBOutwardSide
      );
      const parentBExtraFamilyBranches =
        buildAdditionalAncestorFamilyBranches(
          parentB.id,
          parentUnion.id,
          parentBOutwardSide
        );
      const requiredParentDistance = Math.max(
        FAMILY_LAYOUT.coupleDistance,
        parentABranch.maxX -
          parentBBranch.minX +
          FAMILY_LAYOUT.familyBlockGap
      );
      const parentAX = -requiredParentDistance / 2;
      const parentBX = requiredParentDistance / 2;
      const ancestorMinX = Math.min(
        parentABranch.minX + parentAX,
        parentBBranch.minX + parentBX
      );
      const ancestorMaxX = Math.max(
        parentABranch.maxX + parentAX,
        parentBBranch.maxX + parentBX
      );
      const minX = ancestorMinX;
      const maxX = ancestorMaxX;

      parentUnits.push({
        union: parentUnion,
        kind: "couple",
        parentA,
        parentB,
        parentABranch,
        parentAExtraFamilyBranches,
        parentBBranch,
        parentBExtraFamilyBranches,
        collateralBranches,
        width: Math.max(FAMILY_LAYOUT.coupleDistance, maxX - minX),
        minX,
        maxX,
        parentAX,
        parentBX,
        markerX: 0,
        centerX: 0,
      });
    });

    if (parentUnits.length === 0) {
      ancestorRecursionStack.delete(personId);
      return rootOnlyBranch();
    }

    // Una pareja parental principal queda centrada. Si solo hay relaciones
    // monoparentales, el conjunto completo se centra sobre el hijo. Las
    // unidades adicionales se distribuyen alternando izquierda y derecha.
    const coupleUnits = parentUnits.filter((unit) => unit.kind === "couple");
    const singleUnits = parentUnits.filter((unit) => unit.kind === "single");

    if (coupleUnits.length === 0) {
      const totalWidth =
        singleUnits.reduce((sum, unit) => sum + unit.width, 0) +
        FAMILY_LAYOUT.familyBlockGap * Math.max(0, singleUnits.length - 1);
      let cursor = -totalWidth / 2;

      singleUnits.forEach((unit) => {
        unit.centerX = cursor + unit.width / 2;
        unit.markerX = unit.centerX;
        cursor += unit.width + FAMILY_LAYOUT.familyBlockGap;
      });
    } else {
      const primary = coupleUnits[0];
      primary.centerX = 0;
      primary.markerX = 0;

      let occupiedLeft = primary.minX;
      let occupiedRight = primary.maxX;
      const additionalUnits = [
        ...coupleUnits.slice(1),
        ...singleUnits,
      ];

      additionalUnits.forEach((unit, index) => {
        const placeLeft = index % 2 === 0;

        if (placeLeft) {
          unit.centerX =
            occupiedLeft - FAMILY_LAYOUT.familyBlockGap - unit.width / 2;
          occupiedLeft = unit.centerX - unit.width / 2;
        } else {
          unit.centerX =
            occupiedRight + FAMILY_LAYOUT.familyBlockGap + unit.width / 2;
          occupiedRight = unit.centerX + unit.width / 2;
        }

        unit.markerX = unit.centerX;
      });
    }

    type CollateralPlacement = {
      branches: PersonBranch[];
      childIds: string[];
      childrenCenterX: number;
    };

    const parentCollisionY = -FAMILY_LAYOUT.generationGap;
    const stationaryParentBranches = parentUnits.flatMap((unit) => {
      const branches = [
        translateBranch(
          unit.parentABranch,
          unit.centerX + unit.parentAX,
          parentCollisionY,
          -1
        ),
      ];

      if (
        unit.parentBBranch &&
        unit.parentBX !== null
      ) {
        branches.push(
          translateBranch(
            unit.parentBBranch,
            unit.centerX + unit.parentBX,
            parentCollisionY,
            -1
          )
        );
      }

      return branches;
    });
    const globallyPlacedCollateralBranches: PersonBranch[] = [];
    const collateralPlacements = new Map<string, CollateralPlacement>();
    let occupiedChildLeft = -PERSON_HALF_WIDTH;
    let occupiedChildRight = PERSON_HALF_WIDTH;
    let centeredSiblingIndex = 0;

    parentUnits.forEach((unit) => {
      const placedCollateralBranches: PersonBranch[] = [];
      const childRootPositions = [0];

      unit.collateralBranches.forEach((branch) => {
        let side: -1 | 1;

        if (preferredCollateralSide !== 0) {
          // Mantiene libre el corredor visual de la pareja principal:
          // las ramas del miembro izquierdo crecen hacia la izquierda y
          // las del miembro derecho hacia la derecha.
          side = preferredCollateralSide;
        } else if (unit.centerX < -0.5) {
          side = -1;
        } else if (unit.centerX > 0.5) {
          side = 1;
        } else {
          side = centeredSiblingIndex % 2 === 0 ? -1 : 1;
          centeredSiblingIndex += 1;
        }

        let offsetX: number;

        if (side === -1) {
          offsetX =
            occupiedChildLeft -
            FAMILY_LAYOUT.familyBlockGap -
            branch.maxX;
        } else {
          offsetX =
            occupiedChildRight +
            FAMILY_LAYOUT.familyBlockGap -
            branch.minX;
        }

        const collisionShift = requiredOutwardShift(
          branch,
          offsetX,
          0,
          [
            ...stationaryParentBranches,
            ...globallyPlacedCollateralBranches,
          ],
          side
        );
        offsetX += side * collisionShift;

        const translated = translateBranch(branch, offsetX, 0, 0);

        if (side === -1) {
          occupiedChildLeft = Math.min(
            occupiedChildLeft,
            translated.minX
          );
        } else {
          occupiedChildRight = Math.max(
            occupiedChildRight,
            translated.maxX
          );
        }

        placedCollateralBranches.push(translated);
        globallyPlacedCollateralBranches.push(translated);
        childRootPositions.push(offsetX);
      });

      collateralPlacements.set(unit.union.id, {
        branches: placedCollateralBranches,
        childIds: [
          personId,
          ...placedCollateralBranches.map((branch) => branch.rootPersonId),
        ],
        childrenCenterX:
          (Math.min(...childRootPositions) +
            Math.max(...childRootPositions)) /
          2,
      });
    });

    const branchParts: PersonBranch[] = [rootOnlyBranch()];

    parentUnits.forEach((unit) => {
      const parentY = -FAMILY_LAYOUT.generationGap;
      const collateralPlacement = collateralPlacements.get(unit.union.id);
      const childrenCenterX =
        collateralPlacement?.childrenCenterX ?? unit.markerX;

      // El bloque parental principal se centra sobre sus propios hijos.
      // Las familias adicionales de cada progenitor se trasladan después,
      // junto con su persona ancla, pero nunca participan en el cálculo que
      // decide dónde deben quedar los hermanos de esta unión.
      const familyCenterShiftX =
        parentUnits.length === 1
          ? childrenCenterX - unit.markerX
          : 0;
      const parentAOffsetX =
        unit.centerX + unit.parentAX + familyCenterShiftX;
      const shiftedParentA = translateBranch(
        unit.parentABranch,
        parentAOffsetX,
        parentY,
        -1
      );
      const shiftedBranches: PersonBranch[] = [shiftedParentA];

      unit.parentAExtraFamilyBranches.forEach((branch) => {
        shiftedBranches.push(
          translateBranch(
            branch,
            parentAOffsetX,
            parentY,
            -1
          )
        );
      });

      if (
        unit.parentB &&
        unit.parentBBranch &&
        unit.parentBX !== null
      ) {
        const parentBOffsetX =
          unit.centerX + unit.parentBX + familyCenterShiftX;

        shiftedBranches.push(
          translateBranch(
            unit.parentBBranch,
            parentBOffsetX,
            parentY,
            -1
          )
        );

        unit.parentBExtraFamilyBranches.forEach((branch) => {
          shiftedBranches.push(
            translateBranch(
              branch,
              parentBOffsetX,
              parentY,
              -1
            )
          );
        });
      }

      const unionY =
        unit.kind === "couple"
          ? parentY
          : parentY + FAMILY_LAYOUT.singleUnionDrop;
      const unionNode: RelativeUnionNode = {
        id: unit.union.id,
        union: unit.union,
        level: -1,
        x: unit.markerX + familyCenterShiftX,
        y: unionY,
        childrenCenterX,
        kind: unit.union.kind,
        partnerAId: unit.parentA.id,
        partnerBId: unit.parentB?.id ?? null,
        childIds: collateralPlacement?.childIds ?? [personId],
      };

      branchParts.push(...shiftedBranches);
      branchParts.push(...(collateralPlacement?.branches ?? []));
      branchParts.push({
        rootPersonId: personId,
        persons: [],
        unions: [unionNode],
        minX: unit.markerX,
        maxX: unit.markerX,
        minY: unionY,
        maxY: unionY,
      });
    });

    ancestorRecursionStack.delete(personId);
    return mergeBranches(branchParts);
  };

  const siblingIds = rootParentUnion
    ? Array.from(new Set(rootParentUnion.children))
    : [rootPersonId];

  if (!siblingIds.includes(rootPersonId)) {
    siblingIds.push(rootPersonId);
  }

  siblingIds.sort((first, second) => {
    if (first === rootPersonId) return -1;
    if (second === rootPersonId) return 1;
    return first.localeCompare(second);
  });

  const branchesByPersonId = new Map<string, PersonBranch>();
  siblingIds.forEach((personId) => {
    branchesByPersonId.set(
      personId,
      buildPersonBranch(personId, rootParentUnion?.id ?? null)
    );
  });

  const rootBranch = branchesByPersonId.get(rootPersonId);

  if (!rootBranch) {
    throw new Error("No se pudo construir la rama de la persona principal.");
  }

  const placedBranches: PersonBranch[] = [rootBranch];
  const siblingRootPositions = new Map<string, number>();
  siblingRootPositions.set(rootPersonId, 0);

  let occupiedLeft = rootBranch.minX;
  let occupiedRight = rootBranch.maxX;

  /*
   * Los hijos de la unión parental principal deben conservarse como un
   * grupo reconocible. Antes se posicionaba cada rama usando su anchura
   * completa. Si la persona principal tenía una rama descendente grande,
   * sus hermanos eran expulsados fuera de ese bloque y terminaban mezclados
   * con los hijos de otra unión del mismo progenitor.
   *
   * Ahora se reserva primero una fila compacta para las tarjetas raíz de los
   * hermanos. La rama más pesada de la persona principal determina hacia qué
   * lado se colocan los demás: si crece principalmente a la derecha, los
   * hermanos se mantienen juntos a la izquierda, y viceversa. Solo se añade
   * desplazamiento adicional cuando las ramas reales colisionan.
   */
  const siblingRootGap =
    FAMILY_LAYOUT.personWidth + FAMILY_LAYOUT.childBranchGap;
  const rootLeftExtent = Math.max(
    0,
    -rootBranch.minX - PERSON_HALF_WIDTH
  );
  const rootRightExtent = Math.max(
    0,
    rootBranch.maxX - PERSON_HALF_WIDTH
  );
  const directionalThreshold =
    FAMILY_LAYOUT.personWidth + FAMILY_LAYOUT.minimumHorizontalGap;
  const compactSiblingSide: -1 | 0 | 1 =
    rootRightExtent > rootLeftExtent + directionalThreshold
      ? -1
      : rootLeftExtent > rootRightExtent + directionalThreshold
        ? 1
        : 0;
  const remainingSiblingIds = siblingIds.filter(
    (personId) => personId !== rootPersonId
  );

  const placeSiblingBranch = (
    personId: string,
    requestedRootX: number,
    side: -1 | 1
  ): number => {
    const branch = branchesByPersonId.get(personId);
    if (!branch) return requestedRootX;

    const collisionShift = requiredOutwardShift(
      branch,
      requestedRootX,
      0,
      placedBranches,
      side
    );
    const shiftX = requestedRootX + side * collisionShift;
    const translated = translateBranch(branch, shiftX, 0, 0);

    placedBranches.push(translated);
    siblingRootPositions.set(personId, shiftX);
    occupiedLeft = Math.min(occupiedLeft, translated.minX);
    occupiedRight = Math.max(occupiedRight, translated.maxX);

    return shiftX;
  };

  if (compactSiblingSide !== 0) {
    let nextRootX = compactSiblingSide * siblingRootGap;

    remainingSiblingIds.forEach((personId) => {
      const placedRootX = placeSiblingBranch(
        personId,
        nextRootX,
        compactSiblingSide
      );

      nextRootX =
        placedRootX + compactSiblingSide * siblingRootGap;
    });
  } else {
    let nextLeftRootX = -siblingRootGap;
    let nextRightRootX = siblingRootGap;

    remainingSiblingIds.forEach((personId, index) => {
      const side: -1 | 1 = index % 2 === 0 ? -1 : 1;
      const requestedRootX =
        side === -1 ? nextLeftRootX : nextRightRootX;
      const placedRootX = placeSiblingBranch(
        personId,
        requestedRootX,
        side
      );

      if (side === -1) {
        nextLeftRootX = placedRootX - siblingRootGap;
      } else {
        nextRightRootX = placedRootX + siblingRootGap;
      }
    });
  }

  const topLevelPersons: RelativePersonNode[] = [];
  const topLevelUnions: RelativeUnionNode[] = [];

  if (rootParentUnion) {
    claimedUnions.add(rootParentUnion.id);

    const childPositions = rootParentUnion.children
      .map((childId) => siblingRootPositions.get(childId))
      .filter((value): value is number => value !== undefined);
    const unionCenterX =
      childPositions.length > 0
        ? (Math.min(...childPositions) + Math.max(...childPositions)) / 2
        : 0;
    const parentY = -FAMILY_LAYOUT.generationGap;
    const unionY = parentY;

    const parentA = personsById.get(rootParentUnion.partnerA);
    const parentB = rootParentUnion.partnerB
      ? personsById.get(rootParentUnion.partnerB)
      : undefined;
    const parentAAncestorBranch = parentA
      ? buildAncestorBranch(parentA.id, -1)
      : null;
    const parentBAncestorBranch = parentB
      ? buildAncestorBranch(parentB.id, 1)
      : null;
    let rootParentDistance =
      parentA && parentB
        ? Math.max(
            FAMILY_LAYOUT.coupleDistance,
            (parentAAncestorBranch?.maxX ?? PERSON_HALF_WIDTH) -
              (parentBAncestorBranch?.minX ?? -PERSON_HALF_WIDTH) +
              FAMILY_LAYOUT.familyBlockGap
          )
        : 0;

    if (parentA && parentB) {
      const provisionalParentAX =
        unionCenterX - rootParentDistance / 2;
      const provisionalParentBX =
        unionCenterX + rootParentDistance / 2;
      const leftShift = parentAAncestorBranch
        ? requiredOutwardShift(
            parentAAncestorBranch,
            provisionalParentAX,
            parentY,
            placedBranches,
            -1
          )
        : 0;
      const rightShift = parentBAncestorBranch
        ? requiredOutwardShift(
            parentBAncestorBranch,
            provisionalParentBX,
            parentY,
            placedBranches,
            1
          )
        : 0;
      const additionalOutwardShift = Math.max(
        leftShift,
        rightShift
      );

      if (additionalOutwardShift > 0) {
        rootParentDistance +=
          additionalOutwardShift * 2 +
          FAMILY_LAYOUT.minimumHorizontalGap;
      }
    }

    const parentAX = parentB
      ? unionCenterX - rootParentDistance / 2
      : unionCenterX;
    const parentBX = unionCenterX + rootParentDistance / 2;

    if (parentA) {
      topLevelPersons.push({
        id: parentA.id,
        key: `person:${parentA.id}`,
        person: parentA,
        role: roleFor(parentA.id),
        level: -1,
        x: parentAX,
        y: parentY,
      });
    }

    if (parentB) {
      topLevelPersons.push({
        id: parentB.id,
        key: `person:${parentB.id}`,
        person: parentB,
        role: roleFor(parentB.id),
        level: -1,
        x: parentBX,
        y: parentY,
      });
    }

    topLevelUnions.push({
      id: rootParentUnion.id,
      union: rootParentUnion,
      level: -1,
      x: unionCenterX,
      y: unionY,
      childrenCenterX: unionCenterX,
      kind: rootParentUnion.kind,
      partnerAId: rootParentUnion.partnerA,
      partnerBId: parentB?.id ?? null,
      childIds: rootParentUnion.children.filter((childId) =>
        siblingRootPositions.has(childId)
      ),
    });


    if (parentAAncestorBranch) {
      placedBranches.push(
        translateBranch(
          parentAAncestorBranch,
          parentAX,
          parentY,
          -1
        )
      );
    }

    if (parentBAncestorBranch) {
      placedBranches.push(
        translateBranch(
          parentBAncestorBranch,
          parentBX,
          parentY,
          -1
        )
      );
    }


    const rootParentPlacements = [
      parentA
        ? {
            person: parentA,
            x: parentAX,
            outwardSide: -1 as const,
          }
        : null,
      parentB
        ? {
            person: parentB,
            x: parentBX,
            outwardSide: 1 as const,
          }
        : null,
    ].filter(
      (
        placement
      ): placement is {
        person: Person;
        x: number;
        outwardSide: -1 | 1;
      } => Boolean(placement)
    );

    rootParentPlacements.forEach((placement) => {
      const extraUnions = (unionsByPartner.get(placement.person.id) ?? [])
        .filter(
          (union) =>
            union.id !== rootParentUnion.id &&
            !claimedUnions.has(union.id)
        )
        .sort((first, second) => first.id.localeCompare(second.id));

      extraUnions.forEach((union, unionIndex) => {
        claimedUnions.add(union.id);

        const partnerId =
          union.partnerA === placement.person.id
            ? union.partnerB || null
            : union.partnerA;
        const partnerBranch = partnerId
          ? buildPersonBranch(partnerId, union.id)
          : null;

        const childBranches = union.children
          .filter((childId) => childId !== placement.person.id)
          .map((childId) => buildPersonBranch(childId, union.id))
          .filter((branch) => branch.persons.length > 0);

        const childSpan =
          childBranches.length === 0
            ? FAMILY_LAYOUT.personWidth
            : childBranches.reduce(
                (sum, branch) => sum + branchWidth(branch),
                0
              ) +
              FAMILY_LAYOUT.childBranchGap *
                (childBranches.length - 1);

        const isCouple = Boolean(partnerId);
        const rankDistance =
          unionIndex *
          (FAMILY_LAYOUT.personWidth +
            FAMILY_LAYOUT.minimumHorizontalGap);

        let groupMinX: number;
        let groupMaxX: number;
        let childrenCenterX: number;
        let markerX: number;
        let partnerX: number | null = null;

        if (isCouple) {
          const basePairDistance =
            FAMILY_LAYOUT.coupleDistance + rankDistance * 2;
          const partnerInwardExtent = partnerBranch
            ? placement.outwardSide === -1
              ? partnerBranch.maxX
              : -partnerBranch.minX
            : PERSON_HALF_WIDTH;
          const occupiedBoundaryDistance =
            placement.outwardSide === -1
              ? Math.max(0, placement.x - occupiedLeft)
              : Math.max(0, occupiedRight - placement.x);
          const requiredForPartnerClearance =
            2 *
            (partnerInwardExtent +
              FAMILY_LAYOUT.childBranchGap +
              childSpan / 2);
          const requiredForCentralClearance =
            2 *
            (occupiedBoundaryDistance +
              FAMILY_LAYOUT.familyBlockGap +
              childSpan / 2);
          const pairDistance = Math.max(
            basePairDistance,
            requiredForPartnerClearance,
            requiredForCentralClearance
          );

          markerX =
            placement.x +
            placement.outwardSide * (pairDistance / 2);
          partnerX =
            placement.x + placement.outwardSide * pairDistance;
          childrenCenterX = markerX;
          groupMinX = childrenCenterX - childSpan / 2;
          groupMaxX = childrenCenterX + childSpan / 2;
        } else if (placement.outwardSide === -1) {
          groupMaxX =
            occupiedLeft - FAMILY_LAYOUT.familyBlockGap;
          groupMinX = groupMaxX - childSpan;
          childrenCenterX = (groupMinX + groupMaxX) / 2;
          markerX = childrenCenterX;
        } else {
          groupMinX =
            occupiedRight + FAMILY_LAYOUT.familyBlockGap;
          groupMaxX = groupMinX + childSpan;
          childrenCenterX = (groupMinX + groupMaxX) / 2;
          markerX = childrenCenterX;
        }

        let childCursor = groupMinX;

        childBranches.forEach((branch) => {
          const translated = translateBranch(
            branch,
            childCursor - branch.minX,
            0,
            0
          );

          placedBranches.push(translated);
          childCursor =
            translated.maxX + FAMILY_LAYOUT.childBranchGap;
        });

        if (placement.outwardSide === -1) {
          occupiedLeft = Math.min(occupiedLeft, groupMinX);
        } else {
          occupiedRight = Math.max(occupiedRight, groupMaxX);
        }

        // Las uniones monoparentales adicionales usan un carril inferior
        // a la generación del progenitor. Esto evita que su conexión
        // horizontal atraviese las tarjetas de hermanos ubicadas en la
        // misma fila. Las uniones de pareja permanecen alineadas.
        const unionNodeY = isCouple
          ? parentY
          : parentY + FAMILY_LAYOUT.singleUnionDrop;

        if (partnerId && partnerX !== null) {
          if (partnerBranch && partnerBranch.persons.length > 0) {
            const translatedPartnerBranch = translateBranch(
              partnerBranch,
              partnerX,
              parentY,
              -1
            );

            placedBranches.push(translatedPartnerBranch);

            if (placement.outwardSide === -1) {
              occupiedLeft = Math.min(
                occupiedLeft,
                translatedPartnerBranch.minX
              );
            } else {
              occupiedRight = Math.max(
                occupiedRight,
                translatedPartnerBranch.maxX
              );
            }
          } else {
            const partner = personsById.get(partnerId);

            if (partner) {
              topLevelPersons.push({
                id: partner.id,
                key: `person:${partner.id}`,
                person: partner,
                role: roleFor(partner.id),
                level: -1,
                x: partnerX,
                y: parentY,
              });

              if (placement.outwardSide === -1) {
                occupiedLeft = Math.min(
                  occupiedLeft,
                  partnerX - PERSON_HALF_WIDTH
                );
              } else {
                occupiedRight = Math.max(
                  occupiedRight,
                  partnerX + PERSON_HALF_WIDTH
                );
              }
            }
          }
        }

        topLevelUnions.push({
          id: union.id,
          union,
          level: -1,
          x: markerX,
          y: unionNodeY,
          childrenCenterX,
          kind: union.kind,
          partnerAId: placement.person.id,
          partnerBId: partnerId,
          childIds: childBranches.map(
            (branch) => branch.rootPersonId
          ),
        });
      });
    });
  }

  const mergedDescendants = mergeBranches(placedBranches);

  const personMap = new Map<string, LayoutPersonNode>();
  const unionMap = new Map<string, LayoutUnionNode>();

  const addPersonNode = (node: RelativePersonNode): void => {
    const existing = personMap.get(node.id);

    if (!existing) {
      personMap.set(node.id, node);
      return;
    }

    if (existing.x !== node.x || existing.y !== node.y) {
      warnings.push(
        `La persona ${node.id} apareció en más de una rama. Se conservó la primera posición.`
      );
    }
  };

  const addUnionNode = (node: RelativeUnionNode): void => {
    if (!unionMap.has(node.id)) {
      unionMap.set(node.id, node);
    }
  };

  mergedDescendants.persons.forEach(addPersonNode);
  mergedDescendants.unions.forEach(addUnionNode);
  topLevelPersons.forEach(addPersonNode);
  topLevelUnions.forEach(addUnionNode);

  const layoutPersons = Array.from(personMap.values());
  const layoutUnions = Array.from(unionMap.values());
  const visiblePersonIds = new Set(layoutPersons.map((node) => node.id));
  const detachedPersonIds = persons
    .map((person) => person.id)
    .filter((personId) => !visiblePersonIds.has(personId));
  const bounds = createBounds(layoutPersons);
  const collisions = detectCollisions(layoutPersons);

  return {
    rootPersonId,
    selectedPersonId: validSelectedPersonId,
    persons: layoutPersons,
    unions: layoutUnions,
    bounds,
    warnings,
    collisions,
    detachedPersonIds,
  };
}
