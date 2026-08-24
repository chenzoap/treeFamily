import {useEffect, useRef, useState} from "react";
import {
  deletePersonErrorMessage,
  finishDeleteSubmission,
  startDeleteSubmission,
} from "./DeletePersonDialog.logic";

type DeletePersonDialogProps = {
  personName: string;
  relationshipCount: number;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export default function DeletePersonDialog({
  personName,
  relationshipCount,
  onCancel,
  onConfirm,
}: DeletePersonDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const submissionGateRef = useRef(false);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, submitting]);

  const confirm = async () => {
    if (!startDeleteSubmission(submissionGateRef)) return;
    try {
      setSubmitting(true);
      setError(null);
      await onConfirm();
    } catch (reason) {
      setError(deletePersonErrorMessage(reason));
      finishDeleteSubmission(submissionGateRef);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="presentation"
    >
      <section
        className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-person-title"
        aria-describedby="delete-person-description"
      >
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-700">
          Acción permanente
        </p>
        <h2 id="delete-person-title" className="mt-1 text-xl font-bold text-slate-900">
          ¿Eliminar a {personName}?
        </h2>
        <div id="delete-person-description" className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          <p>
            Esta acción eliminará permanentemente a esta persona y sus conexiones directas del árbol.
          </p>
          <p>
            Sus familiares permanecerán en el árbol. Esta acción no se puede deshacer.
          </p>
          <p className="font-semibold text-slate-800">
            Conexiones registradas: {relationshipCount}
          </p>
          <p className="text-xs text-slate-500">
            Este conteo es informativo; el servidor verificará las conexiones actuales.
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-xl bg-red-700 px-4 py-3 font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={submitting}
            onClick={confirm}
          >
            {submitting ? "Eliminando..." : "Eliminar persona"}
          </button>
        </div>
      </section>
    </div>
  );
}
