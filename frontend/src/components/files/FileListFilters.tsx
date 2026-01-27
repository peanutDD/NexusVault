import { memo } from 'react';

interface FileListFiltersProps {
  search: string;
  mimeType: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  sizeMin: string;
  sizeMax: string;
  categories: string[];
  onSearchChange: (v: string) => void;
  onMimeTypeChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onSizeMinChange: (v: string) => void;
  onSizeMaxChange: (v: string) => void;
  onClearFilters: () => void;
}

const FileListFilters = memo(function FileListFilters({
  search,
  mimeType,
  category,
  dateFrom,
  dateTo,
  sizeMin,
  sizeMax,
  categories,
  onSearchChange,
  onMimeTypeChange,
  onCategoryChange,
  onDateFromChange,
  onDateToChange,
  onSizeMinChange,
  onSizeMaxChange,
  onClearFilters,
}: FileListFiltersProps) {
  const hasFilters = dateFrom || dateTo || sizeMin || sizeMax || category;

  return (
    <div className="mb-6 space-y-4">
      <div className="flex gap-4 flex-wrap">
        <input
          ref={(el) => {
            // 用于键盘快捷键聚焦
            const w = window as unknown as {
              __fileListSearchInput?: HTMLInputElement;
            };
            w.__fileListSearchInput = el ?? undefined;
          }}
          type="text"
          placeholder="搜索文件... (Ctrl+K)"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 min-w-48 px-4 py-2 bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-600 rounded-lg text-white dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-all duration-200"
          aria-label="搜索文件"
        />
        <select
          value={mimeType}
          onChange={(e) => onMimeTypeChange(e.target.value)}
          className="px-4 py-2 bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-600 rounded-lg text-white dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-all duration-200"
          aria-label="按文件类型筛选"
        >
          <option value="">所有类型</option>
          <option value="image/">图片</option>
          <option value="video/">视频</option>
          <option value="audio/">音频</option>
          <option value="application/pdf">PDF</option>
          <option value="text/">文本</option>
          <option value="application/zip">ZIP</option>
          <option value="application/">应用/文档</option>
        </select>
        <select
          aria-label="按分类筛选"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="px-4 py-2 bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-600 rounded-lg text-white dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-all duration-200"
        >
          <option value="">全部分类</option>
          <option value="__uncategorized__">未分类</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label htmlFor="date-from" className="text-sm text-gray-300 dark:text-gray-400 whitespace-nowrap transition-colors duration-200">
            日期从:
          </label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="px-4 py-2 bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-600 rounded-lg text-white dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-all duration-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="date-to" className="text-sm text-gray-300 dark:text-gray-400 whitespace-nowrap transition-colors duration-200">
            日期到:
          </label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="px-4 py-2 bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-600 rounded-lg text-white dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-all duration-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="size-min" className="text-sm text-gray-300 dark:text-gray-400 whitespace-nowrap transition-colors duration-200">
            大小最小(MB):
          </label>
          <input
            id="size-min"
            type="number"
            min="0"
            placeholder="MB"
            value={sizeMin}
            onChange={(e) => onSizeMinChange(e.target.value)}
            className="w-24 px-4 py-2 bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-600 rounded-lg text-white dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-all duration-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="size-max" className="text-sm text-gray-300 dark:text-gray-400 whitespace-nowrap transition-colors duration-200">
            大小最大(MB):
          </label>
          <input
            id="size-max"
            type="number"
            min="0"
            placeholder="MB"
            value={sizeMax}
            onChange={(e) => onSizeMaxChange(e.target.value)}
            className="w-24 px-4 py-2 bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-600 rounded-lg text-white dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-all duration-200"
          />
        </div>
        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 bg-gray-700 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-600 dark:hover:bg-gray-500 transition-all duration-200"
          >
            清除筛选
          </button>
        )}
      </div>
    </div>
  );
});

export default FileListFilters;
