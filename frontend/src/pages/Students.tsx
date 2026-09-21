import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BarChart2, Download, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { api, apiError } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import type { Paginated, Student } from "@/types";
import StudentForm, { type StudentFormValues } from "@/components/StudentForm";
import ImportStudents from "@/components/ImportStudents";
import { ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Pagination, StatusBadge, TableSkeleton } from "@/components/ui";
import { fmtDate } from "@/utils/format";
import { exportCSV } from "@/utils/export";
import { departmentLabel } from "@/utils/departments";

export default function Students() {
  const { user } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN";
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [batch, setBatch] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Student | null>(null);

  const facets = useQuery({
    queryKey: ["facets"],
    queryFn: async () => (await api.get<{ departments: { id: string; name: string }[]; batches: string[] }>("/students/facets")).data,
  });

  const params = { page, pageSize: 10, search, departmentId, batch };
  const list = useQuery({
    queryKey: ["students", params],
    queryFn: async () => (await api.get<Paginated<Student>>("/students", { params })).data,
  });

  const save = useMutation({
    mutationFn: async (values: StudentFormValues) =>
      editing ? api.patch(`/students/${editing.id}`, values) : api.post("/students", values),
    onSuccess: () => {
      toast.success(editing ? "Student updated" : "Student added");
      setFormOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["facets"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  // Admin deletes the student outright. A leader instead removes only their
  // own department's membership — the backend rejects a full delete from them.
  const remove = useMutation({
    mutationFn: async (student: Student) =>
      isAdmin
        ? api.delete(`/students/${student.id}`)
        : api.delete(`/students/${student.id}/memberships/${user?.departmentId}`),
    onSuccess: () => {
      toast.success(isAdmin ? "Student deleted" : "Removed from your department");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <>
      <PageHeader
        title="Students"
        description="Add, edit and organise the students in your training."
        actions={
          <>
            <button
              className="btn-ghost"
              onClick={() => list.data && exportCSV(
                list.data.items.map(({ id, departments, ...r }) => ({ ...r, departments: departments.map((d) => departmentLabel(d.name)).join(", ") })),
                "students",
              )}
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button className="btn-ghost" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import students
            </button>
            <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> Add student
            </button>
          </>
        }
      />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search name, phone, ID…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search students" />
        </div>
        <select className="input" value={departmentId} aria-label="Filter by department"
          onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}>
          <option value="">All departments</option>
          {facets.data?.departments.map((d) => <option key={d.id} value={d.id}>{departmentLabel(d.name)}</option>)}
        </select>
        <select className="input" value={batch} aria-label="Filter by batch"
          onChange={(e) => { setBatch(e.target.value); setPage(1); }}>
          <option value="">All batches</option>
          {facets.data?.batches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {list.isLoading ? (
          <TableSkeleton cols={6} />
        ) : list.isError ? (
          <ErrorState message="Could not load students" onRetry={list.refetch} />
        ) : list.data!.items.length === 0 ? (
          <EmptyState title="No students found" description="Try clearing the filters, or add your first student."
            action={<button className="btn-primary" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Add student</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-gray-50 dark:bg-gray-900/60">
                  <tr>
                    <th className="th">Student ID</th><th className="th">Name</th><th className="th">Phone</th>
                    <th className="th">Departments</th><th className="th">Batch</th><th className="th">Status</th>
                    <th className="th">Registered</th><th className="th sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {list.data!.items.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="td font-mono text-xs">{s.studentId}</td>
                      <td className="td">
                        <Link to={`/students/${s.id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                          {s.fullName}
                        </Link>
                      </td>
                      <td className="td">{s.phone}</td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          {s.departments.map((d) => (
                            <span key={d.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                              {departmentLabel(d.name)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="td">{s.batch}</td>
                      <td className="td"><StatusBadge status={s.status} /></td>
                      <td className="td">{fmtDate(s.createdAt)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          <Link to={`/students/${s.id}`} className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={`View analytics for ${s.fullName}`}>
                            <BarChart2 className="h-4 w-4" />
                          </Link>
                          <button className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={`Edit ${s.fullName}`}
                            onClick={() => { setEditing(s); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                            aria-label={isAdmin ? `Delete ${s.fullName}` : `Remove ${s.fullName} from your department`}
                            onClick={() => setToDelete(s)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.data!.page} pages={list.data!.pages} total={list.data!.total} onChange={setPage} />
          </>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit student" : "Add student"} width="max-w-2xl">
        <StudentForm student={editing} onCancel={() => setFormOpen(false)} onSubmit={async (v) => { await save.mutateAsync(v); }} />
      </Modal>

      <ImportStudents open={importOpen} onClose={() => setImportOpen(false)} departments={facets.data?.departments ?? []} />

      <ConfirmDialog
        open={!!toDelete}
        title={isAdmin ? "Delete student" : "Remove from your department"}
        message={
          isAdmin
            ? `This will permanently remove ${toDelete?.fullName} and all their department memberships and attendance records.`
            : `This removes ${toDelete?.fullName} from your department only. ${
                toDelete && toDelete.departments.length <= 1
                  ? "This is their only department, so their whole student record will be removed."
                  : "Their record and other department memberships stay untouched."
              }`
        }
        loading={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
    </>
  );
}
