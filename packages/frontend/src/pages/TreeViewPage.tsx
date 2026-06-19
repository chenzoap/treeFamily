import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../lib/firebase";
import { useTreeStore } from "../store/useTreeStore";
import { type Person, type Relationship } from "../types/family";
import TreeView from "./TreeView";
import Stage4Panel from "../components/Stage4Panel";
import EmptyTreeState from "../components/tree/EmptyTreeState";

type TreeSummaryResponse = {
  treeId: string | null;
  rootPersonId: string | null;
};

function personLabel(person?: Person): string | undefined {
  if (!person) return undefined;

  return `${person.firstName ?? ""} ${person.lastName ?? ""}`.replace(/\s+/g, " ").trim();
}

function countConnectedFamilyMembers(rootPersonId: string | null, relationships: Relationship[]): number {
  if (!rootPersonId) return 0;

  const connectedIds = new Set<string>();

  relationships.forEach((relationship) => {
    if (relationship.fromPersonId === rootPersonId) {
      connectedIds.add(relationship.toPersonId);
    }

    if (relationship.toPersonId === rootPersonId) {
      connectedIds.add(relationship.fromPersonId);
    }
  });

  return connectedIds.size;
}

const TreeViewPage = () => {
  const navigate = useNavigate();
  const {
    setPersons,
    setRelationships,
    setRootPersonId,
    setTreeData,
    resetTree,
    loading,
    setLoading,
    treeId,
    rootPersonId,
    persons,
    relationships,
  } = useTreeStore();

  const [authChecking, setAuthChecking] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setLoadError(null);

        if (!user) {
          resetTree();
          navigate("/login", { replace: true });
          return;
        }

        const getMyTreeSummary = httpsCallable<undefined, TreeSummaryResponse>(
          functions,
          "getMyTreeSummary"
        );

        const result = await getMyTreeSummary(undefined);
        const { treeId: existingTreeId, rootPersonId: existingRootPersonId } = result.data;

        if (!existingTreeId || !existingRootPersonId) {
          resetTree();
          navigate("/create-profile", { replace: true });
          return;
        }

        setTreeData(existingTreeId, existingRootPersonId);
      } catch (error) {
        console.error("Error verificando árbol del usuario:", error);
        setLoadError("No pudimos verificar tu árbol. Intenta nuevamente.");
      } finally {
        setAuthChecking(false);
      }
    });

    return () => unsubscribe();
  }, [navigate, resetTree, setTreeData]);

  useEffect(() => {
    if (!treeId) return;

    setLoading(true);
    setLoadError(null);

    const unsubPersons = onSnapshot(
      collection(db, "trees", treeId, "persons"),
      (snapshot) => {
        const personsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Person));

        setPersons(personsData);

        const root = personsData.find((p) => p.isRoot);
        if (root) setRootPersonId(root.id);

        setLoading(false);
      },
      (error) => {
        console.error("Error cargando personas:", error);
        setLoadError("No pudimos cargar las personas de tu árbol.");
        setLoading(false);
      }
    );

    const unsubRels = onSnapshot(
      collection(db, "trees", treeId, "relationships"),
      (snapshot) => {
        const relsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Relationship));

        setRelationships(relsData);
      },
      (error) => {
        console.error("Error cargando relaciones:", error);
        setLoadError("No pudimos cargar las relaciones de tu árbol.");
      }
    );

    return () => {
      unsubPersons();
      unsubRels();
    };
  }, [treeId, setPersons, setRelationships, setRootPersonId, setLoading]);

  const rootPerson = useMemo(
    () => persons.find((person) => person.id === rootPersonId),
    [persons, rootPersonId]
  );

  const connectedFamilyCount = useMemo(
    () => countConnectedFamilyMembers(rootPersonId, relationships),
    [rootPersonId, relationships]
  );

  const isLoadingTree = authChecking || loading;

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Tree Family
            </p>
            <h1 className="mt-0.5 text-xl font-bold text-slate-900">
              🌳 Mi árbol familiar
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Tu árbol es privado por defecto. Solo tú puedes verlo y editarlo en esta versión.
            </p>
          </div>

          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            onClick={async () => {
              await auth.signOut();
              resetTree();
              navigate("/login", { replace: true });
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden p-4">
        <aside className="mr-4 flex w-[400px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
              Construye tu árbol
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Acciones rápidas
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Agrega familiares cercanos sin manejar datos técnicos.
            </p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {connectedFamilyCount < 2 && (
              <EmptyTreeState
                connectedFamilyCount={connectedFamilyCount}
                rootName={personLabel(rootPerson)}
              />
            )}

            <Stage4Panel />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <section className="h-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            {isLoadingTree ? (
              <div className="flex h-full items-center justify-center">
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
                  <h2 className="mt-4 text-base font-bold text-slate-900">
                    Cargando tu árbol familiar...
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Estamos preparando tus familiares y relaciones.
                  </p>
                </div>
              </div>
            ) : loadError ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl">
                    ⚠️
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-slate-900">
                    No pudimos cargar tu árbol
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">{loadError}</p>
                  <button
                    type="button"
                    className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    onClick={() => window.location.reload()}
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            ) : (
              <TreeView />
            )}
          </section>
        </main>
      </div>

      {import.meta.env.DEV && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-1 text-center text-xs font-semibold text-red-600">
          Running in emulator mode. Do not use with production credentials.
        </div>
      )}
    </div>
  );
};

export default TreeViewPage;