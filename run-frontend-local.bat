@echo off
cd /d "c:\Users\mahmoud\Desktop\Fratelanza-Chating-System"

echo.
echo ========================================
echo Starting Frontend on http://localhost:5173
echo ========================================
call cmd /c pnpm --filter @workspace/fratelanza-crm run dev

pause
