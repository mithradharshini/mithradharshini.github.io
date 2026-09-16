// admin.js
const GITHUB_API_URL = 'https://api.github.com';
let ghToken = '';
let ghRepo = '';
let protoData = [];
let currentWeek = null;
let newImagesToCommit = [];

const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const weekList = document.getElementById('week-list');
const editorEmpty = document.getElementById('editor-empty');
const editorActive = document.getElementById('editor-active');
const errorMsg = document.getElementById('login-error');

// Auth Check
if (sessionStorage.getItem('ghToken') && sessionStorage.getItem('ghRepo')) {
  ghToken = sessionStorage.getItem('ghToken');
  ghRepo = sessionStorage.getItem('ghRepo');
  showDashboard();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = document.getElementById('gh-token').value.trim();
  const repo = document.getElementById('gh-repo').value.trim();
  
  errorMsg.classList.add('hidden');
  
  // Verify token
  try {
    const res = await fetch(`${GITHUB_API_URL}/repos/${repo}`, {
      headers: { Authorization: `token ${token}` }
    });
    
    if (res.ok) {
      sessionStorage.setItem('ghToken', token);
      sessionStorage.setItem('ghRepo', repo);
      ghToken = token;
      ghRepo = repo;
      showDashboard();
    } else {
      errorMsg.textContent = 'Invalid token or repository access denied.';
      errorMsg.classList.remove('hidden');
    }
  } catch (err) {
    errorMsg.textContent = 'Connection error.';
    errorMsg.classList.remove('hidden');
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('ghToken');
  sessionStorage.removeItem('ghRepo');
  window.location.reload();
});

async function showDashboard() {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
  await fetchData();
}

async function fetchData() {
  try {
    // Fetch directly from github API to avoid CDN caching
    const res = await fetch(`${GITHUB_API_URL}/repos/${ghRepo}/contents/data/protosem.json`, {
      headers: { 
        Authorization: `token ${ghToken}`,
        Accept: 'application/vnd.github.v3.raw'
      },
      cache: 'no-store'
    });
    
    if (res.ok) {
      protoData = await res.json();
      renderSidebar();
    } else if (res.status === 404) {
      // fallback to local if running locally and API fails
      const localRes = await fetch('data/protosem.json');
      protoData = await localRes.json();
      renderSidebar();
    } else {
      alert("Failed to load data from GitHub.");
    }
  } catch (err) {
    console.error(err);
    alert("Error fetching data.");
  }
}

function renderSidebar() {
  weekList.innerHTML = '';
  protoData.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'w-full text-left px-4 py-3 rounded-lg text-sm transition-colors flex justify-between items-center group mb-1 hover:bg-gray-100';
    btn.innerHTML = `
      <div>
        <span class="block font-medium text-gray-900">Week ${String(item.week).padStart(2, '0')}</span>
        <span class="block text-xs text-gray-500 truncate w-40">${item.title || 'Untitled'}</span>
      </div>
      <span class="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-md ${item.status === 'documented' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}">${item.status}</span>
    `;
    btn.onclick = () => selectWeek(item.week);
    weekList.appendChild(btn);
  });
}

function selectWeek(weekNum) {
  currentWeek = protoData.find(w => w.week === weekNum);
  editorEmpty.classList.add('hidden');
  editorActive.classList.remove('hidden');
  editorActive.classList.add('flex');
  
  document.getElementById('editor-header').textContent = `Editing Week ${String(currentWeek.week).padStart(2, '0')}`;
  document.getElementById('edit-title').value = currentWeek.title || '';
  document.getElementById('edit-desc').value = currentWeek.description || '';
  
  renderImages();
}

function renderImages() {
  const container = document.getElementById('image-gallery-editor');
  container.innerHTML = '';
  
  const images = currentWeek.images || [];
  images.forEach((img, idx) => {
    const el = document.createElement('div');
    el.className = 'border border-gray-200 rounded-lg p-2 relative bg-gray-50';
    
    // Check if it's a new unsaved image
    const isNew = img.src.startsWith('data:image');
    const imgSrc = isNew ? img.src : `../${img.src}`; // adjust path for preview if local, but we might just use github raw
    
    el.innerHTML = `
      <div class="h-24 w-full bg-gray-200 rounded overflow-hidden mb-2 relative group">
        <img src="${isNew ? img.src : img.src}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/150?text=Image'">
        <button onclick="removeImage(${idx})" class="absolute top-1 right-1 bg-red-600 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
      <input type="text" placeholder="Caption (optional)" class="w-full text-xs border border-gray-300 rounded px-2 py-1" value="${img.caption || ''}" onchange="updateCaption(${idx}, this.value)">
    `;
    container.appendChild(el);
  });
  lucide.createIcons();
}

function removeImage(idx) {
  currentWeek.images.splice(idx, 1);
  renderImages();
}

window.updateCaption = function(idx, val) {
  currentWeek.images[idx].caption = val;
};

document.getElementById('add-image-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    if (!currentWeek.images) currentWeek.images = [];
    
    // Store original file info to upload later
    const base64Data = event.target.result.split(',')[1];
    const path = `assets/protosem/week-${String(currentWeek.week).padStart(2, '0')}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    currentWeek.images.push({
      src: event.target.result, // preview
      caption: '',
      _uploadData: {
        path: path,
        content: base64Data
      }
    });
    
    renderImages();
  };
  reader.readAsDataURL(file);
});

document.getElementById('save-btn').addEventListener('click', async () => {
  if (!currentWeek) return;
  
  // Update JSON locally
  currentWeek.title = document.getElementById('edit-title').value.trim();
  currentWeek.description = document.getElementById('edit-desc').value.trim();
  currentWeek.status = (currentWeek.title || currentWeek.description) ? 'documented' : 'placeholder';
  
  const saveBtn = document.getElementById('save-btn');
  const saveStatus = document.getElementById('save-status');
  
  saveBtn.disabled = true;
  saveStatus.classList.remove('hidden');
  saveStatus.textContent = 'Preparing commit...';
  
  try {
    // 1. Gather all new images to upload across all weeks (though we only edit one week at a time usually)
    const treeItems = [];
    
    // Clean up images array for JSON, separate uploads
    protoData.forEach(w => {
      if (w.images) {
        w.images.forEach(img => {
          if (img._uploadData) {
            treeItems.push({
              path: img._uploadData.path,
              mode: '100644',
              type: 'blob',
              content: img._uploadData.content,
              isBase64: true
            });
            img.src = img._uploadData.path; // Update JSON to point to real path
            delete img._uploadData;
          }
        });
      }
    });
    
    // Add JSON to tree
    treeItems.push({
      path: 'data/protosem.json',
      mode: '100644',
      type: 'blob',
      content: JSON.stringify(protoData, null, 2)
    });
    
    // Get latest commit SHA
    saveStatus.textContent = 'Fetching branch info...';
    let refRes = await fetch(`${GITHUB_API_URL}/repos/${ghRepo}/git/refs/heads/main`, { headers: { Authorization: `token ${ghToken}` } });
    if (!refRes.ok) throw new Error("Could not fetch main branch ref");
    let refData = await refRes.json();
    let latestCommitSha = refData.object.sha;
    
    // Get base tree SHA
    let commitRes = await fetch(`${GITHUB_API_URL}/repos/${ghRepo}/git/commits/${latestCommitSha}`, { headers: { Authorization: `token ${ghToken}` } });
    let commitData = await commitRes.json();
    let baseTreeSha = commitData.tree.sha;
    
    // Upload blobs for images (GitHub tree API requires pre-uploaded blobs if base64)
    saveStatus.textContent = 'Uploading files...';
    for (let item of treeItems) {
      if (item.isBase64) {
        let blobRes = await fetch(`${GITHUB_API_URL}/repos/${ghRepo}/git/blobs`, {
          method: 'POST',
          headers: { Authorization: `token ${ghToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: item.content, encoding: 'base64' })
        });
        let blobData = await blobRes.json();
        item.sha = blobData.sha;
        delete item.content; // remove content, use sha
        delete item.isBase64;
      }
    }
    
    // Create Tree
    saveStatus.textContent = 'Creating tree...';
    let treeRes = await fetch(`${GITHUB_API_URL}/repos/${ghRepo}/git/trees`, {
      method: 'POST',
      headers: { Authorization: `token ${ghToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
    });
    let treeData = await treeRes.json();
    let newTreeSha = treeData.sha;
    
    // Create Commit
    saveStatus.textContent = 'Creating commit...';
    let newCommitRes = await fetch(`${GITHUB_API_URL}/repos/${ghRepo}/git/commits`, {
      method: 'POST',
      headers: { Authorization: `token ${ghToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Admin: Update ProtoSem Week ${String(currentWeek.week).padStart(2, '0')}`,
        tree: newTreeSha,
        parents: [latestCommitSha]
      })
    });
    let newCommitData = await newCommitRes.json();
    let newCommitSha = newCommitData.sha;
    
    // Update Ref
    saveStatus.textContent = 'Deploying...';
    let updateRefRes = await fetch(`${GITHUB_API_URL}/repos/${ghRepo}/git/refs/heads/main`, {
      method: 'PATCH',
      headers: { Authorization: `token ${ghToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommitSha, force: false })
    });
    
    if (updateRefRes.ok) {
      saveStatus.textContent = 'Successfully Published!';
      setTimeout(() => { saveStatus.classList.add('hidden'); }, 3000);
      renderSidebar();
      renderImages();
    } else {
      throw new Error("Failed to update branch ref");
    }
    
  } catch (err) {
    console.error(err);
    alert('Error publishing changes: ' + err.message);
    saveStatus.classList.add('hidden');
  } finally {
    saveBtn.disabled = false;
  }
});
