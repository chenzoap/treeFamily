import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import TreeView from "../pages/TreeView";
import { useTreeStore } from "../store/useTreeStore";
import type { StressTreeFixture } from "./fixtures/stressTrees";
import { stressTreeFixtures } from "./fixtures/stressTrees";

interface TreeViewHarnessState {
  size: number;
  personIds: string[];
  selectionTargets: StressTreeFixture["selectionTargets"];
  selectedPersonId: string | null;
}

interface P06TreeViewApi {
  readonly size: number;
  readonly fixture: StressTreeFixture;
  select(personId: string): void;
  clearSelection(): void;
  getState(): TreeViewHarnessState;
}

declare global {
  interface Window {
    __P06_TREEVIEW__?: P06TreeViewApi;
  }
}

const allowedSizes = new Set([25, 50, 100]);
const requestedSize = Number(
  new URLSearchParams(window.location.search).get("p06Size")
);
const rootElement = document.querySelector<HTMLDivElement>("#root");
const info = document.querySelector<HTMLOutputElement>("#p06-info");

if (!allowedSizes.has(requestedSize) || !rootElement || !info) {
  const message = allowedSizes.has(requestedSize)
    ? "El harness TreeView P06 no encontró sus elementos DOM requeridos."
    : `p06Size inválido: ${String(requestedSize)}. Usa 25, 50 o 100.`;
  document.documentElement.dataset.p06TreeviewError = message;
  if (info) info.textContent = message;
  throw new Error(message);
}

const harnessRoot = rootElement;
const harnessInfo = info;
const fixture = stressTreeFixtures.find(
  (candidate) => candidate.persons.length === requestedSize
)!;

localStorage.removeItem("family-tree-storage");
const store = useTreeStore.getState();
store.resetTree();
store.setPersons(fixture.persons);
store.setRelationships(fixture.relationships);
store.setRootPersonId(fixture.rootPersonId);
store.setSelectedPersonId(null);

const observer = new MutationObserver(() => {
  const personCount = document.querySelectorAll("[data-person-id]").length;
  if (personCount === requestedSize) {
    document.documentElement.dataset.p06TreeviewReady = "true";
    harnessInfo.textContent = `TreeView P06 ${requestedSize}: listo`;
  }
});
observer.observe(harnessRoot, { childList: true, subtree: true });

export function Harness(): React.JSX.Element {
  useEffect(() => {
    document.documentElement.dataset.p06TreeviewMounted = "true";
  }, []);
  return <TreeView />;
}

window.__P06_TREEVIEW__ = {
  size: requestedSize,
  fixture,
  select(personId) {
    useTreeStore.getState().setSelectedPersonId(personId);
  },
  clearSelection() {
    useTreeStore.getState().setSelectedPersonId(null);
  },
  getState() {
    return {
      size: requestedSize,
      personIds: fixture.persons.map((person) => person.id),
      selectionTargets: fixture.selectionTargets,
      selectedPersonId: useTreeStore.getState().selectedPersonId,
    };
  },
};

createRoot(harnessRoot).render(<Harness />);
