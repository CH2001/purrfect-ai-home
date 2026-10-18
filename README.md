# Purrfect Home

**An AI-assisted pet-adoption preparation app that lets people rehearse life with a rescue cat or dog before making a commitment.**

## Brief description of the solution

### Why: turn adoption interest into practical preparation

Choosing a pet involves more than liking a photo. Prospective adopters need to consider daily care, time away from home, noise, available space and introductions to resident pets. Purrfect Home turns those considerations into an interactive experience: describe your household, explore pet profiles, ask Mimi questions, and complete a seven-day virtual home trial.

During the trial, feeding, play, observation and retreat choices affect simulated state. Hunger and attention alerts invite users to respond. Gemini adds personality-based reactions and explains the resulting readiness report, helping users identify care gaps and questions to discuss with a rescuer.

### Market size and needs

**Purrfect Home targets a valuable moment in the pet-care journey: helping an interested adopter become a prepared owner.** First-time adopters need to understand the commitment, households with existing pets need an introduction plan, and shelters need practical ways to prepare applicants. Our opportunity is to bring these needs together through personalised guidance and a seven-day virtual care experience, starting with Malaysian rescue partners.

Evidence from ASEAN and the wider Japan and Asia-Pacific (JAPAC) region gives us three reasons to pursue this opportunity:

- **A growing local pet-care economy.** Malaysia's pet-food market reached approximately **US$448.6 million in 2025**, with **7.9% compound annual growth over 2021–2025**, according to Agriculture and Agri-Food Canada, citing Euromonitor International. This shows sustained spending on everyday care. For Purrfect Home, it makes Malaysia a relevant starting market for helping prospective owners understand the routines and resources behind that commitment. [Source: AAFC, *Pet food trends in Malaysia*, 2026 / Euromonitor](https://agriculture.canada.ca/en/international-trade/reports-and-guides/sector-trend-analysis-pet-food-trends-malaysia).
- **A substantial household audience across JAPAC.** Australia's 2025 national pet survey estimates that **7.7 million households—73% of all households—own a pet**, up from 69% in 2022. It also reports that **12% of pet owners needed financial assistance for veterinary care**. Together, these findings show how widespread pet ownership can become while highlighting the importance of realistic preparation. Our expansion hypothesis is that household-specific planning can serve both new adopters and existing owners considering another pet. [Source: Animal Medicines Australia, *Pets in Australia 2025*](https://animalmedicinesaustralia.org.au/resources/pets-in-australia-a-national-survey-of-pets-and-people-3/).
- **A concrete welfare need in ASEAN.** SPCA Singapore reported **608 confirmed animal cruelty and welfare cases in 2025**, following 961 in 2024, with neglect, poor welfare and abandonment remaining concerns. These cases reinforce the case for testing practical care education before adoption. Purrfect Home gives users a place to practise daily decisions and identify preparation gaps to discuss with a rescuer. [Source: SPCA Singapore, February 2026 coverage](https://spca.org.sg/media-archives/).

**Our route to market is a Malaysian shelter-partner pilot**, reaching adopters when they are actively considering a pet. The pilot would test whether guided preparation improves care knowledge and makes adoption conversations more useful, while measuring completion rates and staff time saved. Potential commercial models include partner subscriptions and sponsored adopter education; pricing and willingness to pay would be tested before expansion to other ASEAN and JAPAC markets.

These country-level figures establish market context, not a combined regional total or an adoption-software revenue estimate: pet-food spending, household ownership and one organisation's welfare caseload measure different things. We will size our reachable market from partner adoption volumes, participating households and validated pricing, and assess adoption outcomes through partner follow-up.

### Competitors and what makes this approach different

[Petfinder](https://www.petfinder.com/adopt-or-get-involved/about-petfinder/faqs/) already supports pet discovery, saved favourites, listing alerts and connections with adoption organisations. Shelters also provide counselling and lifestyle matching.

Purrfect Home’s proposed differentiation is the combination of **household-aware discovery, catalogue-grounded conversation and an action-driven seven-day rehearsal** in one journey. Users can practise care decisions and inspect a report tied to those actions. Gemini makes the experience conversational, while deterministic rules keep trial outcomes consistent and auditable. This is a complementary preparation tool; we do not claim that other services lack every individual feature.

### Intended impact

The goal is better-prepared adopters, clearer conversations with rescuers and fewer preventable care misunderstandings. A pilot would measure trial completion, changes in care knowledge, identification of preparation gaps, and shelter staff time spent answering repeated questions. Longer-term adoption retention would require partner follow-up. These are intended outcomes, not demonstrated reductions in returns or abandonment.

## Technology stack and Google services

| Technology / service | How this submission uses it | Rationale |
| --- | --- | --- |
| React 19, TypeScript, TanStack Start / Router, Vite, Tailwind CSS | Mobile-friendly discovery, household setup, chat, trial room and reports; Node.js server functions and API | Share domain types and simulation logic across the application while keeping authoritative writes on the server. |
| **Gemini through Vertex AI** | Extracts proposed household details, answers questions using retrieved pet records, narrates personality-based reactions to care actions, and explains reports | Makes preparation interactive and contextual. Bounded prompts, validated outputs and scripted fallbacks keep the demo usable when AI is unavailable. |
| **Cloud Run** | Hosts the web app and authenticated API in one container; runs a separate private reminder service | Provides managed container hosting and automatic scaling, with a separate access boundary for scheduled work. |
| **Firebase Authentication** | Automatically creates a guest session without a login form; backend verifies Firebase ID tokens | Removes demo signup friction while keeping each visitor’s data under a separate UID. |
| **Cloud Firestore** | Stores household versions, trial snapshots, events, reports, notifications and request receipts | Transactions support concurrency checks and safe retries; pinned snapshots preserve the context of each trial. Direct browser database access is denied. |
| **Cloud Scheduler** | Invokes the private reminder worker using OIDC | Runs review reminders without a continuously running application timer. |
| **Cloud Build + Artifact Registry** | Builds the Docker image and stores versioned deployment images | Supports repeatable builds and deployment by immutable image digest. |
| **Cloud Storage + Terraform** | Stores remote Terraform state and build source archives; Terraform defines APIs, IAM, Firebase and Cloud Run resources | Makes infrastructure reproducible and keeps deployment configuration reviewable. |
| **Google Cloud IAM + Application Default Credentials** | Assigns separate web, worker, build and scheduler identities | Services use short-lived credentials rather than embedded service-account keys. |
| **Secret Manager** — optional integration support | Terraform supports secret containers and access bindings for future third-party credentials; secret values are added outside Terraform | Keeps secret values out of source code, browser bundles and Terraform state. The current Google integrations do not need static API secrets. |
| **Cloud Logging** | Receives build logs and application diagnostics, including sanitised AI fallback events | Helps diagnose deployment and model failures without logging household prompts or credentials. |
| Vitest + Firebase emulators | Checks simulation rules, UI store behaviour, guest entry, API validation and persistence flows | Verifies behaviour locally before deployment. |

### How retrieval and generative AI work

Mimi retrieves relevant records from the bundled pet catalogue using lexical matching and household criteria, then supplies those records and bounded conversation history to Gemini. Responses show links to the retrieved profiles. This is a small-catalogue retrieval-augmented approach, not a managed vector database or a live shelter search.

For trial reactions, Gemini receives the server-owned animal personality, current state and recent care events. **The simulation engine controls hunger, stress, trust, day progression and report scores; model output provides narrative and suggestions.** Unknown animal facts remain unknown, and household changes require user confirmation.

## Demo scope

The current catalogue contains six synthetic cats and dogs. The demo includes automatic guest entry, saved trials, catalogue chat, pet sounds, in-app attention alerts and AI-assisted reactions. Guest access is tied to browser storage; clearing it loses access to that session.

Readiness scores are educational game indicators, not clinical measurements, compatibility probabilities or adoption approvals. Live shelter ingestion, rescuer sharing workflows and background FCM push are not implemented. Live Gemini access depends on the configured project's model permissions and quotas.

## Run and deploy


For the guest demo, simulation fixes, bundled audio, catalogue chat and Gemini reactions,
follow [REDEPLOY_DEMO.md](REDEPLOY_DEMO.md) to update the existing Cloud Run deployment.
The app now opens a private guest session automatically, with no login form.

Start with [GCP_SETUP.md](GCP_SETUP.md) for the step-by-step Terraform deployment,
Firebase IDs, local `.env`, keyless Google authentication and Secret Manager guide.
See [implementation notes](docs/GCP_IMPLEMENTATION.md) for the architecture and remaining scope.

Requires Node 24.12+. Use `npm ci`, `npm run typecheck`, `npm test`, and
`npm run build`. Copy `.env.example` for an offline demo. For a cloud-backed run,
follow the setup guide first. `npm run test:cloud` tests the compiled server against
local Firebase emulators (Java 21+), with no billable cloud resources.

See [verification notes](docs/VERIFICATION.md) for completed checks and their limits.

## Project origins

The original interface was built with [Lovable](https://lovable.dev).
The [upstream Lovable demo](https://purrfect-ai-home.lovable.app) is separate from this modified GCP deployment.
The project remains connected to its [Lovable editor](https://lovable.dev/projects/a318aa07-8bd1-4651-ac7c-a41eab499757); avoid rewriting published Git history.

