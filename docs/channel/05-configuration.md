# OpenClaw WebHub Channel - 配置模式

> **上一节**：[04-api-endpoints.md](04-api-endpoints.md)  
> **下一节**：[06-message-flows.md](06-message-flows.md)

---

## 1. 完整配置类型

```typescript
interface WebHubConfig {
  /** API 配置 */
  api: {
    baseUrl: string;
    apiKey?: string;
    accessToken?: string;
    signatureKey?: string;
    signatureAlgorithm?: "sha256" | "sha512";
  };
  
  /** Webhook 配置 */
  webhook: {
    path: string;
    secret?: string;
  };
  
  /** 字段映射配置 */
  mapping?: {
    userIdField?: string;
    messageIdField?: string;
    timestampFormat?: "unix" | "iso8601" | "milliseconds";
    textFormat?: "plain" | "markdown";
  };
  
  /** 速率限制配置 */
  rateLimit?: {
    enabled?: boolean;
    requestsPerSecond?: number;
    burstSize?: number;
  };
  
  /** 超时配置（毫秒） */
  timeout?: {
    connect?: number;
    read?: number;
    write?: number;
  };
  
  /** 重试配置 */
  retry?: {
    enabled?: boolean;
    maxAttempts?: number;
    backoffMs?: number;
  };
  
  /** 消息处理配置 */
  message?: {
    maxLength?: number;
    allowedFormats?: ("plain" | "markdown" | "html")[];
    media?: {
      maxSize?: number;
      allowedTypes?: string[];
    };
  };
  
  /** 功能开关 */
  features?: {
    polls?: boolean;
    reactions?: boolean;
    threads?: boolean;
    typing?: boolean;
    presence?: boolean;
    buttons?: boolean;
  };
}
```

---

## 2. 默认配置

```json
{
  "api": {
    "baseUrl": "https://api.example.com/webhub/v1",
    "signatureAlgorithm": "sha256"
  },
  "webhook": {
    "path": "/webhook"
  },
  "mapping": {
    "userIdField": "id",
    "messageIdField": "id",
    "timestampFormat": "unix",
    "textFormat": "markdown"
  },
  "rateLimit": {
    "enabled": true,
    "requestsPerSecond": 10,
    "burstSize": 20
  },
  "timeout": {
    "connect": 10000,
    "read": 30000,
    "write": 30000
  },
  "retry": {
    "enabled": true,
    "maxAttempts": 3,
    "backoffMs": 1000
  },
  "message": {
    "maxLength": 10000,
    "allowedFormats": ["plain", "markdown"],
    "media": {
      "maxSize": 104857600,
      "allowedTypes": ["image/*", "video/*", "audio/*", "application/pdf"]
    }
  },
  "features": {
    "polls": true,
    "reactions": true,
    "threads": true,
    "typing": true,
    "presence": true,
    "buttons": true
  }
}
```

---

## 3. openclaw.plugin.json

```json
{
  "id": "webhub",
  "channels": ["webhub"],
  "version": "1.0.0",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "api": {
        "type": "object",
        "properties": {
          "baseUrl": { "type": "string" },
          "apiKey": { "type": "string" },
          "accessToken": { "type": "string" },
          "signatureKey": { "type": "string" },
          "signatureAlgorithm": { "type": "string", "enum": ["sha256", "sha512"] }
        },
        "required": ["baseUrl"]
      },
      "webhook": {
        "type": "object",
        "properties": {
          "path": { "type": "string" },
          "secret": { "type": "string" }
        }
      },
      "mapping": {
        "type": "object",
        "properties": {
          "userIdField": { "type": "string" },
          "messageIdField": { "type": "string" },
          "timestampFormat": { "type": "string" },
          "textFormat": { "type": "string" }
        }
      },
      "rateLimit": {
        "type": "object",
        "properties": {
          "enabled": { "type": "boolean" },
          "requestsPerSecond": { "type": "number" },
          "burstSize": { "type": "number" }
        }
      },
      "timeout": {
        "type": "object",
        "properties": {
          "connect": { "type": "number" },
          "read": { "type": "number" },
          "write": { "type": "number" }
        }
      },
      "retry": {
        "type": "object",
        "properties": {
          "enabled": { "type": "boolean" },
          "maxAttempts": { "type": "number" },
          "backoffMs": { "type": "number" }
        }
      },
      "message": {
        "type": "object",
        "properties": {
          "maxLength": { "type": "number" },
          "allowedFormats": { "type": "array" },
          "media": {
            "type": "object",
            "properties": {
              "maxSize": { "type": "number" },
              "allowedTypes": { "type": "array" }
            }
          }
        }
      },
      "features": {
        "type": "object",
        "properties": {
          "polls": { "type": "boolean" },
          "reactions": { "type": "boolean" },
          "threads": { "type": "boolean" },
          "typing": { "type": "boolean" },
          "presence": { "type": "boolean" },
          "buttons": { "type": "boolean" }
        }
      }
    },
    "required": ["api"]
  }
}
```

---

## 4. Config Adapter

```typescript
import type { ChannelConfigAdapter, ResolvedAccount } from "openclaw/plugin-sdk";

export const config: ChannelConfigAdapter<ResolvedAccount> = {
  listAccountIds: (cfg) => {
    const accounts = cfg.channels?.webhub?.accounts || {};
    return Object.keys(accounts);
  },
  
  resolveAccount: (cfg, accountId) => {
    const accounts = cfg.channels?.webhub?.accounts || {};
    const account = accounts[accountId] || accounts["default"];
    return {
      id: accountId,
      config: account,
      enabled: account?.enabled !== false,
    };
  },
  
  defaultAccountId: (cfg) => "default",
  
  setAccountEnabled: ({ cfg, accountId, enabled }) => {
    // 实现启用/禁用账号
  },
  
  deleteAccount: ({ cfg, accountId }) => {
    // 实现删除账号
  },
};
```

---

*最后更新: 2026-02-06*
