# CD Valet App Privacy Answers

Use these answers in App Store Connect App Privacy for the MVP build.

## Tracking
- Does this app use data for tracking? No.
- Uses IDFA? No.
- Third-party advertising SDKs? No.

## Data Collection Summary
- Local library data, manual notes, and optional local profile email are stored on device.
- Camera access is used only to scan CD UPC barcodes.
- Scanned UPC/barcode values may be sent to MusicBrainz to retrieve public album metadata.
- CD Valet does not maintain a TixPy cloud account or hosted library database for the MVP.

## App Privacy Data Types
- User Content / Other User Content: Yes, only for UPC/barcode lookup requests sent to MusicBrainz.
  - Purpose: App Functionality.
  - Linked to user: No.
  - Used for tracking: No.
- Contact Info / Email Address: No, for App Privacy nutrition label purposes, because the optional profile email is stored locally on device and is not collected by TixPy.
- Diagnostics: No, for App Privacy nutrition label purposes, because no analytics or crash-reporting SDK is configured to collect diagnostics from users.
- Location: No.
- Contacts: No.
- Browsing History: No.
- Search History: No.
- Identifiers: No.
- Purchases: No.
- Financial Info: No.
- Health and Fitness: No.
- Sensitive Info: No.

## Privacy URLs
- Privacy Policy URL: https://tompinataro.github.io/CD-Valet/privacy/
- Support URL: https://tompinataro.github.io/CD-Valet/support/
- User Privacy Choices URL: leave blank unless ASC requires it; support/data deletion steps are on the Support URL.

Before submitting, verify the two public URLs above are live and reachable without login.
