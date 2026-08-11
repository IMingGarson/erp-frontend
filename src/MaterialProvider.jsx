import { useState, useEffect, useMemo, Fragment } from "react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useAuthStore } from "./store/authStore";
import { ChevronDown, Edit2, Trash2, ChevronUp } from "lucide-react";

const MaterialProviderPage = () => {
  const isRD = useAuthStore((state) => state.isRD());

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  // 搜尋狀態
  const [searchTerm, setSearchTerm] = useState("");

  // 表單與 Modal 狀態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    fax: "",
    tax_id: "",
    address: "",
    invoice_address: "",
    delivery_address: "",
    phone: "",
    contact_person: "",
    contact_email: "",
    bank_name: "",
    bank_account: "",
    note: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 自訂對話框 (Alert & Confirm) 狀態
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
    onConfirm: null,
  });

  const toggleRow = (id) =>
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

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
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/material_providers");
      if (!res.ok) throw new Error("無法載入原物料供應商資料");
      const json = await res.json();
      setProviders(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 處理搜尋過濾
  const processedProviders = useMemo(() => {
    const list = Array.isArray(providers) ? providers : [];
    if (!searchTerm) return list;

    return list.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.tax_id && p.tax_id.includes(searchTerm)) ||
        (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase())),
    );
  }, [providers, searchTerm]);

  // 表單操作
  const openModal = (provider = null) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        code: provider.code || "",
        name: provider.name || "",
        fax: provider.fax || "",
        tax_id: provider.tax_id || "",
        address: provider.address || "",
        invoice_address: provider.invoice_address || "",
        delivery_address: provider.delivery_address || "",
        phone: provider.phone || "",
        contact_person: provider.contact_person || "",
        contact_email: provider.contact_email || "",
        bank_name: provider.bank_name || "",
        bank_account: provider.bank_account || "",
        note: provider.note || "",
      });
    } else {
      setEditingProvider(null);
      setFormData({
        code: "",
        name: "",
        fax: "",
        tax_id: "",
        address: "",
        invoice_address: "",
        delivery_address: "",
        phone: "",
        contact_person: "",
        contact_email: "",
        bank_name: "",
        bank_account: "",
        note: "",
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProvider(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ==========================================
    // 🛡️ 表單資料 Validation 驗證區塊
    // ==========================================

    if (!formData.name) {
      return showAlert("資料不完整", "請填寫供應商名稱", "warning");
    }

    const nameRegex = /^[\u4E00-\u9FFFa-zA-Z0-9\s]+$/;
    if (!nameRegex.test(formData.name)) {
      return showAlert(
        "格式錯誤",
        "供應商名稱只能包含中文、半形英文與數字，不接受全形英數字或特殊符號。",
        "warning",
      );
    }

    const codeRegex = /^[a-zA-Z\d-]+$/;
    if (formData.code && !codeRegex.test(formData.code)) {
      return showAlert(
        "格式錯誤",
        "供應商代碼只能包含半形英文、數字與橫槓 (-)，不接受全形字元或特殊符號。",
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

    if (formData.fax && !codeRegex.test(formData.fax)) {
      return showAlert(
        "格式錯誤",
        "傳真號碼只能包含半形數字與橫槓 (-)，不接受全形字元。",
        "warning",
      );
    }

    const taxIdRegex = /^\d+$/;
    if (formData.tax_id && !taxIdRegex.test(formData.tax_id)) {
      return showAlert(
        "格式錯誤",
        "統一編號只能由半形數字組成，不接受全形數字。",
        "warning",
      );
    }
    // ==========================================

    showConfirm(
      "儲存確認",
      `確定要${editingProvider ? "更新" : "新增"}供應商「${formData.name}」的資料嗎？`,
      async () => {
        closeDialog();
        setIsSubmitting(true);

        const url = editingProvider
          ? `/api/material_providers/${editingProvider.id}`
          : "/api/material_providers";

        const method = editingProvider ? "PUT" : "POST";

        try {
          const res = await fetchWithAuth(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });

          if (!res.ok) throw new Error("儲存失敗");

          await fetchProviders();
          closeModal();
          showAlert(
            "儲存成功",
            `已成功${editingProvider ? "更新" : "新增"}供應商「${formData.name}」的資料。`,
            "success",
          );
        } catch (err) {
          showAlert("發生錯誤", err.message, "error");
        } finally {
          setIsSubmitting(false);
        }
      },
    );
  };

  const handleDelete = (id, name) => {
    showConfirm("刪除確認", `確定要刪除供應商「${name}」嗎？`, async () => {
      closeDialog();
      try {
        const res = await fetchWithAuth(`/api/material_providers/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("刪除失敗");

        setProviders((prev) => prev.filter((p) => p.id !== id));
        showAlert("刪除成功", `已成功移除「${name}」。`, "success");
      } catch (err) {
        showAlert("刪除失敗", err.message, "error");
      }
    });
  };

  if (loading && providers.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="text-lg font-medium text-slate-500 animate-pulse">
          載入供應商資料中...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            原物料供應商管理
          </h2>
        </div>
      </div>

      <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg border border-blue-100">
        <p className="flex items-center gap-2 font-medium mb-1">
          <span className="text-lg">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
          <li>此頁面可快速搜尋原物料供應商資訊。</li>
          <li>
            基於權限控管，僅有<strong>「研發部」</strong>
            具備新增、編輯與刪除供應商資料的權限。
          </li>
          <li>
            您可以透過下方的搜尋列，輸入<strong>供應商代碼、名稱</strong>或
            <strong>統一編號</strong>來快速篩選目標供應商。
          </li>
        </ul>
      </div>

      {error && (
        <div className="p-4 mb-6 text-red-700 bg-red-50 rounded-lg border border-red-200">
          ⚠️ {error}
        </div>
      )}

      {/* 操作區與篩選器 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 mt-2">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <input
            type="text"
            placeholder="搜尋供應商代碼、名稱或統一編號..."
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
            + 新增供應商
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
                <th className="p-4 w-10"></th>
                <th className="p-4 font-semibold whitespace-nowrap">代碼</th>
                <th className="p-4 font-semibold whitespace-nowrap">名稱</th>
                <th className="p-4 font-semibold whitespace-nowrap">
                  統一編號
                </th>
                <th className="p-4 font-semibold whitespace-nowrap">聯絡人</th>
                <th className="p-4 font-semibold whitespace-nowrap">電話</th>
                <th className="p-4 font-semibold">地址</th>
                {isRD && (
                  <th className="p-4 font-semibold text-center whitespace-nowrap">
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedProviders.length > 0 ? (
                processedProviders.map((p) => (
                  <Fragment key={p.id}>
                    {/* 主要顯示列 */}
                    <tr
                      className="hover:bg-slate-50 outline-none transition-colors cursor-pointer"
                      onClick={() => toggleRow(p.id)}
                    >
                      <td className="p-4 text-slate-400">
                        {expandedRows[p.id] ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </td>
                      <td className="p-4 text-slate-600 font-mono text-sm">
                        {p.code || "-"}
                      </td>
                      <td className="p-4 text-slate-800 font-bold">{p.name}</td>
                      <td className="p-4 text-slate-600 font-mono text-sm">
                        {p.tax_id || "-"}
                      </td>
                      <td className="p-4 text-slate-600">
                        {p.contact_person || "-"}
                      </td>
                      <td className="p-4 text-slate-600 font-mono text-sm">
                        {p.phone || "-"}
                      </td>
                      <td className="p-4 text-slate-500 font-mono text-sm truncate max-w-xs">
                        {p.address || "-"}
                      </td>
                      {isRD && (
                        <td className="p-4 text-center whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(p);
                            }}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-600 hover:text-white transition-all duration-200 text-xs font-bold mr-2 outline-none shadow-sm"
                          >
                            編輯
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(p.id, p.name);
                            }}
                            className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-500 hover:text-white transition-all duration-200 text-xs font-bold outline-none shadow-sm"
                          >
                            刪除
                          </button>
                        </td>
                      )}
                    </tr>

                    {/* 展開詳情列 */}
                    {expandedRows[p.id] && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={isRD ? "8" : "7"} className="px-12 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm text-slate-600">
                            <div>
                              <p className="font-bold text-slate-400 uppercase text-xs mb-1">
                                傳真
                              </p>
                              <p>{p.fax || "-"}</p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-400 uppercase text-xs mb-1">
                                Email
                              </p>
                              <p>{p.contact_email || "-"}</p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-400 uppercase text-xs mb-1">
                                銀行名稱
                              </p>
                              <p>{p.bank_name || "-"}</p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-400 uppercase text-xs mb-1">
                                銀行帳號
                              </p>
                              <p className="font-mono">
                                {p.bank_account || "-"}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <p className="font-bold text-slate-400 uppercase text-xs mb-1">
                                發票地址
                              </p>
                              <p>{p.invoice_address || "-"}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="font-bold text-slate-400 uppercase text-xs mb-1">
                                送貨地址
                              </p>
                              <p>{p.delivery_address || "-"}</p>
                            </div>
                            <div className="col-span-4">
                              <p className="font-bold text-slate-400 uppercase text-xs mb-1">
                                備註
                              </p>
                              <p className="italic text-slate-500">
                                {p.note || "無"}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={isRD ? "8" : "7"}
                    className="p-12 text-center text-slate-400"
                  >
                    找不到符合的供應商資料
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-xl font-bold text-slate-800">
                {editingProvider ? "編輯供應商資料" : "新增供應商"}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none outline-none"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 overflow-hidden"
            >
              {/* 加入 overflow-y-auto 讓表單內容可滾動，避免高度超過螢幕 */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* 區塊 1：基本資訊 */}
                <div>
                  <h4 className="text-md font-bold text-slate-800 mb-3 border-b pb-1">
                    基本資訊
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        供應商名稱 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="請輸入供應商全名"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        供應商代碼
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
                        統一編號
                      </label>
                      <input
                        type="text"
                        name="tax_id"
                        maxLength="10"
                        value={formData.tax_id}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                        placeholder="請輸入統編"
                      />
                    </div>
                  </div>
                </div>

                {/* 區塊 2：聯絡資訊 */}
                <div>
                  <h4 className="text-md font-bold text-slate-800 mb-3 border-b pb-1">
                    聯絡資訊
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        聯絡 Email
                      </label>
                      <input
                        type="email"
                        name="contact_email"
                        value={formData.contact_email}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="例如：user@example.com"
                      />
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
                        傳真號碼
                      </label>
                      <input
                        type="text"
                        name="fax"
                        value={formData.fax}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                        placeholder="例如：02-2345-6780"
                      />
                    </div>
                  </div>
                </div>

                {/* 區塊 3：地址與財務資訊 */}
                <div>
                  <h4 className="text-md font-bold text-slate-800 mb-3 border-b pb-1">
                    地址與財務
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        公司地址
                      </label>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="請輸入公司立案地址"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                          發票寄送地址
                        </label>
                        <input
                          type="text"
                          name="invoice_address"
                          value={formData.invoice_address}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="與公司地址不同時填寫"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                          送貨地址
                        </label>
                        <input
                          type="text"
                          name="delivery_address"
                          value={formData.delivery_address}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="原物料主要送貨地址"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                          匯款銀行名稱
                        </label>
                        <input
                          type="text"
                          name="bank_name"
                          value={formData.bank_name}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="例如：中國信託 城東分行"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                          匯款帳號
                        </label>
                        <input
                          type="text"
                          name="bank_account"
                          value={formData.bank_account}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                          placeholder="請輸入銀行帳號"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 區塊 4：備註 */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    備註
                  </label>
                  <textarea
                    name="note"
                    rows="2"
                    value={formData.note}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="其他補充事項..."
                  />
                </div>
              </div>

              {/* 表單送出區塊 */}
              <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end gap-3">
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
                  className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 outline-none flex items-center justify-center min-w-[100px]"
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

export default MaterialProviderPage;
