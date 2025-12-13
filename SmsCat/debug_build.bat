@echo off
REM Debug Build script for SMSCat (No hidden console)

echo Building SMSCat (Debug Mode)...

REM Install/update dependencies first
echo Installing dependencies...
go mod tidy
if %ERRORLEVEL% NEQ 0 (
    echo Failed to install dependencies
    pause
    exit /b 1
)

REM Check if rsrc is installed
where rsrc >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo rsrc tool not found. Installing...
    go install github.com/akavel/rsrc@latest
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install rsrc
        pause
        exit /b 1
    )
)

REM Check if ICO file exists
if not exist "SMSLogo.ico" (
    echo SMSLogo.ico not found. Attempting to create from PNG...
    where magick >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        magick convert SMSLogo.png -define icon:auto-resize=256,128,64,48,32,16 SMSLogo.ico
    )
)

REM Generate resource file only if ICO exists
if exist "SMSLogo.ico" (
    echo Generating resource file...
    del resource.syso 2>nul
    rsrc -ico SMSLogo.ico -o resource.syso
)

REM Build the application WITHOUT windowsgui to show console
echo Building executable (Debug version)...
REM Removed -ldflags "-s -w -H windowsgui" to allow console output and symbols
go build -tags desktop,production -o SMSCat_Debug.exe

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful! SMSCat_Debug.exe created.
    echo Please run this executable from a command prompt to see error logs.
    echo.
) else (
    echo.
    echo Build failed!
    pause
    exit /b 1
)

pause
