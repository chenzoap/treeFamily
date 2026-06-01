import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../lib/firebase";
import { useTreeStore } from "../store/useTreeStore";

type TreeSummaryResponse = {
  treeId: string | null;
  rootPersonId: string | null;
};

function authErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";

  if (code === "auth/invalid-email") return "Revisa tu correo electrónico.";
  if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "Correo o contraseña incorrectos.";
  }
  if (code === "auth/too-many-requests") return "Demasiados intentos. Intenta nuevamente más tarde.";

  return "No pudimos iniciar sesión. Intenta nuevamente.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setTreeData = useTreeStore((state) => state.setTreeData);
  const resetTree = useTreeStore((state) => state.resetTree);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);
      resetTree();

      await signInWithEmailAndPassword(auth, email.trim(), password);

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

      navigate("/create-profile", { replace: true });
    } catch (err) {
      console.error("Error iniciando sesión:", err);
      resetTree();
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-blue-700 mb-2">Tree Family</p>
          <h1 className="text-3xl font-bold text-slate-900">Inicia sesión</h1>
          <p className="text-sm text-slate-600 mt-2">
            Entra para continuar construyendo tu árbol familiar privado.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Correo electrónico</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full border p-3 rounded-lg border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tu@email.com"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full border p-3 rounded-lg border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tu contraseña"
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
          >
            {loading ? "Entrando..." : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          ¿Todavía no tienes cuenta?{" "}
          <Link className="font-semibold text-blue-700 hover:underline" to="/signup">
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}
