import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search,
  ChevronDown,
  Trash2,
  Plus,
  Save,
  FileText,
  Eye,
  Building2,
  Calculator,
  Printer,
  XCircle,
  Lock,
  Package,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";

// 格式化數字，移除不必要的結尾 0
const formatNum = (num, maxDecimals = 4) => {
  if (num === null || num === undefined || isNaN(num) || num === "") return "0";
  return parseFloat(Number(num).toFixed(maxDecimals)).toString();
};

// 解決 JS IEEE 754 浮點數精準度問題的運算器
const precise = {
  add: (a, b) => parseFloat((Number(a) + Number(b)).toPrecision(12)),
  mul: (a, b) => parseFloat((Number(a) * Number(b)).toPrecision(12)),
  div: (a, b) => parseFloat((Number(a) / Number(b)).toPrecision(12)),
};

// 格式化金額，帶千分位且移除結尾 0
const formatCurrency = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Number(num).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
};

const COST_OPTIONS = [
  { key: "material_cost", name: "原料成本" },
  { key: "packaging_cost", name: "包材成本" },
  { key: "manual_cost", name: "人工成本" },
];

const getSortedCostKeys = (breakdownObj) => {
  if (!breakdownObj) return [];
  const existingKeys = Object.keys(breakdownObj);
  return COST_OPTIONS.map((opt) => opt.key).filter((key) =>
    existingKeys.includes(key),
  );
};

const AddCostDropdown = ({ existingKeys, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded font-bold transition-colors flex items-center gap-1 border border-slate-200 shadow-sm"
      >
        <Plus size={13} /> 新增項目
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-slate-200 rounded-md shadow-lg z-10 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100">
          {COST_OPTIONS.map((opt) => {
            const isDisabled = existingKeys.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  onSelect(opt.key);
                  setIsOpen(false);
                }}
                className={`text-left px-3 py-2 text-[13px] font-bold transition-colors ${
                  isDisabled
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {opt.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DocumentPreview = ({
  formData,
  vendors,
  materials,
  allMaterials,
  boms,
}) => {
  const customer = vendors.find(
    (v) => String(v.id) === String(formData.customer),
  );
  const today = formData.issue_date
    ? formData.issue_date.replace(/-/g, "/")
    : new Date().toISOString().split("T")[0].replace(/-/g, "/");

  const getBomItems = (productId) => {
    return boms
      .filter((b) => String(b.parent?.id) === String(productId))
      .map((bom) => {
        const childCode = bom.child?.code || "";
        const childName = bom.child?.name || "";
        const childUnit = bom.child?.unit || "KG";

        const fullMat = allMaterials.find(
          (m) => String(m.id) === String(bom.child?.id),
        );

        const baseQty = parseFloat(bom.base_quantity || 1);
        const reqQty = parseFloat(bom.quantity_required || 0);
        const usageQty = precise.div(reqQty, baseQty);

        return {
          ...bom,
          childCode,
          childName,
          childUnit,
          cost: Math.round(parseFloat(fullMat?.estimated_cost || 0)),
          qty: usageQty,
        };
      });
  };

  return (
    <div
      id="print-area"
      className="flex flex-col gap-8 bg-slate-200 p-8 rounded-lg overflow-y-auto max-h-[75vh] custom-scrollbar print:bg-white print:p-0 print:overflow-visible print:block print:max-h-none"
      style={{ fontFamily: "'MingLiU', 'PMingLiU', serif" }}
    >
      {formData.items.map((item, idx) => {
        const mat =
          allMaterials.find((m) => String(m.id) === String(item.product)) ||
          item.product_detail;
        const bomItems = getBomItems(item.product);

        const qty = parseFloat(item.sales_unit_quantity) || 1;

        // 🌟 完全聽從畫面上的成本拆解，不再傻傻算 BOM
        const totalMaterialCostPerUnit = Math.round(
          parseFloat(item.costs_breakdown?.material_cost?.value || 0),
        );

        const manualCostPerUnit = Math.round(
          Object.entries(item.costs_breakdown || {})
            .filter(([k, c]) => k !== "material_cost")
            .reduce(
              (sum, [k, c]) => precise.add(sum, parseFloat(c.value) || 0),
              0,
            ),
        );

        const totalEstimatedCostPerUnit = precise.add(
          totalMaterialCostPerUnit,
          manualCostPerUnit,
        );

        const totalMaterialCostOverall = Math.round(
          precise.mul(totalMaterialCostPerUnit, qty),
        );
        const manualCostOverall = Math.round(
          precise.mul(manualCostPerUnit, qty),
        );
        const totalEstimatedCostOverall = Math.round(
          precise.mul(totalEstimatedCostPerUnit, qty),
        );

        return (
          <div
            key={`cost-${idx}`}
            className="page-break bg-white p-10 shadow-lg mx-auto w-full max-w-[210mm] min-h-[297mm] text-black relative print:shadow-none print:w-full print:max-w-none print:m-0 print:p-[15mm] flex flex-col"
          >
            <div className="flex justify-between items-start mb-6 shrink-0">
              <div className="w-1/3 text-[12px] leading-relaxed">
                <h2 className="text-[15px] font-bold mb-1">基香食品有限公司</h2>
                <p>桃園市觀音區崙坪里1鄰1-10號</p>
                <p>電話: 03-4988228</p>
              </div>
              <div className="w-1/3 text-center">
                <p className="text-[12px] text-right mt-6">傳真: 03-4988159</p>
              </div>
              <div className="w-1/3 text-right">
                <h1 className="text-[26px] font-bold tracking-[0.2em] mb-1">
                  成本估算單
                </h1>
                <p className="text-[12px]">
                  第 {idx + 1} 頁,共 {formData.items.length} 頁
                </p>
              </div>
            </div>

            <div className="flex justify-between text-[12px] mb-4 shrink-0">
              <div className="space-y-1.5 w-[30%]">
                <div className="flex">
                  <span className="w-20 shrink-0">單據日期:</span>
                  <span>{today}</span>
                </div>
                <div className="flex">
                  <span className="w-20 shrink-0">產品編號:</span>
                  <span>{mat?.code || ""}</span>
                </div>
                <div className="flex">
                  <span className="w-20 shrink-0">原料總成本:</span>
                  <span>{totalMaterialCostOverall}</span>
                </div>
                <div className="flex">
                  <span className="w-20 shrink-0">估算總成本:</span>
                  <span>{totalEstimatedCostOverall}</span>
                </div>
              </div>
              <div className="space-y-1.5 w-[35%] flex flex-col items-center">
                <div className="flex w-full justify-center px-2">
                  <span className="shrink-0 mr-2">產品名稱:</span>
                  <span className="text-left font-bold text-[13px]">
                    {mat?.name || ""}
                  </span>
                </div>
                <div>
                  <br />
                </div>
                <div className="flex w-full justify-center px-2">
                  <span className="shrink-0 mr-2">總計(含工):</span>
                  <span className="text-left font-bold text-[13px]">
                    {totalEstimatedCostOverall}
                  </span>
                </div>
                <div>
                  <br />
                </div>
              </div>
              <div className="space-y-1.5 w-[35%] flex flex-col items-end">
                <div className="flex w-full max-w-[200px]">
                  <span className="w-24 shrink-0">單據編號:</span>
                  <span className="flex-1 text-left">
                    {formData.quotation_number || "系統核發"}
                  </span>
                </div>
                <div className="flex w-full max-w-[200px]">
                  <span className="w-24 shrink-0">數 量:</span>
                  <span className="flex-1 text-left">
                    {qty} {item.sales_unit}
                  </span>
                </div>
                <div className="flex w-full max-w-[200px]">
                  <span className="w-24 shrink-0">製造總費用:</span>
                  <span className="flex-1 text-left">{manualCostOverall}</span>
                </div>
                <div className="flex w-full max-w-[200px]">
                  <span className="w-24 shrink-0">估算單位成本:</span>
                  <span className="flex-1 text-left">
                    {totalEstimatedCostPerUnit} / 單位
                  </span>
                </div>
              </div>
            </div>

            <table className="w-full text-[12px] border-collapse mb-8 shrink-0">
              <thead>
                <tr className="border-t border-b border-black text-left">
                  <th className="py-2 px-1 w-8">序</th>
                  <th className="py-2 px-1">原料編號</th>
                  <th className="py-2 px-1">原料名稱</th>
                  <th className="py-2 px-1 w-14 text-center">單位</th>
                  <th className="py-2 px-1 w-20 text-right text-gray-500">
                    配方比例
                  </th>
                  <th className="py-2 px-1 w-20 text-right">總需求量</th>
                  <th className="py-2 px-1 w-20 text-right">平均成本</th>
                  <th className="py-2 px-1 w-24 text-right">總材料成本</th>
                </tr>
              </thead>
              <tbody>
                {bomItems.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4 text-gray-400">
                      尚無配方資料
                    </td>
                  </tr>
                ) : (
                  bomItems.map((b, bIdx) => {
                    const totalUsage = precise.mul(b.qty, qty);
                    const matCostOverall = Math.round(
                      precise.mul(b.cost, totalUsage),
                    );
                    return (
                      <tr
                        key={bIdx}
                        className="border-b border-dashed border-gray-200"
                      >
                        <td className="py-2 px-1">{bIdx + 1}</td>
                        <td className="py-2 px-1">{b.childCode}</td>
                        <td className="py-2 px-1">{b.childName}</td>
                        <td className="py-2 px-1 text-center">{b.childUnit}</td>
                        <td className="py-2 px-1 text-right text-gray-500">
                          {formatNum(b.qty, 4)}
                        </td>
                        <td className="py-2 px-1 text-right font-bold">
                          {formatNum(totalUsage, 4)}
                        </td>
                        <td className="py-2 px-1 text-right">{b.cost}</td>
                        <td className="py-2 px-1 text-right">
                          {matCostOverall}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="flex-1 min-h-[50px]"></div>

            <div className="mt-8 text-[12px] shrink-0">
              <p>單據備註：</p>
            </div>

            <div className="flex justify-between mt-auto pt-16 text-[13px] shrink-0">
              <div>審 核：</div>
              <div>經 辦：</div>
              <div>會 簽：</div>
              <div>倉 管：</div>
              <div>簽 收：</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// 🌟 修正版 FilterableDropdown (Apple 風格視窗定位)
// ==========================================
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
  const [dropdownStyle, setDropdownStyle] = useState({});
  const selectRef = useRef(null);
  const dropdownMenuRef = useRef(null);

  const filteredOptions = options.filter(
    (opt) =>
      (opt.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.code || "").toLowerCase().includes(searchTerm.toLowerCase()),
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
        className={`w-full h-[42px] px-3.5 py-2 border rounded-xl text-[13px] flex justify-between items-center transition-all shadow-sm cursor-pointer ${
          disabled
            ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
            : isOpen
              ? "border-blue-500 ring-4 ring-blue-500/15 bg-white"
              : "bg-white border-slate-300/80 hover:border-slate-400 text-slate-800"
        }`}
      >
        <span className="truncate pr-2 font-bold text-slate-800">
          {selectedOpt ? (
            renderItem ? (
              renderItem(selectedOpt)
            ) : (
              selectedOpt.name
            )
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={15} className="text-slate-400 flex-shrink-0" />
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
            className="fixed z-[9999] bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-2xl flex flex-col max-h-64 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-2.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  autoFocus
                  className="w-full border border-slate-200 bg-white rounded-xl pl-8 pr-3 py-1.5 text-[13px] font-bold focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
                  placeholder="輸入代碼或名稱搜尋..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-1.5 custom-scrollbar">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className={`px-3 py-2 text-[13px] rounded-xl cursor-pointer transition-colors font-bold ${
                      String(value) === String(opt.id)
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {renderItem ? renderItem(opt) : opt.name}
                  </div>
                ))
              ) : (
                <div className="px-3 py-6 text-center text-slate-400 text-[13px] font-bold">
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

const QuotationEditPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [vendors, setVendors] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [formData, setFormData] = useState({
    customer: "",
    status: "DRAFT",
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

  const closeDialog = () => {
    const cb = dialog.onCloseCallback;
    setDialog((prev) => ({ ...prev, isOpen: false, onCloseCallback: null }));
    if (cb) cb();
  };

  const packMaterials = useMemo(() => {
    return [
      { id: "", name: "-- 無需對應包材 --", code: "" },
      ...allMaterials.filter((m) =>
        ["PACK", "OTHER", "STICKER"].includes(m.type),
      ),
    ];
  }, [allMaterials]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [vendorRes, matRes, bomRes, quotRes] = await Promise.all([
          fetchWithAuth("/api/vendors?is_active=true"),
          fetchWithAuth("/api/materials"),
          fetchWithAuth("/api/boms"),
          fetchWithAuth(`/api/quotations/${id}`),
        ]);

        const vendorJson = await vendorRes.json();
        const matJson = await matRes.json();
        const bomJson = await bomRes.json();
        const quotJson = await quotRes.json();

        setVendors(vendorJson.data || vendorJson || []);
        setBoms(bomJson.data || bomJson || []);

        const allMats = matJson.data || matJson || [];
        setAllMaterials(allMats);
        setMaterials(
          allMats.filter(
            (m) =>
              m.type === "PRODUCT" && ["IN_DEV", "IN_PROD"].includes(m.phase),
          ),
        );

        const currentQuot = quotJson.data || quotJson;

        setFormData({
          id: currentQuot.id,
          quotation_number: currentQuot.quotation_number,
          issue_date: currentQuot.issue_date,
          customer: currentQuot.customer,
          customer_name: currentQuot.customer_name,
          status: currentQuot.status,
          items: currentQuot.items.map((item) => {
            let breakdown = item.costs_breakdown || {};

            // 🌟 防呆修復：如果 material_cost 丟失或為 0，強制抓回最新資料庫成本
            if (
              !breakdown.material_cost ||
              !breakdown.material_cost.value ||
              breakdown.material_cost.value === "0" ||
              breakdown.material_cost.value === 0
            ) {
              breakdown = {
                ...breakdown,
                material_cost: {
                  name: "原料成本",
                  value: String(
                    Math.round(
                      parseFloat(item.product_detail?.estimated_cost || 0),
                    ),
                  ),
                },
              };
            } else {
              breakdown.material_cost.name = "原料成本";
            }

            const fullMat = allMats.find(
              (m) => String(m.id) === String(item.product_detail?.id),
            );
            const matchedProfile =
              fullMat?.product_profiles?.find(
                (p) => p.spec === item.spec && p.sales_unit === item.sales_unit,
              ) || fullMat?.product_profiles?.[0];

            return {
              ...item,
              product: item.product_detail?.id || "",
              spec: item.spec || "",
              sales_unit: item.sales_unit || "箱",
              sales_unit_quantity: String(item.sales_unit_quantity || 1),
              sales_pack_unit: item.sales_pack_unit || "無",
              sales_pack_quantity: String(item.sales_pack_quantity || 0),
              outer_pack: matchedProfile?.outer_pack || "",
              inner_pack: matchedProfile?.inner_pack || "",
              pricing_multiplier: String(item.pricing_multiplier || 1.0),
              final_price_per_kg: String(item.final_price_per_kg || ""),
              costs_breakdown: breakdown,
            };
          }),
        });
      } catch (err) {
        setDialog({
          isOpen: true,
          type: "alert",
          status: "error",
          title: "載入失敗",
          message: err.message,
          onCloseCallback: () => navigate("/quotations"),
        });
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [id, navigate]);

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `temp_${Date.now()}`,
          product: "",
          spec: "",
          sales_unit: "箱",
          sales_unit_quantity: "1",
          sales_pack_unit: "包",
          sales_pack_quantity: "1",
          outer_pack: "",
          inner_pack: "",
          costs_breakdown: {
            material_cost: { name: "原料成本", value: "" },
          },
          pricing_multiplier: "1.0",
          final_price_per_kg: "",
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

  const updateItemField = (index, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items];

      // 🌟 深拷貝更新：強制觸發 React Re-render
      const updatedItem = { ...newItems[index], [field]: value };

      if (field === "product" && value) {
        const selectedMat = allMaterials.find(
          (m) => String(m.id) === String(value),
        );
        if (selectedMat) {
          updatedItem.costs_breakdown = {
            ...updatedItem.costs_breakdown,
            material_cost: {
              name: "原料成本",
              value: String(
                Math.round(parseFloat(selectedMat.estimated_cost || 0)),
              ),
            },
          };
        }
      }

      newItems[index] = updatedItem;
      return { ...prev, items: newItems };
    });
  };

  const updateCostBreakdown = (itemIndex, costKey, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      const targetItem = newItems[itemIndex];
      targetItem.costs_breakdown = {
        ...targetItem.costs_breakdown,
        [costKey]: { ...targetItem.costs_breakdown[costKey], [field]: value },
      };
      return { ...prev, items: newItems };
    });
  };

  const handleAddSpecificCost = (itemIndex, costKey) => {
    if (!costKey) return;
    const option = COST_OPTIONS.find((opt) => opt.key === costKey);
    if (!option) return;

    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[itemIndex].costs_breakdown[costKey] = {
        name: option.name,
        value: "",
      };
      return { ...prev, items: newItems };
    });
  };

  const removeCostField = (itemIndex, costKey) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      const newBreakdown = { ...newItems[itemIndex].costs_breakdown };
      delete newBreakdown[costKey];
      newItems[itemIndex].costs_breakdown = newBreakdown;
      return { ...prev, items: newItems };
    });
  };

  // 數字型文字安全過濾（僅允許整數或小數點）
  const handleNumericTextInput = (val, allowDecimal = true) => {
    if (val === "") return "";
    let clean = val.replace(/[^0-9.]/g, "");
    if (!allowDecimal) clean = clean.replace(/\./g, "");
    const parts = clean.split(".");
    if (parts.length > 2) clean = parts[0] + "." + parts.slice(1).join("");
    return clean;
  };

  const calculatedTotals = useMemo(() => {
    let total = 0;
    formData.items.forEach((item) => {
      // 🌟 已修復：改為抓取 sales_unit_quantity 與 final_price_per_kg
      const q = Number(item.sales_unit_quantity) || 0;
      const p = Number(item.final_price_per_kg) || 0;
      total += Math.round(q * p);
    });
    const tax = Math.round(total * 0.05);
    return { total_amount: total, tax_amount: tax, grand_total: total + tax };
  }, [formData.items]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer)
      return setDialog({
        isOpen: true,
        type: "alert",
        status: "warning",
        title: "資料不完整",
        message: "請先選擇客戶",
      });
    if (formData.items.length === 0)
      return setDialog({
        isOpen: true,
        type: "alert",
        status: "warning",
        title: "資料不完整",
        message: "請至少新增一筆報價品項",
      });
    if (
      formData.items.some(
        (item) =>
          !item.product ||
          !item.final_price_per_kg ||
          isNaN(Number(item.final_price_per_kg)),
      )
    )
      return setDialog({
        isOpen: true,
        type: "alert",
        status: "warning",
        title: "資料不完整",
        message: "所有品項皆須選擇產品並輸入有效的最終報價金額",
      });

    setDialog({
      isOpen: true,
      type: "confirm",
      status: "warning",
      title: formData.status === "CONFIRMED" ? "正式成立報價單" : "儲存草稿",
      message:
        formData.status === "CONFIRMED"
          ? "確定要成立此報價單嗎？系統將會自動把所有相關的 IN_DEV 原物料推進至 IN_PROD 狀態！"
          : "確定要將此報價單儲存為草稿嗎？",
      onConfirm: async () => {
        setIsSubmitting(true);
        setDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          const payload = {
            ...formData,
            items: formData.items.map((item) => {
              const { id, product_detail, ...rest } = item;
              const processed =
                typeof id === "string" && id.startsWith("temp_")
                  ? rest
                  : { id, ...rest };

              processed.sales_unit_quantity =
                Number(processed.sales_unit_quantity) || 1;
              processed.sales_pack_quantity =
                Number(processed.sales_pack_quantity) || 1;
              processed.pricing_multiplier =
                Number(processed.pricing_multiplier) || 1.0;
              processed.final_price_per_kg =
                Number(processed.final_price_per_kg) || 0;

              // 🌟 將空字串轉為 null 交給後端，並且帶入 ID 後綴確保 Django 能接
              processed.outer_pack = processed.outer_pack || null;
              processed.inner_pack = processed.inner_pack || null;
              processed.outer_pack_id = processed.outer_pack;
              processed.inner_pack_id = processed.inner_pack;

              return processed;
            }),
          };

          const res = await fetchWithAuth(`/api/quotations/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            let errorMsg = "儲存失敗，請檢查網路狀態或資料格式";
            try {
              const errData = await res.json();
              errorMsg =
                errData.detail || errData.non_field_errors?.[0] || errorMsg;
            } catch (e) {}
            throw new Error(errorMsg);
          }

          setDialog({
            isOpen: true,
            type: "alert",
            status: "success",
            title: "更新成功",
            message: "報價單已成功更新！",
            onCloseCallback: () => navigate("/quotations"),
          });
        } catch (err) {
          setDialog({
            isOpen: true,
            type: "alert",
            status: "error",
            title: "發生錯誤",
            message: err.message,
          });
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="animate-pulse text-slate-500 font-medium text-[15px]">
          載入系統資料中...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-8 pb-16 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800 print:bg-white print:p-0">
      <style>{`
        @media print {
          .page-break { page-break-before: always; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      {/* 標題與簡介 */}
      <div className="mb-6 print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            編輯報價單
          </h2>
          <p className="text-[13px] text-slate-500 font-medium mt-1">
            單號：{formData.quotation_number || "未核發"}
          </p>
        </div>
      </div>

      <div className="bg-blue-50/70 backdrop-blur-md text-blue-900 text-[13px] p-4 md:p-5 rounded-2xl mb-8 border border-blue-200/60 shadow-sm print:hidden">
        <p className="flex items-center gap-2 font-bold mb-2">
          <span className="text-base">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-5 text-slate-700 font-medium">
          <li>選定客戶後即可配置產品、拆解內部製造成本與設定報價係數。</li>
          <li>包材結構採用分組設定，完整支援外箱大單位與內袋輔助單位對應。</li>
          <li>所有數值欄位均支援文字直接編輯，系統自動核算估計成本與總計。</li>
        </ul>
      </div>

      <form className="flex flex-col gap-8 w-full pb-6 print:hidden">
        {/* 客戶與單據狀態卡片 */}
        <div className="bg-white p-6 md:p-7 rounded-3xl border border-slate-200/80 shadow-sm">
          <h3 className="text-[14px] font-black text-blue-600 uppercase tracking-widest mb-5 flex items-center gap-2">
            <Building2 size={18} /> 客戶與單據資訊
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-2 uppercase tracking-wider">
                指定客戶 <span className="text-red-500">*</span>
              </label>
              <FilterableDropdown
                value={formData.customer}
                onChange={(val) =>
                  setFormData((p) => ({ ...p, customer: val }))
                }
                options={vendors}
                placeholder="-- 請搜尋並選擇客戶 --"
                renderItem={(v) => `[${v.code || "無代碼"}] ${v.name}`}
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-2 uppercase tracking-wider">
                單據狀態 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, status: e.target.value }))
                }
                className="w-full h-[42px] px-3.5 py-2 border border-slate-300/80 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 outline-none transition-all bg-white font-bold text-[13px] text-slate-800 shadow-sm"
              >
                <option value="DRAFT">📝 草稿 (DRAFT)</option>
                <option value="CONFIRMED">✅ 已確認/成立 (CONFIRMED)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 報價品項明細 */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 md:px-8 py-5 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-3">
            <h3 className="text-[14px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
              <Calculator size={18} /> 報價品項明細
              <span className="text-slate-400 font-bold text-[13px] ml-1">
                ({formData.items.length})
              </span>
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              disabled={!formData.customer}
              className="text-[13px] bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={16} strokeWidth={2.5} /> 新增品項
            </button>
          </div>

          <div className="p-6 md:p-8 bg-slate-50/40 flex flex-col gap-8">
            {formData.items.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-300/80 rounded-2xl text-slate-400 font-bold text-[14px] bg-white">
                {formData.customer
                  ? "點擊上方「新增品項」開始配置報價單"
                  : "請先於上方選擇客戶"}
              </div>
            ) : (
              formData.items.map((item, index) => {
                const costsKeys = getSortedCostKeys(item.costs_breakdown);
                const totalCostPerUnit = Math.round(
                  costsKeys.reduce(
                    (sum, key) =>
                      precise.add(
                        sum,
                        parseFloat(item.costs_breakdown[key].value) || 0,
                      ),
                    0,
                  ),
                );
                const suggestedPrice = Math.round(
                  precise.mul(
                    totalCostPerUnit,
                    parseFloat(item.pricing_multiplier || 1),
                  ),
                );

                const orderQty = parseFloat(item.sales_unit_quantity) || 0;
                const finalTotalPrice = precise.mul(
                  parseFloat(item.final_price_per_kg) || 0,
                  orderQty,
                );

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-200/90 rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden relative"
                  >
                    {/* 品項卡片 Header */}
                    <div className="bg-slate-100/70 px-6 py-3.5 border-b border-slate-200/80 flex justify-between items-center">
                      <span className="text-[12px] font-black uppercase tracking-widest text-slate-500">
                        品項 #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-white bg-red-50 hover:bg-red-600 px-3 py-1 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1 border border-red-200 shadow-sm"
                      >
                        <Trash2 size={13} /> 移除品項
                      </button>
                    </div>

                    <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      {/* 左側：產品選擇與包材結構 */}
                      <div className="lg:col-span-5 flex flex-col gap-5 border-b lg:border-b-0 lg:border-r border-slate-200/80 pb-6 lg:pb-0 lg:pr-8">
                        <div>
                          <label className="block text-[12px] font-bold text-slate-600 mb-2 uppercase tracking-wider">
                            報價產品 <span className="text-red-500">*</span>
                          </label>
                          <FilterableDropdown
                            value={item.product}
                            onChange={(val) =>
                              updateItemField(index, "product", val)
                            }
                            options={materials}
                            placeholder="搜尋成品料號或名稱"
                            renderItem={(m) => (
                              <div className="flex justify-between items-center w-full">
                                <span className="text-[13px] text-slate-400 font-mono">
                                  [{m.code}]
                                </span>
                                <span className="text-[13px] text-slate-800 font-bold ml-2">
                                  {m.name}
                                </span>
                              </div>
                            )}
                          />
                        </div>

                        <div>
                          <label className="block text-[12px] font-bold text-slate-600 mb-2 uppercase tracking-wider flex justify-between">
                            <span>包裝規格文字</span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              (印於報價單)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={item.spec}
                            onChange={(e) =>
                              updateItemField(index, "spec", e.target.value)
                            }
                            placeholder="如：1KG*25包/箱"
                            className="w-full px-3.5 py-2 h-[42px] border border-slate-300/80 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 outline-none text-[13px] font-bold text-slate-800 transition-all shadow-sm"
                          />
                        </div>

                        {/* 🌟 Apple 風格 包裝與換算結構分組 */}
                        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3.5">
                          <div className="flex items-center gap-1.5 text-blue-700 font-black text-[12px] uppercase tracking-wider border-b border-slate-200/60 pb-2">
                            <Package size={15} strokeWidth={2.5} />{" "}
                            包材結構與換算設定
                          </div>

                          {/* 銷售大單位 (外層) */}
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-2xs space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                                銷售大單位 (外層)
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                  銷售數量
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={+item.sales_unit_quantity}
                                  onChange={(e) =>
                                    updateItemField(
                                      index,
                                      "sales_unit_quantity",
                                      handleNumericTextInput(e.target.value),
                                    )
                                  }
                                  className="w-full px-3 py-1.5 h-[38px] border border-slate-200 rounded-lg text-center font-mono font-bold text-[13px] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                  大單位名稱
                                </label>
                                <input
                                  type="text"
                                  value={item.sales_unit}
                                  onChange={(e) =>
                                    updateItemField(
                                      index,
                                      "sales_unit",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="箱"
                                  className="w-full px-3 py-1.5 h-[38px] border border-slate-200 rounded-lg text-center font-bold text-[13px] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                對應實體外包裝 (MRP推算用)
                              </label>
                              <FilterableDropdown
                                value={item.outer_pack}
                                onChange={(val) =>
                                  updateItemField(index, "outer_pack", val)
                                }
                                options={packMaterials}
                                placeholder="-- 無需對應外包裝 --"
                                renderItem={(m) =>
                                  m.id ? `[${m.code}] ${m.name}` : m.name
                                }
                              />
                            </div>
                          </div>

                          {/* 內部小單位 (內層) */}
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-2xs space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                                內部小單位 (內層)
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                  每單位內含數量
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={+item.sales_pack_quantity}
                                  onChange={(e) =>
                                    updateItemField(
                                      index,
                                      "sales_pack_quantity",
                                      handleNumericTextInput(e.target.value),
                                    )
                                  }
                                  className="w-full px-3 py-1.5 h-[38px] border border-slate-200 rounded-lg text-center font-mono font-bold text-[13px] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                  小單位名稱
                                </label>
                                <input
                                  type="text"
                                  value={item.sales_pack_unit}
                                  onChange={(e) =>
                                    updateItemField(
                                      index,
                                      "sales_pack_unit",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="包"
                                  className="w-full px-3 py-1.5 h-[38px] border border-slate-200 rounded-lg text-center font-bold text-[13px] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                對應實體內包裝 (MRP推算用)
                              </label>
                              <FilterableDropdown
                                value={item.inner_pack}
                                onChange={(val) =>
                                  updateItemField(index, "inner_pack", val)
                                }
                                options={packMaterials}
                                placeholder="-- 無需對應內包裝 --"
                                renderItem={(m) =>
                                  m.id ? `[${m.code}] ${m.name}` : m.name
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 中間：成本拆解 */}
                      <div className="lg:col-span-4 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-slate-200/80 pb-6 lg:pb-0 lg:pr-8 h-full justify-between">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <label className="block text-[12px] font-bold text-slate-600 uppercase tracking-wider">
                              內部成本拆解 (每單位)
                            </label>
                            <AddCostDropdown
                              existingKeys={costsKeys}
                              onSelect={(key) =>
                                handleAddSpecificCost(index, key)
                              }
                            />
                          </div>

                          <div className="space-y-2.5">
                            {costsKeys.map((costKey) => (
                              <div
                                key={costKey}
                                className="flex gap-2 items-center"
                              >
                                <input
                                  type="text"
                                  value={item.costs_breakdown[costKey].name}
                                  readOnly
                                  className="w-28 px-3 py-2 h-[40px] border border-slate-200 rounded-xl outline-none text-[13px] font-bold bg-slate-100 text-slate-600 shrink-0"
                                />
                                <div className="relative flex-1 flex items-center min-w-0">
                                  <span className="absolute left-3 text-slate-400 text-[13px] font-bold">
                                    $
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={item.costs_breakdown[costKey].value}
                                    onChange={(e) =>
                                      updateCostBreakdown(
                                        index,
                                        costKey,
                                        "value",
                                        handleNumericTextInput(e.target.value),
                                      )
                                    }
                                    placeholder="0"
                                    className="w-full pl-7 pr-3 py-2 h-[40px] border border-slate-300/80 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-[14px] text-right font-mono font-bold text-slate-800"
                                  />
                                </div>
                                <div className="shrink-0">
                                  {costKey === "material_cost" ? (
                                    <div
                                      className="w-[36px] h-[40px] flex items-center justify-center text-slate-300 bg-slate-50 border border-slate-200/60 rounded-xl cursor-not-allowed"
                                      title="基礎成本項目不可刪除"
                                    >
                                      <Lock size={14} />
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeCostField(index, costKey)
                                      }
                                      className="w-[36px] h-[40px] flex items-center justify-center text-red-500 hover:text-white bg-red-50 hover:bg-red-500 rounded-xl border border-red-200 transition-colors shadow-sm"
                                      title="移除此項目"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200/80 flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl">
                          <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
                            估算單位成本
                          </span>
                          <span className="text-[16px] font-black font-mono text-slate-900">
                            ${formatCurrency(totalCostPerUnit)}
                          </span>
                        </div>
                      </div>

                      {/* 右側：係數、售價與小計 */}
                      <div className="lg:col-span-3 flex flex-col gap-4 h-full justify-between">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[12px] font-bold text-slate-600 mb-2 uppercase tracking-wider">
                              報價係數 (Multiplier)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.pricing_multiplier}
                              onChange={(e) =>
                                updateItemField(
                                  index,
                                  "pricing_multiplier",
                                  handleNumericTextInput(e.target.value),
                                )
                              }
                              placeholder="1.0"
                              className="w-full px-3.5 py-2 h-[42px] border border-purple-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 outline-none text-[14px] font-mono text-purple-700 font-bold bg-purple-50/40 shadow-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-[12px] font-bold text-slate-600 mb-2 uppercase tracking-wider">
                              建議售價 (每單位)
                            </label>
                            <div className="bg-slate-100/80 px-3.5 py-2 h-[42px] text-[13px] flex items-center justify-between border border-slate-200 rounded-xl">
                              <span className="text-[14px] font-mono font-bold text-slate-500">
                                ${formatCurrency(suggestedPrice)}
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[12px] font-black text-blue-600 mb-2 uppercase tracking-wider">
                              最終報價單價 (每單位){" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-[15px]">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={item.final_price_per_kg}
                                onChange={(e) =>
                                  updateItemField(
                                    index,
                                    "final_price_per_kg",
                                    handleNumericTextInput(e.target.value),
                                  )
                                }
                                placeholder={suggestedPrice.toString()}
                                className="w-full pl-8 pr-3.5 py-2 h-[44px] border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none text-[17px] font-mono font-black text-blue-700 shadow-sm"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200/80 flex flex-col justify-end bg-blue-50/40 p-4 rounded-2xl border border-blue-100">
                          <span className="text-[11px] text-blue-600 font-black uppercase tracking-wider mb-1">
                            品項小計 (未稅)
                          </span>
                          <span className="text-[20px] font-black font-mono text-blue-900 leading-none">
                            ${formatCurrency(Math.round(finalTotalPrice))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 底部功能列 */}
        <div className="mt-2 flex flex-col sm:flex-row justify-end gap-3.5 w-full">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            disabled={formData.items.length === 0}
            className="w-full sm:w-auto px-7 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 active:scale-95 shadow-sm transition-all font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Eye size={17} /> 預覽報價單
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-9 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl shadow-[0_4px_14px_rgba(37,99,235,0.3)] transition-all font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Save size={17} /> {isSubmitting ? "更新中..." : "更新報價單"}
          </button>
        </div>
      </form>

      {/* 預覽視窗 Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 print:static print:block print:bg-transparent print:p-0 print:backdrop-blur-none">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 print:shadow-none print:w-full print:max-w-none print:max-h-none print:overflow-visible print:block">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/80 shrink-0 print:hidden">
              <h3 className="text-[16px] font-black text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" /> 單據列印預覽
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <Printer size={15} /> 列印單據
                </button>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="text-slate-400 hover:text-slate-700 font-bold text-xl ml-2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200/60 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-200/70 p-6 overflow-y-auto print:bg-white print:p-0 print:overflow-visible print:block print:max-h-none">
              <DocumentPreview
                formData={formData}
                vendors={vendors}
                materials={materials}
                allMaterials={allMaterials}
                boms={boms}
              />
            </div>
          </div>
        </div>
      )}

      <CustomDialog isOpen={dialog.isOpen} {...dialog} onClose={closeDialog} />
    </div>
  );
};

export default QuotationEditPage;
