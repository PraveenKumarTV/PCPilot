'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const PcpilotMcpClient = require('../backend/mcp/client');

const projectRoot = path.resolve(__dirname, '..');

test('MCP client discovers Phase 1 and Phase 4 tools', async () => {
  const mcp = new PcpilotMcpClient({ projectRoot });

  try {
    const result = await mcp.listTools();
    const names = result.tools.map((tool) => tool.name).sort();

    assert.deepEqual(names, [
      'delete_selected_files',
      'find_duplicate_files',
      'find_old_files',
      'get_cpu_usage',
      'get_directory_tree',
      'get_disk_usage',
      'get_file_metadata',
      'get_folder_size',
      'get_folder_sizes',
      'get_largest_files',
      'get_process_details',
      'get_ram_usage',
      'get_system_info',
      'get_top_cpu_processes',
      'get_top_memory_processes',
      'list_running_processes',
      'scan_cleanup_candidates',
      'scan_temporary_files',
      'search_files',
    ]);
  } finally {
    await mcp.close();
  }
});

test('MCP client calls get_ram_usage through stdio', async () => {
  const mcp = new PcpilotMcpClient({ projectRoot });

  try {
    const result = await mcp.callTool('get_ram_usage');
    assert.equal(result.isError, undefined);

    const text = result.content.find((item) => item.type === 'text')?.text;
    assert.equal(typeof text, 'string');

    const ram = JSON.parse(text);
    assert.ok(ram.totalBytes > 0);
    assert.ok(ram.usagePercentage >= 0 && ram.usagePercentage <= 100);
  } finally {
    await mcp.close();
  }
});
