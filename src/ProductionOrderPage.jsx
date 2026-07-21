import React, { useState, useEffect, useMemo } from "react";
import CustomDialog from "./components/CustomDialog";
import { ChevronDown, ChevronRight, Printer } from "lucide-react";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useNavigate } from "react-router-dom";

const formatNum = (num, type) => {
  if (num === null || num === undefined || isNaN(num) || num === "") return "0";
  if (type === "PACK") return Math.ceil(num).toString();
  return parseFloat(Number(num).toFixed(4)).toString();
};

const StatusTag = ({ status }) => {
  const config = {
    DRAFT: {
      label: "草稿",
      css: "bg-slate-100 text-slate-600 border-slate-200",
    },
    IN_PROGRESS: {
      label: "生產中",
      css: "bg-blue-100 text-blue-700 border-blue-200",
    },
    DONE: {
      label: "已完成",
      css: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    CANCELLED: {
      label: "已作廢",
      css: "bg-red-100 text-red-700 border-red-200",
    },
  };
  const statusData = config[status] || {
    label: status,
    css: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-bold border uppercase tracking-wider ${statusData.css}`}
    >
      {statusData.label}
    </span>
  );
};

// ==========================================
// 核心邏輯：將後端嵌套的批號資料，動態攤平為一列列的實體單據格式
// ==========================================
const getFlattenedMaterials = (materials_info) => {
  const result = [];
  if (!Array.isArray(materials_info)) return result;

  materials_info.forEach((mat) => {
    const materialCode = mat.code || "-";

    if (mat.type === "CHILD_PRODUCT") {
      result.push({
        isChild: true,
        code: materialCode,
        materialName: mat.materialName,
        child_order_number: mat.child_order_number,
        requiredQty: mat.requiredQty,
        allocatedQty: mat.requiredQty,
        batch_number: "-",
        unit: mat.unit || "",
      });
      return;
    }

    const batches = mat.batches || [];
    const usedBatches = batches.filter((b) => {
      const usedVal = parseFloat(b.used);
      return !isNaN(usedVal) && usedVal > 0;
    });

    if (usedBatches.length > 0) {
      usedBatches.forEach((b) => {
        result.push({
          isChild: false,
          code: materialCode,
          materialName: mat.materialName,
          requiredQty: mat.requiredQty,
          allocatedQty: parseFloat(b.used),
          batch_number: b.batch_number,
          unit: mat.unit || "kg",
        });
      });
    } else {
      result.push({
        isChild: false,
        code: materialCode,
        materialName: mat.materialName,
        requiredQty: mat.requiredQty,
        allocatedQty: 0,
        batch_number: "缺料",
        unit: mat.unit || "kg",
      });
    }
  });

  return result;
};

// ==========================================
// 實體單據渲染元件
// ==========================================
const ProductionFormTemplate = ({ order, isChildForm = false, onPrint }) => {
  if (!order) return null;

  const orderDateStr = new Date(order.created_at).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const flattenedMaterials = getFlattenedMaterials(order.materials_info);

  let vInfo = {};
  try {
    vInfo =
      typeof order.vendor_info === "string"
        ? JSON.parse(order.vendor_info)
        : order.vendor_info || {};
  } catch (e) {
    vInfo = {};
  }

  const rawShippingDate = vInfo.shipping_date
    ? vInfo.shipping_date.replace(/-/g, "/")
    : "";
  const displayShippingDate = `${rawShippingDate} ${vInfo.notes || ""}`.trim();
  const customerName = vInfo.name || "廠內備庫";

  return (
    <div
      className={`bg-white font-sans text-black relative ${isChildForm ? "p-1" : "p-4 print:p-0"}`}
    >
      {/* Header 表頭區塊 */}
      <div className="flex justify-between items-start mb-2 text-[14px] pt-1">
        <div className="w-1/3 text-[12px] leading-tight">
          <div>
            第 1 頁,共 1 頁 製表日期 :{" "}
            <span className="font-mono">{orderDateStr}</span>
          </div>
          <div className="mt-1">
            單據日期 : <span className="font-mono">{orderDateStr}</span>
          </div>
          <div className="mt-1">
            產品編號 :{" "}
            <span className="font-mono">{order.product_code || "-"}</span>
          </div>
          <div className="mt-1 text-[14px] font-bold whitespace-nowrap">
            產品名稱 : {order.product_name}
          </div>
          <div className="mt-1">產品規格 : -</div>
          <div className="mt-1 italic underline">生產注意 : </div>
        </div>

        <div className="w-1/3 text-center">
          <h1 className="text-2xl font-black tracking-widest">
            基香食品有限公司
          </h1>
          <h2 className="text-xl font-bold tracking-widest mt-1 border-b-2 border-black inline-block pb-1 px-4">
            生產流程單
          </h2>
          <div className="mt-2 text-[14px] text-left pl-8">
            單據編號 :{" "}
            <span className="font-mono font-bold text-base">
              {order.order_number}
            </span>
          </div>
          <div className="mt-1 text-[14px] text-left pl-8 flex items-baseline gap-2">
            <span>製令數量 : </span>
            <span className="font-mono font-bold text-xl">
              {formatNum(order.target_qty, "PRODUCT")}
            </span>
            <span>{order.product_unit || "KG"}</span>
          </div>
        </div>

        <div className="w-1/3 flex flex-col items-end text-[12px] leading-relaxed">
          <div className="text-right w-full">版次: 04 (內)</div>
          <div className="mt-2 w-full flex flex-col gap-2 text-left">
            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">交貨日期:</span>
              <span className="flex-1 border-b border-black text-left font-mono font-bold text-blue-700">
                {displayShippingDate}
              </span>
            </div>
            <div className="flex items-baseline gap-2 text-[14px] font-bold">
              <span className="whitespace-nowrap">訂單客戶:</span>
              <span className="flex-1 border-b border-black text-left">
                {customerName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 核心表格區塊 */}
      <table className="w-full text-[12px] border-collapse border-2 border-black mb-2">
        <thead>
          <tr className="border-b-2 border-black bg-gray-50/50">
            <th className="border border-black py-0.5 px-1 w-8 text-center">
              序
            </th>
            <th className="border border-black py-0.5 px-1 w-20 text-center">
              原料編號
            </th>
            <th className="border border-black py-0.5 px-2 text-left">
              原料名稱
            </th>
            <th className="border border-black py-0.5 px-1 w-16 text-center">
              投入包數
            </th>
            <th className="border border-black py-0.5 px-1 w-16 text-center">
              空袋數量
            </th>
            <th className="border border-black py-0.5 px-1 w-24 text-center">
              配方用量(kg)
            </th>
            <th className="border border-black py-0.5 px-1 w-10 text-center">
              生產
            </th>
            <th className="border border-black py-0.5 px-1 w-10 text-center">
              領料
            </th>
            <th className="border border-black py-0.5 px-2 w-36 text-center">
              原料批號
            </th>
          </tr>
        </thead>
        <tbody>
          {flattenedMaterials.length > 0 ? (
            flattenedMaterials.map((mat, i) => (
              <tr
                key={i}
                className={`border-b border-black h-7 hover:bg-slate-50 transition-colors ${mat.isChild ? "bg-indigo-50/30" : ""}`}
              >
                <td className="border border-black text-center">{i + 1}</td>
                <td className="border border-black text-center text-[10px] text-gray-700 font-mono tracking-tighter">
                  {mat.code}
                </td>
                <td className="border border-black text-left px-2">
                  <span
                    className={`truncate max-w-[200px] ${mat.isChild ? "font-bold text-indigo-700" : ""}`}
                  >
                    {mat.materialName}
                  </span>
                </td>
                <td className="border border-black"></td>
                <td className="border border-black"></td>
                <td className="border border-black text-right px-2 font-mono font-bold text-[13px]">
                  {formatNum(mat.allocatedQty, "RAW")}
                </td>
                <td className="border border-black"></td>
                <td className="border border-black"></td>
                <td className="border border-black text-center font-mono text-[11px] tracking-wider text-blue-700">
                  {mat.batch_number}
                </td>
              </tr>
            ))
          ) : (
            <tr className="border-b border-black text-center h-7">
              <td colSpan="9" className="text-gray-400">
                無原物料紀錄
              </td>
            </tr>
          )}
          {Array.from({
            length: Math.max(0, 10 - flattenedMaterials.length),
          }).map((_, i) => (
            <tr key={`empty-${i}`} className="border-b border-black h-7">
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer 備註與簽名區塊 */}
      <div className="text-[12px] mt-1 space-y-1">
        <div className="flex items-baseline gap-6 font-bold border-b border-dotted border-gray-400 pb-1">
          <div>
            調煮時間:{" "}
            <span className="w-16 inline-block border-b border-black text-center">
              ~
            </span>
          </div>
          <div>
            溫度:{" "}
            <span className="w-16 inline-block border-b border-black">
              &nbsp;
            </span>{" "}
            °C
          </div>
          <div>
            合計:{" "}
            <span className="font-mono text-[14px] underline px-2">
              {formatNum(order.target_qty, "PRODUCT")}
            </span>
          </div>
          <div>
            覆秤:{" "}
            <span className="w-20 inline-block border-b border-black">
              &nbsp;
            </span>{" "}
            kg
          </div>
          <div>
            袋重:{" "}
            <span className="w-20 inline-block border-b border-black">
              &nbsp;
            </span>{" "}
            kg
          </div>
        </div>

        <div className="text-[10px] text-gray-800 leading-tight py-0.5">
          備註: 1. *添*記號之原料，秤量前請驗算用量是否合於法規用量。 2.
          *過*記號之原料為含過敏原之原料，請區隔。
        </div>

        <div className="flex items-center gap-2 border border-black p-1">
          <span className="font-bold underline text-[11px]">
            生產前後濾網使用正確無破損
          </span>
          <span className="ml-4 flex items-center border border-black px-1 border-dashed">
            生產前
            <span className="ml-1 w-3 h-3 border border-black inline-block"></span>
          </span>
          <span className="flex items-center border border-black px-1 border-dashed">
            生產後使用人員
            <span className="ml-1 w-3 h-3 border border-black inline-block"></span>
          </span>
          <span className="flex items-center border border-black px-1 border-dashed">
            確認人員
            <span className="ml-1 w-3 h-3 border border-black inline-block"></span>
          </span>
          <span className="flex items-center border border-black px-1 border-dashed">
            查核人員
            <span className="ml-1 w-3 h-3 border border-black inline-block"></span>
          </span>
          <div className="ml-auto text-[9px] leading-tight text-gray-700">
            1.產品投入前清點包數填寫數量，生產後確認空袋記錄數量。
            <br />
            2.配料人員秤料時確認原料數量正確標註於配料欄.合格為V，不合格為X。
            <br />
            3.生產人員投料時確認原料數量正確標註於投料欄.合格為V，不合格為X。
            <br />
          </div>
        </div>

        <div className="flex justify-between items-end mt-3 px-4 font-bold text-[14px]">
          <div>
            主 管：
            <span className="w-24 inline-block border-b border-black">
              &nbsp;
            </span>
          </div>
          <div>
            生 產：
            <span className="w-24 inline-block border-b border-black">
              &nbsp;
            </span>
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-3">
              審 核：
              <span className="w-24 inline-block border-b border-black">
                &nbsp;
              </span>
            </div>
            <div>
              領 料：
              <span className="w-24 inline-block border-b border-black">
                &nbsp;
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-3 text-[12px] font-normal">
              經 辦：
              <span className="font-bold text-[14px] ml-2">
                {order.creator_name || "系統產出"}
              </span>
            </div>
            <div>
              組 合：
              <span className="w-24 inline-block border-b border-black">
                &nbsp;
              </span>
            </div>
          </div>
          <div className="text-[10px] font-normal self-end">表號: C-56</div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 處理 A4 母子單列印的包裹層元件
// ==========================================
const ProductionOrderPrintTemplate = ({ data }) => {
  if (!data) return null;
  const children = data.children_orders || [];

  return (
    <div className="hidden print:block w-full bg-white text-black font-sans mx-auto print:pt-8 print:px-8">
      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 0;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page-break {
              page-break-after: always;
            }
          }
        `}
      </style>

      {/* 母單 */}
      <div className={children.length > 0 ? "page-break" : ""}>
        <ProductionFormTemplate order={data} isChildForm={false} />
      </div>

      {/* 子單列印（一張一頁） */}
      {children.map((child, idx) => (
        <div
          key={child.id}
          className={idx === children.length - 1 ? "" : "page-break print:pt-8"}
        >
          <ProductionFormTemplate order={child} isChildForm={true} />
        </div>
      ))}
    </div>
  );
};

// ==========================================
// 主頁面元件
// ==========================================
const ProductionOrderPage = () => {
  const navigate = useNavigate();
  const [productionOrders, setProductionOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterOrder, setFilterOrder] = useState("");
  const [filterProduct, setFilterProduct] = useState("");

  const [expandedOrderIds, setExpandedOrderIds] = useState([]);
  const [detailedOrdersMap, setDetailedOrdersMap] = useState({});
  const [printData, setPrintData] = useState(null);

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/production_orders?is_root=true");
      if (!res.ok) throw new Error("生產單資料載入失敗");
      const json = await res.json();

      let orderArray = [];
      if (Array.isArray(json)) orderArray = json;
      else if (json.results && Array.isArray(json.results))
        orderArray = json.results;
      else if (json.data && Array.isArray(json.data)) orderArray = json.data;
      else if (
        json.data &&
        json.data.results &&
        Array.isArray(json.data.results)
      )
        orderArray = json.data.results;

      setProductionOrders(orderArray);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = async (orderId) => {
    if (expandedOrderIds.includes(orderId)) {
      setExpandedOrderIds((prev) => prev.filter((id) => id !== orderId));
      return;
    }

    if (!detailedOrdersMap[orderId]) {
      try {
        const res = await fetchWithAuth(`/api/production_orders/${orderId}`);
        if (res.ok) {
          const json = await res.json();
          setDetailedOrdersMap((prev) => ({
            ...prev,
            [orderId]: json.data || json,
          }));
        } else {
          setDetailedOrdersMap((prev) => ({
            ...prev,
            [orderId]: { hasError: true },
          }));
        }
      } catch (err) {
        setDetailedOrdersMap((prev) => ({
          ...prev,
          [orderId]: { hasError: true },
        }));
      }
    }

    setExpandedOrderIds((prev) => [...prev, orderId]);
  };

  const handlePrintRow = async (e, po) => {
    if (e) e.stopPropagation();

    let orderToPrint = detailedOrdersMap[po.id];

    if (!orderToPrint) {
      try {
        const res = await fetchWithAuth(`/api/production_orders/${po.id}`);
        if (res.ok) {
          const json = await res.json();
          orderToPrint = json.data || json;
          setDetailedOrdersMap((prev) => ({ ...prev, [po.id]: orderToPrint }));
        } else {
          showAlert("錯誤", "載入單據詳細資料失敗，無法列印", "error");
          return;
        }
      } catch (err) {
        showAlert("錯誤", "網路異常，無法載入列印資料", "error");
        return;
      }
    }

    if (orderToPrint.hasError) {
      showAlert("錯誤", "此單據資料損毀，無法進行列印", "error");
      return;
    }

    setPrintData(orderToPrint);
    setTimeout(() => {
      const originalTitle = document.title;
      document.title = `${po.order_number}_${po.product_name}`;
      window.print();
      document.title = originalTitle;
    }, 150);
  };

  const filteredOrders = useMemo(() => {
    return productionOrders.filter((po) => {
      const matchOrder =
        !filterOrder ||
        (po.order_number &&
          po.order_number.toLowerCase().includes(filterOrder.toLowerCase()));
      const matchProduct =
        !filterProduct ||
        (po.product_name &&
          po.product_name.toLowerCase().includes(filterProduct.toLowerCase()));
      return matchOrder && matchProduct;
    });
  }, [productionOrders, filterOrder, filterProduct]);

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="animate-pulse text-slate-500 font-bold">
          載入生產單資料中...
        </div>
      </div>
    );
  if (error)
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 text-red-500 font-bold">
        錯誤: {error}
      </div>
    );

  return (
    <>
      <div className="print:hidden p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              生產單管理
            </h2>
          </div>
        </div>
        <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg mb-6 border border-blue-100">
          <p className="flex items-center gap-2 font-medium mb-1">
            <span className="text-lg">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
            <li>
              支援<strong>單號</strong>單號與<strong>產品名稱</strong>
              快速搜尋，即時監控各單號狀態。
            </li>
            <li>一鍵產出符合實體規範的生產單與簽核欄位，對接現場作業。</li>
            <li>
              提供生產單細節編輯功能，針對原物料批號回填實際耗損、用量、盤盈盤虧事項。
            </li>
          </ul>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <div className="flex gap-4 flex-wrap w-full md:w-auto">
              <input
                type="text"
                placeholder="搜尋生產單號..."
                value={filterOrder}
                onChange={(e) => setFilterOrder(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-full md:w-64 shadow-sm"
              />
              <input
                type="text"
                placeholder="搜尋產品名稱..."
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-full md:w-64 shadow-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-sm text-slate-600 font-semibold">
                <tr>
                  <th className="p-4 w-10 text-center"></th>
                  <th className="p-4">生產單號</th>
                  <th className="p-4">產品名稱</th>
                  <th className="p-4 text-right">預計產量</th>
                  <th className="p-4 text-center">狀態</th>
                  <th className="p-4 text-center">建立者</th>
                  <th className="p-4 text-center w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((po) => {
                    const isExpanded = expandedOrderIds.includes(po.id);
                    return (
                      <React.Fragment key={po.id}>
                        <tr
                          className={`hover:bg-blue-50/60 cursor-pointer transition-colors duration-150 ${isExpanded ? "bg-blue-50/30" : ""}`}
                          onClick={() => handleToggleExpand(po.id)}
                        >
                          <td className="p-4 text-center text-slate-400 font-mono text-[10px]">
                            {isExpanded ? "▼" : "▶"}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-700">
                            {po.order_number}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">
                                {po.product_name}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-right text-slate-800 font-mono font-bold">
                            {formatNum(po.target_qty, po.product_type)}{" "}
                            <span className="text-xs text-slate-500 font-sans font-normal">
                              {po.product_unit}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <StatusTag status={po.status} />
                          </td>
                          <td className="p-4 text-center text-slate-600">
                            {po.creator_name}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={(e) => handlePrintRow(e, po)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-600 hover:text-white transition-all duration-200 text-xs font-bold mr-2 outline-none shadow-sm"
                            >
                              列印
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/production/${po.id}`);
                              }}
                              className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-md hover:bg-amber-600 hover:text-white transition-all duration-200 text-xs font-bold outline-none shadow-sm"
                            >
                              編輯
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td
                              colSpan="7"
                              className="p-0 bg-slate-200/50 shadow-inner border-b-4 border-slate-300"
                            >
                              <div className="p-4 md:p-8 overflow-x-auto flex flex-col gap-6">
                                <div className="min-w-[800px] max-w-5xl mx-auto w-full">
                                  {detailedOrdersMap[po.id] ? (
                                    detailedOrdersMap[po.id].hasError ? (
                                      <div className="p-12 text-center text-red-500 bg-white shadow-xl ring-1 ring-black/5 font-bold">
                                        載入失敗，請確認 API 是否正常運作
                                      </div>
                                    ) : (
                                      <>
                                        <div className="shadow-xl ring-1 ring-black/5 mb-8 relative">
                                          <ProductionFormTemplate
                                            order={detailedOrdersMap[po.id]}
                                            onPrint={(e) =>
                                              handlePrintRow(e, po)
                                            }
                                          />
                                        </div>

                                        {detailedOrdersMap[
                                          po.id
                                        ].children_orders?.map((child, idx) => (
                                          <div
                                            key={child.id}
                                            className={`relative pt-6 border-t-[3px] border-dashed border-slate-300 ${idx > 0 ? "mt-6" : ""}`}
                                          >
                                            {idx === 0 && (
                                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-200 text-slate-600 px-4 py-1 rounded-full text-xs font-bold tracking-widest shadow-sm">
                                                ▼ 子生產單 ▼
                                              </div>
                                            )}
                                            <div className="shadow-xl ring-1 ring-black/5">
                                              <ProductionFormTemplate
                                                order={child}
                                                isChildForm={true}
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </>
                                    )
                                  ) : (
                                    <div className="p-12 text-center text-slate-500 animate-pulse bg-white shadow-xl ring-1 ring-black/5">
                                      載入詳細單據資料中...
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="7"
                      className="p-12 text-center text-slate-400 bg-white"
                    >
                      查無符合條件的生產單
                    </td>
                  </tr>
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

      {printData && <ProductionOrderPrintTemplate data={printData} />}
    </>
  );
};

export default ProductionOrderPage;
