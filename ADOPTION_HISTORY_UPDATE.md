# Deploy the sample Adoption History to GCP

Adoption History now includes a clearly labelled fictional Oyen record, dated 18 October 2026, with an expandable compatibility status report and seven-day sample timeline. It is displayed for both existing and new users without writing fabricated trials to Firestore.

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
terraform "-chdir=infra" plan "-out=sample-history.tfplan"
~~~

Review the plan, then:

~~~powershell
terraform "-chdir=infra" apply "sample-history.tfplan"
$serviceUrl = terraform "-chdir=infra" output -raw service_url
Start-Process $serviceUrl
~~~

This builds all current local source changes, including any earlier demo fixes you have not yet deployed. On an otherwise up-to-date deployment, expect new web/worker image revisions, not database replacement.

## 4. Verify Adoption History

1. Open the deployed app and press Ctrl+F5.
2. Select History, then Completed. Find the Fictional sample card for Oyen below your own trials.
3. Select View sample compatibility report. Check the four readiness areas, example household, strengths, concerns, next steps and seven-day timeline.
4. Collapse the report, then switch to In Progress. The sample should not appear as an active trial. Existing saved trials remain unchanged.
5. Check the same page on a narrow mobile screen.

This presentation-only sample requires no Firestore migration, new environment variables, secrets or IAM permissions. Dates and findings are fixed illustrative content, not a live assessment of the current user. Build a new image even if Terraform reports no changes with the old image reference.

The change has been made locally, not deployed automatically.
