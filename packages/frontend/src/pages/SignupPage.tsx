import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../lib/firebase";
import { useTreeStore } from "../store/useTreeStore";

type TreeSummaryResponse = {
  treeId: string | null;
  rootPersonId: string | null;
};

function signupErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";

  if (code === "auth/email-already-in-use") {
    return "Ya existe una cuenta con este correo. Inicia sesión.";
  }
  if (code === "auth/invalid-email") return "Revisa tu correo electrónico.";
  if (code === "auth/weak-password") return "La contraseña debe tener al menos 6 caracteres.";

  return "No pudimos crear tu cuenta. Intenta nuevamente.";
}

export default function SignupPage() {
  const navigate = useNavigate();
  const setTreeData = useTreeStore((state) => state.setTreeData);
  const resetTree = useTreeStore((state) => state.resetTree);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      resetTree();

      await createUserWithEmailAndPassword(auth, email.trim(), password);

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
      console.error("Error creando cuenta:", err);
      resetTree();
      setError(signupErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-blue-700 mb-2">Tree Family</p>
          <h1 className="text-3xl font-bold text-slate-900">Crea tu cuenta</h1>
          <p className="text-sm text-slate-600 mt-2">
            Tu árbol será privado y estará asociado a tu cuenta.
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
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full border p-3 rounded-lg border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Confirmar contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1 w-full border p-3 rounded-lg border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Repite tu contraseña"
              minLength={6}
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          ¿Ya tienes cuenta?{" "}
          <Link className="font-semibold text-blue-700 hover:underline" to="/login">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
