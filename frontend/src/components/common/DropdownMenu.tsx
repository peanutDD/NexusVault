/**
 * DropdownMenu 组件
 *
 * 可复用的下拉菜单组件，支持自定义选项和回调。
 * 下拉内容通过 createPortal 挂到 document.body，避免父级 transform（如 toolbar scale）
 * 导致 position:fixed 被裁剪或错位。
 */
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface DropdownMenuOption {
  label: string;
  value: string;
}

interface DropdownMenuProps {
  title: string;
  options: DropdownMenuOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  ariaLabel: string;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  title,
  options,
  selectedValue,
  onSelect,
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.value === selectedValue);
  const selectedLabel = selectedOption?.label || '';

  // 计算下拉菜单位置
  const computeMenuPosition = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const width = Math.max(120, rect.width);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = Math.min(rect.bottom + 8, window.innerHeight - 8);
    return { left, top, width };
  };

  // 监听点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isClickInsideTrigger = triggerRef.current?.contains(target) || false;
      const isClickInsideMenu = menuRef.current?.contains(target) || false;

      if (!isClickInsideTrigger && !isClickInsideMenu) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 监听窗口大小变化，重新计算下拉菜单位置
  useEffect(() => {
    const handleResize = () => {
      if (isOpen && triggerRef.current) {
        setMenuPosition(computeMenuPosition(triggerRef.current));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // 打开时若尚未有位置则补算（例如由键盘打开）
  useEffect(() => {
    if (isOpen && !menuPosition && triggerRef.current) {
      setMenuPosition(computeMenuPosition(triggerRef.current));
    }
  }, [isOpen, menuPosition]);

  // 动态位置通过 ref 写入，避免 JSX 内联 style 触发 lint
  useEffect(() => {
    if (!menuRef.current || !menuPosition) return;
    const el = menuRef.current;
    el.style.left = `${menuPosition.left}px`;
    el.style.top = `${menuPosition.top}px`;
    el.style.width = `${menuPosition.width}px`;
  }, [menuPosition]);

  const handleToggle = () => {
    if (triggerRef.current) {
      setMenuPosition(computeMenuPosition(triggerRef.current));
    }
    setIsOpen((prev) => !prev);
  };

  const handleOptionSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  return (
    <div ref={triggerRef} className="filtersCard">
      <button
        type="button"
        className="filtersCardHeader"
        onClick={handleToggle}
        aria-label={ariaLabel}
      >
        <span className="filtersCardTitle">{title}</span>
        <span className="filtersCardHeaderRight">
          <span className="filtersCardSelected" title={selectedLabel}>
            {selectedLabel}
          </span>
          <ChevronDown
            className={isOpen ? 'filtersChevron filtersChevronOpen' : 'filtersChevron'}
            aria-hidden="true"
          />
        </span>
      </button>

      {/* 下拉内容挂到 body，避免父级 transform 导致 fixed 被裁剪（如 .fileListToolbarScale75） */}
      {isOpen &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            className="filtersDropdownPortal"
            role="menu"
            aria-label={`${title} options`}
          >
            <div className="filtersList">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  className={option.value === selectedValue ? 'filtersItem filtersItemSelected' : 'filtersItem'}
                  onClick={() => handleOptionSelect(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default DropdownMenu;
