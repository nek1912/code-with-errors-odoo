import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { forgotPasswordSchema, type ForgotPasswordFormData } from "@/schemas/auth";
import { forgotPassword, getErrorMessage } from "@/services/api";

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
      const response = await forgotPassword(data);
      setSuccess(response.message);
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
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg bg-green-500/10 p-4 text-sm text-green-500">
                {success}
              </div>
              <p className="text-xs text-neutral-500">
                If the email exists, you will receive a reset link shortly.
              </p>
              <Link to="/login">
                <Button variant="secondary" className="w-full">
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</div>
              )}

              <p className="text-center text-sm text-neutral-400">
                Enter your email address and we'll send you a link to reset your password.
              </p>

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

              <Button type="submit" className="w-full" isLoading={isLoading}>
                Send Reset Link
              </Button>
            </form>
          )}

          <div className="mt-4 text-center text-sm text-neutral-400">
            Remember your password?{" "}
            <Link to="/login" className="text-blue-500 hover:underline">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
