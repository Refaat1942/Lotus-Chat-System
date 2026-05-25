@echo off
setlocal enabledelayedexpansion

REM Read .env file and set environment variables
for /f "usebackq delims==" %%A in ("%~dp0.env") do (
    if not "%%A"=="" (
        set "%%A"
    )
)

echo.
echo ========================================
echo Starting API Server
echo ========================================
echo Port: %PORT%
echo Database: %DATABASE_URL%
echo.

cd /d "%~dp0artifacts\api-server"
node --enable-source-maps dist/index.mjs

pause
