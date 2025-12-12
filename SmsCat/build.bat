@echo off
REM Build script for SMSCat with icon support

echo Building SMSCat...

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

REM Check if ICO file exists, if not, try to create from PNG
if not exist "SMSLogo.ico" (
    echo SMSLogo.ico not found. Attempting to create from PNG...
    REM Try ImageMagick if available
    where magick >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        magick convert SMSLogo.png -define icon:auto-resize=256,128,64,48,32,16 SMSLogo.ico
        if %ERRORLEVEL% NEQ 0 (
            echo Failed to convert PNG to ICO with ImageMagick
        )
    )
    
    REM If still no ICO file, skip icon embedding (systray icon will still work)
    if not exist "SMSLogo.ico" (
        echo Warning: SMSLogo.ico not found. Building without exe icon.
        echo (System tray icon will still work from embedded PNG)
        echo To add exe icon later: Convert SMSLogo.png to SMSLogo.ico and rebuild
        echo.
    )
)

REM Generate resource file only if ICO exists
if exist "SMSLogo.ico" (
    echo Generating resource file...
    rsrc -ico SMSLogo.ico -o resource.syso
    if %ERRORLEVEL% NEQ 0 (
        echo Warning: Failed to generate resource file, building without exe icon
        del resource.syso 2>nul
    )
)

REM Build the application
echo Building executable...
go build -tags desktop,production -ldflags "-s -w -H windowsgui" -o SMSCat.exe

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful! SMSCat.exe created.
    if not exist "resource.syso" (
        echo Note: Exe icon not embedded. System tray icon will still work.
    )
) else (
    echo.
    echo Build failed!
    pause
    exit /b 1
)

pause

