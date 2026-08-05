import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import type { Person } from "../types/family";
import {
  editPersonSchema,
  personToEditValues,
  submitPersonUpdate,
  updatePersonErrorMessage,
  type EditPersonData,
  type UpdatePersonCall,
  type UpdatePersonPayload,
} from "./EditPersonForm.logic";

type EditPersonFormProps = {
  treeId: string;
  person: Person;
  onCancel: () => void;
  onSaved: () => void;
  updatePersonCall?: UpdatePersonCall;
};

export default function EditPersonForm({
  treeId,
  person,
  onCancel,
  onSaved,
  updatePersonCall,
}: EditPersonFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const callable = useMemo<UpdatePersonCall>(() => {
    if (updatePersonCall) return updatePersonCall;
    const updatePerson = httpsCallable<UpdatePersonPayload, {ok: true; personId: string}>(
      functions,
      "updatePerson"
    );
    return async (payload) => updatePerson(payload);
  }, [updatePersonCall]);
  const {
    register,
    handleSubmit,
    formState: {errors, isDirty, isSubmitting, isValid},
  } = useForm<EditPersonData>({
    resolver: zodResolver(editPersonSchema),
    mode: "onChange",
    defaultValues: personToEditValues(person),
  });

  const onSubmit = async (data: EditPersonData) => {
    try {
      setSubmitError(null);
      await submitPersonUpdate({
        call: callable,
        treeId,
        personId: person.id,
        data,
        onSaved,
      });
    } catch (error) {
      setSubmitError(updatePersonErrorMessage(error));
    }
  };

  const inputClass =
    "mt-1 w-full rounded-xl border border-[#D8D0C4] bg-[#FFFCF7] px-3 py-2.5 text-sm text-[#2B2B2B] outline-none transition focus:border-[#2F5D50] focus:ring-2 focus:ring-[#2F5D50]/15";

  return (
    <form
      className="space-y-4 border-t border-[#E5DED4] pt-5"
      onSubmit={handleSubmit(onSubmit)}
      aria-label="Editar información de la persona"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C97C5D]">
          Datos personales
        </p>
        <h3 className="mt-1 text-lg font-bold text-[#2B2B2B]">
          Editar información
        </h3>
      </div>

      <label className="block text-xs font-semibold text-slate-600">
        Nombre
        <input className={inputClass} autoComplete="given-name" {...register("firstName")} />
        {errors.firstName && (
          <span className="mt-1 block text-xs text-red-700" role="alert">
            {errors.firstName.message}
          </span>
        )}
      </label>

      <label className="block text-xs font-semibold text-slate-600">
        Segundo nombre
        <input className={inputClass} autoComplete="additional-name" {...register("middleName")} />
      </label>

      <label className="block text-xs font-semibold text-slate-600">
        Apellido
        <input className={inputClass} autoComplete="family-name" {...register("lastName")} />
        {errors.lastName && (
          <span className="mt-1 block text-xs text-red-700" role="alert">
            {errors.lastName.message}
          </span>
        )}
      </label>

      <label className="block text-xs font-semibold text-slate-600">
        Segundo apellido
        <input className={inputClass} {...register("secondLastName")} />
      </label>

      <label className="block text-xs font-semibold text-slate-600">
        Fecha de nacimiento
        <input className={inputClass} type="date" {...register("birthDate")} />
      </label>

      <label className="block text-xs font-semibold text-slate-600">
        Lugar de nacimiento
        <input className={inputClass} {...register("birthPlace")} />
      </label>

      {submitError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {submitError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="rounded-xl border border-[#D8D0C4] bg-[#FFFCF7] px-4 py-3 font-bold text-slate-700 transition hover:bg-white disabled:opacity-50"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-xl bg-[#2F5D50] px-4 py-3 font-bold text-white shadow-sm transition hover:bg-[#274D43] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting || !isValid || !isDirty}
        >
          {isSubmitting ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
