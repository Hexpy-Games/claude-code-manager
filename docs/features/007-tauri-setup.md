# Feature 007: Tauri Project Setup

**Status**: In Progress
**Priority**: High (Phase 2 foundation)
**Estimated Effort**: 1 day

## Overview

Set up the Tauri desktop application in the monorepo with proper TypeScript, React, TailwindCSS, and Shadcn UI configuration. This feature establishes the foundation for all Phase 2 desktop UI features.

## Goals

1. Initialize Tauri 2.x project in `apps/desktop/`
2. Configure React 18 with TypeScript
3. Set up TailwindCSS for styling
4. Configure Shadcn UI component library
5. Integrate with monorepo build system (Turbo, pnpm)
6. Set up testing infrastructure (Vitest for unit tests, Playwright for E2E)
7. Configure Tauri permissions and capabilities

## Technical Design

### Directory Structure

```
apps/desktop/
├── src/                          # React application source
│   ├── components/              # React components
│   │   └── ui/                  # Shadcn UI components
│   ├── lib/                     # Utility functions
│   │   └── utils.ts             # cn() helper and other utils
│   ├── styles/                  # Global styles
│   │   └── globals.css          # TailwindCSS imports
│   ├── App.tsx                  # Root component
│   ├── main.tsx                 # React entry point
│   └── vite-env.d.ts            # Vite type definitions
├── src-tauri/                   # Rust/Tauri backend
│   ├── src/
│   │   ├── lib.rs               # Tauri app setup
│   │   └── main.rs              # Rust entry point
│   ├── Cargo.toml               # Rust dependencies
│   ├── tauri.conf.json          # Tauri configuration
│   └── capabilities/            # Tauri capability definitions
├── e2e/                         # E2E tests
│   └── app.spec.ts              # Basic app launch tests
├── index.html                   # HTML entry point
├── package.json                 # Package configuration
├── tsconfig.json                # TypeScript config
├── tsconfig.node.json           # Node-specific TS config
├── vite.config.ts               # Vite bundler config
├── tailwind.config.js           # TailwindCSS config
├── postcss.config.js            # PostCSS config
├── components.json              # Shadcn UI config
└── vitest.config.ts             # Vitest testing config
```

### Technology Stack

- **Tauri**: 2.x (Rust + Web frontend)
- **Frontend Framework**: React 18.x
- **Language**: TypeScript 5.6.x
- **Bundler**: Vite 5.x
- **Styling**: TailwindCSS 3.x
- **UI Components**: Shadcn UI
- **State Management**: (To be added in Feature 009 - Zustand)
- **Testing**:
  - Unit/Component: Vitest + React Testing Library
  - E2E: Playwright

### Package Configuration

**package.json**:
```json
{
  "name": "@claude-code-manager/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "lint": "biome check src",
    "lint:fix": "biome check --write src",
    "format": "biome format --write src",
    "clean": "rm -rf dist node_modules .turbo src-tauri/target"
  },
  "dependencies": {
    "@claude-code-manager/shared": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.8",
    "@vitest/ui": "^2.1.8",
    "jsdom": "^25.0.1",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@playwright/test": "^1.48.2",
    "tailwindcss": "^3.4.15",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20"
  }
}
```

### TypeScript Configuration

**tsconfig.json** (extends root):
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src-tauri"]
}
```

### Vite Configuration

**vite.config.ts**:
```typescript
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
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
```

### Vitest Configuration

**vitest.config.ts**:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/',
      ],
    },
  },
});
```

### TailwindCSS Configuration

**tailwind.config.js**:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {},
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

### Tauri Configuration

**src-tauri/tauri.conf.json** (key sections):
```json
{
  "productName": "Claude Code Manager",
  "version": "0.1.0",
  "identifier": "com.claude-code-manager.app",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Claude Code Manager",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  }
}
```

## Implementation Plan

### Step 1: Initialize Tauri Project

1. Create `apps/desktop/` directory
2. Run `pnpm create tauri-app` in apps directory
3. Select React + TypeScript template
4. Configure as `@claude-code-manager/desktop`

### Step 2: Configure Monorepo Integration

1. Update `apps/desktop/package.json` with scripts
2. Add `@claude-code-manager/shared` dependency
3. Ensure TypeScript extends root config
4. Verify Turbo orchestration works

### Step 3: Set Up TailwindCSS

1. Install TailwindCSS, PostCSS, Autoprefixer
2. Create `tailwind.config.js`
3. Create `postcss.config.js`
4. Create `src/styles/globals.css` with Tailwind imports
5. Import globals.css in main.tsx

### Step 4: Set Up Shadcn UI

1. Initialize Shadcn UI: `pnpm dlx shadcn-ui@latest init`
2. Configure `components.json`
3. Create `src/lib/utils.ts` with `cn()` helper
4. Install first component to test: `pnpm dlx shadcn-ui@latest add button`

### Step 5: Set Up Testing Infrastructure

1. Install Vitest, React Testing Library, jsdom
2. Create `vitest.config.ts`
3. Create test setup file: `src/test/setup.ts`
4. Install Playwright for E2E
5. Initialize Playwright: `pnpm dlx playwright install`
6. Create `e2e/app.spec.ts` for basic tests

### Step 6: Configure Tauri Permissions

1. Review default permissions in `src-tauri/tauri.conf.json`
2. Set up capabilities for HTTP requests (for API communication)
3. Configure file system access if needed

### Step 7: Create Basic App Structure

1. Create placeholder `App.tsx` with Tailwind test
2. Test dev mode: `pnpm dev`
3. Test build: `pnpm build`
4. Verify hot reload works
5. Verify Shadcn UI button renders

## Test Plan

### Unit Tests

**Test File**: `src/App.test.tsx`
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('should render without crashing', () => {
    render(<App />);
    expect(screen.getByText(/Claude Code Manager/i)).toBeInTheDocument();
  });

  it('should apply Tailwind styles correctly', () => {
    render(<App />);
    const element = screen.getByTestId('app-container');
    expect(element).toHaveClass('min-h-screen');
  });
});
```

**Test File**: `src/lib/utils.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('should merge class names', () => {
    expect(cn('class-1', 'class-2')).toBe('class-1 class-2');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'conditional')).toBe('base');
    expect(cn('base', true && 'conditional')).toBe('base conditional');
  });

  it('should merge Tailwind classes without conflicts', () => {
    // Tailwind-merge should handle conflicting utilities
    expect(cn('px-2 py-1', 'p-3')).toBe('p-3');
  });
});
```

### E2E Tests

**Test File**: `e2e/app.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Desktop App', () => {
  test('should launch successfully', async ({ page }) => {
    // Playwright will launch the Tauri app
    await expect(page).toHaveTitle(/Claude Code Manager/);
  });

  test('should render main interface', async ({ page }) => {
    const heading = page.getByText(/Claude Code Manager/i);
    await expect(heading).toBeVisible();
  });

  test('should apply dark mode by default', async ({ page }) => {
    const body = page.locator('body');
    await expect(body).toHaveClass(/dark/);
  });
});
```

### Configuration Tests

**Test File**: `__tests__/config.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Configuration Files', () => {
  it('should have valid package.json', () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '../package.json'), 'utf-8')
    );
    expect(pkg.name).toBe('@claude-code-manager/desktop');
    expect(pkg.type).toBe('module');
  });

  it('should have valid Tauri config', () => {
    const tauriConf = JSON.parse(
      readFileSync(join(__dirname, '../src-tauri/tauri.conf.json'), 'utf-8')
    );
    expect(tauriConf.productName).toBe('Claude Code Manager');
    expect(tauriConf.identifier).toBe('com.claude-code-manager.app');
  });
});
```

## Acceptance Criteria

- [ ] Tauri project initialized in `apps/desktop/`
- [ ] Package named `@claude-code-manager/desktop`
- [ ] TypeScript configuration extends root
- [ ] React 18 with TypeScript working
- [ ] TailwindCSS installed and configured
- [ ] Shadcn UI initialized with at least one component
- [ ] `pnpm dev` launches Tauri app in development mode
- [ ] `pnpm build` creates production build
- [ ] Hot reload works in development
- [ ] Vitest configured for unit tests
- [ ] Playwright configured for E2E tests
- [ ] All tests passing (unit + E2E)
- [ ] Linting and formatting work with Biome
- [ ] Integrated with Turbo build system
- [ ] Basic App component renders with Tailwind styles
- [ ] Shadcn UI button component works

## Dependencies

None (this is the foundation feature for Phase 2)

## Dependent Features

- Feature 008: API Client (needs this Tauri setup)
- Feature 009: Session List Component (needs UI framework)
- Feature 010: Chat Interface Component (needs UI framework)
- Feature 011: Settings Panel (needs UI framework)

## Notes

- Tauri 2.x is a major version with breaking changes from 1.x
- Vite is the recommended bundler for Tauri 2.x
- Shadcn UI is not a component library but a collection of copy-paste components
- Using `workspace:*` for internal dependencies ensures monorepo compatibility
- Playwright E2E tests for Tauri apps require special setup
- Tauri apps have both frontend (React) and backend (Rust) code
- The `src-tauri/` directory contains Rust code and is managed by Cargo

## References

- [Tauri 2.x Documentation](https://v2.tauri.app/)
- [Vite Documentation](https://vitejs.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [Shadcn UI Documentation](https://ui.shadcn.com/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright for Tauri](https://tauri.app/v1/guides/testing/webdriver/introduction)
