---
name: "Require Type and Lint Check"
description: "Mandates running type checks and lint checks before completing any task."
priority: high
---
# Rule: Code Validation Before Task Completion

Before concluding any task that involves modifying code, you MUST perform the following steps to ensure code health and prevent leaving behind unused or broken code:

1. **Identify Package Manager**: Check for lockfiles (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, etc.) to determine the correct package manager. Do not blindly run `npm` commands.
2. **Type Check**: Run the project's type checker (e.g., `pnpm tsc --noEmit` or equivalent script defined in `package.json`).
3. **Lint Check**: Run the project's linter (e.g., `pnpm run lint` or equivalent script defined in `package.json`).
4. **Fix Errors**: If the type or lint checks fail due to your recent modifications (e.g., unused variables, missing types, syntax errors), you must fix those specific errors before ending your turn.
5. **Verify Fix**: Re-run the checks to confirm your changes did not introduce any new errors.
