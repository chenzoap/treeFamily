import {useEffect, useRef, useState} from "react";
import {
  deleteRelationshipErrorMessage,
  type RelationshipPresentation,
} from "./DeleteRelationshipDialog.logic";
import {
  finishDeleteSubmission,
  startDeleteSubmission,
} from "./DeletePersonDialog.logic";

type Props = {
  relationship: RelationshipPresentation;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export default function DeleteRelationshipDialog({
  relationship,
  onCancel,
  onConfirm,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const submissionGateRef = useRef(false);

  useEffect(() => cancelButtonRef.current?.focus(), []);
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
      setError(deleteRelationshipErrorMessage(reason));
      finishDeleteSubmission(submissionGateRef);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <section
        className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-relationship-title"
        aria-describedby="delete-relationship-description"
      >
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-700">
          Quitar conexión
        </p>
        <h2 id="delete-relationship-title" className="mt-1 text-xl font-bold text-slate-900">
          {relationship.title}
        </h2>
        <div id="delete-relationship-description" className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          {relationship.type === "PARENT_OF" ? (
            <>
              <p>Ninguna persona será eliminada. Solo se eliminará esta conexión parental.</p>
              <p>Las personas seguirán perteneciendo al árbol, pero la forma en que aparecen puede cambiar.</p>
              <p>No se reasignará automáticamente otro padre o madre.</p>
            </>
          ) : (
            <>
              <p>Ninguna persona será eliminada. Solo se eliminará esta relación de pareja.</p>
              <p>Las relaciones parentales con sus hijos permanecerán.</p>
              <p>Si comparten hijos, pueden seguir apareciendo como coprogenitores.</p>
              <p>No se cambia el estado de la relación; el documento se elimina.</p>
            </>
          )}
          <p>Esta acción no se puede deshacer desde esta operación.</p>
        </div>

        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button ref={cancelButtonRef} type="button" disabled={submitting} onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" disabled={submitting} onClick={confirm} className="rounded-xl bg-red-700 px-4 py-3 font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? "Quitando..." : "Quitar relación"}
          </button>
        </div>
      </section>
    </div>
  );
}
