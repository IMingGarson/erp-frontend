import React, { useState, useEffect, useRef, useMemo } from "react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import {
  Printer,
  FileText,
  Search,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";

// ==========================================
// 輔助函數：將浮點數轉字串並移除結尾的 0 與小數點
// ==========================================
const formatDisplayNum = (val) => {
  if (val === null || val === undefined || val === "") return "";
  const num = parseFloat(val);
  if (isNaN(num)) return "";
  return parseFloat(num.toFixed(5)).toString();
};

// ==========================================
// 輔助函數：從規格字串萃取單位重量 (KG/單位)
// 支援格式："1KG*25包/箱", "10KG/桶", "0.5KG*10袋"
// ==========================================
const getProductWeightRatio = (spec) => {
  if (!spec) return 1;
  const match = spec.match(/([\d.]+)\s*KG/i);
  const packMatch = spec.match(/\*\s*([\d.]+)\s*[包袋罐瓶]/i);

  const w = match ? parseFloat(match[1]) : 1;
  const p = packMatch ? parseFloat(packMatch[1]) : 1;
  return w * p;
};

// ==========================================
// 列印專用 Template (包含 4 頁，完美版面比例)
// ==========================================
const RecallReportPrintTemplate = ({
  reportData,
  formData,
  recoveryRate,
  traceResults,
  selectedMaterial,
  isSimulation,
  activeTab,
}) => {
  if (!reportData) return null;

  // 1. 扁平化並「去重」所有生產單 (避免同一張單用兩批異常原料而重複出現)
  const uniqueOrdersMap = new Map();
  (traceResults || []).forEach((b) => {
    (b.trace_details?.orders || []).forEach((o) => {
      if (!uniqueOrdersMap.has(o.order_number)) {
        uniqueOrdersMap.set(o.order_number, {
          ...o,
          batch_numbers: [b.batch_number],
          expiration_dates: [b.expiration_date],
          used_qty_total: parseFloat(o.used_qty || 0),
        });
      } else {
        const existing = uniqueOrdersMap.get(o.order_number);
        if (!existing.batch_numbers.includes(b.batch_number)) {
          existing.batch_numbers.push(b.batch_number);
          existing.expiration_dates.push(b.expiration_date);
        }
        existing.used_qty_total += parseFloat(o.used_qty || 0);
      }
    });
  });
  const uniqueOrders = Array.from(uniqueOrdersMap.values());

  // 2. 扁平化下游銷貨單
  const downstreamShipments = uniqueOrders.flatMap((o) =>
    (o.delivery_notes || []).map((dn) => ({
      ...dn,
      product_code: o.product_code,
      product_name: o.product_name,
      spec: o.product_spec,
      target_qty: o.target_qty,
      actual_qty: o.actual_qty,
      order_created_at: o.order_created_at,
      expiration_date: o.expiration_dates[0],
      customer_code: dn.customer_info?.code || o.po_vendor_info?.code || "",
      customer_name: dn.customer_info?.name || o.po_vendor_info?.name || "",
      vendor_address:
        dn.customer_info?.address || o.po_vendor_info?.address || "",
      vendor_phone: dn.customer_info?.phone || o.po_vendor_info?.phone || "",
    })),
  );

  // 3. 取得不重複的下游廠商清單
  const uniqueVendors = Array.from(
    new Map(
      downstreamShipments
        .filter((s) => s.customer_code)
        .map((s) => [
          s.customer_code,
          {
            code: s.customer_code,
            name: s.customer_name,
            address: s.vendor_address,
            phone: s.vendor_phone,
          },
        ]),
    ).values(),
  );

  const todayStr = new Date().toISOString().split("T")[0].replace(/-/g, "/");

  return (
    <div className="w-full bg-white text-black font-sans mx-auto shadow-xl ring-1 ring-black/5 print:shadow-none print:ring-0 max-w-[210mm]">
      <style>
        {`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-force-block { display: flex !important; }
            .page-break { page-break-before: always; }
          }
        `}
      </style>

      {/* ========================================================= */}
      {/* 📄 頁面 1：基本資訊與統計看板 */}
      {/* ========================================================= */}
      <div
        className={`border-2 border-green-600 p-8 min-h-[297mm] relative flex-col bg-white ${activeTab === 0 ? "flex" : "hidden"} print-force-block`}
      >
        <table className="w-full border-collapse border-2 border-black text-center mb-2">
          <tbody>
            <tr>
              <td className="border-2 border-black w-32 h-20 align-middle">
                <div className="text-red-600 font-black text-5xl italic font-serif">
                  G
                </div>
              </td>
              <td className="border-2 border-black align-middle">
                <div className="text-2xl font-bold tracking-widest border-b-2 border-black py-1">
                  基香食品有限公司
                </div>
                <div className="text-2xl font-bold tracking-widest py-1">
                  產品回收計畫書
                </div>
              </td>
              <td className="border-2 border-black w-32 align-top text-left text-sm font-bold p-1">
                <div className="border-b border-black pb-1 mb-1">版次： 04</div>
                <div>頁次： 1</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="font-bold text-[#1f4e78] text-sm mb-0.5 mt-4">
          【責任廠商基本資訊】
        </div>
        <table className="w-full border-collapse border-2 border-black text-sm mb-4">
          <thead>
            <tr className="bg-[#1f4e78] text-white">
              <th className="border border-black px-2 py-1.5 w-40 font-bold">
                項目
              </th>
              <th className="border border-black px-2 py-1.5 font-bold text-left">
                填寫內容
              </th>
            </tr>
          </thead>
          <tbody className="font-bold text-slate-800 text-left">
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                責任廠商名稱
              </td>
              <td className="border border-black px-2 py-1.5">
                基香食品有限公司
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                責任廠商地址
              </td>
              <td className="border border-black px-2 py-1.5">
                桃園市觀音區崙坪里一鄰1-10號
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                責任廠商電話
              </td>
              <td className="border border-black px-2 py-1.5">03-4988228</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                預定完成回收期限
              </td>
              <td className="border border-black px-2 py-1.5 text-slate-500 font-normal">
                {formData.deadline || ""}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                回收保管地點
              </td>
              <td className="border border-black px-2 py-1.5">
                桃園市觀音區崙坪里一鄰1-10號
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                負責保管之人員
              </td>
              <td className="border border-black px-2 py-1.5">余家旺</td>
            </tr>
            {[...Array(6)].map((_, i) => (
              <tr key={i} className="h-7">
                <td className="border border-black bg-slate-100"></td>
                <td className="border border-black"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="font-bold text-[#1f4e78] text-sm mb-0.5">
          【回收進度統計看板】
        </div>
        <table className="w-full border-collapse border-2 border-black text-sm text-left">
          <thead>
            <tr className="bg-[#1f4e78] text-white">
              <th className="border border-black px-2 py-1.5 w-40 font-bold">
                關鍵指標 (Kg)
              </th>
              <th className="border border-black px-2 py-1.5 font-bold w-48 text-center">
                當前數值
              </th>
              <th className="border border-black px-2 py-1.5 font-bold">
                計算公式 / 來源說明
              </th>
            </tr>
          </thead>
          <tbody className="font-bold text-slate-800">
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                回收原料總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-mono">
                {formatDisplayNum(reportData.total_raw_recalled)}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                異常原料進貨總量(kg)
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                尚未使用原料總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-mono">
                {formatDisplayNum(reportData.unused_raw_total)}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                異常原料在庫總量(kg)
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                產品生產總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-mono">
                {formatDisplayNum(reportData.total_produced_product)}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                各品項產品之總量(kg)
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                尚未出貨產品總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-mono">
                {formatDisplayNum(reportData.total_in_stock_product)}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                各品項在庫總量(kg)
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                下游總出貨總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center text-red-600 font-mono">
                {formatDisplayNum(reportData.total_shipped_product)}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                已出貨至下游廠商之總量
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                實際回收總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-mono">
                {formData.actualRecovered
                  ? formatDisplayNum(formData.actualRecovered)
                  : ""}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                各品項實際收回之重量/容量
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                整體回收率 (%)
              </td>
              <td className="border border-black px-2 py-1.5 text-center text-red-600 font-mono">
                {recoveryRate !== null
                  ? `${formatDisplayNum(recoveryRate)}%`
                  : ""}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                (產品實際回收總量+庫存) / 總生產量
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100 align-top">
                最終處置方式
              </td>
              <td
                className="border border-black px-2 py-1.5 align-top"
                colSpan={2}
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-3 h-3 border border-black mt-1 bg-white flex items-center justify-center shrink-0">
                    {formData.disposalMethod === "MEASURE" && "✓"}
                  </div>
                  <span className="text-sm font-normal">
                    採行消毒、改製或其他適當安全措施者，應載明所採用之措施方法與實施程序，及預定完成日期。
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-3 h-3 border border-black mt-1 bg-white flex items-center justify-center shrink-0">
                    {formData.disposalMethod === "DESTROY" && "✓"}
                  </div>
                  <span className="text-sm font-normal">
                    銷毀者，應載明銷毀之方式與期限，及銷毀產品之重量或容量。
                  </span>
                </div>
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 bg-slate-100">
                待銷毀產品總量
              </td>
              <td className="border border-black px-2 py-1.5 text-center font-mono">
                {formData.destroyAmount
                  ? formatDisplayNum(formData.destroyAmount)
                  : ""}
              </td>
              <td className="border border-black px-2 py-1.5 text-xs font-normal">
                最終處置方式為「銷毀」之重量
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ========================================================= */}
      {/* 📄 頁面 2：回收產品與庫存資料 */}
      {/* ========================================================= */}
      <div
        className={`page-break border-2 border-green-600 p-8 min-h-[297mm] relative flex-col bg-white ${activeTab === 1 ? "flex" : "hidden"} print-force-block`}
      >
        <table className="w-full border-collapse border-2 border-black text-center mb-2">
          <tbody>
            <tr>
              <td className="border-2 border-black w-32 h-20 align-middle">
                <div className="text-red-600 font-black text-5xl italic font-serif">
                  G
                </div>
              </td>
              <td className="border-2 border-black align-middle">
                <div className="text-2xl font-bold tracking-widest border-b-2 border-black py-1">
                  基香食品有限公司
                </div>
                <div className="text-2xl font-bold tracking-widest py-1">
                  產品回收計畫書
                </div>
              </td>
              <td className="border-2 border-black w-32 align-top text-left text-sm font-bold p-1">
                <div className="border-b border-black pb-1 mb-1">版次： 04</div>
                <div>頁次： 2</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="text-lg font-bold text-[#1f4e78] mb-2 mt-4 text-left">
          回收產品與庫存基本明細
        </div>

        <table className="w-full border-collapse border border-black text-xs text-center">
          <thead className="bg-[#1f4e78] text-white">
            <tr>
              <th className="border border-black px-1 py-1.5 font-bold w-[9%]">
                產品編號
              </th>
              <th className="border border-black px-1 py-1.5 font-bold w-[20%]">
                回收產品名稱
              </th>
              <th className="border border-black px-1 py-1.5 font-bold w-[16%]">
                包裝規格
              </th>
              <th className="border border-black px-1 py-1.5 font-bold w-[9%]">
                生產批號
              </th>
              <th className="border border-black px-1 py-1.5 font-bold w-[10%]">
                銷貨單號
              </th>
              <th className="border border-black px-0.5 py-1.5 font-bold w-[4%] leading-tight">
                數量
                <br />
                (單位)
              </th>
              <th className="border border-black px-0.5 py-1.5 font-bold w-[5%]">
                出貨量
                <br />
                (kg)
              </th>
              <th className="border border-black px-1 py-1.5 font-bold w-[9%]">
                製令單號
              </th>
              <th className="border border-black px-0.5 py-1.5 font-bold w-[5%]">
                生產量
                <br />
                (kg)
              </th>
              <th className="border border-black px-0.5 py-1.5 font-bold w-[5%] leading-tight">
                原料用量
                <br />
                (kg)
              </th>
              <th className="border border-black px-0.5 py-1.5 font-bold w-[5%] leading-tight relative">
                誤差量
                <br />
                (kg)
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 text-black whitespace-nowrap font-normal text-[10px]">
                  *誤差值為生產數量-銷貨數量
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="font-bold text-slate-800">
            {(() => {
              const flattenedRows = [];
              let sumDnUnits = 0;
              let sumDnKg = 0;
              let sumProducedKg = 0;
              let sumUsedKg = 0;

              uniqueOrders.forEach((po) => {
                const weightRatio = getProductWeightRatio(po.product_spec);
                const producedQtyUnits = parseFloat(
                  po.actual_qty || po.target_qty || 0,
                );
                const producedKg = producedQtyUnits * weightRatio;
                const usedKg = po.used_qty_total;

                sumProducedKg += producedKg;
                sumUsedKg += usedKg;

                const deliveries =
                  po.delivery_notes && po.delivery_notes.length > 0
                    ? po.delivery_notes
                    : [null];

                let poDnUnits = 0;
                deliveries.forEach((dn) => {
                  if (dn) poDnUnits += parseFloat(dn.quantity || 0);
                });
                const poDnKg = poDnUnits * weightRatio;
                const errorKg = producedKg - poDnKg;

                deliveries.forEach((dn, dnIdx) => {
                  const dnUnits = dn ? parseFloat(dn.quantity || 0) : 0;
                  const dnKg = dnUnits * weightRatio;

                  if (dn) {
                    sumDnUnits += dnUnits;
                    sumDnKg += dnKg;
                  }

                  flattenedRows.push(
                    <tr
                      key={`${po.order_number}-${dn?.note_number || "none"}-${dnIdx}`}
                      className="h-8"
                    >
                      <td className="border border-slate-300 px-1">
                        {po.product_code || "-"}
                      </td>
                      <td className="border border-slate-300 px-1 text-left break-all">
                        {po.product_name || "-"}
                      </td>
                      <td className="border border-slate-300 px-1 text-left break-all text-[10px]">
                        {po.product_spec || "-"}
                      </td>
                      <td className="border border-slate-300 px-1 text-[10px]">
                        {po.batch_numbers.join(", ")}
                      </td>
                      <td className="border border-slate-300 px-1 font-mono">
                        {dn ? dn.note_number : "-"}
                      </td>
                      <td className="border border-slate-300 px-1 font-mono">
                        {dn ? formatDisplayNum(dnUnits) : "-"}
                      </td>
                      <td className="border border-slate-300 px-1 font-mono">
                        {dn ? formatDisplayNum(dnKg) : "-"}
                      </td>
                      <td className="border border-slate-300 px-1 font-mono">
                        {po.order_number || "-"}
                      </td>
                      <td className="border border-slate-300 px-1 font-mono">
                        {dnIdx === 0 ? formatDisplayNum(producedKg) : ""}
                      </td>
                      <td className="border border-slate-300 px-1 font-mono">
                        {dnIdx === 0 ? formatDisplayNum(usedKg) : ""}
                      </td>
                      <td className="border border-slate-300 px-1 font-mono text-red-600">
                        {dnIdx === 0 ? formatDisplayNum(errorKg) : ""}
                      </td>
                    </tr>,
                  );
                });
              });

              if (flattenedRows.length === 0) {
                flattenedRows.push(
                  <tr key="empty" className="h-8 text-slate-500">
                    <td colSpan="11" className="border border-slate-300 py-4">
                      無生產/出貨資料
                    </td>
                  </tr>,
                );
              }

              const padCount = Math.max(0, 15 - flattenedRows.length);
              for (let i = 0; i < padCount; i++) {
                flattenedRows.push(
                  <tr key={`pad-${i}`} className="h-8">
                    {[...Array(11)].map((_, col) => (
                      <td
                        key={col}
                        className="border border-slate-300 px-1"
                      ></td>
                    ))}
                  </tr>,
                );
              }

              flattenedRows.push(
                <tr
                  key="footer-total"
                  className="bg-[#1f4e78] text-white font-bold h-8"
                >
                  <td
                    colSpan="5"
                    className="border border-black text-center tracking-widest"
                  >
                    合 計
                  </td>
                  <td className="border border-black">
                    {sumDnUnits ? formatDisplayNum(sumDnUnits) : "-"}
                  </td>
                  <td className="border border-black">
                    {sumDnKg ? formatDisplayNum(sumDnKg) : "-"}
                  </td>
                  <td className="border border-black border-t-0"></td>
                  <td className="border border-black">
                    {formatDisplayNum(sumProducedKg)}
                  </td>
                  <td className="border border-black">
                    {formatDisplayNum(sumUsedKg)}
                  </td>
                  <td className="border border-black"></td>
                </tr>,
              );

              return flattenedRows;
            })()}
          </tbody>
        </table>
      </div>

      {/* ========================================================= */}
      {/* 📄 頁面 3：下游廠商出貨與聯絡明細 */}
      {/* ========================================================= */}
      <div
        className={`page-break border-2 border-green-600 p-8 min-h-[297mm] relative flex-col bg-white ${activeTab === 2 ? "flex" : "hidden"} print-force-block`}
      >
        <table className="w-full border-collapse border-2 border-black text-center mb-2">
          <tbody>
            <tr>
              <td className="border-2 border-black w-32 h-20 align-middle">
                <div className="text-red-600 font-black text-5xl italic font-serif">
                  G
                </div>
              </td>
              <td className="border-2 border-black align-middle">
                <div className="text-2xl font-bold tracking-widest border-b-2 border-black py-1">
                  基香食品有限公司
                </div>
                <div className="text-2xl font-bold tracking-widest py-1">
                  產品回收計畫書
                </div>
              </td>
              <td className="border-2 border-black w-32 align-top text-left text-sm font-bold p-1">
                <div className="border-b border-black pb-1 mb-1">版次： 04</div>
                <div>頁次： 3</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="text-lg font-bold text-[#1f4e78] mb-2 mt-4 text-left">
          下游廠商出貨與聯絡明細
        </div>

        <table className="w-full border-collapse border border-black text-[10px] text-center">
          <thead className="bg-[#1f4e78] text-white">
            <tr className="bg-white text-[#1f4e78]">
              <th colSpan="8" className="border border-slate-300"></th>
              <th
                colSpan="2"
                className="border border-slate-300 font-bold py-1"
              >
                出貨
              </th>
              <th
                colSpan="2"
                className="border border-slate-300 font-bold py-1"
              >
                收貨
              </th>
              <th
                colSpan="2"
                className="border border-slate-300 font-bold py-1"
              >
                預計回收
              </th>
              <th
                colSpan="2"
                className="border border-slate-300 font-bold py-1"
              >
                實際回廠
              </th>
            </tr>
            <tr>
              <th className="border border-black px-1 py-1.5 font-bold w-[7%]">
                客戶編號
              </th>
              <th className="border border-black px-1 py-1.5 font-bold w-[14%]">
                客戶名稱
              </th>
              <th className="border border-black px-1 py-1.5 font-bold w-[16%]">
                地址
              </th>
              <th className="border border-black px-1 py-1.5 font-bold w-[9%]">
                聯絡電話
              </th>
              <th className="border border-black px-1 py-1.5 font-bold w-[8%]">
                出貨日期
              </th>
              <th className="border border-black px-1 py-1.5 font-bold w-[14%]">
                出貨產品名稱
              </th>
              <th className="border border-black px-1 py-1.5 font-bold w-[8%]">
                製造日期
              </th>
              <th className="border border-black px-1 py-1.5 font-bold w-[8%]">
                有效期限
              </th>
              <th className="border border-black px-0 py-1.5 font-bold w-[2%] text-[9px] leading-tight">
                數量
                <br />
                (單位)
              </th>
              <th className="border border-black px-0 py-1.5 font-bold w-[2%] text-[9px] leading-tight">
                數量
                <br />
                (kg)
              </th>
              <th className="border border-black px-0 py-1.5 font-bold w-[2%] text-[9px] leading-tight">
                數量
                <br />
                (單位)
              </th>
              <th className="border border-black px-0 py-1.5 font-bold w-[2%] text-[9px] leading-tight">
                數量
                <br />
                (kg)
              </th>
              <th className="border border-black px-0 py-1.5 font-bold w-[2%] text-[9px] leading-tight">
                數量
                <br />
                (單位)
              </th>
              <th className="border border-black px-0 py-1.5 font-bold w-[2%] text-[9px] leading-tight">
                數量
                <br />
                (kg)
              </th>
              <th className="border border-black px-0 py-1.5 font-bold w-[2%] text-[9px] leading-tight">
                數量
                <br />
                (單位)
              </th>
              <th className="border border-black px-0 py-1.5 font-bold w-[2%] text-[9px] leading-tight">
                數量
                <br />
                (kg)
              </th>
            </tr>
          </thead>
          <tbody className="font-bold text-slate-800">
            {downstreamShipments.map((ship, idx) => {
              const weightRatio = getProductWeightRatio(ship.spec);
              const dnUnits = parseFloat(ship.quantity || 0);
              const dnKg = dnUnits * weightRatio;

              return (
                <tr key={idx} className="h-8">
                  <td className="border border-slate-300 px-1">
                    {ship.customer_code || "-"}
                  </td>
                  <td className="border border-slate-300 px-1 text-left break-words">
                    {ship.customer_name || "-"}
                  </td>
                  <td className="border border-slate-300 px-1 text-left break-words">
                    {ship.vendor_address || "-"}
                  </td>
                  <td className="border border-slate-300 px-1">
                    {ship.vendor_phone || "-"}
                  </td>
                  <td className="border border-slate-300 px-1 font-mono">
                    {ship.note_date || "-"}
                  </td>
                  <td className="border border-slate-300 px-1 text-left break-words">
                    {ship.product_name}
                  </td>
                  <td className="border border-slate-300 px-1 font-mono">
                    {ship.order_created_at?.split(" ")[0] || "-"}
                  </td>
                  <td className="border border-slate-300 px-1 font-mono">
                    {ship.expiration_date || "-"}
                  </td>
                  <td className="border border-slate-300 px-0 font-mono">
                    {formatDisplayNum(dnUnits)}
                  </td>
                  <td className="border border-slate-300 px-0 font-mono text-blue-700 bg-slate-50">
                    {formatDisplayNum(dnKg)}
                  </td>
                  <td className="border border-slate-300 px-0"></td>
                  <td className="border border-slate-300 px-0"></td>
                  <td className="border border-slate-300 px-0"></td>
                  <td className="border border-slate-300 px-0"></td>
                  <td className="border border-slate-300 px-0"></td>
                  <td className="border border-slate-300 px-0"></td>
                </tr>
              );
            })}
            {[...Array(Math.max(0, 15 - downstreamShipments.length))].map(
              (_, i) => (
                <tr key={`pad-${i}`} className="h-8">
                  {[...Array(16)].map((_, col) => (
                    <td key={col} className="border border-slate-300 px-1"></td>
                  ))}
                </tr>
              ),
            )}
            <tr className="bg-[#1f4e78] text-white font-bold h-8">
              <td
                colSpan="8"
                className="border border-black text-center tracking-widest"
              >
                總計
              </td>
              <td className="border border-black bg-white text-red-600">
                {formatDisplayNum(
                  downstreamShipments.reduce(
                    (sum, s) => sum + (parseFloat(s.quantity) || 0),
                    0,
                  ),
                )}
              </td>
              <td className="border border-black bg-white text-red-600">
                {formatDisplayNum(
                  downstreamShipments.reduce(
                    (sum, s) =>
                      sum +
                      parseFloat(s.quantity || 0) *
                        getProductWeightRatio(s.spec),
                    0,
                  ),
                )}
              </td>
              <td className="border border-black bg-white text-red-600"></td>
              <td className="border border-black bg-white text-red-600"></td>
              <td className="border border-black bg-white text-red-600"></td>
              <td className="border border-black bg-white text-red-600"></td>
              <td className="border border-black bg-white text-red-600"></td>
              <td className="border border-black bg-white text-red-600"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ========================================================= */}
      {/* 📄 頁面 4：產品回收通知單 (依廠商迴圈產生多頁) */}
      {/* ========================================================= */}
      {uniqueVendors.length > 0 && (
        <div
          className={`page-break relative flex-col bg-slate-100 ${activeTab === 3 ? "flex" : "hidden"} print-force-block print:bg-white`}
        >
          {uniqueVendors.map((vendor, vIdx) => {
            const vendorShipments = downstreamShipments.filter(
              (s) => s.customer_code === vendor.code,
            );
            return (
              <div
                key={`notice-${vIdx}`}
                className="bg-white p-8 min-h-[297mm] flex flex-col mb-4 print:mb-0 border border-slate-200 print:border-none shadow-sm print:shadow-none"
              >
                <table className="w-full border-collapse border-2 border-black text-sm mb-0">
                  <tbody>
                    <tr>
                      <td
                        rowSpan="2"
                        className="border border-black w-32 h-20 align-middle text-center"
                      >
                        <div className="text-red-600 font-black text-5xl italic font-serif">
                          G
                        </div>
                      </td>
                      <td className="border border-black align-middle text-center text-2xl font-bold tracking-widest">
                        基香食品有限公司
                      </td>
                      <td className="border border-black align-middle pl-2 w-48 font-bold">
                        版次： <span className="ml-4">04</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black align-middle text-center text-2xl font-bold tracking-widest">
                        產品回收通知單
                      </td>
                      <td className="border border-black align-middle pl-2 w-48 font-bold">
                        頁次：{" "}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="w-full border-collapse border-x-2 border-black text-sm font-bold">
                  <tbody>
                    <tr>
                      <td className="border border-black px-2 py-1 text-blue-900 w-[15%]">
                        填表日期：
                      </td>
                      <td className="border border-black px-2 py-1 w-[35%]">
                        {todayStr}
                      </td>
                      <td className="border border-black px-2 py-1 text-blue-900 w-[15%]">
                        編號：
                      </td>
                      <td className="border border-black px-2 py-1 text-blue-900 w-[35%]">
                        26-{String(vIdx + 1).padStart(3, "0")}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black px-2 py-1 text-blue-900">
                        客戶名稱：
                      </td>
                      <td className="border border-black px-2 py-1">
                        {vendor.name}
                      </td>
                      <td className="border border-black px-2 py-1 text-blue-900">
                        連絡人：
                      </td>
                      <td className="border border-black px-2 py-1"></td>
                    </tr>
                    <tr>
                      <td className="border border-black px-2 py-1 text-blue-900">
                        貨品貯存位置：
                      </td>
                      <td className="border border-black px-2 py-1">
                        {vendor.address}
                      </td>
                      <td className="border border-black px-2 py-1 text-blue-900">
                        緊急連絡電話：
                      </td>
                      <td className="border border-black px-2 py-1">
                        {vendor.phone}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="w-full border-collapse border-x-2 border-black text-sm font-bold">
                  <tbody>
                    <tr>
                      <td className="border border-black px-2 py-2 text-blue-900 w-[15%] align-top">
                        回收原因：
                      </td>
                      <td className="border border-black px-2 py-2 text-[#1f4e78] tracking-wider leading-relaxed">
                        {isSimulation && <div>“廠內模擬回收演練”</div>}
                        <div>
                          供應商通知產品中 {selectedMaterial?.name || "原料"}{" "}
                          抽驗發現疑慮，需進行招回。
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="w-full border-collapse border-2 border-black text-sm text-center mb-0">
                  <thead className="bg-[#1f4e78] font-bold text-white tracking-widest">
                    <tr>
                      <td
                        rowSpan="2"
                        className="border border-black w-[5%] bg-white text-black"
                      >
                        NO
                      </td>
                      <td
                        colSpan="3"
                        className="border border-black text-blue-900 bg-white"
                      >
                        廠內填寫
                      </td>
                      <td
                        rowSpan="2"
                        className="border border-black text-white w-[12%]"
                      >
                        發貨數量(Kg)
                      </td>
                      <td
                        colSpan="2"
                        className="border border-black bg-white text-black"
                      >
                        客戶填寫
                      </td>
                      <td
                        rowSpan="2"
                        className="border border-black bg-white text-black w-[12%]"
                      >
                        備註
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black w-[35%]">
                        產 品 名 稱
                      </td>
                      <td className="border border-black w-[12%]">製造日期</td>
                      <td className="border border-black w-[12%]">有效期限</td>
                      <td className="border border-black w-[12%]">
                        收貨數量(Kg)
                      </td>
                      <td className="border border-black w-[12%]">
                        庫存數量(Kg)
                      </td>
                    </tr>
                  </thead>
                  <tbody className="font-bold text-black bg-white">
                    {vendorShipments.map((vp, pIdx) => {
                      const vpKg =
                        parseFloat(vp.quantity || 0) *
                        getProductWeightRatio(vp.spec);
                      return (
                        <tr key={pIdx} className="h-8">
                          <td className="border border-black">{pIdx + 1}</td>
                          <td className="border border-black px-1 text-left break-words">
                            {vp.product_name}
                          </td>
                          <td className="border border-black font-mono">
                            {vp.order_created_at?.split(" ")[0] || "-"}
                          </td>
                          <td className="border border-black font-mono">
                            {vp.expiration_date || "-"}
                          </td>
                          <td className="border border-black font-mono">
                            {formatDisplayNum(vpKg)}
                          </td>
                          <td className="border border-black bg-slate-100"></td>
                          <td className="border border-black bg-slate-100"></td>
                          <td className="border border-black text-xs text-slate-500 bg-slate-100"></td>
                        </tr>
                      );
                    })}
                    {[...Array(Math.max(0, 12 - vendorShipments.length))].map(
                      (_, i) => (
                        <tr key={`pad-${i}`} className="h-8">
                          <td className="border border-black"></td>
                          <td className="border border-black"></td>
                          <td className="border border-black"></td>
                          <td className="border border-black"></td>
                          <td className="border border-black"></td>
                          <td className="border border-black bg-slate-100"></td>
                          <td className="border border-black bg-slate-100"></td>
                          <td className="border border-black bg-slate-100"></td>
                        </tr>
                      ),
                    )}
                    <tr className="h-8">
                      <td
                        colSpan="4"
                        className="border border-black px-1 py-1 tracking-widest text-center"
                      >
                        合 計
                      </td>
                      <td className="border border-black px-1 py-1">
                        {formatDisplayNum(
                          vendorShipments.reduce(
                            (sum, vp) =>
                              sum +
                              parseFloat(vp.quantity || 0) *
                                getProductWeightRatio(vp.spec),
                            0,
                          ),
                        )}
                      </td>
                      <td className="border border-black px-1 py-1 bg-slate-100"></td>
                      <td className="border border-black px-1 py-1 bg-slate-100"></td>
                      <td className="border border-black px-1 py-1 bg-slate-100"></td>
                    </tr>
                  </tbody>
                </table>

                <table className="w-full border-collapse border-x-2 border-b-2 border-black text-sm font-bold bg-white text-center">
                  <tbody>
                    <tr className="h-10">
                      <td className="border border-black w-24">製表：</td>
                      <td className="border border-black"></td>
                      <td className="border border-black w-32">客戶簽名：</td>
                      <td className="border border-black bg-slate-100 w-1/3"></td>
                    </tr>
                  </tbody>
                </table>

                <div className="border-x-2 border-b-2 border-black p-1 text-sm font-bold min-h-[4rem]">
                  說明：
                  <br />
                  <span className="ml-4">
                    1.
                    以上客戶及聯絡人名稱、貨品貯存位置及聯繫電話若有異動，請於回傳時更正，感謝。
                  </span>
                </div>

                <table className="w-full border-collapse border-x-2 border-b-2 border-black text-sm font-bold bg-white text-left">
                  <tbody>
                    <tr className="h-8">
                      <td colSpan="4" className="border border-black px-2">
                        敬呈
                      </td>
                    </tr>
                    <tr className="h-8">
                      <td className="border border-black px-2 w-24">
                        總經理：
                      </td>
                      <td colSpan="3" className="border border-black"></td>
                    </tr>
                    <tr className="h-8">
                      <td colSpan="4" className="border border-black px-2">
                        敬會：
                      </td>
                    </tr>
                    <tr className="h-10">
                      <td className="border border-black px-2">總務部：</td>
                      <td className="border border-black px-2 w-1/3">
                        生產部：
                      </td>
                      <td
                        className="border border-black px-2 w-1/3"
                        colSpan="2"
                      >
                        品保部：
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {uniqueVendors.length === 0 && (
        <div
          className={`page-break border-2 border-green-600 p-8 min-h-[297mm] flex-col items-center justify-center bg-slate-50 ${activeTab === 3 ? "flex" : "hidden"} print-force-block`}
        >
          <div className="text-xl font-bold text-slate-400">
            目前尚無出貨至下游廠商之紀錄，不需產生回收通知單。
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 主頁面 Component
// ==========================================
const TracePage = () => {
  const [materials, setMaterials] = useState([]);
  const [traceResults, setTraceResults] = useState([]);
  const [reportData, setReportData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [expandedBatches, setExpandedBatches] = useState({});
  const [isSimulation, setIsSimulation] = useState(true);

  const [viewMode, setViewMode] = useState("search");
  const [activePreviewTab, setActivePreviewTab] = useState(0);

  const [formData, setFormData] = useState({
    deadline: "",
    actualRecovered: "",
    disposalMethod: "",
    destroyAmount: "",
  });

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
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await fetchWithAuth("/api/materials");
        if (res.ok) {
          const json = await res.json();
          setMaterials(json.data || []);
        }
      } catch (err) {
        console.error("無法取得物料清單", err);
      }
    };
    fetchMaterials();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target))
        setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredMaterials = useMemo(() => {
    if (!searchTerm) return materials;
    const lowerTerm = searchTerm.toLowerCase();
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerTerm) ||
        m.code.toLowerCase().includes(lowerTerm),
    );
  }, [materials, searchTerm]);

  const toggleExpand = (batchId) => {
    setExpandedBatches((prev) => ({ ...prev, [batchId]: !prev[batchId] }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!selectedMaterial)
      return showAlert(
        "查詢條件為空",
        "請先從下拉選單中選擇要追溯的物料。",
        "warning",
      );

    setLoading(true);
    setError(null);
    setExpandedBatches({});
    setReportData(null);
    setTraceResults([]);

    try {
      const reportUrl = `/api/abnormality_trace/recall_report?material_id=${selectedMaterial.id}`;
      const reportRes = await fetchWithAuth(reportUrl, { method: "GET" });

      if (!reportRes.ok) throw new Error("無法取得異常追溯指標資料");
      const reportJson = await reportRes.json();
      setReportData(reportJson.data || reportJson);

      const detailUrl = `/api/batches/trace?q=${encodeURIComponent(selectedMaterial.code)}`;
      const detailRes = await fetchWithAuth(detailUrl, { method: "GET" });
      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        const dataList = detailJson.data || [];
        setTraceResults(dataList);
        if (dataList.length === 1)
          setExpandedBatches({ [dataList[0].batch_id]: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedMaterial(null);
    setSearchTerm("");
    setReportData(null);
    setTraceResults([]);
    setError(null);
    setExpandedBatches({});
    setFormData({
      deadline: "",
      actualRecovered: "",
      disposalMethod: "",
      destroyAmount: "",
    });
  };

  const handlePrintAction = () => {
    setTimeout(() => {
      const originalTitle = document.title;
      document.title = `產品回收計畫書_${selectedMaterial?.name || ""}`;
      window.print();
      document.title = originalTitle;
    }, 150);
  };

  const recoveryRate = useMemo(() => {
    if (!reportData) return null;
    if (
      formData.actualRecovered === "" ||
      isNaN(parseFloat(formData.actualRecovered))
    )
      return null;

    const totalProduced = parseFloat(reportData.total_produced_product) || 0;
    const inStock = parseFloat(reportData.total_in_stock_product) || 0;
    const actualRec = parseFloat(formData.actualRecovered) || 0;

    if (totalProduced <= 0) return 0;
    return ((actualRec + inStock) / totalProduced) * 100;
  }, [reportData, formData.actualRecovered]);

  // ==========================================
  // 渲染: 預覽全螢幕模式 (Preview Mode)
  // ==========================================
  if (viewMode === "preview") {
    const tabs = [
      "基本資訊與統計",
      "回收與庫存明細",
      "下游出貨明細",
      "產品回收通知單",
    ];
    return (
      <div className="min-h-screen bg-slate-200 flex flex-col font-sans">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0 print:hidden shadow-sm z-10 relative">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setViewMode("search")}
              className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold transition-colors"
            >
              <ArrowLeft size={18} /> 返回設定頁
            </button>
            <div className="h-6 w-px bg-slate-300"></div>
            <h2 className="text-xl font-bold text-[#1f4e78] tracking-widest flex items-center gap-2">
              <FileText size={20} /> 產品回收計畫書預覽
            </h2>
          </div>
          <button
            onClick={handlePrintAction}
            className="px-6 py-2 bg-[#1f4e78] hover:bg-blue-900 text-white font-bold rounded shadow-md transition-colors flex items-center gap-2"
          >
            <Printer size={16} /> 確認列印全卷
          </button>
        </div>

        <div className="bg-white border-b border-slate-200 px-8 flex gap-8 shrink-0 print:hidden shadow-sm z-0 relative">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActivePreviewTab(idx)}
              className={`py-4 px-2 border-b-[3px] font-bold transition-colors ${
                activePreviewTab === idx
                  ? "border-[#1f4e78] text-[#1f4e78]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {idx + 1}. {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible flex justify-center pb-24">
          <RecallReportPrintTemplate
            reportData={reportData}
            formData={formData}
            recoveryRate={recoveryRate}
            traceResults={traceResults}
            selectedMaterial={selectedMaterial}
            isSimulation={isSimulation}
            activeTab={activePreviewTab}
          />
        </div>
      </div>
    );
  }

  // ==========================================
  // 渲染: 搜尋與設定模式 (Search Mode)
  // ==========================================
  return (
    <>
      <div className="p-6 md:p-8 max-w-7xl mx-auto bg-blue-50/20 min-h-screen font-sans relative text-slate-900 print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-4 border-slate-200 pb-4">
          <h2 className="text-3xl font-black text-black tracking-tight flex items-center gap-2">
            追蹤追溯
          </h2>
        </div>

        <div className="bg-blue-50/80 text-blue-800 text-sm p-4 rounded-2xl mb-6 border border-blue-100/50 shadow-sm">
          <p className="flex items-center gap-2 font-bold mb-2">
            <span className="text-lg leading-none">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
            <li>
              條列系統中所有原物料的<strong>批號、庫存</strong>狀態。
            </li>
            <li>
              支援以批號代碼、物料名稱進行<strong>搜尋資料</strong>
              ，產出回收計畫書 4 大報表。
            </li>
          </ul>
        </div>

        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row gap-3 w-full items-center p-4 bg-white rounded-xl shadow-md border border-blue-100 mb-6"
        >
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm font-bold text-slate-700 whitespace-nowrap">
              模擬演練
            </label>
            <select
              value={isSimulation ? "YES" : "NO"}
              onChange={(e) => setIsSimulation(e.target.value === "YES")}
              className="border border-slate-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-blue-50 bg-slate-50 cursor-pointer font-bold"
            >
              <option value="YES">是</option>
              <option value="NO">否</option>
            </select>
          </div>

          <div className="relative w-full sm:flex-1" ref={dropdownRef}>
            <div
              className={`flex items-center justify-between w-full border ${isDropdownOpen ? "border-blue-500 ring-2 ring-blue-100" : "border-blue-200"} rounded-md px-4 py-2.5 cursor-pointer bg-blue-50/10 hover:bg-white transition-all`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Search size={16} className="text-slate-400 flex-shrink-0" />
                <span
                  className={`truncate text-sm font-mono ${selectedMaterial ? "text-slate-800 font-bold" : "text-slate-400"}`}
                >
                  {selectedMaterial
                    ? `[${selectedMaterial.code}] ${selectedMaterial.name}`
                    : "點擊選擇原物料或輸入關鍵字搜尋..."}
                </span>
              </div>
              <ChevronDown
                size={18}
                className="text-slate-400 flex-shrink-0 ml-2"
              />
            </div>

            {isDropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden flex flex-col">
                <div className="p-2 border-b border-slate-100 bg-slate-50">
                  <input
                    type="text"
                    autoFocus
                    placeholder="輸入關鍵字..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                  {filteredMaterials.length > 0 ? (
                    filteredMaterials.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedMaterial(m);
                          setIsDropdownOpen(false);
                          setSearchTerm("");
                        }}
                        className="px-3 py-2.5 text-sm hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                      >
                        <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">
                          {m.code}
                        </span>
                        <span className="truncate text-slate-700 font-bold">
                          {m.name}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-slate-400 text-sm">
                      無相符資料
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="submit"
              disabled={loading || !selectedMaterial}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md shadow-sm transition-colors text-sm font-bold whitespace-nowrap flex-1 sm:flex-none disabled:opacity-50"
            >
              {loading ? "追溯中..." : "搜尋"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium whitespace-nowrap shadow-sm"
            >
              清除
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 mb-6 text-red-900 bg-red-50 rounded-lg border border-red-200 font-bold shadow-sm">
            ⚠️ 提示：{error}
          </div>
        )}

        {reportData && (
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="bg-[#1f4e78] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">
                1
              </span>{" "}
              指標內容設定
            </h3>
            <div className="bg-white border border-blue-200 rounded-xl shadow-lg overflow-hidden relative">
              <div className="overflow-x-auto pb-20">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#1f4e78] text-white">
                      <th className="px-4 py-3 font-bold w-48 border border-slate-300">
                        關鍵指標 (Kg)
                      </th>
                      <th className="px-4 py-3 font-bold w-48 text-center border border-slate-300">
                        當前數值
                      </th>
                      <th className="px-4 py-3 font-bold border border-slate-300">
                        計算公式 / 來源說明
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-bold text-slate-800">
                    <tr className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-4 py-3 bg-slate-50">
                        回收原料總量
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-center font-mono text-lg text-blue-600">
                        {formatDisplayNum(reportData.total_raw_recalled)}
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-xs font-normal text-slate-500">
                        異常原料進貨總量(kg)
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-4 py-3 bg-slate-50">
                        尚未使用原料總量
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-center font-mono text-lg text-blue-600">
                        {formatDisplayNum(reportData.unused_raw_total)}
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-xs font-normal text-slate-500">
                        異常原料在庫總量(kg)
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-4 py-3 bg-slate-50">
                        產品生產總量
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-center font-mono text-lg text-blue-600">
                        {formatDisplayNum(reportData.total_produced_product)}
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-xs font-normal text-slate-500">
                        各品項產品之總量(kg)
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-4 py-3 bg-slate-50">
                        尚未出貨產品總量
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-center font-mono text-lg text-blue-600">
                        {formatDisplayNum(reportData.total_in_stock_product)}
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-xs font-normal text-slate-500">
                        各品項在庫總量(kg)
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-4 py-3 bg-slate-50">
                        下游總出貨總量
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-center text-red-600 font-mono text-lg">
                        {formatDisplayNum(reportData.total_shipped_product)}
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-xs font-normal text-slate-500">
                        已出貨至下游廠商之總量
                      </td>
                    </tr>
                    <tr className="bg-yellow-50/30">
                      <td className="border border-slate-300 px-4 py-3 bg-yellow-100/50 text-yellow-900">
                        實際回收總量 <span className="text-red-500">*</span>
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="輸入回收 Kg"
                          value={formData.actualRecovered}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              actualRecovered: e.target.value,
                            })
                          }
                          className="w-full max-w-[140px] px-3 py-2 border-2 border-yellow-400 rounded-md font-mono text-base font-black text-center focus:outline-none focus:border-blue-500 shadow-sm"
                        />
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-xs font-normal text-slate-500">
                        各品項實際收回之重量/容量
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-4 py-3 bg-slate-50">
                        整體回收率 (%)
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-center text-red-600 font-mono text-xl">
                        {recoveryRate !== null
                          ? `${formatDisplayNum(recoveryRate)}%`
                          : ""}
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-xs font-normal text-slate-500">
                        (產品實際回收總量+庫存) / 總生產量
                      </td>
                    </tr>
                    <tr className="bg-yellow-50/30">
                      <td className="border border-slate-300 px-4 py-3 bg-yellow-100/50 text-yellow-900 align-top">
                        最終處置方式 <span className="text-red-500">*</span>
                      </td>
                      <td
                        className="border border-slate-300 px-4 py-3 align-top"
                        colSpan={2}
                      >
                        <div className="flex flex-col gap-3">
                          <label
                            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${formData.disposalMethod === "MEASURE" ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
                          >
                            <input
                              type="radio"
                              name="disposal"
                              value="MEASURE"
                              checked={formData.disposalMethod === "MEASURE"}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  disposalMethod: e.target.value,
                                })
                              }
                              className="mt-1 w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm font-bold text-slate-800">
                              採行消毒、改製或其他適當安全措施者，應載明所採用之措施方法與實施程序，及預定完成日期。
                            </span>
                          </label>
                          <label
                            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${formData.disposalMethod === "DESTROY" ? "border-red-500 bg-red-50" : "border-slate-200 hover:bg-slate-50"}`}
                          >
                            <input
                              type="radio"
                              name="disposal"
                              value="DESTROY"
                              checked={formData.disposalMethod === "DESTROY"}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  disposalMethod: e.target.value,
                                })
                              }
                              className="mt-1 w-4 h-4 text-red-600"
                            />
                            <span className="text-sm font-bold text-slate-800">
                              銷毀者，應載明銷毀之方式與期限，及銷毀產品之重量或容量。
                            </span>
                          </label>
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-yellow-50/30">
                      <td className="border border-slate-300 px-4 py-3 bg-yellow-100/50 text-yellow-900">
                        待銷毀產品總量
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center">
                        <input
                          type="text"
                          placeholder="輸入數量"
                          disabled={formData.disposalMethod !== "DESTROY"}
                          value={formData.destroyAmount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              destroyAmount: e.target.value,
                            })
                          }
                          className="w-full max-w-[140px] px-3 py-2 border-2 border-slate-300 rounded-md font-mono text-base font-black text-center focus:outline-none focus:border-red-500 disabled:bg-slate-100 disabled:opacity-50 transition-colors"
                        />
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-xs font-normal text-slate-500">
                        最終處置方式為「銷毀」之重量
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="absolute bottom-5 right-5">
                <button
                  onClick={() => setViewMode("preview")}
                  className="px-8 py-3 bg-[#1f4e78] hover:bg-blue-900 text-white rounded-lg shadow-xl transition-all text-base font-bold tracking-wider flex items-center gap-3 hover:-translate-y-1"
                >
                  <FileText size={20} /> 展開預覽全卷計畫書
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. 受影響生產單明細 */}
        {reportData && (
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
            {/* 標題區：與上方元件 1 保持一致的標題排版 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span className="bg-[#1f4e78] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                  2
                </span>
                受影響生產單明細
              </h3>
            </div>

            {/* 主表格容器：統一深藍外框與圓角陰影 */}
            <div className="bg-white rounded-xl shadow-lg border border-blue-200 overflow-hidden min-h-[300px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    {/* 表頭：統一採用元件 1 的深藍背景 (#1f4e78) */}
                    <tr className="bg-[#1f4e78] text-white">
                      <th className="px-4 py-3 font-bold whitespace-nowrap border border-slate-300">
                        批號 / 物料品號
                      </th>
                      <th className="px-4 py-3 font-bold border border-slate-300">
                        物料名稱
                      </th>
                      <th className="px-4 py-3 font-bold whitespace-nowrap text-center border border-slate-300">
                        剩餘庫存
                      </th>
                      <th className="px-4 py-3 font-bold whitespace-nowrap text-center border border-slate-300">
                        入庫日期
                      </th>
                      <th className="px-4 py-3 font-bold whitespace-nowrap border border-slate-300">
                        流向與用量概要
                      </th>
                      <th className="px-4 py-3 font-bold whitespace-nowrap text-center border border-slate-300">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-bold text-slate-800">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-16 text-center text-[#1f4e78] border border-slate-300"
                        >
                          <div className="text-lg font-bold animate-pulse flex items-center justify-center gap-3">
                            <span className="w-5 h-5 border-2 border-[#1f4e78] border-t-transparent rounded-full animate-spin" />
                            深度追溯中...
                          </div>
                        </td>
                      </tr>
                    ) : traceResults.length > 0 ? (
                      traceResults.map((batch) => {
                        const isExpanded = !!expandedBatches[batch.batch_id];
                        const ordersList = batch.trace_details?.orders || [];
                        const mrpsList = batch.trace_details?.mrps || [];

                        // 快速計算已投入與待排產加總
                        const totalUsedInOrders = ordersList.reduce(
                          (acc, cur) => acc + (Number(cur.used_qty) || 0),
                          0,
                        );
                        const totalUsedInMrps = mrpsList.reduce(
                          (acc, cur) => acc + (Number(cur.used_qty) || 0),
                          0,
                        );

                        return (
                          <React.Fragment key={batch.batch_id}>
                            {/* 主列表列 */}
                            <tr
                              className={`transition-colors border-b border-slate-300 ${
                                isExpanded
                                  ? "bg-blue-50/50"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              {/* 批號與品號 */}
                              <td className="px-4 py-3.5 border-r border-slate-300 whitespace-nowrap">
                                <div className="font-mono text-base font-bold text-[#1f4e78]">
                                  {batch.batch_number}
                                </div>
                                <div className="font-mono text-xs font-normal text-slate-500">
                                  {batch.material_code}
                                </div>
                              </td>

                              {/* 物料名稱 */}
                              <td className="px-4 py-3.5 border-r border-slate-300 text-slate-900 font-bold">
                                {batch.material_name}
                              </td>

                              {/* 剩餘庫存 */}
                              <td className="px-4 py-3.5 border-r border-slate-300 text-center font-mono text-lg text-red-600 whitespace-nowrap">
                                {formatDisplayNum(batch.remaining_qty)}
                              </td>

                              {/* 入庫日期 */}
                              <td className="px-4 py-3.5 border-r border-slate-300 text-center font-mono text-xs font-medium text-slate-600 whitespace-nowrap">
                                {batch.received_date}
                              </td>

                              {/* Apple 風格用量膠囊標籤（高對比深色） */}
                              <td className="px-4 py-3.5 border-r border-slate-300">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#1f4e78]/10 text-[#1f4e78] border border-[#1f4e78]/20">
                                    <span className="w-2 h-2 rounded-full bg-[#1f4e78]" />
                                    已投入:{" "}
                                    {formatDisplayNum(totalUsedInOrders)} (
                                    {ordersList.length}單)
                                  </span>
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    待排產: {formatDisplayNum(totalUsedInMrps)}{" "}
                                    ({mrpsList.length}筆)
                                  </span>
                                </div>
                              </td>

                              {/* 操作按鈕 */}
                              <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(batch.batch_id)}
                                  className={`px-4 py-1.5 text-xs rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 mx-auto ${
                                    isExpanded
                                      ? "bg-[#1f4e78] text-white ring-2 ring-[#1f4e78]/30"
                                      : "bg-white text-[#1f4e78] border border-[#1f4e78]/40 hover:bg-[#1f4e78] hover:text-white"
                                  }`}
                                >
                                  <span>
                                    {isExpanded ? "收起明細" : "展開關聯"}
                                  </span>
                                  <span
                                    className={`transition-transform duration-200 text-[10px] ${isExpanded ? "rotate-180" : ""}`}
                                  >
                                    ▼
                                  </span>
                                </button>
                              </td>
                            </tr>

                            {/* 展開詳情區：分組卡片群組 (Apple Grouped Cards) */}
                            {isExpanded && (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="bg-slate-100/70 p-6 border-b-2 border-slate-300 shadow-inner"
                                >
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                                    {/* 1. 現存庫存 */}
                                    <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm flex flex-col justify-between h-full">
                                      <div>
                                        <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                                          1. 現存原料來源
                                        </div>
                                        <div className="text-base font-bold text-slate-900 mb-1">
                                          {batch.material_name}
                                        </div>
                                        <div className="text-xs font-mono text-slate-500 mb-4">
                                          原物料代碼: {batch.material_code}
                                        </div>
                                      </div>
                                      <div className="space-y-2 text-xs font-mono bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <div className="flex justify-between">
                                          <span className="text-slate-500">
                                            庫存批號
                                          </span>
                                          <span className="font-bold text-slate-900">
                                            {batch.batch_number}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-500">
                                            入庫日期
                                          </span>
                                          <span className="font-medium text-slate-700">
                                            {batch.received_date}
                                          </span>
                                        </div>
                                        <div className="flex justify-between pt-1.5 border-t border-slate-200">
                                          <span className="text-slate-500 font-bold">
                                            現存量
                                          </span>
                                          <span className="font-bold text-red-600 text-sm">
                                            {formatDisplayNum(
                                              batch.remaining_qty,
                                            )}{" "}
                                            KG
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* 2. 已投產生產單 */}
                                    <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm flex flex-col h-full">
                                      <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                          <span className="w-2 h-2 bg-[#1f4e78] rounded-full" />
                                          2. 已製作之生產單
                                        </span>
                                        <span className="text-[#1f4e78] font-bold text-xs bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                          {ordersList.length} 筆
                                        </span>
                                      </div>
                                      <div className="space-y-3 flex-1 overflow-y-auto max-h-[280px] pr-1">
                                        {ordersList.length > 0 ? (
                                          ordersList.map((po, idx) => (
                                            <div
                                              key={idx}
                                              className="border border-slate-200 bg-slate-50/70 p-3.5 rounded-lg hover:border-[#1f4e78] transition-colors"
                                            >
                                              <div className="flex justify-between font-mono text-xs mb-1.5">
                                                <span className="font-bold text-[#1f4e78]">
                                                  {po.order_number}
                                                </span>
                                                <span className="text-slate-400 text-[11px]">
                                                  {po.order_created_at || "-"}
                                                </span>
                                              </div>
                                              <div className="text-xs font-bold text-slate-800 mb-2">
                                                產出: {po.product_name}
                                              </div>
                                              <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-1.5 font-mono">
                                                <span className="text-slate-500">
                                                  投入原料量:
                                                </span>
                                                <span className="font-black text-red-600 text-sm">
                                                  {formatDisplayNum(
                                                    po.used_qty,
                                                  )}{" "}
                                                  <span className="text-xs font-normal text-slate-600">
                                                    {po.unit}
                                                  </span>
                                                </span>
                                              </div>
                                              {(po.delivery_notes || [])
                                                .length > 0 && (
                                                <div className="mt-2 text-xs bg-blue-100/60 text-[#1f4e78] px-2.5 py-1 rounded font-bold flex items-center justify-between border border-blue-200">
                                                  <span>附屬銷貨單</span>
                                                  <span className="font-black">
                                                    {po.delivery_notes.length}{" "}
                                                    筆
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-xs text-slate-400 text-center py-10">
                                            無關聯生產單
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm flex flex-col h-full">
                                      <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                          <span className="w-2 h-2 bg-amber-500 rounded-full" />
                                          3. 尚未生產之訂購單
                                        </span>
                                        <span className="text-amber-800 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                          {mrpsList.length} 筆
                                        </span>
                                      </div>
                                      <div className="space-y-3 flex-1 overflow-y-auto max-h-[280px] pr-1">
                                        {mrpsList.length > 0 ? (
                                          mrpsList.map((mrp, idx) => (
                                            <div
                                              key={idx}
                                              className="border border-slate-200 bg-slate-50/70 p-3.5 rounded-lg"
                                            >
                                              <div className="flex justify-between font-mono text-xs mb-1.5">
                                                <span className="font-bold text-amber-700">
                                                  {mrp.mrp_id}
                                                </span>
                                                <span className="text-slate-400 text-[11px]">
                                                  {
                                                    mrp.created_at?.split(
                                                      " ",
                                                    )[0]
                                                  }
                                                </span>
                                              </div>
                                              <div className="flex justify-between items-center text-xs font-mono border-t border-slate-200 pt-1.5">
                                                <span className="text-slate-500">
                                                  預計用量:
                                                </span>
                                                <span className="font-bold text-red-600 text-sm">
                                                  {formatDisplayNum(
                                                    mrp.used_qty,
                                                  )}{" "}
                                                  <span className="text-xs font-normal text-slate-600">
                                                    {mrp.unit}
                                                  </span>
                                                </span>
                                              </div>
                                              {mrp.vendor_info?.name && (
                                                <div className="text-[11px] text-slate-500 mt-2 pt-1.5 border-t border-dashed border-slate-200 truncate font-normal">
                                                  對應廠商:{" "}
                                                  <strong className="text-slate-700 font-bold">
                                                    {mrp.vendor_info.name}
                                                  </strong>
                                                </div>
                                              )}
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-xs text-slate-400 text-center py-10">
                                            無待排產計畫
                                          </div>
                                        )}
                                      </div>
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
                          colSpan={6}
                          className="p-16 text-center text-slate-500 text-base border border-slate-300"
                        >
                          {selectedMaterial
                            ? "找不到符合條件的追溯紀錄"
                            : "請從上方搜尋物料後發動追溯"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
};

export default TracePage;
