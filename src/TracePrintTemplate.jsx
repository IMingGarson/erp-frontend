// TracePrintTemplate.jsx
import React from "react";

const TracePrintTemplate = ({ data }) => {
  if (!data) return null;

  // 取得今天的日期作為製表日期
  const today = new Date();
  const formattedDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  // 計算合計
  const totalMaterialQty =
    data.trace_details?.orders?.reduce(
      (sum, po) => sum + parseFloat(po.used_qty || 0),
      0,
    ) || 0;
  // 假定產品總數合計 (Placeholder)
  const totalProductQty = 7897.0;

  return (
    <div className="hidden print:block w-full bg-white text-black font-sans mx-auto print:p-[10mm]">
      <style>
        {`
          @media print {
            @page { 
              size: A4 landscape; 
              margin: 0; 
            }
            body { 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
            }
          }
        `}
      </style>

      {/* 報表標題區 */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-center mb-2">
          {data.material_code} {data.material_name}(批號:{data.batch_number}
          )領用記錄
        </h1>
        <div className="text-sm text-right">製表日期:{formattedDate}</div>
      </div>

      {/* 報表表格區 */}
      <table className="w-full border-collapse border border-black text-[10px] text-center">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-1">
              客戶
              <br />
              編號
            </th>
            <th className="border border-black p-1">客戶名稱</th>
            <th className="border border-black p-1">
              貨品編號/
              <br />
              產品編號
            </th>
            <th className="border border-black p-1">
              品名/
              <br />
              產品名稱
            </th>
            <th className="border border-black p-1">規格</th>
            <th className="border border-black p-1">批號編號</th>
            <th className="border border-black p-1">銷貨單編號</th>
            <th className="border border-black p-1">
              數量
              <br />
              (包)
            </th>
            <th className="border border-black p-1">KG</th>
            <th className="border border-black p-1">領料單據編號</th>
            <th className="border border-black p-1">製令單號</th>
            <th className="border border-black p-1">產品數量</th>
            <th className="border border-black p-1">原料數量</th>
          </tr>
        </thead>
        <tbody>
          {data.trace_details?.orders?.map((po, index) => (
            <tr key={index}>
              {/* 以下為 Placeholder 假資料 */}
              <td className="border border-black p-1 text-gray-500">
                [待補] 04-031
              </td>
              <td className="border border-black p-1 text-gray-500">
                {po.vendor_info?.name || "[待補] 裕馨國際"}
              </td>
              <td className="border border-black p-1 text-gray-500">
                [待補] P850011310
              </td>

              {/* 以下為現有真實資料 */}
              <td className="border border-black p-1 font-bold">
                {po.product_name}
              </td>

              {/* 以下為 Placeholder 假資料 */}
              <td className="border border-black p-1 text-gray-500">
                [待補] 5KG*5包/箱
              </td>
              <td className="border border-black p-1 text-gray-500">
                [待補] 20260126
              </td>
              <td className="border border-black p-1 text-gray-500">
                [待補] 202602040004
              </td>
              <td className="border border-black p-1 text-gray-500">
                [待補] 45
              </td>
              <td className="border border-black p-1 text-gray-500">
                [待補] 225
              </td>
              <td className="border border-black p-1 text-gray-500">
                [待補] 202602030038
              </td>

              {/* 以下為現有真實資料 */}
              <td className="border border-black p-1 font-bold">
                {po.order_number}
              </td>

              {/* 產品數量(Placeholder) 與 原料數量(真實資料) */}
              <td className="border border-black p-1 text-gray-500">
                [待補] 225.0
              </td>
              <td className="border border-black p-1 font-bold">
                {po.used_qty}
              </td>
            </tr>
          ))}

          {/* 合計列 */}
          <tr className="bg-gray-50 font-bold">
            <td
              colSpan="11"
              className="border border-black p-1 text-right pr-4"
            >
              合計
            </td>
            <td className="border border-black p-1 text-gray-500">
              [待補] {totalProductQty}
            </td>
            <td className="border border-black p-1">
              {totalMaterialQty.toFixed(4)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default TracePrintTemplate;
