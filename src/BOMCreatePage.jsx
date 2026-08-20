import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search,
  ChevronDown,
  Trash2,
  Plus,
  Save,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  Info,
  FlaskConical,
  CheckCircle2,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useAuthStore } from "./store/authStore";

// 🌟 實用工具：格式化數字，移除不必要的結尾 0
const formatNum = (num, maxDecimals = 4) => {
  if (num === null || num === undefined || isNaN(num) || num === "") return "0";
  return parseFloat(Number(num).toFixed(maxDecimals)).toString();
};

// 格式化金額，帶千分位且移除結尾 0
const formatCurrency = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Number(num).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
};

const BOMCreatePage = () => {
  const me = useAuthStore((state) => state.me());

  const { materialCode } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(materialCode);

  const [originalMaterialId, setOriginalMaterialId] = useState(null);
  const [originalBomIds, setOriginalBomIds] = useState([]);

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // ==========================================
  // 🌟 核心邏輯：遞迴攤平半成品內的添加物
  // ==========================================
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
          const childRatio = childQty / baseQty;
          const actualRatio = currentRatio * childRatio;

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
            additivesMap[childCode].ratio += actualRatio;
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

  // 1. 初始化載入資料
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

        if (!targetMaterial) {
          return showAlert(
            "錯誤",
            "找不到該配方資料，可能已被刪除或代碼錯誤。",
            "error",
            () => navigate("/materials"),
          );
        }

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
              quantity: bom.quantity_required,
              is_additive: fullMat ? fullMat.is_additive : false,
              legal_limit_percent: fullMat
                ? parseFloat(fullMat.legal_limit_percent)
                : null,
              contained_additives: containedAdditives,
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

  // 2. 表單操作處理
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
          unit: "KG",
          estimated_cost: 0,
          is_additive: false,
          legal_limit_percent: null,
          contained_additives: [],
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
    if (sortConfig.key === sortKey && sortConfig.direction === "desc") {
      newDirection = "asc";
    }

    setSortConfig({ key: sortKey, direction: newDirection });

    setFormData((prev) => {
      const sortedItems = [...prev.items].sort((a, b) => {
        let valA = 0,
          valB = 0;
        if (sortKey === "quantity") {
          valA = parseFloat(a.quantity) || 0;
          valB = parseFloat(b.quantity) || 0;
        } else if (sortKey === "subtotal") {
          valA =
            (parseFloat(a.quantity) || 0) * (parseFloat(a.estimated_cost) || 0);
          valB =
            (parseFloat(b.quantity) || 0) * (parseFloat(b.estimated_cost) || 0);
        }
        if (valA < valB) return newDirection === "asc" ? -1 : 1;
        if (valA > valB) return newDirection === "asc" ? 1 : -1;
        return 0;
      });
      return { ...prev, items: sortedItems };
    });
  };

  const calculations = useMemo(() => {
    const totalCost = formData.items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.estimated_cost) || 0;
      return sum + qty * cost;
    }, 0);
    const baseQty = parseFloat(formData.base_quantity) || 1;
    return { totalCost, unitCost: baseQty > 0 ? totalCost / baseQty : 0 };
  }, [formData.items, formData.base_quantity]);

  // ==========================================
  // 🌟 全局添加物法規驗算 (分組紀錄來源貢獻)
  // ==========================================
  const additiveCalculations = useMemo(() => {
    const baseQty = parseFloat(formData.base_quantity) || 1;
    const summary = {}; // { [code]: { name, limit, totalQty, sources: [] } }

    formData.items.forEach((item) => {
      const itemQty = parseFloat(item.quantity) || 0;
      if (itemQty <= 0) return;

      // 1. 直加的添加物
      if (item.is_additive && item.legal_limit_percent) {
        if (!summary[item.material_code]) {
          summary[item.material_code] = {
            code: item.material_code,
            name: item.material_name,
            limit: item.legal_limit_percent,
            totalQty: 0,
            sources: [],
          };
        }
        summary[item.material_code].totalQty += itemQty;
        summary[item.material_code].sources.push({
          type: "DIRECT",
          name: item.material_name,
          qty: itemQty,
        });
      }

      // 2. 半成品帶入的隱藏添加物
      if (item.contained_additives && item.contained_additives.length > 0) {
        item.contained_additives.forEach((add) => {
          if (!summary[add.code]) {
            summary[add.code] = {
              code: add.code,
              name: add.name,
              limit: add.limit,
              totalQty: 0,
              sources: [],
            };
          }
          const contributedQty = itemQty * add.ratio;
          summary[add.code].totalQty += contributedQty;
          summary[add.code].sources.push({
            type: "SEMI",
            name: item.material_name,
            qty: contributedQty,
          });
        });
      }
    });

    const results = Object.values(summary).map((add) => {
      const usagePercent = (add.totalQty / baseQty) * 100;
      return {
        ...add,
        usagePercent,
        isExceeded: usagePercent > add.limit,
      };
    });

    const hasLimitError = results.some((r) => r.isExceeded);
    // 取出所有超標的添加物代碼，用來標記有問題的行
    const exceededCodes = results
      .filter((r) => r.isExceeded)
      .map((r) => r.code);

    return { results, hasLimitError, exceededCodes };
  }, [formData.items, formData.base_quantity]);

  // 3. 核心存檔邏輯
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

      const bomPromises = formData.items.map((item) => {
        const bomPayload = {
          parent_id: currentParentId,
          child_id: item.material_id,
          base_quantity: parseFloat(formData.base_quantity),
          quantity_required: parseFloat(item.quantity),
        };

        if (isEditMode && item.id) {
          return fetchWithAuth(`/api/boms/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bomPayload),
          });
        } else {
          return fetchWithAuth("/api/boms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bomPayload),
          });
        }
      });

      await Promise.all(bomPromises);

      showAlert(
        "儲存成功",
        `配方已成功${isEditMode ? "更新" : "建立"}！`,
        "success",
        () => navigate("/materials"),
      );
    } catch (err) {
      showAlert("發生錯誤", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.code)
      return showAlert("資料不完整", "請輸入配方代碼", "warning");
    if (!formData.name)
      return showAlert("資料不完整", "請輸入配方名稱", "warning");
    if (!formData.base_quantity || formData.base_quantity <= 0)
      return showAlert("資料錯誤", "基準產量必須大於 0", "warning");
    if (formData.items.length === 0)
      return showAlert("資料不完整", "請至少新增一筆配方物料", "warning");
    if (formData.items.some((item) => !item.material_id))
      return showAlert("資料不完整", "有明細尚未選擇物料", "warning");

    if (additiveCalculations.hasLimitError) {
      return showAlert(
        "法規上限警示",
        "配方中有添加物總量超過法規安全上限，無法儲存。",
        "error",
      );
    }

    showConfirm(
      isEditMode ? "更新配方確認" : "建立配方確認",
      isEditMode
        ? `確定要覆蓋更新配方「${formData.name}」嗎？`
        : `確定要建立配方「${formData.name}」嗎？\n系統將會同步在物料庫建立這筆配方主檔。`,
      executeSubmit,
    );
  };

  // ==========================================
  // 內建物料選擇器
  // ==========================================
  const MaterialSelect = ({ value, onChange, options, excludedIds }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [dropdownStyle, setDropdownStyle] = useState({});
    const selectRef = useRef(null);
    const dropdownMenuRef = useRef(null);

    const filtered = options.filter(
      (m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.code.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const handleToggle = () => {
      if (!isOpen && selectRef.current) {
        const rect = selectRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropdownHeight = 260;

        if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
          setDropdownStyle({
            bottom: `${window.innerHeight - rect.top + 4}px`,
            top: "auto",
            left: `${rect.left}px`,
            width: `${rect.width}px`,
          });
        } else {
          setDropdownStyle({
            top: `${rect.bottom + 4}px`,
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
        if (
          dropdownMenuRef.current &&
          dropdownMenuRef.current.contains(e.target)
        )
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
          className={`w-full h-[36px] px-3 py-1.5 border rounded-md text-sm cursor-pointer bg-white flex justify-between items-center transition-colors ${
            isOpen
              ? "border-blue-500 ring-1 ring-blue-500"
              : "border-slate-300 hover:border-slate-400"
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden w-full">
            <Search size={14} className="text-slate-400 flex-shrink-0" />
            <span
              className={`truncate ${value ? "text-slate-800 font-medium" : "text-slate-400"}`}
            >
              {value || "搜尋代碼或名稱..."}
            </span>
          </div>
          <ChevronDown
            size={14}
            className="text-slate-400 flex-shrink-0 ml-1"
          />
        </div>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setIsOpen(false)}
            ></div>
            <div
              ref={dropdownMenuRef}
              style={dropdownStyle}
              className="fixed z-[9999] bg-white border border-slate-200 rounded-md shadow-xl flex flex-col max-h-64 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="p-2 border-b border-slate-100 bg-slate-50 shrink-0">
                <input
                  autoFocus
                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                          if (isDisabled) return;
                          onChange(m);
                          setIsOpen(false);
                          setSearchTerm("");
                        }}
                        className={`px-2 py-2.5 text-sm rounded flex items-center gap-2 transition-colors ${
                          isDisabled
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                            : "text-slate-700 hover:bg-slate-100 cursor-pointer"
                        }`}
                      >
                        <span
                          className={`text-[11px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${
                            isDisabled
                              ? "bg-slate-200 text-slate-400 border-slate-200"
                              : "bg-white text-slate-500 border-slate-200"
                          }`}
                        >
                          {m.code}
                        </span>
                        <span className="truncate font-medium">{m.name}</span>
                        <div className="flex-1 flex items-center justify-end gap-2">
                          {isDisabled && (
                            <span className="text-xs text-slate-400 font-normal">
                              (已選擇)
                            </span>
                          )}
                          {m.is_additive && (
                            <div
                              className="flex items-center justify-center bg-orange-500 text-white p-0.5 rounded shadow-sm border border-orange-600 shrink-0"
                              title="法定添加物"
                            >
                              <FlaskConical size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-6 text-center text-slate-400 text-sm">
                    查無符合的物料
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen bg-slate-50">
        <div className="text-lg font-medium text-slate-500 animate-pulse">
          載入系統資料中...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 md:p-8 pb-12 max-w-6xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            {isEditMode ? "調整配方內容" : "配方建立與成本估算"}
          </h2>
        </div>
      </div>

      <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg mb-6 border border-blue-100 shadow-sm">
        <p className="flex items-center gap-2 font-medium mb-2">
          <span className="text-lg leading-none">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
          <li>此頁面專注於「配方比例設計」與「打料基數成本試算」。</li>
          <li>
            加入法定添加物或含添加物的半成品時，系統會自動攤平計算全配方的佔比，嚴格把關法規上限。
          </li>
        </ul>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-6 mb-10 w-full md:w-auto"
      >
        {/* 單頭區塊 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm w-full">
          <h3 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
            1. 基本資訊
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                配方代碼 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleMasterChange}
                disabled={isEditMode}
                placeholder="如：P9202020"
                className="w-full h-[42px] px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono transition-colors disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                配方/成品名稱 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleMasterChange}
                placeholder="例如：泰式打拋豬肉B"
                className="w-full h-[42px] px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                物料類型
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleMasterChange}
                className="w-full h-[42px] px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors bg-white"
              >
                <option value="PRODUCT">成品 (PRODUCT)</option>
                <option value="SEMI">半成品 (SEMI)</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-blue-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                基準產量 (KG) <span className="text-red-500">*</span>
                <span title="配方原料總合應等於此重量" className="cursor-help">
                  <Info size={14} />
                </span>
              </label>
              <input
                type="number"
                name="base_quantity"
                min="0.01"
                step="0.01"
                value={formData.base_quantity}
                onChange={handleMasterChange}
                className="w-full h-[42px] px-3 py-2 border-2 border-blue-200 bg-blue-50 text-blue-800 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono font-bold transition-colors"
              />
            </div>
          </div>
        </div>

        {/* 明細清單區塊 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col w-full">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-3">
            <h3 className="text-base font-bold text-slate-800">
              2. 配方用料明細{" "}
              <span className="text-slate-400 font-normal ml-1">
                ({formData.items.length})
              </span>
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              {formData.items.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSortItems("quantity")}
                    className={`text-sm px-3 py-1.5 rounded-md font-bold transition-colors shadow-sm flex items-center gap-1 border ${
                      sortConfig.key === "quantity"
                        ? "bg-blue-50 text-blue-600 border-blue-200"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    用量排序
                    {sortConfig.key === "quantity" &&
                      (sortConfig.direction === "desc" ? (
                        <ArrowDown size={14} />
                      ) : (
                        <ArrowUp size={14} />
                      ))}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSortItems("subtotal")}
                    className={`text-sm px-3 py-1.5 rounded-md font-bold transition-colors shadow-sm flex items-center gap-1 border ${
                      sortConfig.key === "subtotal"
                        ? "bg-blue-50 text-blue-600 border-blue-200"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    小計排序
                    {sortConfig.key === "subtotal" &&
                      (sortConfig.direction === "desc" ? (
                        <ArrowDown size={14} />
                      ) : (
                        <ArrowUp size={14} />
                      ))}
                  </button>
                </>
              )}
              <div className="w-px h-6 bg-slate-300 mx-1 hidden sm:block"></div>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-sm bg-white text-emerald-600 px-3 py-1.5 rounded-md hover:bg-emerald-50 font-bold transition-colors shadow-sm flex items-center gap-1 border border-slate-200"
              >
                <Plus size={16} /> 加入原料
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto w-full">
            {formData.items.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-sm font-medium">
                尚未加入任何原料，請點擊上方按鈕開始設計配方
              </div>
            ) : (
              <div className="min-w-[800px]">
                <div className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-5 pl-8">物料名稱</div>
                  <div className="col-span-3">使用量 (依基準產量設定)</div>
                  <div className="col-span-2 text-right">單位成本</div>
                  <div className="col-span-2 text-right pr-8">小計</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {formData.items.map((item, index) => {
                    const itemQty = parseFloat(item.quantity) || 0;
                    const subtotal = formatNum(
                      itemQty * item.estimated_cost,
                      2,
                    );

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

                    const excludedIds = formData.items
                      .filter((_, i) => i !== index)
                      .map((i) => i.material_id)
                      .filter(Boolean);

                    return (
                      <div
                        key={index}
                        className={`grid grid-cols-12 gap-3 px-6 py-3 items-center transition-colors group ${
                          isErrorRow
                            ? "bg-red-50/60 hover:bg-red-100/50"
                            : "hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="col-span-5 flex items-center gap-3">
                          <span className="text-slate-400 font-mono text-xs w-5 text-right shrink-0">
                            {index + 1}.
                          </span>
                          <div className="flex-1">
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

                                // 如果選到 SEMI，背景抓取隱藏的添加物
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
                        </div>

                        <div className="col-span-3 relative">
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "quantity",
                                e.target.value,
                              )
                            }
                            className={`w-full px-3 py-1.5 pr-10 border border-slate-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono text-sm transition-colors ${
                              isErrorRow
                                ? "border-red-300 focus:border-red-500 focus:ring-red-500 bg-white"
                                : ""
                            }`}
                            placeholder="0"
                          />
                          <span className="absolute right-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">
                            {item.unit}
                          </span>
                        </div>

                        <div className="col-span-2 text-right font-mono text-sm text-slate-500">
                          ${formatNum(item.estimated_cost, 2)}
                        </div>
                        <div className="col-span-2 flex justify-end items-center gap-4">
                          <span className="font-mono text-sm font-bold text-slate-700">
                            ${subtotal}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-slate-300 hover:text-red-500 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 🌟 佔位固定的全局添加物試算面板 (Apple Style) */}
          <div className="border-t border-slate-200 bg-slate-50/50 p-6 min-h-[220px] flex flex-col gap-5">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FlaskConical
                size={18}
                className="text-orange-500"
                strokeWidth={2.5}
              />
              法定添加物安全試算面板
            </h3>

            {additiveCalculations.results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg p-6 bg-white">
                <FlaskConical size={28} className="mb-2 opacity-30" />
                <span className="text-sm font-medium">
                  目前配方中尚無法定添加物
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {additiveCalculations.results.map((add) => {
                  const baseQty = parseFloat(formData.base_quantity) || 1;
                  const maxAllowedQty = baseQty * (add.limit / 100);

                  return (
                    <div
                      key={add.code}
                      className={`flex flex-col bg-white rounded-xl border shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300 ${
                        add.isExceeded
                          ? "border-red-200 ring-2 ring-red-100"
                          : "border-slate-200"
                      }`}
                    >
                      {/* Header */}
                      <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                        <h4 className="font-bold text-slate-800 text-base truncate pr-2">
                          {add.name}
                        </h4>
                        <span className="bg-white text-slate-500 text-xs px-2.5 py-1 rounded-md font-bold shrink-0 shadow-sm border border-slate-200">
                          上限 {formatNum(add.limit)}%
                        </span>
                      </div>

                      {/* Body: Math (直式加法) */}
                      <div className="p-5 flex-1 flex flex-col">
                        <div className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-wider">
                          配方貢獻來源
                        </div>
                        <div className="space-y-2 flex-1">
                          {add.sources.map((src, i) => (
                            <div
                              key={i}
                              className="flex justify-between items-baseline text-sm"
                            >
                              <span className="text-slate-600 truncate pr-4 text-xs font-medium">
                                <span className="text-slate-400 mr-1.5 font-normal">
                                  [{src.type === "DIRECT" ? "原料" : "半成品"}]
                                </span>
                                {src.name}
                              </span>
                              <span className="font-mono text-slate-600 shrink-0">
                                {formatNum(src.qty)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Summation Line */}
                        <div className="mt-4 pt-3 border-t-2 border-slate-800 flex justify-between items-end">
                          <span className="text-sm font-bold text-slate-800">
                            合計總重 (KG)
                          </span>
                          <span className="text-xl font-mono font-black text-slate-800 leading-none tracking-tight">
                            {formatNum(add.totalQty)}
                          </span>
                        </div>
                      </div>

                      {/* Footer: Result & Stats (Apple Style Widget) */}
                      <div className="p-5 border-t border-slate-100 bg-slate-50/30 flex flex-col gap-4">
                        {/* 數據小卡 */}
                        <div className="flex bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-1.5">
                          <div className="flex-1 flex flex-col items-center justify-center py-2 border-r border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                              安全上限 (KG)
                            </span>
                            <span className="font-mono font-bold text-slate-700 text-sm">
                              {formatNum(maxAllowedQty)}
                            </span>
                          </div>
                          <div className="flex-1 flex flex-col items-center justify-center py-2">
                            <span
                              className={`text-[10px] font-bold mb-1 uppercase tracking-wider ${
                                add.isExceeded
                                  ? "text-red-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {add.isExceeded
                                ? "已超標量 (KG)"
                                : "還可新增 (KG)"}
                            </span>
                            <span
                              className={`font-mono font-bold text-sm ${
                                add.isExceeded
                                  ? "text-red-500"
                                  : "text-slate-700"
                              }`}
                            >
                              {formatNum(
                                Math.abs(maxAllowedQty - add.totalQty),
                              )}
                            </span>
                          </div>
                        </div>

                        {/* 狀態與比例區塊 */}
                        <div className="flex justify-between items-center mt-1">
                          <div
                            className={`flex items-center gap-2 font-semibold text-sm tracking-wide ${
                              add.isExceeded
                                ? "text-red-500"
                                : "text-emerald-500"
                            }`}
                          >
                            {add.isExceeded ? (
                              <AlertTriangle size={20} strokeWidth={2.5} />
                            ) : (
                              <CheckCircle2 size={20} strokeWidth={2.5} />
                            )}
                            <span>
                              {add.isExceeded ? "佔比已超標" : "符合法規安全"}
                            </span>
                          </div>
                          <div className="text-right flex flex-col justify-center">
                            <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">
                              目前佔比
                            </div>
                            <div
                              className={`text-3xl font-black font-mono leading-none tracking-tighter flex items-baseline justify-end ${
                                add.isExceeded
                                  ? "text-red-500"
                                  : "text-slate-800"
                              }`}
                            >
                              {formatNum(add.usagePercent, 2)}
                              <span className="text-lg ml-0.5 font-bold opacity-40 text-slate-500">
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

          <div className="bg-slate-100 px-6 py-5 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-8">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                  總材料成本
                </p>
                <div className="text-slate-800 font-mono font-bold text-xl">
                  ${formatCurrency(calculations.totalCost)}
                </div>
              </div>
              <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                  每 KG 成本 (除 {formData.base_quantity} KG 基準)
                </p>
                <div className="text-blue-700 font-mono font-black text-2xl">
                  ${formatCurrency(calculations.unitCost)}
                </div>
              </div>
            </div>

            <div className="w-full md:w-auto">
              <button
                type="submit"
                disabled={isSubmitting || additiveCalculations.hasLimitError}
                title={
                  additiveCalculations.hasLimitError
                    ? "請先修正超標的添加物再行儲存"
                    : ""
                }
                className="w-full md:w-auto px-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {isSubmitting ? "儲存中..." : "儲存配方"}
              </button>
            </div>
          </div>
        </div>
      </form>

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

export default BOMCreatePage;
