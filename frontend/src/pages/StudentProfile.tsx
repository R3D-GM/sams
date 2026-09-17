import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "@/services/api";
import type { Student, AttendanceStatus } from "@/types";
import { ErrorState, PageHeader, Skeleton, StatusBadge, EmptyState } from "@/components/ui";
import { fmtDate, pct } from "@/utils/format";

interface Profile extends Student {
  attendances: { id: string; date: string; status: AttendanceStatus; notes: string | null }[];
  stats: { total: number; present: number; percentage: number };
}

export default function StudentProfile() {
  const { id } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => (await api.get<Profile>(`/students/${id}`)).data,
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (isError || !data) return <ErrorState message="Student not found" onRetry={refetch} />;

  return (
    <>
      <Link to="/students" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to students
      </Link>
      <PageHeader title={data.fullName} description={`${data.studentId} · ${data.department.name} · ${data.batch}`} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <h2 className="mb-4 font-semibold">Details</h2>
          <dl className="space-y-3 text-sm">
            {[
              ["Phone", data.phone],
              ["Email", data.email || "—"],
              ["Gender", data.gender.charAt(0) + data.gender.slice(1).toLowerCase()],
              ["Department", data.department.name],
              ["Batch", data.batch],
              ["Registered", fmtDate(data.createdAt)],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
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
                <tr><th className="th">Date</th><th className="th">Status</th><th className="th">Notes</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.attendances.map((a) => (
                  <tr key={a.id}>
                    <td className="td">{fmtDate(a.date)}</td>
                    <td className="td"><StatusBadge status={a.status} /></td>
                    <td className="td">{a.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
