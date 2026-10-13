import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ToolExecutionResult } from './toolTypes';

const execAsync = promisify(exec);

export interface SystemDiagnostics {
  os: string;
  architecture: string;
  uptimeHours: number;
  totalMemoryGb: number;
  freeMemoryGb: number;
  usedMemoryPercent: number;
  cpuModel: string;
  cpuCores: number;
  batteryPercent?: number;
  batteryState?: string;
}

export async function getBatteryStatus(): Promise<{
  percent: number;
  status: string;
} | null> {
  if (process.platform !== 'win32') return null;

  try {
    const cmd =
      'powershell -NoProfile -NonInteractive -Command "Get-CimInstance -ClassName Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining, BatteryStatus | ConvertTo-Json"';
    const { stdout } = await execAsync(cmd, { timeout: 2500 });
    const trimmed = stdout.trim();
    if (!trimmed) return null;

    const data = JSON.parse(trimmed) as {
      EstimatedChargeRemaining?: number;
      BatteryStatus?: number;
    };
    if (typeof data.EstimatedChargeRemaining !== 'number') return null;

    const statusCodes: Record<number, string> = {
      1: 'Discharging (on battery)',
      2: 'Connected to AC power',
      3: 'Fully Charged',
      4: 'Low battery',
      5: 'Critical',
      6: 'Charging',
      7: 'Charging and High',
      8: 'Charging and Low',
      9: 'Charging and Critical',
    };

    return {
      percent: data.EstimatedChargeRemaining,
      status:
        statusCodes[data.BatteryStatus || 1] || 'Operating on battery power',
    };
  } catch {
    return null;
  }
}

export async function getSystemDiagnostics(): Promise<ToolExecutionResult> {
  const startTime = performance.now();

  const totalMem = os.totalmem() / 1024 / 1024 / 1024;
  const freeMem = os.freemem() / 1024 / 1024 / 1024;
  const usedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
  const uptimeHours = Number((os.uptime() / 3600).toFixed(1));
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model || 'Standard Processor';

  const battery = await getBatteryStatus();

  const diagnostics: SystemDiagnostics = {
    os: `Windows ${os.release()} (${process.arch})`,
    architecture: process.arch,
    uptimeHours,
    totalMemoryGb: Number(totalMem.toFixed(1)),
    freeMemoryGb: Number(freeMem.toFixed(1)),
    usedMemoryPercent: usedPercent,
    cpuModel,
    cpuCores: cpus.length,
    batteryPercent: battery?.percent,
    batteryState: battery?.status,
  };

  const elapsed = Math.round(performance.now() - startTime);

  let message = `System diagnostics nominal: RAM at ${usedPercent}%, Uptime ${uptimeHours}h.`;
  if (battery) {
    message += ` Battery is at ${battery.percent}% (${battery.status}).`;
  }

  return {
    success: true,
    message,
    data: diagnostics,
    durationMs: elapsed,
  };
}
