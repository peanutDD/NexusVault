import { memo } from 'react';

export type SortOption = 'created_at_desc' | 'created_at_asc' | 'filename_asc' | 'filename_desc' | 'file_size_desc' | 'file_size_asc' | 'type_group';

interface FileListFiltersProps {
  search: string;
  mimeType: string;
  category: string;
  sortBy: SortOption;
  categories: string[];
  onSearchChange: (v: string) => void;
  onMimeTypeChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onSortChange: (v: SortOption) => void;
}

const FileListFilters = memo(function FileListFilters({
  search,
  mimeType,
  category,
  sortBy,
  categories,
  onSearchChange,
  onMimeTypeChange,
  onCategoryChange,
  onSortChange,
}: FileListFiltersProps) {
  return (
    <div className="mb-6">
      <div className="flex gap-3 flex-wrap items-center">
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
        <select
          aria-label="排序方式"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="px-4 py-2 bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-600 rounded-lg text-white dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-all duration-200"
        >
          <option value="created_at_desc">最新上传</option>
          <option value="created_at_asc">最早上传</option>
          <option value="filename_asc">文件名 A-Z</option>
          <option value="filename_desc">文件名 Z-A</option>
          <option value="file_size_desc">文件大小 ↓</option>
          <option value="file_size_asc">文件大小 ↑</option>
          <option value="type_group">按类型分组</option>
        </select>
      </div>
    </div>
  );
});

export default FileListFilters;
