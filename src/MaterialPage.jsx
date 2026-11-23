import React, { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Search,
  AlertCircle,
  Database,
  FlaskConical,
  Trash2,
  Activity,
  CheckCircle2,
  Plus,
  Edit2,
  ShieldCheck,
  PenTool,
  SlidersHorizontal,
  AlignLeft,
  ClipboardCheck,
  Calendar,
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

const getMergedAllergens = (
  manualAllergens = [],
  ingredientsArray = [],
  bomsArray = [],
) => {
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

  bomsArray.forEach((bom) => {
    if (bom.is_active !== false && bom.child_allergen_info) {
      const bomAllergens = bom.child_allergen_info
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      bomAllergens.forEach((a) => merged.add(a));
    }
  });

  return Array.from(merged);
};

const getIngredientsOnlyAllergens = (ingredientsArray = [], bomsArray = []) => {
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

  bomsArray.forEach((bom) => {
    if (bom.is_active !== false && bom.child_allergen_info) {
      const bomAllergens = bom.child_allergen_info
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      bomAllergens.forEach((a) => merged.add(a));
    }
  });

  return Array.from(merged);
};

// 🌟 貼上：標籤專用常數與計算函式
const ALLERGEN_MAP = {
  CRUSTACEAN: "甲殼類",
  MANGO: "芒果",
  PEANUT: "花生",
  MILK: "奶類",
  EGG: "蛋",
  NUT: "堅果類",
  SESAME: "芝麻",
  GLUTEN: "含麩質之穀物",
  SOY: "大豆",
  FISH: "魚類",
  SULFITE: "二氧化硫",
};

const calculateExpDateForLabel = (mfgDateObj, storageLifeStr) => {
  if (!mfgDateObj || isNaN(mfgDateObj.getTime())) return "詳見包裝標示";
  const d = new Date(mfgDateObj);

  let monthsToAdd = 0;
  if (storageLifeStr) {
    const monthMatch = storageLifeStr.match(/(\d+)\s*個月/);
    const yearMatch = storageLifeStr.match(/(\d+)\s*年/);
    const dayMatch = storageLifeStr.match(/(\d+)\s*天/);

    if (monthMatch) monthsToAdd += parseInt(monthMatch[1], 10);
    if (yearMatch) monthsToAdd += parseInt(yearMatch[1], 10) * 12;

    if (monthsToAdd > 0) {
      d.setMonth(d.getMonth() + monthsToAdd);
      d.setDate(d.getDate() - 1);
    } else if (dayMatch) {
      d.setDate(d.getDate() + parseInt(dayMatch[1], 10) - 1);
    }
  }
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

// 🌟 貼上：完整標籤樣板元件
const ProductLabelTemplate = ({
  name,
  ingredientsText,
  allergenInfo,
  nutritionFact,
  spec,
  stickerInfo,
  storageLife,
  storageMethod = "ROOM_TEMP",
  servingSize = 10,
  servingsPerContainer = 100,
}) => {
  const today = new Date();
  const mfgDateDisplay = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  const expDateDisplay = calculateExpDateForLabel(today, storageLife);

  // 過敏原格式化
  const rawAllergens = allergenInfo ? allergenInfo.split(",") : [];
  const activeAllergens = rawAllergens
    .map((a) => ALLERGEN_MAP[a.trim()] || a.trim())
    .filter(Boolean);
  const allergenStr =
    activeAllergens.length > 0 ? `本品含有${activeAllergens.join("、")}` : "";

  // 營養素格式化
  const nut100 = nutritionFact || emptyNutrition;
  const format100g = (val) => parseFloat(val || 0).toFixed(1);
  const calcPerServing = (val) => {
    const num = parseFloat(val || 0);
    if (Number(servingSize) === 100) return num.toFixed(1);
    return ((num / 100) * Number(servingSize)).toFixed(1);
  };

  const NutRow = ({ label, indent, valKey, unit }) => (
    <tr>
      <td className={`text-left py-[3px] ${indent ? "pl-3 text-[11px]" : ""}`}>
        {label}
      </td>
      <td className="py-[3px]">
        <div className="flex justify-end gap-2 w-full pr-1">
          <span>{calcPerServing(nut100[valKey])}</span>
          <span className="w-[28px] text-left">{unit}</span>
        </div>
      </td>
      <td className="py-[3px]">
        <div className="flex justify-end gap-2 w-full">
          <span>{format100g(nut100[valKey])}</span>
          <span className="w-[28px] text-left">{unit}</span>
        </div>
      </td>
    </tr>
  );

  let storageStr =
    "常溫保存，貯存於乾燥陰涼處，避免陽光直射，開封後請儘速使用。";
  if (storageMethod === "REFRIGERATED") {
    storageStr =
      "請冷藏保存於 7°C 以下，離開冷藏請勿超過半小時，開封後請儘速使用完畢。";
  } else if (storageMethod === "FROZEN") {
    storageStr =
      "請冷凍保存於 -18°C 以下，請勿反覆解凍，開封後請儘速使用完畢。";
  }

  const manufacturer = stickerInfo?.manufacturer || "";
  const tel = stickerInfo?.tel || "";
  const fax = stickerInfo?.fax || "";
  const address = stickerInfo?.address || "";

  return (
    <div className="w-[130mm] min-w-[130mm] shrink-0 bg-white p-4 font-sans text-black border-[3px] border-black mx-auto box-border overflow-hidden">
      <div className="text-center font-black text-2xl tracking-widest mb-3 border-b-[3px] border-black pb-2">
        {name || "產品名稱"}
      </div>

      <div className="flex gap-4 text-[11px] leading-tight">
        <div className="w-[55%] flex flex-col gap-1.5 justify-between text-[11px]">
          <div>
            <span className="font-bold">成份：</span>
            {ingredientsText || "無"}
          </div>
          <div className="font-bold text-justify leading-relaxed">
            本產品生產製程廠房，其設備或生產管線有處理甲殼類、芒果、花生、奶類、蛋、堅果類、芝麻、含麩質之穀物、大豆、魚類及二氧化硫
          </div>
          {allergenStr && <div className="font-bold">{allergenStr}</div>}

          <div className="mt-1 flex flex-col gap-1 text-[12px]">
            <div>製造日期：{mfgDateDisplay}</div>
            <div>有效期限：{expDateDisplay}</div>
            <div>包裝規格：{spec || "-"}</div>
            <div>原產地：台灣</div>
            <div>製造商：{manufacturer}</div>
            <div>
              TEL: {tel} {fax ? `FAX: ${fax}` : ""}
            </div>
            <div>{address}</div>
          </div>
          <div className="mt-1 font-bold text-[12px]">{storageStr}</div>
        </div>

        <div className="w-[60%] flex flex-col">
          <div className="border-[2px] border-black p-1.5 flex-1">
            <div className="text-center font-bold text-[15px] border-b-[2px] border-black pb-1 mb-1.5 tracking-widest">
              營養標示
            </div>
            <div className="flex justify-between border-b border-black pb-1 text-[12px]">
              <span>每一份量</span>
              <div className="flex justify-end gap-2 pr-1">
                <span>{servingSize}</span>
                <span className="w-[28px] text-left">公克</span>
              </div>
            </div>
            <div className="flex justify-between border-b-[2px] border-black pb-1 mb-1 text-[12px]">
              <span>本包裝含</span>
              <div className="flex justify-end gap-2 pr-1">
                <span>{servingsPerContainer}</span>
                <span className="w-[28px] text-left">份</span>
              </div>
            </div>
            <table className="w-full text-right mt-1 text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-black">
                  <th className="text-left font-normal pb-1"></th>
                  <th className="font-normal pb-1 text-right pr-[16px]">
                    每份
                  </th>
                  <th className="font-normal pb-1 text-right pr-[12px]">
                    每100公克
                  </th>
                </tr>
              </thead>
              <tbody>
                <NutRow label="熱量" valKey="energy_kcal" unit="大卡" />
                <NutRow label="蛋白質" valKey="protein" unit="公克" />
                <NutRow label="脂肪" valKey="fat" unit="公克" />
                <NutRow
                  label="飽和脂肪"
                  indent
                  valKey="saturated_fat"
                  unit="公克"
                />
                <NutRow
                  label="反式脂肪"
                  indent
                  valKey="trans_fat"
                  unit="公克"
                />
                <NutRow label="碳水化合物" valKey="carbs" unit="公克" />
                <NutRow label="糖" indent valKey="sugar" unit="公克" />
                <NutRow label="鈉" valKey="sodium" unit="毫克" />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const extractBomIngredients = (
  bomsArray,
  material = null,
  allMaterials = [],
) => {
  const rawMap = new Map();
  const visitedSemiIds = new Set();
  const matList = Array.isArray(allMaterials) ? allMaterials : [];

  const findMaterialById = (matId) =>
    matList.find((m) => String(m.id) === String(matId));

  const collectFromBoms = (bomsList, sourceLabel = "") => {
    if (!Array.isArray(bomsList)) return;

    bomsList.forEach((bom) => {
      if (!bom || bom.is_active === false) return;

      if (bom.child_type === "RAW") {
        const key = String(bom.child ?? bom.child_code ?? bom.child_name);
        if (!rawMap.has(key)) {
          const matchedMat = findMaterialById(bom.child);
          rawMap.set(key, {
            id: bom.child ?? key,
            code: bom.child_code || matchedMat?.code || "",
            name: bom.child_name || matchedMat?.name || "",
            is_additive: Boolean(
              matchedMat?.is_additive ?? bom.child_is_additive ?? false,
            ),
            allergen_info:
              bom.child_allergen_info ?? matchedMat?.allergen_info ?? "",
            nutrition_fact:
              bom.child_nutrition_fact &&
              Object.keys(bom.child_nutrition_fact).length > 0
                ? bom.child_nutrition_fact
                : matchedMat?.nutrition_fact || {},
            _from_bom: sourceLabel || bom.child_name || "原料",
          });
        }
      } else if (bom.child_type === "SEMI") {
        const semiId = String(bom.child);
        if (!semiId || visitedSemiIds.has(semiId)) return;
        visitedSemiIds.add(semiId);

        const semiMat = findMaterialById(semiId);
        if (semiMat && Array.isArray(semiMat.boms)) {
          collectFromBoms(
            semiMat.boms,
            bom.child_name || semiMat.name || "半成品",
          );
        }
      }
    });
  };

  if (material?.id != null) {
    visitedSemiIds.add(String(material.id));
  }

  collectFromBoms(bomsArray, material?.name || "");

  return Array.from(rawMap.values());
};

// ==========================================
// 🌟 選項清單定義
// ==========================================
const TYPE_OPTIONS = [
  { value: "RAW", label: "原物料" },
  { value: "SEMI", label: "半成品" },
  { value: "PRODUCT", label: "成品" },
  { value: "PACK", label: "包材" },
  { value: "STICKER", label: "標籤貼紙" },
  { value: "OTHER", label: "其他" },
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

const QC_TYPE_OPTIONS = [
  { value: "range", label: "數值範圍" },
  { value: "boolean", label: "狀態判定 (合格/陰陽性)" },
  { value: "text", label: "純文字描述" },
];

const QC_BOOL_OPTIONS = [
  { value: "NEGATIVE", label: "陰性 (Negative)" },
  { value: "POSITIVE", label: "陽性 (Positive)" },
  { value: "QUALIFIED", label: "合格 (Qualified)" },
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

const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder = "請選擇...",
  disabled = false,
  className = "",
  menuClassName = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectRef.current && !selectRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value),
  );

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold transition-all shadow-sm ${
          disabled
            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
            : "cursor-pointer hover:border-blue-400 text-slate-800"
        } ${isOpen ? "ring-4 ring-blue-500/10 border-blue-500" : ""}`}
      >
        <span
          className={`truncate ${selectedOption ? "text-slate-800" : "text-slate-400"}`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? "rotate-180 text-blue-500" : ""}`}
        />
      </div>
      {isOpen && !disabled && (
        <div
          className={`absolute z-[100] top-[calc(100%+8px)] left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar ${menuClassName}`}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`px-4 py-3 text-sm font-bold cursor-pointer transition-colors ${
                String(value) === String(opt.value)
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

const convertToGrams = (qty, unit) => {
  const u = (unit || "kg").toLowerCase();
  const q = parseFloat(qty) || 0;
  if (u === "kg" || u === "l") return q * 1000;
  if (u === "g" || u === "ml") return q;
  return q;
};

const calculateNutritionFromBOMsAndIngredients = (
  boms,
  ingredients,
  parentUnit,
) => {
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
  let hasActiveBoms = false;

  if (boms && boms.length > 0) {
    boms.forEach((bom) => {
      if (bom.is_active === false) return;
      hasActiveBoms = true;

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

      if (["RAW", "SEMI"].includes(bom.child_type) && childNut) {
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

  const formattedNut = {};

  if (hasActiveBoms) {
    Object.keys(totalNut).forEach((k) => {
      if (baseQtyInGrams > 0) {
        const per100gFinal = totalNut[k] / (baseQtyInGrams / 100);
        formattedNut[k] = parseFloat(per100gFinal.toFixed(2)).toString();
      } else {
        formattedNut[k] = "0";
      }
    });
    return formattedNut;
  }

  if (ingredients && ingredients.length > 0) {
    ingredients.forEach((item) => {
      const detail = item.ingredient_detail || item;
      let ingNut = detail?.nutrition_fact;
      if (typeof ingNut === "string") {
        try {
          ingNut = JSON.parse(ingNut);
        } catch (e) {
          ingNut = {};
        }
      }

      if (ingNut) {
        Object.keys(totalNut).forEach((k) => {
          totalNut[k] += parseFloat(ingNut[k]) || 0;
        });
      }
    });

    Object.keys(totalNut).forEach((k) => {
      formattedNut[k] = parseFloat(totalNut[k].toFixed(2)).toString();
    });
    return formattedNut;
  }

  return emptyNutrition;
};

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

const normalizeQCStandards = (rawArray) => {
  if (!Array.isArray(rawArray)) return [];
  return rawArray.map((std) => {
    const uniqueId =
      std.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);

    if (std.format === "v2") {
      return {
        ...std,
        id: uniqueId,
        target_min:
          std.target_min !== undefined ? std.target_min : std.min || "",
        target_max:
          std.target_max !== undefined ? std.target_max : std.max || "",
      };
    }

    if (std.type === "dilution" || std.type === "custom") {
      return {
        format: "v2",
        id: uniqueId,
        name: std.name || "未命名檢驗",
        type: "text",
        target_text: std.value || "",
      };
    }
    if (
      ["brix", "salt", "moisture"].includes(std.type) ||
      std.type === "range"
    ) {
      return {
        format: "v2",
        id: uniqueId,
        name: std.name || "數值範圍",
        type: "range",
        target_min: std.min || "",
        target_max: std.max || "",
      };
    }
    if (std.type === "boolean") {
      return {
        format: "v2",
        id: uniqueId,
        name: std.name || "狀態判定",
        type: "boolean",
        target_bool: std.target_bool || "NEGATIVE",
      };
    }
    return {
      format: "v2",
      id: uniqueId,
      name: std.name || "自訂檢驗",
      type: "text",
      target_text: std.value || "",
    };
  });
};

const QCCardView = ({ qc }) => {
  if (qc.type === "range") {
    return (
      <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 flex flex-col justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] h-full">
        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <SlidersHorizontal size={12} /> {qc.name}
        </span>
        <div className="flex items-baseline gap-2">
          {qc.target_min || qc.target_max ? (
            <>
              {qc.target_min && (
                <span className="text-xl font-black text-blue-800 font-mono tracking-tight">
                  {qc.target_min}
                </span>
              )}
              {qc.target_min && qc.target_max ? (
                <span className="text-sm font-bold text-blue-400">~</span>
              ) : qc.target_max ? (
                <span className="text-sm font-bold text-blue-500 mr-1">
                  {"<"}
                </span>
              ) : (
                <span className="text-sm font-bold text-blue-500 ml-1">
                  {">"}
                </span>
              )}
              {qc.target_max && (
                <span className="text-xl font-black text-blue-800 font-mono tracking-tight">
                  {qc.target_max}
                </span>
              )}
            </>
          ) : (
            <span className="text-lg font-black text-slate-400">-</span>
          )}
        </div>
      </div>
    );
  }

  if (qc.type === "boolean") {
    const isNegative = qc.target_bool === "NEGATIVE";
    const isPositive = qc.target_bool === "POSITIVE";
    const isQualified = qc.target_bool === "QUALIFIED";
    return (
      <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] h-full">
        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <CheckCircle2 size={12} /> {qc.name}
        </span>
        <div className="flex items-center">
          <span
            className={`text-sm font-black px-3 py-1 rounded-lg border ${
              isNegative
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : isPositive
                  ? "bg-rose-100 text-rose-700 border-rose-200"
                  : isQualified
                    ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
            }`}
          >
            {isNegative
              ? "陰性 (Negative)"
              : isPositive
                ? "陽性 (Positive)"
                : isQualified
                  ? "合格 (Qualified)"
                  : "-"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 flex flex-col justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] h-full">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <AlignLeft size={12} /> {qc.name}
      </span>
      <div className="flex items-center">
        <span className="text-base font-black text-slate-800 break-words">
          {qc.target_text || "-"}
        </span>
      </div>
    </div>
  );
};

export default function MaterialPage() {
  const isRD = useAuthStore((state) => state.isRD());
  const me = useAuthStore((state) => state.me());
  const navigate = useNavigate();
  const [additiveFilter, setAdditiveFilter] = useState("");
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [pendingRejectSnapshotId, setPendingRejectSnapshotId] = useState(null);

  const initialFormData = {
    code: "",
    name: "",
    english_name: "",
    phase: "IN_DEV",
    type: "RAW",
    unit: "KG",
    is_in_house: false,
    pack_capacity: "",
    storage_method: "ROOM_TEMP",
    dietary_type: "",
    allergen_info: [],
    manual_allergen_info: [],
    storage_life: "",
    description: "",
    is_active: true,
    nutrition_fact: emptyNutrition,
    qc_standards: [],
    boms: [],
    ingredients: [],
    is_additive: false,
    legal_limit_percent: "",
    additive_license_no: "",
    license_valid_date: "",
    product_registration_no: "",
    origin: "",
    nutrition_snapshots: [],
    sticker_info: {
      manufacturer: "",
      tel: "",
      fax: "",
      address: "",
    },
  };
  const [formData, setFormData] = useState(initialFormData);

  const [ingSearchTerm, setIngSearchTerm] = useState("");
  const [ingSearchResults, setIngSearchResults] = useState([]);
  const [isIngDropdownOpen, setIsIngDropdownOpen] = useState(false);
  const [isIngTfdaSearching, setIsIngTfdaSearching] = useState(false);
  const ingSearchRef = useRef(null);

  const [ingTfdaQuery, setIngTfdaQuery] = useState("");
  const [ingTfdaResults, setIngTfdaResults] = useState([]);
  const [isIngTfdaDropdownOpen, setIsIngTfdaDropdownOpen] = useState(false);
  const ingTfdaRef = useRef(null);

  const [viewingMaterial, setViewingMaterial] = useState(null);

  const [activeSnapshotId, setActiveSnapshotId] = useState(null);

  const [validityModalOpen, setValidityModalOpen] = useState(false);
  const [validityTargetId, setValidityTargetId] = useState(null);
  const [validityForm, setValidityForm] = useState({
    valid_from: "",
    valid_until: "",
  });

  const submitValidity = async () => {
    if (!validityTargetId) return;
    try {
      const res = await fetchWithAuth(
        `/api/nutrition_snapshots/${validityTargetId}/validity`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validityForm),
        },
      );

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || "設定失敗");
      }

      setValidityModalOpen(false);
      setValidityTargetId(null);

      showAlert("成功", `已成功設定標籤使用區間。`, "success");
      fetchMaterials();

      const updateSnapshots = (snapshots) =>
        snapshots.map((s) =>
          s.id === validityTargetId
            ? {
                ...s,
                valid_from: validityForm.valid_from,
                valid_until: validityForm.valid_until,
              }
            : s,
        );

      setFormData((prev) => ({
        ...prev,
        nutrition_snapshots: updateSnapshots(prev.nutrition_snapshots),
      }));

      if (viewingMaterial) {
        setViewingMaterial((prev) => ({
          ...prev,
          nutrition_snapshots: updateSnapshots(prev.nutrition_snapshots),
        }));
      }
    } catch (err) {
      setValidityModalOpen(false);
      showAlert("發生錯誤", err.message, "error");
    }
  };

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
      const json = await response.json();
      setMaterials(json.data || json || []);
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
    if (isModalOpen || viewingMaterial) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
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

  const handleAddQC = () => {
    setFormData((prev) => ({
      ...prev,
      qc_standards: [
        ...(prev.qc_standards || []),
        {
          format: "v2",
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          name: "",
          type: "range",
          target_min: "",
          target_max: "",
          target_text: "",
          target_bool: "NEGATIVE",
        },
      ],
    }));
  };

  const handleUpdateQC = (id, field, value) => {
    setFormData((prev) => {
      const updated = prev.qc_standards.map((qc) => {
        if (qc.id === id) {
          return { ...qc, [field]: value };
        }
        return qc;
      });
      return { ...prev, qc_standards: updated };
    });
  };

  const handleRemoveQC = (id) => {
    setFormData((prev) => ({
      ...prev,
      qc_standards: prev.qc_standards.filter((qc) => qc.id !== id),
    }));
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

  // 🌟 成分即為 type === "RAW" 的 Material，直接從 materials 或搜尋 API 取得 RAW 物料
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (ingSearchTerm.trim()) {
        try {
          const matRes = await fetchWithAuth(
            `/api/materials?search=${encodeURIComponent(ingSearchTerm)}&type=RAW&lite=true`,
          );

          if (matRes.ok) {
            const json = await matRes.json();
            const items = json.results || json.data || json || [];
            const rawItems = items.filter((m) => m.type === "RAW");
            setIngSearchResults(rawItems);
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

  const handleAddRawMaterialAsIngredient = (rawMat) => {
    if (formData.ingredients.find((i) => i.id === rawMat.id)) {
      showAlert("提示", "此原料成分已在清單中", "info");
      return;
    }
    const updatedIngredients = [...formData.ingredients, rawMat];

    const newAllergens = getMergedAllergens(
      formData.manual_allergen_info,
      updatedIngredients,
      formData.boms,
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

  const handleRemoveIngredientFromMaterial = (ingId) => {
    const updatedIngredients = formData.ingredients.filter(
      (i) => i.id !== ingId,
    );
    const newAllergens = getMergedAllergens(
      formData.manual_allergen_info,
      updatedIngredients,
      formData.boms,
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

      const newAllergenInfo = getMergedAllergens(
        newManualAllergens,
        prev.ingredients,
        prev.boms,
      );

      return {
        ...prev,
        manual_allergen_info: newManualAllergens,
        allergen_info: newAllergenInfo,
      };
    });
  };

  const handleIngTfdaSearch = async () => {
    const query = (ingTfdaQuery || formData.name).trim();
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

  const handleApplyIngTfdaResult = (item) => {
    const autoAllergens = autoDetectAllergens(item.name || "");
    const mergedAllergens = Array.from(
      new Set([...formData.allergen_info, ...autoAllergens]),
    );

    setIngTfdaQuery(item.name);

    setFormData((prev) => ({
      ...prev,
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

  const handleOpenViewModal = (material) => {
    const extractedIngredients =
      material.ingredients?.map((i) => i.ingredient_detail || i) || [];

    let displayNut = material.nutrition_fact || emptyNutrition;
    if (
      ["SEMI", "PRODUCT"].includes(material.type) &&
      isNutritionEmpty(displayNut)
    ) {
      displayNut = calculateNutritionFromBOMsAndIngredients(
        material.boms || [],
        extractedIngredients,
        material.unit,
      );
    }

    const finalBomIngredients = extractBomIngredients(
      material.boms || [],
      material,
      materials,
    );
    const displayQC = normalizeQCStandards(material.qc_standards);

    setViewingMaterial({
      ...material,
      display_nutrition: displayNut,
      display_ingredients: extractedIngredients,
      display_bom_ingredients: finalBomIngredients,
      display_qc: displayQC,
    });

    if (
      material.nutrition_snapshots &&
      material.nutrition_snapshots.length > 0
    ) {
      setActiveSnapshotId(material.nutrition_snapshots[0].id);
    } else {
      setActiveSnapshotId(null);
    }
  };

  const handleOpenAddModal = () => {
    if (!isRD)
      return showAlert("權限不足", "僅有研發部可以新增物料。", "warning");
    setEditingId(null);
    setFormData(initialFormData);
    setIngTfdaQuery("");
    setIngTfdaResults([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (material) => {
    if (!isRD)
      return showAlert("權限不足", "僅有研發部可以編輯物料。", "warning");
    setEditingId(material.id);

    const parsedIngredients =
      material.ingredients?.map((i) => i.ingredient_detail || i) || [];
    const dbAllergens = material.allergen_info
      ? material.allergen_info.split(",").map((s) => s.trim())
      : [];

    const ingAllergens = getIngredientsOnlyAllergens(
      parsedIngredients,
      material.boms || [],
    );

    const manualAllergens = dbAllergens.filter(
      (a) => !ingAllergens.includes(a),
    );

    let editNut = material.nutrition_fact || emptyNutrition;
    if (
      ["SEMI", "PRODUCT"].includes(material.type) &&
      isNutritionEmpty(editNut)
    ) {
      editNut = calculateNutritionFromBOMsAndIngredients(
        material.boms || [],
        parsedIngredients,
        material.unit,
      );
    }

    const editQC = normalizeQCStandards(material.qc_standards);

    setFormData({
      ...material,
      english_name: material.english_name || "",
      pack_capacity:
        material.pack_capacity != null
          ? parseFloat(material.pack_capacity).toString()
          : "",
      is_in_house: Boolean(material.is_in_house),
      storage_method: material.storage_method || "ROOM_TEMP",
      dietary_type: material.dietary_type || "",
      description: material.description || "",
      is_active: material.is_active !== false,
      product_registration_no: material.product_registration_no || "",
      allergen_info: dbAllergens,
      manual_allergen_info: manualAllergens,
      nutrition_fact: editNut,
      ingredients: parsedIngredients,
      boms: material.boms || [],
      is_additive: Boolean(material.is_additive),
      legal_limit_percent:
        material.legal_limit_percent != null
          ? parseFloat(material.legal_limit_percent).toString()
          : "",
      additive_license_no: material.additive_license_no || "",
      license_valid_date: material.license_valid_date || "",
      origin: material.origin || "",
      qc_standards: editQC,
      storage_life: material.storage_life || "",
      nutrition_snapshots: material.nutrition_snapshots || [],
      sticker_info: material.sticker_info || {
        manufacturer: "",
        tel: "",
        fax: "",
        address: "",
      },
    });

    setIngTfdaQuery(material.name || "");
    setIngTfdaResults([]);

    if (
      material.nutrition_snapshots &&
      material.nutrition_snapshots.length > 0
    ) {
      setActiveSnapshotId(material.nutrition_snapshots[0].id);
    } else {
      setActiveSnapshotId(null);
    }

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

        const cleanQC = formData.qc_standards
          .filter((q) => q.name.trim() !== "")
          .map((q) => {
            if (q.type === "range")
              return {
                id: q.id,
                format: "v2",
                type: "range",
                name: q.name,
                target_min: q.target_min,
                target_max: q.target_max,
              };
            if (q.type === "boolean")
              return {
                id: q.id,
                format: "v2",
                type: "boolean",
                name: q.name,
                target_bool: q.target_bool,
              };
            return {
              id: q.id,
              format: "v2",
              type: "text",
              name: q.name,
              target_text: q.target_text,
            };
          });

        const payload = {
          ...formData,
          is_in_house:
            formData.type === "PRODUCT" ? Boolean(formData.is_in_house) : false,
          dietary_type: formData.dietary_type || null,
          allergen_info: formData.allergen_info.join(","),
          nutrition_fact: finalNutrition,
          ingredients: payloadIngredients,
          is_additive:
            formData.type === "RAW" ? Boolean(isAdditiveChecked) : false,
          legal_limit_percent:
            formData.type === "RAW" && isAdditiveChecked
              ? formData.legal_limit_percent || null
              : null,
          additive_license_no:
            formData.type === "RAW" && formData.is_additive
              ? formData.additive_license_no || ""
              : "",
          license_valid_date:
            formData.type === "RAW" &&
            formData.is_additive &&
            formData.license_valid_date
              ? formData.license_valid_date
              : null,
          pack_capacity:
            formData.type === "PACK" ? formData.pack_capacity : null,
          qc_standards: cleanQC,
          sticker_info:
            formData.type === "STICKER" ? formData.sticker_info : null,
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

  const submitSnapshotReview = async () => {
    if (!pendingRejectSnapshotId) return;

    try {
      const res = await fetchWithAuth(
        `/api/nutrition_snapshots/${pendingRejectSnapshotId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            review_note: rejectNote.trim(),
          }),
        },
      );

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || "審核失敗");
      }

      showAlert("退回成功", `已成功退回該快照版本。`, "success");
      fetchMaterials();

      const now = new Date().toISOString();

      const updateSnapshot = (s) =>
        s.id === pendingRejectSnapshotId
          ? {
              ...s,
              status: "REJECTED",
              review_note: rejectNote.trim(),
              reviewed_at: now,
              reviewer_name: me.full_name,
            }
          : s;

      setFormData((prev) => ({
        ...prev,
        nutrition_snapshots: prev.nutrition_snapshots.map(updateSnapshot),
      }));

      if (viewingMaterial) {
        setViewingMaterial((prev) => ({
          ...prev,
          nutrition_snapshots: prev.nutrition_snapshots.map(updateSnapshot),
        }));
      }

      setRejectModalOpen(false);
      setPendingRejectSnapshotId(null);
      setRejectNote("");
    } catch (err) {
      showAlert("發生錯誤", err.message, "error");
    }
  };

  const handleReviewSnapshot = async (snapshotId, actionType) => {
    if (actionType === "reject") {
      setPendingRejectSnapshotId(snapshotId);
      setRejectNote("");
      setRejectModalOpen(true);
      return;
    }

    try {
      const res = await fetchWithAuth(
        `/api/nutrition_snapshots/${snapshotId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve", review_note: "" }),
        },
      );

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || "審核失敗");
      }

      showAlert("審核成功", `已成功核准該快照版本。`, "success");
      fetchMaterials();

      const now = new Date().toISOString();

      const updateSnapshot = (s) =>
        s.id === snapshotId
          ? {
              ...s,
              status: "APPROVED",
              reviewed_at: now,
              reviewer_name: me.full_name,
            }
          : s;

      setFormData((prev) => ({
        ...prev,
        nutrition_snapshots: prev.nutrition_snapshots.map(updateSnapshot),
      }));

      if (viewingMaterial) {
        setViewingMaterial((prev) => ({
          ...prev,
          nutrition_snapshots: prev.nutrition_snapshots.map(updateSnapshot),
        }));
      }
    } catch (err) {
      showAlert("發生錯誤", err.message, "error");
    }
  };

  const isRawAdditiveIncomplete = (mat) => {
    if (!mat || mat.type !== "RAW" || !mat.is_additive) return false;
    const missingLimit =
      mat.legal_limit_percent === null ||
      mat.legal_limit_percent === undefined ||
      String(mat.legal_limit_percent).trim() === "";
    const missingLicenseNo =
      !mat.additive_license_no || String(mat.additive_license_no).trim() === "";
    const missingValidDate =
      !mat.license_valid_date || String(mat.license_valid_date).trim() === "";
    return missingLimit || missingLicenseNo || missingValidDate;
  };

  const isRawLicenseExpiringOrExpired = (mat, daysThreshold = 14) => {
    if (!mat || mat.type !== "RAW" || !mat.license_valid_date) return false;
    const targetDate = new Date(
      `${String(mat.license_valid_date).slice(0, 10)}T23:59:59`,
    );
    if (isNaN(targetDate.getTime())) return false;

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const deadline = new Date(todayStart);
    deadline.setDate(deadline.getDate() - daysThreshold);
    deadline.setHours(23, 59, 59, 999);

    return targetDate.getTime() <= deadline.getTime();
  };

  const filteredMaterials = useMemo(() => {
    const list = Array.isArray(materials) ? materials : [];
    return list.filter((mat) => {
      const matchSearch =
        mat.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === "" ? true : mat.type === filterType;
      const matchAdditive =
        additiveFilter === "INCOMPLETE"
          ? isRawAdditiveIncomplete(mat)
          : additiveFilter === "EXPIRING"
            ? isRawLicenseExpiringOrExpired(mat, 14)
            : true;
      return matchSearch && matchType && matchAdditive;
    });
  }, [materials, searchTerm, filterType, additiveFilter]);

  const totalPages = Math.ceil(filteredMaterials.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = filteredMaterials.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const hasAdditiveIngredient = useMemo(() => {
    if (formData.type !== "RAW" || !Array.isArray(formData.ingredients)) {
      return false;
    }
    return formData.ingredients.some((ing) =>
      Boolean(ing?.is_additive || ing?.ingredient_detail?.is_additive),
    );
  }, [formData.type, formData.ingredients]);

  const isAdditiveChecked =
    Boolean(formData.is_additive) || hasAdditiveIngredient;

  const formBomIngredients = useMemo(() => {
    return extractBomIngredients(formData.boms, formData, materials);
  }, [formData.boms, formData, materials]);

  const additiveAlertsCount = useMemo(() => {
    const list = Array.isArray(materials) ? materials : [];
    let incompleteCount = 0;
    let expiringCount = 0;

    list.forEach((mat) => {
      if (isRawAdditiveIncomplete(mat)) incompleteCount += 1;
      if (isRawLicenseExpiringOrExpired(mat, 14)) expiringCount += 1;
    });

    return { incompleteCount, expiringCount };
  }, [materials]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, additiveFilter]);
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
            配方過敏原與成分將會
            <strong className="text-blue-700">自動從「配方」展開算出</strong>
            ，免除人工遺漏。
          </li>
          <li>
            半成品與成品{" "}
            <strong className="text-blue-700">
              預設自動依「配方」展開計算營養素
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
          <div className="relative w-full sm:w-40">
            <CustomSelect
              options={[{ label: "所有類型", value: "" }, ...TYPE_OPTIONS]}
              value={filterType}
              onChange={(val) => setFilterType(val)}
              placeholder="所有類型"
              className="py-0.5"
            />
          </div>
          <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer hover:border-rose-300 shadow-sm select-none">
            <input
              type="checkbox"
              checked={additiveFilter === "INCOMPLETE"}
              onChange={(e) =>
                setAdditiveFilter(e.target.checked ? "INCOMPLETE" : "")
              }
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span>添加物資料缺漏</span>
            {additiveAlertsCount.incompleteCount > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-black text-white bg-rose-600 rounded-full">
                {additiveAlertsCount.incompleteCount}
              </span>
            )}
          </label>

          <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer hover:border-rose-300 shadow-sm select-none">
            <input
              type="checkbox"
              checked={additiveFilter === "EXPIRING"}
              onChange={(e) =>
                setAdditiveFilter(e.target.checked ? "EXPIRING" : "")
              }
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span>許可證即將/已到期(14天)</span>
            {additiveAlertsCount.expiringCount > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-black text-white bg-rose-600 rounded-full">
                {additiveAlertsCount.expiringCount}
              </span>
            )}
          </label>
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
                      {(mat.is_additive ||
                        (mat.ingredients &&
                          mat.ingredients.some(
                            (i) =>
                              i.ingredient_detail?.is_additive || i.is_additive,
                          ))) && (
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
                        {isRD && ["PRODUCT", "SEMI"].includes(mat.type) ? (
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
          <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200/50">
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

            <div className="p-6 md:p-8 pb-16 overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex flex-col gap-8">
                <div className="w-full space-y-6">
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
                      {viewingMaterial.type === "RAW" && (
                        <>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                              是否為法定添加物
                            </span>
                            <span
                              className={`text-sm font-bold ${
                                viewingMaterial.is_additive ||
                                viewingMaterial.display_ingredients?.some(
                                  (ing) => ing?.is_additive,
                                )
                                  ? "text-red-600"
                                  : "text-slate-500"
                              }`}
                            >
                              {viewingMaterial.is_additive ||
                              viewingMaterial.display_ingredients?.some(
                                (ing) => ing?.is_additive,
                              )
                                ? "是"
                                : "否"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                              法定上限 (%)
                            </span>
                            <span className="text-sm font-bold text-slate-800 font-mono">
                              {viewingMaterial.legal_limit_percent != null &&
                              viewingMaterial.legal_limit_percent !== ""
                                ? `${formatDisplayNum(viewingMaterial.legal_limit_percent)}%`
                                : "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                              許可證字號
                            </span>
                            <span className="text-sm font-bold text-slate-800 font-mono">
                              {viewingMaterial.additive_license_no || "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                              許可證效期
                            </span>
                            <span className="text-sm font-bold text-slate-800 font-mono">
                              {viewingMaterial.license_valid_date || "-"}
                            </span>
                          </div>
                        </>
                      )}
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
                  {/* STICKER 標籤廠商資訊展示區塊 */}
                  {viewingMaterial.type === "STICKER" &&
                    viewingMaterial.sticker_info && (
                      <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                          標籤顯示資訊
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400/80 mb-1 block">
                              製造商
                            </span>
                            <span className="text-sm font-bold text-slate-800">
                              {viewingMaterial.sticker_info.manufacturer || "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400/80 mb-1 block">
                              電話
                            </span>
                            <span className="text-sm font-bold text-slate-800 font-mono">
                              {viewingMaterial.sticker_info.tel || "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400/80 mb-1 block">
                              傳真
                            </span>
                            <span className="text-sm font-bold text-slate-800 font-mono">
                              {viewingMaterial.sticker_info.fax || "-"}
                            </span>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400/80 mb-1 block">
                              地址
                            </span>
                            <span className="text-sm font-bold text-slate-800">
                              {viewingMaterial.sticker_info.address || "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                  <HistoricalPriceChart
                    materialId={viewingMaterial.id}
                    materialType={viewingMaterial.type}
                  />

                  {["RAW", "SEMI", "PRODUCT"].includes(
                    viewingMaterial.type,
                  ) && (
                    <>
                      <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <h4 className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                          成分展開清單
                        </h4>

                        {(viewingMaterial.display_ingredients &&
                          viewingMaterial.display_ingredients.length > 0) ||
                        (viewingMaterial.display_bom_ingredients &&
                          viewingMaterial.display_bom_ingredients.length >
                            0) ? (
                          <div className="flex flex-wrap gap-2">
                            {viewingMaterial.display_ingredients?.map(
                              (ing, idx) => (
                                <span
                                  key={`manual-${idx}`}
                                  className="bg-amber-50 text-amber-900 border border-amber-200 pl-3 pr-2 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2"
                                >
                                  <span>{ing.name}</span>
                                  <div className="flex items-center gap-1.5 border-l border-amber-200/80 pl-2 ml-0.5">
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
                              ),
                            )}

                            {viewingMaterial.display_bom_ingredients?.map(
                              (ing, idx) => (
                                <span
                                  key={`bom-${idx}`}
                                  className="bg-slate-50 text-slate-600 border border-slate-200 pl-3 pr-2 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2"
                                  title={`來自配方: ${ing._from_bom}`}
                                >
                                  <span>{ing.name}</span>
                                  <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2 ml-0.5">
                                    <span className="text-[10px] bg-slate-200/70 text-slate-500 border border-slate-300 px-1.5 py-0.5 rounded-md tracking-wider">
                                      配方自動帶入
                                    </span>
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

                        {viewingMaterial.display_qc &&
                        viewingMaterial.display_qc.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {viewingMaterial.display_qc.map((qc) => (
                              <QCCardView key={qc.id} qc={qc} />
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400 font-bold py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                            尚未設定任何品管檢驗標準
                          </div>
                        )}
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

                {/* 下半部：Snapshot 標籤預覽面板 (水平滑動) */}
                {["PRODUCT"].includes(viewingMaterial.type) && (
                  <div className="w-full space-y-6">
                    {viewingMaterial.nutrition_snapshots &&
                      viewingMaterial.nutrition_snapshots.length > 0 && (
                        <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative flex flex-col items-start overflow-hidden">
                          <h4 className="text-[11px] font-black text-purple-600 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2 w-full text-center">
                            營養價值履歷與標籤預覽
                          </h4>

                          <div className="flex overflow-x-auto w-full gap-6 pb-4 snap-x custom-scrollbar items-stretch">
                            {viewingMaterial.nutrition_snapshots.map((snap) => {
                              const isPending = snap.status === "PENDING";
                              const isApproved = snap.status === "APPROVED";
                              const isRejected = snap.status === "REJECTED";

                              return (
                                <div
                                  key={snap.id}
                                  className="shrink-0 w-[560px] snap-center p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-4 relative"
                                >
                                  <div>
                                    <div className="flex flex-row justify-between items-start mb-2">
                                      <div className="flex items-center font-mono font-bold text-lg text-slate-800">
                                        <div className="flex">
                                          {snap.version_num}
                                        </div>
                                        <div className="flex ml-1 text-sm">
                                          {snap.valid_from ||
                                          snap.valid_until ? (
                                            <div className="text-indigo-600 font-bold">
                                              使用區間:{" "}
                                              {snap.valid_from || "未指定"}{" "}
                                              {snap.valid_until
                                                ? `~ ${snap.valid_until}`
                                                : "(永久有效)"}
                                            </div>
                                          ) : (
                                            isApproved && (
                                              <div className="text-slate-400 font-bold">
                                                尚未設定使用區間
                                              </div>
                                            )
                                          )}
                                        </div>
                                      </div>
                                      <span
                                        className={`text-[10px] font-black px-2 py-0.5 rounded ${isPending ? "bg-amber-100 text-amber-700" : isApproved ? "bg-emerald-100 text-emerald-700" : isRejected ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}
                                      >
                                        {isPending
                                          ? "待審核"
                                          : isApproved
                                            ? "已核准"
                                            : isRejected
                                              ? "已退回"
                                              : "已封存"}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 space-y-0.5">
                                      <div>
                                        建立者: {snap.creator_name} (
                                        {new Date(
                                          snap.created_at,
                                        ).toLocaleDateString()}
                                        )
                                      </div>
                                      {snap.reviewed_by && (
                                        <div>
                                          審核者: {snap.reviewer_name} (
                                          {new Date(
                                            snap.reviewed_at,
                                          ).toLocaleDateString()}
                                          )
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* 🌟 渲染詳細標籤 */}
                                  <div className="flex-1 flex justify-center bg-slate-100 py-4 rounded-xl border border-slate-200 overflow-hidden">
                                    <div className="origin-top flex justify-center">
                                      {["PRODUCT", "SEMI"].includes(
                                        viewingMaterial.type,
                                      ) ? (
                                        <ProductLabelTemplate
                                          name={viewingMaterial.name}
                                          ingredientsText={
                                            snap.ingredients_text || ""
                                          }
                                          allergenInfo={
                                            snap.allergen_info ||
                                            viewingMaterial.allergen_info
                                          }
                                          nutritionFact={snap.nutrition_fact}
                                          spec={snap.label_info?.spec || ""}
                                          stickerInfo={
                                            snap.label_info ||
                                            viewingMaterial.sticker_info
                                          }
                                          storageLife={
                                            viewingMaterial.storage_life
                                          }
                                          storageMethod={
                                            viewingMaterial.storage_method
                                          }
                                          servingSize={
                                            snap.label_info?.servingSize ||
                                            viewingMaterial.sticker_info
                                              ?.servingSize ||
                                            10
                                          }
                                          servingsPerContainer={
                                            snap.label_info
                                              ?.servingsPerContainer ||
                                            viewingMaterial.sticker_info
                                              ?.servingsPerContainer ||
                                            100
                                          }
                                        />
                                      ) : (
                                        <NutritionLabel
                                          nutritionData={snap.nutrition_fact}
                                        />
                                      )}
                                    </div>
                                  </div>

                                  {snap.review_note && (
                                    <div className="mt-2 text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                                      備註: {snap.review_note}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {(!viewingMaterial.nutrition_snapshots ||
                      viewingMaterial.nutrition_snapshots.length === 0) && (
                      <div className="bg-slate-100 p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-inner flex flex-col items-center justify-center min-h-[300px] relative">
                        <div className="text-center">
                          <FlaskConical
                            size={48}
                            className="text-slate-300 mx-auto mb-4"
                          />
                          <div className="text-lg font-bold text-slate-600 mb-2">
                            尚無標籤資料
                          </div>
                        </div>
                      </div>
                    )}
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
                      <CustomSelect
                        options={TYPE_OPTIONS}
                        value={formData.type}
                        onChange={(val) =>
                          setFormData((prev) => ({ ...prev, type: val }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        使用階段
                      </label>
                      <CustomSelect
                        options={PHASE_OPTIONS}
                        value={formData.phase}
                        onChange={(val) =>
                          setFormData((prev) => ({ ...prev, phase: val }))
                        }
                      />
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
                      <CustomSelect
                        options={STORAGE_OPTIONS}
                        value={formData.storage_method}
                        onChange={(val) =>
                          setFormData((prev) => ({
                            ...prev,
                            storage_method: val,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                        素食類別
                      </label>
                      <CustomSelect
                        options={[
                          { label: "未設定", value: "" },
                          ...DIETARY_OPTIONS,
                        ]}
                        value={formData.dietary_type}
                        onChange={(val) =>
                          setFormData((prev) => ({
                            ...prev,
                            dietary_type: val,
                          }))
                        }
                        placeholder="未設定"
                      />
                    </div>
                    {formData.type === "PRODUCT" && (
                      <div className="flex items-center pt-6">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(formData.is_in_house)}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                is_in_house: e.target.checked,
                              }))
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          <span className="ml-3 text-sm font-bold text-slate-700">
                            是否開放廠內自製
                          </span>
                        </label>
                      </div>
                    )}
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

                {/* STICKER 標籤廠商資訊輸入區塊 */}
                {formData.type === "STICKER" && (
                  <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] animate-in fade-in">
                    <h4 className="text-[11px] font-black text-rose-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                      標籤顯示資訊
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                          製造商 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.sticker_info?.manufacturer || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              sticker_info: {
                                ...prev.sticker_info,
                                manufacturer: e.target.value,
                              },
                            }))
                          }
                          required={formData.type === "STICKER"}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                          電話 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.sticker_info?.tel || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              sticker_info: {
                                ...prev.sticker_info,
                                tel: e.target.value,
                              },
                            }))
                          }
                          required={formData.type === "STICKER"}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                          傳真
                        </label>
                        <input
                          type="text"
                          value={formData.sticker_info?.fax || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              sticker_info: {
                                ...prev.sticker_info,
                                fax: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                          placeholder=""
                        />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                          地址 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.sticker_info?.address || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              sticker_info: {
                                ...prev.sticker_info,
                                address: e.target.value,
                              },
                            }))
                          }
                          required={formData.type === "STICKER"}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                          placeholder=""
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 🌟 成分展開清單區塊：僅 RAW / SEMI / PRODUCT 顯示；PACK / STICKER / OTHER 預設隱藏 */}
                {["RAW", "SEMI", "PRODUCT"].includes(formData.type) && (
                  <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] relative overflow-visible">
                    <h4 className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                      成分展開清單
                      {formData.type === "RAW" && (
                        <span className="text-xs font-medium text-slate-400 normal-case tracking-normal">
                          ※ 原物料成分即為 RAW
                          物料，可搜尋加入原料並設定添加物與營養價值
                        </span>
                      )}
                      {formData.type === "SEMI" && (
                        <span className="text-xs font-medium text-slate-400 normal-case tracking-normal">
                          ※ 半成品成分為唯讀，自動依配方展開
                        </span>
                      )}
                      {formData.type === "PRODUCT" && (
                        <span className="text-xs font-medium text-slate-400 normal-case tracking-normal">
                          ※ 成品先關聯半成品，再自動展開成分清單
                        </span>
                      )}
                    </h4>

                    {/* 已加入 / 展開的成分標籤（保留「是否為添加物」標籤） */}
                    <div className="mb-5 flex flex-wrap gap-2">
                      {formData.type === "RAW" &&
                        formData.ingredients.map((ing) => (
                          <span
                            key={`manual-edit-${ing.id}`}
                            className="bg-amber-50 text-amber-900 border border-amber-200 pl-3 pr-1 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 group transition-all hover:shadow-md"
                          >
                            <span className="flex items-center gap-2">
                              <span>{ing.name}</span>
                              {ing.is_additive && (
                                <div className="flex items-center gap-1.5 border-l border-amber-200/80 pl-2 ml-0.5">
                                  <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-md tracking-wider">
                                    添加物
                                  </span>
                                </div>
                              )}
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

                      {["SEMI", "PRODUCT"].includes(formData.type) &&
                        (formBomIngredients.length > 0 ? (
                          formBomIngredients.map((ing) => (
                            <span
                              key={`bom-edit-${ing.id}`}
                              className="bg-slate-50 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2"
                              title={
                                ing._from_bom
                                  ? `來源: ${ing._from_bom}`
                                  : undefined
                              }
                            >
                              <span>{ing.name}</span>
                              {ing.is_additive && (
                                <div className="flex items-center border-l border-slate-200 pl-2 ml-0.5">
                                  <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-md tracking-wider">
                                    添加物
                                  </span>
                                </div>
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm font-bold text-slate-400">
                            尚無可展開的成分
                          </span>
                        ))}
                    </div>

                    {/* 僅 RAW 顯示 Search Bar 與原本 Modal 內的輸入 Form（SEMI / PRODUCT 不顯示 Search Bar） */}
                    {formData.type === "RAW" && (
                      <>
                        <div className="relative mb-6" ref={ingSearchRef}>
                          <div className="flex gap-3">
                            <div className="relative flex-1">
                              <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                size={16}
                              />
                              <input
                                type="text"
                                value={ingSearchTerm}
                                onChange={(e) =>
                                  setIngSearchTerm(e.target.value)
                                }
                                placeholder="搜尋並加入原料成分 (名稱或代號)..."
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 text-sm font-bold text-slate-800 transition-all shadow-sm"
                              />
                            </div>
                          </div>
                          {isIngDropdownOpen && (
                            <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl max-h-60 overflow-y-auto z-20 divide-y divide-slate-100">
                              {ingSearchResults.length > 0 ? (
                                ingSearchResults.map((res) => (
                                  <div
                                    key={`raw-mat-${res.id}`}
                                    onClick={() =>
                                      handleAddRawMaterialAsIngredient(res)
                                    }
                                    className="p-4 hover:bg-amber-50 cursor-pointer transition-colors group flex justify-between items-center"
                                  >
                                    <div>
                                      <div className="font-bold text-slate-800 text-sm group-hover:text-amber-700 mb-1 flex items-center gap-1.5">
                                        <Database
                                          size={14}
                                          className="text-purple-500"
                                          title="原物料 (RAW)"
                                        />
                                        {res.name}
                                        {res.is_additive && (
                                          <span className="ml-2 text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded">
                                            添加物
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-mono">
                                        物料代號: {res.code}
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
                                  找不到相符的原物料
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 原成分 Sub-Modal 內嵌表單：是否為添加物、TFDA、營養價值 */}
                        <div className="border-t border-slate-100 pt-5 space-y-5">
                          <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 relative">
                            <div className="flex items-center">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(formData.is_additive)}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      is_additive: e.target.checked,
                                    }))
                                  }
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                                <span className="ml-3 text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                                  此物料屬於「法定添加物」
                                </span>
                              </label>
                              {hasAdditiveIngredient && (
                                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                                  成分包含添加物
                                </span>
                              )}
                            </div>

                            {isAdditiveChecked && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in pt-4">
                                <div>
                                  <label className="block text-[10px] font-bold text-indigo-500 mb-1.5 uppercase">
                                    法定上限 (%)
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={formData.legal_limit_percent}
                                    onChange={(e) =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        legal_limit_percent: e.target.value,
                                      }))
                                    }
                                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-sm font-bold text-slate-800 bg-white"
                                    placeholder="例如: 2.0"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-indigo-500 mb-1.5 uppercase">
                                    許可證字號
                                  </label>
                                  <input
                                    type="text"
                                    value={formData.additive_license_no}
                                    onChange={(e) =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        additive_license_no: e.target.value,
                                      }))
                                    }
                                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-sm font-bold text-slate-800 bg-white"
                                    placeholder="衛部添製字第..."
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="block text-[10px] font-bold text-indigo-500 mb-1.5 uppercase">
                                    許可證效期
                                  </label>
                                  <input
                                    type="date"
                                    value={formData.license_valid_date || ""}
                                    onChange={(e) =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        license_valid_date: e.target.value,
                                      }))
                                    }
                                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none text-sm font-bold text-slate-800 bg-white"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                            <label className="block text-[11px] font-bold text-blue-700 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                              <Database size={14} /> 從 TFDA 國家資料庫帶入數據
                              (選填)
                              <span className="text-[10px] text-blue-500 font-normal ml-2 tracking-normal">
                                ※ TFDA 搜尋時會自動忽略括號內文字 (如:
                                複合原料展開)
                              </span>
                            </label>
                            <div className="relative" ref={ingTfdaRef}>
                              <div className="flex gap-3">
                                <input
                                  type="text"
                                  value={ingTfdaQuery}
                                  onChange={(e) =>
                                    setIngTfdaQuery(e.target.value)
                                  }
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
                              {isIngTfdaDropdownOpen &&
                                ingTfdaResults.length > 0 && (
                                  <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl max-h-48 overflow-y-auto z-20 divide-y divide-slate-100">
                                    {ingTfdaResults.map((res) => (
                                      <div
                                        key={res.code}
                                        onClick={() =>
                                          handleApplyIngTfdaResult(res)
                                        }
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
                                          熱: {res.energy_kcal} / 蛋:{" "}
                                          {res.protein} / 脂: {res.fat} / 碳:{" "}
                                          {res.carbs}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
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
                                    value={
                                      formData.nutrition_fact?.[item.id] ?? "0"
                                    }
                                    onChange={(e) =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        nutrition_fact: {
                                          ...prev.nutrition_fact,
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
                      </>
                    )}
                  </div>
                )}

                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                  <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-2">
                    <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Activity size={14} /> 廠內品管與檢驗標準
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddQC}
                      className="px-4 py-1.5 bg-[#007AFF] text-white text-xs font-black rounded-lg hover:bg-[#0056b3] transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <Plus size={14} /> 新增項目
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formData.qc_standards?.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col lg:flex-row gap-4 items-start lg:items-center animate-in slide-in-from-top-2"
                      >
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            handleUpdateQC(item.id, "name", e.target.value)
                          }
                          placeholder="項目名稱 (如: 糖度, 外觀...)"
                          className="w-full lg:w-[220px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <div className="relative shrink-0 w-full lg:w-[180px]">
                          <CustomSelect
                            options={QC_TYPE_OPTIONS}
                            value={item.type}
                            onChange={(val) =>
                              handleUpdateQC(item.id, "type", val)
                            }
                            className="py-0 border-slate-300"
                            menuClassName="w-[180px]"
                          />
                        </div>

                        <div className="flex-1 w-full flex items-center gap-2">
                          {item.type === "range" && (
                            <div className="flex items-center gap-2 w-full">
                              <input
                                type="number"
                                step="any"
                                value={item.target_min}
                                onChange={(e) =>
                                  handleUpdateQC(
                                    item.id,
                                    "target_min",
                                    e.target.value,
                                  )
                                }
                                placeholder="下限"
                                className="flex-1 w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-mono font-bold text-indigo-700 focus:outline-none focus:border-indigo-400"
                              />
                              <span className="text-slate-400 font-bold">
                                ~
                              </span>
                              <input
                                type="number"
                                step="any"
                                value={item.target_max}
                                onChange={(e) =>
                                  handleUpdateQC(
                                    item.id,
                                    "target_max",
                                    e.target.value,
                                  )
                                }
                                placeholder="上限"
                                className="flex-1 w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-mono font-bold text-indigo-700 focus:outline-none focus:border-indigo-400"
                              />
                            </div>
                          )}

                          {item.type === "boolean" && (
                            <div className="relative w-full">
                              <CustomSelect
                                options={QC_BOOL_OPTIONS}
                                value={item.target_bool}
                                onChange={(val) =>
                                  handleUpdateQC(item.id, "target_bool", val)
                                }
                                className="border-emerald-200 bg-emerald-50 text-emerald-700 py-0"
                              />
                            </div>
                          )}

                          {item.type === "text" && (
                            <input
                              type="text"
                              value={item.target_text}
                              onChange={(e) =>
                                handleUpdateQC(
                                  item.id,
                                  "target_text",
                                  e.target.value,
                                )
                              }
                              placeholder="合格標準 (如: 呈現金黃色...)"
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-400"
                            />
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveQC(item.id)}
                          className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}

                    {(!formData.qc_standards ||
                      formData.qc_standards.length === 0) && (
                      <div className="text-sm font-bold text-slate-400 py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                        尚未設定任何檢驗項目
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
                          const isChecked = formData.allergen_info.includes(
                            allergen.value,
                          );
                          const isFromIngredients = getIngredientsOnlyAllergens(
                            formData.ingredients,
                            formData.boms,
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
                                disabled={isFromIngredients}
                                onChange={(e) =>
                                  handleManualAllergenChange(e, allergen.value)
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
                        placeholder="例如: 12個月 或 1年"
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

                {["PRODUCT"].includes(formData.type) && (
                  <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
                    <h4 className="text-[11px] font-black text-purple-600 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                      營養價值履歷與標籤預覽
                    </h4>

                    {formData.nutrition_snapshots &&
                    formData.nutrition_snapshots.length > 0 ? (
                      <div className="flex overflow-x-auto w-full gap-6 pb-4 snap-x custom-scrollbar items-stretch">
                        {formData.nutrition_snapshots.map((snap) => {
                          const isPending = snap.status === "PENDING";
                          const isApproved = snap.status === "APPROVED";
                          const isRejected = snap.status === "REJECTED";

                          return (
                            <div
                              key={snap.id}
                              className="shrink-0 w-[560px] snap-center p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-4 relative"
                            >
                              <div>
                                <div className="flex flex-row justify-between items-start mb-2">
                                  <div className="flex items-center font-mono font-bold text-lg text-slate-800">
                                    <div className="flex">
                                      {snap.version_num}
                                    </div>
                                    <div className="flex ml-1 text-sm">
                                      {snap.valid_from || snap.valid_until ? (
                                        <div className="text-indigo-600 font-bold">
                                          使用區間:{" "}
                                          {snap.valid_from || "未指定"} ~{" "}
                                          {snap.valid_until || "永久有效"}
                                        </div>
                                      ) : (
                                        isApproved && (
                                          <div className="text-slate-400 font-bold">
                                            尚未設定使用區間
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded ${isPending ? "bg-amber-100 text-amber-700" : isApproved ? "bg-emerald-100 text-emerald-700" : isRejected ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}
                                  >
                                    {isPending
                                      ? "待審核"
                                      : isApproved
                                        ? "已核准"
                                        : isRejected
                                          ? "已退回"
                                          : "已封存"}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 space-y-0.5">
                                  <div>
                                    建立者: {snap.creator_name} (
                                    {new Date(
                                      snap.created_at,
                                    ).toLocaleDateString()}
                                    )
                                  </div>
                                  {snap.reviewed_by && (
                                    <div>
                                      審核者: {snap.reviewer_name} (
                                      {new Date(
                                        snap.reviewed_at,
                                      ).toLocaleDateString()}
                                      )
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* 🌟 渲染完整營養標籤 */}
                              <div className="flex-1 flex justify-center bg-slate-100 py-4 rounded-xl border border-slate-200 overflow-hidden">
                                <div className="origin-top flex justify-center">
                                  {["PRODUCT", "SEMI"].includes(
                                    formData.type,
                                  ) ? (
                                    <ProductLabelTemplate
                                      name={formData.name}
                                      ingredientsText={
                                        snap.ingredients_text || ""
                                      }
                                      allergenInfo={
                                        snap.allergen_info ||
                                        formData.allergen_info.join(",")
                                      }
                                      nutritionFact={snap.nutrition_fact}
                                      spec={snap.label_info?.spec || ""}
                                      stickerInfo={
                                        snap.label_info || formData.sticker_info
                                      }
                                      storageLife={formData.storage_life}
                                      storageMethod={formData.storage_method}
                                      servingSize={
                                        snap.label_info?.servingSize ||
                                        formData.sticker_info?.servingSize ||
                                        10
                                      }
                                      servingsPerContainer={
                                        snap.label_info?.servingsPerContainer ||
                                        formData.sticker_info
                                          ?.servingsPerContainer ||
                                        100
                                      }
                                    />
                                  ) : (
                                    <NutritionLabel
                                      nutritionData={snap.nutrition_fact}
                                    />
                                  )}
                                </div>
                              </div>

                              {(isPending || isApproved) && isRD && (
                                <div className="mt-auto pt-3 border-t border-slate-200 flex gap-2">
                                  {isPending && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleReviewSnapshot(
                                            snap.id,
                                            "approve",
                                          )
                                        }
                                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                                      >
                                        <ClipboardCheck size={14} /> 核准
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleReviewSnapshot(
                                            snap.id,
                                            "reject",
                                          )
                                        }
                                        className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                                      >
                                        退回
                                      </button>
                                    </>
                                  )}
                                  {isApproved && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setValidityTargetId(snap.id);
                                        setValidityForm({
                                          valid_from: snap.valid_from || "",
                                          valid_until: snap.valid_until || "",
                                        });
                                        setValidityModalOpen(true);
                                      }}
                                      className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                                    >
                                      設定使用區間
                                    </button>
                                  )}
                                </div>
                              )}
                              {snap.review_note && (
                                <div className="mt-2 text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                                  備註: {snap.review_note}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center">
                        <FlaskConical
                          size={48}
                          className="text-slate-300 mx-auto mb-4"
                        />
                        <div className="text-lg font-bold text-slate-600 mb-2">
                          尚無標籤資料
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
      {/* 🌟 審核退回輸入備註 Modal */}
      {/* ========================================================= */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-black text-rose-600 flex items-center gap-2 mb-2">
                <AlertCircle size={20} /> 退回營養價值
              </h3>
              <p className="text-sm text-slate-500 font-medium mb-4">
                請輸入退回備註 (選填)：
              </p>
              <textarea
                autoFocus
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none text-sm font-medium text-slate-800 transition-all resize-none"
              />
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectModalOpen(false);
                  setPendingRejectSnapshotId(null);
                  setRejectNote("");
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 text-sm font-bold rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitSnapshotReview}
                className="px-5 py-2 text-white bg-rose-500 hover:bg-rose-600 text-sm font-bold rounded-xl shadow-md transition-colors"
              >
                確認退回
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 🌟 設定效期 Modal */}
      {/* ========================================================= */}
      {validityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-black text-indigo-600 flex items-center gap-2 mb-4">
                <Calendar size={20} /> 設定標籤使用區間
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                    生效起始日
                  </label>
                  <input
                    type="date"
                    value={validityForm.valid_from}
                    onChange={(e) =>
                      setValidityForm({
                        ...validityForm,
                        valid_from: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-medium text-slate-800 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                    生效結束日 (未填寫則表示永久有效)
                  </label>
                  <input
                    type="date"
                    value={validityForm.valid_until}
                    onChange={(e) =>
                      setValidityForm({
                        ...validityForm,
                        valid_until: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-medium text-slate-800 transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setValidityModalOpen(false);
                  setValidityTargetId(null);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 text-sm font-bold rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitValidity}
                className="px-5 py-2 text-white bg-indigo-500 hover:bg-indigo-600 text-sm font-bold rounded-xl shadow-md transition-colors"
              >
                儲存設定
              </button>
            </div>
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
