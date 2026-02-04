# 推送指南

## 快速推送

在目录中有两个推送脚本供你选择：

### 1. **push.bat** （推荐 - 交互式）
完整的推送助手，会：
- 显示当前git状态
- 检测未提交的更改
- 提供提交或直接推送选项
- 显示推送结果和错误诊断

**使用方法：**
```cmd
双击运行 push.bat
```

### 2. **push-simple.bat** （快速 - 一键推送）
简化版本，直接推送所有更改

**使用方法：**
```cmd
双击运行 push-simple.bat
```

## 如果推送被GitHub阻止

### 问题：GitHub Secret Scanning
当推送包含敏感信息（如bot token）时，GitHub会自动阻止。

### 解决方案：

**选项A：允许已知的secret（推荐用于测试）**
1. 脚本会提示失败原因和链接
2. 访问 https://github.com/wentenx22/myDiscordbot-v2/security/secret-scanning
3. 找到被检测到的secret
4. 点击"Allow"按钮允许推送
5. 重新运行push.bat推送

**选项B：使用环境变量（推荐用于生产环境）**
1. 在`.env`文件中设置敏感信息
2. 确保`.env`在`.gitignore`中（已配置）
3. 修改config.json使用占位符（${DISCORD_BOT_TOKEN}等）
4. 推送时不会包含真实的secret
5. 运行Bot时自动从`.env`加载值

### 环境变量配置

复制`.env.example`为`.env`：
```
DISCORD_BOT_TOKEN=your_token_here
TELEGRAM_BOT_TOKEN=your_token_here
...
```

## 常见问题

**Q: 推送很慢？**
A: 可能是网络问题或node_modules太大，可以用`git push --force`强制推送

**Q: 提示"Please tell me who you are"？**
A: 配置git用户信息：
```cmd
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"
```

**Q: 想要完全隐藏敏感信息？**
A: 
1. 更新config.json为占位符格式
2. 在`.env`中设置真实值
3. 确保`.env`被`.gitignore`忽略
4. 运行Bot时自动加载

## 文件说明

- `push.bat` - 交互式推送脚本（推荐）
- `push-simple.bat` - 一键推送脚本
- `.env` - 本地环境变量（被.gitignore忽略，不会上传）
- `.env.example` - 环境变量模板（用于参考）
- `config.json` - 配置文件（支持占位符）
