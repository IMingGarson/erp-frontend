import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Loader2,
  RefreshCw,
  ChevronDown,
  Check,
  PackageOpen,
} from "lucide-react";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import CustomDialog from "./components/customDialog";

const cleanFloat = (val, decimals = 3) => {
  const num = parseFloat(val);
  if (isNaN(num)) return "0";
  return parseFloat(num.toFixed(decimals)).toString();
};

const formatNum = (num, type) => {
  if (num === null || num === undefined || isNaN(num) || num === "") return "0";
  if (type === "PACK") return Math.ceil(num).toString();
  return parseFloat(Number(num).toFixed(5)).toString();
};

const CustomAdjustmentSelect = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const selectRef = useRef(null);
  const dropdownRef = useRef(null);

  const handleToggle = () => {
    if (!isOpen && selectRef.current) {
      const rect = selectRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleScrollOrResize = () => {
      if (isOpen) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  const config = {
    NONE: {
      label: "無調整",
      bg: "bg-slate-50",
      text: "text-slate-600",
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
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
      hover: "hover:bg-rose-100",
    },
  };
  const current = config[value] || config.NONE;

  return (
    <div className="relative w-full" ref={selectRef}>
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full h-10 px-3 flex items-center justify-between rounded-xl text-[13px] font-medium transition-colors border focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none ${current.bg} ${current.text} ${current.border} ${current.hover}`}
      >
        <span className="truncate">{current.label}</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`shrink-0 ml-1 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
            }}
            className="fixed z-[99999] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1"
          >
            {Object.entries(config).map(([key, { label, text }]) => (
              <div
                key={key}
                onClick={() => {
                  onChange(key);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 text-center text-[13px] font-medium cursor-pointer transition-colors hover:bg-slate-50 bg-white ${text}`}
              >
                {label}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
};

const OverlaySelect = ({
  value,
  onChange,
  options,
  placeholder,
  disabledBatchIds = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOpt = options.find((o) => String(o.id) === String(value));

  return (
    <div className="relative w-full">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`w-full h-11 px-4 flex justify-between items-center bg-white border rounded-xl text-sm font-medium transition-all duration-200 shadow-sm ${
          isOpen
            ? "border-blue-400 ring-2 ring-blue-500/10"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        {selectedOpt ? (
          <div className="flex justify-between items-center w-full pr-3 gap-2">
            <span className="font-mono font-medium text-slate-700 text-[14px] truncate">
              {selectedOpt.batch_number}
            </span>
            <span className="text-[12px] font-medium text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100 shrink-0">
              餘: {cleanFloat(selectedOpt.remaining_qty)}
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

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
            }}
            className="fixed z-[99999] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl flex flex-col max-h-60 overflow-y-auto custom-scrollbar"
          >
            <div className="p-2 space-y-1">
              {options.length > 0 ? (
                options.map((opt) => {
                  const isSelected = String(value) === String(opt.id);
                  const isDisabled =
                    disabledBatchIds.includes(String(opt.id)) && !isSelected;

                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        if (!isDisabled) {
                          onChange(opt.id);
                          setIsOpen(false);
                        }
                      }}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all border ${
                        isDisabled
                          ? "bg-slate-100/60 border-transparent opacity-40 cursor-not-allowed"
                          : isSelected
                            ? "bg-blue-50/80 border-blue-100 cursor-pointer"
                            : "bg-white border-transparent hover:bg-slate-50 cursor-pointer"
                      }`}
                    >
                      <div className="flex justify-between items-center w-full pr-3 gap-2">
                        <span
                          className={`font-mono text-[14px] truncate ${isSelected ? "font-semibold text-blue-700" : "font-medium text-slate-600"}`}
                        >
                          {opt.batch_number}
                        </span>
                        <span
                          className={`text-[12px] font-medium px-2.5 py-0.5 rounded-md border shrink-0 ${isSelected ? "text-blue-600 bg-white border-blue-200" : "text-slate-500 bg-slate-50 border-slate-200"}`}
                        >
                          餘: {cleanFloat(opt.remaining_qty)}
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
                  <PackageOpen size={28} className="opacity-30" />{" "}
                  無其他可用庫存
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default function ProductionOrderEditPage() {
  const { production_order_id } = useParams();
  const navigate = useNavigate();
  const [mainHeaderForm, setMainHeaderForm] = useState({
    is_completed: false,
    completed_date: "",
    actual_qty: "",
  });
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
    items: [],
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

      setMainHeaderForm({
        is_completed: orderData.is_completed || false,
        completed_date: orderData.completed_date || "",
        actual_qty:
          orderData.actual_qty !== null && orderData.actual_qty !== undefined
            ? orderData.actual_qty
            : "",
      });

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

      const mainHeaderPayload = {
        materials_info: updatedMainMaterials,
        is_completed: mainHeaderForm.is_completed,
        completed_date: mainHeaderForm.completed_date || null,
        actual_qty:
          mainHeaderForm.actual_qty !== "" ? mainHeaderForm.actual_qty : null,
      };

      promises.push(
        fetchWithAuth(`/api/production_orders/${mainOrder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mainHeaderPayload),
        }).then((res) => {
          if (!res.ok) throw new Error(`生產單儲存失敗`);
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
    const defaultOldUsed = parseFloat(oldUsed) || 0;
    setReplaceModal({
      isOpen: true,
      loading: true,
      submitting: false,
      orderId,
      materialCode: matCode,
      materialName: matName,
      oldBatchNumber: oldBatchNum,
      oldUsedQty: defaultOldUsed,
      requiredQty: parseFloat(requiredQty) || 0,
      currentTotalAllocated: parseFloat(currentTotalAllocated) || 0,
      batches: [],
      items: [
        { id: Date.now(), batchId: "", usedQty: defaultOldUsed.toString() },
      ],
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

  const handleAddReplaceItem = () => {
    setReplaceModal((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { id: Date.now(), batchId: "", description: "", usedQty: "" },
      ],
    }));
  };

  const handleRemoveReplaceItem = (id) => {
    if (replaceModal.items.length <= 1) return;
    setReplaceModal((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  };

  const handleReplaceItemChange = (id, field, value) => {
    setReplaceModal((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const executeReplaceBatch = async () => {
    for (const item of replaceModal.items) {
      if (!item.batchId)
        return showAlert("錯誤", "請為所有項目選擇新批號", "warning");
      const q = parseFloat(item.usedQty);
      if (isNaN(q) || q <= 0)
        return showAlert("錯誤", "請輸入有效的新使用量", "warning");
    }

    if (hasDuplicateBatch)
      return showAlert("錯誤", "不能重複選擇相同的替換批號", "warning");
    if (isNotEqualToOriginal)
      return showAlert(
        "錯誤",
        `替換後的批號總用量 (${cleanFloat(totalNewQty)}) 必須等同於原本批號使用的總用量 (${cleanFloat(oldQty)})`,
        "warning",
      );

    setReplaceModal((prev) => ({ ...prev, submitting: true }));
    try {
      const payload = {
        material_code: replaceModal.materialCode,
        old_batch_number: replaceModal.oldBatchNumber,
        old_used_qty: replaceModal.oldUsedQty,
        replacements: replaceModal.items.map((item) => ({
          batch_number: replaceModal.batches.find(
            (b) => String(b.id) === String(item.batchId),
          )?.batch_number,
          used_qty: parseFloat(item.usedQty) || 0,
        })),
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

      showAlert("成功", "多筆批號替換與庫存更新成功", "success");
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
  const totalNewQty = replaceModal.items.reduce((sum, item) => {
    const val = parseFloat(item.usedQty);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  const isNotEqualToOriginal = Math.abs(totalNewQty - oldQty) > 1e-9;
  const hasExceedingStock = replaceModal.items.some((item) => {
    if (!item.batchId || item.usedQty === "") return false;
    const bInfo = replaceModal.batches.find(
      (b) => String(b.id) === String(item.batchId),
    );
    const maxQ = bInfo ? parseFloat(bInfo.remaining_qty) || 0 : 0;
    return parseFloat(item.usedQty) > maxQ;
  });
  const batchIdsSelected = replaceModal.items
    .map((i) => i.batchId)
    .filter(Boolean);
  const hasDuplicateBatch =
    new Set(batchIdsSelected).size !== batchIdsSelected.length;
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
      <div key={order.id} className="w-full mb-9">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden w-full">
          <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-slate-800 text-[15px] flex flex-wrap items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${isMain ? "bg-blue-500" : "bg-purple-500"}`}
              ></span>
              <span className="text-slate-500 tracking-wide font-semibold">
                {labelTitle}
              </span>
              <span className="font-mono text-slate-900 font-bold">
                {order.order_number}
              </span>
              <span className="bg-white border border-slate-200 px-3 py-1 rounded-lg text-[13px] font-semibold text-slate-700 shadow-2xs">
                {order.product_profile?.name || order.product_name}
              </span>
            </h3>
          </div>

          <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full text-left border-collapse table-fixed min-w-[1160px]">
              <thead className="bg-slate-50/50 text-[12px] text-slate-500 font-semibold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-4 px-5 w-[21%]">原料編號 / 名稱</th>
                  <th className="py-4 px-4 w-[18%]">投入批號</th>
                  <th className="py-4 px-3 w-[8%] text-right">投入包數</th>
                  <th className="py-4 px-3 w-[8%] text-right">空袋數</th>
                  <th className="py-4 px-3 w-[9%] text-right">配方用量</th>
                  <th className="py-4 px-3 w-[9%] text-right">耗損量</th>
                  <th className="py-4 px-3 w-[9%] text-right">實際用量</th>
                  <th className="py-4 px-3 w-[8%] text-center">盤盈虧</th>
                  <th className="py-4 px-5 w-[9%] text-right">盈虧數</th>
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

                  if (usedBatches.length === 0 && !isMain) {
                    return (
                      <tr key={mat.code} className="bg-slate-50/40">
                        <td className="py-4 px-5 align-middle">
                          <div className="font-semibold text-slate-600 truncate">
                            {mat.materialName}
                          </div>
                        </td>
                        <td
                          className="py-4 px-5 text-center text-slate-400 font-medium text-[13px]"
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
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        {idx === 0 ? (
                          <td
                            className="py-4 px-5 align-middle border-r border-slate-100/80"
                            rowSpan={usedBatches.length}
                          >
                            <div className="flex flex-col gap-1.5 pr-2">
                              <span className="font-mono text-[11px] text-slate-400 font-medium tracking-wide">
                                {mat.code}
                              </span>
                              <span className="text-slate-800 font-bold leading-snug">
                                {mat.materialName}
                              </span>
                              {mat.remark && (
                                <span className="mt-0.5 w-fit px-2 py-0.5 font-mono text-[11px] bg-slate-100 rounded-md text-slate-600 border border-slate-200/80 font-medium">
                                  {mat.remark}
                                </span>
                              )}
                            </div>
                          </td>
                        ) : null}

                        <td className="py-4 px-4 align-middle">
                          <div className="flex flex-col items-start justify-center gap-2">
                            <span
                              className={`font-mono font-medium text-[12px] px-2.5 py-1 rounded-lg border break-all ${
                                mat.type === "SEMI" ||
                                mat.type === "CHILD_PRODUCT"
                                  ? "text-purple-700 bg-purple-50/90 border-purple-200"
                                  : "text-blue-700 bg-blue-50/90 border-blue-200"
                              }`}
                            >
                              {b.batch_number}
                            </span>
                            {isConvertible && (
                              <button
                                type="button"
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
                                className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/60 rounded-full text-[11px] font-medium transition-all active:scale-95 shadow-2xs"
                                title="替換批號與庫存"
                              >
                                <RefreshCw size={11} strokeWidth={2} /> 替換
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-3 align-middle">
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
                            className="w-full h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-right font-mono text-[14px] font-medium text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300 placeholder:font-sans"
                            placeholder="0"
                          />
                        </td>

                        <td className="py-4 px-3 align-middle">
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
                            className="w-full h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-right font-mono text-[14px] font-medium text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300 placeholder:font-sans"
                            placeholder="0"
                          />
                        </td>

                        <td className="py-4 px-3 text-right font-mono font-semibold text-slate-700 align-middle text-[14px]">
                          {formatNum(b.used, mat.type)}
                        </td>

                        <td className="py-4 px-3 align-middle">
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
                            className="w-full h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-right font-mono text-[14px] text-orange-600 font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 outline-none transition-all placeholder:text-slate-300 placeholder:font-sans"
                            placeholder="0.0"
                          />
                        </td>

                        <td className="py-4 px-3 align-middle">
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
                            className="w-full h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-right font-mono text-[14px] text-blue-600 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-300 placeholder:font-sans"
                            placeholder="0.00"
                          />
                        </td>

                        <td className="py-4 px-3 align-middle">
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

                        <td className="py-4 px-5 align-middle">
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
                            className={`w-full h-10 px-2.5 rounded-xl text-right font-mono text-[14px] font-medium focus:outline-none transition-all ${
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
    <div className="p-6 md:p-10 max-w-[1440px] mx-auto bg-slate-50 min-h-screen font-sans text-slate-800 w-full relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-slate-400 hover:text-blue-600 transition-colors tracking-wider"
          >
            <ArrowLeft size={15} strokeWidth={2} /> 返回列表
          </button>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex flex-wrap items-center gap-3">
            <span>生產單編輯</span>
            <span className="text-sm px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-xl font-mono font-semibold shadow-2xs">
              單號: {mainOrder?.order_number}
            </span>
          </h2>
        </div>
      </div>

      {/* 🌟 生產完工狀態與實際產量回填表單區塊 */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 md:p-7 mb-9 w-full">
        <h3 className="font-bold text-slate-800 text-[15px] mb-5 flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          生產完工與實際產量回填
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-3 bg-slate-50/80 border border-slate-200/80 px-4 py-3 rounded-xl">
            <input
              type="checkbox"
              id="is_completed"
              checked={mainHeaderForm.is_completed}
              onChange={(e) =>
                setMainHeaderForm((prev) => ({
                  ...prev,
                  is_completed: e.target.checked,
                }))
              }
              className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label
              htmlFor="is_completed"
              className="text-sm font-semibold text-slate-700 cursor-pointer select-none"
            >
              標記為「製造完成」
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">
              完工日期
            </label>
            <input
              type="date"
              value={mainHeaderForm.completed_date || ""}
              onChange={(e) =>
                setMainHeaderForm((prev) => ({
                  ...prev,
                  completed_date: e.target.value,
                }))
              }
              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">
              最終實際產量 (KG)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={mainHeaderForm.actual_qty || ""}
              onChange={(e) =>
                setMainHeaderForm((prev) => ({
                  ...prev,
                  actual_qty: e.target.value,
                }))
              }
              placeholder="請輸入實際產量"
              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl font-mono text-sm font-semibold text-blue-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {mainOrder && renderEditableTable(mainOrder, "【主母單】", true)}

      {childrenOrders.length > 0 && (
        <div className="mt-12 w-full">
          <div className="flex items-center gap-4 mb-7">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-slate-500 text-[12px] font-semibold tracking-widest uppercase bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-2xs">
              關聯子生產單物料細節
            </span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>
          {childrenOrders.map((child) =>
            renderEditableTable(child, "【子生產單】", false),
          )}
        </div>
      )}
      <div className="w-full flex justify-end">
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={submitting}
          className="md:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium text-[14px] shadow-sm flex items-center justify-center gap-2 disabled:bg-blue-300 disabled:shadow-none"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" strokeWidth={2} />
          )}
          儲存變更
        </button>
      </div>

      {/* 🌟 批號替換 Modal */}
      {replaceModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[440px] flex flex-col relative border border-slate-100">
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
                type="button"
                onClick={() =>
                  setReplaceModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6 relative z-10 bg-white max-h-[65vh] overflow-y-auto overflow-x-visible pb-64 custom-scrollbar">
              {replaceModal.loading ? (
                <div className="flex flex-col justify-center items-center py-8 text-slate-400 font-medium gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  搜尋可用庫存中...
                </div>
              ) : (
                <>
                  <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/70 text-[13px] space-y-3">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-slate-500 font-medium shrink-0">
                        替換物料
                      </span>
                      <span className="text-slate-800 font-bold truncate text-right">
                        <span className="text-slate-400 font-mono mr-1.5 text-[12px]">
                          [{replaceModal.materialCode}]
                        </span>
                        {replaceModal.materialName}
                      </span>
                    </div>
                    <div className="w-full h-px bg-slate-200/60"></div>
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-slate-500 font-medium">
                        目前批號
                      </span>
                      <span className="text-slate-700 font-mono font-medium bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs text-[13px]">
                        {replaceModal.oldBatchNumber}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-slate-500 font-medium">
                        原本用量
                      </span>
                      <span className="text-blue-600 font-mono font-bold text-[14px]">
                        {cleanFloat(replaceModal.oldUsedQty)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="block text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                        選擇替換的新批號與用量{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleAddReplaceItem}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 transition-colors"
                      >
                        + 增加一筆批號
                      </button>
                    </div>

                    {replaceModal.items.map((item, index) => {
                      const selectedB = replaceModal.batches.find(
                        (b) => String(b.id) === String(item.batchId),
                      );
                      const maxQ = selectedB
                        ? parseFloat(selectedB.remaining_qty) || 0
                        : 0;
                      const itemQ = parseFloat(item.usedQty) || 0;
                      const isItemExceed = item.batchId && itemQ > maxQ;

                      const otherSelectedBatchIds = replaceModal.items
                        .filter((i) => i.id !== item.id)
                        .map((i) => String(i.batchId))
                        .filter(Boolean);

                      return (
                        <div
                          key={item.id}
                          className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-3.5 relative"
                        >
                          {replaceModal.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveReplaceItem(item.id)}
                              className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 text-sm font-bold"
                            >
                              ×
                            </button>
                          )}
                          <div>
                            <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                              新批號 #{index + 1}
                            </span>
                            <OverlaySelect
                              value={item.batchId}
                              onChange={(id) =>
                                handleReplaceItemChange(item.id, "batchId", id)
                              }
                              options={replaceModal.batches.map((b) => ({
                                id: b.id,
                                batch_number: b.batch_number,
                                remaining_qty: parseFloat(b.remaining_qty),
                              }))}
                              placeholder="請選擇可用批號..."
                              disabledBatchIds={otherSelectedBatchIds}
                            />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[11px] font-semibold text-slate-500">
                                使用量
                              </span>
                              {selectedB && (
                                <span className="text-[11px] text-blue-600 font-mono">
                                  庫存上限: {cleanFloat(maxQ)}
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.usedQty}
                              onChange={(e) =>
                                handleReplaceItemChange(
                                  item.id,
                                  "usedQty",
                                  e.target.value,
                                )
                              }
                              placeholder="0"
                              className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-400"
                            />
                          </div>
                          {isItemExceed && (
                            <p className="text-[11px] text-rose-600 font-medium">
                              ⚠️ 輸入用量超過該批號剩餘庫存
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 text-xs space-y-2 font-medium text-slate-600">
                    <div className="flex justify-between">
                      <span>原本用量：</span>
                      <span className="font-mono font-bold text-slate-800">
                        {cleanFloat(oldQty)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>替換後總用量：</span>
                      <span
                        className={`font-mono font-bold ${isNotEqualToOriginal ? "text-rose-600" : "text-blue-600"}`}
                      >
                        {cleanFloat(totalNewQty)}
                      </span>
                    </div>
                    {isNotEqualToOriginal && (
                      <p className="text-rose-600 font-semibold pt-1">
                        ⚠️ 替換後的總用量必須等同於原本用量 (
                        {cleanFloat(oldQty)})！
                      </p>
                    )}
                    {hasDuplicateBatch && (
                      <p className="text-rose-600 font-semibold pt-1">
                        ⚠️ 不可重複選擇相同的替換批號！
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl relative z-0">
              <button
                type="button"
                onClick={() =>
                  setReplaceModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="px-5 py-2 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={executeReplaceBatch}
                disabled={
                  replaceModal.loading ||
                  replaceModal.submitting ||
                  isNotEqualToOriginal ||
                  hasExceedingStock ||
                  hasDuplicateBatch
                }
                className="px-5 py-2 text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
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
