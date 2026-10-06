import React, { useState, useEffect, useMemo } from "react";
import CustomDialog from "./components/customDialog";
import {
  Printer,
  FileText,
  PackageCheck,
  ClipboardCheck,
  Loader2,
  Search,
} from "lucide-react";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { useNavigate } from "react-router-dom";

// ==============================================
// 🌟 輔助函數
// ==============================================
const formatValue = (num) => {
  if (num === null || num === undefined || num === "") return "0";
  return parseFloat(Number(num).toFixed(5)).toString();
};

const getOrderTotalWeight = (materials_info) => {
  if (!Array.isArray(materials_info)) return 0;
  return materials_info.reduce((sum, mat) => {
    const unit = (mat.unit || "").toUpperCase();
    if (unit === "KG" && mat.type !== "PACK") {
      return sum + (parseFloat(mat.requiredQty) || 0);
    }
    return sum;
  }, 0);
};

const getFlattenedMaterials = (materials_info) => {
  const result = [];
  if (!Array.isArray(materials_info)) return result;

  materials_info.forEach((mat) => {
    if (mat.type === "CHILD_PRODUCT") return;

    const materialCode = mat.code || "-";
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
          requiredQty: parseFloat(mat.requiredQty) || 0,
          allocatedQty: parseFloat(b.used),
          input_bags: b.input_bags,
          empty_bags: b.empty_bags,
          batch_number: b.batch_number,
          unit: mat.unit || "kg",
          remark: mat.remark || "",
          type: mat.type,
          sequence_num: mat.sequence_num || "",
        });
      });
    } else {
      result.push({
        isChild: false,
        code: materialCode,
        materialName: mat.materialName,
        requiredQty: parseFloat(mat.requiredQty) || 0,
        allocatedQty: parseFloat(mat.requiredQty) || 0,
        input_bags: "",
        empty_bags: "",
        batch_number: materialCode,
        unit: mat.unit || "kg",
        remark: mat.remark || "",
        type: mat.type,
        sequence_num: mat.sequence_num || "",
      });
    }
  });

  return result;
};

// 提取共用的日期格式化邏輯
const extractDates = (order) => {
  const today = new Date();
  const reportDateStr = `${today.getFullYear()} 年 ${(today.getMonth() + 1).toString().padStart(2, "0")} 月 ${today.getDate().toString().padStart(2, "0")} 日`;
  const reportDateShort = `${today.getFullYear()}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getDate().toString().padStart(2, "0")}`;

  const batchNum = order.used_batch_number || order.order_number;
  let mfgDateStr = "";
  let mfgDateShort = "";

  if (batchNum && batchNum.length >= 8) {
    const yyyy = batchNum.substring(0, 4);
    const mm = batchNum.substring(4, 6);
    const dd = batchNum.substring(6, 8);
    if (!isNaN(Date.parse(`${yyyy}-${mm}-${dd}`))) {
      mfgDateStr = `${yyyy} 年 ${mm} 月 ${dd} 日`;
      mfgDateShort = `${yyyy}/${mm}/${dd}`;
    }
  }
  if (!mfgDateStr) {
    const d = new Date(order.created_at);
    mfgDateStr = `${d.getFullYear()} 年 ${(d.getMonth() + 1).toString().padStart(2, "0")} 月 ${d.getDate().toString().padStart(2, "0")} 日`;
    mfgDateShort = `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
  }

  let expDateStr = "詳見包裝標示";
  const storageLife = order.product_profile?.storage_life || "";
  const monthsMatch = storageLife.match(/(\d+)\s*個月/);

  if (monthsMatch && mfgDateShort.includes("/")) {
    const months = parseInt(monthsMatch[1], 10);
    const parts = mfgDateShort.split("/");
    const mfgDateObj = new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
    if (!isNaN(mfgDateObj.getTime())) {
      mfgDateObj.setMonth(mfgDateObj.getMonth() + months);
      mfgDateObj.setDate(mfgDateObj.getDate() - 1);
      expDateStr = `${mfgDateObj.getFullYear()} 年 ${(mfgDateObj.getMonth() + 1).toString().padStart(2, "0")} 月 ${mfgDateObj.getDate().toString().padStart(2, "0")} 日`;
    }
  }

  const updatedD = new Date(order.updated_at);
  const updatedDateShort = `${updatedD.getFullYear()}/${(updatedD.getMonth() + 1).toString().padStart(2, "0")}/${updatedD.getDate().toString().padStart(2, "0")}`;

  return {
    reportDateStr,
    reportDateShort,
    batchNum,
    mfgDateStr,
    mfgDateShort,
    expDateStr,
    updatedDateShort,
  };
};

const getVendorName = (order) => {
  try {
    const vInfo =
      typeof order.vendor_info === "string"
        ? JSON.parse(order.vendor_info)
        : order.vendor_info || {};
    return vInfo.name || "基香食品";
  } catch (e) {
    return "基香食品";
  }
};

// ==============================================
// 🌟 列印樣板 0：廠內生產流程單
// ==============================================
const ProductionFormTemplate = ({
  order,
  isChildForm = false,
  sortBySequence = false,
}) => {
  if (!order) return null;

  const orderDateStr = new Date(order.created_at).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const flattenedMaterials = getFlattenedMaterials(order.materials_info);

  // 🌟 依照 Toggle 狀態決定前端的即時排序邏輯
  flattenedMaterials.sort((a, b) => {
    if (sortBySequence) {
      // 按照序號 (Sequence_num) 排序，若無序號則退回以數量排序
      const seqA = String(a.sequence_num || "").trim();
      const seqB = String(b.sequence_num || "").trim();
      if (seqA && seqB)
        return seqA.localeCompare(seqB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      if (seqA && !seqB) return -1;
      if (!seqA && seqB) return 1;
      return b.requiredQty - a.requiredQty;
    } else {
      // 預設原邏輯：半成品固定置頂，其餘按照用量由高到低
      if (a.type === "SEMI" && b.type !== "SEMI") return -1;
      if (a.type !== "SEMI" && b.type === "SEMI") return 1;
      return b.requiredQty - a.requiredQty;
    }
  });

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

  const totalWeight = getOrderTotalWeight(order.materials_info);
  const isWeightBased = totalWeight > 0;

  const displayQty = formatValue(order.target_qty);
  const displayUnit = isWeightBased
    ? "KG"
    : order.product_profile?.unit || "KG";

  return (
    <div className={`bg-white font-sans text-black relative p-4 print:p-0`}>
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
            <span className="font-mono">
              {order.product_profile?.code || "-"}
            </span>
          </div>
          <div className="mt-1 text-[14px] font-bold whitespace-nowrap">
            產品名稱 : {order.product_profile?.name || order.product_name}
          </div>
          <div className="mt-1">產品規格 : {order.product_profile?.spec}</div>
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
            <span className="font-mono font-bold text-xl">{displayQty}</span>
            <span className="font-bold">{displayUnit}</span>
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
                className="border-b border-black h-7 hover:bg-slate-50 transition-colors"
              >
                <td className="border border-black text-center">{i + 1}</td>
                <td className="border border-black text-center text-[10px] text-gray-700 font-mono tracking-tighter">
                  {mat.code}
                </td>
                <td className="border border-black text-left px-2">
                  <span className="truncate max-w-[200px]">
                    {mat.materialName}
                    {mat.remark && mat.remark.length > 0 && (
                      <span className="px-2 font-mono text-[12px]">
                        ({mat.remark})
                      </span>
                    )}
                  </span>
                </td>
                <td className="border border-black text-right px-2 font-mono font-bold text-[13px]">
                  {mat.input_bags}
                </td>
                <td className="border border-black text-right px-2 font-mono font-bold text-[13px]">
                  {mat.empty_bags}
                </td>
                <td className="border border-black text-right px-2 font-mono font-bold text-[13px]">
                  {formatValue(mat.allocatedQty)}
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
              {displayQty}
            </span>
            {displayUnit}
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

// ==============================================
// 🌟 列印樣板 1：檢核1.jpg (單一產品多批號表)
// ==============================================
const CoATemplateProduct = ({ orders }) => {
  if (!orders || orders.length === 0) return null;
  const sampleOrder = orders[0];
  const standards = sampleOrder.product_profile?.qc_standards || [];

  const rangeStandards = standards.filter((s) => s.type === "range");

  return (
    <div
      className={`bg-white font-serif text-black relative p-6 print:p-0 mx-auto w-full max-w-[1000px]`}
    >
      <div className="flex items-center justify-between border-2 border-black border-b-0">
        <div className="w-[100px] border-r-2 border-black p-2 flex items-center justify-center">
          <div className="w-12 h-12 bg-red-600 rounded flex items-center justify-center text-white font-black text-2xl italic">
            G
          </div>
        </div>
        <div className="flex-1 text-center py-4">
          <h1 className="text-2xl font-bold tracking-[0.3em]">
            基香食品有限公司
          </h1>
          <h2 className="text-xl font-bold tracking-[0.5em] mt-2">
            成品檢驗記錄表
          </h2>
        </div>
        <div className="w-[150px] border-l-2 border-black h-full flex flex-col justify-center text-sm font-bold">
          <div className="border-b-2 border-black p-2 flex items-center gap-4">
            <span className="tracking-widest w-12">版次：</span> <span>04</span>
          </div>
          <div className="p-2 flex items-center gap-4">
            <span className="tracking-widest w-12">頁次：</span>{" "}
            <span>1 / 1</span>
          </div>
        </div>
      </div>

      <table className="w-full text-[12px] border-collapse border-2 border-black mt-0 text-center">
        <tbody>
          <tr>
            <td
              colSpan={3}
              className="border border-black p-1 px-2 text-left text-[14px]"
            >
              分類品號：
            </td>
            <td
              colSpan={standards.length + 2}
              className="border border-black p-1 px-2 text-right text-[12px]"
            >
              ※規格詳見A-7-03成品管制標準
            </td>
          </tr>

          <tr className="text-[14px] font-bold">
            <td className="border border-black p-2 w-[12%]">產品編號</td>
            <td className="border border-black p-2 w-[22%]">
              {sampleOrder.product_profile?.code}
            </td>
            <td className="border border-black p-2 w-[12%]">產品名稱</td>
            <td
              colSpan={standards.length}
              className="border border-black p-2 w-auto"
            >
              {sampleOrder.product_profile?.name}
            </td>
            <td
              colSpan={2}
              className="border border-black p-0 w-[20%] align-top text-[12px]"
            >
              <div className="flex h-full items-stretch min-h-[40px]">
                <div className="w-[40%] flex items-center justify-center border-r border-black font-bold">
                  檢測中線
                </div>
                <div className="w-[60%] flex flex-col justify-center">
                  {rangeStandards.length > 0 ? (
                    rangeStandards.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between border-b border-black last:border-0 px-2 py-0.5"
                      >
                        <span>{s.name}</span>
                        <span>{s.target_min || s.target_max || "-"}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center w-full">-</div>
                  )}
                </div>
              </div>
            </td>
          </tr>

          <tr className="bg-gray-50/50 font-bold">
            <td rowSpan={2} className="border border-black p-2">
              取樣日期
            </td>
            <td rowSpan={2} className="border border-black p-2">
              生產批號
            </td>
            <td rowSpan={2} className="border border-black p-2">
              檢測日期
            </td>
            <td
              colSpan={standards.length + 1}
              className="border border-black p-1"
            >
              檢驗項目 / 標準 (合格打✓, 不合格打✗)
            </td>
            <td rowSpan={2} className="border border-black p-2">
              備註
            </td>
          </tr>

          <tr className="bg-gray-50/50 font-bold text-[11px]">
            {standards.map((qc, i) => (
              <td key={i} className="border border-black p-1 px-2">
                {qc.name}
              </td>
            ))}
            <td className="border border-black p-1 w-10">判定</td>
          </tr>

          {orders.map((order, idx) => {
            const { mfgDateShort, batchNum, updatedDateShort } =
              extractDates(order);
            const metricsMap = {};
            (order.qc_metrics || []).forEach((m) => {
              metricsMap[m.name] = m.actual_value;
            });

            return (
              <tr key={idx} className="h-8">
                <td className="border border-black p-1 tracking-wider">
                  {mfgDateShort}
                </td>
                <td className="border border-black p-1 font-mono tracking-tighter">
                  {batchNum}
                </td>
                <td className="border border-black p-1 tracking-wider">
                  {updatedDateShort}
                </td>

                {standards.map((qc, i) => {
                  let val = metricsMap[qc.name] || "";
                  if (qc.type === "boolean") {
                    val =
                      val === "NEGATIVE" ? "✓" : val === "POSITIVE" ? "✗" : "✓";
                  }
                  if (qc.type === "text" && val) val = "✓";
                  return (
                    <td key={i} className="border border-black p-1">
                      {val}
                    </td>
                  );
                })}

                <td className="border border-black p-1 font-bold text-[14px]">
                  {order.qc_passed === true
                    ? "✓"
                    : order.qc_passed === false
                      ? "✗"
                      : ""}
                </td>
                <td className="border border-black p-1 text-left text-[10px]">
                  {order.qc_passed === false
                    ? "綜合此前檢測落點，需再確認"
                    : ""}
                </td>
              </tr>
            );
          })}

          {Array.from({ length: Math.max(0, 15 - orders.length) }).map(
            (_, i) => (
              <tr key={`empty-${i}`} className="h-8">
                <td className="border border-black p-1"></td>
                <td className="border border-black"></td>
                <td className="border border-black"></td>
                {standards.map((_, j) => (
                  <td key={j} className="border border-black"></td>
                ))}
                <td className="border border-black"></td>
                <td className="border border-black"></td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

// ==============================================
// 🌟 列印樣板 2：檢核2.jpg (單一客戶多產品表)
// ==============================================
const CoATemplateVendor = ({ orders }) => {
  if (!orders || orders.length === 0) return null;
  const { reportDateShort } = extractDates(orders[0]);
  const vendorName = getVendorName(orders[0]);

  return (
    <div
      className={`bg-white font-serif text-black relative p-6 print:p-0 mx-auto w-full max-w-[1100px]`}
    >
      <div className="flex items-center justify-center border-2 border-black border-b-0">
        <div className="w-[100px] border-r-2 border-black p-2 flex items-center justify-center">
          <div className="w-12 h-12 bg-red-600 rounded flex items-center justify-center text-white font-black text-2xl italic">
            G
          </div>
        </div>
        <div className="flex-1 text-center py-4">
          <h1 className="text-2xl font-bold tracking-[0.3em]">
            基香食品有限公司
          </h1>
          <h2 className="text-xl font-bold tracking-[0.5em] mt-2">
            產品檢驗報告表
          </h2>
        </div>
      </div>

      <table className="w-full text-[14px] border-collapse border-2 border-black text-center font-bold">
        <thead>
          <tr>
            <td className="border border-black p-2 w-[15%] bg-gray-50/50">
              客 戶 名 稱
            </td>
            <td className="border border-black p-2 w-[35%] tracking-widest">
              {vendorName}
            </td>
            <td className="border border-black p-2 w-[15%] bg-gray-50/50">
              報 告 日 期
            </td>
            <td className="border border-black p-2 w-[35%] tracking-widest">
              {reportDateShort.replace(/\//g, ". ")}
            </td>
          </tr>
        </thead>
      </table>

      <table className="w-full text-[12px] border-collapse border-x-2 border-b-2 border-black mt-0 text-center align-middle">
        <thead>
          <tr className="bg-gray-50/50">
            <th className="border border-black p-1 w-8">
              項<br />次
            </th>
            <th className="border border-black p-1 w-24">產品編號</th>
            <th className="border border-black p-1 w-32">產品名稱</th>
            <th className="border border-black p-1 w-28">製造批號</th>
            <th className="border border-black p-1 w-20">製造日期</th>
            <th className="border border-black p-1 w-20">有效日期</th>
            <th className="border border-black p-1 w-32">保存方式</th>
            <th className="border border-black p-1 w-24">檢驗項目</th>
            <th className="border border-black p-1 w-24">標準範圍</th>
            <th className="border border-black p-1 w-16">檢測結果</th>
            <th className="border border-black p-1">備註</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, orderIdx) => {
            const { mfgDateShort, batchNum, expDateStr } = extractDates(order);
            const mfgNoSlash = mfgDateShort.replace(/\//g, "");
            const expNoSpaces = expDateStr.replace(/ 年 | 月 | 日/g, "");

            const standards = order.product_profile?.qc_standards || [];
            const metricsMap = {};
            (order.qc_metrics || []).forEach((m) => {
              metricsMap[m.name] = m.actual_value;
            });

            const rowCount = Math.max(1, standards.length);

            return (
              <React.Fragment key={orderIdx}>
                {Array.from({ length: rowCount }).map((_, qcIdx) => {
                  const qc = standards[qcIdx];
                  let stdText = "-";
                  let resText = "-";

                  if (qc) {
                    if (qc.type === "range")
                      stdText = `${qc.target_min || ""} ~ ${qc.target_max || ""}`;
                    else if (qc.type === "boolean")
                      stdText = qc.target_bool === "NEGATIVE" ? "陰性" : "合格";
                    else stdText = qc.target_text || "-";

                    resText = metricsMap[qc.name] || "-";
                    if (qc.type === "boolean" && resText) {
                      resText =
                        resText === "NEGATIVE"
                          ? "合格"
                          : resText === "POSITIVE"
                            ? "陽性"
                            : "合格";
                    }
                  }

                  return (
                    <tr key={`${orderIdx}-${qcIdx}`}>
                      {qcIdx === 0 && (
                        <>
                          <td
                            className="border border-black p-1"
                            rowSpan={rowCount}
                          >
                            {orderIdx + 1}
                          </td>
                          <td
                            className="border border-black p-1 tracking-tighter"
                            rowSpan={rowCount}
                          >
                            {order.product_profile?.code}
                          </td>
                          <td
                            className="border border-black p-1 font-bold"
                            rowSpan={rowCount}
                          >
                            {order.product_profile?.name}
                          </td>
                          <td
                            className="border border-black p-1 tracking-tighter"
                            rowSpan={rowCount}
                          >
                            {batchNum}
                          </td>
                          <td
                            className="border border-black p-1 tracking-tighter"
                            rowSpan={rowCount}
                          >
                            {mfgNoSlash}
                          </td>
                          <td
                            className="border border-black p-1 tracking-tighter"
                            rowSpan={rowCount}
                          >
                            {expNoSpaces}
                          </td>
                          <td
                            className="border border-black p-1 text-left text-[10px] leading-tight"
                            rowSpan={rowCount}
                          >
                            <div>■ 常溫 28°C↓</div>
                            <div>□ 冷藏 0-7°C↓</div>
                            <div>□ 冷凍 -18°C↓</div>
                          </td>
                        </>
                      )}
                      <td className="border border-black p-1 bg-gray-50/20">
                        {qc?.name || "-"}
                      </td>
                      <td className="border border-black p-1 bg-gray-50/20">
                        {stdText}
                      </td>
                      <td className="border border-black p-1 bg-gray-50/20">
                        {resText}
                      </td>
                      <td className="border border-black p-1 bg-gray-50/20 text-[10px]">
                        -
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ==============================================
// 🌟 列印樣板 3：檢核3.jpg (單一產品單一批號表)
// ==============================================
const CoATemplateSingle = ({ order }) => {
  if (!order) return null;
  const vendorName = getVendorName(order);
  const { reportDateStr, mfgDateStr, batchNum, expDateStr } =
    extractDates(order);
  const standards = order.product_profile?.qc_standards || [];
  const metricsMap = {};
  (order.qc_metrics || []).forEach((m) => {
    metricsMap[m.name] = m.actual_value;
  });

  return (
    <div
      className={`bg-white font-serif text-black relative p-6 print:p-0 mx-auto w-full max-w-[794px]`}
    >
      <div className="flex items-center justify-center border-2 border-black border-b-0">
        <div className="w-[150px] border-r-2 border-black p-4 flex items-center justify-center">
          <div className="w-16 h-16 bg-red-600 rounded flex items-center justify-center text-white font-black text-3xl italic">
            G
          </div>
        </div>
        <div className="flex-1 text-center py-6">
          <h1 className="text-3xl font-bold tracking-[0.3em]">
            基香食品有限公司
          </h1>
          <h2 className="text-xl font-bold tracking-[0.5em] mt-4">
            產品檢驗報告表
          </h2>
        </div>
      </div>

      <table className="w-full text-[15px] border-collapse border-2 border-black">
        <tbody>
          <tr>
            <td className="border border-black p-4 w-[20%] text-center">
              客 戶 名 稱
            </td>
            <td className="border border-black p-4 w-[30%] text-center font-bold tracking-widest">
              {vendorName}
            </td>
            <td className="border border-black p-4 w-[20%] text-center">
              報 告 日 期
            </td>
            <td className="border border-black p-4 w-[30%] text-center tracking-widest">
              {reportDateStr}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-4 text-center">產 品 編 號</td>
            <td className="border border-black p-4 text-center font-bold tracking-widest">
              {order.product_profile?.code}
            </td>
            <td className="border border-black p-4 text-center">製 造 批 號</td>
            <td className="border border-black p-4 text-center font-bold tracking-wider">
              {batchNum}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-4 text-center">產 品 名 稱</td>
            <td className="border border-black p-4 text-center font-bold tracking-widest">
              {order.product_profile?.name || order.product_name}
            </td>
            <td className="border border-black p-4 text-center">製 造 日 期</td>
            <td className="border border-black p-4 text-center tracking-widest">
              {mfgDateStr}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-4 text-center">保 存 方 式</td>
            <td className="border border-black p-4 pl-8 text-sm leading-loose">
              <div>■ 常溫 28°C↓(開封後冷藏保存)</div>
              <div>□ 冷藏 0-7°C↓</div>
              <div>□ 冷凍 -18°C↓</div>
            </td>
            <td className="border border-black p-4 text-center">有 效 日 期</td>
            <td className="border border-black p-4 text-center tracking-widest">
              {expDateStr}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full text-[15px] border-collapse border-x-2 border-b-2 border-black mt-0">
        <thead>
          <tr className="text-center">
            <th className="border border-black p-3 w-16">
              項<br />次
            </th>
            <th className="border border-black p-3 w-[25%]">檢驗項目</th>
            <th className="border border-black p-3 w-[25%]">標準範圍</th>
            <th className="border border-black p-3 w-[20%]">檢測結果</th>
            <th className="border border-black p-3">備註</th>
          </tr>
        </thead>
        <tbody className="text-center">
          {standards.length > 0 ? (
            standards.map((qc, idx) => {
              const actual = metricsMap[qc.name];
              let standardText = "";
              if (qc.type === "range") {
                if (qc.target_min && !qc.target_max)
                  standardText = `${qc.target_min} 以上（含）`;
                else if (!qc.target_min && qc.target_max)
                  standardText = `${qc.target_max} 以下（含）`;
                else if (qc.target_min && qc.target_max)
                  standardText = `${qc.target_min} ~ ${qc.target_max}`;
                else standardText = "-";
              } else if (qc.type === "boolean")
                standardText =
                  qc.target_bool === "NEGATIVE"
                    ? "陰性"
                    : qc.target_bool === "POSITIVE"
                      ? "陽性"
                      : "合格";
              else standardText = qc.target_text || "-";

              let resultText = actual;
              if (qc.type === "boolean" && actual) {
                resultText =
                  actual === "NEGATIVE"
                    ? "合格"
                    : actual === "POSITIVE"
                      ? "陽性"
                      : "合格";
              }

              return (
                <tr key={idx} className="h-12 font-bold">
                  <td className="border border-black p-2">{idx + 1}</td>
                  <td className="border border-black p-2 tracking-widest">
                    {qc.name}
                  </td>
                  <td className="border border-black p-2">{standardText}</td>
                  <td className="border border-black p-2">
                    {resultText || "-"}
                  </td>
                  <td className="border border-black p-2 text-xs font-normal"></td>
                </tr>
              );
            })
          ) : (
            <tr className="h-24">
              <td colSpan="5" className="border border-black p-4 text-gray-400">
                無品管設定紀錄
              </td>
            </tr>
          )}
          {Array.from({ length: Math.max(0, 5 - standards.length) }).map(
            (_, i) => (
              <tr key={`empty-${i}`} className="h-12">
                <td className="border border-black p-2">
                  {standards.length + i + 1}
                </td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      {/* 底部簽核與備註 */}
      <div className="mt-8 text-sm px-2">備註：</div>

      <div className="flex justify-between items-end mt-24 px-12 text-lg font-bold">
        <div className="flex items-end gap-2">
          主 管：<div className="w-32 border-b border-black h-8"></div>
        </div>
        <div className="flex items-end gap-2 relative">
          品 管：<div className="w-32 border-b border-black h-8"></div>
        </div>
      </div>
    </div>
  );
};

// ==============================================
// 🌟 列印包裝元件 (完美還原 Flow 與隱藏網址標頭)
// ==============================================
const ProductionOrderPrintTemplate = ({ data, type, sortBySequence }) => {
  if (!data) return null;
  const dataArray = Array.isArray(data) ? data : [data];

  // Flow 的展開邏輯
  const flattenOrders = (order) => {
    let orders = [order];
    if (order.children && order.children.length > 0) {
      order.children.forEach((child) => {
        orders = orders.concat(flattenOrders(child));
      });
    }
    return orders;
  };

  const flowOrdersToPrint =
    type === "Flow" ? dataArray.flatMap(flattenOrders) : [];

  return (
    <div className="hidden print:block w-full bg-white text-black font-sans mx-auto print:p-0">
      <style>
        {`
          @media print {
            @page { 
              size: A4 portrait; 
              margin: 0; 
            }
            body { 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
              padding: 0;
              margin: 0;
            }
            .page-break { page-break-after: always; }
            .print-container {
               padding: 10mm; 
               width: 100%;
            }
          }
        `}
      </style>

      {type === "CoA_Single" &&
        dataArray.map((order, idx) => (
          <div
            key={order.id}
            className={`print-container ${idx === dataArray.length - 1 ? "" : "page-break"}`}
          >
            <CoATemplateSingle order={order} />
          </div>
        ))}

      {type === "CoA_Product" && (
        <div className="print-container">
          <CoATemplateProduct orders={dataArray} />
        </div>
      )}

      {type === "CoA_Vendor" && (
        <div className="print-container">
          <CoATemplateVendor orders={dataArray} />
        </div>
      )}

      {type === "Flow" && (
        <div className="print:pt-8 print:px-8">
          {flowOrdersToPrint.map((orderToPrint, idx) => (
            <div
              key={orderToPrint.id}
              className={
                idx === flowOrdersToPrint.length - 1
                  ? ""
                  : "page-break print:pt-8"
              }
            >
              {/* 🌟 完整還原原本傳給 Flow Template 的 isChildForm 與 sortBySequence */}
              <ProductionFormTemplate
                order={orderToPrint}
                isChildForm={idx !== 0}
                sortBySequence={sortBySequence}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function ProductionOrderPage() {
  const navigate = useNavigate();
  const [productionOrders, setProductionOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterOrder, setFilterOrder] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterVendor, setFilterVendor] = useState("");

  // 🌟 新增：由前端控制是否依序號排版的狀態，預設走原邏輯
  const [sortBySequence, setSortBySequence] = useState(false);

  const [expandedOrderIds, setExpandedOrderIds] = useState([]);
  const [detailedOrdersMap, setDetailedOrdersMap] = useState({});
  const [printData, setPrintData] = useState(null);
  const [printType, setPrintType] = useState("Flow");

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
  }, [filterProduct, filterVendor]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ is_root: "true" });
      if (filterProduct) params.append("product", filterProduct);
      if (filterVendor) params.append("vendor", filterVendor);

      const res = await fetchWithAuth(
        `/api/production_orders?${params.toString()}`,
      );
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
          const orderData = json.data || json;

          const allChildren = orderData.children_orders || [];
          const orderMap = {};
          allChildren.forEach((child) => {
            child.children = [];
            orderMap[child.order_number] = child;
          });

          const rootChildren = [];
          allChildren.forEach((child) => {
            if (child.parent_id === orderData.order_number) {
              rootChildren.push(child);
            } else if (orderMap[child.parent_id]) {
              orderMap[child.parent_id].children.push(child);
            } else {
              rootChildren.push(child);
            }
          });

          orderData.children = rootChildren;
          setDetailedOrdersMap((prev) => ({ ...prev, [orderId]: orderData }));
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

  const handlePrintRow = async (e, po, type = "Flow") => {
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

    if (type.startsWith("CoA") && orderToPrint.qc_passed === null) {
      return showAlert(
        "無法產出報告",
        "此生產單尚未填寫檢驗紀錄，請先完成「品管檢驗」。",
        "warning",
      );
    }

    setPrintType(type);
    setPrintData(type === "Flow" ? orderToPrint : [orderToPrint]);
    setTimeout(() => {
      const originalTitle = document.title;
      document.title = `${type}_${po.order_number}_${po.product_profile?.name || po.product_name}`;
      window.print();
      document.title = originalTitle;
    }, 200);
  };

  const handleBatchPrintCoA = async (filterCategory) => {
    if (filteredOrders.length === 0) {
      return showAlert("提示", "目前沒有符合的生產單可供列印", "info");
    }

    const validOrders = filteredOrders.filter((o) => o.qc_passed !== null);
    if (validOrders.length === 0) {
      return showAlert(
        "提示",
        "您篩選的單據中，尚未有完成品管檢驗的紀錄，無法批次產出報告。",
        "warning",
      );
    }

    setDialog({
      isOpen: true,
      type: "alert",
      status: "info",
      title: "準備資料中",
      message: "正在載入列印資料，請稍候...",
    });

    try {
      const detailedList = [];
      for (const po of validOrders) {
        if (detailedOrdersMap[po.id] && !detailedOrdersMap[po.id].hasError) {
          detailedList.push(detailedOrdersMap[po.id]);
        } else {
          const res = await fetchWithAuth(`/api/production_orders/${po.id}`);
          if (res.ok) {
            const json = await res.json();
            const orderData = json.data || json;
            detailedList.push(orderData);
            setDetailedOrdersMap((prev) => ({ ...prev, [po.id]: orderData }));
          }
        }
      }

      closeDialog();
      setPrintType(`CoA_${filterCategory}`);
      setPrintData(detailedList);
      setTimeout(() => {
        const originalTitle = document.title;
        document.title = `CoA_Batch_${filterCategory}_Report`;
        window.print();
        document.title = originalTitle;
      }, 300);
    } catch (err) {
      closeDialog();
      showAlert("錯誤", "載入批次列印資料失敗", "error");
    }
  };

  // 🌟 遞迴渲染子訂單，並將 sortBySequence 開關傳入
  const renderChildrenOrders = (childrenArr, depth = 1) => {
    if (!childrenArr || childrenArr.length === 0) return null;
    return childrenArr.map((child, idx) => (
      <div
        key={child.id}
        className="relative pt-6 border-t-[3px] border-dashed border-slate-300 mt-6"
      >
        {depth == 1 && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-200 text-slate-600 px-4 py-1 rounded-full text-xs font-bold tracking-widest shadow-sm">
            ▼ 子生產單 ▼
          </div>
        )}
        <div className="shadow-xl ring-1 ring-black/5">
          <ProductionFormTemplate
            order={child}
            isChildForm={true}
            sortBySequence={sortBySequence}
          />
        </div>
        {renderChildrenOrders(child.children, depth + 1)}
      </div>
    ));
  };

  const filteredOrders = useMemo(() => {
    return productionOrders.filter((po) => {
      const matchOrder =
        !filterOrder ||
        (po.order_number &&
          po.order_number.toLowerCase().includes(filterOrder.toLowerCase()));
      return matchOrder;
    });
  }, [productionOrders, filterOrder]);

  return (
    <>
      <div className="print:hidden p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              生產單與出貨管理
            </h2>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col gap-5 bg-slate-50/50">
            {/* 搜尋區塊：改用 Grid 確保對齊不亂跳 */}
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="搜尋單號"
                  value={filterOrder}
                  onChange={(e) => setFilterOrder(e.target.value)}
                  className="w-full h-[40px] pl-9 pr-4 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:outline-none shadow-sm transition-all"
                />
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="搜尋產品名稱"
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  className="w-full h-[40px] pl-9 pr-4 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:outline-none shadow-sm transition-all"
                />
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="搜尋客戶名稱"
                  value={filterVendor}
                  onChange={(e) => setFilterVendor(e.target.value)}
                  className="w-full h-[40px] pl-9 pr-4 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:outline-none shadow-sm transition-all"
                />
              </div>
              <div className="text-xs text-slate-400 font-bold flex items-center gap-2 mr-2">
                {loading && <Loader2 size={14} className="animate-spin" />}共{" "}
                {filteredOrders.length} 筆
              </div>
            </div>

            {/* 操作區塊：統一高度，整齊排列 */}
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 px-3 h-[40px] rounded-lg shadow-sm cursor-pointer hover:bg-slate-50 transition-colors select-none">
                <input
                  type="checkbox"
                  checked={sortBySequence}
                  onChange={(e) => setSortBySequence(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                依自訂序號排序
              </label>

              <button
                onClick={() => handleBatchPrintCoA("Product")}
                disabled={!filterProduct || filteredOrders.length === 0}
                className="px-4 h-[40px] bg-indigo-600 text-white border border-indigo-700 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition-all disabled:opacity-30 flex items-center gap-2"
              >
                <ClipboardCheck size={16} /> 批次產生產品報告
              </button>
              <button
                onClick={() => handleBatchPrintCoA("Vendor")}
                disabled={!filterVendor || filteredOrders.length === 0}
                className="px-4 h-[40px] bg-emerald-600 text-white border border-emerald-700 rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 transition-all disabled:opacity-30 flex items-center gap-2"
              >
                <ClipboardCheck size={16} /> 批次產生客戶報告
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-sm text-slate-600 font-semibold">
                <tr>
                  <th className="p-4 w-10 text-center"></th>
                  <th className="p-4">生產單號</th>
                  <th className="p-4">產品名稱</th>
                  <th className="p-4">指定客戶</th>
                  <th className="p-4 text-right">預計產量</th>
                  <th className="p-4 text-center">建立者</th>
                  <th className="p-4 text-center">操作與報表</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading && filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="p-12 text-center text-slate-400 bg-white"
                    >
                      資料載入中...
                    </td>
                  </tr>
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((po) => {
                    const isExpanded = expandedOrderIds.includes(po.id);
                    const vName = getVendorName(po);

                    return (
                      <React.Fragment key={po.id}>
                        <tr
                          className={`hover:bg-slate-50 cursor-pointer transition-colors duration-150 ${isExpanded ? "bg-slate-50/50" : ""}`}
                          onClick={() => handleToggleExpand(po.id)}
                        >
                          <td className="p-4 text-center text-slate-400 font-mono text-[10px]">
                            {isExpanded ? "▼" : "▶"}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-700">
                            {po.order_number}
                          </td>
                          <td className="p-4 font-bold text-slate-800">
                            {po.product_profile?.name || po.product_name}
                          </td>
                          <td className="p-4 text-slate-600 font-bold">
                            {vName === "基香食品" ? "-" : vName}
                          </td>
                          <td className="p-4 text-right text-slate-800 font-mono font-bold">
                            {formatValue(po.target_qty)}{" "}
                            <span className="text-xs text-slate-500 font-sans font-normal">
                              KG
                            </span>
                          </td>
                          <td className="p-4 text-center text-slate-600">
                            {po.creator_name}
                          </td>
                          <td className="p-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              {/* 1. 內部單 */}
                              <button
                                onClick={(e) => handlePrintRow(e, po, "Flow")}
                                className="px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-md hover:bg-slate-600 hover:text-white transition-all duration-200 text-xs font-bold inline-flex items-center gap-1 shadow-sm outline-none"
                              >
                                <Printer size={14} /> 內部單
                              </button>

                              {/* 2. 耗損回填 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/production/${po.id}`);
                                }}
                                className="px-3 py-1.5 bg-white text-slate-600 border border-slate-300 rounded-md hover:bg-slate-600 hover:text-white transition-all duration-200 text-xs font-bold inline-flex items-center gap-1 shadow-sm outline-none"
                              >
                                <FileText size={14} /> 耗損回填
                              </button>

                              {/* 3. QC 檢驗 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/production-qc/${po.id}`);
                                }}
                                className={`px-3 py-1.5 border rounded-md transition-all duration-200 text-xs font-bold inline-flex items-center gap-1 shadow-sm outline-none ${
                                  po.qc_passed === true
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white"
                                    : po.qc_passed === false
                                      ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white"
                                      : "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white"
                                }`}
                              >
                                <PackageCheck size={14} />
                                {po.qc_passed === true
                                  ? "QC 合格"
                                  : po.qc_passed === false
                                    ? "QC 異常"
                                    : "品管檢驗"}
                              </button>

                              {/* 4. 產生報告 */}
                              <button
                                onClick={(e) =>
                                  handlePrintRow(e, po, "CoA_Single")
                                }
                                className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-600 hover:text-white transition-all duration-200 text-xs font-bold inline-flex items-center gap-1 shadow-sm outline-none"
                              >
                                <ClipboardCheck size={14} /> 產生報告
                              </button>
                            </div>
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
                                            isChildForm={false}
                                            sortBySequence={sortBySequence}
                                          />
                                        </div>
                                        {/* 保留子配方的展開 */}
                                        {renderChildrenOrders(
                                          detailedOrdersMap[po.id].children,
                                        )}
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

      {printData && (
        <ProductionOrderPrintTemplate
          data={printData}
          type={printType}
          sortBySequence={sortBySequence}
        />
      )}
    </>
  );
}
