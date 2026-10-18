# Purrfect Ai Home

## GCP integration in this local copy

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

The original Lovable instructions below describe the upstream project.

Based on the specification documents, data and design UI/UX. Create the application. Make sure it can scale. For now use mock data/ LLM but put the code where the GCP needs to be configured in comment form.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://purrfect-ai-home.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a318aa07-8bd1-4651-ac7c-a41eab499757).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
