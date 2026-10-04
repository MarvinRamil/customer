# Google Cloud Storage (GCS) Setup for Build Artifacts

This guide explains how to upload AAB and APK build artifacts to Google Cloud Storage, bypassing GitLab's artifact size limit.

## 1. Create a GCS Bucket

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Navigate to **Cloud Storage** → **Buckets**
4. Click **Create bucket**
5. Configure:
   - **Name:** e.g. `bee-customer-builds`
   - **Location:** Choose a region (e.g. `us-central1`)
   - **Storage class:** Standard
   - **Access control:** Uniform (recommended)
6. Click **Create**

## 2. Create a Service Account

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. **Name:** e.g. `gitlab-ci-uploads`
4. Click **Create and Continue**
5. **Grant access:** Add role **Storage Object Admin** (or **Storage Object Creator** for write-only)
6. Click **Done**
7. Click the service account → **Keys** tab
8. **Add Key** → **Create new key** → **JSON**
9. Download the JSON file and keep it secure

## 3. Set GitLab CI/CD Variables

In GitLab: **Settings** → **CI/CD** → **Variables** → **Add variable**

| Key | Value | Protected | Masked |
|-----|-------|-----------|--------|
| `GCS_BUCKET` | Your bucket name (e.g. `bee-customer-builds`) | No | No |
| `GCS_GCP_SERVICE_ACCOUNT_KEY` | Contents of the JSON key file | Yes | Yes |

For `GCS_GCP_SERVICE_ACCOUNT_KEY`: paste the entire JSON content (one line or pretty-printed).

## 4. Install Google Cloud SDK on Runner

The upload step uses `gsutil`. Install on your GitLab runner (shell executor):

**Ubuntu/Debian:**
```bash
# Add Google Cloud SDK repo
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
sudo apt-get update
sudo apt-get install -y google-cloud-sdk
```

**Or use the install script:**
```bash
curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz
tar -xf google-cloud-cli-linux-x86_64.tar.gz
sudo ./google-cloud-sdk/install.sh --quiet --path-update true
```

## 5. Upload Path Structure

Artifacts are uploaded to:
```
gs://<bucket>/bee-customer/<branch>/<filename>
```

Examples:
- `gs://bee-customer-builds/bee-customer/features/app-release-test_v1.0.1_build42.apk`
- `gs://bee-customer-builds/bee-customer/features/app-release-test_v1.0.1_build42.aab`
- `gs://bee-customer-builds/bee-customer/main/app-release-v1.0.1_build42.aab`

## 6. Download from GCS

**Using gsutil:**
```bash
gsutil cp gs://bee-customer-builds/bee-customer/features/app-release-test_v1.0.1_build42.apk .
```

**Using Cloud Console:** Browse to the bucket → navigate to the path → download.

## 7. Optional: Make Bucket Private

By default the bucket may be publicly readable. To restrict access:

1. Bucket → **Permissions** → ensure only your service account (and team) have access
2. Remove "AllUsers" / "Public" if present
3. Use signed URLs for temporary download links if needed

## Troubleshooting

- **"gsutil: command not found"** – Install Google Cloud SDK on the runner (see step 4)
- **"AccessDeniedException"** – Check service account has Storage Object Creator/Admin role
- **"Bucket not found"** – Verify `GCS_BUCKET` variable matches the bucket name exactly
- **Upload skipped** – Upload only runs when both `GCS_BUCKET` and `GCS_GCP_SERVICE_ACCOUNT_KEY` are set
