import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  ChevronDown,
  Trash2,
  ChevronLeft,
  ChevronRight,
  DownloadCloud,
  Printer,
  FileText,
  PackagePlus,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { CompanyLogo } from "./components/companyLogo";
import { useAuthStore } from "./store/authStore";

const ITEMS_PER_PAGE = 10;

const STATUS_MAP = {
  WAITING: {
    label: "等待進貨",
    css: "bg-amber-100 text-amber-700 border-amber-200",
  },
  STOCKED: {
    label: "已經入庫",
    css: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
};

const StatusTag = ({ status }) => {
  const statusData = STATUS_MAP[(status || "").toUpperCase()] || {
    label: status,
    css: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`inline-block text-center min-w-[64px] px-3 py-1 rounded-full text-[11px] tracking-wide font-bold border ${statusData.css}`}
    >
      {statusData.label}
    </span>
  );
};

const formatDisplayNum = (val) => {
  if (val === null || val === undefined || val === "") return "";
  const num = Number(val);
  return isNaN(num) ? val : parseFloat(num.toFixed(2)).toString();
};

const formatCurrency = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return "0";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const parseSpecString = (specStr, baseUnit = "KG") => {
  if (!specStr) return null;
  let str = specStr.toString().toUpperCase().replace(/\s+/g, "");
  const abbrMap = {
    CTN: "箱",
    CARTON: "箱",
    PCS: "件",
    EA: "件",
    BTL: "瓶",
    公升: "L",
    公斤: "KG",
    公克: "G",
  };
  for (const [key, val] of Object.entries(abbrMap)) {
    str = str.split(key).join(val);
  }
  const isWeightOrVolume = ["KG", "K", "G", "L", "ML"].includes(
    baseUnit.toUpperCase(),
  );
  const complexMatch = str.match(
    /([\d.]+)[A-Z\u4e00-\u9fa5\/]*[*X]([\d.]+)[A-Z\u4e00-\u9fa5]*\/([A-Z\u4e00-\u9fa5]+)/,
  );
  if (complexMatch) {
    const innerWeight = parseFloat(complexMatch[1]);
    const count = parseFloat(complexMatch[2]);
    const outerUnit = complexMatch[3];
    return {
      auxQuantity: isWeightOrVolume
        ? parseFloat((innerWeight * count).toFixed(2))
        : count,
      auxUnit: outerUnit,
    };
  }
  const simpleMatch = str.match(
    /([\d.]+)[A-Z\u4e00-\u9fa5]*\/([A-Z\u4e00-\u9fa5]+)/,
  );
  if (simpleMatch)
    return {
      auxQuantity: parseFloat(parseFloat(simpleMatch[1]).toFixed(2)),
      auxUnit: simpleMatch[2].replace(/紙袋/g, "袋"),
    };
  if (
    str.includes("*") &&
    (str.includes("CM") || str.includes("MM") || /[\d]+\*[\d]+/.test(str))
  )
    return { auxQuantity: 1, auxUnit: "件" };
  if (str.includes("KG/包") || str.includes("K/包"))
    return { auxQuantity: 1, auxUnit: "包" };
  const weightMatch = str.match(/(?:^|[^\d.])([\d.]+)(?:KG|K|G|L|件)/);
  if (weightMatch)
    return {
      auxQuantity: parseFloat(parseFloat(weightMatch[1]).toFixed(2)),
      auxUnit: "件",
    };
  return null;
};

const SearchableDropdown = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const selectRef = useRef(null);
  const dropdownMenuRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.id === value),
    [value, options],
  );

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lowerSearch = search.toLowerCase();
    return options.filter(
      (opt) =>
        (opt.name && opt.name.toLowerCase().includes(lowerSearch)) ||
        (opt.code && opt.code.toLowerCase().includes(lowerSearch)),
    );
  }, [options, search]);

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
            : "border-slate-200 hover:border-slate-300 shadow-sm"
        }`}
      >
        <span
          className={
            selectedOption
              ? "text-slate-800 font-bold"
              : "text-slate-400 font-medium"
          }
        >
          {selectedOption
            ? `[${selectedOption.code}] ${selectedOption.name}`
            : placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownMenuRef}
            style={dropdownStyle}
            className="fixed bg-white border border-slate-200 shadow-2xl rounded-2xl max-h-72 flex flex-col z-[99999] overflow-hidden"
          >
            <div className="p-3 border-b border-slate-100 bg-slate-50 shrink-0">
              <input
                autoFocus
                type="text"
                placeholder="搜尋代碼或名稱..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm font-medium text-slate-800"
              />
            </div>
            <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer rounded-xl flex items-center gap-3 transition-colors"
                  >
                    <span className="text-[11px] font-mono bg-white shadow-sm border border-slate-200 px-2 py-0.5 rounded-lg text-slate-500 font-bold">
                      {opt.code}
                    </span>
                    <span className="text-sm font-bold text-slate-700">
                      {opt.name}
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
// 列印 Template - C-53 (內部請購單 - A4 直向)
// ==========================================
const PurchaseRequisitionPrintTemplate = ({ data }) => {
  if (!data) return null;
  const printItems = [...(data.items || [])];
  while (printItems.length < 7) printItems.push({});
  const [printYear, printMonth, printDay] = data.request_date
    ? data.request_date.split("-")
    : ["      ", "    ", "    "];

  return (
    <div
      className="hidden print:block w-full bg-white text-black font-sans mx-auto print:p-8"
      style={{ maxWidth: "210mm" }}
    >
      <style>{`
        @media print {
          .page-break { page-break-before: always; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>
      <div className="flex border-2 border-black">
        <div className="w-[15%] border-r-2 border-black flex items-center justify-center p-3 overflow-hidden">
          <CompanyLogo className="w-16 h-16 scale-110" />
        </div>
        <div className="w-[85%] flex flex-col text-center">
          <div className="text-2xl font-bold border-b-2 border-black py-2 tracking-[0.2em]">
            基香食品有限公司
          </div>
          <div className="text-2xl font-bold py-2 tracking-[0.5em]">請購單</div>
        </div>
      </div>
      <div className="border-x-2 border-black px-2 py-3 text-[15px] font-bold">
        填單日期：<span className="mx-1">{printYear}</span>年
        <span className="mx-1">{printMonth}</span>月
        <span className="mx-1">{printDay}</span>日
      </div>
      <table className="w-full border-collapse border-2 border-black text-center text-sm font-bold">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="border-r border-black p-2 font-normal w-10">NO</th>
            <th className="border-r border-black p-2 font-normal">
              物料名稱與包裝規格
            </th>
            <th className="border-r border-black p-2 font-normal w-24">
              總基本數量
            </th>
            <th className="border-r border-black p-2 font-normal w-20">
              指定到貨日
            </th>
            <th className="border-r border-black p-2 font-normal w-24">
              供應商
            </th>
            <th className="border-r border-black p-2 font-normal w-24">
              現庫存量
            </th>
            <th className="p-2 font-normal w-16">備註</th>
          </tr>
        </thead>
        <tbody>
          {printItems.map((item, idx) => {
            let deliveryStr = "";
            if (item.expected_delivery_date) {
              const parts = item.expected_delivery_date.split("-");
              if (parts.length === 3) deliveryStr = `${parts[1]}/${parts[2]}`;
            }
            return (
              <tr
                key={idx}
                className="border-b border-black last:border-b-0 h-10"
              >
                <td className="border-r border-black p-1">{idx + 1}</td>
                <td className="border-r border-black p-1 text-left px-2 text-lg">
                  {item.material_name || ""}{" "}
                  {item.in_stock_spec ? ` (${item.in_stock_spec})` : ""}
                </td>
                <td className="border-r border-black p-1 text-xl">
                  {item.quantity
                    ? `${formatDisplayNum(item.quantity)} ${item.unit || ""}`
                    : ""}
                </td>
                <td className="border-r border-black p-1 text-lg">
                  {deliveryStr}
                </td>
                <td className="border-r border-black p-1 text-lg">
                  {item.provider_name || ""}
                </td>
                <td className="border-r border-black p-1"></td>
                <td className="p-1 text-lg">{item.remark || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex justify-between items-end mt-4 px-4 font-bold text-lg">
        <div className="w-1/3">主管：</div>
        <div className="w-1/3">採購：</div>
        <div className="w-1/3">
          請購：
          <span className="ml-2 font-normal italic text-xl border-b border-black min-w-[80px] inline-block text-center">
            {data.applicant}
          </span>
        </div>
      </div>
      <div className="text-right mt-6 pr-4 font-bold text-sm">表號：C-53</div>
    </div>
  );
};

// ==========================================
// 🌟 列印 Template - 進貨單 (C-34 格式 - A4 橫向 landscape)
// ==========================================
const PurchaseStockedReceivingPrintTemplate = ({
  data,
  providers,
  materials,
}) => {
  if (!data || !data.items || data.items.length === 0) return null;

  const providerGroups = {};
  data.items.forEach((item) => {
    const pId = item.material_provider_id || "unknown";
    if (!providerGroups[pId]) providerGroups[pId] = [];
    providerGroups[pId].push(item);
  });

  return (
    <div className="hidden print:block w-full bg-white text-black font-sans mx-auto">
      <style>{`
        @media print { 
          @page { size: A4 landscape; margin: 8mm 10mm; } 
          .page-break { page-break-after: always; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {Object.entries(providerGroups).map(([pId, items], index, arr) => {
        const provider = providers.find((p) => p.id.toString() === pId) || {};

        const deliveryDates = items
          .map((i) => i.expected_delivery_date)
          .filter(Boolean)
          .sort();
        const deliveryDateStr =
          deliveryDates.length > 0 ? deliveryDates[0].replace(/-/g, "/") : "";

        const totalSum = items.reduce((acc, curr) => {
          return (
            acc +
            parseFloat(curr.quantity || 0) *
              parseFloat(curr.purchased_price || 0)
          );
        }, 0);

        const printItems = [...items];
        while (printItems.length < 10) printItems.push({});

        return (
          <div
            key={pId}
            className={`w-full ${index < arr.length - 1 ? "page-break" : ""}`}
          >
            {/* Header 表頭 */}
            <div className="flex justify-between items-end mb-1 border-b border-black pb-2">
              <div className="w-1/3 text-[11px] leading-tight font-bold">
                桃園市觀音區崙坪里1鄰1-10號
                <br />
                電話: 03-4988228 <span className="ml-4">傳真: 03-4988159</span>
              </div>
              <div className="w-1/3 text-center">
                <h1 className="text-2xl font-black tracking-[0.1em]">
                  基香食品有限公司
                </h1>
                <h2 className="text-xl font-bold tracking-[0.5em] mt-1">
                  進 貨 單
                </h2>
              </div>
              <div className="w-1/3 text-[11px] text-right font-bold leading-tight">
                版次: 04
                <br />第 1 頁, 共 1 頁
              </div>
            </div>

            {/* 廠商與訂單資訊區塊 */}
            <div className="border border-black text-[12px] mb-1 flex flex-col font-bold">
              <div className="flex border-b border-black">
                <div className="w-[35%] border-r border-black p-1 truncate">
                  廠商名稱: {provider.name || "未指定廠商"}
                </div>
                <div className="w-[35%] border-r border-black p-1 truncate">
                  廠商編號: {provider.code || "-"}
                </div>
                <div className="w-[30%] p-1 truncate">
                  單據日期:{" "}
                  {data.request_date
                    ? data.request_date.replace(/-/g, "/")
                    : ""}
                </div>
              </div>
              <div className="flex border-b border-black">
                <div className="w-[35%] border-r border-black p-1 truncate">
                  廠商統編: {provider.tax_id || "-"}
                </div>
                <div className="w-[35%] border-r border-black p-1 truncate">
                  聯 絡 人: {provider.contact_person || "-"}
                </div>
                <div className="w-[30%] p-1 truncate">單據編號: {data.id}</div>
              </div>
              <div className="flex border-b border-black">
                <div className="w-[35%] border-r border-black p-1 truncate">
                  廠商電話: {provider.phone || "-"}
                </div>
                <div className="w-[35%] border-r border-black p-1 truncate">
                  廠商傳真: {provider.fax || "-"}
                </div>
                <div className="w-[30%] p-1 truncate">
                  發票號碼:{" "}
                  {(data.invoices || [])
                    .map(
                      (inv) =>
                        `${inv.invoice_number}${inv.period ? `(${inv.period})` : ""}`,
                    )
                    .join(", ") || "-"}
                </div>
              </div>
              <div className="flex">
                <div className="w-[70%] border-r border-black p-1 truncate">
                  送貨地址: 桃園市觀音區崙坪里1鄰1-10號
                </div>
                <div className="w-[30%] p-1 flex justify-between">
                  <span>交貨日期:</span>
                  <span className="font-bold text-sm tracking-wider pr-2">
                    {deliveryDateStr}
                  </span>
                </div>
              </div>
            </div>

            {/* 進貨明細表格 */}
            <table className="w-full border-collapse border border-black text-center text-[11px] font-bold">
              <thead>
                <tr className="border-b border-black">
                  <th className="border-r border-black p-1 font-normal w-8">
                    序
                  </th>
                  <th className="border-r border-black p-1 font-normal w-32">
                    批號編號
                  </th>
                  <th className="border-r border-black p-1 font-normal text-left px-2">
                    品名
                  </th>
                  <th className="border-r border-black p-1 font-normal w-20">
                    驗收數量
                  </th>
                  <th className="border-r border-black p-1 font-normal w-12">
                    單位
                  </th>
                  <th className="border-r border-black p-1 font-normal w-20">
                    單價
                  </th>
                  <th className="border-r border-black p-1 font-normal w-24">
                    小計
                  </th>
                  <th className="border-r border-black p-1 font-normal w-28">
                    附註
                  </th>
                  <th className="border-r border-black p-1 font-normal w-12">
                    外觀
                  </th>
                  <th className="p-1 font-normal w-12">判定</th>
                </tr>
              </thead>
              <tbody>
                {printItems.map((item, idx) => {
                  const batches = item.generated_batches || [];
                  const batchNumStr = batches
                    .map((b) => b.batch_number)
                    .join(", ");

                  return (
                    <tr key={idx} className="border-b border-black h-7">
                      <td className="border-r border-black">
                        {item.material_id ? idx + 1 : ""}
                      </td>
                      <td className="border-r border-black font-mono text-[11px]">
                        {batchNumStr || ""}
                      </td>
                      <td className="border-r border-black text-left px-2 text-[12px]">
                        {item.material_name || ""}{" "}
                        {item.in_stock_spec ? `(${item.in_stock_spec})` : ""}
                      </td>
                      <td className="border-r border-black text-right px-2 font-mono text-[12px]">
                        {item.quantity ? formatDisplayNum(item.quantity) : ""}
                      </td>
                      <td className="border-r border-black">
                        {item.unit || ""}
                      </td>
                      <td className="border-r border-black text-right px-2 font-mono">
                        {item.purchased_price
                          ? formatDisplayNum(item.purchased_price)
                          : ""}
                      </td>
                      <td className="border-r border-black text-right px-2 font-mono text-[12px]">
                        {item.quantity && item.purchased_price
                          ? formatCurrency(item.quantity * item.purchased_price)
                          : ""}
                      </td>
                      <td className="border-r border-black text-left px-1 truncate text-[10px]">
                        {item.remark || ""}
                      </td>
                      <td className="border-r border-black"></td>
                      <td></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-bold h-7 text-[11px]">
                  <td
                    colSpan="3"
                    className="text-left p-1 border-r border-black"
                  >
                    合計金額：{" "}
                    <span className="float-right pr-2">
                      {formatCurrency(totalSum)}
                    </span>
                  </td>
                  <td
                    colSpan="2"
                    className="text-left p-1 border-r border-black"
                  >
                    營業稅：
                  </td>
                  <td
                    colSpan="3"
                    className="text-left p-1 border-r border-black"
                  >
                    進貨總額：{" "}
                    <span className="float-right pr-2">
                      {formatCurrency(totalSum)}
                    </span>
                  </td>
                  <td colSpan="2" className="text-left p-1">
                    車輛清潔: V
                  </td>
                </tr>
                <tr className="border-t border-black font-bold h-7 text-[11px]">
                  <td
                    colSpan="3"
                    className="text-left p-1 border-r border-black"
                  >
                    折讓金額：
                  </td>
                  <td
                    colSpan="2"
                    className="text-left p-1 border-r border-black"
                  >
                    已付金額：
                  </td>
                  <td
                    colSpan="3"
                    className="text-left p-1 border-r border-black"
                  >
                    未清金額：{" "}
                    <span className="float-right pr-2">
                      {formatCurrency(totalSum)}
                    </span>
                  </td>
                  <td colSpan="2" className="text-left p-1">
                    車輛溫度: ＿°C
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* 驗收標準與備註 */}
            <div className="border border-t-0 border-black p-1.5 text-[10px] leading-snug font-bold">
              <div className="flex justify-between items-start">
                <div className="w-[75%]">
                  <div>
                    單據備註：
                    {(data.invoices || [])
                      .map((inv) => inv.note)
                      .filter(Boolean)
                      .join(" | ")}
                  </div>
                  <div className="text-[9px] text-slate-700 mt-0.5">
                    驗收標準：1.
                    包裝外觀清潔無破損，包裝上註明「產品名稱」、「製造日期」、「有效期限」，並符合食品法規相關規定。2.
                    入庫之貨品保存期限，應距有有效期1/3以上。3.
                    內容物顏色組織正常，無潰爛。4.
                    原料內容物無異味、雜質及滲出液。5.
                    冷藏：凍結點～7°C，冷凍-12°C以下，常溫不紀錄。6.
                    原料單次進貨僅准收2個批號，並填寫數量及批號編號。7.
                    內包材類請填寫製造日期。8.
                    驗收合格者標記"V"，不合格者標記為"X"。
                  </div>
                </div>
                <div className="w-[24%] border-l border-black pl-2 text-[10px]">
                  <div>單據備註：</div>
                  <div>( 1 ) 11:40-13:00 休息時間不收貨。</div>
                </div>
              </div>
            </div>

            {/* 簽核欄位 */}
            <div className="flex justify-between items-end mt-3 px-4 font-bold text-[12px]">
              <div>
                審 核：
                <span className="w-16 inline-block border-b border-black"></span>
              </div>
              <div>
                會 計：
                <span className="w-16 inline-block border-b border-black"></span>
              </div>
              <div>
                品 保：
                <span className="w-16 inline-block border-b border-black"></span>
              </div>
              <div>
                經 辦：
                <span className="w-20 inline-block text-center border-b border-black leading-none pb-0.5">
                  {data.applicant || "張安彤"}
                </span>
              </div>
            </div>
            <div className="text-right mt-1 pr-4 font-bold text-[10px]">
              表號: C-34
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// 🌟 列印 Template - C-34 (外部採購單)
// ==========================================
const PurchaseOrderPrintTemplate = ({ data, providers, materials }) => {
  if (!data || !data.items || data.items.length === 0) return null;

  const providerGroups = {};
  data.items.forEach((item) => {
    const pId = item.material_provider_id || "unknown";
    if (!providerGroups[pId]) providerGroups[pId] = [];
    providerGroups[pId].push(item);
  });

  return (
    <div className="hidden print:block w-full bg-white text-black font-sans mx-auto">
      <style>{`
        @media print { 
          @page { size: A4 portrait; margin-top: 5mm; margin-bottom: 5mm; margin-left: 10mm; } 
          .page-break { page-break-after: always; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {Object.entries(providerGroups).map(([pId, items], index, arr) => {
        const provider = providers.find((p) => p.id.toString() === pId) || {};

        const deliveryDates = items
          .map((i) => i.expected_delivery_date)
          .filter(Boolean)
          .sort();
        const deliveryDateStr =
          deliveryDates.length > 0 ? deliveryDates[0].replace(/-/g, "/") : "";

        const totalSum = items.reduce((acc, curr) => {
          return (
            acc +
            parseFloat(curr.quantity || 0) *
              parseFloat(curr.purchased_price || 0)
          );
        }, 0);

        const printItems = [...items];
        while (printItems.length < 15) printItems.push({});

        return (
          <div
            key={pId}
            className={`w-full ${index < arr.length - 1 ? "page-break" : ""}`}
          >
            <div className="flex justify-between items-end mb-1 border-b border-black pb-2">
              <div className="w-1/3 text-[11px] leading-tight font-bold">
                桃園市觀音區崙坪里1鄰1-10號
                <br />
                電話: 03-4988228 <span className="ml-4">傳真: 03-4988159</span>
              </div>
              <div className="w-1/3 text-center">
                <h1 className="text-2xl font-black tracking-[0.1em]">
                  基香食品有限公司
                </h1>
                <h2 className="text-xl font-bold tracking-[0.5em] mt-1">
                  廠 商 採 購 單
                </h2>
              </div>
              <div className="w-1/3 text-[11px] text-right font-bold leading-tight">
                版次: 03
                <br />第 1 頁, 共 1 頁
              </div>
            </div>

            <div className="border border-black text-[12px] mb-1 flex flex-col font-bold">
              <div className="flex border-b border-black">
                <div className="w-[35%] border-r border-black p-1 truncate">
                  廠商名稱: {provider.name || "未指定廠商"}
                </div>
                <div className="w-[35%] border-r border-black p-1 truncate">
                  廠商編號: {provider.code || "-"}
                </div>
                <div className="w-[30%] p-1 truncate">
                  單據日期:{" "}
                  {data.request_date
                    ? data.request_date.replace(/-/g, "/")
                    : ""}
                </div>
              </div>
              <div className="flex border-b border-black">
                <div className="w-[35%] border-r border-black p-1 truncate">
                  廠商統編: {provider.tax_id || "-"}
                </div>
                <div className="w-[35%] border-r border-black p-1 truncate">
                  聯 絡 人: {provider.contact_person || "-"}
                </div>
                <div className="w-[30%] p-1 truncate">單據編號: {data.id}</div>
              </div>
              <div className="flex border-b border-black">
                <div className="w-[35%] border-r border-black p-1 truncate">
                  廠商電話: {provider.phone || "-"}
                </div>
                <div className="w-[35%] border-r border-black p-1 truncate">
                  廠商傳真: {provider.fax || "-"}
                </div>
                <div className="w-[30%] p-1 truncate"></div>
              </div>
              <div className="flex">
                <div className="w-[70%] border-r border-black p-1 truncate">
                  送貨地址: 桃園市觀音區崙坪里1鄰1-10號
                </div>
                <div className="w-[30%] p-1 flex justify-between">
                  <span>交貨日期:</span>
                  <span className="font-bold text-sm tracking-wider pr-2">
                    {deliveryDateStr}
                  </span>
                </div>
              </div>
            </div>

            <table className="w-full border-collapse border border-black text-center text-[11px] font-bold">
              <thead>
                <tr className="border-b border-black">
                  <th className="border-r border-black p-1 font-normal w-8">
                    序
                  </th>
                  <th className="border-r border-black p-1 font-normal w-24">
                    貨品編號
                  </th>
                  <th className="border-r border-black p-1 font-normal text-left px-2">
                    品名
                  </th>
                  <th className="border-r border-black p-1 font-normal w-16">
                    數量
                  </th>
                  <th className="border-r border-black p-1 font-normal w-10">
                    單位
                  </th>
                  <th className="border-r border-black p-1 font-normal w-20">
                    單價
                  </th>
                  <th className="border-r border-black p-1 font-normal w-24">
                    小計
                  </th>
                  <th className="p-1 font-normal w-28">附註</th>
                </tr>
              </thead>
              <tbody>
                {printItems.map((item, idx) => {
                  const matchedMaterial = materials.find(
                    (m) => m.id === item.material_id,
                  );
                  const matCode = matchedMaterial ? matchedMaterial.code : "-";

                  return (
                    <tr key={idx} className="border-b border-black h-7">
                      <td className="border-r border-black">
                        {item.material_id ? idx + 1 : ""}
                      </td>
                      <td className="border-r border-black font-mono">
                        {item.material_id ? matCode : ""}
                      </td>
                      <td className="border-r border-black text-left px-2 text-[13px]">
                        {item.material_name || ""}
                      </td>
                      <td className="border-r border-black text-right px-2 font-mono text-[13px]">
                        {item.quantity ? formatDisplayNum(item.quantity) : ""}
                      </td>
                      <td className="border-r border-black">
                        {item.unit || ""}
                      </td>
                      <td className="border-r border-black text-right px-2 font-mono">
                        {item.purchased_price
                          ? formatDisplayNum(item.purchased_price)
                          : ""}
                      </td>
                      <td className="border-r border-black text-right px-2 font-mono text-[13px]">
                        {item.quantity && item.purchased_price
                          ? formatCurrency(item.quantity * item.purchased_price)
                          : ""}
                      </td>
                      <td className="text-left px-1 truncate max-w-[110px] text-[10px]">
                        {item.in_stock_spec || ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-bold h-8 text-[12px]">
                  <td colSpan="4" className="text-left p-1">
                    合計金額：{" "}
                    <span className="float-right pr-4 tracking-wider">
                      {formatCurrency(totalSum)}
                    </span>
                  </td>
                  <td
                    colSpan="2"
                    className="border-l border-black text-left p-1"
                  >
                    營業稅：
                  </td>
                  <td
                    colSpan="2"
                    className="border-l border-black text-left p-1"
                  >
                    總計金額：{" "}
                    <span className="float-right pr-4 tracking-wider text-[13px]">
                      {formatCurrency(totalSum)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="border border-t-0 border-black p-2 text-[11px] leading-relaxed font-bold">
              <div className="mb-1">單據備註：</div>
              <div className="pl-6 space-y-0.5">
                <div>( 1 ) 11:40-13:00 休息時間不收貨。</div>
                <div>
                  ( 2 ) 逐批報告及年度外檢報告以電子檔為主：E-mail:
                  goodsmell@hotmail.com 。
                </div>
                <div>
                  ( 3 )
                  包裝外觀應清潔無破損，完整標示品名及製造有效期限，產品品質及標示應符合食品法規相關規定。
                </div>
                <div>
                  ( 4 )
                  內包材每年請提供符合食品器具容器包裝衛生標準之外部檢驗報告，標示應符合食品安全衛生管理法
                  26 條。
                </div>
              </div>
            </div>

            <div className="flex justify-between items-end mt-4 px-4 font-bold text-[13px]">
              <div>
                審 核：
                <span className="w-20 inline-block border-b border-black"></span>
              </div>
              <div>
                經 辦：
                <span className="w-20 inline-block text-center border-b border-black leading-none pb-0.5">
                  {data.applicant}
                </span>
              </div>
              <div>
                會 計：
                <span className="w-20 inline-block border-b border-black"></span>
              </div>
              <div>
                倉 管：
                <span className="w-20 inline-block border-b border-black"></span>
              </div>
              <div>
                簽 收：
                <span className="w-20 inline-block border-b border-black"></span>
              </div>
            </div>
            <div className="text-right mt-2 pr-4 font-bold text-[11px]">
              表號: C-34
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RequisitionNode = ({
  req,
  isExpanded,
  toggleExpand,
  onEdit,
  onDelete,
  onPrint,
  onOpenBatchModal,
}) => {
  const hasItems = req.items && req.items.length > 0;
  const isStocked = (req.status || "").toUpperCase() === "STOCKED";

  return (
    <div className="mb-4 overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300">
      <div
        className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer group"
        onClick={() => toggleExpand(req.id)}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
          <span
            className={`w-8 h-8 flex items-center justify-center text-slate-400 text-sm flex-shrink-0 bg-slate-50 border border-slate-100 rounded-full transition-transform duration-300 group-hover:bg-slate-100 ${isExpanded ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          <div className="flex-shrink-0">
            <span className="font-mono text-[13px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
              #{req.id}
            </span>
          </div>
          <StatusTag status={req.status} />
          <div className="flex flex-col ml-3 truncate flex-1">
            <span className="font-bold text-slate-900 text-base truncate tracking-tight">
              填單日：{req.request_date}
            </span>
            <span className="text-[13px] text-slate-500 font-medium mt-0.5">
              請購人：{req.applicant}
            </span>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex-shrink-0 flex items-center w-full md:w-auto md:pl-0 justify-between md:justify-end gap-4 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
          <div className="text-slate-500 text-sm font-medium flex items-center gap-2 mr-2">
            <span>品項數量</span>
            <span className="text-lg font-black text-slate-800">
              {req.items?.length || 0}
            </span>
          </div>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onPrint(req, "PR")}
              className="px-3 py-2 text-slate-600 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 transition-colors text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
            >
              <FileText size={14} /> 內部請購單
            </button>
            <button
              onClick={() => onPrint(req, "PO")}
              className="px-3 py-2 text-indigo-600 border border-indigo-200 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
            >
              <Printer size={14} /> 外部採購單
            </button>

            {isStocked && (
              <button
                onClick={() => onPrint(req, "RECEIVING")}
                className="px-3 py-2 text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
              >
                <Printer size={14} /> 列印進貨單
              </button>
            )}

            <button
              onClick={() => onEdit(req)}
              className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors text-xs font-bold shadow-sm ml-2"
            >
              {isStocked ? "檢視內容" : "編輯"}
            </button>
            <button
              onClick={() => onDelete(req.id)}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 transition-colors text-xs font-bold shadow-sm"
            >
              刪除
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-slate-50/50 p-6 border-t border-slate-100">
          {hasItems ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {req.items.map((item, idx) => {
                const batches = item.generated_batches || [];
                const isNotFullyReceived = item.is_fully_received === false;

                return (
                  <div
                    key={item.id || idx}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden transition-shadow hover:shadow-md"
                  >
                    <div className="p-5 border-b border-slate-100 flex justify-between items-start gap-3 bg-white">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-lg leading-tight tracking-tight">
                          {item.material_name}
                        </span>
                        {/* 🌟 提醒標籤：該請購品項尚未收貨完畢 */}
                        {isNotFullyReceived && (
                          <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-lg text-xs font-bold shadow-2xs w-fit">
                            <AlertCircle
                              size={14}
                              className="text-amber-600 shrink-0"
                            />
                            <span>尚未收貨完畢</span>
                          </div>
                        )}
                      </div>

                      {/* 🌟 快速建立收貨批號按鈕 */}
                      <button
                        type="button"
                        onClick={() => onOpenBatchModal(item, req)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all inline-flex items-center gap-1 shrink-0"
                      >
                        <PackagePlus size={14} /> 登錄收貨批號
                      </button>
                    </div>

                    <div className="p-5 flex-1 flex flex-col gap-4 bg-white">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                              預計採購
                            </span>
                            <span className="text-sm font-semibold text-slate-700">
                              {formatDisplayNum(item.package_qty)}{" "}
                              {item.aux_unit}{" "}
                              {item.in_stock_spec
                                ? `(${item.in_stock_spec})`
                                : ""}
                            </span>
                          </div>
                          <span className="font-mono text-sm font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            {formatDisplayNum(item.quantity)} {item.unit}
                          </span>
                        </div>

                        {/* 分批入庫批號列表 */}
                        {batches.length > 0 && (
                          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/70 rounded-xl shadow-2xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md">
                                分批入庫紀錄 (已收:{" "}
                                {formatDisplayNum(item.total_received_qty)} /{" "}
                                {formatDisplayNum(item.quantity)} {item.unit})
                              </span>
                              {item.is_fully_received && (
                                <span className="text-[10px] font-bold text-white bg-emerald-600 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <CheckCircle2 size={12} /> 已全數交貨
                                </span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {batches.map((b, bIdx) => (
                                <div
                                  key={bIdx}
                                  className="flex justify-between items-center text-xs font-mono bg-white px-2 py-1 rounded border border-emerald-100"
                                >
                                  <span className="font-bold text-slate-800">
                                    批號: {b.batch_number}
                                  </span>
                                  <span className="text-slate-600">
                                    數量: {formatDisplayNum(b.original_qty)}{" "}
                                    {item.unit} ({b.received_date})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex text-[15px] mt-1">
                        <span className="text-slate-400 font-bold w-16 shrink-0">
                          供應商
                        </span>
                        <span className="text-slate-800 font-medium truncate">
                          {item.provider_name || "-"}
                        </span>
                      </div>
                      <div className="flex text-[15px]">
                        <span className="text-slate-400 font-bold w-16 shrink-0">
                          備註
                        </span>
                        <span className="text-slate-600 italic line-clamp-2 leading-relaxed">
                          {item.remark || "-"}
                        </span>
                      </div>
                      {item.expected_delivery_date && (
                        <div className="flex text-sm mt-1">
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 shadow-2xs">
                            預計 {item.expected_delivery_date} 到貨
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-50/80 p-5 border-t border-slate-100 flex justify-between items-center mt-auto">
                      <div className="text-sm text-slate-500 font-mono flex items-center">
                        <span className="font-bold text-slate-800 text-lg">
                          {formatDisplayNum(item.quantity)}
                        </span>
                        <span className="ml-1 mr-2 text-sm text-slate-500 font-bold">
                          {item.unit}
                        </span>
                        <span className="text-slate-300 mx-1">×</span>
                        <span className="font-bold text-[15px]">
                          ${formatDisplayNum(item.purchased_price)}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-slate-400 font-bold">
                          小計
                        </span>
                        <span className="font-black text-2xl text-blue-700 tracking-tight">
                          $
                          {formatCurrency(
                            (parseFloat(item.quantity) || 0) *
                              (parseFloat(item.purchased_price) || 0),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-slate-400 py-8 text-center bg-white rounded-xl border border-dashed border-slate-200 font-medium">
              此單據目前無任何請購品項。
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function PurchaseRequisitionPage() {
  const me = useAuthStore((state) => state.me());
  const [requisitions, setRequisitions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [materialProviders, setMaterialProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchMaterial, setSearchMaterial] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState([]);

  const [printConfig, setPrintConfig] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequisition, setEditingRequisition] = useState(null);
  const [formData, setFormData] = useState({
    request_date: "",
    applicant: "",
    status: "WAITING",
    items: [],
    invoices_payload: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🌟 分批收貨建立批號 Modal 狀態
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchModalItem, setBatchModalItem] = useState(null);
  const [batchModalData, setBatchModalData] = useState({
    batch_number: "",
    original_qty: "",
    received_date: new Date().toISOString().split("T")[0],
    expiration_date: new Date().toISOString().split("T")[0],
    note: "",
  });

  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
    onConfirm: null,
  });

  const isReadOnly = editingRequisition?.status === "STOCKED";
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

  useEffect(() => {
    Promise.all([
      fetchRequisitions(),
      fetchMaterials(),
      fetchMaterialProviders(),
    ]);
  }, []);

  useEffect(() => {
    if (me?.full_name && !editingRequisition)
      setFormData((prev) => ({ ...prev, applicant: me.full_name }));
  }, [me, editingRequisition]);

  const fetchRequisitions = async () => {
    setLoading(true);
    try {
      let url = "/api/purchase_requisitions";
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error("無法載入請購單資料");
      const json = await res.json();
      setRequisitions(json.data || json);
      setCurrentPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await fetchWithAuth("/api/materials");
      if (response.ok) setMaterials((await response.json()).data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMaterialProviders = async () => {
    try {
      const response = await fetchWithAuth("/api/material_providers");
      if (response.ok) setMaterialProviders((await response.json()).data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const filteredRequisitions = useMemo(() => {
    const list = Array.isArray(requisitions) ? requisitions : [];
    return list.filter((req) => {
      if (filterStatus !== "ALL" && req.status !== filterStatus) return false;
      if (searchMaterial) {
        const term = searchMaterial.toLowerCase();
        const hasMatchingItem = req.items.some(
          (item) =>
            item.material_name &&
            item.material_name.toLowerCase().includes(term),
        );
        if (!hasMatchingItem) return false;
      }
      return true;
    });
  }, [requisitions, searchMaterial, filterStatus]);

  const totalPages =
    Math.ceil(filteredRequisitions.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequisitions = useMemo(() => {
    return filteredRequisitions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRequisitions, startIndex]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchMaterial, filterStatus]);

  const toggleRowExpand = (id) =>
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id],
    );

  const handlePrint = (req, type = "PR") => {
    setPrintConfig({ type, data: req });
    setTimeout(() => {
      const originalTitle = document.title;
      const typeStr =
        type === "PR" ? "請購單" : type === "PO" ? "採購單" : "進貨單";
      document.title = `${req.request_date}_${typeStr}_請購人_${req.applicant}`;
      window.print();
      document.title = originalTitle;
      setPrintConfig(null);
    }, 150);
  };

  const handleDelete = (id) => {
    showConfirm(
      "刪除確認",
      `確定要刪除請購單嗎？\n刪除後該單無法恢復。`,
      async () => {
        closeDialog();
        try {
          const res = await fetchWithAuth(`/api/purchase_requisitions/${id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("刪除失敗");
          setRequisitions((prev) => prev.filter((r) => r.id !== id));
          showAlert("刪除成功", `已成功刪除請購單 #${id}。`, "success");
        } catch (err) {
          showAlert("刪除失敗", err.message, "error");
        }
      },
    );
  };

  const openModal = (requisition = null) => {
    if (requisition) {
      setEditingRequisition(requisition);
      setFormData({
        request_date: requisition.request_date || "",
        applicant: requisition.applicant || "",
        status: (requisition.status || "WAITING").toUpperCase(),
        items: JSON.parse(JSON.stringify(requisition.items)),
        invoices_payload: requisition.invoices
          ? JSON.parse(JSON.stringify(requisition.invoices))
          : [],
      });
    } else {
      const today = new Date().toISOString().split("T")[0];
      setEditingRequisition(null);
      setFormData({
        request_date: today,
        applicant: me?.full_name || "",
        status: "WAITING",
        items: [],
        invoices_payload: [],
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRequisition(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.applicant || !formData.request_date)
      return showAlert("資料不完整", "請填寫申請人與填單日期", "warning");
    if (formData.items.length === 0)
      return showAlert("資料不完整", "請至少新增一筆請購明細", "warning");
    setIsSubmitting(true);
    const payload = {
      ...formData,
      status: formData.status.toLowerCase(),
      items: formData.items.map((item) => ({
        ...item,
        expected_delivery_date: item.expected_delivery_date || null,
      })),
      invoices_payload: formData.invoices_payload || [],
    };
    const url = editingRequisition
      ? `/api/purchase_requisitions/${editingRequisition.id}`
      : "/api/purchase_requisitions";
    try {
      const res = await fetchWithAuth(url, {
        method: editingRequisition ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("儲存失敗");
      showAlert(
        "儲存成功",
        `已成功${editingRequisition ? "更新" : "新增"}請購單。`,
        "success",
      );
      closeModal();
    } catch (err) {
      showAlert("發生錯誤", err.message, "error");
    } finally {
      setIsSubmitting(false);
      await fetchRequisitions();
    }
  };

  // 🌟 開啟分批收貨建立批號 Modal
  const handleOpenBatchModal = (item) => {
    setBatchModalItem(item);
    const remainingNeeded = Math.max(
      0,
      parseFloat(item.quantity || 0) - parseFloat(item.total_received_qty || 0),
    );
    setBatchModalData({
      batch_number: "",
      original_qty: remainingNeeded > 0 ? remainingNeeded.toString() : "",
      received_date: new Date().toISOString().split("T")[0],
      expiration_date: new Date().toISOString().split("T")[0],
      note: "",
    });
    setIsBatchModalOpen(true);
  };

  // 🌟 提交分批收貨建立批號
  const handleBatchModalSubmit = async (e) => {
    e.preventDefault();
    if (!batchModalData.batch_number || !batchModalData.original_qty) {
      return showAlert("提示", "請填寫完整批號與數量", "warning");
    }

    setIsSubmitting(true);
    try {
      const payload = {
        material: batchModalItem.material_id,
        source_pr_item: batchModalItem.id,
        batch_number: batchModalData.batch_number,
        original_qty: batchModalData.original_qty,
        remaining_qty: batchModalData.original_qty,
        received_date: batchModalData.received_date,
        expiration_date: batchModalData.expiration_date,
        note: batchModalData.note,
      };

      const res = await fetchWithAuth("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "建立收貨批號失敗");
      }

      await fetchRequisitions();
      setIsBatchModalOpen(false);
      showAlert(
        "成功",
        `已成功登錄收貨批號: ${batchModalData.batch_number}`,
        "success",
      );
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMasterChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          material_name: null,
          material_id: null,
          material_provider_id: null,
          provider_name: null,
          in_stock_spec: "",
          package_qty: "",
          aux_unit: "",
          aux_quantity: "",
          quantity: "",
          unit: "KG",
          purchased_price: "",
          expected_delivery_date: null,
          remark: "",
          suggestions: null,
        },
      ],
    }));
  };

  const handleRemoveItem = (index) =>
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));

  const fetchPriceSuggestions = async (index, material_id, provider_id) => {
    if (!material_id || !provider_id) return;
    try {
      const res = await fetchWithAuth(
        `/api/purchase_requisitions/prev_purchase_price?material_id=${material_id}&provider_id=${provider_id}`,
      );
      if (res.ok) {
        const json = await res.json();
        const suggestionData = json.data || json;
        setFormData((prev) => {
          const newItems = [...prev.items];
          newItems[index].suggestions = suggestionData;
          if (suggestionData.from_provider?.current_stock !== undefined) {
            newItems[index].current_stock =
              suggestionData.from_provider.current_stock;
          } else if (
            suggestionData.from_historical_pr?.current_stock !== undefined
          ) {
            newItems[index].current_stock =
              suggestionData.from_historical_pr.current_stock;
          }
          return { ...prev, items: newItems };
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const applySuggestion = (index, suggestionData) => {
    if (!suggestionData) return;
    setFormData((prev) => {
      const newItems = [...prev.items];
      const item = newItems[index];
      item.purchased_price =
        suggestionData.latest_price !== null
          ? formatDisplayNum(suggestionData.latest_price)
          : "";
      item.in_stock_spec = suggestionData.latest_spec ?? "";
      item.aux_quantity =
        suggestionData.latest_aux_quantity !== null
          ? formatDisplayNum(suggestionData.latest_aux_quantity)
          : "";
      item.aux_unit = suggestionData.latest_aux_unit ?? "";
      return { ...prev, items: newItems };
    });
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      const item = { ...newItems[index], [field]: value };
      if (field === "in_stock_spec" && value) {
        const parsed = parseSpecString(value, item.unit || "KG");
        if (parsed) {
          item.aux_quantity = parsed.auxQuantity;
          item.aux_unit = parsed.auxUnit;
        }
      }
      if (["package_qty", "aux_quantity", "in_stock_spec"].includes(field)) {
        const pq = parseFloat(item.package_qty) || 0;
        const aq = parseFloat(item.aux_quantity) || 0;
        if (pq > 0 && aq > 0) {
          item.quantity = formatDisplayNum(pq * aq);
        } else {
          item.quantity = "";
        }
      }
      newItems[index] = item;
      return { ...prev, items: newItems };
    });
  };

  if (loading && requisitions.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="text-lg font-bold text-slate-400 animate-pulse">
          載入請購單資料中...
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
              請購單管理
            </h2>
            <p className="text-slate-500 mt-2 font-semibold">
              高效管理廠內食材與包材進貨流程，支援分批收貨、獨立批號與彈性發票登打
            </p>
          </div>
        </div>

        <div className="bg-blue-50/80 text-blue-800 text-sm p-4 rounded-2xl mb-6 border border-blue-100/50 shadow-sm">
          <p className="flex items-center gap-2 font-bold mb-2">
            <span className="text-lg leading-none">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
            <li>
              支援<strong>分批送貨與多次入庫批號建立</strong>
              ，可隨時追蹤各明細累計交貨進度。
            </li>
            <li>
              彈性登打<strong>多張進貨發票資訊</strong>
              （支援期號如115年09-10月與備註細節）。
            </li>
            <li>
              當請購單完成入庫（狀態變為已入庫）後，可直接一鍵列印 A4 橫向
              <strong>進貨單</strong>。
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
          <div className="flex flex-col md:flex-row justify-between items-center gap-5">
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
              <div className="relative w-full sm:w-72">
                <Search
                  size={18}
                  className="absolute left-4 top-3 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="搜尋原物料名稱..."
                  value={searchMaterial}
                  onChange={(e) => setSearchMaterial(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-200 font-medium placeholder-slate-400"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-200 font-bold text-slate-700"
              >
                <option value="ALL">全部狀態</option>
                <option value="WAITING">等待進貨</option>
                <option value="STOCKED">已經入庫</option>
              </select>
              {(searchMaterial || filterStatus !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchMaterial("");
                    setFilterStatus("ALL");
                  }}
                  className="text-sm text-slate-400 hover:text-red-500 font-bold transition-colors ml-2"
                >
                  清除
                </button>
              )}
            </div>
            <button
              onClick={() => openModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all duration-200 text-sm font-bold w-full md:w-auto hover:shadow-[0_6px_16px_rgba(37,99,235,0.3)] hover:-translate-y-0.5"
            >
              + 新增請購單
            </button>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-8 rounded-3xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col justify-between">
          <div>
            {paginatedRequisitions.length > 0 ? (
              <div>
                {paginatedRequisitions.map((req) => (
                  <RequisitionNode
                    key={req.id}
                    req={req}
                    isExpanded={expandedRows.includes(req.id)}
                    toggleExpand={toggleRowExpand}
                    onEdit={openModal}
                    onDelete={handleDelete}
                    onPrint={handlePrint}
                    onOpenBatchModal={handleOpenBatchModal}
                  />
                ))}
              </div>
            ) : (
              <div className="py-24 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-5 border border-slate-100">
                  <Search size={32} />
                </div>
                <span className="text-slate-400 font-bold text-lg">
                  找不到符合條件的請購單資料
                </span>
              </div>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-6 px-4">
              <div className="text-sm text-slate-500 font-bold">
                顯示第 {startIndex + 1} 到{" "}
                {Math.min(
                  currentPage * ITEMS_PER_PAGE,
                  filteredRequisitions.length,
                )}{" "}
                筆， 共 {filteredRequisitions.length} 筆
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

        {/* 🌟 登錄收貨批號 Modal */}
        {isBatchModalOpen && batchModalItem && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-extrabold text-slate-800">
                  登錄收貨批號 ({batchModalItem.material_name})
                </h3>
                <button
                  onClick={() => setIsBatchModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xl"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={handleBatchModalSubmit}
                className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">
                    批號代碼 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={batchModalData.batch_number}
                    onChange={(e) =>
                      setBatchModalData((prev) => ({
                        ...prev,
                        batch_number: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-mono font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                    placeholder="請輸入本次到貨批號..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">
                    本次收貨數量 ({batchModalItem.unit}){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={batchModalData.original_qty}
                    onChange={(e) =>
                      setBatchModalData((prev) => ({
                        ...prev,
                        original_qty: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-mono font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-right"
                  />
                  <div className="text-[11px] text-slate-400 mt-1 ml-1">
                    採購總量: {formatDisplayNum(batchModalItem.quantity)} |
                    已收總量:{" "}
                    {formatDisplayNum(batchModalItem.total_received_qty)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">
                      入庫日期
                    </label>
                    <input
                      type="date"
                      value={batchModalData.received_date}
                      onChange={(e) =>
                        setBatchModalData((prev) => ({
                          ...prev,
                          received_date: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">
                      有效期限
                    </label>
                    <input
                      type="date"
                      value={batchModalData.expiration_date}
                      onChange={(e) =>
                        setBatchModalData((prev) => ({
                          ...prev,
                          expiration_date: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">
                    收貨備註
                  </label>
                  <textarea
                    rows={2}
                    value={batchModalData.note}
                    onChange={(e) =>
                      setBatchModalData((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium resize-none"
                    placeholder="分批收貨備註說明..."
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3 shrink-0 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsBatchModalOpen(false)}
                    className="px-6 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-md transition-all text-sm disabled:opacity-50"
                  >
                    {isSubmitting ? "建立中..." : "確認建立批號"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-opacity duration-300">
            <div className="bg-white rounded-[2rem] w-full max-w-[1200px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {editingRequisition
                    ? isReadOnly
                      ? `檢視請購單 #${editingRequisition.id}`
                      : `編輯請購單 #${editingRequisition.id}`
                    : "新增請購單"}
                </h3>
                <button
                  onClick={closeModal}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors font-bold text-xl"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col overflow-hidden flex-1 bg-slate-50/50"
              >
                <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
                  {isReadOnly && (
                    <div className="mb-6 p-4 bg-emerald-50/80 text-emerald-800 border border-emerald-200/60 rounded-2xl text-[15px] font-bold flex items-center gap-3 shadow-sm">
                      <span className="text-xl bg-white rounded-full p-1 shadow-sm">
                        ✅
                      </span>
                      此單據已入庫。若需分批收貨，可直接於外部明細展開處點擊「登錄收貨批號」。
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                        填單日期
                      </label>
                      <input
                        type="date"
                        name="request_date"
                        required
                        value={formData.request_date}
                        onChange={handleMasterChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                        請購人
                      </label>
                      <input
                        type="text"
                        name="applicant"
                        readOnly
                        value={formData.applicant}
                        className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-[15px] text-slate-700 font-bold cursor-not-allowed outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                        單據狀態 (當全數收貨完畢後手動更改為已入庫)
                      </label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleMasterChange}
                        className={`w-full px-4 py-3 border rounded-xl text-[15px] outline-none transition-all font-bold ${formData.status === "STOCKED" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"}`}
                      >
                        <option value="WAITING">等待進貨 (未完成)</option>
                        <option value="STOCKED">已經入庫 (已完成)</option>
                      </select>
                    </div>
                  </div>

                  {/* 🌟 彈性登打進貨發票資訊區塊（發票號碼、期號、textarea細節） */}
                  <div className="mb-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                      <h4 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        進貨發票資訊
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            invoices_payload: [
                              ...(prev.invoices_payload || []),
                              {
                                invoice_number: "",
                                period: "",
                                note: "",
                                invoice_date: new Date()
                                  .toISOString()
                                  .split("T")[0],
                              },
                            ],
                          }));
                        }}
                        className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 font-bold transition-all shadow-sm"
                      >
                        + 新增發票
                      </button>
                    </div>

                    <div className="space-y-4">
                      {(formData.invoices_payload || []).map((inv, invIdx) => (
                        <div
                          key={invIdx}
                          className="bg-slate-50 border border-slate-200 p-5 rounded-2xl relative"
                        >
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">
                              發票 #{invIdx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  invoices_payload:
                                    prev.invoices_payload.filter(
                                      (_, i) => i !== invIdx,
                                    ),
                                }));
                              }}
                              className="text-red-500 hover:text-red-700 text-xs font-bold"
                            >
                              移除
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">
                                發票號碼
                              </label>
                              <input
                                type="text"
                                value={inv.invoice_number || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormData((prev) => {
                                    const newInv = [...prev.invoices_payload];
                                    newInv[invIdx].invoice_number = val;
                                    return {
                                      ...prev,
                                      invoices_payload: newInv,
                                    };
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">
                                期號
                              </label>
                              <input
                                type="text"
                                value={inv.period || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormData((prev) => {
                                    const newInv = [...prev.invoices_payload];
                                    newInv[invIdx].period = val;
                                    return {
                                      ...prev,
                                      invoices_payload: newInv,
                                    };
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                                placeholder="例如: 115年09-10月"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">
                                發票日期
                              </label>
                              <input
                                type="date"
                                value={inv.invoice_date || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormData((prev) => {
                                    const newInv = [...prev.invoices_payload];
                                    newInv[invIdx].invoice_date = val;
                                    return {
                                      ...prev,
                                      invoices_payload: newInv,
                                    };
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                              發票細節 / 備註
                            </label>
                            <textarea
                              rows={2}
                              value={inv.note || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData((prev) => {
                                  const newInv = [...prev.invoices_payload];
                                  newInv[invIdx].note = val;
                                  return { ...prev, invoices_payload: newInv };
                                });
                              }}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium resize-none"
                              placeholder="輸入發票品名、金額、明細或其他需要記錄的細節..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-5 pl-2">
                    <h4 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                      請購明細{" "}
                      <span className="bg-slate-200 text-slate-700 text-[13px] py-1 px-3 rounded-full">
                        {formData.items.length}
                      </span>
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-sm bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 font-bold shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-all hover:shadow-[0_6px_16px_rgba(37,99,235,0.3)] hover:-translate-y-0.5"
                    >
                      + 加入品項
                    </button>
                  </div>

                  <div className="space-y-6">
                    {formData.items.length === 0 ? (
                      <div className="p-16 text-center border-2 border-dashed border-slate-300 rounded-3xl text-slate-400 bg-white/50 font-bold text-lg">
                        請點擊右上方按鈕加入請購品項
                      </div>
                    ) : (
                      formData.items.map((item, index) => {
                        const isWeight = ["KG", "K", "G", "L", "ML"].includes(
                          (item.unit || "KG").toUpperCase(),
                        );
                        const auxLabel = isWeight ? "單件基本重" : "單件基本數";
                        const totalLabel = isWeight
                          ? "總基本重量"
                          : "總基本數量";

                        return (
                          <div
                            key={index}
                            className="bg-white border rounded-[2rem] p-7 shadow-sm relative transition-all duration-300 group border-slate-200 hover:border-blue-300 hover:shadow-md"
                          >
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                              <h5 className="font-extrabold text-slate-800 flex items-center gap-3 text-lg tracking-tight">
                                <span className="bg-slate-100 text-slate-500 w-9 h-9 flex items-center justify-center rounded-full text-[15px] border border-slate-200">
                                  {index + 1}
                                </span>
                                品項內容
                              </h5>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 px-3 py-2 rounded-xl transition-colors flex items-center gap-2 text-[13px] font-bold opacity-60 group-hover:opacity-100 border border-transparent hover:border-red-100"
                              >
                                <Trash2 size={16} /> 移除
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              <div className="lg:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                  供應商 <span className="text-red-500">*</span>
                                </label>
                                <SearchableDropdown
                                  value={item.material_provider_id}
                                  options={materialProviders}
                                  onChange={(opt) => {
                                    handleItemChange(
                                      index,
                                      "material_provider_id",
                                      opt.id,
                                    );
                                    handleItemChange(
                                      index,
                                      "provider_name",
                                      opt.name,
                                    );
                                    fetchPriceSuggestions(
                                      index,
                                      item.material_id,
                                      opt.id,
                                    );
                                  }}
                                  placeholder="選擇供應商..."
                                />
                              </div>

                              <div className="lg:col-span-2 relative">
                                <label className="flex justify-between items-end text-xs font-bold text-slate-500 mb-2 ml-1">
                                  <span className="mb-1">
                                    原物料名稱{" "}
                                    <span className="text-red-500">*</span>
                                  </span>
                                  {item.current_stock !== undefined && (
                                    <div className="inline-flex items-center gap-1.5 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg shadow-sm">
                                      <span className="text-emerald-800 font-black text-[11px] tracking-wider">
                                        廠內庫存:{" "}
                                        <span className="font-mono text-[13px]">
                                          {formatDisplayNum(item.current_stock)}
                                        </span>{" "}
                                        {item.unit}
                                      </span>
                                    </div>
                                  )}
                                </label>
                                <SearchableDropdown
                                  value={item.material_id}
                                  options={materials}
                                  onChange={(m) => {
                                    handleItemChange(
                                      index,
                                      "material_id",
                                      m.id,
                                    );
                                    handleItemChange(
                                      index,
                                      "material_name",
                                      m.name,
                                    );
                                    handleItemChange(
                                      index,
                                      "unit",
                                      m.unit || "KG",
                                    );
                                    fetchPriceSuggestions(
                                      index,
                                      m.id,
                                      item.material_provider_id,
                                    );
                                  }}
                                  placeholder="選擇物料..."
                                />
                              </div>

                              <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-5 bg-slate-50/70 p-5 rounded-3xl border border-slate-100">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                    下單規格 (可修改)
                                  </label>
                                  <input
                                    type="text"
                                    value={item.in_stock_spec}
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "in_stock_spec",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] font-bold outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                    採購件數{" "}
                                    <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.package_qty}
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "package_qty",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] font-mono font-bold outline-none"
                                  />
                                </div>
                                <div className="flex gap-3">
                                  <div className="w-1/2">
                                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                      輔助單位
                                    </label>
                                    <input
                                      type="text"
                                      value={item.aux_unit}
                                      onChange={(e) =>
                                        handleItemChange(
                                          index,
                                          "aux_unit",
                                          e.target.value,
                                        )
                                      }
                                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] font-bold outline-none"
                                    />
                                  </div>
                                  <div className="w-1/2">
                                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1 truncate">
                                      {auxLabel}
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.aux_quantity}
                                      onChange={(e) =>
                                        handleItemChange(
                                          index,
                                          "aux_quantity",
                                          e.target.value,
                                        )
                                      }
                                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] font-mono font-bold outline-none"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <div className="flex-1 relative">
                                    <label className="block text-xs font-extrabold text-blue-700 mb-2 ml-1 truncate">
                                      {totalLabel}{" "}
                                      {item.unit ? `(${item.unit})` : ""}{" "}
                                      <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                      type="number"
                                      required
                                      step="0.01"
                                      value={item.quantity}
                                      onChange={(e) =>
                                        handleItemChange(
                                          index,
                                          "quantity",
                                          e.target.value,
                                        )
                                      }
                                      className="w-full px-4 py-3 border rounded-xl text-[15px] outline-none font-mono font-black transition-all border-blue-200 bg-blue-50 text-blue-900"
                                      placeholder="自動計算..."
                                    />
                                  </div>
                                  <div className="w-20">
                                    <label className="block text-xs font-bold text-slate-500 mb-2 ml-1 text-center">
                                      單位
                                    </label>
                                    <input
                                      type="text"
                                      readOnly
                                      value={item.unit}
                                      className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-[15px] font-black text-slate-600 text-center shadow-sm"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                  基本單價 (每 {item.unit || "件"}){" "}
                                  <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                  <span className="absolute left-4 top-3 text-slate-400 font-bold">
                                    $
                                  </span>
                                  <input
                                    type="text"
                                    value={item.purchased_price ?? ""}
                                    placeholder="無前次紀錄"
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "purchased_price",
                                        e.target.value,
                                      )
                                    }
                                    onBlur={(e) => {
                                      const val = parseFloat(e.target.value);
                                      if (!isNaN(val)) {
                                        handleItemChange(
                                          index,
                                          "purchased_price",
                                          val.toFixed(2),
                                        );
                                      } else if (e.target.value !== "") {
                                        handleItemChange(
                                          index,
                                          "purchased_price",
                                          "",
                                        );
                                      }
                                    }}
                                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-mono font-bold outline-none"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                  指定到貨日
                                </label>
                                <input
                                  type="date"
                                  value={item.expected_delivery_date || ""}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "expected_delivery_date",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-bold outline-none"
                                />
                              </div>

                              <div className="lg:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
                                  備註說明
                                </label>
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
                                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-bold outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="p-6 md:px-10 md:py-6 border-t border-slate-100 bg-white/90 backdrop-blur-md flex justify-end gap-4 z-10 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)]">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-8 py-3.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all text-[15px] font-bold shadow-sm"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-10 py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-[0_4px_12px_rgba(37,99,235,0.2)] text-[15px] font-bold disabled:opacity-50 transition-all"
                  >
                    {isSubmitting ? "處理中..." : "確認儲存"}
                  </button>
                </div>
              </form>
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

      {printConfig?.type === "PR" && (
        <PurchaseRequisitionPrintTemplate data={printConfig.data} />
      )}
      {printConfig?.type === "PO" && (
        <PurchaseOrderPrintTemplate
          data={printConfig.data}
          providers={materialProviders}
          materials={materials}
        />
      )}
      {printConfig?.type === "RECEIVING" && (
        <PurchaseStockedReceivingPrintTemplate
          data={printConfig.data}
          providers={materialProviders}
          materials={materials}
        />
      )}
    </>
  );
}
