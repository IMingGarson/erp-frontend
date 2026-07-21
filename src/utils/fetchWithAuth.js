import { useAuthStore } from "../store/authStore";

export const fetchWithAuth = async (url, options = {}) => {
  const DEBUG = true;
  let accessToken = localStorage.getItem("access_token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const config = {
    ...options,
    headers,
  };

  let response = await fetch(
    DEBUG ? `http://localhost:8000${url}` : url,
    config,
  );

  if (response.status === 401) {
    const refreshToken = localStorage.getItem("refresh_token");

    if (!refreshToken) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
      return response;
    }

    try {
      const refreshResponse = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const newAccess = refreshData.access;

        localStorage.setItem("access_token", newAccess);

        headers["Authorization"] = `Bearer ${newAccess}`;
        response = await fetch(url, { ...config, headers });
      } else {
        useAuthStore.getState().logout();
        window.location.href = "/login";
      }
    } catch (error) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }
  }

  return response;
};
