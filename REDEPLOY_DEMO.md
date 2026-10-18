# Update the deployed demo on GCP

This update fixes the Simulate page, bundles the loading GIF and pet audio, removes the login screen through automatic Firebase guest sessions, adds a catalogue-grounded pet chatbot, adds Gemini pet reactions, and connects sounds to visible care alerts.

Your existing Cloud Run URL stays the same. Run the following blocks in order in **one PowerShell window**. Stop if a command fails. This guide updates an existing deployment; do not repeat the foundation setup or set `deploy_services` to false.

## 1. Open the edited source

```powershell
Set-Location "C:\Users\chunh\Documents\Codex\2026-10-17\github-plugin-github-openai-curated-remote\outputs\purrfect-ai-home"
$projectId = "project-e9bc8734-bb74-44f5-845"
```

Use the same deployment identity as the successful Terraform apply. If you switched ADC to a runtime service account, restore your user ADC:

```powershell
gcloud auth application-default login
gcloud auth application-default set-quota-project $projectId
```

Do not create a JSON service-account key. No new Gemini key is needed.

## 2. Build a new image

```powershell
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
```

Wait for SUCCESS. Docker bundles the actual MP3/GIF files; it no longer relies on Lovable asset URLs. The source upload excludes your local .env, credentials, and Terraform state.

## 3. Save the new image reference

```powershell
$digest = gcloud artifacts docker images describe $image "--format=value(image_summary.digest)" "--project=$projectId"
if ($LASTEXITCODE -ne 0 -or $digest -notmatch '^sha256:[a-f0-9]{64}$') { throw "Could not resolve the new image digest" }
$immutableImage = "${imageRepo}@$digest"
$immutableImage
notepad .\infra\terraform.tfvars
```

Keep the old image digest separately for rollback. In the file, update the existing values (do not duplicate them):

```hcl
deploy_services = true
image = "PASTE_THE_FULL_NEW_IMAGE_REFERENCE"
```

Keep your project ID, region, Gemini model, and authorized domains. Your app hostname should remain in the list:

```hcl
authorized_domains = ["localhost", "purrfect-home-odp7sbqzwa-as.a.run.app"]
```

Terraform now enables Firebase anonymous sign-in and sets `DEMO_GUEST_ACCESS=true` on the web service. Both are required: deploying only the new image will not enable guest sessions.

## 4. Review and apply the update

```powershell
terraform "-chdir=infra" fmt
terraform "-chdir=infra" validate
terraform "-chdir=infra" plan "-out=demo-update.tfplan"
```

Expect updates to the web/worker image, web environment and Firebase anonymous sign-in setting. Do not proceed if the plan proposes unexpected database or bucket deletion. Apply this fresh plan:

```powershell
terraform "-chdir=infra" apply "demo-update.tfplan"
$serviceUrl = terraform "-chdir=infra" output -raw service_url
Start-Process $serviceUrl
```

## 5. Check the demo

1. Open the URL in a private browser window: the app opens automatically with no login form. A brief “Opening your demo” message is normal. Each browser gets its own anonymous Firebase UID; no shared demo account is used. Existing signed-in sessions remain usable.
2. Open **Simulate**, choose **Start a new trial**, then **Start Trial**. The page should render without a React snapshot loop. Create a new trial for rules version 1.1.0; old trials preserve their previous feeding model.
3. Tap **Enable sound** (browsers require a gesture). Tap the pet to hear the bundled recording. Sound remains optional.
4. Tap **Try pet alert**: a visible hunger/attention card and popup appear. Use **Feed now** or **Give attention**. Natural hunger alerts appear when hunger exceeds 65; idle calls depend on personality (45–120 seconds), with a 45-second reminder cooldown. Alerts work with sound muted and without browser notification permission. OS notifications remain optional while the app is open; this does not add background FCM push.
5. Feed and play, then check **[Pet]'s reaction**. Gemini uses the pinned personality, current state and actual care history. The label explicitly distinguishes Gemini from scripted fallback. New trials no longer get automatic meals merely from owning a bowl.
6. Open **Today's moment**, choose an action, confirm/end the day. Repeat through seven days and check the report. Model failures never block a care action or change the authoritative scores.
7. Tap **Ask Mimi** and try “Compare Oyen and Luna”, “Recommend a calm dog”, and a follow-up. Replies include links to retrieved catalogue records. Gemini gets only those records and the current household; unknown health/compatibility facts remain unknown. The existing Profile flow saves household changes; the new chat does not silently overwrite them.
8. Refresh: trial progress remains in this browser's guest session. A second private browser session should have separate data. Clearing browser storage loses access to the old guest UID.

## AI scope and troubleshooting

This is retrieval-augmented chat over the six bundled synthetic pet records, with lexical retrieval, saved household criteria and up to six conversation turns. It is not connected to a live shelter feed or a managed vector database. The citations come from server-selected records.

Gemini supplies narrative reactions and suggestions; the TypeScript engine still calculates hunger/stress/trust, records care actions and advances days. This hybrid design makes owner actions meaningful while keeping reports consistent. Generating animation frames or replacing the entire simulation with an unvalidated model is outside this update.

Your configured `gemini-3.8-flash` ID is documented by Google, but project access and quota must still be available. AI calls share the existing per-user daily limit (40), including onboarding, chat, reactions and final narration. Guest users can create new sessions; this is a demo limit, not project-wide abuse prevention. Check Vertex project quotas before making the demo widely public.

If you see **Catalogue fallback** or **Scripted reaction**, inspect sanitized service logs:

```powershell
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="purrfect-home" AND ("ai_fallback" OR "report_narration_fallback")' "--project=$projectId" "--limit=20"
```

Confirm `AI_PROVIDER=vertex`, the model ID, project Vertex access, and the runtime service account's Vertex role. The UI intentionally remains usable when the model times out or its quota is exhausted. No live billable Gemini call is implied by local tests.

For rollback, restore the previous image digest in .tfvars, generate another plan and apply. If returning to the old login-required image, also revert the guest-auth configuration deliberately.

References: [Firebase anonymous authentication](https://firebase.google.com/docs/auth/web/anonymous-auth), [Gemini 3.8 Flash](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash). Audio attribution and CC BY-SA licences are available in Profile and `public/audio-credits.txt`.
