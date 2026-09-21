import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, X } from "lucide-react";
import { api, apiError } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import type { Student, AttendanceStatus, Department } from "@/types";
import { ConfirmDialog, ErrorState, PageHeader, Skeleton, StatusBadge, EmptyState } from "@/components/ui";
import { fmtDate, pct } from "@/utils/format";
import { departmentLabel } from "@/utils/departments";

interface Profile extends Student {
  attendances: { id: string; date: string; status: AttendanceStatus; notes: string | null; department: Department }[];
  stats: { total: number; present: number; percentage: number };
}

export default function StudentProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [toRemove, setToRemove] = useState<Department | null>(null);
  const isAdmin = user?.role === "SUPER_ADMIN";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => (await api.get<Profile>(`/students/${id}`)).data,
  });

  const removeMembership = useMutation({
    mutationFn: async (departmentId: string) => api.delete(`/students/${id}/memberships/${departmentId}`),
    onSuccess: (res) => {
      toast.success("Removed from department");
      setToRemove(null);
      qc.invalidateQueries({ queryKey: ["students"] });
      // If that was their last department, the student record itself was deleted server-side.
      if (String(res.data?.message ?? "").toLowerCase().includes("had no remaining")) {
        navigate("/students");
      } else {
        qc.invalidateQueries({ queryKey: ["student", id] });
      }
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (isError || !data) return <ErrorState message="Student not found" onRetry={refetch} />;

  // A leader may only remove their own department's membership from a student.
  const canRemove = (d: Department) => isAdmin || d.id === user?.departmentId;

  return (
    <>
      <Link to="/students" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to students
      </Link>
      <PageHeader
        title={data.fullName}
        description={`${data.studentId} · ${data.departments.map((d) => departmentLabel(d.name)).join(", ")} · ${data.batch}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <h2 className="mb-4 font-semibold">Details</h2>
          <dl className="space-y-3 text-sm">
            {[
              ["Phone", data.phone],
              ["Email", data.email || "—"],
              ["Gender", data.gender.charAt(0) + data.gender.slice(1).toLowerCase()],
              ["Batch", data.batch],
              ["Registered", fmtDate(data.createdAt)],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
            <div>
              <dt className="mb-1.5 text-gray-500 dark:text-gray-400">Departments</dt>
              <dd className="flex flex-wrap gap-1.5">
                {data.departments.map((d) => (
                  <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-2.5 pr-1 text-xs dark:bg-gray-800">
                    {departmentLabel(d.name)}
                    {canRemove(d) && (
                      <button
                        className="rounded-full p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
                        aria-label={`Remove ${data.fullName} from ${departmentLabel(d.name)}`}
                        onClick={() => setToRemove(d)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Status</dt>
              <dd><StatusBadge status={data.status} /></dd>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-3 dark:border-gray-800">
              <dt className="text-gray-500 dark:text-gray-400">Attendance rate</dt>
              <dd className="font-semibold text-brand-600 dark:text-brand-400">{pct(data.stats.percentage)}</dd>
            </div>
          </dl>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <h2 className="border-b border-gray-200 px-4 py-3 font-semibold dark:border-gray-800">Attendance history</h2>
          {data.attendances.length === 0 ? (
            <EmptyState title="No attendance records yet" />
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/60">
                <tr><th className="th">Date</th><th className="th">Department</th><th className="th">Status</th><th className="th">Notes</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.attendances.map((a) => (
                  <tr key={a.id}>
                    <td className="td">{fmtDate(a.date)}</td>
                    <td className="td">{departmentLabel(a.department.name)}</td>
                    <td className="td"><StatusBadge status={a.status} /></td>
                    <td className="td">{a.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!toRemove}
        title="Remove from department"
        message={`Remove ${data.fullName} from ${departmentLabel(toRemove?.name)}? ${
          data.departments.length <= 1
            ? "This is their only department, so their whole student record will be removed."
            : "Their record and other department memberships stay untouched."
        }`}
        loading={removeMembership.isPending}
        onCancel={() => setToRemove(null)}
        onConfirm={() => toRemove && removeMembership.mutate(toRemove.id)}
      />
    </>
  );
}
