import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Package,
  Calendar,
  Filter,
  AlertCircle,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";

const ITEMS_PER_PAGE = 10;

const TYPE_CONFIG = {
  RAW: {
    label: "原物料",
    css: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  SEMI: {
    label: "半成品",
    css: "bg-purple-100 text-purple-700 border-purple-200",
  },
  PACK: { label: "包材", css: "bg-amber-100 text-amber-700 border-amber-200" },
  PRODUCT: { label: "成品", css: "bg-blue-100 text-blue-700 border-blue-200" },
  STICKER: {
    label: "標籤貼紙",
    css: "bg-pink-100 text-pink-700 border-pink-200",
  },
  OTHER: { label: "其他", css: "bg-slate-100 text-slate-700 border-slate-200" },
};

const TAB_OPTIONS = [
  { value: "RAW", label: "原物料" },
  { value: "PRODUCT", label: "成品" },
  { value: "SEMI", label: "半成品" },
  { value: "PACK", label: "包材" },
  { value: "STICKER", label: "標籤貼紙" },
  { value: "OTHER", label: "其他" },
];

const TypeTag = ({ type }) => {
  const typeData = TYPE_CONFIG[type?.toUpperCase()] || {
    label: type,
    css: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`inline-block text-center min-w-[56px] px-2 py-0.5 rounded text-xs font-bold border ${typeData.css}`}
    >
      {typeData.label}
    </span>
  );
};

const formatDisplayNum = (val) => {
  if (val === null || val === undefined || val === "") return "";
  const num = Number(val);
  return isNaN(num) ? val : parseFloat(num.toFixed(2)).toString();
};

// ==========================================
// 🌟 Custom Dropdown (Portal + Searchable)
// ==========================================
const CustomDropdown = ({
  value,
  onChange,
  options,
  placeholder,
  searchable = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const selectRef = useRef(null);
  const dropdownMenuRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [value, options],
  );

  const filteredOptions = useMemo(() => {
    if (!search || !searchable) return options;
    const lowerSearch = search.toLowerCase();
    return options.filter(
      (opt) =>
        (opt.label && opt.label.toLowerCase().includes(lowerSearch)) ||
        (opt.code && opt.code.toLowerCase().includes(lowerSearch)),
    );
  }, [options, search, searchable]);

  const handleToggle = () => {
    if (!isOpen && selectRef.current) {
      const rect = selectRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: `${rect.bottom + 8}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleScrollOrClick = (e) => {
      if (dropdownMenuRef.current && dropdownMenuRef.current.contains(e.target))
        return;
      if (selectRef.current && selectRef.current.contains(e.target)) return;
      if (isOpen) setIsOpen(false);
    };
    const updatePosition = () => {
      if (isOpen && selectRef.current) {
        const rect = selectRef.current.getBoundingClientRect();
        setDropdownStyle({
          top: `${rect.bottom + 8}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
        });
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleScrollOrClick);
      document.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition, true);
    }
    return () => {
      document.removeEventListener("mousedown", handleScrollOrClick);
      document.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition, true);
    };
  }, [isOpen]);

  return (
    <>
      <div
        ref={selectRef}
        onClick={handleToggle}
        className={`w-full px-4 py-3 bg-white border rounded-xl text-[15px] cursor-pointer flex justify-between items-center transition-all ${
          isOpen
            ? "border-blue-500 ring-4 ring-blue-500/10"
            : "border-slate-300 hover:border-slate-400 shadow-sm"
        }`}
      >
        <span
          className={
            selectedOption
              ? "text-slate-800 font-bold truncate"
              : "text-slate-400 font-medium truncate"
          }
        >
          {selectedOption
            ? selectedOption.code
              ? `[${selectedOption.code}] ${selectedOption.label}`
              : selectedOption.label
            : placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`text-slate-400 shrink-0 ml-2 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownMenuRef}
            style={dropdownStyle}
            className="fixed bg-white border border-slate-200 shadow-2xl rounded-2xl max-h-72 flex flex-col z-[99999] overflow-hidden"
          >
            {searchable && (
              <div className="p-3 border-b border-slate-100 bg-slate-50 shrink-0">
                <input
                  autoFocus
                  type="text"
                  placeholder="搜尋..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm font-medium text-slate-800"
                />
              </div>
            )}
            <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer rounded-xl flex items-center gap-3 transition-colors"
                  >
                    {opt.code && (
                      <span className="text-[11px] font-mono bg-white shadow-sm border border-slate-200 px-2 py-0.5 rounded-lg text-slate-500 font-bold shrink-0">
                        {opt.code}
                      </span>
                    )}
                    <span
                      className={`text-sm font-bold truncate ${opt.color || "text-slate-700"}`}
                    >
                      {opt.label}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-slate-400 font-medium">
                  查無結果
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default function InventoryPage() {
  const [batches, setBatches] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState("RAW");

  const [searchMaterial, setSearchMaterial] = useState("");
  const [searchBatchNumber, setSearchBatchNumber] = useState("");
  const [searchDateStart, setSearchDateStart] = useState("");
  const [searchDateEnd, setSearchDateEnd] = useState("");

  // 🌟 快速篩選按鈕狀態：是否僅顯示包含未收貨完畢批號的物料
  const [filterNotFullyReceived, setFilterNotFullyReceived] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [expandedMaterials, setExpandedMaterials] = useState([]);
  const [expandedBatches, setExpandedBatches] = useState([]);

  const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialBatchData = {
    batch_number: "",
    material: "",
    original_qty: "",
    received_date: new Date().toISOString().split("T")[0],
    expiration_date: new Date().toISOString().split("T")[0],
  };
  const [batchFormData, setBatchFormData] = useState(initialBatchData);

  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
    onConfirm: null,
  });

  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  const showAlert = (title, message, status = "info") =>
    setDialog({
      isOpen: true,
      type: "alert",
      status,
      title,
      message,
      onConfirm: closeDialog,
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

  useEffect(() => {
    Promise.all([fetchBatches(), fetchMaterials()]);
  }, []);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/batches");
      if (!res.ok) throw new Error("無法載入批號資料");
      setBatches((await res.json()).data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const res = await fetchWithAuth("/api/materials");
      if (res.ok) setMaterials((await res.json()).data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const getBatchMatId = (b) => {
    if (!b) return null;
    if (typeof b.material === "object" && b.material !== null)
      return b.material.id;
    if (typeof b.product === "object" && b.product !== null)
      return b.product.id;
    return b.material || b.material_id || b.product || b.product_id || null;
  };

  // 🌟 計算全系統中尚未收貨完畢的批號數量供按鈕提示使用
  const notFullyReceivedCount = useMemo(() => {
    if (!Array.isArray(batches)) return 0;
    return batches.filter(
      (b) =>
        b.source_pr_item_detail &&
        b.source_pr_item_detail.is_fully_received === false,
    ).length;
  }, [batches]);

  const groupedBatches = useMemo(() => {
    if (!materials || materials.length === 0) return [];

    let filteredBatches = Array.isArray(batches) ? [...batches] : [];

    if (searchBatchNumber) {
      const term = searchBatchNumber.toLowerCase();
      filteredBatches = filteredBatches.filter(
        (b) => b.batch_number && b.batch_number.toLowerCase().includes(term),
      );
    }
    if (searchDateStart) {
      filteredBatches = filteredBatches.filter(
        (b) => b.received_date && b.received_date >= searchDateStart,
      );
    }
    if (searchDateEnd) {
      filteredBatches = filteredBatches.filter(
        (b) => b.received_date && b.received_date <= searchDateEnd,
      );
    }

    const nameToIdMap = {};
    materials.forEach((m) => {
      if (m.name) nameToIdMap[m.name.trim()] = m.id;
    });

    const batchesByMatId = {};
    filteredBatches.forEach((b) => {
      let matId = getBatchMatId(b);
      if (!matId) {
        const name = b.material_name || b.product_name;
        if (name && nameToIdMap[name.trim()]) {
          matId = nameToIdMap[name.trim()];
        }
      }
      if (matId) {
        const key = String(matId);
        if (!batchesByMatId[key]) batchesByMatId[key] = [];
        batchesByMatId[key].push(b);
      }
    });

    let targetMaterials = materials.filter(
      (m) => (m.type?.toUpperCase() || "OTHER") === activeTab,
    );

    // 🌟 篩選邏輯修正：當開啟過濾時，只保留「該物料底下至少有一個批號尚未收貨完畢」的物料，
    // 但該物料底下的所有其他批號「不會被隱藏」，依然完整保留顯示。
    if (filterNotFullyReceived) {
      targetMaterials = targetMaterials.filter((m) => {
        const matBatches = batchesByMatId[String(m.id)] || [];
        return matBatches.some(
          (b) =>
            b.source_pr_item_detail &&
            b.source_pr_item_detail.is_fully_received === false,
        );
      });
    }

    if (searchMaterial) {
      const term = searchMaterial.toLowerCase();
      targetMaterials = targetMaterials.filter(
        (m) =>
          (m.name && m.name.toLowerCase().includes(term)) ||
          (m.code && m.code.toLowerCase().includes(term)),
      );
    }

    const hasBatchFilter = Boolean(
      searchBatchNumber ||
      searchDateStart ||
      searchDateEnd ||
      filterNotFullyReceived,
    );

    const result = [];
    targetMaterials.forEach((m) => {
      const matBatches = batchesByMatId[String(m.id)] || [];
      if (
        hasBatchFilter &&
        matBatches.length === 0 &&
        !filterNotFullyReceived
      ) {
        return;
      }

      const totalRemaining = matBatches.reduce(
        (sum, b) => sum + parseFloat(b.remaining_qty || 0),
        0,
      );

      result.push({
        material_name: m.name,
        material_code: m.code,
        material_id: m.id,
        unit: m.unit || "KG",
        total_remaining: totalRemaining,
        batches: matBatches, // 保留該物料的所有批號
      });
    });

    return result.sort((a, b) =>
      a.material_name.localeCompare(b.material_name),
    );
  }, [
    batches,
    materials,
    activeTab,
    searchMaterial,
    searchBatchNumber,
    searchDateStart,
    searchDateEnd,
    filterNotFullyReceived,
  ]);

  const totalPages = Math.ceil(groupedBatches.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedGroups = groupedBatches.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
    setExpandedMaterials([]);
  }, [
    searchMaterial,
    searchBatchNumber,
    searchDateStart,
    searchDateEnd,
    activeTab,
    filterNotFullyReceived,
  ]);

  const toggleMaterialExpand = (matName) => {
    setExpandedMaterials((prev) => {
      if (prev.includes(matName)) {
        return prev.filter((n) => n !== matName);
      } else {
        return [...prev, matName];
      }
    });
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    if (
      !batchFormData.batch_number ||
      !batchFormData.material ||
      !batchFormData.original_qty
    ) {
      return showAlert("提示", "請填寫完整批號資訊", "warning");
    }
    setIsSubmitting(true);
    const payload = {
      ...batchFormData,
      remaining_qty: batchFormData.original_qty,
    };
    try {
      const res = await fetchWithAuth("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("新增批號失敗");
      await fetchBatches();
      setIsAddBatchModalOpen(false);
      showAlert("成功", "批號新增成功", "success");
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const materialOptions = materials.map((m) => ({
    value: m.id,
    label: m.name,
    code: m.code,
  }));

  if (loading && batches.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="text-lg font-bold text-slate-400 animate-pulse">
          載入資料中...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden p-6 md:p-10 max-w-[1400px] mx-auto bg-slate-50/50 min-h-screen font-sans text-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
              批號管理與庫存追蹤
            </h2>
            <p className="text-slate-500 mt-2 font-semibold">
              管理廠內各物料之實體批號庫存狀態與請購單交貨進度追蹤
            </p>
          </div>
        </div>

        <div className="bg-blue-50/80 text-blue-800 text-sm p-4 rounded-2xl mb-6 border border-blue-100/50 shadow-sm">
          <p className="flex items-center gap-2 font-bold mb-2">
            <span className="text-lg leading-none">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700 font-medium">
            <li>
              透過雙層結構將<strong>物料</strong>與<strong>批號庫存</strong>
              分群顯示，支援<strong>多維度過濾</strong>。
            </li>
            <li>
              若批號對應之<strong>請購單尚未完整收貨完畢</strong>
              ，系統將自動顯示提醒標籤。
            </li>
          </ul>
        </div>

        {error && (
          <div className="p-4 mb-8 text-red-700 bg-red-50 rounded-2xl border border-red-200 shadow-sm flex items-center gap-3">
            <span className="text-xl">⚠️</span>{" "}
            <span className="font-bold">{error}</span>
          </div>
        )}

        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <Filter size={18} className="text-blue-500" /> 搜尋與快速過濾
            </div>

            {/* 🌟 快速篩選按鈕與即時筆數提示 */}
            <button
              type="button"
              onClick={() => setFilterNotFullyReceived((prev) => !prev)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 border shadow-2xs ${
                filterNotFullyReceived
                  ? "bg-amber-500 text-white border-amber-600 shadow-amber-500/20"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              }`}
            >
              <AlertCircle
                size={15}
                className={
                  filterNotFullyReceived ? "text-white" : "text-amber-600"
                }
              />
              <span>
                {filterNotFullyReceived
                  ? "取消篩選（顯示全部）"
                  : "篩選尚未收貨完畢物料"}
              </span>
              {notFullyReceivedCount > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    filterNotFullyReceived
                      ? "bg-white text-amber-800"
                      : "bg-amber-200 text-amber-900"
                  }`}
                >
                  {notFullyReceivedCount} 筆未收齊
                </span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                物料名稱
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="搜尋物料名稱"
                  value={searchMaterial}
                  onChange={(e) => setSearchMaterial(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                批號
              </label>
              <div className="relative">
                <Package
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="搜尋批號代碼"
                  value={searchBatchNumber}
                  onChange={(e) => setSearchBatchNumber(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                入庫日期
              </label>
              <div className="relative flex items-center gap-2">
                <Calendar size={16} className="text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={searchDateStart}
                  onChange={(e) => setSearchDateStart(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
                <span className="text-slate-400 text-sm shrink-0">至</span>
                <input
                  type="date"
                  value={searchDateEnd}
                  onChange={(e) => setSearchDateEnd(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={() => {
                setSearchMaterial("");
                setSearchBatchNumber("");
                setSearchDateStart("");
                setSearchDateEnd("");
                setFilterNotFullyReceived(false);
              }}
              className="text-sm text-slate-400 hover:text-red-500 font-bold transition-colors"
            >
              清除所有條件
            </button>
            <button
              onClick={() => {
                setBatchFormData(initialBatchData);
                setIsAddBatchModalOpen(true);
              }}
              className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg shadow-sm transition-all text-sm font-bold"
            >
              + 新增庫存批號
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto mt-6 pb-2 border-b border-slate-100 custom-scrollbar">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-5 py-2.5 rounded-t-lg font-bold text-sm whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeTab === tab.value
                    ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                    : "bg-white text-slate-500 hover:bg-slate-50 border-b-2 border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white p-4 sm:p-8 rounded-3xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col justify-between">
          <div className="space-y-6">
            {paginatedGroups.length > 0 ? (
              paginatedGroups.map((group) => {
                const isMatExpanded = expandedMaterials.includes(
                  group.material_name,
                );

                return (
                  <div
                    key={group.material_name}
                    className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm transition-all duration-300"
                  >
                    <div className="p-5 flex items-center justify-between transition-colors group bg-slate-50/30 hover:bg-blue-50/30">
                      <div
                        className="flex items-center gap-4 flex-1 cursor-pointer"
                        onClick={() =>
                          toggleMaterialExpand(group.material_name)
                        }
                      >
                        <span
                          className={`w-8 h-8 flex items-center justify-center text-blue-500 bg-white border border-blue-100 rounded-full transition-transform duration-300 shadow-sm ${isMatExpanded ? "rotate-90" : ""}`}
                        >
                          ▶
                        </span>
                        <Package className="text-slate-400" size={20} />
                        <span className="font-extrabold text-xl text-slate-800 tracking-tight">
                          {group.material_name}
                        </span>
                        <span className="ml-3 px-3 py-1 bg-white text-slate-600 rounded-lg text-xs font-bold border border-slate-200 shadow-sm">
                          共 {group.batches.length} 個批號
                        </span>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-slate-500 font-bold flex items-baseline gap-2">
                          <span className="text-xs">總庫存量</span>
                          <span className="text-xl font-mono text-slate-800">
                            {formatDisplayNum(group.total_remaining)}
                          </span>
                          <span className="text-sm">{group.unit}</span>
                        </div>
                      </div>
                    </div>

                    {isMatExpanded && (
                      <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50/50 space-y-4">
                        {group.batches.length > 0 ? (
                          group.batches.map((batch) => {
                            const isLowStock =
                              parseFloat(batch.remaining_qty) <
                              parseFloat(batch.original_qty) * 0.2;

                            // 檢查對應之請購單是否尚未完整收貨完畢
                            const isNotFullyReceived =
                              batch.source_pr_item_detail &&
                              batch.source_pr_item_detail.is_fully_received ===
                                false;
                            const prId =
                              batch.source_pr_item_detail?.requisition_id;

                            return (
                              <div
                                key={batch.id}
                                className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:border-slate-300 transition-colors"
                              >
                                <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center">
                                  <div className="flex items-center gap-4 flex-1 min-w-0 flex-wrap">
                                    <span className="font-mono text-sm font-black text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded shadow-sm">
                                      {batch.batch_number}
                                    </span>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 font-bold ml-2">
                                      <span>入庫: {batch.received_date}</span>
                                      <span>|</span>
                                      <span>效期: {batch.expiration_date}</span>
                                    </div>

                                    {/* 🌟 提醒標籤：該請購單還沒收貨完畢 */}
                                    {isNotFullyReceived && (
                                      <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-300 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs">
                                        <AlertCircle
                                          size={14}
                                          className="text-amber-600 shrink-0"
                                        />
                                        <span>
                                          請購單 {prId ? `#${prId} ` : ""}
                                          尚未收貨完畢
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-4 md:mt-0 flex items-center justify-end gap-6 flex-shrink-0">
                                    <div
                                      className={`px-3 py-1 rounded border shadow-sm flex items-baseline gap-1.5 ${isLowStock ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-700"}`}
                                    >
                                      <span className="text-[10px] uppercase font-bold tracking-wider">
                                        剩餘
                                      </span>
                                      <span className="font-mono font-black text-base">
                                        {formatDisplayNum(batch.remaining_qty)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-8 bg-white border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm font-bold flex flex-col items-center justify-center gap-2">
                            <span>此物料目前尚無庫存批號</span>
                            <button
                              onClick={() => {
                                setBatchFormData({
                                  ...initialBatchData,
                                  material: group.material_id,
                                });
                                setIsAddBatchModalOpen(true);
                              }}
                              className="text-blue-600 hover:text-blue-700 hover:underline text-xs font-bold"
                            >
                              + 立即為此物料建立庫存批號
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-24 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-5 border border-slate-100">
                  <Search size={32} />
                </div>
                <span className="text-slate-400 font-bold text-lg">
                  查無符合條件的物料與批號資料
                </span>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-6 px-4">
              <div className="text-sm text-slate-500 font-bold">
                顯示第 {startIndex + 1} 到{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, groupedBatches.length)}{" "}
                項物料， 共 {groupedBatches.length} 項物料
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 shadow-sm transition-all"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-black text-slate-700 px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 shadow-sm transition-all"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        {isAddBatchModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-extrabold text-slate-800">
                  新增庫存批號
                </h3>
                <button
                  onClick={() => setIsAddBatchModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xl"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                    批號代碼 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={batchFormData.batch_number}
                    onChange={(e) =>
                      setBatchFormData((prev) => ({
                        ...prev,
                        batch_number: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-mono font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                    物料 <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    value={batchFormData.material}
                    options={materialOptions}
                    onChange={(val) =>
                      setBatchFormData((prev) => ({
                        ...prev,
                        material: val,
                      }))
                    }
                    placeholder="請選擇物料..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                    初始進貨量(KG) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={batchFormData.original_qty}
                    onChange={(e) =>
                      setBatchFormData((prev) => ({
                        ...prev,
                        original_qty: e.target.value,
                      }))
                    }
                    onBlur={(e) => {
                      const num = parseFloat(e.target.value);
                      setBatchFormData((prev) => ({
                        ...prev,
                        original_qty: !isNaN(num) ? num.toFixed(2) : "",
                      }));
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-mono font-bold text-right focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                      入庫日期
                    </label>
                    <input
                      type="date"
                      value={batchFormData.received_date}
                      onChange={(e) =>
                        setBatchFormData((prev) => ({
                          ...prev,
                          received_date: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                      有效期限
                    </label>
                    <input
                      type="date"
                      value={batchFormData.expiration_date}
                      onChange={(e) =>
                        setBatchFormData((prev) => ({
                          ...prev,
                          expiration_date: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setIsAddBatchModalOpen(false)}
                  className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveBatch}
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all hover:-translate-y-0.5 disabled:opacity-50"
                >
                  確認新增
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
    </>
  );
}
