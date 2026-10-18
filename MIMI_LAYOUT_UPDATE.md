# Deploy the Ask Mimi layout fix to GCP

Ask Mimi now stays inside the centered 440 px application frame, above the bottom navigation. Its chat panel and backdrop also stay inside the frame. On smaller screens, they adapt to the available width.

No new GCP service, IAM permission or secret is needed. Build and deploy a new image; applying Terraform with the old image does not update its files.

## 1. Build the updated source

Use one PowerShell window and your deployment identity. Stop if a command fails.

~~~powershell
Set-Location "C:/Users/chunh/Documents/Codex/2026-10-17/github-plugin-github-openai-curated-remote/outputs/purrfect-ai-home"
$projectId = "project-e9bc8734-bb74-44f5-845"

$browser = terraform "-chdir=infra" output -json browser_config | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Could not read Firebase settings" }
$imageRepo = terraform "-chdir=infra" output -raw image_repository
if ($LASTEXITCODE -ne 0) { throw "Could not read image repository" }
$builder = terraform "-chdir=infra" output -raw build_service_account
if ($LASTEXITCODE -ne 0) { throw "Could not read build identity" }
$sourceBucket = terraform "-chdir=infra" output -raw build_source_bucket
if ($LASTEXITCODE -ne 0) { throw "Could not read source bucket" }

$tag = Get-Date -Format "yyyyMMdd-HHmmss"
$image = "${imageRepo}:$tag"
$substitutions = "_IMAGE=$image,_FIREBASE_API_KEY=$($browser.VITE_FIREBASE_API_KEY),_FIREBASE_AUTH_DOMAIN=$($browser.VITE_FIREBASE_AUTH_DOMAIN),_FIREBASE_APP_ID=$($browser.VITE_FIREBASE_APP_ID)"

gcloud builds submit . "--config=cloudbuild.yaml" "--project=$projectId" "--service-account=projects/$projectId/serviceAccounts/$builder" "--gcs-source-staging-dir=gs://$sourceBucket/source" "--substitutions=$substitutions"
if ($LASTEXITCODE -ne 0) { throw "Build failed; do not deploy" }
~~~

Wait for SUCCESS.

## 2. Save the new image reference

~~~powershell
$digest = gcloud artifacts docker images describe $image "--format=value(image_summary.digest)" "--project=$projectId"
if ($LASTEXITCODE -ne 0 -or $digest -notmatch '^sha256:[a-f0-9]{64}$') { throw "Invalid image digest" }
$immutableImage = "${imageRepo}@$digest"
$immutableImage
notepad ./infra/terraform.tfvars
~~~

Replace the existing image value with the full reference printed above. Keep deploy_services = true, your existing authorised domains, and other settings. Save the previous image digest if you need rollback.

## 3. Review and deploy

~~~powershell
terraform "-chdir=infra" validate
terraform "-chdir=infra" plan "-out=mimi-layout.tfplan"
~~~

Review the plan, then:

~~~powershell
terraform "-chdir=infra" apply "mimi-layout.tfplan"
$serviceUrl = terraform "-chdir=infra" output -raw service_url
Start-Process $serviceUrl
~~~

This builds all current local source changes, including any earlier demo fixes you have not yet deployed. On an otherwise up-to-date deployment, expect new web/worker image revisions, not database replacement.

## 4. Verify the layout

Open the deployed app and hard-refresh with Ctrl+F5. On a wide desktop window, Ask Mimi should sit inside the right edge of the centered application, above its bottom navigation. Open the chat: the panel and shaded backdrop should stay inside the same frame. Close it with the X or Escape.

Repeat with a narrow mobile window. Check that the button remains visible, the chat fits without horizontal overflow, and the bottom navigation remains usable after closing the chat. Avoid clearing site storage: that would lose access to the browser's anonymous demo session.

This is a frontend layout change. No new environment variables or secrets are required. The source has been edited locally; run the steps above to update GCP.
