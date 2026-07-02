```markdown
# NexusVault Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the NexusVault repository, a Rust codebase with a focus on clarity, maintainability, and consistent commit practices. You'll learn about file naming, import/export styles, commit message conventions, and how to approach testing within this project.

## Coding Conventions

### File Naming
- **Style:** camelCase
- **Example:**  
  - `vaultManager.rs`
  - `userDataHandler.rs`

### Import Style
- **Style:** Relative imports
- **Example:**
  ```rust
  mod utils;
  use crate::utils::encryption;
  ```

### Export Style
- **Style:** Named exports
- **Example:**
  ```rust
  pub fn encrypt_data(data: &str) -> String { ... }
  ```

### Commit Messages
- **Type:** Conventional commits
- **Allowed Prefixes:** `fix`
- **Format Example:**
  ```
  fix: resolve panic on empty vault initialization
  ```

## Workflows

### Fixing Bugs
**Trigger:** When a bug is identified and needs to be resolved  
**Command:** `/fix-bug`

1. Identify the bug and reproduce it locally.
2. Create a new branch for your fix.
3. Make code changes following the coding conventions.
4. Write a commit message starting with `fix:`, describing the change.
   - Example: `fix: correct off-by-one error in index calculation`
5. Push your branch and open a pull request for review.

### Adding New Features
**Trigger:** When implementing a new feature or module  
**Command:** `/add-feature`

1. Plan the feature and determine affected modules.
2. Create new files using camelCase naming.
3. Use relative imports to integrate with existing code.
4. Export new functions or structs using named exports.
5. Write tests for new functionality (see Testing Patterns).
6. Commit changes with a descriptive message (use a relevant prefix if extending beyond `fix`).
7. Push and open a pull request.

## Testing Patterns

- **Test File Pattern:** Files end with `.test.ts`
- **Framework:** Unknown (ensure to follow the `.test.ts` pattern)
- **Example:**
  ```typescript
  // vaultManager.test.ts
  import { encrypt_data } from './vaultManager';

  test('encrypt_data returns non-empty string', () => {
      expect(encrypt_data('secret')).not.toBe('');
  });
  ```

## Commands
| Command      | Purpose                                      |
|--------------|----------------------------------------------|
| /fix-bug     | Start the bug fixing workflow                |
| /add-feature | Start the new feature implementation workflow |
```
