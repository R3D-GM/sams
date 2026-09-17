import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/ui";

const TECH = ["React 18", "TypeScript", "Tailwind CSS", "React Router", "React Hook Form", "TanStack Query", "Recharts", "Node.js", "Express", "Prisma ORM", "PostgreSQL", "JWT + bcrypt"];

export default function About() {
  return (
    <>
      <PageHeader title="About" description="Details about this application." />
      <div className="card max-w-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white"><GraduationCap className="h-6 w-6" /></span>
          <div>
            <h2 className="text-lg font-semibold">Student Attendance Management System</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Version 1.0.0</p>
          </div>
        </div>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Developer</dt><dd className="font-medium">Instructor / Project Owner</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">License</dt><dd className="font-medium">MIT</dd></div>
        </dl>
        <h3 className="mb-2 mt-6 font-semibold">Project description</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          A single-instructor tool for managing students and recording attendance for every training session.
          It runs entirely on your own machine and stores all data in your local PostgreSQL database, so no
          internet connection is required during class.
        </p>
        <h3 className="mb-2 mt-6 font-semibold">Technologies used</h3>
        <ul className="flex flex-wrap gap-2">
          {TECH.map((t) => (
            <li key={t} className="badge bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{t}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
