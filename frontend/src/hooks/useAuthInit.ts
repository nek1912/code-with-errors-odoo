import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { getMe } from "@/services/api";

export function useAuthInit() {
  const { setUser, setLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const user = await getMe();
        setUser(user);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, [setUser, setLoading]);

  return { isAuthenticated };
}
