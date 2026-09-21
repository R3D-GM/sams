import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { departmentLabel } from "@/utils/departments";
import type { Student } from "@/types";
import { Spinner } from "./ui";

export interface StudentFormValues {
  fullName: string; phone: string; departmentIds: string[]; universityDepartment: string; batch: string;
  gender: "MALE" | "FEMALE"; status: "ACTIVE" | "INACTIVE";
}

const ETHIOPIA_PREFIX = "+251";

/** Accessible add/edit student form with client-side validation. */
export default function StudentForm({ student, onSubmit, onCancel }: {
  student?: Student | null;
  onSubmit: (values: StudentFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const facets = useQuery({
    queryKey: ["facets"],
    queryFn: async () => (await api.get<{ departments: { id: string; name: string }[]; batches: string[] }>("/students/facets")).data,
  });
  // Teachers only ever have one department in scope, so lock the field instead of showing a choice.
  const isTeacher = user?.role === "TEACHER";
  const teacherDeptName = facets.data?.departments.find((d) => d.id === user?.departmentId)?.name;

  // Phone is handled outside react-hook-form: the +251 prefix is fixed and
  // shown separately, and only the remaining 9 digits are ever editable.
  const [phoneDigits, setPhoneDigits] = useState(() => (student?.phone ?? "").replace(/^\+251/, ""));
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneValid = /^\d{9}$/.test(phoneDigits);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<StudentFormValues>({
    defaultValues: {
      fullName: student?.fullName ?? "",
      departmentIds: student?.departments?.map((d) => d.id) ?? (isTeacher && user?.departmentId ? [user.departmentId] : []),
      universityDepartment: student?.universityDepartment ?? "",
      batch: student?.batch ?? "",
      gender: student?.gender ?? "MALE",
      status: student?.status ?? "ACTIVE",
    },
  });

  // A leader can only ever act on their own department, regardless of what's
  // in the form state — this is the client-side mirror of the backend rule.
  const submit = handleSubmit((values) => {
    if (!phoneValid) {
      setPhoneTouched(true);
      return;
    }
    const phone = ETHIOPIA_PREFIX + phoneDigits;
    onSubmit({
      ...values,
      phone,
      ...(isTeacher && user?.departmentId ? { departmentIds: [user.departmentId] } : {}),
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="fullName">Full name *</label>
          <input id="fullName" className="input" {...register("fullName", { required: "Full name is required", minLength: { value: 2, message: "Too short" } })} />
          {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>}
        </div>

        <div>
          <label className="label" htmlFor="phone">Phone number *</label>
          <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
            <span className="flex select-none items-center bg-gray-100 px-3 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {ETHIOPIA_PREFIX}
            </span>
            <input
              id="phone"
              className="input flex-1 rounded-none border-0"
              inputMode="numeric"
              maxLength={9}
              placeholder="912345678"
              value={phoneDigits}
              onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 9))}
              onBlur={() => setPhoneTouched(true)}
              aria-label="Phone number, 9 digits after +251"
            />
          </div>
          {phoneTouched && !phoneValid && (
            <p className="mt-1 text-xs text-red-600">Enter exactly 9 digits after +251, e.g. 912345678</p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="batch">Batch *</label>
          <input
            id="batch"
            className="input"
            inputMode="numeric"
            maxLength={4}
            placeholder="2017"
            {...register("batch", {
              required: "Batch is required",
              pattern: { value: /^\d{4}$/, message: "Batch must be exactly 4 digits, e.g. 2017" },
            })}
          />
          {errors.batch && <p className="mt-1 text-xs text-red-600">{errors.batch.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="label">Departments *</label>
          {isTeacher ? (
            <p className="input flex items-center bg-gray-50 text-gray-600 dark:bg-gray-900/60 dark:text-gray-300">
              {teacherDeptName ? departmentLabel(teacherDeptName) : "Your department"}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                {!facets.data && <span className="text-sm text-gray-500">Loading…</span>}
                {facets.data?.departments.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" value={d.id} className="h-4 w-4 rounded"
                      {...register("departmentIds", { validate: (v) => v.length > 0 || "Select at least one department" })} />
                    {departmentLabel(d.name)}
                  </label>
                ))}
              </div>
              {student && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Unchecking a department here won't remove that membership — use the "Remove from department" action on the student's profile instead.
                </p>
              )}
            </>
          )}
          {errors.departmentIds && <p className="mt-1 text-xs text-red-600">{errors.departmentIds.message}</p>}
        </div>

        <div>
          <label className="label" htmlFor="universityDepartment">University department *</label>
          <input
            id="universityDepartment"
            className="input"
            placeholder="e.g. Software Engineering"
            {...register("universityDepartment", {
              required: "University department is required",
              validate: (v) => !/^\d+$/.test(v.trim()) || "University department must be text, not only numbers",
            })}
          />
          {errors.universityDepartment && <p className="mt-1 text-xs text-red-600">{errors.universityDepartment.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="gender">Gender</label>
          <select id="gender" className="input" {...register("gender")}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" className="input" {...register("status")}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner />} Save student</button>
      </div>
    </form>
  );
}
