import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import type { Student } from "@/types";
import { Spinner } from "./ui";

export interface StudentFormValues {
  fullName: string; phone: string; departmentId: string; universityDepartment: string; batch: string;
  gender: "MALE" | "FEMALE" | "OTHER"; email: string; status: "ACTIVE" | "INACTIVE";
}

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

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<StudentFormValues>({
    defaultValues: {
      fullName: student?.fullName ?? "",
      phone: student?.phone ?? "",
      departmentId: student?.departmentId ?? (isTeacher ? user?.departmentId ?? "" : ""),
      universityDepartment: student?.universityDepartment ?? "",
      batch: student?.batch ?? "",
      gender: student?.gender ?? "OTHER",
      email: student?.email ?? "",
      status: student?.status ?? "ACTIVE",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="fullName">Full name *</label>
          <input id="fullName" className="input" {...register("fullName", { required: "Full name is required", minLength: { value: 2, message: "Too short" } })} />
          {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone number *</label>
          <input id="phone" className="input" placeholder="+252612345678"
            {...register("phone", { required: "Phone is required", pattern: { value: /^\+?[0-9][0-9\s-]{6,18}$/, message: "Enter a valid phone number" } })} />
          {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="email">Email (optional)</label>
          <input id="email" type="email" className="input"
            {...register("email", { pattern: { value: /^\S+@\S+\.\S+$/, message: "Invalid email" } })} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="departmentId">Department *</label>
          <select id="departmentId" className="input" disabled={isTeacher}
            {...register("departmentId", { required: "Department is required" })}>
            {!facets.data && <option value="">Loading…</option>}
            {facets.data?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {errors.departmentId && <p className="mt-1 text-xs text-red-600">{errors.departmentId.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="batch">Batch *</label>
          <input id="batch" className="input" {...register("batch", { required: "Batch is required" })} />
          {errors.batch && <p className="mt-1 text-xs text-red-600">{errors.batch.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="universityDepartment">University department (optional)</label>
          <input id="universityDepartment" className="input" placeholder="e.g. Software Engineering"
            {...register("universityDepartment")} />
        </div>
        <div>
          <label className="label" htmlFor="gender">Gender</label>
          <select id="gender" className="input" {...register("gender")}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
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
