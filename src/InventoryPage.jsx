import { useState, useEffect, useMemo, useRef } from "react";
import { fetchWithAuth } from "./utils/fetchWithAuth";
import CustomDialog from "./components/CustomDialog";

const TYPE_CONFIG = {
  RAW: {
    label: "原物料",
    css: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  SEMI: {
    label: "半成品",
    css: "bg-purple-100 text-purple-700 border-purple-200",
  },
  PACK: { label: "包材", css: "bg-amber-100 text-amber-700 border-amber-200" },
  PRODUCT: { label: "成品", css: "bg-blue-100 text-blue-700 border-blue-200" },
};

const TypeTag = ({ type }) => {
  const typeData = TYPE_CONFIG[type] || {
    label: type,
    css: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={`inline-block text-center min-w-[56px] px-2 py-0.5 rounded text-xs font-bold border ${typeData.css}`}
    >
      {typeData.label}
    </span>
  );
};

const BomNode = ({ node, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const hasBatches = node.batches && node.batches.length > 0;
  const isExpandable = hasChildren || hasBatches;

  const totalOriginal = node.batches
    ? node.batches.reduce((sum, b) => sum + parseFloat(b.original_qty || 0), 0)
    : 0;
  const isLowStock =
    totalOriginal > 0 && (node.totalInventory || 0) < totalOriginal * 0.2;

  return (
    <div
      className={`mb-3 overflow-hidden rounded-lg shadow-sm bg-white border border-slate-200 ${level > 0 ? "ml-4 md:ml-8 border-l-4 border-l-blue-400" : ""}`}
    >
      <div
        className={`p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center transition-colors ${isExpandable ? "cursor-pointer hover:bg-slate-50" : ""}`}
        onClick={() => isExpandable && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span
            className={`w-4 text-center text-slate-400 text-xs flex-shrink-0 ${!isExpandable && "opacity-0"}`}
          >
            {isExpanded ? "▼" : "▶"}
          </span>
          <TypeTag type={node.type} />
          <span
            className="font-bold text-slate-800 text-lg truncate"
            title={node.name}
          >
            {node.name}
          </span>
          {isLowStock && (
            <span className="flex-shrink-0 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded border border-red-200">
              ⚠️ 低水位
            </span>
          )}
        </div>

        <div className="mt-2 sm:mt-0 flex-shrink-0 flex items-baseline w-full sm:w-auto pl-7 sm:pl-0">
          <span className="text-slate-500 text-sm font-medium w-24 sm:text-right">
            現有庫存：
          </span>
          <span
            className={`text-xl font-black w-24 text-right tracking-tight ${isLowStock ? "text-red-600" : "text-slate-800"}`}
          >
            {(node.totalInventory || 0).toFixed(2)}
          </span>
          <span className="text-sm font-normal text-slate-500 w-12 text-left ml-2">
            {node.unit}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-slate-50 p-4 border-t border-slate-200">
          {hasChildren && (
            <div className="mb-4">
              <div className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                配方組成
              </div>
              {node.children.map((child) => (
                <BomNode key={child.id} node={child} level={level + 1} />
              ))}
            </div>
          )}

          {hasBatches && (
            <div>
              <div className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                可用批號明細
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {node.batches.map((b) => {
                  const batchLow =
                    parseFloat(b.remaining_qty) <
                    parseFloat(b.original_qty) * 0.2;
                  return (
                    <div
                      key={b.id}
                      className={`bg-white border p-3 rounded-md shadow-sm ${batchLow ? "border-red-200 bg-red-50/30" : "border-slate-200"}`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-mono text-sm font-bold text-slate-700">
                          {b.batch_number}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {b.received_date}
                        </span>
                      </div>
                      <div className="text-right text-sm border-t border-slate-100 pt-2 mt-1">
                        剩餘：
                        <span
                          className={`font-black ml-1 ${batchLow ? "text-red-600" : "text-emerald-600"}`}
                        >
                          {parseFloat(b.remaining_qty).toFixed(2)}
                        </span>{" "}
                        <span className="text-xs text-slate-500">
                          {node.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!hasChildren && !hasBatches && (
            <div className="text-sm text-slate-400 italic py-3 text-center border border-dashed border-slate-200 rounded bg-slate-50/50">
              目前無可用庫存或配方資料。
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- 主頁面組件 ---
const InventoryPage = () => {
  const [batches, setBatches] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStatItem, setSelectedStatItem] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const itemsPerPage = 20;
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

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const addBatchCodeRef = useRef(null);
  const addMaterialRef = useRef(null);
  const addQuantityRef = useRef(null);
  const addDateRef = useRef(null);
  const addExpirationDateRef = useRef(null);

  const [isMaterialDropdownOpen, setIsMaterialDropdownOpen] = useState(false);
  const [materialSearchTerm, setMaterialSearchTerm] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState("");

  const filteredMaterials = materials.filter(
    (m) =>
      m.name.includes(materialSearchTerm) ||
      TYPE_CONFIG[m.type.toUpperCase()].label.includes(materialSearchTerm),
  );

  const selectedMaterial = materials.find(
    (m) => String(m.id) === String(selectedMaterialId),
  );
  const selectedMaterialDisplay = selectedMaterial
    ? `[${TYPE_CONFIG[selectedMaterial.type.toUpperCase()].label}] ${selectedMaterial.name}`
    : "-- 請選擇物料 --";

  const selectButtonRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  // 開啟選單並計算位置的函式
  const handleToggleDropdown = () => {
    if (!isMaterialDropdownOpen && selectButtonRef.current) {
      const rect = selectButtonRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      });
    }
    setIsMaterialDropdownOpen(!isMaterialDropdownOpen);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [batchRes, materialRes, bomRes] = await Promise.all([
        fetchWithAuth("/api/batches"),
        fetchWithAuth("/api/materials"),
        fetchWithAuth("/api/boms"),
      ]);

      if (!batchRes.ok || !materialRes.ok || !bomRes.ok) {
        throw new Error("API fetch failed");
      }

      const [batchJson, materialJson, bomJson] = await Promise.all([
        batchRes.json(),
        materialRes.json(),
        bomRes.json(),
      ]);

      setBatches(batchJson.data || []);
      setMaterials(materialJson.data || []);
      setBoms(bomJson.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const uniqueMaterials = useMemo(() => {
    return [...new Set(batches.map((b) => b.material_name))].filter(Boolean);
  }, [batches]);

  useEffect(() => {
    if (uniqueMaterials.length > 0 && !selectedStatItem) {
      setSelectedStatItem(uniqueMaterials[0]);
    }
  }, [uniqueMaterials, selectedStatItem]);

  const stats = useMemo(() => {
    if (!selectedStatItem) {
      return {
        totalOriginal: 0,
        totalRemaining: 0,
        lowStockCount: 0,
        batchCount: 0,
        healthPercentage: 0,
        unit: "",
      };
    }

    const targetBatches = batches.filter(
      (b) => b.material_name === selectedStatItem,
    );
    const totalOriginal = targetBatches.reduce(
      (sum, b) => sum + parseFloat(b.original_qty || 0),
      0,
    );
    const totalRemaining = targetBatches.reduce(
      (sum, b) => sum + parseFloat(b.remaining_qty || 0),
      0,
    );
    const lowStockCount = targetBatches.filter(
      (b) => parseFloat(b.remaining_qty) < parseFloat(b.original_qty) * 0.2,
    ).length;
    const healthPercentage =
      totalOriginal > 0
        ? ((totalRemaining / totalOriginal) * 100).toFixed(1)
        : 0;
    const unit = targetBatches.length > 0 ? targetBatches[0].unit : "";

    return {
      totalOriginal,
      totalRemaining,
      lowStockCount,
      batchCount: targetBatches.length,
      healthPercentage,
      unit,
    };
  }, [batches, selectedStatItem]);

  const processedBatches = useMemo(() => {
    let filtered = batches.filter(
      (b) =>
        (b.material_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (b.batch_number || "").toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const materialLatestTime = {};
    filtered.forEach((b) => {
      const matName = b.material_name || "";
      const time = new Date(b.created_at).getTime();
      if (!materialLatestTime[matName] || time > materialLatestTime[matName]) {
        materialLatestTime[matName] = time;
      }
    });

    filtered.sort((a, b) => {
      const matA = a.material_name || "";
      const matB = b.material_name || "";

      if (matA !== matB) {
        return materialLatestTime[matB] - materialLatestTime[matA];
      }

      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();

      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [batches, searchTerm, sortOrder]);

  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedBatches.slice(startIndex, startIndex + itemsPerPage);
  }, [processedBatches, currentPage]);

  const totalPages = Math.ceil(processedBatches.length / itemsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortOrder]);

  const producsAndSemis = useMemo(() => {
    return materials.filter((m) => m.type === "PRODUCT" || m.type === "SEMI");
  }, [materials]);

  const handleSaveNewBatch = async () => {
    const payload = {
      batch_number: addBatchCodeRef.current?.value,
      material: addMaterialRef.current?.value,
      original_qty: parseFloat(addQuantityRef.current?.value),
      received_date:
        addDateRef.current?.value || new Date().toISOString().split("T")[0],
      expiration_date:
        addExpirationDateRef.current?.value ||
        new Date().toISOString().split("T")[0],
      remaining_qty: parseFloat(addQuantityRef.current?.value),
    };

    if (
      !payload.batch_number ||
      !payload.material ||
      isNaN(payload.original_qty)
    ) {
      showAlert("提示", "請填寫完整且正確的批號資訊", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("新增批號失敗");

      showAlert("成功", "批號新增成功", "success");
      setIsAddModalOpen(false);
      fetchData();
    } catch (err) {
      showAlert("錯誤", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBatch = (id, batchNumber) => {
    showConfirm(
      "確認刪除",
      `確定要刪除批號「${batchNumber}」嗎？\n刪除後此批號將無法用於未來的生產單分配。`,
      async () => {
        setIsSubmitting(true);
        try {
          const res = await fetchWithAuth(`/api/batches/${id}`, {
            method: "DELETE",
          });

          if (!res.ok) throw new Error("刪除失敗");

          setBatches((prev) => prev.filter((b) => b.id !== id));
          closeDialog();
          showAlert("成功", `批號 ${batchNumber} 已成功刪除`, "success");
        } catch (err) {
          showAlert("錯誤", err.message, "error");
        } finally {
          setIsSubmitting(false);
        }
      },
    );
  };

  const bomTree = useMemo(() => {
    if (!selectedProduct) return [];

    const buildBomTree = (parentId) => {
      // 修正：統一轉字串進行 ID 匹配，防止數字與字串類型衝突
      const childrenBoms = boms.filter(
        (b) => String(b.parent) === String(parentId),
      );

      return childrenBoms
        .map((bom) => {
          const mat = materials.find((m) => String(m.id) === String(bom.child));
          if (!mat) return null;

          const validBatches = batches
            .filter(
              (b) =>
                String(b.material) === String(mat.id) &&
                parseFloat(b.remaining_qty) > 0,
            )
            .sort(
              (a, b) => new Date(b.received_date) - new Date(a.received_date),
            );

          const totalInventory = validBatches.reduce(
            (sum, b) => sum + parseFloat(b.remaining_qty),
            0,
          );
          const children = buildBomTree(mat.id);

          return {
            ...mat,
            totalInventory,
            batches: validBatches,
            children,
          };
        })
        .filter(Boolean);
    };

    return buildBomTree(selectedProduct);
  }, [selectedProduct, boms, materials, batches]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="text-lg font-medium text-slate-500 animate-pulse">
          載入資料中...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg m-8 border border-red-100">
        <h3 className="text-xl font-bold mb-2">連線錯誤</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            庫存與配方監控
          </h2>
        </div>
      </div>

      <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg mb-6 border border-blue-100">
        <p className="flex items-center gap-2 font-medium mb-1">
          <span className="text-lg">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
          <li>
            「批號庫存清單」可檢視各物料的<strong>「總剩餘與進貨量」</strong>
            ，並標示低水位警告（低於進貨量 20%）。
          </li>
          <li>
            支援透過原物料名稱或批號進行<strong>「快速搜尋與排序」</strong>
            ，方便追蹤特定批次。
          </li>
          <li>
            切換至「產品清單」可選擇成品或半成品，展開檢視其
            <strong>「配方組成與包材」</strong>。
          </li>
          <li>
            在配方樹狀圖中，系統會直接列出底層物料的
            <strong>「可用庫存批號與剩餘量」</strong>。
          </li>
        </ul>
      </div>
      <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-lg mb-6 w-fit">
        <button
          onClick={() => setActiveTab("list")}
          className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "list"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
          }`}
        >
          批號庫存清單
        </button>
        <button
          onClick={() => setActiveTab("bom")}
          className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "bom"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
          }`}
        >
          產品清單
        </button>
      </div>

      {activeTab === "list" && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-800 truncate pr-4">
                {selectedStatItem ? `${selectedStatItem} 庫存分析` : "庫存分析"}
              </h3>
              <select
                value={selectedStatItem}
                onChange={(e) => setSelectedStatItem(e.target.value)}
                className="w-full md:w-64 flex-shrink-0 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {uniqueMaterials.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-500 font-medium mb-1">
                  總剩餘量 / 總進貨量
                </p>
                <p className="text-2xl font-bold text-slate-800">
                  {stats.totalRemaining.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                  <span className="text-base font-normal text-slate-400">
                    {" "}
                    /{" "}
                    {stats.totalOriginal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}{" "}
                    {stats.unit}
                  </span>
                </p>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-3">
                  <div
                    className={`h-1.5 rounded-full ${stats.healthPercentage < 20 ? "bg-red-500" : "bg-blue-600"}`}
                    style={{
                      width: `${Math.min(stats.healthPercentage, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-500 font-medium mb-1">
                  現存批號總數
                </p>
                <p className="text-2xl font-bold text-slate-800">
                  {stats.batchCount}{" "}
                  <span className="text-base font-normal text-slate-400">
                    批
                  </span>
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  目前存放於廠內尚未耗盡之批次
                </p>
              </div>

              <div
                className={`p-4 rounded-lg border transition-colors ${stats.lowStockCount > 0 ? "bg-red-50/50 border-red-100" : "bg-slate-50 border-slate-100"}`}
              >
                <p className="text-sm text-slate-500 font-medium mb-1">
                  低水位批號數量
                </p>
                <p
                  className={`text-2xl font-bold ${stats.lowStockCount > 0 ? "text-red-600" : "text-slate-800"}`}
                >
                  {stats.lowStockCount}{" "}
                  <span className="text-base font-normal text-slate-400">
                    批
                  </span>
                </p>
                {stats.lowStockCount > 0 ? (
                  <p className="text-xs text-red-600/80 font-medium mt-2">
                    ⚠️ 庫存低於進貨量 20%，建議盡速安排採購補貨
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-2">
                    目前庫存水位健康
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4">
            <input
              type="text"
              placeholder="搜尋名稱或批號"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-96 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors text-sm font-medium whitespace-nowrap w-full md:w-auto"
            >
              + 新增批號
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 min-h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">
                      原物料名稱
                    </th>
                    <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">
                      批號
                    </th>
                    <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">
                      進貨量
                    </th>
                    <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">
                      現有量
                    </th>
                    <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">
                      單位
                    </th>
                    <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">
                      入庫日期
                    </th>
                    <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">
                      有效日期
                    </th>
                    <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">
                      盤盈/虧
                    </th>
                    <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">
                      數量
                    </th>
                    <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedBatches.length > 0 ? (
                    paginatedBatches.map((batch, index) => {
                      const isFirst =
                        index === 0 ||
                        paginatedBatches[index - 1].material_name !==
                          batch.material_name;
                      const isLowStock =
                        parseFloat(batch.remaining_qty) <
                        parseFloat(batch.original_qty) * 0.2;
                      const rows = [];

                      if (isFirst) {
                        const matBatches = processedBatches.filter(
                          (b) => b.material_name === batch.material_name,
                        );
                        const totalRem = matBatches.reduce(
                          (sum, b) => sum + parseFloat(b.remaining_qty),
                          0,
                        );
                        const totalOrig = matBatches.reduce(
                          (sum, b) => sum + parseFloat(b.original_qty),
                          0,
                        );
                        rows.push(
                          <tr
                            key={`header-${batch.material_name}`}
                            className="bg-blue-50/60 border-t-2 border-blue-100"
                          >
                            <td colSpan="10" className="px-4 py-3 text-sm">
                              <span className="font-bold text-blue-800">
                                🏷️ {batch.material_name}
                              </span>
                              <span className="ml-4 text-blue-700 font-medium">
                                總剩餘：{totalRem.toFixed(2)} / 總進貨：
                                {totalOrig.toFixed(2)} {batch.unit} (共{" "}
                                {matBatches.length} 批)
                              </span>
                            </td>
                          </tr>,
                        );
                      }

                      rows.push(
                        <tr
                          key={batch.batch_number}
                          className="hover:bg-slate-50"
                        >
                          <td className="p-4 text-slate-400 text-sm pl-8">
                            ↳ {batch.material_name}
                          </td>
                          <td className="p-4 text-slate-700 font-mono text-xs font-semibold">
                            {batch.batch_number}
                          </td>
                          <td className="p-4 text-slate-500 text-sm">
                            {parseFloat(batch.original_qty).toFixed(2)}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${isLowStock ? "bg-red-100 text-red-700 border-red-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}
                            >
                              {parseFloat(batch.remaining_qty).toFixed(2)}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 text-sm">
                            {batch.unit}
                          </td>
                          <td className="p-4 text-slate-500 text-sm">
                            {batch.received_date}
                          </td>
                          <td className="p-4 text-slate-500 text-sm">
                            {batch.expiration_date}
                          </td>
                          <td className="p-4 text-slate-500 text-sm">
                            {batch.adjustment_type === "NONE" ? (
                              "-"
                            ) : batch.adjustment_type === "PROFIT" ? (
                              <span className="text-normal font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                                盤盈
                              </span>
                            ) : (
                              <span className="text-normal font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                                盤虧
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-slate-500 text-sm">
                            {parseFloat(batch.adjustment_qty).toFixed(2)}
                          </td>
                          <td className="p-4 text-slate-500 text-sm">
                            <button
                              onClick={() =>
                                handleDeleteBatch(batch.id, batch.batch_number)
                              }
                              disabled={isSubmitting}
                              className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-md transition-colors disabled:opacity-50"
                            >
                              刪除
                            </button>
                          </td>
                        </tr>,
                      );
                      return rows;
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan="10"
                        className="p-8 text-center text-slate-500 text-sm"
                      >
                        查無資料
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-slate-600 gap-4">
            <div>
              顯示{" "}
              {paginatedBatches.length > 0
                ? (currentPage - 1) * itemsPerPage + 1
                : 0}{" "}
              - {Math.min(currentPage * itemsPerPage, processedBatches.length)}{" "}
              筆，共 {processedBatches.length} 筆
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border rounded-md disabled:opacity-50 hover:bg-slate-50"
              >
                上一頁
              </button>
              <div className="px-4 py-1.5 bg-slate-100 rounded-md font-medium border">
                {currentPage} / {totalPages}
              </div>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1.5 border rounded-md disabled:opacity-50 hover:bg-slate-50"
              >
                下一頁
              </button>
            </div>
          </div>
        </>
      )}

      {activeTab === "bom" && (
        <div className="bg-slate-50/50 p-6 rounded-xl shadow-sm border border-slate-200 min-h-[500px]">
          <div className="mb-6 max-w-md bg-white p-4 rounded-lg shadow-sm border border-slate-100">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              請選擇成品或半成品：
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="" disabled>
                -- 點擊展開清單 --
              </option>
              {producsAndSemis.map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.type === "PRODUCT" ? "成品" : "半成品"}] {m.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct ? (
            <div>
              <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
                <h3 className="text-lg font-bold text-slate-800">
                  配方細節及包材
                </h3>
                <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                  點擊節點展開
                </span>
              </div>
              {bomTree.length > 0 ? (
                <div className="mt-4">
                  {bomTree.map((node) => (
                    <BomNode key={node.id} node={node} />
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">此項目尚未建立配方或包材關聯。</p>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg bg-white/50">
              <span className="text-3xl mb-2 block">📋</span>
              請從上方選擇一個品項以檢視所需之底層庫存。
            </div>
          )}
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="border-b pb-3 mb-4 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-gray-800">
                手動新增批號庫存
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* 讓表單區塊佔滿剩餘空間，但不再控制 overflow */}
            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  批號代碼 (Batch Code) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  ref={addBatchCodeRef}
                  placeholder="例如：B20260507-001"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 自訂的搜尋下拉選單 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  關聯物料/產品 <span className="text-red-500">*</span>
                </label>
                <input
                  type="hidden"
                  ref={addMaterialRef}
                  value={selectedMaterialId}
                />

                <button
                  type="button"
                  ref={selectButtonRef}
                  onClick={handleToggleDropdown}
                  className="w-full text-left bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex justify-between items-center"
                >
                  <span
                    className={
                      selectedMaterialId
                        ? "text-gray-900"
                        : "text-gray-500 truncate pr-2"
                    }
                  >
                    {selectedMaterialDisplay}
                  </span>
                  <span className="text-gray-400 text-xs shrink-0">▼</span>
                </button>

                {isMaterialDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[9998]"
                      onClick={() => setIsMaterialDropdownOpen(false)}
                    ></div>

                    <div
                      className="fixed z-[9999] bg-white border border-gray-200 rounded-md shadow-2xl flex flex-col max-h-60 overflow-hidden"
                      style={dropdownStyle}
                    >
                      <div className="p-2 border-b border-gray-100 bg-gray-50 shrink-0">
                        <input
                          type="text"
                          placeholder="搜尋物料名稱或類型..."
                          value={materialSearchTerm}
                          onChange={(e) =>
                            setMaterialSearchTerm(e.target.value)
                          }
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>

                      <ul className="overflow-y-auto p-1 flex-1">
                        {filteredMaterials.length > 0 ? (
                          filteredMaterials.map((m) => (
                            <li
                              key={m.id}
                              onClick={() => {
                                setSelectedMaterialId(m.id);
                                setIsMaterialDropdownOpen(false);
                                setMaterialSearchTerm("");
                              }}
                              className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors ${
                                selectedMaterialId === m.id
                                  ? "bg-blue-50 text-blue-700 font-bold"
                                  : "text-gray-700 hover:bg-gray-100"
                              }`}
                            >
                              [
                              {TYPE_CONFIG[m.type.toUpperCase()]?.label ||
                                m.type}
                              ] {m.name}
                            </li>
                          ))
                        ) : (
                          <li className="px-3 py-4 text-sm text-center text-gray-400">
                            查無符合的物料
                          </li>
                        )}
                      </ul>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 gap-0">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    初始庫存量 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    ref={addQuantityRef}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    入庫日期
                  </label>
                  <input
                    type="date"
                    ref={addDateRef}
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    有效期限
                  </label>
                  <input
                    type="date"
                    ref={addExpirationDateRef}
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3 border-t pt-4 shrink-0">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setSelectedMaterialId("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
              >
                取消
              </button>
              <button
                onClick={handleSaveNewBatch}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm transition-colors font-medium text-sm disabled:opacity-50"
              >
                {isSubmitting ? "儲存中..." : "確認新增"}
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
};

export default InventoryPage;
