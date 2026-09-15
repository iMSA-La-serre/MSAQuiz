# Contributing to MSAQuiz

MSAQuiz is iMSA's internal quiz platform, maintained by the La Serre team. Thank you for helping out!

## Getting Started

1. Clone the repository: `git clone https://github.com/iMSA-La-serre/MSAQuiz.git`
2. Install dependencies with pnpm (see the prerequisites in the [README](../README.md)): `pnpm install`
3. Pull the latest changes from the current integration branch (ask the team if unsure which one is active): `git checkout <integration-branch> && git pull`
4. Create your branch from it: `git checkout -b feat/your-feature-name`

## Branch Naming

- `feat/` — new feature
- `fix/` — bug fix
- `chore/` — maintenance, dependencies
- `docs/` — documentation only

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add timer display to question screen
fix: prevent crash when quiz has no questions
chore: update dependencies
```

## Pull Requests

- Open issues and pull requests on [iMSA-La-serre/MSAQuiz](https://github.com/iMSA-La-serre/MSAQuiz), targeting the integration branch you started from.
- **One pull request = one feature or fix.** Do not bundle multiple features together — it becomes unmanageable to review and harder to revert if something breaks.
- Make sure the CI passes (formatting, lint and tests) before requesting review
- Link any related issue with `Closes #123`

## Code Style

- Run `pnpm format`, `pnpm lint` and `pnpm test` and fix any errors before committing (`pnpm format:fix` and `pnpm lint:fix` apply automatic fixes)
- Keep components small and focused
- No commented-out code

## Reporting Issues

Use the issue templates provided in this repository.
