import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { signupSchema, type SignupFormData } from "@/schemas/auth";
import { signup, getErrorMessage } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { Eye, EyeOff } from "lucide-react";

export default function SignupPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const password = watch("password", "");

  const onSubmit = async (data: SignupFormData) => {
    setError("");
    setIsLoading(true);
    try {
      const response = await signup({
        full_name: data.full_name,
        email: data.email,
        password: data.password,
      });
      // Store tokens and user, then redirect to dashboard
      localStorage.setItem("access_token", response.access_token);
      localStorage.setItem("refresh_token", response.refresh_token);
      setUser(response.user);
      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600">
            <span className="text-xl font-bold text-white">AF</span>
          </div>
          <CardTitle>Create Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" placeholder="John Doe" {...register("full_name")} />
              {errors.full_name && (
                <p className="text-xs text-red-500">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
              <PasswordStrengthIndicator password={password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("confirm_password")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="text-xs text-red-500">{errors.confirm_password.message}</p>
              )}
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="accept_terms"
                className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-950"
                {...register("accept_terms")}
              />
              <label htmlFor="accept_terms" className="text-xs text-neutral-400">
                I agree to the Terms of Service and Privacy Policy
              </label>
            </div>
            {errors.accept_terms && (
              <p className="text-xs text-red-500">{errors.accept_terms.message}</p>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Create Account
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-neutral-400">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-500 hover:underline">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
