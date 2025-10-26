# Feature: Tauri Desktop Application Setup

> **Feature ID**: 007
> **Status**: Complete ✅
> **Owner**: Development Team
> **Created**: 2025-10-24
> **Updated**: 2025-10-25

## Overview

Set up the Tauri 2.x desktop application foundation in the monorepo with React 18, TypeScript, TailwindCSS, and Shadcn UI. This establishes the base for all Phase 2 desktop UI features including session management, chat interface, and settings.

## User Story

**As a** desktop application developer
**I want** a properly configured Tauri 2.x project with modern frontend tooling
**So that** I can build cross-platform desktop UI components efficiently with hot reload and testing infrastructure

### Example
**As a** frontend developer
**I want** to run `pnpm dev` in the desktop app directory
**So that** the Tauri app launches with hot reload, letting me see UI changes instantly

## Acceptance Criteria

- [ ] **AC1**: Tauri 2.x project initialized in `apps/desktop/` directory
- [ ] **AC2**: React 18 with TypeScript configured and working
- [ ] **AC3**: Vite bundler configured with proper aliases (`@/` for src)
- [ ] **AC4**: TailwindCSS installed and configured with globals.css
- [ ] **AC5**: Shadcn UI initialized with components.json configuration
- [ ] **AC6**: At least one Shadcn component (Button) installed and working
- [ ] **AC7**: Vitest configured for unit testing with jsdom environment
- [ ] **AC8**: Playwright configured for E2E testing of Tauri app
- [ ] **AC9**: `pnpm dev` launches Tauri app in development mode
- [ ] **AC10**: Hot reload works (changes reflect without restart)
- [ ] **AC11**: `pnpm build` creates production build successfully
- [ ] **AC12**: `pnpm test:unit` runs unit tests and passes
- [ ] **AC13**: `pnpm test:e2e` runs E2E tests and passes
- [ ] **AC14**: TypeScript strict mode enabled with no errors
- [ ] **AC15**: Biome linter configured and passing
- [ ] **AC16**: Integrated with monorepo Turbo build system
- [ ] **AC17**: Package named `@claude-code-manager/desktop`
- [ ] **AC18**: TypeScript path alias `@/*` resolves to `./src/*`

## Success Metrics

### Quantitative Metrics
- **Dev startup time**: < 5 seconds from `pnpm dev` to app launch
- **Hot reload time**: < 2 seconds for changes to reflect
- **Build time**: < 30 seconds for production build
- **Test execution**: Unit tests < 5 seconds, E2E tests < 20 seconds

### Qualitative Metrics
- **Developer experience**: Instant feedback with hot reload
- **Type safety**: Full TypeScript coverage with strict mode
- **UI consistency**: Shadcn UI provides consistent design system
- **Testing confidence**: Comprehensive test infrastructure ready

## User Flows

### Primary Flow (Happy Path)

1. **Developer initializes Tauri project**
   - Runs `pnpm create tauri-app` in apps directory
   - Selects React + TypeScript template
   - Configures package name as `@claude-code-manager/desktop`

2. **Developer configures frontend tooling**
   - Installs TailwindCSS, PostCSS, Autoprefixer
   - Creates tailwind.config.js with proper content paths
   - Creates globals.css with Tailwind directives
   - Imports globals.css in main.tsx

3. **Developer sets up Shadcn UI**
   - Runs `pnpm dlx shadcn-ui@latest init`
   - Configures components.json with proper paths
   - Creates `src/lib/utils.ts` with `cn()` helper
   - Installs Button component to verify setup

4. **Developer configures testing**
   - Installs Vitest, React Testing Library, jsdom
   - Creates vitest.config.ts with jsdom environment
   - Creates test setup file
   - Installs Playwright for E2E tests
   - Creates basic smoke tests

5. **Developer verifies setup**
   - Runs `pnpm dev` → App launches successfully
   - Makes UI change → Hot reload works
   - Runs `pnpm test:unit` → Tests pass
   - Runs `pnpm build` → Production build succeeds

### Alternative Flows

#### Alt Flow 1: Monorepo Integration Issues

1. Developer creates Tauri project
2. TypeScript can't resolve `@claude-code-manager/shared`
3. Developer checks tsconfig.json extends root config
4. Developer verifies package.json has `workspace:*` dependency
5. Developer runs `pnpm install` at root
6. Resolution succeeds

#### Alt Flow 2: Shadcn UI Installation Fails

1. Developer runs `shadcn-ui init`
2. Command fails due to missing dependencies
3. Developer installs `class-variance-authority`, `clsx`, `tailwind-merge`
4. Developer creates `src/lib/utils.ts` manually
5. Developer runs `shadcn-ui add button`
6. Button component installed successfully

#### Alt Flow 3: E2E Test Configuration

1. Developer installs Playwright
2. Tauri-specific Playwright config needed
3. Developer follows Tauri E2E testing guide
4. Creates `playwright.config.ts` with beforeAll hook to launch Tauri
5. Creates basic E2E test
6. Test launches actual Tauri app and passes

## Edge Cases

### Edge Case 1: Port 1420 Already in Use

- **Situation**: Dev server can't start because port occupied
- **Expected behavior**: Clear error message, suggest killing process or changing port
- **Rationale**: Common development issue, needs clear guidance

### Edge Case 2: Rust Not Installed

- **Situation**: Tauri requires Rust, user doesn't have it
- **Expected behavior**: Clear error with link to Rust installation instructions
- **Rationale**: Prerequisite for Tauri development

### Edge Case 3: Node Version Incompatibility

- **Situation**: User has Node 16, project requires Node 18+
- **Expected behavior**: Package.json engines field specifies requirement, error on install
- **Rationale**: Prevent subtle runtime errors

### Edge Case 4: TailwindCSS Not Purging Unused Styles

- **Situation**: Production build has large CSS file
- **Expected behavior**: Tailwind config has proper content paths to enable purging
- **Rationale**: Keep production bundle small

### Edge Case 5: Hot Reload Not Working

- **Situation**: Changes don't reflect in running app
- **Expected behavior**: Check Vite watch config, verify no TypeScript errors blocking
- **Rationale**: Essential for development experience

### Edge Case 6: Vitest Can't Find Components

- **Situation**: Tests fail with "Cannot find module '@/components/Button'"
- **Expected behavior**: vitest.config.ts has same alias resolution as vite.config.ts
- **Rationale**: Test environment must match development environment

## Dependencies

### Required Features
None - This is the foundation feature for Phase 2

### External Dependencies
- **Tauri 2.x**: Desktop app framework (@tauri-apps/cli, @tauri-apps/api)
- **React 18**: UI library
- **TypeScript 5.6+**: Type safety
- **Vite 5.x**: Build tool and dev server
- **TailwindCSS 3.x**: Utility-first CSS
- **Shadcn UI**: Component collection
- **Vitest**: Unit testing framework
- **Playwright**: E2E testing framework
- **Rust**: Tauri backend (system requirement)

## Technical Notes

### Architecture Considerations

**Tauri Architecture**:
```
┌─────────────────────────────────────┐
│   Frontend (React + TypeScript)    │
│   - Vite dev server (port 1420)    │
│   - Hot reload enabled              │
│   - TailwindCSS for styling         │
└──────────────┬──────────────────────┘
               │ Tauri API
┌──────────────▼──────────────────────┐
│   Backend (Rust)                    │
│   - Native OS integration           │
│   - File system access              │
│   - IPC to frontend                 │
└─────────────────────────────────────┘
```

### Data Model Changes

N/A - No database changes required

### API Changes

N/A - This feature establishes frontend, API integration comes in Feature 008

### Directory Structure

```
apps/desktop/
├── src/                          # React application
│   ├── components/               # React components
│   │   └── ui/                   # Shadcn UI components
│   ├── lib/                      # Utility functions
│   │   └── utils.ts              # cn() helper
│   ├── styles/                   # Global styles
│   │   └── globals.css           # Tailwind imports
│   ├── test/                     # Test utilities
│   │   └── setup.ts              # Vitest setup
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # React entry point
│   └── vite-env.d.ts             # Vite types
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── lib.rs                # Tauri setup
│   │   └── main.rs               # Entry point
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Tauri config
│   └── capabilities/             # Permissions
├── e2e/                          # E2E tests
│   └── app.spec.ts               # Smoke tests
├── index.html                    # HTML entry
├── package.json                  # npm config
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Vite config
├── vitest.config.ts              # Vitest config
├── playwright.config.ts          # Playwright config
├── tailwind.config.js            # Tailwind config
├── postcss.config.js             # PostCSS config
└── components.json               # Shadcn config
```

### Package Configuration

**Key package.json Scripts**:
```json
{
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "lint": "biome check src",
    "lint:fix": "biome check --write src"
  }
}
```

**Key Dependencies**:
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tauri-apps/api": "^2.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.8",
    "@playwright/test": "^1.48.2",
    "tailwindcss": "^3.4.15"
  }
}
```

### TypeScript Configuration

```typescript
// tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
```

### Tauri Configuration

```json
// src-tauri/tauri.conf.json
{
  "productName": "Claude Code Manager",
  "version": "0.1.0",
  "identifier": "com.claude-code-manager.app",
  "build": {
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{
      "title": "Claude Code Manager",
      "width": 1200,
      "height": 800,
      "resizable": true
    }]
  }
}
```

## UI/UX Considerations

### Visual Design
- **Dark mode by default**: System preference respected
- **Shadcn UI theme**: Consistent with Claude.ai aesthetic
- **Responsive layout**: Adapts to window size
- **Native feel**: Looks native on Mac, Windows, Linux

### Accessibility
- **Keyboard navigation**: Tab order logical
- **Screen reader support**: Proper ARIA labels
- **Color contrast**: Meets WCAG AA standards
- **Focus indicators**: Visible focus rings

## Non-Functional Requirements

### Performance
- **Cold start**: < 3 seconds from launch to render
- **Hot reload**: < 2 seconds for changes
- **Memory usage**: < 200MB idle
- **Build size**: < 50MB installed (excluding dependencies)

### Security
- **CSP configured**: Content Security Policy in place
- **Tauri permissions**: Minimal permissions granted
- **No eval**: No dynamic code execution
- **Dependency audit**: Regular security scans

### Compatibility
- **macOS**: 11+ (Big Sur and newer)
- **Windows**: 10+ (64-bit)
- **Linux**: Ubuntu 20.04+, modern distros

## Open Questions

- [x] **Q1**: Should we use Tauri 1.x or 2.x?
  - **Answer**: Tauri 2.x for latest features and security

- [x] **Q2**: Which UI component library?
  - **Answer**: Shadcn UI for flexibility and customization

- [x] **Q3**: Vite or Webpack?
  - **Answer**: Vite for faster dev experience and Tauri 2 recommendation

- [x] **Q4**: Support light mode?
  - **Answer**: Yes, but dark mode default (matches Claude.ai)

- [x] **Q5**: E2E testing strategy?
  - **Answer**: Playwright with Tauri-specific configuration

## Related Features

- [Feature 008]: API Client - Depends on this Tauri setup
- [Feature 009]: Clone-Based Sessions - Desktop UI will display workspaces
- [Feature 010]: Session List UI - Builds on this foundation
- [Feature 011]: Chat Interface - Builds on this foundation

## References

- [Tauri 2.x Documentation](https://v2.tauri.app/)
- [Vite Documentation](https://vitejs.dev/)
- [React 18 Documentation](https://react.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [Shadcn UI Documentation](https://ui.shadcn.com/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright for Tauri](https://tauri.app/v1/guides/testing/webdriver/introduction)

---

**Document History**:
- 2025-10-24: Initial implementation
- 2025-10-25: Converted to proper use-case format with template structure
