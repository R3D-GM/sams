import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck, Save, Search, XCircle } from "lucide-react";
import clsx from "clsx";
import { api, apiError } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import type { AttendanceStatus, SheetRow } from "@/types";
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/ui";
import { toInputDate } from "@/utils/format";
import { departmentLabel } from "@/utils/departments";

type Draft = Record<string, { status: AttendanceStatus | null; notes: string }>;

// Only these two statuses are selectable. "Late" has been removed as an option.
const STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT"];

export default function Attendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isTeacher = user?.role === "TEACHER";
  const [date, setDate] = useState(toInputDate(new Date()));
  const [search, setSearch] = useState("");
  // A leader always takes attendance for their own department — locked, not a choice.
  // An admin must explicitly pick which department's session this is.
  const [departmentId, setDepartmentId] = useState(isTeacher ? user?.departmentId ?? "" : "");
  const [batch, setBatch] = useState("");
  const [draft, setDraft] = useState<Draft>({});

  const facets = useQuery({
    queryKey: ["facets"],
    queryFn: async () => (await api.get<{ departments: { id: string; name: string }[]; batches: string[] }>("/students/facets")).data,
  });
  const currentDeptName = departmentLabel(facets.data?.departments.find((d) => d.id === departmentId)?.name);

  const sheet = useQuery({
    queryKey: ["sheet", date, departmentId, batch],
    enabled: !!departmentId,
    queryFn: async () =>
      (await api.get<{ date: string; saved: boolean; rows: SheetRow[] }>("/attendance/sheet", {
        params: { date, departmentId, batch },
      })).data,
  });

  // Seed the local draft whenever a new sheet loads (existing records are pre-filled).
  useEffect(() => {
    if (!sheet.data) return;
    const next: Draft = {};
    for (const r of sheet.data.rows) next[r.studentId] = { status: r.status, notes: r.notes };
    setDraft(next);
  }, [sheet.data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (sheet.data?.rows ?? []).filter(
      (r) => !q || r.fullName.toLowerCase().includes(q) || r.code.toLowerCase().includes(q),
    );
  }, [sheet.data, search]);

  const setAll = (status: AttendanceStatus) =>
    setDraft((d) => {
      const next = { ...d };
      for (const r of rows) next[r.studentId] = { ...next[r.studentId], status };
      return next;
    });

  const save = useMutation({
    mutationFn: async () => {
      if (!departmentId) throw new Error("Choose a department first");
      const entries = Object.entries(draft)
        .filter(([, v]) => v.status)
        .map(([studentId, v]) => ({ studentId, status: v.status!, notes: v.notes }));
      if (entries.length === 0) throw new Error("Mark at least one student before saving");
      return api.post("/attendance", { date, departmentId, entries });
    },
    onSuccess: () => {
      toast.success("Attendance saved");
      qc.invalidateQueries({ queryKey: ["sheet"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  // Keyboard shortcut: Ctrl/Cmd + S saves the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save.mutate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const counts = Object.values(draft).reduce(
    (acc, v) => {
      if (v.status === "PRESENT") acc.present++;
      else if (v.status === "ABSENT") acc.absent++;
      return acc;
    },
    { present: 0, absent: 0 },
  );

  return (
    <>
      <PageHeader
        title="Take attendance"
        description={
          !departmentId
            ? "Choose a department to start a session."
            : sheet.data?.saved
              ? `A session already exists for ${currentDeptName || "this department"} on this date — saving will update it.`
              : `Marking attendance for ${currentDeptName || "this department"}.`
        }
        actions={
          <>
            <button className="btn-ghost" onClick={() => setAll("PRESENT")} disabled={!departmentId}><CheckCheck className="h-4 w-4" /> Mark all present</button>
            <button className="btn-ghost" onClick={() => setAll("ABSENT")} disabled={!departmentId}><XCircle className="h-4 w-4" /> Mark all absent</button>
            <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending || !departmentId}>
              <Save className="h-4 w-4" /> Save attendance
            </button>
          </>
        }
      />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="date">Session date</label>
          <input id="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="q">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input id="q" className="input pl-9" placeholder="Student name or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="dep">Department *</label>
          {isTeacher ? (
            <p className="input flex items-center bg-gray-50 text-gray-600 dark:bg-gray-900/60 dark:text-gray-300">
              {currentDeptName || "Your department"}
            </p>
          ) : (
            <select id="dep" className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Select a department…</option>
              {facets.data?.departments.map((d) => <option key={d.id} value={d.id}>{departmentLabel(d.name)}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="label" htmlFor="bt">Batch</label>
          <select id="bt" className="input" value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="">All</option>
            {facets.data?.batches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Present {counts.present}</span>
        <span className="badge bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400">Absent {counts.absent}</span>
      </div>

      <div className="card overflow-hidden">
        {!departmentId ? (
          <EmptyState title="Choose a department" description="Pick which department's session you're taking attendance for." />
        ) : sheet.isLoading ? (
          <TableSkeleton cols={4} />
        ) : sheet.isError ? (
          <ErrorState message="Could not load the attendance sheet" onRetry={sheet.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState title="No students match" description="Adjust the search or filters, or add active students to this department first." />
        ) : (
          <div>
            {/* Mobile: one big-tap card per student — this is the screen leaders use live during a session */}
            <div className="divide-y divide-gray-100 sm:hidden dark:divide-gray-800">
              {rows.map((r) => {
                const current = draft[r.studentId]?.status ?? null;
                return (
                  <div key={r.studentId} className="p-4">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{r.fullName}</p>
                    <p className="font-mono text-xs text-gray-500">{r.code} · Batch {r.batch}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, [r.studentId]: { ...d[r.studentId], status: s } }))}
                          className={clsx(
                            "rounded-lg border py-3 text-sm font-semibold transition",
                            current === s
                              ? s === "PRESENT"
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-red-600 bg-red-600 text-white"
                              : "border-gray-300 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
                          )}
                        >
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                    <input
                      className="input mt-2"
                      placeholder="Optional note"
                      value={draft[r.studentId]?.notes ?? ""}
                      aria-label={`Notes for ${r.fullName}`}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.studentId]: { ...d[r.studentId], notes: e.target.value } }))}
                    />
                  </div>
                );
              })}
            </div>

            {/* Desktop / tablet: compact table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[760px]">
                <thead className="bg-gray-50 dark:bg-gray-900/60">
                  <tr>
                    <th className="th">Student</th><th className="th">Batch</th>
                    <th className="th">Status</th><th className="th">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((r) => {
                    const current = draft[r.studentId]?.status ?? null;
                    return (
                      <tr key={r.studentId}>
                        <td className="td">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{r.fullName}</p>
                          <p className="font-mono text-xs text-gray-500">{r.code}</p>
                        </td>
                        <td className="td">{r.batch}</td>
                        <td className="td">
                          <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700" role="group" aria-label={`Status for ${r.fullName}`}>
                            {STATUSES.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setDraft((d) => ({ ...d, [r.studentId]: { ...d[r.studentId], status: s } }))}
                                className={clsx(
                                  "px-3 py-1.5 text-xs font-medium transition",
                                  current === s
                                    ? s === "PRESENT" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                                    : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800",
                                )}
                              >
                                {s.charAt(0) + s.slice(1).toLowerCase()}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="td">
                          <input
                            className="input py-1.5"
                            placeholder="Optional note"
                            value={draft[r.studentId]?.notes ?? ""}
                            aria-label={`Notes for ${r.fullName}`}
                            onChange={(e) => setDraft((d) => ({ ...d, [r.studentId]: { ...d[r.studentId], notes: e.target.value } }))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-500">Tip: press Ctrl/Cmd + S to save.</p>
    </>
  );
}
