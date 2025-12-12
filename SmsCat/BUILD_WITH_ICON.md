# Building SMSCat with Icon

To build SMSCat.exe with a custom icon, you need to embed the icon as a Windows resource.

## Method 1: Using rsrc (Recommended)

1. **Install rsrc tool:**
   ```bash
   go install github.com/akavel/rsrc@latest
   ```

2. **Convert PNG to ICO (if needed):**
   - Use an online converter or tool like ImageMagick
   - Or use: `magick convert SMSLogo.png -define icon:auto-resize=256,128,64,48,32,16 SMSLogo.ico`

3. **Generate resource file:**
   ```bash
   rsrc -ico SMSLogo.ico -o resource.syso
   ```

4. **Build the application:**
   ```bash
   go build -tags desktop,production -ldflags "-s -w -H windowsgui" -o SMSCat.exe
   ```

   The `resource.syso` file will be automatically included in the build.

## Method 2: Using windres (Alternative)

If you have MinGW installed:

1. **Convert PNG to ICO** (same as above)

2. **Create a resource file** (`app.rc`):
   ```
   1 ICON "SMSLogo.ico"
   ```

3. **Compile resource:**
   ```bash
   windres -o resource.syso app.rc
   ```

4. **Build:**
   ```bash
   go build -tags desktop,production -ldflags "-s -w -H windowsgui" -o SMSCat.exe
   ```

## Notes

- The system tray icon is already set from the embedded PNG
- The exe icon requires the `.syso` resource file
- Make sure `resource.syso` is in the same directory as `main.go` when building

