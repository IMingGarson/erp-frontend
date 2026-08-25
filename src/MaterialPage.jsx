import React, { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Search,
  ArrowLeft,
  Database,
  FlaskConical,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useAuthStore } from "./store/authStore";

// ==========================================
// 選項常數
// ==========================================
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

// ==========================================
// 營養標示元件 (符合台灣法定格式與縮排，僅顯示每100g)
// ==========================================
const NutritionLabel = ({ nutritionData }) => {
  const data = nutritionData || {};

  const formatVal = (val) => parseFloat(val || 0).toFixed(1);
  const formatInt = (val) => Math.round(parseFloat(val || 0));

  return (
    <div className="w-[240px] border-[3px] border-black p-2 font-sans text-black bg-white mx-auto shadow-sm">
      <h2 className="text-2xl font-black text-center mb-1 tracking-widest">
        營養標示
      </h2>

      <table className="w-full text-sm font-bold text-right border-collapse mt-2">
        <thead>
          <tr className="border-b-[3px] border-black border-t-[3px]">
            <th className="font-bold text-left py-1 w-[50%]"></th>
            <th className="font-bold py-1 w-[50%] text-center">每100公克</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/30">
          <tr>
            <td className="text-left py-1.5">熱量</td>
            <td className="py-1.5 text-center">
              {formatVal(data.energy_kcal)} 大卡
            </td>
          </tr>
          <tr>
            <td className="text-left py-1.5">蛋白質</td>
            <td className="py-1.5 text-center">
              {formatVal(data.protein)} 公克
            </td>
          </tr>
          <tr>
            <td className="text-left py-1.5">脂肪</td>
            <td className="py-1.5 text-center">{formatVal(data.fat)} 公克</td>
          </tr>
          <tr>
            <td className="text-left py-1.5 pl-4 text-[13px] text-slate-700 font-medium">
              飽和脂肪
            </td>
            <td className="py-1.5 text-center text-[13px]">
              {formatVal(data.saturated_fat)} 公克
            </td>
          </tr>
          <tr>
            <td className="text-left py-1.5 pl-4 text-[13px] text-slate-700 font-medium">
              反式脂肪
            </td>
            <td className="py-1.5 text-center text-[13px]">
              {formatVal(data.trans_fat)} 公克
            </td>
          </tr>
          <tr>
            <td className="text-left py-1.5">碳水化合物</td>
            <td className="py-1.5 text-center">{formatVal(data.carbs)} 公克</td>
          </tr>
          <tr>
            <td className="text-left py-1.5 pl-4 text-[13px] text-slate-700 font-medium">
              糖
            </td>
            <td className="py-1.5 text-center text-[13px]">
              {formatVal(data.sugar)} 公克
            </td>
          </tr>
          <tr>
            <td className="text-left py-1.5">鈉</td>
            <td className="py-1.5 text-center">
              {formatInt(data.sodium)} 毫克
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// ==========================================
// 主頁面 Component
// ==========================================
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

  const emptyNutrition = {
    energy_kcal: "0",
    protein: "0",
    fat: "0",
    saturated_fat: "0",
    trans_fat: "0",
    carbs: "0",
    sugar: "0",
    sodium: "0",
  };

  const initialFormData = {
    code: "",
    name: "",
    english_name: "",
    phase: "IN_DEV",
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
    nutrition_fact: emptyNutrition, // 🌟 新增的營養價值欄位
  };
  const [formData, setFormData] = useState(initialFormData);

  // TFDA 搜尋狀態
  const [tfdaQuery, setTfdaQuery] = useState("");
  const [tfdaResults, setTfdaResults] = useState([]);
  const [isSearchingTfda, setIsSearchingTfda] = useState(false);
  const [isTfdaDropdownOpen, setIsTfdaDropdownOpen] = useState(false);
  const tfdaRef = useRef(null);

  // 詳細資訊 Pop up 狀態
  const [viewingMaterial, setViewingMaterial] = useState(null);

  // 自訂對話框
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tfdaRef.current && !tfdaRef.current.contains(event.target)) {
        setIsTfdaDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🌟 鎖定底層滾動的副作用 (Scroll Lock)
  useEffect(() => {
    if (isModalOpen || viewingMaterial) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    // 確保組件卸載時一定會解除鎖定
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isModalOpen, viewingMaterial]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleNutritionChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      nutrition_fact: {
        ...prev.nutrition_fact,
        [name]: value,
      },
    }));
  };

  // --- TFDA 搜尋 API ---
  const handleTfdaSearch = async () => {
    const query = tfdaQuery.trim() || formData.name.trim();
    if (!query) {
      return showAlert("提示", "請先輸入物料名稱或搜尋關鍵字", "warning");
    }

    setIsSearchingTfda(true);
    setTfdaResults([]);
    try {
      const res = await fetchWithAuth(
        `/api/materials/tfda_lookup?q=${encodeURIComponent(query)}`,
      );
      if (res.ok) {
        const json = await res.json();
        setTfdaResults(json.data || []);
        setIsTfdaDropdownOpen(true);
      }
    } catch (error) {
      console.error("TFDA 搜尋失敗", error);
    } finally {
      setIsSearchingTfda(false);
    }
  };

  const handleApplyTfdaResult = (item) => {
    setFormData((prev) => ({
      ...prev,
      nutrition_fact: {
        energy_kcal: item.energy_kcal || "0",
        protein: item.protein || "0",
        fat: item.fat || "0",
        saturated_fat: item.saturated_fat || "0",
        trans_fat: item.trans_fat || "0", // API 已轉換為公克
        carbs: item.carbs || "0",
        sugar: item.sugar || "0",
        sodium: item.sodium || "0",
      },
    }));
    setIsTfdaDropdownOpen(false);
    setTfdaQuery("");
  };

  const handleOpenAddModal = () => {
    if (!isRD)
      return showAlert("權限不足", "僅有研發部可以新增物料。", "warning");
    setEditingId(null);
    setFormData(initialFormData);
    setTfdaQuery("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (material) => {
    if (!isRD)
      return showAlert("權限不足", "僅有研發部可以編輯物料。", "warning");
    setEditingId(material.id);
    setFormData({
      ...material,
      nutrition_fact: material.nutrition_fact || emptyNutrition,
    });
    setTfdaQuery("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setTfdaQuery("");
  };

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

          if (!response.ok) throw new Error("儲存失敗，請檢查輸入資料。");
          await fetchMaterials();
          handleCloseModal();
          showAlert(
            "儲存成功",
            `已成功${isEditing ? "更新" : "新增"}。`,
            "success",
          );
        } catch (error) {
          showAlert("發生錯誤", error.message, "error");
        }
      },
    );
  };

  const handleDelete = (id, name) => {
    if (!isRD) return showAlert("權限不足", "僅有研發部可以刪除。", "warning");

    showConfirm("刪除確認", `確定要刪除「${name}」嗎？無法復原。`, async () => {
      closeDialog();
      try {
        const response = await fetchWithAuth(`/api/materials/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("刪除失敗");
        setMaterials((prev) => prev.filter((m) => m.id !== id));
        showAlert("刪除成功", `已成功移除「${name}」。`, "success");
      } catch (error) {
        showAlert("刪除失敗", "請檢查是否已有相關聯的生產單。", "error");
      }
    });
  };

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
            原物料建檔時支援帶入國家法規八大營養素，以利後續成品標籤精準展算。
          </li>
        </ul>
      </div>

      {/* 篩選與操作區 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 mt-2">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <input
            type="text"
            placeholder="搜尋代碼或名稱..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-72 shadow-sm"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm cursor-pointer"
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
              className="text-sm text-slate-500 hover:text-red-500 underline"
            >
              清除條件
            </button>
          )}
        </div>

        {isRD && (
          <button
            onClick={handleOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md shadow-sm transition-colors text-sm font-bold"
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
                    資料載入中...
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
                  <tr
                    key={mat.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="p-3 font-mono text-slate-600">{mat.code}</td>
                    <td className="p-3 font-bold text-slate-800">{mat.name}</td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 inline-flex text-xs font-semibold rounded-md border bg-slate-50 text-slate-700 border-slate-200">
                        {getTypeLabel(mat.type)}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-md border ${mat.phase === "IN_DEV" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
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
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{" "}
                          啟用
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>{" "}
                          停用
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
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
                        {isRD &&
                        mat.phase === "IN_DEV" &&
                        ["PRODUCT", "SEMI"].includes(mat.type) ? (
                          <button
                            onClick={() => navigate(`/bom-create/${mat.code}`)}
                            className="w-20 py-1.5 bg-purple-50 text-purple-600 border border-purple-200 rounded-md hover:bg-purple-600 hover:text-white transition-all text-xs font-bold shadow-sm"
                          >
                            調整配方
                          </button>
                        ) : (
                          <div className="w-20"></div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分頁 */}
        {!isLoading && filteredMaterials.length > 0 && (
          <div className="bg-white px-6 py-3 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              顯示 {startIndex + 1} 到{" "}
              {Math.min(startIndex + itemsPerPage, filteredMaterials.length)}{" "}
              筆，共 {filteredMaterials.length} 筆
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
              >
                上一頁
              </button>
              <span className="flex items-center px-3 text-sm font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
              >
                下一頁
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 詳情 Pop up (Apple UI Style, 包含營養標示) */}
      {/* ========================================================= */}
      {viewingMaterial && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white/80 backdrop-blur-md shrink-0 z-10">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <FlaskConical className="text-blue-600" size={28} />
                {viewingMaterial.name}
              </h3>
              <button
                onClick={() => setViewingMaterial(null)}
                className="text-slate-400 hover:text-slate-700 text-3xl leading-none outline-none transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 flex flex-col lg:flex-row gap-8 text-sm custom-scrollbar">
              <div className="flex-1 space-y-6">
                {/* 基本資訊卡片 */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                  <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                    1. 基本資訊
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                        物料代號
                      </span>
                      <span className="text-sm font-bold text-slate-800 font-mono">
                        {viewingMaterial.code}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                        物料類型
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {getTypeLabel(viewingMaterial.type)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                        使用階段
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {getPhaseLabel(viewingMaterial.phase)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                        單位
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {viewingMaterial.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                        啟用狀態
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {viewingMaterial.is_active ? "啟用中" : "已停用"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                        預估成本
                      </span>
                      <span className="text-sm font-bold text-slate-800 font-mono">
                        ${viewingMaterial.estimated_cost ?? 0}
                      </span>
                    </div>
                    <div className="col-span-2 md:col-span-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                        英文名稱
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {viewingMaterial.english_name || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 法規與食安卡片 */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                  <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                    2. 法規與食安
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="col-span-2 md:col-span-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                        過敏原宣告
                      </span>
                      <span className="text-sm font-bold text-red-600">
                        {viewingMaterial.allergen_info || "無"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                        保存期限
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {viewingMaterial.storage_life || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                        產地
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {viewingMaterial.origin || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                        登錄字號
                      </span>
                      <span className="text-sm font-bold text-slate-800 font-mono">
                        {viewingMaterial.product_registration_no || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 備註卡片 */}
                {viewingMaterial.description && (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                    <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                      3. 備註與描述
                    </h4>
                    <p className="text-sm text-slate-700 font-medium leading-relaxed">
                      {viewingMaterial.description}
                    </p>
                  </div>
                )}
              </div>

              {/* 右側：詳情頁內的營養標籤預覽 */}
              <div className="w-full lg:w-[380px] shrink-0">
                <div className="bg-white p-8 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col items-center sticky top-0">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 w-full text-center border-b border-slate-100 pb-2">
                    法規營養標示預覽
                  </h4>
                  <NutritionLabel
                    nutritionData={
                      viewingMaterial.nutrition_fact || emptyNutrition
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 新增/編輯 Modal (包含 TFDA 搜尋與營養標示) */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white/80 backdrop-blur-md z-10 shrink-0">
              <h3 className="text-2xl font-black text-slate-800">
                {editingId ? "編輯物料資料" : "新增物料"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-red-500 text-3xl leading-none outline-none transition-colors"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 md:p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                {/* 區塊一：基本資訊 */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                  <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                    1. 基本資訊
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        物料代號 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="code"
                        value={formData.code}
                        onChange={handleInputChange}
                        required
                        disabled={editingId !== null}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-mono disabled:bg-slate-100 text-sm font-bold text-slate-800 transition-all"
                        placeholder="R001"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        物料名稱 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all"
                        placeholder="請輸入物料名稱"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        類型
                      </label>
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-sm font-bold text-slate-800 cursor-pointer transition-all"
                      >
                        {TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        使用階段
                      </label>
                      <select
                        name="phase"
                        value={formData.phase}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-sm font-bold text-slate-800 cursor-pointer transition-all"
                      >
                        {PHASE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        基本計量單位
                      </label>
                      <input
                        type="text"
                        name="unit"
                        value={formData.unit}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all"
                        placeholder="KG"
                      />
                    </div>
                  </div>
                </div>

                {/* 區塊二：營養價值設定 */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm relative">
                  <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                    2. 法規八大營養素 (每 100g)
                  </h4>

                  {/* TFDA 搜尋列 (針對 RAW 優先開放) */}
                  {formData.type === "RAW" && (
                    <div className="mb-8 bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                      <label className="block text-[11px] font-bold text-blue-700 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                        <Database size={14} /> 從 TFDA 國家資料庫帶入數據 (選填)
                      </label>
                      <div className="relative" ref={tfdaRef}>
                        <div className="flex gap-3">
                          {/* 預設帶入 formData.name，並讓使用者看見 placeholder */}
                          <input
                            type="text"
                            value={tfdaQuery}
                            onChange={(e) => setTfdaQuery(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" &&
                              (e.preventDefault(), handleTfdaSearch())
                            }
                            placeholder={`預設搜尋：${formData.name || "輸入關鍵字"}`}
                            className="flex-1 px-4 py-2.5 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 text-sm font-bold text-slate-800 transition-all shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={handleTfdaSearch}
                            disabled={isSearchingTfda}
                            className="px-6 py-2.5 bg-[#1f4e78] text-white font-bold rounded-xl hover:bg-blue-900 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm shadow-md"
                          >
                            {isSearchingTfda ? (
                              "搜尋中..."
                            ) : (
                              <>
                                <Search size={16} /> 搜尋 TFDA
                              </>
                            )}
                          </button>
                        </div>
                        {isTfdaDropdownOpen && tfdaResults.length > 0 && (
                          <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl max-h-60 overflow-y-auto z-20 divide-y divide-slate-100">
                            {tfdaResults.map((res) => (
                              <div
                                key={res.code}
                                onClick={() => handleApplyTfdaResult(res)}
                                className="p-4 hover:bg-blue-50 cursor-pointer transition-colors group"
                              >
                                <div className="flex justify-between items-center mb-1.5">
                                  <span className="font-bold text-slate-800 text-sm group-hover:text-blue-700">
                                    {res.name}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50">
                                    {res.code}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 font-mono font-medium">
                                  熱量: {res.energy_kcal} / 蛋白質:{" "}
                                  {res.protein} / 脂肪: {res.fat} / 碳水:{" "}
                                  {res.carbs} / 鈉: {res.sodium}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {isTfdaDropdownOpen &&
                          tfdaResults.length === 0 &&
                          !isSearchingTfda && (
                            <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 shadow-xl rounded-2xl p-6 text-center text-sm font-bold text-slate-500 z-20">
                              查無資料，請手動依供應商規格書輸入。
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-start">
                    {/* 左側：手動輸入區 */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                      {[
                        { id: "energy_kcal", label: "熱量", unit: "大卡" },
                        { id: "protein", label: "蛋白質", unit: "g" },
                        { id: "fat", label: "脂肪", unit: "g" },
                        { id: "saturated_fat", label: " 飽和脂肪", unit: "g" },
                        { id: "trans_fat", label: " 反式脂肪", unit: "g" },
                        { id: "carbs", label: "碳水化合物", unit: "g" },
                        { id: "sugar", label: " 糖", unit: "g" },
                        { id: "sodium", label: "鈉", unit: "mg" },
                      ].map((item) => (
                        <div key={item.id} className="relative flex flex-col">
                          <label
                            className={`text-[11px] font-bold mb-1.5 uppercase tracking-wider ${item.label.includes(" ") ? "text-slate-400" : "text-slate-600"}`}
                          >
                            {item.label}
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              name={item.id}
                              value={formData.nutrition_fact?.[item.id] || ""}
                              onChange={handleNutritionChange}
                              step="any"
                              min="0"
                              className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-right font-mono font-bold text-sm focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                            />
                            <span className="absolute right-4 text-[10px] text-slate-400 font-bold pointer-events-none uppercase">
                              {item.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 右側：標籤預覽 */}
                    <div className="flex flex-col items-center justify-center bg-slate-100 p-8 rounded-3xl border border-slate-200/60 shadow-inner w-full lg:w-[320px]">
                      <NutritionLabel nutritionData={formData.nutrition_fact} />
                    </div>
                  </div>
                </div>

                {/* 區塊三：其他法規資訊 */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                  <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                    3. 食安管理資訊
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        過敏原宣告
                      </label>
                      <input
                        type="text"
                        name="allergen_info"
                        value={formData.allergen_info}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                        placeholder="例如：含有大豆、牛奶及其製品"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        保存期限
                      </label>
                      <input
                        type="text"
                        name="storage_life"
                        value={formData.storage_life}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                        placeholder="12個月"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        產地
                      </label>
                      <input
                        type="text"
                        name="origin"
                        value={formData.origin}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                        placeholder="台灣"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 bg-white/80 backdrop-blur-md shrink-0 flex justify-end gap-4 z-10">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 text-sm font-bold rounded-xl shadow-sm transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 text-white bg-[#1f4e78] hover:bg-blue-900 text-sm font-bold rounded-xl shadow-md hover:-translate-y-0.5 transition-all"
                >
                  儲存物料資料
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
