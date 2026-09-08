import type { FamilyLayoutResult } from "../graph/familyLayout";
import { buildFamilyLayout } from "../graph/familyLayout";
import { buildUnionsWithDiagnostics } from "../graph/union";
import type { Union } from "../types/family";
import { renderFullTree } from "../visualization/renderTree";
import {
  stressTreeFixtures,
  type StressTreeFixture,
} from "./fixtures/stressTrees";

interface RenderMetrics {
  layoutMs: number;
  renderSyncMs: number;
  readyMs: number;
}

interface HarnessState {
  size: number;
  personIds: string[];
  unionIds: string[];
  selectionTargets: StressTreeFixture["selectionTargets"];
  selectedPersonId: string | null;
  layout: FamilyLayoutResult;
  metrics: RenderMetrics;
  renderSeq: number;
}

interface P06StressApi {
  readonly size: number;
  readonly fixture: StressTreeFixture;
  readonly unions: Union[];
  render(selectedPersonId?: string | null): Promise<HarnessState>;
  getState(): HarnessState;
}

declare global {
  interface Window {
    __P06_STRESS__?: P06StressApi;
  }
}

const allowedSizes = new Set([25, 50, 100]);
const requestedSize = Number(
  new URLSearchParams(window.location.search).get("p06Size")
);
const info = document.querySelector<HTMLOutputElement>("#p06-info");
const svg = document.querySelector<SVGSVGElement>("#p06-tree");

if (!allowedSizes.has(requestedSize) || !info || !svg) {
  const message = allowedSizes.has(requestedSize)
    ? "El harness P06 no encontró sus elementos DOM requeridos."
    : `p06Size inválido: ${String(requestedSize)}. Usa 25, 50 o 100.`;
  document.documentElement.dataset.p06Error = message;
  if (info) info.textContent = message;
  throw new Error(message);
}

const harnessInfo = info;
const harnessSvg = svg;

const fixture = stressTreeFixtures.find(
  (candidate) => candidate.persons.length === requestedSize
)!;
const normalization = buildUnionsWithDiagnostics(
  fixture.persons,
  fixture.relationships
);

if (normalization.issues.length > 0) {
  throw new Error(
    `El fixture P06 produjo ${normalization.issues.length} diagnostic(s).`
  );
}

let renderSeq = 0;
let state: HarnessState;

const afterTwoAnimationFrames = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

async function render(
  selectedPersonId: string | null = null
): Promise<HarnessState> {
  document.documentElement.dataset.p06Ready = "false";

  const layoutStartedAt = performance.now();
  const layout = buildFamilyLayout(
    fixture.rootPersonId,
    selectedPersonId,
    fixture.persons,
    normalization.unions
  );
  const layoutMs = performance.now() - layoutStartedAt;

  const width = harnessSvg.clientWidth;
  const height = harnessSvg.clientHeight;
  const readyStartedAt = performance.now();
  const renderStartedAt = performance.now();
  renderFullTree(harnessSvg, layout, width, height);
  const renderSyncMs = performance.now() - renderStartedAt;
  await afterTwoAnimationFrames();
  const readyMs = performance.now() - readyStartedAt;

  renderSeq += 1;
  state = {
    size: requestedSize,
    personIds: fixture.persons.map((person) => person.id),
    unionIds: normalization.unions.map((union) => union.id),
    selectionTargets: fixture.selectionTargets,
    selectedPersonId,
    layout,
    metrics: { layoutMs, renderSyncMs, readyMs },
    renderSeq,
  };

  document.documentElement.dataset.p06RenderSeq = String(renderSeq);
  document.documentElement.dataset.p06Ready = "true";
  harnessInfo.textContent = `P06 ${requestedSize}: render ${renderSeq}`;
  return state;
}

window.__P06_STRESS__ = {
  size: requestedSize,
  fixture,
  unions: normalization.unions,
  render,
  getState: () => state,
};

void render();
