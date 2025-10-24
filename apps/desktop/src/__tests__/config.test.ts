import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = join(__dirname, '../../');

describe('Configuration Files', () => {
  it('should have valid package.json', () => {
    const pkgPath = join(rootDir, 'package.json');
    expect(existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    expect(pkg.name).toBe('@claude-code-manager/desktop');
    expect(pkg.type).toBe('module');
  });

  it('should have valid Tauri config', () => {
    const tauriConfPath = join(rootDir, 'src-tauri/tauri.conf.json');
    expect(existsSync(tauriConfPath)).toBe(true);

    const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf-8'));
    expect(tauriConf.productName).toBe('Claude Code Manager');
    expect(tauriConf.identifier).toBe('com.claude-code-manager.desktop');
  });

  it('should have TailwindCSS config', () => {
    const tailwindPath = join(rootDir, 'tailwind.config.js');
    expect(existsSync(tailwindPath)).toBe(true);
  });

  it('should have PostCSS config', () => {
    const postcssPath = join(rootDir, 'postcss.config.js');
    expect(existsSync(postcssPath)).toBe(true);
  });

  it('should have Shadcn UI config', () => {
    const componentsPath = join(rootDir, 'components.json');
    expect(existsSync(componentsPath)).toBe(true);

    const config = JSON.parse(readFileSync(componentsPath, 'utf-8'));
    expect(config.aliases.components).toBe('@/components');
    expect(config.aliases.utils).toBe('@/lib/utils');
  });

  it('should have vitest config', () => {
    const vitestPath = join(rootDir, 'vitest.config.ts');
    expect(existsSync(vitestPath)).toBe(true);
  });
});
