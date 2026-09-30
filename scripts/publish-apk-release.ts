import fs from 'fs';
import path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN || '';
const OWNER = 'djsushilkumar';
const REPO = 'fieldops-saas';
const TAG = 'v1.0.0-testing';
const APK_PATH = path.resolve('/workspace/clever-darwin/apps/mobile/build/app/outputs/flutter-apk/app-debug.apk');

async function main() {
  if (!fs.existsSync(APK_PATH)) {
    console.error(`APK not found at ${APK_PATH}`);
    process.exit(1);
  }

  const stat = fs.statSync(APK_PATH);
  console.log(`Uploading APK: ${APK_PATH} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);

  // 1. Create or get existing release for this tag
  console.log(`Checking/Creating release for tag ${TAG}...`);
  let releaseId: number | null = null;
  let uploadUrl = '';

  const getReleaseRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (getReleaseRes.ok) {
    const existing = await getReleaseRes.json();
    releaseId = existing.id;
    uploadUrl = existing.upload_url;
    console.log(`Found existing release ID: ${releaseId}`);
  } else {
    const createRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tag_name: TAG,
        name: 'FieldOps Android Mobile Testing Build v1.0.0',
        body: `## 📱 FieldOps Mobile Testing APK (Android)

### Included Features:
- **TaskOPad Engine**: Interactive checklist completion, high-priority tasks, offline task queue.
- **Unolo Visits & GPS Engine**: Haversine distance geofence verification, "Navigate with Google Maps", Anti-spoofing fake GPS detection.
- **Attendance & Shifts**: Duty timer, point-in-time GPS clock-in / clock-out.
- **Proof of Work**: Photo capture with timestamp & coordinate watermark, touch signature canvas, field notes.
- **Offline Durability**: Local SQLite caching with idempotency-keyed replay engine.

### How to Install:
1. Download **fieldops-mobile-debug.apk** directly to your Android device.
2. Tap the downloaded file and select **Install** (allow *Install unknown apps* if prompted).
3. Open **FieldOps** and log in with your credentials or register a new workspace.
`,
        draft: false,
        prerelease: true,
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create release (${createRes.status}): ${errText}`);
    }

    const created = await createRes.json();
    releaseId = created.id;
    uploadUrl = created.upload_url;
    console.log(`Created new release ID: ${releaseId}`);
  }

  // 2. Upload asset
  // upload_url is in format: https://uploads.github.com/repos/owner/repo/releases/id/assets{?name,label}
  const cleanUploadUrl = uploadUrl.replace(/\{.*?\}/, '') + '?name=fieldops-mobile-debug.apk';
  console.log(`Uploading asset to: ${cleanUploadUrl}...`);

  const fileBuffer = fs.readFileSync(APK_PATH);

  const uploadRes = await fetch(cleanUploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': String(stat.size),
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    // If asset already exists, delete it first and re-upload
    if (errText.includes('already_exists')) {
      console.log('Asset already exists, fetching assets to delete old one...');
      const listAssetsRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/${releaseId}/assets`, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
      });
      const assets = await listAssetsRes.json();
      const match = assets.find((a: any) => a.name === 'fieldops-mobile-debug.apk');
      if (match) {
        console.log(`Deleting existing asset ID ${match.id}...`);
        await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${match.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
        });
        console.log('Re-uploading freshly compiled APK...');
        const retryRes = await fetch(cleanUploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Length': String(stat.size),
          },
          body: fileBuffer,
        });
        if (!retryRes.ok) {
          throw new Error(`Retry upload failed: ${await retryRes.text()}`);
        }
        const uploadedData = await retryRes.json();
        console.log('✅ Asset uploaded successfully!');
        console.log(`📥 Download URL: ${uploadedData.browser_download_url}`);
        return;
      }
    }
    throw new Error(`Asset upload failed (${uploadRes.status}): ${errText}`);
  }

  const uploadedData = await uploadRes.json();
  console.log('✅ Asset uploaded successfully!');
  console.log(`📥 Download URL: ${uploadedData.browser_download_url}`);
}

main().catch((err) => {
  console.error('Release script error:', err);
  process.exit(1);
});
