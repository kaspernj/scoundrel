# Scoundrel

## Development workflow

- After making changes, run `npm run lint` and `npm run typecheck`.
- After making changes, check whether `README.md` needs updates.
- `npm run lint`
- `npm run typecheck`
- `npm run test`

## GitHub PR formatting

- When using `gh pr create`, pass the body as a multi-line string (actual newlines), not escaped `\n` sequences.
