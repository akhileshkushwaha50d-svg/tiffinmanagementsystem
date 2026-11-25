@echo off
TITLE Tiffin Management & Delivery Web Application
echo =========================================================================
echo   TIFFIN MANAGEMENT & DELIVERY FULL-STACK WEB APPLICATION
echo =========================================================================
echo Starting Backend Server on http://localhost:8000 or http://localhost:5000 ...
echo Database: SQLite (data/tiffin.db) / Prisma PostgreSQL
echo Frontend: HTML5, CSS3, JavaScript SPA
echo.

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start http://localhost:8000
    python server.py
    goto end
)

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start http://localhost:8000
    py server.py
    goto end
)

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start http://localhost:5000
    node server.js
    goto end
)

echo Python was not found in standard system PATH.
echo Attempting to start default browser directly with frontend...
start "" "%~dp0static\index.html"
echo.
echo Please ensure Python 3 is installed to run the backend API server.
pause

:end
