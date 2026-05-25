@echo off
setlocal enabledelayedexpansion

cd /d "c:\Users\mahmoud\Desktop\Fratelanza-Chating-System"

echo.
echo ========================================
echo Installing dependencies...
echo ========================================
call cmd /c pnpm install

echo.
echo ========================================
echo Starting API Server on http://localhost:3000
echo ========================================
call cmd /c pnpm --filter @workspace/api-server run build
call cmd /c node --enable-source-maps artifacts\api-server\dist\index.mjs

pause
