'use strict';

const si = require('systeminformation');

function normalizeProcess(process) {
  return {
    pid: process.pid,
    name: process.name || process.command || 'unknown',
    cpuUsagePercentage: Number((process.cpu ?? 0).toFixed(2)),
    memoryUsagePercentage: Number((process.mem ?? 0).toFixed(2)),
    memoryBytes: process.memRss ?? null,
    state: process.state || null,
    command: process.command || null,
    parentPid: process.parentPid ?? null,
  };
}

async function listRunningProcesses() {
  const result = await si.processes();
  return result.list.map(normalizeProcess);
}

async function getProcessDetails(pid) {
  const processId = Number(pid);
  if (!Number.isInteger(processId) || processId < 1) throw new Error('pid must be a positive integer');
  const result = await si.processes();
  const process = result.list.find((item) => item.pid === processId);
  if (!process) throw new Error(`Process ${processId} was not found`);
  return normalizeProcess(process);
}

async function getTopMemoryProcesses(limit = 10) {
  const processes = await listRunningProcesses();
  return processes.sort((left, right) => right.memoryUsagePercentage - left.memoryUsagePercentage).slice(0, Math.min(Math.max(Number(limit) || 10, 1), 100));
}

async function getTopCpuProcesses(limit = 10) {
  const processes = await listRunningProcesses();
  return processes.sort((left, right) => right.cpuUsagePercentage - left.cpuUsagePercentage).slice(0, Math.min(Math.max(Number(limit) || 10, 1), 100));
}

module.exports = { listRunningProcesses, getProcessDetails, getTopMemoryProcesses, getTopCpuProcesses };
