import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { findApprovedApp, launchApp } from '../src/services/tools/appLauncher';
import {
  sanitizeAndValidateUrl,
  openWebUrl,
} from '../src/services/tools/urlLauncher';
import { getSystemDiagnostics } from '../src/services/tools/systemStatsTool';
import {
  isPathSafe,
  createSafeFile,
  readSafeFile,
} from '../src/services/tools/fileTools';
import {
  detectDirectIntent,
  parseModelDirectives,
} from '../src/services/tools/intentDetector';
import { ToolRegistry } from '../src/services/tools/toolRegistry';

describe('Stage 5: Safe Desktop Actions & Windows Automation', () => {
  describe('Application Launcher Allowlist', () => {
    it('accurately identifies approved applications and aliases', () => {
      expect(findApprovedApp('spotify')?.id).toBe('spotify');
      expect(findApprovedApp('music')?.id).toBe('spotify');
      expect(findApprovedApp('Google Chrome')?.id).toBe('chrome');
      expect(findApprovedApp('vs code')?.id).toBe('vscode');
      expect(findApprovedApp('code')?.id).toBe('vscode');
      expect(findApprovedApp('calculator')?.id).toBe('calculator');
      expect(findApprovedApp('calc')?.id).toBe('calculator');
      expect(findApprovedApp('notepad')?.id).toBe('notepad');
      expect(findApprovedApp('terminal')?.id).toBe('terminal');
    });

    it('rejects unauthorized executable attempts', async () => {
      const blockedApp = await launchApp('cmd_malicious.exe', true);
      expect(blockedApp.success).toBe(false);
      expect(blockedApp.message).toContain('Access denied');
      expect(blockedApp.error).toContain('Disallowed application');
    });

    it('executes approved applications in simulation mode safely', async () => {
      const result = await launchApp('spotify', true);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Spotify launched successfully');
    });
  });

  describe('URL Launcher & Web Validation', () => {
    it('validates and normalizes valid web URLs', () => {
      expect(sanitizeAndValidateUrl('https://github.com')).toBe(
        'https://github.com/',
      );
      expect(sanitizeAndValidateUrl('google.com')).toBe('https://google.com/');
      expect(sanitizeAndValidateUrl('http://news.ycombinator.com')).toBe(
        'http://news.ycombinator.com/',
      );
    });

    it('rejects unsafe protocols and malicious schemas', () => {
      expect(sanitizeAndValidateUrl('file:///C:/Windows/System32')).toBeNull();
      expect(sanitizeAndValidateUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeAndValidateUrl('data:text/html,evil')).toBeNull();
      expect(sanitizeAndValidateUrl('')).toBeNull();
    });

    it('executes safe URLs in simulation mode', async () => {
      const res = await openWebUrl('https://anthropic.com', true);
      expect(res.success).toBe(true);
      expect(res.message).toContain('Navigated to https://anthropic.com/');
    });
  });

  describe('System Hardware Diagnostics Telemetry', () => {
    it('retrieves live host hardware metrics', async () => {
      const result = await getSystemDiagnostics();
      expect(result.success).toBe(true);
      expect(result.message).toContain('RAM at');

      const data = result.data as any;
      expect(data).toBeDefined();
      expect(typeof data.totalMemoryGb).toBe('number');
      expect(typeof data.usedMemoryPercent).toBe('number');
      expect(typeof data.uptimeHours).toBe('number');
      expect(typeof data.cpuModel).toBe('string');
      expect(data.cpuCores).toBeGreaterThan(0);
    });
  });

  describe('Sandboxed File Operations', () => {
    const testDir = path.join(os.homedir(), 'Desktop', 'jarvis_test_sandbox');
    const testFile = path.join(testDir, 'test_note.txt');

    beforeEach(() => {
      try {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
        if (fs.existsSync(testDir)) fs.rmdirSync(testDir);
      } catch {}
    });

    it('identifies and blocks unauthorized system path traversal', () => {
      const winCheck = isPathSafe('C:\\Windows\\System32\\cmd.exe');
      expect(winCheck.safe).toBe(false);
      expect(winCheck.reason).toContain(
        'Access to system or sensitive file pattern is blocked',
      );

      const envCheck = isPathSafe('C:\\Users\\User\\.env');
      expect(envCheck.safe).toBe(false);

      const sshCheck = isPathSafe('C:\\Users\\User\\.ssh\\id_rsa');
      expect(sshCheck.safe).toBe(false);
    });

    it('creates and reads safe text files within user directories', async () => {
      const writeRes = await createSafeFile(
        testFile,
        'Initial test directive from JARVIS.',
      );
      expect(writeRes.success).toBe(true);
      expect(fs.existsSync(testFile)).toBe(true);

      const readRes = await readSafeFile(testFile);
      expect(readRes.success).toBe(true);
      expect((readRes.data as any).content).toBe(
        'Initial test directive from JARVIS.',
      );

      // Clean up
      try {
        fs.unlinkSync(testFile);
        fs.rmdirSync(testDir);
      } catch {}
    });

    it('rejects disallowed file extensions', async () => {
      const badFile = path.join(
        os.homedir(),
        'Desktop',
        'jarvis_test_sandbox',
        'script.bat',
      );
      const res = await createSafeFile(badFile, 'calc.exe');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid file extension');
    });
  });

  describe('Direct Intent Detection & Model Directives', () => {
    it('detects high-confidence voice/text triggers instantly', () => {
      const spotifyIntent = detectDirectIntent('open spotify');
      expect(spotifyIntent).toEqual({
        toolId: 'open_app',
        args: { app: 'spotify' },
        confidence: 'high',
      });

      const calcIntent = detectDirectIntent('launch calc');
      expect(calcIntent?.toolId).toBe('open_app');
      expect(calcIntent?.args.app).toBe('calculator');

      const batteryIntent = detectDirectIntent('Jarvis check battery');
      expect(batteryIntent).toEqual({
        toolId: 'system_diagnostics',
        args: {},
        confidence: 'high',
      });

      const urlIntent = detectDirectIntent('open https://news.google.com');
      expect(urlIntent?.toolId).toBe('open_url');
      expect(urlIntent?.args.url).toBe('https://news.google.com');
    });

    it('parses [ACTION: toolId {args}] model directives and cleans response text', () => {
      const modelOutput =
        'Certainly, sir. [ACTION: open_app {"app": "spotify"}] Music playback initiated.';
      const parsed = parseModelDirectives(modelOutput);

      expect(parsed.actions.length).toBe(1);
      expect(parsed.actions[0].toolId).toBe('open_app');
      expect(parsed.actions[0].args).toEqual({ app: 'spotify' });
      expect(parsed.cleanedText).toBe(
        'Certainly, sir.  Music playback initiated.',
      );
    });
  });

  describe('Unified Tool Registry & Audit Trail', () => {
    let registry: ToolRegistry;

    beforeEach(() => {
      registry = new ToolRegistry();
    });

    it('lists all default registered tools', () => {
      const tools = registry.getAllTools();
      const toolIds = tools.map((t) => t.id);
      expect(toolIds).toContain('open_app');
      expect(toolIds).toContain('open_url');
      expect(toolIds).toContain('system_diagnostics');
      expect(toolIds).toContain('read_file');
      expect(toolIds).toContain('write_file');
    });

    it('validates tool arguments with Zod schemas and executes successfully', async () => {
      const res = await registry.executeTool('open_app', { app: 'notepad' });
      expect(res.success).toBe(true);

      const auditLogs = registry.getAuditLogs();
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].toolId).toBe('open_app');
      expect(auditLogs[0].success).toBe(true);
    });

    it('fails gracefully when required tool arguments are missing', async () => {
      const res = await registry.executeTool('open_app', {});
      expect(res.success).toBe(false);
      expect(res.message).toContain('Invalid parameters');

      const auditLogs = registry.getAuditLogs();
      expect(auditLogs[0].success).toBe(false);
    });
  });
});
