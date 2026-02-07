# OpenClaw WebHub Channel - 测试用例

> **上一节**：[09-implementation.md](09-implementation.md)  
> **下一节**：[11-appendix.md](11-appendix.md)

---

## 1. 单元测试

```typescript
import { describe, it, expect } from '@jest/globals';
import { WebHubPlugin } from './src/channel';
import { createMockConfig } from './test/mocks';

describe('WebHub Channel', () => {
  
  describe('消息发送', () => {
    it('应该成功发送文本消息', async () => {
      const channel = new WebHubPlugin();
      const config = createMockConfig();
      const params = {
        target: { type: 'user' as const, id: 'user123' },
        content: { text: 'Hello!' },
      };
      
      const result = await channel.send(params);
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
    
    it('应该验证消息格式', async () => {
      const channel = new WebHubPlugin();
      const params = {
        target: { type: 'user' as const, id: '' },
        content: { text: 'Hello!' },
      };
      
      await expect(channel.send(params)).rejects.toThrow();
    });
  });
  
  describe('Webhook 处理', () => {
    it('应该正确验证签名', async () => {
      // 测试签名验证逻辑
    });
    
    it('应该正确解析消息', async () => {
      // 测试消息解析逻辑
    });
    
    it('应该处理无效载荷', async () => {
      // 测试错误处理逻辑
    });
  });
  
  describe('消息转换', () => {
    it('应该正确映射字段', () => {
      // 测试字段映射逻辑
    });
    
    it('应该正确转换时间戳', () => {
      // 测试时间戳转换逻辑
    });
  });
});
```

---

## 2. 集成测试

```typescript
describe('WebHub Integration', () => {
  it('应该完整发送和接收消息', async () => {
    const config = createMockConfig();
    const channel = new WebHubPlugin(config);
    
    // 发送消息
    const sendResult = await channel.send({
      target: { type: 'user', id: 'user123' },
      content: { text: 'Test message' },
    });
    
    expect(sendResult.success).toBe(true);
    
    // 模拟接收消息
    const inboundMessage = createMockInboundMessage({
      content: { text: 'Response from user' },
    });
    
    // 验证消息转换
    const normalized = channel.normalizeMessage(inboundMessage);
    expect(normalized.content).toBe('Response from user');
  });
});
```

---

## 3. 端到端测试

```typescript
describe('WebHub E2E', () => {
  beforeAll(async () => {
    // 启动测试服务器
    await startMockServer();
  });
  
  afterAll(async () => {
    // 停止测试服务器
    await stopMockServer();
  });
  
  it('应该处理完整消息流', async () => {
    const webhub = new WebHubClient({
      apiUrl: 'http://localhost:3000',
      apiKey: 'test-key',
    });
    
    // 1. 发送消息
    const sent = await webhub.send({
      target: { type: 'user', id: 'user1' },
      content: { text: 'Hello!' },
    });
    
    // 2. 模拟用户回复
    await mockServer.receiveMessage({
      id: 'msg_001',
      content: { text: 'Hi there!' },
      sender: { id: 'user1' },
    });
    
    // 3. 验证消息接收
    const received = await webhub.waitForMessage('msg_001');
    expect(received.content.text).toBe('Hi there!');
  });
});
```

---

## 4. 性能测试

```typescript
describe('WebHub Performance', () => {
  it('应该支持并发消息发送', async () => {
    const channel = new WebHubPlugin();
    const messages = Array.from({ length: 100 }, (_, i) => ({
      target: { type: 'user', id: `user${i}` },
      content: { text: `Message ${i}` },
    }));
    
    const start = Date.now();
    const results = await Promise.all(
      messages.map(msg => channel.send(msg))
    );
    const duration = Date.now() - start;
    
    expect(results.every(r => r.success)).toBe(true);
    expect(duration).toBeLessThan(30000); // 30秒内完成
  });
});
```

---

*最后更新: 2026-02-06*
