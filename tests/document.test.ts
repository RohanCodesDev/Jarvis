import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  validateDocumentFile,
  extractDocumentText,
  generateLocalExecutiveSummary,
  formatDocumentReport,
  analyzeDocumentFile,
} from '../src/services/tools/documentReaderTool';
import { ToolRegistry } from '../src/services/tools/toolRegistry';
import { detectDirectIntent } from '../src/services/tools/intentDetector';

describe('Stage 9: Document & Local File Intelligence', () => {
  const tempDir = path.join(process.cwd(), 'tests_temp_docs');

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Document Validation & Security Perimeter', () => {
    it('approves supported document extensions in workspace', () => {
      const docPath = path.join(tempDir, 'sample.txt');
      fs.writeFileSync(docPath, 'Test content');
      const val = validateDocumentFile(docPath);
      expect(val.valid).toBe(true);
      expect(val.extension).toBe('.txt');
    });

    it('rejects unsupported file formats like binaries and executables', () => {
      const exePath = path.join(tempDir, 'malicious.exe');
      fs.writeFileSync(exePath, 'binary');
      const val = validateDocumentFile(exePath);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('Unsupported document format');
    });

    it('rejects non-existent files with a descriptive error', () => {
      const missing = path.join(tempDir, 'ghost_file.pdf');
      const val = validateDocumentFile(missing);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('Document not found');
    });

    it('enforces directory safety boundary against path traversal', () => {
      const traversal = '..\\..\\..\\..\\Windows\\System32\\cmd.exe';
      const val = validateDocumentFile(traversal);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('Security boundary violation');
    });
  });

  describe('Multi-Format Content & Metadata Extraction', () => {
    it('extracts text and computes accurate metadata for markdown documents', async () => {
      const mdPath = path.join(tempDir, 'project_spec.md');
      const content = `# Project JARVIS Architecture Specification
This document establishes the tactical architectural guidelines for the desktop assistant.
Security protocols must ensure absolute isolation of user filesystem sandboxes.
The performance objective shall maintain sub-50ms latency across telemetry streams.`;

      fs.writeFileSync(mdPath, content, 'utf-8');
      const res = await extractDocumentText(mdPath);

      expect(res.metadata.fileName).toBe('project_spec.md');
      expect(res.metadata.extension).toBe('.md');
      expect(res.metadata.lineCount).toBeGreaterThanOrEqual(4);
      expect(res.metadata.wordCount).toBeGreaterThan(20);
      expect(res.text).toContain('Project JARVIS Architecture Specification');
    });

    it('extracts source code structure and module exports', async () => {
      const codePath = path.join(tempDir, 'cryptoHelper.ts');
      const code = `import crypto from 'node:crypto';
export class CipherEngine {
  encrypt(data: string): string {
    return data;
  }
}
export function generateAuthToken(): string {
  return 'token_xyz';
}`;

      fs.writeFileSync(codePath, code, 'utf-8');
      const res = await extractDocumentText(codePath);

      expect(res.metadata.fileName).toBe('cryptoHelper.ts');
      expect(res.metadata.extension).toBe('.ts');
      expect(res.text).toContain('CipherEngine');
    });

    it('extracts structured data and parses schema attributes', async () => {
      const dataPath = path.join(tempDir, 'config.json');
      const json = JSON.stringify(
        {
          appName: 'JARVIS',
          version: '2.5.0',
          encryption: 'AES-256-GCM',
          telemetryIntervalMs: 1000,
        },
        null,
        2,
      );

      fs.writeFileSync(dataPath, json, 'utf-8');
      const res = await extractDocumentText(dataPath);

      expect(res.metadata.extension).toBe('.json');
      expect(res.metadata.fileSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('Executive Summary Quality (Not Shortened Paragraphs)', () => {
    it('produces an authentic multi-section executive briefing with synthesized prose', () => {
      const text = `# Enterprise Cloud Migration Protocol
The purpose of this operational agreement is to migrate legacy databases to Neon Serverless PostgreSQL.
All database connections must require strict TLS 1.3 transport encryption.
Automated migration scripts shall verify data row checksums before releasing locks.
The overarching deliverable ensures high availability, zero data loss, and sub-10ms response latencies.`;

      const metadata = {
        fileName: 'Cloud_Migration.md',
        filePath: 'C:/docs/Cloud_Migration.md',
        extension: '.md',
        fileSizeBytes: 420,
        wordCount: 52,
        lineCount: 5,
        mimeType: 'text/plain',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };

      const summary = generateLocalExecutiveSummary(text, metadata);

      // Verify that the output is NOT a naive snippet collage
      expect(summary.executiveSummary).not.toContain('The document establishes The purpose');
      expect(summary.executiveSummary).not.toContain('Furthermore, analysis reveals that');
      expect(summary.executiveSummary).not.toContain('In conclusion, The overarching');

      // Verify authentic executive briefing structure
      expect(summary.overview).toContain('Cloud_Migration.md');
      expect(summary.overview).toContain('Analytical Document');
      expect(summary.executiveSummary.length).toBeGreaterThan(80);
      expect(summary.keyFindings.length).toBeGreaterThanOrEqual(3);
      expect(summary.actionableInsights.length).toBeGreaterThanOrEqual(1);

      // Verify key findings highlight actionable technical and governance statements
      const findingsText = summary.keyFindings.join(' ');
      expect(findingsText).toMatch(/(?:must|shall|deliverable|integrity|focus)/i);
    });

    it('tailors executive synthesis and architectural breakdown for source code', () => {
      const code = `import fs from 'node:fs';
export class NetworkController {
  init(): void {}
}
export function sendPacket(dest: string): boolean {
  return true;
}`;

      const metadata = {
        fileName: 'networkController.ts',
        filePath: 'C:/src/networkController.ts',
        extension: '.ts',
        fileSizeBytes: 150,
        wordCount: 16,
        lineCount: 8,
        mimeType: 'text/plain',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };

      const summary = generateLocalExecutiveSummary(code, metadata);

      expect(summary.overview).toContain('Source Code Module');
      expect(summary.executiveSummary).toContain('core application logic');
      expect(summary.sectionBreakdown.length).toBeGreaterThan(0);
      expect(summary.sectionBreakdown[0].title).toBe('Core Architecture & API Surface');
      expect(summary.sectionBreakdown[0].summary).toContain('NetworkController');
      expect(summary.actionableInsights.some((a) => a.includes('unit test'))).toBe(true);
    });

    it('prioritizes specific user queries within executive findings', () => {
      const text = `The compliance audit requires all confidential documents to be encrypted with AES-256.
Financial logs shall be retained for 7 calendar years.`;

      const metadata = {
        fileName: 'audit_policy.txt',
        filePath: 'C:/docs/audit_policy.txt',
        extension: '.txt',
        fileSizeBytes: 120,
        wordCount: 22,
        lineCount: 2,
        mimeType: 'text/plain',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };

      const summary = generateLocalExecutiveSummary(text, metadata, 'encryption standards');
      expect(summary.keyFindings[0]).toContain('Targeted Inquiry');
      expect(summary.keyFindings[0]).toContain('encryption standards');
    });

    it('formats a presentation-ready markdown report with all executive headers', () => {
      const text = `The system architecture shall utilize decoupled micro-frontends.`;
      const metadata = {
        fileName: 'architecture.txt',
        filePath: 'C:/docs/architecture.txt',
        extension: '.txt',
        fileSizeBytes: 60,
        wordCount: 7,
        lineCount: 1,
        mimeType: 'text/plain',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };

      const summary = generateLocalExecutiveSummary(text, metadata);
      const report = formatDocumentReport(summary, metadata);

      expect(report).toContain('### 📄 DOCUMENT INTELLIGENCE: ARCHITECTURE.TXT');
      expect(report).toContain('#### 🎯 Executive Summary');
      expect(report).toContain('#### 🔍 Core Findings & Strategic Takeaways');
      expect(report).toContain('#### ⚡ Actionable Insights & Directives');
    });
  });

  describe('Tool Registry Integration & Direct Intent Routing', () => {
    it('executes analyze_document via ToolRegistry and returns report', async () => {
      const testFile = path.join(tempDir, 'system_manual.md');
      fs.writeFileSync(
        testFile,
        `# JARVIS Operational Manual
The system shall monitor desktop activity.
All background commands must adhere to timeout boundaries.`,
        'utf-8',
      );

      const registry = new ToolRegistry();
      const result = await registry.executeTool('analyze_document', {
        filePath: testFile,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('analyzed successfully');
      expect((result.data as any).metadata.fileName).toBe('system_manual.md');
      expect((result.data as any).formattedReport).toMatch(/JARVIS Operational Manual/i);
    });

    it('detects direct voice/text intent for document summarization', () => {
      const action1 = detectDirectIntent('summarize document quarterly_report.pdf');
      expect(action1?.toolId).toBe('analyze_document');
      expect(action1?.args.filePath).toBe('quarterly_report.pdf');

      const action2 = detectDirectIntent('analyze file src/index.ts');
      expect(action2?.toolId).toBe('analyze_document');
      expect(action2?.args.filePath).toBe('src/index.ts');

      const action3 = detectDirectIntent('summarize contract.pdf focusing on liability');
      expect(action3?.toolId).toBe('analyze_document');
      expect(action3?.args.filePath).toBe('contract.pdf');
      expect(action3?.args.query).toBe('liability');

      const action4 = detectDirectIntent('read and summarize meeting_notes.md');
      expect(action4?.toolId).toBe('analyze_document');
      expect(action4?.args.filePath).toBe('meeting_notes.md');
    });
  });
});
