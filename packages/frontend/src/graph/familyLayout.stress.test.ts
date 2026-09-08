import { describe, expect, it } from "vitest";
import {
  stressTreeFixtures,
  type StressTreeFixture,
} from "../test/fixtures/stressTrees";
import type { LayoutPersonNode } from "./familyLayout";
import { buildFamilyLayout, FAMILY_LAYOUT } from "./familyLayout";
import { buildUnionsWithDiagnostics } from "./union";

const WARMUP_RUNS = 5;
const MEASURED_RUNS = 30;
const SAFETY_CEILING_MS = 1_000;

const thresholds = new Map([
  [25, { pass: 15, blocker: 40 }],
  [50, { pass: 35, blocker: 80 }],
  [100, { pass: 80, blocker: 180 }],
]);

type Classification = "PASS" | "WARNING" | "BLOCKER";

function assertUnique(values: string[]): void {
  expect(new Set(values).size).toBe(values.length);
}

function assertFixtureIntegrity(fixture: StressTreeFixture): void {
  const personIds = fixture.persons.map((person) => person.id);
  const relationshipIds = fixture.relationships.map(
    (relationship) => relationship.id
  );
  const personIdSet = new Set(personIds);
  const rootPersons = fixture.persons.filter((person) => person.isRoot);

  assertUnique(personIds);
  assertUnique(relationshipIds);
  expect(rootPersons).toHaveLength(1);
  expect(rootPersons[0].id).toBe(fixture.rootPersonId);

  fixture.persons.forEach((person) => {
    expect(person.firstName.trim().length).toBeGreaterThan(0);
    expect(person.lastName.trim().length).toBeGreaterThan(0);
  });

  const relationshipKeys = new Set<string>();
  const parentsByChild = new Map<string, Set<string>>();
  const adjacency = new Map(
    personIds.map((personId) => [personId, new Set<string>()])
  );

  fixture.relationships.forEach((relationship) => {
    expect(personIdSet.has(relationship.fromPersonId)).toBe(true);
    expect(personIdSet.has(relationship.toPersonId)).toBe(true);
    expect(relationship.fromPersonId).not.toBe(relationship.toPersonId);

    const endpoints =
      relationship.type === "PARTNER_OF"
        ? [relationship.fromPersonId, relationship.toPersonId].sort()
        : [relationship.fromPersonId, relationship.toPersonId];
    const relationshipKey = `${relationship.type}:${endpoints.join("->")}`;
    expect(relationshipKeys.has(relationshipKey)).toBe(false);
    relationshipKeys.add(relationshipKey);

    adjacency.get(relationship.fromPersonId)!.add(relationship.toPersonId);
    adjacency.get(relationship.toPersonId)!.add(relationship.fromPersonId);

    if (relationship.type === "PARENT_OF") {
      expect(["father", "mother"]).toContain(relationship.parentRole);
      const parents = parentsByChild.get(relationship.toPersonId) ?? new Set();
      parents.add(relationship.fromPersonId);
      parentsByChild.set(relationship.toPersonId, parents);
    }
  });

  parentsByChild.forEach((parents) => expect(parents.size).toBeLessThanOrEqual(2));

  const visited = new Set<string>([fixture.rootPersonId]);
  const pending = [fixture.rootPersonId];
  while (pending.length > 0) {
    const current = pending.shift()!;
    adjacency.get(current)!.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        pending.push(neighbor);
      }
    });
  }
  expect(visited.size).toBe(fixture.persons.length);

  expect(personIdSet.has(fixture.selectionTargets.deep)).toBe(true);
  expect(personIdSet.has(fixture.selectionTargets.lateral)).toBe(true);
  expect(fixture.selectionTargets.deep).not.toBe(
    fixture.selectionTargets.lateral
  );
}

function physicalOverlaps(persons: LayoutPersonNode[]): string[] {
  const overlaps: string[] = [];
  for (let firstIndex = 0; firstIndex < persons.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < persons.length;
      secondIndex += 1
    ) {
      const first = persons[firstIndex];
      const second = persons[secondIndex];
      const overlapsX =
        Math.abs(first.x - second.x) < FAMILY_LAYOUT.personWidth;
      const overlapsY =
        Math.abs(first.y - second.y) < FAMILY_LAYOUT.personHeight;
      if (overlapsX && overlapsY) overlaps.push(`${first.id}:${second.id}`);
    }
  }
  return overlaps;
}

function percentile(sortedValues: number[], percentileValue: number): number {
  const index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

function classify(personCount: number, median: number): Classification {
  const threshold = thresholds.get(personCount);
  if (!threshold) throw new Error(`No thresholds for ${personCount} persons.`);
  if (median <= threshold.pass) return "PASS";
  if (median <= threshold.blocker) return "WARNING";
  return "BLOCKER";
}

describe("P06 pure family layout stress", () => {
  stressTreeFixtures.forEach((fixture, fixtureIndex) => {
    it(`${fixture.persons.length} persons remain valid, complete and deterministic`, () => {
      const expectedPersonCount = [25, 50, 100][fixtureIndex];
      expect(fixture.persons).toHaveLength(expectedPersonCount);
      assertFixtureIntegrity(fixture);

      const normalization = buildUnionsWithDiagnostics(
        fixture.persons,
        fixture.relationships
      );
      expect(normalization.issues).toEqual([]);

      const buildLayout = () =>
        buildFamilyLayout(
          fixture.rootPersonId,
          fixture.selectionTargets.deep,
          fixture.persons,
          normalization.unions
        );

      const layout = buildLayout();
      const repeatedLayout = buildLayout();
      const layoutIds = layout.persons.map((node) => node.id);
      const inputIds = fixture.persons.map((person) => person.id).sort();
      const overlapPairs = physicalOverlaps(layout.persons);

      expect(layoutIds.slice().sort()).toEqual(inputIds);
      assertUnique(layoutIds);
      expect(layout.detachedPersonIds).toEqual([]);
      expect(overlapPairs).toEqual([]);
      expect(layout.persons.some((node) => node.id === fixture.selectionTargets.deep)).toBe(true);
      expect(layout.persons.some((node) => node.id === fixture.selectionTargets.lateral)).toBe(true);

      layout.persons.forEach((node) => {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      });
      Object.values(layout.bounds).forEach((value) =>
        expect(Number.isFinite(value)).toBe(true)
      );
      expect(layout.bounds.width).toBeGreaterThan(0);
      expect(layout.bounds.height).toBeGreaterThan(0);

      const repeatedPositions = new Map(
        repeatedLayout.persons.map((node) => [node.id, [node.x, node.y]])
      );
      layout.persons.forEach((node) => {
        expect(repeatedPositions.get(node.id)).toEqual([node.x, node.y]);
      });

      for (let index = 0; index < WARMUP_RUNS; index += 1) buildLayout();

      const timings: number[] = [];
      for (let index = 0; index < MEASURED_RUNS; index += 1) {
        const startedAt = performance.now();
        buildLayout();
        const duration = performance.now() - startedAt;
        expect(duration).toBeLessThanOrEqual(SAFETY_CEILING_MS);
        timings.push(duration);
      }

      timings.sort((left, right) => left - right);
      const median =
        timings.length % 2 === 0
          ? (timings[timings.length / 2 - 1] + timings[timings.length / 2]) / 2
          : timings[Math.floor(timings.length / 2)];
      const classification = classify(fixture.persons.length, median);
      const unionCounts = normalization.unions.reduce(
        (counts, union) => ({ ...counts, [union.kind]: counts[union.kind] + 1 }),
        { couple: 0, coParents: 0, singleParent: 0 }
      );

      console.info("[P06-layout-stress]", {
        persons: fixture.persons.length,
        relationships: fixture.relationships.length,
        unions: normalization.unions.length,
        couples: unionCounts.couple,
        coParents: unionCounts.coParents,
        singleParents: unionCounts.singleParent,
        diagnostics: normalization.issues.length,
        layoutWarnings: layout.warnings.length,
        collisions: layout.collisions.length,
        collisionDetails: layout.collisions,
        physicalOverlaps: overlapPairs.length,
        detached: layout.detachedPersonIds.length,
        bounds: layout.bounds,
        timingMs: {
          median,
          p95: percentile(timings, 95),
          min: timings[0],
          max: timings[timings.length - 1],
        },
        classification,
      });

      expect(classification).not.toBe("BLOCKER");
    });
  });
});
