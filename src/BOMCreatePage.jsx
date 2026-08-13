import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search,
  ChevronDown,
  Trash2,
  Plus,
  Calculator,
  Save,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ListOrdered,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useAuthStore } from "./store/authStore";

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
    base_quantity: 1,
    items: [],
  });

  // 🌟 修改：新增 onCloseCallback 狀態
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
    onConfirm: null,
    onCloseCallback: null,
  });

  // 🌟 修改：Alert 接收第四個參數作為 onCloseCallback
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

  // 🌟 修改：在關閉對話框時，檢查並執行 onCloseCallback
  const closeDialog = () => {
    const callback = dialog.onCloseCallback;
    setDialog((prev) => ({ ...prev, isOpen: false, onCloseCallback: null }));
    if (callback) callback(); // 執行傳入的 reload 動作
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
          ["RAW", "SEMI"].includes(m.type?.toUpperCase()),
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
            () => navigate(-1),
          );
        }

        setOriginalMaterialId(targetMaterial.id);

        const bomRes = await fetchWithAuth(
          `/api/boms?parent__code=${materialCode}`,
        );
        const bomJson = await bomRes.json();
        const bomList = bomJson.data || bomJson || [];

        const loadedItems = bomList
          .map((bom) => ({
            id: bom.id,
            material_id: bom.child?.id || bom.child,
            material_code: bom.child?.code || "",
            material_name: bom.child?.name || "未知物料",
            type: bom.child?.type || "",
            unit: bom.child?.unit || "KG",
            estimated_cost: bom.child?.estimated_cost || 0,
            quantity: bom.quantity_required,
          }))
          .sort(
            (a, b) =>
              (parseFloat(b.quantity) || 0) - (parseFloat(a.quantity) || 0),
          );

        setFormData({
          code: targetMaterial.code,
          name: targetMaterial.name,
          type: targetMaterial.type,
          base_quantity:
            bomList.length > 0 ? parseFloat(bomList[0].base_quantity) : 1,
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
          base_quantity: 1,
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
          const qtyA = parseFloat(a.quantity) || 0;
          const costA = parseFloat(a.estimated_cost) || 0;
          valA = qtyA * costA;

          const qtyB = parseFloat(b.quantity) || 0;
          const costB = parseFloat(b.estimated_cost) || 0;
          valB = qtyB * costB;
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
        if (!matRes.ok) throw new Error("更新成品資料失敗");
      } else {
        const matRes = await fetchWithAuth("/api/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(materialPayload),
        });
        if (!matRes.ok) throw new Error("建立成品資料失敗，請確認代碼是否重複");
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

      // 🌟 送出成功後，點擊 OK 就會觸發 reload
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

    showConfirm(
      isEditMode ? "更新配方確認" : "建立配方確認",
      isEditMode
        ? `確定要覆蓋更新配方「${formData.name}」嗎？`
        : `確定要建立配方「${formData.name}」嗎？\n系統將會同步在物料庫建立這筆成品資料。`,
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
                        {isDisabled && (
                          <span className="ml-auto text-xs text-slate-400 font-normal">
                            (已選擇)
                          </span>
                        )}
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
    <div className="w-full p-6 md:p-8 max-w-6xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800">
      {/* 標題與說明 */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Calculator className="text-blue-600" size={28} />
            {isEditMode ? "調整配方內容" : "配方與成本估算建立"}
          </h2>
        </div>

        <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg border border-blue-100 shadow-sm ml-12">
          <p className="flex items-center gap-2 font-medium mb-2">
            <span className="text-lg leading-none">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
            <li>請輸入配方代碼 (如 P9202020)、名稱與基準產量。</li>
            <li>
              下方清單加入物料時，系統會自動抓取該物料目前的
              <strong className="text-slate-800 mx-1">
                預估成本 (Estimated Cost)
              </strong>{" "}
              進行配方總價與每 KG 成本試算。
            </li>
            <li>
              可利用<strong className="text-slate-800 mx-1">用量排序</strong>與
              <strong className="text-slate-800 mx-1">小計排序</strong>
              功能，快速檢視成本大戶；再次點擊可切換高低順序。
            </li>
          </ul>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-6 ml-0 md:ml-12"
      >
        {/* 單頭區塊 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
            基本資訊
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
                配方名稱 <span className="text-red-500">*</span>
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
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                基準產量 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="base_quantity"
                min="0.01"
                step="0.01"
                value={formData.base_quantity}
                onChange={handleMasterChange}
                className="w-full h-[42px] px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono transition-colors"
              />
            </div>
          </div>
        </div>

        {/* 明細區塊 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-3">
            <h3 className="text-base font-bold text-slate-800">
              配方用料明細{" "}
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

          <div className="flex-1 overflow-x-auto">
            {formData.items.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-sm font-medium">
                尚未加入任何原料，請點擊上方按鈕開始設計配方
              </div>
            ) : (
              <div className="min-w-[800px]">
                <div className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-5 pl-8">物料名稱</div>
                  <div className="col-span-3">使用量</div>
                  <div className="col-span-2 text-right">單位成本</div>
                  <div className="col-span-2 text-right pr-8">小計</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {formData.items.map((item, index) => {
                    const subtotal = (
                      (parseFloat(item.quantity) || 0) * item.estimated_cost
                    ).toFixed(2);

                    const excludedIds = formData.items
                      .filter((_, i) => i !== index)
                      .map((i) => i.material_id)
                      .filter(Boolean);

                    return (
                      <div
                        key={index}
                        className="grid grid-cols-12 gap-3 px-6 py-3 items-center hover:bg-slate-50/50 transition-colors group"
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
                              onChange={(selectedMat) => {
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
                            className="w-full px-3 py-1.5 pr-10 border border-slate-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono text-sm transition-colors"
                            placeholder="0.00"
                          />
                          <span className="absolute right-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">
                            {item.unit}
                          </span>
                        </div>
                        <div className="col-span-2 text-right font-mono text-sm text-slate-500">
                          ${item.estimated_cost.toFixed(2)}
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

          <div className="bg-slate-50 px-6 py-5 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-8">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                  總材料成本
                </p>
                <div className="text-slate-800 font-mono font-bold text-xl">
                  $
                  {calculations.totalCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                  每 KG 成本 (÷ {formData.base_quantity})
                </p>
                <div className="text-blue-700 font-mono font-black text-2xl">
                  $
                  {calculations.unitCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full md:w-auto px-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={16} />
              {isSubmitting ? "儲存中..." : "儲存"}
            </button>
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
