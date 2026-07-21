import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import CustomDialog from "./components/customDialog";

const formatNum = (num, type) => {
  if (num === null || num === undefined || isNaN(num) || num === "") return "0";
  if (type === "PACK") return Math.ceil(num).toString();
  return parseFloat(Number(num).toFixed(4)).toString();
};

const ProductionOrderEditPage = () => {
  const { production_order_id } = useParams();
  const navigate = useNavigate();

  const [mainOrder, setMainOrder] = useState(null);
  const [childrenOrders, setChildrenOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [editForm, setEditForm] = useState({});

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
    fetchOrderDetails();
  }, [production_order_id]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `/api/production_orders/${production_order_id}`,
      );
      if (!res.ok) throw new Error("載入生產單細節失敗");
      const json = await res.json();

      const orderData = json.data || json;
      setMainOrder(orderData);
      setChildrenOrders(orderData.children_orders || []);

      const initialForm = {};
      const processOrderMaterials = (order) => {
        if (!order.materials_info) return;
        order.materials_info.forEach((mat) => {
          if (mat.type === "CHILD_PRODUCT") return;

          const usedBatches = (mat.batches || []).filter((b) => {
            const usedVal = parseFloat(b.used);
            return !isNaN(usedVal) && usedVal > 0;
          });

          usedBatches.forEach((b) => {
            const key = `${order.id}_${mat.code}_${b.id}`;
            initialForm[key] = {
              input_bags: b.input_bags || "",
              empty_bags: b.empty_bags || "",
              actual_used: b.actual_used || b.used || "",
              loss_qty: b.loss_qty || "0",
              adjustment_type: b.adjustment_type || "NONE",
              adjustment_qty: b.adjustment_qty || "0",
            };
          });
        });
      };

      processOrderMaterials(orderData);
      (orderData.children_orders || []).forEach(processOrderMaterials);
      setEditForm(initialForm);
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (orderId, matCode, batchId, field, value) => {
    const key = `${orderId}_${matCode}_${batchId}`;
    setEditForm((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleSaveClick = () => {
    setDialog({
      isOpen: true,
      type: "confirm",
      status: "warning",
      title: "確認儲存",
      message: "確定要更新此生產單與關聯子單的批號耗損及用量細節嗎？",
      onConfirm: executeUpdate,
    });
  };

  const executeUpdate = async () => {
    closeDialog();
    setSubmitting(true);

    const buildUpdatedMaterialsInfo = (order) => {
      return order.materials_info.map((mat) => {
        if (mat.type === "CHILD_PRODUCT") return mat;

        const updatedBatches = mat.batches?.map((b) => {
          const key = `${order.id}_${mat.code}_${b.id}`;
          const formData = editForm[key];

          if (formData) {
            return {
              ...b,
              input_bags: formData.input_bags,
              empty_bags: formData.empty_bags,
              used: formData.actual_used,
              actual_used: formData.actual_used,
              loss_qty: formData.loss_qty,
              adjustment_type: formData.adjustment_type,
              adjustment_qty: formData.adjustment_qty,
            };
          }
          return b;
        });

        return { ...mat, batches: updatedBatches };
      });
    };

    const extractAdjustmentBatches = (materials) => {
      const batches = [];
      for (const row of materials) {
        for (const bat of row.batches) {
          if (
            bat.batch_number &&
            bat?.adjustment_type?.length &&
            bat?.adjustment_qty > 0
          ) {
            batches.push({
              batch_number: bat.batch_number,
              adjustment_type: bat.adjustment_type.toUpperCase(),
              adjustment_qty: bat.adjustment_qty,
            });
          }
        }
      }
      return batches;
    };

    try {
      const promises = [];
      const updatedMainMaterials = buildUpdatedMaterialsInfo(mainOrder);
      promises.push(
        fetchWithAuth(`/api/production_orders/${mainOrder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ materials_info: updatedMainMaterials }),
        }).then((res) => {
          if (!res.ok)
            throw new Error(`母單 [${mainOrder.order_number}] 儲存失敗`);
        }),
      );

      const mainBatches = extractAdjustmentBatches(updatedMainMaterials);
      if (mainBatches.length > 0) {
        promises.push(
          fetchWithAuth(`/api/batches/adjustment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mainBatches),
          }).then((res) => {
            if (!res.ok)
              throw new Error(
                `母單 [${mainOrder.order_number}] 批號庫存調整失敗`,
              );
          }),
        );
      }

      for (const child of childrenOrders) {
        const updatedChildMaterials = buildUpdatedMaterialsInfo(child);

        promises.push(
          fetchWithAuth(`/api/production_orders/${child.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ materials_info: updatedChildMaterials }),
          }).then((res) => {
            if (!res.ok)
              throw new Error(`子單 [${child.order_number}] 儲存失敗`);
          }),
        );

        const childBatches = extractAdjustmentBatches(updatedChildMaterials);
        if (childBatches.length > 0) {
          promises.push(
            fetchWithAuth(`/api/batches/adjustment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(childBatches),
            }).then((res) => {
              if (!res.ok)
                throw new Error(
                  `子單 [${child.order_number}] 批號庫存調整失敗`,
                );
            }),
          );
        }

        await Promise.all(promises);
      }

      setDialog({
        isOpen: true,
        type: "alert",
        status: "success",
        title: "成功",
        message: "生產單批號細節已成功更新！",
        onConfirm: () => navigate(-1),
      });
    } catch (err) {
      showAlert("儲存失敗", err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const renderEditableTable = (order, labelTitle, isMain = false) => {
    const unitLabel = order.product_unit || "kg";

    return (
      <div
        key={order.id}
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8 w-full"
      >
        <div className="p-4 bg-slate-100 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${isMain ? "bg-blue-600" : "bg-indigo-500"}`}
            ></span>
            {labelTitle}：{order.order_number} {order.product_name}
          </h3>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse table-fixed text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 text-left w-[22%]">原料編號/名稱</th>
                <th className="p-3 text-center w-[12%]">原料批號</th>
                <th className="p-3 text-right w-[8%]">投入包數</th>
                <th className="p-3 text-right w-[8%]">空袋數量</th>
                <th className="p-3 text-right w-[11%]">
                  配方用量({unitLabel})
                </th>
                <th className="p-3 text-right w-[10%]">耗損量({unitLabel})</th>
                <th className="p-3 text-center w-[9%]">盤盈/盤虧</th>
                <th className="p-3 text-right w-[11%]">
                  盈虧數量({unitLabel})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.materials_info?.flatMap((mat) => {
                if (mat.type === "CHILD_PRODUCT" && isMain) {
                  return null;
                }
                const usedBatches = (mat.batches || []).filter((b) => {
                  const usedVal = parseFloat(b.used);
                  return !isNaN(usedVal) && usedVal > 0;
                });

                if (usedBatches.length === 0) {
                  return (
                    <tr key={mat.code} className="text-slate-400 italic">
                      <td className="p-3 font-medium text-slate-700 truncate">
                        {mat.materialName}
                      </td>
                      <td
                        className="p-3 text-center text-red-500 font-bold"
                        colSpan="8"
                      >
                        無批號投入紀錄（未指派）
                      </td>
                    </tr>
                  );
                }

                return usedBatches.map((b, idx) => {
                  const key = `${order.id}_${mat.code}_${b.id}`;
                  const rowData = editForm[key] || {};

                  return (
                    <tr
                      key={`${mat.code}_${b.id}`}
                      className="hover:bg-slate-50/80 transition-colors h-12"
                    >
                      {idx === 0 ? (
                        <td
                          className="p-3 font-medium text-slate-800 border-r border-slate-100 align-middle"
                          rowSpan={usedBatches.length}
                        >
                          <div className="font-mono text-[10px] text-slate-400">
                            {mat.code}
                          </div>
                          <div className="text-slate-700 font-bold truncate">
                            {mat.materialName}
                          </div>
                        </td>
                      ) : null}

                      <td className="p-3 text-center font-mono font-bold text-blue-700 bg-blue-50/10 align-middle">
                        {b.batch_number}
                      </td>

                      <td className="p-2 align-middle">
                        <input
                          type="number"
                          value={rowData.input_bags || ""}
                          onChange={(e) =>
                            handleInputChange(
                              order.id,
                              mat.code,
                              b.id,
                              "input_bags",
                              e.target.value,
                            )
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded text-right focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </td>

                      <td className="p-2 align-middle">
                        <input
                          type="number"
                          value={rowData.empty_bags || ""}
                          onChange={(e) =>
                            handleInputChange(
                              order.id,
                              mat.code,
                              b.id,
                              "empty_bags",
                              e.target.value,
                            )
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded text-right focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-slate-600 align-middle pr-4">
                        {formatNum(b.used, "RAW")}
                      </td>

                      {/* <td className="p-2 align-middle">
                        <input
                          type="number"
                          step="0.0001"
                          value={rowData.actual_used || ""}
                          onChange={(e) =>
                            handleInputChange(
                              order.id,
                              mat.code,
                              b.id,
                              "actual_used",
                              e.target.value,
                            )
                          }
                          className="w-full px-2 py-1 border border-blue-300 bg-blue-50/20 rounded text-right font-mono font-bold text-blue-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          placeholder="0.00"
                        />
                      </td> */}

                      <td className="p-2 align-middle">
                        <input
                          type="number"
                          step="0.0001"
                          value={rowData.loss_qty || ""}
                          onChange={(e) =>
                            handleInputChange(
                              order.id,
                              mat.code,
                              b.id,
                              "loss_qty",
                              e.target.value,
                            )
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded text-right font-mono text-amber-700 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          placeholder="0.0"
                        />
                      </td>

                      <td className="p-2 align-middle">
                        <select
                          value={rowData.adjustment_type || "NONE"}
                          onChange={(e) =>
                            handleInputChange(
                              order.id,
                              mat.code,
                              b.id,
                              "adjustment_type",
                              e.target.value,
                            )
                          }
                          className={`w-full px-1 py-1 border rounded text-xs font-bold focus:outline-none text-center ${
                            rowData.adjustment_type === "PROFIT"
                              ? "border-emerald-300 text-emerald-700 bg-emerald-50/40"
                              : rowData.adjustment_type === "LOSS"
                                ? "border-red-300 text-red-700 bg-red-50/40"
                                : "border-slate-300 text-slate-500"
                          }`}
                        >
                          <option value="NONE">無調整</option>
                          <option value="PROFIT">盤盈</option>
                          <option value="LOSS">盤虧</option>
                        </select>
                      </td>

                      <td className="p-2 align-middle">
                        <input
                          type="number"
                          step="0.0001"
                          disabled={rowData.adjustment_type === "NONE"}
                          value={
                            rowData.adjustment_type === "NONE"
                              ? "0"
                              : rowData.adjustment_qty || ""
                          }
                          onChange={(e) =>
                            handleInputChange(
                              order.id,
                              mat.code,
                              b.id,
                              "adjustment_qty",
                              e.target.value,
                            )
                          }
                          className={`w-full px-2 py-1 border rounded text-right font-mono focus:outline-none ${
                            rowData.adjustment_type === "NONE"
                              ? "bg-slate-100 text-slate-400 border-slate-200"
                              : "border-slate-300 text-slate-800"
                          }`}
                          placeholder="0.0"
                        />
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-50 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <div className="text-slate-500 font-bold">載入母子單生產明細中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            生產單編輯
            <span className="text-sm px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono font-bold">
              單號: {mainOrder?.order_number}
            </span>
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-sm text-slate-500 hover:text-slate-800 transition-colors mb-2 font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> 返回列表
          </button>
        </div>

        <button
          onClick={handleSaveClick}
          disabled={submitting}
          className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all font-bold text-sm shadow-md flex items-center justify-center gap-2 disabled:bg-blue-400"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          儲存
        </button>
      </div>

      <div className="bg-amber-50 text-amber-900 text-xs p-3.5 rounded-lg mb-6 border border-amber-200 shadow-sm leading-relaxed">
        <strong>💡 操作提示：</strong>
        真實製作產品可能會與標準配方有誤差（如原物料廠商正負 5% 誤差）。
        您可以直接修改<strong>「實際用量」</strong>與<strong>「耗損量」</strong>
        ，或利用<strong>「盤盈/盤虧吸收」</strong>
        選單指派該批號直接吸收盤點誤差值，系統在儲存後會同步更新至後端審核系統。
      </div>

      {mainOrder && renderEditableTable(mainOrder, "【主母單】", true)}

      {childrenOrders.length > 0 && (
        <div className="mt-8 border-t-2 border-dashed border-slate-300 pt-6 w-full">
          <div className="text-center mb-4">
            <span className="bg-slate-200 text-slate-600 px-6 py-1 rounded-full text-xs font-black tracking-widest shadow-sm">
              ▼ 關聯子生產單物料細節回填 ▼
            </span>
          </div>
          {childrenOrders.map((child) =>
            renderEditableTable(child, "【子生產單】", false),
          )}
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

export default ProductionOrderEditPage;
