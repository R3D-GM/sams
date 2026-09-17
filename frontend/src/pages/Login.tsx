import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { apiError } from "@/services/api";
import { Spinner } from "@/components/ui";
import logo from "@/assets/logo.png";
import { getWelcomeMessage } from "@/utils/welcome";

interface Form { username: string; password: string }

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>();

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (values: Form) => {
    try {
      const loggedInUser = await login(values.username, values.password);
      toast.success(getWelcomeMessage(loggedInUser));
      navigate("/", { replace: true });
    } catch (e) {
      toast.error(apiError(e, "Login failed"));
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-50 to-white p-4 dark:from-gray-950 dark:to-gray-900">
      <div className="card w-full max-w-sm p-7">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl bg-brand-600 text-white">
            <img src={logo} alt="Logo" className="h-14 w-14 rounded-xl object-cover" />
          </span>
          <h1 className="text-xl font-semibold">Attendance Manager</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sign in to your instructor account</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="username">Username</label>
            <input id="username" className="input" autoComplete="username"
              {...register("username", { required: "Username is required" })} />
            {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" autoComplete="current-password"
              {...register("password", { required: "Password is required" })} />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>
          <button className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting && <Spinner />} Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
