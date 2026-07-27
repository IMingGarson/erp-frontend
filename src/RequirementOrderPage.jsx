import React, { useState, useEffect, useMemo, useRef } from "react";
import CustomDialog from "./components/customDialog";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import {
  Printer,
  ReceiptText,
  FileText,
  Save,
  Plus,
  Trash2,
} from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dailySequence, setDailySequence] = useState(1);
  const [coDailySequence, setCoDailySequence] = useState(1);

  const [activeMainTab, setActiveMainTab] = useState("create");
  const logisticsOptions = ["新竹物流", "黑貓宅急便", "嘉里物流"];

  const [vendorData, setVendorData] = useState({
    id: "",
    name: "",
    tax_id: "",
    phone: "",
    fax: "",
    address: "",
    contact: "",
    shippingDate: "",
    logisticsProvider: "",
    notes: "",
  });
  const [vendorSearch, setVendorSearch] = useState("");
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);

  const createEmptyRow = (seq = 1) => ({
    id: `P${getTodayString()}${String(seq).padStart(3, "0")}`,
    product_id: "",
    product_code: "",
    product_name: "",
    spec: "",
    quantity: "",
    unit: "",
    unit_price: "",
    used_batch_number: "",
    note: "",
  });

  const [formItems, setFormItems] = useState([createEmptyRow()]);
  const [documentNote, setDocumentNote] = useState("");

  // --- 計算動態總計 ---
  const calculatedTotals = useMemo(() => {
    let total = 0;
    formItems.forEach((item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.unit_price) || 0;
      total += Math.round(q * p);
    });
    const tax = Math.round(total * 0.05);
    return {
      total_amount: total,
      tax_amount: tax,
      grand_total: total + tax,
    };
  }, [formItems]);

  // --- 可搜尋下拉式選單 State & Refs ---
  const [activeDropdownRow, setActiveDropdownRow] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productDropdownStyle, setProductDropdownStyle] = useState({});

  const [orderItems, setOrderItems] = useState([]);
  const [activeTabIds, setActiveTabIds] = useState({});

  const [allocations, setAllocations] = useState({});
  const [expandedMaterials, setExpandedMaterials] = useState([]);
  const [expandedMrpIds, setExpandedMrpIds] = useState([]);

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
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
      const [matRes, bomRes, batchRes, venRes, mrpRes, seqRes, coSeqRes] =
        await Promise.all([
          fetchWithAuth("/api/materials"),
          fetchWithAuth("/api/boms"),
          fetchWithAuth("/api/batches"),
          fetchWithAuth("/api/vendors"),
          fetchWithAuth("/api/mrp"),
          fetchWithAuth("/api/mrp/daily_sequence"),
          fetchWithAuth("/api/customer_orders/daily_sequence"),
        ]);

      if (
        !matRes.ok ||
        !bomRes.ok ||
        !batchRes.ok ||
        !venRes.ok ||
        !mrpRes.ok ||
        !seqRes.ok ||
        !coSeqRes.ok
      )
        throw new Error("資料載入失敗，請確認 API 狀態");

      const matJson = await matRes.json();
      const bomJson = await bomRes.json();
      const batchJson = await batchRes.json();
      const venJson = await venRes.json();
      const mrpJson = await mrpRes.json();
      const seqJson = await seqRes.json();
      const coSeqJson = await coSeqRes.json();

      const loadedMaterials = matJson.data || [];
      setMaterials(loadedMaterials);
      setBoms(bomJson.data || []);
      setBatches(batchJson.data || []);
      setVendors(venJson.data || []);

      const remoteMrp = mrpJson.data || [];
      setMrpPlans(remoteMrp);

      if (seqJson.data && seqJson.data.sequence) {
        setDailySequence(seqJson.data.sequence);
        setFormItems((prev) => {
          if (prev.length === 1 && !prev[0].product_id) {
            return [createEmptyRow(seqJson.data.sequence)];
          }
          return prev;
        });
      }

      if (coSeqJson.data && coSeqJson.data.sequence) {
        setCoDailySequence(coSeqJson.data.sequence);
      }

      let loadedAllocations = {};
      remoteMrp.forEach((plan) => {
        if (plan.batch_inventory_info) {
          try {
            const parsedInfo =
              typeof plan.batch_inventory_info === "string"
                ? JSON.parse(plan.batch_inventory_info)
                : plan.batch_inventory_info;

            let validAllocObj = {};

            if (Array.isArray(parsedInfo)) {
              validAllocObj = {
                _base_qty: parseFloat(plan.required_qty),
                _productId: plan.product_id,
              };
              parsedInfo.forEach((item) => {
                const mat = loadedMaterials.find(
                  (m) => m.code === item.code || m.name === item.materialName,
                );
                if (mat) {
                  validAllocObj[mat.id] = item;
                }
              });
            } else {
              const isAllocData = (obj) =>
                obj &&
                typeof obj === "object" &&
                Object.values(obj).some((v) => v && v.batches);

              if (isAllocData(parsedInfo)) {
                validAllocObj = parsedInfo;
              } else {
                const firstKey = Object.keys(parsedInfo)[0];
                if (firstKey && isAllocData(parsedInfo[firstKey])) {
                  validAllocObj = parsedInfo[firstKey];
                }
              }

              // 補回快取識別欄位，防止重整後自動重新計算覆蓋手動修改的結果
              if (validAllocObj && !validAllocObj._base_qty) {
                validAllocObj._base_qty = parseFloat(plan.required_qty);
                validAllocObj._productId = plan.product_id;
              }
            }

            const displayId = plan.frontend_temp_id || plan.id;
            // 只要有除了 _base_qty 和 _productId 以外的真實物料配置就載入
            if (
              Object.keys(validAllocObj).filter(
                (k) => k !== "_base_qty" && k !== "_productId",
              ).length > 0
            ) {
              loadedAllocations[displayId] = validAllocObj;
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

  const producsAndSemis = useMemo(() => {
    return materials.filter((m) => m.type === "PRODUCT" || m.type === "SEMI");
  }, [materials]);

  const filteredProducts = useMemo(() => {
    const term = productSearchTerm.toLowerCase();
    return producsAndSemis.filter(
      (m) =>
        (m.name && m.name.toLowerCase().includes(term)) ||
        (m.code && m.code.toLowerCase().includes(term)) ||
        (m.type && m.type.toLowerCase().includes(term)),
    );
  }, [producsAndSemis, productSearchTerm]);

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
      tax_id: v.tax_id || "",
      phone: v.phone || "",
      fax: v.fax || "",
      address: v.address || "",
      contact: v.contact_person || "",
    });
    setVendorSearch(v.name);
    setIsVendorDropdownOpen(false);
  };

  const handleVendorSearchChange = (e) => {
    setVendorSearch(e.target.value);
    setIsVendorDropdownOpen(true);
    if (!e.target.value) {
      setVendorData((prev) => ({
        ...prev,
        id: "",
        name: "",
        tax_id: "",
        phone: "",
        fax: "",
        address: "",
        contact: "",
      }));
    }
  };

  // --- 表單列操作 ---
  const handleAddRow = () => {
    const nextSeq = dailySequence + 1;
    setDailySequence(nextSeq);
    setFormItems((prev) => [...prev, createEmptyRow(nextSeq)]);
  };

  const handleRemoveRow = (id) => {
    setFormItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    setFormItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  // --- 下拉式選單邏輯 ---
  const handleToggleProductDropdown = (e, rowId) => {
    if (activeDropdownRow !== rowId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      const dropdownEstimatedHeight = 260;

      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      let dynamicStyle = {
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      };

      if (spaceBelow < dropdownEstimatedHeight && spaceAbove > spaceBelow) {
        dynamicStyle.bottom = `${viewportHeight - rect.top + 4}px`;
      } else {
        dynamicStyle.top = `${rect.bottom + 4}px`;
      }

      setProductDropdownStyle(dynamicStyle);
      setActiveDropdownRow(rowId);
      setProductSearchTerm("");
    } else {
      setActiveDropdownRow(null);
    }
  };

  const handleSelectProduct = (rowId, product) => {
    setFormItems((prev) =>
      prev.map((item) =>
        item.id === rowId
          ? {
              ...item,
              product_id: product.id,
              product_code: product.code || "",
              product_name: product.name || "",
              unit: product.unit || "",
            }
          : item,
      ),
    );
    setActiveDropdownRow(null);
  };

  // --- 監聽數量與產品，自動展開 MRP ---
  useEffect(() => {
    let newOrderItems = [];
    const newActiveTabIds = {};

    formItems.forEach((fItem) => {
      if (!fItem.product_id || Number(fItem.quantity) <= 0) return;

      const product = materials.find(
        (m) => String(m.id) === String(fItem.product_id),
      );
      if (!product) return;

      const qty = Number(fItem.quantity);
      const motherId = fItem.id; // 以列的 ID 作為根單據 ID (無連字號)
      const generatedItems = [];

      const buildDrafts = (matId, currentQty, currentDraftId) => {
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
            const childQty = currentQty * parseFloat(c.quantity_required);
            const childDraftId = `${currentDraftId}-${childSeq++}`;
            buildDrafts(c.child, childQty, childDraftId);
          }
        });

        generatedItems.push({
          id: currentDraftId,
          productId: mat.id,
          name: mat.name,
          type: mat.type,
          qty: parseFloat(Number(currentQty).toFixed(2)),
          unit: mat.unit,
          productCode: mat.code,
        });
      };

      buildDrafts(fItem.product_id, qty, motherId);
      generatedItems.reverse();
      newOrderItems = [...newOrderItems, ...generatedItems];

      if (generatedItems.length > 0) {
        newActiveTabIds[fItem.id] = generatedItems[0].id;
      }
    });

    setOrderItems(newOrderItems);

    // 設置每個 Row 預設選中的 Tab
    setActiveTabIds((prev) => {
      const updated = { ...prev };
      Object.keys(newActiveTabIds).forEach((rowId) => {
        if (
          !updated[rowId] ||
          !newOrderItems.find((i) => i.id === updated[rowId])
        ) {
          updated[rowId] = newActiveTabIds[rowId];
        }
      });
      return updated;
    });
  }, [formItems, materials, boms]);

  useEffect(() => {
    if (orderItems.length === 0 && mrpPlans.length === 0) return;

    const newAllocations = { ...allocations };
    const globalVirtualBatches = batches.map((b) => ({
      ...b,
      remaining_qty: parseFloat(b.remaining_qty),
    }));

    const applyAllocation = (item, isNewOrder) => {
      const uniqueId = item.id;
      // 確保從後端計畫或前端新品皆能準確抓到 productId 和所需數量
      const productId = isNewOrder ? item.productId : item.product_id;
      const qtyValue = isNewOrder ? item.qty : parseFloat(item.required_qty);

      // 如果有舊的配置，偵測產品或數量是否改變，若有則砍掉重新計算以解決更新快取 Bug
      if (newAllocations[uniqueId]) {
        const currentAlloc = { ...newAllocations[uniqueId] };

        if (
          currentAlloc._base_qty !== qtyValue ||
          currentAlloc._productId !== productId
        ) {
          delete newAllocations[uniqueId];
        } else {
          Object.keys(currentAlloc).forEach((matIdStr) => {
            if (matIdStr === "_base_qty" || matIdStr === "_productId") return;
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
      }

      const itemReqs = {};
      const traverse = (parentId, multiplier) => {
        const children = boms.filter(
          (b) => String(b.parent) === String(parentId),
        );
        if (children.length === 0) {
          if (!itemReqs[parentId]) itemReqs[parentId] = 0;
          itemReqs[parentId] += multiplier;
        } else {
          children.forEach((c) => {
            const childMat = materials.find(
              (m) => String(m.id) === String(c.child),
            );
            if (childMat) {
              // 【防雙重扣除機制】成品只負責扣原物料或包材，半成品的扣除由其專屬的生成單負責
              if (childMat.type === "RAW" || childMat.type === "PACK") {
                traverse(c.child, multiplier * parseFloat(c.quantity_required));
              }
            }
          });
        }
      };

      traverse(productId, qtyValue);
      const itemAlloc = { _base_qty: qtyValue, _productId: productId };

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
    const validItems = formItems.filter((i) => i.product_id);

    const payloadData = {
      isPreview: true,
      order_number: "預覽單號",
      order_date: getTodayString(true),
      delivery_date: vendorData.shippingDate,
      customer: {
        name: vendorData.name,
        code: vendorData.code,
        tax_id: vendorData.tax_id,
        phone: vendorData.phone,
        fax: vendorData.fax,
        address: vendorData.address,
        contact: vendorData.contact,
      },
      logistics_info: {
        provider: vendorData.logisticsProvider,
        notes: vendorData.notes,
      },
      items: validItems,
      totals: {
        total_amount: calculatedTotals.total_amount,
        tax_amount: calculatedTotals.tax_amount,
        grand_total: calculatedTotals.grand_total,
        document_note: documentNote,
      },
    };

    setPreviewData(payloadData);
    setIsPreviewModalOpen(true);
  };

  const handleConfirmSaveOrder = async () => {
    setIsPreviewModalOpen(false);
    setIsSubmitting(true);
    try {
      const itemMap = {};
      orderItems.forEach((item) => {
        const cleanBatchInfo = { ...(allocations[item.id] || {}) };
        delete cleanBatchInfo._base_qty;
        delete cleanBatchInfo._productId;

        itemMap[item.id] = {
          ...item,
          batch_inventory_info: cleanBatchInfo,
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

      let createdParents = [];
      if (rootItems.length > 0) {
        const mrpRes = await fetchWithAuth("/api/mrp/bulk_create_drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!mrpRes.ok) throw new Error("MRP 建立失敗");
        const data = await mrpRes.json();
        createdParents = data?.data?.filter((d) => !d.parent_id) || [];
      }

      const order_number = `CO${getTodayString()}${coDailySequence
        .toString()
        .padStart(3, "0")}`;

      let startingCOSeq = coDailySequence;
      for (const item of formItems) {
        const matchedMrp = createdParents.find(
          (p) => String(p.product_id) === String(item.product_id),
        );
        if (!matchedMrp) {
          showAlert("錯誤", "無效的客戶訂購單", "warning");
          break;
        }
        const order_number = `CO${getTodayString()}${startingCOSeq
          .toString()
          .padStart(3, "0")}`;
        const coPayload = {
          order_number: order_number,
          order_date: getTodayString(true),
          delivery_date: vendorData.shippingDate,
          customer_info: {
            name: vendorData.name,
            code: vendorData.code,
            tax_id: vendorData.tax_id,
            phone: vendorData.phone,
            fax: vendorData.fax,
            address: vendorData.address,
            contact: vendorData.contact,
          },
          product_id: item.product_id,
          mrp_id: matchedMrp.id,
          document_note: documentNote,
          spec: item.spec,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price ? Number(item.unit_price) : null,
          total_amount:
            Math.round(Number(item.quantity) * Number(item.unit_price)) || null,
          tax_amount: null,
          grand_total: null,
          logistics_info: {
            provider: vendorData.logisticsProvider,
            notes: vendorData.notes,
          },
          note: item.note,
          used_batch_number: item.used_batch_number,
        };
        const coRes = await fetchWithAuth("/api/customer_orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coPayload),
        });

        if (!coRes.ok) {
          throw new Error("客戶訂貨單建立失敗，請確認 API");
        }
        startingCOSeq++;
      }

      showAlert("成功", "單據已成功建立", "success");
      setOrderItems([]);
      const nextSeq = dailySequence + 1;
      setDailySequence(nextSeq);
      setFormItems([createEmptyRow(nextSeq)]);
      setDocumentNote("");
      setVendorData({
        id: "",
        name: "",
        tax_id: "",
        phone: "",
        fax: "",
        address: "",
        shippingDate: "",
        logisticsProvider: "",
        notes: "",
      });
      setActiveTabIds({});
      setVendorSearch("");
      fetchData();
    } catch (err) {
      showAlert("暫存失敗", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintOrder = (order, e) => {
    if (e) e.stopPropagation();
    setPrintData(order);
    setTimeout(() => {
      const originalTitle = document.title;
      document.title = `客戶訂貨單_${order.order_number || order.note_number || "預覽"}`;
      window.print();
      document.title = originalTitle;
    }, 150);
  };

  const handlePrintPreview = () => {
    if (previewData) {
      setPrintData(previewData);
      setTimeout(() => {
        const originalTitle = document.title;
        document.title = `客戶訂貨單_預覽`;
        window.print();
        document.title = originalTitle;
      }, 150);
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

  const CustomerOrderTemplate = ({ order }) => {
    if (!order) return null;

    const isPreview = order.isPreview;
    let customer, logistics, orderNo, orderDate, deliveryDate, totals, items;

    if (isPreview) {
      customer = order.customer;
      logistics = order.logistics_info;
      orderNo = order.order_number;
      orderDate = order.order_date;
      deliveryDate = order.delivery_date;
      totals = order.totals;
      items = order.items.map((item) => ({
        product_code: item.product_code,
        product_name: item.product_name,
        spec: item.spec,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        subtotal: Math.round(
          Number(item.quantity || 0) * Number(item.unit_price || 0),
        ),
        note: item.note,
        used_batch_number: item.used_batch_number,
      }));
    } else {
      const cmoArray =
        order.customer_orders && Array.isArray(order.customer_orders)
          ? order.customer_orders
          : [order.customer_orders || order];
      const primaryCmo = cmoArray[0] || {};

      customer = primaryCmo.customer_info || order.customer_info || {};
      logistics = primaryCmo.logistics_info || order.logistics_info || {};
      orderNo = primaryCmo.order_number || order.order_number || "";
      orderDate = primaryCmo.order_date || order.order_date || "";
      deliveryDate = primaryCmo.delivery_date || order.delivery_date || "";

      // 合併總計
      const totalAmt =
        cmoArray.reduce(
          (sum, curr) => sum + Number(curr.total_amount || 0),
          0,
        ) || order.total_amount;
      const taxAmt = Math.round(totalAmt * 0.05);

      totals = {
        total_amount: totalAmt,
        tax_amount: taxAmt,
        grand_total: totalAmt + taxAmt,
        document_note: primaryCmo.document_note || order.document_note || "",
      };

      items = cmoArray.map((co) => ({
        product_code: co.product_code || order.product_code,
        product_name: co.product_name || order.product_name,
        spec: co.spec || order.spec,
        quantity: co.quantity || order.required_qty,
        unit: co.unit || order.unit,
        unit_price: co.unit_price || order.unit_price,
        subtotal: co.total_amount || order.total_amount,
        note: co.note || order.note,
        used_batch_number: co.used_batch_number || order.used_batch_number,
      }));
    }

    // 將項目補齊到 10 列
    const paddedItems = [...items];
    while (paddedItems.length < 10) paddedItems.push(null);

    return (
      <div className="bg-white font-sans text-black relative p-6 print:p-0">
        {/* --- Header 區塊 --- */}
        <div className="mb-1 w-full">
          <div className="flex justify-between items-end">
            <div className="flex-1">
              <div className="text-[18px]">基香食品有限公司</div>
              <div className="text-[14px]">桃園市觀音區崙坪里1鄰1-10號</div>
            </div>
            <div className="flex-1 text-center">
              <h1 className="text-[32px] font-bold tracking-[0.5em] m-0 ml-[0.5em] whitespace-nowrap">
                客 戶 訂 貨 單
              </h1>
            </div>
            <div className="flex-1"></div>
          </div>
          <div className="flex justify-between text-[14px] mt-1">
            <div className="flex-1">電 話: 03-4988228</div>
            <div className="flex-1 text-center pr-[4.5rem]">
              傳 真: 03-4988159
            </div>
            <div className="flex-1 text-right">版次:03 第 1 頁,共 1 頁</div>
          </div>
        </div>

        {/* --- 客戶與單據資訊表 --- */}
        <table className="w-full border-collapse border border-black mb-1 text-[14px]">
          <tbody>
            <tr>
              <td className="border border-black px-2 py-0.5 align-top w-[40%]">
                客戶名稱：{customer.name || ""}
              </td>
              <td className="border border-black px-2 py-0.5 align-top w-[30%]">
                客戶編號：{customer.code || ""}
              </td>
              <td className="border border-black px-2 py-0.5 align-top w-[30%]">
                單據日期：{orderDate}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-0.5 align-top">
                客戶統編：{customer.tax_id || ""}
              </td>
              <td className="border border-black px-2 py-0.5 align-top">
                聯 絡 人：{customer.contact || ""}
              </td>
              <td className="border border-black px-2 py-0.5 align-top">
                單據編號：{orderNo}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-0.5 align-top">
                客戶電話：{customer.phone || ""}
              </td>
              <td className="border border-black px-2 py-0.5 align-top">
                客戶傳真：{customer.fax || ""}
              </td>
              <td className="border border-black px-2 py-0.5 align-top">
                交貨日期：{deliveryDate}
              </td>
            </tr>
            <tr>
              <td
                className="border border-black px-2 py-0.5 align-top"
                colSpan="3"
              >
                送貨地址：{customer.address || ""}
                {logistics.notes && ` (備註: ${logistics.notes})`}
              </td>
            </tr>
          </tbody>
        </table>

        {/* --- 產品明細表 (10 欄位) --- */}
        <table className="w-full border-collapse border border-black text-center text-[14px]">
          <thead>
            <tr className="font-normal">
              <th className="border border-black px-1 py-1 w-[4%] font-normal">
                序
              </th>
              <th className="border border-black px-1 py-1 w-[14%] font-normal">
                貨品編號
              </th>
              <th className="border border-black px-1 py-1 w-[22%] font-normal">
                品名
              </th>
              <th className="border border-black px-1 py-1 w-[16%] font-normal">
                規格
              </th>
              <th className="border border-black px-1 py-1 w-[9%] font-normal">
                數量
              </th>
              <th className="border border-black px-1 py-1 w-[5%] font-normal">
                單位
              </th>
              <th className="border border-black px-1 py-1 w-[8%] font-normal">
                單價
              </th>
              <th className="border border-black px-1 py-1 w-[10%] font-normal">
                小計
              </th>
              <th className="border border-black px-1 py-1 w-[5%] font-normal">
                附註
              </th>
              <th className="border border-black px-1 py-1 w-[7%] font-normal">
                批號編號
              </th>
            </tr>
          </thead>
          <tbody>
            {paddedItems.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-black px-1 py-1">
                  {item ? idx + 1 : "."}
                </td>
                <td
                  className={`border border-black px-1 py-1 ${item ? "text-left" : "text-transparent"}`}
                >
                  {item ? item.product_code : "."}
                </td>
                <td
                  className={`border border-black px-1 py-1 ${item ? "text-left" : "text-transparent"}`}
                >
                  {item ? item.product_name : "."}
                </td>
                <td
                  className={`border border-black px-1 py-1 ${item ? "text-left" : "text-transparent"}`}
                >
                  {item ? item.spec : "."}
                </td>
                <td className="border border-black px-1 py-1 text-right">
                  {item && item.quantity
                    ? Number(item.quantity).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })
                    : ""}
                </td>
                <td className="border border-black px-1 py-1">
                  {item ? item.unit : ""}
                </td>
                <td className="border border-black px-1 py-1 text-right">
                  {item
                    ? Number(item.unit_price).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })
                    : ""}
                </td>
                <td className="border border-black px-1 py-1 text-right">
                  {item
                    ? Number(item.subtotal).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })
                    : ""}
                </td>
                <td
                  className={`border border-black px-1 py-1 ${item ? "text-left" : ""}`}
                >
                  {item ? item.note : ""}
                </td>
                <td
                  className={`border border-black px-1 py-1 ${item ? "text-left" : ""}`}
                >
                  {item ? item.used_batch_number : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* --- 底部金額與物流狀態 --- */}
        <table className="w-full border-collapse border border-black border-t-0 text-[14px]">
          <tbody>
            <tr>
              <td className="border-r border-b border-black px-2 py-1 align-top w-[35%]">
                合計金額：{totals.total_amount}
              </td>
              <td className="border-r border-b border-black px-2 py-1 align-top w-[30%] text-center">
                營業稅：{totals.tax_amount}
              </td>
              <td className="border-b border-black px-2 py-1 align-top w-[35%]">
                總計金額：{totals.grand_total}
              </td>
            </tr>
            <tr>
              <td className="px-2 py-1 align-top" colSpan="3">
                <div className="flex justify-between mb-1">
                  <div className="w-[50%]">
                    單據備註：{totals.document_note}
                  </div>
                  <div className="w-[25%] flex items-center">
                    車輛是否清潔：
                    <div className="w-4 h-4 border border-black ml-1 inline-block"></div>
                  </div>
                  <div className="w-[25%] flex items-center">
                    車輛是否上鎖：
                    <div className="w-4 h-4 border border-black ml-1 inline-block"></div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="w-[65%]">
                    車輛溫度：
                    <span className="inline-block w-12 border-b border-black"></span>
                    °C 冷藏：0-7°C , 冷凍：-18°C 以下。
                  </div>
                  <div className="w-[35%]">
                    運輸方式：{logistics.provider || "___________________"}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* --- 簽名區塊 --- */}
        <div className="flex justify-between mt-2 px-4 text-[14px]">
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
      <div className="hidden print:block w-full bg-white text-black font-sans mx-auto print:pt-4">
        <style>
          {`
            @media print {
              @page { size: A4 landscape; margin: 15mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `}
        </style>
        <CustomerOrderTemplate order={data} />
      </div>
    );
  };

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
              建立客戶訂購單
            </h2>
          </div>
        </div>

        <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg mb-6 border border-blue-100">
          <p className="flex items-center gap-2 font-medium mb-1">
            <span className="text-lg">💡</span> 系統功能說明
          </p>
          <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
            <li>
              系統會依據您輸入的數量<strong>「自動即時計算」</strong>需求單
              的物料需求及庫存分配。支援點擊下方按鈕加入多筆明細。
            </li>
            <li>
              單據明細中的單價皆為未稅，系統將自動計算
              <strong> 5% 營業稅</strong>與含稅總額。
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
            新增訂購單
          </button>
          <button
            onClick={() => setActiveMainTab("view")}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeMainTab === "view" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}
          >
            查看線上單據 (
            {mrpPlans.filter((mrp) => mrp.parent_id === null).length})
          </button>
        </div>

        {activeMainTab === "create" ? (
          <div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8 overflow-hidden">
              <div className="p-6 bg-slate-50/50 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <FileText className="text-blue-600" size={20} />
                  1. 客戶訂單與出貨資訊
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="relative lg:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                      搜尋客戶名稱或代碼 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={vendorSearch}
                      onChange={handleVendorSearchChange}
                      onFocus={() => setIsVendorDropdownOpen(true)}
                      onBlur={() =>
                        setTimeout(() => setIsVendorDropdownOpen(false), 200)
                      }
                      placeholder="輸入名稱或代碼搜尋自動帶入"
                      className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
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
                              <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shadow-sm group-hover:bg-white group-hover:text-blue-600 transition-colors">
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
                  <div className="lg:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                      客戶統編
                    </label>
                    <input
                      type="text"
                      value={vendorData.tax_id}
                      onChange={(e) =>
                        setVendorData({ ...vendorData, tax_id: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded focus:outline-none text-slate-600"
                      placeholder="統編"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                      預計出貨日期 <span className="text-red-500">*</span>
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
                      className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                      出貨地址
                    </label>
                    <input
                      type="text"
                      value={vendorData.address}
                      onChange={(e) =>
                        setVendorData({
                          ...vendorData,
                          address: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
                      placeholder="出貨地址"
                    />
                  </div>

                  <div className="lg:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                      物流商選擇 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={vendorData.logisticsProvider}
                      onChange={(e) =>
                        setVendorData({
                          ...vendorData,
                          logisticsProvider: e.target.value,
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
                    >
                      <option value="">-- 請選擇物流商 --</option>
                      {logisticsOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                      備註
                    </label>
                    <input
                      type="text"
                      value={vendorData.notes}
                      onChange={(e) =>
                        setVendorData({
                          ...vendorData,
                          notes: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* --- 表單 Body: 訂單明細與產品項目 (支援多行) --- */}
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ReceiptText className="text-blue-600" size={20} />
                  2. 填寫訂單明細
                </h3>
                <div className="border border-slate-300 rounded-lg overflow-visible shadow-sm">
                  <table className="w-full text-sm text-left bg-white">
                    <thead className="bg-slate-100 border-b border-slate-300 text-slate-700">
                      <tr>
                        <th className="p-3 font-bold w-[25%]">
                          貨品編號 / 搜尋產品
                        </th>
                        <th className="p-3 font-bold w-[15%]">規格</th>
                        <th className="p-3 font-bold w-20">數量</th>
                        <th className="p-3 font-bold w-16">單位</th>
                        <th className="p-3 font-bold w-24">未稅單價</th>
                        <th className="p-3 font-bold w-[12%]">附註</th>
                        <th className="p-3 font-bold w-[12%]">批號編號</th>
                        <th className="p-3 font-bold w-12 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formItems.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="p-3 relative">
                            <button
                              type="button"
                              onClick={(e) =>
                                handleToggleProductDropdown(e, item.id)
                              }
                              className="w-full text-left bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-1 flex justify-between items-center"
                            >
                              <span
                                className={
                                  item.product_id
                                    ? "text-blue-700 font-bold truncate"
                                    : "text-slate-400 truncate"
                                }
                              >
                                {item.product_id
                                  ? `[${item.product_code || "無編號"}] ${item.product_name}`
                                  : "選擇產品..."}
                              </span>
                              <span className="text-slate-400 text-xs shrink-0 ml-1">
                                ▼
                              </span>
                            </button>

                            {activeDropdownRow === item.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-[9998]"
                                  onClick={() => setActiveDropdownRow(null)}
                                ></div>
                                <div
                                  className="fixed z-[9999] bg-white border border-gray-200 rounded-md shadow-2xl flex flex-col max-h-60 overflow-hidden"
                                  style={productDropdownStyle}
                                >
                                  <div className="p-2 border-b border-gray-100 bg-gray-50 shrink-0">
                                    <input
                                      type="text"
                                      placeholder="搜尋產品名稱或代碼..."
                                      value={productSearchTerm}
                                      onChange={(e) =>
                                        setProductSearchTerm(e.target.value)
                                      }
                                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                      autoFocus
                                    />
                                  </div>
                                  <ul className="overflow-y-auto p-1 flex-1">
                                    {filteredProducts.length > 0 ? (
                                      filteredProducts.map((m) => (
                                        <li
                                          key={m.id}
                                          onClick={() =>
                                            handleSelectProduct(item.id, m)
                                          }
                                          className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors ${
                                            item.product_id === m.id
                                              ? "bg-blue-50 text-blue-700 font-bold"
                                              : "text-gray-700 hover:bg-gray-100"
                                          }`}
                                        >
                                          [{m.code || "無編號"}] {m.name}
                                        </li>
                                      ))
                                    ) : (
                                      <li className="px-3 py-4 text-sm text-center text-gray-400">
                                        查無符合的產品
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              </>
                            )}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.spec}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "spec",
                                  e.target.value,
                                )
                              }
                              placeholder="如: 500g/包"
                              className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-1"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "quantity",
                                  e.target.value,
                                )
                              }
                              required
                              placeholder="0"
                              className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-1 font-bold text-blue-700 text-right"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "unit",
                                  e.target.value,
                                )
                              }
                              placeholder="KG"
                              className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-1 text-center"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.unit_price}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "unit_price",
                                  e.target.value,
                                )
                              }
                              placeholder="0"
                              className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-1 text-right"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.note}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "note",
                                  e.target.value,
                                )
                              }
                              placeholder="選填"
                              className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-1 text-slate-500"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.used_batch_number}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "used_batch_number",
                                  e.target.value,
                                )
                              }
                              placeholder="選填"
                              className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-1 text-slate-500"
                            />
                          </td>
                          <td className="p-3 text-center">
                            {formItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(item.id)}
                                className="text-red-400 hover:text-red-600 transition-colors p-1"
                                title="刪除此列"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="bg-slate-50 border-t border-slate-200 p-2 text-center">
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="text-blue-600 hover:text-blue-800 font-bold text-sm flex items-center justify-center w-full py-1.5 rounded transition-colors hover:bg-blue-100"
                    >
                      <Plus size={16} className="mr-1" /> 新增一筆明細
                    </button>
                  </div>
                </div>

                {/* 表單 Footer: 金額小計與備註 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50 p-6 rounded-lg border border-slate-200 mt-6">
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <label className="block font-bold text-slate-700 mb-2">
                        單據備註事項
                      </label>
                      <textarea
                        value={documentNote}
                        onChange={(e) => setDocumentNote(e.target.value)}
                        className="w-full border border-slate-300 rounded p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm resize-none"
                        rows="3"
                        placeholder="請輸入給物流或內部的備註資訊..."
                      ></textarea>
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                        <span className="text-blue-500">*</span>
                        註：車輛溫度、運輸方式等資訊，請於列印後交由人員現場手寫填入。
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 flex flex-col justify-end bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="font-bold">未稅小計：</span>
                      <div className="flex items-center">
                        <span className="mr-2 text-slate-400">NT$</span>
                        <input
                          type="number"
                          value={calculatedTotals.total_amount}
                          readOnly
                          placeholder="0"
                          className="w-32 text-right border-b border-slate-200 bg-transparent focus:outline-none cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="font-bold">營業稅 (5%)：</span>
                      <div className="flex items-center">
                        <span className="mr-2 text-slate-400">NT$</span>
                        <input
                          type="number"
                          value={calculatedTotals.tax_amount}
                          readOnly
                          placeholder="0"
                          className="w-32 text-right border-b border-slate-200 bg-slate-50 text-slate-500 focus:outline-none cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-blue-800 font-bold border-t border-slate-200 pt-3 mt-2">
                      <span className="text-lg">含稅總額：</span>
                      <div className="flex items-center">
                        <span className="mr-2">NT$</span>
                        <input
                          type="number"
                          value={calculatedTotals.grand_total}
                          readOnly
                          placeholder="0"
                          className="w-32 text-right border-b-2 border-blue-500 bg-slate-50 text-xl focus:outline-none cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {orderItems.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                  3. 底層物料庫存分配
                </h3>

                {formItems.map((fItem, index) => {
                  if (!fItem.product_id || Number(fItem.quantity) <= 0)
                    return null;

                  const rowOrderItems = orderItems.filter((item) =>
                    String(item.id).startsWith(fItem.id),
                  );
                  if (rowOrderItems.length === 0) return null;

                  const activeTabId = activeTabIds[fItem.id];

                  return (
                    <div
                      key={fItem.id}
                      className="mb-6 border border-slate-200 rounded-lg overflow-hidden shadow-sm"
                    >
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-sm whitespace-nowrap">
                          明細列 {index + 1}
                        </span>
                        <span className="font-bold text-slate-700 truncate">
                          {fItem.product_name}
                        </span>
                        <span className="text-slate-500 text-sm whitespace-nowrap">
                          / {fItem.quantity} {fItem.unit}
                        </span>
                      </div>

                      <div className="flex overflow-x-auto border-b border-slate-200 custom-scrollbar bg-white">
                        {rowOrderItems.map((item) => {
                          let hasShortage = false;
                          if (allocations[item.id]) {
                            hasShortage = Object.keys(allocations[item.id])
                              .filter(
                                (k) => k !== "_base_qty" && k !== "_productId",
                              )
                              .some((k) => allocations[item.id][k].isShortage);
                          }
                          const isChild = String(item.id).includes("-");
                          const isActive = activeTabId === item.id;

                          return (
                            <div
                              key={item.id}
                              className={`flex items-center gap-2 px-5 py-3 border-b-2 cursor-pointer transition-colors ${isActive ? "border-blue-600 text-blue-700 font-bold bg-blue-50/50" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                              onClick={() =>
                                setActiveTabIds((prev) => ({
                                  ...prev,
                                  [fItem.id]: item.id,
                                }))
                              }
                            >
                              {isChild && (
                                <span className="text-slate-300 font-bold">
                                  ↳
                                </span>
                              )}
                              <TypeTag type={item.type} />
                              <span
                                className={
                                  hasShortage ? "text-red-600 font-black" : ""
                                }
                              >
                                {item.name}
                              </span>
                              {hasShortage && " ⚠️"}
                            </div>
                          );
                        })}
                      </div>

                      {activeTabId && (
                        <div className="p-4 bg-white">
                          <MaterialAllocationList
                            itemId={activeTabId}
                            allocations={allocations}
                            expandedMaterials={expandedMaterials}
                            toggleMaterialExpanded={toggleMaterialExpanded}
                            handleBatchUsageSave={handleBatchUsageSave}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="mt-8 flex justify-end items-center border-t border-slate-200 pt-6 gap-4">
                  <button
                    onClick={handleOpenPreview}
                    disabled={
                      !vendorData.name ||
                      isSubmitting ||
                      orderItems.length === 0
                    }
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText size={18} /> 預覽並建立訂單
                  </button>
                </div>
              </div>
            )}
          </div>
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
                        Object.keys(allocations[displayId])
                          .filter(
                            (k) => k !== "_base_qty" && k !== "_productId",
                          )
                          .some((k) => allocations[displayId][k].isShortage);

                      return (
                        <React.Fragment key={d.id}>
                          <tr
                            className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${isExpanded ? "bg-blue-50/50" : ""}`}
                            onClick={() => toggleMrpExpanded(d.id)}
                          >
                            <td className="p-4 text-center text-slate-400 text-[10px]">
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
                            <td className="p-4 text-right text-slate-800 font-bold">
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
                                                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                                                          {" "}
                                                          {child.mrp_id}
                                                        </span>
                                                        <span className="font-bold text-slate-700 text-sm">
                                                          {child.product_name}
                                                        </span>
                                                      </div>
                                                      <div className="text-xs text-slate-600">
                                                        計畫生產:{" "}
                                                        <span className="font-bold text-slate-800">
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
        {isPreviewModalOpen && previewData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-100 max-w-[1000px] w-full max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
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

              <div className="overflow-y-auto p-4 md:p-8 flex-1 bg-slate-200/50">
                <div
                  className="bg-white shadow-xl mx-auto ring-1 ring-black/5"
                  style={{ minWidth: "800px" }}
                >
                  <CustomerOrderTemplate order={previewData} />
                </div>
              </div>

              <div className="bg-white border-t border-slate-200 p-4 flex justify-between items-center shrink-0">
                <button
                  onClick={handlePrintPreview}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 border border-slate-300"
                >
                  <Printer size={18} /> 列印預覽
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsPreviewModalOpen(false)}
                    className="px-5 py-2.5 bg-white text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors border border-slate-300"
                  >
                    取消修改
                  </button>
                  <button
                    onClick={handleConfirmSaveOrder}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? "處理中..." : "確認建立單據"}
                  </button>
                </div>
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
              className="text-sm font-black text-slate-800 truncate tracking-wider"
              title={batch.batch_number}
            >
              {batch.batch_number}
            </h4>
          </div>
          {batch.received_date && (
            <div className="text-[10px] text-slate-400 ml-4">
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
                  className={`w-24 px-2 py-1.5 text-right text-sm font-bold border rounded-lg transition-all duration-200 focus:outline-none ${isModified ? "bg-amber-50 border-amber-400 text-amber-900 focus:ring-2 focus:ring-amber-200" : usedQty > 0 ? "border-blue-300 bg-blue-50 text-blue-700 focus:ring-2 focus:ring-blue-200" : "border-slate-200 text-slate-600 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100"}`}
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
                className={`text-sm font-bold ${usedQty > 0 ? "text-blue-600" : "text-slate-400"}`}
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
            <span className={`text-xs ${usedQty > 0 ? "text-blue-600" : ""}`}>
              {formatNum(usedQty, matType)}
            </span>{" "}
            {unit}
          </span>
          <span>
            庫存剩餘:{" "}
            <span className="text-xs text-slate-700">
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

  const sortedMaterials = Object.entries(itemAlloc)
    .filter(([k]) => k !== "_base_qty" && k !== "_productId")
    .sort(([idA, matA], [idB, matB]) => {
      const isSemiA = matA.type === "SEMI" || matA.type === "PRODUCT";
      const isSemiB = matB.type === "SEMI" || matB.type === "PRODUCT";
      const isPackA = matA.type === "PACK";
      const isPackB = matB.type === "PACK";

      if (isSemiA && !isSemiB) return -1;
      if (!isSemiA && isSemiB) return 1;
      if (isPackA && !isPackB) return 1;
      if (!isPackA && isPackB) return -1;
      return matB.requiredQty - matA.requiredQty;
    });

  if (sortedMaterials.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 border border-dashed rounded-lg bg-slate-50/50">
        此項目無須分配底層物料庫存，子單據已負責其原料。
      </div>
    );
  }

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
