import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  Lock,
  Package,
  AlertCircle,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";

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
        className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 border border-slate-200 shadow-sm"
      >
        <Plus size={13} /> 新增成本項目
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-slate-200 rounded-xl shadow-lg z-10 flex flex-col py-1.5 animate-in fade-in zoom-in-95 duration-100">
          {COST_OPTIONS.map((opt) => {
            const isDisabled = existingKeys.includes(opt.key);
            // 🌟 強制只有 manual_cost 可以被手動新增
            const isManualOnly = opt.key !== "manual_cost";
            const disabledState = isDisabled || isManualOnly;

            return (
              <button
                key={opt.key}
                type="button"
                disabled={disabledState}
                onClick={() => {
                  onSelect(opt.key);
                  setIsOpen(false);
                }}
                className={`text-left px-4 py-2 text-[13px] font-bold transition-colors ${
                  disabledState
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

// ==========================================
// 🌟 列印預覽元件
// ==========================================
const DocumentPreview = ({ formData, vendors, allMaterials }) => {
  const customer = vendors.find(
    (v) => String(v.id) === String(formData.customer),
  );
  const today = formData.issue_date
    ? formData.issue_date.replace(/-/g, "/")
    : new Date().toISOString().split("T")[0].replace(/-/g, "/");

  return (
    <div
      id="print-area"
      className="flex flex-col gap-8 bg-slate-200 p-8 rounded-lg overflow-y-auto max-h-[75vh] custom-scrollbar print:bg-white print:p-0 print:overflow-visible print:block print:max-h-none"
      style={{ fontFamily: "'MingLiU', 'PMingLiU', serif" }}
    >
      {/* 產品報價單首頁 */}
      <div className="bg-white p-10 shadow-lg mx-auto w-full max-w-[210mm] min-h-[297mm] text-black relative print:shadow-none print:w-full print:max-w-none print:m-0 print:p-[15mm] flex flex-col page-break">
        <div className="flex justify-between items-start mb-6 shrink-0">
          <div className="w-1/3 text-[12px] leading-relaxed">
            <h2 className="text-[15px] font-bold mb-1">基香食品有限公司</h2>
            <p>桃園市觀音區崙坪里1鄰1-10號</p>
            <p>電話: 03-4988228</p>
          </div>
          <div className="w-1/3 text-center">
            <h1 className="text-[26px] font-bold tracking-[0.5em] mb-1 pb-1 inline-block border-b-[3px] border-double border-black">
              產品報價單
            </h1>
            <p className="text-[12px]">傳真: 03-4988159</p>
          </div>
          <div className="w-1/3 text-right text-[12px]">
            <p>第 1 頁,共 1 頁</p>
          </div>
        </div>

        <div className="flex justify-between text-[12px] mb-4 shrink-0">
          <div className="space-y-1">
            <p>
              <span className="inline-block w-16">客戶名稱:</span>{" "}
              {customer?.name || formData.customer_name || ""}
            </p>
            <p>
              <span className="inline-block w-16">客戶統編:</span>{" "}
              {customer?.tax_id || ""}
            </p>
            <p>
              <span className="inline-block w-16">客戶電話:</span>{" "}
              {customer?.phone || ""}
            </p>
            <p>
              <span className="inline-block w-16">送貨地址:</span>{" "}
              {customer?.delivery_address || customer?.address || ""}
            </p>
          </div>
          <div className="space-y-1">
            <p>
              <span className="inline-block w-16">客戶編號:</span>{" "}
              {customer?.code || ""}
            </p>
            <p>
              <span className="inline-block w-16">聯 絡 人:</span>{" "}
              {customer?.contact_person || ""}
            </p>
            <p>
              <span className="inline-block w-16">客戶傳真:</span>{" "}
              {customer?.fax || ""}
            </p>
          </div>
          <div className="space-y-1 text-right">
            <p>
              <span className="inline-block w-16 text-left">單據日期:</span>{" "}
              {today}
            </p>
            <p>
              <span className="inline-block w-16 text-left">單據編號:</span>{" "}
              {formData.quotation_number || "系統核發"}
            </p>
          </div>
        </div>

        <table className="w-full text-[12px] border-collapse shrink-0">
          <thead>
            <tr className="border-t border-b border-black text-left">
              <th className="py-2 px-1 w-8">序</th>
              <th className="py-2 px-1 w-20">貨品編號</th>
              <th className="py-2 px-1">品名</th>
              <th className="py-2 px-1 w-14 text-center">數量</th>
              <th className="py-2 px-1 w-14 text-center">單位</th>
              <th className="py-2 px-1 w-24 text-right">單價(元/單位)</th>
              <th className="py-2 px-1 w-28 text-center">規格</th>
              <th className="py-2 px-1 w-20">附註(未稅)</th>
            </tr>
          </thead>
          <tbody>
            {formData.items.map((item, idx) => {
              const mat =
                allMaterials.find(
                  (m) => String(m.id) === String(item.product),
                ) || item.product_detail;
              return (
                <tr
                  key={idx}
                  className="border-b border-dashed border-gray-300"
                >
                  <td className="py-2 px-1 text-center">{idx + 1}</td>
                  <td className="py-2 px-1">{mat?.code}</td>
                  <td className="py-2 px-1">{mat?.name}</td>
                  <td className="py-2 px-1 text-center">
                    {item.sales_unit_quantity || 1}
                  </td>
                  <td className="py-2 px-1 text-center">
                    {item.sales_unit || ""}
                  </td>
                  <td className="py-2 px-1 text-right">
                    {Math.round(parseFloat(item.final_price_per_kg || 0))}
                  </td>
                  <td className="py-2 px-1 text-center">{item.spec || ""}</td>
                  <td className="py-2 px-1"></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex-1 min-h-[100px]"></div>

        <div className="mt-auto text-[12px] leading-relaxed space-y-4 pt-10 shrink-0">
          <div>
            <span className="text-[13px] font-bold">產品備註：</span>
            <div className="pl-6 space-y-1 mt-1 text-gray-800">
              <p>
                1.
                接收報價單請於三日內簽名回傳，逾期未簽名回傳則視為同意此報價。
              </p>
              <p>2. 原物料漲幅超過5% 或作業上有其他異動將重新報價。</p>
              <p>3. 訂貨後需一次出貨完畢並結清款項。</p>
              <p>
                4.
                調味粉產品：最低出貨量單品項以『箱』為單位，無庫存產品，單一品項出貨量未滿
                100kg 除負擔運費外須加換線處理費500元。
              </p>
              <p>5. 果醬、調味醬產品：最低訂貨量為『 100 kg』。</p>
              <p className="mt-2 font-bold tracking-widest text-[13px]">
                ** 此報價金額未包含關稅 **
              </p>
            </div>
          </div>
          <div>
            <span className="text-[13px] font-bold">專用原料清單：</span>
          </div>
          <div>
            <span className="text-[13px] font-bold">通用備註：</span>
            <div className="pl-6 space-y-1 mt-1 text-gray-800">
              <p>1. 如需內部檢驗報告，請於訂購時提出需求。</p>
              <p>
                2. 累計採購量未達經濟批量之產品，其外部檢驗費用將由客戶負擔。
              </p>
              <p>
                3.
                本報價單30天內有效，非常態庫存產品出貨日期由訂購日起計15～20工作天，請提早訂購。
              </p>
              <p>
                4.
                上述產品專用之原料，若結束生產後尚有剩餘原料，請以當時採購之原價購回。
              </p>
              <p>
                5.
                代客研發產品若有採購計畫異動請提早告知，以利進行製程庫存調整。
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-16 text-[13px] shrink-0">
          <div className="w-1/4">審 核：</div>
          <div className="w-1/4">經 辦：</div>
          <div className="w-1/4">會 簽：</div>
          <div className="w-1/4">客戶簽回：</div>
        </div>
      </div>

      {/* 各品項估算單明細 */}
      {formData.items.map((item, idx) => {
        const mat =
          allMaterials.find((m) => String(m.id) === String(item.product)) ||
          item.product_detail;

        const qty = parseFloat(item.sales_unit_quantity) || 1;

        const totalMaterialCostPerUnit = Math.round(
          parseFloat(item.costs_breakdown?.material_cost?.value || 0),
        );

        const manualCostPerUnit = Math.round(
          Object.entries(item.costs_breakdown || {})
            .filter(([k]) => k !== "material_cost")
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
                  <span className="shrink-0 mr-2">總計(含工與包材):</span>
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
                  <span className="w-24 shrink-0">包材與製造費用:</span>
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

            <div className="flex-1 min-h-[50px]">
              {/* 🌟 移除 BOM 表格，只保留總計即可 */}
            </div>

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
// 🌟 FilterableDropdown
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
        className={`w-full h-[42px] px-3.5 py-2 border rounded-xl text-[13px] flex justify-between items-center transition-colors shadow-sm cursor-pointer ${
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

// ==========================================
// 🌟 主頁面
// ==========================================
const QuotationCreatePage = () => {
  const navigate = useNavigate();

  const [vendors, setVendors] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);
  const [packageOrders, setPackageOrders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [formError, setFormError] = useState("");

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

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [vendorRes, matRes, poRes] = await Promise.all([
          fetchWithAuth("/api/vendors?is_active=true"),
          fetchWithAuth("/api/materials?type__in=SEMI,PRODUCT,PACK"), // 🌟 取消不需要的原料，加快效能
          fetchWithAuth("/api/package_orders"),
        ]);

        const vendorJson = await vendorRes.json();
        const matJson = await matRes.json();
        const poJson = await poRes.json();

        setVendors(vendorJson.data || vendorJson || []);
        setAllMaterials(matJson.data || matJson || []);
        setPackageOrders(poJson.data || poJson || []);
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
  }, [navigate]);

  // 🌟 將所有的 成品 (PRODUCT) 與 半成品 (SEMI) 合併為一個下拉選單選項
  const quoteTargetOptions = useMemo(() => {
    const prodOpts = packageOrders.map((po) => ({
      id: `po_${po.id}`,
      type: "PRODUCT",
      code: po.product_code,
      name: po.product_name,
      po: po,
    }));
    const semiOpts = allMaterials
      .filter((m) => m.type === "SEMI")
      .map((m) => ({
        id: `semi_${m.id}`,
        type: "SEMI",
        code: m.code,
        name: m.name,
        mat: m,
      }));
    return [...prodOpts, ...semiOpts];
  }, [packageOrders, allMaterials]);

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `temp_${Date.now()}`,
          target_id: "",
          product: "",
          spec: "",
          sales_unit: "",
          sales_unit_quantity: "1",
          sales_pack_unit: "",
          sales_pack_quantity: "0",
          outer_pack: "",
          inner_pack: "",
          costs_breakdown: {
            material_cost: { name: "原料成本", value: "0" },
            packaging_cost: { name: "包材成本", value: "0" },
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

  const handleNumericTextInput = (val, allowDecimal = true) => {
    if (val === "") return "";
    let clean = val.replace(/[^0-9.]/g, "");
    if (!allowDecimal) clean = clean.replace(/\./g, "");
    const parts = clean.split(".");
    if (parts.length > 2) clean = parts[0] + "." + parts.slice(1).join("");
    return clean;
  };

  const updateItemField = (index, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  // 🌟 處理選擇成品或半成品，自動鎖定資料與取得成本
  const handleSelectTarget = (index, selectedId) => {
    const target = quoteTargetOptions.find((o) => o.id === selectedId);
    if (!target) return;

    setFormData((prev) => {
      const newItems = [...prev.items];
      let updatedItem = { ...newItems[index], target_id: selectedId };

      if (target.type === "PRODUCT") {
        const po = target.po;
        const prodMat = allMaterials.find(
          (m) => String(m.id) === String(po.product),
        );

        let packCost = 0;
        (po.packaging_info || []).forEach((p) => {
          const m = allMaterials.find(
            (mat) => String(mat.id) === String(p.material_id),
          );
          if (m) {
            packCost +=
              (parseFloat(m.estimated_cost) || 0) * (Number(p.qty) || 1);
          }
        });

        // 🌟 直接取用後端運算好的 estimated_cost (PRODUCT的成本 = 內含的 SEMI 原料成本)
        let totalMatCost = parseFloat(prodMat?.estimated_cost || 0);

        updatedItem.product = po.product;
        updatedItem.spec = po.spec || "";
        updatedItem.sales_unit = po.sales_unit || "箱";
        updatedItem.sales_unit_quantity = String(po.sales_unit_quantity || 1);
        updatedItem.sales_pack_unit = po.sales_pack_unit || "包";
        updatedItem.sales_pack_quantity = String(po.sales_pack_quantity || 0);
        updatedItem.outer_pack = po.outer_pack || "";
        updatedItem.inner_pack = po.inner_pack || "";

        updatedItem.costs_breakdown = {
          ...updatedItem.costs_breakdown,
          material_cost: {
            name: "原料成本",
            value: String(Math.round(totalMatCost)),
          },
          packaging_cost: {
            name: "包材成本",
            value: String(Math.round(packCost)),
          },
        };
      } else {
        const semi = target.mat;

        // 🌟 SEMI 同樣直接取用 estimated_cost 作為原料成本
        let totalMatCost = parseFloat(semi.estimated_cost) || 0;

        updatedItem.product = semi.id;
        updatedItem.spec = "";
        updatedItem.sales_unit = semi.unit || "KG";
        updatedItem.sales_unit_quantity = "1";
        updatedItem.sales_pack_unit = "";
        updatedItem.sales_pack_quantity = "0";
        updatedItem.outer_pack = "";
        updatedItem.inner_pack = "";

        updatedItem.costs_breakdown = {
          ...updatedItem.costs_breakdown,
          material_cost: {
            name: "原料成本",
            value: String(Math.round(totalMatCost)),
          },
          packaging_cost: { name: "包材成本", value: "0" },
        };
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

  const calculatedTotals = useMemo(() => {
    let total = 0;
    formData.items.forEach((item) => {
      const q = Number(item.sales_unit_quantity) || 0;
      const p = Number(item.final_price_per_kg) || 0;
      total += Math.round(q * p);
    });
    const tax = Math.round(total * 0.05);
    return { total_amount: total, tax_amount: tax, grand_total: total + tax };
  }, [formData.items]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formData.customer) {
      setFormError("請先選擇客戶");
      return;
    }
    if (formData.items.length === 0) {
      setFormError("請至少新增一筆報價品項");
      return;
    }
    if (
      formData.items.some(
        (item) =>
          !item.product ||
          !item.final_price_per_kg ||
          isNaN(Number(item.final_price_per_kg)),
      )
    ) {
      setFormError("所有品項皆須選擇成品或半成品，並輸入有效的最終報價金額");
      return;
    }

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
              const { id, product_detail, target_id, ...rest } = item;
              const processed =
                typeof id === "string" && id.startsWith("temp_")
                  ? rest
                  : { id, ...rest };

              processed.sales_unit_quantity =
                Number(processed.sales_unit_quantity) || 1;
              processed.sales_pack_quantity =
                Number(processed.sales_pack_quantity) || 0;
              processed.pricing_multiplier =
                Number(processed.pricing_multiplier) || 1.0;
              processed.final_price_per_kg =
                Number(processed.final_price_per_kg) || 0;

              processed.outer_pack = processed.outer_pack || null;
              processed.inner_pack = processed.inner_pack || null;

              return processed;
            }),
          };

          const res = await fetchWithAuth("/api/quotations", {
            method: "POST",
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
            title: "建立成功",
            message: "報價單已成功建立！",
            onCloseCallback: () => navigate("/quotations"),
          });
        } catch (err) {
          setFormError(err.message);
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
            新增報價單
          </h2>
          <p className="text-[13px] text-slate-500 font-medium mt-1">
            尚未核發單號
          </p>
        </div>
      </div>

      <div className="bg-blue-50/70 backdrop-blur-md text-blue-900 text-[13px] p-4 md:p-5 rounded-2xl mb-8 border border-blue-200/60 shadow-sm print:hidden">
        <p className="flex items-center gap-2 font-bold mb-2">
          <span className="text-base">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-5 text-slate-700 font-medium">
          <li>
            請從下拉選單選擇 <strong>成品</strong> 或 <strong>半成品</strong>{" "}
            作為報價標的。
          </li>
          <li>
            選擇後系統會自動鎖定並帶入包材結構與成本，您僅需填寫人工成本與設定報價係數。
          </li>
          <li>所有基礎原料與包材成本皆由系統同步計算，確保報價精準無誤。</li>
        </ul>
      </div>

      <form className="flex flex-col gap-8 w-full pb-6 print:hidden">
        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-[13px] font-bold flex items-start gap-2.5 shadow-sm animate-in slide-in-from-top-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

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

                const currentOuterMat = allMaterials.find(
                  (m) => String(m.id) === String(item.outer_pack),
                );
                const currentInnerMat = allMaterials.find(
                  (m) => String(m.id) === String(item.inner_pack),
                );

                const innerCap = currentInnerMat?.pack_capacity
                  ? parseInt(currentInnerMat.pack_capacity)
                  : 0;

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-200/90 rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden relative"
                  >
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
                      {/* 左側：包裝單選擇與唯讀規格 */}
                      <div className="lg:col-span-5 flex flex-col gap-5 border-b lg:border-b-0 lg:border-r border-slate-200/80 pb-6 lg:pb-0 lg:pr-8">
                        <div>
                          <label className="block text-[12px] font-bold text-slate-600 mb-2 uppercase tracking-wider">
                            選擇報價標的 (成品 / 半成品){" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <FilterableDropdown
                            value={item.target_id}
                            onChange={(val) => handleSelectTarget(index, val)}
                            options={quoteTargetOptions}
                            placeholder="搜尋成品或半成品..."
                            renderItem={(opt) => (
                              <div className="flex justify-between items-center w-full">
                                <span
                                  className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                                    opt.type === "PRODUCT"
                                      ? "bg-blue-100 text-blue-700 border border-blue-200"
                                      : "bg-purple-100 text-purple-700 border border-purple-200"
                                  }`}
                                >
                                  {opt.type === "PRODUCT" ? "成品" : "半成品"}
                                </span>
                                <span className="text-[13px] text-slate-800 font-bold ml-2 truncate text-right">
                                  [{opt.code}] {opt.name}
                                </span>
                              </div>
                            )}
                          />
                        </div>

                        {/* 🌟 依需求更新：包裝與規格字串 (Auto-Spec) 的客製化版面 */}
                        <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3.5 relative overflow-hidden">
                          <div className="flex items-center gap-1.5 text-slate-500 font-black text-[12px] uppercase tracking-wider border-b border-slate-200/60 pb-2">
                            <Package size={15} strokeWidth={2.5} />{" "}
                            包材與規格檢視
                          </div>

                          <div className="flex flex-col gap-2 text-[13px]">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider w-16">
                                包材單位
                              </span>
                              <div className="flex items-center">
                                {currentOuterMat ? (
                                  <>
                                    <span className="font-mono text-slate-700 font-bold">
                                      {`[${currentOuterMat.code}]`}&nbsp;
                                      {currentOuterMat.name}&nbsp;x&nbsp;
                                    </span>
                                    <span className="font-mono text-slate-700 font-bold">
                                      {formatNum(item.sales_unit_quantity, 0)}
                                    </span>
                                    <span className="font-sans font-medium text-slate-600 mx-1">
                                      {item.sales_unit}
                                    </span>
                                  </>
                                ) : (
                                  <span className="font-bold text-slate-400">
                                    -
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider w-16">
                                輔助單位
                              </span>
                              <div className="flex items-center">
                                {currentInnerMat ? (
                                  <>
                                    <span className="font-mono text-slate-700 font-bold">
                                      {`[${currentInnerMat.code}]`}&nbsp;
                                      {currentInnerMat.name}&nbsp;x&nbsp;
                                    </span>
                                    <span className="font-mono text-slate-700 font-bold">
                                      {formatNum(item.sales_pack_quantity, 0)}
                                    </span>
                                    <span className="font-sans font-medium text-slate-600 mx-1">
                                      {item.sales_pack_unit}
                                    </span>
                                  </>
                                ) : (
                                  <span className="font-bold text-slate-400">
                                    -
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="w-full h-px bg-slate-200/60 my-1"></div>

                          <div className="flex flex-col gap-1 text-[13px]">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              規格標示字串
                            </span>
                            <span className="font-bold text-slate-700">
                              {item.spec || "-"}
                            </span>
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
                            {costsKeys.map((costKey) => {
                              // 🌟 鎖定原料與包材成本
                              const isLocked =
                                costKey === "material_cost" ||
                                costKey === "packaging_cost";

                              return (
                                <div
                                  key={costKey}
                                  className="flex gap-2 items-center"
                                >
                                  <input
                                    type="text"
                                    value={item.costs_breakdown[costKey].name}
                                    readOnly
                                    className="w-24 px-3 py-2 h-[40px] border border-slate-200 rounded-xl outline-none text-[12px] font-bold bg-slate-100 text-slate-500 shrink-0 shadow-sm"
                                  />
                                  <div className="relative flex-1 flex items-center min-w-0">
                                    <span className="absolute left-3 text-slate-400 text-[13px] font-bold">
                                      $
                                    </span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      readOnly={isLocked}
                                      value={
                                        item.costs_breakdown[costKey].value
                                      }
                                      onChange={(e) =>
                                        updateCostBreakdown(
                                          index,
                                          costKey,
                                          "value",
                                          handleNumericTextInput(
                                            e.target.value,
                                          ),
                                        )
                                      }
                                      placeholder="0"
                                      className={`w-full pl-7 pr-3 py-2 h-[40px] border rounded-xl outline-none text-[14px] text-right font-mono font-bold shadow-sm transition-all ${
                                        isLocked
                                          ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed"
                                          : "bg-white border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                                      }`}
                                    />
                                  </div>
                                  <div className="shrink-0">
                                    {isLocked ? (
                                      <div
                                        className="w-[36px] h-[40px] flex items-center justify-center text-slate-400 bg-slate-50 border border-slate-200/60 rounded-xl cursor-not-allowed shadow-sm"
                                        title="由系統推算，不可刪除或手手動修改"
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
                              );
                            })}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200/80 flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
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
                              報價係數
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
                            <div className="bg-slate-100/80 px-3.5 py-2 h-[42px] text-[13px] flex items-center justify-between border border-slate-200 rounded-xl shadow-sm">
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
                                className="w-full pl-8 pr-3.5 py-2 h-[44px] border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none text-[17px] font-mono font-black text-blue-700 shadow-sm transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200/80 flex flex-col justify-end bg-blue-50/40 p-4 rounded-2xl border border-blue-100 shadow-sm">
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
            <Save size={17} /> {isSubmitting ? "建立中..." : "建立報價單"}
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
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
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
                allMaterials={allMaterials}
              />
            </div>
          </div>
        </div>
      )}

      <CustomDialog isOpen={dialog.isOpen} {...dialog} onClose={closeDialog} />
    </div>
  );
};

export default QuotationCreatePage;
