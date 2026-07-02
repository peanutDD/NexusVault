import { useSearchParams } from 'react-router-dom';
import {
  getCurrentFolderParam,
  parseCollectionParam,
} from './fileListFilterParams';

export function useFileListScope() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = getCurrentFolderParam(searchParams);
  const activeCollection = parseCollectionParam(searchParams.get('collection')).join(',');
  const activeTagId = searchParams.get('tag') || '';

  return {
    searchParams,
    setSearchParams,
    currentFolderId,
    activeCollection,
    activeTagId,
  };
}
