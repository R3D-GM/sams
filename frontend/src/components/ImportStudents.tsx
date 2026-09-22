import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { api, apiError } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { departmentLabel, matchDepartmentByText } from "@/utils/departments";
import { Modal, Spinner } from "./ui";

interface Department { id: string; name: string }

/** Loosely-typed row shape coming out of a spreadsheet, JSON, or Google Form export. */
type RawRow = Record<string, unknown>;

/**
 * Finds a value in a row by trying several possible header spellings.
 * Google Form column names vary a lot ("Full Name", "Name", "Student Name"...)
 * so we normalise every header to lowercase/no-punctuation before matching.
 */
function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return "";
}

function normaliseRow(row: RawRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const norm = key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    out[norm] = String(value ?? "").trim();
  }
  return out;
}

function normaliseGender(v: string): "MALE" | "FEMALE" {
  const g = v.trim().toLowerCase();
  if (g.startsWith("f") || g === "ሴት") return "FEMALE";
  return "MALE";
}

function normaliseStatus(v: string): "ACTIVE" | "INACTIVE" {
  return v.trim().toLowerCase().startsWith("inactive") ? "INACTIVE" : "ACTIVE";
}

/** Splits a multi-select answer cell (e.g. "መዝሙር ክፍል, ስነ-ስዕል ክፍል") into individual selections. */
function splitMultiValue(v: string): string[] {
  return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

/** Maps one spreadsheet/JSON row onto the shape the /students/import API expects. */
function mapRow(raw: RawRow, departments: Department[], fallbackDepartmentId: string) {
  const row = normaliseRow(raw);
  // "department" covers a plain CSV column; "departments" covers Google
  // Forms' export of a "Departments" question (which may hold more than
  // one selection if it's a checkbox/multi-select question).
  const deptCell = pick(row, "departments", "department", "class", "clubdepartment");
  const matchedIds = splitMultiValue(deptCell)
    .map((token) => matchDepartmentByText(token, departments)?.id)
    .filter((id): id is string => !!id);
  // Only fall back to the admin's selected default department when the row
  // itself didn't name any recognisable department — the row's own answer
  // always wins when present, English or Amharic.
  const departmentIds = matchedIds.length > 0 ? matchedIds : (fallbackDepartmentId ? [fallbackDepartmentId] : []);

  return {
    fullName: pick(row, "fullname", "name", "studentname"),
    phone: pick(row, "phone", "phonenumber", "mobile", "mobilenumber", "phoneno"),
    departmentIds,
    universityDepartment: pick(row, "universitydepartment", "fieldofstudy", "major"),
    batch: pick(row, "batch", "year", "batchyear", "class"),
    gender: normaliseGender(pick(row, "gender", "sex")),
    status: normaliseStatus(pick(row, "status")),
  };
}

export default function ImportStudents({ open, onClose, departments }: {
  open: boolean;
  onClose: () => void;
  departments: Department[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const isTeacher = user?.role === "TEACHER";
  const [targetDept, setTargetDept] = useState(isTeacher ? user?.departmentId ?? "" : "");
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<RawRow[] | null>(null);

  const rows = useMemo(
    () => rawRows?.map((r) => mapRow(r, departments, targetDept)) ?? null,
    [rawRows, departments, targetDept],
  );

  const readFile = async (file: File) => {
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    let raw: RawRow[] = [];

    if (ext === "json") {
      raw = JSON.parse(await file.text());
    } else {
      // xlsx, xls and csv all go through SheetJS
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    }

    setRawRows(raw);
  };

  const importMutation = useMutation({
    mutationFn: async () => api.post("/students/import", { students: rows }),
    onSuccess: ({ data }) => {
      toast.success(`Imported ${data.created} students (${data.skipped} skipped)`);
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["facets"] });
      reset();
      onClose();
    },
    onError: (e) => toast.error(apiError(e, "Import failed")),
  });

  const reset = () => {
    setRawRows(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const validCount = rows?.filter((r) => r.fullName && r.phone && r.departmentIds.length > 0).length ?? 0;
  const invalidCount = (rows?.length ?? 0) - validCount;

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Import students"
      width="max-w-lg"
    >
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        For the first batch of students — e.g. a Google Form's response sheet — upload the
        exported Excel (.xlsx) or CSV file. After that, use "Add student" for one-off additions.
      </p>

      {!isTeacher && (
        <div className="mb-4">
          <label className="label" htmlFor="import-dept">
            Default department (optional — only used for rows where the file itself doesn't name a valid department)
          </label>
          <select id="import-dept" className="input" value={targetDept} onChange={(e) => setTargetDept(e.target.value)}>
            <option value="">No default — skip rows with no recognised department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{departmentLabel(d.name)}</option>)}
          </select>
        </div>
      )}

      <div className="mb-4">
        <label className="label" htmlFor="import-file">Excel, CSV or JSON file</label>
        <input
          id="import-file"
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          className="input"
          onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
        />
      </div>

      {rows && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900/60">
          <p><strong>{fileName}</strong> — {rows.length} row(s) found.</p>
          <p className="text-emerald-600 dark:text-emerald-400">{validCount} ready to import</p>
          {invalidCount > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              {invalidCount} row(s) missing a name, phone, or department will be skipped.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={() => { reset(); onClose(); }}>Cancel</button>
        <button
          className="btn-primary"
          disabled={!rows || validCount === 0 || importMutation.isPending}
          onClick={() => importMutation.mutate()}
        >
          {importMutation.isPending && <Spinner />}
          <Upload className="h-4 w-4" /> Import {validCount > 0 ? validCount : ""} students
        </button>
      </div>
    </Modal>
  );
}
