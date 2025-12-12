@echo off
REM Build script for SMSCat with icon support

echo Building SMSCat...

REM Check if rsrc is installed
where rsrc >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo rsrc tool not found. Installing...
    go install github.com/akavel/rsrc@latest
)

REM Check if ICO file exists, if not, try to create from PNG
if not exist "SMSLogo.ico" (
    echo SMSLogo.ico not found. Attempting to create from PNG...
    REM Try ImageMagick if available
    where magick >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        magick convert SMSLogo.png -define icon:auto-resize=256,128,64,48,32,16 SMSLogo.ico
    ) else (
        echo Please convert SMSLogo.png to SMSLogo.ico manually or install ImageMagick
        echo You can use an online converter: https://convertio.co/png-ico/
        pause
        exit /b 1
    )
)

REM Generate resource file
if exist "SMSLogo.ico" (
    echo Generating resource file...
    rsrc -ico SMSLogo.ico -o resource.syso
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to generate resource file
        pause
        exit /b 1
    )
)

REM Build the application
echo Building executable...
go build -tags desktop,production -ldflags "-s -w -H windowsgui" -o SMSCat.exe

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful! SMSCat.exe created.
) else (
    echo.
    echo Build failed!
    pause
    exit /b 1
)

pause

