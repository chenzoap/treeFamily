import {useEffect, useRef, useState} from "react";
import type {PartnerRelationshipStatus} from "../types/family";
import {
  buildUpdatePartnerStatusPayload,
  canSubmitPartnerStatus,
  partnerStatusLabel,
  partnerStatusOptions,
  submitUpdatePartnerStatus,
  updatePartnerStatusErrorMessage,
  type UpdatePartnerStatusCall,
  type UpdatePartnerStatusTarget,
} from "./UpdatePartnerStatusDialog.logic";
import {
  finishDeleteSubmission,
  startDeleteSubmission,
} from "./DeletePersonDialog.logic";

type Props = {
  treeId: string;
  target: UpdatePartnerStatusTarget;
  call: UpdatePartnerStatusCall;
  onCancel: () => void;
  onSuccess: () => void;
};

export default function UpdatePartnerStatusDialog({
  treeId,
  target,
  call,
  onCancel,
  onSuccess,
}: Props) {
  const [selectedStatus, setSelectedStatus] =
    useState<PartnerRelationshipStatus>(target.expectedRelationshipStatus);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const submissionGateRef = useRef(false);
  const canSubmit = canSubmitPartnerStatus(target, selectedStatus);

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
      await submitUpdatePartnerStatus({
        call,
        payload: buildUpdatePartnerStatusPayload({
          treeId,
          target,
          relationshipStatus: selectedStatus,
        }),
        onSuccess,
      });
    } catch (reason) {
      setError(updatePartnerStatusErrorMessage(reason));
      finishDeleteSubmission(submissionGateRef);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <section className="w-full max-w-lg rounded-2xl border border-sky-200 bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="update-partner-status-title" aria-describedby="update-partner-status-description">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700">
          Editar relación de pareja
        </p>
        <h2 id="update-partner-status-title" className="mt-1 text-xl font-bold text-slate-900">
          Cambiar estado de relación con {target.otherPersonName}
        </h2>
        <p className="mt-3 text-sm font-semibold text-slate-700">
          Estado actual: {partnerStatusLabel(target.expectedRelationshipStatus)}
        </p>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Estado de la relación
          <select className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5" value={selectedStatus} disabled={submitting} onChange={(event) => setSelectedStatus(event.target.value as PartnerRelationshipStatus)}>
            {partnerStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {canSubmit && (
          <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
            Cambiar de “{partnerStatusLabel(target.expectedRelationshipStatus)}” a “{partnerStatusLabel(selectedStatus)}”.
          </p>
        )}

        <div id="update-partner-status-description" className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
          <p>Ninguna persona será eliminada. La relación de pareja continuará existiendo y solo cambiará su estado.</p>
          <p>Las relaciones parentales y los hijos no cambiarán.</p>
          <p>Con el comportamiento visual actual seguirá apareciendo como relación de pareja.</p>
          <p>Esta acción no modifica la cuenta ni la autenticación.</p>
        </div>

        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button ref={cancelButtonRef} type="button" disabled={submitting} onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={submitting || !canSubmit} onClick={confirm} className="rounded-xl bg-sky-700 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? "Cambiando..." : "Cambiar estado"}
          </button>
        </div>
      </section>
    </div>
  );
}
