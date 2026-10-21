import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  FastForward,
  X,
  StopCircle,
  Zap,
} from 'lucide-react';
import type { ExecutionPlan, TaskStep } from '../../services/agent/agentTypes';

interface TacticalTaskPlanCardProps {
  plan: ExecutionPlan;
  onApproveStep?: (planId: string, stepId: string) => void;
  onCancelPlan?: (planId: string) => void;
  onDismiss?: () => void;
}

export const TacticalTaskPlanCard: React.FC<TacticalTaskPlanCardProps> = ({
  plan,
  onApproveStep,
  onCancelPlan,
  onDismiss,
}) => {
  const completedSteps = plan.steps.filter(
    (s) => s.status === 'completed',
  ).length;
  const progressPercent = Math.round(
    (completedSteps / plan.steps.length) * 100,
  );

  const getStatusBadge = () => {
    switch (plan.status) {
      case 'running':
        return (
          <span className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
            Executing
          </span>
        );
      case 'awaiting_approval':
        return (
          <span className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 animate-pulse">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            Approval Required
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Mission Complete
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-red-950/80 border border-red-500/40 text-red-300">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            Mission Halted
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
            <StopCircle className="w-3 h-3 text-slate-400" />
            Aborted
          </span>
        );
      default:
        return (
          <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
            {plan.status}
          </span>
        );
    }
  };

  const renderStepIcon = (step: TaskStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'running':
        return (
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
        );
      case 'awaiting_approval':
        return (
          <ShieldAlert className="w-4 h-4 text-amber-400 animate-bounce shrink-0" />
        );
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'skipped':
        return <FastForward className="w-4 h-4 text-slate-500 shrink-0" />;
      default:
        return (
          <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0 flex items-center justify-center text-[9px] text-slate-500 font-mono">
            {step.index}
          </div>
        );
    }
  };

  return (
    <div className="relative rounded-lg border border-cyan-500/30 bg-slate-950/90 backdrop-blur-md p-4 shadow-2xl shadow-cyan-950/50 max-w-lg w-full transition-all duration-300">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-cyan-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-semibold tracking-wider uppercase text-cyan-100 font-mono">
              {plan.title}
            </h4>
            {getStatusBadge()}
          </div>
          <p className="text-[11px] text-slate-400 italic line-clamp-1">
            "{plan.prompt}"
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {plan.status === 'running' && onCancelPlan && (
            <button
              onClick={() => onCancelPlan(plan.id)}
              className="px-2 py-1 text-[10px] font-mono tracking-wider rounded bg-rose-950/80 border border-rose-500/40 text-rose-300 hover:bg-rose-900 transition-colors"
              title="Abort Mission"
            >
              Abort
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="py-2.5">
        <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
          <span>PROGRESS</span>
          <span>
            {completedSteps}/{plan.steps.length} STEPS ({progressPercent}%)
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {plan.steps.map((step) => {
          const isAwaiting = step.status === 'awaiting_approval';
          return (
            <div
              key={step.id}
              className={`p-2 rounded border text-xs font-mono transition-all ${
                isAwaiting
                  ? 'bg-amber-950/40 border-amber-500/50'
                  : step.status === 'running'
                    ? 'bg-cyan-950/30 border-cyan-500/40'
                    : step.status === 'completed'
                      ? 'bg-slate-900/60 border-emerald-500/20'
                      : step.status === 'failed'
                        ? 'bg-rose-950/40 border-rose-500/30'
                        : 'bg-slate-900/30 border-slate-800/80 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  {renderStepIcon(step)}
                  <span
                    className={`truncate ${
                      step.status === 'completed'
                        ? 'text-slate-300'
                        : step.status === 'running'
                          ? 'text-cyan-200 font-semibold'
                          : step.status === 'failed'
                            ? 'text-rose-300'
                            : 'text-slate-400'
                    }`}
                  >
                    {step.description}
                  </span>
                </div>

                {step.durationMs !== undefined && (
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {step.durationMs}ms
                  </span>
                )}
              </div>

              {/* Approval Interactivity */}
              {isAwaiting && (
                <div className="mt-2 pt-2 border-t border-amber-500/30 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-amber-300">
                    High-risk action requires executive confirmation.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onApproveStep?.(plan.id, step.id)}
                      className="px-2.5 py-1 text-[10px] font-semibold tracking-wider rounded bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
                    >
                      APPROVE
                    </button>
                    <button
                      onClick={() => onCancelPlan?.(plan.id)}
                      className="px-2 py-1 text-[10px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      DENY
                    </button>
                  </div>
                </div>
              )}

              {/* Error message display */}
              {step.error && step.status === 'failed' && (
                <div className="mt-1 text-[10px] text-rose-400 pl-6">
                  {step.error}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      {plan.summary && (
        <div className="mt-3 pt-2 border-t border-cyan-500/20 text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-line">
          {plan.summary}
        </div>
      )}
    </div>
  );
};
