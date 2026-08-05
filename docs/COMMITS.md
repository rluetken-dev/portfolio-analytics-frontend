# Commit Message Guidelines

This project follows the Conventional Commits specification to keep a clean, readable Git history.

## Format

```text
<type>(optional scope): <short summary>

(optional body)

(optional footer)
```

## Types

- `feat`: a new feature
- `fix`: a bug fix
- `docs`: documentation-only changes
- `style`: formatting or styling changes that do not affect behavior
- `refactor`: code changes that neither fix a bug nor add a feature
- `test`: adding or updating tests
- `chore`: build, CI, dependency, or tooling changes

## Frontend Scopes

Scopes are optional, but useful for keeping the history easy to scan.

Common scopes for this project:

- `auth`
- `companies`
- `portfolio`
- `charts`
- `analytics`
- `api`
- `ui`
- `docs`
- `ci`

## Examples

```text
feat(companies): add company discovery panel
```

```text
fix(auth): refresh session after page reload
```

```text
docs(readme): clarify local setup
```

```text
style(ui): align portfolio table spacing
```

```text
refactor(api): centralize frontend fetch handling
```

```text
test(status): add status message smoke tests
```

```text
chore(ci): update Node version in GitHub Actions
```

## Tips

- Keep the summary short, ideally under 72 characters.
- Use imperative mood, for example `add`, not `added`.
- Use lowercase for type and scope.
- Keep each commit focused on one logical change.
- Prefer a scope when it makes the affected area clearer.

For more details, see [Conventional Commits](https://www.conventionalcommits.org).
