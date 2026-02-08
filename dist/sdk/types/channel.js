"use strict";
/******************************************************************
 * Channel SDK - Channel Types
 *
 * OpenClaw Channel SDK 的核心类型定义
 *
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 ******************************************************************/
Object.defineProperty(exports, "__esModule", { value: true });
exports.TargetType = exports.MessageType = void 0;
/**
 * 消息类型 [Channel SDK 标准]
 */
var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "text";
    MessageType["IMAGE"] = "image";
    MessageType["VIDEO"] = "video";
    MessageType["AUDIO"] = "audio";
    MessageType["FILE"] = "file";
    MessageType["LOCATION"] = "location";
})(MessageType || (exports.MessageType = MessageType = {}));
/**
 * 目标类型 [Channel SDK 标准]
 */
var TargetType;
(function (TargetType) {
    TargetType["USER"] = "user";
    TargetType["GROUP"] = "group";
    TargetType["CHANNEL"] = "channel";
})(TargetType || (exports.TargetType = TargetType = {}));
//# sourceMappingURL=channel.js.map