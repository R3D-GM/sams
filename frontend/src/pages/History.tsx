import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Trash2 } from "lucide-react";
import { api, apiError } from "@/services/api";
import type { Paginated, SessionSummary, Student } from "@/types";
import { ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Pagination, StatusBadge, TableSkeleton } from "@/components/ui";
import { fmtDay, pct } from "@/utils/format";
import { departmentLabel } from "@/utils/departments";

export default function History() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [batch, setBatch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [open, setOpen] = useState<{ date: string; departmentId: string; departmentName: string } | null>(null);
  const [toDelete, setToDelete] = useState<{ date: string; departmentId: string } | null>(null);

  const facets = useQuery({
    queryKey: ["facets"],
    queryFn: async () => (await api.get<{ departments: { id: string; name: string }[]; batches: string[] }>("/students/facets")).data,
  });
  const students = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => (await api.get<Paginated<Student>>("/students", { params: { pageSize: 100 } })).data.items,
  });

  const params = { page, pageSize: 10, from, to, departmentId, batch, studentId };
  const sessions = useQuery({
    queryKey: ["sessions", params],
    queryFn: async () => (await api.get<Paginated<SessionSummary>>("/attendance/sessions", { params })).data,
  });

  const detail = useQuery({
    queryKey: ["session", open?.date, open?.departmentId],
    enabled: !!open,
    queryFn: async () => (await api.get(`/attendance/sessions/${open!.date}`, { params: { departmentId: open!.departmentId } })).data,
  });

  const remove = useMutation({
    mutationFn: async (target: { date: string; departmentId: string }) =>
      api.delete(`/attendance/sessions/${target.date}`, { params: { departmentId: target.departmentId } }),
    onSuccess: () => {
      toast.success("Session deleted");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <>
      <PageHeader title="Attendance history" description="Review, filter and edit past sessions." />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
        <div><label className="label" htmlFor="from">From</label><input id="from" type="date" className="input" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></div>
        <div><label className="label" htmlFor="to">To</label><input id="to" type="date" className="input" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></div>
        <div>
          <label className="label" htmlFor="dep">Department</label>
          <select id="dep" className="input" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}>
            <option value="">All</option>{facets.data?.departments.map((d) => <option key={d.id} value={d.id}>{departmentLabel(d.name)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bt">Batch</label>
          <select id="bt" className="input" value={batch} onChange={(e) => { setBatch(e.target.value); setPage(1); }}>
            <option value="">All</option>{facets.data?.batches.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="st">Student</label>
          <select id="st" className="input" value={studentId} onChange={(e) => { setStudentId(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {students.data?.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {sessions.isLoading ? (
          <TableSkeleton cols={6} />
        ) : sessions.isError ? (
          <ErrorState message="Could not load sessions" onRetry={sessions.refetch} />
        ) : sessions.data!.items.length === 0 ? (
          <EmptyState title="No sessions found" description="Adjust the filters or record a new attendance session." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="bg-gray-50 dark:bg-gray-900/60">
                  <tr><th className="th">Date</th><th className="th">Department</th><th className="th">Present</th><th className="th">Absent</th><th className="th">Rate</th><th className="th sr-only">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sessions.data!.items.map((s) => (
                    <tr key={`${s.date}-${s.departmentId}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="td font-medium">{fmtDay(s.date)}</td>
                      <td className="td">{departmentLabel(s.departmentName)}</td>
                      <td className="td">{s.present}</td>
                      <td className="td">{s.absent}</td>
                      <td className="td">{pct(s.percentage)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          <button className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="View session"
                            onClick={() => setOpen({ date: s.date, departmentId: s.departmentId, departmentName: s.departmentName })}>
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="Delete session"
                            onClick={() => setToDelete({ date: s.date, departmentId: s.departmentId })}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={sessions.data!.page} pages={sessions.data!.pages} total={sessions.data!.total} onChange={setPage} />
          </>
        )}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${fmtDay(open.date)} · ${departmentLabel(open.departmentName)}` : ""} width="max-w-3xl">
        {detail.isLoading ? (
          <TableSkeleton cols={4} />
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-500">
              To change these records, open the Attendance page, pick this department and date — saving updates the session.
            </p>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/60">
                  <tr><th className="th">Student</th><th className="th">Batch</th><th className="th">Status</th><th className="th">Notes</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {detail.data?.records?.map((r: any) => (
                    <tr key={r.id}>
                      <td className="td">{r.fullName}</td>
                      <td className="td">{r.batch}</td>
                      <td className="td"><StatusBadge status={r.status} /></td>
                      <td className="td">{r.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete session"
        message="All attendance records for this date and department will be removed."
        loading={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
    </>
  );
}
