import React, { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Search,
  ArrowLeft,
  Database,
  FlaskConical,
  Calculator,
  RefreshCw,
  Trash2,
  Droplets,
  Activity,
  CheckCircle2,
  Plus,
  Edit2,
  ShieldCheck, // TFDA 標示圖示
  PenTool, // 手動標示圖示
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useAuthStore } from "./store/authStore";
import HistoricalPriceChart from "./components/HistoricalPriceChart";

// ==========================================
// 🌟 輔助函數
// ==========================================
const formatDisplayNum = (val) => {
  if (val === null || val === undefined || val === "") return null;
  const num = parseFloat(val);
  return isNaN(num) ? "0" : parseFloat(num.toFixed(2)).toString();
};

// 🌟 提取成分中的過敏原並與手動勾選的聯集
const getMergedAllergens = (manualAllergens = [], ingredientsArray = []) => {
  let merged = new Set(manualAllergens);
  ingredientsArray.forEach((ing) => {
    if (ing.allergen_info) {
      const ingAllergens =
        typeof ing.allergen_info === "string"
          ? ing.allergen_info
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : ing.allergen_info;
      ingAllergens.forEach((a) => merged.add(a));
    }
  });
  return Array.from(merged);
};

// 提取純成分自帶的過敏原 (用來判斷某個選項是否由成分強制勾選)
const getIngredientsOnlyAllergens = (ingredientsArray = []) => {
  let merged = new Set();
  ingredientsArray.forEach((ing) => {
    if (ing.allergen_info) {
      const ingAllergens =
        typeof ing.allergen_info === "string"
          ? ing.allergen_info
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : ing.allergen_info;
      ingAllergens.forEach((a) => merged.add(a));
    }
  });
  return Array.from(merged);
};

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

const STORAGE_OPTIONS = [
  { value: "ROOM_TEMP", label: "常溫" },
  { value: "REFRIGERATED", label: "冷藏" },
  { value: "FROZEN", label: "冷凍" },
];

const DIETARY_OPTIONS = [
  { value: "MEAT", label: "葷食" },
  { value: "VEGAN", label: "全素" },
  { value: "LACTO", label: "奶素" },
  { value: "OVO", label: "蛋素" },
  { value: "LACTO_OVO", label: "蛋奶素" },
  { value: "FIVE_PUNGENT", label: "植物五辛素" },
];

const ALLERGEN_OPTIONS = [
  { value: "CRUSTACEAN", label: "甲殼類" },
  { value: "MANGO", label: "芒果" },
  { value: "PEANUT", label: "花生" },
  { value: "MILK", label: "牛奶、羊奶" },
  { value: "EGG", label: "蛋" },
  { value: "NUT", label: "堅果類" },
  { value: "SESAME", label: "芝麻" },
  { value: "GLUTEN", label: "含麩質之穀物" },
  { value: "SOY", label: "大豆" },
  { value: "FISH", label: "魚類" },
  { value: "SULFITE", label: "亞硫酸鹽類" },
];

const getTypeLabel = (typeValue) => {
  const target = TYPE_OPTIONS.find((opt) => opt.value === typeValue);
  return target ? target.label : typeValue;
};

const getPhaseLabel = (phaseValue) => {
  const target = PHASE_OPTIONS.find((opt) => opt.value === phaseValue);
  return target ? target.label : phaseValue;
};

const getStorageLabel = (val) => {
  const target = STORAGE_OPTIONS.find((opt) => opt.value === val);
  return target ? target.label : val || "常溫";
};

const getDietaryLabel = (val) => {
  const target = DIETARY_OPTIONS.find((opt) => opt.value === val);
  return target ? target.label : "未設定";
};

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

const NutritionLabel = ({ nutritionData }) => {
  const data = nutritionData || {};

  const formatVal = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? "0" : parseFloat(num.toFixed(1)).toString();
  };
  const formatInt = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? "0" : Math.round(num).toString();
  };

  return (
    <div className="w-[240px] border-[3px] border-black p-2 font-sans text-black bg-white mx-auto shadow-sm">
      <h2 className="text-2xl font-black text-center mb-1 tracking-widest">
        營養標示
      </h2>
      <table className="w-full text-sm font-bold text-right border-collapse mt-2">
        <thead>
          <tr className="border-b-[3px] border-black border-t-[3px]">
            <th className="font-bold text-left py-1 w-[50%]"></th>
            <th className="font-bold py-1 w-[50%] text-center">每100克/毫升</th>
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

const calculateNutritionFromBOMs = (boms) => {
  const calculated = {
    energy_kcal: 0,
    protein: 0,
    fat: 0,
    saturated_fat: 0,
    trans_fat: 0,
    carbs: 0,
    sugar: 0,
    sodium: 0,
  };
  if (!boms || boms.length === 0) return calculated;

  boms.forEach((bom) => {
    if (
      ["RAW", "SEMI"].includes(bom.child_type) &&
      bom.child_nutrition_fact &&
      bom.is_active !== false
    ) {
      const baseQty = parseFloat(bom.base_quantity) || 1;
      const requiredQty = parseFloat(bom.quantity_required) || 0;
      const ratio = requiredQty / baseQty;
      Object.keys(calculated).forEach((k) => {
        const val = parseFloat(bom.child_nutrition_fact[k]) || 0;
        calculated[k] += val * ratio;
      });
    }
  });

  const formattedNutrition = {};
  Object.keys(calculated).forEach((k) => {
    formattedNutrition[k] = parseFloat(calculated[k].toFixed(2)).toString();
  });
  return formattedNutrition;
};

// 計算總和營養素 (給成分加總用)
const calculateTotalNutrition = (ingredients) => {
  const calc = {
    energy_kcal: 0,
    protein: 0,
    fat: 0,
    saturated_fat: 0,
    trans_fat: 0,
    carbs: 0,
    sugar: 0,
    sodium: 0,
  };
  if (!ingredients || ingredients.length === 0) return emptyNutrition;

  ingredients.forEach((ing) => {
    Object.keys(calc).forEach((k) => {
      calc[k] += parseFloat(ing.nutrition_fact?.[k]) || 0;
    });
  });

  const formatted = {};
  Object.keys(calc).forEach((k) => {
    formatted[k] = parseFloat(calc[k].toFixed(2)).toString();
  });
  return formatted;
};

const isNutritionEmpty = (nutData) => {
  if (!nutData || Object.keys(nutData).length === 0) return true;
  return Object.values(nutData).every((v) => {
    const num = parseFloat(v);
    return isNaN(num) || num === 0;
  });
};

export default function MaterialPage() {
  const isRD = useAuthStore((state) => state.isRD());
  const navigate = useNavigate();

  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialFormData = {
    code: "",
    name: "",
    english_name: "",
    phase: "IN_DEV",
    type: "RAW",
    unit: "KG",
    pack_capacity: "",
    storage_method: "ROOM_TEMP",
    dietary_type: "",
    allergen_info: [], // 包含手動選擇與成分自帶的聯集
    manual_allergen_info: [], // 專門紀錄使用者手動勾選的過敏原
    storage_life: "",
    description: "",
    is_active: true,
    nutrition_fact: emptyNutrition,
    qc_dilution_ratio: "",
    qc_brix_min: "",
    qc_brix_max: "",
    qc_salt_min: "",
    qc_salt_max: "",
    qc_moisture_max: "",
    qc_microbiology: [],
    boms: [],
    ingredients: [],
    product_registration_no: "",
    origin: "",
  };
  const [formData, setFormData] = useState(initialFormData);

  // 成分搜尋相關 States
  const [ingSearchTerm, setIngSearchTerm] = useState("");
  const [ingSearchResults, setIngSearchResults] = useState([]);
  const [isIngDropdownOpen, setIsIngDropdownOpen] = useState(false);
  const ingSearchRef = useRef(null);

  // 新增/編輯成分 Dialog States
  const initialIngForm = {
    name: "",
    source_type: "MANUAL",
    tfda_code: "",
    nutrition_fact: emptyNutrition,
    allergen_info: [],
    is_additive: false,
    legal_limit_percent: "",
    additive_license_no: "",
    license_valid_date: "",
  };
  const [ingModalOpen, setIngModalOpen] = useState(false);
  const [editingIngId, setEditingIngId] = useState(null);
  const [ingForm, setIngForm] = useState(initialIngForm);
  const [ingTfdaQuery, setIngTfdaQuery] = useState("");
  const [ingTfdaResults, setIngTfdaResults] = useState([]);
  const [isIngTfdaSearching, setIsIngTfdaSearching] = useState(false);
  const [isIngTfdaDropdownOpen, setIsIngTfdaDropdownOpen] = useState(false);
  const ingTfdaRef = useRef(null);

  const [viewingMaterial, setViewingMaterial] = useState(null);

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
      if (ingSearchRef.current && !ingSearchRef.current.contains(event.target))
        setIsIngDropdownOpen(false);
      if (ingTfdaRef.current && !ingTfdaRef.current.contains(event.target))
        setIsIngTfdaDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isModalOpen || viewingMaterial || ingModalOpen)
      document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isModalOpen, viewingMaterial, ingModalOpen]);

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
      nutrition_fact: { ...prev.nutrition_fact, [name]: value },
    }));
  };

  const handleAddMicrobio = () => {
    setFormData((prev) => ({
      ...prev,
      qc_microbiology: [
        ...(prev.qc_microbiology || []),
        { item: "", limit: "" },
      ],
    }));
  };

  const handleUpdateMicrobio = (index, field, value) => {
    setFormData((prev) => {
      const newMicro = [...(prev.qc_microbiology || [])];
      newMicro[index][field] = value;
      return { ...prev, qc_microbiology: newMicro };
    });
  };

  const handleRemoveMicrobio = (index) => {
    setFormData((prev) => {
      const newMicro = [...(prev.qc_microbiology || [])];
      newMicro.splice(index, 1);
      return { ...prev, qc_microbiology: newMicro };
    });
  };

  const handleQuickDilution = (ratio) => {
    setFormData((prev) => ({ ...prev, qc_dilution_ratio: ratio }));
  };

  const autoDetectAllergens = (foodName) => {
    const detected = [];
    if (/蝦|蟹/.test(foodName)) detected.push("CRUSTACEAN");
    if (/芒果/.test(foodName)) detected.push("MANGO");
    if (/花生/.test(foodName)) detected.push("PEANUT");
    if (/牛|奶|起司|乳/.test(foodName)) detected.push("MILK");
    if (/蛋/.test(foodName)) detected.push("EGG");
    if (/核桃|腰果|杏仁|堅果|夏威夷豆/.test(foodName)) detected.push("NUT");
    if (/芝麻/.test(foodName)) detected.push("SESAME");
    if (/麥|麵|麩/.test(foodName)) detected.push("GLUTEN");
    if (/豆|醬油/.test(foodName)) detected.push("SOY");
    if (/魚/.test(foodName)) detected.push("FISH");
    return detected;
  };

  // 搜尋現有成分 (Debounce 風格)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (ingSearchTerm.trim()) {
        try {
          const res = await fetchWithAuth(
            `/api/ingredients?search=${encodeURIComponent(ingSearchTerm)}`,
          );
          if (res.ok) {
            const json = await res.json();
            setIngSearchResults(json.results || json.data || json || []);
            setIsIngDropdownOpen(true);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        setIngSearchResults([]);
        setIsIngDropdownOpen(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [ingSearchTerm]);

  // 🌟 新增成分到清單中，並即時連動更新過敏原與營養素
  const handleAddIngredientToMaterial = (ingredient) => {
    if (formData.ingredients.find((i) => i.id === ingredient.id)) {
      showAlert("提示", "此成分已在清單中", "info");
      return;
    }
    const updatedIngredients = [...formData.ingredients, ingredient];
    // 使用手動勾選的 + 所有成分自帶的
    const newAllergens = getMergedAllergens(
      formData.manual_allergen_info,
      updatedIngredients,
    );

    setFormData((prev) => ({
      ...prev,
      ingredients: updatedIngredients,
      allergen_info: newAllergens,
      nutrition_fact:
        prev.type === "RAW"
          ? calculateTotalNutrition(updatedIngredients)
          : prev.nutrition_fact,
    }));
    setIngSearchTerm("");
    setIsIngDropdownOpen(false);
  };

  // 🌟 移除成分，並「即時解除」該成分附帶的過敏原 (若非手動勾選)
  const handleRemoveIngredientFromMaterial = (ingId) => {
    const updatedIngredients = formData.ingredients.filter(
      (i) => i.id !== ingId,
    );
    // 重算聯集：使用手動勾選的 + "剩餘"成分自帶的
    const newAllergens = getMergedAllergens(
      formData.manual_allergen_info,
      updatedIngredients,
    );

    setFormData((prev) => ({
      ...prev,
      ingredients: updatedIngredients,
      allergen_info: newAllergens,
      nutrition_fact:
        prev.type === "RAW"
          ? calculateTotalNutrition(updatedIngredients)
          : prev.nutrition_fact,
    }));
  };

  // 🌟 原物料層級：手動勾選過敏原
  const handleManualAllergenChange = (e, allergenValue) => {
    const isChecked = e.target.checked;
    setFormData((prev) => {
      let newManualAllergens = [...prev.manual_allergen_info];
      if (isChecked) {
        newManualAllergens.push(allergenValue);
      } else {
        newManualAllergens = newManualAllergens.filter(
          (v) => v !== allergenValue,
        );
      }

      // 畫面顯示的永遠是聯集 (手動 + 成分自帶)
      const newAllergenInfo = getMergedAllergens(
        newManualAllergens,
        prev.ingredients,
      );

      return {
        ...prev,
        manual_allergen_info: newManualAllergens,
        allergen_info: newAllergenInfo,
      };
    });
  };

  const handleOpenIngModal = (ingredientToEdit = null) => {
    if (ingredientToEdit) {
      setEditingIngId(ingredientToEdit.id);
      const parsedAllergens = ingredientToEdit.allergen_info
        ? ingredientToEdit.allergen_info.split(",").map((s) => s.trim())
        : [];
      setIngForm({
        name: ingredientToEdit.name,
        source_type: ingredientToEdit.source_type || "MANUAL",
        tfda_code: ingredientToEdit.tfda_code || "",
        nutrition_fact: ingredientToEdit.nutrition_fact || emptyNutrition,
        allergen_info: parsedAllergens,
        is_additive: ingredientToEdit.is_additive || false,
        legal_limit_percent:
          ingredientToEdit.legal_limit_percent != null
            ? parseFloat(ingredientToEdit.legal_limit_percent).toString()
            : "",
        additive_license_no: ingredientToEdit.additive_license_no || "",
        license_valid_date: ingredientToEdit.license_valid_date || "",
      });
      setIngTfdaQuery("");
    } else {
      setEditingIngId(null);
      setIngForm({ ...initialIngForm, name: ingSearchTerm.trim() });
      setIngTfdaQuery(ingSearchTerm.trim());
    }
    setIngTfdaResults([]);
    setIsIngDropdownOpen(false);
    setIngSearchTerm("");
    setIngModalOpen(true);
  };

  const handleIngTfdaSearch = async () => {
    const query = (ingTfdaQuery || ingForm.name).trim();
    if (!query) return;
    setIsIngTfdaSearching(true);
    try {
      const res = await fetchWithAuth(
        `/api/materials/tfda_lookup?q=${encodeURIComponent(query)}`,
      );
      if (res.ok) {
        const json = await res.json();
        setIngTfdaResults(json.data || []);
        setIsIngTfdaDropdownOpen(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsIngTfdaSearching(false);
    }
  };

  // 🌟 將選定的 TFDA 名稱填回 Search Bar
  const handleApplyIngTfdaResult = (item) => {
    const autoAllergens = autoDetectAllergens(item.name || "");
    const mergedAllergens = Array.from(
      new Set([...ingForm.allergen_info, ...autoAllergens]),
    );

    setIngTfdaQuery(item.name);

    setIngForm((prev) => ({
      ...prev,
      source_type: "TFDA",
      tfda_code: item.code,
      allergen_info: mergedAllergens,
      nutrition_fact: {
        energy_kcal: item.energy_kcal || "0",
        protein: item.protein || "0",
        fat: item.fat || "0",
        saturated_fat: item.saturated_fat || "0",
        trans_fat: item.trans_fat || "0",
        carbs: item.carbs || "0",
        sugar: item.sugar || "0",
        sodium: item.sodium || "0",
      },
    }));
    setIsIngTfdaDropdownOpen(false);
  };

  // 🌟 儲存成分 (支援 POST 新增 與 PUT 編輯)
  const handleSaveIngredient = async (e) => {
    e.preventDefault();
    if (!ingForm.name) return showAlert("警告", "請填寫成分名稱", "warning");

    const payload = {
      ...ingForm,
      allergen_info: ingForm.allergen_info.join(","),
      legal_limit_percent: ingForm.is_additive
        ? ingForm.legal_limit_percent
        : null,
      additive_license_no: ingForm.is_additive
        ? ingForm.additive_license_no
        : "",
      license_valid_date:
        ingForm.is_additive && ingForm.license_valid_date
          ? ingForm.license_valid_date
          : null,
    };

    const method = editingIngId ? "PUT" : "POST";
    const url = editingIngId
      ? `/api/ingredients/${editingIngId}`
      : "/api/ingredients";

    try {
      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error("儲存成分失敗，請確認名稱是否重複或資料正確");

      const json = await res.json();
      const savedIng = json.data || json;

      if (editingIngId) {
        const updatedIngredients = formData.ingredients.map((i) =>
          i.id === editingIngId ? savedIng : i,
        );
        const newAllergens = getMergedAllergens(
          formData.manual_allergen_info,
          updatedIngredients,
        );

        setFormData((prev) => ({
          ...prev,
          ingredients: updatedIngredients,
          allergen_info: newAllergens,
          nutrition_fact:
            prev.type === "RAW"
              ? calculateTotalNutrition(updatedIngredients)
              : prev.nutrition_fact,
        }));
        showAlert("成功", `已更新成分「${savedIng.name}」`, "success");
      } else {
        handleAddIngredientToMaterial(savedIng);
        showAlert(
          "成功",
          `已建立成分「${savedIng.name}」並加入清單`,
          "success",
        );
      }

      setIngModalOpen(false);
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    }
  };

  const handleRecalculateFromBOM = () => {
    if (!formData.boms || formData.boms.length === 0) {
      return showAlert(
        "無法展算",
        "此物料目前沒有設定下層 BOM 配方，無法計算。",
        "warning",
      );
    }
    const calcNutrition = calculateNutritionFromBOMs(formData.boms);
    setFormData((prev) => ({ ...prev, nutrition_fact: calcNutrition }));
    showAlert("展算成功", "已依據底層 BOM 比例覆蓋營養數值。", "success");
  };

  const handleOpenViewModal = (material) => {
    let displayNut = material.nutrition_fact || emptyNutrition;
    if (
      ["SEMI", "PRODUCT"].includes(material.type) &&
      isNutritionEmpty(displayNut)
    ) {
      displayNut = calculateNutritionFromBOMs(material.boms || []);
    }
    const extractedIngredients =
      material.ingredients?.map((i) => i.ingredient_detail) || [];
    setViewingMaterial({
      ...material,
      display_nutrition: displayNut,
      display_ingredients: extractedIngredients,
    });
  };

  const handleOpenAddModal = () => {
    if (!isRD)
      return showAlert("權限不足", "僅有研發部可以新增物料。", "warning");
    setEditingId(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (material) => {
    if (!isRD)
      return showAlert("權限不足", "僅有研發部可以編輯物料。", "warning");
    setEditingId(material.id);

    // 找出哪些是「純手動」勾選的，以保留使用者的操作
    const parsedIngredients =
      material.ingredients?.map((i) => i.ingredient_detail) || [];
    const dbAllergens = material.allergen_info
      ? material.allergen_info.split(",").map((s) => s.trim())
      : [];
    const ingAllergens = getIngredientsOnlyAllergens(parsedIngredients);

    // 手動過敏原 = 總共的過敏原 減去 成分自帶的過敏原
    const manualAllergens = dbAllergens.filter(
      (a) => !ingAllergens.includes(a),
    );

    let editNut = material.nutrition_fact || emptyNutrition;
    if (
      ["SEMI", "PRODUCT"].includes(material.type) &&
      isNutritionEmpty(editNut)
    ) {
      editNut = calculateNutritionFromBOMs(material.boms || []);
    }

    setFormData({
      ...material,
      english_name: material.english_name || "",
      pack_capacity:
        material.pack_capacity != null
          ? parseFloat(material.pack_capacity).toString()
          : "",
      storage_method: material.storage_method || "ROOM_TEMP",
      dietary_type: material.dietary_type || "",
      description: material.description || "",
      is_active: material.is_active !== false,
      product_registration_no: material.product_registration_no || "",
      allergen_info: dbAllergens,
      manual_allergen_info: manualAllergens, // 載入時復原手動紀錄
      nutrition_fact: editNut,
      ingredients: parsedIngredients,
      qc_dilution_ratio: material.qc_dilution_ratio || "",
      qc_brix_min:
        material.qc_brix_min != null
          ? parseFloat(material.qc_brix_min).toString()
          : "",
      qc_brix_max:
        material.qc_brix_max != null
          ? parseFloat(material.qc_brix_max).toString()
          : "",
      qc_salt_min:
        material.qc_salt_min != null
          ? parseFloat(material.qc_salt_min).toString()
          : "",
      qc_salt_max:
        material.qc_salt_max != null
          ? parseFloat(material.qc_salt_max).toString()
          : "",
      qc_moisture_max:
        material.qc_moisture_max != null
          ? parseFloat(material.qc_moisture_max).toString()
          : "",
      qc_microbiology: material.qc_microbiology || [],
      boms: material.boms || [],
      origin: material.origin || "",
    });

    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.code)
      return showAlert(
        "資料不完整",
        "請填寫必填欄位（代碼與名稱）。",
        "warning",
      );

    const isEditing = editingId !== null;
    showConfirm(
      "儲存確認",
      `確定要${isEditing ? "更新" : "新增"}物料「${formData.name}」嗎？`,
      async () => {
        closeDialog();
        let finalNutrition = formData.nutrition_fact;
        if (!["RAW", "SEMI", "PRODUCT"].includes(formData.type))
          finalNutrition = emptyNutrition;

        const payloadIngredients = formData.ingredients.map((i) => ({
          ingredient_id: i.id,
        }));

        const payload = {
          ...formData,
          dietary_type: formData.dietary_type || null,
          allergen_info: formData.allergen_info.join(","),
          nutrition_fact: finalNutrition,
          ingredients: payloadIngredients,
          pack_capacity:
            formData.type === "PACK" ? formData.pack_capacity : null,
        };

        const url = isEditing
          ? `/api/materials/${editingId}`
          : "/api/materials";
        const method = isEditing ? "PUT" : "POST";

        try {
          const response = await fetchWithAuth(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
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
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            物料與產品管理
          </h2>
        </div>
      </div>

      <div className="bg-blue-50/80 text-blue-800 text-sm p-4 rounded-2xl border border-blue-100/50 mb-4 shadow-sm">
        <p className="flex items-center gap-2 font-bold mb-1">
          <span className="text-lg">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700 font-medium">
          <li>檢視或維護原物料、半成品、成品、標籤以及包材資料。</li>
          <li>
            支援輸入過敏原資訊，點擊成分標籤可直接設定該成分是否為添加物與法定上限。
          </li>
          <li>
            原物料建檔支援國家 TFDA 資料檢索；半成品與成品{" "}
            <strong className="text-blue-700">
              預設自動依 BOM 配方展算營養素
            </strong>
            。
          </li>
        </ul>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-2 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <div className="relative w-full sm:w-72">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="搜尋代碼或名稱..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 w-full bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all"
            />
          </div>
          <div className="relative w-full sm:w-auto">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm cursor-pointer transition-all appearance-none"
            >
              <option value="">所有類型</option>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              size={18}
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
            >
              清除條件
            </button>
          )}
        </div>
        {isRD && (
          <button
            onClick={handleOpenAddModal}
            className="bg-[#007AFF] hover:bg-[#0056b3] text-white px-6 py-2.5 rounded-xl shadow-[0_2px_8px_rgba(0,122,255,0.3)] transition-all text-sm font-bold flex items-center gap-2 hover:-translate-y-0.5"
          >
            + 新增物料
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[11px] uppercase tracking-widest text-slate-400 font-black">
                <th className="p-5">代碼</th>
                <th className="p-5">名稱</th>
                <th className="p-5">類型</th>
                <th className="p-5">階段</th>
                <th className="p-5">預估成本</th>
                <th className="p-5 text-center">狀態</th>
                <th className="p-5 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="p-16 text-center text-slate-400 font-medium"
                  >
                    資料載入中...
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="p-16 text-center text-slate-400 font-medium"
                  >
                    找不到符合條件的資料
                  </td>
                </tr>
              ) : (
                currentData.map((mat) => (
                  <tr
                    key={mat.id}
                    className="hover:bg-blue-50/30 transition-colors duration-200 group"
                  >
                    <td className="p-4 font-mono font-semibold text-slate-500 text-xs">
                      {mat.code}
                    </td>
                    <td className="p-4 font-black text-slate-800">
                      {mat.name}
                      {mat.ingredients &&
                        mat.ingredients.some(
                          (i) => i.ingredient_detail?.is_additive,
                        ) && (
                          <span className="ml-2 bg-indigo-50 text-indigo-600 border border-indigo-200/60 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            含添加物
                          </span>
                        )}
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 inline-flex text-[11px] font-bold rounded-lg border bg-slate-50 text-slate-600 border-slate-200/80 shadow-sm">
                        {getTypeLabel(mat.type)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 inline-flex text-[11px] font-bold rounded-lg border shadow-sm ${mat.phase === "IN_DEV" ? "bg-amber-50 text-amber-700 border-amber-200/60" : "bg-emerald-50 text-emerald-700 border-emerald-200/60"}`}
                      >
                        {getPhaseLabel(mat.phase)}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-600">
                      {mat.estimated_cost != null
                        ? `$${formatDisplayNum(mat.estimated_cost)}`
                        : "-"}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center items-center">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shadow-sm ${mat.is_active ? "bg-emerald-400" : "bg-slate-300"}`}
                        ></span>
                      </div>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="flex w-full justify-center gap-2.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenViewModal(mat)}
                          className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all text-xs font-bold shadow-sm"
                        >
                          詳情
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(mat)}
                          className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-600 hover:text-white transition-all text-xs font-bold shadow-sm"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => handleDelete(mat.id, mat.name)}
                          className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-600 hover:text-white transition-all text-xs font-bold shadow-sm"
                        >
                          刪除
                        </button>
                        {isRD &&
                        mat.phase === "IN_DEV" &&
                        ["PRODUCT", "SEMI"].includes(mat.type) ? (
                          <button
                            onClick={() => navigate(`/bom-create/${mat.code}`)}
                            className="px-4 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-600 hover:text-white transition-all text-xs font-bold shadow-sm"
                          >
                            調整配方
                          </button>
                        ) : (
                          <div className="w-[88px]"></div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredMaterials.length > 0 && (
          <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-200/60 flex items-center justify-between">
            <div className="text-xs font-bold text-slate-400">
              顯示 {startIndex + 1} -{" "}
              {Math.min(startIndex + itemsPerPage, filteredMaterials.length)}{" "}
              筆，共 {filteredMaterials.length} 筆
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 shadow-sm transition-all"
              >
                上一頁
              </button>
              <div className="flex items-center justify-center px-4 text-xs font-black text-slate-700">
                {currentPage} / {totalPages}
              </div>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 shadow-sm transition-all"
              >
                下一頁
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 🌟 詳情 Pop up */}
      {/* ========================================================= */}
      {viewingMaterial && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200/50">
            <div className="p-6 border-b border-slate-200/60 flex justify-between items-center bg-white/90 backdrop-blur-md shrink-0 z-10">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <FlaskConical className="text-blue-500" size={28} />{" "}
                {viewingMaterial.name}
              </h3>
              <button
                onClick={() => setViewingMaterial(null)}
                className="text-slate-400 hover:text-slate-700 text-3xl leading-none outline-none transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 md:p-10 pb-16 overflow-y-auto flex-1 custom-scrollbar">
              <div
                className={`grid grid-cols-1 ${viewingMaterial.type !== "PACK" ? "lg:grid-cols-12" : ""} gap-8`}
              >
                <div
                  className={`${viewingMaterial.type !== "PACK" ? "lg:col-span-8" : ""} space-y-6`}
                >
                  <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                    <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                      基本資訊
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
                      <div className="col-span-1 md:col-span-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                          英文名稱
                        </span>
                        <span className="text-sm font-bold text-slate-800">
                          {viewingMaterial.english_name || "-"}
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
                          保存方式
                        </span>
                        <span className="text-sm font-bold text-slate-800">
                          {getStorageLabel(viewingMaterial.storage_method)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                          素食類別
                        </span>
                        <span className="text-sm font-bold text-slate-800">
                          {getDietaryLabel(viewingMaterial.dietary_type)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                          啟用狀態
                        </span>
                        <span
                          className={`text-sm font-bold ${viewingMaterial.is_active ? "text-emerald-600" : "text-slate-400"}`}
                        >
                          {viewingMaterial.is_active ? "啟用中" : "已停用"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                          預估成本
                        </span>
                        <span className="text-sm font-bold text-slate-800 font-mono">
                          $
                          {formatDisplayNum(
                            viewingMaterial.estimated_cost ?? 0,
                          )}
                        </span>
                      </div>
                      {viewingMaterial.type === "PACK" &&
                        viewingMaterial.pack_capacity && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                              包材容量 / 淨重
                            </span>
                            <span className="text-sm font-bold text-slate-800 font-mono">
                              {formatDisplayNum(viewingMaterial.pack_capacity)}{" "}
                              KG
                            </span>
                          </div>
                        )}
                    </div>
                  </div>

                  <HistoricalPriceChart
                    materialId={viewingMaterial.id}
                    materialType={viewingMaterial.type}
                  />

                  {viewingMaterial.type !== "PACK" && (
                    <>
                      <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <h4 className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                          成分展開清單
                        </h4>
                        {viewingMaterial.display_ingredients &&
                        viewingMaterial.display_ingredients.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {viewingMaterial.display_ingredients.map(
                              (ing, idx) => (
                                <span
                                  key={idx}
                                  className="bg-amber-50 text-amber-900 border border-amber-200 pl-3 pr-2 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2"
                                >
                                  {/* 成分名稱 */}
                                  <span>{ing.name}</span>

                                  {/* 標籤群組 */}
                                  <div className="flex items-center gap-1.5 border-l border-amber-200/80 pl-2 ml-0.5">
                                    {/* 來源標籤 */}
                                    {ing.source_type === "TFDA" ? (
                                      <span className="text-[10px] bg-blue-100/80 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md tracking-wider">
                                        TFDA
                                      </span>
                                    ) : (
                                      <span className="text-[10px] bg-slate-200/70 text-slate-600 border border-slate-300 px-1.5 py-0.5 rounded-md tracking-wider">
                                        手動
                                      </span>
                                    )}

                                    {/* 添加物標籤 */}
                                    {ing.is_additive && (
                                      <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-md tracking-wider">
                                        添加物
                                      </span>
                                    )}
                                  </div>
                                </span>
                              ),
                            )}
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-slate-400">
                            未設定任何成分
                          </span>
                        )}
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                          <Activity size={14} /> 廠內品管與檢驗標準
                        </h4>
                        <div className="flex flex-col gap-4 mb-6">
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              檢測稀釋比例
                            </span>
                            <span className="text-lg font-black text-slate-800">
                              {viewingMaterial.qc_dilution_ratio || "-"}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col justify-center">
                              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                                Brix (糖度) %
                              </span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-lg font-black text-blue-700 font-mono">
                                  {formatDisplayNum(
                                    viewingMaterial.qc_brix_min,
                                  ) || "-"}
                                </span>
                                <span className="text-xs font-bold text-blue-400">
                                  ~
                                </span>
                                <span className="text-lg font-black text-blue-700 font-mono">
                                  {formatDisplayNum(
                                    viewingMaterial.qc_brix_max,
                                  ) || "-"}
                                </span>
                              </div>
                            </div>
                            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-center">
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">
                                Salt (鹽度) %
                              </span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-lg font-black text-emerald-700 font-mono">
                                  {formatDisplayNum(
                                    viewingMaterial.qc_salt_min,
                                  ) || "-"}
                                </span>
                                <span className="text-xs font-bold text-emerald-400">
                                  ~
                                </span>
                                <span className="text-lg font-black text-emerald-700 font-mono">
                                  {formatDisplayNum(
                                    viewingMaterial.qc_salt_max,
                                  ) || "-"}
                                </span>
                              </div>
                            </div>
                            <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-100 flex flex-col justify-center">
                              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">
                                水分上限 %
                              </span>
                              <div className="flex items-baseline gap-1">
                                {viewingMaterial.qc_moisture_max ? (
                                  <>
                                    <span className="text-sm font-bold text-sky-500 mr-1">
                                      {"<"}
                                    </span>
                                    <span className="text-lg font-black text-sky-700 font-mono">
                                      {formatDisplayNum(
                                        viewingMaterial.qc_moisture_max,
                                      )}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-lg font-black text-slate-400">
                                    -
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                          <span className="text-[10px] uppercase font-bold text-slate-400 mb-3 block">
                            微生物與其他法定檢驗
                          </span>
                          {viewingMaterial.qc_microbiology &&
                          viewingMaterial.qc_microbiology.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {viewingMaterial.qc_microbiology.map(
                                (item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start gap-3 bg-white border border-slate-200 px-4 py-3 rounded-xl shadow-sm"
                                  >
                                    <CheckCircle2
                                      size={18}
                                      className="text-emerald-500 shrink-0 mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-bold text-slate-700 text-sm break-words mb-1.5">
                                        {item.item}
                                      </div>
                                      <div className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 inline-block break-words">
                                        <span className="text-[10px] text-indigo-400 uppercase tracking-wider mr-1.5 font-bold">
                                          檢驗標準
                                        </span>
                                        {item.limit}
                                      </div>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            <div className="text-sm font-medium text-slate-400 bg-slate-50 rounded-xl p-4 text-center border border-dashed border-slate-200">
                              未設定微生物或法定檢驗項目
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                          法規與食安
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                          <div className="col-span-2 md:col-span-3">
                            <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 block">
                              過敏原宣告
                            </span>
                            {viewingMaterial.allergen_info ? (
                              <div className="flex flex-wrap gap-2">
                                {viewingMaterial.allergen_info
                                  .split(",")
                                  .map((val, idx) => {
                                    const cleanVal = val.trim();
                                    const match = ALLERGEN_OPTIONS.find(
                                      (opt) => opt.value === cleanVal,
                                    );
                                    return (
                                      <span
                                        key={idx}
                                        className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"
                                      >
                                        {match ? match.label : cleanVal}
                                      </span>
                                    );
                                  })}
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-slate-400">
                                無
                              </span>
                            )}
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
                    </>
                  )}

                  <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                    <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                      備註與描述
                    </h4>
                    <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                      {viewingMaterial.description || ""}
                    </p>
                  </div>
                </div>

                {viewingMaterial.type !== "PACK" && (
                  <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 w-full text-center border-b border-slate-100 pb-2">
                        法規營養標示
                      </h4>
                      <NutritionLabel
                        nutritionData={viewingMaterial.display_nutrition}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 🌟 新增/編輯 Material Modal */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200/50">
            <div className="p-6 border-b border-slate-200/60 flex justify-between items-center bg-white/90 backdrop-blur-md z-10 shrink-0">
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
              <div className="p-6 md:p-10 pb-16 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                    <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest">
                      基本資訊
                    </h4>
                    <div className="flex items-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          name="is_active"
                          checked={formData.is_active}
                          onChange={handleInputChange}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        <span
                          className={`ml-2 text-[11px] font-bold uppercase tracking-wider ${formData.is_active ? "text-emerald-600" : "text-slate-400"}`}
                        >
                          {formData.is_active ? "啟用中" : "已停用"}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
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
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-mono disabled:bg-slate-100 text-sm font-bold text-slate-800 transition-all shadow-sm"
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
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                        placeholder="中文名稱"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        英文名稱
                      </label>
                      <input
                        type="text"
                        name="english_name"
                        value={formData.english_name}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                        placeholder="英文名稱 (選填)"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        類型
                      </label>
                      <div className="relative">
                        <select
                          name="type"
                          value={formData.type}
                          onChange={handleInputChange}
                          className="w-full pl-4 pr-10 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-sm font-bold text-slate-800 cursor-pointer transition-all shadow-sm appearance-none"
                        >
                          {TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                          size={18}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        使用階段
                      </label>
                      <div className="relative">
                        <select
                          name="phase"
                          value={formData.phase}
                          onChange={handleInputChange}
                          className="w-full pl-4 pr-10 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-sm font-bold text-slate-800 cursor-pointer transition-all shadow-sm appearance-none"
                        >
                          {PHASE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                          size={18}
                        />
                      </div>
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
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                        placeholder="KG"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        保存方式 <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          name="storage_method"
                          value={formData.storage_method}
                          onChange={handleInputChange}
                          className="w-full pl-4 pr-10 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-sm font-bold text-slate-800 cursor-pointer transition-all shadow-sm appearance-none"
                        >
                          {STORAGE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                          size={18}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        素食類別
                      </label>
                      <div className="relative">
                        <select
                          name="dietary_type"
                          value={formData.dietary_type}
                          onChange={handleInputChange}
                          className="w-full pl-4 pr-10 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-sm font-bold text-slate-800 cursor-pointer transition-all shadow-sm appearance-none"
                        >
                          <option value="">未設定</option>
                          {DIETARY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                          size={18}
                        />
                      </div>
                    </div>
                    {formData.type === "PACK" && (
                      <div className="animate-in fade-in">
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                          包材容量 / 淨重 (KG){" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          name="pack_capacity"
                          value={formData.pack_capacity}
                          onChange={handleInputChange}
                          required={formData.type === "PACK"}
                          className="w-full px-4 py-3 border border-indigo-300 bg-indigo-50 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                          placeholder="例如 0.5"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {["RAW", "SEMI", "PRODUCT"].includes(formData.type) && (
                  <>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative overflow-visible">
                      <h4 className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                        成分展開清單
                        <span className="text-xs font-medium text-slate-400 normal-case tracking-normal">
                          ※ 點擊成分標籤可編輯添加物與營養素
                        </span>
                      </h4>
                      <div className="mb-5 flex flex-wrap gap-2">
                        {formData.ingredients.map((ing) => (
                          <span
                            key={ing.id}
                            className="bg-amber-50 text-amber-900 border border-amber-200 pl-3 pr-1 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 group transition-all hover:shadow-md"
                          >
                            <span
                              className="cursor-pointer hover:underline flex items-center gap-2"
                              onClick={() => handleOpenIngModal(ing)}
                              title="點擊編輯成分"
                            >
                              <span>{ing.name}</span>

                              {/* 標籤群組 */}
                              <div className="flex items-center gap-1.5 border-l border-amber-200/80 pl-2">
                                {ing.source_type === "TFDA" ? (
                                  <span className="text-[10px] bg-blue-100/80 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md tracking-wider">
                                    TFDA
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-slate-200/70 text-slate-600 border border-slate-300 px-1.5 py-0.5 rounded-md tracking-wider">
                                    手動
                                  </span>
                                )}

                                {ing.is_additive && (
                                  <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-md tracking-wider">
                                    添加物
                                  </span>
                                )}
                              </div>
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveIngredientFromMaterial(ing.id)
                              }
                              className="text-amber-400 hover:text-red-500 hover:bg-amber-100 rounded p-1 transition-colors ml-1"
                              title="移除成分"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="relative" ref={ingSearchRef}>
                        <div className="flex gap-3">
                          <div className="relative flex-1">
                            <Search
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                              size={16}
                            />
                            <input
                              type="text"
                              value={ingSearchTerm}
                              onChange={(e) => setIngSearchTerm(e.target.value)}
                              placeholder="搜尋並加入成分 (名稱或 TFDA 代碼)..."
                              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 text-sm font-bold text-slate-800 transition-all shadow-sm"
                            />
                          </div>
                        </div>
                        {isIngDropdownOpen && (
                          <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl max-h-60 overflow-y-auto z-20 divide-y divide-slate-100">
                            {ingSearchResults.length > 0 ? (
                              ingSearchResults.map((res) => (
                                <div
                                  key={res.id}
                                  onClick={() =>
                                    handleAddIngredientToMaterial(res)
                                  }
                                  className="p-4 hover:bg-amber-50 cursor-pointer transition-colors group flex justify-between items-center"
                                >
                                  <div>
                                    <div className="font-bold text-slate-800 text-sm group-hover:text-amber-700 mb-1 flex items-center gap-1.5">
                                      {/* 🌟 搜尋結果增加 Source 標示 */}
                                      {res.source_type === "TFDA" ? (
                                        <ShieldCheck
                                          size={14}
                                          className="text-blue-500"
                                          title="來自 TFDA 資料庫"
                                        />
                                      ) : (
                                        <PenTool
                                          size={14}
                                          className="text-slate-400"
                                          title="手動建檔"
                                        />
                                      )}
                                      {res.name}
                                      {res.is_additive && (
                                        <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                          添加物
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono">
                                      {res.tfda_code
                                        ? `TFDA: ${res.tfda_code}`
                                        : "手動建檔"}
                                    </div>
                                  </div>
                                  <Plus
                                    size={16}
                                    className="text-slate-300 group-hover:text-amber-500"
                                  />
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-center text-sm font-bold text-slate-500">
                                找不到相符的成分
                              </div>
                            )}

                            {ingSearchTerm.trim() && (
                              <div
                                onClick={() => handleOpenIngModal(null)}
                                className="p-4 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors text-center border-t border-blue-200"
                              >
                                <span className="text-sm font-black text-blue-700">
                                  ＋ 建立新成分「{ingSearchTerm}」
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative">
                      <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                        法規八大營養素 (每 100g)
                      </h4>

                      {["SEMI", "PRODUCT"].includes(formData.type) && (
                        <div className="mb-8 bg-purple-50/50 p-5 rounded-2xl border border-purple-100 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-inner">
                          <div className="text-purple-800 text-sm">
                            <span className="font-black block mb-1 tracking-wide flex items-center gap-2">
                              <Calculator size={16} /> 自動預設展算已啟用
                            </span>
                            已在背景使用最新 BOM
                            展算出營養素。若您手動修改過，可隨時點擊右側按鈕覆蓋為原本的展算基準值。
                          </div>
                          <button
                            type="button"
                            onClick={handleRecalculateFromBOM}
                            className="px-6 py-2.5 bg-white text-purple-700 border border-purple-200 font-bold rounded-xl hover:bg-purple-600 hover:text-white transition-all shadow-sm text-sm whitespace-nowrap flex items-center gap-2"
                          >
                            <RefreshCw size={16} /> 使用配方重新展算
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-start">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                          {[
                            { id: "energy_kcal", label: "熱量", unit: "大卡" },
                            { id: "protein", label: "蛋白質", unit: "g" },
                            { id: "fat", label: "脂肪", unit: "g" },
                            {
                              id: "saturated_fat",
                              label: " 飽和脂肪",
                              unit: "g",
                            },
                            { id: "trans_fat", label: " 反式脂肪", unit: "g" },
                            { id: "carbs", label: "碳水化合物", unit: "g" },
                            { id: "sugar", label: " 糖", unit: "g" },
                            { id: "sodium", label: "鈉", unit: "mg" },
                          ].map((item) => (
                            <div
                              key={item.id}
                              className="relative flex flex-col"
                            >
                              <label
                                className={`text-[11px] font-bold mb-1.5 uppercase tracking-wider ${item.label.includes(" ") ? "text-slate-400" : "text-slate-600"}`}
                              >
                                {item.label}
                              </label>
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  step="any"
                                  name={item.id}
                                  value={
                                    formData.nutrition_fact?.[item.id] || ""
                                  }
                                  onChange={handleNutritionChange}
                                  className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-right font-mono font-bold text-sm focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                                />
                                <span className="absolute right-4 text-[10px] text-slate-400 font-bold pointer-events-none uppercase">
                                  {item.unit}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col items-center justify-center bg-slate-100 p-8 rounded-3xl border border-slate-200/60 shadow-inner w-full lg:w-[320px]">
                          <div className="text-sm uppercase font-black text-slate-900 tracking-widest mb-4">
                            預覽
                          </div>
                          <NutritionLabel
                            nutritionData={formData.nutrition_fact}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                      <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest mb-5 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                        <Activity size={14} /> 廠內品管與檢驗標準
                      </h4>
                      <div className="flex flex-col gap-5 mb-8">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap min-w-max">
                            檢測稀釋比例
                          </label>
                          <input
                            type="text"
                            name="qc_dilution_ratio"
                            value={formData.qc_dilution_ratio}
                            onChange={handleInputChange}
                            className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                            placeholder="例如: 原液, 1:1"
                          />
                          <div className="flex flex-wrap gap-2">
                            {["原液", "1:1", "1:5", "1:10"].map((ratio) => (
                              <button
                                key={ratio}
                                type="button"
                                onClick={() => handleQuickDilution(ratio)}
                                className="px-3 py-2 bg-white border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:border-indigo-400 hover:text-indigo-600 transition-colors shadow-sm whitespace-nowrap"
                              >
                                {ratio}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 flex flex-col justify-start">
                            <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-3">
                              Brix (糖度) 範圍 %
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="any"
                                name="qc_brix_min"
                                value={formData.qc_brix_min}
                                onChange={handleInputChange}
                                placeholder="Min"
                                className="w-full px-3 py-2.5 bg-white border border-blue-200 rounded-xl text-center text-sm font-black text-blue-800 font-mono focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20 shadow-sm transition-all"
                              />
                              <span className="font-black text-blue-400">
                                ~
                              </span>
                              <input
                                type="number"
                                step="any"
                                name="qc_brix_max"
                                value={formData.qc_brix_max}
                                onChange={handleInputChange}
                                placeholder="Max"
                                className="w-full px-3 py-2.5 bg-white border border-blue-200 rounded-xl text-center text-sm font-black text-blue-800 font-mono focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20 shadow-sm transition-all"
                              />
                            </div>
                          </div>
                          <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 flex flex-col justify-start">
                            <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-3">
                              Salt (鹽度) 範圍 %
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="any"
                                name="qc_salt_min"
                                value={formData.qc_salt_min}
                                onChange={handleInputChange}
                                placeholder="Min"
                                className="w-full px-3 py-2.5 bg-white border border-emerald-200 rounded-xl text-center text-sm font-black text-emerald-800 font-mono focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 shadow-sm transition-all"
                              />
                              <span className="font-black text-emerald-400">
                                ~
                              </span>
                              <input
                                type="number"
                                step="any"
                                name="qc_salt_max"
                                value={formData.qc_salt_max}
                                onChange={handleInputChange}
                                placeholder="Max"
                                className="w-full px-3 py-2.5 bg-white border border-emerald-200 rounded-xl text-center text-sm font-black text-emerald-800 font-mono focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 shadow-sm transition-all"
                              />
                            </div>
                          </div>
                          <div className="bg-sky-50/50 p-5 rounded-2xl border border-sky-100 flex flex-col justify-start">
                            <label className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-3">
                              水分上限 %
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sky-500 pl-2">
                                {"<"}
                              </span>
                              <input
                                type="number"
                                step="any"
                                name="qc_moisture_max"
                                value={formData.qc_moisture_max}
                                onChange={handleInputChange}
                                placeholder="例如: 10"
                                className="w-full px-4 py-2.5 bg-white border border-sky-200 rounded-xl text-center text-base font-black text-sky-800 font-mono focus:outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-500/20 shadow-sm transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-6">
                        <div className="flex justify-between items-center mb-5">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            微生物與其他法定檢驗
                          </label>
                          <button
                            type="button"
                            onClick={handleAddMicrobio}
                            className="px-4 py-2 bg-[#007AFF]/10 text-[#007AFF] text-xs font-black rounded-xl hover:bg-[#007AFF]/20 transition-colors"
                          >
                            + 新增檢驗項目
                          </button>
                        </div>
                        <div className="space-y-3">
                          {formData.qc_microbiology?.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 animate-in slide-in-from-top-2"
                            >
                              <input
                                type="text"
                                value={item.item}
                                onChange={(e) =>
                                  handleUpdateMicrobio(
                                    idx,
                                    "item",
                                    e.target.value,
                                  )
                                }
                                placeholder="項目名稱 (如: 沙門氏菌)"
                                className="flex-[2] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                              />
                              <input
                                type="text"
                                value={item.limit}
                                onChange={(e) =>
                                  handleUpdateMicrobio(
                                    idx,
                                    "limit",
                                    e.target.value,
                                  )
                                }
                                placeholder="合格標準 (如: 陰性 / 10ppb)"
                                className="flex-[3] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-indigo-700 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveMicrobio(idx)}
                                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          ))}
                          {(!formData.qc_microbiology ||
                            formData.qc_microbiology.length === 0) && (
                            <div className="text-sm text-slate-400 font-bold py-6 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                              尚未設定任何檢驗項目
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                      <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                        法規與食安
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                        <div className="sm:col-span-2 lg:col-span-3">
                          <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase flex items-center gap-2">
                            法定過敏原 (由成分自動聯集，也可手動追加)
                            {formData.allergen_info.length > 0 && (
                              <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[9px]">
                                已選 {formData.allergen_info.length} 項
                              </span>
                            )}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {ALLERGEN_OPTIONS.map((allergen) => {
                              // 畫面顯示以聯集為主 (formData.allergen_info)
                              const isChecked = formData.allergen_info.includes(
                                allergen.value,
                              );
                              // 判斷這個選項是否是由 "成分" 帶來的
                              const isFromIngredients =
                                getIngredientsOnlyAllergens(
                                  formData.ingredients,
                                ).includes(allergen.value);

                              return (
                                <label
                                  key={allergen.value}
                                  className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all shadow-sm ${isChecked ? (isFromIngredients ? "bg-red-50 border-red-200 text-red-400 cursor-not-allowed" : "bg-red-50 border-red-500 text-red-700 cursor-pointer") : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"}`}
                                  title={
                                    isFromIngredients
                                      ? "此過敏原由成分自動帶入，無法手動取消"
                                      : ""
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={isChecked}
                                    disabled={isFromIngredients} // 如果是成分自帶的，禁止手動取消
                                    onChange={(e) =>
                                      handleManualAllergenChange(
                                        e,
                                        allergen.value,
                                      )
                                    }
                                  />
                                  {allergen.label}
                                </label>
                              );
                            })}
                          </div>
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
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
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
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                            placeholder="台灣"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                            產品登錄字號 (選填)
                          </label>
                          <input
                            type="text"
                            name="product_registration_no"
                            value={formData.product_registration_no}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                            placeholder="非必填"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                  <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                    備註與描述
                  </h4>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-medium text-slate-800 transition-all shadow-sm resize-none custom-scrollbar"
                    placeholder="請輸入任何配方、包裝或廠內注意事項..."
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-200/60 bg-white/90 backdrop-blur-md shrink-0 flex justify-end gap-4 z-10">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-3 text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 text-sm font-bold rounded-xl shadow-sm transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 text-white bg-[#007AFF] hover:bg-[#0056b3] text-sm font-bold rounded-xl shadow-[0_2px_8px_rgba(0,122,255,0.3)] hover:-translate-y-0.5 transition-all"
                >
                  儲存物料資料
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 🌟 新增/編輯「成分」 Sub-Modal (層級 60) - 添加物已移至此處 */}
      {/* ========================================================= */}
      {ingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <div className="p-5 border-b border-slate-200/60 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                {editingIngId ? (
                  <>
                    <Edit2 size={20} className="text-amber-500" /> 編輯成分
                  </>
                ) : (
                  "建立全新成分"
                )}
              </h3>
              <button
                onClick={() => setIngModalOpen(false)}
                className="text-slate-400 hover:text-red-500 text-3xl leading-none outline-none transition-colors"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSaveIngredient}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                    成分名稱 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ingForm.name}
                    onChange={(e) =>
                      setIngForm({ ...ingForm, name: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                    placeholder="例如: 麥芽糊精"
                  />
                </div>

                {/* 🌟 移轉自原物料的添加物設定 */}
                <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 relative">
                  <div className="flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ingForm.is_additive}
                        onChange={(e) =>
                          setIngForm({
                            ...ingForm,
                            is_additive: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      <span className="ml-3 text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                        此成分屬於「法定添加物」
                      </span>
                    </label>
                  </div>

                  {ingForm.is_additive && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in pt-4">
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-500 mb-1.5 uppercase">
                          法定上限 (%) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          required={ingForm.is_additive}
                          value={ingForm.legal_limit_percent}
                          onChange={(e) =>
                            setIngForm({
                              ...ingForm,
                              legal_limit_percent: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-sm font-bold text-slate-800"
                          placeholder="例如: 2.0"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-500 mb-1.5 uppercase">
                          許可證字號
                        </label>
                        <input
                          type="text"
                          value={ingForm.additive_license_no}
                          onChange={(e) =>
                            setIngForm({
                              ...ingForm,
                              additive_license_no: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-sm font-bold text-slate-800"
                          placeholder="衛部添製字第..."
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-indigo-500 mb-1.5 uppercase">
                          許可證效期
                        </label>
                        <input
                          type="date"
                          value={ingForm.license_valid_date || ""}
                          onChange={(e) =>
                            setIngForm({
                              ...ingForm,
                              license_valid_date: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-sm font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                  <label className="block text-[11px] font-bold text-blue-700 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                    <Database size={14} /> 從 TFDA 國家資料庫帶入數據 (選填)
                  </label>
                  <div className="relative" ref={ingTfdaRef}>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={ingTfdaQuery}
                        onChange={(e) => setIngTfdaQuery(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), handleIngTfdaSearch())
                        }
                        placeholder="搜尋 TFDA..."
                        className="flex-1 px-4 py-2.5 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 text-sm font-bold text-slate-800 transition-all shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={handleIngTfdaSearch}
                        disabled={isIngTfdaSearching}
                        className="px-6 py-2.5 bg-[#007AFF] text-white font-bold rounded-xl hover:bg-[#0056b3] transition-colors disabled:opacity-50 flex items-center gap-2 text-sm shadow-md"
                      >
                        {isIngTfdaSearching ? (
                          "搜尋中"
                        ) : (
                          <>
                            <Search size={16} /> 搜尋
                          </>
                        )}
                      </button>
                    </div>
                    {isIngTfdaDropdownOpen && ingTfdaResults.length > 0 && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl max-h-48 overflow-y-auto z-20 divide-y divide-slate-100">
                        {ingTfdaResults.map((res) => (
                          <div
                            key={res.code}
                            onClick={() => handleApplyIngTfdaResult(res)}
                            className="p-3 hover:bg-blue-50 cursor-pointer transition-colors group"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-slate-800 text-sm group-hover:text-blue-700">
                                {res.name}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                {res.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              熱: {res.energy_kcal} / 蛋: {res.protein} / 脂:{" "}
                              {res.fat} / 碳: {res.carbs}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-[11px] font-bold text-slate-500 mb-3 uppercase flex items-center gap-2">
                    法定過敏原 (可複選)
                    {ingForm.allergen_info.length > 0 && (
                      <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[9px]">
                        已選 {ingForm.allergen_info.length} 項
                      </span>
                    )}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ALLERGEN_OPTIONS.map((allergen) => {
                      const isChecked = ingForm.allergen_info.includes(
                        allergen.value,
                      );
                      return (
                        <label
                          key={`ing-${allergen.value}`}
                          className={`cursor-pointer px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all shadow-sm ${isChecked ? "bg-red-50 border-red-500 text-red-700" : "bg-white border-slate-200 text-slate-500"}`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked)
                                setIngForm((p) => ({
                                  ...p,
                                  allergen_info: [
                                    ...p.allergen_info,
                                    allergen.value,
                                  ],
                                }));
                              else
                                setIngForm((p) => ({
                                  ...p,
                                  allergen_info: p.allergen_info.filter(
                                    (val) => val !== allergen.value,
                                  ),
                                }));
                            }}
                          />
                          {allergen.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-[11px] font-bold text-slate-500 mb-3 uppercase">
                    營養標示 (每100g)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: "energy_kcal", label: "熱量" },
                      { id: "protein", label: "蛋白質" },
                      { id: "fat", label: "脂肪" },
                      { id: "saturated_fat", label: "飽和脂肪" },
                      { id: "trans_fat", label: "反式脂肪" },
                      { id: "carbs", label: "碳水" },
                      { id: "sugar", label: "糖" },
                      { id: "sodium", label: "鈉" },
                    ].map((item) => (
                      <div key={`ing-nut-${item.id}`}>
                        <label className="text-[10px] font-bold text-slate-400 mb-1 block">
                          {item.label}
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={ingForm.nutrition_fact[item.id]}
                          onChange={(e) =>
                            setIngForm((p) => ({
                              ...p,
                              nutrition_fact: {
                                ...p.nutrition_fact,
                                [item.id]: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-400 outline-none transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-slate-200/60 bg-slate-50 shrink-0 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIngModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 text-sm font-bold rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-white bg-amber-500 hover:bg-amber-600 text-sm font-bold rounded-xl shadow-md transition-colors flex items-center gap-2"
                >
                  {editingIngId ? "儲存更新" : "建立並加入"}
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
