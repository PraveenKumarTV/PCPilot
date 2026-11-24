'use strict';

const state = { history: [], currentProcessMode: 'memory' };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '--';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = -1;
  do { value /= 1024; unit += 1; } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatUptime(seconds) {
  if (!Number.isFinite(seconds)) return '--';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 3500);
}

function setMetric(valueId, barId, detailId, percentage, detail) {
  const value = Number.isFinite(percentage) ? percentage : 0;
  $(`#${valueId}`).textContent = `${value.toFixed(1)}%`;
  $(`#${barId}`).style.width = `${Math.max(0, Math.min(100, value))}%`;
  $(`#${detailId}`).textContent = detail;
}

function renderSystemDetails(info) {
  $('#system-details').innerHTML = [
    ['Operating system', info.operatingSystem],
    ['Architecture', info.architecture],
    ['Kernel', `${info.kernel || '--'} ${info.release || ''}`],
    ['Logged-in user', info.loggedInUser || '--'],
  ].map(([label, value]) => `<div><dt>${label}</dt><dd title="${value}">${value}</dd></div>`).join('');
}

async function loadMetrics() {
  try {
    const metrics = await api('/api/system/metrics');
    const primaryDisk = metrics.disks.find((disk) => disk.mount === '/') || metrics.disks[0];
    $('#hero-host').textContent = `${metrics.info.hostname || 'Linux host'} is online`;
    $('#hero-subtitle').textContent = `${metrics.info.operatingSystem} / ${metrics.info.platform} / ${metrics.info.architecture}`;
    $('#uptime-value').textContent = formatUptime(metrics.info.uptimeSeconds);
    setMetric('cpu-value', 'cpu-bar', 'cpu-detail', metrics.cpu.usagePercentage, `${metrics.cpu.model || 'CPU'} / ${metrics.cpu.coreCount || '--'} cores`);
    setMetric('ram-value', 'ram-bar', 'ram-detail', metrics.ram.usagePercentage, `${formatBytes(metrics.ram.usedBytes)} of ${formatBytes(metrics.ram.totalBytes)}`);
    setMetric('disk-value', 'disk-bar', 'disk-detail', primaryDisk?.usagePercentage, `${primaryDisk?.mount || '--'} / ${formatBytes(primaryDisk?.freeBytes)} free`);
    renderSystemDetails(metrics.info);
    $('#last-updated').textContent = `Updated ${new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`;
  } catch (error) {
    showToast(error.message);
    $('#hero-host').textContent = 'Telemetry unavailable';
    $('#hero-subtitle').textContent = 'Start the local PCPilot backend to connect.';
  }
}

function switchView(viewName) {
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === viewName));
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${viewName}`));
  const titles = { overview: 'Your machine, clearly.', chat: 'Ask your machine.', storage: 'See what is taking space.', processes: 'Know what is running.' };
  $('#page-title').textContent = titles[viewName];
  $('#current-view').textContent = viewName.toUpperCase();
  if (viewName === 'processes') loadProcesses();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line);
}

function markdownToHtml(markdown) {
  const lines = String(markdown || '').replaceAll('\r', '').split('\n');
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const nextLine = lines[index + 1];

    if (line.includes('|') && nextLine && isTableSeparator(nextLine)) {
      const splitRow = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
      const headers = splitRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      output.push(`<div class="response-table-wrap"><table class="response-table"><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_header, cellIndex) => `<td>${inlineMarkdown(row[cellIndex] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    if (/^###\s+/.test(line)) output.push(`<h5>${inlineMarkdown(line.replace(/^###\s+/, ''))}</h5>`);
    else if (/^##\s+/.test(line)) output.push(`<h4>${inlineMarkdown(line.replace(/^##\s+/, ''))}</h4>`);
    else if (/^#\s+/.test(line)) output.push(`<h3>${inlineMarkdown(line.replace(/^#\s+/, ''))}</h3>`);
    else if (/^[-*]\s+/.test(line)) output.push(`<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`);
    else if (line.trim()) output.push(`<p>${inlineMarkdown(line)}</p>`);
    index += 1;
  }

  return output.join('');
}

function addMessage(role, text) {
  const message = document.createElement('div');
  message.className = `message ${role}`;
  const label = role === 'user' ? 'YOU' : 'PCPILOT';
  message.innerHTML = `<span class="message-label">${label}</span><div class="message-content"></div>`;
  message.querySelector('.message-content').innerHTML = role === 'assistant' ? markdownToHtml(text) : `<p>${escapeHtml(text)}</p>`;
  $('#messages').appendChild(message);
  $('#messages').scrollTop = $('#messages').scrollHeight;
}

function renderActivity(toolExecutions = []) {
  const activity = $('#tool-activity');
  if (!toolExecutions.length) { activity.textContent = 'No operations yet.'; return; }
  activity.innerHTML = toolExecutions.map((tool) => `<div class="activity-item"><strong>${tool.success ? 'COMPLETED' : 'FAILED'}</strong>${tool.name}</div>`).join('');
}

async function sendChat(event) {
  event.preventDefault();
  const input = $('#chat-input');
  const message = input.value.trim();
  if (!message) return;
  addMessage('user', message);
  input.value = '';
  const pending = document.createElement('div');
  pending.className = 'message assistant';
  pending.innerHTML = '<span class="message-label">PCPILOT / WORKING</span><p>Checking local telemetry...</p>';
  $('#messages').appendChild(pending);
  try {
    const result = await api('/api/chat', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ message, history:state.history }) });
    pending.remove();
    addMessage('assistant', result.answer);
    state.history.push({ role:'user', content:message }, { role:'assistant', content:result.answer });
    state.history = state.history.slice(-10);
    renderActivity(result.toolExecutions);
  } catch (error) {
    pending.remove();
    addMessage('assistant', `I could not complete that request: ${error.message}`);
    showToast(error.message);
  }
}

function renderProcesses(processes) {
  $('#process-results').innerHTML = processes.map((process) => `<tr><td title="${process.name}">${process.name}</td><td>${process.pid}</td><td>${process.cpuUsagePercentage.toFixed(1)}%</td><td>${process.memoryUsagePercentage.toFixed(1)}%</td><td>${process.state || '--'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-cell">No processes returned.</td></tr>';
}

async function loadProcesses() {
  const mode = state.currentProcessMode;
  $('#process-status').textContent = 'Refreshing process snapshot';
  try {
    const processes = await api(`/api/processes/top-${mode}?limit=20`);
    renderProcesses(processes);
    $('#process-status').textContent = `${processes.length} processes / sorted by ${mode}`;
  } catch (error) { $('#process-status').textContent = 'Process data unavailable'; showToast(error.message); }
}

function renderStorage(files) {
  $('#storage-results').innerHTML = files.map((file) => `<tr><td title="${file.path}">${file.path}</td><td>${formatBytes(file.sizeBytes)}</td><td>${file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : '--'}</td></tr>`).join('') || '<tr><td colspan="3" class="empty-cell">No matching files.</td></tr>';
}

async function loadStorage(mode) {
  const storagePath = encodeURIComponent($('#storage-path').value.trim());
  if (!storagePath) return showToast('Enter an allowed directory path.');
  $('#storage-status').textContent = 'Scanning local files...';
  try {
    const url = mode === 'duplicates' ? `/api/files/duplicates?path=${storagePath}` : `/api/files/largest?path=${storagePath}&limit=25`;
    const result = await api(url);
    if (mode === 'duplicates') {
      const files = result.flatMap((group) => group.paths.map((path) => ({ path, sizeBytes: group.sizeBytes })));
      renderStorage(files);
      $('#storage-status').textContent = `${result.length} duplicate groups found`;
    } else {
      renderStorage(result);
      $('#storage-status').textContent = `${result.length} largest files found`;
    }
  } catch (error) { $('#storage-status').textContent = 'Scan failed'; showToast(error.message); }
}

$$('.nav-item, [data-view="chat"]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
$('#refresh-button').addEventListener('click', loadMetrics);
$('#chat-form').addEventListener('submit', sendChat);
$('#largest-button').addEventListener('click', () => loadStorage('largest'));
$('#duplicates-button').addEventListener('click', () => loadStorage('duplicates'));
$$('.process-tab').forEach((button) => button.addEventListener('click', () => { $$('.process-tab').forEach((item) => item.classList.remove('active')); button.classList.add('active'); state.currentProcessMode = button.dataset.processMode; loadProcesses(); }));

loadMetrics();
window.setInterval(loadMetrics, 2000);
