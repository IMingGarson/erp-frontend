import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import {
  Factory,
  Database,
  PackageCheck,
  Printer,
  Trash2,
  Search,
  ChevronDown,
  FlaskConical,
  AlertTriangle,
  Check,
  Loader2,
  Layers,
} from "lucide-react";

const USEAGE_THRESHOLD = 1.8;

function getTodayString(formatted = false) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return formatted ? `${yyyy}-${mm}-${dd}` : `${yyyy}${mm}${dd}`;
}

function gcd(a, b) {
  return b === 0n ? a : gcd(b, a % b);
}

function toFraction(val) {
  try {
    if (val === null || val === undefined || val === "")
      return { n: 0n, d: 1n };
    const str = String(val).trim();
    if (isNaN(Number(str))) return { n: 0n, d: 1n };
    if (!str.includes(".")) return { n: BigInt(str), d: 1n };
    let [intPart, decPart] = str.split(".");
    if (!intPart || intPart === "-") intPart = intPart === "-" ? "-0" : "0";
    if (!decPart) decPart = "0";
    decPart = decPart.replace(/0+$/, "");
    if (decPart === "") decPart = "0";
    const decimals = decPart === "0" ? 0n : BigInt(decPart.length);
    const nStr = decPart === "0" ? intPart : intPart + decPart;
    const n = BigInt(nStr);
    const d = 10n ** decimals;
    const divisor = gcd(n < 0n ? -n : n, d);
    return { n: n / divisor, d: d / divisor };
  } catch {
    return { n: 0n, d: 1n };
  }
}

function mulFrac(f1, f2) {
  const n = f1.n * f2.n;
  const d = f1.d * f2.d;
  const divisor = gcd(n < 0n ? -n : n, d);
  return { n: n / divisor, d: d / divisor };
}

function divFrac(f1, f2) {
  if (f2.n === 0n) return { n: 0n, d: 1n };
  const n = f1.n * f2.d;
  const d = f1.d * f2.n;
  const finalN = d < 0n ? -n : n;
  const finalD = d < 0n ? -d : d;
  const divisor = gcd(finalN < 0n ? -finalN : finalN, finalD);
  return { n: finalN / divisor, d: finalD / divisor };
}

function addFrac(f1, f2) {
  const n = f1.n * f2.d + f2.n * f1.d;
  const d = f1.d * f2.d;
  const divisor = gcd(n < 0n ? -n : n, d);
  return { n: n / divisor, d: d / divisor };
}

function fracToNumber(f) {
  return Number(f.n) / Number(f.d);
}

function roundToDisplay(num, type) {
  if (num === null || num === undefined || isNaN(num) || num === "") return 0;
  if (type === "PACK") return Math.ceil(Number(num));
  const value = Number(num);
  if (value === 0) return 0;
  if (Math.abs(value) >= 0.01) return Math.round(value * 100) / 100;
  return Number(value.toFixed(4));
}

function formatNum(num, type) {
  const rounded = roundToDisplay(num, type);
  if (rounded === 0) return "0";
  if (type === "PACK") return rounded.toString();
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function getContainedAdditives(
  matId,
  boms,
  materials,
  multiplierFrac = { n: 1n, d: 1n },
) {
  const results = {};
  const children = boms.filter((b) => String(b.parent?.id) === String(matId));
  children.forEach((c) => {
    const childMat = materials.find(
      (m) => String(m.id) === String(c.child?.id || c.child),
    );
    if (!childMat) return;
    const baseQtyF = toFraction(c.base_quantity || "1");
    const reqQtyF = toFraction(c.quantity_required || "0");
    const ratioF = divFrac(reqQtyF, baseQtyF);
    const qtyF = mulFrac(multiplierFrac, ratioF);
    if (childMat.is_additive && childMat.legal_limit_percent) {
      if (!results[childMat.id]) {
        results[childMat.id] = {
          ...childMat,
          _qtyFrac: { n: 0n, d: 1n },
          qty: 0,
        };
      }
      const r = results[childMat.id];
      r._qtyFrac = addFrac(r._qtyFrac, qtyF);
      r.qty = fracToNumber(r._qtyFrac);
    } else if (childMat.type === "SEMI" || childMat.type === "PRODUCT") {
      const deepResults = getContainedAdditives(
        childMat.id,
        boms,
        materials,
        qtyF,
      );
      Object.values(deepResults).forEach((dr) => {
        if (!results[dr.id]) {
          results[dr.id] = { ...dr, _qtyFrac: { n: 0n, d: 1n }, qty: 0 };
        }
        const r = results[dr.id];
        r._qtyFrac = addFrac(r._qtyFrac, dr._qtyFrac);
        r.qty = fracToNumber(r._qtyFrac);
      });
    }
  });
  return results;
}

const TypeTag = ({ type }) => {
  const config = {
    RAW: {
      label: "原物料",
      css: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    SEMI: {
      label: "半成品",
      css: "bg-purple-50 text-purple-700 border-purple-200",
    },
    PACK: { label: "包材", css: "bg-amber-50 text-amber-700 border-amber-200" },
    PRODUCT: { label: "成品", css: "bg-blue-50 text-blue-700 border-blue-200" },
    PACKAGING: {
      label: "包裝",
      css: "bg-orange-50 text-orange-700 border-orange-200",
    },
    STICKER: {
      label: "標籤",
      css: "bg-orange-50 text-orange-700 border-orange-200",
    },
    OTHER: {
      label: "其他",
      css: "bg-slate-50 text-slate-700 border-slate-200",
    },
  };
  const typeData = config[type] || {
    label: type,
    css: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={`inline-block text-center min-w-[72px] px-3 py-1 rounded-lg text-sm uppercase tracking-widest font-bold border flex-shrink-0 shadow-sm ${typeData.css}`}
    >
      {typeData.label}
    </span>
  );
};

const FilterableDropdown = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  renderItem,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const filteredOptions = options.filter(
    (opt) =>
      (opt.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.code || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedOpt = options.find((o) => String(o.id) === String(value));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[44px] px-4 py-2 rounded-xl text-sm flex justify-between items-center transition-all shadow-sm border ${
          disabled
            ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
            : isOpen
              ? "border-blue-500 ring-4 ring-blue-500/10 bg-blue-50/30"
              : "bg-white border-slate-200 hover:border-slate-300 text-slate-900"
        }`}
      >
        <span className="truncate pr-2 font-medium">
          {selectedOpt
            ? renderItem
              ? renderItem(selectedOpt)
              : selectedOpt.name
            : placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 transition-transform ${isOpen ? "rotate-180 text-blue-500" : "text-slate-400"}`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 top-[calc(100%+8px)] left-0 min-w-full w-max max-w-[90vw] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col max-h-72 overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                autoFocus
                className="w-full h-10 border border-slate-200 bg-white rounded-lg pl-10 pr-4 text-sm font-medium focus:outline-none focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = String(value) === String(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className={`flex items-center justify-between px-4 py-3 text-sm rounded-xl cursor-pointer transition-all font-medium mb-1 ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    <span className="truncate pr-2">
                      {renderItem ? renderItem(opt) : opt.name}
                    </span>
                    {isSelected && <Check size={16} strokeWidth={3} />}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-slate-400 text-sm font-medium">
                無符合的廠內自製成品
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const BatchRow = ({
  orderId,
  matId,
  batch,
  matType,
  unit,
  onSave,
  readyOnly = false,
}) => {
  const [tempValue, setTempValue] = useState(batch.used);
  useEffect(() => {
    setTempValue(batch.used);
  }, [batch.used]);

  const isModified = String(tempValue) !== String(batch.used);

  const handleInternalSave = () => {
    let val = tempValue;
    if (val !== "") {
      const parsedVal = parseFloat(val);
      if (isNaN(parsedVal) || parsedVal < 0) {
        setTempValue(batch.used);
        return;
      }
      if (parsedVal > batch.available) {
        val =
          matType === "PACK" || matType === "OTHER" || matType === "STICKER"
            ? Math.floor(batch.available).toString()
            : batch.available.toString();
      }
    }
    setTempValue(val);
    onSave(orderId, matId, batch.id, val);
  };

  const totalCapacity = parseFloat(batch.available) || 0;
  const usedQty = parseFloat(tempValue) || 0;
  const remainingQty = Math.max(0, totalCapacity - usedQty);
  const usagePercent =
    totalCapacity > 0 ? Math.min(100, (usedQty / totalCapacity) * 100) : 0;

  return (
    <div
      className={`relative flex flex-col bg-white border border-slate-200/80 rounded-[1.5rem] p-5 w-full min-h-[160px] ${isModified ? "border-amber-300 ring-2 ring-amber-400/20" : "shadow-sm"}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h4 className="text-[17px] font-bold text-slate-800 truncate font-mono">
            {batch.batch_number}
          </h4>
          {batch.received_date && (
            <span className="text-[11px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md w-fit">
              EXP: {new Date(batch.received_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5">
        {!readyOnly ? (
          <>
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="decimal"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                className="w-full h-12 pl-4 pr-10 text-right text-lg font-mono font-bold rounded-[14px] outline-none border bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-blue-400"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                {unit}
              </span>
            </div>
            <button
              type="button"
              onClick={handleInternalSave}
              disabled={!isModified}
              className={`h-12 px-5 rounded-[14px] font-bold text-[15px] transition-all border ${
                isModified
                  ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600"
                  : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
              }`}
            >
              儲存
            </button>
          </>
        ) : (
          <div className="w-full h-12 bg-slate-50 border border-slate-100 rounded-[14px] flex items-center justify-end px-4">
            <span className="text-lg font-mono font-bold text-blue-600">
              {formatNum(tempValue, matType)}{" "}
              <span className="text-sm font-medium text-slate-400">{unit}</span>
            </span>
          </div>
        )}
      </div>

      <div className="mt-auto">
        <div className="flex justify-between items-end mb-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              本次分配
            </span>
            <span className="text-[15px] font-bold font-mono text-blue-600">
              {formatNum(usedQty, matType)}
            </span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              剩餘庫存
            </span>
            <span className="text-[15px] font-bold text-slate-500 font-mono">
              {formatNum(remainingQty, matType)}
            </span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const MaterialAllocationList = ({
  itemId,
  mrpId,
  mrpPlans = [],
  readyOnly = false,
  allocations,
  materials,
  boms,
  expandedMaterials,
  toggleMaterialExpanded,
  handleBatchUsageSave,
}) => {
  const itemAlloc = allocations[itemId];
  if (!itemAlloc)
    return (
      <div className="p-4 text-slate-400 text-sm font-medium">
        尚未分配物料...
      </div>
    );

  const baseQty = itemAlloc._base_qty;
  const sortedMaterials = Object.entries(itemAlloc).filter(
    ([k]) => k !== "_base_qty" && k !== "_productId",
  );

  return (
    <div className="space-y-4 w-full min-w-0">
      {sortedMaterials.map(([matId, mat]) => {
        const matInfo = materials.find((m) => String(m.id) === String(matId));
        const isAdditive = matInfo?.is_additive;
        const limitPercent = parseFloat(matInfo?.legal_limit_percent);
        const totalAllocated = mat.batches.reduce(
          (sum, b) => sum + (parseFloat(b.used) || 0),
          0,
        );

        let hasAdditiveError = false;
        let usagePercent = 0;
        if (isAdditive && !isNaN(limitPercent) && baseQty) {
          usagePercent = (totalAllocated / baseQty) * 100;
          hasAdditiveError = usagePercent > limitPercent;
        }

        const isSemi = mat.type?.toUpperCase() === "SEMI";
        const childPlan = isSemi
          ? mrpPlans.find(
              (p) =>
                p.parent_id === mrpId && String(p.product_id) === String(matId),
            )
          : null;
        const canExpand = !isSemi || (isSemi && childPlan);
        const isUnder = !isSemi && totalAllocated < mat.requiredQty - 0.0001;
        const expandedKey = `${itemId}-${matId}`;
        const isExpanded = expandedMaterials.includes(expandedKey);

        return (
          <div
            key={matId}
            className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-sm"
          >
            <div
              className={`p-5 flex flex-col md:flex-row justify-between items-start md:items-center ${canExpand ? "cursor-pointer hover:bg-slate-50/80" : ""}`}
              onClick={() => canExpand && toggleMaterialExpanded(expandedKey)}
            >
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                <span className="text-slate-400 text-sm w-4">
                  {canExpand ? (isExpanded ? "▼" : "▶") : ""}
                </span>
                <TypeTag type={mat.type} />
                {isAdditive && (
                  <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-orange-200">
                    <FlaskConical size={13} /> 法定添加物
                  </span>
                )}
                <span className="font-bold text-slate-800 truncate text-[16px]">
                  {mat.materialName}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm mt-3 md:mt-0">
                {hasAdditiveError ? (
                  <span className="font-bold text-red-700 bg-red-100 px-3 py-1.5 rounded-xl border border-red-200">
                    超標 {formatNum(usagePercent, 2)}%
                  </span>
                ) : !isSemi && isUnder ? (
                  <span className="font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                    缺料 {formatNum(mat.requiredQty - totalAllocated, mat.type)}{" "}
                    {mat.unit}
                  </span>
                ) : !isSemi ? (
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    已分配 {formatNum(totalAllocated, mat.type)} {mat.unit}
                  </span>
                ) : (
                  <span className="font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200">
                    需生產 {formatNum(mat.requiredQty, mat.type)} {mat.unit}
                  </span>
                )}
              </div>
            </div>

            {isExpanded && !isSemi && (
              <div className="bg-slate-50/60 p-5 border-t border-slate-200/80">
                <div className="flex overflow-x-auto gap-4 pb-2">
                  {mat.batches.map((b) => (
                    <div key={b.id} className="w-[320px] flex-shrink-0">
                      <BatchRow
                        orderId={itemId}
                        matId={matId}
                        batch={b}
                        matType={mat.type}
                        unit={mat.unit}
                        onSave={handleBatchUsageSave}
                        readyOnly={readyOnly}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isExpanded && isSemi && childPlan && (
              <div className="bg-slate-50/80 p-6 border-t border-slate-200">
                <MaterialAllocationList
                  itemId={childPlan.frontend_temp_id || childPlan.id}
                  mrpId={childPlan.mrp_id}
                  mrpPlans={mrpPlans}
                  allocations={allocations}
                  materials={materials}
                  boms={boms}
                  expandedMaterials={expandedMaterials}
                  toggleMaterialExpanded={toggleMaterialExpanded}
                  handleBatchUsageSave={handleBatchUsageSave}
                  readyOnly={readyOnly}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function InHouseStockPage() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [boms, setBoms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [mrpPlans, setMrpPlans] = useState([]);
  const [packageOrders, setPackageOrders] = useState([]);
  const [productRelations, setProductRelations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dailySequence, setDailySequence] = useState(1);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [stockBatchNumber, setStockBatchNumber] = useState("");
  const [note, setNote] = useState("廠內預存成品庫存");

  const [orderItems, setOrderItems] = useState([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [allocations, setAllocations] = useState({});
  const [expandedMaterials, setExpandedMaterials] = useState([]);
  const [expandedMrpIds, setExpandedMrpIds] = useState([]);

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

  const toggleMaterialExpanded = (key) =>
    setExpandedMaterials((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  const toggleMrpExpanded = (id) =>
    setExpandedMrpIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [matRes, bomRes, batchRes, mrpRes, seqRes, poRes, relRes] =
        await Promise.all([
          fetchWithAuth("/api/materials"),
          fetchWithAuth("/api/boms"),
          fetchWithAuth("/api/batches"),
          fetchWithAuth("/api/mrp"),
          fetchWithAuth("/api/mrp/daily_sequence"),
          fetchWithAuth("/api/package_orders"),
          fetchWithAuth("/api/product_package_relations"),
        ]);

      const [matJson, bomJson, batchJson, mrpJson, seqJson, poJson, relJson] =
        await Promise.all([
          matRes.json(),
          bomRes.json(),
          batchRes.json(),
          mrpRes.json(),
          seqRes.json(),
          poRes.json(),
          relRes.json(),
        ]);

      const loadedMaterials = matJson.data || matJson.results || matJson || [];
      setMaterials(loadedMaterials);
      setBoms(bomJson.data || bomJson.results || bomJson || []);
      setBatches(batchJson.data || batchJson.results || batchJson || []);
      setMrpPlans(mrpJson.data || mrpJson.results || mrpJson || []);
      setPackageOrders(poJson.data || poJson.results || poJson || []);
      setProductRelations(relJson.data || relJson.results || relJson || []);

      const nextSeq = seqJson?.data?.sequence || 1;
      setDailySequence(nextSeq);
      setStockBatchNumber(
        (prev) =>
          prev || `STK${getTodayString()}${String(nextSeq).padStart(3, "0")}`,
      );
    } catch (err) {
      showAlert("錯誤", err.message || "載入資料失敗", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 🌟 僅篩選 type === "PRODUCT" 且 is_in_house === true 的廠內自製成品
  const inHouseProducts = useMemo(() => {
    return materials.filter(
      (m) => m.type === "PRODUCT" && Boolean(m.is_in_house),
    );
  }, [materials]);

  const selectedProduct = useMemo(() => {
    return (
      inHouseProducts.find((m) => String(m.id) === String(selectedProductId)) ||
      null
    );
  }, [inHouseProducts, selectedProductId]);

  const defaultOrderNumber = useMemo(() => {
    return `STK${getTodayString()}${String(dailySequence).padStart(3, "0")}`;
  }, [dailySequence]);

  // 🌟 優先使用手動輸入的批號作為生產單號
  const resolvedOrderNumber = useMemo(() => {
    const trimmed = (stockBatchNumber || "").trim();
    return trimmed || defaultOrderNumber;
  }, [stockBatchNumber, defaultOrderNumber]);

  useEffect(() => {
    if (!selectedProduct || Number(targetQty) <= 0) {
      setOrderItems([]);
      setActiveTabId("");
      return;
    }

    const qtyFrac = toFraction(targetQty);
    const generated = [];
    let childSeq = 1;

    const buildDrafts = (
      matId,
      currentQtyFrac,
      currentDraftId,
      parentDraftId = null,
    ) => {
      const mat = materials.find((m) => String(m.id) === String(matId));
      if (!mat) return;
      const children = boms.filter(
        (b) => String(b.parent?.id) === String(matId),
      );

      generated.push({
        id: currentDraftId,
        parentDraftId,
        productId: mat.id,
        name: mat.name,
        type: mat.type,
        qty: fracToNumber(currentQtyFrac),
        _qtyFrac: currentQtyFrac,
        unit: mat.unit || "KG",
        productCode: mat.code,
        remark: note,
      });

      children.forEach((c) => {
        const childMat = c.child;
        if (
          childMat &&
          (childMat.type === "SEMI" || childMat.type === "PRODUCT")
        ) {
          const baseQtyF = toFraction(c.base_quantity || "1");
          const reqQtyF = toFraction(c.quantity_required || "0");
          const ratioF = divFrac(reqQtyF, baseQtyF);
          const childQtyFrac = mulFrac(currentQtyFrac, ratioF);
          buildDrafts(
            childMat.id,
            childQtyFrac,
            `${resolvedOrderNumber}-${childSeq++}`,
            currentDraftId,
          );
        }
      });
    };

    buildDrafts(selectedProduct.id, qtyFrac, resolvedOrderNumber, null);

    const matchedRel = productRelations.find(
      (r) => String(r.product) === String(selectedProduct.id),
    );
    const targetPo = matchedRel
      ? packageOrders.find(
          (p) => String(p.id) === String(matchedRel.package_order),
        )
      : null;

    if (
      targetPo &&
      Array.isArray(targetPo.packaging_info) &&
      targetPo.packaging_info.length > 0
    ) {
      generated.push({
        id: `${resolvedOrderNumber}-${childSeq++}`,
        parentDraftId: resolvedOrderNumber,
        productId: selectedProduct.id,
        name: `${selectedProduct.name} (包裝耗材)`,
        type: "PACKAGING",
        qty: Number(targetQty) || 0,
        _qtyFrac: qtyFrac,
        unit: targetPo.sales_unit || selectedProduct.unit || "KG",
        productCode: selectedProduct.code,
        remark: "包裝耗材",
        isPackagingNode: true,
        packaging_info: targetPo.packaging_info,
      });
    }

    setOrderItems(generated);
    setActiveTabId(generated[0]?.id || "");
  }, [
    selectedProduct,
    targetQty,
    resolvedOrderNumber,
    materials,
    boms,
    packageOrders,
    productRelations,
    note,
  ]);

  useEffect(() => {
    if (orderItems.length === 0) return;

    const newAllocations = {};
    const globalVirtualBatches = batches.map((b) => ({
      ...b,
      remaining_qty: parseFloat(b.remaining_qty),
    }));

    orderItems.forEach((item) => {
      const qtyValueF = item._qtyFrac;
      const itemReqs = {};

      if (item.isPackagingNode) {
        item.packaging_info.forEach((pkg) => {
          const targetMatId = pkg.material_id;
          const reqQty = (Number(item.qty) || 0) * (Number(pkg.qty) || 1);
          itemReqs[targetMatId] = {
            qtyFrac: toFraction(reqQty),
            remark:
              pkg.layer === "outer"
                ? "外箱"
                : pkg.layer === "inner"
                  ? "內裝"
                  : "其他包材",
            sequence_num: "",
          };
        });
      } else {
        const directChildren = boms.filter(
          (b) => String(b.parent?.id) === String(item.productId),
        );
        if (directChildren.length === 0) {
          itemReqs[item.productId] = {
            qtyFrac: qtyValueF,
            remark: "",
            sequence_num: "",
          };
        } else {
          directChildren.forEach((c) => {
            const childMat = c.child;
            if (!childMat) return;
            const baseQtyF = toFraction(c.base_quantity || "1");
            const reqQtyF = toFraction(c.quantity_required || "0");
            const ratioF = divFrac(reqQtyF, baseQtyF);
            const reqF = mulFrac(qtyValueF, ratioF);
            if (!itemReqs[childMat.id]) {
              itemReqs[childMat.id] = {
                qtyFrac: { n: 0n, d: 1n },
                remark: c.remark || "",
                sequence_num: c.sequence_num || "",
              };
            }
            itemReqs[childMat.id].qtyFrac = addFrac(
              itemReqs[childMat.id].qtyFrac,
              reqF,
            );
          });
        }
      }

      const itemAlloc = {
        _base_qty: fracToNumber(qtyValueF),
        _productId: item.productId,
      };

      Object.keys(itemReqs).forEach((matIdStr) => {
        const matInfo = materials.find(
          (m) => String(m.id) === String(matIdStr),
        );
        const isPack =
          matInfo?.type === "PACK" ||
          matInfo?.type === "OTHER" ||
          matInfo?.type === "STICKER";
        const exactRequiredQty = fracToNumber(itemReqs[matIdStr].qtyFrac);
        let requiredQty = roundToDisplay(exactRequiredQty, matInfo?.type);
        if (isPack) requiredQty = Math.ceil(requiredQty);

        const availableBatches = globalVirtualBatches
          .filter(
            (b) =>
              String(b.material) === String(matIdStr) && b.remaining_qty > 0,
          )
          .sort(
            (a, b) => new Date(a.received_date) - new Date(b.received_date),
          );

        let remainingToFulfill = requiredQty;
        const batchAllocations = availableBatches
          .map((b) => {
            let used = 0;
            if (remainingToFulfill > 0) {
              used = Math.min(b.remaining_qty, remainingToFulfill);
              if (isPack) used = Math.ceil(used);
              remainingToFulfill -= used;
              globalVirtualBatches.find((gb) => gb.id === b.id).remaining_qty -=
                used;
            }
            return {
              id: b.id,
              batch_number: b.batch_number,
              received_date: b.received_date,
              available: b.remaining_qty + used,
              used:
                used === 0
                  ? ""
                  : isPack
                    ? Math.ceil(used).toString()
                    : roundToDisplay(used, matInfo?.type).toString(),
            };
          })
          .filter((b) => b.available > 0);

        itemAlloc[matIdStr] = {
          materialName: matInfo?.name || "未知物料",
          unit: matInfo?.unit || "",
          type: matInfo?.type || "",
          code: matInfo?.code || "",
          requiredQty,
          maxQty: requiredQty * USEAGE_THRESHOLD,
          batches: batchAllocations,
          isShortage: remainingToFulfill > 0.0001,
          remark: itemReqs[matIdStr].remark,
          sequence_num: itemReqs[matIdStr].sequence_num || "",
        };
      });

      newAllocations[item.id] = itemAlloc;
    });

    setAllocations(newAllocations);
  }, [orderItems, batches, boms, materials]);

  const handleBatchUsageSave = (orderId, matId, batchId, newVal) => {
    setAllocations((prev) => {
      const orderAlloc = { ...(prev[orderId] || {}) };
      const matData = { ...(orderAlloc[matId] || {}) };
      if (!matData.batches) return prev;
      const nextBatches = matData.batches.map((b) =>
        String(b.id) === String(batchId) ? { ...b, used: newVal } : b,
      );
      const totalAllocated = nextBatches.reduce(
        (sum, b) => sum + (parseFloat(b.used) || 0),
        0,
      );
      matData.batches = nextBatches;
      matData.isShortage = totalAllocated < matData.requiredQty - 0.0001;
      orderAlloc[matId] = matData;
      return { ...prev, [orderId]: orderAlloc };
    });
    showAlert("成功", "已更新批號分配用量", "success");
  };

  const handleCreateInHouseProduction = async () => {
    if (!selectedProduct || Number(targetQty) <= 0) {
      return showAlert(
        "資料不完整",
        "請選擇廠內自製成品並輸入大於 0 的預存數量",
        "warning",
      );
    }

    const finalOrderNo = resolvedOrderNumber;

    showConfirm(
      "建立廠內自製生產單",
      `確定要以單號/批號「${finalOrderNo}」為「${selectedProduct.name}」建立 ${targetQty} ${selectedProduct.unit || "KG"} 的廠內自製生產單並扣除批號庫存嗎？`,
      async () => {
        closeDialog();
        setIsSubmitting(true);
        try {
          const itemMap = {};
          orderItems.forEach((item) => {
            if (item.type === "PACKAGING") return;
            const cleanBatchInfo = { ...(allocations[item.id] || {}) };
            delete cleanBatchInfo._base_qty;
            delete cleanBatchInfo._productId;
            const cleanItem = { ...item };
            delete cleanItem._qtyFrac;
            itemMap[item.id] = {
              ...cleanItem,
              batch_inventory_info: cleanBatchInfo,
              children_mrp: [],
            };
          });

          const rootItems = [];
          orderItems.forEach((item) => {
            if (item.type === "PACKAGING") return;
            if (!item.parentDraftId) {
              rootItems.push(itemMap[item.id]);
            } else if (itemMap[item.parentDraftId]) {
              itemMap[item.parentDraftId].children_mrp.push(itemMap[item.id]);
            }
          });

          const mrpRes = await fetchWithAuth("/api/mrp/bulk_create_drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vendor_data: {
                name: "廠內自製預存",
                code: "IN_HOUSE",
                logistics: "廠內備庫",
                notes: note,
              },
              parent_mrp_payload: rootItems,
            }),
          });
          if (!mrpRes.ok) throw new Error("建立廠內自製 MRP 草稿失敗");
          const mrpJson = await mrpRes.json();
          const createdParents = (mrpJson.data || mrpJson || []).filter(
            (d) => !d.parent_id,
          );
          const parentDraft = createdParents[0];
          if (!parentDraft) throw new Error("未取得建立後的母單 ID");

          const convertRes = await fetchWithAuth(
            "/api/mrp/convert_to_production",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mrp_id: finalOrderNo,
                is_in_house: true,
                spec: selectedProduct.spec || "",
                sales_unit: selectedProduct.unit || "KG",
              }),
            },
          );
          if (!convertRes.ok) throw new Error("轉換廠內自製生產單失敗");

          if (finalOrderNo) {
            await fetchWithAuth("/api/batches", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                material: selectedProduct.id,
                batch_number: finalOrderNo,
                original_qty: Number(targetQty),
                remaining_qty: Number(targetQty),
                received_date: getTodayString(true),
                note: note || "廠內自製預存成品庫存",
              }),
            });
          }

          showAlert(
            "建立成功",
            `已完成廠內自製生產單「${finalOrderNo}」建立、扣庫與預存批號登錄！`,
            "success",
          );
          setTargetQty("");
          const nextSeq = dailySequence + 1;
          setDailySequence(nextSeq);
          setStockBatchNumber(
            `STK${getTodayString()}${String(nextSeq).padStart(3, "0")}`,
          );
          fetchData();
        } catch (err) {
          showAlert("錯誤", err.message, "error");
        } finally {
          setIsSubmitting(false);
        }
      },
    );
  };

  const inHouseProductionOrders = useMemo(() => {
    return mrpPlans.filter(
      (p) =>
        !p.parent_id && (p.vendor_info?.code === "IN_HOUSE" || p.is_in_house),
    );
  }, [mrpPlans]);

  const activeItem = orderItems.find((i) => i.id === activeTabId) || null;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-900">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Factory className="text-blue-600" size={30} />
          成品預存庫存（廠內自製）
        </h2>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 mb-8">
        <h3 className="text-lg font-semibold text-blue-600 mb-5 flex items-center gap-2">
          <Layers size={20} /> 1. 設定廠內自製成品與預存數量
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              廠內自製成品 <span className="text-red-500">*</span>
            </label>
            <FilterableDropdown
              value={selectedProductId}
              onChange={(val) => setSelectedProductId(val)}
              options={inHouseProducts}
              placeholder={loading ? "載入中..." : "選擇廠內自製成品"}
              disabled={loading}
              renderItem={(m) => `[${m.code}] ${m.name}`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              預存製作數量 ({selectedProduct?.unit || "KG"}){" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={targetQty}
              onChange={(e) => setTargetQty(e.target.value)}
              placeholder="例如: 1000"
              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              入庫批號編號（同步作為生產單號）
            </label>
            <input
              type="text"
              value={stockBatchNumber}
              onChange={(e) => setStockBatchNumber(e.target.value)}
              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-slate-600 mb-2">
            備註
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {orderItems.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 mb-8">
          <h3 className="text-lg font-semibold text-blue-600 mb-5 flex items-center gap-2">
            <Database size={20} /> 2. 底層 BOM 物料庫存分配
          </h3>

          <div className="flex overflow-x-auto border-b border-slate-200 mb-6">
            {orderItems.map((item) => {
              const isActive = item.id === activeTabId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTabId(item.id)}
                  className={`flex items-center gap-2 px-5 py-3 border-b-[3px] whitespace-nowrap font-semibold text-sm ${
                    isActive
                      ? "border-blue-600 text-blue-700 bg-blue-50/40"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <TypeTag type={item.type} />
                  <span>{item.name || item.productCode}</span>
                </button>
              );
            })}
          </div>

          {activeItem && (
            <MaterialAllocationList
              itemId={activeItem.id}
              mrpId={resolvedOrderNumber}
              mrpPlans={mrpPlans}
              allocations={allocations}
              materials={materials}
              boms={boms}
              expandedMaterials={expandedMaterials}
              toggleMaterialExpanded={toggleMaterialExpanded}
              handleBatchUsageSave={handleBatchUsageSave}
            />
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate("/production-orders")}
              className="px-6 py-3 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50"
            >
              前往生產單管理
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreateInHouseProduction}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <PackageCheck size={18} />
              )}
              建立廠內自製生產單並入庫
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Printer size={20} className="text-slate-500" /> 3.
          廠內自製預存單據紀錄
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="p-4">單號</th>
                <th className="p-4">成品名稱</th>
                <th className="p-4 text-right">預存數量</th>
                <th className="p-4 text-center">狀態</th>
                <th className="p-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inHouseProductionOrders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-slate-400">
                    尚無廠內自製預存單據
                  </td>
                </tr>
              ) : (
                inHouseProductionOrders.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50/60">
                    <td className="p-4 font-mono font-bold text-slate-700">
                      {plan.mrp_id}
                    </td>
                    <td className="p-4 font-bold text-slate-800">
                      {plan.product_name}
                    </td>
                    <td className="p-4 text-right font-mono font-bold">
                      {formatNum(plan.required_qty, "PRODUCT")} {plan.unit}
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {plan.status.toUpperCase() === "CONVERTED"
                          ? "已轉生產單"
                          : "尚未轉生產單"}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => navigate("/production")}
                        className="px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100"
                      >
                        查看生產單
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
