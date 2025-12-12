# Creating ICO File for Icons

To get the icons working properly (both system tray and exe icon), you need to convert `SMSLogo.png` to `SMSLogo.ico`.

## Quick Method: Online Converter

1. Go to https://convertio.co/png-ico/ or https://www.icoconverter.com/
2. Upload `SMSLogo.png`
3. Download the converted `SMSLogo.ico`
4. Place it in the same directory as `main.go`
5. Run `build.bat` again

## Method 2: Using ImageMagick (if installed)

```bash
magick convert SMSLogo.png -define icon:auto-resize=256,128,64,48,32,16 SMSLogo.ico
```

## Method 3: Using PowerShell (Windows)

```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("SMSLogo.png")
$ico = New-Object System.Drawing.Icon
# Note: PowerShell method is complex, online converter is easier
```

## After Creating ICO

Once you have `SMSLogo.ico`:
1. Place it in the `SmsCat` directory (same as `main.go`)
2. Run `build.bat` - it will automatically use the ICO file
3. The system tray icon will use the ICO (better compatibility)
4. The exe icon will be embedded via `resource.syso`

**Note:** The app will work with just PNG, but ICO format provides better compatibility on Windows.

