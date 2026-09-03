import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  ChevronDown,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Printer,
  FileText,
  Package,
  Calendar,
  Filter,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { CompanyLogo } from "./components/companyLogo";

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

const formatTolerance = (min, max) => {
  if (min !== null && max !== null && min !== undefined && max !== undefined) {
    const minNum = parseFloat(min);
    const maxNum = parseFloat(max);
    const mid = (minNum + maxNum) / 2;
    const diff = (maxNum - minNum) / 2;
    return `${mid.toFixed(1)} ± ${diff.toFixed(1)}`;
  } else if (max !== null && max !== undefined) return `< ${max}`;
  else if (min !== null && min !== undefined) return `> ${min}`;
  return "-";
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

// ==========================================
// 🌟 列印 Template - COA 產品檢驗報告表 (標準 A4 橫向無截斷版)
// ==========================================
const COAPrintTemplate = ({ data, material, customerName }) => {
  if (!data || !material) return null;

  const qcRecordsArray = Array.isArray(data) ? data : [data];
  const todayStr = new Date()
    .toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, ". ");

  const moistureStandard = material.qc_moisture_max
    ? `< ${material.qc_moisture_max}%`
    : "-";
  const brixStandard = formatTolerance(
    material.qc_brix_min,
    material.qc_brix_max,
  );
  const saltStandard = formatTolerance(
    material.qc_salt_min,
    material.qc_salt_max,
  );
  const dilutionRemark = material.qc_dilution_ratio
    ? `${material.qc_dilution_ratio.replace(/[()]/g, "")} 稀釋`
    : "-";

  // 動態過濾：只收集真正有檢驗結果的項目
  const getValidTestItems = (qcRecord) => {
    const items = [];
    if (!qcRecord) return items;

    if (Array.isArray(qcRecord.actual_microbiology)) {
      qcRecord.actual_microbiology.forEach((m) => {
        if (
          m &&
          m.result !== null &&
          m.result !== undefined &&
          String(m.result).trim() !== ""
        ) {
          items.push({
            name: m.item,
            standard: m.limit || "-",
            result: m.result,
            remark: "-",
          });
        }
      });
    }

    if (
      qcRecord.actual_moisture !== null &&
      qcRecord.actual_moisture !== undefined &&
      String(qcRecord.actual_moisture).trim() !== ""
    ) {
      items.push({
        name: "水分(%)",
        standard: moistureStandard,
        result: formatDisplayNum(qcRecord.actual_moisture),
        remark: "鹵素燈水分儀檢測",
      });
    }

    if (
      qcRecord.actual_brix !== null &&
      qcRecord.actual_brix !== undefined &&
      String(qcRecord.actual_brix).trim() !== ""
    ) {
      items.push({
        name: "糖度 Brix(°)",
        standard: brixStandard,
        result: formatDisplayNum(qcRecord.actual_brix),
        remark: dilutionRemark,
      });
    }

    if (
      qcRecord.actual_salt !== null &&
      qcRecord.actual_salt !== undefined &&
      String(qcRecord.actual_salt).trim() !== ""
    ) {
      items.push({
        name: "鹽度(%)",
        standard: saltStandard,
        result: formatDisplayNum(qcRecord.actual_salt),
        remark: dilutionRemark,
      });
    }

    return items;
  };

  const recordsWithResults = qcRecordsArray
    .map((recordItem) => ({
      ...recordItem,
      testItems: getValidTestItems(recordItem.qcRecord),
    }))
    .filter((recordItem) => recordItem.testItems.length > 0);

  const uniqueInspectors = [
    ...new Set(
      recordsWithResults.map((r) => r.qcRecord?.inspector_name).filter(Boolean),
    ),
  ].join(", ");

  return (
    <div className="hidden print:block w-full bg-white text-black font-sans mx-auto box-border">
      <style>{`
        @media print { 
          @page { 
            size: A4 landscape; 
            margin: 8mm 10mm; 
          } 
          html, body { 
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          thead {
            display: table-header-group;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="border-[3px] border-black w-full box-border">
        {/* 表頭區塊 */}
        <div className="flex border-b-[3px] border-black pb-1.5 pt-2">
          <div className="w-[18%] flex items-center justify-center">
            <CompanyLogo className="w-16 h-16" />
          </div>
          <div className="w-[64%] flex flex-col justify-center items-center text-center">
            <div className="text-2xl font-black tracking-[0.8em] mb-1">
              基香食品有限公司
            </div>
            <div className="text-xl font-bold tracking-[0.8em] border-t-[2px] border-black pt-1 w-3/4">
              產品檢驗報告表
            </div>
          </div>
          <div className="w-[18%]"></div>
        </div>

        {/* 客戶與日期資訊列 */}
        <div className="flex border-b-[3px] border-black text-xs font-bold h-8">
          <div className="w-[12%] border-r-[2px] border-black flex items-center justify-center bg-gray-50">
            客戶名稱
          </div>
          <div className="w-[68%] flex items-center px-3 tracking-wider">
            {customerName || "廠內備查"}
          </div>
          <div className="w-[20%] border-l-[2px] border-black flex items-center justify-center tracking-wider text-[11px]">
            報告日期：{todayStr}
          </div>
        </div>

        {/* 🌟 100% 精準比例表格 (table-fixed 確保每一列嚴格按照百分比佈局) */}
        <table className="w-full table-fixed text-center text-xs font-bold border-collapse">
          <thead>
            <tr className="border-b-[3px] border-black bg-gray-50 h-8 text-[11px]">
              <th className="border-r-[2px] border-black w-[4%]">項次</th>
              <th className="border-r-[2px] border-black w-[7%]">產品編號</th>
              <th className="border-r-[2px] border-black w-[15%]">產品名稱</th>
              <th className="border-r-[2px] border-black w-[11%]">製造批號</th>
              <th className="border-r-[2px] border-black w-[9%]">製造日期</th>
              <th className="border-r-[2px] border-black w-[9%]">有效日期</th>
              <th className="border-r-[2px] border-black w-[11%]">保存方式</th>
              <th className="border-r-[2px] border-black w-[10%]">檢驗項目</th>
              <th className="border-r-[2px] border-black w-[10%]">標準範圍</th>
              <th className="border-r-[2px] border-black w-[5%]">檢測結果</th>
              <th className="w-[9%]">備 註</th>
            </tr>
          </thead>
          <tbody>
            {recordsWithResults.length > 0 ? (
              recordsWithResults.map((recordItem, recordIdx) => {
                const { batch, testItems } = recordItem;
                const mfgDate = batch?.received_date
                  ? String(batch.received_date).replace(/-/g, "")
                  : "";
                const expDate = batch?.expiration_date
                  ? String(batch.expiration_date).replace(/-/g, "")
                  : "";
                const batchNumber = batch?.batch_number || "";
                const totalRows = testItems.length;

                return (
                  <React.Fragment key={recordItem.qcRecord?.id || recordIdx}>
                    {testItems.map((item, idx) => {
                      const isFirstRow = idx === 0;
                      const isLastRow = idx === totalRows - 1;

                      return (
                        <tr
                          key={idx}
                          className={
                            isLastRow
                              ? "border-b-[3px] border-black"
                              : "border-b border-black"
                          }
                        >
                          {isFirstRow && (
                            <>
                              <td
                                className="border-r-[2px] border-black py-1 px-0.5"
                                rowSpan={totalRows}
                              >
                                {recordIdx + 1}
                              </td>
                              <td
                                className="border-r-[2px] border-black py-1 px-1 font-mono text-[11px] break-all leading-tight"
                                rowSpan={totalRows}
                              >
                                {material.code}
                              </td>
                              <td
                                className="border-r-[2px] border-black py-1 px-1.5 text-left break-words leading-tight"
                                rowSpan={totalRows}
                              >
                                {material.name}
                              </td>
                              <td
                                className="border-r-[2px] border-black py-1 px-1 font-mono text-[11px] break-all leading-tight"
                                rowSpan={totalRows}
                              >
                                {batchNumber}
                              </td>
                              <td
                                className="border-r-[2px] border-black py-1 px-0.5 font-mono text-[11px]"
                                rowSpan={totalRows}
                              >
                                {mfgDate}
                              </td>
                              <td
                                className="border-r-[2px] border-black py-1 px-0.5 font-mono text-[11px]"
                                rowSpan={totalRows}
                              >
                                {expDate}
                              </td>
                              <td
                                className="border-r-[2px] border-black py-1 px-1 text-left text-[10px] leading-tight whitespace-nowrap"
                                rowSpan={totalRows}
                              >
                                <div>■常溫 28°C↓</div>
                                <div>□冷藏 0-7°C↓</div>
                                <div>□冷凍 -18°C↓</div>
                              </td>
                            </>
                          )}
                          <td className="border-r-[2px] border-black py-1 px-1 break-words text-[11px] leading-tight">
                            {item.name}
                          </td>
                          <td className="border-r-[2px] border-black py-1 px-1 font-normal break-words text-[11px] leading-tight">
                            {item.standard}
                          </td>
                          <td className="border-r-[2px] border-black py-1 px-1 font-mono text-[11px]">
                            {item.result}
                          </td>
                          <td className="py-1 px-0.5 font-normal text-[9px] text-black-800 break-words leading-tight">
                            {item.remark}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={11}
                  className="p-6 text-center text-gray-800 font-bold text-lg"
                >
                  此物料目前尚無任何已登打之檢測結果
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 簽核簽名區塊 (加入 print-avoid-break 防止單獨掉到下一頁) */}
      <div className="print-avoid-break flex justify-between items-end mt-6 px-8 font-bold text-base">
        <div>
          主 管：
          <span className="w-40 inline-block border-b border-black"></span>
        </div>
        <div>
          品 管：
          <span className="w-40 inline-block border-b border-black text-center italic font-normal tracking-widest text-sm">
            {uniqueInspectors}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function InventoryPage() {
  const [batches, setBatches] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState("RAW");

  const [searchMaterial, setSearchMaterial] = useState("");
  const [searchBatchNumber, setSearchBatchNumber] = useState("");
  const [searchDateStart, setSearchDateStart] = useState("");
  const [searchDateEnd, setSearchDateEnd] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [expandedMaterials, setExpandedMaterials] = useState([]);
  const [expandedBatches, setExpandedBatches] = useState([]);
  const [qcRecordsMap, setQcRecordsMap] = useState({});

  const [printConfig, setPrintConfig] = useState(null);
  const [isQCModalOpen, setIsQCModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState(false);
  const [printDraft, setPrintDraft] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");

  const [currentBatch, setCurrentBatch] = useState(null);
  const [editingQCId, setEditingQCId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialQCData = {
    test_date: new Date().toISOString().split("T")[0],
    sample_date: new Date().toISOString().split("T")[0],
    actual_microbiology: [],
    actual_moisture: "",
    actual_brix: "",
    actual_salt: "",
    is_passed: false,
    remark: "",
  };
  const [qcFormData, setQcFormData] = useState(initialQCData);

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

  useEffect(() => {
    Promise.all([fetchBatches(), fetchMaterials(), fetchProviders()]);
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

  const fetchProviders = async () => {
    try {
      const res = await fetchWithAuth("/api/vendors");
      if (res.ok) setProviders((await res.json()).data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchQCRecords = async (batchId) => {
    try {
      const res = await fetchWithAuth(`/api/qc_records?batch_id=${batchId}`);
      if (res.ok) {
        const json = await res.json();
        const records = json.data || json || [];
        setQcRecordsMap((prev) => ({
          ...prev,
          [batchId]: records,
        }));
        return records;
      }
    } catch (error) {
      console.error(error);
    }
    return [];
  };

  const getBatchMatId = (b) => {
    if (!b) return null;
    if (typeof b.material === "object" && b.material !== null)
      return b.material.id;
    if (typeof b.product === "object" && b.product !== null)
      return b.product.id;
    return b.material || b.material_id || b.product || b.product_id || null;
  };

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

    if (searchMaterial) {
      const term = searchMaterial.toLowerCase();
      targetMaterials = targetMaterials.filter(
        (m) =>
          (m.name && m.name.toLowerCase().includes(term)) ||
          (m.code && m.code.toLowerCase().includes(term)),
      );
    }

    const hasBatchFilter = Boolean(
      searchBatchNumber || searchDateStart || searchDateEnd,
    );

    const result = [];
    targetMaterials.forEach((m) => {
      const matBatches = batchesByMatId[String(m.id)] || [];
      if (hasBatchFilter && matBatches.length === 0) {
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
        batches: matBatches,
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
  ]);

  const toggleMaterialExpand = (matName, groupBatches) => {
    setExpandedMaterials((prev) => {
      if (prev.includes(matName)) {
        return prev.filter((n) => n !== matName);
      } else {
        groupBatches.forEach((b) => {
          if (!qcRecordsMap[b.id]) fetchQCRecords(b.id);
        });
        return [...prev, matName];
      }
    });
  };

  const toggleBatchExpand = (batchId) => {
    if (expandedBatches.includes(batchId)) {
      setExpandedBatches((prev) => prev.filter((id) => id !== batchId));
    } else {
      setExpandedBatches((prev) => [...prev, batchId]);
      fetchQCRecords(batchId);
    }
  };

  const preparePrintAllCOA = async (group) => {
    const relatedMaterial = materials.find(
      (m) => String(m.id) === String(group.material_id),
    ) || {
      id: group.material_id,
      name: group.material_name,
      code: group.material_code || "-",
      qc_microbiology: [],
    };

    let updatedMap = { ...qcRecordsMap };

    if (group.batches && group.batches.length > 0) {
      const missingBatches = group.batches.filter((b) => !updatedMap[b.id]);
      if (missingBatches.length > 0) {
        await Promise.all(
          missingBatches.map(async (b) => {
            try {
              const res = await fetchWithAuth(
                `/api/qc_records?batch_id=${b.id}`,
              );
              if (res.ok) {
                const json = await res.json();
                updatedMap[b.id] = json.data || json || [];
              }
            } catch (err) {
              console.error(err);
            }
          }),
        );
        setQcRecordsMap(updatedMap);
      }
    }

    let allPrintData = [];
    if (group.batches && group.batches.length > 0) {
      group.batches.forEach((b) => {
        const records = updatedMap[b.id] || [];
        records.forEach((qc) => {
          allPrintData.push({ qcRecord: qc, batch: b });
        });
      });
    }

    setPrintDraft({ dataArray: allPrintData, material: relatedMaterial });
    setSelectedCustomer("");
    setIsPrintModalOpen(true);
  };

  const preparePrintSingleCOA = (qcRecord, material, batch) => {
    const relatedMaterial = material || {
      name: batch?.material_name || "產品檢驗報告",
      code: "-",
      qc_microbiology: [],
    };
    setPrintDraft({
      dataArray: [{ qcRecord, batch }],
      material: relatedMaterial,
    });
    setSelectedCustomer("");
    setIsPrintModalOpen(true);
  };

  const executePrintCOA = (e) => {
    e.preventDefault();
    if (!selectedCustomer)
      return showAlert("提示", "請選擇客戶名稱", "warning");
    const customerObj = providers.find(
      (p) => String(p.id) === String(selectedCustomer),
    );

    setPrintConfig({
      data: printDraft.dataArray,
      material: printDraft.material,
      customerName: customerObj ? customerObj.name : "廠內備查",
    });

    setIsPrintModalOpen(false);
    setTimeout(() => {
      const originalTitle = document.title;
      const suffix =
        printDraft.dataArray.length > 1
          ? "總表"
          : printDraft.dataArray[0]?.qcRecord?.batch_number ||
            printDraft.dataArray[0]?.batch?.batch_number ||
            "COA";
      document.title = `${suffix}_COA檢驗報告_${printDraft.material?.name || ""}`;
      window.print();
      document.title = originalTitle;
      setPrintConfig(null);
    }, 150);
  };

  const openQCModal = (batch, qcRecord = null) => {
    setCurrentBatch(batch);
    const bMatId = getBatchMatId(batch);
    const relatedMaterial = materials.find(
      (m) => String(m.id) === String(bMatId),
    );

    if (qcRecord) {
      setEditingQCId(qcRecord.id);
      setQcFormData({
        test_date: qcRecord.test_date,
        sample_date: qcRecord.sample_date,
        actual_microbiology: Array.isArray(qcRecord.actual_microbiology)
          ? qcRecord.actual_microbiology
          : [],
        actual_moisture: qcRecord.actual_moisture ?? "",
        actual_brix: qcRecord.actual_brix ?? "",
        actual_salt: qcRecord.actual_salt ?? "",
        is_passed: qcRecord.is_passed,
        remark: qcRecord.remark || "",
      });
    } else {
      setEditingQCId(null);
      let defaultMicro = [];
      if (relatedMaterial && Array.isArray(relatedMaterial.qc_microbiology)) {
        defaultMicro = relatedMaterial.qc_microbiology.map((item) => ({
          item: item.item,
          limit: item.limit,
          result: "",
          is_passed: false,
        }));
      }
      setQcFormData({ ...initialQCData, actual_microbiology: defaultMicro });
    }
    setIsQCModalOpen(true);
  };

  const handleQCSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const bMatId = getBatchMatId(currentBatch);

    const payload = {
      ...qcFormData,
      batch: currentBatch.id,
      material: bMatId,
      actual_moisture: qcFormData.actual_moisture || null,
      actual_brix: qcFormData.actual_brix || null,
      actual_salt: qcFormData.actual_salt || null,
      actual_microbiology: qcFormData.actual_microbiology,
    };

    const url = editingQCId
      ? `/api/qc_records/${editingQCId}`
      : "/api/qc_records";
    try {
      const res = await fetchWithAuth(url, {
        method: editingQCId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("儲存檢驗紀錄失敗");
      await fetchQCRecords(currentBatch.id);
      setIsQCModalOpen(false);
      showAlert("成功", `品管紀錄已儲存`, "success");
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQC = (batchId, qcId) => {
    showConfirm("確認刪除", "確定要刪除這筆檢驗紀錄嗎？", async () => {
      closeDialog();
      try {
        const res = await fetchWithAuth(`/api/qc_records/${qcId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("刪除失敗");
        fetchQCRecords(batchId);
        showAlert("成功", "紀錄已刪除", "success");
      } catch (err) {
        showAlert("錯誤", err.message, "error");
      }
    });
  };

  const handleTextChange = (field, value) => {
    setQcFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTextBlur = (field, value) => {
    const num = parseFloat(value);
    if (!isNaN(num))
      setQcFormData((prev) => ({ ...prev, [field]: num.toFixed(2) }));
    else if (value !== "") setQcFormData((prev) => ({ ...prev, [field]: "" }));
  };

  const handleDynamicMicroChange = (index, field, value) => {
    setQcFormData((prev) => {
      const newMicro = [...prev.actual_microbiology];
      newMicro[index][field] = value;
      return { ...prev, actual_microbiology: newMicro };
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

  const providerOptions = providers.map((p) => ({
    value: p.id,
    label: p.name,
    code: p.code,
  }));
  const materialOptions = materials.map((m) => ({
    value: m.id,
    label: m.name,
    code: m.code,
  }));
  const isPassedOptions = [
    { value: true, label: "合格 (PASS)", color: "text-emerald-700" },
    { value: false, label: "不合格 (FAIL)", color: "text-red-700" },
  ];

  if (loading && batches.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="text-lg font-bold text-slate-400 animate-pulse">
          載入資料中...
        </div>
      </div>
    );
  }

  const currentBatchMatId = getBatchMatId(currentBatch);
  const currentMaterial = currentBatch
    ? materials.find((m) => String(m.id) === String(currentBatchMatId))
    : null;

  return (
    <>
      <div className="print:hidden p-6 md:p-10 max-w-[1400px] mx-auto bg-slate-50/50 min-h-screen font-sans text-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
              品管與批號查核
            </h2>
            <p className="text-slate-500 mt-2 font-semibold">
              紀錄批號庫存狀態並登打 QC 檢驗結果生成 COA 報告
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
              分群顯示，支援<strong>多維度過濾</strong>（日期、批號、名稱）。
            </li>
            <li>
              點擊批號展開，可動態載入物料的標準（如色澤與風味）進行
              <strong>品管檢驗登打</strong>。
            </li>
            <li>
              一條龍檢索：登打 ➔ 編輯/查看 ➔ 選擇客戶 ➔ 匯出{" "}
              <strong className="text-blue-700">
                單筆或全批號的 COA 產品檢驗報告
              </strong>
              。
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
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2 text-slate-800 font-bold">
            <Filter size={18} className="text-blue-500" /> 搜尋條件
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
                          toggleMaterialExpand(
                            group.material_name,
                            group.batches,
                          )
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            preparePrintAllCOA(group);
                          }}
                          className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl hover:bg-indigo-600 hover:text-white transition-colors text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
                        >
                          <Printer size={14} /> 列印此物料總表
                        </button>
                      </div>
                    </div>

                    {isMatExpanded && (
                      <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50/50 space-y-4">
                        {group.batches.length > 0 ? (
                          group.batches.map((batch) => {
                            const isBatchExpanded = expandedBatches.includes(
                              batch.id,
                            );
                            const isLowStock =
                              parseFloat(batch.remaining_qty) <
                              parseFloat(batch.original_qty) * 0.2;
                            const qcRecords = qcRecordsMap[batch.id] || [];

                            const bMatId = getBatchMatId(batch);
                            const batchMat = materials.find(
                              (m) => String(m.id) === String(bMatId),
                            );

                            return (
                              <div
                                key={batch.id}
                                className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:border-slate-300 transition-colors"
                              >
                                <div
                                  className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer"
                                  onClick={() => toggleBatchExpand(batch.id)}
                                >
                                  <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <span
                                      className={`w-6 h-6 flex items-center justify-center text-slate-400 text-xs transition-transform duration-300 ${isBatchExpanded ? "rotate-90" : ""}`}
                                    >
                                      ▶
                                    </span>
                                    <span className="font-mono text-sm font-black text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded shadow-sm">
                                      {batch.batch_number}
                                    </span>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 font-bold ml-2">
                                      <span>入庫: {batch.received_date}</span>
                                      <span>|</span>
                                      <span>效期: {batch.expiration_date}</span>
                                    </div>
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
                                    <div
                                      className="flex gap-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={() => openQCModal(batch)}
                                        className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-600 hover:text-white transition-colors text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
                                      >
                                        <ClipboardCheck size={14} /> 登打檢驗
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {isBatchExpanded && (
                                  <div className="bg-slate-50/80 p-5 border-t border-slate-100">
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                      品管檢驗紀錄{" "}
                                      <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                        {qcRecords.length}
                                      </span>
                                    </h4>

                                    {qcRecords.length > 0 ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {qcRecords.map((qc) => (
                                          <div
                                            key={qc.id}
                                            className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                                          >
                                            <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100">
                                              <div>
                                                <span
                                                  className={`px-2 py-1 rounded text-[10px] font-black tracking-wider border shadow-sm ${qc.is_passed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}
                                                >
                                                  {qc.is_passed
                                                    ? "合格 PASS"
                                                    : "不合格 FAIL"}
                                                </span>
                                                <div className="text-xs text-slate-500 font-bold mt-2">
                                                  {qc.test_date}
                                                </div>
                                              </div>
                                              <button
                                                onClick={() =>
                                                  preparePrintSingleCOA(
                                                    qc,
                                                    batchMat,
                                                    batch,
                                                  )
                                                }
                                                className="text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 shadow-sm"
                                              >
                                                <FileText size={12} /> 列印此筆
                                              </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs mb-4 flex-1">
                                              {Array.isArray(
                                                qc.actual_microbiology,
                                              ) &&
                                                qc.actual_microbiology.map(
                                                  (m, idx) => (
                                                    <div
                                                      key={idx}
                                                      className="flex flex-col col-span-2"
                                                    >
                                                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                                                        {m.item}
                                                      </span>
                                                      <span className="font-bold text-slate-700">
                                                        {m.result}
                                                      </span>
                                                    </div>
                                                  ),
                                                )}
                                              <div className="flex flex-col">
                                                <span className="text-[10px] text-black-800 font-bold uppercase">
                                                  水分
                                                </span>
                                                <span className="font-mono font-bold text-black-800">
                                                  {qc.actual_moisture
                                                    ? `${qc.actual_moisture}%`
                                                    : "-"}
                                                </span>
                                              </div>
                                              <div className="flex flex-col">
                                                <span className="text-[10px] text-black-800 font-bold uppercase">
                                                  糖度 Brix
                                                </span>
                                                <span className="font-mono font-bold text-black-800">
                                                  {qc.actual_brix || "-"}
                                                </span>
                                              </div>
                                              <div className="flex flex-col">
                                                <span className="text-[10px] text-black-800 font-bold uppercase">
                                                  鹽度 Salt
                                                </span>
                                                <span className="font-mono font-bold text-black-800">
                                                  {qc.actual_salt
                                                    ? `${qc.actual_salt}%`
                                                    : "-"}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="flex justify-between items-end pt-3 border-t border-slate-50 mt-auto">
                                              <span className="text-[10px] text-slate-400 font-bold truncate">
                                                檢驗: {qc.inspector_name}
                                              </span>
                                              <div className="flex gap-2 shrink-0">
                                                <button
                                                  onClick={() =>
                                                    openQCModal(batch, qc)
                                                  }
                                                  className="text-[11px] font-bold text-slate-500 hover:text-blue-600 transition-colors bg-white px-2 py-1 rounded border border-slate-200"
                                                >
                                                  編輯
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    handleDeleteQC(
                                                      batch.id,
                                                      qc.id,
                                                    )
                                                  }
                                                  className="text-[11px] font-bold text-slate-500 hover:text-red-600 transition-colors bg-white px-2 py-1 rounded border border-slate-200"
                                                >
                                                  刪除
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center py-6 bg-white border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm font-bold">
                                        此批號尚未登打任何檢驗紀錄。
                                      </div>
                                    )}
                                  </div>
                                )}
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

        {isPrintModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
            <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col overflow-hidden border border-white/20 animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Printer className="text-indigo-500" size={24} />
                  列印設定
                </h3>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={executePrintCOA} className="flex flex-col">
                <div className="p-6 space-y-4">
                  <div className="bg-indigo-50 text-indigo-800 p-4 rounded-xl text-sm font-bold mb-2 border border-indigo-100">
                    即將匯出「{printDraft?.material?.name}
                    」的檢驗報告，請選擇要顯示在報告上的客戶名稱。
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                      選擇客戶名稱 <span className="text-red-500">*</span>
                    </label>
                    <CustomDropdown
                      value={selectedCustomer}
                      onChange={setSelectedCustomer}
                      options={providerOptions}
                      placeholder="請選擇..."
                    />
                  </div>
                </div>
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(false)}
                    className="px-6 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-white font-bold transition-all shadow-sm"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md font-bold transition-all hover:-translate-y-0.5"
                  >
                    確認列印
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isQCModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-opacity duration-300">
            <div className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20">
              <div className="p-6 md:px-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                  <ClipboardCheck className="text-indigo-500" />
                  {editingQCId ? "編輯檢驗紀錄" : "登打檢驗結果"}
                </h3>
                <button
                  onClick={() => setIsQCModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold text-xl"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleQCSave}
                className="flex flex-col overflow-hidden flex-1"
              >
                <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center">
                    <div>
                      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        正在檢驗批號
                      </div>
                      <div className="font-mono text-xl font-black text-indigo-700">
                        {currentBatch?.batch_number}
                      </div>
                      <div className="font-bold text-slate-700 mt-1 flex items-center gap-2">
                        <TypeTag type={currentMaterial?.type} />
                        {currentBatch?.material_name || currentMaterial?.name}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                        取樣日期 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={qcFormData.sample_date}
                        onChange={(e) =>
                          handleTextChange("sample_date", e.target.value)
                        }
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                        檢測日期 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={qcFormData.test_date}
                        onChange={(e) =>
                          handleTextChange("test_date", e.target.value)
                        }
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {qcFormData.actual_microbiology.length > 0 && (
                    <div className="pt-4 border-t border-slate-100">
                      <div className="text-[11px] font-black text-indigo-500 uppercase tracking-widest mb-3">
                        物料專屬檢驗項目
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {qcFormData.actual_microbiology.map((mItem, mIndex) => (
                          <div
                            key={mIndex}
                            className="bg-slate-50 p-4 rounded-xl border border-slate-200"
                          >
                            <div className="flex justify-between items-end mb-2">
                              <label className="block text-xs font-bold text-slate-700">
                                {mItem.item}
                              </label>
                              <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">
                                標準: {mItem.limit}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={mItem.result || ""}
                              onChange={(e) =>
                                handleDynamicMicroChange(
                                  mIndex,
                                  "result",
                                  e.target.value,
                                )
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all shadow-sm mb-3"
                            />
                            <div className="flex items-center gap-2">
                              <label className="relative inline-flex items-center cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={mItem.is_passed}
                                  onChange={(e) =>
                                    handleDynamicMicroChange(
                                      mIndex,
                                      "is_passed",
                                      e.target.checked,
                                    )
                                  }
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-red-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                                <span className="ml-2 text-[11px] font-bold text-slate-600">
                                  {mItem.is_passed ? "合格" : "不合格"}
                                </span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-slate-100">
                    <div className="flex flex-col justify-end">
                      <div className="flex justify-between items-center mb-2 ml-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                          糖度 (Brix)
                        </label>
                        <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded shadow-sm">
                          標準:{" "}
                          {formatTolerance(
                            currentMaterial?.qc_brix_min,
                            currentMaterial?.qc_brix_max,
                          )}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={qcFormData.actual_brix}
                          onChange={(e) =>
                            handleTextChange("actual_brix", e.target.value)
                          }
                          onBlur={(e) =>
                            handleTextBlur("actual_brix", e.target.value)
                          }
                          className="w-full px-4 py-3 bg-blue-50/50 border border-blue-100 text-blue-800 rounded-xl text-[15px] font-mono font-black focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all shadow-sm text-center disabled:opacity-80"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col justify-end">
                      <div className="flex justify-between items-center mb-2 ml-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                          鹽度 (%)
                        </label>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded shadow-sm">
                          標準:{" "}
                          {formatTolerance(
                            currentMaterial?.qc_salt_min,
                            currentMaterial?.qc_salt_max,
                          )}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={qcFormData.actual_salt}
                          onChange={(e) =>
                            handleTextChange("actual_salt", e.target.value)
                          }
                          onBlur={(e) =>
                            handleTextBlur("actual_salt", e.target.value)
                          }
                          className="w-full px-4 py-3 bg-emerald-50/50 border border-emerald-100 text-emerald-800 rounded-xl text-[15px] font-mono font-black focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none transition-all shadow-sm text-center disabled:opacity-80"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col justify-end">
                      <div className="flex justify-between items-center mb-2 ml-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                          水分 (%)
                        </label>
                        <span className="text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded shadow-sm">
                          標準:{" "}
                          {currentMaterial?.qc_moisture_max
                            ? `< ${currentMaterial.qc_moisture_max}%`
                            : "-"}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={qcFormData.actual_moisture}
                          onChange={(e) =>
                            handleTextChange("actual_moisture", e.target.value)
                          }
                          onBlur={(e) =>
                            handleTextBlur("actual_moisture", e.target.value)
                          }
                          className="w-full px-4 py-3 bg-sky-50/50 border border-sky-100 text-sky-800 rounded-xl text-[15px] font-mono font-black focus:bg-white focus:ring-4 focus:ring-sky-500/20 focus:border-sky-400 outline-none transition-all shadow-sm text-center disabled:opacity-80"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                      最終判定 <span className="text-red-500">*</span>
                    </label>
                    <CustomDropdown
                      value={qcFormData.is_passed}
                      onChange={(val) => handleTextChange("is_passed", val)}
                      options={isPassedOptions}
                      placeholder="選擇判定結果"
                      searchable={false}
                    />
                  </div>

                  <div>
                    <label className="block text-normal font-bold text-slate-800 mb-2 ml-1">
                      備註說明
                    </label>
                    <textarea
                      value={qcFormData.remark}
                      onChange={(e) =>
                        handleTextChange("remark", e.target.value)
                      }
                      rows={2}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all resize-none custom-scrollbar"
                    />
                  </div>
                </div>

                <div className="p-6 md:px-8 border-t border-slate-100 bg-white flex justify-end gap-4 shrink-0 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)]">
                  <button
                    type="button"
                    onClick={() => setIsQCModalOpen(false)}
                    className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-bold transition-all shadow-sm"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-[0_4px_12px_rgba(79,70,229,0.3)] font-bold disabled:opacity-50 transition-all hover:-translate-y-0.5 tracking-wide"
                  >
                    {isSubmitting ? "儲存中..." : "儲存檢驗結果"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                    關聯物料 <span className="text-red-500">*</span>
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
                    初始進貨量 <span className="text-red-500">*</span>
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

      {printConfig && (
        <COAPrintTemplate
          data={printConfig.data}
          material={printConfig.material}
          customerName={printConfig.customerName}
        />
      )}
    </>
  );
}
