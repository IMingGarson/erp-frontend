import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { fetchWithAuth } from "./utils/fetchWithAuth";

function App() {
  const { setLoginData, logout } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        setIsInitializing(false);
        return;
      }

      try {
        const response = await fetchWithAuth("/api/auth/me");

        if (response.ok) {
          const result = await response.json();
          setLoginData(result.data, token);
        } else {
          console.error("無法取得使用者資料，API 狀態碼:", response.status);
          logout();
        }
      } catch (error) {
        console.error("初始化身分驗證失敗，網路異常:", error);
        logout();
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();
  }, [setLoginData, logout]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 font-medium">系統載入中...</div>
      </div>
    );
  }

  return <Outlet />;
}

export default App;
