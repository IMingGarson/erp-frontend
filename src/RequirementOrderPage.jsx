import React, { useState, useEffect, useMemo } from "react";
import CustomDialog from "./components/CustomDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import { Printer, ReceiptText, FileText } from "lucide-react";

// --- 工具函數 ---
const getTodayString = (formatted = false) => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return formatted ? `${yyyy}-${mm}-${dd}` : `${yyyy}${mm}${dd}`;
};

const formatNum = (num, type) => {
  if (num === null || num === undefined || isNaN(num) || num === "") return "0";
  if (type === "PACK") return Math.ceil(num).toString();
  return parseFloat(Number(num).toFixed(4)).toString();
};

const TypeTag = ({ type }) => {
  const config = {
    RAW: {
      label: "原物料",
      css: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    SEMI: {
      label: "半成品",
      css: "bg-purple-100 text-purple-700 border-purple-200",
    },
    PACK: {
      label: "包材",
      css: "bg-amber-100 text-amber-700 border-amber-200",
    },
    PRODUCT: {
      label: "成品",
      css: "bg-blue-100 text-blue-700 border-blue-200",
    },
  };
  const typeData = config[type] || {
    label: type,
    css: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`inline-block text-center min-w-[56px] px-2 py-0.5 rounded text-xs font-bold border flex-shrink-0 ${typeData.css}`}
    >
      {typeData.label}
    </span>
  );
};

const RequirementOrderPage = () => {
  const [materials, setMaterials] = useState([]);
  const [boms, setBoms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [mrpPlans, setMrpPlans] = useState([]);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [motherOrderNumber, setMotherOrderNumber] = useState("");

  const [activeMainTab, setActiveMainTab] = useState("create");
  const logisticsOptions = ["新竹物流", "黑貓宅急便", "嘉里物流"];

  const [vendorData, setVendorData] = useState({
    id: "",
    name: "",
    phone: "",
    address: "",
    contact: "",
    shippingDate: "",
    logisticsProvider: "",
    notes: "",
  });
  const [vendorSearch, setVendorSearch] = useState("");
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);

  const [orderItems, setOrderItems] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [targetQty, setTargetQty] = useState("");

  const [allocations, setAllocations] = useState({});
  const [expandedMaterials, setExpandedMaterials] = useState([]);
  const [expandedMrpIds, setExpandedMrpIds] = useState([]);

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewOrdersData, setPreviewOrdersData] = useState([]);
  const [printData, setPrintData] = useState(null);

  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    status: "info",
    title: "",
    message: "",
    onConfirm: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  const [filterVendor, setFilterVendor] = useState("");
  const [filterProduct, setFilterProduct] = useState("");

  const [dailySequence, setDailySequence] = useState(1);

  useEffect(() => {
    fetchData();
  }, []);

  const toggleMaterialExpanded = (key) => {
    setExpandedMaterials((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const toggleMrpExpanded = (id) => {
    setExpandedMrpIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [matRes, bomRes, batchRes, venRes, mrpRes, seqRes, coRes] =
        await Promise.all([
          fetchWithAuth("/api/materials"),
          fetchWithAuth("/api/boms"),
          fetchWithAuth("/api/batches"),
          fetchWithAuth("/api/vendors"),
          fetchWithAuth("/api/mrp?status=PENDING"),
          fetchWithAuth("/api/mrp/daily_sequence"),
          fetchWithAuth("/api/customer_orders"),
        ]);

      if (
        !matRes.ok ||
        !bomRes.ok ||
        !batchRes.ok ||
        !venRes.ok ||
        !mrpRes.ok ||
        !seqRes.ok ||
        !coRes.ok
      )
        throw new Error("資料載入失敗，請確認 API 狀態");

      const matJson = await matRes.json();
      const bomJson = await bomRes.json();
      const batchJson = await batchRes.json();
      const venJson = await venRes.json();
      const mrpJson = await mrpRes.json();
      const seqJson = await seqRes.json();
      const coJson = await coRes.json();

      setMaterials(matJson.data || []);
      setBoms(bomJson.data || []);
      setBatches(batchJson.data || []);
      setVendors(venJson.data || []);
      setCustomerOrders(coJson.data || []);

      const remoteMrp = mrpJson.data || [];
      setMrpPlans(remoteMrp);
      if (seqJson.data && seqJson.data.sequence) {
        setDailySequence(seqJson.data.sequence);
      }

      let loadedAllocations = {};
      remoteMrp.forEach((plan) => {
        if (plan.batch_inventory_info) {
          try {
            const parsedInfo =
              typeof plan.batch_inventory_info === "string"
                ? JSON.parse(plan.batch_inventory_info)
                : plan.batch_inventory_info;
            const isAllocData = (obj) =>
              obj &&
              typeof obj === "object" &&
              Object.values(obj).some((v) => v && v.batches);

            if (isAllocData(parsedInfo)) {
              loadedAllocations[plan.id] = parsedInfo;
            } else {
              const firstKey = Object.keys(parsedInfo)[0];
              if (firstKey && isAllocData(parsedInfo[firstKey])) {
                loadedAllocations[plan.id] = parsedInfo[firstKey];
              }
            }
          } catch (e) {
            console.error("解析 batch_inventory_info 失敗", e);
          }
        }
      });

      setAllocations((prev) => ({ ...prev, ...loadedAllocations }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = (id) => {
    showConfirm("確認刪除", "確定刪除此單嗎？", async () => {
      setIsSubmitting(true);
      try {
        const delRes = await fetchWithAuth(`/api/mrp/${id}`, {
          method: "DELETE",
        });
        if (!delRes.ok) throw new Error("刪除失敗");

        setAllocations((prev) => {
          const newAlloc = { ...prev };
          delete newAlloc[id];
          return newAlloc;
        });

        closeDialog();
        fetchData();
      } catch (err) {
        showAlert("錯誤", err.message, "error");
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const filteredVendors = useMemo(() => {
    if (!vendorSearch) return vendors;
    const term = vendorSearch.toLowerCase();
    return vendors.filter((v) => {
      const matchName = (v.name || "").toLowerCase().includes(term);
      const matchCode = (v.code || "").toLowerCase().includes(term);
      return matchName || matchCode;
    });
  }, [vendors, vendorSearch]);

  const handleSelectVendor = (v) => {
    setVendorData({
      ...vendorData,
      id: v.id,
      name: v.name,
      code: v.code,
      tax_id: v.tax_id,
      phone: v.phone || "",
      address: v.address || "",
      contact: v.contact_person || "",
    });
    setVendorSearch("");
    setIsVendorDropdownOpen(false);
  };

  const handleVendorSearchChange = (e) => {
    setVendorSearch(e.target.value);
    setIsVendorDropdownOpen(true);
    if (!e.target.value) setVendorData({ ...vendorData, id: "", name: "" });
  };

  const producsAndSemis = useMemo(() => {
    return materials.filter((m) => m.type === "PRODUCT" || m.type === "SEMI");
  }, [materials]);

  const handleAddOrderItem = () => {
    if (!selectedProduct || !targetQty || targetQty <= 0) return;
    const product = materials.find(
      (m) => String(m.id) === String(selectedProduct),
    );
    if (!product) return;

    const motherId = `P${getTodayString()}${String(dailySequence).padStart(3, "0")}`;
    setDailySequence((prev) => prev + 1);
    const generatedItems = [];

    const buildDrafts = (matId, qty, currentDraftId) => {
      const mat = materials.find((m) => String(m.id) === String(matId));
      if (!mat) return null;

      let childSeq = 1;
      const children = boms.filter((b) => String(b.parent) === String(matId));
      children.forEach((c) => {
        const childMat = materials.find(
          (m) => String(m.id) === String(c.child),
        );
        if (
          childMat &&
          (childMat.type === "SEMI" || childMat.type === "PRODUCT")
        ) {
          const childQty = qty * parseFloat(c.quantity_required);
          const childDraftId = `${currentDraftId}-${childSeq++}`;
          buildDrafts(c.child, childQty, childDraftId);
        }
      });

      generatedItems.push({
        id: currentDraftId,
        productId: mat.id,
        name: mat.name,
        type: mat.type,
        qty: parseFloat(Number(qty).toFixed(2)),
        unit: mat.unit,
        productCode: mat.code,
      });

      return currentDraftId;
    };

    buildDrafts(selectedProduct, targetQty, motherId);
    setMotherOrderNumber(motherId);
    generatedItems.reverse();

    setOrderItems((prev) => [...prev, ...generatedItems]);
    setActiveTabId(generatedItems[0].id);
    setSelectedProduct("");
    setTargetQty("");
  };

  const handleRemoveOrderItem = (id) => {
    const updated = orderItems.filter((item) => item.id !== id);
    setOrderItems(updated);
    if (activeTabId === id)
      setActiveTabId(updated.length > 0 ? updated[0].id : null);
    setAllocations((prev) => {
      const newAlloc = { ...prev };
      delete newAlloc[id];
      return newAlloc;
    });
  };

  useEffect(() => {
    if (orderItems.length === 0 && mrpPlans.length === 0) return;

    const newAllocations = { ...allocations };
    const globalVirtualBatches = batches.map((b) => ({
      ...b,
      remaining_qty: parseFloat(b.remaining_qty),
    }));

    const applyAllocation = (item, isNewOrder) => {
      const uniqueId = item.id;

      if (newAllocations[uniqueId]) {
        const currentAlloc = { ...newAllocations[uniqueId] };

        Object.keys(currentAlloc).forEach((matIdStr) => {
          const matData = { ...currentAlloc[matIdStr] };
          let matBatches = [...matData.batches];

          matBatches.forEach((bUsed, idx) => {
            const batchIdx = globalVirtualBatches.findIndex(
              (gb) => String(gb.id) === String(bUsed.id),
            );
            if (batchIdx !== -1) {
              const usedAmount = parseFloat(bUsed.used) || 0;
              const currentGlobalRemaining =
                globalVirtualBatches[batchIdx].remaining_qty;
              const actualAvailable = Math.max(
                currentGlobalRemaining,
                usedAmount,
              );

              matBatches[idx] = { ...bUsed, available: actualAvailable };
              globalVirtualBatches[batchIdx].remaining_qty -= usedAmount;
            }
          });

          const existingBatchIds = matBatches.map((b) => String(b.id));
          const freedBatches = globalVirtualBatches
            .filter(
              (gb) =>
                String(gb.material) === String(matIdStr) &&
                gb.remaining_qty > 0 &&
                !existingBatchIds.includes(String(gb.id)),
            )
            .sort(
              (a, b) => new Date(a.received_date) - new Date(b.received_date),
            );

          freedBatches.forEach((fb) => {
            matBatches.push({
              id: fb.id,
              batch_number: fb.batch_number,
              received_date: fb.received_date,
              available: fb.remaining_qty,
              used: "",
            });
          });

          matBatches.sort((a, b) => {
            if (!a.received_date) return 1;
            if (!b.received_date) return -1;
            return new Date(a.received_date) - new Date(b.received_date);
          });

          matData.batches = matBatches;
          currentAlloc[matIdStr] = matData;
        });

        newAllocations[uniqueId] = currentAlloc;
        return;
      }

      const itemReqs = {};
      const productId = isNewOrder ? item.productId : item.product;
      const qtyValue = isNewOrder ? item.qty : item.required_qty;

      const traverse = (parentId, multiplier) => {
        const children = boms.filter(
          (b) => String(b.parent) === String(parentId),
        );
        if (children.length === 0) {
          if (!itemReqs[parentId]) itemReqs[parentId] = 0;
          itemReqs[parentId] += multiplier;
        } else {
          children.forEach((c) =>
            traverse(c.child, multiplier * parseFloat(c.quantity_required)),
          );
        }
      };

      traverse(productId, qtyValue);
      const itemAlloc = {};

      Object.keys(itemReqs).forEach((matIdStr) => {
        const matInfo = materials.find(
          (m) => String(m.id) === String(matIdStr),
        );
        const isPack = matInfo?.type === "PACK";
        let requiredQty = itemReqs[matIdStr];
        if (isPack) requiredQty = Math.ceil(requiredQty);

        const availableBatches = globalVirtualBatches
          .filter(
            (b) =>
              String(b.material) === String(matIdStr) && b.remaining_qty > 0,
          )
          .sort(
            (a, b) => new Date(a.received_date) - new Date(b.received_date),
          );

        let remainingToFulfill = requiredQty;
        const batchAllocations = availableBatches
          .map((b) => {
            let used = 0;
            if (remainingToFulfill > 0) {
              used = Math.min(b.remaining_qty, remainingToFulfill);
              if (isPack) used = Math.ceil(used);
              remainingToFulfill -= used;
              globalVirtualBatches.find((gb) => gb.id === b.id).remaining_qty -=
                used;
            }
            return {
              id: b.id,
              batch_number: b.batch_number,
              received_date: b.received_date,
              available: b.remaining_qty + used,
              used:
                used === 0
                  ? ""
                  : isPack
                    ? Math.ceil(used).toString()
                    : parseFloat(used.toFixed(4)).toString(),
            };
          })
          .filter((b) => b.available > 0);

        itemAlloc[matIdStr] = {
          materialName: matInfo?.name || "未知物料",
          unit: matInfo?.unit || "",
          type: matInfo?.type || "",
          code: matInfo?.code || "",
          requiredQty,
          maxQty: requiredQty * 1.2,
          batches: batchAllocations,
          isShortage: remainingToFulfill > 0.0001,
        };
      });
      newAllocations[uniqueId] = itemAlloc;
    };

    const sortedDrafts = [...mrpPlans].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at),
    );
    sortedDrafts.forEach((d) => applyAllocation(d, false));
    orderItems.forEach((item) => applyAllocation(item, true));

    setAllocations(newAllocations);
  }, [orderItems, mrpPlans, boms, materials, batches]);

  const handleBatchUsageSave = async (orderId, matId, batchId, newVal) => {
    const orderAlloc = { ...allocations[orderId] };
    if (!orderAlloc) return;
    const matData = { ...orderAlloc[matId] };
    const batchIndex = matData.batches.findIndex(
      (b) => String(b.id) === String(batchId),
    );

    if (batchIndex !== -1) {
      const newBatches = [...matData.batches];
      newBatches[batchIndex] = { ...newBatches[batchIndex], used: newVal };
      matData.batches = newBatches;

      const totalAllocated = newBatches.reduce(
        (sum, b) => sum + (parseFloat(b.used) || 0),
        0,
      );
      matData.isShortage = totalAllocated < matData.requiredQty - 0.0001;
    }

    orderAlloc[matId] = matData;
    setAllocations((prev) => ({ ...prev, [orderId]: orderAlloc }));

    const isDraft = mrpPlans.some(
      (p) =>
        String(p.id) === String(orderId) ||
        String(p.frontend_temp_id) === String(orderId),
    );

    if (isDraft) {
      try {
        const res = await fetchWithAuth(`/api/mrp/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch_inventory_info: orderAlloc }),
        });
        if (res.ok) fetchData();
        else throw new Error("更新草稿失敗");
      } catch (err) {
        showAlert("錯誤", err.message, "error");
      }
    } else {
      setBatches((prev) => [...prev]);
    }
  };

  const handleOpenPreview = () => {
    const rootItems = orderItems.filter(
      (item) => !String(item.id).includes("-"),
    );
    console.log(rootItems);
    const previewData = rootItems.map((item) => ({
      _tempId: item.id,
      order_date: getTodayString(true),
      delivery_date: vendorData.shippingDate,
      customer_info: {
        name: vendorData.name,
        code: vendorData.code,
        tax_id: vendorData.tax_id,
        phone: vendorData.phone,
        address: vendorData.address,
        contact: vendorData.contact,
      },
      product_code: item.productCode || "",
      product_name: item.name,
      spec: "",
      quantity: item.qty,
      unit: item.unit,
      logistics_info: {
        provider: vendorData.logisticsProvider,
        notes: vendorData.notes,
      },
      unit_price: "",
      total_amount: "",
      tax_amount: "",
      grand_total: "",
      document_note: "",
    }));

    setPreviewOrdersData(previewData);
    setIsPreviewModalOpen(true);
  };

  const handleConfirmSaveOrder = async () => {
    setIsPreviewModalOpen(false);
    setIsSubmitting(true);
    try {
      const itemMap = {};
      orderItems.forEach((item) => {
        itemMap[item.id] = {
          ...item,
          batch_inventory_info: allocations[item.id] || {},
          children_mrp: [],
        };
      });

      const rootItems = [];
      orderItems.forEach((item) => {
        if (!String(item.id).includes("-")) {
          rootItems.push(itemMap[item.id]);
        } else {
          const parentId = String(item.id).split("-").slice(0, -1).join("-");
          if (itemMap[parentId]) {
            itemMap[parentId].children_mrp.push(itemMap[item.id]);
          }
        }
      });

      const payload = {
        vendor_data: vendorData,
        parent_mrp_payload: rootItems,
      };

      // 1. 建立 MRP 草稿
      const mrpRes = await fetchWithAuth("/api/mrp/bulk_create_drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!mrpRes.ok) throw new Error("MRP 建立失敗");
      const data = await mrpRes.json();
      const parent = data?.data?.find((d) => !d.parent_id);

      for (const previewData of previewOrdersData) {
        const coPayload = {
          order_number: `CO${getTodayString()}${Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, "0")}`,
          order_date: previewData.order_date,
          delivery_date: previewData.delivery_date,
          customer_info: previewData.customer_info,
          product_id: orderItems.find((i) => i.id === previewData._tempId)
            ?.productId,
          mrp_id: parent.id,
          spec: previewData.spec,
          quantity: previewData.quantity,
          unit: previewData.unit,
          unit_price: null,
          total_amount: null,
          tax_amount: null,
          grand_total: null,
          logistics_info: previewData.logistics_info,
          status: "CONFIRMED",
        };

        const coRes = await fetchWithAuth("/api/customer_orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coPayload),
        });

        if (!coRes.ok) {
          throw new Error("客戶訂貨單建立失敗，請確認 API");
        }
      }

      showAlert("成功", "需求單草稿與客戶訂貨單已成功建立", "success");
      setOrderItems([]);
      setVendorData({
        id: "",
        name: "",
        phone: "",
        address: "",
        shippingDate: "",
        logisticsProvider: "",
        notes: "",
      });
      setActiveTabId(null);
      fetchData();
    } catch (err) {
      showAlert("暫存失敗", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintOrder = (order, e) => {
    if (e) e.stopPropagation();
    console.log("d", order);
    setPrintData(order);
    setTimeout(() => {
      const originalTitle = document.title;
      document.title = `客戶訂貨單_${order.order_number}`;
      window.print();
      document.title = originalTitle;
    }, 150);
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      const itemMap = {};
      orderItems.forEach((item) => {
        itemMap[item.id] = {
          ...item,
          batch_inventory_info: allocations[item.id] || {},
          children_mrp: [],
        };
      });

      const rootItems = [];
      orderItems.forEach((item) => {
        if (!String(item.id).includes("-")) {
          rootItems.push(itemMap[item.id]);
        } else {
          const parentId = String(item.id).split("-").slice(0, -1).join("-");
          if (itemMap[parentId]) {
            itemMap[parentId].children_mrp.push(itemMap[item.id]);
          }
        }
      });

      const payload = {
        vendor_data: vendorData,
        parent_mrp_payload: rootItems,
      };

      const res = await fetchWithAuth("/api/mrp/bulk_create_drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok) {
        showAlert("成功", "需求單草稿已儲存", "success");
        setOrderItems([]);
        setVendorData({
          id: "",
          name: "",
          phone: "",
          address: "",
          shippingDate: "",
          logisticsProvider: "",
          notes: "",
        });
        setActiveTabId(null);
        fetchData();
      }
    } catch (err) {
      showAlert("暫存失敗", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertToProduction = (id) => {
    showConfirm(
      "製作生產單",
      "確認要將此單據轉為生產單嗎？\n這將會實際扣除批號庫存。",
      async () => {
        closeDialog();
        setIsSubmitting(true);
        try {
          const res = await fetchWithAuth("/api/mrp/convert_to_production", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mrp_id: id }),
          });

          const json = await res.json();
          if (res.ok) {
            showAlert("操作成功", "成功轉為生產單並完成扣庫", "success");
            fetchData();
          } else {
            throw new Error(json.error || "轉換失敗");
          }
        } catch (err) {
          showAlert("錯誤", err.message, "error");
        } finally {
          setIsSubmitting(false);
        }
      },
    );
  };

  const filteredMrp = useMemo(() => {
    return mrpPlans.filter((d) => {
      const vInfo = d.vendor_info || {};
      const matchVendor =
        !filterVendor || (vInfo.name && vInfo.name.includes(filterVendor));
      const matchProduct =
        !filterProduct ||
        (d.product_name && d.product_name.includes(filterProduct));
      const isRoot = !d.parent_id;

      return matchVendor && matchProduct && isRoot;
    });
  }, [mrpPlans, filterVendor, filterProduct]);

  // --- 客戶訂貨單 預覽與列印樣板 ---
  const CustomerOrderTemplate = ({ order }) => {
    if (!order) return null;
    const cmo = order.customer_orders;
    const customer = cmo[0].customer_info || {};
    const logistics = cmo[0].logistics_info || {};
    const qtyStr = formatNum(order.required_qty, "PRODUCT");

    return (
      <div className="bg-white font-sans text-black relative p-6 print:p-0">
        {/* Header 表頭區塊 */}
        <div className="flex items-end mb-2 w-full">
          <div className="flex-1 text-[14px] leading-relaxed">
            <span className="text-[18px]">基香食品有限公司</span>
            <br />
            桃園市觀音區崙坪里1鄰1-10號
            <br />電 話：03-4988228 <span className="inline-block"></span>傳
            真：03-4988159
          </div>
          <h1 className="text-[32px] font-bold tracking-[1em] m-0 text-center pl-[1em]">
            客戶訂貨單
          </h1>
          <div className="flex-1 text-[14px] text-right pb-1">
            版次:03 <span className="inline-block w-4"></span> 第 1 頁,共 1 頁
          </div>
        </div>

        {/* 客戶與單據資訊表 */}
        <table className="w-full border-collapse border border-black mb-2 text-[14px]">
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1 align-top w-1/3">
                客戶名稱：{customer.name || ""}
              </td>
              <td className="border border-black px-2 py-1 align-top w-1/3">
                客戶編號：{customer.code || ""}
              </td>
              <td className="border border-black px-2 py-1 align-top w-1/3">
                單據日期：{cmo[0].order_date || ""}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 align-top">
                客戶統編：{customer.tax_id || ""}
              </td>
              <td className="border border-black px-2 py-1 align-top">
                聯絡人：{customer.contact || ""}
              </td>
              <td className="border border-black px-2 py-1 align-top">
                單據編號：{cmo[0].order_number}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 align-top">
                客戶電話：{customer.phone || ""}
              </td>
              <td className="border border-black px-2 py-1 align-top">
                客戶傳真：{customer.fax || ""}
              </td>
              <td className="border border-black px-2 py-1 align-top">
                交貨日期：{cmo[0].delivery_date || ""}
              </td>
            </tr>
            <tr>
              <td
                className="border border-black px-2 py-1 align-top"
                colSpan="3"
              >
                送貨地址：{customer.address || ""}
                {logistics.notes && ` (備註: ${logistics.notes})`}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 產品明細表 */}
        <table className="w-full border-collapse border border-black text-center text-[14px]">
          <thead>
            <tr className="font-normal">
              <th className="border border-black px-1 py-1 w-[5%] font-normal">
                序
              </th>
              <th className="border border-black px-1 py-1 w-[15%] font-normal">
                貨品編號
              </th>
              <th className="border border-black px-1 py-1 w-[25%] font-normal">
                品名
              </th>
              <th className="border border-black px-1 py-1 w-[15%] font-normal">
                規格
              </th>
              <th className="border border-black px-1 py-1 w-[8%] font-normal">
                數量
              </th>
              <th className="border border-black px-1 py-1 w-[5%] font-normal">
                單位
              </th>
              <th className="border border-black px-1 py-1 w-[7%] font-normal">
                單價
              </th>
              <th className="border border-black px-1 py-1 w-[10%] font-normal">
                小計
              </th>
              <th className="border border-black px-1 py-1 w-[5%] font-normal">
                附註
              </th>
              <th className="border border-black px-1 py-1 w-[5%] font-normal">
                批號編號
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-1 py-1.5">1</td>
              <td className="border border-black px-1 py-1.5 text-left">
                {order.product_code || ""}
              </td>
              <td className="border border-black px-1 py-1.5 text-left">
                {order.product_name || ""}
              </td>
              <td className="border border-black px-1 py-1.5">
                {order.spec || ""}
              </td>
              <td className="border border-black px-1 py-1.5 text-right">
                {qtyStr}
              </td>
              <td className="border border-black px-1 py-1.5">
                {order.unit || "KG"}
              </td>
              <td className="border border-black px-1 py-1.5">
                {order.unit_price || ""}
              </td>
              <td className="border border-black px-1 py-1.5">
                {order.total_amount || ""}
              </td>
              <td className="border border-black px-1 py-1.5"></td>
              <td className="border border-black px-1 py-1.5"></td>
            </tr>
            {/* 預留空白列 */}
            {[...Array(6)].map((_, idx) => (
              <tr key={idx}>
                <td className="border border-black px-1 py-1.5 text-transparent">
                  .
                </td>
                <td className="border border-black px-1 py-1.5"></td>
                <td className="border border-black px-1 py-1.5"></td>
                <td className="border border-black px-1 py-1.5"></td>
                <td className="border border-black px-1 py-1.5"></td>
                <td className="border border-black px-1 py-1.5"></td>
                <td className="border border-black px-1 py-1.5"></td>
                <td className="border border-black px-1 py-1.5"></td>
                <td className="border border-black px-1 py-1.5"></td>
                <td className="border border-black px-1 py-1.5"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 底部金額與物流狀態 */}
        <table className="w-full border-collapse border border-black border-t-0 text-[14px]">
          <tbody>
            <tr>
              <td className="border-r border-b border-black px-2 py-1 align-top w-1/3">
                合計金額：{order.total_amount || ""}
              </td>
              <td className="border-r border-b border-black px-2 py-1 align-top w-1/3 text-center">
                營業稅：{order.tax_amount || ""}
              </td>
              <td className="border-b border-black px-2 py-1 align-top w-1/3">
                總計金額：{order.grand_total || ""}
              </td>
            </tr>
            <tr>
              <td className="px-2 py-1 align-top" colSpan="3">
                <div className="flex justify-between mb-1">
                  <div>單據備註：{order.document_note || ""}</div>
                  <div>
                    車輛是否清潔：
                    <span className="inline-block w-3 h-3 border border-black relative top-[2px] ml-[2px]"></span>
                  </div>
                  <div>
                    車輛是否上鎖：
                    <span className="inline-block w-3 h-3 border border-black relative top-[2px] ml-[2px]"></span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <div>
                    車輛溫度：________°C 冷藏：0-7°C ，冷凍：-18°C 以下。
                  </div>
                  <div>
                    運輸方式：{logistics.provider || "___________________"}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 簽名區塊 */}
        <div className="flex justify-between mt-4 px-2 text-[14px]">
          <div>主 管：</div>
          <div>經 辦：</div>
          <div>出 貨：</div>
          <div>簽 收：</div>
          <div>表號：C-32</div>
        </div>
      </div>
    );
  };

  const CustomerOrderPrintTemplate = ({ data }) => {
    if (!data) return null;
    return (
      <div className="hidden print:block w-full bg-white text-black font-sans mx-auto print:pt-4 print:p-[15mm]">
        <style>
          {`
          @media print {
            @page { size: A4 landscape; margin: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}
        </style>
        <CustomerOrderTemplate order={data} />
      </div>
    );
  };
  console.log("mrpPlans", mrpPlans);
  if (loading && materials.length === 0)
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="animate-pulse text-slate-500">載入系統資料中...</div>
      </div>
    );

  return (
    <>
      <div className="print:hidden p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              建立物料需求單
            </h2>
          </div>
        </div>

        <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg mb-6 border border-blue-100">
          <p className="flex items-center gap-2 font-medium mb-1">
            <span className="text-lg">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
            <li>
              系統會依據生產數量<strong>「自動計算」</strong>物料需求庫存量。
            </li>
            <li>
              確認分配後，點擊「預覽並建立訂單」可同時產生 MRP 與{" "}
              <strong>客戶訂貨單</strong>。
            </li>
            <li>
              核對無誤後，請至查看分頁將草稿<strong>「製作生產單」</strong>
              ，製作後系統會扣除實際庫存。
            </li>
          </ul>
        </div>

        <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-lg mb-6 w-fit">
          <button
            onClick={() => setActiveMainTab("create")}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeMainTab === "create" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
          >
            新增物料需求單
          </button>
          <button
            onClick={() => setActiveMainTab("view")}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeMainTab === "view" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
          >
            查看物料需求單 ({mrpPlans.length})
          </button>
        </div>

        {activeMainTab === "create" ? (
          <>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                1. 填寫客戶與出貨資訊
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                    搜尋客戶名稱或代碼 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vendorSearch || vendorData.name}
                    onChange={handleVendorSearchChange}
                    onFocus={() => setIsVendorDropdownOpen(true)}
                    onBlur={() =>
                      setTimeout(() => setIsVendorDropdownOpen(false), 200)
                    }
                    placeholder="輸入名稱或代碼搜尋"
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  {isVendorDropdownOpen && vendorSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-48 overflow-y-auto">
                      {filteredVendors.map((v) => (
                        <div
                          key={v.id}
                          onClick={() => handleSelectVendor(v)}
                          className="group flex items-center p-3 cursor-pointer border-b border-slate-50 hover:bg-blue-50 transition-all duration-200"
                        >
                          {v.code && (
                            <div className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shadow-sm group-hover:bg-white group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                              {v.code}
                            </div>
                          )}
                          <div className="px-5 font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                            {v.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                    預計出貨日期 *
                  </label>
                  <input
                    type="date"
                    value={vendorData.shippingDate}
                    onChange={(e) =>
                      setVendorData({
                        ...vendorData,
                        shippingDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                    物流商選擇 *
                  </label>
                  <select
                    value={vendorData.logisticsProvider}
                    onChange={(e) =>
                      setVendorData({
                        ...vendorData,
                        logisticsProvider: e.target.value,
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">-- 請選擇物流商 --</option>
                    {logisticsOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                    出貨地址
                  </label>
                  <input
                    type="text"
                    value={vendorData.address}
                    onChange={(e) =>
                      setVendorData({ ...vendorData, address: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                    備註事項
                  </label>
                  <input
                    type="text"
                    value={vendorData.notes}
                    onChange={(e) =>
                      setVendorData({ ...vendorData, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="輸入備註..."
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                2. 新增生產項目
              </h3>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                    選擇產品
                  </label>
                  <div className="relative w-full">
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className="appearance-none w-full bg-white border border-slate-300 rounded-lg pl-4 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="" disabled>
                        -- 請選擇品項 --
                      </option>
                      {producsAndSemis.map((m) => (
                        <option key={m.id} value={m.id}>
                          [{m.type}] {m.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-1/4">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                    製令數量 (公斤)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={targetQty}
                    onChange={(e) => setTargetQty(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="輸入數量"
                  />
                </div>

                <button
                  onClick={handleAddOrderItem}
                  disabled={!selectedProduct || !targetQty || targetQty <= 0}
                  className="w-full md:w-auto shrink-0 whitespace-nowrap px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors disabled:bg-slate-300"
                >
                  新增
                </button>
              </div>
            </div>

            {orderItems.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                  3. 底層物料庫存分配
                </h3>
                <div className="flex overflow-x-auto border-b border-slate-200 mb-6 custom-scrollbar">
                  {orderItems.map((item) => {
                    const hasShortage =
                      allocations[item.id] &&
                      Object.values(allocations[item.id]).some(
                        (mat) => mat.isShortage,
                      );
                    const isChild = String(item.id).includes("-");

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 px-5 py-3 border-b-2 cursor-pointer transition-colors ${activeTabId === item.id ? "border-blue-600 text-blue-700 font-bold bg-blue-50/50" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                        onClick={() => setActiveTabId(item.id)}
                      >
                        {isChild && (
                          <span className="text-slate-300 font-bold">↳</span>
                        )}
                        <TypeTag type={item.type} />
                        <span
                          className={
                            hasShortage ? "text-red-600 font-black" : ""
                          }
                        >
                          {item.name}{" "}
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({item.id})
                          </span>
                        </span>
                        {hasShortage && " ⚠️"}
                        <button
                          className="ml-2 rounded-full w-5 h-5 flex items-center justify-center text-xs bg-slate-200 hover:bg-red-500 hover:text-white shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveOrderItem(item.id);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
                {activeTabId && (
                  <MaterialAllocationList
                    itemId={activeTabId}
                    allocations={allocations}
                    expandedMaterials={expandedMaterials}
                    toggleMaterialExpanded={toggleMaterialExpanded}
                    handleBatchUsageSave={handleBatchUsageSave}
                  />
                )}
                <div className="mt-8 flex justify-end items-center border-t border-slate-200 pt-6 gap-4">
                  <button
                    onClick={handleOpenPreview}
                    disabled={
                      !vendorData.name ||
                      isSubmitting ||
                      orderItems.length === 0
                    }
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText size={18} /> 預覽
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4">
              <div className="flex gap-4 flex-wrap">
                <input
                  type="text"
                  placeholder="搜尋客戶"
                  value={filterVendor}
                  onChange={(e) => setFilterVendor(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="搜尋產品"
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600 font-semibold">
                  <tr>
                    <th className="p-4 w-10"></th>
                    <th className="p-4">客戶資訊</th>
                    <th className="p-4">產品名稱</th>
                    <th className="p-4 text-right">需求量</th>
                    <th className="p-4 text-center">狀態</th>
                    <th className="p-4 text-right">建立日期</th>
                    <th className="p-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredMrp.length > 0 ? (
                    filteredMrp.map((d) => {
                      const vInfo = d.vendor_info;
                      const isExpanded = expandedMrpIds.includes(d.id);
                      const displayId = d.frontend_temp_id || d.id;
                      const hasShortage =
                        allocations[displayId] &&
                        Object.values(allocations[displayId]).some(
                          (mat) => mat.isShortage,
                        );

                      return (
                        <React.Fragment key={d.id}>
                          <tr
                            className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${isExpanded ? "bg-blue-50/50" : ""}`}
                            onClick={() => toggleMrpExpanded(d.id)}
                          >
                            <td className="p-4 text-center text-slate-400 font-mono text-[10px]">
                              {isExpanded ? "▼" : "▶"}
                            </td>
                            <td className="p-4 text-slate-700">
                              {vInfo.name || "-"}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-700">
                                  {d.product_name}
                                </span>
                                {hasShortage && (
                                  <span
                                    className="text-red-500 text-xs font-bold"
                                    title="庫存不足"
                                  >
                                    ⚠️
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-right text-slate-800 font-mono">
                              {formatNum(d.required_qty, "PRODUCT")} {d.unit}
                            </td>
                            <td className="p-4 text-center">
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase tracking-wider">
                                Pending
                              </span>
                            </td>
                            <td className="p-4 text-slate-400 text-right">
                              {new Date(d.created_at).toLocaleDateString()}
                            </td>
                            <td
                              className="p-4 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex flex-col items-center justify-center gap-2">
                                {d.customer_orders &&
                                  d.customer_orders.length > 0 && (
                                    <button
                                      key={d.customer_orders[0].id}
                                      onClick={(e) => handlePrintOrder(d, e)}
                                      className="w-[90%] px-3 py-1.5 bg-white text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-600 hover:text-white transition-all duration-200 text-xs font-bold shadow-sm cursor-pointer items-center gap-2"
                                    >
                                      列印訂貨單
                                    </button>
                                  )}
                                <button
                                  onClick={() =>
                                    handleConvertToProduction(d.id)
                                  }
                                  disabled={hasShortage}
                                  title={
                                    hasShortage
                                      ? "庫存不足，無法轉為生產單"
                                      : "將此草稿轉為生產單"
                                  }
                                  className="w-[90%] px-3 py-1 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-500 hover:text-white transition-all duration-200 font-bold text-xs cursor-pointer shadow-sm border border-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-50 disabled:hover:text-emerald-600"
                                >
                                  轉生產單
                                </button>
                                <button
                                  onClick={() => handleDeleteDraft(d.id)}
                                  className="w-[90%] px-3 py-1 bg-red-50 text-red-600 rounded-md hover:bg-red-500 hover:text-white transition-all duration-200 font-bold text-xs cursor-pointer shadow-sm border border-red-100"
                                >
                                  刪除
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td
                                colSpan="7"
                                className="p-0 bg-slate-50/50 shadow-inner"
                              >
                                <div className="w-0 min-w-full">
                                  <div className="p-6 w-full max-w-full overflow-hidden">
                                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                                      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm col-span-1 lg:col-span-1">
                                        <h4 className="text-xs font-black text-slate-400 uppercase mb-3 border-b pb-1">
                                          單據細節
                                        </h4>
                                        <div className="space-y-2 text-xs">
                                          <div>
                                            <span className="text-slate-400">
                                              出貨日期:
                                            </span>{" "}
                                            <span className="font-bold ml-1">
                                              {vInfo.shipping_date || "-"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">
                                              物流商:
                                            </span>{" "}
                                            <span className="font-bold ml-1">
                                              {vInfo.logistics || "-"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">
                                              地址:
                                            </span>{" "}
                                            <span className="font-bold ml-1">
                                              {vInfo.address || "-"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">
                                              電話:
                                            </span>{" "}
                                            <span className="font-bold ml-1">
                                              {vInfo.phone || "-"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">
                                              備註:
                                            </span>{" "}
                                            <span className="text-slate-500 ml-1 italic">
                                              {vInfo.notes || "無"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="lg:col-span-3 min-w-0">
                                        {mrpPlans.filter(
                                          (child) =>
                                            child.parent_id === d.mrp_id,
                                        ).length > 0 && (
                                          <div className="mb-6 space-y-3 border-b border-slate-200/60 pb-4">
                                            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                                              <span>子單據</span>
                                            </h4>
                                            {mrpPlans
                                              .filter(
                                                (child) =>
                                                  child.parent_id === d.mrp_id,
                                              )
                                              .map((child) => {
                                                const childDisplayId =
                                                  child.frontend_temp_id ||
                                                  child.id;
                                                const childExpandedKey = `child-mrp-card-${child.id}`;
                                                const isChildCardExpanded =
                                                  expandedMaterials.includes(
                                                    childExpandedKey,
                                                  );

                                                return (
                                                  <div
                                                    key={child.id}
                                                    className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm"
                                                  >
                                                    {/* 子單據 Header */}
                                                    <div
                                                      className="p-3 bg-slate-50 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                                      onClick={() =>
                                                        toggleMaterialExpanded(
                                                          childExpandedKey,
                                                        )
                                                      }
                                                    >
                                                      <div className="flex items-center gap-2">
                                                        <span className="text-slate-400 text-[10px]">
                                                          {isChildCardExpanded
                                                            ? "▼"
                                                            : "▶"}
                                                        </span>
                                                        <span className="font-mono text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                                                          {" "}
                                                          {child.mrp_id}
                                                        </span>
                                                        <span className="font-bold text-slate-700 text-sm">
                                                          {child.product_name}
                                                        </span>
                                                      </div>
                                                      <div className="text-xs text-slate-600">
                                                        計畫生產:{" "}
                                                        <span className="font-mono font-bold text-slate-800">
                                                          {formatNum(
                                                            child.required_qty,
                                                            "SEMI",
                                                          )}
                                                        </span>{" "}
                                                        {child.unit}
                                                      </div>
                                                    </div>

                                                    {/* 子單據展開後的物料與批號用量排序內容 */}
                                                    {isChildCardExpanded && (
                                                      <div className="p-4 border-t border-slate-100 bg-white">
                                                        <MaterialAllocationList
                                                          itemId={
                                                            childDisplayId
                                                          }
                                                          allocations={
                                                            allocations
                                                          }
                                                          expandedMaterials={
                                                            expandedMaterials
                                                          }
                                                          toggleMaterialExpanded={
                                                            toggleMaterialExpanded
                                                          }
                                                          handleBatchUsageSave={
                                                            handleBatchUsageSave
                                                          }
                                                        />
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                          </div>
                                        )}
                                        <h4 className="text-xs font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
                                          批號與庫存分配
                                        </h4>
                                        <MaterialAllocationList
                                          itemId={displayId}
                                          allocations={allocations}
                                          expandedMaterials={expandedMaterials}
                                          toggleMaterialExpanded={
                                            toggleMaterialExpanded
                                          }
                                          handleBatchUsageSave={
                                            handleBatchUsageSave
                                          }
                                        />
                                      </div>
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
                        colSpan="7"
                        className="p-12 text-center text-slate-400"
                      >
                        目前無需求單草稿
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 預覽訂單 Modal */}
        {isPreviewModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-100 max-w-5xl w-full max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10 shadow-sm shrink-0">
                <h3 className="text-xl font-bold text-slate-800 tracking-wider flex items-center gap-2">
                  <FileText className="text-blue-600" /> 客戶訂貨單預覽
                </h3>
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="text-slate-400 hover:text-red-500 text-2xl leading-none transition-colors"
                >
                  &times;
                </button>
              </div>

              <div className="overflow-y-auto p-4 md:p-8 flex-1">
                <div
                  className="bg-white shadow-md mx-auto ring-1 ring-black/5"
                  style={{ minWidth: "800px" }}
                >
                  {previewOrdersData.map((orderData, idx) => (
                    <div
                      key={idx}
                      className={
                        idx > 0
                          ? "mt-8 border-t-[4px] border-dashed border-slate-300 pt-8"
                          : ""
                      }
                    >
                      <CustomerOrderTemplate order={orderData} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border-t border-slate-200 p-4 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-5 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  取消修改
                </button>
                <button
                  onClick={handleConfirmSaveOrder}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? "處理中..." : "確認建立 MRP 與訂貨單"}
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
      {/* 隱藏的列印區塊 */}
      {printData && <CustomerOrderPrintTemplate data={printData} />}
    </>
  );
};

const BatchRow = ({
  orderId,
  matId,
  batch,
  matType,
  unit,
  onSave,
  readyOnly = false,
}) => {
  const [tempValue, setTempValue] = useState(batch.used);
  useEffect(() => {
    setTempValue(batch.used);
  }, [batch.used]);

  const isModified = tempValue !== batch.used;
  const handleInternalSave = () => {
    let val = tempValue;
    if (val !== "") {
      let parsedVal = parseFloat(val);
      if (isNaN(parsedVal) || parsedVal < 0) {
        setTempValue(batch.used);
        return;
      }
      if (parsedVal > batch.available) {
        val =
          matType === "PACK"
            ? Math.floor(batch.available).toString()
            : batch.available.toString();
      }
    }
    setTempValue(val);
    onSave(orderId, matId, batch.id, val);
  };

  const totalCapacity = parseFloat(batch.available) || 0;
  const usedQty = parseFloat(tempValue) || 0;
  const remainingQty = Math.max(0, totalCapacity - usedQty);
  const usagePercent =
    totalCapacity > 0 ? Math.min(100, (usedQty / totalCapacity) * 100) : 0;
  const isFullyUsed = usagePercent >= 100;

  return (
    <div
      className={`relative flex flex-col bg-white border p-4 rounded-xl transition-all duration-300 w-full min-h-[110px] ${isModified ? "border-amber-400 ring-2 ring-amber-50 shadow-md" : "border-slate-200 hover:border-blue-300 hover:shadow-md shadow-sm"}`}
    >
      <div className="flex justify-between items-start mb-4 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${usedQty > 0 ? (isFullyUsed ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]") : "bg-slate-300"}`}
            ></span>
            <h4
              className="font-mono text-sm font-black text-slate-800 truncate tracking-wider"
              title={batch.batch_number}
            >
              {batch.batch_number}
            </h4>
          </div>
          {batch.received_date && (
            <div className="text-[10px] text-slate-400 font-mono ml-4">
              保存期限: {new Date(batch.received_date).toLocaleDateString()}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end shrink-0">
          {!readyOnly ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="number"
                  step={matType === "PACK" ? "1" : "0.01"}
                  min={0}
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  placeholder="0"
                  className={`w-24 px-2 py-1.5 text-right text-sm font-mono font-bold border rounded-lg transition-all duration-200 focus:outline-none ${isModified ? "bg-amber-50 border-amber-400 text-amber-900 focus:ring-2 focus:ring-amber-200" : usedQty > 0 ? "border-blue-300 bg-blue-50 text-blue-700 focus:ring-2 focus:ring-blue-200" : "border-slate-200 text-slate-600 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100"}`}
                />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  {isModified && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isModified ? "bg-amber-500" : "hidden"}`}
                  ></span>
                </span>
              </div>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out max-w-[60px] opacity-100`}
              >
                <button
                  onClick={handleInternalSave}
                  className="px-2.5 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 active:scale-95 shadow-md whitespace-nowrap"
                >
                  儲存
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-center shadow-inner min-w-[60px]">
              <span
                className={`text-sm font-mono font-bold ${usedQty > 0 ? "text-blue-600" : "text-slate-400"}`}
              >
                {tempValue || "0"}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-auto">
        <div className="flex justify-between items-end mb-1.5 text-[10px] font-bold text-slate-500">
          <span>
            本次分配:{" "}
            <span
              className={`font-mono text-xs ${usedQty > 0 ? "text-blue-600" : ""}`}
            >
              {formatNum(usedQty, matType)}
            </span>{" "}
            {unit}
          </span>
          <span>
            庫存剩餘:{" "}
            <span className="font-mono text-xs text-slate-700">
              {formatNum(remainingQty, matType)}
            </span>{" "}
            {unit}
          </span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out relative ${isFullyUsed ? "bg-amber-400" : usedQty > 0 ? "bg-blue-500" : "bg-transparent"}`}
            style={{ width: `${usagePercent}%` }}
          >
            {usedQty > 0 && !isFullyUsed && (
              <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MaterialAllocationList = ({
  itemId,
  readyOnly = false,
  allocations,
  expandedMaterials,
  toggleMaterialExpanded,
  handleBatchUsageSave,
}) => {
  const itemAlloc = allocations[itemId];
  if (!itemAlloc)
    return <div className="p-4 text-slate-400">尚未分配物料...</div>;

  const sortedMaterials = Object.entries(itemAlloc).sort(
    ([idA, matA], [idB, matB]) => {
      const isSemiA = matA.type === "SEMI" || matA.type === "PRODUCT";
      const isSemiB = matB.type === "SEMI" || matB.type === "PRODUCT";
      const isPackA = matA.type === "PACK";
      const isPackB = matB.type === "PACK";

      if (isSemiA && !isSemiB) return -1;
      if (!isSemiA && isSemiB) return 1;
      if (isPackA && !isPackB) return 1;
      if (!isPackA && isPackB) return -1;
      return matB.requiredQty - matA.requiredQty;
    },
  );

  return (
    <div className="space-y-3 w-full min-w-0">
      {sortedMaterials.map(([matId, mat]) => {
        const totalAllocated = mat.batches.reduce(
          (sum, b) => sum + (parseFloat(b.used) || 0),
          0,
        );
        const isUnder = totalAllocated < mat.requiredQty - 0.0001;
        const isOver = totalAllocated > mat.maxQty + 0.0001;
        const expandedKey = `${itemId}-${matId}`;
        const isExpanded = expandedMaterials.includes(expandedKey);

        const borderColor = isUnder
          ? "border-red-300"
          : isOver
            ? "border-amber-300"
            : "border-slate-200";
        const bgColor = isUnder
          ? "bg-red-50/30"
          : isOver
            ? "bg-amber-50/20"
            : "bg-white";

        const sortedBatches = [...mat.batches].sort((a, b) => {
          const usedA = parseFloat(a.used) || 0;
          const usedB = parseFloat(b.used) || 0;
          return usedB - usedA;
        });

        return (
          <div
            key={matId}
            className={`border rounded-lg overflow-hidden transition-colors ${borderColor}`}
          >
            <div
              className={`p-3 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer hover:bg-slate-50 ${bgColor}`}
              onClick={() => toggleMaterialExpanded(expandedKey)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-slate-400 text-[10px] w-4 flex-shrink-0">
                  {isExpanded ? "▼" : "▶"}
                </span>
                <TypeTag type={mat.type} />
                <span className="font-bold text-slate-700 truncate">
                  {mat.materialName}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs w-full md:w-auto justify-end">
                {isUnder ? (
                  <span className="font-bold text-red-600 animate-pulse">
                    庫存不足！缺少{" "}
                    {formatNum(mat.requiredQty - totalAllocated, mat.type)}{" "}
                    {mat.unit}
                  </span>
                ) : (
                  <span
                    className={`font-bold ${isOver ? "text-amber-600" : "text-emerald-600"}`}
                  >
                    已分配 {formatNum(totalAllocated, mat.type)} {mat.unit}
                  </span>
                )}
              </div>
            </div>
            {isExpanded && (
              <div className="bg-slate-50 p-3 border-t border-slate-200 w-full min-w-0">
                <div className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-2 gap-2">
                  <span className="text-xs font-bold text-slate-500">
                    批號分配
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">
                      需求: <b>{formatNum(mat.requiredQty, mat.type)}</b>{" "}
                      {mat.unit}
                    </span>
                  </div>
                </div>
                <div className="flex overflow-x-auto gap-4 pb-4 pt-1 snap-x custom-scrollbar w-full min-w-0">
                  {sortedBatches.map((b) => (
                    <div
                      key={b.id}
                      className="w-[85vw] sm:w-[360px] flex-shrink-0 snap-start"
                    >
                      <BatchRow
                        orderId={itemId}
                        matId={matId}
                        batch={b}
                        matType={mat.type}
                        unit={mat.unit}
                        onSave={handleBatchUsageSave}
                        readyOnly={readyOnly}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RequirementOrderPage;
