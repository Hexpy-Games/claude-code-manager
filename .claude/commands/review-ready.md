# Pre-Merge Review & Testing

You are helping ensure code is ready to merge. This command runs all quality checks.

## Step 1: Check Current Branch

First, verify we're on a session branch:

```bash
git branch --show-current
```

Expected: `session/sess_*` or feature branch
If on `main`: **STOP** - Don't run tests on main, switch to feature branch

## Step 2: Check for Uncommitted Changes

```bash
git status
```

If there are uncommitted changes:
- Ask user if they want to commit them first
- Or continue with dirty working directory (may affect tests)

## Step 3: Run Linting

```bash
pnpm lint
```

**Expected**: No errors

If linting fails:
- Show errors to user
- Ask if they want to auto-fix: `pnpm lint --fix`
- Or manually fix issues
- **STOP until fixed**

## Step 4: Run Type Checking

```bash
pnpm typecheck
```

**Expected**: No type errors

If type checking fails:
- Show type errors
- **STOP until fixed** - Type errors must be resolved

## Step 5: Run Unit Tests

```bash
pnpm test:unit
```

**Expected**: All tests pass

If tests fail:
- Show which tests failed
- Show failure details
- **STOP until fixed** - All tests must pass

## Step 6: Run E2E Tests

```bash
pnpm test:e2e
```

**Expected**: All E2E tests pass

If E2E tests fail:
- Show which tests failed
- Consider if failure is due to:
  - Bug in implementation
  - Flaky test
  - Test needs updating
- **STOP until fixed**

## Step 7: Check Test Coverage

```bash
pnpm test:coverage
```

**Expected**: Overall coverage ≥ 80%

Show coverage report summary:
- Statements: X%
- Branches: X%
- Functions: X%
- Lines: X%

If coverage < 80%:
- Show which files have low coverage
- Suggest areas that need more tests
- User can:
  - Add more tests (recommended)
  - Or accept lower coverage with justification

## Step 8: Run Code Review Agent

Use the `code-reviewer` agent to analyze the code:

```
I need you to review the code changes for this feature.

Please check:
1. Code quality and complexity
2. Security vulnerabilities
3. Best practices and patterns
4. Test quality
5. Performance concerns
6. Error handling

Focus on files changed in this session branch compared to main.
```

Wait for agent to complete review.

### Review Results

If code review finds issues:
- **Critical issues**: Must fix before merge
  - Security vulnerabilities
  - Logic errors
  - Missing error handling

- **Recommendations**: Should fix
  - Code duplication
  - Complexity issues
  - Performance improvements

- **Nice-to-haves**: Optional
  - Style suggestions
  - Refactoring opportunities

Show results to user and ask which issues to address.

## Step 9: Summary Report

Create a summary report:

```markdown
# Pre-Merge Review Summary

## ✅ Checks Passed
- [x] Linting
- [x] Type checking
- [x] Unit tests (X tests passed)
- [x] E2E tests (X tests passed)
- [x] Code coverage (X%)
- [x] Code review

## 📊 Statistics
- Files changed: X
- Lines added: +X
- Lines removed: -X
- Test coverage: X%
- Tests added: X

## 🎯 Ready to Merge
All quality gates passed! This code is ready to merge to main.

## 📝 Next Steps
1. Review the summary above
2. If satisfied, merge to main:
   ```bash
   git checkout main
   git merge <your-branch>
   git push origin main
   ```
3. Optional: Delete session branch
   ```bash
   git branch -d <your-branch>
   ```
```

## Step 10: Wait for User Decision

Ask the user:
- "Ready to merge to main?"
- "Would you like me to help with the merge?"
- "Any final changes needed?"

If user says yes to merge:
- Provide step-by-step merge instructions
- Or offer to create merge commit message

## Failure Scenarios

### If Any Check Fails

Create a different report:

```markdown
# Pre-Merge Review - Issues Found

## ❌ Failed Checks
- [ ] Linting (X errors)
- [ ] Type checking (X errors)
- [ ] Unit tests (X failures)
- [ ] E2E tests (X failures)
- [ ] Code coverage (X% - below 80%)
- [ ] Code review (X critical issues)

## 🔧 Issues to Fix

### Critical
1. Issue 1 description
2. Issue 2 description

### Recommended
1. Issue 1 description
2. Issue 2 description

## 📝 Next Steps
1. Fix the issues above
2. Run `/review-ready` again
3. Repeat until all checks pass
```

**IMPORTANT**: Do NOT allow merge if critical checks fail:
- Linting errors
- Type errors
- Test failures
- Critical security issues

## Notes

- This command should be run before EVERY merge
- It's okay to run multiple times while fixing issues
- All checks must pass before merge
- Code coverage can be discussed if slightly below 80%

---

**Remember**: Quality over speed. Better to spend time fixing issues than to merge broken code.
