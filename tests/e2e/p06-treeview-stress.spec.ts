import { expect, test, type Page } from "@playwright/test";

const VIEWPORT = { width: 1440, height: 1000 };
const WARMUPS = 2;
const RUNS = 10;
const SAFETY_CEILING_MS = 1_500;
const expectedUnions = { 25: 9, 50: 19, 100: 34 } as const;

function summarize(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    min: sorted[0],
    median: (sorted[4] + sorted[5]) / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted[sorted.length - 1],
  };
}

function classify(size: number, median: number) {
  const limits = {
    25: { pass: 250, blocker: 450 },
    50: { pass: 350, blocker: 650 },
    100: { pass: 550, blocker: 1000 },
  }[size]!;
  if (median <= limits.pass) return "PASS";
  if (median <= limits.blocker) return "WARNING";
  return "BLOCKER";
}

async function inspectDom(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>("svg")!;
    const cards = Array.from(
      document.querySelectorAll<SVGGElement>("[data-person-id]")
    );
    const rects = cards.map((card) => ({
      id: card.dataset.personId!,
      rect: card.getBoundingClientRect().toJSON(),
    }));
    const overlaps: string[] = [];
    for (let first = 0; first < rects.length; first += 1) {
      for (let second = first + 1; second < rects.length; second += 1) {
        const a = rects[first];
        const b = rects[second];
        const width = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const height = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (width > 1 && height > 1) overlaps.push(`${a.id}:${b.id}`);
      }
    }
    const svgRect = svg.getBoundingClientRect();
    const visible = rects.filter(({ rect }) =>
      rect.right > svgRect.left && rect.left < svgRect.right &&
      rect.bottom > svgRect.top && rect.top < svgRect.bottom
    ).length;
    const bounds = rects.reduce(
      (value, { rect }) => ({
        left: Math.min(value.left, rect.left),
        top: Math.min(value.top, rect.top),
        right: Math.max(value.right, rect.right),
        bottom: Math.max(value.bottom, rect.bottom),
      }),
      { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
    );
    return {
      personIds: rects.map(({ id }) => id),
      unionIds: Array.from(document.querySelectorAll<SVGGElement>("[data-union-id]"),
        (node) => node.dataset.unionId!),
      selectedIds: Array.from(document.querySelectorAll<SVGGElement>('[data-selected="true"]'),
        (node) => node.dataset.personId!),
      zeroSized: rects.filter(({ rect }) => rect.width === 0 || rect.height === 0).map(({ id }) => id),
      overlaps,
      visible,
      svg: { width: svg.clientWidth, height: svg.clientHeight },
      bounds: { ...bounds, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top },
      transform: svg.querySelector(":scope > g")?.getAttribute("transform") ?? null,
    };
  });
}

async function measureSelection(page: Page, personId: string): Promise<number> {
  return page.evaluate((targetId) => new Promise<number>((resolve, reject) => {
    const startedAt = performance.now();
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Selection timeout for ${targetId}`));
    }, 2_000);
    const observer = new MutationObserver(() => {
      const selected = document.querySelector(
        `[data-person-id="${CSS.escape(targetId)}"][data-selected="true"]`
      );
      if (!selected) return;
      window.clearTimeout(timeout);
      observer.disconnect();
      resolve(performance.now() - startedAt);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    window.__P06_TREEVIEW__!.select(targetId);
  }), personId);
}

async function clearSelection(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error("Clear selection timeout"));
    }, 2_000);
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-selected="true"]')) return;
      window.clearTimeout(timeout);
      observer.disconnect();
      resolve();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    window.__P06_TREEVIEW__!.clearSelection();
  }));
}

async function testCoalescing(page: Page, deep: string, lateral: string) {
  await clearSelection(page);
  return page.evaluate(({ deepId, lateralId }) => new Promise<{
    history: string[];
    finalSelection: string;
  }>((resolve, reject) => {
    const history: string[] = [];
    const record = () => {
      const current = document.querySelector<SVGGElement>('[data-selected="true"]')?.dataset.personId;
      if (current && history.at(-1) !== current) history.push(current);
      if (current === lateralId) finish();
    };
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error("Debounce coalescing timeout"));
    }, 2_000);
    const finish = () => {
      window.clearTimeout(timeout);
      observer.disconnect();
      resolve({ history, finalSelection: lateralId });
    };
    const observer = new MutationObserver(record);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    window.__P06_TREEVIEW__!.select(deepId);
    window.setTimeout(() => window.__P06_TREEVIEW__!.select(lateralId), 30);
  }), { deepId: deep, lateralId: lateral });
}

async function zoomOnce(page: Page): Promise<boolean> {
  const before = (await inspectDom(page)).transform;
  const box = await page.locator("svg").boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, -350);
  await expect.poll(async () => (await inspectDom(page)).transform).not.toBe(before);
  return true;
}

test.describe("P06 TreeView and Zustand integration stress", () => {
  test.use({ viewport: VIEWPORT });

  for (const size of [25, 50, 100] as const) {
    test(`${size} persons survive TreeView debounce, selection and redraw`, async ({ page }) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      const warnings: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
        if (message.type() === "warning" && /\[family-(?:layout|layout-collision|connector)\]/.test(message.text())) {
          warnings.push(message.text());
        }
      });

      await page.goto(`/p06-treeview.html?p06Size=${size}`);
      await page.locator('html[data-p06-treeview-mounted="true"]').waitFor();
      await page.locator('html[data-p06-treeview-ready="true"]').waitFor();
      const expected = await page.evaluate(() => window.__P06_TREEVIEW__!.getState());
      const initial = await inspectDom(page);

      expect(initial.personIds).toHaveLength(size);
      expect(new Set(initial.personIds).size).toBe(size);
      expect(initial.personIds.slice().sort()).toEqual(expected.personIds.slice().sort());
      expect(initial.unionIds).toHaveLength(expectedUnions[size]);
      expect(new Set(initial.unionIds).size).toBe(expectedUnions[size]);
      expect(initial.zeroSized).toEqual([]);
      expect(initial.overlaps).toEqual([]);
      expect(initial.visible).toBeGreaterThan(0);
      expect(initial.svg).toEqual(VIEWPORT);

      const targets = expected.selectionTargets;
      for (let index = 0; index < WARMUPS; index += 1) {
        await measureSelection(page, index % 2 === 0 ? targets.deep : targets.lateral);
      }
      const timings: number[] = [];
      for (let index = 0; index < RUNS; index += 1) {
        timings.push(await measureSelection(page, index % 2 === 0 ? targets.deep : targets.lateral));
      }
      const latency = summarize(timings);
      const latencyClassification = classify(size, latency.median);
      expect(latency.max).toBeLessThanOrEqual(SAFETY_CEILING_MS);
      expect(latencyClassification).not.toBe("BLOCKER");

      await measureSelection(page, targets.deep);
      const deepDom = await inspectDom(page);
      expect(deepDom.selectedIds).toEqual([targets.deep]);
      expect(deepDom.personIds).toHaveLength(size);
      expect(deepDom.unionIds).toHaveLength(expectedUnions[size]);
      expect(deepDom.overlaps).toEqual([]);

      let zoomAfterDeep: boolean | null = null;
      let zoomAfterLateral: boolean | null = null;
      if (size === 100) zoomAfterDeep = await zoomOnce(page);

      await measureSelection(page, targets.lateral);
      const lateralDom = await inspectDom(page);
      expect(lateralDom.selectedIds).toEqual([targets.lateral]);
      expect(lateralDom.personIds).toHaveLength(size);
      expect(lateralDom.unionIds).toHaveLength(expectedUnions[size]);
      expect(lateralDom.overlaps).toEqual([]);
      if (size === 100) zoomAfterLateral = await zoomOnce(page);

      const coalescing = await testCoalescing(page, targets.deep, targets.lateral);
      expect(coalescing.history).toEqual([targets.lateral]);
      expect(coalescing.finalSelection).toBe(targets.lateral);
      const coalescedDom = await inspectDom(page);
      expect(coalescedDom.personIds).toHaveLength(size);
      expect(coalescedDom.unionIds).toHaveLength(expectedUnions[size]);
      expect(coalescedDom.overlaps).toEqual([]);

      await page.waitForTimeout(200);
      const screenshot = `/tmp/p06-treeview-${size}.png`;
      await page.screenshot({ path: screenshot, fullPage: true });
      if (size === 100) {
        await page.screenshot({ path: "/tmp/p06-treeview-100-selected.png", fullPage: true });
      }

      console.info("[P06-treeview-stress]", {
        persons: size,
        unions: expectedUnions[size],
        viewport: VIEWPORT,
        personBounds: initial.bounds,
        initiallyVisible: initial.visible,
        initialOverlaps: initial.overlaps.length,
        warmups: WARMUPS,
        runs: RUNS,
        selectionLatencyMs: latency,
        classification: latencyClassification,
        coalescing: {
          deepSent: targets.deep,
          lateralSentAfterMs: 30,
          intermediateSelections: coalescing.history.filter((id) => id !== targets.lateral),
          finalSelection: coalescing.finalSelection,
        },
        zoomAfterDeep,
        zoomAfterLateral,
        pageErrors,
        consoleErrors,
        warnings,
        screenshot,
      });

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(warnings).toEqual([]);
    });
  }
});

declare global {
  interface Window {
    __P06_TREEVIEW__: {
      select(personId: string): void;
      clearSelection(): void;
      getState(): {
        personIds: string[];
        selectionTargets: { deep: string; lateral: string };
      };
    };
  }
}
