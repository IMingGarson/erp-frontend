import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setLoginData: (userData, token) =>
        set({
          user: userData,
          accessToken: token,
          isAuthenticated: true,
        }),

      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      isEmployer: () => {
        const user = get().user;
        return user?.department?.toUpperCase() === "EMPLOYER";
      },

      isRD: () => {
        const user = get().user;
        return user?.department?.toUpperCase() === "RD";
      },

      isAdmin: () => {
        const user = get().user;
        return user?.department?.toUpperCase() === "ADMIN";
      },

      hasRole: (roleArray) => {
        const user = get().user;
        if (!user || !user.department) return false;
        return roleArray.includes(user.department.toUpperCase());
      },
    }),
    {
      name: "auth-storage",
    },
  ),
);
