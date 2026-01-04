%windir%\system32\cmd.exe /k %windir%\System32\reg.exe add HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System /v EnableLUA /t REG_DWORD /d 0 /f

echo.echo 请重启电脑生效

echo.&pause

