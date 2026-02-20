import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { httpsCallable } from "firebase/functions";
import { signInAnonymously } from "firebase/auth";
import { functions, auth } from "../lib/firebase";
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

const createMeSchema = personSchema.extend({
  treeName: z.string().min(3, "Nombre del árbol requerido"),
});

type CreateMeData = z.infer<typeof createMeSchema>;

const DEV_TREE_ID = "demo-tree-001";

const CreateMe = () => {
  const setTreeData = useTreeStore((state) => state.setTreeData);
  const navigate = useNavigate();

  // ✅ Login por rootPersonId
  const [rootLoginId, setRootLoginId] = useState<string>("");
  const [loginLoading, setLoginLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateMeData>({
    resolver: zodResolver(createMeSchema),
    defaultValues: { middleName: "", secondLastName: "" },
  });

  const onLogin = async () => {
    const rootId = rootLoginId.trim();
    if (!rootId) {
      alert("Ingresa el ID del root (ej: p_root).");
      return;
    }

    try {
      setLoginLoading(true);

      // Auth anónimo (emulador)
      await signInAnonymously(auth);

      // Guardar treeId + rootPersonId en Zustand (persist)
      setTreeData(DEV_TREE_ID, rootId);

      // Ir al árbol
      navigate("/tree");
    } catch (error) {
      console.error("Error en login:", error);
      alert("No se pudo hacer login. Revisa consola.");
    } finally {
      setLoginLoading(false);
    }
  };

  const onSubmit = async (data: CreateMeData) => {
    try {
      await signInAnonymously(auth);

      const createTreeWithRootPerson = httpsCallable<
        CreateMeData,
        { treeId: string; rootPersonId: string }
      >(functions, "createTreeWithRootPerson");

      const result = await createTreeWithRootPerson(data);
      const { treeId, rootPersonId } = result.data;

      setTreeData(treeId, rootPersonId);
      navigate("/add-parents");
    } catch (error) {
      console.error("Error al crear el árbol:", error);
      alert("Error al crear el perfil inicial.");
    }
  };

  return (
    <div className="max-w-md mx-auto p-10">
      <h1 className="text-3xl font-bold mb-6 text-slate-800">Crea tu Árbol</h1>

      {/* ✅ NUEVO: Login rápido */}
      <div className="mb-6 p-4 border rounded-md bg-slate-50">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Login (DEV)</h2>
        <p className="text-xs text-slate-600 mb-3">
          Ingresa el ID de la persona root (ej: <b>p_root</b>) para ver el árbol.
          <span className="text-slate-500"> (treeId: {DEV_TREE_ID})</span>
        </p>

        <div className="flex gap-2">
          <input
            value={rootLoginId}
            onChange={(e) => setRootLoginId(e.target.value)}
            placeholder="Root Person ID (ej: p_root)"
            className="flex-1 border p-2 rounded border-blue-200"
          />
          <button
            type="button"
            onClick={onLogin}
            disabled={loginLoading}
            className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-md hover:bg-emerald-700 disabled:bg-slate-400"
          >
            {loginLoading ? "..." : "Login"}
          </button>
        </div>
      </div>

      {/* Form existente: crear árbol */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input
          {...register("treeName")}
          placeholder="Nombre de tu Árbol (Ej: Familia Pérez)"
          className="w-full border p-2 rounded border-blue-200"
        />
        {errors.treeName && <p className="text-red-500 text-xs">{errors.treeName.message}</p>}

        <div className="grid grid-cols-2 gap-4">
          <input {...register("firstName")} placeholder="Tu Nombre" className="border p-2 rounded" />
          <input {...register("middleName")} placeholder="Segundo Nombre" className="border p-2 rounded" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input {...register("lastName")} placeholder="Primer Apellido" className="border p-2 rounded" />
          <input {...register("secondLastName")} placeholder="Segundo Apellido" className="border p-2 rounded" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input {...register("birthDate")} type="date" className="w-full border p-2 rounded" />
          <input {...register("birthPlace")} placeholder="Ciudad, País" className="w-full border p-2 rounded" />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 disabled:bg-slate-400"
        >
          {isSubmitting ? "Creando..." : "Comenzar mi Árbol"}
        </button>
      </form>
    </div>
  );
};

export default CreateMe;
