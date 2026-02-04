# PowerShell UTF-8 Setup
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp.com 65001 | Out-Null

# Start the bot
node index.js @args
