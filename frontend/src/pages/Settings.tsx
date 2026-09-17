import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Database, Download, Moon, Sun, Upload } from "lucide-react";
import { api, apiError } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { ConfirmDialog, PageHeader, Spinner } from "@/components/ui";
import { downloadJSON, exportCSV } from "@/utils/export";

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const { theme, set } = useTheme();
  const restoreRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [pendingRestore, setPendingRestore] = useState<any>(null);

  const profile = useForm({ defaultValues: { fullName: user?.fullName ?? "", username: user?.username ?? "", email: user?.email ?? "" } });
  const password = useForm({ defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });

  const saveProfile = profile.handleSubmit(async (values) => {
    try {
      const { data } = await api.patch("/auth/profile", values);
      setUser(data);
      toast.success("Profile updated");
    } catch (e) { toast.error(apiError(e)); }
  });

  const savePassword = password.handleSubmit(async (values) => {
    if (values.newPassword !== values.confirm) return toast.error("Passwords do not match");
    try {
      await api.post("/auth/change-password", values);
      password.reset();
      toast.success("Password changed");
    } catch (e) { toast.error(apiError(e)); }
  });

  const backup = async () => {
    const { data } = await api.get("/reports/backup");
    downloadJSON(data, `attendance-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success("Backup downloaded");
  };

  const exportStudents = async () => {
    const { data } = await api.get("/students", { params: { pageSize: 1000 } });
    exportCSV(data.items.map(({ id, ...r }: any) => r), "students-export");
  };

  const onRestoreFile = async (file: File) => setPendingRestore(JSON.parse(await file.text()));

  const doRestore = async () => {
    try {
      await api.post("/reports/restore", pendingRestore);
      toast.success("Database restored");
      setPendingRestore(null);
    } catch (e) { toast.error(apiError(e)); }
  };

  const onImportFile = async (file: File) => {
    try {
      const students = JSON.parse(await file.text());
      const { data } = await api.post("/students/import", { students });
      toast.success(`Imported ${data.created} students (${data.skipped} skipped)`);
    } catch (e) { toast.error(apiError(e, "Import failed — expected a JSON array of students")); }
  };

  return (
    <>
      <PageHeader title="Settings" description="Manage your account, appearance and data." />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Profile</h2>
          <form onSubmit={saveProfile} className="space-y-4">
            <div><label className="label" htmlFor="fullName">Full name</label><input id="fullName" className="input" {...profile.register("fullName", { required: true })} /></div>
            <div><label className="label" htmlFor="username">Username</label><input id="username" className="input" {...profile.register("username", { required: true })} /></div>
            <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" {...profile.register("email")} /></div>
            <button className="btn-primary" disabled={profile.formState.isSubmitting}>{profile.formState.isSubmitting && <Spinner />} Save profile</button>
          </form>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Change password</h2>
          <form onSubmit={savePassword} className="space-y-4">
            <div><label className="label" htmlFor="cp">Current password</label><input id="cp" type="password" className="input" autoComplete="current-password" {...password.register("currentPassword", { required: true })} /></div>
            <div>
              <label className="label" htmlFor="np">New password</label>
              <input id="np" type="password" className="input" autoComplete="new-password" {...password.register("newPassword", { required: true, minLength: { value: 6, message: "At least 6 characters" } })} />
              {password.formState.errors.newPassword && <p className="mt-1 text-xs text-red-600">{password.formState.errors.newPassword.message}</p>}
            </div>
            <div><label className="label" htmlFor="cf">Confirm new password</label><input id="cf" type="password" className="input" autoComplete="new-password" {...password.register("confirm", { required: true })} /></div>
            <button className="btn-primary" disabled={password.formState.isSubmitting}>{password.formState.isSubmitting && <Spinner />} Update password</button>
          </form>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Appearance</h2>
          <div className="flex gap-3">
            <button className={theme === "light" ? "btn-primary" : "btn-ghost"} onClick={() => set("light")}><Sun className="h-4 w-4" /> Light</button>
            <button className={theme === "dark" ? "btn-primary" : "btn-ghost"} onClick={() => set("dark")}><Moon className="h-4 w-4" /> Dark</button>
          </div>
        </section>

        {user?.role === "SUPER_ADMIN" && (
          <section className="card p-5">
            <h2 className="mb-1 font-semibold">Data</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Backups contain every department, student and attendance record as JSON.</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={backup}><Database className="h-4 w-4" /> Backup database</button>
              <button className="btn-ghost" onClick={() => restoreRef.current?.click()}><Upload className="h-4 w-4" /> Restore backup</button>
              <button className="btn-ghost" onClick={exportStudents}><Download className="h-4 w-4" /> Export students CSV</button>
              <button className="btn-ghost" onClick={() => importRef.current?.click()}><Upload className="h-4 w-4" /> Import students JSON</button>
            </div>
            <input ref={restoreRef} type="file" accept="application/json" className="hidden"
              onChange={(e) => e.target.files?.[0] && onRestoreFile(e.target.files[0])} />
            <input ref={importRef} type="file" accept="application/json" className="hidden"
              onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])} />
          </section>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingRestore}
        title="Restore database"
        message="This replaces all current departments, students and attendance records with the contents of the backup file. This cannot be undone."
        confirmLabel="Restore"
        onCancel={() => setPendingRestore(null)}
        onConfirm={doRestore}
      />
    </>
  );
}
