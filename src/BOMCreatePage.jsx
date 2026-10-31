import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Trash2,
  Plus,
  Save,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  FlaskConical,
  CheckCircle2,
  Download,
  MousePointerClick,
  AlertCircle,
  GripVertical,
  Camera,
  Package,
  XCircle,
  Copy,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { TFDA_INGREDIENT_RULES } from "./utils/tfdaLegalRules";

// ==========================================
// 🌟 輔助函數
// ==========================================
const formatNum = (num, maxDecimals = 4) => {
  if (num === null || num === undefined || isNaN(num) || num === "") return "0";
  return parseFloat(Number(num).toFixed(maxDecimals)).toString();
};

const precise = {
  add: (a, b) => parseFloat((Number(a) + Number(b)).toPrecision(12)),
  mul: (a, b) => parseFloat((Number(a) * Number(b)).toPrecision(12)),
  div: (a, b) => parseFloat((Number(a) / Number(b)).toPrecision(12)),
};

const formatCurrency = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Number(num).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
};

const handleNumericTextInput = (val, allowDecimal = true) => {
  if (val === "") return "";
  let clean = val.replace(/[^0-9.]/g, "");
  if (!allowDecimal) clean = clean.replace(/\./g, "");
  const parts = clean.split(".");
  if (parts.length > 2) clean = parts[0] + "." + parts.slice(1).join("");
  return clean;
};

const TYPE_MAP = {
  RAW: {
    label: "原物料",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  SEMI: { label: "半成品", color: "bg-blue-100 text-blue-800 border-blue-200" },
  PACK: {
    label: "包材",
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
  PRODUCT: {
    label: "成品",
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
};

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

const convertToGrams = (qty, unit) => {
  const u = (unit || "kg").toLowerCase();
  const q = parseFloat(qty) || 0;
  if (u === "kg" || u === "l") return q * 1000;
  if (u === "g" || u === "ml") return q;
  return q;
};

const isNutritionEmpty = (nutData) => {
  if (!nutData || Object.keys(nutData).length === 0) return true;
  return Object.values(nutData).every((v) => {
    const num = parseFloat(v);
    return isNaN(num) || num === 0;
  });
};

const calculateNutritionFromBOMs = (boms, parentUnit) => {
  const totalNut = {
    energy_kcal: 0,
    protein: 0,
    fat: 0,
    saturated_fat: 0,
    trans_fat: 0,
    carbs: 0,
    sugar: 0,
    sodium: 0,
  };
  let baseQtyInGrams = 0;
  let hasValidData = false;

  if (boms && boms.length > 0) {
    boms.forEach((bom) => {
      if (bom.is_active === false) return;
      if (!baseQtyInGrams) {
        baseQtyInGrams = convertToGrams(bom.base_quantity, parentUnit);
      }

      let childNut = bom.child_nutrition_fact;
      if (typeof childNut === "string") {
        try {
          childNut = JSON.parse(childNut);
        } catch (e) {
          childNut = {};
        }
      }

      if (childNut && Object.keys(childNut).length > 0) {
        hasValidData = true;
        const reqQtyInGrams = convertToGrams(
          bom.quantity_required,
          bom.child_unit,
        );

        Object.keys(totalNut).forEach((k) => {
          const per100gVal = parseFloat(childNut[k]) || 0;
          const totalContributed = (reqQtyInGrams / 100) * per100gVal;
          totalNut[k] += totalContributed;
        });
      }
    });
  }

  if (!hasValidData) return emptyNutrition;

  const formattedNut = {};
  Object.keys(totalNut).forEach((k) => {
    if (baseQtyInGrams > 0) {
      const per100gFinal = totalNut[k] / (baseQtyInGrams / 100);
      formattedNut[k] = parseFloat(per100gFinal.toFixed(2)).toString();
    } else {
      formattedNut[k] = "0";
    }
  });

  return formattedNut;
};

// ==========================================
// 🌟 共用 Components
// ==========================================
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

const FilterableDropdown = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  disabledIds = [],
  renderItem,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const selectRef = useRef(null);
  const dropdownMenuRef = useRef(null);

  const filteredOptions = options.filter(
    (opt) =>
      (opt.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.order_number || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedOpt = options.find((o) => String(o.id) === String(value));

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && selectRef.current) {
      const rect = selectRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 260;

      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        setDropdownStyle({
          bottom: `${window.innerHeight - rect.top + 6}px`,
          top: "auto",
          left: `${rect.left}px`,
          width: `${rect.width}px`,
        });
      } else {
        setDropdownStyle({
          top: `${rect.bottom + 6}px`,
          bottom: "auto",
          left: `${rect.left}px`,
          width: `${rect.width}px`,
        });
      }
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleScroll = (e) => {
      if (dropdownMenuRef.current && dropdownMenuRef.current.contains(e.target))
        return;
      if (isOpen) setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", () => setIsOpen(false), true);
    }
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", () => setIsOpen(false), true);
    };
  }, [isOpen]);

  return (
    <>
      <div
        ref={selectRef}
        onClick={handleToggle}
        className={`w-full h-11 px-3.5 py-2 border rounded-xl text-[14px] flex justify-between items-center transition-all shadow-sm cursor-pointer ${
          disabled
            ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
            : isOpen
              ? "border-blue-400 ring-2 ring-blue-500/10 bg-white"
              : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 font-medium"
        }`}
      >
        <span className="truncate pr-2 w-full flex items-center">
          {selectedOpt ? (
            renderItem ? (
              renderItem(selectedOpt)
            ) : (
              selectedOpt.name
            )
          ) : (
            <span className="text-slate-400 flex items-center gap-2">
              {placeholder}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 transition-transform ${isOpen ? "rotate-180 text-blue-500" : "text-slate-400"}`}
        />
      </div>

      {isOpen && !disabled && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
          ></div>
          <div
            ref={dropdownMenuRef}
            style={dropdownStyle}
            className="fixed z-[9999] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl flex flex-col max-h-64 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-2 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  autoFocus
                  className="w-full border border-slate-200 bg-white rounded-xl pl-8 pr-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm"
                  placeholder="輸入關鍵字搜尋..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-1.5 custom-scrollbar">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isSelected = String(value) === String(opt.id);
                  const isItemDisabled =
                    opt.id &&
                    disabledIds.includes(String(opt.id)) &&
                    !isSelected;

                  return (
                    <div
                      key={opt.id || `empty-${Math.random()}`}
                      onClick={() => {
                        if (isItemDisabled) return;
                        onChange(opt.id);
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                      className={`px-3 py-2.5 text-[13px] rounded-xl transition-colors font-medium flex justify-between items-center ${
                        isSelected
                          ? "bg-blue-50 text-blue-700 font-bold"
                          : isItemDisabled
                            ? "text-slate-400 bg-slate-50/50 cursor-not-allowed"
                            : "text-slate-700 hover:bg-slate-50 cursor-pointer"
                      }`}
                    >
                      <span className="w-full">
                        {renderItem ? renderItem(opt) : opt.name}
                      </span>
                      {isItemDisabled && (
                        <span className="text-[10px] text-slate-400 font-bold border border-slate-200 bg-white px-1.5 py-0.5 rounded">
                          已選
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-3 py-6 text-center text-slate-400 text-[13px] font-medium">
                  查無資料
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

const SearchableSelect = ({
  value,
  onChange,
  options,
  placeholder,
  renderItem,
  icon: Icon = Search,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const selectRef = useRef(null);
  const dropdownRef = useRef(null);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lowerTerm = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lowerTerm) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(lowerTerm)),
    );
  }, [options, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !selectRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center">
      <div
        ref={selectRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-9 px-3 border rounded-lg text-sm cursor-pointer bg-white flex justify-between items-center transition-all shadow-sm ${
          isOpen
            ? "border-[#007AFF] ring-2 ring-[#007AFF]/20"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden w-full">
          <Icon
            size={14}
            className={value ? "text-[#007AFF]" : "text-slate-400"}
          />
          <span
            className={`truncate font-bold ${value ? "text-slate-800" : "text-slate-400"}`}
          >
            {value || placeholder}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-[calc(100%+4px)] left-0 w-full min-w-[320px] z-[999] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col max-h-[320px] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="p-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <input
              autoFocus
              className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 shadow-sm transition-all"
              placeholder="輸入關鍵字過濾..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto flex-1 p-2 custom-scrollbar bg-white">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  className="px-3 py-2.5 text-sm rounded-xl hover:bg-[#007AFF]/5 cursor-pointer transition-colors"
                >
                  {renderItem ? (
                    renderItem(opt)
                  ) : (
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">
                        {opt.label}
                      </span>
                      {opt.subLabel && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {opt.subLabel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs font-bold">
                查無符合結果
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 🌟 頁面主體 BOMCreatePage
// ==========================================
export default function BOMCreatePage() {
  const { materialCode } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(materialCode);

  const [originalMaterialId, setOriginalMaterialId] = useState(null);
  const [originalBomIds, setOriginalBomIds] = useState([]);
  const [materials, setMaterials] = useState([]);

  // 🌟 包材選擇用資料
  const [packMaterials, setPackMaterials] = useState([]);
  const [packageOrdersList, setPackageOrdersList] = useState([]);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expandedRows, setExpandedRows] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({
    key: "sequence",
    direction: "asc",
  });

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "PRODUCT",
    base_quantity: 10,
    items: [],
  });

  // 🌟 包裝單資料結構
  const [packFormData, setPackFormData] = useState({
    id: null,
    packageSuffix: "",
    order_number: "",
    outer_pack: "",
    inner_pack: "",
    additional_packs: [],
    sales_unit: "箱",
    sales_unit_quantity: "1",
    sales_pack_unit: "包",
    sales_pack_quantity: "0",
    spec: "",
    selectedTemplateId: "",
  });

  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
    onConfirm: null,
    onCloseCallback: null,
  });

  const showAlert = (title, message, status = "info", onCloseCallback = null) =>
    setDialog({
      isOpen: true,
      type: "alert",
      status,
      title,
      message,
      onConfirm: null,
      onCloseCallback,
    });

  const showConfirm = (title, message, onConfirm) =>
    setDialog({
      isOpen: true,
      type: "confirm",
      status: "warning",
      title,
      message,
      onConfirm,
      onCloseCallback: null,
    });

  const closeDialog = () => {
    const callback = dialog.onCloseCallback;
    setDialog((prev) => ({ ...prev, isOpen: false, onCloseCallback: null }));
    if (callback) callback();
  };

  const fetchContainedAdditives = async (parentCode, allMats) => {
    let additivesMap = {};
    const traverse = async (code, currentRatio) => {
      try {
        const res = await fetchWithAuth(`/api/boms?parent__code=${code}`);
        const json = await res.json();
        const boms = json.data || json || [];
        if (boms.length === 0) return;

        const baseQty = parseFloat(boms[0].base_quantity) || 1;

        for (const bom of boms) {
          const childCode = bom.child?.code || bom.child;
          const childQty = parseFloat(bom.quantity_required) || 0;
          const childRatio = precise.div(childQty, baseQty);
          const actualRatio = precise.mul(currentRatio, childRatio);
          const fullMat = allMats.find((m) => m.code === childCode);

          if (fullMat?.ingredients && fullMat.ingredients.length > 0) {
            fullMat.ingredients.forEach((matIng) => {
              const ing =
                matIng.ingredient_detail || matIng.ingredient || matIng;
              if (
                ing &&
                ing.is_additive &&
                ing.legal_limit_percent !== null &&
                ing.legal_limit_percent !== undefined
              ) {
                const ingKey = `ing_${ing.id}`;
                if (!additivesMap[ingKey]) {
                  additivesMap[ingKey] = {
                    code: ingKey,
                    name: ing.name,
                    limit: parseFloat(ing.legal_limit_percent),
                    ratio: 0,
                  };
                }
                additivesMap[ingKey].ratio = precise.add(
                  additivesMap[ingKey].ratio,
                  actualRatio,
                );
              }
            });
          }
          if (fullMat?.type === "SEMI") await traverse(childCode, actualRatio);
        }
      } catch (e) {
        console.error("展開半成品 BOM 失敗", e);
      }
    };
    await traverse(parentCode, 1.0);
    return Object.values(additivesMap);
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [matRes, packMatRes, poListRes] = await Promise.all([
        fetchWithAuth("/api/materials?lite=true"),
        fetchWithAuth("/api/materials?type__in=PACK,STICKER,OTHER"),
        fetchWithAuth("/api/package_orders"),
      ]);

      if (!matRes.ok) throw new Error("無法取得物料資料");
      const matJson = await matRes.json();
      const allMaterials = matJson.data || matJson || [];

      setMaterials(
        allMaterials.filter((m) =>
          ["RAW", "SEMI", "PACK"].includes(m.type?.toUpperCase()),
        ),
      );

      if (packMatRes.ok) {
        const packMatJson = await packMatRes.json();
        const allPackMaterials = packMatJson.data || packMatJson || [];
        setPackMaterials([
          { id: "", name: "-- 無需對應包材 --", code: "", pack_capacity: null },
          ...allPackMaterials,
        ]);
      } else {
        setPackMaterials([
          { id: "", name: "-- 無需對應包材 --", code: "", pack_capacity: null },
          ...allMaterials.filter((m) =>
            ["PACK", "STICKER", "OTHER"].includes(m.type),
          ),
        ]);
      }

      if (poListRes.ok) {
        const poListJson = await poListRes.json();
        setPackageOrdersList(poListJson.data || poListJson || []);
      }

      if (isEditMode) {
        const specificMatRes = await fetchWithAuth(
          `/api/materials?code=${materialCode}`,
        );
        const specificMatJson = await specificMatRes.json();
        const targetMaterial = (specificMatJson.data || specificMatJson)[0];

        if (!targetMaterial)
          return showAlert("錯誤", "找不到配方資料", "error", () =>
            navigate("/materials"),
          );

        setOriginalMaterialId(targetMaterial.id);
        const bomRes = await fetchWithAuth(
          `/api/boms?parent__code=${materialCode}`,
        );
        const bomJson = await bomRes.json();
        const bomList = bomJson.data || bomJson || [];

        if (targetMaterial.type === "PRODUCT") {
          try {
            const poRes = await fetchWithAuth(
              `/api/package_orders?search=${targetMaterial.code}`,
            );
            if (poRes.ok) {
              const poJson = await poRes.json();
              const poList = poJson.data || poJson || [];
              const matchedPO = poList.find(
                (p) => String(p.product_code) === String(targetMaterial.code),
              );

              if (matchedPO) {
                const additional_packs = [];
                (matchedPO.packaging_info || []).forEach((item, idx) => {
                  if (item.layer !== "outer" && item.layer !== "inner") {
                    additional_packs.push({
                      id: `exist_${idx}`,
                      material_id: String(item.material_id),
                      qty: String(item.qty || 1),
                    });
                  }
                });

                setPackFormData({
                  id: matchedPO.id,
                  packageSuffix: "",
                  order_number: matchedPO.order_number,
                  outer_pack: matchedPO.outer_pack
                    ? String(matchedPO.outer_pack)
                    : "",
                  inner_pack: matchedPO.inner_pack
                    ? String(matchedPO.inner_pack)
                    : "",
                  additional_packs,
                  sales_unit: matchedPO.sales_unit || "箱",
                  sales_unit_quantity: matchedPO.sales_unit_quantity
                    ? String(matchedPO.sales_unit_quantity)
                    : "1",
                  sales_pack_unit: matchedPO.sales_pack_unit || "包",
                  sales_pack_quantity: matchedPO.sales_pack_quantity
                    ? String(matchedPO.sales_pack_quantity)
                    : "0",
                  spec: matchedPO.spec || "",
                  selectedTemplateId: "",
                });
              }
            }
          } catch (poErr) {
            console.error("Fetch Package Order failed", poErr);
          }
        }

        const today = new Date().toISOString().split("T")[0];

        const loadedItems = await Promise.all(
          bomList.map(async (bom, index) => {
            const childId = bom.child?.id || bom.child;
            const fullMat = allMaterials.find((m) => m.id === childId);
            const childCode = bom.child?.code || "";

            let containedAdditives = [];
            if (fullMat?.type === "SEMI") {
              containedAdditives = await fetchContainedAdditives(
                childCode,
                allMaterials,
              );
            }

            const boundId =
              bom.selected_price_readonly ||
              bom.selected_quote_info?.id ||
              null;
            const isBound = !!boundId;
            let isExpired = bom.selected_quote_info?.is_expired === true;
            let boundPrice = null;

            if (boundId && fullMat?.provider_quotes) {
              const matchedQuote = fullMat.provider_quotes.find(
                (q) => q.id === boundId,
              );
              if (matchedQuote) {
                isExpired =
                  isExpired ||
                  matchedQuote.is_expired === true ||
                  (matchedQuote.valid_until &&
                    matchedQuote.valid_until < today);
                if (!isExpired) boundPrice = matchedQuote.price;
              }
            }

            const hasAdditive =
              fullMat?.ingredients?.some((matIng) => {
                const ing =
                  matIng.ingredient_detail || matIng.ingredient || matIng;
                return ing?.is_additive === true;
              }) || false;

            let itemNutrition = fullMat ? fullMat.nutrition_fact : {};
            if (
              fullMat &&
              ["SEMI", "PRODUCT"].includes(fullMat.type) &&
              isNutritionEmpty(itemNutrition)
            ) {
              itemNutrition = calculateNutritionFromBOMs(
                fullMat.boms,
                fullMat.unit,
              );
            }

            let itemAllergens = fullMat ? fullMat.allergen_info || "" : "";
            if (!itemAllergens && fullMat && fullMat.boms) {
              const tempAllergens = new Set();
              fullMat.boms.forEach((b) => {
                if (b.child_allergen_info) {
                  b.child_allergen_info
                    .split(",")
                    .forEach((a) => tempAllergens.add(a.trim()));
                }
              });
              itemAllergens = Array.from(tempAllergens)
                .filter(Boolean)
                .join(",");
            }

            return {
              id: bom.id,
              material_id: childId,
              material_code: childCode,
              material_name: bom.child?.name || "未知物料",
              type: bom.child?.type || "",
              unit: bom.child?.unit || "KG",
              base_estimated_cost: fullMat ? fullMat.estimated_cost || 0 : 0,
              provider_quotes: fullMat ? fullMat.provider_quotes || [] : [],
              quantity: parseFloat(bom.quantity_required || 0).toFixed(3),
              remark: bom.remark || "",
              set_cost:
                bom.set_cost !== null && bom.set_cost !== ""
                  ? parseFloat(bom.set_cost).toFixed(2)
                  : "",
              selected_price_id: boundId,
              selected_quote_info: bom.selected_quote_info || null,
              estimated_cost:
                isBound && boundPrice !== null && !isExpired
                  ? parseFloat(boundPrice)
                  : fullMat
                    ? fullMat.estimated_cost || 0
                    : 0,
              is_additive: hasAdditive,
              ingredients: fullMat?.ingredients || [],
              allergen_info: itemAllergens,
              contained_additives: containedAdditives,
              nutrition_fact: itemNutrition,
              sequence_num: bom.sequence_num || String(index + 1),
            };
          }),
        );

        const hasCustomSequence = loadedItems.some(
          (item) =>
            item.sequence_num && String(item.sequence_num).trim() !== "",
        );
        if (hasCustomSequence) {
          loadedItems.sort((a, b) => {
            const seqA = String(a.sequence_num || "");
            const seqB = String(b.sequence_num || "");
            if (!seqA) return 1;
            if (!seqB) return -1;
            return seqA.localeCompare(seqB, undefined, {
              numeric: true,
              sensitivity: "base",
            });
          });
          setSortConfig({ key: "sequence", direction: "asc" });
        } else {
          loadedItems.sort(
            (a, b) =>
              (parseFloat(b.quantity) || 0) - (parseFloat(a.quantity) || 0),
          );
          setSortConfig({ key: "quantity", direction: "desc" });
        }

        setFormData({
          code: targetMaterial.code,
          name: targetMaterial.name,
          type: targetMaterial.type,
          base_quantity:
            bomList.length > 0 ? parseFloat(bomList[0].base_quantity) : 10,
          items: loadedItems,
        });
        setOriginalBomIds(bomList.map((b) => b.id));
      } else {
        setOriginalMaterialId(null);
        setOriginalBomIds([]);
        setSortConfig({ key: "quantity", direction: "desc" });
        setFormData({
          code: "",
          name: "",
          type: "PRODUCT",
          base_quantity: 10,
          items: [],
        });
      }
    } catch (err) {
      showAlert("載入失敗", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [materialCode]);

  const handleDragStart = (e, index) => {
    if (["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(e.target.tagName)) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...formData.items];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);

    setFormData((prev) => ({ ...prev, items: newItems }));
    setDraggedIndex(null);
    setSortConfig({ key: null, direction: null });
  };

  const toggleExpand = (path) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleMasterChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 🌟 包裝單連動函式，完全對齊 PackageOrderPage 預覽字串產生規則
  const updatePackField = (field, value) => {
    setPackFormData((prev) => {
      let updated = { ...prev, [field]: value };

      if (
        [
          "outer_pack",
          "inner_pack",
          "sales_unit",
          "sales_pack_unit",
          "sales_pack_quantity",
          "sales_unit_quantity",
        ].includes(field)
      ) {
        let nextOuterPack = field === "outer_pack" ? value : updated.outer_pack;
        let nextInnerPack = field === "inner_pack" ? value : updated.inner_pack;
        let nextSalesUnit = field === "sales_unit" ? value : updated.sales_unit;
        let nextPackUnit =
          field === "sales_pack_unit" ? value : updated.sales_pack_unit;
        let nextSalesQtyStr =
          field === "sales_unit_quantity" ? value : updated.sales_unit_quantity;
        let nextPackQtyStr =
          field === "sales_pack_quantity" ? value : updated.sales_pack_quantity;

        const outerMat = packMaterials.find(
          (m) => String(m.id) === String(nextOuterPack),
        );
        const innerMat = packMaterials.find(
          (m) => String(m.id) === String(nextInnerPack),
        );

        if (field === "outer_pack") {
          if (!value) {
            nextSalesQtyStr = "0";
            nextSalesUnit = "";
            nextInnerPack = "";
            nextPackQtyStr = "0";
            nextPackUnit = "";
            updated.inner_pack = "";
            updated.sales_pack_quantity = "0";
            updated.sales_pack_unit = "";
          } else if (outerMat) {
            const match = outerMat.name.match(/([箱桶袋包罐瓶])/);
            if (match) nextSalesUnit = match[1];
          }
          updated.sales_unit_quantity = nextSalesQtyStr;
          updated.sales_unit = nextSalesUnit;
        }

        if (field === "inner_pack") {
          if (!value) {
            nextPackQtyStr = "0";
            nextPackUnit = "";
          } else if (innerMat) {
            const match = innerMat.name.match(/([箱桶袋包罐瓶])/);
            if (match) nextPackUnit = match[1];
          }
          updated.sales_pack_quantity = nextPackQtyStr;
          updated.sales_pack_unit = nextPackUnit;
        }

        const parsedSalesQty = Number(nextSalesQtyStr) || 0;
        const parsedPackQty = Number(nextPackQtyStr) || 0;

        const outerCap = outerMat?.pack_capacity
          ? parseFloat(outerMat.pack_capacity)
          : 0;
        const innerCap = innerMat?.pack_capacity
          ? parseFloat(innerMat.pack_capacity)
          : 0;

        if (!nextOuterPack || parsedSalesQty <= 0) {
          updated.spec = "";
        } else if (nextInnerPack && parsedPackQty > 0) {
          const weight = innerCap ? `${innerCap}KG` : "1KG";
          updated.spec = `${weight}*${parsedPackQty}${nextPackUnit || "包"}/${nextSalesUnit || "箱"}`;
        } else {
          const weight = outerCap ? `${outerCap}KG` : "10KG";
          updated.spec = `${weight}/${nextSalesUnit || "桶"}`;
        }
      }

      return updated;
    });
  };

  const handleApplyPackageTemplate = (templateId) => {
    const template = packageOrdersList.find(
      (p) => String(p.id) === String(templateId),
    );
    if (!template) {
      setPackFormData((prev) => ({
        ...prev,
        selectedTemplateId: "",
        order_number: "",
        outer_pack: "",
        inner_pack: "",
        additional_packs: [],
        sales_unit: "箱",
        sales_unit_quantity: "1",
        sales_pack_unit: "包",
        sales_pack_quantity: "0",
        spec: "",
      }));
      return;
    }

    const additional_packs = [];
    (template.packaging_info || []).forEach((item, idx) => {
      if (item.layer !== "outer" && item.layer !== "inner") {
        additional_packs.push({
          id: `temp_${Date.now()}_${idx}`,
          material_id: String(item.material_id),
          qty: String(item.qty || 1),
        });
      }
    });

    setPackFormData((prev) => ({
      ...prev,
      selectedTemplateId: templateId,
      order_number: template.order_number,
      outer_pack: template.outer_pack ? String(template.outer_pack) : "",
      inner_pack: template.inner_pack ? String(template.inner_pack) : "",
      additional_packs,
      sales_unit: template.sales_unit || "箱",
      sales_unit_quantity: template.sales_unit_quantity
        ? String(template.sales_unit_quantity)
        : "1",
      sales_pack_unit: template.sales_pack_unit || "包",
      sales_pack_quantity: template.sales_pack_quantity
        ? String(template.sales_pack_quantity)
        : "0",
      spec: template.spec || "",
    }));
  };

  const addAdditionalPack = () => {
    setPackFormData((prev) => ({
      ...prev,
      additional_packs: [
        ...prev.additional_packs,
        { id: `temp_${Date.now()}`, material_id: "", qty: "1" },
      ],
    }));
  };

  const updateAdditionalPack = (index, field, value) => {
    setPackFormData((prev) => {
      const newPacks = [...prev.additional_packs];
      newPacks[index] = { ...newPacks[index], [field]: value };
      return { ...prev, additional_packs: newPacks };
    });
  };

  const removeAdditionalPack = (index) => {
    setPackFormData((prev) => ({
      ...prev,
      additional_packs: prev.additional_packs.filter((_, i) => i !== index),
    }));
  };

  const disabledMaterialIds = useMemo(() => {
    const ids = [];
    if (packFormData.outer_pack) ids.push(String(packFormData.outer_pack));
    if (packFormData.inner_pack) ids.push(String(packFormData.inner_pack));
    packFormData.additional_packs.forEach((p) => {
      if (p.material_id) ids.push(String(p.material_id));
    });
    return ids;
  }, [
    packFormData.outer_pack,
    packFormData.inner_pack,
    packFormData.additional_packs,
  ]);

  const calculatePackCostPreview = () => {
    let cost = 0;
    const outerMat = packMaterials.find(
      (m) => String(m.id) === String(packFormData.outer_pack),
    );
    const innerMat = packMaterials.find(
      (m) => String(m.id) === String(packFormData.inner_pack),
    );
    if (outerMat)
      cost +=
        (parseFloat(outerMat.estimated_cost) || 0) *
        (Number(packFormData.sales_unit_quantity) || 1);
    if (innerMat)
      cost +=
        (parseFloat(innerMat.estimated_cost) || 0) *
        (Number(packFormData.sales_pack_quantity) || 1);
    packFormData.additional_packs.forEach((pack) => {
      const addMat = packMaterials.find(
        (m) => String(m.id) === String(pack.material_id),
      );
      if (addMat) {
        cost +=
          (parseFloat(addMat.estimated_cost) || 0) * (Number(pack.qty) || 1);
      }
    });
    return Math.round(cost);
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: null,
          material_id: null,
          material_code: "",
          material_name: "",
          type: "",
          quantity: "",
          remark: "",
          unit: "KG",
          estimated_cost: 0,
          base_estimated_cost: 0,
          provider_quotes: [],
          is_additive: false,
          ingredients: [],
          allergen_info: "",
          contained_additives: [],
          nutrition_fact: {},
          set_cost: "",
          selected_price_id: null,
          selected_quote_info: null,
          sequence_num: String(prev.items.length + 1),
        },
      ],
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const handleSortItems = (sortKey) => {
    let newDirection = "desc";
    if (sortConfig.key === sortKey && sortConfig.direction === "desc")
      newDirection = "asc";
    setSortConfig({ key: sortKey, direction: newDirection });

    setFormData((prev) => {
      const sortedItems = [...prev.items].sort((a, b) => {
        let valA = 0,
          valB = 0;
        if (sortKey === "quantity") {
          valA = parseFloat(a.quantity) || 0;
          valB = parseFloat(b.quantity) || 0;
        } else if (sortKey === "subtotal") {
          const aExpired = a.selected_quote_info?.is_expired === true;
          const aCost =
            a.set_cost !== "" && a.set_cost !== null
              ? parseFloat(a.set_cost)
              : aExpired
                ? parseFloat(a.base_estimated_cost) || 0
                : parseFloat(a.estimated_cost) || 0;
          const bExpired = b.selected_quote_info?.is_expired === true;
          const bCost =
            b.set_cost !== "" && b.set_cost !== null
              ? parseFloat(b.set_cost)
              : bExpired
                ? parseFloat(b.base_estimated_cost) || 0
                : parseFloat(b.estimated_cost) || 0;
          valA = (parseFloat(a.quantity) || 0) * aCost;
          valB = (parseFloat(b.quantity) || 0) * bCost;
        }
        if (valA < valB) return newDirection === "asc" ? -1 : 1;
        if (valA > valB) return newDirection === "asc" ? 1 : -1;
        return 0;
      });

      const resequencedItems = sortedItems.map((item, idx) => ({
        ...item,
        sequence_num: String(idx + 1),
      }));

      return { ...prev, items: resequencedItems };
    });
  };

  const handleExportExcel = () => {
    if (formData.items.length === 0)
      return showAlert("無法匯出", "目前沒有配方明細可供匯出。", "warning");
    const getTypeLabel = (type) => {
      const map = {
        RAW: "原物料",
        SEMI: "半成品",
        PRODUCT: "成品",
        PACK: "包材",
      };
      return map[type] || type;
    };
    const safeStr = (str) =>
      (str || "").toString().replace(/,/g, "，").replace(/\n/g, " ");

    const topSection = [
      ["配方代碼", safeStr(formData.code)],
      ["配方/成品名稱", safeStr(formData.name)],
      ["物料類型", getTypeLabel(formData.type)],
      ["基準產量 (KG)", formData.base_quantity],
    ];

    const itemHeaders = [
      "投入序號",
      "物料代碼",
      "物料名稱",
      "類型",
      "備註說明",
      "使用量",
      "單位",
      "系統基準成本",
      "各廠最新報價",
      "設定單位成本",
      "小計",
    ];

    const getNestedRows = (parentMatId, parentQty, level) => {
      let nestedRows = [];
      const parentMat = materials.find((m) => m.id === parentMatId);
      if (!parentMat || !parentMat.boms || parentMat.boms.length === 0)
        return nestedRows;

      const processedBoms = parentMat.boms.map((bom) => {
        const childMat = materials.find((m) => m.id === bom.child) || {};
        let childRefCost = parseFloat(childMat.estimated_cost) || 0;
        const today = new Date().toISOString().split("T")[0];

        if (bom.selected_price_readonly && childMat.provider_quotes) {
          const matchedQuote = childMat.provider_quotes.find(
            (q) => q.id === bom.selected_price_readonly,
          );
          if (matchedQuote) {
            const isQuoteExpired =
              matchedQuote.is_expired ||
              (matchedQuote.valid_until && matchedQuote.valid_until < today);
            if (!isQuoteExpired) childRefCost = parseFloat(matchedQuote.price);
          }
        }
        const hasSetCost =
          bom.set_cost !== null &&
          bom.set_cost !== undefined &&
          bom.set_cost !== "";
        const activeCost = hasSetCost ? parseFloat(bom.set_cost) : childRefCost;
        const childBaseQty = parseFloat(bom.base_quantity) || 1;
        const childReqQty = parseFloat(bom.quantity_required) || 0;
        const actualQty = precise.mul(
          precise.div(childReqQty, childBaseQty),
          parentQty,
        );
        const subtotal = precise.mul(actualQty, activeCost);
        const quotesStr =
          childMat.provider_quotes
            ?.map(
              (q) =>
                `${q.provider_name}:$${q.price}(${q.effective_date}~${q.valid_until || "長期"})`,
            )
            .join(" | ") || "-";

        return {
          bom,
          childMat,
          childRefCost,
          hasSetCost,
          activeCost,
          actualQty,
          subtotal,
          quotesStr,
        };
      });

      processedBoms.sort((a, b) => b.actualQty - a.actualQty);

      processedBoms.forEach((item) => {
        const prefix = " ".repeat(level) + "↳ ";
        nestedRows.push([
          safeStr(item.bom.sequence_num),
          safeStr(item.bom.child_code),
          prefix + safeStr(item.bom.child_name),
          getTypeLabel(item.bom.child_type),
          safeStr(item.bom.remark),
          `${formatNum(item.actualQty)}`,
          `${safeStr(item.bom.child_unit)}`,
          `$${formatNum(item.childRefCost, 2)}`,
          item.quotesStr,
          item.hasSetCost ? `$${formatNum(item.bom.set_cost, 2)}` : "-",
          `$${formatNum(item.subtotal, 2)}`,
        ]);
        if (item.childMat.type === "SEMI") {
          nestedRows = nestedRows.concat(
            getNestedRows(item.bom.child, item.actualQty, level + 1),
          );
        }
      });
      return nestedRows;
    };

    let itemRows = [];
    formData.items.forEach((item, index) => {
      const qty = parseFloat(item.quantity) || 0;
      const isExpired = item.selected_quote_info?.is_expired === true;
      const refCost = isExpired
        ? parseFloat(item.base_estimated_cost) || 0
        : parseFloat(item.estimated_cost) || 0;
      const hasSetCost =
        item.set_cost !== "" && item.set_cost !== null && !isNaN(item.set_cost);
      const activeCost = hasSetCost ? parseFloat(item.set_cost) : refCost;
      const subtotal = precise.mul(qty, activeCost);
      const safeRemark = safeStr(item.remark);
      const quotesStr =
        item.provider_quotes
          ?.map(
            (q) =>
              `${q.provider_name}:$${q.price}(${q.effective_date}~${q.valid_until || "長期"})`,
          )
          .join(" | ") || "-";

      itemRows.push([
        safeStr(item.sequence_num || index + 1),
        safeStr(item.material_code),
        safeStr(item.material_name),
        getTypeLabel(item.type),
        safeRemark,
        `${formatNum(qty)}`,
        `${safeStr(item.unit)}`,
        `$${formatNum(refCost, 2)}`,
        quotesStr,
        hasSetCost ? `$${formatNum(item.set_cost, 2)}` : "-",
        `$${formatNum(subtotal, 2)}`,
      ]);
      if (item.type === "SEMI" && item.material_id) {
        const nested = getNestedRows(item.material_id, qty, 1);
        itemRows = itemRows.concat(nested);
      }
    });

    const footerSection = [
      ["總材料成本", `$${formatCurrency(calculations.totalCost)}`],
      [
        `每 KG 成本 (除 ${formData.base_quantity} KG 基準)`,
        `$${formatCurrency(calculations.unitCost)}`,
      ],
      ["用料總重", `${formatNum(calculations.totalWeight)} KG`],
    ];

    const csvLines = [
      ...topSection.map((row) => row.join(",")),
      "",
      "",
      "",
      itemHeaders.join(","),
      ...itemRows.map((row) => row.join(",")),
      "",
      "",
      "",
      ...footerSection.map((row) => row.join(",")),
    ];

    const csvContent = "\uFEFF" + csvLines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `${formData.code || "未命名配方"}_配方表.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderProviderQuotesSubRow = (
    baseRefCost,
    providerQuotes,
    itemIndex,
    isNested = false,
    nestedSelectedId = null,
  ) => {
    if (!providerQuotes || providerQuotes.length === 0) return null;

    const isReadOnly = itemIndex === undefined;
    const currentSelectedId = !isReadOnly
      ? formData.items[itemIndex].selected_price_id
      : nestedSelectedId;

    return (
      <div className="w-full pl-[104px] pr-4 pb-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 pl-2 mb-0.5 w-full">
          <CornerDownRight
            size={12}
            className="text-slate-300"
            strokeWidth={3}
          />
          <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
            廠商報價情報
          </span>
        </div>

        <div className="flex flex-col gap-1 w-full">
          {providerQuotes.map((pq, i) => {
            const diff = pq.price - baseRefCost;
            const diffPct = baseRefCost > 0 ? (diff / baseRefCost) * 100 : 0;
            const isUp = diff > 0;
            const isDown = diff < 0;
            const isThisSelected = currentSelectedId === pq.id;

            const today = new Date().toISOString().split("T")[0];
            const isQuoteExpired =
              pq.is_expired || (pq.valid_until && pq.valid_until < today);

            return (
              <div
                key={i}
                onClick={() => {
                  if (isReadOnly || isQuoteExpired) return;
                  if (itemIndex !== undefined && itemIndex !== null) {
                    if (isThisSelected) {
                      handleItemChange(itemIndex, "selected_price_id", null);
                      handleItemChange(
                        itemIndex,
                        "estimated_cost",
                        formData.items[itemIndex].base_estimated_cost,
                      );
                    } else {
                      handleItemChange(
                        itemIndex,
                        "estimated_cost",
                        parseFloat(pq.price),
                      );
                      handleItemChange(itemIndex, "selected_price_id", pq.id);
                    }
                  }
                }}
                className={`flex items-center justify-between gap-4 px-3 py-1.5 rounded-lg border transition-all duration-200 w-full ${
                  isQuoteExpired && isThisSelected
                    ? "bg-amber-50/50 border-amber-300 ring-2 ring-amber-300/40 shadow-sm cursor-not-allowed"
                    : isQuoteExpired
                      ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                      : isThisSelected
                        ? "bg-emerald-50 border-emerald-400 shadow-sm cursor-pointer"
                        : isReadOnly
                          ? "bg-slate-50/50 border-transparent"
                          : "bg-white border-transparent hover:border-[#007AFF]/30 hover:bg-blue-50/20 cursor-pointer group/quote"
                }`}
              >
                <div className="flex-[2] flex items-center gap-1.5 min-w-[120px] truncate relative">
                  {isThisSelected && !isQuoteExpired && (
                    <CheckCircle2
                      size={14}
                      className="text-emerald-500 shrink-0"
                      strokeWidth={3}
                    />
                  )}
                  {isQuoteExpired && (
                    <AlertCircle
                      size={14}
                      className="text-amber-500 shrink-0"
                      strokeWidth={2.5}
                    />
                  )}
                  <span
                    className={`text-xs font-semibold truncate ${isQuoteExpired ? "text-amber-700 line-through decoration-amber-500/50" : isThisSelected ? "text-emerald-700" : "text-slate-700"}`}
                  >
                    {pq.provider_name}
                  </span>
                </div>

                <div className="flex-[3] flex items-center justify-center gap-2 min-w-[160px]">
                  <span
                    className={`text-[10px] font-mono font-medium whitespace-nowrap ${isQuoteExpired ? "text-amber-600/70" : "text-slate-500"}`}
                  >
                    {pq.effective_date} ~ {pq.valid_until || "長期"}
                  </span>
                </div>

                <span
                  className={`flex-[1] text-xs font-mono font-bold min-w-[70px] text-right ${isQuoteExpired ? "text-amber-700" : isThisSelected ? "text-emerald-700" : "text-slate-800"}`}
                >
                  ${formatNum(pq.price, 2)}
                </span>

                <div
                  className={`flex-[2] text-right font-mono text-[10px] font-bold min-w-[90px] ${isQuoteExpired ? "text-amber-500/70" : isUp ? "text-rose-500" : isDown ? "text-emerald-500" : "text-slate-400"}`}
                >
                  {diff !== 0 ? (
                    <span>
                      {isUp ? "+" : "-"} ${formatNum(Math.abs(diff), 2)} (
                      {formatNum(Math.abs(diffPct), 1)}%)
                    </span>
                  ) : (
                    <span>-</span>
                  )}
                </div>

                {!isReadOnly && !isThisSelected && !isQuoteExpired && (
                  <div className="w-6 shrink-0 flex justify-end opacity-0 group-hover/quote:opacity-100 transition-opacity">
                    <MousePointerClick size={12} className="text-[#007AFF]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderNestedRows = (parentMatId, parentQty, level, pathPrefix) => {
    const parentMat = materials.find((m) => m.id === parentMatId);
    if (!parentMat || !parentMat.boms || parentMat.boms.length === 0)
      return null;

    const processedBoms = parentMat.boms.map((bom, idx) => {
      const childMat = materials.find((m) => m.id === bom.child) || {};
      let childRefCost = parseFloat(childMat.estimated_cost) || 0;
      const today = new Date().toISOString().split("T")[0];

      const boundId = bom.selected_price_readonly || null;
      if (boundId && childMat.provider_quotes) {
        const matchedQuote = childMat.provider_quotes.find(
          (q) => q.id === boundId,
        );
        if (matchedQuote) {
          const isQuoteExpired =
            matchedQuote.is_expired ||
            (matchedQuote.valid_until && matchedQuote.valid_until < today);
          if (!isQuoteExpired) childRefCost = parseFloat(matchedQuote.price);
        }
      }

      const childBaseQty = parseFloat(bom.base_quantity) || 1;
      const childReqQty = parseFloat(bom.quantity_required) || 0;
      const actualQty = precise.mul(
        precise.div(childReqQty, childBaseQty),
        parentQty,
      );
      const hasSetCost =
        bom.set_cost !== null &&
        bom.set_cost !== undefined &&
        bom.set_cost !== "";
      const activeCost = hasSetCost ? parseFloat(bom.set_cost) : childRefCost;
      const subtotal = precise.mul(actualQty, activeCost);

      return {
        ...bom,
        originalIdx: idx,
        childMat,
        childCost: childRefCost,
        childBaseQty,
        childReqQty,
        actualQty,
        subtotal,
        boundId,
        hasSetCost,
      };
    });

    processedBoms.sort((a, b) => b.actualQty - a.actualQty);

    return processedBoms.map((item) => {
      const currentPath = `${pathPrefix}-${item.originalIdx}`;
      const isExpanded = expandedRows.has(currentPath);
      const hasChildren =
        item.childMat.type === "SEMI" &&
        item.childMat.boms &&
        item.childMat.boms.length > 0;

      return (
        <React.Fragment key={currentPath}>
          <div className="flex flex-col border-b border-slate-100/50 bg-slate-50/30 hover:bg-slate-50 transition-colors group">
            <div className="flex items-start md:items-center gap-2 px-4 py-2 w-full">
              <div
                className="w-[88px] shrink-0 flex items-center justify-end pr-3"
                style={{ paddingRight: `${level * 0.5 + 0.75}rem` }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(currentPath)}
                    className="text-slate-400 hover:text-[#007AFF] p-0.5 rounded transition-colors bg-white border border-slate-200 shadow-sm"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} strokeWidth={3} />
                    ) : (
                      <ChevronRight size={14} strokeWidth={3} />
                    )}
                  </button>
                ) : (
                  <CornerDownRight
                    size={12}
                    className="text-slate-300"
                    strokeWidth={2.5}
                  />
                )}
              </div>

              <div className="w-16 flex justify-center shrink-0">
                {item.childMat.type && (
                  <span
                    className={`px-2 py-1 text-[9px] font-black rounded-md uppercase tracking-widest ${TYPE_MAP[item.childMat.type]?.color || "bg-slate-100 text-slate-500 border-slate-200"}`}
                  >
                    {TYPE_MAP[item.childMat.type]?.label || item.childMat.type}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-[280px] shrink-0 flex flex-col gap-0.5 px-2">
                <span className="text-sm font-bold text-slate-700 truncate">
                  {item.child_name}
                </span>
                <span className="text-[10px] font-mono text-slate-400 font-semibold">
                  {item.child_code}
                </span>
              </div>

              <div className="w-24 shrink-0">
                {item.remark ? (
                  <span className="text-xs text-slate-500 font-medium truncate block bg-white px-2 py-1 rounded border border-slate-100">
                    {item.remark}
                  </span>
                ) : (
                  <span className="text-slate-300 block text-center">-</span>
                )}
              </div>

              <div className="w-32 shrink-0 flex justify-end items-baseline gap-1 pt-1 pr-2">
                <span className="text-[15px] font-mono font-black text-slate-700">
                  {formatNum(item.actualQty)}
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase">
                  {item.child_unit}
                </span>
              </div>

              <div className="w-16 shrink-0 text-right">
                <span className="text-[13px] font-mono font-bold text-slate-500">
                  ${formatNum(item.childCost, 2)}
                </span>
              </div>

              <div className="w-16 shrink-0 flex justify-center">
                {item.hasSetCost ? (
                  <span className="font-mono text-[13px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                    ${formatNum(item.set_cost, 2)}
                  </span>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </div>

              <div className="w-20 shrink-0 text-right pr-2">
                <span className="font-mono text-sm font-black text-slate-600">
                  ${formatNum(item.subtotal, 2)}
                </span>
              </div>

              <div className="w-10 shrink-0"></div>
            </div>

            {item.childMat.provider_quotes &&
              item.childMat.provider_quotes.length > 0 && (
                <div>
                  {renderProviderQuotesSubRow(
                    parseFloat(item.childMat.estimated_cost) || 0,
                    item.childMat.provider_quotes,
                    undefined,
                    true,
                    item.boundId,
                  )}
                </div>
              )}
          </div>
          {isExpanded &&
            hasChildren &&
            renderNestedRows(
              item.child,
              item.actualQty,
              level + 1,
              currentPath,
            )}
        </React.Fragment>
      );
    });
  };

  const claimsAndWarnings = useMemo(() => {
    const baseQty = parseFloat(formData.base_quantity) || 1;
    let totalSugar = 0;
    let totalFat = 0;
    let hasValidEdibleItems = false;
    const triggeredWarnings = new Set();
    const triggeredLimits = new Set();
    const bannedItems = new Set();

    formData.items.forEach((item) => {
      const itemQty = parseFloat(item.quantity) || 0;
      if (itemQty <= 0) return;
      if (item.type === "PACK" || item.type === "STICKER") return;

      hasValidEdibleItems = true;
      const ratio = precise.div(itemQty, baseQty);
      const nut = item.nutrition_fact || {};

      totalSugar = precise.add(
        totalSugar,
        precise.mul(parseFloat(nut.sugar) || 0, ratio),
      );
      totalFat = precise.add(
        totalFat,
        precise.mul(parseFloat(nut.fat) || 0, ratio),
      );

      TFDA_INGREDIENT_RULES.forEach((rule) => {
        const isMatch = rule.keywords.some((keyword) =>
          item.material_name.toLowerCase().includes(keyword.toLowerCase()),
        );
        if (isMatch) {
          if (rule.type === "BANNED")
            bannedItems.add(
              `包含禁用成分「${item.material_name}」：${rule.warningText}`,
            );
          else {
            if (rule.warningText)
              triggeredWarnings.add(
                `含有「${item.material_name}」：應標示「${rule.warningText}」`,
              );
            if (rule.limitText)
              triggeredLimits.add(
                `含有「${item.material_name}」：法規要求「${rule.limitText}」`,
              );
          }
        }
      });
    });

    return {
      hasValidEdibleItems,
      sugarFree: hasValidEdibleItems && totalSugar <= 0.5,
      lowFat: hasValidEdibleItems && totalFat <= 3.0,
      warnings: Array.from(triggeredWarnings),
      limits: Array.from(triggeredLimits),
      banned: Array.from(bannedItems),
    };
  }, [formData.items, formData.base_quantity]);

  const additiveCalculations = useMemo(() => {
    const baseQty = parseFloat(formData.base_quantity) || 1;
    const summary = {};

    formData.items.forEach((item) => {
      const itemQty = parseFloat(item.quantity) || 0;
      if (itemQty <= 0) return;
      const currentItemRatio = precise.div(itemQty, baseQty);

      if (item.ingredients && item.ingredients.length > 0) {
        item.ingredients.forEach((matIng) => {
          const ing = matIng.ingredient_detail || matIng.ingredient || matIng;
          if (
            ing &&
            ing.is_additive &&
            ing.legal_limit_percent !== null &&
            ing.legal_limit_percent !== undefined
          ) {
            const ingKey = `ing_${ing.id}`;
            if (!summary[ingKey])
              summary[ingKey] = {
                code: ingKey,
                name: ing.name,
                limit: parseFloat(ing.legal_limit_percent),
                ratio: 0,
                sources: [],
              };
            summary[ingKey].ratio = precise.add(
              summary[ingKey].ratio,
              currentItemRatio,
            );
            summary[ingKey].sources.push({
              type: "DIRECT",
              name: item.material_name,
              qty: itemQty,
            });
          }
        });
      }

      if (item.contained_additives && item.contained_additives.length > 0) {
        item.contained_additives.forEach((add) => {
          if (!summary[add.code])
            summary[add.code] = {
              code: add.code,
              name: add.name,
              limit: add.limit,
              ratio: 0,
              sources: [],
            };
          const contributedRatio = precise.mul(currentItemRatio, add.ratio);
          const contributedQty = precise.mul(itemQty, add.ratio);
          summary[add.code].ratio = precise.add(
            summary[add.code].ratio,
            contributedRatio,
          );
          summary[add.code].sources.push({
            type: "SEMI",
            name: item.material_name,
            qty: contributedQty,
          });
        });
      }
    });

    const results = Object.values(summary).map((add) => {
      const usagePercent = precise.mul(add.ratio, 100);
      const totalQty = precise.mul(add.ratio, baseQty);
      return {
        ...add,
        totalQty,
        usagePercent,
        isExceeded: usagePercent > add.limit,
      };
    });

    return {
      results,
      hasLimitError: results.some((r) => r.isExceeded),
      exceededCodes: results.filter((r) => r.isExceeded).map((r) => r.code),
    };
  }, [formData.items, formData.base_quantity]);

  const calculations = useMemo(() => {
    let totalCost = 0;
    let totalWeight = 0;

    formData.items.forEach((item) => {
      const itemQty = parseFloat(item.quantity) || 0;
      const today = new Date().toISOString().split("T")[0];
      let isExpired = false;
      if (item.selected_price_id && item.provider_quotes) {
        const matchedQuote = item.provider_quotes.find(
          (q) => q.id === item.selected_price_id,
        );
        if (matchedQuote) {
          isExpired =
            matchedQuote.is_expired ||
            (matchedQuote.valid_until && matchedQuote.valid_until < today);
        }
      }
      const refCost = isExpired
        ? parseFloat(item.base_estimated_cost) || 0
        : parseFloat(item.estimated_cost) || 0;
      const activeCost =
        item.set_cost !== "" && item.set_cost !== null
          ? parseFloat(item.set_cost)
          : refCost;

      totalCost += itemQty * activeCost;
      if (item.type !== "PACK" && item.type !== "STICKER")
        totalWeight += itemQty;
    });

    const baseQty = parseFloat(formData.base_quantity) || 1;
    const weightDiff = totalWeight - baseQty;
    return {
      totalCost,
      unitCost: baseQty > 0 ? totalCost / baseQty : 0,
      totalWeight,
      weightDiff,
    };
  }, [formData.items, formData.base_quantity]);

  const calculatedNutrition = useMemo(() => {
    const totalNut = {
      energy_kcal: 0,
      protein: 0,
      fat: 0,
      saturated_fat: 0,
      trans_fat: 0,
      carbs: 0,
      sugar: 0,
      sodium: 0,
    };
    const baseQtyInGrams = convertToGrams(formData.base_quantity, "KG") || 1000;
    let hasValidData = false;

    formData.items.forEach((item) => {
      const qtyGrams = convertToGrams(item.quantity, item.unit);
      let nut = item.nutrition_fact;
      if (typeof nut === "string") {
        try {
          nut = JSON.parse(nut);
        } catch (e) {
          nut = {};
        }
      }
      if (nut && Object.keys(nut).length > 0) {
        hasValidData = true;
        Object.keys(totalNut).forEach((k) => {
          const per100g = parseFloat(nut[k]) || 0;
          totalNut[k] += (qtyGrams / 100) * per100g;
        });
      }
    });

    if (!hasValidData) return emptyNutrition;

    const formattedNut = {};
    Object.keys(totalNut).forEach((k) => {
      if (baseQtyInGrams > 0) {
        const per100gFinal = totalNut[k] / (baseQtyInGrams / 100);
        formattedNut[k] = parseFloat(per100gFinal.toFixed(2)).toString();
      } else {
        formattedNut[k] = "0";
      }
    });
    return formattedNut;
  }, [formData.items, formData.base_quantity]);

  const aggregatedAllergens = useMemo(() => {
    const allergens = new Set();
    formData.items.forEach((item) => {
      if (item.allergen_info) {
        const parts =
          typeof item.allergen_info === "string"
            ? item.allergen_info.split(",")
            : item.allergen_info;
        parts.forEach((a) => {
          const t = a.trim();
          if (t) allergens.add(t);
        });
      }
    });
    return Array.from(allergens).join(",");
  }, [formData.items]);

  const ingredientsText = useMemo(() => {
    const sorted = [...formData.items]
      .filter((i) => !["PACK", "STICKER", "OTHER"].includes(i.type))
      .sort(
        (a, b) => (parseFloat(b.quantity) || 0) - (parseFloat(a.quantity) || 0),
      );
    return sorted.map((i) => i.material_name).join("、");
  }, [formData.items]);

  const executeSubmit = async () => {
    setIsSubmitting(true);
    closeDialog();
    try {
      let currentParentId = originalMaterialId;
      const finalCode = formData.code;

      const materialPayload = {
        code: finalCode,
        name: formData.name,
        type: formData.type,
        phase: "IN_DEV",
        origin: "台灣",
        unit: "KG",
        is_active: true,
      };

      if (formData.type === "PRODUCT") {
        const packaging_info = [];
        if (packFormData.outer_pack)
          packaging_info.push({
            layer: "outer",
            material_id: packFormData.outer_pack,
            qty: Number(packFormData.sales_unit_quantity) || 1,
          });
        if (packFormData.inner_pack)
          packaging_info.push({
            layer: "inner",
            material_id: packFormData.inner_pack,
            qty: Number(packFormData.sales_pack_quantity) || 1,
          });
        packFormData.additional_packs.forEach((p) => {
          if (p.material_id)
            packaging_info.push({
              layer: "other",
              material_id: p.material_id,
              qty: Number(p.qty) || 1,
            });
        });

        // 🌟 防呆：找出第一個加入明細的 SEMI 作為關聯半成品
        const semiItem = formData.items.find((item) => item.type === "SEMI");
        const semiMaterialId = semiItem
          ? semiItem.material_id
          : formData.items.length > 0
            ? formData.items[0].material_id
            : null;

        const poPayload = {
          order_number: packFormData.order_number || finalCode,
          outer_pack_id: packFormData.outer_pack || null,
          inner_pack_id: packFormData.inner_pack || null,
          spec: packFormData.spec,
          sales_unit: packFormData.sales_unit,
          sales_unit_quantity: packFormData.sales_unit_quantity,
          sales_pack_unit: packFormData.sales_pack_unit,
          sales_pack_quantity: packFormData.sales_pack_quantity,
          packaging_info,
        };

        if (!isEditMode) {
          // 1. 獨立建立成品 Material
          const matRes = await fetchWithAuth("/api/materials", {
            method: "POST",
            body: JSON.stringify(materialPayload),
          });
          if (!matRes.ok) throw new Error("建立成品主檔失敗");
          const createdMaterial = (await matRes.json()).data;
          currentParentId = createdMaterial.id;

          let targetPackageOrderId = null;

          // 🌟 2. 決定 Package Order：有範本就直接取用 ID，否則建立新的
          if (packFormData.selectedTemplateId) {
            targetPackageOrderId = packFormData.selectedTemplateId;
          } else {
            const poRes = await fetchWithAuth("/api/package_orders", {
              method: "POST",
              body: JSON.stringify(poPayload),
            });
            if (!poRes.ok) {
              const e = await poRes.json();
              throw new Error(e.detail || e.message || "建立包裝單失敗");
            }
            const createdPO = (await poRes.json()).data;
            targetPackageOrderId = createdPO.id;
          }

          // 3. 獨立建立 Product Package Order Relation
          const relationPayload = {
            package_order: targetPackageOrderId,
            product: currentParentId,
            semi_material: semiMaterialId,
            is_active: true,
          };
          const relRes = await fetchWithAuth("/api/product_package_relations", {
            method: "POST",
            body: JSON.stringify(relationPayload),
          });
          if (!relRes.ok) throw new Error("建立包裝關聯失敗");
        } else {
          // =======================
          // 編輯模式
          // =======================
          await fetchWithAuth(`/api/materials/${currentParentId}`, {
            method: "PUT",
            body: JSON.stringify(materialPayload),
          });

          if (packFormData.selectedTemplateId) {
            // 🌟 情況 A：編輯模式下套用「現有範本」
            // 為了簡化邏輯，若原先沒有綁定，或是原先綁定的 ID 不等於新選定的範本 ID，直接新建一筆 Relation 關聯
            if (
              !packFormData.id ||
              String(packFormData.id) !==
                String(packFormData.selectedTemplateId)
            ) {
              const relationPayload = {
                package_order: packFormData.selectedTemplateId,
                product: currentParentId,
                semi_material: semiMaterialId,
                is_active: true,
              };
              const relRes = await fetchWithAuth(
                "/api/product_package_relations",
                {
                  method: "POST",
                  body: JSON.stringify(relationPayload),
                },
              );
              if (!relRes.ok) throw new Error("建立包裝關聯失敗");
            }
          } else if (packFormData.id) {
            // 🌟 情況 B：編輯模式下更新「原有的自訂包裝單」
            await fetchWithAuth(`/api/package_orders/${packFormData.id}`, {
              method: "PUT",
              body: JSON.stringify(poPayload),
            });
          } else {
            // 🌟 情況 C：編輯模式下原本沒有包裝單，現在「新增自訂包裝單」
            const poRes = await fetchWithAuth("/api/package_orders", {
              method: "POST",
              body: JSON.stringify(poPayload),
            });
            if (!poRes.ok) {
              const e = await poRes.json();
              throw new Error(e.detail || e.message || "建立包裝單失敗");
            }
            const createdPO = (await poRes.json()).data;

            const relationPayload = {
              package_order: createdPO.id,
              product: currentParentId,
              semi_material: semiMaterialId,
              is_active: true,
            };
            const relRes = await fetchWithAuth(
              "/api/product_package_relations",
              {
                method: "POST",
                body: JSON.stringify(relationPayload),
              },
            );
            if (!relRes.ok) throw new Error("建立包裝關聯失敗");
          }
        }
      } else {
        // SEMI or RAW flow
        if (isEditMode) {
          const matRes = await fetchWithAuth(
            `/api/materials/${currentParentId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(materialPayload),
            },
          );
          if (!matRes.ok) throw new Error("更新配方主檔失敗");
        } else {
          const matRes = await fetchWithAuth("/api/materials", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(materialPayload),
          });
          if (!matRes.ok)
            throw new Error("建立配方主檔失敗，請確認代碼是否重複");
          const json = await matRes.json();
          const createdMaterial = json.data || json;
          currentParentId = createdMaterial.id;
        }
      }

      // 清除舊的 BOM (若有)
      if (isEditMode) {
        const currentItemIds = formData.items
          .filter((item) => item.id)
          .map((item) => item.id);
        const deletedIds = originalBomIds.filter(
          (id) => !currentItemIds.includes(id),
        );
        const deletePromises = deletedIds.map((id) =>
          fetchWithAuth(`/api/boms/${id}`, { method: "DELETE" }),
        );
        await Promise.all(deletePromises);
      }

      // 建立新的 BOM
      const bomPromises = formData.items.map(async (item, index) => {
        const bomPayload = {
          parent_id: currentParentId,
          child_id: item.material_id,
          base_quantity: parseFloat(formData.base_quantity),
          quantity_required: parseFloat(item.quantity),
          remark: item.remark || "",
          set_cost: item.set_cost !== "" ? parseFloat(item.set_cost) : null,
          selected_price_id: item.selected_price_id || null,
          sequence_num: item.sequence_num || String(index + 1),
        };
        const url =
          isEditMode && item.id ? `/api/boms/${item.id}` : "/api/boms";
        const method = isEditMode && item.id ? "PUT" : "POST";
        const res = await fetchWithAuth(url, {
          method: method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bomPayload),
        });
        if (!res.ok) throw new Error("儲存明細失敗");
        const json = await res.json();
        return json.data || json;
      });

      await Promise.all(bomPromises);

      const snapshotPayload = {
        material: currentParentId,
        nutrition_fact: calculatedNutrition,
        allergen_info: aggregatedAllergens,
        ingredients_text: ingredientsText,
        status: "PENDING",
        is_active: true,
      };

      const snapRes = await fetchWithAuth("/api/nutrition_snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshotPayload),
      });

      if (!snapRes.ok) {
        throw new Error(
          "配方已儲存，但建立營養標籤快照失敗，請聯絡系統管理員。",
        );
      }

      showAlert(
        "儲存成功",
        `配方與營養標籤快照已成功${isEditMode ? "更新" : "建立"}！`,
        "success",
        () => window.location.reload(),
      );
    } catch (err) {
      showAlert("發生錯誤", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.code || !formData.name)
      return showAlert("資料不完整", "請輸入代碼與名稱", "warning");
    if (!formData.base_quantity || formData.base_quantity <= 0)
      return showAlert("資料錯誤", "基準產量必須大於 0", "warning");

    if (formData.type === "PRODUCT") {
      // 🌟 修正：防呆檢測獨立的 order_number
      if (!packFormData.order_number)
        return showAlert("資料不完整", "建立成品時，請輸入包裝單號", "warning");
      if (formData.items.length === 0)
        return showAlert(
          "資料不完整",
          "建立成品時，必須在明細中加入關聯的半成品",
          "warning",
        );
    }

    if (
      formData.items.length === 0 ||
      formData.items.some((item) => !item.material_id)
    )
      return showAlert("資料不完整", "請完整選擇物料明細", "warning");

    if (additiveCalculations.hasLimitError)
      return showAlert(
        "法規上限警示",
        "添加物超過法規安全上限，無法儲存。",
        "error",
      );
    if (claimsAndWarnings.banned.length > 0)
      return showAlert(
        "禁用原料警示",
        "含有台灣法規禁用原料，無法儲存。",
        "error",
      );

    showConfirm(
      isEditMode ? "更新確認" : "建立確認",
      isEditMode
        ? `確定更新配方「${formData.name}」並建立一份新的標籤快照？`
        : `確定建立配方「${formData.name}」與標籤快照？`,
      executeSubmit,
    );
  };

  const materialCost = calculations.totalCost;
  const packCost = formData.type === "PRODUCT" ? calculatePackCostPreview() : 0;
  const grandTotal = materialCost + packCost;

  if (loading)
    return (
      <div className="flex justify-center items-center h-full min-h-screen bg-slate-50">
        <div className="text-lg font-bold text-slate-400 animate-pulse">
          載入系統資料中...
        </div>
      </div>
    );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          {isEditMode ? "調整配方內容" : "配方建立與成本估算"}
        </h2>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-8 mb-10 w-full"
      >
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm w-full transition-shadow hover:shadow-md">
          <h3 className="text-xs font-black text-[#007AFF] uppercase tracking-widest mb-6 border-b border-slate-100 pb-3">
            1. 基本資訊
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                {formData.type === "PRODUCT" && !isEditMode
                  ? "配方代碼 + 包裝單代碼"
                  : "配方代碼"}{" "}
                <span className="text-red-500">*</span>
              </label>
              {formData.type === "PRODUCT" && !isEditMode ? (
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleMasterChange}
                      placeholder="P920"
                      className="w-full h-[48px] px-4 py-2 border border-slate-200 rounded-xl focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 outline-none font-mono font-bold transition-all shadow-sm"
                    />
                    <input
                      type="text"
                      value={packFormData.packageSuffix}
                      onChange={(e) =>
                        updatePackField("packageSuffix", e.target.value)
                      }
                      placeholder="-1"
                      className="w-24 shrink-0 h-[48px] px-3 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono font-bold transition-all shadow-sm placeholder:text-blue-300"
                    />
                  </div>
                  {formData.code && packFormData.packageSuffix && (
                    <div className="text-[11px] text-[#007AFF] mt-1.5 font-bold tracking-wider">
                      成品代碼預覽: {formData.code}
                      {packFormData.packageSuffix}
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleMasterChange}
                  disabled={isEditMode}
                  placeholder="P9202020"
                  className="w-full h-[48px] px-4 py-2 border border-slate-200 rounded-xl focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 outline-none font-mono font-bold transition-all shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
                />
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                配方/成品名稱 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleMasterChange}
                placeholder="泰式打拋豬肉B"
                className="w-full h-[48px] px-4 py-2 border border-slate-200 rounded-xl focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 outline-none font-bold text-[15px] transition-all shadow-sm"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                物料類型
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleMasterChange}
                disabled={isEditMode}
                className="w-full h-[48px] px-4 py-2 border border-slate-200 rounded-xl focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 outline-none font-bold transition-all shadow-sm bg-white appearance-none cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="PRODUCT">成品 (PRODUCT)</option>
                <option value="SEMI">半成品 (SEMI)</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-black text-[#007AFF] mb-2 uppercase tracking-wider flex items-center gap-1">
                基準產量 (KG) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="base_quantity"
                min="0.01"
                step="0.01"
                value={formData.base_quantity}
                onChange={handleMasterChange}
                className="w-full h-[48px] px-4 py-2 border-2 border-blue-200 bg-blue-50/50 text-[#007AFF] rounded-xl focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 outline-none font-mono font-black text-lg transition-all shadow-sm"
              />
            </div>
          </div>

          {/* 🌟 包裝設定 (僅 PRODUCT) */}
          {formData.type === "PRODUCT" &&
            (() => {
              const isTemplateSelected = Boolean(
                packFormData.selectedTemplateId,
              );

              return (
                <div className="mt-8 pt-8 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Package size={16} className="text-slate-400" />{" "}
                        包裝設定與對應 (成品必填)
                      </h4>
                      {isTemplateSelected && (
                        <span className="bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest animate-in fade-in flex items-center gap-1">
                          🔒 範本唯讀模式
                        </span>
                      )}
                    </div>
                    <div className="w-full md:w-80">
                      <FilterableDropdown
                        value={packFormData.selectedTemplateId}
                        onChange={handleApplyPackageTemplate}
                        options={packageOrdersList}
                        placeholder="快速套用現有包裝單範本..."
                        renderItem={(m) => (
                          <div className="flex justify-between items-center w-full gap-2">
                            <span className="text-[12px] text-slate-400 font-mono shrink-0">
                              [{m.order_number}]
                            </span>
                            <span className="text-[13px] text-slate-700 font-medium truncate">
                              {m.spec || "無規格描述"}
                            </span>
                          </div>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* 獨立的包裝單號輸入框 */}
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:items-center gap-4">
                      <label className="text-[13px] font-black text-blue-700 whitespace-nowrap">
                        設定包裝單號 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={packFormData.order_number}
                        onChange={(e) =>
                          updatePackField("order_number", e.target.value)
                        }
                        placeholder="例如: PKG-202610-001"
                        disabled={isEditMode || isTemplateSelected} // 🌟 修正：使用 isEditMode
                        className="flex-1 h-[42px] px-4 bg-white border border-slate-200 rounded-xl font-mono font-bold text-[14px] text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none shadow-sm transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100 flex flex-col gap-4 relative overflow-hidden">
                      {/* 若套用範本，疊加一層透明遮罩來暗示唯讀 */}
                      {isTemplateSelected && (
                        <div className="absolute inset-0 bg-slate-50/40 z-[5] pointer-events-none"></div>
                      )}

                      <div className="flex items-center justify-between relative z-10">
                        <h4 className="text-[12px] font-bold text-blue-500 uppercase tracking-widest">
                          包材結構與換算設定
                        </h4>
                        <button
                          type="button"
                          onClick={addAdditionalPack}
                          disabled={isTemplateSelected}
                          className="text-[12px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus size={14} /> 新增包材
                        </button>
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 relative z-10">
                        <span className="text-[12px] font-bold text-slate-500 tracking-wide block">
                          包材單位
                        </span>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="col-span-4 sm:col-span-2">
                            <FilterableDropdown
                              value={packFormData.outer_pack}
                              onChange={(val) =>
                                updatePackField("outer_pack", val)
                              }
                              options={packMaterials.filter(
                                (pm) => pm.type === "PACK" || !pm.id,
                              )}
                              disabledIds={disabledMaterialIds}
                              disabled={isTemplateSelected}
                              placeholder="-- 無需對應外包裝 --"
                              renderItem={(m) =>
                                m.id ? `[${m.code}] ${m.name}` : m.name
                              }
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-1 relative flex items-center">
                            <span className="absolute left-3 text-slate-400 font-bold text-[13px] z-10">
                              x
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="數量"
                              value={packFormData.sales_unit_quantity}
                              disabled={isTemplateSelected}
                              onChange={(e) =>
                                updatePackField(
                                  "sales_unit_quantity",
                                  handleNumericTextInput(e.target.value),
                                )
                              }
                              className="w-full h-11 pl-7 pr-3 bg-white border border-slate-200 rounded-xl text-center font-mono font-medium text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none shadow-sm transition-all disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <input
                              type="text"
                              placeholder="單位 (箱)"
                              value={packFormData.sales_unit}
                              disabled={isTemplateSelected}
                              onChange={(e) =>
                                updatePackField("sales_unit", e.target.value)
                              }
                              className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-center font-medium text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none shadow-sm transition-all disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 relative z-10">
                        <span className="text-[12px] font-bold text-slate-500 tracking-wide block">
                          輔助單位 (選填)
                        </span>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="col-span-4 sm:col-span-2">
                            <FilterableDropdown
                              value={packFormData.inner_pack}
                              onChange={(val) =>
                                updatePackField("inner_pack", val)
                              }
                              options={packMaterials.filter(
                                (pm) => pm.type === "PACK" || !pm.id,
                              )}
                              disabled={
                                !packFormData.outer_pack || isTemplateSelected
                              }
                              disabledIds={disabledMaterialIds}
                              placeholder={
                                packFormData.outer_pack
                                  ? "-- 無需對應內包裝 --"
                                  : "請先選擇外包材"
                              }
                              renderItem={(m) =>
                                m.id ? `[${m.code}] ${m.name}` : m.name
                              }
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-1 relative flex items-center">
                            <span className="absolute left-3 text-slate-400 font-bold text-[13px] z-10">
                              x
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="數量"
                              disabled={
                                !packFormData.outer_pack || isTemplateSelected
                              }
                              value={packFormData.sales_pack_quantity}
                              onChange={(e) =>
                                updatePackField(
                                  "sales_pack_quantity",
                                  handleNumericTextInput(e.target.value),
                                )
                              }
                              className="w-full h-11 pl-7 pr-3 bg-white border border-slate-200 rounded-xl text-center font-mono font-medium text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none shadow-sm transition-all disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <input
                              type="text"
                              placeholder="單位 (包)"
                              disabled={
                                !packFormData.outer_pack || isTemplateSelected
                              }
                              value={packFormData.sales_pack_unit}
                              onChange={(e) =>
                                updatePackField(
                                  "sales_pack_unit",
                                  e.target.value,
                                )
                              }
                              className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-center font-medium text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none shadow-sm transition-all disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>

                      {packFormData.additional_packs.length > 0 && (
                        <div className="space-y-3 relative z-10">
                          {packFormData.additional_packs.map((pack, idx) => (
                            <div
                              key={pack.id}
                              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2"
                            >
                              <div className="flex-1">
                                <FilterableDropdown
                                  value={pack.material_id}
                                  onChange={(val) =>
                                    updateAdditionalPack(
                                      idx,
                                      "material_id",
                                      val,
                                    )
                                  }
                                  options={packMaterials}
                                  disabledIds={disabledMaterialIds}
                                  disabled={isTemplateSelected}
                                  placeholder="選擇額外包材 / 標籤"
                                  renderItem={(m) =>
                                    m.id ? `[${m.code}] ${m.name}` : m.name
                                  }
                                />
                              </div>
                              <div className="w-[110px] shrink-0 relative flex items-center">
                                <span className="absolute left-3 text-slate-400 font-bold text-[13px] z-10">
                                  x
                                </span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="數量"
                                  disabled={isTemplateSelected}
                                  value={pack.qty}
                                  onChange={(e) =>
                                    updateAdditionalPack(
                                      idx,
                                      "qty",
                                      handleNumericTextInput(e.target.value),
                                    )
                                  }
                                  className="w-full h-11 pl-7 pr-3 bg-white border border-slate-200 rounded-xl text-center font-mono font-medium text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeAdditionalPack(idx)}
                                disabled={isTemplateSelected}
                                className="w-11 h-11 flex items-center justify-center shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                              >
                                <XCircle size={20} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 relative z-10">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[12px] font-bold text-slate-500 uppercase">
                            包裝規格預覽
                          </label>
                          <input
                            type="text"
                            value={packFormData.spec}
                            disabled={isTemplateSelected}
                            onChange={(e) =>
                              updatePackField("spec", e.target.value)
                            }
                            placeholder="選填，如不滿意自動產生之預覽可手動更改"
                            className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl font-medium text-[14px] text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none shadow-sm transition-all disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[12px] font-bold text-slate-500 uppercase">
                            預估包材總成本
                          </label>
                          <div className="w-full h-11 px-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between shadow-inner">
                            <span className="text-blue-700 font-bold text-[14px] font-mono">
                              ${formatCurrency(calculatePackCostPreview())}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col w-full overflow-visible">
          <div className="px-6 py-4 md:px-6 md:py-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50/50 gap-4">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-black text-slate-800">
                {formData.type === "PRODUCT"
                  ? "2. 配方用料明細 (含內容物與包裝清單)"
                  : "2. 配方用料明細"}
              </h3>
              <span className="text-[#007AFF] bg-blue-50 font-black px-2.5 py-0.5 rounded-full border border-blue-100 shadow-sm text-sm">
                {formData.items.length}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-2">
                ※ 拖曳左側 <GripVertical size={12} className="inline mb-0.5" />{" "}
                符號可自訂物料加工順序
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {formData.items.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSortItems("quantity")}
                    className={`text-[11px] px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm flex items-center gap-1 border ${sortConfig.key === "quantity" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                  >
                    用量排序{" "}
                    {sortConfig.key === "quantity" &&
                      (sortConfig.direction === "desc" ? (
                        <ArrowDown size={12} />
                      ) : (
                        <ArrowUp size={12} />
                      ))}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSortItems("subtotal")}
                    className={`text-[11px] px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm flex items-center gap-1 border ${sortConfig.key === "subtotal" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                  >
                    小計排序{" "}
                    {sortConfig.key === "subtotal" &&
                      (sortConfig.direction === "desc" ? (
                        <ArrowDown size={12} />
                      ) : (
                        <ArrowUp size={12} />
                      ))}
                  </button>
                  <div className="w-px h-4 bg-slate-300 mx-1 hidden sm:block"></div>
                </>
              )}
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs bg-white text-[#007AFF] px-4 py-1.5 rounded-lg hover:bg-blue-50 font-black transition-all shadow-sm flex items-center gap-1.5 border border-slate-200 hover:border-blue-200"
              >
                <Plus size={14} strokeWidth={3} /> 加入原料
              </button>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-visible w-full pb-[300px] min-h-[400px]">
            {formData.items.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-sm font-bold bg-white">
                尚未加入任何原料，請點擊上方「加入原料」開始設計。
              </div>
            ) : (
              <div className="min-w-[1000px] flex flex-col w-full overflow-visible">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100/50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10">
                  <div className="w-[88px] text-center shrink-0">序號</div>
                  <div className="w-16 text-center shrink-0">類型</div>
                  <div className="flex-1 min-w-[280px] shrink-0">物料</div>
                  <div className="w-24 shrink-0">備註</div>
                  <div className="w-32 shrink-0 pl-1 text-right">
                    用量(KG) <span className="text-red-500">*</span>
                  </div>
                  <div className="w-16 shrink-0 text-right">系統均價</div>
                  <div className="w-16 shrink-0 text-center">設定成本</div>
                  <div className="w-20 shrink-0 text-right pr-2">小計</div>
                  <div className="w-10 shrink-0"></div>
                </div>

                <div className="flex flex-col relative z-0">
                  {formData.items.map((item, index) => {
                    const itemQty = parseFloat(item.quantity) || 0;
                    const isExpired =
                      item.selected_quote_info?.is_expired === true;
                    const refCost = isExpired
                      ? parseFloat(item.base_estimated_cost) || 0
                      : parseFloat(item.estimated_cost) || 0;
                    const hasSetCost =
                      item.set_cost !== "" &&
                      item.set_cost !== null &&
                      !isNaN(item.set_cost);
                    const activeCost = hasSetCost
                      ? parseFloat(item.set_cost)
                      : refCost;
                    const subtotal = formatNum(itemQty * activeCost, 2);
                    const isSemi = item.type === "SEMI";
                    const currentPath = `root-${index}`;
                    const isExpanded = expandedRows.has(currentPath);

                    const isErrorRow = Boolean(
                      item.material_code &&
                      ((item.is_additive &&
                        additiveCalculations.exceededCodes.includes(
                          item.material_code,
                        )) ||
                        (item.contained_additives &&
                          item.contained_additives.some((add) =>
                            additiveCalculations.exceededCodes.includes(
                              add.code,
                            ),
                          ))),
                    );

                    return (
                      <React.Fragment key={index}>
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          className={`flex flex-col border-b border-slate-100 transition-colors group relative hover:z-[40] focus-within:z-[50] ${
                            isErrorRow
                              ? "bg-red-50 hover:bg-red-100/50"
                              : "bg-white hover:bg-slate-50/50"
                          } ${dragOverIndex === index ? "border-t-[3px] border-t-[#007AFF] bg-blue-50/30" : ""} ${
                            draggedIndex === index ? "opacity-50" : ""
                          }`}
                        >
                          <div className="flex items-start md:items-center gap-2 px-4 py-2 w-full">
                            <div className="w-[88px] shrink-0 flex items-center justify-center gap-1.5 pl-2 pt-1">
                              <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0">
                                <GripVertical size={16} />
                              </div>
                              <input
                                type="text"
                                value={item.sequence_num || ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "sequence_num",
                                    e.target.value,
                                  )
                                }
                                placeholder={index + 1}
                                className={`w-12 h-8 text-center text-xs font-mono font-bold rounded-md transition-all outline-none ${isErrorRow ? "bg-red-50 text-red-600 placeholder:text-red-300 border-red-100" : "bg-slate-50 text-slate-700 border border-transparent hover:border-slate-200 focus:bg-white focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 placeholder:text-slate-400 placeholder:font-bold"}`}
                              />
                            </div>

                            <div className="w-16 shrink-0 flex flex-col items-center justify-center">
                              {item.type && (
                                <span
                                  className={`px-1.5 py-0.5 text-[9px] font-black rounded uppercase tracking-widest ${TYPE_MAP[item.type]?.color || "bg-slate-100 text-slate-500 border-slate-200"}`}
                                >
                                  {TYPE_MAP[item.type]?.label || item.type}
                                </span>
                              )}
                              {isSemi && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(currentPath)}
                                  className="mt-1 text-[#007AFF] hover:bg-blue-50 p-0.5 rounded transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDown size={14} strokeWidth={3} />
                                  ) : (
                                    <ChevronRight size={14} strokeWidth={3} />
                                  )}
                                </button>
                              )}
                            </div>

                            <div className="flex-1 min-w-[280px] shrink-0">
                              <SearchableSelect
                                placeholder="請搜尋原料..."
                                value={
                                  item.material_id
                                    ? `[${item.material_code}] ${item.material_name}`
                                    : ""
                                }
                                options={materials.map((m) => ({
                                  label: m.name,
                                  subLabel: m.code,
                                  value: m,
                                  type: m.type,
                                }))}
                                onChange={async (selectedMat) => {
                                  const hasAdditive =
                                    selectedMat?.ingredients?.some((matIng) => {
                                      const ing =
                                        matIng.ingredient_detail ||
                                        matIng.ingredient ||
                                        matIng;
                                      return ing?.is_additive === true;
                                    }) || false;

                                  let itemNutrition =
                                    selectedMat.nutrition_fact || {};
                                  if (
                                    ["SEMI", "PRODUCT"].includes(
                                      selectedMat.type,
                                    ) &&
                                    isNutritionEmpty(itemNutrition)
                                  ) {
                                    itemNutrition = calculateNutritionFromBOMs(
                                      selectedMat.boms,
                                      selectedMat.unit,
                                    );
                                  }

                                  let itemAllergens =
                                    selectedMat.allergen_info || "";
                                  if (!itemAllergens && selectedMat.boms) {
                                    const tempAllergens = new Set();
                                    selectedMat.boms.forEach((b) => {
                                      if (b.child_allergen_info) {
                                        b.child_allergen_info
                                          .split(",")
                                          .forEach((a) =>
                                            tempAllergens.add(a.trim()),
                                          );
                                      }
                                    });
                                    itemAllergens = Array.from(tempAllergens)
                                      .filter(Boolean)
                                      .join(",");
                                  }

                                  handleItemChange(
                                    index,
                                    "material_id",
                                    selectedMat.id,
                                  );
                                  handleItemChange(
                                    index,
                                    "material_code",
                                    selectedMat.code,
                                  );
                                  handleItemChange(
                                    index,
                                    "material_name",
                                    selectedMat.name,
                                  );
                                  handleItemChange(
                                    index,
                                    "type",
                                    selectedMat.type,
                                  );
                                  handleItemChange(
                                    index,
                                    "unit",
                                    selectedMat.unit || "KG",
                                  );
                                  handleItemChange(
                                    index,
                                    "base_estimated_cost",
                                    selectedMat.estimated_cost || 0,
                                  );
                                  handleItemChange(
                                    index,
                                    "estimated_cost",
                                    selectedMat.estimated_cost || 0,
                                  );
                                  handleItemChange(
                                    index,
                                    "provider_quotes",
                                    selectedMat.provider_quotes || [],
                                  );
                                  handleItemChange(
                                    index,
                                    "is_additive",
                                    hasAdditive,
                                  );
                                  handleItemChange(
                                    index,
                                    "ingredients",
                                    selectedMat.ingredients || [],
                                  );
                                  handleItemChange(
                                    index,
                                    "allergen_info",
                                    itemAllergens,
                                  );
                                  handleItemChange(
                                    index,
                                    "nutrition_fact",
                                    itemNutrition,
                                  );
                                  handleItemChange(index, "set_cost", "");
                                  handleItemChange(
                                    index,
                                    "selected_price_id",
                                    null,
                                  );
                                  handleItemChange(
                                    index,
                                    "selected_quote_info",
                                    null,
                                  );

                                  if (selectedMat.type === "SEMI") {
                                    const contained =
                                      await fetchContainedAdditives(
                                        selectedMat.code,
                                        materials,
                                      );
                                    handleItemChange(
                                      index,
                                      "contained_additives",
                                      contained,
                                    );
                                  } else {
                                    handleItemChange(
                                      index,
                                      "contained_additives",
                                      [],
                                    );
                                  }
                                }}
                                renderItem={(opt) => {
                                  const mat = opt.value;
                                  const hasAdditiveIcon =
                                    mat?.ingredients?.some((matIng) => {
                                      const ing =
                                        matIng.ingredient_detail ||
                                        matIng.ingredient ||
                                        matIng;
                                      return ing?.is_additive === true;
                                    });
                                  return (
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`px-1.5 py-0.5 border text-[9px] font-bold rounded uppercase ${TYPE_MAP[mat.type]?.color || "bg-slate-50 text-slate-600 border-slate-200"}`}
                                      >
                                        {TYPE_MAP[mat.type]?.label || mat.type}
                                      </span>
                                      <span className="font-bold text-slate-800 text-sm truncate">
                                        {opt.label}
                                      </span>
                                      <div className="flex-1 flex items-center justify-end gap-1">
                                        <span className="text-[10px] text-slate-400 font-mono font-semibold">
                                          {opt.subLabel}
                                        </span>
                                        {hasAdditiveIcon && (
                                          <div className="bg-orange-500 text-white p-0.5 rounded shadow-sm">
                                            <FlaskConical
                                              size={10}
                                              strokeWidth={3}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                            </div>

                            <div className="w-24 shrink-0 relative">
                              <input
                                type="text"
                                value={item.remark || ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "remark",
                                    e.target.value,
                                  )
                                }
                                className="w-full h-[36px] px-3 border border-transparent bg-slate-50 rounded-lg hover:border-slate-200 hover:bg-white focus:bg-white focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 outline-none text-[13px] transition-all placeholder:text-slate-300"
                                placeholder="備註..."
                              />
                            </div>

                            <div className="w-32 shrink-0 relative">
                              <input
                                type="number"
                                step="any"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val))
                                    handleItemChange(
                                      index,
                                      "quantity",
                                      val.toFixed(3),
                                    );
                                  else handleItemChange(index, "quantity", "");
                                }}
                                className={`w-full h-[36px] pl-3 pr-8 text-right font-mono font-bold text-[#007AFF] bg-blue-50/30 border border-transparent hover:border-blue-100 rounded-lg focus:bg-white focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 outline-none transition-all ${isErrorRow ? "border-red-300 text-red-600 bg-white" : ""}`}
                                placeholder="0"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-300 uppercase pointer-events-none">
                                {item.unit}
                              </span>
                            </div>

                            <div className="w-16 shrink-0 text-right pt-0.5 relative group/price">
                              <span
                                className={`font-mono text-[13px] font-bold transition-colors ${item.selected_price_id && !isExpired ? "text-emerald-600" : "text-slate-500"}`}
                              >
                                ${formatNum(refCost, 2)}
                              </span>
                              {item.selected_price_id && isExpired && (
                                <div
                                  className="absolute -top-1 -right-1 bg-amber-50 rounded-full border border-amber-200 p-0.5 cursor-help"
                                  title={`此報價已於 ${item.selected_quote_info?.valid_until} 過期`}
                                >
                                  <AlertCircle
                                    size={10}
                                    className="text-amber-500"
                                    strokeWidth={2.5}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="w-16 shrink-0 flex justify-center">
                              <div className="flex items-center h-[36px] px-1 bg-slate-50 border border-transparent rounded-lg hover:bg-white hover:border-slate-200 focus-within:bg-white focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20 transition-all">
                                <span className="text-xs font-bold text-slate-400">
                                  $
                                </span>
                                <input
                                  type="number"
                                  step="any"
                                  value={
                                    item.set_cost !== null ? item.set_cost : ""
                                  }
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "set_cost",
                                      e.target.value,
                                    )
                                  }
                                  onBlur={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val))
                                      handleItemChange(
                                        index,
                                        "set_cost",
                                        val.toFixed(2),
                                      );
                                    else
                                      handleItemChange(index, "set_cost", "");
                                  }}
                                  className="w-full text-right bg-transparent outline-none font-mono font-bold text-[13px] text-indigo-600 placeholder:font-sans placeholder:text-slate-300 placeholder:font-normal"
                                  placeholder="自訂"
                                />
                              </div>
                            </div>

                            <div className="w-20 shrink-0 text-right pr-2 pt-0.5">
                              <span className="font-mono text-[15px] font-black text-slate-700">
                                ${subtotal}
                              </span>
                            </div>

                            <div className="w-10 shrink-0 flex justify-center pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {renderProviderQuotesSubRow(
                            item.base_estimated_cost || 0,
                            item.provider_quotes,
                            index,
                          )}
                        </div>

                        {isExpanded && isSemi && item.material_id && (
                          <div className="bg-slate-50/40 border-b border-slate-200 pb-2">
                            {renderNestedRows(
                              item.material_id,
                              itemQty,
                              1,
                              currentPath,
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border border-slate-200/60 bg-slate-50/50 p-6 md:p-8 rounded-2xl shadow-sm min-h-[220px] flex flex-col gap-6">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <FlaskConical
              size={16}
              className="text-orange-500"
              strokeWidth={2.5}
            />
            法定添加物安全試算面板
          </h3>
          {additiveCalculations.results.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl p-8 bg-white/50">
              <FlaskConical size={32} className="mb-3 opacity-20" />
              <span className="text-sm font-bold">
                目前配方中尚無法定添加物
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {additiveCalculations.results.map((add) => {
                const baseQty = parseFloat(formData.base_quantity) || 1;
                const maxAllowedQty = baseQty * (add.limit / 100);
                return (
                  <div
                    key={add.code}
                    className={`flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-300 ${add.isExceeded ? "border-red-300 ring-2 ring-red-500/10" : "border-slate-200"}`}
                  >
                    <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                      <h4 className="font-bold text-slate-800 text-sm truncate pr-2">
                        {add.name}
                      </h4>
                      <span className="bg-white text-slate-500 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-md font-black shrink-0 shadow-sm border border-slate-200">
                        上限 {formatNum(add.limit)}%
                      </span>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="text-[10px] text-slate-400 font-bold mb-2 uppercase tracking-widest">
                        配方貢獻來源
                      </div>
                      <div className="space-y-2 flex-1">
                        {add.sources.map((src, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-baseline text-xs"
                          >
                            <span className="text-slate-700 truncate pr-4 font-semibold">
                              <span className="text-slate-400 mr-1 font-medium">
                                [{src.type === "DIRECT" ? "原料" : "半成品"}]
                              </span>
                              {src.name}
                            </span>
                            <span className="font-mono text-slate-600 font-bold shrink-0">
                              {formatNum(src.qty)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-end">
                        <span className="text-xs font-bold text-slate-500">
                          合計總重 (KG)
                        </span>
                        <span className="text-xl font-mono font-black text-slate-800 leading-none">
                          {formatNum(add.totalQty)}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <div
                          className={`flex items-center gap-1.5 font-bold text-xs tracking-wide ${add.isExceeded ? "text-red-500" : "text-emerald-500"}`}
                        >
                          {add.isExceeded ? (
                            <AlertTriangle size={16} strokeWidth={2.5} />
                          ) : (
                            <CheckCircle2 size={16} strokeWidth={2.5} />
                          )}
                          <span>
                            {add.isExceeded ? "佔比已超標" : "符合安全"}
                          </span>
                        </div>
                        <div className="text-right flex flex-col justify-center">
                          <div
                            className={`text-2xl font-black font-mono leading-none flex items-baseline justify-end ${add.isExceeded ? "text-red-500" : "text-slate-800"}`}
                          >
                            {formatNum(add.usagePercent, 2)}
                            <span className="text-sm ml-0.5 font-bold opacity-50">
                              %
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border border-slate-200/60 bg-slate-50/50 p-6 md:p-8 rounded-2xl shadow-sm min-h-[220px] flex flex-col gap-6">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Camera size={16} className="text-purple-500" strokeWidth={2.5} />
            營養價值預覽
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-start">
            <div className="flex flex-col gap-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 block">
                  預計展開成分清單
                </span>
                <span className="text-sm font-bold text-slate-800 leading-relaxed">
                  {ingredientsText || "無"}
                </span>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 block">
                  自動聯集過敏原宣告
                </span>
                <div className="flex flex-wrap gap-2">
                  {aggregatedAllergens ? (
                    aggregatedAllergens.split(",").map((a, i) => {
                      const match = ALLERGEN_OPTIONS.find(
                        (opt) => opt.value === a,
                      );
                      return (
                        <span
                          key={i}
                          className="bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-lg text-xs font-bold shadow-sm"
                        >
                          {match ? match.label : a}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-sm font-bold text-slate-400">無</span>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-slate-500 font-bold bg-purple-50/50 border border-purple-100 p-4 rounded-xl leading-relaxed">
                💡
                儲存配方時，系統將自動為當前版本建立一份「營養價值副本」，並進入研發審核流程。
                審核通過後，生產單即可於出貨標籤時選擇此版本製作出貨標籤。
              </div>
            </div>
            <div className="flex flex-col items-center justify-center bg-slate-100 p-8 rounded-3xl border border-slate-200/60 shadow-inner w-full lg:w-[320px]">
              <div className="text-sm uppercase font-black text-slate-900 tracking-widest mb-4">
                標籤預覽
              </div>
              <NutritionLabel nutritionData={calculatedNutrition} />
            </div>
          </div>
        </div>

        <div className="bg-white px-6 py-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-wrap items-center gap-6 md:gap-8">
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                總材料成本
              </p>
              <div className="text-slate-800 font-mono font-black text-xl">
                ${formatNum(materialCost, 2)}
              </div>
            </div>

            {formData.type === "PRODUCT" && (
              <>
                <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                    總包材成本
                  </p>
                  <div className="text-slate-800 font-mono font-black text-xl">
                    ${formatNum(packCost, 2)}
                  </div>
                </div>
              </>
            )}

            <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
            <div>
              <p className="text-[#007AFF] text-[10px] font-bold uppercase tracking-widest mb-1">
                生產總成本
              </p>
              <div className="text-[#007AFF] font-mono font-black text-2xl">
                ${formatNum(grandTotal, 2)}
              </div>
            </div>
            <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                用料總重
              </p>
              <div className="flex items-baseline gap-2">
                <div
                  className={`font-mono font-black text-2xl ${calculations.weightDiff < -0.001 ? "text-red-500" : calculations.weightDiff > 0.001 ? "text-amber-500" : "text-emerald-500"}`}
                >
                  {formatNum(calculations.totalWeight, 2)}
                </div>
                <span className="text-slate-500 font-bold text-xs">KG</span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleExportExcel}
              className="w-full md:w-auto px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-lg shadow-sm transition-all font-bold text-sm flex items-center justify-center gap-2"
            >
              <Download size={16} strokeWidth={2.5} /> 匯出 EXCEL
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                additiveCalculations.hasLimitError ||
                claimsAndWarnings.banned.length > 0
              }
              className="w-full md:w-auto px-8 py-2.5 bg-[#007AFF] hover:bg-[#0056b3] text-white rounded-lg shadow-[0_2px_8px_rgba(0,122,255,0.3)] transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Save size={16} strokeWidth={2.5} />{" "}
              {isSubmitting ? "儲存中..." : "儲存配方"}
            </button>
          </div>
        </div>
      </form>
      <CustomDialog isOpen={dialog.isOpen} {...dialog} onClose={closeDialog} />
    </div>
  );
}
