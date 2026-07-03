```markdown
# NexusVault Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the NexusVault TypeScript codebase. You'll learn about file naming, import/export styles, commit message tendencies, and how to write and run tests using Vitest. This guide is ideal for onboarding new contributors or maintaining consistency in ongoing development.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userProfile.ts`, `vaultManager.ts`

### Import Style
- Use **relative imports** for modules within the project.
  - Example:
    ```typescript
    import { encryptData } from './cryptoUtils';
    ```

### Export Style
- **Mixed** export style: both named and default exports are present.
  - Named export example:
    ```typescript
    export function connectVault() { ... }
    ```
  - Default export example:
    ```typescript
    export default VaultManager;
    ```

### Commit Messages
- Freeform style, no strict prefixes.
- Average commit message length: ~34 characters.
  - Example: `Add vault encryption logic`

## Workflows

### Adding a New Feature
**Trigger:** When implementing new functionality.
**Command:** `/add-feature`

1. Create a new file using camelCase naming.
2. Write your TypeScript code, using relative imports for dependencies.
3. Export your functions or classes using named or default exports as appropriate.
4. Add or update relevant tests in a `.test.tsx` file.
5. Commit your changes with a concise, descriptive message.

### Running Tests
**Trigger:** To verify code correctness before pushing or merging.
**Command:** `/run-tests`

1. Ensure you have Vitest installed (`npm install` if needed).
2. Run the test suite:
    ```bash
    npx vitest
    ```
3. Review test output and fix any failing tests.

### Writing Tests
**Trigger:** When adding or updating code.
**Command:** `/write-test`

1. Create a test file with the `.test.tsx` suffix, matching the module under test.
2. Use Vitest to write your test cases.
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { encryptData } from './cryptoUtils';

    describe('encryptData', () => {
      it('should encrypt data correctly', () => {
        expect(encryptData('secret')).toBeDefined();
      });
    });
    ```
3. Place test files alongside or near the files they test.

## Testing Patterns

- **Framework:** Vitest
- **Test file pattern:** `*.test.tsx`
- Tests are colocated with source files or in a dedicated test directory.
- Use standard Vitest syntax (`describe`, `it`, `expect`).

## Commands

| Command        | Purpose                                 |
|----------------|-----------------------------------------|
| /add-feature   | Scaffold and implement a new feature    |
| /run-tests     | Run the full test suite with Vitest     |
| /write-test    | Create and write a new test file        |
```