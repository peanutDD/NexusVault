/**
 * ZIP 流式加载工具
 * 对齐 Pixiv zip_player：使用 HTTP Range 请求按需加载 ZIP 文件内容
 * @see https://github.com/pixiv/zip_player
 */

import { ZipReader, BlobReader, BlobWriter, Reader, HttpReader } from '@zip.js/zip.js';
import { fileService } from '../services/files';
import { API_BASE_URL } from '../config/env';
import { useAuthStore } from '../store/authStore';

/**
 * 自定义 Reader：使用 fileService 的 Range 请求功能
 * 实现 zip.js 的 Reader 接口，支持认证和 Range 请求
 */
class FileServiceReader implements Reader<Blob> {
  private fileId: string;
  private totalSize: number | null = null;
  private signal?: AbortSignal;
  private _readable: ReadableStream<Uint8Array> | null = null;

  constructor(fileId: string, signal?: AbortSignal) {
    this.fileId = fileId;
    this.signal = signal;
  }

  async init(): Promise<void> {
    // 获取文件大小
    this.totalSize = await fileService.getFileSize(this.fileId);
  }

  async readUint8Array(index: number, length: number): Promise<Uint8Array> {
    if (this.totalSize === null) {
      await this.init();
    }
    
    const totalSize = this.totalSize ?? 0;
    
    // 如果请求的起始位置超出文件大小，返回空数组
    if (index >= totalSize) {
      return new Uint8Array(0);
    }
    
    // 计算实际可读取的长度（不能超出文件末尾）
    const actualLength = Math.min(length, totalSize - index);
    const end = index + actualLength - 1;
    
    const blob = await fileService.getFileRange(this.fileId, index, end, {
      signal: this.signal,
    });
    const arrayBuffer = await blob.arrayBuffer();
    const result = new Uint8Array(arrayBuffer);
    
    // 确保返回的数据长度不超过请求的长度（zip.js 要求）
    // 如果实际返回的数据少于请求的长度，说明已经到达文件末尾，这是正常的
    if (result.length > actualLength) {
      return result.slice(0, actualLength);
    }
    
    return result;
  }

  get size(): number {
    return this.totalSize ?? 0;
  }

  get readable(): ReadableStream<Uint8Array> {
    if (!this._readable) {
      // 创建一个 ReadableStream，按需读取数据
      const fileId = this.fileId;
      const signal = this.signal;
      let totalSize: number | null = null;
      
      const getSize = async (): Promise<number> => {
        if (totalSize === null) {
          totalSize = await fileService.getFileSize(fileId);
        }
        return totalSize;
      };
      
      const readChunk = async (index: number, length: number): Promise<Uint8Array> => {
        const size = await getSize();
        
        // 如果请求的起始位置超出文件大小，返回空数组
        if (index >= size) {
          return new Uint8Array(0);
        }
        
        // 计算实际可读取的长度（不能超出文件末尾）
        const actualLength = Math.min(length, size - index);
        const end = index + actualLength - 1;
        
        const blob = await fileService.getFileRange(fileId, index, end, { signal });
        const arrayBuffer = await blob.arrayBuffer();
        const result = new Uint8Array(arrayBuffer);
        
        // 确保返回的数据长度不超过请求的长度
        if (result.length > actualLength) {
          return result.slice(0, actualLength);
        }
        
        return result;
      };
      
      this._readable = new ReadableStream({
        async start(controller) {
          try {
            const size = await getSize();
            // 流式读取整个文件
            const chunkSize = 64 * 1024; // 64KB chunks
            for (let offset = 0; offset < size; offset += chunkSize) {
              const data = await readChunk(offset, chunkSize);
              controller.enqueue(data);
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    }
    return this._readable;
  }
}

/**
 * ZIP 文件条目信息
 */
export interface ZipEntryInfo {
  filename: string;
  offset: number;
  size: number;
  compressedSize: number;
}

/**
 * 解析 ZIP central directory，获取文件列表和偏移量
 * @param fileId 文件 ID
 * @param totalSize 文件总大小
 * @param signal 取消信号
 * @returns ZIP 条目信息列表
 */
export async function parseZipCentralDirectory(
  fileId: string,
  totalSize: number,
  signal?: AbortSignal
): Promise<ZipEntryInfo[]> {
  // ZIP central directory 通常在文件末尾，读取最后 64KB 应该足够
  const centralDirSize = Math.min(65536, totalSize);
  const start = Math.max(0, totalSize - centralDirSize);

  // 请求 ZIP 末尾部分（包含 central directory）
  const tailBlob = await fileService.getFileRange(fileId, start, totalSize - 1, { signal });
  const tailArrayBuffer = await tailBlob.arrayBuffer();
  const tailView = new DataView(tailArrayBuffer);

  // 查找 End of Central Directory Record (EOCD) 签名：0x06054b50
  // EOCD 在文件末尾，包含 central directory 的偏移量
  let eocdOffset = -1;
  for (let i = tailView.byteLength - 22; i >= 0; i--) {
    if (tailView.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('无法找到 ZIP End of Central Directory');
  }

  // 解析 EOCD
  const centralDirOffset = tailView.getUint32(eocdOffset + 16, true);
  const centralDirSizeFromEocd = tailView.getUint32(eocdOffset + 12, true);
  const entryCount = tailView.getUint16(eocdOffset + 10, true);

  // 如果 central directory 不在 tail 中，需要单独请求
  let centralDirBlob: Blob;
  if (centralDirOffset < start) {
    // central directory 不在 tail 中，需要单独请求
    const centralDirEnd = centralDirOffset + centralDirSizeFromEocd - 1;
    centralDirBlob = await fileService.getFileRange(
      fileId,
      centralDirOffset,
      centralDirEnd,
      { signal }
    );
  } else {
    // central directory 在 tail 中，直接切片
    const offsetInTail = centralDirOffset - start;
    centralDirBlob = tailBlob.slice(offsetInTail, offsetInTail + centralDirSizeFromEocd);
  }

  // 解析 central directory 条目
  const entries: ZipEntryInfo[] = [];
  const centralDirArrayBuffer = await centralDirBlob.arrayBuffer();
  const centralDirView = new DataView(centralDirArrayBuffer);
  let offset = 0;

  for (let i = 0; i < entryCount && offset < centralDirArrayBuffer.byteLength; i++) {
    // Central Directory File Header 签名：0x02014b50
    if (centralDirView.getUint32(offset, true) !== 0x02014b50) {
      break;
    }

    const compressedSize = centralDirView.getUint32(offset + 20, true);
    const uncompressedSize = centralDirView.getUint32(offset + 24, true);
    const filenameLength = centralDirView.getUint16(offset + 28, true);
    const extraFieldLength = centralDirView.getUint16(offset + 30, true);
    const commentLength = centralDirView.getUint16(offset + 32, true);
    const localHeaderOffset = centralDirView.getUint32(offset + 42, true);

    // 读取文件名
    const filenameBytes = new Uint8Array(
      centralDirArrayBuffer,
      offset + 46,
      filenameLength
    );
    const filename = new TextDecoder('utf-8').decode(filenameBytes);

    entries.push({
      filename,
      offset: localHeaderOffset,
      size: uncompressedSize,
      compressedSize,
    });

    // 移动到下一个条目
    offset += 46 + filenameLength + extraFieldLength + commentLength;
  }

  return entries;
}

/**
 * 使用 zip.js 读取 ZIP 文件中的指定条目（支持 Range 请求）
 * @param fileId 文件 ID
 * @param entryName 条目名称
 * @param entryOffset 条目在 ZIP 中的偏移量（从 central directory 获取）
 * @param signal 取消信号
 * @returns 条目内容的 Blob
 */
export async function readZipEntry(
  fileId: string,
  entryName: string,
  entryOffset: number,
  signal?: AbortSignal
): Promise<Blob> {
  // 先读取 Local File Header 来确定实际数据位置
  // Local File Header 签名：0x04034b50
  const headerBlob = await fileService.getFileRange(
    fileId,
    entryOffset,
    entryOffset + 30, // Local File Header 至少 30 字节
    { signal }
  );
  const headerArrayBuffer = await headerBlob.arrayBuffer();
  const headerView = new DataView(headerArrayBuffer);

  if (headerView.getUint32(0, true) !== 0x04034b50) {
    throw new Error(`无效的 Local File Header，偏移量: ${entryOffset}`);
  }

  const filenameLength = headerView.getUint16(26, true);
  const extraFieldLength = headerView.getUint16(28, true);
  const compressedSize = headerView.getUint32(18, true);

  // 计算数据开始位置
  const dataStart = entryOffset + 30 + filenameLength + extraFieldLength;
  const dataEnd = dataStart + compressedSize - 1;

  // 请求实际数据
  const dataBlob = await fileService.getFileRange(fileId, dataStart, dataEnd, { signal });

  // 使用 zip.js 解压（如果压缩了）
  // 注意：Ugoira 通常使用未压缩的 ZIP，所以可能不需要解压
  // 但为了通用性，我们使用 zip.js 处理
  const reader = new ZipReader(new BlobReader(dataBlob));
  const entries = await reader.getEntries();
  const entry = entries.find((e) => e.filename === entryName);

  if (!entry) {
    throw new Error(`找不到条目: ${entryName}`);
  }

  const writer = new BlobWriter();
  if ('getData' in entry && typeof entry.getData === 'function') {
    await entry.getData(writer);
  } else {
    throw new Error('Entry 不支持 getData 方法');
  }
  const result = await writer.getData();

  await reader.close();
  return result;
}

/**
 * 使用 zip.js 读取 ZIP 条目（推荐方法，支持 Range 请求和认证）
 * zip.js 会自动处理 Range 请求和 central directory 解析
 * @param fileId 文件 ID
 * @param entryName 条目名称
 * @param signal 取消信号
 * @returns 条目内容的 Blob
 */
export async function readZipEntryWithZipJs(
  fileId: string,
  entryName: string,
  _signal?: AbortSignal // 注意：HttpReader 暂不支持 signal，此参数保留以保持 API 兼容性
): Promise<Blob> {
  // 构建下载 URL
  const url = `${API_BASE_URL}/api/files/${fileId}/download`;
  
  // 获取认证 token
  const token = useAuthStore.getState().token ?? localStorage.getItem('token');
  
  // 构建 headers
  const headers: [string, string][] = [];
  if (token) {
    headers.push(['Authorization', `Bearer ${token}`]);
  }
  
  // 使用 zip.js 的 HttpReader，它原生支持 Range 请求和自定义 headers
  // HttpReader 会自动处理 Range 请求，先读取 central directory，然后按需读取文件内容
  const httpReaderOptions: {
    useRangeHeader?: boolean;
    preventHeadRequest?: boolean;
    headers?: Iterable<[string, string]>;
  } = {
    useRangeHeader: true, // 启用 Range 请求
    preventHeadRequest: false, // 允许 HEAD 请求获取文件大小
  };
  
  if (headers.length > 0) {
    httpReaderOptions.headers = headers;
  }
  
  const httpReader = new HttpReader(url, httpReaderOptions);
  
  const reader = new ZipReader(httpReader);

  try {
    const entries = await reader.getEntries();
    const entry = entries.find((e) => e.filename === entryName);

    if (!entry) {
      throw new Error(`找不到条目: ${entryName}`);
    }

    const writer = new BlobWriter();
    if ('getData' in entry && typeof entry.getData === 'function') {
      await entry.getData(writer);
    } else {
      throw new Error('Entry 不支持 getData 方法');
    }
    const result = await writer.getData();

    return result;
  } finally {
    await reader.close();
  }
}

/**
 * 获取 ZIP 文件中的所有条目名称
 * @param fileId 文件 ID
 * @param signal 取消信号
 * @returns 条目名称列表
 */
export async function listZipEntries(
  fileId: string,
  signal?: AbortSignal
): Promise<string[]> {
  const fileReader = new FileServiceReader(fileId, signal);
  const reader = new ZipReader(fileReader);

  try {
    const entries = await reader.getEntries();
    return entries.map((e) => e.filename);
  } finally {
    await reader.close();
  }
}
