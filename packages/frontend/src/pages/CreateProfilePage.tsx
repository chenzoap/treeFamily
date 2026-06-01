import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import { functions, auth } from "../lib/firebase";
import { useTreeStore } from "../store/useTreeStore";
import { useNavigate } from "react-router-dom";

const personSchema = z.object({
  firstName: z.string().trim().min(2, "Ingresa tu nombre."),
  middleName: z.string().optional().or(z.literal("")),
  lastName: z.string().trim().min(2, "Ingresa tu apellido."),
  secondLastName: z.string().optional().or(z.literal("")),
  birthDate: z.string().min(1, "Ingresa tu fecha de nacimiento."),
  birthPlace: z.string().optional().or(z.literal("")),
});

const createMeSchema = personSchema.extend({
  treeName: z.string().trim().min(3, "Ingresa un nombre para tu árbol."),
});

type CreateMeData = z.infer<typeof createMeSchema>;

type TreeSummaryResponse = {
  treeId: string | null;
  rootPersonId: string | null;
};

const CreateProfilePage = () => {
  const setTreeData = useTreeStore((state) => state.setTreeData);
  const navigate = useNavigate();
  const [checkingTree, setCheckingTree] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateMeData>({
    resolver: zodResolver(createMeSchema),
    defaultValues: {
      treeName: "Mi familia",
      middleName: "",
      secondLastName: "",
      birthPlace: "",
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setPageError(null);

        if (!user) {
          navigate("/login", { replace: true });
          return;
        }

        const getMyTreeSummary = httpsCallable<undefined, TreeSummaryResponse>(
          functions,
          "getMyTreeSummary"
        );

        const result = await getMyTreeSummary(undefined);
        const { treeId, rootPersonId } = result.data;

        if (treeId && rootPersonId) {
          setTreeData(treeId, rootPersonId);
          navigate("/tree", { replace: true });
          return;
        }
      } catch (error) {
        console.error("Error verificando árbol existente:", error);
        setPageError("No pudimos verificar si ya tienes un árbol. Puedes intentar crear tu perfil nuevamente.");
      } finally {
        setCheckingTree(false);
      }
    });

    return () => unsubscribe();
  }, [navigate, setTreeData]);

  const onSubmit = async (data: CreateMeData) => {
    try {
      setPageError(null);

      if (!auth.currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const getMyTreeSummary = httpsCallable<undefined, TreeSummaryResponse>(
        functions,
        "getMyTreeSummary"
      );
      const summaryResult = await getMyTreeSummary(undefined);
      if (summaryResult.data.treeId && summaryResult.data.rootPersonId) {
        setTreeData(summaryResult.data.treeId, summaryResult.data.rootPersonId);
        navigate("/tree", { replace: true });
        return;
      }

      const createTreeWithRootPerson = httpsCallable<
        CreateMeData,
        { treeId: string; rootPersonId: string }
      >(functions, "createTreeWithRootPerson");

      const result = await createTreeWithRootPerson(data);
      const { treeId, rootPersonId } = result.data;

      setTreeData(treeId, rootPersonId);
      navigate("/tree", { replace: true });
    } catch (error) {
      console.error("Error al crear el árbol:", error);
      setPageError("No pudimos crear tu árbol. Revisa la información e intenta nuevamente.");
    }
  };

  if (checkingTree) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl bg-white border shadow-sm p-6 text-center max-w-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
          <h1 className="text-lg font-bold text-slate-800">Revisando tu árbol</h1>
          <p className="text-sm text-slate-600 mt-1">Estamos preparando tu espacio familiar privado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white border rounded-2xl shadow-sm p-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-blue-700 mb-2">Tree Family</p>
          <h1 className="text-3xl font-bold text-slate-900">Empecemos contigo</h1>
          <p className="text-sm text-slate-600 mt-2">
            Tu árbol familiar comienza con tu información básica. Luego podrás agregar a tus familiares cercanos.
          </p>
        </div>

        {pageError && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {pageError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Nombre del árbol</span>
            <input
              {...register("treeName")}
              placeholder="Ej: Familia Aragon"
              className="mt-1 w-full border p-3 rounded-lg border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.treeName && <p className="mt-1 text-red-600 text-xs">{errors.treeName.message}</p>}
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tu nombre *</span>
              <input {...register("firstName")} placeholder="Fernando" className="mt-1 w-full border p-3 rounded-lg border-slate-200" />
              {errors.firstName && <p className="mt-1 text-red-600 text-xs">{errors.firstName.message}</p>}
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Segundo nombre</span>
              <input {...register("middleName")} placeholder="Opcional" className="mt-1 w-full border p-3 rounded-lg border-slate-200" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Apellido *</span>
              <input {...register("lastName")} placeholder="Aragon" className="mt-1 w-full border p-3 rounded-lg border-slate-200" />
              {errors.lastName && <p className="mt-1 text-red-600 text-xs">{errors.lastName.message}</p>}
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Segundo apellido</span>
              <input {...register("secondLastName")} placeholder="Opcional" className="mt-1 w-full border p-3 rounded-lg border-slate-200" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Fecha de nacimiento *</span>
              <input {...register("birthDate")} type="date" className="mt-1 w-full border p-3 rounded-lg border-slate-200" />
              {errors.birthDate && <p className="mt-1 text-red-600 text-xs">{errors.birthDate.message}</p>}
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Lugar de nacimiento</span>
              <input {...register("birthPlace")} placeholder="Ciudad, país (opcional)" className="mt-1 w-full border p-3 rounded-lg border-slate-200" />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
          >
            {isSubmitting ? "Creando tu árbol..." : "Crear mi árbol"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateProfilePage;
