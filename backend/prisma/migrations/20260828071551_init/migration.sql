ALTER TABLE "Student" ADD COLUMN "universityDepartment" TEXT;

CREATE INDEX IF NOT EXISTS "Student_universityDepartment_idx"
ON "Student"("universityDepartment");