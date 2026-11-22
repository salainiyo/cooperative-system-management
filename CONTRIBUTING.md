# Contributing

Contributions are welcome. This project treats financial data carefully, so
changes to money calculations need test coverage.

## Getting started

1. Fork the repository and branch from `main`.
2. Follow the setup in the README (`backend/` and `frontend/` have their own
   README files).
3. Keep local `.env` and Ansible vault files untracked.

## Before opening a pull request

- Run `cd backend && pytest -q` and `cd frontend && npm test && npm run build`.
- Add tests for changes to balances, interest, fees or payout logic.
- Do not include real member data, credentials or personal identifiers.
- Update the README and CHANGELOG when behavior changes.
