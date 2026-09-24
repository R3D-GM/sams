import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, TOKEN_KEY } from "@/services/api";

export type Role = "SUPER_ADMIN" | "TEACHER";

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: Role;
  departmentId: string | null;
  departmentName: string | null;
}

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthValue>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Restore the logged in user on refresh using the stored JWT.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return setLoading(false);
    api
      .get<User>("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const { data } = await api.post("/auth/login", { username, password });
    // Wipe any cached data from a previous session on this browser BEFORE
    // storing the new token — otherwise, on a shared/reused browser session,
    // pages can briefly (or for a while, if the backend is slow to wake up)
    // keep showing the PREVIOUS person's cached dashboard/student data while
    // the new, correctly-scoped data is still being fetched.
    queryClient.clear();
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user as User;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
