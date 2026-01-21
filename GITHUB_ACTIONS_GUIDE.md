# GitHub Actions APK Build - Setup Guide

This guide explains how to build your Android APK using GitHub Actions without needing Android Studio installed locally.

## What's Included

Two GitHub Actions workflows have been created:

### 1. Debug Build Workflow
**File**: `.github/workflows/build-android.yml`

**Triggers**:
- Every push to `main` or `master` branch
- Every pull request
- Manual trigger via GitHub UI

**Output**: Debug APK (unsigned, for testing)

### 2. Release Build Workflow
**File**: `.github/workflows/build-release.yml`

**Triggers**:
- When you create a GitHub release
- Manual trigger via GitHub UI

**Output**: Signed release APK (for distribution)

## How to Use

### First Time Setup

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Add Capacitor and GitHub Actions"
   git push origin main
   ```

2. **Wait for the build**:
   - Go to your repository on GitHub
   - Click the "Actions" tab
   - You'll see the workflow running
   - Wait for it to complete (green checkmark)

### Download Your APK

1. Click on the completed workflow run
2. Scroll down to the "Artifacts" section
3. Click on `smart-school-bell-debug` to download
4. Extract the ZIP file to get your APK
5. Transfer the APK to your Android device
6. Install it (you may need to enable "Install from unknown sources")

### Manual Build Trigger

If you want to build without pushing code:

1. Go to "Actions" tab on GitHub
2. Click "Build Android APK" in the left sidebar
3. Click "Run workflow" button (top right)
4. Select the branch
5. Click the green "Run workflow" button
6. Wait for completion and download from artifacts

## Building Release APKs (Optional)

For production-ready, signed APKs:

### Prerequisites

You need to create a signing key first. Run this locally:

```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Follow the prompts to set passwords and details.

### Add Secrets to GitHub

1. Go to your repository settings
2. Click "Secrets and variables" → "Actions"
3. Add these secrets:
   - `SIGNING_KEY`: Base64 encoded keystore file
     ```bash
     base64 my-release-key.keystore | tr -d '\n' | pbcopy
     ```
   - `ALIAS`: Your key alias (e.g., `my-key-alias`)
   - `KEY_STORE_PASSWORD`: Keystore password
   - `KEY_PASSWORD`: Key password

### Create a Release

1. Go to your repository on GitHub
2. Click "Releases" → "Create a new release"
3. Create a new tag (e.g., `v1.0.0`)
4. Fill in release details
5. Click "Publish release"
6. The workflow will automatically build and attach the signed APK

## Workflow Details

### What the Workflow Does

1. ✅ Checks out your code
2. ✅ Sets up Node.js 20
3. ✅ Sets up Java 17
4. ✅ Installs npm dependencies
5. ✅ Builds the web application
6. ✅ Syncs Capacitor to Android
7. ✅ Builds the Android APK using Gradle
8. ✅ Uploads the APK as an artifact

### Build Time

- **First build**: 5-10 minutes (downloading dependencies)
- **Subsequent builds**: 2-5 minutes (using cache)

### Artifact Retention

- **Debug builds**: 30 days
- **Release builds**: 90 days

## Troubleshooting

### Build Fails

1. Check the workflow logs in the Actions tab
2. Common issues:
   - Node/npm version mismatch
   - Missing dependencies
   - Gradle build errors

### Can't Download Artifact

- Make sure you're logged into GitHub
- Artifacts are only available for 30 days
- You need read access to the repository

### APK Won't Install

- Enable "Install from unknown sources" on Android
- Make sure you're using a debug build for testing
- For release builds, ensure proper signing

## Next Steps

1. **Test the APK**: Install on your Android device and test all features
2. **Iterate**: Make changes, push to GitHub, download new APK
3. **Release**: When ready, create a GitHub release for a signed APK
4. **Distribute**: Share the APK or publish to Google Play Store

## Benefits of GitHub Actions

✅ No need for Android Studio locally  
✅ Consistent build environment  
✅ Automatic builds on every commit  
✅ Easy to share APKs with testers  
✅ Free for public repositories  
✅ Build history and artifacts stored on GitHub
