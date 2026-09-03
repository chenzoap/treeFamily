import {useEffect, useRef, useState} from "react";
import type {ParentRole} from "../types/family";
import {
  buildReassignParentPayload,
  canSubmitReassignment,
  reassignParentErrorMessage,
  reassignParentTitle,
  submitReassignParent,
  type ReassignParentCall,
  type ReassignParentTarget,
} from "./ReassignParentDialog.logic";
import {
  finishDeleteSubmission,
  startDeleteSubmission,
} from "./DeletePersonDialog.logic";

type Props = {
  treeId: string;
  target: ReassignParentTarget;
  call: ReassignParentCall;
  onCancel: () => void;
  onSuccess: () => void;
};

export default function ReassignParentDialog({
  treeId,
  target,
  call,
  onCancel,
  onSuccess,
}: Props) {
  const [newParentPersonId, setNewParentPersonId] = useState("");
  const [selectedParentRole, setSelectedParentRole] =
    useState<ParentRole | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const submissionGateRef = useRef(false);
  const canSubmit = canSubmitReassignment(
    target,
    newParentPersonId,
    selectedParentRole
  );

  useEffect(() => cancelButtonRef.current?.focus(), []);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, submitting]);

  const confirm = async () => {
    if (!canSubmit || !startDeleteSubmission(submissionGateRef)) return;
    try {
      setSubmitting(true);
      setError(null);
      await submitReassignParent({
        call,
        payload: buildReassignParentPayload({
          treeId,
          target,
          newParentPersonId,
          selectedParentRole,
        }),
        onSuccess,
      });
    } catch (reason) {
      setError(reassignParentErrorMessage(reason));
      finishDeleteSubmission(submissionGateRef);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <section className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="reassign-parent-title" aria-describedby="reassign-parent-description">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">
          Reasignar filiación
        </p>
        <h2 id="reassign-parent-title" className="mt-1 text-xl font-bold text-slate-900">
          {reassignParentTitle(target, newParentPersonId, selectedParentRole)}
        </h2>

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Nuevo progenitor
            <select className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5" value={newParentPersonId} disabled={submitting} onChange={(event) => setNewParentPersonId(event.target.value)}>
              <option value="">Selecciona una persona</option>
              {target.candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
              ))}
            </select>
          </label>

          {target.parentRole ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Rol que se conservará: {target.parentRole === "father" ? "Padre" : "Madre"}
            </p>
          ) : (
            <label className="block text-sm font-semibold text-slate-700">
              Rol de la nueva filiación
              <select className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5" value={selectedParentRole ?? ""} disabled={submitting} onChange={(event) => setSelectedParentRole(event.target.value === "father" || event.target.value === "mother" ? event.target.value : undefined)}>
                <option value="">Selecciona un rol</option>
                <option value="father">Padre</option>
                <option value="mother">Madre</option>
              </select>
            </label>
          )}

          {target.candidates.length === 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No hay otras personas disponibles para usar como progenitor.
            </p>
          )}
        </div>

        <div id="reassign-parent-description" className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
          <p>Ninguna persona será eliminada. Solo se reemplazará esta filiación parental.</p>
          <p>Las demás relaciones permanecerán y las relaciones de pareja no cambiarán.</p>
          <p>El árbol puede reorganizarse después del cambio.</p>
          <p>El progenitor anterior seguirá perteneciendo al árbol y puede quedar desconectado visualmente.</p>
          <p>Esta acción no modifica la cuenta ni la autenticación.</p>
        </div>

        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button ref={cancelButtonRef} type="button" disabled={submitting} onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={submitting || !canSubmit} onClick={confirm} className="rounded-xl bg-amber-700 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? "Cambiando..." : "Cambiar progenitor"}
          </button>
        </div>
      </section>
    </div>
  );
}
