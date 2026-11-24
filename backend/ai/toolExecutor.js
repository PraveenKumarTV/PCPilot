'use strict';

const READ_ONLY_TOOLS = new Set([
  'get_system_info',
  'get_cpu_usage',
  'get_ram_usage',
  'get_disk_usage',
  'get_folder_size',
  'get_folder_sizes',
  'get_largest_files',
  'search_files',
  'get_file_metadata',
  'find_old_files',
  'find_duplicate_files',
  'get_directory_tree',
  'list_running_processes',
  'get_process_details',
  'get_top_memory_processes',
  'get_top_cpu_processes',
  'scan_temporary_files',
  'scan_cleanup_candidates',
]);

function parseToolResult(result) {
  if (result.isError) {
    const text = result.content
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n');
    throw new Error(text || 'MCP tool returned an error');
  }

  const text = result.content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n');

  if (!text) {
    return { success: true, result: null };
  }

  try {
    return { success: true, result: JSON.parse(text) };
  } catch (_error) {
    return { success: true, result: text };
  }
}

async function executeReadOnlyTool(mcpClient, toolName, argumentsValue) {
  if (!READ_ONLY_TOOLS.has(toolName)) {
    throw new Error(`Tool "${toolName}" is not permitted in this phase`);
  }

  if (!argumentsValue || typeof argumentsValue !== 'object' || Array.isArray(argumentsValue)) {
    throw new Error('Tool arguments must be a JSON object');
  }

  const result = await mcpClient.callTool(toolName, argumentsValue);
  return parseToolResult(result);
}

module.exports = { READ_ONLY_TOOLS, executeReadOnlyTool, parseToolResult };
