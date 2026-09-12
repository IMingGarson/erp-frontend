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
  Info,
  FlaskConical,
  CheckCircle2,
  Tag,
  Download,
  MessageSquareText,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { TFDA_INGREDIENT_RULES } from "./utils/tfdaLegalRules";

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

export default function BOMCreatePage() {
  const { materialCode } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(materialCode);

  const [originalMaterialId, setOriginalMaterialId] = useState(null);
  const [originalBomIds, setOriginalBomIds] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expandedRows, setExpandedRows] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({
    key: "quantity",
    direction: "desc",
  });

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "PRODUCT",
    base_quantity: 10,
    items: [],
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
        const data = await res.json();
        const boms = data.data || data || [];
        if (boms.length === 0) return;

        const baseQty = parseFloat(boms[0].base_quantity) || 1;

        for (const bom of boms) {
          const childCode = bom.child?.code || bom.child;
          const childQty = parseFloat(bom.quantity_required) || 0;
          const childRatio = precise.div(childQty, baseQty);
          const actualRatio = precise.mul(currentRatio, childRatio);
          const fullMat = allMats.find((m) => m.code === childCode);

          if (fullMat?.is_additive) {
            if (!additivesMap[childCode]) {
              additivesMap[childCode] = {
                code: childCode,
                name: fullMat.name,
                limit: parseFloat(fullMat.legal_limit_percent),
                ratio: 0,
              };
            }
            additivesMap[childCode].ratio = precise.add(
              additivesMap[childCode].ratio,
              actualRatio,
            );
          } else if (fullMat?.type === "SEMI") {
            await traverse(childCode, actualRatio);
          }
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
      const matRes = await fetchWithAuth("/api/materials");
      if (!matRes.ok) throw new Error("無法取得物料資料");
      const json = await matRes.json();
      const allMaterials = json.data || json || [];

      setMaterials(
        allMaterials.filter((m) =>
          ["RAW", "SEMI", "PACK"].includes(m.type?.toUpperCase()),
        ),
      );

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

        const loadedItems = await Promise.all(
          bomList.map(async (bom) => {
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

            return {
              id: bom.id,
              material_id: childId,
              material_code: childCode,
              material_name: bom.child?.name || "未知物料",
              type: bom.child?.type || "",
              unit: bom.child?.unit || "KG",
              estimated_cost: fullMat ? fullMat.estimated_cost || 0 : 0,
              provider_quotes: fullMat ? fullMat.provider_quotes || [] : [],
              quantity: bom.quantity_required,
              remark: bom.remark || "",
              set_cost: bom.set_cost !== null ? bom.set_cost : "",
              is_additive: fullMat ? fullMat.is_additive : false,
              legal_limit_percent: fullMat
                ? parseFloat(fullMat.legal_limit_percent)
                : null,
              contained_additives: containedAdditives,
              nutrition_fact: fullMat ? fullMat.nutrition_fact : {},
            };
          }),
        );

        loadedItems.sort(
          (a, b) =>
            (parseFloat(b.quantity) || 0) - (parseFloat(a.quantity) || 0),
        );

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
          provider_quotes: [],
          is_additive: false,
          legal_limit_percent: null,
          contained_additives: [],
          nutrition_fact: {},
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
          const aCost =
            a.set_cost !== "" && a.set_cost !== null
              ? parseFloat(a.set_cost)
              : parseFloat(a.estimated_cost) || 0;
          const bCost =
            b.set_cost !== "" && b.set_cost !== null
              ? parseFloat(b.set_cost)
              : parseFloat(b.estimated_cost) || 0;
          valA = (parseFloat(a.quantity) || 0) * aCost;
          valB = (parseFloat(b.quantity) || 0) * bCost;
        }
        if (valA < valB) return newDirection === "asc" ? -1 : 1;
        if (valA > valB) return newDirection === "asc" ? 1 : -1;
        return 0;
      });
      return { ...prev, items: sortedItems };
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
        const childRefCost = parseFloat(childMat.estimated_cost) || 0;
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

    formData.items.forEach((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const refCost = parseFloat(item.estimated_cost) || 0;
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

  // 🌟 極簡白盒化設計：廠商報價 Sub-row (純白底板、文字色彩、不依賴雜訊背景)
  const renderProviderQuotesSubRow = (
    refCost,
    providerQuotes,
    isNested = false,
  ) => {
    if (!providerQuotes || providerQuotes.length === 0) return null;

    // 與上層表單欄位切齊 (縮排 w-8 + gap-4 + w-[64px] + gap-4)
    const paddingLeftClass = isNested ? "" : "pl-[116px]";

    return (
      <div
        className={`w-full ${paddingLeftClass} pr-6 pb-4 flex flex-col gap-1.5`}
      >
        <div className="flex items-center gap-1.5 pl-2 mb-0.5">
          <CornerDownRight
            size={12}
            className="text-slate-300"
            strokeWidth={3}
          />
          <span className="text-[11px] font-black text-slate-800 tracking-widest">
            廠商報價
          </span>
        </div>

        <div className="flex flex-col gap-1.5 w-fit">
          {providerQuotes.map((pq, i) => {
            const diff = pq.price - refCost;
            const diffPct = refCost > 0 ? (diff / refCost) * 100 : 0;
            const isUp = diff > 0;
            const isDown = diff < 0;

            return (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm transition-all hover:border-slate-300 hover:shadow"
              >
                {/* 1. 廠商名稱 (固定寬) */}
                <span
                  className="text-xs font-bold text-slate-800 w-[140px] truncate"
                  title={pq.provider_name}
                >
                  {pq.provider_name}
                </span>

                {/* 2. 起迄日 (極簡文字化，無多餘底色，防斷行) */}
                <div className="w-[200px] shrink-0 flex items-center justify-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shrink-0">
                      起
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-600 whitespace-nowrap">
                      {pq.effective_date}
                    </span>
                  </div>
                  <span className="text-slate-300 text-[10px]">-</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shrink-0">
                      迄
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-600 whitespace-nowrap">
                      {pq.valid_until || "無期限"}
                    </span>
                  </div>
                </div>

                {/* 3. 報價 (固定寬，左對齊) */}
                <span className="text-[13px] font-mono font-black text-slate-900 w-[70px] text-left">
                  ${formatNum(pq.price, 2)}
                </span>

                {/* 4. 漲幅 (固定寬，右對齊，直接以顏色文字取代背景色塊) */}
                <div
                  className={`w-[140px] text-right font-mono text-[11px] font-bold ${isUp ? "text-rose-500" : isDown ? "text-emerald-500" : "text-slate-400"}`}
                >
                  {diff !== 0 ? (
                    <span className="whitespace-nowrap">
                      {isUp ? "+" : "-"} ${formatNum(Math.abs(diff), 2)} (
                      {formatNum(Math.abs(diffPct), 1)}%)
                    </span>
                  ) : (
                    <span>-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 🌟 半成品階層式展開渲染
  const renderNestedRows = (parentMatId, parentQty, level, pathPrefix) => {
    const parentMat = materials.find((m) => m.id === parentMatId);
    if (!parentMat || !parentMat.boms || parentMat.boms.length === 0)
      return null;

    const processedBoms = parentMat.boms.map((bom, idx) => {
      const childMat = materials.find((m) => m.id === bom.child) || {};
      const childCost = parseFloat(childMat.estimated_cost) || 0;
      const childBaseQty = parseFloat(bom.base_quantity) || 1;
      const childReqQty = parseFloat(bom.quantity_required) || 0;
      const actualQty = precise.mul(
        precise.div(childReqQty, childBaseQty),
        parentQty,
      );
      const subtotal = precise.mul(actualQty, childCost);
      return {
        ...bom,
        originalIdx: idx,
        childMat,
        childCost,
        childBaseQty,
        childReqQty,
        actualQty,
        subtotal,
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

      const nestedPaddingLeft = level * 1.5 + 1.5;

      return (
        <React.Fragment key={currentPath}>
          <div className="flex flex-col border-b border-slate-100/50 bg-slate-50/30 hover:bg-slate-50 transition-colors group">
            <div className="flex items-start md:items-center gap-4 px-4 py-2 w-full min-w-[900px]">
              <div
                className="w-8 shrink-0 flex flex-col items-end pt-1"
                style={{ paddingRight: `${level * 0.5}rem` }}
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

              <div className="w-[64px] flex justify-center pt-0.5 shrink-0">
                {item.childMat.type && (
                  <span
                    className={`px-2 py-1 text-[9px] font-black rounded-md uppercase tracking-widest ${TYPE_MAP[item.childMat.type]?.color || "bg-slate-100 text-slate-500 border-slate-200"}`}
                  >
                    {TYPE_MAP[item.childMat.type]?.label || item.childMat.type}
                  </span>
                )}
              </div>

              <div className="w-[280px] shrink-0 flex flex-col gap-0.5 pt-0.5">
                <span className="text-sm font-bold text-slate-700 truncate">
                  {item.child_name}
                </span>
                <span className="text-[10px] font-mono text-slate-400 font-semibold">
                  {item.child_code}
                </span>
              </div>

              <div className="flex-1 min-w-[120px]">
                {item.remark ? (
                  <span className="text-xs text-slate-500 font-medium truncate block bg-white px-2 py-1 rounded border border-slate-100">
                    {item.remark}
                  </span>
                ) : (
                  <span className="text-slate-300 block text-center">-</span>
                )}
              </div>

              <div className="w-[130px] shrink-0 flex items-baseline gap-1 pt-1 pl-1">
                <span className="text-[15px] font-mono font-black text-slate-700">
                  {formatNum(item.actualQty)}
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase">
                  {item.child_unit}
                </span>
              </div>

              <div className="w-[100px] shrink-0 text-right">
                <span className="text-[13px] font-mono font-bold text-slate-500">
                  ${formatNum(item.childCost, 2)}
                </span>
              </div>

              <div className="w-[110px] shrink-0"></div>

              <div className="w-[100px] shrink-0 text-right pr-2">
                <span className="font-mono text-sm font-black text-slate-600">
                  ${formatNum(item.subtotal, 2)}
                </span>
              </div>

              <div className="w-8 shrink-0"></div>
            </div>

            {item.childMat.provider_quotes &&
              item.childMat.provider_quotes.length > 0 && (
                <div style={{ paddingLeft: `${nestedPaddingLeft + 8.5}rem` }}>
                  {renderProviderQuotesSubRow(
                    item.childCost,
                    item.childMat.provider_quotes,
                    true,
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

      if (item.is_additive && item.legal_limit_percent) {
        if (!summary[item.material_code])
          summary[item.material_code] = {
            code: item.material_code,
            name: item.material_name,
            limit: item.legal_limit_percent,
            ratio: 0,
            sources: [],
          };
        summary[item.material_code].ratio = precise.add(
          summary[item.material_code].ratio,
          currentItemRatio,
        );
        summary[item.material_code].sources.push({
          type: "DIRECT",
          name: item.material_name,
          qty: itemQty,
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
      const activeCost =
        item.set_cost !== "" && item.set_cost !== null
          ? parseFloat(item.set_cost)
          : parseFloat(item.estimated_cost) || 0;
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

  const executeSubmit = async () => {
    setIsSubmitting(true);
    closeDialog();
    try {
      let currentParentId = originalMaterialId;
      const materialPayload = {
        code: formData.code,
        name: formData.name,
        type: formData.type,
        phase: "IN_DEV",
        origin: "台灣",
        unit: "KG",
        is_active: true,
      };

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
        if (!matRes.ok) throw new Error("建立配方主檔失敗，請確認代碼是否重複");
        const createdMaterial = await matRes.json();
        currentParentId = createdMaterial.id || createdMaterial.data?.id;
      }

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

      const bomPromises = formData.items.map(async (item) => {
        const bomPayload = {
          parent_id: currentParentId,
          child_id: item.material_id,
          base_quantity: parseFloat(formData.base_quantity),
          quantity_required: parseFloat(item.quantity),
          remark: item.remark || "",
          set_cost: item.set_cost !== "" ? parseFloat(item.set_cost) : null,
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
        return res.json();
      });

      await Promise.all(bomPromises);
      showAlert(
        "儲存成功",
        `配方已成功${isEditMode ? "更新" : "建立"}！`,
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
    if (
      formData.items.length === 0 ||
      formData.items.some((item) => !item.material_id)
    )
      return showAlert("資料不完整", "請完整選擇物料", "warning");

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
        ? `確定更新配方「${formData.name}」？`
        : `確定建立配方「${formData.name}」？`,
      executeSubmit,
    );
  };

  const MaterialSelect = ({ value, onChange, options, excludedIds }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const selectRef = useRef(null);
    const dropdownMenuRef = useRef(null);

    const filtered = options.filter(
      (m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.code.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const handleToggle = () => setIsOpen(!isOpen);

    useEffect(() => {
      const handleScroll = (e) => {
        if (
          dropdownMenuRef.current &&
          dropdownMenuRef.current.contains(e.target)
        )
          return;
        if (isOpen) setIsOpen(false);
      };
      if (isOpen) window.addEventListener("scroll", handleScroll, true);
      return () => window.removeEventListener("scroll", handleScroll, true);
    }, [isOpen]);

    return (
      <div className="relative w-full">
        <div
          ref={selectRef}
          onClick={handleToggle}
          className={`w-full h-[40px] px-3 py-1 border rounded-lg text-[13px] cursor-pointer bg-white flex justify-between items-center transition-all shadow-sm ${isOpen ? "border-[#007AFF] ring-2 ring-[#007AFF]/20 bg-white" : "border-slate-200 hover:border-slate-300"}`}
        >
          <div className="flex items-center gap-2 overflow-hidden w-full">
            <Search size={14} className="text-slate-400 flex-shrink-0" />
            <span
              className={`truncate font-bold ${value ? "text-slate-800" : "text-slate-400"}`}
            >
              {value || "搜尋代碼/名稱..."}
            </span>
          </div>
          <ChevronDown
            size={14}
            className={`text-slate-400 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[98]"
              onClick={() => setIsOpen(false)}
            ></div>
            <div
              ref={dropdownMenuRef}
              className="absolute top-full left-0 w-full min-w-[280px] mt-2 z-[99] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col max-h-[300px] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="p-2 border-b border-slate-100 bg-slate-50/80 shrink-0 backdrop-blur-md">
                <input
                  autoFocus
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 shadow-sm transition-all"
                  placeholder="輸入關鍵字..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                {filtered.length > 0 ? (
                  filtered.map((m) => {
                    const isDisabled = excludedIds.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          if (!isDisabled) {
                            onChange(m);
                            setIsOpen(false);
                            setSearchTerm("");
                          }
                        }}
                        className={`px-3 py-2 text-xs rounded-lg flex items-center gap-2.5 transition-colors ${isDisabled ? "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60" : "text-slate-700 hover:bg-[#007AFF]/10 cursor-pointer"}`}
                      >
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap font-bold ${isDisabled ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-white text-slate-500 border-slate-200 shadow-sm"}`}
                        >
                          {m.code}
                        </span>
                        <span className="truncate font-black">{m.name}</span>
                        <div className="flex-1 flex items-center justify-end gap-1.5">
                          {isDisabled && (
                            <span className="text-[10px] text-slate-400 font-bold">
                              (已選)
                            </span>
                          )}
                          {m.is_additive && (
                            <div className="bg-orange-500 text-white p-0.5 rounded shadow-sm">
                              <FlaskConical size={10} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs font-bold">
                    查無符合物料
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

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
        {/* 基本資訊 */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm w-full transition-shadow hover:shadow-md">
          <h3 className="text-xs font-black text-[#007AFF] uppercase tracking-widest mb-6 border-b border-slate-100 pb-3">
            1. 基本資訊
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                配方代碼 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleMasterChange}
                disabled={isEditMode}
                placeholder="P9202020"
                className="w-full h-[48px] px-4 py-2 border border-slate-200 rounded-xl focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 outline-none font-mono font-bold transition-all shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
              />
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
                className="w-full h-[48px] px-4 py-2 border border-slate-200 rounded-xl focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 outline-none font-bold transition-all shadow-sm bg-white appearance-none cursor-pointer"
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
        </div>

        {/* 🌟 核心：高密度、全橫排對齊資料列 (Data Grid) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col w-full overflow-hidden">
          <div className="px-6 py-4 md:px-6 md:py-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50/50 gap-4">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-black text-slate-800">
                2. 配方用料明細
              </h3>
              <span className="text-[#007AFF] bg-blue-50 font-black px-2.5 py-0.5 rounded-full border border-blue-100 shadow-sm text-sm">
                {formData.items.length}
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

          <div className="overflow-x-auto w-full">
            {formData.items.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-sm font-bold bg-white">
                尚未加入任何原料，請點擊上方「加入原料」開始設計。
              </div>
            ) : (
              <div className="min-w-[1100px] flex flex-col w-full">
                {/* 🌟 嚴格對齊的表頭 */}
                <div className="flex items-center px-4 py-2 bg-slate-100/50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest gap-4">
                  <div className="w-8 text-center shrink-0">#</div>
                  <div className="w-[64px] text-center shrink-0">類型</div>
                  <div className="w-[280px] shrink-0">物料</div>
                  <div className="flex-1 min-w-[120px]">備註</div>
                  <div className="w-[120px] shrink-0 pl-1">
                    用量(KG) <span className="text-red-500">*</span>
                  </div>
                  <div className="w-[100px] shrink-0 text-right">系統均價</div>
                  <div className="w-[110px] shrink-0 text-center">設定成本</div>
                  <div className="w-[100px] shrink-0 text-right pr-2">小計</div>
                  <div className="w-8 shrink-0"></div>
                </div>

                <div className="flex flex-col">
                  {formData.items.map((item, index) => {
                    const itemQty = parseFloat(item.quantity) || 0;
                    const refCost = parseFloat(item.estimated_cost) || 0;
                    const hasSetCost =
                      item.set_cost !== "" &&
                      item.set_cost !== null &&
                      !isNaN(item.set_cost);
                    const activeCost = hasSetCost
                      ? parseFloat(item.set_cost)
                      : refCost;
                    const subtotal = formatNum(itemQty * activeCost, 2);

                    const excludedIds = formData.items
                      .filter((_, i) => i !== index)
                      .map((i) => i.material_id)
                      .filter(Boolean);
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
                          className={`flex flex-col border-b border-slate-100 transition-colors group ${isErrorRow ? "bg-red-50 hover:bg-red-100/50" : "bg-white hover:bg-slate-50/50"}`}
                        >
                          {/* 🌟 1. 主資料列 (絕對水平對齊) */}
                          <div className="flex items-start md:items-center gap-4 px-4 py-3 w-full">
                            {/* 序號與展開 */}
                            <div className="w-8 flex flex-col items-center justify-center pt-1.5 shrink-0">
                              <span
                                className={`text-xs font-black ${isErrorRow ? "text-red-500" : "text-slate-400"}`}
                              >
                                {index + 1}
                              </span>
                              {isSemi && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(currentPath)}
                                  className="mt-1 text-[#007AFF] hover:bg-blue-50 p-1 rounded-md transition-colors border border-blue-100 shadow-sm bg-white"
                                >
                                  {isExpanded ? (
                                    <ChevronDown size={14} strokeWidth={3} />
                                  ) : (
                                    <ChevronRight size={14} strokeWidth={3} />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* 類型 */}
                            <div className="w-[64px] flex justify-center pt-1.5 shrink-0">
                              {item.type && (
                                <span
                                  className={`px-2 py-1 text-[10px] font-black rounded-md uppercase tracking-widest ${TYPE_MAP[item.type]?.color || "bg-slate-100 text-slate-500 border-slate-200"}`}
                                >
                                  {TYPE_MAP[item.type]?.label || item.type}
                                </span>
                              )}
                            </div>

                            {/* 物料選擇 */}
                            <div className="w-[280px] shrink-0 pt-0.5">
                              <MaterialSelect
                                value={
                                  item.material_id
                                    ? `[${item.material_code}] ${item.material_name}`
                                    : ""
                                }
                                options={materials}
                                excludedIds={excludedIds}
                                onChange={async (selectedMat) => {
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
                                    selectedMat.is_additive || false,
                                  );
                                  handleItemChange(
                                    index,
                                    "legal_limit_percent",
                                    selectedMat.legal_limit_percent
                                      ? parseFloat(
                                          selectedMat.legal_limit_percent,
                                        )
                                      : null,
                                  );
                                  handleItemChange(
                                    index,
                                    "nutrition_fact",
                                    selectedMat.nutrition_fact || {},
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
                              />
                            </div>

                            {/* 備註 */}
                            <div className="flex-1 min-w-[120px] pt-1 relative">
                              <MessageSquareText
                                size={13}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300"
                              />
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
                                className="w-full h-[40px] pl-8 pr-3 border border-slate-200 rounded-lg focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 outline-none text-[13px] transition-all bg-white focus:bg-white placeholder:text-slate-300"
                                placeholder="備註..."
                              />
                            </div>

                            {/* 用量 */}
                            <div className="w-[120px] shrink-0 relative pt-1">
                              <input
                                type="text"
                                value={formatNum(item.quantity)}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                                className={`w-full h-[40px] pl-3 pr-8 border border-slate-200 rounded-lg focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 outline-none font-mono font-bold text-sm text-[#007AFF] bg-blue-50/30 transition-all ${isErrorRow ? "border-red-300 text-red-600 bg-white" : "bg-white"}`}
                                placeholder="0"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-300 uppercase pointer-events-none">
                                {item.unit}
                              </span>
                            </div>

                            {/* 系統均價 */}
                            <div className="w-[100px] shrink-0 text-right pt-2">
                              <span className="font-mono font-bold text-slate-500 text-[13px]">
                                ${formatNum(refCost, 2)}
                              </span>
                            </div>

                            {/* 自訂成本 */}
                            <div className="w-[110px] shrink-0 relative pt-0.5">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-300">
                                $
                              </span>
                              <input
                                type="text"
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
                                className="w-full h-[40px] pl-6 pr-2 text-left border border-indigo-200 bg-indigo-50/20 text-indigo-700 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono font-bold text-sm transition-all placeholder:text-indigo-200 placeholder:font-sans placeholder:text-center"
                                placeholder="自訂"
                              />
                            </div>

                            {/* 小計 */}
                            <div className="w-[100px] shrink-0 text-right pt-2.5 pr-2 flex flex-col items-end">
                              <span className="font-mono text-[15px] font-black text-slate-700">
                                ${subtotal}
                              </span>
                            </div>

                            {/* Action */}
                            <div className="w-8 shrink-0 flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} strokeWidth={2.5} />
                              </button>
                            </div>
                          </div>

                          {/* 🌟 2. 獨立的廠商報價情報列 (Sub-row) */}
                          {renderProviderQuotesSubRow(
                            refCost,
                            item.provider_quotes,
                          )}
                        </div>

                        {/* 🌟 3. 半成品展開區塊 */}
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

        {/* 法規面板 (保持原邏輯) */}
        <div className="border border-slate-200/60 bg-slate-50/50 p-8 rounded-3xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] min-h-[220px] flex flex-col gap-6">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
            <FlaskConical
              size={18}
              className="text-orange-500"
              strokeWidth={2.5}
            />
            法定添加物安全試算面板
          </h3>
          {additiveCalculations.results.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl p-8 bg-white/50">
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
                    className={`flex flex-col bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 ${add.isExceeded ? "border-red-300 ring-4 ring-red-500/10" : "border-slate-200"}`}
                  >
                    <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                      <h4 className="font-black text-slate-800 text-base truncate pr-2">
                        {add.name}
                      </h4>
                      <span className="bg-white text-slate-500 text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg font-black shrink-0 shadow-sm border border-slate-200">
                        上限 {formatNum(add.limit)}%
                      </span>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="text-[10px] text-slate-400 font-black mb-3 uppercase tracking-widest">
                        配方貢獻來源
                      </div>
                      <div className="space-y-2.5 flex-1">
                        {add.sources.map((src, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-baseline text-sm"
                          >
                            <span className="text-slate-700 truncate pr-4 text-xs font-bold">
                              <span className="text-slate-400 mr-2 font-medium">
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
                      <div className="mt-5 pt-3 border-t-[3px] border-slate-800 flex justify-between items-end">
                        <span className="text-xs font-black text-slate-800">
                          合計總重 (KG)
                        </span>
                        <span className="text-2xl font-mono font-black text-slate-800 leading-none tracking-tight">
                          {formatNum(add.totalQty)}
                        </span>
                      </div>
                    </div>
                    <div className="p-5 border-t border-slate-100 bg-slate-50/80 flex flex-col gap-5">
                      <div className="flex bg-white rounded-xl border border-slate-200/80 shadow-sm p-1.5">
                        <div className="flex-1 flex flex-col items-center justify-center py-2.5 border-r border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">
                            安全上限 (KG)
                          </span>
                          <span className="font-mono font-black text-slate-700 text-sm">
                            {formatNum(maxAllowedQty)}
                          </span>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center py-2.5">
                          <span
                            className={`text-[9px] font-black mb-1.5 uppercase tracking-widest ${add.isExceeded ? "text-red-500" : "text-slate-400"}`}
                          >
                            {add.isExceeded ? "已超標量 (KG)" : "還可新增 (KG)"}
                          </span>
                          <span
                            className={`font-mono font-black text-sm ${add.isExceeded ? "text-red-600" : "text-slate-700"}`}
                          >
                            {formatNum(Math.abs(maxAllowedQty - add.totalQty))}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div
                          className={`flex items-center gap-2 font-bold text-sm tracking-wide ${add.isExceeded ? "text-red-500" : "text-emerald-500"}`}
                        >
                          {add.isExceeded ? (
                            <AlertTriangle size={20} strokeWidth={2.5} />
                          ) : (
                            <CheckCircle2 size={20} strokeWidth={2.5} />
                          )}
                          <span>
                            {add.isExceeded ? "佔比已超標" : "符合安全"}
                          </span>
                        </div>
                        <div className="text-right flex flex-col justify-center">
                          <div className="text-[9px] font-black tracking-widest text-slate-400 uppercase mb-1">
                            目前佔比
                          </div>
                          <div
                            className={`text-3xl font-black font-mono leading-none tracking-tighter flex items-baseline justify-end ${add.isExceeded ? "text-red-500" : "text-slate-800"}`}
                          >
                            {formatNum(add.usagePercent, 2)}
                            <span className="text-lg ml-1 font-bold opacity-40 text-slate-500">
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

        {/* 底部總計 */}
        <div className="bg-white px-8 py-6 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-wrap items-center gap-6 md:gap-10">
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">
                總材料成本
              </p>
              <div className="text-slate-800 font-mono font-black text-2xl">
                ${formatNum(calculations.totalCost, 2)}
              </div>
            </div>
            <div className="w-px h-10 bg-slate-300 hidden md:block"></div>
            <div>
              <p className="text-[#007AFF] text-[10px] font-black uppercase tracking-widest mb-1.5">
                每 KG 成本 (除 {formData.base_quantity} 基準)
              </p>
              <div className="text-[#007AFF] font-mono font-black text-3xl">
                ${formatNum(calculations.unitCost, 2)}
              </div>
            </div>
            <div className="w-px h-10 bg-slate-300 hidden md:block"></div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">
                用料總重
              </p>
              <div className="flex items-baseline gap-2">
                <div
                  className={`font-mono font-black text-3xl ${calculations.weightDiff < -0.001 ? "text-red-500" : calculations.weightDiff > 0.001 ? "text-amber-500" : "text-emerald-500"}`}
                >
                  {formatNum(calculations.totalWeight, 2)}
                </div>
                <span className="text-slate-500 font-bold text-sm">KG</span>
                <div
                  className={`font-mono font-bold text-sm px-2.5 py-1 rounded-lg border shadow-sm ml-1 ${calculations.weightDiff < -0.001 ? "bg-red-50 text-red-600 border-red-200" : calculations.weightDiff > 0.001 ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}`}
                >
                  {calculations.weightDiff > 0.001 ? "多" : "缺"}{" "}
                  {Math.abs(formatNum(calculations.weightDiff, 2))} KG
                </div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleExportExcel}
              className="w-full md:w-auto px-6 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-xl shadow-sm transition-all font-black text-sm flex items-center justify-center gap-2"
            >
              <Download size={18} strokeWidth={2.5} />
              匯出 EXCEL
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                additiveCalculations.hasLimitError ||
                claimsAndWarnings.banned.length > 0
              }
              className="w-full md:w-auto px-12 py-3.5 bg-[#007AFF] hover:bg-[#0056b3] text-white rounded-xl shadow-[0_4px_12px_rgba(0,122,255,0.3)] transition-all font-black text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
            >
              <Save size={18} strokeWidth={2.5} />
              {isSubmitting ? "儲存中..." : "儲存配方"}
            </button>
          </div>
        </div>
      </form>
      <CustomDialog isOpen={dialog.isOpen} {...dialog} onClose={closeDialog} />
    </div>
  );
}
