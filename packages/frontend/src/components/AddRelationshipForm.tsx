import React, { useState } from "react";
import { useTreeStore } from "../store/useTreeStore";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../lib/firebase";
import { type RelationshipType } from "../types/family";

const AddRelationshipForm = () => {
  const { persons, treeId } = useTreeStore();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [type, setType] = useState<RelationshipType>("PARTNER_OF");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Verificación de seguridad para TypeScript
    if (!treeId) {
      alert("Error: No se encontró el ID del árbol.");
      return;
    }

    if (!fromId || !toId || fromId === toId) {
      alert("Selecciona dos personas diferentes");
      return;
    }

    setLoading(true);
    try {
      // Usamos una aserción de tipo o simplemente confiamos en el check anterior
      // La ruta es: trees/{treeId}/relationships
      const relationshipRef = collection(db, "trees", treeId as string, "relationships");

      await addDoc(relationshipRef, {
        fromPersonId: fromId,
        toPersonId: toId,
        type: type,
        createdAt: new Date().toISOString()
      });
      
      setFromId("");
      setToId("");
      alert("Relación creada con éxito");
    } catch (error) {
      console.error("Error creando relación:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Conectar Familiares</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600">Persona A</label>
          <select 
            value={fromId} 
            onChange={(e) => setFromId(e.target.value)}
            className="w-full mt-1 p-2 border rounded-md bg-slate-50"
          >
            <option value="">Seleccionar...</option>
            {persons.map(p => (
              <option key={p.id} value={p.id}>{p.firstName} {p.lastName} {p.secondLastName}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600">Es...</label>
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value as RelationshipType)}
            className="w-full mt-1 p-2 border rounded-md bg-slate-50 font-bold text-blue-600"
          >
            <option value="PARTNER_OF">PAREJA DE</option>
            <option value="PARENT_OF">PADRE/MADRE DE</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600">Persona B</label>
          <select 
            value={toId} 
            onChange={(e) => setToId(e.target.value)}
            className="w-full mt-1 p-2 border rounded-md bg-slate-50"
          >
            <option value="">Seleccionar...</option>
            {persons.map(p => (
              <option key={p.id} value={p.id}>{p.firstName} {p.lastName} {p.secondLastName}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Guardando..." : "Establecer Vínculo"}
        </button>
      </form>
    </div>
  );
};

export default AddRelationshipForm;