'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const z = require('zod');

const systemService = require('../services/systemService');
const fileService = require('../services/fileService');
const processService = require('../services/processService');
const cleanupService = require('../services/cleanupService');

const server = new McpServer({
  name: 'pcpilot-local-server',
  version: '1.0.0',
});

function textResult(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  };
}

server.registerTool('get_system_info', {
  title: 'Get system information',
  description: 'Returns operating system, platform, architecture, hostname, and uptime.',
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async () => textResult(await systemService.getSystemInfo()));

server.registerTool('get_cpu_usage', {
  title: 'Get CPU usage',
  description: 'Returns current CPU usage, core count, model, and speed.',
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async () => textResult(await systemService.getCpuUsage()));

server.registerTool('get_ram_usage', {
  title: 'Get RAM usage',
  description: 'Returns total, used, free, available RAM, and usage percentage.',
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async () => textResult(await systemService.getRamUsage()));

server.registerTool('get_disk_usage', {
  title: 'Get disk usage',
  description: 'Returns capacity and usage details for available disks and partitions.',
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async () => textResult(await systemService.getDiskUsage()));

server.registerTool('get_folder_size', {
  title: 'Get folder size',
  description: 'Calculates the size and item counts for an allowed directory.',
  inputSchema: z.object({ path: z.string().min(1) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ path }) => textResult(await fileService.getFolderSize(path)));

server.registerTool('get_folder_sizes', {
  title: 'Get folder sizes',
  description: 'Returns immediate subfolders of an allowed directory sorted from largest to smallest by recursive size.',
  inputSchema: z.object({ path: z.string().min(1), limit: z.number().int().min(1).max(1000).default(100) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ path, limit }) => textResult(await fileService.getFolderSizes(path, limit)));

server.registerTool('get_largest_files', {
  title: 'Get largest files',
  description: 'Finds the largest files inside an allowed directory.',
  inputSchema: z.object({ path: z.string().min(1), limit: z.number().int().min(1).max(1000).default(100) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ path, limit }) => textResult(await fileService.getLargestFiles(path, limit)));

server.registerTool('search_files', {
  title: 'Search files',
  description: 'Searches allowed files and directories by case-insensitive name.',
  inputSchema: z.object({ path: z.string().min(1), keyword: z.string().min(1) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ path, keyword }) => textResult(await fileService.searchFiles(path, keyword)));

server.registerTool('get_file_metadata', {
  title: 'Get file metadata',
  description: 'Returns metadata for a file or directory inside an allowed directory.',
  inputSchema: z.object({ path: z.string().min(1) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ path }) => textResult(await fileService.getFileMetadata(path)));

server.registerTool('find_old_files', {
  title: 'Find old files',
  description: 'Finds allowed files that have not been modified within the requested number of days.',
  inputSchema: z.object({ path: z.string().min(1), days: z.number().int().min(1).max(36500) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ path, days }) => textResult(await fileService.findOldFiles(path, days)));

server.registerTool('find_duplicate_files', {
  title: 'Find duplicate files',
  description: 'Finds duplicate allowed files using size and streaming SHA-256 content hashes.',
  inputSchema: z.object({ path: z.string().min(1) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ path }) => textResult(await fileService.findDuplicateFiles(path)));

server.registerTool('get_directory_tree', {
  title: 'Get directory tree',
  description: 'Returns a bounded structured directory tree for an allowed directory.',
  inputSchema: z.object({ path: z.string().min(1), maxDepth: z.number().int().min(0).max(20).default(3) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ path, maxDepth }) => textResult(await fileService.getDirectoryTree(path, maxDepth)));

server.registerTool('list_running_processes', {
  title: 'List running processes',
  description: 'Returns running processes and their CPU and memory usage.',
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async () => textResult(await processService.listRunningProcesses()));

server.registerTool('get_process_details', {
  title: 'Get process details',
  description: 'Returns details for a running process by numeric PID.',
  inputSchema: z.object({ pid: z.number().int().min(1) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ pid }) => textResult(await processService.getProcessDetails(pid)));

server.registerTool('get_top_memory_processes', {
  title: 'Get top memory processes',
  description: 'Returns running processes sorted by memory usage.',
  inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(10) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ limit }) => textResult(await processService.getTopMemoryProcesses(limit)));

server.registerTool('get_top_cpu_processes', {
  title: 'Get top CPU processes',
  description: 'Returns running processes sorted by CPU usage.',
  inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(10) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ limit }) => textResult(await processService.getTopCpuProcesses(limit)));

server.registerTool('scan_temporary_files', {
  title: 'Scan temporary files',
  description: 'Reports likely temporary files inside an allowed directory without deleting anything.',
  inputSchema: z.object({ path: z.string().min(1) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ path }) => textResult(await cleanupService.scanTemporaryFiles(path)));

server.registerTool('scan_cleanup_candidates', {
  title: 'Scan cleanup candidates',
  description: 'Scans configured cleanup directories and reports candidates for review without deleting anything.',
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async () => textResult(await cleanupService.scanCleanupCandidates()));

server.registerTool('delete_selected_files', {
  title: 'Delete selected files',
  description: 'Deletes files only when given a confirmation token created by the PCPilot application.',
  inputSchema: z.object({ confirmationToken: z.string().uuid() }),
  annotations: { destructiveHint: true, openWorldHint: false },
}, async ({ confirmationToken }) => textResult(await cleanupService.deleteConfirmedFiles(confirmationToken)));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(`PCPilot MCP server failed: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { server, textResult };
