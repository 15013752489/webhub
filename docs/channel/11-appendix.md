# OpenClaw WebHub Channel - 附录

> **上一节**：[10-testing.md](10-testing.md)  
> **返回**：[README.md](README.md)

---

## 1. 消息长度限制

| 元素 | 限制 |
|------|------|
| 消息文本 | 10,000 字符 |
| 文件名 | 255 字符 |
| 标题 | 1,000 字符 |
| 投票问题 | 300 字符 |
| 投票选项 | 100 字符 |
| 投票选项数 | 10 个 |
| 消息反应数 | 20 个不重复表情 |

---

## 2. 支持的媒体类型

| 类型 | MIME 类型 |
|------|-----------|
| 图片 | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| 视频 | `video/mp4`, `video/webm`, `video/quicktime` |
| 音频 | `audio/mpeg`, `audio/wav`, `audio/ogg` |
| 文件 | `application/pdf`, `application/zip`, 等 |

---

## 3. Markdown 支持

```markdown
# 一级标题
## 二级标题

**粗体文本**
*斜体文本*
~~删除线~~

`行内代码`
```代码块
多行代码
```

[链接文本](https://example.com)

> 引用文本

- 无序列表项
1. 有序列表项

| 表头1 | 表头2 |
|-------|-------|
| 单元格 | 单元格 |
```

---

## 4. 版本历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| 1.0.0 | 2026-02-06 | OpenClaw | 初始设计文档 |

---

## 5. 相关链接

- **GitHub 仓库**: https://github.com/chatu-ai/openclaw-web-hub-channel
- **OpenClaw 文档**: https://docs.openclaw.ai
- **SDK 参考**: /home/chsword/.npm-global/lib/node_modules/openclaw/docs/
- **WhatsApp 插件参考**: /home/chsword/.npm-global/lib/node_modules/openclaw/extensions/whatsapp/src/channel.ts

---

*最后更新: 2026-02-06*
