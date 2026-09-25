// app.js - Controller and Routing Coordinator

import { 
  initSystemState, 
  saveState, 
  getInitialState, 
  autoScheduleMatches, 
  generateBracket, 
  advanceWinner, 
  loadMockDataIntoState,
  checkPlayerRestConflict,
  checkAndGenerateNextRound
} from './state.js?v=58';

import { 
  renderPlayerSearch, 
  renderPlayerCourts, 
  renderPlayerUpcoming, 
  renderPlayerBrackets, 
  renderStaffDashboard, 
  renderRefereePanel, 
  renderSetupPlayers, 
  renderSetupCourtMapBuilder,
  renderPlayerCourtMap,
  drawCertificate,
  initAudio,
  playNotificationChime,
  speakSummon
} from './ui.js?v=81';

let state = null;
let activeView = 'player-view';

// Keep track of called match IDs to avoid repeating speech/visual summons alerts
let previouslyCalledMatchIds = new Set();
let isAppInitialized = false;

// Initialize the App
function init() {

  


  

  initSystemState((newState) => {
    state = newState;
    
    // First time initialization
    if (!isAppInitialized) {
      isAppInitialized = true;

      

      
      // Cache initially called matches so we don't announce them upon page load
      state.matches.forEach(m => {
        if (m.status === 'called') {
          previouslyCalledMatchIds.add(m.id);
        }
      });

      setupEventListeners();
      
      // Populate setup inputs with saved configs
      if (state.configs) {
        if (state.courts && state.courts.length) document.getElementById('setup-court-count').value = state.courts.length;
        if (state.configs.restBufferMinutes) document.getElementById('setup-rest-buffer').value = state.configs.restBufferMinutes;
        if (state.configs.summonLimitMinutes) document.getElementById('setup-summon-limit').value = state.configs.summonLimitMinutes;
        if (state.configs.giftClaimCode) document.getElementById('setup-gift-claim-code').value = state.configs.giftClaimCode;
        if (state.configs.adminPassword) document.getElementById('setup-admin-password').value = state.configs.adminPassword;
      }
      
      // Periodic update loop (every 1 second) for timers
      setInterval(tickTimers, 1000);
      
      // Autoselect first event for bracket select if present
      const select = document.getElementById('player-bracket-event-select');
      if (state.events.length > 0 && select.options.length === 0) {
        state.events.forEach(ev => {
          const opt = document.createElement('option');
          opt.value = ev;
          opt.text = ev;
          select.add(opt);
        });
      }
    }

    // Every time state updates from cloud (or local)
    checkForNewSummons(state);
    renderAll();
  });
}

// Global renderer
function renderAll() {
  // Update state indicators & layouts
  renderPlayerCourtMap(state);
  renderPlayerCourts(state);
  renderPlayerUpcoming(state);
  renderPlayerBrackets(state);
  renderStaffDashboard(state);
  renderRefereePanel(state);
  renderSetupPlayers(state);
    window.renderDrawOrderButtons();

  renderSetupCourtMapBuilder(state);
}

// Local save state and dispatch render
function saveAndRender() {
  if(window.renderDrawOrderButtons) window.renderDrawOrderButtons();
  saveState(state);
  renderAll();
}

// Check for new match summons to trigger overlays and announcements
function checkForNewSummons(newState) {
  const currentCalled = newState.matches.filter(m => m.status === 'called');
  
  currentCalled.forEach(match => {
    if (!previouslyCalledMatchIds.has(match.id)) {
      previouslyCalledMatchIds.add(match.id);
      
      // Trigger summons overlay
      showSummonOverlay(match);
    }
  });
  
  // Clean up IDs that are no longer in called status
  const currentCalledIds = new Set(currentCalled.map(m => m.id));
  previouslyCalledMatchIds.forEach(id => {
    if (!currentCalledIds.has(id)) {
      previouslyCalledMatchIds.delete(id);
    }
  });
}

// Show Summon Overlay
function showSummonOverlay(match) {
  const p1 = state.players.find(p => p.id === match.player1Id);
  const p2 = state.players.find(p => p.id === match.player2Id);
  const court = state.courts.find(c => c.id === match.courtId);
  
  if (!p1 || !p2 || !court) return;

  const overlay = document.getElementById('summon-overlay');
  document.getElementById('summon-event').innerText = match.event;
  document.getElementById('summon-p1').innerText = p1.name;
  document.getElementById('summon-p2').innerText = p2.name;
  document.getElementById('summon-court').innerText = court.name;

  overlay.classList.remove('hidden');

  // Trigger web audio beep/chime
  playNotificationChime();

  // TTS Voice Summon
  speakSummon(match.event, p1.name, p2.name, court.name);
}

// Tick Timers (runs every 1 second)
function tickTimers() {
  // Only redraw UI elements with timers to avoid full-page flashes
  renderPlayerCourts(state);
  renderRefereePanel(state);
  
  // Also check if summons overlay count hits limit
  const calledMatches = state.matches.filter(m => m.status === 'called');
  calledMatches.forEach(match => {
    const elapsed = Date.now() - match.calledAt;
    const limit = state.configs.summonLimitMinutes * 60 * 1000;
    if (elapsed >= limit && !match.summonsExpiredAlertTriggered) {
      match.summonsExpiredAlertTriggered = true;
      // Mark internally so we don't alert repeatedly
      saveState(state);
    }
  });
}

// Cross-tab synchronization listener
window.addEventListener('storage', (event) => {
  if (event.key === 'tennis_tournament_state') {
    // Reload state
    try {
      state = JSON.parse(event.newValue);
      renderAll();
      checkForNewSummons(state);
    } catch (e) {
      console.error("Failed to parse storage sync state", e);
    }
  }
});

// Also trigger local updates
window.addEventListener('tournament-state-updated', (event) => {
  state = event.detail;
  checkForNewSummons(state);
});

// Setup Listeners
function setupEventListeners() {

  // Global Announcement
  const btnPublishAnnouncement = document.getElementById('btn-publish-announcement');
  if (btnPublishAnnouncement) {
    btnPublishAnnouncement.addEventListener('click', () => {
      const msg = document.getElementById('staff-announcement-input').value.trim();
      if (!state.configs) state.configs = {};
      state.configs.announcementMessage = msg;
      saveAndRender();
      if (msg) {
        alert('發布成功！所有選手將立刻看到此廣播。');
      } else {
        alert('已關閉大會廣播。');
      }
    });
  }

  const btnClearAnnouncement = document.getElementById('btn-clear-announcement');
  if (btnClearAnnouncement) {
    btnClearAnnouncement.addEventListener('click', () => {
      document.getElementById('staff-announcement-input').value = '';
      if (!state.configs) state.configs = {};
      state.configs.announcementMessage = '';
      saveAndRender();
      alert('已關閉大會廣播。');
    });
  }

  // 1. Navigation / View Switcher
  // (Logo click listener removed here, combined below)
  
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const viewId = btn.getAttribute('data-view');

      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const panels = document.querySelectorAll('.view-panel');
      panels.forEach(p => p.classList.remove('active'));
      
      const targetPanel = document.getElementById(viewId);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
      activeView = viewId;
      renderAll();
      
      // Auto-close mobile menu when a tab is clicked
      document.querySelector('.view-selector').classList.remove('show-on-mobile');
    });
  });
  
  // Helper to switch to referee trap mode
  const checkRefereeAuth = () => {
    if (localStorage.getItem('referee_auth') === 'true') {
      const targetBtn = document.querySelector('.nav-btn[data-view="referee-panel"]');
      if (targetBtn) targetBtn.click();
      
      const viewSelector = document.querySelector('.view-selector');
      if (viewSelector) viewSelector.style.display = 'none';
      
      const mobileBtn = document.getElementById('mobile-menu-btn');
      if (mobileBtn) mobileBtn.style.display = 'none';
    }
  };

  // Check admin authorization on load
  const checkAuth = () => {
    if (localStorage.getItem('admin_auth') === 'true') {
      document.querySelectorAll('.admin-only').forEach(btn => {
        btn.style.display = 'flex'; // Nav buttons use flex in this template
      });
    } else if (localStorage.getItem('referee_auth') === 'true') {
      setTimeout(() => checkRefereeAuth(), 100);
    }
  };
  checkAuth();

  // Secret Portal Logic (5 clicks on logo) & Return to Home
  const logo = document.getElementById('brand-logo');
  let logoClickCount = 0;
  let logoClickTimer = null;
  
  if (logo) {
    logo.addEventListener('click', () => {
      // 1. Return to home (player-view) immediately on click
      if (activeView !== 'player-view') {
        const btn = document.querySelector('.nav-btn[data-view="player-view"]');
        if (btn) btn.click();
      }

      // 2. Secret Portal 5-click logic
      logoClickCount++;
      clearTimeout(logoClickTimer);
      
      if (logoClickCount >= 5) {
        logoClickCount = 0;
        if (localStorage.getItem('admin_auth') !== 'true' && localStorage.getItem('referee_auth') !== 'true') {
          document.getElementById('auth-password').value = '';
          document.getElementById('auth-modal').classList.remove('hidden');
        } else {
          // Toggle off admin/referee mode for convenience
          if (confirm("您目前已處於「系統後台模式」。是否要登出並恢復一般選手視角？")) {
            localStorage.removeItem('admin_auth');
            localStorage.removeItem('referee_auth');
            localStorage.removeItem('auth_token');
            window.location.reload();
            
            document.querySelectorAll('.admin-only').forEach(btn => {
              btn.style.display = 'none';
            });
            
            const viewSelector = document.querySelector('.view-selector');
            if (viewSelector) viewSelector.style.display = '';
            
            const mobileBtn = document.getElementById('mobile-menu-btn');
            if (mobileBtn) mobileBtn.style.display = '';
            
            // Switch back to player view
            if (activeView !== 'player-view') {
              document.querySelector('.nav-btn[data-view="player-view"]').click();
            }
          }
        }
      }
      
      logoClickTimer = setTimeout(() => {
        logoClickCount = 0;
      }, 2000); // 2 seconds window
    });
  }

  const loginLink = document.getElementById('player-admin-login-link');
  if (loginLink) {
    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('auth-password').value = '';
      document.getElementById('auth-modal').classList.remove('hidden');
    });
  }

  // Global Auth Modal Submit
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pwd = document.getElementById('auth-password').value;
      if (pwd === 'admin123') {
        localStorage.setItem('admin_auth', 'true');
        document.getElementById('auth-modal').classList.add('hidden');
        checkAuth();
        alert("✅ 管理員驗證成功！已為您開啟全系統後台選單。");
      } else if (pwd === 'ref123') {
        localStorage.setItem('referee_auth', 'true');
        document.getElementById('auth-modal').classList.add('hidden');
        checkAuth();
        alert("✅ 巡場驗證成功！已進入巡場專屬控制台。");
      } else {
        alert("密碼錯誤，請重新輸入。");
        document.getElementById('auth-password').value = '';
      }
    });
  }

  // Mobile Menu Toggle logic
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      document.querySelector('.view-selector').classList.toggle('show-on-mobile');
    });
  }


  
  // Also check if AudioContext is already initialized, else show banner
  // (Standard browser security policy)
  document.getElementById('btn-mock-summon').addEventListener('click', () => {
    playNotificationChime();
  });

  // Close summons overlay
  document.getElementById('btn-close-summon').addEventListener('click', () => {
    document.getElementById('summon-overlay').classList.add('hidden');
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  });

  // 3. Player Search Box
  const searchInput = document.getElementById('player-search-input');
  const searchBtn = document.getElementById('player-search-btn');
  
  const performSearch = () => {
    renderPlayerSearch(state, searchInput.value);
  };
  
  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  // Player self check-in click handler
  document.getElementById('player-search-result').addEventListener('click', (e) => {
    const btnCheckin = e.target.closest('.btn-self-checkin-event');
    const btnGift = e.target.closest('#btn-claim-gift');
    
    if (btnCheckin) {
      const eventName = btnCheckin.getAttribute('data-event');
      if (!state.configs || !state.configs.eventsCheckIn || !state.configs.eventsCheckIn[eventName]) {
        alert('大會目前尚未開放【' + eventName + '】報到，請稍候！');
        return;
      }
      const playerId = btnCheckin.getAttribute('data-id');
      // eventName already declared
      const playerObj = state.players.find(p => p.id === playerId);
      if (playerObj) {
        const confirmMsg = `⚠️ 報到注意事項 (Check-in Notice) ⚠️\n\n您即將進行【${eventName}】的報到手續。\nYou are about to check in for 【${eventName}】.\n\n報到完成後，系統將隨時開始為您安排賽程，請確認您已在現場並準備好出賽。\nOnce checked in, the system may schedule your match at any time. Please ensure you are on-site and ready to play.\n\n確定要現在進行報到嗎？\nAre you sure you want to check in now?`;
        if (!window.confirm(confirmMsg)) return;
        
        const inputPhone = window.prompt(`為了保護您的隱私，請輸入【${playerObj.name}}報名時留的「聯絡電話」以完成身分驗證：`);
        if (inputPhone === null) return;
        
        const storedPhone = (playerObj.phone || '').trim();
        const providedPhone = inputPhone.trim();
        
        // 允許輸入其中一支號碼即可 (處理雙打 09xx / 09xx 的情況)
        const phoneMatch = storedPhone.split(/[/,、]/).map(s => s.trim()).some(p => p && p === providedPhone);
        if (phoneMatch || providedPhone === storedPhone || providedPhone === "0000") { // 0000 為大會後門免密碼
          if (!playerObj.checkInStatus) playerObj.checkInStatus = {};
          playerObj.checkInStatus[eventName] = true;
          
          if ((playerObj.events || []).every(ev => playerObj.checkInStatus[ev])) {
            playerObj.checkedIn = true;
          }
          
          saveAndRender();
          renderPlayerSearch(state, playerObj.name);
          alert(`${playerObj.name} 選手，驗證成功！您已完成「${eventName}」的報到。請注意場地點名與大會廣播！`);
        } else {
          alert("驗證失敗：聯絡電話輸入錯誤，請確認後再試！");
        }
      }
    } else if (btnGift) {
      const playerId = btnGift.getAttribute('data-id');
      const playerObj = state.players.find(p => p.id === playerId);
      if (playerObj && !playerObj.giftClaimed) {
        const inputCode = window.prompt(`【工作人員專用】請輸入發放參賽禮物的「驗證碼」以確認發放：`);
        if (inputCode === null) return; // Cancelled
        
        const correctCode = state.configs.giftClaimCode || '8888';
        if (inputCode.trim() === correctCode.trim()) {
          playerObj.giftClaimed = true;
          saveAndRender();
          renderPlayerSearch(state, playerObj.name);
          alert(`✅ 已成功確認發放贈品給 ${playerObj.name}！`);
        } else {
          alert("❌ 驗證碼錯誤，無法確認發放！");
        }
      }
    }
  });

  // 4. Bracket Event Select
  document.getElementById('player-bracket-event-select').addEventListener('change', () => {
    renderPlayerBrackets(state);
  });

  // 4.5 Bracket Viewer Drag to Scroll
  const bracketViewer = document.getElementById('player-bracket-viewer');
  let isDown = false;
  let startX;
  let startY;
  let scrollLeft;
  let scrollTop;

  bracketViewer.addEventListener('mousedown', (e) => {
    isDown = true;
    startX = e.pageX - bracketViewer.offsetLeft;
    startY = e.pageY - bracketViewer.offsetTop;
    scrollLeft = bracketViewer.scrollLeft;
    scrollTop = bracketViewer.scrollTop;
  });
  bracketViewer.addEventListener('mouseleave', () => { isDown = false; });
  bracketViewer.addEventListener('mouseup', () => { isDown = false; });
  bracketViewer.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - bracketViewer.offsetLeft;
    const y = e.pageY - bracketViewer.offsetTop;
    const walkX = (x - startX) * 2; // Scroll speed multiplier
    const walkY = (y - startY) * 2;
    bracketViewer.scrollLeft = scrollLeft - walkX;
    bracketViewer.scrollTop = scrollTop - walkY;
  });

  // 5. Setup View Handlers
  // Update Courts
  document.getElementById('btn-save-configs').addEventListener('click', () => {
    state.configs.restBufferMinutes = parseInt(document.getElementById('setup-rest-buffer').value) || 30;
    state.configs.summonLimitMinutes = parseInt(document.getElementById('setup-summon-limit').value) || 10;
    state.configs.giftClaimCode = document.getElementById('setup-gift-claim-code').value || '8888';
    state.configs.adminPassword = document.getElementById('setup-admin-password').value || 'admin';
    // Update local token so they don't get locked out immediately
    if (localStorage.getItem('admin_auth') === 'true') {
      localStorage.setItem('auth_token', state.configs.adminPassword);
    }
    saveAndRender();
    alert("✅ 參數設定已成功儲存！");
  });

  document.getElementById('btn-update-courts').addEventListener('click', () => {
    const val = parseInt(document.getElementById('setup-court-count').value);
    if (val >= 1 && val <= 10) {
      // Re-create courts keeping occupied ones if possible, or reset
      const newCourts = [];
      for (let i = 1; i <= val; i++) {
        const courtName = `第${i}球場 (Court ${i})`;
        const existing = state.courts.find(c => c.id === `c${i}`);
        if (existing) {
          existing.name = courtName;
          newCourts.push(existing);
        } else {
          newCourts.push({ id: `c${i}`, name: courtName, status: 'idle', currentMatchId: null });
        }
      }
      state.courts = newCourts;
      
      // Update rest limit and summon limit config
      state.configs.restBufferMinutes = parseInt(document.getElementById('setup-rest-buffer').value) || 30;
      state.configs.summonLimitMinutes = parseInt(document.getElementById('setup-summon-limit').value) || 10;
      state.configs.giftClaimCode = document.getElementById('setup-gift-claim-code').value || '8888';
      
      // Provide a clean slate for the court map when courts are updated
      state.configs.courtMap = Array(25).fill(null);
      saveAndRender();
      alert(`成功設定 ${val} 面球場與比賽參數。`);
    }
  });


  // Reset all
  document.getElementById('btn-reset-all').addEventListener('click', (e) => {
    e.preventDefault();
    const superPassword = 'superadmin'; // Independent reset password
    const pwd = prompt("⚠️ 警告：此為危險操作，將刪除所有賽程與選手資料。\n請輸入【最高權限密碼】以授權：");
    if (pwd !== superPassword) {
      if (pwd !== null) alert("密碼錯誤，拒絕存取。");
      return;
    }
    
    if (confirm("最後確認：此動作將刪除全部選手、球場與賽程數據，完全無法復原，是否確定？")) {
      state = getInitialState();
      saveAndRender();
      alert("系統已重置為空白狀態。");
    }
  });

  // Parse and Import players
  


  // Manual Add Player Button
  document.getElementById('btn-add-player-manual').addEventListener('click', () => {
    document.getElementById('player-modal-title').innerText = '新增選手';
    document.getElementById('player-form').reset();
    document.getElementById('player-form-id').value = '';
    
    // Fill checkboxes
    const chkGroup = document.getElementById('player-form-events');
    chkGroup.innerHTML = '';
    state.events.forEach(ev => {
      const lbl = document.createElement('label');
      lbl.innerHTML = `<input type="checkbox" name="player-modal-events" value="${ev}"> ${ev}`;
      chkGroup.appendChild(lbl);
    });

    document.getElementById('player-modal').classList.remove('hidden');
  });

  // Manual Player Save Form Submit
  document.getElementById('player-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('player-form-id').value;
    const name = document.getElementById('player-form-name').value;
    const phone = document.getElementById('player-form-phone').value;
    const gift = document.getElementById('player-form-gift').value;
    const hasPhotography = document.getElementById('player-form-photography').value === 'yes';
    const utr = document.getElementById('player-form-utr').value;
    const utrName = document.getElementById('player-form-utrName').value;
    
    const checkboxes = document.querySelectorAll('input[name="player-modal-events"]:checked');
    const selectedEvents = Array.from(checkboxes).map(cb => cb.value);

    if (id) {
      // Edit
      const index = state.players.findIndex(p => p.id === id);
      if (index !== -1) {
        const p = state.players[index];
        const addedEvents = selectedEvents.filter(e => !p.events.includes(e));
        
        p.name = name;
        p.phone = phone;
        p.events = selectedEvents;
        p.gift = gift;
        
        if (!p.checkInStatus) p.checkInStatus = {};
        p.events.forEach(ev => {
            if (p.checkInStatus[ev] === undefined) p.checkInStatus[ev] = p.checkedIn || false;
        });
        
        // 如果有新增參賽項目，將該選手移至陣列最後面，確保籤表生成時排在最後
        if (addedEvents.length > 0) {
          state.players.splice(index, 1);
          state.players.push(p);
        }
      }
    } else {
      // Add
      const checkInStatus = {};
      selectedEvents.forEach(ev => checkInStatus[ev] = false);
      
      state.players.push({
        id: 'p_' + Math.random().toString(36).substr(2, 9),
        name: name,
        phone: phone,
        events: selectedEvents,
        gift: gift,
            hasPhotography: hasPhotography,
            utr: utr,
        checkedIn: false,
        checkInStatus: checkInStatus,
        giftClaimed: false,
        lastMatchEndedAt: null
      });
    }

    document.getElementById('player-modal').classList.add('hidden');
    saveAndRender();
  });

  // Regenerate Brackets
  document.getElementById('btn-regenerate-brackets').addEventListener('click', () => {
    if (state.players.length === 0) {
      alert("選手資料庫目前無人，請先匯入或新增選手。");
      return;
    }
    
    if (confirm("重新生成各組別淘汰賽籤表會清除所有現存的比賽結果與球場調度，是否確定？")) {
      // Clear court statuses
      state.courts.forEach(c => {
        c.status = 'idle';
        c.currentMatchId = null;
      });
      state.matches = [];

      state.events.forEach(eventName => {
        const shouldShuffle = true; // Always shuffle since we removed the manual toggle
        generateBracket(state, eventName, shouldShuffle);
      });
      saveAndRender();
      alert("已依照目前選手名單重新產生所有的淘汰賽樹狀圖籤表！");
    }
  });

  // Schedule Queue Filter Change Handler (Staff)
  document.getElementById('staff-queue-filter').addEventListener('change', () => {
    renderAll();
  });

  // Quick Rest Buffer Adjustment
  document.getElementById('quick-rest-buffer').addEventListener('change', (e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 0) {
      state.configs.restBufferMinutes = val;
      // sync with the setup view input too
      document.getElementById('setup-rest-buffer').value = val;
      saveAndRender();
    }
  });

  // Quick Avg Match Time Adjustment
  document.getElementById('quick-avg-match').addEventListener('change', (e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      state.configs.avgMatchMinutes = val;
      saveAndRender();
    }
  });

  // Upcoming Queue Filter Change Handler (Player)
  document.getElementById('player-queue-filter').addEventListener('change', () => {
    renderAll();
  });

  // Save Court Map Configuration
  document.getElementById('btn-save-court-map').addEventListener('click', () => {
    const selects = document.querySelectorAll('.setup-court-map-select');
    const newMap = Array.from(selects).map(select => select.value || null);
    
    state.configs.courtMap = newMap;
    saveAndRender();
    alert("場地配置示意圖已成功儲存！");
  });

  // Edit / Delete Player lists in Setup View
  document.getElementById('setup-players-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const action = btn.getAttribute('data-action');
    const playerId = btn.getAttribute('data-id');
    
    if (action === 'edit-player') {
      try {
        const p = state.players.find(p => p.id === playerId);
        if (p) {
          document.getElementById('player-modal-title').innerText = '修改選手資料';
          document.getElementById('player-form-id').value = p.id;
          document.getElementById('player-form-name').value = p.name;
          document.getElementById('player-form-phone').value = p.phone || '';
          document.getElementById('player-form-gift').value = p.gift || '無';
          document.getElementById('player-form-photography').value = p.hasPhotography ? 'yes' : 'no';
          document.getElementById('player-form-utr').value = p.utr || '';
          document.getElementById('player-form-utrName').value = p.utrName || '';
          
          // Checkboxes
          const chkGroup = document.getElementById('player-form-events');
          chkGroup.innerHTML = '';
          const playerEvents = Array.isArray(p.events) ? p.events : [];
          (state.events || []).forEach(ev => {
            const checked = playerEvents.includes(ev) ? 'checked' : '';
            const lbl = document.createElement('label');
            lbl.innerHTML = `<input type="checkbox" name="player-modal-events" value="${ev}" ${checked}> ${ev}`;
            chkGroup.appendChild(lbl);
          });
          
          document.getElementById('player-modal').classList.remove('hidden');
        }
      } catch (err) {
        alert("修改功能發生錯誤：" + err.message);
      }
    } else if (action === 'delete-player') {
      if (confirm("確定要刪除這名選手嗎？此舉將從資料庫中移除。")) {
        try {
          // Robust deletion
          const originalLength = state.players.length;
          state.players = state.players.filter(p => p.id !== playerId);
          
          if (state.players.length < originalLength) {
            saveAndRender();
            alert("已成功從資料庫中刪除該名選手！");
          } else {
            alert("找不到該選手，或者已經被刪除了。");
          }
        } catch (err) {
          alert("刪除功能發生錯誤：" + err.message);
        }
      }
    }
  });

  // 6. Staff Panel Actions (Check-in, Auto-schedule, Manual Assign, Certificates)
  // Check-in & Gift toggles
  document.getElementById('staff-checkin-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const action = btn.getAttribute('data-action');
    const playerId = btn.getAttribute('data-id');
    const playerObj = state.players.find(p => p.id === playerId);
    
    if (!playerObj) return;

    if (action === 'toggle-checkin') {
      const ev = btn.getAttribute('data-event');
      if (!playerObj.checkInStatus) playerObj.checkInStatus = {};
      
      const isCheckingIn = !playerObj.checkInStatus[ev];
      if (isCheckingIn) {
        if (!window.confirm(`確認要幫選手進行【${ev}】報到嗎？\n請務必提醒選手：「報到完成後，系統會隨時安排您出賽，請勿離開現場」`)) {
          return;
        }
      }
      
      playerObj.checkInStatus[ev] = isCheckingIn;
      
      const anyCheckedIn = (playerObj.events || []).some(e => playerObj.checkInStatus[e]);
      playerObj.checkedIn = (playerObj.events || []).every(e => playerObj.checkInStatus[e]); // legacy fallback
      
      if (!anyCheckedIn) {
        playerObj.giftClaimed = false; // reset gift if completely unchecked
      }
      saveAndRender();
    } else if (action === 'forfeit-event') {
      const ev = btn.getAttribute('data-event');
      if (!window.confirm(`確認要將選手在【${ev}】判定為「未到棄賽」嗎？\n這將自動淘汰選手，並讓對手不戰而勝晉級！`)) {
        return;
      }
      
      if (!playerObj.checkInStatus) playerObj.checkInStatus = {};
      playerObj.checkInStatus[ev] = 'forfeited';
      
      // Auto-advance opponent in the bracket
      const matches = state.matches.filter(m => m.event === ev && (m.status === 'scheduled' || m.status === 'live') && (m.player1Id === playerObj.id || m.player2Id === playerObj.id));
      matches.forEach(m => {
        if (m.status === 'live') {
           const court = state.courts.find(c => c.currentMatchId === m.id);
           if (court) { court.status = 'idle'; court.currentMatchId = null; }
        }
        
        m.status = 'defaulted';
        m.defaultedPlayerId = playerObj.id;
        
        // If the other player is already known, advance them
        const opponentId = m.player1Id === playerObj.id ? m.player2Id : m.player1Id;
        if (opponentId && opponentId !== 'BYE') {
          m.winnerId = opponentId;
          advanceWinner(m, opponentId, state.matches);
        } else if (opponentId === 'BYE') {
          // If the opponent is BYE, the BYE advances... which just cascades
          m.winnerId = 'BYE';
          advanceWinner(m, 'BYE', state.matches);
        }
      });
      
      saveAndRender();
    } else if (action === 'toggle-gift') {
      playerObj.giftClaimed = !playerObj.giftClaimed;
      saveAndRender();
    }
  });

  // Search input in staff dashboard
  document.getElementById('staff-player-search').addEventListener('input', () => {
    renderStaffDashboard(state);
  });

  // Auto-schedule matches
  // Check-in Toggle Logic
  // Per-Event Check-in Toggle Logic
  window.toggleEventCheckIn = function(ev) {
    if (!state.configs) state.configs = {};
    if (!state.configs.eventsCheckIn) state.configs.eventsCheckIn = {};
    const currentState = state.configs.eventsCheckIn[ev] === true;
    state.configs.eventsCheckIn[ev] = !currentState;
    if (!currentState) {
       // Just opened
       alert(`✅ 已開放【${ev}】報到！`);
    }
    saveAndRender();
  };

  document.getElementById('btn-auto-schedule').addEventListener('click', () => {
    const scheduled = autoScheduleMatches(state);
    if (scheduled) {
      alert("智慧自動排程已為您分派合適賽事至空閒球場！已開啟語音召集點名。");
    } else {
      alert("目前無符合條件的待排賽事（可能尚無空閒球場，或待排選手尚未完成報到、尚在30分鐘休息時間內）。");
    }
  });

  // Manual Court assignment dropdown
  document.getElementById('staff-match-queue-tbody').addEventListener('change', (e) => {
    const select = e.target.closest('select');
    if (!select) return;
    
    const action = select.getAttribute('data-action');
    const matchId = select.getAttribute('data-match-id');
    const courtId = select.value;
    
    if (action === 'assign-court-select' && courtId) {
      const match = state.matches.find(m => m.id === matchId);
      const court = state.courts.find(c => c.id === courtId);
      
      if (match && court && court.status === 'idle') {
        match.status = 'called';
        match.courtId = court.id;
        match.calledAt = Date.now();
        
        court.status = 'occupied';
        court.currentMatchId = match.id;
        
        saveAndRender();
        alert(`已手動將此賽事分派至 ${court.name}！已開啟召集通知。`);
      }
    }
  });

  // Free/Abort match from court in Staff view
  document.getElementById('staff-court-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const action = btn.getAttribute('data-action');
    const courtId = btn.getAttribute('data-court-id');
    const matchId = btn.getAttribute('data-match-id');

    if (action === 'staff-abort-match') {
      if (confirm("確定要強行中止此場地的比賽，將賽事移回待排隊列嗎？")) {
        const court = state.courts.find(c => c.id === courtId);
        const match = state.matches.find(m => m.id === matchId);
        
        if (court) {
          court.status = 'idle';
          court.currentMatchId = null;
        }
        if (match) {
          match.status = 'scheduled';
          match.courtId = null;
          match.calledAt = null;
          match.startedAt = null;
        }
        
        saveAndRender();
      }
    }
  });

  // Winners Table - Open Certificate Modal
  let selectedCertPlayer = '';
  let selectedCertEvent = '';

  document.getElementById('staff-winners-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const action = btn.getAttribute('data-action');
    if (action === 'open-certificate') {
      selectedCertPlayer = btn.getAttribute('data-name');
      selectedCertEvent = btn.getAttribute('data-event');
      document.getElementById('cert-rank').value = btn.getAttribute('data-rank');
      
      // Load modal
      document.getElementById('certificate-modal').classList.remove('hidden');
      triggerCertificateDraw();
    }
  });

  // Certificate Controls
  const certStyleSelect = document.getElementById('cert-style');
  const certTitleInput = document.getElementById('cert-title');
  const certRankInput = document.getElementById('cert-rank');

  function triggerCertificateDraw() {
    drawCertificate(
      selectedCertPlayer,
      selectedCertEvent,
      certTitleInput.value,
      certStyleSelect.value,
      certRankInput.value
    );
  }

  certStyleSelect.addEventListener('change', triggerCertificateDraw);
  certTitleInput.addEventListener('input', triggerCertificateDraw);
  certRankInput.addEventListener('input', triggerCertificateDraw);

  // Print button
  document.getElementById('btn-print-certificate').addEventListener('click', () => {
    window.print();
  });

  // Download button
  document.getElementById('btn-download-certificate').addEventListener('click', () => {
    const canvas = document.getElementById('cert-canvas');
    const image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    const link = document.createElement('a');
    link.download = `ACE_${selectedCertWinner}_Certificate.png`;
    link.href = image;
    link.click();
  });

  // 7. Referee view control buttons
  document.getElementById('referee-court-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const action = btn.getAttribute('data-action');
    const matchId = btn.getAttribute('data-match-id');
    const match = state.matches.find(m => m.id === matchId);
    
    if (!match) return;
    const court = state.courts.find(c => c.id === match.courtId);

    if (action === 'referee-start') {
      // Player arrived, start match
      match.status = 'live';
      match.startedAt = Date.now();
      saveAndRender();
    } else if (action === 'referee-default-prompt') {
      // Default/Walkover prompt
      const p1 = state.players.find(p => p.id === match.player1Id);
      const p2 = state.players.find(p => p.id === match.player2Id);
      
      if (!p1 || !p2) return;
      
      const opt = prompt(`請選擇未到被「判定棄賽」的選手（輸入數字）：\n1. ${p1.name}\n2. ${p2.name}\n（如雙方皆未到請輸入 1&2，取消請留空）`);
      
      if (!opt) return;
      const cleanOpt = opt.replace(/\s+/g, '');

      if (cleanOpt === '1&2' || cleanOpt === '12' || cleanOpt === '1,2' || cleanOpt === '1+2' || cleanOpt === '1和2') {
        match.status = 'defaulted';
        match.winnerId = 'BYE';
        match.defaultedPlayerId = 'BOTH';
        match.endedAt = Date.now();
        
        if (court) {
          court.status = 'idle';
          court.currentMatchId = null;
        }

        advanceWinner(match, 'BYE', state.matches);
        checkAndGenerateNextRound(state, match);
        
        saveAndRender();
        alert("已判定雙方皆棄權！此賽程將以 BYE (輪空) 晉級。");
      } else if (cleanOpt === '1' || cleanOpt === '2') {
        const defaultedPlayerId = cleanOpt === '1' ? p1.id : p2.id;
        const winnerId = cleanOpt === '1' ? p2.id : p1.id;
        
        match.status = 'defaulted';
        match.winnerId = winnerId;
        match.defaultedPlayerId = defaultedPlayerId;
        match.endedAt = Date.now();
        
        if (court) {
          court.status = 'idle';
          court.currentMatchId = null;
        }

        // Set rest end for winner (no rest really needed for default, but updates state)

    const updateRestTimeForPlayerAndAliases = (playerObj, time) => {
      if (!playerObj) return;
      state.players.forEach(p => {
        if (p.name.includes(playerObj.name) || playerObj.name.includes(p.name)) {
          p.lastMatchEndedAt = time;
        }
      });
    };

        const p1Obj = state.players.find(p => p.id === match.player1Id);
        const p2Obj = state.players.find(p => p.id === match.player2Id);
        if (p1Obj) updateRestTimeForPlayerAndAliases(p1Obj, match.endedAt);
        if (p2Obj) updateRestTimeForPlayerAndAliases(p2Obj, match.endedAt);

        // Advance bracket
        advanceWinner(match, winnerId, state.matches);
        checkAndGenerateNextRound(state, match);
        
        saveAndRender();
        alert(`已裁定選手棄賽。獲勝者：${getPlayerNameById(state, winnerId)}。`);
      }
    } else if (action === 'referee-reset') {
      // Abort/Reset match from referee view
      if (confirm("確定要中止此球場的賽事並退回待排狀態嗎？")) {
        match.status = 'scheduled';
        match.courtId = null;
        match.calledAt = null;
        match.startedAt = null;
        
        if (court) {
          court.status = 'idle';
          court.currentMatchId = null;
        }
        saveAndRender();
      }
    
    } else if (action === 'referee-utr-prompt') {
      const p1 = state.players.find(p => p.id === match.player1Id);
      const p2 = state.players.find(p => p.id === match.player2Id);
      
      document.getElementById('utr-p1-id').value = p1 ? p1.id : '';
      document.getElementById('utr-p2-id').value = p2 ? p2.id : '';
      
      document.getElementById('utr-p1-name').innerText = p1 ? p1.name : 'Unknown';
      document.getElementById('utr-p2-name').innerText = p2 ? p2.name : 'Unknown';
      
      document.getElementById('utr-p1-val').value = p1 ? (p1.utr || '') : '';
      document.getElementById('utr-p2-val').value = p2 ? (p2.utr || '') : '';
      
      document.getElementById('utr-modal').classList.remove('hidden');
    } else if (action === 'referee-score-prompt') {

      // Enter Score Modal
      const p1Name = getPlayerNameById(state, match.player1Id);
      const p2Name = getPlayerNameById(state, match.player2Id);
      
      document.getElementById('score-form-match-id').value = match.id;
      document.getElementById('score-team1-name').innerText = p1Name;
      document.getElementById('score-team2-name').innerText = p2Name;
      
      // Clear previous inputs
      document.getElementById('score-s1-p1').value = '';
      document.getElementById('score-s1-p2').value = '';
      document.getElementById('score-s2-p1').value = '';
      document.getElementById('score-s2-p2').value = '';
      document.getElementById('score-s3-p1').value = '';
      document.getElementById('score-s3-p2').value = '';
      
      document.getElementById('score-modal').classList.remove('hidden');
    }
  });

  function parseScoreFromForm() {
    const s1p1 = parseInt(document.getElementById('score-s1-p1').value);
    const s1p2 = parseInt(document.getElementById('score-s1-p2').value);
    
    if (isNaN(s1p1) || isNaN(s1p2)) return null;

    const s2p1_val = document.getElementById('score-s2-p1').value;
    const s2p2_val = document.getElementById('score-s2-p2').value;
    const s2p1 = s2p1_val !== '' ? parseInt(s2p1_val) : 0;
    const s2p2 = s2p2_val !== '' ? parseInt(s2p2_val) : 0;

    const s3p1_val = document.getElementById('score-s3-p1').value;
    const s3p2_val = document.getElementById('score-s3-p2').value;
    
    const player1Sets = [s1p1];
    const player2Sets = [s1p2];
    
    let p1SetsWon = s1p1 > s1p2 ? 1 : 0;
    let p2SetsWon = s1p2 > s1p1 ? 1 : 0;

    if (s2p1_val !== '' && s2p2_val !== '') {
      player1Sets.push(s2p1);
      player2Sets.push(s2p2);
      if (s2p1 > s2p2) p1SetsWon++;
      else if (s2p2 > s2p1) p2SetsWon++;
    }

    let supertieObj = null;
    if (s3p1_val !== '' && s3p2_val !== '') {
      const s3p1 = parseInt(s3p1_val);
      const s3p2 = parseInt(s3p2_val);
      supertieObj = { player1: s3p1, player2: s3p2 };
      if (s3p1 > s3p2) p1SetsWon++;
      else if (s3p2 > s3p1) p2SetsWon++;
    }

    return { player1Sets, player2Sets, supertieObj, p1SetsWon, p2SetsWon };
  }

  // Live Score Update Handler
  const btnLiveScore = document.getElementById('btn-update-live-score');
  if (btnLiveScore) {
    btnLiveScore.addEventListener('click', () => {
      const matchId = document.getElementById('score-form-match-id').value;
      const match = state.matches.find(m => m.id === matchId);
      if (!match) return;

      const parsed = parseScoreFromForm();
      if (!parsed) {
        alert("請至少輸入第一盤比分再更新。");
        return;
      }

      match.score = {
        player1: parsed.player1Sets,
        player2: parsed.player2Sets,
        supertie: parsed.supertieObj
      };
      
      saveAndRender();
      document.getElementById('score-modal').classList.add('hidden');
      alert("目前比分已成功更新到公開看版！");
    });
  }

  // Score Form Final Submit Handler
  document.getElementById('score-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const matchId = document.getElementById('score-form-match-id').value;
    const match = state.matches.find(m => m.id === matchId);
    
    if (!match) return;

    const parsed = parseScoreFromForm();
    if (!parsed) return;

    // Determine overall winner
    let winnerId = null;
    if (parsed.p1SetsWon > parsed.p2SetsWon) {
      winnerId = match.player1Id;
    } else if (parsed.p2SetsWon > parsed.p1SetsWon) {
      winnerId = match.player2Id;
    } else {
      alert("警告：未分出獲勝者（雙方贏得盤數相同）。請確認比分輸入是否正確！");
      return;
    }

    // Update match
    match.status = 'completed';
    match.score = {
      player1: parsed.player1Sets,
      player2: parsed.player2Sets,
      supertie: parsed.supertieObj
    };
    match.winnerId = winnerId;
    match.endedAt = Date.now();

    // Release court
    const court = state.courts.find(c => c.id === match.courtId);
    if (court) {
      court.status = 'idle';
      court.currentMatchId = null;
    }

    // Set player rest timers
    const p1Obj = state.players.find(p => p.id === match.player1Id);
    const p2Obj = state.players.find(p => p.id === match.player2Id);

    const updateRestTimeForPlayerAndAliases = (playerObj, time) => {
      if (!playerObj) return;
      state.players.forEach(p => {
        if (p.name.includes(playerObj.name) || playerObj.name.includes(p.name)) {
          p.lastMatchEndedAt = time;
        }
      });
    };

    if (p1Obj) updateRestTimeForPlayerAndAliases(p1Obj, match.endedAt);
    if (p2Obj) updateRestTimeForPlayerAndAliases(p2Obj, match.endedAt);

    // Advance winner in tournament
    advanceWinner(match, winnerId, state.matches);
    checkAndGenerateNextRound(state, match);
    
    // Close score modal
    document.getElementById('score-modal').classList.add('hidden');
    
    saveAndRender();
    alert(`登記成功！比分：${formatScore(match.score)}，勝出者：${getPlayerNameById(state, winnerId)}。已自動更新晉級簽表。`);
  });


}

// Helper: Get Player Name by ID
function getPlayerNameById(state, id) {
  if (!id) return '等候晉級 (TBD)';
  if (id === 'BYE') return '輪空 (BYE)';
  const p = state.players.find(p => p.id === id);
  return p ? p.name : '未知選手';
}

// Helper: Format Match Score
function formatScore(score) {
  if (!score || !score.player1 || score.player1.length === 0) return '';
  
  let setsArr = [];
  for (let i = 0; i < score.player1.length; i++) {
    setsArr.push(`${score.player1[i]}-${score.player2[i]}`);
  }
  
  let scoreStr = setsArr.join(', ');
  
  if (score.supertie && score.supertie.player1 !== undefined && score.supertie.player1 !== '') {
    scoreStr += ` [${score.supertie.player1}-${score.supertie.player2}]`;
  }
  
  return scoreStr;
}

// Run app init on load
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// --- CSV Import Logic ---

  

window.handleCSVUpload = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const text = evt.target.result;
      const parseCSV = (text) => {
        const rows = [];
        let currentRow = [];
        let currentField = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChar = text[i+1];
          if (char === '"') {
            if (inQuotes && nextChar === '"') { currentField += '"'; i++; }
            else { inQuotes = !inQuotes; }
          } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';
          } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            currentRow.push(currentField.trim());
            if (currentRow.length > 1 || currentRow[0] !== '') { rows.push(currentRow); }
            currentRow = [];
            currentField = '';
            if (char === '\r') i++;
          } else {
            if (char !== '\r' || inQuotes) { currentField += char; }
          }
        }
        if (currentField !== '' || currentRow.length > 0) {
          currentRow.push(currentField.trim());
          rows.push(currentRow);
        }
        return rows;
      };

      const rows = parseCSV(text);
      if (rows.length < 2) return alert('CSV 檔案格式錯誤或為空！');
      
                    let nameIdx = -1, phoneIdx = -1, singleEventIdx = -1, doubleEventIdx = -1, giftIdx = -1, photoIdx = -1, utrIdx = -1, utrNameIdx = -1;
              let headerRowIdx = -1;
              
              for (let r = 0; r < Math.min(10, rows.length); r++) {
                const headers = rows[r];
                headers.forEach((h, idx) => {
                  const lower = h.toLowerCase();
                  if (nameIdx === -1 && (lower.includes('選手姓名') || lower.includes('姓名') || lower.includes('名字'))) nameIdx = idx;
                  if (phoneIdx === -1 && (lower.includes('連絡電話') || lower.includes('聯絡電話') || lower.includes('電話') || lower.includes('手機'))) phoneIdx = idx;
                  if (singleEventIdx === -1 && (lower.includes('報名級別') || lower.includes('單打每項') || lower.includes('單打'))) singleEventIdx = idx;
                  if (doubleEventIdx === -1 && (lower.includes('雙打項目') || (lower.includes('雙打') && !lower.includes('夥伴')))) doubleEventIdx = idx;
                  if (giftIdx === -1 && (lower.includes('商品') || lower.includes('參加獎') || lower.includes('衣服') || lower.includes('紀念品') || lower.includes('參賽禮'))) giftIdx = idx;
                  if (photoIdx === -1 && (lower.includes('攝影') || lower.includes('照片') || lower.includes('photo'))) photoIdx = idx;
                  if (utrIdx === -1 && (lower.includes('utr 分數') || lower.includes('utr分數') || lower.includes('積分'))) utrIdx = idx;
                  if (utrNameIdx === -1 && (lower.includes('utr 帳號') || lower.includes('utr帳號') || lower.includes('utr名稱') || lower.includes('utr name'))) utrNameIdx = idx;
                });
                
                if (nameIdx !== -1) {
                  headerRowIdx = r;
                  break;
                }
              }
              
              if (headerRowIdx === -1) return alert('找不到「姓名」欄位！請確認 CSV 中包含「姓名」或「選手姓名」字眼。');

              let importedCount = 0;
              for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const cols = rows[i];
        if (!cols || cols.length === 0) continue;
        const name = cols[nameIdx];
        if (!name) continue;
        
        let phone = phoneIdx >= 0 ? cols[phoneIdx] : '';
        let gift = giftIdx >= 0 ? cols[giftIdx] : '無';
        let utr = utrIdx >= 0 ? cols[utrIdx] : '';
        let utrName = utrNameIdx >= 0 ? cols[utrNameIdx] : '';
        let hasPhoto = photoIdx >= 0 && cols[photoIdx] ? (cols[photoIdx].includes('是') || cols[photoIdx].includes('有') || cols[photoIdx].toLowerCase().includes('yes') || cols[photoIdx].includes('需要') || cols[photoIdx].includes('加購')) : false;
        
        let events = [];
        if (singleEventIdx >= 0 && cols[singleEventIdx]) {
          const evs = cols[singleEventIdx].split(/[,、，\n]/).map(e => e.trim()).filter(e => e);
          events = events.concat(evs);
        }
        if (doubleEventIdx >= 0 && cols[doubleEventIdx]) {
          const evs = cols[doubleEventIdx].split(/[,、，\n]/).map(e => e.trim()).filter(e => e);
          events = events.concat(evs);
        }
        events.forEach(ev => {
           if (!state.events.includes(ev)) state.events.push(ev);
        });
        
        const existing = state.players.find(p => p.name === name && p.phone === phone);
        if (existing) {
           existing.events = events;
           existing.gift = gift;
           existing.hasPhotography = hasPhoto;
           existing.utr = utr;
           existing.utrName = utrName;
        } else {
           state.players.push({
             id: 'p_' + Date.now() + Math.random().toString(36).substr(2, 5),
             name: name,
             phone: phone,
             events: events,
             gift: gift,
             hasPhotography: hasPhoto,
             utr: utr,
             utrName: utrName,
             checkedIn: false,
             checkInStatus: {},
             giftClaimed: false
           });
        }
        importedCount++;
      }
      
      saveState(state);
      e.target.value = ''; // clear input
      renderSetupPlayers(state);
      renderStaffDashboard(state);
      alert(`成功匯入/更新 ${importedCount} 筆選手資料！`);
    } catch (err) {
      alert("匯入失敗：" + err.message);
      console.error(err);
    }
  };
  reader.readAsText(file);
};


window.openDrawOrderModal = function(eventName) {
  document.getElementById('draw-order-event-name').innerText = eventName;
  const listContainer = document.getElementById('draw-order-list');
  listContainer.innerHTML = '';
  
  // Get players for this event
  let eventPlayers = state.players.filter(p => p.events.includes(eventName));
  
  // Calculate Target Bracket Size to determine if BYEs are needed
  const numPlayers = eventPlayers.length;
  let bracketSize = Math.pow(2, Math.ceil(Math.log2(numPlayers > 0 ? numPlayers : 1)));
  if (state.drawSizes && state.drawSizes[eventName]) {
    const forcedSize = state.drawSizes[eventName];
    if (forcedSize >= numPlayers) {
      bracketSize = forcedSize;
    }
  }

  // Inject BYEs
  const numByes = bracketSize - numPlayers;
  for (let i = 0; i < numByes; i++) {
    eventPlayers.push({ id: 'BYE_' + i, name: '空籤 (BYE)' }); // Use unique BYE ids for SortableJS DOM mapping
  }

  // Sort them if there is a saved seed order
  if (state.drawSeeds && state.drawSeeds[eventName]) {
    const seedOrder = state.drawSeeds[eventName];
    eventPlayers.sort((a, b) => {
      // For BYEs, check if their prefix is in the seed order, or map them dynamically
      const aId = a.id.startsWith('BYE') ? 'BYE' : a.id;
      const bId = b.id.startsWith('BYE') ? 'BYE' : b.id;
      
      // If the array has exact duplicates like 'BYE', indexOf only finds the first.
      // So we map them by exact index in the seedOrder if we can.
      // Actually, it's safer to just rebuild the array based on seedOrder!
    });
    
    // Better sorting strategy: Rebuild array exactly matching seedOrder
    const sorted = [];
    const byePool = eventPlayers.filter(p => p.id.startsWith('BYE'));
    const playerPool = eventPlayers.filter(p => !p.id.startsWith('BYE'));
    
    seedOrder.forEach(id => {
      if (id === 'BYE' && byePool.length > 0) {
        sorted.push(byePool.shift());
      } else {
        const pIdx = playerPool.findIndex(p => p.id === id);
        if (pIdx !== -1) {
          sorted.push(playerPool[pIdx]);
          playerPool.splice(pIdx, 1);
        }
      }
    });
    // Append any remaining (if they weren't in seedOrder for some reason)
    eventPlayers = [...sorted, ...playerPool, ...byePool];
  }
  
  eventPlayers.forEach((p, index) => {
    const item = document.createElement('div');
    item.className = 'draw-order-item';
    item.dataset.id = p.id;
    item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; color: var(--primary);';
    
    item.style.cursor = 'grab';
    item.innerHTML = `
      <div style="display: flex; align-items: center;">
        <strong style="margin-right: 10px;" class="item-index">${index + 1}.</strong>
        <span>${p.name}</span>
      </div>
      <div style="color: #94a3b8; cursor: grab;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </div>
    `;
    listContainer.appendChild(item);
  });
  
  // Initialize SortableJS if available
  if (window.Sortable) {
    if (listContainer._sortable) {
      listContainer._sortable.destroy();
    }
    listContainer._sortable = Sortable.create(listContainer, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: function () {
        Array.from(listContainer.children).forEach((child, i) => {
          child.querySelector('.item-index').innerText = `${i + 1}.`;
        });
      }
    });
  }

  document.getElementById('draw-order-modal').classList.remove('hidden');
};

window.moveDrawItem = function(btn, direction) {
  const item = btn.closest('.draw-order-item');
  const container = item.parentNode;
  const siblings = Array.from(container.children);
  const index = siblings.indexOf(item);
  
  if (direction === -1 && index > 0) {
    container.insertBefore(item, siblings[index - 1]);
  } else if (direction === 1 && index < siblings.length - 1) {
    container.insertBefore(item, siblings[index + 2] || null);
  }
  
  // Update numbers
  Array.from(container.children).forEach((child, i) => {
    child.querySelector('.item-index').innerText = `${i + 1}.`;
  });
};

document.addEventListener('DOMContentLoaded', () => {
  const btnSaveDraw = document.getElementById('btn-save-draw-order');
  if (btnSaveDraw) {
    btnSaveDraw.addEventListener('click', () => {
      const eventName = document.getElementById('draw-order-event-name').innerText;
      const items = Array.from(document.getElementById('draw-order-list').children);
      const orderedIds = items.map(item => item.dataset.id);
      
      if (!state.drawSeeds) state.drawSeeds = {};
      state.drawSeeds[eventName] = orderedIds;
      
      // Regenerate bracket for this specific event without shuffling
      generateBracket(state, eventName, false);
      
      saveAndRender();
      document.getElementById('draw-order-modal').classList.add('hidden');
      alert(`已成功儲存 ${eventName} 的籤表順序並重新生成籤表！`);
    });
  }
});


function renderDrawOrderButtons() {
  const container = document.getElementById('draw-order-buttons-container');
  if (!container) return;
  container.innerHTML = '';
  state.events.forEach(ev => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; background: #f8f9fa; padding: 0.5rem; border-radius: 4px; width: 100%;';
    
    const nameSpan = document.createElement('span');
    nameSpan.innerText = ev;
    nameSpan.style.flex = '1';
    nameSpan.style.fontWeight = 'bold';
    nameSpan.style.fontSize = '0.9rem';
    
    const sizeLabel = document.createElement('label');
    sizeLabel.innerText = '固定籤數:';
    sizeLabel.style.fontSize = '0.8rem';
    sizeLabel.style.margin = '0';
    
    const sizeInput = document.createElement('select');
    sizeInput.className = 'form-control';
    sizeInput.style.width = '80px';
    sizeInput.style.padding = '0.2rem';
    const options = [
      { val: "", text: "自動設定" },
      { val: "4", text: "4籤" },
      { val: "8", text: "8籤" },
      { val: "16", text: "16籤" },
      { val: "32", text: "32籤" },
      { val: "64", text: "64籤" },
      { val: "128", text: "128籤" }
    ];
    const currentVal = (state.drawSizes && state.drawSizes[ev]) ? String(state.drawSizes[ev]) : "";
    sizeInput.innerHTML = "";
    options.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.val;
      opt.text = o.text;
      if (o.val === currentVal) {
        opt.selected = true;
      }
      sizeInput.appendChild(opt);
    });
    sizeInput.onchange = (e) => {
      if (!state.drawSizes) state.drawSizes = {};
      if (e.target.value) {
        state.drawSizes[ev] = parseInt(e.target.value, 10);
      } else {
        delete state.drawSizes[ev];
      }
      // Removed saveAndRender() here to prevent Safari from destroying the dropdown while it's still being interacted with
      // We manually save state instead
      saveState(state);
    };
    
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-accent';
    btn.innerText = '🎯 籤表排序';
    btn.onclick = () => window.openDrawOrderModal(ev);
    
    row.appendChild(nameSpan);
    row.appendChild(sizeLabel);
    row.appendChild(sizeInput);
    row.appendChild(btn);
    container.appendChild(row);
  });
}
window.renderDrawOrderButtons = renderDrawOrderButtons;

  // Global handler for admin match options in bracket
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="admin-match-options"]');
    if (!btn) return;
    
    const pwd = prompt("請輸入系統管理密碼以授權編輯：");
    const adminPassword = (state.configs && state.configs.adminPassword) ? state.configs.adminPassword : 'admin';
    if (pwd !== adminPassword) {
      if (pwd !== null) alert("密碼錯誤，拒絕存取。");
      return;
    }

    const matchId = btn.getAttribute('data-match-id');
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;

    const opt = prompt(`請選擇要執行的操作 (輸入數字)：\n1. 撤銷比賽 (退回待排賽程)\n2. 修改比分 (重新登錄比分)`);
    if (opt === '1') {
      if (!confirm('確定要撤銷這場比賽的結果（包含比分與棄賽裁定），並將其退回「待排賽程」嗎？')) return;
      
      // Check if next match is already touched
      if (match.nextMatchId) {
        const nextMatch = state.matches.find(m => m.id === match.nextMatchId);
        if (nextMatch && nextMatch.status !== 'scheduled') {
          alert("❌ 無法撤銷！因為晉級後的下一輪比賽已經開始或結束。\n請先撤銷下一輪的比賽結果。");
          return;
        }
        
        // Remove winner from next match
        if (nextMatch) {
          if (match.p1OrP2 === 'p1') {
            nextMatch.player1Id = null;
          } else if (match.p1OrP2 === 'p2') {
            nextMatch.player2Id = null;
          }
        }
      }
      
      // Check if any player was marked as forfeit in check-in and reset them
      if (match.defaultedPlayerId && match.defaultedPlayerId !== 'BOTH') {
         const p = state.players.find(p => p.id === match.defaultedPlayerId);
         if (p && p.checkInStatus && p.checkInStatus[match.event] === 'forfeited') {
            p.checkInStatus[match.event] = false;
         }
      }

      match.status = 'scheduled';
      match.winnerId = null;
      match.defaultedPlayerId = null;
      match.score = { player1: [], player2: [] };
      match.endedAt = null;
      
      saveAndRender();
      alert("✅ 比賽結果已撤銷，並退回待排賽程！");
      
    } else if (opt === '2') {
      // Edit score
      if (match.nextMatchId) {
         const nextMatch = state.matches.find(m => m.id === match.nextMatchId);
         if (nextMatch && nextMatch.status !== 'scheduled') {
           if (!confirm("⚠️ 警告：晉級後的下一輪比賽已經開始或結束！\n如果您修改比分導致「獲勝者改變」，將會破壞後續賽程邏輯。\n\n如果您只是要微調既有獲勝者的比分數字，請點「確定」繼續。")) {
              return;
           }
         }
      }
      
      const p1Name = getPlayerNameById(state, match.player1Id);
      const p2Name = getPlayerNameById(state, match.player2Id);
      
      document.getElementById('score-form-match-id').value = match.id;
      document.getElementById('score-team1-name').innerText = p1Name;
      document.getElementById('score-team2-name').innerText = p2Name;
      
      const s = match.score || {};
      const s1 = s.player1 || [];
      const s2 = s.player2 || [];
      document.getElementById('score-s1-p1').value = s1[0] !== undefined ? s1[0] : '';
      document.getElementById('score-s1-p2').value = s2[0] !== undefined ? s2[0] : '';
      document.getElementById('score-s2-p1').value = s1[1] !== undefined ? s1[1] : '';
      document.getElementById('score-s2-p2').value = s2[1] !== undefined ? s2[1] : '';
      document.getElementById('score-s3-p1').value = s1[2] !== undefined ? s1[2] : '';
      document.getElementById('score-s3-p2').value = s2[2] !== undefined ? s2[2] : '';
      
      document.getElementById('score-modal').classList.remove('hidden');
    }
  });
