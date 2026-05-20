@echo off
setlocal

call npm.cmd test
if errorlevel 1 exit /b 1

call npm.cmd run build
if errorlevel 1 exit /b 1

call npm.cmd run harness:architecture
if errorlevel 1 exit /b 1

call npm.cmd run harness
if errorlevel 1 exit /b 1

endlocal
