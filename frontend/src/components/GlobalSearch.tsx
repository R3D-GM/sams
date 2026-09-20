import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import type { Student } from "@/types";

/** Global student search. Press "/" anywhere to focus it. */
export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        ref.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const t = setTimeout(() => {
      api.get("/search", { params: { q } }).then((r) => {
        setResults(r.data.students);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        ref={ref}
        className="input pl-9"
        placeholder="Search students…  (press / )"
        value={q}
        aria-label="Global search"
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <ul className="card absolute z-40 mt-2 w-full overflow-hidden p-1">
          {results.map((s) => (
            <li key={s.id}>
              <button
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => {
                  navigate(`/students/${s.id}`);
                  setQ("");
                  setOpen(false);
                }}
              >
                <span className="font-medium">{s.fullName}</span>
                <span className="ml-2 text-xs text-gray-500">{s.studentId} · {s.departments.map((d) => d.name).join(", ")} · {s.batch}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
