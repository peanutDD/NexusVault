import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from '../useDebounce';
import { clearFileListCache } from '../../utils/fileListCache';

/**
 * 排序选项类型
 */
export type SortOption =
  | 'created_at_desc'
  | 'created_at_asc'
  | 'file_size_desc'
  | 'file_size_asc'
  | 'filename_asc'
  | 'filename_desc'
  | 'type_group'
  | 'time_group';

/**
 * 排序字段类型
 */
export type SortField = 'created_at' | 'filename' | 'file_size';

/**
 * 排序顺序类型
 */
export type SortOrder = 'asc' | 'desc';

interface UseFileFiltersReturn {
  /** 搜索关键词 */
  search: string;
  /** MIME 类型筛选 */
  mimeType: string;
  /** 排序方式 */
  sortBy: SortOption;
  /** 防抖后的搜索关键词 */
  debouncedSearch: string;
  /** 排序字段 */
  sortField: SortField;
  /** 排序顺序 */
  sortOrder: SortOrder;
  /** 是否按类型分组 */
  isGroupByType: boolean;
  /** 是否按时间分组 */
  isGroupByTime: boolean;
  /** 设置搜索关键词 */
  setSearch: (value: string) => void;
  /** 设置 MIME 类型筛选 */
  setMimeType: (value: string) => void;
  /** 设置排序方式 */
  setSortBy: (value: SortOption) => void;
  /** 搜索变更处理器 */
  handleSearchChange: (value: string) => void;
  /** MIME 类型变更处理器 */
  handleMimeTypeChange: (value: string) => void;
  /** 排序变更处理器 */
  handleSortChange: (value: SortOption) => void;
}

/**
 * 文件过滤和排序 Hook
 * 管理搜索、MIME 类型筛选和排序状态
 */
export function useFileFilters(): UseFileFiltersReturn {
  const [search, setSearch] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem('fileListSortBy');
    return (saved as SortOption) || 'created_at_desc';
  });

  const debouncedSearch = useDebounce(search, 300);

  const [sortField, sortOrder] = useMemo((): [SortField, SortOrder] => {
    if (sortBy === 'type_group' || sortBy === 'time_group') {
      return ['created_at', 'desc'];
    }
    if (sortBy.startsWith('created_at_')) {
      return ['created_at', sortBy.endsWith('_asc') ? 'asc' : 'desc'];
    }
    if (sortBy.startsWith('file_size_')) {
      return ['file_size', sortBy.endsWith('_asc') ? 'asc' : 'desc'];
    }
    if (sortBy.startsWith('filename_')) {
      return ['filename', sortBy.endsWith('_asc') ? 'asc' : 'desc'];
    }
    // 默认情况
    return ['created_at', 'desc'];
  }, [sortBy]);

  const isGroupByType = sortBy === 'type_group';
  const isGroupByTime = sortBy === 'time_group';

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleMimeTypeChange = useCallback((value: string) => {
    setMimeType(value);
  }, []);

  const handleSortChange = useCallback((value: SortOption) => {
    clearFileListCache();
    setSortBy(value);
    localStorage.setItem('fileListSortBy', value);
  }, []);

  return {
    search,
    mimeType,
    sortBy,
    debouncedSearch,
    sortField,
    sortOrder,
    isGroupByType,
    isGroupByTime,
    setSearch,
    setMimeType,
    setSortBy,
    handleSearchChange,
    handleMimeTypeChange,
    handleSortChange,
  };
}

export default useFileFilters;
