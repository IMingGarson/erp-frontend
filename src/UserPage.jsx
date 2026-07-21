import { useState, useEffect, useMemo } from "react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useAuthStore } from "./store/authStore";

// 定義部門對應表，用於畫面顯示與表單選項
const DEPARTMENT_MAP = {
  ADMIN: "行政",
  MANUFACTURING: "製造",
  RD: "研發",
  PURCHASING: "採購",
  EMPLOYER: "老闆",
};

const UserPage = () => {
  // 透過 Zustand 的 selector 直接取得權限判斷結果，確保畫面能響應狀態變化
  const isEmployer = useAuthStore((state) => state.isEmployer());

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    first_name: "",
    last_name: "",
    department: "ADMIN", // 預設值
    onboarding_date: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
    onConfirm: null,
  });

  const showAlert = (title, message, status = "info") => {
    setDialog({
      isOpen: true,
      type: "alert",
      status,
      title,
      message,
      onConfirm: null,
    });
  };

  const showConfirm = (title, message, onConfirm) => {
    setDialog({
      isOpen: true,
      type: "confirm",
      status: "warning",
      title,
      message,
      onConfirm,
    });
  };

  const closeDialog = () => {
    setDialog((prev) => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/users");
      if (!res.ok) throw new Error("無法載入帳號資料");
      const json = await res.json();

      // 容錯處理：確認後端回傳的是 array 還是包在 data 中
      const dataList = Array.isArray(json) ? json : json.data || [];
      setUsers(dataList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const processedUsers = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    if (!searchTerm) return list;

    return list.filter((u) => {
      const fullName =
        `${u.first_name || ""}${u.last_name || ""}`.toLowerCase();
      const depName = DEPARTMENT_MAP[u.department] || "";
      return (
        (u.username &&
          u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        fullName.includes(searchTerm.toLowerCase()) ||
        depName.includes(searchTerm)
      );
    });
  }, [users, searchTerm]);

  const openModal = (targetUser = null) => {
    if (targetUser) {
      setEditingUser(targetUser);
      setFormData({
        username: targetUser.username || "",
        password: "",
        first_name: targetUser.first_name || "",
        last_name: targetUser.last_name || "",
        department: targetUser.department || "ADMIN",
        onboarding_date: targetUser.onboarding_date || "",
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: "",
        password: "",
        first_name: "",
        last_name: "",
        department: "ADMIN",
        onboarding_date: "",
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.username ||
      (!editingUser && !formData.password) ||
      !formData.first_name ||
      !formData.onboarding_date
    ) {
      return showAlert("資料不完整", "請填寫所有必填欄位 (*)", "warning");
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(formData.username)) {
      return showAlert(
        "格式錯誤",
        "登入帳號只能包含半形英文、數字與底線。",
        "warning",
      );
    }

    setIsSubmitting(true);

    const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";

    const method = editingUser ? "PATCH" : "POST";

    const payload = { ...formData };
    if (editingUser && !payload.password) {
      delete payload.password;
    }

    try {
      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.username?.[0] || "儲存失敗");
      }

      await fetchUsers();
      closeModal();
      showAlert(
        "儲存成功",
        `已成功${editingUser ? "更新" : "新增"}帳號「${formData.username}」。`,
        "success",
      );
    } catch (err) {
      showAlert("發生錯誤", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id, username) => {
    showConfirm(
      "停權確認",
      `確定要刪除/停權帳號「${username}」嗎？`,
      async () => {
        closeDialog();
        try {
          const res = await fetchWithAuth(`/api/users/${id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("操作失敗");

          setUsers((prev) => prev.filter((u) => u.id !== id));
          showAlert("操作成功", `已成功移除「${username}」。`, "success");
        } catch (err) {
          showAlert("操作失敗", err.message, "error");
        }
      },
    );
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="text-lg font-medium text-slate-500 animate-pulse">
          載入帳號資料中...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            系統帳號管理
          </h2>
        </div>
      </div>

      <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg border border-blue-100">
        <p className="flex items-center gap-2 font-medium mb-1">
          <span className="text-lg">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
          <li>此頁面可檢視系統內的所有員工帳號。</li>
          <li>
            基於資安權限，<strong>僅有老闆 (EMPLOYER)</strong>{" "}
            具備開通、編輯與停權帳號的操作權限。
          </li>
        </ul>
      </div>

      {error && (
        <div className="p-4 mb-6 mt-4 text-red-700 bg-red-50 rounded-lg border border-red-200">
          ⚠️ {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 mt-2">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <input
            type="text"
            placeholder="搜尋帳號、姓名或部門..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-72"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-sm text-slate-500 hover:text-red-500 whitespace-nowrap transition-colors underline"
            >
              清除條件
            </button>
          )}
        </div>

        {/* 權限判斷：只有老闆能看到新增按鈕 */}
        {isEmployer && (
          <button
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors text-sm font-medium whitespace-nowrap w-full md:w-auto"
          >
            + 開通新帳號
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
                <th className="p-4 font-semibold whitespace-nowrap">
                  登入帳號
                </th>
                <th className="p-4 font-semibold whitespace-nowrap">姓名</th>
                <th className="p-4 font-semibold whitespace-nowrap">
                  所屬部門
                </th>
                <th className="p-4 font-semibold whitespace-nowrap">到職日</th>
                <th className="p-4 font-semibold whitespace-nowrap">狀態</th>
                {isEmployer && (
                  <th className="p-4 font-semibold text-center whitespace-nowrap">
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedUsers.length > 0 ? (
                processedUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50 outline-none transition-colors"
                  >
                    <td className="p-4 text-slate-800 font-mono font-bold text-sm">
                      {u.username}
                    </td>
                    <td className="p-4 text-slate-800">
                      {u.last_name}
                      {u.first_name}
                    </td>
                    <td className="p-4 text-slate-600">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                        {DEPARTMENT_MAP[u.department] || u.department}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 font-mono text-sm">
                      {u.onboarding_date || "-"}
                    </td>
                    <td className="p-4">
                      {u.is_active ? (
                        <span className="text-green-600 flex items-center gap-1 text-sm font-medium">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          啟用中
                        </span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1 text-sm font-medium">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          已停權
                        </span>
                      )}
                    </td>

                    {isEmployer && (
                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => openModal(u)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-600 hover:text-white transition-all duration-200 text-xs font-bold mr-2 outline-none shadow-sm"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => handleDelete(u.id, u.username)}
                          className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-500 hover:text-white transition-all duration-200 text-xs font-bold outline-none shadow-sm"
                        >
                          刪除
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={isEmployer ? "6" : "5"}
                    className="p-12 text-center text-slate-400"
                  >
                    找不到符合的帳號資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingUser ? "編輯帳號資料" : "開通新帳號"}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none outline-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    登入帳號 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    required
                    disabled={!!editingUser}
                    value={formData.username}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono disabled:bg-slate-100 disabled:text-slate-400"
                    placeholder="請輸入英文或數字 (做為登入帳號)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    登入密碼{" "}
                    {editingUser ? (
                      <span className="text-slate-400 font-normal">
                        (若不修改請留空)
                      </span>
                    ) : (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <input
                    type="password"
                    name="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder={
                      editingUser ? "輸入新密碼以重設" : "請輸入初始密碼"
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      姓氏 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      required
                      value={formData.last_name}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="例如: 余"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      名字 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      required
                      value={formData.first_name}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="例如: 老闆"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      所屬部門 <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {Object.entries(DEPARTMENT_MAP).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      到職日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="onboarding_date"
                      required
                      value={formData.onboarding_date}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 text-sm font-medium rounded-md transition-colors outline-none"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 outline-none"
                >
                  {isSubmitting ? "儲存中..." : "儲存資料"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomDialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        status={dialog.status}
        title={dialog.title}
        message={dialog.message}
        onClose={closeDialog}
        onConfirm={dialog.onConfirm}
      />
    </div>
  );
};

export default UserPage;
