# Session Guide - Quick Reference

Display this quick reference guide for the current development session.

## Current Session Info

Check and display:

```bash
# Current branch
git branch --show-current

# Last commit
git log -1 --oneline

# Files changed in this session
git diff --name-only main..HEAD

# Uncommitted changes
git status --short
```

Show this information to the user in a formatted way.

## Quick Workflow Reminder

### Phase-Gate Process

```
1. 📝 Documentation First
   ├─ Write use-case.md
   └─ Write test-case.md

2. 🧪 Tests First (TDD)
   ├─ Write failing tests
   └─ Run tests (should fail - RED)

3. 💻 Implementation
   ├─ Write minimal code
   └─ Make tests pass (GREEN)

4. ♻️  Refactor
   ├─ Improve code quality
   └─ Tests still pass

5. ✅ Quality Checks
   ├─ Run /review-ready
   ├─ Fix any issues
   └─ Merge to main
```

## Common Commands

### Testing
```bash
# Run unit tests
pnpm test:unit

# Run specific test file
pnpm test:unit path/to/test.ts

# Run tests in watch mode
pnpm test:unit --watch

# Run E2E tests
pnpm test:e2e

# Check coverage
pnpm test:coverage
```

### Code Quality
```bash
# Lint code
pnpm lint

# Auto-fix linting issues
pnpm lint --fix

# Type check
pnpm typecheck
```

### Git
```bash
# See what changed in this session
git diff main

# Commit changes
git add .
git commit -m "feat(scope): description"

# See session history
git log main..HEAD

# Switch to different session
git checkout session/sess_xxx
```

### Development
```bash
# Start dev servers
pnpm dev

# Build all packages
pnpm build

# Clean and reinstall
pnpm clean && pnpm install
```

## Project Slash Commands

- `/start-feature` - Begin new feature with TDD workflow
- `/review-ready` - Run all quality checks before merge
- `/session-guide` - Show this guide (you are here!)
- `/architecture` - Review system architecture

## File Locations

### Documentation
- `docs/features/` - Feature specifications
- `docs/architecture/` - System design docs
- `CLAUDE.md` - Project context
- `GUIDELINES.md` - Detailed workflow

### Code
- `apps/desktop/` - Tauri desktop app
- `apps/web/` - Web client
- `packages/server/` - Backend API
- `packages/shared/` - Shared types

### Tests
- `**/*.test.ts` - Unit tests (next to implementation)
- `apps/*/e2e/` - E2E tests

## Quality Standards

### Coverage Target
- **Minimum**: 80% code coverage
- Unit tests for all business logic
- E2E tests for critical user flows

### Code Review
- Must pass automated review
- No security vulnerabilities
- No type errors
- No linting errors

### Git Commits
```
<type>(<scope>): <subject>

Examples:
feat(sessions): add Git branch creation
fix(git): handle empty repositories
test(sessions): add unit tests for creation flow
docs(architecture): update Git strategy
```

## Need Help?

### Reading Material
1. **New to project?** Read `CLAUDE.md`
2. **Need detailed workflow?** Read `GUIDELINES.md`
3. **Starting feature?** Run `/start-feature`
4. **Ready to merge?** Run `/review-ready`

### Common Questions

**Q: How do I start a new feature?**
A: Run `/start-feature` and follow the prompts

**Q: My tests are failing, what do I do?**
A: Read the test output, fix the issue, run tests again

**Q: Can I skip writing tests?**
A: No. Tests are mandatory. No tests = no merge.

**Q: What if coverage is 79%?**
A: Add one more test to get to 80%+

**Q: Can I merge without code review?**
A: No. Run `/review-ready` first.

## Git-Based Session Strategy

### Key Concepts
- Each session = isolated Git branch
- Format: `session/{session-id}`
- Branch created from `main`
- All changes scoped to session branch
- Merge to main when done

### Session Workflow
```
main
 ├─ session/sess_abc123  ← Your current session
 ├─ session/sess_def456  ← Another session
 └─ session/sess_ghi789  ← Yet another session
```

### Switching Sessions
When you switch sessions in the UI:
1. Backend saves current state
2. Backend runs `git checkout session/other_session`
3. UI loads that session's history
4. You continue where you left off

---

**Remember**: Quality over speed. Test first, code second, review always.
