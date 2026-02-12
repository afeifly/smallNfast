@echo off
setlocal

REM Win7 Build Option
set "BUILD_MODE=normal"
set /P BUILD_INPUT=Do you want to build for Windows 7 with Embedded WebView2? (Y/N): 
if /I "%BUILD_INPUT%"=="Y" set "BUILD_MODE=win7"

REM Check for embedded WebView2 runtime
set "WEBVIEW_ZIP=internal\webview_runtime\WebView2.zip"
set "EMBED_TAGS="

if "%BUILD_MODE%"=="win7" (
    if exist "%WEBVIEW_ZIP%" (
        echo Building for Windows 7 with Embedded WebView2...
        set EMBED_TAGS=embed_webview
    ) else (
        echo ERROR: Windows 7 build requested but WebView2.zip not found!
        echo Please place the fixed version runtime (109.0.1518.78) in internal\webview_runtime\
        pause
        exit /b 1
    )
) else (
    echo Building Standard Version (System WebView2)...
)


REM Install rsrc if missing
where /q rsrc
if %ERRORLEVEL% NEQ 0 (
    echo Installing rsrc tool...
    go install github.com/akavel/rsrc@latest
)

REM Generate .syso
if exist "SMSLogo.ico" (
    echo Generating resource file...
    if exist "app.manifest" (
        rsrc -manifest app.manifest -ico SMSLogo.ico -o resource.syso
    ) else (
        rsrc -ico SMSLogo.ico -o resource.syso
    )
)

REM Build the application
echo Building executable...
if "%EMBED_TAGS%"=="" (
    go build -tags desktop,production -ldflags "-s -w -H windowsgui" -o SMSCat.exe
) else (
    go build -tags "desktop,production,%EMBED_TAGS%" -ldflags "-s -w -H windowsgui" -o SMSCat.exe
)

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful! SMSCat.exe created.
    if "%BUILD_MODE%"=="win7" (
        echo NOTE: This build contains the embedded WebView2 runtime.
    ) else (
        echo NOTE: This build requires WebView2 Runtime installed on target.
    )
) else (
    echo.
    echo Build failed!
)

pause
