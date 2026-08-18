@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title GoLabel Label Print

echo ============================================
echo   GoLabel auto-open helper
echo ============================================
echo.

rem ---------- 1. Find GoLabel.exe ----------
set "GOLABEL="
set "PF=%ProgramFiles%"
set "PF86=%ProgramFiles(x86)%"

rem common install locations
if exist "%PF%\GoLabel\GoLabel.exe" set "GOLABEL=%PF%\GoLabel\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF86%\GoLabel\GoLabel.exe" set "GOLABEL=%PF86%\GoLabel\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF%\GoLabel\GoLabel\GoLabel.exe" set "GOLABEL=%PF%\GoLabel\GoLabel\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF86%\GoLabel\GoLabel\GoLabel.exe" set "GOLABEL=%PF86%\GoLabel\GoLabel\GoLabel.exe"
if defined GOLABEL goto verify
if exist "C:\GoLabel\GoLabel.exe" set "GOLABEL=C:\GoLabel\GoLabel.exe"
if defined GOLABEL goto verify
if exist "C:\GoLabel\GoLabel\GoLabel.exe" set "GOLABEL=C:\GoLabel\GoLabel\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%LOCALAPPDATA%\GoLabel\GoLabel.exe" set "GOLABEL=%LOCALAPPDATA%\GoLabel\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF%\GoDEX\GoLabel\GoLabel.exe" set "GOLABEL=%PF%\GoDEX\GoLabel\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF86%\GoDEX\GoLabel\GoLabel.exe" set "GOLABEL=%PF86%\GoDEX\GoLabel\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF%\GoDEX\GoLabel II\GoLabel.exe" set "GOLABEL=%PF%\GoDEX\GoLabel II\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF86%\GoDEX\GoLabel II\GoLabel.exe" set "GOLABEL=%PF86%\GoDEX\GoLabel II\GoLabel.exe"
if defined GOLABEL goto verify

rem search PATH
if not defined GOLABEL for /f "delims=" %%A in ('where GoLabel.exe 2^>nul') do if not defined GOLABEL set "GOLABEL=%%A"
if defined GOLABEL goto verify

rem recursive search in Program Files (slow, only as fallback)
if not defined GOLABEL for /f "delims=" %%A in ('where /r "%PF%" GoLabel.exe 2^>nul') do if not defined GOLABEL set "GOLABEL=%%A"
if defined GOLABEL goto verify
if not defined GOLABEL for /f "delims=" %%A in ('where /r "%PF86%" GoLabel.exe 2^>nul') do if not defined GOLABEL set "GOLABEL=%%A"
if defined GOLABEL goto verify

echo GoLabel.exe was not found automatically.
set /p "GOLABEL=Enter full path to GoLabel.exe: "

:verify
if exist "%GOLABEL%" goto found
echo.
echo GoLabel.exe not found at: %GOLABEL%
pause
exit /b 1

:found
echo GoLabel: %GOLABEL%

rem ---------- 2. Check data.csv exists ----------
if exist "%~dp0data.csv" goto have_csv
echo data.csv not found in: %cd%
echo.
echo Files currently in this folder:
dir /b
pause
exit /b 1

:have_csv
echo Preparing label files for GoLabel...

rem ---------- 3. Rewrite DataBaseFilePath for every label & ensure schema.ini ----------
rem This works on the first run (files are .ezpx.tmp) and on later runs after the
rem folder was moved (files are already .ezpx, only the path needs re-fixing).
set "GOLABEL_CSV=%~dp0data.csv"
set "GOLABEL_SCHEMA=%~dp0schema.ini"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$sf=$env:GOLABEL_SCHEMA; if (-not (Test-Path $sf)) { Set-Content -LiteralPath $sf -Value @('[data.csv]','ColNameHeader=True','Format=Delimited(,)','CharacterSet=1252',('Col1='+[char]34+'sn'+[char]34+' Text'),('Col2='+[char]34+'qr_code'+[char]34+' Text')) -Encoding ASCII }"
for %%F in (*.ezpx.tmp) do powershell -NoProfile -ExecutionPolicy Bypass -Command "$csv=$env:GOLABEL_CSV; $esc=$csv.Replace('$','$$'); $p='%%~fF'; $c=[IO.File]::ReadAllText($p); $c=[regex]::Replace($c,'<DataBaseFilePath>.*?</DataBaseFilePath>|<DataBaseFilePath\s*/>','<DataBaseFilePath>'+$esc+'</DataBaseFilePath>'); [IO.File]::WriteAllText($p,$c,[Text.Encoding]::UTF8)"
for %%F in (*.ezpx) do powershell -NoProfile -ExecutionPolicy Bypass -Command "$csv=$env:GOLABEL_CSV; $esc=$csv.Replace('$','$$'); $p='%%~fF'; $c=[IO.File]::ReadAllText($p); $c=[regex]::Replace($c,'<DataBaseFilePath>.*?</DataBaseFilePath>|<DataBaseFilePath\s*/>','<DataBaseFilePath>'+$esc+'</DataBaseFilePath>'); [IO.File]::WriteAllText($p,$c,[Text.Encoding]::UTF8)"
echo Database path set to: %~dp0data.csv for all label files

rem ---------- 4. Rename .ezpx.tmp -> .ezpx (if any), then open the main label ----------
for /f "delims=" %%F in ('dir /b /a-d *.ezpx.tmp 2^>nul') do ren "%%~F" "%%~nF"
if exist *.ezpx.tmp echo Renamed .ezpx.tmp files to .ezpx

set "MAIN="
for /f "delims=" %%F in ('dir /b /a-d *_main_label.ezpx 2^>nul') do if not defined MAIN set "MAIN=%%~fF"
if defined MAIN goto open_main
for /f "delims=" %%F in ('dir /b /a-d *.ezpx 2^>nul') do if not defined MAIN set "MAIN=%%~fF"
if defined MAIN goto open_main
echo No .ezpx file found in: %cd%
pause
exit /b 1

:open_main
echo Opening main label: %MAIN%
start "" "%GOLABEL%" "%MAIN%"

:done
echo.
echo Done. If GoLabel asks for the database file the first time,
echo choose data.csv in this folder - it will be remembered after that.
endlocal
