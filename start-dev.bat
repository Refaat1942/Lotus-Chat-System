@echo off
cd /d "c:\Users\mahmoud\Desktop\Fratelanza-Chating-System"

REM Install dependencies
echo Installing dependencies...
call npm install -g pnpm
call pnpm install

REM Start API server
echo Starting API server on port 3000...
call pnpm --filter @workspace/api-server run dev
