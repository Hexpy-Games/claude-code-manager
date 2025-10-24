# Feature 009: Session List Component

## Overview
Session list UI component with Zustand state management for displaying, creating, switching, and deleting sessions.

## Dependencies
- `zustand` - State management
- `@tanstack/react-query` - Data fetching and caching

## Architecture

### State Management (Zustand)
**File**: `src/stores/sessionStore.ts`

Store manages:
- Sessions array
- Active session ID
- Loading/error states
- CRUD operations

### Components

#### SessionList
**File**: `src/components/SessionList.tsx`

Main container component that:
- Fetches sessions using React Query
- Displays list of SessionItem components
- Shows loading/error states
- Provides "New Session" button
- Handles empty state

#### SessionItem
**File**: `src/components/SessionItem.tsx`

Individual session item that:
- Displays session title and metadata
- Shows active indicator
- Provides switch/delete actions
- Shows timestamp (last updated)

#### NewSessionDialog
**File**: `src/components/NewSessionDialog.tsx`

Modal dialog for creating sessions:
- Form with title and root directory inputs
- Optional base branch selection
- Validation
- Success/error feedback

## API Integration

Uses REST client from Feature 008:
- `listSessions()` - Fetch all sessions
- `createSession()` - Create new session
- `switchSession()` - Activate session
- `deleteSession()` - Delete session

## Testing Strategy

### Unit Tests
- Store: State updates, actions, edge cases
- Components: Rendering, user interactions, props
- Integration: Store + API client mocking

### Test Coverage
- Minimum 80% coverage required
- Focus on user workflows and error handling

## UI Requirements

- Sort sessions by `updatedAt` (most recent first)
- Active session has visual indicator (accent color)
- Confirm before deletion
- Show loading spinner during operations
- Display error messages inline
- Responsive layout

## Implementation Checklist

- [x] Documentation
- [ ] Install dependencies
- [ ] Create store with tests (TDD)
- [ ] Create SessionList with tests (TDD)
- [ ] Create SessionItem with tests (TDD)
- [ ] Create NewSessionDialog with tests (TDD)
- [ ] Integration testing
- [ ] Manual UI testing
