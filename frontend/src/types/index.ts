export type Gender = "MALE" | "FEMALE" | "OTHER";
export type StudentStatus = "ACTIVE" | "INACTIVE";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

export interface Department {
  id: string;
  name: string;
}

export interface Student {
  id: string;
  studentId: string;
  fullName: string;
  phone: string;
  departmentId: string;
  department: Department;
  universityDepartment: string | null;
  batch: string;
  gender: Gender;
  email: string | null;
  status: StudentStatus;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface SheetRow {
  studentId: string;
  code: string;
  fullName: string;
  department: string;
  batch: string;
  status: AttendanceStatus | null;
  notes: string;
}

export interface SessionSummary {
  date: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

export interface DashboardData {
  totalStudents: number;
  activeStudents: number;
  presentToday: number;
  absentToday: number;
  attendanceTakenToday: boolean;
  overallPercentage: number;
  recentSessions: { date: string; present: number; total: number; percentage: number }[];
}

export interface GroupStat {
  name: string;
  code?: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

export interface ReportData {
  overall: number;
  totalSessions: number;
  totalRecords: number;
  byStudent: GroupStat[];
  byDepartment: GroupStat[];
  byBatch: GroupStat[];
  mostAbsent: GroupStat[];
  mostConsistent: GroupStat[];
  monthly: GroupStat[];
  weekly: GroupStat[];
}
