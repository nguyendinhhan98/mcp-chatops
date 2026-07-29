/**
 * ChatOps++ Kanban — Core Logic
 * Connects to Focalboard (Mattermost Boards) API to render a premium Kanban board
 */

import {
  getConfig, getMyProfile, getMyTeams, getTeamByName, getMyChannels,
  getKanbanBoardOverview, getUsersByIds,
  getPluginSettings, getKanbanLanes, getKanbanCardsDirect, updateCardLane,
  getKanbanBoardDetails, getUsersByUsernames, getUserAvatarUrlSync,
  createKanbanCard, moveKanbanCard, deleteKanbanCard, searchUsers, createKanbanLane,
  updateKanbanLane, deleteKanbanLane, getChannelUsers, searchChannelUsers
} from './api.js';

import { DragDropEngine } from './dnd.js';

// Smart helper functions to extract values from both Focalboard & AgileOS format cards
const getCardLaneValue = (card) => {
  return card.laneId || card.status || card.fields?.properties?.[state.propertyId] || '';
};

const getCardAssignees = (card) => {
  // AgileOS uses card.assignUsers containing usernames. Focalboard uses card.fields.properties.assignee containing user IDs.
  const owners = card.assignUsers || card.owners || card.assignees || card.fields?.properties?.['assignee'] || [];
  return Array.isArray(owners) ? owners : (typeof owners === 'string' && owners ? [owners] : []);
};

const getCardTitle = (card) => {
  return card.title || card.name || 'Untitled';
};

const getCardDescription = (card) => {
  return card.description || card.fields?.description || '';
};

const getCardDueDate = (card) => {
  return card.deadline || card.dueDate || card.fields?.properties?.['dueDate'] || null;
};

// Help map lane title to appropriate color classes
const getLaneColorByTitle = (title) => {
  const t = String(title || '').toLowerCase();
  if (t.includes('need_review')) return 'propColorOrange';
  if (t.includes('in_review')) return 'propColorBlue';
  if (t.includes('has_comment') || t.includes('comment')) return 'propColorYellow';
  if (t.includes('qc') || t.includes('verify') || t.includes('test')) return 'propColorPurple';
  if (t.includes('done') || t.includes('complete') || t.includes('finish')) return 'propColorGreen';
  return 'propColorDefault';
};



// ─── State ──────────────────────────────────────────────────────────────────

let state = {
  profile: null,
  teams: [],
  currentTeam: null,
  boards: [],
  currentBoard: null,
  lanes: [],          // [{ id, name, color }]
  propertyId: null,   // groupBy property id
  cards: [],          // raw cards from API
  members: [],        // board members
  userMap: {},        // userId → user object
  searchQuery: '',
  assigneeFilter: null,
  filterMine: false,
  filterOverdue: false,
  refreshTimer: null,
  dndEngine: null,
};

// ─── DOM helpers ─────────────────────────────────────────────────────────────

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isOverdue(ts) {
  return ts && new Date(ts) < new Date();
}

function isSoon(ts) {
  if (!ts) return false;
  const diff = new Date(ts) - new Date();
  return diff > 0 && diff < 86400000 * 2; // within 2 days
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '');
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message, type = 'info') {
  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };
  const container = $('#toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 220);
  }, 3000);
}

// ─── Initialization ──────────────────────────────────────────────────────────

async function startApp() {
  renderSkeleton();
  try {
    await initApp();
    setTimeout(checkAndShowSelectorGuide, 500);
  } catch (err) {
    console.error('[Kanban] Init error:', err);
    showError(err.message);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

async function initApp() {
  const [profile, teamsData] = await Promise.all([
    getMyProfile(),
    getMyTeams(),
  ]);

  state.profile = profile;
  state.teams = teamsData || [];

  // Parse URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const urlTeamId = urlParams.get('teamId');

  // Set current team from storage or first team
  const stored = await chrome.storage.local.get(['spCurrentTeamId', 'teamName', 'kanban_last_team']);
  const config = await getConfig();
  const defaultTeamName = stored.teamName || config.teamName || 'dn';

  if (urlTeamId) {
    state.currentTeam = state.teams.find(t => t.id === urlTeamId) || state.teams[0];
  } else if (stored.kanban_last_team) {
    state.currentTeam = state.teams.find(t => t.id === stored.kanban_last_team) || state.teams[0];
  } else if (stored.spCurrentTeamId && stored.spCurrentTeamId !== 'all') {
    state.currentTeam = state.teams.find(t => t.id === stored.spCurrentTeamId) || state.teams[0];
  } else {
    state.currentTeam = state.teams.find(t => t.name === defaultTeamName) || state.teams[0];
  }

  if (!state.currentTeam) throw new Error('Không tìm thấy workspace. Hãy đăng nhập vào ChatOps trước.');

  // Update user avatar in header
  renderUserAvatar();

  // Load boards for current team
  await loadBoards();

  // Setup theme and apply colors
  await setupTheme();

  // Setup event listeners
  setupSearch();
  setupFilters();
  setupRefresh();
  setupWorkspaceSelector();
  setupBoardSelector();
  setupColumnMenus();
  setupKeyboardShortcuts();
  setupHeaderActions();

  // Global add card button setup
  const addCardGlobalBtn = $('#addCardGlobalBtn');
  if (addCardGlobalBtn) {
    addCardGlobalBtn.addEventListener('click', () => {
      openCardModal(null);
    });
  }

  // Auto-refresh every 60 seconds
  state.refreshTimer = setInterval(() => refreshCards(), 60000);
}

// ─── Board Loading ─────────────────────────────────────────────────────────

async function loadBoards() {
  const teamId = state.currentTeam.id;
  try {
    const channels = await getMyChannels(teamId);
    // Filter to only public/private channels that can act as boards
    state.boards = (channels || []).filter(c => c.type === 'O' || c.type === 'P').map(c => ({
      id: c.id,
      title: c.display_name || c.name,
      name: c.name,
      creatorId: c.creator_id
    }));

    // Resolve user details of the board creators
    await resolveBoardCreators();

    if (!state.boards.length) {
      showNoBoardsState();
      return;
    }

    // Parse URL channelId parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlChannelId = urlParams.get('channelId');

    // Restore last used board from storage or URL parameter
    const { kanban_last_board: lastBoardId } = await chrome.storage.local.get('kanban_last_board');
    const targetBoardId = urlChannelId || lastBoardId;
    const savedBoard = targetBoardId && state.boards.find(b => b.id === targetBoardId);
    state.currentBoard = savedBoard || state.boards[0];

    renderBoardDropdown();
    await loadBoardData();
  } catch (err) {
    console.error('[Kanban] Load boards error:', err);
    showError(err.message);
  }
}

async function resolveBoardCreators() {
  const creatorIds = Array.from(new Set(state.boards.map(b => b.creatorId).filter(Boolean)));
  if (creatorIds.length === 0) return;

  // Filter out IDs that we already have in state.userMap
  const missingIds = creatorIds.filter(id => !state.userMap[id]);
  if (missingIds.length === 0) return;

  try {
    const users = await getUsersByIds(missingIds).catch(() => []);
    (users || []).forEach(u => {
      state.userMap[u.id] = u;
      state.userMap[u.username] = u;
    });
  } catch (err) {
    console.warn('[Kanban] Failed to resolve board creators:', err);
  }
}

async function loadBoardData() {
  if (!state.currentBoard) return;
  renderLoadingColumns();

  try {
    const teamId = state.currentTeam.id;
    const cid = state.currentBoard.id;
    const status = state.filterOverdue ? 'over_due' : 'all';
    const search = state.searchQuery || '';

    // Fetch the complete board detail (lanes + cards inside them) from ChatOps Kanban plugin
    const boardData = await getKanbanBoardDetails(cid, teamId, status, search);
    state.boardDetails = boardData; // Cache board details structure
    console.log('[Kanban] Loaded ChatOps board details:', boardData);

    // Map lanes (columns) from board details
    if (boardData && boardData.lanes && boardData.lanes.length > 0) {
      state.lanes = boardData.lanes.map(lane => ({
        id: lane.id || lane._id || '',
        name: lane.title || lane.name || '',
        color: getLaneColorByTitle(lane.title || lane.name),
        isCompletedLane: lane.isCompletedLane || false,
        order: lane.order || 0
      }));

      // Flatten cards from all lanes
      let flatCards = [];
      boardData.lanes.forEach(lane => {
        if (lane.cards && Array.isArray(lane.cards)) {
          lane.cards.forEach(card => {
            // Guarantee card has the laneId it was found in
            card.laneId = card.laneId || lane.id;
            flatCards.push(card);
          });
        }
      });
      state.cards = flatCards;
    } else {
      // Fallbacks mapping
      state.lanes = [
        { id: 'Need_Review', name: 'Need_Review', color: 'propColorOrange' },
        { id: 'In_Review', name: 'In_Review', color: 'propColorBlue' },
        { id: 'Has_Comment', name: 'Has_Comment', color: 'propColorYellow' },
        { id: 'QC/Brse_Verify', name: 'QC/Brse_Verify', color: 'propColorPurple' },
        { id: 'Done', name: 'Done', color: 'propColorGreen' }
      ];
      state.cards = [];
    }

    state.members = [];
    state.propertyId = 'status'; 

    // Pre-fetch all workspace/team members once for the assignee autocomplete picker
    state.teamMembers = await searchUsers('', teamId).catch((err) => {
      console.warn('[Kanban] Failed to fetch team members:', err);
      return [];
    });

    // Resolve user details for assignees
    await resolveUsers();

    renderBoard();
    updateBoardSelectorLabel();
    renderBoardDropdown();
    renderWorkspaceDropdown();
    chrome.storage.local.set({ kanban_last_board: state.currentBoard.id });
  } catch (err) {
    console.error('[Kanban] Load board error:', err);
    showError(err.message);
  }
}

async function resolveUsers() {
  const allUsernames = new Set();
  const allUserIds = new Set();

  state.cards.forEach(card => {
    // AgileOS format: assignUsers contains usernames/emails like nguyentht-runsystem.net or ID strings
    const assignees = getCardAssignees(card);
    assignees.forEach(userRef => {
      if (userRef.includes('-runsystem.net') || userRef.includes('@')) {
        allUsernames.add(userRef);
      } else if (userRef.length === 26) {
        // Mattermost format ID
        allUserIds.add(userRef);
      } else {
        // Fallback guess: assume it is username
        allUsernames.add(userRef);
      }
    });
  });

  if (state.profile) {
    allUserIds.add(state.profile.id);
    if (state.profile.username) allUsernames.add(state.profile.username);
  }

  try {
    const listUsernames = Array.from(allUsernames).filter(Boolean);
    const listUserIds = Array.from(allUserIds).filter(Boolean);
    
    state.userMap = {};

    // 1. Resolve by usernames
    if (listUsernames.length > 0) {
      const usersByUsername = await getUsersByUsernames(listUsernames).catch(() => []);
      (usersByUsername || []).forEach(u => {
        state.userMap[u.username] = u;
        state.userMap[u.id] = u; // map both username and id to the same object
      });
    }

    // 2. Resolve by IDs
    if (listUserIds.length > 0) {
      const usersByIds = await getUsersByIds(listUserIds).catch(() => []);
      (usersByIds || []).forEach(u => {
        state.userMap[u.id] = u;
        state.userMap[u.username] = u;
      });
    }
  } catch (e) {
    console.warn('[Kanban] Failed to resolve users:', e);
  }
}

async function refreshCards() {
  if (!state.currentBoard) return;
  const btn = $('#refreshBtn');
  if (btn) btn.classList.add('spinning');

  try {
    const teamId = state.currentTeam.id;
    const cid = state.currentBoard.id;
    const boardData = await getKanbanBoardDetails(cid, teamId);
    
    if (boardData && boardData.lanes) {
      let flatCards = [];
      boardData.lanes.forEach(lane => {
        if (lane.cards && Array.isArray(lane.cards)) {
          lane.cards.forEach(card => {
            card.laneId = card.laneId || lane.id;
            flatCards.push(card);
          });
        }
      });
      state.cards = flatCards;
    }
    await resolveUsers();
    renderBoard();
    showToast('Đã làm mới danh sách card', 'success');
  } catch (e) {
    console.warn('[Kanban] Refresh failed:', e);
    showToast('Không thể làm mới danh sách card: ' + e.message, 'error');
  } finally {
    if (btn) btn.classList.remove('spinning');
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderSkeleton() {
  const board = $('#kanbanBoard');
  if (!board) return;
  board.innerHTML = `
    ${[1, 2, 3, 4].map(() => `<div class="skeleton skeleton-col"></div>`).join('')}
  `;
}

function renderLoadingColumns() {
  const board = $('#kanbanBoard');
  if (!board) return;
  board.innerHTML = `
    ${[1, 2, 3, 4].map(() => `
      <div class="kanban-column">
        <div class="column-header">
          <div class="skeleton" style="width:80px;height:14px;"></div>
        </div>
        <div class="kanban-column-body">
          ${[1, 2].map(() => `<div class="skeleton skeleton-card"></div>`).join('')}
        </div>
      </div>
    `).join('')}
  `;
}

function getFilteredCards() {
  let cards = state.cards;

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    cards = cards.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.fields?.description || '').toLowerCase().includes(q)
    );
  }

  if (state.assigneeFilter) {
    cards = cards.filter(c => {
      const assignees = getCardAssignees(c);
      return assignees.includes(state.assigneeFilter);
    });
  }

  if (state.filterMine && state.profile) {
    cards = cards.filter(c => {
      const assignees = getCardAssignees(c);
      return assignees.some(a => 
        a === state.profile.id || 
        a === state.profile.username || 
        a === (state.profile.username + '-runsystem.net') || 
        a === state.profile.email
      );
    });
  }

  if (state.filterOverdue) {
    cards = cards.filter(c => {
      const due = getCardDueDate(c);
      return due && isOverdue(due);
    });
  }

  return cards;
}

function renderBoard() {
  const board = $('#kanbanBoard');
  if (!board) return;

  // Destroy old DnD engine
  if (state.dndEngine) {
    state.dndEngine.destroy();
    state.dndEngine = null;
  }

  if (!state.lanes || !state.lanes.length) {
    // Fallback: show all cards in one lane
    board.innerHTML = renderFallbackBoard();
    return;
  }

  const filteredCards = getFilteredCards();
  const cardsByLane = {};
  state.lanes.forEach(l => { cardsByLane[l.id] = []; });

  filteredCards.forEach(card => {
    const laneId = getCardLaneValue(card);
    const lane = state.lanes.find(l => l.id === laneId);
    const targetLane = lane || state.lanes[0];
    (cardsByLane[targetLane.id] = cardsByLane[targetLane.id] || []).push(card);
  });

  board.innerHTML = state.lanes.map(lane =>
    renderColumn(lane, cardsByLane[lane.id] || [])
  ).join('') + `
    <div class="add-lane-col">
      <button class="add-lane-btn" id="addLaneBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Thêm lane
      </button>
    </div>
  `;

  // Setup DnD (only once)
  if (!state.dndEngine) {
    state.dndEngine = new DragDropEngine({
      containerSelector: '#kanbanBoard',
      cardSelector: '.kanban-card',
      columnSelector: '.kanban-column-body',
      onDrop: handleCardDrop,
      onDragStart: (card) => card.classList.add('dragging'),
      onDragEnd: (card) => card.classList.remove('dragging'),
    });
  }

  // Bind card events
  bindCardEvents();

  // Update assignee filter bar
  renderAssigneeFilters();

  // Update column counts
  updateColumnCounts();
}

function renderColumn(lane, cards) {
  const colorClass = `lane-${lane.color || 'propColorDefault'}`;
  const isEmpty = cards.length === 0;

  return `
    <div class="kanban-column" data-lane-id="${escapeHtml(lane.id)}">
      <div class="column-header">
        <div class="column-color-bar ${colorClass}"></div>
        <span class="column-name" title="${escapeHtml(lane.name)}">${escapeHtml(lane.name)}</span>
        <span class="column-count" data-lane-count="${escapeHtml(lane.id)}">${cards.length}</span>
        <button class="column-menu-btn" data-lane-id="${escapeHtml(lane.id)}" title="Tùy chọn lane">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>
      <div class="kanban-column-body" data-lane-id="${escapeHtml(lane.id)}">
        ${isEmpty
          ? `<div class="column-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6m-3-3v6"/></svg>
              <span>Không có card</span>
            </div>`
          : cards.map(card => renderCard(card)).join('')
        }
      </div>
      <div class="column-footer">
        <button class="add-card-btn" data-lane-id="${escapeHtml(lane.id)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Thêm card
        </button>
      </div>
    </div>
  `;
}

function renderCard(card) {
  const cardId = card.id || card._id || '';
  const title = getCardTitle(card);
  const description = getCardDescription(card);
  const dueDate = getCardDueDate(card);
  const assigneeIds = getCardAssignees(card);
  const dueDateFormatted = formatDate(dueDate);
  const overdueClass = isOverdue(dueDate) ? 'overdue' : isSoon(dueDate) ? 'soon' : '';

  const laneId = getCardLaneValue(card);
  const lane = state.lanes.find(l => l.id === laneId);
  const colorClass = `lane-${lane?.color || 'propColorDefault'}`;

  // Optional: get ref number like #304
  const refNum = card.cardNumberRef ? `#${card.cardNumberRef}` : '';

  return `
    <div class="kanban-card" 
         data-card-id="${escapeHtml(cardId)}" 
         tabindex="0"
         role="button"
         aria-label="${escapeHtml(title)}">
      ${lane ? `<div class="card-label-strip ${colorClass}" style="height:3px"></div>` : ''}
      
      <!-- Top header with Reference Number -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-size:11px; font-weight:bold; color:var(--info); font-family:monospace;">${escapeHtml(refNum)}</span>
      </div>

      <div class="card-title">${escapeHtml(title)}</div>
      ${description ? `
        <div class="card-description" style="font-size:11px; color:var(--text-secondary); line-height:1.45; word-break:break-word; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; margin-top:2px;">
          ${linkify(escapeHtml(description))}
        </div>
      ` : ''}
      <div class="card-footer">
        <div class="card-meta" style="gap:6px;flex:1;flex-wrap:wrap;">
          ${dueDateFormatted ? `
            <span class="card-date ${overdueClass}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${dueDateFormatted}
            </span>
          ` : ''}
        </div>
        <div class="card-assignees">
          ${assigneeIds.slice(0, 3).map(uid => renderAvatarSm(uid)).join('')}
          ${assigneeIds.length > 3 ? `<div class="avatar-sm" style="background:var(--bg-card-hover);border:1.5px solid var(--border);font-size:9px;color:var(--text-muted);">+${assigneeIds.length - 3}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="card-action-btn btn-open-card" data-card-id="${escapeHtml(cardId)}" title="Mở chi tiết">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
          <button class="card-action-btn danger btn-delete-card" data-card-id="${escapeHtml(cardId)}" title="Xóa card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderAvatarSm(userId) {
  const user = state.userMap[userId];
  if (!user) {
    // Trim domain if it is username reference
    const cleanId = String(userId || '').split('-runsystem.net')[0].split('@')[0];
    return `<div class="avatar-sm" title="${escapeHtml(userId || '')}">${escapeHtml(cleanId.substring(0, 2).toUpperCase())}</div>`;
  }
  
  const initials = getInitials(user.nickname || user.username || user.first_name + ' ' + user.last_name);
  const avatarUrl = getUserAvatarUrlSync(user.id);
  
  return `
    <div class="avatar-sm" title="${escapeHtml(user.nickname || user.username || '')}">
      <img src="${avatarUrl}" alt="${escapeHtml(initials)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
      <span style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">${escapeHtml(initials)}</span>
    </div>
  `;
}

function renderFallbackBoard() {
  return `
    <div class="kb-empty-board" style="flex:1;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:40px;color:var(--text-muted);">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:0.2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6m-6 4h6m-6 4h4"/></svg>
      <h3 style="color:var(--text-primary)">Board này không có cột Kanban</h3>
      <p>Board này không có property kiểu Select để nhóm theo lane. Hãy chọn board khác hoặc thêm property "Status" trong Mattermost Boards.</p>
    </div>
  `;
}

function renderNoBoardsState() {
  const board = $('#kanbanBoard');
  if (!board) return;
  const config = { chatopsUrl: 'https://chat.runsystem.vn' };
  board.innerHTML = `
    <div class="no-boards-notice">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:0.2"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>
      <h3>Chưa có Kanban board nào</h3>
      <p>Tạo board mới trong <a href="${config.chatopsUrl}" target="_blank">Mattermost Boards</a> rồi quay lại đây.</p>
    </div>
  `;
}

function showNoBoardsState() {
  const board = $('#kanbanBoard');
  if (!board) return;
  board.innerHTML = `
    <div class="no-boards-notice" style="flex:1;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:48px;color:var(--text-muted);">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:0.2"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>
      <h3 style="color:var(--text-primary)">Chưa có Kanban board nào</h3>
      <p style="font-size:13px;line-height:1.6;max-width:400px;">Workspace này chưa có board nào. Hãy tạo board trong Mattermost Boards rồi quay lại đây.</p>
    </div>
  `;
}

function showError(message) {
  const main = $('#mainContent');
  if (!main) return;
  main.innerHTML = `
    <div class="kb-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <h3>Không thể tải Kanban</h3>
      <p>${escapeHtml(message)}</p>
      <p style="font-size:12px;margin-top:4px;">Đảm bảo bạn đã đăng nhập vào ChatOps và plugin Mattermost Boards đã được bật.</p>
      <button class="btn-retry" onclick="location.reload()">Thử lại</button>
    </div>
  `;
}

// ─── Event Binding ────────────────────────────────────────────────────────────

function bindCardEvents() {
  // Card click → open modal
  document.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn')) return;
      const cardId = card.dataset.cardId;
      const cardData = state.cards.find(c => c.id === cardId);
      if (cardData) openCardModal(cardData);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const cardId = card.dataset.cardId;
        const cardData = state.cards.find(c => c.id === cardId);
        if (cardData) openCardModal(cardData);
      }
    });
  });

  // Open card button
  document.querySelectorAll('.btn-open-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = btn.dataset.cardId;
      const cardData = state.cards.find(c => c.id === cardId);
      if (cardData) openCardModal(cardData);
    });
  });

  // Delete card button
  document.querySelectorAll('.btn-delete-card').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cardId = btn.dataset.cardId;
      const cardData = state.cards.find(c => (c.id || c._id) === cardId);
      const laneId = cardData ? cardData.laneId : '';

      showConfirmDialog(
        'Xóa card?',
        'Card này sẽ bị xóa vĩnh viễn khỏi Mattermost Boards.',
        async () => {
          try {
            const channelId = state.currentBoard.id;
            await deleteKanbanCard(channelId, laneId, cardId);
            state.cards = state.cards.filter(c => (c.id || c._id) !== cardId);
            renderBoard();
            showToast('Đã xóa card', 'success');
          } catch (err) {
            showToast('Lỗi khi xóa: ' + err.message, 'error');
          }
        }
      );
    });
  });

  // Add card buttons
  document.querySelectorAll('.add-card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const laneId = btn.dataset.laneId;
      openCardModal(null, laneId);
    });
  });

  // Add lane button
  const addLaneBtn = document.getElementById('addLaneBtn');
  if (addLaneBtn) {
    addLaneBtn.addEventListener('click', () => {
      showAddLaneDialog();
    });
  }
}

function updateColumnCounts() {
  state.lanes.forEach(lane => {
    const countEl = document.querySelector(`[data-lane-count="${lane.id}"]`);
    const colBody = document.querySelector(`.kanban-column-body[data-lane-id="${lane.id}"]`);
    if (!colBody) return;

    // Select all cards excluding ghosts/placeholders
    const cards = colBody.querySelectorAll('.kanban-card:not(.drag-ghost)');
    const count = cards.length;
    if (countEl) countEl.textContent = count;

    const emptyEl = colBody.querySelector('.column-empty');
    if (count === 0) {
      if (!emptyEl) {
        const div = document.createElement('div');
        div.className = 'column-empty';
        div.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6m-3-3v6"/></svg>
          <span>Không có card</span>
        `;
        colBody.appendChild(div);
      }
    } else {
      if (emptyEl) {
        emptyEl.remove();
      }
    }
  });
}

// ─── Inline Add Card ──────────────────────────────────────────────────────────

function showInlineAddCard(laneId) {
  // Remove any existing inline forms
  document.querySelectorAll('.add-card-inline').forEach(f => f.remove());
  document.querySelectorAll('.add-card-btn').forEach(b => b.style.display = '');

  const col = document.querySelector(`.kanban-column-body[data-lane-id="${laneId}"]`);
  if (!col) return;

  const footer = col.closest('.kanban-column')?.querySelector('.column-footer');
  if (footer) {
    const addBtn = footer.querySelector('.add-card-btn');
    if (addBtn) addBtn.style.display = 'none';
  }

  const form = document.createElement('div');
  form.className = 'add-card-inline add-card-inline-form';
  form.innerHTML = `
    <textarea class="add-card-input" placeholder="Tiêu đề card…" rows="3"></textarea>
    <div class="add-card-actions">
      <button class="btn-add-confirm">Thêm card</button>
      <button class="btn-add-cancel">Hủy</button>
    </div>
  `;

  col.appendChild(form);
  const textarea = form.querySelector('.add-card-input');
  textarea.focus();

  form.querySelector('.btn-add-confirm').addEventListener('click', async () => {
    const title = textarea.value.trim();
    if (!title) { textarea.focus(); return; }
    await doCreateCard(laneId, title, form, footer);
  });

  form.querySelector('.btn-add-cancel').addEventListener('click', () => {
    form.remove();
    if (footer) footer.querySelector('.add-card-btn').style.display = '';
  });

  textarea.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      const title = textarea.value.trim();
      if (!title) return;
      await doCreateCard(laneId, title, form, footer);
    } else if (e.key === 'Escape') {
      form.remove();
      if (footer) footer.querySelector('.add-card-btn').style.display = '';
    }
  });
}

async function doCreateCard(laneId, title, form, footer) {
  const btn = form.querySelector('.btn-add-confirm');
  btn.disabled = true;
  btn.textContent = 'Đang tạo…';

  try {
    const channelId = state.currentBoard.id;
    const teamId = state.currentTeam.id;
    const profile = state.profile || {};

    const cardPayload = {
      title: title,
      description: "",
      ownerOnly: false,
      creatorEmail: profile.email || "hannd@runsystem.net",
      lane_id: laneId,
      sharing_channel_id: null,
      data: {
        assignUsers: profile.username ? [profile.username] : ["hannd-runsystem.net"],
        tags: []
      }
    };

    const responseData = await createKanbanCard(channelId, teamId, cardPayload);
    // If server returns the created card object, push it, otherwise use our payload
    const newCard = responseData || {
      id: Math.random().toString(36).substr(2, 9),
      ...cardPayload,
      laneId: laneId,
      assignUsers: cardPayload.data.assignUsers
    };

    state.cards.push(newCard);
    form.remove();
    if (footer) footer.querySelector('.add-card-btn').style.display = '';
    
    // Resolve users again to make sure new card assignees are mapped
    await resolveUsers();
    
    renderBoard();
    showToast('Đã tạo card mới', 'success');
  } catch (err) {
    showToast('Lỗi khi tạo card: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Thêm card';
  }
}

// ─── Drag & Drop Handler ──────────────────────────────────────────────────────

async function handleCardDrop({ cardId, fromLaneId, toLaneId }) {
  if (!cardId || fromLaneId === toLaneId) return;

  // Optimistic UI update
  const card = state.cards.find(c => (c.id || c._id) === cardId);
  if (card) {
    card.laneId = toLaneId;
    if (card.fields?.properties && state.propertyId) {
      card.fields.properties[state.propertyId] = toLaneId;
    }
  }

  updateColumnCounts();

  try {
    const channelId = state.currentBoard.id;
    const profile = state.profile || {};
    const movePayload = {
      updaterId: profile.id || 'xtpdp43bmbd5ucmj85uhordbbr',
      updaterEmail: profile.email || 'hannd@runsystem.net',
      sourceLaneId: fromLaneId,
      targetLaneId: toLaneId,
      cardId: cardId,
      position: 0
    };

    await moveKanbanCard(channelId, cardId, movePayload);
    showToast('Card đã chuyển lane', 'success');
  } catch (err) {
    showToast('Lỗi khi chuyển card: ' + err.message, 'error');
    // Revert
    if (card) {
      card.laneId = fromLaneId;
      if (card.fields?.properties && state.propertyId) {
        card.fields.properties[state.propertyId] = fromLaneId;
      }
    }
    renderBoard();
  }
}

// ─── Card Detail Modal ────────────────────────────────────────────────────────

function openCardModal(card = null, defaultLaneId = '') {
  const isEdit = !!card;
  const cardId = card ? (card.id || card._id || '') : '';
  let title = card ? getCardTitle(card) : '';
  let description = card ? getCardDescription(card) : '';

  // Resolve draft if exists
  const draftKey = isEdit ? `kanban_draft_edit_${cardId}` : `kanban_draft_new_${state.currentBoard.id}`;
  const savedDraft = localStorage.getItem(draftKey);
  if (savedDraft) {
    try {
      const parsed = JSON.parse(savedDraft);
      if (parsed.title !== undefined) title = parsed.title;
      if (parsed.description !== undefined) description = parsed.description;
      showToast('Đã khôi phục bản nháp viết dở', 'info');
    } catch (e) {
      console.warn('[Draft] Failed to parse draft:', e);
    }
  }

  const dueDate = card ? getCardDueDate(card) : '';
  const assigneeIds = card ? getCardAssignees(card) : [];
  const laneId = card ? getCardLaneValue(card) : (defaultLaneId || state.lanes[0]?.id || '');
  const lane = state.lanes.find(l => l.id === laneId);
  const colorClass = `lane-${lane?.color || 'propColorDefault'}`;
  const createdAt = card && (card.createAt || card.createdAt) ? formatDate(card.createAt || card.createdAt) : '';
  const updatedAt = card && (card.updateAt || card.updatedAt) ? formatDate(card.updateAt || card.updatedAt) : '';

  // Resolve raw assignee references (mixed user ID and username) to resolved unique usernames
  let selectedAssignees = Array.from(new Set(assigneeIds.map(ref => {
    const user = state.userMap[ref];
    return user ? (user.username || user.id) : ref;
  })));

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'cardModal';
  overlay.innerHTML = `
    <div class="card-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <button class="modal-close-btn" id="modalCloseBtn" title="Đóng (Esc)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div class="modal-header">
        <span class="modal-status-badge lane-${lane?.color || 'propColorDefault'}" style="background:rgba(from var(--lane-${lane?.color || 'propColorDefault'}) r g b / 0.15);border:1px solid;border-color:color-mix(in srgb, var(--lane-${lane?.color || 'propColorDefault'}) 40%, transparent);color:var(--text-primary);">
          ${escapeHtml(lane?.name || 'Chọn Lane')}
        </span>
      </div>
      <div class="modal-body">
        <div class="modal-main">
          <div class="modal-section">
            <div class="modal-section-label">Tiêu đề card</div>
            <input type="text" id="modalTitleInput" value="${escapeHtml(title)}" placeholder="Nhập tiêu đề card..." style="width:100%; font-size:14px; font-weight:600; background:var(--bg-card); border:1.5px solid var(--border); border-radius:8px; padding:10px; color:var(--text-primary); margin-bottom:12px; outline:none;" />
          </div>
          <div class="modal-section desc-section" style="position:relative; flex:1; display:flex; flex-direction:column; margin-bottom:0;">
            <div class="modal-section-label" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span>Mô tả</span>
              <div style="display:flex; align-items:center; gap:8px;">
                <button id="btnEditDesc" class="header-btn" title="Sửa mô tả" style="padding:4px; font-size:11px; height:auto; display:inline-flex; align-items:center; justify-content:center;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="stroke:currentColor;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                ${description ? `<button class="collapse-btn" id="btnExpandDesc" style="display:none;" title="Xem toàn bộ / Thu gọn"></button>` : ''}
              </div>
            </div>
            
            <div id="modalDescDisplay" class="modal-description collapsed" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:12px; font-size:13px; line-height:1.6; word-break:break-word; color:var(--text-primary);">${description ? parseMarkdown(description) : '<span class="empty" style="color:var(--text-muted);font-style:italic;">Chưa có mô tả chi tiết...</span>'}</div>
            
            <div id="modalDescEditContainer" style="display:none; flex-direction:column; flex:1;">
              <div class="desc-format-toolbar">
                <button type="button" class="format-btn" data-action="heading" title="Tiêu đề (Heading)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15" style="stroke:currentColor;"><path d="M4 12h16"/><path d="M4 18V6"/><path d="M20 18V6"/></svg>
                </button>
                <button type="button" class="format-btn" data-action="bold" title="In đậm (Bold)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15" style="stroke:currentColor;"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
                </button>
                <button type="button" class="format-btn" data-action="italic" title="In nghiêng (Italic)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15" style="stroke:currentColor;"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
                </button>
                <button type="button" class="format-btn" data-action="underline" title="Gạch chân (Underline)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15" style="stroke:currentColor;"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
                </button>
                <button type="button" class="format-btn" data-action="strike" title="Gạch ngang (Strikethrough)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15" style="stroke:currentColor;"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6a5 5 0 0 0-8 0c0 2 3 3 4 4s4 2 4 4a5 5 0 0 1-8 0"/></svg>
                </button>
                
                <div class="format-divider"></div>
                
                <button type="button" class="format-btn" data-action="list" title="Danh sách không thứ tự">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15" style="stroke:currentColor;"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
                <button type="button" class="format-btn" data-action="numlist" title="Danh sách số">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15" style="stroke:currentColor;"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6H3v2h1v1H3"/><path d="M3 13h1.5a1.5 1.5 0 0 1 0 3H3v-1.5"/></svg>
                </button>
                <button type="button" class="format-btn" data-action="quote" title="Trích dẫn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15" style="stroke:currentColor;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </button>
                <button type="button" class="format-btn" data-action="code" title="Mã nguồn (Code)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15" style="stroke:currentColor;"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                </button>
                <button type="button" class="format-btn" data-action="table" title="Bảng">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15" style="stroke:currentColor;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                </button>
                <button type="button" class="format-btn" data-action="link" title="Liên kết">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15" style="stroke:currentColor;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </button>

                <div class="format-divider" style="margin-left:auto; margin-right:4px;"></div>
                
                <button type="button" class="format-btn" id="btnDescPreviewToggle" title="Xem trước (Preview)" style="margin-left: 0;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15" style="stroke:currentColor;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
              <textarea id="modalDescInput" style="width:100%; flex:1; min-height:180px; background:var(--bg-card); border:1.5px solid var(--border); border-top:none; border-radius:0 0 8px 8px; padding:10px; color:var(--text-primary); font-size:13px; line-height:1.6; resize:none; outline:none; box-sizing:border-box;" placeholder="Nhập mô tả chi tiết...">${escapeHtml(description)}</textarea>
              <div id="modalDescPreviewDiv" class="modal-description" style="display:none; width:100%; flex:1; min-height:180px; background:var(--bg-card); border:1.5px solid var(--border); border-top:none; border-radius:0 0 8px 8px; padding:12px; box-sizing:border-box; overflow-y:auto; word-break:break-word;"></div>
            </div>

            <div id="descEditActions" style="display:none; gap:8px; margin-top:8px; justify-content:flex-end;">
              <button id="btnCancelDescEdit" class="header-btn btn-desc-cancel" style="padding:4px 10px; font-size:12px; height:auto;">Hủy</button>
              <button id="btnSaveDescEdit" class="header-btn primary btn-desc-save" style="padding:4px 10px; font-size:12px; height:auto;">Xác nhận</button>
            </div>
          </div>
        </div>
        <div class="modal-sidebar">
          <div class="modal-field">
            <div class="modal-field-label">Trạng thái (Lane)</div>
            <select id="modalLaneSelect" style="width:100%; background:var(--bg-card); border:1.5px solid var(--border); border-radius:8px; padding:8px; color:var(--text-primary); font-size:13px; outline:none;">
              ${state.lanes.map(l => `<option value="${escapeHtml(l.id)}" ${l.id === laneId ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}
            </select>
          </div>

          <div class="modal-field">
            <div class="modal-field-label">Người thực hiện (Assignees)</div>
            <div class="assignee-picker-wrapper" style="position:relative;">
              <div class="assignee-search-input-box" style="display:flex; align-items:center; background:var(--bg-card); border:1.5px solid var(--border); border-radius:8px; padding:6px 10px; gap:8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px; color:var(--text-muted);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input type="text" id="modalAssigneeSearch" placeholder="Tìm thành viên..." style="background:transparent; border:none; color:var(--text-primary); font-size:13px; width:100%; outline:none; font-family:inherit;" autocomplete="off" />
              </div>
              <div class="assignee-dropdown-menu" id="modalAssigneeDropdown" style="display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; background:var(--bg-modal); border:1px solid var(--border); border-radius:8px; max-height:180px; overflow-y:auto; z-index:1100; box-shadow:0 8px 24px rgba(0,0,0,0.5); padding:4px;">
                <!-- Populated via Javascript -->
              </div>
            </div>
            <!-- Container containing the selected chips -->
            <div class="modal-field-value modal-assignees" id="modalSelectedAssignees" style="margin-top:10px; display:flex; flex-wrap:wrap; gap:6px;">
              <!-- Chips rendered by JS -->
            </div>
          </div>

          <div class="modal-field">
            <div class="modal-field-label">Ngày hết hạn</div>
            <input type="date" id="modalDueDateInput" value="${dueDate ? dueDate.substring(0, 10) : ''}" style="width:100%; background:var(--bg-card); border:1.5px solid var(--border); border-radius:8px; padding:8px; color:var(--text-primary); font-size:13px; outline:none;" />
          </div>

          ${createdAt ? `
            <div class="modal-field">
              <div class="modal-field-label">Tạo lúc</div>
              <div class="modal-field-value">${createdAt}</div>
            </div>
          ` : ''}

          ${updatedAt ? `
            <div class="modal-field">
              <div class="modal-field-label">Cập nhật</div>
              <div class="modal-field-value">${updatedAt}</div>
            </div>
          ` : ''}
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-footer-actions">
          ${isEdit ? `
            <button class="header-btn danger btn-modal-delete" data-card-id="${escapeHtml(cardId)}" style="color:var(--danger);border-color:rgba(248,81,73,0.3);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              Xóa card
            </button>
          ` : ''}
          <button class="header-btn btn-modal-cancel" style="background:transparent;border:1px solid var(--border);color:var(--text-muted);">
            Hủy
          </button>
          <button class="header-btn primary btn-modal-save" style="margin-left:8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            ${isEdit ? 'Lưu thay đổi' : 'Tạo mới'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#modalCloseBtn').focus();

  // Close handlers
  const closeModal = () => {
    overlay.style.animation = 'overlayIn 0.15s ease reverse';
    setTimeout(() => overlay.remove(), 150);
  };

  // Discard draft on Cancel click
  const discardDraft = () => {
    localStorage.removeItem(draftKey);
  };
  overlay.querySelector('.btn-modal-cancel').addEventListener('click', () => {
    discardDraft();
    closeModal();
  });

  overlay.querySelector('#modalCloseBtn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  // Save draft on user typing
  const titleInput = overlay.querySelector('#modalTitleInput');
  const descInput = overlay.querySelector('#modalDescInput');
  const saveDraft = () => {
    localStorage.setItem(draftKey, JSON.stringify({
      title: titleInput.value,
      description: descInput.value
    }));
  };
  titleInput.addEventListener('input', saveDraft);
  descInput.addEventListener('input', saveDraft);

  // Dynamic pagination variables for assignee dropdown
  let channelUsers = [];
  let currentAssigneePage = 0;
  let hasMoreAssignees = true;
  let isLoadingAssignees = false;
  let currentSearchQuery = '';

  const searchInput = overlay.querySelector('#modalAssigneeSearch');
  const dropdown = overlay.querySelector('#modalAssigneeDropdown');

  async function loadAssigneePage(page, append = false, query = '') {
    console.log('[Assignees] loadAssigneePage called. Page:', page, 'Append:', append, 'Query:', query);
    if (isLoadingAssignees) return;
    isLoadingAssignees = true;

    let loader = null;
    if (append && dropdown) {
      loader = document.createElement('div');
      loader.id = 'assigneeDropdownLoading';
      loader.style.cssText = 'padding:10px; text-align:center; font-size:12px; color:var(--text-muted);';
      loader.textContent = 'Đang tải thêm...';
      dropdown.appendChild(loader);
      dropdown.scrollTop = dropdown.scrollHeight;
    }

    try {
      const channelId = state.currentBoard.id;
      let users = [];
      if (query) {
        users = await searchChannelUsers(channelId, query, page, 40);
      } else {
        users = await getChannelUsers(channelId, page, 40);
      }
      console.log('[Assignees] API returned users count:', users ? users.length : 0);

      if (loader) loader.remove();

      if (!users || users.length < 40) {
        hasMoreAssignees = false;
      } else {
        hasMoreAssignees = true;
      }

      // Cache user mappings
      users.forEach(u => {
        if (u && u.id) {
          state.userMap[u.id] = u;
          state.userMap[u.username] = u;
        }
      });

      if (append) {
        const existingIds = new Set(channelUsers.map(u => u.id));
        const newUsers = users.filter(u => !existingIds.has(u.id));
        channelUsers = [...channelUsers, ...newUsers];
      } else {
        channelUsers = users;
      }

      renderDropdownList(query);
    } catch (err) {
      console.warn('[Assignees] Failed to load channel users:', err);
      if (loader) loader.remove();
    } finally {
      isLoadingAssignees = false;
    }
  }

  // Load the first page immediately
  loadAssigneePage(0, false, '');

  // Helper to get unique resolved user objects from selected references (ids or usernames)
  function getUniqueResolvedUsers(refs) {
    const resolved = new Map();
    refs.forEach(ref => {
      const user = state.userMap[ref];
      if (user && user.id) {
        resolved.set(user.id, user);
      } else {
        resolved.set(ref, { id: ref, username: ref, nickname: ref });
      }
    });
    return Array.from(resolved.values());
  }

  // Render selected chips dynamically
  function renderSelectedChips() {
    const container = overlay.querySelector('#modalSelectedAssignees');
    if (!container) return;
    
    // Resolve all entries to actual unique user objects
    const resolvedUsers = getUniqueResolvedUsers(selectedAssignees);
    
    if (resolvedUsers.length === 0) {
      container.innerHTML = `<span class="empty">Chưa có người thực hiện</span>`;
      return;
    }
    
    container.innerHTML = resolvedUsers.map(user => {
      const initials = getInitials(user.nickname || user.username || ((user.first_name || '') + ' ' + (user.last_name || '')));
      const name = user.nickname || user.username || user.id;
      const avatarUrl = user.id ? getUserAvatarUrlSync(user.id) : '';
      const uid = user.username || user.id;
      return `
        <div class="assignee-chip">
          <div class="avatar-xs">
            ${user.id ? `<img src="${avatarUrl}" alt="${escapeHtml(initials)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />` : ''}
            <span style="${user.id ? 'display:none; align-items:center; justify-content:center;' : 'display:flex; align-items:center; justify-content:center;'}">${escapeHtml(initials)}</span>
          </div>
          <span class="assignee-chip-name">${escapeHtml(name)}</span>
          <button class="btn-remove-assignee" data-user-id="${escapeHtml(uid)}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:12px; padding:0; display:flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; transition:all 0.15s; flex-shrink:0;" title="Xóa">✕</button>
        </div>
      `;
    }).join('');

    // Bind remove listener to the chips X button
    container.querySelectorAll('.btn-remove-assignee').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid = btn.dataset.userId;
        const user = state.userMap[uid];
        
        // Remove all references matching this user (matching both username or ID to be absolutely clean)
        selectedAssignees = selectedAssignees.filter(ref => {
          const resolvedUser = state.userMap[ref];
          return ref !== uid && (!resolvedUser || (resolvedUser.username !== user?.username && resolvedUser.id !== user?.id));
        });
        
        renderSelectedChips();
        renderDropdownList(searchInput.value);
      });
    });
  }

  // Render items inside the search dropdown
  function renderDropdownList(filterText = '') {
    console.log('[Assignees] renderDropdownList called. Filter:', filterText, 'Users count:', channelUsers.length);
    if (!dropdown) return;
    
    if (channelUsers.length === 0 && isLoadingAssignees) {
      dropdown.innerHTML = `<div style="padding:10px; text-align:center; font-size:12px; color:var(--text-muted);">Đang tải thành viên...</div>`;
      return;
    }

    if (channelUsers.length === 0) {
      dropdown.innerHTML = `<div style="padding:10px; text-align:center; font-size:12px; color:var(--text-muted);">Không tìm thấy thành viên</div>`;
      return;
    }

    dropdown.innerHTML = channelUsers.map(u => {
      const uid = u.username || u.id; // User reference
      // Resolve status using username or ID comparison
      const isSelected = selectedAssignees.some(ref => {
        const resolvedUser = state.userMap[ref];
        return ref === u.username || ref === u.id || (resolvedUser && (resolvedUser.username === u.username || resolvedUser.id === u.id));
      });
      const initials = getInitials(u.nickname || u.username || ((u.first_name || '') + ' ' + (u.last_name || '')));
      const avatarUrl = getUserAvatarUrlSync(u.id);
      const displayName = u.nickname || u.username || `${u.first_name} ${u.last_name}`;
      
      return `
        <div class="assignee-dropdown-item ${isSelected ? 'selected' : ''}" data-user-id="${escapeHtml(uid)}" style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:6px; cursor:pointer; transition:all 0.15s; margin-bottom:2px;">
          <div class="avatar-xs" style="width:24px; height:24px; font-size:10px;">
            <img src="${avatarUrl}" alt="${escapeHtml(initials)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" />
            <span style="display:none;">${escapeHtml(initials)}</span>
          </div>
          <div style="flex:1; display:flex; flex-direction:column; line-height:1.2;">
            <span style="font-size:13px; font-weight:550; color:var(--text-primary);">${escapeHtml(displayName)}</span>
            <span style="font-size:10px; color:var(--text-muted);">@${escapeHtml(u.username)}</span>
          </div>
          ${isSelected ? `
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="3" style="width:14px; height:14px; margin-left:auto;"><polyline points="20 6 9 17 4 12"/></svg>
          ` : ''}
        </div>
      `;
    }).join('');

    // Bind dropdown click handlers
    dropdown.querySelectorAll('.assignee-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid = item.dataset.userId;
        const user = state.userMap[uid];
        
        // Find if this user is already in selectedAssignees
        const isAlreadySelected = selectedAssignees.some(ref => {
          const resolvedUser = state.userMap[ref];
          return ref === uid || (resolvedUser && (resolvedUser.username === user?.username || resolvedUser.id === user?.id));
        });

        if (isAlreadySelected) {
          // Remove all references matching this user
          selectedAssignees = selectedAssignees.filter(ref => {
            const resolvedUser = state.userMap[ref];
            return ref !== uid && (!resolvedUser || (resolvedUser.username !== user?.username && resolvedUser.id !== user?.id));
          });
        } else {
          selectedAssignees.push(uid);
        }
        
        renderSelectedChips();
        renderDropdownList(filterText);
      });
    });
  }

  // Setup search input listeners
  if (searchInput && dropdown) {
    let searchDebounceTimer = null;

    searchInput.addEventListener('focus', () => {
      dropdown.style.display = 'block';
      if (channelUsers.length === 0) {
        loadAssigneePage(0, false, currentSearchQuery);
      } else {
        renderDropdownList(currentSearchQuery);
      }
    });

    searchInput.addEventListener('input', () => {
      currentSearchQuery = searchInput.value;
      currentAssigneePage = 0;
      hasMoreAssignees = true;

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        loadAssigneePage(0, false, currentSearchQuery);
      }, 300);
    });

    // Stop propagation on clicks inside the picker wrapper to prevent click-outside auto-close
    const pickerWrapper = overlay.querySelector('.assignee-picker-wrapper');
    if (pickerWrapper) {
      pickerWrapper.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Close dropdown on click outside
    document.addEventListener('click', function closeAssigneeD(e) {
      const wrapper = overlay.querySelector('.assignee-picker-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // Scroll listener for loadmore pagination
    dropdown.addEventListener('scroll', () => {
      if (dropdown.scrollTop + dropdown.clientHeight >= dropdown.scrollHeight - 15) {
        if (hasMoreAssignees && !isLoadingAssignees) {
          currentAssigneePage++;
          loadAssigneePage(currentAssigneePage, true, currentSearchQuery);
        }
      }
    });
  }

  // Initial chips rendering
  renderSelectedChips();

  // Toggle description view and edit states
  const descDisplay = overlay.querySelector('#modalDescDisplay');
  // descInput is already declared above
  const btnEditDesc = overlay.querySelector('#btnEditDesc');
  const btnExpandDesc = overlay.querySelector('#btnExpandDesc');

  // Description expand/collapse toggle
  if (btnExpandDesc && descDisplay) {
    btnExpandDesc.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = descDisplay.classList.toggle('collapsed');
      btnExpandDesc.classList.toggle('expanded', !isCollapsed);
    });
  }

  const descEditActions = overlay.querySelector('#descEditActions');
  const btnCancelDescEdit = overlay.querySelector('#btnCancelDescEdit');
  const btnSaveDescEdit = overlay.querySelector('#btnSaveDescEdit');

  const descEditContainer = overlay.querySelector('#modalDescEditContainer');

  if (descDisplay && descInput && btnEditDesc && descEditActions && descEditContainer) {
    // Initial display states based on isEdit
    if (!isEdit) {
      descDisplay.style.display = 'none';
      btnEditDesc.style.display = 'none';
      descEditContainer.style.display = 'flex';
      descEditActions.style.display = 'none';
    } else {
      descDisplay.style.display = 'block';
      btnEditDesc.style.display = 'inline-flex';
      descEditContainer.style.display = 'none';
      descEditActions.style.display = 'none';
    }

    const enterEditMode = () => {
      descDisplay.style.display = 'none';
      if (btnExpandDesc) btnExpandDesc.style.display = 'none';
      btnEditDesc.style.display = 'none';
      descEditContainer.style.display = 'flex';
      descEditActions.style.display = 'flex';
      descInput.focus();
    };

    const exitEditMode = (saveChanges = false) => {
      if (saveChanges) {
        const val = descInput.value.trim();
        descDisplay.innerHTML = val ? linkify(escapeHtml(val)) : '<span class="empty" style="color:var(--text-muted);font-style:italic;">Chưa có mô tả chi tiết...</span>';
        
        setTimeout(() => {
          if (val && descDisplay.scrollHeight > descDisplay.clientHeight + 10) {
            if (btnExpandDesc) btnExpandDesc.style.display = 'inline-flex';
            descDisplay.classList.add('collapsed');
          } else {
            if (btnExpandDesc) btnExpandDesc.style.display = 'none';
            descDisplay.classList.remove('collapsed');
          }
        }, 100);
      } else {
        descInput.value = description;
      }
      
      descDisplay.style.display = 'block';
      descEditContainer.style.display = 'none';
      descEditActions.style.display = 'none';
      btnEditDesc.style.display = 'inline-flex';
      
      if (!saveChanges) {
        setTimeout(() => {
          if (description && descDisplay.scrollHeight > descDisplay.clientHeight + 10) {
            if (btnExpandDesc) btnExpandDesc.style.display = 'inline-flex';
            descDisplay.classList.add('collapsed');
          } else {
            if (btnExpandDesc) btnExpandDesc.style.display = 'none';
            descDisplay.classList.remove('collapsed');
          }
        }, 100);
      }
    };

    btnEditDesc.addEventListener('click', enterEditMode);
    btnCancelDescEdit.addEventListener('click', () => exitEditMode(false));
    btnSaveDescEdit.addEventListener('click', () => exitEditMode(true));

    // Single eye Preview Toggle
    const btnDescPreviewToggle = overlay.querySelector('#btnDescPreviewToggle');
    const descPreviewDiv = overlay.querySelector('#modalDescPreviewDiv');
    
    if (btnDescPreviewToggle && descPreviewDiv) {
      btnDescPreviewToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isPreviewMode = descPreviewDiv.style.display === 'block';
        if (isPreviewMode) {
          // Switch back to Edit Mode
          descPreviewDiv.style.display = 'none';
          descInput.style.display = 'block';
          btnDescPreviewToggle.classList.remove('active');
          descInput.focus();
        } else {
          // Switch to Preview Mode
          descPreviewDiv.innerHTML = descInput.value.trim() ? parseMarkdown(descInput.value) : '<span class="empty" style="color:var(--text-muted);font-style:italic;">Không có nội dung để xem trước...</span>';
          descInput.style.display = 'none';
          descPreviewDiv.style.display = 'block';
          btnDescPreviewToggle.classList.add('active');
        }
      });
    }

    // Bind markdown formatting helper actions
    const formatButtons = overlay.querySelectorAll('.format-btn:not(#btnDescPreviewToggle)');
    formatButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Auto-switch to write mode if in preview mode
        if (descPreviewDiv && descPreviewDiv.style.display === 'block') {
          btnDescPreviewToggle.click();
        }

        const action = btn.dataset.action;
        const start = descInput.selectionStart;
        const end = descInput.selectionEnd;
        const text = descInput.value;
        const selectedText = text.substring(start, end);
        
        let replacement = '';
        let cursorOffset = 0;
        
        switch (action) {
          case 'heading':
            replacement = `### ${selectedText}`;
            cursorOffset = 0;
            break;
          case 'bold':
            replacement = `**${selectedText}**`;
            cursorOffset = selectedText ? 0 : -2;
            break;
          case 'italic':
            replacement = `*${selectedText}*`;
            cursorOffset = selectedText ? 0 : -1;
            break;
          case 'underline':
            replacement = `<u>${selectedText}</u>`;
            cursorOffset = selectedText ? 0 : -4;
            break;
          case 'strike':
            replacement = `~~${selectedText}~~`;
            cursorOffset = selectedText ? 0 : -2;
            break;
          case 'list':
            if (selectedText) {
              replacement = selectedText.split('\n').map(line => `- ${line}`).join('\n');
            } else {
              replacement = `- `;
            }
            break;
          case 'numlist':
            if (selectedText) {
              replacement = selectedText.split('\n').map((line, idx) => `${idx + 1}. ${line}`).join('\n');
            } else {
              replacement = `1. `;
            }
            break;
          case 'quote':
            if (selectedText) {
              replacement = selectedText.split('\n').map(line => `> ${line}`).join('\n');
            } else {
              replacement = `> `;
            }
            break;
          case 'code':
            replacement = `\`${selectedText}\``;
            cursorOffset = selectedText ? 0 : -1;
            break;
          case 'table':
            replacement = `\n| Cột 1 | Cột 2 |\n|---|---|\n|   |   |\n`;
            cursorOffset = selectedText ? 0 : -15;
            break;
          case 'link':
            replacement = `[${selectedText}](https://)`;
            cursorOffset = selectedText ? 0 : -10;
            break;
        }
        
        descInput.value = text.substring(0, start) + replacement + text.substring(end);
        descInput.focus();
        
        const newCursorPos = start + replacement.length + cursorOffset;
        descInput.setSelectionRange(newCursorPos, newCursorPos);
      });
    });
  }

  // Check if description overflows dynamically
  if (descDisplay && btnExpandDesc && description) {
    setTimeout(() => {
      // scrollHeight is the full height, clientHeight is the visible height (capped by CSS max-height)
      if (descDisplay.scrollHeight > descDisplay.clientHeight + 10) {
        btnExpandDesc.style.display = 'inline-flex';
      } else {
        descDisplay.classList.remove('collapsed');
      }
    }, 100);
  }

  // Delete card click handler
  if (isEdit) {
    overlay.querySelector('.btn-modal-delete')?.addEventListener('click', () => {
      closeModal();
      showConfirmDialog('Xóa card?', 'Card này sẽ bị xóa vĩnh viễn.', async () => {
        try {
          const channelId = state.currentBoard.id;
          await deleteKanbanCard(channelId, laneId, cardId);
          localStorage.removeItem(draftKey);
          state.cards = state.cards.filter(c => (c.id || c._id) !== cardId);
          renderBoard();
          showToast('Đã xóa card', 'success');
        } catch (err) {
          showToast('Lỗi: ' + err.message, 'error');
        }
      });
    });
  }

  // Save changes handler
  overlay.querySelector('.btn-modal-save').addEventListener('click', async () => {
    const saveBtn = overlay.querySelector('.btn-modal-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu…';

    const inputTitle = overlay.querySelector('#modalTitleInput').value.trim();
    if (!inputTitle) {
      showToast('Vui lòng nhập tiêu đề card', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Lưu thay đổi' : 'Tạo mới';
      return;
    }

    const inputDesc = overlay.querySelector('#modalDescInput').value.trim();
    const selectedLaneId = overlay.querySelector('#modalLaneSelect').value;
    const inputDueDate = overlay.querySelector('#modalDueDateInput').value;

    const channelId = state.currentBoard.id;
    const teamId = state.currentTeam.id;
    const profile = state.profile || {};

    const deadlineISO = inputDueDate ? new Date(inputDueDate).toISOString() : '';

    const payload = {
      title: inputTitle,
      description: inputDesc,
      ownerOnly: false,
      creatorEmail: card ? (card.creatorEmail || profile.email) : (profile.email || "hannd@runsystem.net"),
      lane_id: selectedLaneId,
      sharing_channel_id: null,
      data: {
        assignUsers: selectedAssignees.length > 0 ? selectedAssignees : (profile.username ? [profile.username] : ["hannd-runsystem.net"]),
        tags: card ? (card.tags || []) : []
      }
    };

    try {
      if (isEdit) {
        // PUT request
        await updateKanbanCard(channelId, laneId, cardId, teamId, payload);
        
        // Update local card state
        const idx = state.cards.findIndex(c => (c.id || c._id) === cardId);
        if (idx !== -1) {
          state.cards[idx] = {
            ...state.cards[idx],
            title: inputTitle,
            description: inputDesc,
            deadline: deadlineISO,
            laneId: selectedLaneId,
            assignUsers: payload.data.assignUsers
          };
        }
        showToast('Đã lưu thay đổi card', 'success');
      } else {
        // POST request
        const responseData = await createKanbanCard(channelId, teamId, payload);
        const newCard = responseData || {
          id: Math.random().toString(36).substr(2, 9),
          ...payload,
          laneId: selectedLaneId,
          assignUsers: payload.data.assignUsers
        };
        state.cards.push(newCard);
        showToast('Đã tạo card mới thành công', 'success');
      }

      localStorage.removeItem(draftKey);
      closeModal();
      await resolveUsers();
      renderBoard();
    } catch (err) {
      showToast('Lỗi khi thực hiện: ' + err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Lưu thay đổi' : 'Tạo mới';
    }
  });

  // ESC to close
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
  });
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function showConfirmDialog(title, message, onConfirm) {
  const existing = $('#confirmOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'confirmOverlay';
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="confirm-dialog-actions">
        <button class="header-btn" id="confirmCancel">Hủy</button>
        <button class="header-btn primary" id="confirmOk" style="background:var(--danger);border:none;">Xác nhận</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#confirmOk').focus();

  overlay.querySelector('#confirmCancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirmOk').addEventListener('click', () => { overlay.remove(); onConfirm(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function showPromptDialog(title, placeholder, onConfirm) {
  const existing = $('#confirmOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'confirmOverlay';
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <h3>${escapeHtml(title)}</h3>
      <input type="text" id="promptInput" placeholder="${escapeHtml(placeholder)}" style="width:100%; background:var(--bg-card); border:1.5px solid var(--border); border-radius:8px; padding:10px; color:var(--text-primary); margin-top:12px; margin-bottom:12px; outline:none;" />
      <div class="confirm-dialog-actions">
        <button class="header-btn" id="promptCancel">Hủy</button>
        <button class="header-btn primary" id="promptOk">Thêm</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#promptInput');
  input.focus();

  overlay.querySelector('#promptCancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#promptOk').addEventListener('click', () => {
    const val = input.value.trim();
    if (val) {
      overlay.remove();
      onConfirm(val);
    } else {
      showToast('Vui lòng nhập tên lane', 'error');
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      overlay.querySelector('#promptOk').click();
    }
  });
}

async function showAddLaneDialog() {
  const channelId = state.currentBoard?.id;
  const boardId = state.boardDetails?.id || state.boardDetails?._id || channelId;
  if (!channelId || !boardId) {
    showToast('Lỗi: Không tìm thấy Board ID hoặc Channel ID', 'error');
    return;
  }

  showPromptDialog('Thêm lane mới', 'Nhập tên lane (ví dụ: In_Progress)...', async (title) => {
    try {
      showToast('Đang tạo lane mới...', 'info');
      await createKanbanLane(channelId, title, boardId);
      showToast('Đã thêm lane mới thành công', 'success');
      await loadBoardData();
    } catch (err) {
      showToast('Lỗi khi thêm lane: ' + err.message, 'error');
    }
  });
}

function setupColumnMenus() {
  document.addEventListener('click', (e) => {
    // Close any open column menus
    const openMenus = document.querySelectorAll('.column-menu-dropdown');
    openMenus.forEach(m => m.remove());

    const btn = e.target.closest('.column-menu-btn');
    if (!btn) return;

    e.stopPropagation();

    const laneId = btn.dataset.laneId;
    const lane = state.lanes.find(l => l.id === laneId);
    if (!lane) return;

    // Create menu container
    const menu = document.createElement('div');
    menu.className = 'column-menu-dropdown';
    menu.style.cssText = `
      position: absolute;
      top: ${btn.offsetTop + btn.offsetHeight + 4}px;
      right: 0;
      background: var(--bg-modal);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      z-index: 1000;
      padding: 4px;
      min-width: 170px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    `;

    // Determine position/index of this lane to show Move Left/Right
    const index = state.lanes.findIndex(l => l.id === laneId);
    const isFirst = index === 0;
    const isLast = index === state.lanes.length - 1;

    menu.innerHTML = `
      <button class="column-menu-item" data-action="rename">✏️ Đổi tên cột</button>
      <button class="column-menu-item" data-action="completed">${lane.isCompletedLane ? '⬜️ Hủy hoàn thành' : '✅ Đặt làm cột Hoàn thành'}</button>
      ${!isFirst ? `<button class="column-menu-item" data-action="move-left">⬅️ Di chuyển trái</button>` : ''}
      ${!isLast ? `<button class="column-menu-item" data-action="move-right">➡️ Di chuyển phải</button>` : ''}
      <div style="height: 1px; background: var(--border); margin: 4px 0;"></div>
      <button class="column-menu-item danger" data-action="delete">🗑️ Xóa cột</button>
    `;

    // Append to the column header
    const columnHeader = btn.closest('.column-header');
    if (columnHeader) {
      columnHeader.style.position = 'relative';
      columnHeader.appendChild(menu);
    }

    // Event listener for menu items
    menu.querySelectorAll('.column-menu-item').forEach(item => {
      item.addEventListener('click', async (evt) => {
        evt.stopPropagation();
        menu.remove();
        const action = item.dataset.action;
        await handleLaneAction(laneId, action);
      });
    });
  });
}

async function handleLaneAction(laneId, action) {
  const channelId = state.currentBoard?.id;
  const lane = state.lanes.find(l => l.id === laneId);
  if (!channelId || !lane) return;

  if (action === 'rename') {
    showPromptDialog('Đổi tên cột', 'Nhập tên mới cho cột:', async (newTitle) => {
      if (!newTitle || newTitle.trim() === '') return;
      try {
        showToast('Đang cập nhật tên cột...', 'info');
        await updateKanbanLane(channelId, laneId, newTitle.trim(), lane.isCompletedLane, lane.order);
        showToast('Đã đổi tên cột thành công', 'success');
        await loadBoardData();
      } catch (err) {
        showToast('Lỗi khi đổi tên: ' + err.message, 'error');
      }
    }, lane.name);
  } else if (action === 'completed') {
    try {
      const nextVal = !lane.isCompletedLane;
      showToast('Đang cập nhật trạng thái cột...', 'info');
      await updateKanbanLane(channelId, laneId, lane.name, nextVal, lane.order);
      showToast(nextVal ? 'Đã đặt cột làm Hoàn thành' : 'Đã hủy trạng thái Hoàn thành', 'success');
      await loadBoardData();
    } catch (err) {
      showToast('Lỗi khi cập nhật trạng thái: ' + err.message, 'error');
    }
  } else if (action === 'move-left' || action === 'move-right') {
    const index = state.lanes.findIndex(l => l.id === laneId);
    let targetIndex = -1;
    if (action === 'move-left' && index > 0) targetIndex = index - 1;
    if (action === 'move-right' && index < state.lanes.length - 1) targetIndex = index + 1;

    if (targetIndex !== -1) {
      try {
        const otherLane = state.lanes[targetIndex];
        
        // Swap their order timestamps/numbers
        let currentOrder = lane.order || Date.now();
        let otherOrder = otherLane.order || Date.now();

        // If orders are identical, offset them slightly
        if (currentOrder === otherOrder) {
          if (action === 'move-left') {
            currentOrder = otherOrder - 1000;
          } else {
            currentOrder = otherOrder + 1000;
          }
        } else {
          // Normal swap
          const temp = currentOrder;
          currentOrder = otherOrder;
          otherOrder = temp;
        }

        showToast('Đang thay đổi thứ tự cột...', 'info');
        await updateKanbanLane(channelId, lane.id, lane.name, lane.isCompletedLane, currentOrder);
        await updateKanbanLane(channelId, otherLane.id, otherLane.name, otherLane.isCompletedLane, otherOrder);
        showToast('Đã di chuyển cột thành công', 'success');
        await loadBoardData();
      } catch (err) {
        showToast('Lỗi khi thay đổi thứ tự: ' + err.message, 'error');
      }
    }
  } else if (action === 'delete') {
    showConfirmDialog('Xóa cột này?', 'Cột này sẽ bị xóa khỏi Board vĩnh viễn. Hành động này không thể hoàn tác.', async () => {
      try {
        showToast('Đang xóa cột...', 'info');
        await deleteKanbanLane(channelId, laneId);
        showToast('Đã xóa cột thành công', 'success');
        await loadBoardData();
      } catch (err) {
        showToast('Lỗi khi xóa cột: ' + err.message, 'error');
      }
    });
  }
}

// ─── Board Selector ───────────────────────────────────────────────────────────

function renderBoardDropdown() {
  const list = $('#boardDropdownList');
  if (!list) return;

  const searchInput = $('#boardSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filteredBoards = state.boards.filter(board => {
    return (board.title || '').toLowerCase().includes(query) || (board.name || '').toLowerCase().includes(query);
  });

  list.innerHTML = filteredBoards.map(board => {
    const creatorUser = state.userMap[board.creatorId];
    const creatorName = creatorUser ? (creatorUser.nickname || creatorUser.username) : '';
    const creatorBadge = creatorName ? `<span class="board-opt-creator" style="font-size:11.5px; color:var(--text-muted); font-weight:normal; opacity:0.85; margin-left:auto;">👤 ${escapeHtml(creatorName)}</span>` : '';

    return `
      <div class="board-option ${board.id === state.currentBoard?.id ? 'active' : ''}" data-board-id="${escapeHtml(board.id)}">
        <span class="board-opt-name">${escapeHtml(board.title || 'Untitled Board')}</span>
        ${creatorBadge}
      </div>
    `;
  }).join('');

  list.querySelectorAll('.board-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const boardId = opt.dataset.boardId;
      state.currentBoard = state.boards.find(b => b.id === boardId);
      closeBoardDropdown();
      await loadBoardData();
    });
  });
}

function updateBoardSelectorLabel() {
  const nameEl = $('#boardSelectorName');
  if (nameEl && state.currentBoard) {
    nameEl.textContent = state.currentBoard.title || 'Board';
  }
}

function setupBoardSelector() {
  const selector = $('#boardSelector');
  const btn = $('#boardSelectorBtn');
  if (!selector || !btn) return;

  const searchInput = $('#boardSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderBoardDropdown();
    });
    searchInput.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close workspace dropdown if open
    closeWorkspaceDropdown();
    selector.classList.toggle('open');
    if (selector.classList.contains('open') && searchInput) {
      searchInput.value = '';
      renderBoardDropdown();
      setTimeout(() => searchInput.focus(), 50);
    }
  });

  document.addEventListener('click', (e) => {
    if (!selector.contains(e.target)) selector.classList.remove('open');
  });
}

function closeBoardDropdown() {
  $('#boardSelector')?.classList.remove('open');
}

// ─── Workspace Selector ───────────────────────────────────────────────────────

function renderWorkspaceDropdown() {
  const list = $('#workspaceDropdownList');
  if (!list) return;

  const currentTeamId = typeof state.currentTeam === 'string' ? state.currentTeam : state.currentTeam?.id;

  list.innerHTML = (state.teams || []).map(team => {
    const isActive = team.id === currentTeamId || team.name === currentTeamId;
    return `
      <div class="board-option ${isActive ? 'active' : ''}" data-team-id="${escapeHtml(team.id)}">
        <span class="board-opt-name">${escapeHtml(team.display_name || team.name || 'Workspace')}</span>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.board-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const teamId = opt.dataset.teamId;
      const newTeam = state.teams.find(t => t.id === teamId);
      const currentId = typeof state.currentTeam === 'string' ? state.currentTeam : state.currentTeam?.id;
      if (!newTeam || newTeam.id === currentId) {
        closeWorkspaceDropdown();
        return;
      }
      state.currentTeam = newTeam;
      updateWorkspaceSelectorLabel();
      renderWorkspaceDropdown(); // Sync dropdown highlight immediately!
      closeWorkspaceDropdown();
      
      // Save last team to storage
      await chrome.storage.local.set({ kanban_last_team: newTeam.id });
      
      // Reset board state and reload
      state.currentBoard = null;
      state.boards = [];
      state.lanes = [];
      state.cards = [];
      await loadBoards();
    });
  });
}

function updateWorkspaceSelectorLabel() {
  const nameEl = $('#workspaceSelectorName');
  if (nameEl && state.currentTeam) {
    const displayName = state.currentTeam.display_name || state.currentTeam.name || (typeof state.currentTeam === 'string' ? state.currentTeam : 'Workspace');
    nameEl.textContent = displayName;
  }
}

function setupWorkspaceSelector() {
  const selector = $('#workspaceSelector');
  const btn = $('#workspaceSelectorBtn');
  if (!selector || !btn) return;

  // Render initial label
  updateWorkspaceSelectorLabel();
  renderWorkspaceDropdown();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close board dropdown if open
    closeBoardDropdown();
    selector.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!selector.contains(e.target)) selector.classList.remove('open');
  });
}

function closeWorkspaceDropdown() {
  $('#workspaceSelector')?.classList.remove('open');
}

// ─── Search ───────────────────────────────────────────────────────────────────

function setupSearch() {
  const input = $('#searchInput');
  if (!input) return;

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      state.searchQuery = input.value.trim();
      await loadBoardData();
    }, 250);
  });
}

function setupFilters() {
  const btnMine = $('#filterMine');
  const btnOverdue = $('#filterOverdue');

  if (btnMine) {
    btnMine.addEventListener('click', () => {
      state.filterMine = !state.filterMine;
      btnMine.classList.toggle('active', state.filterMine);
      renderBoard();
    });
  }

  if (btnOverdue) {
    btnOverdue.addEventListener('click', async () => {
      state.filterOverdue = !state.filterOverdue;
      btnOverdue.classList.toggle('active', state.filterOverdue);
      await loadBoardData();
    });
  }
}

// ─── Assignee Filter ──────────────────────────────────────────────────────────

function renderAssigneeFilters() {
  const container = $('#assigneeFilters');
  if (!container) return;

  const memberIds = new Set();
  state.cards.forEach(c => getCardAssignees(c).forEach(id => memberIds.add(id)));
  const memberList = Array.from(memberIds).slice(0, 8);

  container.innerHTML = memberList.map(uid => {
    const user = state.userMap[uid];
    const initials = user ? getInitials(user.nickname || user.username || ((user.first_name || '') + ' ' + (user.last_name || ''))) : String(uid).substring(0, 2).toUpperCase();
    const name = user ? (user.nickname || user.username || uid) : uid;
    const avatarUrl = user ? getUserAvatarUrlSync(user.id) : '';
    return `
      <div class="assignee-avatar-filter ${state.assigneeFilter === uid ? 'active' : ''}" 
           data-user-id="${escapeHtml(uid)}" 
           title="${escapeHtml(name)}"
           style="overflow:hidden; display:flex; align-items:center; justify-content:center;">
        ${user ? `<img src="${avatarUrl}" alt="${escapeHtml(initials)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />` : ''}
        <span style="${user ? 'display:none;' : 'display:flex;'} width:100%; height:100%; align-items:center; justify-content:center;">${escapeHtml(initials)}</span>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.assignee-avatar-filter').forEach(el => {
    el.addEventListener('click', () => {
      const uid = el.dataset.userId;
      state.assigneeFilter = state.assigneeFilter === uid ? null : uid;
      renderBoard();
      renderAssigneeFilters(); // re-render filters to update active state classes
    });
  });
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

function setupRefresh() {
  const btn = $('#refreshBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (btn.classList.contains('spinning')) return;
    btn.classList.add('spinning');
    await refreshCards();
    btn.classList.remove('spinning');
  });
}

// ─── User Avatar ──────────────────────────────────────────────────────────────

function renderUserAvatar() {
  const el = $('#userAvatar');
  if (!el || !state.profile) return;
  const initials = getInitials((state.profile.first_name || '') + ' ' + (state.profile.last_name || '') || state.profile.username);
  const avatarUrl = getUserAvatarUrlSync(state.profile.id);
  el.title = state.profile.username || '';
  el.innerHTML = `
    <img src="${avatarUrl}" alt="${escapeHtml(initials)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
    <span style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">${escapeHtml(initials)}</span>
  `;
}

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + F → focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      $('#searchInput')?.focus();
    }
    // Ctrl/Cmd + R → refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
      e.preventDefault();
      refreshCards();
    }
  });
}

// Ready marker for module check
window.__kanbanReady = true;

async function setupTheme() {
  const themeToggle = $('#themeToggleBtn');
  const sunIcon = themeToggle?.querySelector('.sun-icon');
  const moonIcon = themeToggle?.querySelector('.moon-icon');

  // 1. Theme light/dark mode switcher (Defaults to Dark)
  let currentTheme = localStorage.getItem('kanban_theme_mode') || 'dark';

  const applyThemeMode = (theme) => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
      if (sunIcon) sunIcon.style.display = 'block';
      if (moonIcon) moonIcon.style.display = 'none';
    } else {
      root.removeAttribute('data-theme');
      if (sunIcon) sunIcon.style.display = 'none';
      if (moonIcon) moonIcon.style.display = 'block';
    }
    localStorage.setItem('kanban_theme_mode', theme);
    
    // Trigger updating the header/nav color properties dynamically when theme is switched
    updateThemeColors(theme);
  };

  // Function to apply dynamic properties based on current mode
  const updateThemeColors = async (theme) => {
    try {
      const res = await chrome.storage.local.get('chatops_settings');
      const settings = res.chatops_settings || {};
      const accent = settings.accentColor || '#1c58d9';
      const headerBg = settings.headerColor || '#1153ab';

      const root = document.documentElement;
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--accent-grd', `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 80%, #000))`);
      root.style.setProperty('--border-focus', `color-mix(in srgb, ${accent} 60%, transparent)`);
      root.style.setProperty('--accent-glow', `color-mix(in srgb, ${accent} 30%, transparent)`);

      if (theme === 'light') {
        root.style.setProperty('--header-bg', headerBg);
        root.style.setProperty('--nav-bg', '#ffffff'); // Clean white separation toolbar
      } else {
        root.style.setProperty('--header-bg', '#161b22');
        root.style.setProperty('--nav-bg', '#0d1117');
      }
    } catch (err) {
      console.warn('[Theme] Failed to read settings:', err);
    }
  };

  // Apply initial theme
  applyThemeMode(currentTheme);

  // Click listener
  themeToggle?.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyThemeMode(currentTheme);
  });
}

function linkify(text) {
  return parseMarkdown(text);
}

function parseMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  
  // 1. Tokenize Markdown links [text](url) first to prevent double-matching
  const mdLinks = [];
  html = html.replace(/\[([^\]]+)\]\(((?:https?|ftp|file):\/\/[^\s)]+)\)/g, (match, linkText, url) => {
    const placeholder = `___MDLINK_${mdLinks.length}___`;
    mdLinks.push(`<a href="${url}" target="_blank" class="kb-link" onclick="event.stopPropagation();">${linkText}</a>`);
    return placeholder;
  });
  
  // 2. Tokenize raw URLs (only match URLs that are not part of any placeholders or html tags)
  const rawUrls = [];
  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  html = html.replace(urlPattern, (match) => {
    if (match.includes('___MDLINK_')) return match;
    const placeholder = `___RAWLINK_${rawUrls.length}___`;
    rawUrls.push(`<a href="${match}" target="_blank" class="kb-link" onclick="event.stopPropagation();">${match}</a>`);
    return placeholder;
  });
  
  // 3. Parse other markdown elements
  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3 style="margin: 8px 0 4px 0; font-size: 15px; font-weight: 700; color: var(--text-primary);">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="margin: 10px 0 6px 0; font-size: 17px; font-weight: 700; color: var(--text-primary); border-bottom: 1px solid var(--border); padding-bottom: 3px;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="margin: 12px 0 8px 0; font-size: 19px; font-weight: 700; color: var(--text-primary); border-bottom: 1px solid var(--border); padding-bottom: 4px;">$1</h1>');
  
  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700;">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em style="font-style: italic;">$1</em>');
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
  
  // Parse underline tags (which were escaped to &lt;u&gt;)
  html = html.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<u style="text-decoration: underline;">$1</u>');
  
  // Inline Code
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-input); padding:2px 6px; border-radius:4px; font-family:monospace; font-size:12px; color:var(--text-primary); border:1px solid var(--border);">$1</code>');
  
  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left:3px solid var(--accent); padding-left:10px; margin:10px 0; color:var(--text-secondary); font-style: italic;">$1</blockquote>');
  
  // Lists
  html = html.replace(/^\- (.*$)/gim, '<ul style="margin: 4px 0; padding-left: 20px; list-style-type: disc;"><li>$1</li></ul>');
  html = html.replace(/^([0-9]+)\. (.*$)/gim, '<ol style="margin: 4px 0; padding-left: 20px; list-style-type: decimal;"><li>$2</li></ol>');
  
  // Clean up adjacent list tags
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  html = html.replace(/<\/ol>\s*<ol>/g, '');
  
  // Tables formatting
  if (html.includes('|')) {
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    let rows = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          rows = [];
        }
        if (line.includes('---')) continue;
        
        const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        rows.push(cells);
      } else {
        if (inTable) {
          tableHtml = renderTableHtml(rows);
          lines.splice(i - rows.length - 1, rows.length + 1, tableHtml);
          i -= rows.length;
          inTable = false;
        }
      }
    }
    if (inTable) {
      tableHtml = renderTableHtml(rows);
      lines.splice(lines.length - rows.length, rows.length, tableHtml);
    }
    html = lines.join('\n');
  }

  // Convert remaining newlines to breaks
  html = html.replace(/\n/g, '<br>');
  
  // 4. Detokenize links back to original tag string
  mdLinks.forEach((linkHtml, idx) => {
    html = html.replace(`___MDLINK_${idx}___`, linkHtml);
  });
  rawUrls.forEach((linkHtml, idx) => {
    html = html.replace(`___RAWLINK_${idx}___`, linkHtml);
  });
  
  return html;
}

function renderTableHtml(rows) {
  if (!rows || rows.length === 0) return '';
  let html = '<table style="border-collapse: collapse; width: 100%; margin: 12px 0; border: 1px solid var(--border); font-size: 13px;">';
  
  // Header
  html += '<thead><tr style="background: var(--bg-input); border-bottom: 2px solid var(--border);">';
  rows[0].forEach(cell => {
    html += `<th style="padding: 8px 12px; border: 1px solid var(--border); text-align: left; font-weight: 600; color: var(--text-primary);">${cell}</th>`;
  });
  html += '</tr></thead>';
  
  // Body
  html += '<tbody>';
  for (let i = 1; i < rows.length; i++) {
    html += '<tr style="border-bottom: 1px solid var(--border);">';
    rows[i].forEach(cell => {
      html += `<td style="padding: 8px 12px; border: 1px solid var(--border); color: var(--text-primary);">${cell}</td>`;
    });
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

async function setupHeaderActions() {
  // 1. Coffee Donate Modal
  const coffeeBtn = $('#btnHeaderCoffee');
  const donateModal = $('#donateModal');
  const donateClose = $('#btnDonateModalClose');
  
  if (coffeeBtn && donateModal) {
    coffeeBtn.addEventListener('click', () => {
      donateModal.style.display = 'flex';
    });
  }
  
  if (donateClose && donateModal) {
    donateClose.addEventListener('click', () => {
      donateModal.style.display = 'none';
    });
    donateModal.addEventListener('click', (e) => {
      if (e.target === donateModal) {
        donateModal.style.display = 'none';
      }
    });
  }

  // 2. Rate Review Link
  const rateBtn = $('#btnHeaderRate');
  if (rateBtn) {
    rateBtn.addEventListener('click', () => {
      const url = `https://chromewebstore.google.com/detail/chatops++/mmemhnbgmhfaognbfjhienigmmephjgm/reviews?hl=vi&authuser=0`;
      window.open(url, '_blank');
    });
  }
}

function checkAndShowSelectorGuide() {
  console.log('[Kanban Guide] Checking selector guide. Guided flag:', localStorage.getItem('kanban_selectors_guided'));
  if (localStorage.getItem('kanban_selectors_guided') === 'true') return;

  const target = $('#boardSelector');
  const boardBtn = $('#boardSelectorBtn');
  const workspaceBtn = $('#workspaceSelectorBtn');
  console.log('[Kanban Guide] Target elements found:', !!target, !!boardBtn, !!workspaceBtn);
  if (!target || !boardBtn) return;

  // Add pulse animation to the button
  boardBtn.classList.add('kb-pulse-highlight');

  // Inject pulse animation CSS if not present
  let styleEl = document.getElementById('kb-pulse-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'kb-pulse-style';
    styleEl.textContent = `
      @keyframes kb-pulse-highlight-ani {
        0% { box-shadow: 0 0 0 0 var(--accent, rgba(28, 88, 217, 0.6)); }
        70% { box-shadow: 0 0 0 10px rgba(28, 88, 217, 0); }
        100% { box-shadow: 0 0 0 0 rgba(28, 88, 217, 0); }
      }
      .kb-pulse-highlight {
        animation: kb-pulse-highlight-ani 1.8s infinite !important;
        border-color: var(--accent) !important;
      }
    `;
    document.head.appendChild(styleEl);
  }

  const guide = document.createElement('div');
  guide.id = 'kanbanSelectorGuide';
  guide.style.cssText = `
    position: absolute;
    background: var(--accent);
    color: #ffffff;
    padding: 14px 18px;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 9999;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.5;
    width: 320px;
    text-align: center;
    animation: modalIn 0.25s ease;
    box-sizing: border-box;
  `;

  const rect = target.getBoundingClientRect();
  guide.style.top = (rect.bottom + window.scrollY + 12) + 'px';
  guide.style.left = (rect.left + window.scrollX + rect.width / 2 - 160) + 'px';

  guide.innerHTML = `
    <div style="position:absolute; top:-6px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:6px solid var(--accent);"></div>
    <div style="font-weight:bold; font-size:14px; margin-bottom:6px;">💡 Chọn Kênh Kanban</div>
    <div style="margin-bottom:12px; opacity:0.95;">Vui lòng chọn <strong>Channel (Kênh)</strong> tại đây để tải dữ liệu bảng công việc và ghi chú tương ứng!</div>
    <button id="btnGotItGuide" class="header-btn" style="background:#ffffff !important; color:var(--accent) !important; border:none !important; padding:4px 14px !important; font-size:12px !important; font-weight:600 !important; cursor:pointer !important; height:auto !important; width:auto !important; margin:0 auto !important; display:block !important; border-radius:6px !important; box-shadow:0 2px 4px rgba(0,0,0,0.1) !important;">Đã hiểu</button>
  `;

  const dismissAll = () => {
    localStorage.setItem('kanban_selectors_guided', 'true');
    guide.remove();
    boardBtn.classList.remove('kb-pulse-highlight');
    workspaceBtn?.removeEventListener('click', dismissAll);
    boardBtn?.removeEventListener('click', dismissAll);
  };

  const btn = guide.querySelector('#btnGotItGuide');
  if (btn) {
    btn.addEventListener('click', dismissAll);
  }

  workspaceBtn?.addEventListener('click', dismissAll);
  boardBtn?.addEventListener('click', dismissAll);

  document.body.appendChild(guide);
}




