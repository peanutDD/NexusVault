import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import FileListFilters from './FileListFilters';

describe('FileListFilters', () => {
  it('调用 onSearchChange 并显示/隐藏清除按钮', async () => {
    const user = userEvent.setup();
    const handleSearchChange = vi.fn();

    const { rerender, getByPlaceholderText, getByRole } = render(
      <FileListFilters
        search=""
        mimeType=""
        sortBy="created_at_desc"
        onSearchChange={handleSearchChange}
        onMimeTypeChange={() => {}}
        onSortChange={() => {}}
      />
    );

    const input = getByPlaceholderText('Search… (Ctrl+K)');
    await user.type(input, 'test');

    expect(handleSearchChange).toHaveBeenCalled();

    // 重新渲染，模拟父组件把 search 状态更新为非空
    rerender(
      <FileListFilters
        search="test"
        mimeType=""
        sortBy="created_at_desc"
        onSearchChange={handleSearchChange}
        onMimeTypeChange={() => {}}
        onSortChange={() => {}}
      />
    );

    const clearButton = getByRole('button', { name: 'Clear search' });
    await user.click(clearButton);

    expect(handleSearchChange).toHaveBeenCalledWith('');
  });
});

