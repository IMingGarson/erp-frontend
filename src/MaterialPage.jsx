import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "./utils/fetchWithAuth";

// 類型對應表
const TYPE_OPTIONS = [
  { value: "RAW", label: "原物料" },
  { value: "SEMI", label: "半成品" },
  { value: "PRODUCT", label: "成品" },
  { value: "PACK", label: "包材" },
];

const getTypeLabel = (typeValue) => {
  const target = TYPE_OPTIONS.find((opt) => opt.value === typeValue);
  return target ? target.label : typeValue;
};

export default function MaterialPage() {
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 篩選與分頁狀態
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal 與表單狀態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "RAW",
    unit: "",
    is_active: true,
  });

  // 1. 取得物料列表 (Read)
  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth("/api/materials");
      if (!response.ok) throw new Error("無法取得物料資料");
      const data = await response.json();
      setMaterials(data.data || []);
    } catch (error) {
      console.error("Fetch error:", error);
      alert("載入資料失敗，請稍後再試。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  // 當篩選條件改變時，回到第一頁
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  // 處理表單輸入
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // 開啟新增 Modal
  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      code: "",
      name: "",
      type: "RAW",
      unit: "",
      is_active: true,
    });
    setIsModalOpen(true);
  };

  // 開啟編輯 Modal
  const handleOpenEditModal = (material) => {
    setEditingId(material.id);
    setFormData({
      code: material.code || "",
      name: material.name || "",
      type: material.type || "RAW",
      unit: material.unit || "",
      is_active: material.is_active,
    });
    setIsModalOpen(true);
  };

  // 關閉 Modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // 2. 儲存物料 (Create / Update)
  const handleSave = async (e) => {
    e.preventDefault();
    const isEditing = editingId !== null;
    const url = isEditing ? `/api/materials/${editingId}` : "/api/materials";
    const method = isEditing ? "PUT" : "POST";

    try {
      const response = await fetchWithAuth(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Save error:", errorData);
        alert("儲存失敗，請檢查輸入資料是否正確或代碼是否重複。");
        return;
      }

      await fetchMaterials();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving material:", error);
      alert("系統發生錯誤，無法儲存資料。");
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`確定要刪除物料「${name}」嗎？此操作無法復原。`))
      return;

    try {
      const response = await fetchWithAuth(`/api/materials/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("刪除失敗");
      }

      // 重新取得資料
      fetchMaterials();
    } catch (error) {
      console.error("Delete error:", error);
      alert("刪除失敗，請檢查是否已有相關聯的生產單。");
    }
  };

  // --- 篩選與分頁邏輯 ---
  const filteredMaterials = materials.filter((mat) => {
    const matchSearch =
      mat.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mat.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === "" ? true : mat.type === filterType;
    return matchSearch && matchType;
  });

  const totalPages = Math.ceil(filteredMaterials.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = filteredMaterials.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans text-slate-800 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            產品管理
          </h2>
        </div>
      </div>
      <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg border border-blue-100">
        <p className="flex items-center gap-2 font-medium mb-1">
          <span className="text-lg">💡</span> 系統功能說明
        </p>
        <ul className="list-disc list-inside space-y-1 ml-6 text-slate-700">
          <li>
            在此頁面您可以進行原物料、半成品、成品及包材的
            <strong>「建檔與維護」</strong>。
          </li>
          <li>
            支援透過號碼、名稱或類型進行列表的<strong>「快速篩選」</strong>
            與分頁瀏覽。
          </li>
        </ul>
      </div>

      {/* 操作區與篩選器 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* 搜尋框 (Code, Name) */}
          <input
            type="text"
            placeholder="搜尋代碼或名稱..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
          />
          {/* 類型篩選 */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">所有類型</option>
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors text-sm font-medium whitespace-nowrap"
        >
          + 新增物料
        </button>
      </div>

      {/* Table 內容製作 */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  代碼 (Code)
                </th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  名稱 (Name)
                </th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  類型 (Type)
                </th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  單位 (Unit)
                </th>
                <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">
                  狀態
                </th>
                <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                      資料載入中...
                    </div>
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    找不到符合條件的物料資料
                  </td>
                </tr>
              ) : (
                currentData.map((mat) => (
                  <tr
                    key={mat.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {mat.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {mat.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {mat.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md border
                        ${
                          mat.type === "RAW"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : mat.type === "SEMI"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : mat.type === "PRODUCT"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                        }`}
                      >
                        {getTypeLabel(mat.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {mat.unit.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {mat.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          啟用
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          停用
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleOpenEditModal(mat)}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => handleDelete(mat.id, mat.name)}
                          className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                        >
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分頁控制區 */}
        {!isLoading && filteredMaterials.length > 0 && (
          <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              顯示第{" "}
              <span className="font-medium text-gray-900">
                {startIndex + 1}
              </span>{" "}
              到{" "}
              <span className="font-medium text-gray-900">
                {Math.min(startIndex + itemsPerPage, filteredMaterials.length)}
              </span>{" "}
              筆資料，共{" "}
              <span className="font-medium text-gray-900">
                {filteredMaterials.length}
              </span>{" "}
              筆
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                上一頁
              </button>
              <span className="flex items-center px-3 py-1 text-sm text-gray-700 font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                下一頁
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 新增/編輯 Modal (與原代碼結構一致) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4 border-b pb-2 text-gray-800">
              {editingId ? "編輯物料" : "新增物料"}
            </h3>

            <form onSubmit={handleSave}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    物料代碼 (Code)
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    required
                    disabled={editingId !== null}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                    placeholder="例如：R001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    物料名稱 (Name)
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="請輸入物料名稱"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    類型 (Type)
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    單位 (Unit)
                  </label>
                  <input
                    type="text"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：kg, 個, 瓶"
                  />
                </div>

                <div className="flex items-center mt-4 bg-gray-50 p-3 rounded-md border border-gray-200">
                  <input
                    type="checkbox"
                    name="is_active"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                  />
                  <label
                    htmlFor="is_active"
                    className="ml-2 block text-sm font-medium text-gray-900 cursor-pointer"
                  >
                    啟用
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm transition-colors font-medium text-sm"
                >
                  儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
