import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Loader2,
  RefreshCw,
  ChevronDown,
  Check,
  PackageOpen,
  AlertTriangle,
} from "lucide-react";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import CustomDialog from "./components/customDialog";

const formatNum = (num, type) => {
  if (num === null || num === undefined || isNaN(num) || num === "") return "0";
  if (type === "PACK") return Math.ceil(num).toString();
  return parseFloat(Number(num).toFixed(5)).toString();
};

const CustomAdjustmentSelect = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectRef.current && !selectRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const config = {
    NONE: {
      label: "無調整",
      bg: "bg-slate-50",
      text: "text-slate-500",
      border: "border-slate-200",
      hover: "hover:bg-slate-100",
    },
    PROFIT: {
      label: "盤盈",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      hover: "hover:bg-emerald-100",
    },
    LOSS: {
      label: "盤虧",
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      hover: "hover:bg-red-100",
    },
  };
  const current = config[value] || config.NONE;

  return (
    <div className="relative w-full" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10 px-3 flex items-center justify-between rounded-lg text-[13px] font-medium transition-colors border focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none ${current.bg} ${current.text} ${current.border} ${current.hover}`}
      >
        <span>{current.label}</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full z-[999] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {Object.entries(config).map(([key, { label, text }]) => (
            <div
              key={key}
              onClick={() => {
                onChange(key);
                setIsOpen(false);
              }}
              className={`px-3 py-2.5 text-center text-[13px] font-medium cursor-pointer transition-colors border-b last:border-b-0 border-slate-50 hover:bg-slate-50 bg-white ${text}`}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const OverlaySelect = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectRef.current && !selectRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOpt = options.find((o) => String(o.id) === String(value));

  return (
    <div className="relative w-full" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-11 px-4 flex justify-between items-center bg-white border rounded-xl text-sm font-medium transition-all duration-200 shadow-sm ${
          isOpen
            ? "border-blue-400 ring-2 ring-blue-500/10"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        {selectedOpt ? (
          <div className="flex justify-between items-center w-full pr-3">
            <span className="font-mono font-medium text-slate-700 text-[14px]">
              {selectedOpt.batch_number}
            </span>
            <span className="text-[12px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              餘: {selectedOpt.remaining_qty}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 font-medium">{placeholder}</span>
        )}
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={`flex-shrink-0 transition-transform duration-300 ${
            isOpen ? "rotate-180 text-blue-500" : "text-slate-400"
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full z-[999] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl flex flex-col max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar">
          <div className="p-2">
            {options.length > 0 ? (
              options.map((opt) => {
                const isSelected = String(value) === String(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all mb-1 border ${
                      isSelected
                        ? "bg-blue-50/80 border border-blue-100"
                        : "bg-white border border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full pr-3">
                      <span
                        className={`font-mono text-[14px] ${isSelected ? "font-semibold text-blue-700" : "font-medium text-slate-600"}`}
                      >
                        {opt.batch_number}
                      </span>
                      <span
                        className={`text-[12px] font-medium px-2 py-0.5 rounded-md border ${isSelected ? "text-blue-600 bg-white border-blue-200" : "text-slate-500 bg-slate-50 border-slate-200"}`}
                      >
                        餘: {opt.remaining_qty}
                      </span>
                    </div>
                    {isSelected && (
                      <Check
                        size={16}
                        strokeWidth={2.5}
                        className="text-blue-600 shrink-0"
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-slate-400 text-[13px] font-medium flex flex-col items-center gap-2">
                <PackageOpen size={28} className="opacity-30" /> 無其他可用庫存
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ProductionOrderEditPage() {
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

  const [replaceModal, setReplaceModal] = useState({
    isOpen: false,
    orderId: null,
    materialCode: null,
    materialName: "",
    oldBatchNumber: "",
    oldUsedQty: 0,
    requiredQty: 0,
    currentTotalAllocated: 0,
    batches: [],
    selectedBatchId: "",
    newUsedQty: "",
    loading: false,
    submitting: false,
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

  const getUsedBatches = (mat) => {
    let usedBatches = (mat.batches || []).filter((b) => {
      const usedVal = parseFloat(b.used);
      return !isNaN(usedVal) && usedVal > 0;
    });

    if (
      usedBatches.length === 0 &&
      ["SEMI", "CHILD_PRODUCT", "PRODUCT"].includes(mat.type)
    ) {
      usedBatches = [
        {
          id: mat.code,
          batch_number: mat.code,
          used: mat.requiredQty || mat.quantity || "0",
        },
      ];
    }
    return usedBatches;
  };

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

      const allChildren = orderData.children_orders || [];
      setChildrenOrders(allChildren);

      const initialForm = {};
      const processOrderMaterials = (order) => {
        if (!order.materials_info) return;
        order.materials_info.forEach((mat) => {
          if (mat.type === "CHILD_PRODUCT") return;
          const usedBatches = getUsedBatches(mat);

          usedBatches.forEach((b) => {
            const key = `${order.id}_${mat.code}_${b.id}`;
            initialForm[key] = {
              used: b.used || "",
              input_bags: b.input_bags || "",
              empty_bags: b.empty_bags || "",
              actual_used: b.actual_used || "",
              loss_qty: b.loss_qty || "0",
              adjustment_type: b.adjustment_type || "NONE",
              adjustment_qty: b.adjustment_qty || "0",
            };
          });
        });
      };

      processOrderMaterials(orderData);
      allChildren.forEach(processOrderMaterials);
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
      message: "確定要更新此生產單與所有關聯子單的批號細節嗎？",
      onConfirm: executeUpdate,
    });
  };

  const executeUpdate = async () => {
    closeDialog();
    setSubmitting(true);

    const buildUpdatedMaterialsInfo = (order) => {
      return order.materials_info.map((mat) => {
        if (mat.type === "CHILD_PRODUCT") return mat;

        const usedBatches = getUsedBatches(mat);
        const updatedBatches = usedBatches.map((b) => {
          const key = `${order.id}_${mat.code}_${b.id}`;
          const formData = editForm[key];

          if (formData) {
            return {
              ...b,
              input_bags: formData.input_bags,
              empty_bags: formData.empty_bags,
              used: formData.used,
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
        if (row.type === "CHILD_PRODUCT") continue;
        for (const bat of row.batches) {
          if (
            bat.batch_number &&
            bat?.adjustment_type?.length &&
            parseFloat(bat?.adjustment_qty) > 0 &&
            bat.adjustment_type !== "NONE"
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
          if (!res.ok) throw new Error(`主單儲存失敗`);
        }),
      );

      const mainBatches = extractAdjustmentBatches(updatedMainMaterials);
      if (mainBatches.length > 0) {
        promises.push(
          fetchWithAuth(`/api/batches/adjustment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mainBatches),
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
            if (!res.ok) throw new Error(`子單 ${child.order_number} 儲存失敗`);
          }),
        );

        const childBatches = extractAdjustmentBatches(updatedChildMaterials);
        if (childBatches.length > 0) {
          promises.push(
            fetchWithAuth(`/api/batches/adjustment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(childBatches),
            }),
          );
        }
      }

      await Promise.all(promises);

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

  const handleOpenReplaceModal = async (
    orderId,
    matCode,
    matName,
    oldBatchNum,
    oldUsed,
    requiredQty,
    currentTotalAllocated,
  ) => {
    setReplaceModal({
      isOpen: true,
      loading: true,
      submitting: false,
      orderId,
      materialCode: matCode,
      materialName: matName,
      oldBatchNumber: oldBatchNum,
      oldUsedQty: parseFloat(oldUsed) || 0,
      newUsedQty: parseFloat(oldUsed) || 0,
      requiredQty: parseFloat(requiredQty) || 0,
      currentTotalAllocated: parseFloat(currentTotalAllocated) || 0,
      batches: [],
      selectedBatchId: "",
    });

    try {
      const matRes = await fetchWithAuth(`/api/materials?code=${matCode}`);
      const matJson = await matRes.json();
      const targetMat = Array.isArray(matJson.data)
        ? matJson.data[0]
        : Array.isArray(matJson)
          ? matJson[0]
          : null;
      const targetMatId = targetMat ? String(targetMat.id) : null;

      if (!targetMatId) throw new Error("找不到該物料的系統 ID");

      const res = await fetchWithAuth(
        `/api/batches/replaceable_batches?material_id=${targetMatId}&exclude_batch=${oldBatchNum}`,
      );
      if (!res.ok) throw new Error("無法載入可用庫存清單");
      const json = await res.json();
      const validBatches = json.data || json;

      setReplaceModal((prev) => ({
        ...prev,
        loading: false,
        batches: validBatches,
      }));
    } catch (err) {
      setReplaceModal((prev) => ({ ...prev, loading: false }));
      showAlert("錯誤", err.message, "error");
    }
  };

  const executeReplaceBatch = async () => {
    if (!replaceModal.selectedBatchId)
      return showAlert("錯誤", "請選擇新批號", "warning");

    const newBatch = replaceModal.batches.find(
      (b) => String(b.id) === String(replaceModal.selectedBatchId),
    );
    if (!newBatch) return;

    const newQty = parseFloat(replaceModal.newUsedQty);
    if (isNaN(newQty) || newQty <= 0)
      return showAlert("錯誤", "請輸入有效的新使用量", "warning");

    setReplaceModal((prev) => ({ ...prev, submitting: true }));
    try {
      const payload = {
        material_code: replaceModal.materialCode,
        old_batch_number: replaceModal.oldBatchNumber,
        new_batch_number: newBatch.batch_number,
        old_used_qty: replaceModal.oldUsedQty,
        new_used_qty: newQty,
      };

      const res = await fetchWithAuth(
        `/api/production_orders/${replaceModal.orderId}/replace_batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "替換失敗");

      showAlert("成功", "批號替換與庫存更新成功", "success");
      setReplaceModal((prev) => ({ ...prev, isOpen: false }));
      fetchOrderDetails();
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    } finally {
      setReplaceModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // 🌟 動態計算驗證數值
  const reqQty = parseFloat(replaceModal.requiredQty) || 0;
  const oldQty = parseFloat(replaceModal.oldUsedQty) || 0;
  const newQty = parseFloat(replaceModal.newUsedQty) || 0;
  const currTotal = parseFloat(replaceModal.currentTotalAllocated) || 0;

  const selectedBatchInfo = replaceModal.batches.find(
    (b) => String(b.id) === String(replaceModal.selectedBatchId),
  );
  const maxAvailable = selectedBatchInfo
    ? parseFloat(selectedBatchInfo.remaining_qty) || 0
    : 0;

  const isExceedingStock =
    replaceModal.selectedBatchId && newQty > maxAvailable;

  const newTotal = currTotal - oldQty + newQty;
  const minNeeded = Math.max(0, reqQty - (currTotal - oldQty));

  const isUnder = newTotal < reqQty - 0.0001;
  const isOver = newTotal > reqQty + 0.0001;

  const renderEditableTable = (order, labelTitle, isMain = false) => {
    return (
      <div key={order.id} className="w-full mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full">
          <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-[15px] flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${isMain ? "bg-blue-500" : "bg-purple-500"}`}
              ></span>
              <span className="text-slate-500 tracking-wide font-medium">
                {labelTitle}
              </span>
              <span className="text-slate-800">{order.order_number}</span>
              <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-[13px] text-slate-600 ml-2">
                {order.product_profile?.name || order.product_name}
              </span>
            </h3>
          </div>

          <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full text-left border-collapse table-fixed min-w-[1050px]">
              <thead className="bg-slate-50/50 text-[12px] text-slate-500 font-medium uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-4 w-[20%]">原料編號 / 名稱</th>
                  <th className="p-4 w-[16%]">投入批號</th>
                  <th className="p-4 w-[8%] text-right">投入包數</th>
                  <th className="p-4 w-[8%] text-right">空袋數</th>
                  <th className="p-4 w-[9%] text-right">配方用量</th>
                  <th className="p-4 w-[9%] text-right">耗損量</th>
                  <th className="p-4 w-[10%] text-right">實際用量</th>
                  <th className="p-4 w-[10%] text-center">盤盈虧</th>
                  <th className="p-4 w-[10%] text-right pr-6">盈虧數</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {order.materials_info?.flatMap((mat) => {
                  if (mat.type === "CHILD_PRODUCT") return null;

                  const usedBatches = getUsedBatches(mat);
                  const currentTotalAllocated = usedBatches.reduce(
                    (acc, b) => acc + parseFloat(b.used || 0),
                    0,
                  );

                  if (usedBatches.length === 0) {
                    return (
                      <tr key={mat.code} className="bg-slate-50/30">
                        <td className="p-4 align-middle">
                          <div className="font-bold text-slate-700 truncate">
                            {mat.materialName}
                          </div>
                        </td>
                        <td
                          className="p-4 text-center text-red-400 font-medium text-[13px] tracking-wide"
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
                    const isConvertible =
                      mat.type !== "SEMI" &&
                      mat.type !== "CHILD_PRODUCT" &&
                      b.batch_number;

                    return (
                      <tr
                        key={`${mat.code}_${b.id}`}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        {idx === 0 ? (
                          <td
                            className="p-4 align-middle border-r border-slate-50"
                            rowSpan={usedBatches.length}
                          >
                            <div className="flex flex-col gap-1 pr-2">
                              <span className="font-mono text-[11px] text-slate-400 font-medium tracking-wide">
                                {mat.code}
                              </span>
                              <span className="text-slate-800 font-bold leading-tight line-clamp-2">
                                {mat.materialName}
                              </span>
                              {mat.remark && (
                                <span className="mt-1 w-fit px-2 py-0.5 font-mono text-[11px] bg-slate-100 rounded text-slate-500 border border-slate-200 truncate max-w-full font-medium">
                                  {mat.remark}
                                </span>
                              )}
                            </div>
                          </td>
                        ) : null}

                        <td className="p-4 align-middle">
                          <div className="flex flex-col items-start justify-center gap-2">
                            <span
                              className={`font-mono font-medium text-[13px] px-2 py-1 rounded-md border ${
                                mat.type === "SEMI" ||
                                mat.type === "CHILD_PRODUCT"
                                  ? "text-purple-700 bg-purple-50 border-purple-200"
                                  : "text-blue-700 bg-blue-50 border-blue-200"
                              }`}
                            >
                              {b.batch_number}
                            </span>
                            {isConvertible && (
                              <button
                                onClick={() =>
                                  handleOpenReplaceModal(
                                    order.id,
                                    mat.code,
                                    mat.materialName,
                                    b.batch_number,
                                    b.used,
                                    mat.requiredQty,
                                    currentTotalAllocated,
                                  )
                                }
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 rounded-full text-[11px] font-medium tracking-wide transition-all active:scale-95"
                                title="替換批號與庫存"
                              >
                                <RefreshCw size={12} strokeWidth={2} /> 替換
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="p-3 align-middle">
                          <input
                            type="text"
                            inputMode="decimal"
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
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-right font-mono text-[14px] font-medium text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300 placeholder:font-sans"
                            placeholder="0"
                          />
                        </td>

                        <td className="p-3 align-middle">
                          <input
                            type="text"
                            inputMode="decimal"
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
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-right font-mono text-[14px] font-medium text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300 placeholder:font-sans"
                            placeholder="0"
                          />
                        </td>

                        <td className="p-4 text-right font-mono font-medium text-slate-600 align-middle text-[14px]">
                          {formatNum(b.used, mat.type)}
                        </td>

                        <td className="p-3 align-middle">
                          <input
                            type="text"
                            inputMode="decimal"
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
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-right font-mono text-[14px] text-orange-600 font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 outline-none transition-all placeholder:text-slate-300 placeholder:font-sans"
                            placeholder="0.0"
                          />
                        </td>

                        <td className="p-3 align-middle">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={rowData.actual_used}
                            onChange={(e) =>
                              handleInputChange(
                                order.id,
                                mat.code,
                                b.id,
                                "actual_used",
                                e.target.value,
                              )
                            }
                            className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-right font-mono text-[14px] text-blue-600 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300 placeholder:font-sans"
                            placeholder="0.00"
                          />
                        </td>

                        <td className="p-3 align-middle">
                          <CustomAdjustmentSelect
                            value={rowData.adjustment_type || "NONE"}
                            onChange={(val) =>
                              handleInputChange(
                                order.id,
                                mat.code,
                                b.id,
                                "adjustment_type",
                                val,
                              )
                            }
                          />
                        </td>

                        <td className="p-3 align-middle pr-6">
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={rowData.adjustment_type === "NONE"}
                            value={
                              rowData.adjustment_type === "NONE"
                                ? ""
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
                            className={`w-full h-9 px-2 rounded-lg text-right font-mono text-[14px] font-medium focus:outline-none transition-all ${
                              rowData.adjustment_type === "NONE"
                                ? "bg-transparent text-transparent border-transparent"
                                : "bg-white border border-slate-200 text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
                            }`}
                            placeholder={
                              rowData.adjustment_type === "NONE" ? "" : "0.0"
                            }
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
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-50 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <div className="text-slate-500 font-medium tracking-wide">
          載入明細中...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto bg-slate-50 min-h-screen font-sans text-slate-800 w-full relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-slate-400 hover:text-blue-600 transition-colors mb-3 tracking-widest"
          >
            <ArrowLeft size={16} strokeWidth={2} /> 返回列表
          </button>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            生產單編輯
            <span className="text-sm px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg font-mono font-medium shadow-sm">
              單號: {mainOrder?.order_number}
            </span>
          </h2>
        </div>

        <button
          onClick={handleSaveClick}
          disabled={submitting}
          className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium text-[14px] shadow-sm flex items-center justify-center gap-2 disabled:bg-blue-300 disabled:shadow-none hover:-translate-y-0.5"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" strokeWidth={2} />
          )}
          儲存變更
        </button>
      </div>

      {mainOrder && renderEditableTable(mainOrder, "【主母單】", true)}

      {childrenOrders.length > 0 && (
        <div className="mt-12 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-slate-400 text-[12px] font-bold tracking-[0.2em] uppercase bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
              關聯子生產單物料細節
            </span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>
          {childrenOrders.map((child) =>
            renderEditableTable(child, "【子生產單】", false),
          )}
        </div>
      )}

      {/* 🌟 批號替換 Modal (無邊界 Overlay 設計，輕量化字體) */}
      {replaceModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] w-full max-w-[420px] flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center rounded-t-3xl bg-white relative z-20">
              <h3 className="text-[17px] font-bold text-slate-800 flex items-center gap-2.5 tracking-tight">
                <RefreshCw
                  className="text-blue-500"
                  size={18}
                  strokeWidth={2.5}
                />{" "}
                替換物料批號
              </h3>
              <button
                onClick={() =>
                  setReplaceModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6 relative z-10 bg-white">
              {replaceModal.loading ? (
                <div className="flex flex-col justify-center items-center py-8 text-slate-400 font-medium gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  搜尋可用庫存中...
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-[13px] space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">
                        替換物料
                      </span>
                      <span className="text-slate-800 font-bold max-w-[200px] truncate text-right">
                        <span className="text-slate-400 font-mono mr-1.5 text-[12px]">
                          [{replaceModal.materialCode}]
                        </span>
                        {replaceModal.materialName}
                      </span>
                    </div>
                    <div className="w-full h-px bg-slate-200/50"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">
                        目前批號
                      </span>
                      <span className="text-slate-700 font-mono font-medium bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm text-[13px]">
                        {replaceModal.oldBatchNumber}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">
                        原本用量
                      </span>
                      <span className="text-blue-600 font-mono font-bold text-[14px]">
                        {replaceModal.oldUsedQty}
                      </span>
                    </div>
                  </div>

                  <div className="relative z-50">
                    <label className="block text-[12px] font-bold text-slate-500 mb-2 uppercase tracking-wide">
                      1. 選擇新批號 <span className="text-red-500">*</span>
                    </label>
                    <OverlaySelect
                      value={replaceModal.selectedBatchId}
                      onChange={(id) =>
                        setReplaceModal((prev) => ({
                          ...prev,
                          selectedBatchId: id,
                        }))
                      }
                      options={replaceModal.batches.map((b) => ({
                        id: b.id,
                        batch_number: b.batch_number,
                        remaining_qty: parseFloat(b.remaining_qty),
                      }))}
                      placeholder="請下拉選擇可用批號..."
                    />
                  </div>

                  <div className="relative z-10">
                    <label className="block text-[12px] font-bold text-slate-500 mb-2 uppercase tracking-wide flex justify-between items-end">
                      <span>
                        2. 設定新用量 <span className="text-red-500">*</span>
                      </span>
                      {replaceModal.selectedBatchId && (
                        <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100 lowercase font-mono">
                          庫存上限: {maxAvailable}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={replaceModal.newUsedQty}
                      onChange={(e) =>
                        setReplaceModal((prev) => ({
                          ...prev,
                          newUsedQty: e.target.value,
                        }))
                      }
                      className={`w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-[15px] font-mono font-medium focus:outline-none transition-all shadow-sm ${
                        replaceModal.newUsedQty !== "" &&
                        (isUnder || isExceedingStock)
                          ? "text-red-600 focus:ring-2 focus:ring-red-500/10 focus:border-red-400"
                          : "text-slate-800 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400"
                      }`}
                    />

                    {replaceModal.newUsedQty !== "" && (
                      <div className="mt-3 flex flex-col gap-2">
                        {isExceedingStock && (
                          <div className="text-[12px] font-medium text-red-600 bg-red-50 px-3 py-2.5 rounded-lg border border-red-100 flex items-start gap-2 shadow-sm leading-relaxed">
                            <AlertTriangle
                              size={16}
                              strokeWidth={2}
                              className="shrink-0 mt-0.5"
                            />
                            <div>
                              庫存不足！輸入用量 ({formatNum(newQty)})
                              已超過此批號的剩餘庫存 ({formatNum(maxAvailable)}
                              )。
                            </div>
                          </div>
                        )}
                        {isUnder && (
                          <div className="text-[12px] font-medium text-red-600 bg-red-50 px-3 py-2.5 rounded-lg border border-red-100 flex items-start gap-2 shadow-sm leading-relaxed">
                            <AlertTriangle
                              size={16}
                              strokeWidth={2}
                              className="shrink-0 mt-0.5"
                            />
                            <div>
                              需求量有誤！總分配量 ({formatNum(newTotal)})
                              低於配方需求 ({formatNum(reqQty)})。
                              <br />
                              此批號至少需投入{" "}
                              <span className="font-mono font-bold underline underline-offset-2">
                                {formatNum(minNeeded)}
                              </span>
                              。
                            </div>
                          </div>
                        )}
                        {!isUnder && isOver && !isExceedingStock && (
                          <div className="text-[12px] font-medium text-amber-700 bg-amber-50 px-3 py-2.5 rounded-lg border border-amber-200 flex items-start gap-2 shadow-sm leading-relaxed">
                            <AlertTriangle
                              size={16}
                              strokeWidth={2}
                              className="shrink-0 mt-0.5"
                            />
                            <div>
                              提醒：調整後總分配量 ({formatNum(newTotal)})
                              已超過配方需求 ({formatNum(reqQty)}
                              )，請確認是否為耗損超用 (仍可儲存)。
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl relative z-0">
              <button
                onClick={() =>
                  setReplaceModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="px-5 py-2 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
              >
                取消
              </button>
              <button
                onClick={executeReplaceBatch}
                disabled={
                  replaceModal.loading ||
                  replaceModal.submitting ||
                  !replaceModal.selectedBatchId ||
                  isUnder ||
                  newQty <= 0 ||
                  isExceedingStock
                }
                className="px-5 py-2 text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
              >
                {replaceModal.submitting && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                確認替換
              </button>
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
}
