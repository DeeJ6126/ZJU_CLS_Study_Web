@echo off
setlocal

call npm.cmd test
if errorlevel 1 exit /b 1

call npm.cmd run build
if errorlevel 1 exit /b 1

call npm.cmd run check:architecture
if errorlevel 1 exit /b 1

call npm.cmd run check
if errorlevel 1 exit /b 1

endlocal

