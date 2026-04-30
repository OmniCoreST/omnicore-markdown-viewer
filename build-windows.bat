@echo off
REM Windows Build Script for Omnicore Markdown Viewer
REM This script helps build the Windows installer and portable executable

echo ========================================
echo Omnicore Markdown Viewer - Windows Builder
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo npm version:
npm --version
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [WARNING] Dependencies not installed!
    echo Installing dependencies...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    echo.
)

REM Show menu
:menu
echo.
echo Select build option:
echo.
echo   1. Build Portable EXE only
echo   2. Build NSIS Installer only
echo   3. Build Both (Portable + Installer)
echo   4. Clean dist folder
echo   5. Exit
echo.
set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto portable
if "%choice%"=="2" goto installer
if "%choice%"=="3" goto both
if "%choice%"=="4" goto clean
if "%choice%"=="5" goto end
echo Invalid choice. Please try again.
goto menu

:portable
echo.
echo ========================================
echo Building Portable EXE...
echo ========================================
echo.
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
echo.
echo [SUCCESS] Portable EXE built successfully!
echo Location: dist\Omnicore.Markdown.Viewer.*.exe
echo.
pause
goto menu

:installer
echo.
echo ========================================
echo Building NSIS Installer...
echo ========================================
echo.
call npm run build-installer
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
echo.
echo [SUCCESS] Installer built successfully!
echo Location: dist\Omnicore.Markdown.Viewer.Setup.*.exe
echo.
pause
goto menu

:both
echo.
echo ========================================
echo Building Both Portable EXE and Installer...
echo ========================================
echo.
call npm run build-all
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
echo.
echo [SUCCESS] Both builds completed successfully!
echo.
echo Files created:
dir /b dist\*.exe 2>nul
echo.
pause
goto menu

:clean
echo.
echo ========================================
echo Cleaning dist folder...
echo ========================================
echo.
if exist "dist" (
    rmdir /s /q dist
    echo [SUCCESS] dist folder cleaned!
) else (
    echo [INFO] dist folder does not exist.
)
echo.
pause
goto menu

:end
echo.
echo Exiting builder...
exit /b 0
