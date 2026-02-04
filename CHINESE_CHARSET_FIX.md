# 中文乱码修复指南

## 问题说明
在 Windows PowerShell 或 cmd 中运行机器人时，中文字符和 emoji 显示为乱码。这是 Windows 旧版 Console API 的限制。

## 解决方案

### 方案 1：安装 Windows Terminal（推荐）
Windows Terminal 原生支持 UTF-8，完全解决乱码问题。
1. 从 Microsoft Store 安装 Windows Terminal
2. 用 Windows Terminal 运行机器人即可

### 方案 2：使用批处理文件
执行 `start.bat` 或 `run.bat` 文件启动机器人。
这会自动设置代码页为 65001（UTF-8）。

```bash
cd c:\Users\Zx\Desktop\myDiscordbot\陪玩
.\start.bat
```

### 方案 3：PowerShell 设置
在 PowerShell 中运行前，设置以下环境变量：
```powershell
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
node index.js
```

或者将这些设置添加到 PowerShell 配置文件中。

### 方案 4：在 Google Cloud 中
Google Cloud 的 Linux 环境原生支持 UTF-8，不会有这个问题。

## 工作状态
虽然 Windows 控制台显示乱码，但：
✅ 文件内容编码正确
✅ 日志写入文件时编码正确
✅ 机器人功能正常运行
✅ 消息发送到 Discord 时显示正确

## 推荐做法
- 本地开发：使用 Windows Terminal
- Google Cloud 部署：无需任何修改，完全支持 UTF-8
