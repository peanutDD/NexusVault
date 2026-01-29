/**
 * 响应式图片：支持现代格式（AVIF > WebP > 后备）+ srcset/sizes，后端提供多格式/多尺寸时传入即可。
 * 当前仅单 URL 时退化为 <img>，并统一设置 decoding="async" 与 fetchPriority。
 */

import type { ImgHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface ResponsivePictureProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'srcSet' | 'sizes'> {
  src: string;
  /** AVIF 地址，后端支持时传入 */
  avifSrc?: string;
  /** WebP 地址，后端支持时传入 */
  webpSrc?: string;
  /** 响应式候选（含 1x/2x 或宽度描述符），后端支持多尺寸时传入 */
  srcSet?: string;
  /** 与 srcset 配合的 sizes，如 "(max-width: 600px) 100vw, 50vw" */
  sizes?: string;
  /** 解码方式，默认 async 不阻塞主线程 */
  decoding?: 'async' | 'sync' | 'auto';
  /** 优先级提示：首屏关键图 high，列表缩略图 low */
  fetchPriority?: 'high' | 'low' | 'auto';
  className?: string;
}

export function ResponsivePicture({
  src,
  avifSrc,
  webpSrc,
  srcSet,
  sizes,
  decoding = 'async',
  fetchPriority,
  className,
  alt,
  loading,
  onLoad,
  onError,
  ...rest 
}: ResponsivePictureProps) {
  const imgProps = {
    src,
    alt,
    decoding,
    fetchPriority,
    loading,
    onLoad,
    onError,
    className: cn(className),
    ...rest,
  };

  const hasModernFormat = avifSrc ?? webpSrc;
  const hasResponsive = srcSet ?? sizes;

  if (hasModernFormat) {
    return (
      <picture>
        {avifSrc && <source type="image/avif" srcSet={avifSrc} sizes={sizes} />}
        {webpSrc && <source type="image/webp" srcSet={webpSrc} sizes={sizes} />}
        <img {...imgProps} />
      </picture>
    );
  }

  if (hasResponsive) {
    return <img {...imgProps} srcSet={srcSet} sizes={sizes} />;
  }

  return <img {...imgProps} />;
}
