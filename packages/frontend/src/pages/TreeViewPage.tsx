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

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800">🌳 Mi árbol familiar</h1>
          <p className="text-xs text-slate-500">Privado por defecto</p>
        </div>
        <button
          type="button"
          className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={async () => {
            await auth.signOut();
            resetTree();
            navigate("/login", { replace: true });
          }}
        >
          Cerrar sesión
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-96 bg-white border-r p-4 overflow-y-auto space-y-4">
          {connectedFamilyCount < 2 && (
            <EmptyTreeState connectedFamilyCount={connectedFamilyCount} rootName={personLabel(rootPerson)} />
          )}

          <Stage4Panel />
        </aside>

        <main className="flex-1 relative p-6">
          {authChecking || loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : loadError ? (
            <div className="flex items-center justify-center h-full">
              <div className="max-w-md rounded-2xl bg-white border p-6 text-center shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">No pudimos cargar tu árbol</h2>
                <p className="text-sm text-slate-600 mt-2">{loadError}</p>
                <button
                  type="button"
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
                  onClick={() => window.location.reload()}
                >
                  Reintentar
                </button>
              </div>
            </div>
          ) : (
            <TreeView />
          )}
        </main>
      </div>
    </div>
  );
};

export default TreeViewPage;
