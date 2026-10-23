import React, { useState } from 'react';
import { Send, Mic, ScanEye, Paperclip, FileText, X } from 'lucide-react';
import type { AssistantState } from '../../types/hud';

export interface ActiveAttachedDocument {
  fileName: string;
  filePath: string;
  summary: string;
  excerpt?: string;
  wordCount?: number;
  pageCount?: number;
}

interface CommandDockProps {
  assistantState: AssistantState;
  onSendMessage: (text: string) => void;
  onVoiceTrigger: () => void;
  onInspectScreen?: (prompt?: string) => void;
  attachedDocument?: ActiveAttachedDocument | null;
  onSelectDocument?: () => void;
  onEjectDocument?: () => void;
}

export const CommandDock: React.FC<CommandDockProps> = ({
  assistantState,
  onSendMessage,
  onVoiceTrigger,
  onInspectScreen,
  attachedDocument,
  onSelectDocument,
  onEjectDocument,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || assistantState === 'thinking') return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleInspectScreenClick = () => {
    if (assistantState === 'thinking') return;
    const prompt =
      inputText.trim() ||
      'Inspect my screen and explain what is currently displayed, noting any open code, errors, or windows.';
    if (onInspectScreen) {
      onInspectScreen(prompt);
    } else {
      onSendMessage(prompt);
    }
    setInputText('');
  };

  return (
    <div className="floating-command-dock">
      {/* Active Attached Document Badge */}
      {attachedDocument && (
        <div className="command-dock-attached-badge">
          <div className="attached-badge-left">
            <FileText size={14} className="attached-badge-icon" />
            <span className="attached-badge-name" title={attachedDocument.filePath}>
              {attachedDocument.fileName}
            </span>
            {attachedDocument.wordCount !== undefined && (
              <span className="attached-badge-meta">
                {attachedDocument.wordCount.toLocaleString()}w
              </span>
            )}
            {attachedDocument.pageCount !== undefined && (
              <span className="attached-badge-meta">
                {attachedDocument.pageCount}p
              </span>
            )}
          </div>
          {onEjectDocument && (
            <button
              type="button"
              className="attached-badge-eject"
              onClick={onEjectDocument}
              title="Eject active document"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      <form className="command-input-bar" onSubmit={handleSubmit}>
        <input
          type="text"
          className="command-text-field"
          placeholder={
            attachedDocument
              ? `Ask about "${attachedDocument.fileName}"...`
              : 'Ask JARVIS anything (or attach a document)...'
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={assistantState === 'thinking'}
        />

        {/* Paperclip File Selector */}
        {onSelectDocument && (
          <button
            type="button"
            className="command-action-icon doc-attach-action"
            title="Attach & Analyze Document (PDF, TXT, Code, Data)"
            onClick={onSelectDocument}
            disabled={assistantState === 'thinking'}
          >
            <Paperclip size={18} />
          </button>
        )}

        <button
          type="button"
          className="command-action-icon vision-action"
          title="Inspect Screen (Optical Vision Scan)"
          onClick={handleInspectScreenClick}
          disabled={assistantState === 'thinking'}
        >
          <ScanEye size={18} />
        </button>

        <button
          type="button"
          className={`command-action-icon ${assistantState === 'listening' ? 'listening' : ''}`}
          title="Dictate with microphone"
          onClick={onVoiceTrigger}
        >
          <Mic size={18} />
        </button>

        <button
          type="submit"
          className="command-action-icon send-action"
          disabled={!inputText.trim() || assistantState === 'thinking'}
          title="Send directive"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
