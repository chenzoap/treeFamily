import { useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useTreeStore } from "../store/useTreeStore";
import { type Person, type Relationship } from "../types/family";
import TreeView from "./TreeView";
import Stage4Panel from "../components/Stage4Panel";
//import AddRelationshipForm from "../components/AddRelationshipForm";

const TreeViewPage = () => {
  const { setPersons, setRelationships, setRootPersonId, loading, setLoading, treeId } = useTreeStore();

  useEffect(() => {
    if (!treeId) return;
    
    setLoading(true);

    // Escuchar Personas del árbol específico
    const unsubPersons = onSnapshot(
      collection(db, "trees", treeId, "persons"), 
      (snapshot) => {
        const personsData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Person));
        
        setPersons(personsData);

        const root = personsData.find(p => p.isRoot);
        if (root) setRootPersonId(root.id);
        
        setLoading(false);
      }
    );

    // Escuchar Relaciones del árbol específico
    const unsubRels = onSnapshot(
      collection(db, "trees", treeId, "relationships"), 
      (snapshot) => {
        const relsData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Relationship));
        
        setRelationships(relsData);
      }
    );

    return () => {
      unsubPersons();
      unsubRels();
    };
  }, [treeId, setPersons, setRelationships, setRootPersonId, setLoading]);

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">🌳 Mi Árbol Genealógico</h1>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-white border-r p-4 overflow-y-auto">
          <Stage4Panel  />
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-700">
              <strong>Nota:</strong> Ahora el sistema busca automáticamente hacia arriba (padres) y hacia abajo (hijos).
            </p>
          </div>
        </aside>

        <main className="flex-1 relative p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
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