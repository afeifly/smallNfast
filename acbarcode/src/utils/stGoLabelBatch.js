/**
 * Windows batch helper bundled into the exported ZIP package.
 *
 * Workflow after extracting the package (label.ezpx + data.csv + this .bat):
 *   1. Find where GoLabel.exe is installed on this Windows machine.
 *   2. Rewrite <DataBaseFilePath> inside the .ezpx to the absolute path
 *      of the data.csv in the current folder (GoLabel cannot use a
 *      relative path here).
 *   3. Launch GoLabel with the .ezpx open.
 *
 * Written WITHOUT parenthesized if-blocks on purpose: "%ProgramFiles(x86)%"
 * contains parentheses that break cmd block parsing. Uses single-line ifs
 * and goto labels instead.
 *
 * On the first run GoLabel may ask to confirm the CSV file; after that it
 * saves a schema.ini next to data.csv and auto-connects on later runs.
 */
export const PRINT_LABELS_BAT = `@echo off
setlocal EnableExtensions
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

rem remembered path from a previous run
if exist "%~dp0golabel_path.txt" for /f "usebackq delims=" %%L in ("%~dp0golabel_path.txt") do set "GOLABEL=%%L"
if defined GOLABEL goto verify

rem common install locations
if exist "%PF%\\GoLabel\\GoLabel.exe" set "GOLABEL=%PF%\\GoLabel\\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF86%\\GoLabel\\GoLabel.exe" set "GOLABEL=%PF86%\\GoLabel\\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF%\\GoLabel\\GoLabel\\GoLabel.exe" set "GOLABEL=%PF%\\GoLabel\\GoLabel\\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF86%\\GoLabel\\GoLabel\\GoLabel.exe" set "GOLABEL=%PF86%\\GoLabel\\GoLabel\\GoLabel.exe"
if defined GOLABEL goto verify
if exist "C:\\GoLabel\\GoLabel.exe" set "GOLABEL=C:\\GoLabel\\GoLabel.exe"
if defined GOLABEL goto verify
if exist "C:\\GoLabel\\GoLabel\\GoLabel.exe" set "GOLABEL=C:\\GoLabel\\GoLabel\\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%LOCALAPPDATA%\\GoLabel\\GoLabel.exe" set "GOLABEL=%LOCALAPPDATA%\\GoLabel\\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF%\\GoDEX\\GoLabel\\GoLabel.exe" set "GOLABEL=%PF%\\GoDEX\\GoLabel\\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF86%\\GoDEX\\GoLabel\\GoLabel.exe" set "GOLABEL=%PF86%\\GoDEX\\GoLabel\\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF%\\GoDEX\\GoLabel II\\GoLabel.exe" set "GOLABEL=%PF%\\GoDEX\\GoLabel II\\GoLabel.exe"
if defined GOLABEL goto verify
if exist "%PF86%\\GoDEX\\GoLabel II\\GoLabel.exe" set "GOLABEL=%PF86%\\GoDEX\\GoLabel II\\GoLabel.exe"
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
if exist "%GOLABEL%" goto saveit
echo.
echo GoLabel.exe not found at: %GOLABEL%
pause
exit /b 1

:saveit
echo %GOLABEL%>"%~dp0golabel_path.txt"
echo GoLabel: %GOLABEL%

rem ---------- 2. Find .ezpx and data.csv in this folder ----------
set "EZPX="
if exist "%~dp0label.ezpx" set "EZPX=%~dp0label.ezpx"
if not defined EZPX for %%F in (*.ezpx) do if not defined EZPX set "EZPX=%%~fF"
if defined EZPX goto have_ezpx
echo No .ezpx file found in: %cd%
pause
exit /b 1

:have_ezpx
if exist "%~dp0data.csv" goto have_csv
echo data.csv not found in: %cd%
pause
exit /b 1

:have_csv
echo Label : %EZPX%
echo CSV   : %~dp0data.csv

rem ---------- 3. Rewrite DataBaseFilePath for EVERY .ezpx & ensure schema.ini ----------
set "GOLABEL_CSV=%~dp0data.csv"
set "GOLABEL_SCHEMA=%~dp0schema.ini"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$sf=$env:GOLABEL_SCHEMA; if (-not (Test-Path $sf)) { Set-Content -LiteralPath $sf -Value @('[data.csv]','ColNameHeader=True','Format=Delimited(,)','CharacterSet=1252',('Col1='+[char]34+'sn'+[char]34+' Text'),('Col2='+[char]34+'qr_code'+[char]34+' Text')) -Encoding ASCII }"
for %%F in (*.ezpx) do powershell -NoProfile -ExecutionPolicy Bypass -Command "$csv=$env:GOLABEL_CSV; $esc=$csv.Replace('$','$$'); $p='%%~fF'; $c=[IO.File]::ReadAllText($p); $c=[regex]::Replace($c,'<DataBaseFilePath>.*?</DataBaseFilePath>|<DataBaseFilePath\\s*/>','<DataBaseFilePath>'+$esc+'</DataBaseFilePath>'); [IO.File]::WriteAllText($p,$c,[Text.Encoding]::UTF8)"
echo Database path set to: %~dp0data.csv for all .ezpx files
echo schema.ini ready (created if missing)

rem ---------- 4. Launch GoLabel ----------
echo.
echo Starting GoLabel...
start "" "%GOLABEL%" "%EZPX%"
echo.
echo Done. If GoLabel asks for the database file the first time,
echo choose data.csv in this folder - it will be remembered after that.
endlocal
`;
