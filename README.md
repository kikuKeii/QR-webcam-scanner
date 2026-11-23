# Webcam Keyboard Scanner

A Windows Electron application that scans QR codes and barcodes locally with a webcam and sends the decoded text to the **currently focused Windows application** using the Windows `SendInput` keyboard API. It does not use the clipboard for wedge input and does not upload frames or history.

## Requirements and development

- Windows 10/11, a working webcam, and permission to use the camera.
- Node.js 24 or newer and npm.
- Windows PowerShell 5.1 (included with Windows) for the local keyboard helper.

In a terminal in this directory:

```powershell
npm ci
npm start
```

The Electron runtime is downloaded during installation. Use `npm test` for the local automated tests. The UI may run on other platforms for development, but keyboard output is implemented for Windows only.

## Using the scanner

1. Choose a camera and resolution, set the suffix to **Enter**, **Tab**, or **None**, and click **Start scanner**. The resolution is a preference; the camera may negotiate a different size.
2. Switch to Notepad, a Chrome/Laravel form, Excel, or another application and place the caret in the target field. Show a code to the camera. The value is typed at the current focus, followed by the chosen suffix. Switching focus while input is being sent can change its destination.
3. Use **Stop scanner** when finished. Camera and resolution changes restart the camera while scanning. The preview, last scan, and recent history are shown in the window.
4. Minimize or close the window to hide it in the tray. Use the tray menu to start/stop, reopen, or **Exit**. When “Continue scanning in the tray” is off, hiding the window stops scanning. “Start with Windows” applies to the packaged application.

The scanner supports QR Code, Code 128, Code 39, EAN-13, EAN-8, UPC-A, UPC-E, ITF, Codabar, PDF417 and Data Matrix using ZXing. UPC-A may be reported as EAN-13 with a leading zero. Recognition depends on camera focus, lighting, code size and image quality.

Duplicate prevention suppresses the same visible value and format until the cooldown expires. A code can also be scanned again after it has disappeared for at least one second (or three scan intervals, whichever is longer). Disable prevention to scan repeatedly at the configured interval. Increase the scan interval to reduce CPU usage.

History and settings are stored in Electron's user-data directory (normally `%APPDATA%\qr-webcam-scanner`), with at most 500 recent entries. Only scans successfully sent to the keyboard are recorded. Copy buttons are explicit user actions. CSV export uses a save dialog; potentially spreadsheet-formula-like values are prefixed with an apostrophe in the exported file.

## Portable Windows build

After verifying the development application on Windows, run:

```powershell
npm ci
npm run build:win
```

The portable executable is written to `dist/`. The build is unsigned; Windows SmartScreen may warn about it. The PowerShell helper is unpacked alongside the app inside the portable executable's extracted resources. A Windows build and the manual tests below have not been verified in this Linux development environment; no prebuilt executable is included.

## Windows verification checklist

- Scan a QR code and a linear barcode into Notepad, then into a Laravel form in Chrome.
- Check Enter, Tab and None suffixes and Unicode text.
- Verify duplicate suppression, cooldown expiry, disappearance/reappearance, and disabled duplicate prevention.
- Switch cameras and resolutions, unplug the active camera, and verify errors and cleanup.
- Minimize to the tray with background scanning enabled and disabled; start and stop from the tray, then exit.
- Stop during scanning and verify the camera indicator turns off and no helper process remains.

## Troubleshooting

- **No camera / permission denied:** Enable camera access for desktop apps in Windows privacy settings, close other camera apps, and check the device connection. Restart the scanner after changing permissions.
- **Nothing is typed:** Select the target input field *after* starting the scanner. Windows blocks input injection into elevated applications from a non-elevated process (UIPI); run both applications at the same privilege level. Some protected applications may reject simulated input.
- **Keyboard error:** Ensure Windows PowerShell 5.1 is present and not blocked by organizational policy or endpoint security software. The scanner stops on output errors to avoid repeated unintended input.
- **Poor recognition:** Improve lighting and focus, hold the code steady and fully in view, try another resolution, or increase the scan interval.
- **Camera remains active:** Stop the scanner or choose Exit from the tray; closing the window alone hides it. If background scanning is enabled, hiding deliberately keeps the camera running.
