---
description: Tag and push a new version to GitHub after running tests
---

# Tag and Push Workflow

This workflow ensures all tests pass before creating a version tag and pushing to GitHub.

## Steps

// turbo
1. Navigate to the test directory:
   ```
   cd c:\Users\rishi\Agent Test\ai_human_debate_arena\tests
   ```

// turbo
2. Run all Playwright tests:
   ```
   npx playwright test --reporter=list
   ```

3. **STOP if any tests fail.** Do not proceed until all tests pass.

// turbo
4. Stage all changes:
   ```
   cd c:\Users\rishi\Agent Test\ai_human_debate_arena
   git add -A
   ```

5. Commit with version message:
   ```
   git commit -m "v{VERSION}: {DESCRIPTION}"
   ```
   - Replace `{VERSION}` with the version number from `version.json`
   - Replace `{DESCRIPTION}` with a brief summary of changes

6. Create annotated tag:
   ```
   git tag -a v{VERSION} -m "v{VERSION}: {DESCRIPTION}"
   ```

7. Push to GitHub with tags:
   ```
   git push origin master --tags
   ```

## Pre-requisites

- Flask server must be running at http://127.0.0.1:8081
- `version.json` must be updated with the new version number and changelog
