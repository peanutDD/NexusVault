import { memo } from 'react';
import { cn } from '../../../utils/cn';

interface SelectionCheckboxProps {
  /** 是否选中 */
  isSelected: boolean;
  /** 点击回调 */
  onClick: () => void;
  /** 是否总是显示（默认只在 hover 时显示未选中状态） */
  alwaysVisible?: boolean;
  /** 位置类名（默认 absolute left-2 top-2） */
  positionClassName?: string;
  /** 大小 */
  size?: 'sm' | 'md';
  /** 是否在 group hover 时显示 */
  showOnGroupHover?: boolean;
}

/**
 * 选择框组件
 * 用于文件卡片和文件夹卡片的选择交互
 */
export const SelectionCheckbox = memo(function SelectionCheckbox({
  isSelected,
  onClick,
  alwaysVisible = false,
  positionClassName = 'absolute left-2 top-2',
  size = 'md',
  showOnGroupHover = true,
}: SelectionCheckboxProps) {
  const sizeClasses = size === 'sm' 
    ? { outer: 'h-4 w-4', inner: 'h-3 w-3', icon: 'h-2 w-2' }
    : { outer: 'h-5 w-5', inner: 'h-4 w-4', icon: 'h-3 w-3' };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <div
      className={cn(
        positionClassName,
        'z-10 flex cursor-pointer items-center justify-center transition-all',
        sizeClasses.outer
      )}
      onClick={handleClick}
    >
      {isSelected ? (
        <div 
          className={cn(
            'card-checkbox-outer-crystal card-checkbox-selected flex items-center justify-center rounded-full',
            sizeClasses.outer
          )}
        >
          <div 
            className={cn(
              'flex items-center justify-center rounded-full bg-violet-500',
              sizeClasses.inner
            )}
          >
            <svg 
              className={cn('text-white drop-shadow-sm', sizeClasses.icon)} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      ) : (
        <div 
          className={cn(
            'flex items-center justify-center rounded-full bg-black/40',
            sizeClasses.inner,
            !alwaysVisible && showOnGroupHover && 'opacity-0 group-hover:opacity-100'
          )}
        >
          <div 
            className={cn(
              'rounded-full border-2 border-white/60',
              size === 'sm' ? 'h-2 w-2' : 'h-3 w-3'
            )} 
          />
        </div>
      )}
    </div>
  );
});

export default SelectionCheckbox;
