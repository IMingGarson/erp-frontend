import { useState, useEffect, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Layers,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useAuthStore } from "./store/authStore";

const TYPE_OPTIONS = [
  { value: "RAW", label: "原物料" },
  { value: "SEMI", label: "半成品" },
  { value: "PRODUCT", label: "成品" },
  { value: "PACK", label: "包材" },
];

const PHASE_OPTIONS = [
  { value: "IN_DEV", label: "開發中" },
  { value: "IN_PROD", label: "正式量產" },
];

const getTypeLabel = (typeValue) => {
  const target = TYPE_OPTIONS.find((opt) => opt.value === typeValue);
  return target ? target.label : typeValue;
};

const getPhaseLabel = (phaseValue) => {
  const target = PHASE_OPTIONS.find((opt) => opt.value === phaseValue);
  return target ? target.label : phaseValue;
};

export default function MaterialPage() {
  const isRD = useAuthStore((state) => state.isRD());
  const navigate = useNavigate();

  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 篩選與分頁狀態
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal 與表單狀態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialFormData = {
    code: "",
    name: "",
    english_name: "",
    phase: "IN_DEV", // 需求 4：預設為 IN_DEV
    type: "RAW",
    unit: "KG",
    allergen_info: "",
    storage_life: "",
    description: "",
    additive_license_no: "",
    license_valid_date: "",
    product_registration_no: "",
    origin: "",
    is_active: true,
  };
  const [formData, setFormData] = useState(initialFormData);

  // 詳細資訊 Pop up 狀態 (需求 2)
  const [viewingMaterial, setViewingMaterial] = useState(null);

  // 自訂對話框 (Alert & Confirm) 狀態
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
    onConfirm: null,
  });

  const showAlert = (title, message, status = "info") =>
    setDialog({
      isOpen: true,
      type: "alert",
      status,
      title,
      message,
      onConfirm: null,
    });
  const showConfirm = (title, message, onConfirm) =>
    setDialog({
      isOpen: true,
      type: "confirm",
      status: "warning",
      title,
      message,
      onConfirm,
    });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  // 1. 取得物料列表 (Read)
  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth("/api/materials");
      if (!response.ok) throw new Error("無法取得物料資料");
      const data = await response.json();
      setMaterials(data.data || []);
    } catch (error) {
      console.error("Fetch error:", error);
      showAlert("載入失敗", "無法載入物料資料，請稍後再試。", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleOpenAddModal = () => {
    if (!isRD)
      return showAlert(
        "權限不足",
        "僅有研發部 (RD) 人員可以新增物料。",
        "warning",
      );
    setEditingId(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (material) => {
    if (!isRD)
      return showAlert(
        "權限不足",
        "僅有研發部 (RD) 人員可以編輯物料。",
        "warning",
      );
    setEditingId(material.id);
    setFormData({
      code: material.code || "",
      name: material.name || "",
      english_name: material.english_name || "",
      phase: material.phase || "IN_DEV",
      type: material.type || "RAW",
      unit: material.unit || "",
      allergen_info: material.allergen_info || "",
      storage_life: material.storage_life || "",
      description: material.description || "",
      additive_license_no: material.additive_license_no || "",
      license_valid_date: material.license_valid_date || "",
      product_registration_no: material.product_registration_no || "",
      origin: material.origin || "",
      is_active: material.is_active,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  // 2. 儲存物料 (Create / Update) 結合 Confirm
  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      return showAlert(
        "資料不完整",
        "請填寫必填欄位（代碼與名稱）。",
        "warning",
      );
    }

    const isEditing = editingId !== null;
    showConfirm(
      "儲存確認",
      `確定要${isEditing ? "更新" : "新增"}物料「${formData.name}」嗎？`,
      async () => {
        closeDialog();
        const url = isEditing
          ? `/api/materials/${editingId}`
          : "/api/materials";
        const method = isEditing ? "PUT" : "POST";

        try {
          const response = await fetchWithAuth(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error("Save error:", errorData);
            throw new Error("儲存失敗，請檢查輸入資料或代碼是否重複。");
          }

          await fetchMaterials();
          handleCloseModal();
          showAlert(
            "儲存成功",
            `已成功${isEditing ? "更新" : "新增"}物料資料。`,
            "success",
          );
        } catch (error) {
          showAlert("發生錯誤", error.message, "error");
        }
      },
    );
  };

  const handleDelete = (id, name) => {
    if (!isRD)
      return showAlert(
        "權限不足",
        "僅有研發部 (RD) 人員可以刪除物料。",
        "warning",
      );

    showConfirm(
      "刪除確認",
      `確定要刪除物料「${name}」嗎？此操作無法復原。`,
      async () => {
        closeDialog();
        try {
          const response = await fetchWithAuth(`/api/materials/${id}`, {
            method: "DELETE",
          });

          if (!response.ok) throw new Error("刪除失敗");

          setMaterials((prev) => prev.filter((m) => m.id !== id));
          showAlert("刪除成功", `已成功移除「${name}」。`, "success");
        } catch (error) {
          showAlert(
            "刪除失敗",
            "刪除失敗，請檢查是否已有相關聯的生產單或 BOM。",
            "error",
          );
        }
      },
    );
  };

  // --- 篩選與分頁邏輯 ---
  const filteredMaterials = useMemo(() => {
    const list = Array.isArray(materials) ? materials : [];
    return list.filter((mat) => {
      const matchSearch =
        mat.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === "" ? true : mat.type === filterType;
      return matchSearch && matchType;
    });
  }, [materials, searchTerm, filterType]);

  const totalPages = Math.ceil(filteredMaterials.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = filteredMaterials.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            物料與產品管理
          </h2>
        </div>
      </div>

      <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg border border-blue-100 mb-3">
        <p className="flex items-center gap-2 font-medium mb-1">
          <span className="text-lg">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
          <li>在此頁面您可以檢視或維護原物料、半成品、成品及包材資料。</li>
          <li>
            基於權限控管，僅有<strong>「研發部」</strong>
            具備新增與編輯物料的權限。
          </li>
        </ul>
      </div>

      {/* 操作區與篩選器 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 mt-2">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <input
            type="text"
            placeholder="搜尋代碼或名稱..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-72"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">所有類型</option>
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
            onClick={handleOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors text-sm font-medium whitespace-nowrap w-full md:w-auto"
          >
            + 新增物料
          </button>
        )}
      </div>

      {/* Table 內容 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="p-3 font-semibold">代碼</th>
                <th className="p-3 font-semibold">名稱</th>
                <th className="p-3 font-semibold">類型</th>
                <th className="p-3 font-semibold">階段</th>
                <th className="p-3 font-semibold">預估成本</th>
                <th className="p-3 font-semibold text-center">狀態</th>
                <th className="p-3 font-semibold text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                      資料載入中...
                    </div>
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-slate-400">
                    找不到符合條件的物料資料
                  </td>
                </tr>
              ) : (
                currentData.map((mat) => (
                  <Fragment key={mat.id}>
                    <tr className="hover:bg-slate-50 outline-none transition-colors cursor-pointer">
                      <td className="p-3 font-mono text-slate-600">
                        {mat.code}
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {mat.name}
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md border bg-slate-50 text-slate-700 border-slate-200">
                          {getTypeLabel(mat.type)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md border ${
                            mat.phase === "IN_DEV"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {getPhaseLabel(mat.phase)}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {mat.estimated_cost !== undefined
                          ? `$${mat.estimated_cost}`
                          : "-"}
                      </td>
                      <td className="p-3 text-center">
                        {mat.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            啟用
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            停用
                          </span>
                        )}
                      </td>
                      <td
                        className="p-3 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex w-full justify-center gap-2">
                          <button
                            onClick={() => setViewingMaterial(mat)}
                            className="w-16 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-md hover:bg-slate-600 hover:text-white transition-all text-xs font-bold shadow-sm"
                          >
                            詳情
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(mat)}
                            className="w-16 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-600 hover:text-white transition-all text-xs font-bold shadow-sm"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => handleDelete(mat.id, mat.name)}
                            className="w-16 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-500 hover:text-white transition-all text-xs font-bold shadow-sm"
                          >
                            刪除
                          </button>
                          {isRD && (
                            <>
                              {mat.phase === "IN_DEV" &&
                              ["PRODUCT", "SEMI"].includes(mat.type) ? (
                                <button
                                  onClick={() =>
                                    navigate(`/bom-create/${mat.code}`)
                                  }
                                  className="w-20 py-1.5 bg-purple-50 text-purple-600 border border-purple-200 rounded-md hover:bg-purple-600 hover:text-white transition-all text-xs font-bold shadow-sm"
                                >
                                  調整配方
                                </button>
                              ) : (
                                /* 🌟 隱形佔位符：確保下方的「編輯」與「刪除」不會往左邊塌陷 */
                                <div className="w-20"></div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分頁控制區 */}
        {!isLoading && filteredMaterials.length > 0 && (
          <div className="bg-white px-6 py-3 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              顯示第{" "}
              <span className="font-medium text-slate-900">
                {startIndex + 1}
              </span>{" "}
              到{" "}
              <span className="font-medium text-slate-900">
                {Math.min(startIndex + itemsPerPage, filteredMaterials.length)}
              </span>{" "}
              筆資料，共{" "}
              <span className="font-medium text-slate-900">
                {filteredMaterials.length}
              </span>{" "}
              筆
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
              >
                上一頁
              </button>
              <span className="flex items-center px-3 py-1 text-sm text-slate-700 font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
              >
                下一頁
              </button>
            </div>
          </div>
        )}
      </div>

      {viewingMaterial && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-xl font-bold text-slate-800">
                {viewingMaterial.code} ({viewingMaterial.name})
              </h3>
              <button
                onClick={() => setViewingMaterial(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none outline-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <span className="block text-xs text-slate-400 uppercase font-bold">
                    物料代號
                  </span>
                  {viewingMaterial.code}
                </div>
                <div>
                  <span className="block text-xs text-slate-400 uppercase font-bold">
                    物料名稱
                  </span>
                  {viewingMaterial.name}
                </div>
                <div>
                  <span className="block text-xs text-slate-400 uppercase font-bold">
                    英文名稱
                  </span>
                  {viewingMaterial.english_name || "-"}
                </div>
                <div>
                  <span className="block text-xs text-slate-400 uppercase font-bold">
                    物料類型
                  </span>
                  {getTypeLabel(viewingMaterial.type)}
                </div>
                <div>
                  <span className="block text-xs text-slate-400 uppercase font-bold">
                    使用階段
                  </span>
                  {getPhaseLabel(viewingMaterial.phase)}
                </div>
                <div>
                  <span className="block text-xs text-slate-400 uppercase font-bold">
                    單位
                  </span>
                  {viewingMaterial.unit}
                </div>
                <div>
                  <span className="block text-xs text-slate-400 uppercase font-bold">
                    預估成本
                  </span>
                  ${viewingMaterial.estimated_cost ?? 0}
                </div>
                <div>
                  <span className="block text-xs text-slate-400 uppercase font-bold">
                    是否原物料
                  </span>
                  {viewingMaterial.is_raw_material ? "是" : "否"}
                </div>
                <div>
                  <span className="block text-xs text-slate-400 uppercase font-bold">
                    啟用狀態
                  </span>
                  {viewingMaterial.is_active ? "啟用" : "停用"}
                </div>
                <div>
                  <span className="block text-xs text-slate-400 uppercase font-bold">
                    建立者
                  </span>
                  {viewingMaterial.creator_name || "系統產生"}
                </div>
                <div>
                  <span className="block text-xs text-slate-400 uppercase font-bold">
                    建立時間
                  </span>
                  {new Date(viewingMaterial.created_at).toLocaleString()}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-bold text-slate-700 mb-3">
                  食安與法規資訊
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <span className="block text-xs text-slate-400 uppercase font-bold">
                      過敏原資訊
                    </span>
                    {viewingMaterial.allergen_info || "-"}
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 uppercase font-bold">
                      保存期限
                    </span>
                    {viewingMaterial.storage_life || "-"}
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 uppercase font-bold">
                      產地
                    </span>
                    {viewingMaterial.origin || "-"}
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 uppercase font-bold">
                      添加物許可證號
                    </span>
                    {viewingMaterial.additive_license_no || "-"}
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 uppercase font-bold">
                      許可證效期
                    </span>
                    {viewingMaterial.license_valid_date || "-"}
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 uppercase font-bold">
                      產品登錄號
                    </span>
                    {viewingMaterial.product_registration_no || "-"}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div>
                  <span className="block text-xs text-slate-400 uppercase font-bold mb-1">
                    成分來源描述
                  </span>
                  <p className="text-slate-600 bg-slate-50 p-3 rounded-md">
                    {viewingMaterial.description || "無描述"}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end shrink-0">
              <button
                onClick={() => setViewingMaterial(null)}
                className="px-5 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-md text-sm font-medium transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-xl font-bold text-slate-800">
                {editingId ? "編輯物料資料" : "新增物料"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none outline-none"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* 基本資訊 */}
                <div>
                  <h4 className="text-md font-bold text-slate-800 mb-3 border-b pb-1">
                    基本與規格資訊
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        物料代號 (Code) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="code"
                        value={formData.code}
                        onChange={handleInputChange}
                        required
                        disabled={editingId !== null}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono disabled:bg-slate-100 disabled:text-slate-500"
                        placeholder="例如：R001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        物料名稱 (Name) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="請輸入物料名稱"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        英文名稱
                      </label>
                      <input
                        type="text"
                        name="english_name"
                        value={formData.english_name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="English Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        類型 (Type)
                      </label>
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      >
                        {TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        使用階段 (Phase)
                      </label>
                      <select
                        name="phase"
                        value={formData.phase}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      >
                        {PHASE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        單位 (Unit)
                      </label>
                      <input
                        type="text"
                        name="unit"
                        value={formData.unit}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="例如：KG, 個"
                      />
                    </div>
                  </div>
                </div>

                {/* 食安與合規資訊 */}
                <div>
                  <h4 className="text-md font-bold text-slate-800 mb-3 border-b pb-1">
                    食安與合規資訊
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        過敏原資訊
                      </label>
                      <input
                        type="text"
                        name="allergen_info"
                        value={formData.allergen_info}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="例如：含有大豆、牛奶"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        保存期限
                      </label>
                      <input
                        type="text"
                        name="storage_life"
                        value={formData.storage_life}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="例如：12個月"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        產地
                      </label>
                      <input
                        type="text"
                        name="origin"
                        value={formData.origin}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="例如：台灣"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        添加物許可證號
                      </label>
                      <input
                        type="text"
                        name="additive_license_no"
                        value={formData.additive_license_no}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        許可證效期
                      </label>
                      <input
                        type="date"
                        name="license_valid_date"
                        value={formData.license_valid_date}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        產品登錄號
                      </label>
                      <input
                        type="text"
                        name="product_registration_no"
                        value={formData.product_registration_no}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 描述與狀態 */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      描述 (成分來源)
                    </label>
                    <textarea
                      name="description"
                      rows="2"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="成分來源說明..."
                    />
                  </div>

                  <div className="flex items-center bg-slate-50 p-3 rounded-md border border-slate-200">
                    <input
                      type="checkbox"
                      name="is_active"
                      id="is_active_check"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                    />
                    <label
                      htmlFor="is_active_check"
                      className="ml-2 block text-sm font-bold text-slate-800 cursor-pointer"
                    >
                      是否啟用
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 text-sm font-medium rounded-md transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 text-sm font-medium rounded-md shadow-sm transition-colors"
                >
                  儲存資料
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
}
