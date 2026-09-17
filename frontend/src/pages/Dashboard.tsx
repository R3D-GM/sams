import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart3, CalendarCheck, CheckCircle2, Percent, UserPlus, Users, XCircle } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import type { DashboardData } from "@/types";
import { EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from "@/components/ui";
import { fmtDate, pct } from "@/utils/format";
import { getWelcomeMessage } from "@/utils/welcome";

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardData>("/dashboard")).data,
  });

  const greeting = getWelcomeMessage(user);

  if (isLoading)
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  if (isError || !data) return <ErrorState message="Could not load dashboard" onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title={greeting}
        description="Overview of today's session and overall attendance."
        actions={
          <>
            <Link to="/attendance" className="btn-primary"><CalendarCheck className="h-4 w-4" /> Take attendance</Link>
            <Link to="/students" className="btn-ghost"><UserPlus className="h-4 w-4" /> Add student</Link>
            <Link to="/reports" className="btn-ghost"><BarChart3 className="h-4 w-4" /> View reports</Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total students" value={data.totalStudents} icon={Users} />
        <StatCard label="Present today" value={data.presentToday} icon={CheckCircle2} tone="green" />
        <StatCard label="Absent today" value={data.absentToday} icon={XCircle} tone="red" />
        <StatCard label="Overall attendance" value={pct(data.overallPercentage)} icon={Percent} tone="gray" />
      </div>

      {!data.attendanceTakenToday && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Attendance has not been recorded today. <Link to="/attendance" className="font-medium underline">Take it now</Link>.
        </div>
      )}

      <section className="card mt-6 overflow-hidden">
        <h2 className="border-b border-gray-200 px-4 py-3 font-semibold dark:border-gray-800">Recent sessions</h2>
        {data.recentSessions.length === 0 ? (
          <EmptyState title="No sessions yet" description="Record your first attendance session to see it here." />
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/60">
              <tr><th className="th">Date</th><th className="th">Present</th><th className="th">Total</th><th className="th">Rate</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.recentSessions.map((s) => (
                <tr key={s.date}>
                  <td className="td font-medium">{fmtDate(s.date)}</td>
                  <td className="td">{s.present}</td>
                  <td className="td">{s.total}</td>
                  <td className="td">{pct(s.percentage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
