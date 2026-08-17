import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";

// 預設的三組成本選項
const COST_OPTIONS = [
  { key: "material_cost", name: "純料成本" },
  { key: "packaging_cost", name: "包材成本" },
  { key: "manual_cost", name: "人工成本" },
];

// --- 🌟 客製化新增成本下拉選單 ---
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
        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1.5 rounded font-bold transition-colors flex items-center gap-1 border border-slate-200 shadow-sm"
      >
        <Plus size={12} /> 新增項目
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-28 bg-white border border-slate-200 rounded-md shadow-lg z-10 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100">
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
                className={`text-left px-3 py-2 text-xs font-bold transition-colors ${
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

// --- 擬真列印預覽元件 (支援列印樣式，強制新細明體) ---
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
  const today = new Date().toISOString().split("T")[0].replace(/-/g, "/");

  // 取得成品的 BOM 原料清單
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
        const usageQty = reqQty / baseQty;

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
      {/* ========================================== */}
      {/* 外部視角：產品報價單 (Image 3)               */}
      {/* ========================================== */}
      <div className="bg-white p-10 shadow-lg mx-auto w-full max-w-[210mm] min-h-[297mm] text-black relative print:shadow-none print:w-full print:max-w-none print:m-0 print:p-[15mm] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 shrink-0">
          <div className="w-1/3 text-xs leading-relaxed">
            <h2 className="text-base font-bold mb-1">基香食品有限公司</h2>
            <p>桃園市觀音區崙坪里1鄰1-10號</p>
            <p>電話: 03-4988228</p>
          </div>
          <div className="w-1/3 text-center">
            <h1 className="text-2xl font-bold tracking-[0.5em] mb-1 pb-1 inline-block border-b-[3px] border-double border-black">
              產品報價單
            </h1>
            <p className="text-xs">傳真: 03-4988159</p>
          </div>
          <div className="w-1/3 text-right text-xs">
            <p>第 1 頁,共 1 頁</p>
          </div>
        </div>

        {/* Meta Data */}
        <div className="flex justify-between text-xs mb-4 shrink-0">
          <div className="space-y-1">
            <p>
              <span className="inline-block w-16">客戶名稱:</span>{" "}
              {customer?.name || ""}
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

        {/* Items Table */}
        <table className="w-full text-xs border-collapse shrink-0">
          <thead>
            <tr className="border-t border-b border-black text-left">
              <th className="py-2 px-1 w-8">序</th>
              <th className="py-2 px-1 w-24">貨品編號</th>
              <th className="py-2 px-1">品名</th>
              <th className="py-2 px-1 w-28 text-right">單價(元/公斤)</th>
              <th className="py-2 px-1 w-32 text-center">規格</th>
              <th className="py-2 px-1 w-24">附註(未稅)</th>
            </tr>
          </thead>
          <tbody>
            {formData.items.map((item, idx) => {
              const mat = materials.find(
                (m) => String(m.id) === String(item.product),
              );
              return (
                <tr
                  key={idx}
                  className="border-b border-dashed border-gray-300"
                >
                  <td className="py-3 px-1 text-center">{idx + 1}</td>
                  <td className="py-3 px-1">{mat?.code}</td>
                  <td className="py-3 px-1">{mat?.name}</td>
                  <td className="py-3 px-1 text-right">
                    {Math.round(parseFloat(item.final_price_per_kg || 0))}
                  </td>
                  <td className="py-3 px-1 text-center">{item.spec || ""}</td>
                  <td className="py-3 px-1"></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 彈性空白區塊 */}
        <div className="flex-1 min-h-[100px]"></div>

        {/* Footer Notes */}
        <div className="mt-auto text-xs leading-relaxed space-y-4 pt-10 shrink-0">
          <div>
            <span className="text-sm">產品備註：</span>
            <div className="pl-6 space-y-0.5 mt-1 text-gray-800">
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
              <p className="mt-2 font-bold tracking-widest">
                ** 此報價金額未包含關稅 **
              </p>
            </div>
          </div>

          <div>
            <span className="text-sm">專用原料清單：</span>
          </div>

          <div>
            <span className="text-sm">通用備註：</span>
            <div className="pl-6 space-y-0.5 mt-1 text-gray-800">
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

        {/* Signatures */}
        <div className="flex justify-between mt-16 text-sm shrink-0">
          <div className="w-1/4">審 核：</div>
          <div className="w-1/4">經 辦：</div>
          <div className="w-1/4">會 簽：</div>
          <div className="w-1/4">客戶簽回：</div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 內部視角：成本估算單 (Image 4) - 每個品項一頁  */}
      {/* ========================================== */}
      {formData.items.map((item, idx) => {
        const mat = materials.find(
          (m) => String(m.id) === String(item.product),
        );
        const bomItems = getBomItems(item.product);

        // 內部成本精算
        const totalMaterialCost = Math.round(
          bomItems.reduce((sum, b) => sum + b.cost * b.qty, 0),
        );
        const manualCost = Math.round(
          Object.values(item.costs_breakdown)
            .filter((c) => c.name !== "純料成本")
            .reduce((sum, c) => sum + (parseFloat(c.value) || 0), 0),
        );
        const totalEstimatedCost = totalMaterialCost + manualCost;

        return (
          <div
            key={`cost-${idx}`}
            className="page-break bg-white p-10 shadow-lg mx-auto w-full max-w-[210mm] min-h-[297mm] text-black relative print:shadow-none print:w-full print:max-w-none print:m-0 print:p-[15mm] flex flex-col"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-6 shrink-0">
              <div className="w-1/3 text-xs leading-relaxed">
                <h2 className="text-base font-bold mb-1">基香食品有限公司</h2>
                <p>桃園市觀音區崙坪里1鄰1-10號</p>
                <p>電話: 03-4988228</p>
              </div>
              <div className="w-1/3 text-center">
                <p className="text-xs text-right mt-6">傳真: 03-4988159</p>
              </div>
              <div className="w-1/3 text-right">
                <h1 className="text-2xl font-bold tracking-[0.2em] mb-1">
                  成本估算單
                </h1>
                <p className="text-xs">
                  第 {idx + 1} 頁,共 {formData.items.length} 頁
                </p>
              </div>
            </div>

            {/* 🌟 Meta Data (使用 Flexbox 嚴格對齊) */}
            <div className="flex justify-between text-xs mb-4 shrink-0">
              <div className="space-y-1 w-[30%]">
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
                  <span>{totalMaterialCost}</span>
                </div>
                <div className="flex">
                  <span className="w-20 shrink-0">估算總成本:</span>
                  <span>{totalEstimatedCost}</span>
                </div>
              </div>
              <div className="space-y-1 w-[35%] flex flex-col items-center">
                <div className="flex w-full justify-center px-2">
                  <span className="shrink-0 mr-2">產品名稱:</span>
                  <span className="text-left font-bold">{mat?.name || ""}</span>
                </div>
                <div>
                  <br />
                </div>
                <div className="flex w-full justify-center px-2">
                  <span className="shrink-0 mr-2">含工總成本:</span>
                  <span className="text-left">{totalEstimatedCost}</span>
                </div>
                <div>
                  <br />
                </div>
              </div>
              <div className="space-y-1 w-[35%] flex flex-col items-end">
                <div className="flex w-full max-w-[200px]">
                  <span className="w-24 shrink-0">單據編號:</span>
                  <span className="flex-1 text-left">
                    {formData.quotation_number || "系統核發"}
                  </span>
                </div>
                <div className="flex w-full max-w-[200px]">
                  <span className="w-24 shrink-0">數 量:</span>
                  <span className="flex-1 text-left">1.0000</span>
                </div>
                <div className="flex w-full max-w-[200px]">
                  <span className="w-24 shrink-0">製造總費用:</span>
                  <span className="flex-1 text-left">{manualCost}</span>
                </div>
                <div className="flex w-full max-w-[200px]">
                  <span className="w-24 shrink-0">估算單位成本:</span>
                  <span className="flex-1 text-left">{totalEstimatedCost}</span>
                </div>
              </div>
            </div>

            {/* BOM Table */}
            <table className="w-full text-xs border-collapse mb-8 shrink-0">
              <thead>
                <tr className="border-t border-b border-black text-left">
                  <th className="py-2 px-1 w-8">序</th>
                  <th className="py-2 px-1">原料編號</th>
                  <th className="py-2 px-1">原料名稱</th>
                  <th className="py-2 px-1 w-12 text-center">單位</th>
                  <th className="py-2 px-1 w-20 text-right">使用量</th>
                  <th className="py-2 px-1 w-20 text-right">平均成本</th>
                  <th className="py-2 px-1 w-16 text-center">插件位置</th>
                  <th className="py-2 px-1 w-16">附註</th>
                  <th className="py-2 px-1 w-24 text-right">總材料成本</th>
                </tr>
              </thead>
              <tbody>
                {bomItems.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-4 text-gray-400">
                      尚無配方資料
                    </td>
                  </tr>
                ) : (
                  bomItems.map((b, bIdx) => (
                    <tr
                      key={bIdx}
                      className="border-b border-dashed border-gray-200"
                    >
                      <td className="py-1.5 px-1">{bIdx + 1}</td>
                      <td className="py-1.5 px-1">{b.childCode}</td>
                      <td className="py-1.5 px-1">{b.childName}</td>
                      <td className="py-1.5 px-1 text-center">{b.childUnit}</td>
                      <td className="py-1.5 px-1 text-right">
                        {b.qty.toFixed(4)}
                      </td>
                      <td className="py-1.5 px-1 text-right">{b.cost}</td>
                      <td className="py-1.5 px-1 text-center"></td>
                      <td className="py-1.5 px-1"></td>
                      <td className="py-1.5 px-1 text-right">
                        {Math.round(b.cost * b.qty)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="flex-1 min-h-[50px]"></div>

            <div className="mt-8 text-xs shrink-0">
              <p>單據備註：</p>
            </div>

            {/* Signatures */}
            <div className="flex justify-between mt-auto pt-16 text-sm shrink-0">
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

// --- 共用下拉選單元件 ---
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
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
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
        className={`w-full h-[42px] px-3 py-2 border rounded-md text-sm flex justify-between items-center transition-colors ${
          disabled
            ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
            : isOpen
              ? "border-blue-500 ring-1 ring-blue-500 bg-white"
              : "bg-white border-slate-300 hover:border-slate-400 text-slate-800"
        }`}
      >
        <span className="truncate pr-2 font-medium">
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
        <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-xl flex flex-col max-h-64 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 bg-slate-50 shrink-0">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-2 text-slate-400"
              />
              <input
                autoFocus
                className="w-full border border-slate-300 rounded pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="輸入代碼或名稱搜尋..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  className={`px-3 py-2.5 text-sm rounded cursor-pointer transition-colors ${
                    String(value) === String(opt.id)
                      ? "bg-blue-50 text-blue-700 font-bold"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {renderItem ? renderItem(opt) : opt.name}
                </div>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-slate-400 text-sm">
                查無資料
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- 主頁面 ---
const QuotationCreatePage = () => {
  const navigate = useNavigate();
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

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [vendorRes, matRes, bomRes] = await Promise.all([
          fetchWithAuth("/api/vendors?is_active=true"),
          fetchWithAuth("/api/materials"),
          fetchWithAuth("/api/boms"),
        ]);

        const vendorJson = await vendorRes.json();
        const matJson = await matRes.json();
        const bomJson = await bomRes.json();

        setVendors(vendorJson.data || vendorJson || []);
        setBoms(bomJson.data || bomJson || []);

        const allMats = matJson.data || matJson || [];
        setAllMaterials(allMats);

        const filteredMats = allMats.filter(
          (m) =>
            m.type === "PRODUCT" && ["IN_DEV", "IN_PROD"].includes(m.phase),
        );
        setMaterials(filteredMats);
      } catch (err) {
        setDialog({
          isOpen: true,
          type: "alert",
          status: "error",
          title: "載入失敗",
          message: err.message,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `temp_${Date.now()}`,
          product: "",
          spec: "",
          costs_breakdown: {
            material_cost: { name: "純料成本", value: "" },
          },
          pricing_multiplier: 1.0,
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
      newItems[index] = { ...newItems[index], [field]: value };

      // 自動連動純料成本 (並四捨五入)
      if (field === "product" && value) {
        const selectedMat = allMaterials.find(
          (m) => String(m.id) === String(value),
        );
        if (selectedMat && newItems[index].costs_breakdown["material_cost"]) {
          newItems[index].costs_breakdown["material_cost"].value = Math.round(
            parseFloat(selectedMat.estimated_cost || 0),
          );
        }
      }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer) {
      return setDialog({
        isOpen: true,
        type: "alert",
        status: "warning",
        title: "資料不完整",
        message: "請先選擇客戶",
      });
    }
    if (formData.items.length === 0) {
      return setDialog({
        isOpen: true,
        type: "alert",
        status: "warning",
        title: "資料不完整",
        message: "請至少新增一筆報價品項",
      });
    }
    if (
      formData.items.some((item) => !item.product || !item.final_price_per_kg)
    ) {
      return setDialog({
        isOpen: true,
        type: "alert",
        status: "warning",
        title: "資料不完整",
        message: "所有品項皆須選擇產品並輸入最終報價",
      });
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
              const { id, ...rest } = item;
              return typeof id === "string" && id.startsWith("temp_")
                ? rest
                : item;
            }),
          };

          const res = await fetchWithAuth("/api/quotations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) throw new Error("儲存失敗，請檢查網路狀態或資料格式");

          setDialog({
            isOpen: true,
            type: "alert",
            status: "success",
            title: "儲存成功",
            message: "報價單已成功建立！",
            onCloseCallback: () => window.location.reload(),
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
        <div className="animate-pulse text-slate-500 font-medium">
          載入系統資料中...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 md:p-8 pb-12 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800 print:bg-white print:p-0">
      <style>{`
        @media print {
          .page-break { page-break-before: always; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      <div className="mb-6 print:hidden">
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
          報價單管理
        </h2>
      </div>

      <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg mb-6 border border-blue-100 shadow-sm print:hidden">
        <p className="flex items-center gap-2 font-medium mb-1">
          <span className="text-lg leading-none">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
          <li>請先選定客戶，系統才會根據客戶歷史紀錄或特約開啟報價功能。</li>
          <li>
            動態成本區塊可新增「包材成本」、「人工成本」，系統將自動加總並乘以「報價常數」給出建議單價。
          </li>
          <li>成本運算至四捨五入整數位。</li>
        </ul>
      </div>

      <form className="flex flex-col gap-6 w-full pb-6 print:hidden">
        {/* 單頭區塊 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Building2 size={18} className="text-slate-500" /> 客戶與單據資訊
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
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
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                單據狀態 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, status: e.target.value }))
                }
                className="w-full h-[42px] px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors bg-white font-medium"
              >
                <option value="DRAFT">📝 草稿</option>
                <option value="CONFIRMED">✅ 已確認/成立</option>
              </select>
            </div>
          </div>
        </div>

        {/* 單身區塊 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-3">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Calculator size={18} className="text-slate-500" /> 報價品項明細
              <span className="text-slate-400 font-normal text-sm">
                ({formData.items.length})
              </span>
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              disabled={!formData.customer}
              className="text-sm bg-white text-emerald-600 px-3 py-1.5 rounded-md hover:bg-emerald-50 font-bold transition-colors shadow-sm flex items-center gap-1 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} /> 新增品項
            </button>
          </div>

          <div className="p-6 bg-slate-50/30 flex flex-col gap-6">
            {formData.items.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-400 font-medium">
                {formData.customer
                  ? "請點擊右上角「新增品項」開始報價"
                  : "請先於上方選擇客戶"}
              </div>
            ) : (
              formData.items.map((item, index) => {
                const costsKeys = Object.keys(item.costs_breakdown);
                const totalCost = Math.round(
                  costsKeys.reduce(
                    (sum, key) =>
                      sum + (parseFloat(item.costs_breakdown[key].value) || 0),
                    0,
                  ),
                );
                const suggestedPrice = Math.round(
                  totalCost * parseFloat(item.pricing_multiplier || 1),
                );

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden relative group"
                  >
                    <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-5 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-slate-100 pb-4 lg:pb-0 lg:pr-6">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                            報價產品
                          </label>
                          <FilterableDropdown
                            value={item.product}
                            onChange={(val) =>
                              updateItemField(index, "product", val)
                            }
                            options={materials}
                            placeholder="請搜尋成品..."
                            renderItem={(m) => (
                              <div className="flex flex-col">
                                <span>{m.name}</span>
                                <span className="text-xs text-slate-400 font-mono">
                                  [{m.code}] Phase: {m.phase}
                                </span>
                              </div>
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase flex justify-between">
                            包裝規格文字
                            <span className="text-[10px] text-slate-400 font-normal">
                              列印呈現在報價單上
                            </span>
                          </label>
                          <input
                            type="text"
                            value={item.spec}
                            onChange={(e) =>
                              updateItemField(index, "spec", e.target.value)
                            }
                            placeholder="如：0.10KG*110包/箱"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:border-blue-500 focus:ring-1 outline-none text-sm"
                          />
                        </div>

                        <div className="mt-auto pt-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1 border border-transparent hover:border-red-100"
                          >
                            <Trash2 size={14} /> 刪除此品項
                          </button>
                        </div>
                      </div>

                      {/* 中間：成本結構動態 Json */}
                      <div className="lg:col-span-4 flex flex-col gap-3 border-b lg:border-b-0 lg:border-r border-slate-100 pb-4 lg:pb-0 lg:pr-6">
                        <div className="flex justify-between items-center mb-1 relative">
                          <label className="block text-xs font-bold text-slate-500 uppercase">
                            內部成本拆解 (每公斤)
                          </label>
                          <AddCostDropdown
                            existingKeys={costsKeys}
                            onSelect={(key) =>
                              handleAddSpecificCost(index, key)
                            }
                          />
                        </div>

                        {costsKeys.map((costKey) => (
                          <div
                            key={costKey}
                            className="flex gap-2 items-center"
                          >
                            {/* 🌟 彈性等寬排版 */}
                            <input
                              type="text"
                              value={item.costs_breakdown[costKey].name}
                              readOnly
                              className="flex-1 px-2 py-1.5 border border-slate-200 rounded outline-none text-xs bg-slate-100 text-slate-500 min-w-0"
                            />
                            <div className="relative flex-1 flex items-center gap-1 min-w-0">
                              <span className="text-slate-400 text-xs">$</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.costs_breakdown[costKey].value}
                                onChange={(e) =>
                                  updateCostBreakdown(
                                    index,
                                    costKey,
                                    "value",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                className="w-full px-2 py-1.5 border border-slate-300 rounded focus:border-blue-500 outline-none text-xs text-right font-mono"
                              />
                            </div>
                            {/* 🌟 固定寬度的按鈕佔位區，確保上下對齊 */}
                            <div className="w-6 flex justify-center shrink-0">
                              {costKey !== "material_cost" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeCostField(index, costKey)
                                  }
                                  className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-end">
                          <span className="text-xs font-bold text-slate-600">
                            總估算成本：
                          </span>
                          <span className="text-sm font-black font-mono text-slate-800">
                            ${totalCost}
                          </span>
                        </div>
                      </div>

                      {/* 右側：最終報價 */}
                      <div className="lg:col-span-3 flex flex-col justify-center gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                            報價係數
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={item.pricing_multiplier}
                            onChange={(e) =>
                              updateItemField(
                                index,
                                "pricing_multiplier",
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:border-purple-500 focus:ring-1 outline-none text-sm font-mono text-purple-700 font-bold bg-purple-50/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                            建議售價
                          </label>
                          <div className="bg-slate-50 p-2 text-xs flex justify-between border border-slate-200 rounded">
                            <span className="text-sm font-mono font-bold text-slate-500">
                              ${suggestedPrice}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-black text-blue-600 mb-1.5 uppercase">
                            最終報價單價 (每公斤){" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 font-bold">
                              $
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.final_price_per_kg}
                              onChange={(e) =>
                                updateItemField(
                                  index,
                                  "final_price_per_kg",
                                  e.target.value,
                                )
                              }
                              placeholder={suggestedPrice.toString()}
                              className="w-full pl-7 pr-3 py-2 border-2 border-blue-200 rounded-md focus:border-blue-500 outline-none text-lg font-mono font-black text-blue-700"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col md:flex-row justify-end gap-3 w-full">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            disabled={formData.items.length === 0}
            className="w-full md:w-auto px-6 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 shadow-sm transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Eye size={16} /> 預覽報價單
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full md:w-auto px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={16} /> {isSubmitting ? "儲存中..." : "儲存報價"}
          </button>
        </div>
      </form>

      {/* 雙視角列印預覽 Modal */}
      {/* 雙視角列印預覽 Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:static print:block print:bg-transparent print:p-0 print:backdrop-blur-none">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:w-full print:max-w-none print:max-h-none print:overflow-visible print:block">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0 print:hidden">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText size={20} className="text-blue-600" /> 單據列印預覽
                (外部報價 / 內部估算)
              </h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded flex items-center gap-2 transition-colors"
                >
                  <Printer size={14} /> 列印此單據
                </button>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-300 p-6 overflow-y-auto print:bg-white print:p-0 print:overflow-visible print:block print:max-h-none">
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

export default QuotationCreatePage;
