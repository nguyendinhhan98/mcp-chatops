/**
 * Kanban API — ChatOps Kanban Plugin (chatops-kanban-plugin)
 * Base URL: {chatopsUrl}/plugins/chatops-kanban-plugin
 * Core Service URL: {chatopsUrl}/agileos-service
 */

// ─── Config & Settings ──────────────────────────────────────────────────────

let _config = null;
let _pluginSettings = null;

export async function getConfig() {
  if (_config) return _config;
  const res = await chrome.storage.local.get(['chatopsUrl', 'cookie', 'csrf', 'teamName']);
  _config = {
    chatopsUrl: res.chatopsUrl || 'https://chat.runsystem.vn',
    cookie: res.cookie || '',
    csrf: res.csrf || '',
    teamName: res.teamName || 'dn',
  };
  return _config;
}

export function clearConfigCache() {
  _config = null;
  _pluginSettings = null;
}

/** Get the agileos-service plugin settings containing apiURL and workspaceID */
export async function getPluginSettings() {
  if (_pluginSettings) return _pluginSettings;
  const config = await getConfig();
  const url = `${config.chatopsUrl}/plugins/chatops-kanban-plugin/plugin-settings`;
  const headers = await buildHeaders();
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    _pluginSettings = await response.json();
    console.log('[Kanban API] Loaded plugin settings:', _pluginSettings);
    return _pluginSettings;
  } catch (err) {
    console.error('[Kanban API] Failed to load plugin settings:', err);
    // Fallback defaults from screenshot
    return {
      apiURL: `${config.chatopsUrl}/agileos-service`,
      workspaceID: '6224cbfd6586b50435dd12d3'
    };
  }
}

// ─── HTTP Clients ───────────────────────────────────────────────────────────

async function buildHeaders() {
  const config = await getConfig();
  const headers = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (config.cookie) {
    const token = config.cookie.includes('=') ? config.cookie.split('=').slice(1).join('=') : config.cookie;
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (config.csrf) {
    const csrfToken = config.csrf.includes('=') ? config.csrf.split('=').slice(1).join('=') : config.csrf;
    headers['X-CSRF-Token'] = csrfToken;
  }
  return headers;
}

/** Call AgileOS Kanban service API */
async function agileRequest(path, options = {}) {
  const settings = await getPluginSettings();
  // Ensure we don't have double slashes
  const basePath = settings.apiURL.endsWith('/') ? settings.apiURL.slice(0, -1) : settings.apiURL;
  const url = `${basePath}/chatops-client${path}`;
  const baseHeaders = await buildHeaders();
  
  // Merge required AgileOS headers: appkey and pluginid
  const headers = {
    ...baseHeaders,
    'appkey': settings.appKey || settings.appkey || 'U2FsdGVkX19hK9IboGD9f+FvHcAmDb4d5rSaLrb96GlXc8ObSyZxp3WpyU45Vi8FdDpiM+n53GtKronRq3ZbzPuxXYAAVN3+Tt21irXkMNZ2O+TY6AGoA2JpdncK4rfM',
    'pluginid': 'chatops-kanban',
    ...options.headers
  };
  
  console.log(`[AgileOS API] Requesting: ${url}`, options);
  const response = await fetch(url, { 
    ...options, 
    headers,
    credentials: 'include'
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `AgileOS API error: ${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return null;
  const data = await response.json();
  console.log(`[AgileOS API] Response from ${path}:`, data);
  return data;
}

/** Call ChatOps Kanban plugin API */
async function kbRequest(path, options = {}) {
  const config = await getConfig();
  const url = `${config.chatopsUrl}/plugins/chatops-kanban-plugin${path}`;
  const headers = await buildHeaders();
  console.log(`[Kanban API] Requesting: ${url}`, options);
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Kanban API error: ${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return null;
  const data = await response.json();
  console.log(`[Kanban API] Response from ${path}:`, data);
  return data;
}

/** Call Mattermost core API v4 */
async function mmRequest(path, options = {}) {
  const config = await getConfig();
  const url = `${config.chatopsUrl}/api/v4${path}`;
  const headers = await buildHeaders();
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Mattermost API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// ─── Mattermost Core API ────────────────────────────────────────────────────

export async function getMyProfile() {
  return mmRequest('/users/me');
}

export async function getMyTeams() {
  return mmRequest('/users/me/teams');
}

export async function getTeamByName(teamName) {
  return mmRequest(`/teams/name/${teamName}`);
}

export async function getMyChannels(teamId) {
  return mmRequest(`/users/me/teams/${teamId}/channels`);
}

export async function getUsers(page = 0, perPage = 60, teamId = '') {
  const query = teamId ? `?in_team=${teamId}&page=${page}&per_page=${perPage}` : `?page=${page}&per_page=${perPage}`;
  return mmRequest(`/users${query}`);
}

export async function searchUsers(term, teamId = '', page = 0, perPage = 30) {
  if (!term) {
    return getUsers(page, perPage, teamId);
  }
  const body = { term, allow_inactive: false };
  if (teamId) body.team_id = teamId;
  return mmRequest('/users/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getUsersByIds(ids) {
  if (!ids || ids.length === 0) return [];
  return mmRequest('/users/ids', {
    method: 'POST',
    body: JSON.stringify(ids),
  });
}

export async function getUsersByUsernames(usernames) {
  if (!usernames || usernames.length === 0) return [];
  return mmRequest('/users/usernames', {
    method: 'POST',
    body: JSON.stringify(usernames),
  });
}

export function getUserAvatarUrl(userId) {
  return getConfig().then(c => `${c.chatopsUrl}/api/v4/users/${userId}/image`);
}

export function getUserAvatarUrlSync(userId) {
  const baseUrl = _config?.chatopsUrl || 'https://chat.runsystem.vn';
  return `${baseUrl}/api/v4/users/${userId}/image`;
}


// ─── ChatOps Kanban Plugin API ──────────────────────────────────────────────

/**
 * Get board details (entire lanes + cards grouped)
 * GET /plugins/chatops-kanban-plugin/c-{channelId}
 */
export async function getKanbanBoardDetails(channelId, teamId, cardStatus = 'all', searchQuery = '') {
  let url = `/c-${channelId}?card_status=${cardStatus}&teamId=${teamId}`;
  if (searchQuery) {
    url += `&search_type=title&search=${encodeURIComponent(searchQuery)}`;
  }
  return kbRequest(url);
}

/**
 * Create a new card on a lane
 * POST /plugins/chatops-kanban-plugin/channel/{channelId}/card
 */
export async function createKanbanCard(channelId, teamId, cardData) {
  return kbRequest(`/channel/${channelId}/card?currentTeamId=${teamId}`, {
    method: 'POST',
    body: JSON.stringify(cardData)
  });
}

/**
 * Move a card to a different lane
 * POST /plugins/chatops-kanban-plugin/channel/{channelId}/card/{cardId}/move
 */
export async function moveKanbanCard(channelId, cardId, moveData) {
  return kbRequest(`/channel/${channelId}/card/${cardId}/move`, {
    method: 'POST',
    body: JSON.stringify(moveData)
  });
}

/**
 * Update card details
 * PUT /plugins/chatops-kanban-plugin/channel/{channelId}/card/{laneId}/{cardId}
 */
export async function updateKanbanCard(channelId, laneId, cardId, teamId, cardData) {
  return kbRequest(`/channel/${channelId}/card/${laneId}/${cardId}?currentTeamId=${teamId}`, {
    method: 'PUT',
    body: JSON.stringify(cardData)
  });
}

/**
 * Delete a card from a lane
 * DELETE /plugins/chatops-kanban-plugin/channel/{channelId}/card/{laneId}/{cardId}
 */
export async function deleteKanbanCard(channelId, laneId, cardId) {
  return kbRequest(`/channel/${channelId}/card/${laneId}/${cardId}`, {
    method: 'DELETE'
  });
}

/**
 * Create a new lane (column)
 * POST /plugins/chatops-kanban-plugin/channel/{channelId}/lane
 */
export async function createKanbanLane(channelId, title, boardId) {
  return kbRequest(`/channel/${channelId}/lane`, {
    method: 'POST',
    body: JSON.stringify({ title, boardId })
  });
}

/**
 * Update an existing lane (column)
 * PUT /plugins/chatops-kanban-plugin/channel/{channelId}/lane/{laneId}
 */
export async function updateKanbanLane(channelId, laneId, title, isCompletedLane, order = null) {
  const body = { title, isCompletedLane };
  if (order !== null) {
    body.order = Number(order);
  }
  return kbRequest(`/channel/${channelId}/lane/${laneId}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

/**
 * Delete a lane (column)
 * DELETE /plugins/chatops-kanban-plugin/channel/{channelId}/lane/{laneId}
 */
export async function deleteKanbanLane(channelId, laneId) {
  return kbRequest(`/channel/${channelId}/lane/${laneId}`, {
    method: 'DELETE'
  });
}

/**
 * Get board/channel overview (lanes + cards)
 * GET /plugins/chatops-kanban-plugin/boards/{channelId}/overviews
 */
export async function getKanbanBoardOverview(channelId, teamId, username, filterBy = 'all', searchQuery = '', isMyTasks = false) {
  const query = new URLSearchParams({
    teamId,
    username,
    filterBy,
    searchType: 'title',
    searchInput: searchQuery,
    isMyTasks: String(isMyTasks)
  }).toString();
  return kbRequest(`/boards/${channelId}/overviews?${query}`);
}

// ─── AgileOS Service API (Kanban Core Backend) ──────────────────────────────

/**
 * Get board lanes for a channel
 * GET /agileos-service/chatops-client/lanes
 */
export async function getKanbanLanes(channelId, workspaceId) {
  return agileRequest(`/lanes?channelId=${channelId}&workspaceId=${workspaceId}`);
}

/**
 * Get incomplete cards count
 * GET /agileos-service/chatops-client/my-tasks/incomplete/count
 */
export async function getIncompleteTasksCount(teamId, workspaceId, username) {
  return agileRequest(`/my-tasks/incomplete/count?teamId=${teamId}&workspaceId=${workspaceId}&mm_username=${username}`);
}

/**
 * Get card by Post ID
 * GET /agileos-service/chatops-client/cards/by-post/{postId}
 */
export async function getCardByPost(postId) {
  return agileRequest(`/cards/by-post/${postId}`);
}

/**
 * Get cards list for a board/channel (supporting multiple common endpoint guesses)
 */
export async function getKanbanCardsDirect(channelId, workspaceId, filterBy = 'all', searchQuery = '') {
  const query = new URLSearchParams({
    channelId,
    workspaceId,
    filterBy,
    searchType: 'title',
    searchInput: searchQuery
  }).toString();
  return agileRequest(`/cards?${query}`);
}

/**
 * Update card lane (drag-and-drop or status change)
 * PATCH /agileos-service/chatops-client/cards/{cardId}
 */
export async function updateCardLane(cardId, toLaneId, workspaceId) {
  return agileRequest(`/cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      laneId: toLaneId,
      workspaceId
    })
  });
}



