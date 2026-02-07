# OpenClaw WebHub Channel - 错误处理

> **上一节**：[06-message-flows.md](06-message-flows.md)  
> **下一节**：[08-security.md](08-security.md)

---

## 1. 错误代码枚举

```typescript
enum WebHubErrorCode {
  // ========== 客户端错误 (4xx) ==========
  
  /** 无效的请求 */
  INVALID_REQUEST = "INVALID_REQUEST",
  
  /** 缺少必需字段 */
  MISSING_FIELD = "MISSING_FIELD",
  
  /** 无效的令牌 */
  INVALID_TOKEN = "INVALID_TOKEN",
  
  /** 超过速率限制 */
  RATE_LIMITED = "RATE_LIMITED",
  
  /** 权限不足 */
  PERMISSION_DENIED = "PERMISSION_DENIED",
  
  /** 用户不存在 */
  USER_NOT_FOUND = "USER_NOT_FOUND",
  
  /** 群组不存在 */
  GROUP_NOT_FOUND = "GROUP_NOT_FOUND",
  
  /** 消息不存在 */
  MESSAGE_NOT_FOUND = "MESSAGE_NOT_FOUND",
  
  /** 无效的媒体 */
  INVALID_MEDIA = "INVALID_MEDIA",
  
  /** 媒体文件过大 */
  MEDIA_TOO_LARGE = "MEDIA_TOO_LARGE",
  
  // ========== 服务端错误 (5xx) ==========
  
  /** 内部错误 */
  INTERNAL_ERROR = "INTERNAL_ERROR",
  
  /** 服务不可用 */
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  
  /** 请求超时 */
  TIMEOUT = "TIMEOUT",
  
  /** Webhook 失败 */
  WEBHOOK_FAILED = "WEBHOOK_FAILED",
}
```

---

## 2. 错误响应格式

```typescript
interface WebHubErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryable: boolean;
  };
  requestId: string;
  timestamp: number;
}
```

### 示例

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please wait 1 second before retrying.",
    "details": {
      "retryAfter": 1
    },
    "retryable": true
  },
  "requestId": "req_abc123",
  "timestamp": 1707210000
}
```

---

## 3. 错误处理策略

```typescript
class WebHubErrorHandler {
  
  /**
   * 处理错误并决定是否重试
   */
  async handleError(error: WebHubErrorResponse): Promise<boolean> {
    const { code, retryable } = error.error;
    
    // 不应重试的错误
    const noRetryCodes: string[] = [
      WebHubErrorCode.INVALID_REQUEST,
      WebHubErrorCode.MISSING_FIELD,
      WebHubErrorCode.INVALID_TOKEN,
      WebHubErrorCode.PERMISSION_DENIED,
      WebHubErrorCode.USER_NOT_FOUND,
      WebHubErrorCode.GROUP_NOT_FOUND,
      WebHubErrorCode.MESSAGE_NOT_FOUND,
      WebHubErrorCode.INVALID_MEDIA,
      WebHubErrorCode.MEDIA_TOO_LARGE,
    ];
    
    if (noRetryCodes.includes(code)) {
      console.error(`Non-retryable error: ${code}`);
      return false;
    }
    
    // 可重试的错误
    if (retryable) {
      console.warn(`Retryable error: ${code}, will retry...`);
      return true;
    }
    
    return false;
  }
  
  /**
   * 计算重试延迟（指数退避）
   */
  calculateBackoff(attempt: number, baseDelay: number): number {
    return baseDelay * Math.pow(2, attempt);
  }
}
```

---

## 4. HTTP 状态码映射

| HTTP 状态码 | 错误代码 | 说明 |
|-------------|----------|------|
| 400 | INVALID_REQUEST | 请求格式错误 |
| 401 | INVALID_TOKEN | 未授权 |
| 403 | PERMISSION_DENIED | 权限不足 |
| 404 | USER_NOT_FOUND / MESSAGE_NOT_FOUND / GROUP_NOT_FOUND | 资源不存在 |
| 413 | MEDIA_TOO_LARGE | 请求体过大 |
| 429 | RATE_LIMITED | 超过速率限制 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |
| 503 | SERVICE_UNAVAILABLE | 服务不可用 |
| 504 | TIMEOUT | 请求超时 |

---

*最后更新: 2026-02-06*
