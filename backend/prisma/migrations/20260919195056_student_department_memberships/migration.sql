/*
  Warnings:

  - You are about to drop the column `departmentId` on the `Student` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[studentId,departmentId,date]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `departmentId` to the `Attendance` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_departmentId_fkey";

-- DropIndex
DROP INDEX "Attendance_studentId_date_key";

-- DropIndex
DROP INDEX "Student_departmentId_idx";

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "departmentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "departmentId";

-- CreateTable
CREATE TABLE "StudentDepartment" (
    "studentId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDepartment_pkey" PRIMARY KEY ("studentId","departmentId")
);

-- CreateIndex
CREATE INDEX "StudentDepartment_departmentId_idx" ON "StudentDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "Attendance_departmentId_idx" ON "Attendance"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_departmentId_date_key" ON "Attendance"("studentId", "departmentId", "date");

-- AddForeignKey
ALTER TABLE "StudentDepartment" ADD CONSTRAINT "StudentDepartment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartment" ADD CONSTRAINT "StudentDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
