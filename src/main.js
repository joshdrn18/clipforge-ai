import './style.css';

const state = { mode: 'auto', aspectRatio: '9:16', jobs: [], agents: [], assets: [], selectedFile: null, apiOnline: false };
const $ = (s) => document.querySelector(s);
const fmtBytes = (n) => n < 1024 * 1024 ? (n / 1024).toFixed(0) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB';
const fmtDuration = (s) => s ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '—';

document.querySelector('#app').innerHTML = `
<div class="shell">
  <aside class="sidebar">
    <a class="brand" href="#"><span class="brand-mark"><i></i><i></i><i></i></span><span>clipforge<span class="brand-ai">.ai</span></span></a>
    <div class="workspace-label">WORKSPACE <span class="live-dot"></span></div>
    <nav>
      <a class="nav-item active" href="#"><span class="nav-icon">▦</span> Overview</a>
      <a class="nav-item" href="#queue"><span class="nav-icon">◷</span> Processing queue <span class="nav-count" id="queue-count">0</span></a>
      <a class="nav-item" href="#agents"><span class="nav-icon">⌘</span> Processing agents</a>
      <a class="nav-item" href="#outputs"><span class="nav-icon">▤</span> Clip library</a>
    </nav>
    <div class="sidebar-bottom">
      <div class="storage-card"><div class="storage-icon">◈</div><div><b>Local-first compute</b><small>Choose where heavy processing runs.</small></div></div>
      <div class="profile"><div class="avatar">CF</div><div><b>My workspace</b><small>Personal instance</small></div><span class="dots">···</span></div>
    </div>
  </aside>
  <main class="main">
    <header class="topbar"><div class="crumb">Workspace <span>/</span> Overview</div><div class="top-actions"><span class="system-status"><i id="api-dot"></i><span id="api-label">Checking system</span></span><button class="icon-button" title="Notifications">♧</button><div class="avatar small">CF</div></div></header>
    <section class="welcome"><div><div class="eyebrow"><span class="spark">✦</span> AI VIDEO WORKSPACE</div><h1>Make every moment<br><em>worth watching.</em></h1><p>Turn long videos into scroll-stopping clips. Process privately on your own machine or scale with a cloud worker.</p></div><div class="welcome-art"><div class="art-ring ring-one"></div><div class="art-ring ring-two"></div><div class="play-tile">▶</div><span class="art-tag tag-top">AI HIGHLIGHTS</span><span class="art-tag tag-bottom">9:16 READY</span></div></section>
    <section class="metrics">
      <div class="metric"><span class="metric-label">TOTAL JOBS</span><strong id="metric-jobs">0</strong><small>Across this workspace</small></div>
      <div class="metric"><span class="metric-label">IN QUEUE</span><strong id="metric-queue">0</strong><small>Waiting to be processed</small></div>
      <div class="metric"><span class="metric-label">CONNECTED AGENTS</span><strong id="metric-agents">0</strong><small>Local + cloud workers</small></div>
      <div class="metric accent-metric"><span class="metric-label">PROCESSING MODE</span><strong id="metric-mode">AUTO</strong><small>Smart agent selection</small></div>
    </section>
    <section class="content-grid">
      <div class="panel upload-panel">
        <div class="panel-heading"><div><span class="step-label">01 / NEW PROJECT</span><h2>Start with a video</h2><p>Upload a source file to prepare a clipping job.</p></div><span class="panel-symbol">↗</span></div>
        <label class="dropzone" id="dropzone" for="file-input"><input id="file-input" type="file" accept="video/*,.mp4,.mov,.mkv,.webm" /><span class="upload-symbol">↑</span><b>Drop your video here</b><span>or <u>browse files</u> from your device</span><small>MP4, MOV, MKV, WEBM · Duration limited by available processing capacity</small></label>
        <div class="file-selected" id="file-selected" hidden></div>
        <div class="field-row"><label>PROCESSING MODE</label><div class="mode-select" role="group"><button data-mode="auto" class="mode-option selected">Auto <small>Recommended</small></button><button data-mode="local" class="mode-option">Local <small>Your device</small></button><button data-mode="cloud" class="mode-option">Cloud <small>Remote server</small></button></div></div>
        <div class="field-row"><label>CLIP FORMAT</label><div class="format-pills"><button type="button" data-ratio="9:16" class="format-pill active">▯ 9:16 Vertical</button><button type="button" data-ratio="16:9" class="format-pill">▭ 16:9</button><button type="button" data-ratio="1:1" class="format-pill">□ 1:1</button></div></div>
        <button class="primary-button" id="create-job" disabled><span>✦</span> Prepare clipping job <span class="button-arrow">→</span></button>
        <p class="form-note" id="form-note">Choose a video to continue. Rendering requires a connected local or cloud agent.</p>
      </div>
      <div class="right-column">
        <div class="panel agent-panel" id="agents"><div class="panel-heading compact"><div><span class="step-label">02 / COMPUTE</span><h2>Processing agents</h2></div><span class="status-chip" id="agent-status">SCANNING</span></div>
          <div class="agent-row"><div class="agent-icon local-icon">⌂</div><div class="agent-info"><b>Local processing</b><small>Run on your own computer</small></div><span class="agent-state offline" id="local-state">Offline</span></div>
          <div class="agent-row"><div class="agent-icon cloud-icon">☁</div><div class="agent-info"><b>Cloud processing</b><small>Dedicated remote compute</small></div><span class="agent-state offline" id="cloud-state">Not configured</span></div>
          <div class="agent-footer"><span>Agent connection is outbound-only</span><a href="#setup">Setup guide ↗</a></div>
        </div>
        <div class="tip-card"><span class="tip-icon">✳</span><div><b>One workspace. Two ways to process.</b><p>Use local compute for privacy and zero server fees. Add a cloud worker when you need longer or parallel jobs.</p></div></div>
      </div>
    </section>
    <section class="panel queue-panel" id="queue"><div class="panel-heading compact"><div><span class="step-label">03 / ACTIVITY</span><h2>Recent jobs</h2></div><a href="#queue" class="text-link">View all <span>→</span></a></div><div id="jobs-list" class="jobs-list"><div class="empty-state"><div class="empty-icon">▤</div><b>Your next great clip starts here</b><span>Jobs you create will appear in this queue.</span></div></div></section>
    <section class="panel library-panel" id="outputs">
      <div class="panel-heading compact"><div><span class="step-label">04 / EXPORTS</span><h2>Clip library</h2><p>Rendered clips saved from your processing jobs.</p></div><span class="status-chip" id="library-count">0 CLIPS</span></div>
      <div id="assets-list" class="assets-grid"><div class="empty-state"><div class="empty-icon">▤</div><b>Your finished clips will appear here</b><span>Once an agent renders a job, preview and download the MP4 here.</span></div></div>
    </section>
    <section class="setup-strip" id="setup"><div><span class="step-label">NEXT STEP</span><b>Connect your first processing agent</b><p>The web workspace is ready. Install the local agent or configure a remote worker to start rendering.</p></div><a href="https://github.com/artbyjazi/autoclip" target="_blank" rel="noreferrer">Explore AutoClip engine ↗</a></section>
    <footer>CLIPFORGE AI <span>·</span> Built for creators who make more with less.</footer>
  </main>
</div>`;

async function refresh() {
  try {
    const [health, jobs, agents, assets] = await Promise.all([
      fetch('/api/health').then(r => r.json()),
      fetch('/api/jobs').then(r => r.json()),
      fetch('/api/agents').then(r => r.json()),
      fetch('/api/assets').then(r => r.json())
    ]);
    state.apiOnline = !!health.ok;
    state.jobs = jobs.jobs || [];
    state.agents = agents.agents || [];
    state.assets = assets.assets || [];
    $('#api-dot').className = state.apiOnline ? 'online' : 'offline-dot';
    $('#api-label').textContent = state.apiOnline ? 'System operational' : 'API unavailable';
    $('#metric-jobs').textContent = state.jobs.length;
    $('#metric-queue').textContent = state.jobs.filter(j => ['queued','processing'].includes(j.status)).length;
    $('#queue-count').textContent = state.jobs.filter(j => ['queued','processing'].includes(j.status)).length;
    $('#metric-agents').textContent = state.agents.filter(a => a.status === 'online').length;
    $('#agent-status').textContent = state.agents.some(a => a.status === 'online') ? 'CONNECTED' : 'NO AGENTS';
    const localAgent = state.agents.find(a => a.mode === 'local' && a.status === 'online');
    const cloudAgent = state.agents.find(a => a.mode === 'cloud' && a.status === 'online');
    const isPipelineReady = agent => {
      try { return JSON.parse(agent?.capabilities_json || '{}').pipeline_ready === true; }
      catch { return false; }
    };
    $('#local-state').textContent = !localAgent ? 'Offline' : (isPipelineReady(localAgent) ? 'Ready' : 'Setup required');
    $('#cloud-state').textContent = !cloudAgent ? 'Not configured' : (isPipelineReady(cloudAgent) ? 'Ready' : 'Setup required');
    $('#local-state').className = 'agent-state ' + (localAgent && isPipelineReady(localAgent) ? 'online-state' : 'offline');
    $('#cloud-state').className = 'agent-state ' + (cloudAgent && isPipelineReady(cloudAgent) ? 'online-state' : 'offline');
    renderJobs();
    renderAssets();
  } catch {
    $('#api-label').textContent = 'Waiting for deployment';
    $('#api-dot').className = 'offline-dot';
  }
}
function renderJobs() {
  const root = $('#jobs-list');
  if (!state.jobs.length) {
    root.innerHTML = '<div class="empty-state"><div class="empty-icon">▤</div><b>Your next great clip starts here</b><span>Jobs you create will appear in this queue.</span></div>';
    return;
  }
  root.innerHTML = state.jobs.map(j => {
    const actions = j.status === 'failed'
      ? `<div class="job-actions"><button class="job-action retry" data-job-action="retry" data-job-id="${escapeHtml(j.id)}">↻ Retry</button><button class="job-action delete" data-job-action="delete" data-job-id="${escapeHtml(j.id)}">Delete</button></div>`
      : j.status === 'queued'
        ? `<div class="job-actions"><button class="job-action cancel" data-job-action="cancel" data-job-id="${escapeHtml(j.id)}">Cancel</button></div>`
        : j.status === 'cancelled'
          ? `<div class="job-actions"><button class="job-action delete" data-job-action="delete" data-job-id="${escapeHtml(j.id)}">Delete</button></div>`
          : '';
    const error = j.error ? `<small class="job-error">${escapeHtml(j.error)}</small>` : '';
    return `<div class="job-row">
      <div class="job-thumb">▶</div>
      <div class="job-details"><b>${escapeHtml(j.source_name)}</b><small>${fmtBytes(j.source_size || 0)} · ${fmtDuration(j.duration_seconds)} · ${escapeHtml(j.processing_mode || 'auto').toUpperCase()}</small>${error}</div>
      <div class="job-progress"><span>${escapeHtml(j.stage || j.status)}</span><div><i style="width:${Math.max(0,Math.min(100,j.progress || 0))}%"></i></div></div>
      <span class="job-status status-${escapeHtml(j.status)}">${escapeHtml(j.status)}</span>
      ${actions}
    </div>`;
  }).join('');
  root.querySelectorAll('[data-job-action]').forEach(button => {
    button.addEventListener('click', () => handleJobAction(button.dataset.jobId, button.dataset.jobAction, button));
  });
}
async function handleJobAction(jobId, action, button) {
  const prompts = {
    retry: 'Retry this failed job? The existing partial clips will be cleared and the original source will be processed again.',
    cancel: 'Cancel this queued job? It has not started processing yet.',
    delete: 'Permanently delete this job and its stored source/output files?'
  };
  if (!window.confirm(prompts[action] || 'Continue?')) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = action === 'retry' ? 'Retrying…' : action === 'cancel' ? 'Cancelling…' : 'Deleting…';
  try {
    const response = await fetch('/api/jobs/' + encodeURIComponent(jobId), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Job action failed');
    await refresh();
  } catch (error) {
    window.alert(error.message);
    button.disabled = false;
    button.textContent = original;
  }
}
function renderAssets() {
  const root = $('#assets-list');
  $('#library-count').textContent = state.assets.length + ' CLIPS';
  if (!state.assets.length) {
    root.innerHTML = '<div class="empty-state"><div class="empty-icon">▤</div><b>Your finished clips will appear here</b><span>Once an agent renders a job, preview and download the MP4 here.</span></div>';
    return;
  }
  root.innerHTML = state.assets.map(asset => {
    const url = '/api/assets/' + encodeURIComponent(asset.id);
    return `<article class="asset-card">
      <video controls preload="metadata" playsinline src="${url}"></video>
      <div class="asset-meta"><b>${escapeHtml(asset.file_name || 'clip.mp4')}</b><small>${fmtBytes(asset.size_bytes || 0)} · ${escapeHtml(asset.source_name || 'Source video')}</small></div>
      <a class="asset-download" href="${url}" download="${escapeHtml(asset.file_name || 'clip.mp4')}">↓ Download MP4</a>
    </article>`;
  }).join('');
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const fileInput = $('#file-input');
fileInput.addEventListener('change', () => {
  state.selectedFile = fileInput.files?.[0] || null;
  const f = state.selectedFile;
  $('#file-selected').hidden = !f;
  if (f) {
    $('#file-selected').innerHTML = `<span>▣</span><div><b>${escapeHtml(f.name)}</b><small>${fmtBytes(f.size)}</small></div><button id="remove-file" type="button">×</button>`;
    $('#remove-file').onclick = () => { fileInput.value = ''; state.selectedFile = null; $('#file-selected').hidden = true; $('#create-job').disabled = true; };
    $('#create-job').disabled = false;
    $('#form-note').textContent = 'File selected. Clicking below uploads the video to R2 in chunks before adding it to the processing queue.';
  } else $('#create-job').disabled = true;
});
$('#dropzone').addEventListener('dragover', e => { e.preventDefault(); $('#dropzone').classList.add('dragging'); });
$('#dropzone').addEventListener('dragleave', () => $('#dropzone').classList.remove('dragging'));
$('#dropzone').addEventListener('drop', e => {
  e.preventDefault(); $('#dropzone').classList.remove('dragging');
  const f = e.dataTransfer.files?.[0];
  if (f && (f.type.startsWith('video/') || /\.(mp4|mov|mkv|webm)$/i.test(f.name))) {
    const transfer = new DataTransfer(); transfer.items.add(f); fileInput.files = transfer.files; fileInput.dispatchEvent(new Event('change'));
  }
});
document.querySelectorAll('[data-ratio]').forEach(b => b.addEventListener('click', () => {
  state.aspectRatio = b.dataset.ratio;
  document.querySelectorAll('[data-ratio]').forEach(x => x.classList.toggle('active', x === b));
}));
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
  state.mode = b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('selected', x === b));
  $('#metric-mode').textContent = state.mode.toUpperCase();
}));
$('#create-job').addEventListener('click', async () => {
  const f = state.selectedFile; if (!f) return;
  const btn = $('#create-job');
  let uploadInfo = null;
  btn.disabled = true;
  const setProgress = (message) => { $('#form-note').textContent = message; btn.innerHTML = '<span class="spinner"></span> ' + message; };
  try {
    setProgress('Creating job…');
    const response = await fetch('/api/jobs', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({source_name:f.name,source_size:f.size,processing_mode:state.mode,settings:{aspect_ratio:state.aspectRatio}}) });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Could not create job');
    const jobId = data.job.id;

    setProgress('Preparing secure video upload…');
    const initResponse = await fetch('/api/uploads/init', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({job_id:jobId,file_name:f.name,file_size:f.size,content_type:f.type || 'application/octet-stream'}) });
    uploadInfo = await initResponse.json();
    if (!initResponse.ok || !uploadInfo.ok) throw new Error(uploadInfo.error || 'Could not initialize upload');

    const chunkSize = uploadInfo.part_size || (16 * 1024 * 1024);
    const totalParts = Math.ceil(f.size / chunkSize);
    const parts = [];
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * chunkSize;
      const end = Math.min(start + chunkSize, f.size);
      setProgress('Uploading video ' + Math.round((end / f.size) * 100) + '%…');
      const partResponse = await fetch('/api/uploads/part?upload_id=' + encodeURIComponent(uploadInfo.upload_id) + '&key=' + encodeURIComponent(uploadInfo.key) + '&part_number=' + partNumber, {
        method:'POST', headers:{'Content-Type':'application/octet-stream'}, body:f.slice(start, end)
      });
      const partData = await partResponse.json();
      if (!partResponse.ok || !partData.ok) throw new Error(partData.error || 'Upload failed at part ' + partNumber);
      parts.push({part_number:partNumber, etag:partData.etag});
    }

    setProgress('Finalizing upload…');
    const completeResponse = await fetch('/api/uploads/complete', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({job_id:jobId,upload_id:uploadInfo.upload_id,key:uploadInfo.key,parts}) });
    const completeData = await completeResponse.json();
    if (!completeResponse.ok || !completeData.ok) throw new Error(completeData.error || 'Could not finalize video upload');

    $('#form-note').textContent = 'Video uploaded successfully. The job is queued and waiting for a connected processing agent.';
    fileInput.value = ''; state.selectedFile = null; $('#file-selected').hidden = true;
    await refresh();
  } catch (e) {
    if (uploadInfo?.upload_id && uploadInfo?.key) {
      fetch('/api/uploads/abort', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({upload_id:uploadInfo.upload_id,key:uploadInfo.key}) }).catch(() => {});
    }
    $('#form-note').textContent = 'Upload did not finish: ' + e.message + '. You can retry the upload.';
    await refresh();
  } finally {
    btn.disabled = !state.selectedFile;
    btn.innerHTML = '<span>✦</span> Prepare clipping job <span class="button-arrow">→</span>';
  }
});
refresh();
setInterval(refresh, 12000);

// ClipForge UI bundle entrypoint.
