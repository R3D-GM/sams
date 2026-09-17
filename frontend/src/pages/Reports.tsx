import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { api } from "@/services/api";
import type { ReportData } from "@/types";
import { ErrorState, PageHeader, Skeleton, StatCard, EmptyState } from "@/components/ui";
import { pct } from "@/utils/format";
import { exportCSV, exportExcel, exportPDF } from "@/utils/export";
import { BarChart3, CalendarDays, Percent } from "lucide-react";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function Reports() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reports", from, to],
    queryFn: async () => (await api.get<ReportData>("/reports", { params: { from, to } })).data,
  });

  const exportRows = () =>
    (data?.byStudent ?? []).map((s) => ({
      "Student ID": s.code ?? "",
      Name: s.name,
      Present: s.present,
      Absent: s.absent,
      Sessions: s.total,
      "Attendance %": s.percentage,
    }));

  if (isLoading) return <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (isError || !data) return <ErrorState message="Could not load reports" onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Attendance analytics across students, departments and batches."
        actions={
          <>
            <button className="btn-ghost" onClick={() => exportCSV(exportRows(), "attendance-report")}><FileDown className="h-4 w-4" /> CSV</button>
            <button className="btn-ghost" onClick={() => exportExcel(exportRows(), "attendance-report")}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
            <button className="btn-primary" onClick={() => exportPDF(exportRows(), "attendance-report", "Attendance report")}><FileText className="h-4 w-4" /> PDF</button>
          </>
        }
      />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:w-1/2">
        <div><label className="label" htmlFor="from">From</label><input id="from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label" htmlFor="to">To</label><input id="to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      {data.totalRecords === 0 ? (
        <div className="card"><EmptyState title="No attendance data in this range" description="Record sessions or widen the date range." /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Overall attendance" value={pct(data.overall)} icon={Percent} />
            <StatCard label="Sessions recorded" value={data.totalSessions} icon={CalendarDays} tone="green" />
            <StatCard label="Attendance records" value={data.totalRecords} icon={BarChart3} tone="gray" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Monthly attendance rate">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={12} /><YAxis unit="%" fontSize={12} />
                  <Tooltip /><Line type="monotone" dataKey="percentage" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Weekly attendance rate">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.weekly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={11} /><YAxis unit="%" fontSize={12} />
                  <Tooltip /><Bar dataKey="percentage" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Attendance by department">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.byDepartment} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" unit="%" fontSize={12} /><YAxis type="category" dataKey="name" width={130} fontSize={11} />
                  <Tooltip /><Bar dataKey="percentage" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Records by batch">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={data.byBatch} dataKey="total" nameKey="name" outerRadius={95} label>
                    {data.byBatch.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ListCard title="Most absent students" rows={data.mostAbsent} valueKey="absent" suffix=" absences" />
            <ListCard title="Most consistent students" rows={data.mostConsistent} valueKey="percentage" suffix="%" />
          </div>

          <div className="card mt-6 overflow-hidden">
            <h2 className="border-b border-gray-200 px-4 py-3 font-semibold dark:border-gray-800">Attendance by student</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50 dark:bg-gray-900/60">
                  <tr><th className="th">Student</th><th className="th">Present</th><th className="th">Absent</th><th className="th">Sessions</th><th className="th">Rate</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.byStudent.map((s) => (
                    <tr key={s.code ?? s.name}>
                      <td className="td font-medium">{s.name}</td>
                      <td className="td">{s.present}</td><td className="td">{s.absent}</td>
                      <td className="td">{s.total}</td><td className="td">{pct(s.percentage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function ListCard({ title, rows, valueKey, suffix }: { title: string; rows: any[]; valueKey: string; suffix: string }) {
  return (
    <div className="card overflow-hidden">
      <h2 className="border-b border-gray-200 px-4 py-3 font-semibold dark:border-gray-800">{title}</h2>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((r) => (
          <li key={r.code ?? r.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span>{r.name}</span>
            <span className="font-medium">{Number(r[valueKey]).toFixed(valueKey === "percentage" ? 1 : 0)}{suffix}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
