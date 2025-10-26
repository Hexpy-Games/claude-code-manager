# Start New Feature (TDD Workflow)

You are helping start a new feature using Test-Driven Development. Follow these steps:

## Step 1: Read Project Context

First, read the following files to understand the project:
- `CLAUDE.md` - Project overview and architecture
- `.claude/development/GUIDELINES.md` - Development workflow and standards

## Step 2: Understand Feature Request

Ask the user:
1. What is the feature they want to build?
2. What problem does it solve?
3. Are there any specific requirements or constraints?

## Step 3: Create Feature Documentation

Create the following documents in `.claude/features/{number}-{feature-name}/`:

### 3.1 Use Case Document (`use-case.md`)

Use this template:

```markdown
# Feature: [Feature Name]

## Overview
Brief description of what this feature does.

## User Story
As a [type of user], I want [goal], so that [benefit].

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Success Metrics
How will we measure if this feature is successful?

## Edge Cases
What could go wrong?
- Edge case 1
- Edge case 2

## Dependencies
- Dependency 1: Description
- Dependency 2: Description

## Technical Notes
Any technical considerations, constraints, or implementation hints.
```

### 3.2 Test Case Document (`test-case.md`)

Use this template:

```markdown
# Test Cases: [Feature Name]

## Unit Tests

### Component/Function 1
- ✅ Test case 1 description
- ✅ Test case 2 description
- ✅ Test case 3 description

### Component/Function 2
- ✅ Test case 1 description
- ✅ Test case 2 description

## Integration Tests

### Integration Scenario 1
- Setup: What needs to be set up
- Action: What action to perform
- Expected: What should happen
- ✅ Test case description

## E2E Tests

### Happy Path: [Scenario Name]
1. User action 1
2. User action 2
3. **Assert**: Expected result 1
4. User action 3
5. **Assert**: Expected result 2

### Error Path: [Error Scenario]
1. User action that triggers error
2. **Assert**: Error is handled gracefully
3. **Assert**: User sees helpful error message

## Test Data

Example data needed for tests:
```json
{
  "example": "data"
}
```

## Mocks/Stubs

What external dependencies need to be mocked?
- Dependency 1: Mock strategy
- Dependency 2: Stub approach
```

## Step 4: Review Documents with User

Show the created documents to the user and ask:
1. Does this capture the requirements correctly?
2. Are there any missing scenarios?
3. Are the acceptance criteria clear and testable?

## Step 5: Create Test Files (TDD - Red Phase)

Based on the test cases, create test files:

### For Unit Tests
Create `*.test.ts` files next to implementation:
- `apps/server/src/services/[service].test.ts`
- `apps/desktop/src/components/[component].test.tsx`

### For E2E Tests
Create spec files in e2e directories:
- `apps/desktop/e2e/[feature].spec.ts`

**Write tests that FAIL** - We haven't implemented yet!

## Step 6: Run Tests (Should Fail)

Run tests to confirm they fail:
```bash
pnpm test:unit
```

Expected output: Tests fail (RED phase)

## Step 7: Ready to Implement

Tell the user:
- ✅ Documentation is ready
- ✅ Test cases are written
- ✅ Tests are failing (as expected)
- ✅ Ready to implement feature

Now they can start writing implementation code to make tests pass!

## Reminder

Before merging:
1. All tests must pass
2. Run `/review-ready` to do final checks
3. Code coverage should be ≥ 80%

---

**TDD Mantra**: Red → Green → Refactor
