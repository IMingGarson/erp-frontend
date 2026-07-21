import { useState, useEffect, useMemo } from "react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useAuthStore } from "./store/authStore";

const VendorPage = () => {
  const isRD = useAuthStore((state) => state.isRD());

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 搜尋狀態
  const [searchTerm, setSearchTerm] = useState("");

  // 表單與 Modal 狀態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [formData, setFormData] = useState({
    code: "", // 新增代碼欄位
    name: "",
    tax_id: "",
    contact_person: "",
    phone: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 自訂對話框 (Alert & Confirm) 狀態
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert", // 'alert' | 'confirm'
    status: "info", // 'success' | 'error' | 'warning' | 'info'
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
    fetchVendors();
  }, []);

  // 1. 修正 Fetch 邏輯：解析 .data
  const fetchVendors = async () => {
    setLoading(true);
    try {
      // 移除 API 結尾的 /
      const res = await fetchWithAuth("/api/vendors");
      if (!res.ok) throw new Error("無法載入客戶資料");
      const json = await res.json();
      // 根據統一 Response 格式取用 data
      setVendors(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 處理搜尋過濾
  const processedVendors = useMemo(() => {
    const list = Array.isArray(vendors) ? vendors : [];
    if (!searchTerm) return list;

    return list.filter(
      (v) =>
        (v.name && v.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.tax_id && v.tax_id.includes(searchTerm)) ||
        (v.code && v.code.toLowerCase().includes(searchTerm.toLowerCase())), // 新增代碼搜尋
    );
  }, [vendors, searchTerm]);

  // 表單操作
  const openModal = (vendor = null) => {
    if (vendor) {
      setEditingVendor(vendor);
      setFormData({
        code: vendor.code || "", // 載入代碼
        name: vendor.name || "",
        tax_id: vendor.tax_id || "",
        contact_person: vendor.contact_person || "",
        phone: vendor.phone || "",
        address: vendor.address || "",
      });
    } else {
      setEditingVendor(null);
      setFormData({
        code: "",
        name: "",
        tax_id: "",
        contact_person: "",
        phone: "",
        address: "",
      }); // 重置包含代碼
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVendor(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 2. 修正 Submit 邏輯：處理 PUT/POST URL
  // 2. 修正 Submit 邏輯：加入格式驗證與處理 PUT/POST URL
  const handleSubmit = async (e) => {
    e.preventDefault();

    // ==========================================
    // 🛡️ 表單資料 Validation 驗證區塊
    // ==========================================

    if (!formData.name) {
      return showAlert("資料不完整", "請填寫客戶名稱", "warning");
    }

    // 1. 驗證名稱：只允許中文 (\u4E00-\u9FFF)、半形英文 (a-zA-Z)、半形數字 (0-9) 以及空白 (\s)
    // 因為嚴格指定了半形範圍，使用者若輸入「全形英數字」或「特殊符號」都會被阻擋
    const nameRegex = /^[\u4E00-\u9FFFa-zA-Z0-9\s]+$/;
    if (!nameRegex.test(formData.name)) {
      return showAlert(
        "格式錯誤",
        "客戶名稱只能包含中文、半形英文與數字，不接受全形英數字或特殊符號。",
        "warning",
      );
    }

    // 2. 驗證代碼：只允許半形數字 (\d) 與橫槓 (-)
    const codeRegex = /^[\d-]+$/;
    if (formData.code && !codeRegex.test(formData.code)) {
      return showAlert(
        "格式錯誤",
        "客戶代碼只能包含半形數字與橫槓 (-)，不接受全形字元。",
        "warning",
      );
    }

    if (formData.phone && !codeRegex.test(formData.phone)) {
      return showAlert(
        "格式錯誤",
        "聯絡電話只能包含半形數字與橫槓 (-)，不接受全形字元。",
        "warning",
      );
    }

    // 3. 驗證統一編號：只允許半形數字 (\d)
    const taxIdRegex = /^\d+$/;
    if (formData.tax_id && !taxIdRegex.test(formData.tax_id)) {
      return showAlert(
        "格式錯誤",
        "統一編號只能由半形數字組成，不接受全形數字。",
        "warning",
      );
    }
    // ==========================================

    setIsSubmitting(true);

    const url = editingVendor
      ? `/api/vendors/${editingVendor.id}`
      : "/api/vendors";

    const method = editingVendor ? "PUT" : "POST";

    try {
      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("儲存失敗");

      await fetchVendors();
      closeModal();
      showAlert(
        "儲存成功",
        `已成功${editingVendor ? "更新" : "新增"}客戶「${formData.name}」的資料。`,
        "success",
      );
    } catch (err) {
      showAlert("發生錯誤", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. 修正 Delete 邏輯：移除 URL 斜線
  const handleDelete = (id, name) => {
    showConfirm("刪除確認", `確定要刪除客戶「${name}」嗎？`, async () => {
      closeDialog();
      try {
        // 移除 API 結尾的 /
        const res = await fetchWithAuth(`/api/vendors/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("刪除失敗");

        // 重新拉取或從本地過濾
        setVendors((prev) => prev.filter((v) => v.id !== id));
        showAlert("刪除成功", `已成功移除「${name}」。`, "success");
      } catch (err) {
        showAlert("刪除失敗", err.message, "error");
      }
    });
  };

  if (loading && vendors.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="text-lg font-medium text-slate-500 animate-pulse">
          載入客戶資料中...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            客戶名錄管理
          </h2>
        </div>
      </div>

      <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg border border-blue-100">
        <p className="flex items-center gap-2 font-medium mb-1">
          <span className="text-lg">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
          <li>此頁面可快速搜尋外部客戶資訊。</li>
          <li>
            基於權限控管，僅有<strong>「研發部」</strong>
            具備新增、編輯與刪除客戶資料的權限。
          </li>
          <li>
            您可以透過下方的搜尋列，輸入<strong>客戶代碼、客戶名稱</strong>或
            <strong>統一編號</strong>來快速篩選目標客戶。
          </li>
        </ul>
      </div>

      {error && (
        <div className="p-4 mb-6 text-red-700 bg-red-50 rounded-lg border border-red-200">
          ⚠️ {error}
        </div>
      )}

      {/* 操作區與篩選器 (修改為統一風格) */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 mt-2">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <input
            type="text"
            placeholder="搜尋客戶代碼、名稱或統一編號..."
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

        {isRD && (
          <button
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors text-sm font-medium whitespace-nowrap w-full md:w-auto"
          >
            + 新增客戶
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
                <th className="p-4 font-semibold whitespace-nowrap">
                  客戶代碼
                </th>
                <th className="p-4 font-semibold whitespace-nowrap">
                  客戶名稱
                </th>
                <th className="p-4 font-semibold whitespace-nowrap">
                  統一編號
                </th>
                <th className="p-4 font-semibold whitespace-nowrap">負責人</th>
                <th className="p-4 font-semibold whitespace-nowrap">
                  聯絡電話
                </th>
                <th className="p-4 font-semibold">地址</th>
                {isRD && (
                  <th className="p-4 font-semibold text-center whitespace-nowrap">
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedVendors.length > 0 ? (
                processedVendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    className="hover:bg-slate-50 outline-none transition-colors"
                  >
                    <td className="p-4 text-slate-600 font-mono text-sm">
                      {vendor.code || "-"}
                    </td>
                    <td className="p-4 text-slate-800 font-bold">
                      {vendor.name}
                    </td>
                    <td className="p-4 text-slate-600 font-mono text-sm">
                      {vendor.tax_id || "-"}
                    </td>
                    <td className="p-4 text-slate-600">
                      {vendor.contact_person || "-"}
                    </td>
                    <td className="p-4 text-slate-600 font-mono text-sm">
                      {vendor.phone || "-"}
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-sm">
                      {vendor.address || "-"}
                    </td>
                    {isRD && (
                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => openModal(vendor)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-600 hover:text-white transition-all duration-200 text-xs font-bold mr-2 outline-none shadow-sm"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => handleDelete(vendor.id, vendor.name)}
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
                  <td colSpan="7" className="p-12 text-center text-slate-400">
                    找不到符合的客戶資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新增/編輯表單 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingVendor ? "編輯客戶資料" : "新增客戶"}
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
                    客戶代碼
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    placeholder="請輸入代碼"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    客戶名稱 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="請輸入公司全名"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      統一編號
                    </label>
                    <input
                      type="text"
                      name="tax_id"
                      maxLength="8"
                      value={formData.tax_id}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                      placeholder="請輸入統編"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      聯絡人
                    </label>
                    <input
                      type="text"
                      name="contact_person"
                      value={formData.contact_person}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="輸入聯絡人名稱"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    聯絡電話
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    placeholder="例如：02-2345-6789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    地址
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="完整地址"
                  />
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

export default VendorPage;
