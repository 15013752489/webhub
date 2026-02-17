#!/bin/bash

# OpenClaw Chatu Channel - 快速测试脚本
# 
# 使用方法: ./test-chatu.sh

set -e

# 配置
BASE_URL="http://localhost:3000"
CHANNEL_ID="23ade6a3-b393-4ed3-895c-41420162e334"
ACCESS_TOKEN="wh_2835b6943ab548dda29b2538ca18e1ef"

echo "================================"
echo "OpenClaw Chatu Channel 测试脚本"
echo "================================"
echo ""

# 1. 健康检查
echo "1️⃣  检查服务器健康状态..."
HEALTH=$(curl -s "${BASE_URL}/health")
if [[ $(echo "$HEALTH" | jq -r '.status') == "ok" ]]; then
    echo "✅ 服务器运行正常"
else
    echo "❌ 服务器未运行"
    exit 1
fi
echo ""

# 2. 获取频道信息
echo "2️⃣  获取频道信息..."
CHANNEL=$(curl -s "${BASE_URL}/api/webhub/channels/${CHANNEL_ID}")
if [[ $(echo "$CHANNEL" | jq -r '.success') == "true" ]]; then
    CHANNEL_NAME=$(echo "$CHANNEL" | jq -r '.data.name')
    CHANNEL_STATUS=$(echo "$CHANNEL" | jq -r '.data.status')
    echo "✅ 频道: ${CHANNEL_NAME} (状态: ${CHANNEL_STATUS})"
else
    echo "❌ 无法获取频道信息"
    exit 1
fi
echo ""

# 3. 发送文本消息
echo "3️⃣  测试发送文本消息..."
TEXT_MSG=$(cat <<EOF
{
  "messageId": "test-$(date +%s)-text",
  "target": {"type": "user", "id": "test-user-$(date +%s)"},
  "content": {"text": "测试文本消息 - $(date)", "format": "plain"},
  "timestamp": $(date +%s)000
}
EOF
)

TEXT_RESULT=$(curl -s -X POST "${BASE_URL}/api/channel/messages" \
  -H "Content-Type: application/json" \
  -H "X-Channel-Token: ${ACCESS_TOKEN}" \
  -H "X-Channel-ID: ${CHANNEL_ID}" \
  -d "$TEXT_MSG")

if [[ $(echo "$TEXT_RESULT" | jq -r '.success') == "true" ]]; then
    MSG_ID=$(echo "$TEXT_RESULT" | jq -r '.messageId')
    echo "✅ 文本消息发送成功 (ID: ${MSG_ID})"
else
    echo "❌ 文本消息发送失败"
    echo "$TEXT_RESULT" | jq .
    exit 1
fi
echo ""

# 4. 发送图片消息
echo "4️⃣  测试发送图片消息..."
IMAGE_MSG=$(cat <<EOF
{
  "messageId": "test-$(date +%s)-image",
  "target": {"type": "user", "id": "test-user-$(date +%s)"},
  "content": {"text": "测试图片消息", "format": "plain"},
  "media": [{"type": "image", "url": "https://picsum.photos/200"}],
  "timestamp": $(date +%s)000
}
EOF
)

IMAGE_RESULT=$(curl -s -X POST "${BASE_URL}/api/channel/messages" \
  -H "Content-Type: application/json" \
  -H "X-Channel-Token: ${ACCESS_TOKEN}" \
  -H "X-Channel-ID: ${CHANNEL_ID}" \
  -d "$IMAGE_MSG")

if [[ $(echo "$IMAGE_RESULT" | jq -r '.success') == "true" ]]; then
    MSG_ID=$(echo "$IMAGE_RESULT" | jq -r '.messageId')
    echo "✅ 图片消息发送成功 (ID: ${MSG_ID})"
else
    echo "❌ 图片消息发送失败"
    echo "$IMAGE_RESULT" | jq .
    exit 1
fi
echo ""

# 5. 查询最近的消息
echo "5️⃣  查询最近的消息..."
MESSAGES=$(curl -s "${BASE_URL}/api/webhub/channels/${CHANNEL_ID}/messages?limit=5")
MSG_COUNT=$(echo "$MESSAGES" | jq '.data | length')
echo "✅ 找到 ${MSG_COUNT} 条消息"
echo ""
echo "最近的消息:"
echo "$MESSAGES" | jq -r '.data[] | "  - \(.createdAt) | \(.messageType) | \(.status)"'
echo ""

# 总结
echo "================================"
echo "✅ 所有测试通过！"
echo "================================"
echo ""
echo "频道统计:"
curl -s "${BASE_URL}/api/webhub/channels/${CHANNEL_ID}/status" | jq '.data.metrics'
echo ""
