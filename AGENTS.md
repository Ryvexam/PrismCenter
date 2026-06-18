# AGENTS.md

## Repository Scope

PrismCenter is a React 19 and Vite application for energy-first AI datacenter siting in France. The UI is French. Code, comments, commit messages, branch names, pull-request descriptions, and technical documentation must be written in English.

## Git Workflow

- Protect `main` and `dev`; never commit directly to either branch.
- Start work from `dev` using `feat/*`, `fix/*`, `refactor/*`, `docs/*`, `test/*`, `chore/*`, `ci/*`, `security/*`, or `perf/*`.
- Open feature pull requests into `dev`; promote `dev` into `main` through a separate reviewed pull request.
- Use Conventional Commits.
- Do not force-push or delete protected branches.

## Required Validation

Run these commands before opening or updating a pull request:

```bash
npm ci
npm test
npm run build
git diff --check
```

For dependency or deployment changes, also run an appropriate audit and inspect the generated bundle.

## Engineering Rules

- Keep calculation logic outside React components when it can be tested independently.
- Treat public APIs and embedded datasets as untrusted and incomplete.
- Preserve timeouts, fallbacks, null handling, and explicit confidence labels.
- Avoid secrets in the browser bundle or repository. Document future configuration in `.env.example` only.
- Keep functions focused, typed through clear data shapes or JSDoc where useful, and free of repeated literals.

## Hyperscale Model

- Centralize power, GPU, energy, and cost assumptions in `src/data/colossusScenarios.js`.
- Keep 30 MW, 300 MW, 1 GW, and 2 GW as explicit comparison bands.
- Separate GPU-only draw from server overhead, networking, storage, cooling, conversion losses, and redundancy.
- Label every hyperscale result as an order-of-magnitude estimate, not a grid-connection promise or engineering design.
- Above 300 MW, heavily weight transmission voltage, available capacity, reinforcement, cooling, storage, and dedicated energy procurement.

## Security Review

Check changes for XSS, unsafe URL construction, untrusted API payloads, exposed credentials, dependency risk, denial-of-service through uncontrolled requests, and missing abort/timeout behavior. The frontend must never contain private API keys or infrastructure credentials.
