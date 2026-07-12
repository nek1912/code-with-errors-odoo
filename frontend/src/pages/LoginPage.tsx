import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { loginSchema, type LoginFormData } from "@/schemas/auth";
import { login, getErrorMessage } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { Eye, EyeOff, Shield, User, Wrench, Briefcase } from "lucide-react";
import { toast } from "@/components/ui/toast";

const DEMO_ACCOUNTS = [
  {
    email: "admin@assetflow.com",
    label: "Admin",
    role: "ADMIN",
    desc: "Full access, Org Setup, Analytics",
    icon: Shield,
    color: "border-red-500/30 hover:border-red-500/60 bg-red-950/10 text-red-400",
  },
  {
    email: "ravi.sharma@assetflow.com",
    label: "Asset Manager",
    role: "ASSET_MANAGER",
    desc: "Registers assets, approves transfers & repairs",
    icon: Wrench,
    color: "border-blue-500/30 hover:border-blue-500/60 bg-blue-950/10 text-blue-400",
  },
  {
    email: "priya.patel@assetflow.com",
    label: "Dept Head (IT)",
    role: "DEPARTMENT_HEAD",
    desc: "Approves department transfers, books resources",
    icon: Briefcase,
    color: "border-amber-500/30 hover:border-amber-500/60 bg-amber-950/10 text-amber-400",
  },
  {
    email: "neha.gupta@assetflow.com",
    label: "Employee",
    role: "EMPLOYEE",
    desc: "Raises repairs, bookings & transfer requests",
    icon: User,
    color: "border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-950/10 text-emerald-400",
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const handleLoginSuccess = (response: any) => {
    localStorage.setItem("access_token", response.access_token);
    localStorage.setItem("refresh_token", response.refresh_token);
    setUser(response.user);
    toast({ title: `Logged in as ${response.user.full_name}`, variant: "success" });
    navigate("/dashboard");
  };

  const onSubmit = async (data: LoginFormData) => {
    setError("");
    setIsLoading(true);
    try {
      const response = await login(data);
      handleLoginSuccess(response);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (email: string) => {
    setError("");
    setIsLoading(true);
    setValue("email", email);
    setValue("password", "Demo@1234");
    try {
      const response = await login({ email, password: "Demo@1234" });
      handleLoginSuccess(response);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[128px]" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-purple-600/10 blur-[128px]" />

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left column: Login Card */}
        <Card className="border-neutral-800 bg-neutral-900/60 backdrop-blur-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
              <span className="text-2xl font-bold tracking-wider">AF</span>
            </div>
            <CardTitle className="text-2xl font-bold text-white">Welcome back</CardTitle>
            <CardDescription className="text-neutral-400">
              Enter your credentials to access your workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-neutral-300">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className="border-neutral-800 bg-neutral-950 text-white placeholder:text-neutral-600"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-neutral-300">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-neutral-500 transition-colors hover:text-neutral-300"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="border-neutral-800 bg-neutral-950 text-white placeholder:text-neutral-600 pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 transition-colors hover:text-neutral-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-700 mt-2" isLoading={isLoading}>
                Sign In
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-neutral-900 px-2 text-neutral-500">Or setup an account</span>
              </div>
            </div>

            <Link to="/signup">
              <Button variant="secondary" className="w-full border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800">
                Create Account
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Right column: Demo quick login panel */}
        <div className="flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Showcase Demo Mode</h2>
            <p className="mt-1.5 text-sm text-neutral-400 leading-relaxed">
              Instantly toggle between different user perspectives. Use the cards below to quickly log in with pre-seeded demo accounts.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickLogin(acc.email)}
                  disabled={isLoading}
                  className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all hover:bg-neutral-900/40 disabled:opacity-50 ${acc.color}`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      {acc.role.replace("_", " ")}
                    </span>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-2 text-base font-bold text-white">{acc.label}</h3>
                  <p className="mt-1 text-xs text-neutral-500 line-clamp-2">
                    {acc.desc}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-4 text-center">
            <p className="text-xs text-neutral-500">
              Note: Self-created accounts default to <strong>Employee</strong>. Admin, Asset Manager, and Department Head roles are available via seeded demo accounts or assignment by an administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
