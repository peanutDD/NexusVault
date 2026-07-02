import api from '../services/api';

export type TelemetryEvent = {
  /** 事件大类：upload / download / preview / error / ui / transcode 等 */
  eventType: string;
  /** 具体动作：如 upload_with_instant、download_file、open_preview 等 */
  action: string;
  /** 状态：start / success / failure */
  status?: 'start' | 'success' | 'failure';
  /** 本次操作耗时（毫秒） */
  durationMs?: number;
  /** 错误信息（仅在 failure 时填） */
  errorMessage?: string;
  /** 关联的文件 ID（若有） */
  fileId?: string;
  /** 关联的文件大小（字节，若有） */
  fileSize?: number;
  /** 额外上下文信息 */
  extra?: Record<string, unknown>;
};

async function sendTelemetry(event: TelemetryEvent): Promise<void> {
  try {
    // 测试环境下避免额外网络请求
    if (import.meta.env.MODE === 'test') return;

    await api.post('/api/telemetry/events', {
      event_type: event.eventType,
      action: event.action,
      status: event.status,
      duration_ms: event.durationMs,
      error_message: event.errorMessage,
      file_id: event.fileId,
      file_size: event.fileSize,
      extra: event.extra ?? null,
    });
  } catch {
    // 遥测失败不影响主流程，静默忽略
  }
}

export function trackEvent(event: TelemetryEvent): void {
  void sendTelemetry(event);
}

export function trackError(
  error: unknown,
  context: { action: string; fileId?: string; fileSize?: number; extra?: Record<string, unknown> }
): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);

  void sendTelemetry({
    eventType: 'error',
    action: context.action,
    status: 'failure',
    errorMessage: message,
    fileId: context.fileId,
    fileSize: context.fileSize,
    extra: context.extra,
  });
}

