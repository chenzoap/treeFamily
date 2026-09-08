import { expect, test, type Page } from "@playwright/test";

const VIEWPORT = { width: 1440, height: 1000 };
const WARMUPS = 3;
const RUNS = 10;
const SAFETY_CEILING_MS = 1_500;
const screenshotPaths: Record<number, string> = {
  25: "/tmp/p06-render-stress-25.png",
  50: "/tmp/p06-render-stress-50.png",
  100: "/tmp/p06-render-stress-100.png",
};

type Timing = { renderSyncMs: number; readyMs: number };

function summary(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
  return {
    min: sorted[0],
    median,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted[sorted.length - 1],
  };
}

function classification(size: number, median: number) {
  const limits = {
    25: { pass: 80, blocker: 180 },
    50: { pass: 150, blocker: 350 },
    100: { pass: 300, blocker: 700 },
  }[size]!;
  if (median <= limits.pass) return "PASS";
  if (median <= limits.blocker) return "WARNING";
  return "BLOCKER";
}

async function render(page: Page, selectedPersonId?: string): Promise<Timing> {
  return page.evaluate(async (selection) => {
    const result = await window.__P06_STRESS__!.render(selection ?? null);
    return result.metrics;
  }, selectedPersonId);
}

async function inspectDom(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>("#p06-tree")!;
    const cards = Array.from(
      document.querySelectorAll<SVGGElement>("[data-person-id]")
    );
    const rects = cards.map((card) => ({
      id: card.dataset.personId!,
      rect: card.getBoundingClientRect().toJSON(),
    }));
    const zeroSized = rects.filter(
      ({ rect }) => rect.width === 0 || rect.height === 0
    ).map(({ id }) => id);
    const overlaps: string[] = [];
    for (let first = 0; first < rects.length; first += 1) {
      for (let second = first + 1; second < rects.length; second += 1) {
        const a = rects[first];
        const b = rects[second];
        const intersectionWidth =
          Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const intersectionHeight =
          Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (intersectionWidth > 1 && intersectionHeight > 1) {
          overlaps.push(`${a.id}:${b.id}`);
        }
      }
    }
    const svgRect = svg.getBoundingClientRect();
    const visible = rects.filter(({ rect }) =>
      rect.right > svgRect.left &&
      rect.left < svgRect.right &&
      rect.bottom > svgRect.top &&
      rect.top < svgRect.bottom
    ).length;
    const personBounds = rects.reduce(
      (bounds, { rect }) => ({
        left: Math.min(bounds.left, rect.left),
        top: Math.min(bounds.top, rect.top),
        right: Math.max(bounds.right, rect.right),
        bottom: Math.max(bounds.bottom, rect.bottom),
      }),
      { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
    );
    const transform = svg.querySelector(":scope > g")?.getAttribute("transform") ?? null;
    const scaleMatch = transform?.match(/scale\(([^)]+)\)/);
    return {
      personIds: rects.map(({ id }) => id),
      unionIds: Array.from(document.querySelectorAll("[data-union-id]"), (node) =>
        (node as SVGGElement).dataset.unionId!
      ),
      selectedIds: Array.from(
        document.querySelectorAll<SVGGElement>('[data-selected="true"]'),
        (node) => node.dataset.personId!
      ),
      zeroSized,
      overlaps,
      visible,
      svg: { width: svg.clientWidth, height: svg.clientHeight },
      personBounds: {
        ...personBounds,
        width: personBounds.right - personBounds.left,
        height: personBounds.bottom - personBounds.top,
      },
      transform,
      initialScale: scaleMatch ? Number(scaleMatch[1]) : null,
    };
  });
}

test.describe("P06 Chromium SVG render stress", () => {
  test.use({ viewport: VIEWPORT });

  for (const size of [25, 50, 100]) {
    test(`${size} persons render and redraw with stable SVG geometry`, async ({ page }) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      const relevantWarnings: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
        if (
          message.type() === "warning" &&
          /\[family-(?:layout|layout-collision|connector)\]/.test(message.text())
        ) relevantWarnings.push(message.text());
      });

      await page.goto(`/p06-stress.html?p06Size=${size}`);
      await page.locator('html[data-p06-ready="true"]').waitFor();

      const expected = await page.evaluate(() => window.__P06_STRESS__!.getState());
      const initial = await inspectDom(page);
      expect(initial.personIds).toHaveLength(size);
      expect(new Set(initial.personIds).size).toBe(size);
      expect(initial.personIds.slice().sort()).toEqual(expected.personIds.slice().sort());
      expect(initial.unionIds).toHaveLength(expected.unionIds.length);
      expect(new Set(initial.unionIds).size).toBe(expected.unionIds.length);
      expect(initial.zeroSized).toEqual([]);
      expect(initial.overlaps).toEqual([]);
      expect(initial.visible).toBeGreaterThan(0);
      expect(initial.svg).toEqual(VIEWPORT);
      expect(initial.transform).not.toBeNull();
      expect(Number.isFinite(initial.initialScale)).toBe(true);

      for (let index = 0; index < WARMUPS; index += 1) await render(page);
      const timings: Timing[] = [];
      for (let index = 0; index < RUNS; index += 1) timings.push(await render(page));
      const renderSync = summary(timings.map((timing) => timing.renderSyncMs));
      const ready = summary(timings.map((timing) => timing.readyMs));
      const renderClassification = classification(size, renderSync.median);
      expect(renderSync.max).toBeLessThanOrEqual(SAFETY_CEILING_MS);
      expect(renderClassification).not.toBe("BLOCKER");

      const beforeDeepSeq = Number(
        await page.locator("html").getAttribute("data-p06-render-seq")
      );
      await render(page, expected.selectionTargets.deep);
      const afterDeep = await inspectDom(page);
      expect(Number(await page.locator("html").getAttribute("data-p06-render-seq"))).toBe(
        beforeDeepSeq + 1
      );
      expect(afterDeep.personIds).toHaveLength(size);
      expect(afterDeep.overlaps).toEqual([]);
      expect(afterDeep.selectedIds).toEqual([expected.selectionTargets.deep]);

      await render(page, expected.selectionTargets.lateral);
      const afterLateral = await inspectDom(page);
      expect(afterLateral.personIds).toHaveLength(size);
      expect(afterLateral.overlaps).toEqual([]);
      expect(afterLateral.selectedIds).toEqual([expected.selectionTargets.lateral]);

      let zoomChanged: boolean | null = null;
      if (size === 100) {
        const beforeZoom = afterLateral.transform;
        const svgBox = await page.locator("#p06-tree").boundingBox();
        expect(svgBox).not.toBeNull();
        await page.mouse.move(svgBox!.x + svgBox!.width / 2, svgBox!.y + svgBox!.height / 2);
        await page.mouse.wheel(0, -400);
        await expect.poll(async () => (await inspectDom(page)).transform).not.toBe(beforeZoom);
        zoomChanged = true;
      }

      await page.waitForTimeout(200);
      await page.screenshot({ path: screenshotPaths[size], fullPage: true });

      console.info("[P06-render-stress]", {
        persons: size,
        unions: expected.unionIds.length,
        viewport: VIEWPORT,
        layoutBounds: expected.layout.bounds,
        svg: initial.svg,
        personBounds: initial.personBounds,
        initiallyVisible: initial.visible,
        initialScale: initial.initialScale,
        physicalOverlaps: initial.overlaps.length,
        warmups: WARMUPS,
        runs: RUNS,
        renderSyncMs: renderSync,
        readyMs: ready,
        classification: renderClassification,
        deepSelection: expected.selectionTargets.deep,
        lateralSelection: expected.selectionTargets.lateral,
        zoomChanged,
        pageErrors,
        consoleErrors,
        relevantWarnings,
        screenshot: screenshotPaths[size],
      });

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }
});

declare global {
  interface Window {
    __P06_STRESS__: {
      render(selectedPersonId?: string | null): Promise<{
        metrics: Timing & { layoutMs: number };
      }>;
      getState(): {
        personIds: string[];
        unionIds: string[];
        selectionTargets: { deep: string; lateral: string };
        layout: { bounds: Record<string, number> };
      };
    };
  }
}
