# OpenClaw WebHub Channel - 安全性

> **上一节**：[07-error-handling.md](07-error-handling.md)  
> **下一节**：[09-implementation.md](09-implementation.md)

---

## 1. 认证方式

### 1.1 API Key 认证

```http
Authorization: Bearer {apiKey}
X-WebHub-Signature: sha256={signature}
```

### 1.2 Access Token 认证

```http
Authorization: Bearer {accessToken}
```

### 1.3 Basic Auth 认证

```http
Authorization: Basic {base64(username:password)}
```

---

## 2. Webhook 签名验证

```typescript
import * as crypto from 'crypto';

/**
 * 生成签名
 */
function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * 验证签名
 */
function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signPayload(payload, secret);
  
  // 使用 timingSafeEqual 防止时序攻击
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

/**
 * Webhook 处理器示例
 */
async function handleWebhook(
  body: string,
  headers: Record<string, string>
): Promise<void> {
  const signature = headers['x-webhub-signature'];
  const secret = process.env.WEBHUB_WEBHOOK_SECRET;
  
  if (!verifySignature(body, signature, secret)) {
    throw new Error('Invalid signature');
  }
  
  const payload = JSON.parse(body);
  // 处理消息...
}
```

---

## 3. 安全最佳实践

```typescript
const securityConfig = {
  // 1. HTTPS 必须
  requireHttps: true,
  
  // 2. 签名验证
  verifySignature: true,
  
  // 3. 请求大小限制
  maxBodySize: '10mb',
  
  // 4. CORS 配置
  cors: {
    enabled: true,
    allowedOrigins: ['https://openclaw.example.com'],
  },
  
  // 5. 输入验证
  inputValidation: {
    maxMessageLength: 10000,
    sanitizeHtml: true,
    maxDepth: 10,
  },
  
  // 6. 速率限制
  rateLimit: {
    windowMs: 60000,
    maxRequests: 100,
  },
};
```

---

## 4. Security Adapter

```typescript
import type { ChannelSecurityAdapter } from "openclaw/plugin-sdk";

export const security: ChannelSecurityAdapter<ResolvedWebHubAccount> = {
  resolveDmPolicy: ({ cfg, accountId, account }) => ({
    policy: account.dmPolicy ?? "pairing",
    allowFrom: account.allowFrom ?? [],
    policyPath: `channels.webhub.accounts.${accountId}.dmPolicy`,
    allowFromPath: `channels.webhub.accounts.${accountId}.`,
    approveHint: "WebHub pairing code: {code}",
    normalizeEntry: (raw) => raw.trim(),
  }),
  
  collectWarnings: ({ account, cfg }) => {
    const warnings: string[] = [];
    if (!cfg.api?.baseUrl) {
      warnings.push("- WebHub: api.baseUrl is not configured");
    }
    return warnings;
  },
};
```

---

## 5. 加密传输

```typescript
// 所有 API 调用必须使用 HTTPS
const API_BASE_URL = process.env.WEBHUB_API_URL || 'https://api.example.com';

// 敏感数据加密
interface EncryptedPayload {
  iv: string;           // 初始化向量
  encryptedData: string; // 加密后的数据
  authTag: string;      // 认证标签
}
```

---

*最后更新: 2026-02-06*
