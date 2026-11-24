'use strict';

const os = require('node:os');
const si = require('systeminformation');

async function getSystemInfo() {
  const [osInfo, time] = await Promise.all([
    si.osInfo(),
    si.time(),
  ]);

  let loggedInUser = null;
  try {
    loggedInUser = os.userInfo().username;
  } catch (_error) {
    loggedInUser = null;
  }

  return {
    operatingSystem: osInfo.distro || osInfo.platform || 'Unknown',
    platform: osInfo.platform,
    architecture: osInfo.arch,
    hostname: osInfo.hostname,
    uptimeSeconds: time.uptime,
    kernel: osInfo.kernel,
    release: osInfo.release,
    loggedInUser,
  };
}

async function getCpuUsage() {
  const [cpu, load] = await Promise.all([si.cpu(), si.currentLoad()]);
  return {
    usagePercentage: Number(load.currentLoad.toFixed(2)),
    coreCount: cpu.physicalCores || cpu.cores,
    model: cpu.brand,
    speedGHz: cpu.speed,
  };
}

async function getRamUsage() {
  const memory = await si.mem();
  const used = memory.used;
  const total = memory.total;

  return {
    totalBytes: total,
    usedBytes: used,
    freeBytes: memory.free,
    availableBytes: memory.available,
    usagePercentage: total ? Number(((used / total) * 100).toFixed(2)) : 0,
  };
}

async function getDiskUsage() {
  const disks = await si.fsSize();
  return disks.map((disk) => ({
    mount: disk.mount,
    filesystem: disk.fs,
    type: disk.type,
    totalBytes: disk.size,
    usedBytes: disk.used,
    freeBytes: disk.available,
    usagePercentage: Number((disk.use || 0).toFixed(2)),
  }));
}

module.exports = {
  getSystemInfo,
  getCpuUsage,
  getRamUsage,
  getDiskUsage,
};
