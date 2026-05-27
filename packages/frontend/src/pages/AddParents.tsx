/**
 * LEGACY / TEMPORAL
 *
 * Esta pantalla pertenece al flujo antiguo para agregar padres.
 * Ya no está registrada en App.tsx y no debe usarse en el flujo principal.
 *
 * Motivo:
 * - Usa addPerson y addRelationship directamente.
 * - Esas funciones ahora están marcadas como legacy.
 * - El flujo principal de Etapa 4 debe manejarse desde Stage4Panel.
 *
 * Mantener temporalmente como referencia hasta confirmar que puede eliminarse.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { httpsCallable, FunctionsError } from "firebase/functions";
import { functions } from "../lib/firebase"; 
import { useTreeStore } from "../store/useTreeStore";
import { useNavigate } from "react-router-dom";

const personSchema = z.object({
  firstName: z.string().min(2, "Requerido"),
  middleName: z.string().optional().or(z.literal("")), 
  lastName: z.string().min(2, "Requerido"),
  secondLastName: z.string().optional().or(z.literal("")),
  birthDate: z.string().min(1, "Fecha requerida"),
  birthPlace: z.string().min(2, "Lugar requerido"),
});

type ParentFormData = z.infer<typeof personSchema>;

interface AddPersonPayload {
  treeId: string;
  personData: ParentFormData;
}

const AddParents = () => {
  const navigate = useNavigate();
  const { rootPersonId, treeId, persons } = useTreeStore();
  
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<ParentFormData>({
    resolver: zodResolver(personSchema),
    defaultValues: { middleName: "", secondLastName: "" }
  });

  const onAddParent = async (data: ParentFormData) => {
    if (!treeId || !rootPersonId) {
      alert("Error: Datos del árbol no encontrados. Regresa al paso anterior.");
      return;
    }

    try {
      const addPersonFn = httpsCallable<AddPersonPayload, { personId: string }>(functions, 'addPerson');
      const personResult = await addPersonFn({ treeId, personData: data });
      const newParentId = personResult.data.personId;

      const addRelFn = httpsCallable(functions, 'addRelationship');
      await addRelFn({
        treeId,
        type: "PARENT_OF",
        fromPersonId: newParentId,
        toPersonId: rootPersonId
      });

      alert("Familiar agregado correctamente.");
      reset(); 

    } catch (error: unknown) {
      let errorMessage = "Ocurrió un error inesperado.";
      if (error instanceof Error) {
        const fError = error as FunctionsError;
        errorMessage = fError.code === 'permission-denied' 
          ? "No tienes permisos." 
          : fError.message;
        console.error("Error detallado:", fError);
      }
      alert(`Error al vincular: ${errorMessage}`);
    }
  };

  return (
    <div className="p-10 max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-slate-800 text-center">Paso 2: Tus Raíces</h1>
      <p className="text-slate-500 mt-2 mb-8 text-center">Agrega a tus padres uno a la vez.</p>

      <form onSubmit={handleSubmit(onAddParent)} className="space-y-4 bg-white p-6 rounded-xl border shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <input {...register("firstName")} placeholder="Nombre" className="border p-2 rounded" />
          <input {...register("middleName")} placeholder="Segundo Nombre" className="border p-2 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input {...register("lastName")} placeholder="Apellido" className="border p-2 rounded" />
          <input {...register("secondLastName")} placeholder="Segundo Apellido" className="border p-2 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input {...register("birthDate")} type="date" className="border p-2 rounded" />
          <input {...register("birthPlace")} placeholder="Lugar" className="border p-2 rounded" />
        </div>
        
        <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg disabled:bg-slate-300">
          {isSubmitting ? "Guardando..." : "Agregar y Vincular"}
        </button>
      </form>

      <div className="mt-8 space-y-3">
        <button onClick={() => navigate("/tree")} className="w-full border-2 border-blue-600 text-blue-600 font-bold py-3 rounded-lg">
          Ver mi Árbol →
        </button>
        <p className="text-center text-xs text-slate-400">Personas en el árbol: {persons.length}</p>
      </div>
    </div>
  );
};

export default AddParents;