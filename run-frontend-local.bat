@echo off
cd /d "%~dp0"

echo.
echo ========================================
echo Starting Frontend on http://localhost:5173
echo ========================================
call cmd /c pnpm --filter @workspace/lotus-crm run dev

pause
