// ui.js - Tennis Tournament Manager UI Rendering & Visual Elements

import { checkPlayerRestConflict, advanceWinner, saveState } from './state.js';

// Audio Context reference for Web Audio API Chime
let audioCtx = null;

// Initialize Audio Context on user gesture
export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    document.getElementById('audio-init-banner').classList.add('hidden');
    console.log("Audio Context initialized successfully.");
    // Play test chime
    playNotificationChime();
  }
}

// Web Audio API Ding-Dong Chime
export function playNotificationChime() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const now = audioCtx.currentTime;
  
  // Note 1 (E5)
  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(659.25, now); // E5
  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.2, now + 0.05);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  osc1.connect(gain1);
  gain1.connect(audioCtx.destination);
  osc1.start(now);
  osc1.stop(now + 0.5);
  
  // Note 2 (C5) - slightly delayed
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(523.25, now + 0.25); // C5
  gain2.gain.setValueAtTime(0, now + 0.25);
  gain2.gain.linearRampToValueAtTime(0.2, now + 0.3);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  osc2.start(now + 0.25);
  osc2.stop(now + 0.75);
}

// Speak the summon announcement using Browser Text-to-Speech
export function speakSummon(eventName, p1Name, p2Name, courtName) {
  if (!window.speechSynthesis) return;
  
  // Stop previous speech if any
  window.speechSynthesis.cancel();
  
  const text = `廣播，廣播！請進行 ${eventName} 的選手， ${p1Name}，與， ${p2Name}，立即前往 ${courtName} 報到出賽。重複一次，請 ${p1Name} 與 ${p2Name} 立即前往 ${courtName} 報到出賽。`;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-TW';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  
  window.speechSynthesis.speak(utterance);
}

// Render Player Lookup Results
export function renderPlayerSearch(state, nameQuery) {
  const container = document.getElementById('player-search-result');
  if (!nameQuery) {
    container.classList.add('hidden');
    return;
  }
  
  const matchedPlayers = state.players.filter(p => p.name.toLowerCase().includes(nameQuery.trim().toLowerCase()));
  
  container.classList.remove('hidden');
  
  if (matchedPlayers.length === 0) {
    container.innerHTML = `
      <div class="text-center py-2 text-danger">
        <strong>⚠️ 找不到包含「${nameQuery}」的選手</strong>
        <p class="small text-secondary mt-2">請確認輸入字眼是否相符，或洽大會服務台詢問。</p>
      </div>
    `;
    return;
  }
  

  let finalHtml = '';
  
  matchedPlayers.forEach(player => {
    // Find player's matches
    const activeMatches = state.matches.filter(m => 
      (m.status === 'called' || m.status === 'live') && 
      (m.player1Id === player.id || m.player2Id === player.id)
    );
    
    const upcomingMatches = state.matches.filter(m => 
      m.status === 'scheduled' && 
      (m.player1Id === player.id || m.player2Id === player.id)
    );
    
    let matchStatusHtml = '';
    if (activeMatches.length > 0) {
      const am = activeMatches[0];
      const court = state.courts.find(c => c.id === am.courtId);
      const courtName = court ? court.name : '指定球場';
      const statusText = am.status === 'called' ? '已召集 Called (10 min check-in)' : '正在進行比賽 Match In Progress';
      const statusClass = am.status === 'called' ? 'badge-warning' : 'badge-success';
      matchStatusHtml = `
        <div class="mt-3 p-3 bg-opacity-10 border border-success rounded" style="background: rgba(46,204,113,0.1);">
          <span class="badge ${statusClass}">${statusText}</span>
          <p class="mt-2 font-bold text-primary">您必須立即前往 (Please report to)：${courtName}</p>
          <div class="small text-secondary mt-1">賽事 (Event)：${am.event} (${am.round})</div>
        </div>
      `;
    } else if (upcomingMatches.length > 0) {
      matchStatusHtml = `
        <div class="mt-3 p-3 bg-opacity-5 border border-info rounded" style="background: rgba(6,180,212,0.05);">
          <span class="badge badge-info">待安排賽程 To Be Scheduled</span>
          <p class="mt-2 font-bold text-primary">您有一場即將進行的比賽 (You have an upcoming match)：</p>
          <div class="small text-secondary mt-1">
            賽事 (Event)：${upcomingMatches[0].event} (${upcomingMatches[0].round})<br>
            預估將會安排在後續的空閒球場進行。(Estimated to be scheduled on the next available court.)
          </div>
        </div>
      `;
    } else {
      matchStatusHtml = `
        <div class="mt-3 p-3 bg-opacity-5 border border-secondary rounded" style="background: var(--bg-secondary);">
          <span class="badge badge-success">無待進行賽事 No Upcoming Matches</span>
          <p class="mt-2 small text-secondary">您目前沒有進行中或待排定的淘汰賽程（可能已完賽或尚未產生下一輪賽事）。<br>You currently have no active or scheduled matches.</p>
        </div>
      `;
    }

    finalHtml += `
      <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <div class="flex-between">
          <h4 style="font-size: 1.2rem; font-weight: 800; color: var(--accent);">👤 ${player.name}</h4>
        </div>
        
        <div class="mt-3 grid gap-2" style="font-size: 0.9rem;">
          <div><strong>🎖️ 報名項目與報到狀態 (Events & Check-in Status)：</strong></div>
          <div class="flex" style="flex-wrap: wrap; gap: 8px;">
            ${(player.events || []).map(ev => {
              const isCheckedIn = player.checkInStatus && player.checkInStatus[ev];
              if (isCheckedIn) {
                return `<span class="badge badge-success">✅ ${ev} (已報到 Checked-in)</span>`;
              } else {
                const isCheckInOpen = state.configs && state.configs.eventsCheckIn && state.configs.eventsCheckIn[ev];
                if (!isCheckInOpen) {
                  return `<span class="badge" style="background: #e2e8f0; color: #475569; padding: 4px 10px; font-size: 0.85rem; font-weight: 600; border: 1px solid #cbd5e1;">⏳ 尚未開放報到 Not Open Yet (${ev})</span>`;
                }
                return `<button class="btn btn-sm btn-accent btn-self-checkin-event" data-id="${player.id}" data-event="${ev}" style="padding: 4px 10px; font-size: 0.85rem; font-weight: 600;">📍 報到 Check-in ${ev}</button>`;
              }
            }).join('')}
          </div>
          <div class="mt-2">
            <strong>📸 大會攝影服務 (Photography)：</strong>
            <span class="badge ${player.hasPhotography ? 'badge-success' : 'badge-warning'}" style="margin-right: 8px;">
              ${player.hasPhotography ? '✅ 已購買 (Yes)' : '無 (No)'}
            </span>
            <strong>🎾 UTR 層級 (UTR)：</strong>
            <span class="badge badge-info">${player.utr || '未提供 N/A'}</span>
          </div>
          <div class="mt-2">
            <strong>🎁 參賽贈品 (Gift)：</strong>
            <span class="text-secondary">${player.gift}</span> 
            ${player.gift && player.gift !== '無' ? `
            <span class="badge ${player.giftClaimed ? 'badge-success' : 'badge-warning'}">
              ${player.giftClaimed ? '已領取 Claimed' : '未領取 Unclaimed'}
            </span>` : ''}
            ${!player.giftClaimed && player.gift && player.gift !== '無' ? `
              <button class="btn btn-sm btn-outline ml-2" id="btn-claim-gift" data-id="${player.id}" style="padding: 2px 8px; font-size: 0.8rem; margin-left: 8px;">
                向工作人員領取 (Claim from Staff)
              </button>
            ` : ''}
          </div>
        </div>
        
        ${matchStatusHtml}
      </div>
    `;
  });

  container.innerHTML = finalHtml;
}

// Render Courts in Player View
export function renderPlayerCourts(state) {
  const grid = document.getElementById('player-court-grid');
  grid.innerHTML = '';

  state.courts.forEach(court => {
    const card = document.createElement('div');
    card.className = `court-card ${court.status}`;
    
    let stateContent = '';
    
    if (court.status === 'occupied' && court.currentMatchId) {
      const match = state.matches.find(m => m.id === court.currentMatchId);
      if (match) {
        const p1 = state.players.find(p => p.id === match.player1Id);
        const p2 = state.players.find(p => p.id === match.player2Id);
        const p1Name = p1 ? p1.name : (match.player1Id === 'BYE' ? 'BYE' : '未知');
        const p2Name = p2 ? p2.name : (match.player2Id === 'BYE' ? 'BYE' : '未知');
        const scoreStr = formatScore(match.score);
        
        if (match.status === 'called') {
          // Summoning timer
          card.classList.add('called');
          const elapsed = Date.now() - match.calledAt;
          const limit = state.configs.summonLimitMinutes * 60 * 1000;
          const remaining = Math.max(0, limit - elapsed);
          const min = Math.floor(remaining / 60000);
          const sec = Math.floor((remaining % 60000) / 1000);
          const countdownStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
          
          stateContent = `
            <div class="match-details">
              <span class="badge badge-warning">📢 大會召集點名中</span>
              <div class="players-versus mt-2">
                <span>${p1Name}</span>
                <span class="vs">VS</span>
                <span>${p2Name}</span>
              </div>
              <div class="match-event">${match.event} (${match.round})</div>
              <div class="timer-container called-timer mt-2">
                <span>⏳ 到達期限：</span><span>${countdownStr}</span>
              </div>
            </div>
          `;
        } else {
          // Match in progress
          card.classList.add('occupied');
          const elapsed = Date.now() - (match.startedAt || match.calledAt);
          const hr = Math.floor(elapsed / 3600000);
          const min = Math.floor((elapsed % 3600000) / 60000);
          const sec = Math.floor((elapsed % 60000) / 1000);
          const elapsedStr = `${hr > 0 ? hr + ':' : ''}${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

          stateContent = `
            <div class="match-details">
              <span class="badge badge-success">🎾 比賽進行中</span>
              <div class="players-versus mt-2">
                <span>${p1Name}</span>
                <span class="vs">VS</span>
                <span>${p2Name}</span>
              </div>
              <div class="match-event">${match.event} (${match.round})</div>
              <div class="live-score-badge mt-2">${scoreStr || '0 - 0'}</div>
              <div class="timer-container live-timer mt-2" style="font-size: 0.95rem;">
                <span>⏱️ 已進行：</span><span>${elapsedStr}</span>
              </div>
            </div>
          `;
        }
      }
    } else {
      // Idle
      stateContent = `
        <div class="text-center text-secondary py-4">
          <span style="font-size: 2rem;">💤</span>
          <p class="mt-2 font-bold">空閒球場 (Available)</p>
          <span class="badge badge-info mt-1">等待指派</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="court-name">
        <span>🏟️ ${court.name}</span>
      </div>
      <div class="court-state">
        ${stateContent}
      </div>
    `;
    grid.appendChild(card);
  });
}

// Render Upcoming Matches Queue in Player View
export function renderPlayerUpcoming(state) {
  const tbody = document.getElementById('player-upcoming-matches');
  tbody.innerHTML = '';
  
  let upcoming = state.matches.filter(m => m.status === 'scheduled' && m.player1Id !== 'BYE' && m.player2Id !== 'BYE');

  const filterSelect = document.getElementById('player-queue-filter');
  const currentFilter = filterSelect ? filterSelect.value : 'all';

  // Update filter dropdown options dynamically from upcoming matches
  if (filterSelect) {
    const uniqueEvents = [...new Set(state.matches.filter(m => m.status === 'scheduled' && m.player1Id !== 'BYE' && m.player2Id !== 'BYE').map(m => m.event))];
    const optionsHtml = ['<option value="all">全部賽事項目</option>']
      .concat(uniqueEvents.map(ev => `<option value="${ev}" ${ev === currentFilter ? 'selected' : ''}>${ev}</option>`));
    filterSelect.innerHTML = optionsHtml.join('');
  }
  
  // Apply filter
  if (currentFilter !== 'all') {
    upcoming = upcoming.filter(m => m.event === currentFilter);
  }
  
  document.getElementById('upcoming-matches-count').innerText = `${upcoming.length} 場待安排`;

  if (upcoming.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary">目前沒有等待安排的賽程。</td></tr>`;
    return;
  }

  // Calculate Estimated Time variables using queue simulation
  const totalCourts = state.courts.length;
  const avgMatchDurationMs = (state.configs.avgMatchMinutes || 30) * 60 * 1000;
  
  let courtAvailabilities = [];
  if (totalCourts > 0) {
    state.courts.forEach(court => {
      const baseTime = Date.now();
      
      if (court.status === 'idle' || !court.currentMatchId) {
        courtAvailabilities.push(baseTime);
      } else {
        const activeMatch = state.matches.find(m => m.id === court.currentMatchId);
        if (activeMatch && activeMatch.startedAt) {
          const elapsed = Date.now() - activeMatch.startedAt;
          const remaining = Math.max(0, avgMatchDurationMs - elapsed);
          courtAvailabilities.push(Date.now() + remaining); // active matches still relative to now
        } else {
          courtAvailabilities.push(baseTime + avgMatchDurationMs);
        }
      }
    });
  }

  const rLimitMs = (state.configs.restBufferMinutes || 30) * 60 * 1000;
  
  // 1. Implement Dependency Pre-calculation (prereqs map)
  const prereqs = {};
  state.matches.forEach(m => {
    if (m.nextMatchId) {
      if (!prereqs[m.nextMatchId]) prereqs[m.nextMatchId] = [];
      prereqs[m.nextMatchId].push(m.id);
    }
  });

  const matchFinishTimes = {}; // Record simulated finish times of scheduled matches

  // 2. Implement getPlayerReadyTime logic to handle isPlaying and lastMatchEndedAt
  const getPlayerReadyTime = (player) => {
    if (!player) return Date.now();
    const activeCourt = state.courts.find(c => {
       if (c.status !== 'occupied' || !c.currentMatchId) return false;
       const m = state.matches.find(match => match.id === c.currentMatchId);
       if (!m) return false;
       return m.player1Id === player.id || m.player2Id === player.id || m.player1DoubleId === player.id || m.player2DoubleId === player.id;
    });
    if (activeCourt) {
       const m = state.matches.find(match => match.id === activeCourt.currentMatchId);
       let elapsed = m && m.startedAt ? (Date.now() - m.startedAt) : 0;
       return Date.now() + Math.max(0, avgMatchDurationMs - elapsed) + rLimitMs;
    }
    if (player.lastMatchEndedAt) return player.lastMatchEndedAt + rLimitMs;
    return Date.now();
  };

  // Render all upcoming matches (user can scroll vertically)
  upcoming.forEach((match, idx) => {
    const p1 = state.players.find(p => p.id === match.player1Id);
    const p2 = state.players.find(p => p.id === match.player2Id);
    
    const ev = match.event;
    const isPlayerCheckedIn = (p) => p && (p.checkInStatus ? p.checkInStatus[ev] : p.checkedIn);
    let p1Status = p1 ? (isPlayerCheckedIn(p1) ? '✅ 報到' : '❌ 未報到') : 'TBD';
    let p2Status = p2 ? (isPlayerCheckedIn(p2) ? '✅ 報到' : '❌ 未報到') : 'TBD';
    
    // Check conflicts
    const rLimit = state.configs.restBufferMinutes || 30;
    let conflictP1 = p1 ? checkPlayerRestConflict(p1, state, Date.now(), rLimit) : { conflict: false };
    let conflictP2 = p2 ? checkPlayerRestConflict(p2, state, Date.now(), rLimit) : { conflict: false };
    
    let conflictText = '';
    if (conflictP1.conflict && conflictP1.reason === 'restBuffer') {
      conflictText += `<span class="badge badge-warning">${p1.name} 尚需休息 ${conflictP1.remainingMin} 分</span> `;
    }
    if (conflictP2.conflict && conflictP2.reason === 'restBuffer') {
      conflictText += `<span class="badge badge-warning">${p2.name} 尚需休息 ${conflictP2.remainingMin} 分</span> `;
    }

    const p1NameText = p1 ? p1.name : (match.player1Id === 'BYE' ? 'BYE' : '等候對手');
    const p2NameText = p2 ? p2.name : (match.player2Id === 'BYE' ? 'BYE' : '等候對手');

    // Shorten text for mobile display
    const shortEvent = match.event.replace(/\s*\(.*?\)/, '');
    let shortRound = match.round
      .replace(/第\s*(\d+)\s*輪.*/, 'R$1')
      .replace(/半準決賽.*/, '8強')
      .replace(/準決賽.*/, '4強')
      .replace(/決賽.*/, '決賽');

    // Estimated time calculation
    let timeText = '';
    if (totalCourts === 0) {
      timeText = '釋出後排定';
    } else {
      courtAvailabilities.sort((a, b) => a - b);
      const earliestAvailableTime = courtAvailabilities[0];
      
      let p1Ready = getPlayerReadyTime(p1);
      let p2Ready = getPlayerReadyTime(p2);
      
      let minPrereqReady = Date.now();
      if (prereqs[match.id]) {
        prereqs[match.id].forEach(prqId => {
          if (matchFinishTimes[prqId]) {
            minPrereqReady = Math.max(minPrereqReady, matchFinishTimes[prqId] + rLimitMs);
          } else {
             const activeCourt = state.courts.find(c => c.currentMatchId === prqId);
             if (activeCourt) {
               const m = state.matches.find(x => x.id === prqId);
               let elapsed = (m && m.startedAt) ? (Date.now() - m.startedAt) : 0;
               minPrereqReady = Math.max(minPrereqReady, Date.now() + Math.max(0, avgMatchDurationMs - elapsed) + rLimitMs);
             }
          }
        });
      }
      
      const matchStartTime = Math.max(earliestAvailableTime, p1Ready, p2Ready, minPrereqReady);
      matchFinishTimes[match.id] = matchStartTime + avgMatchDurationMs;
      
      if (matchStartTime <= Date.now() + 60000) {
        timeText = '即將上場';
      } else {
        const estimatedDate = new Date(matchStartTime);
        const hours = String(estimatedDate.getHours()).padStart(2, '0');
        const mins = String(estimatedDate.getMinutes()).padStart(2, '0');
        timeText = `約 ${hours}:${mins}<br><span style="font-size: 0.75rem; opacity: 0.7;">(僅供參考)</span>`;
      }
      
      // Crucial: Update the court's available time. Since the match starts at matchStartTime,
      // it won't be available until matchStartTime + duration!
      courtAvailabilities[0] = matchStartTime + avgMatchDurationMs;
    }

    const isEventCheckInOpen = state.configs.eventsCheckIn && state.configs.eventsCheckIn[ev] === true;
    if (!isEventCheckInOpen) {
      timeText = '尚未開放報到';
    }

    const tr = document.createElement('tr');
    tr.className = 'setup-player-row';
    tr.innerHTML = `
      <td style="white-space: nowrap;">${shortEvent}</td>
      <td style="white-space: nowrap;"><span class="badge badge-info">${shortRound}</span></td>
      <td><strong>${p1NameText}</strong> <span class="text-secondary small">vs</span> <strong>${p2NameText}</strong></td>
      <td>
        <span class="small text-secondary">${p1NameText}: ${p1Status}<br>${p2NameText}: ${p2Status}</span>
        ${conflictText ? '<br>' + conflictText : ''}
      </td>
      <td style="white-space: nowrap; font-size: 0.8rem;"><span class="text-secondary">${timeText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Event dropdown & Brackets in Player Hub
export function renderPlayerBrackets(state) {
  const select = document.getElementById('player-bracket-event-select');
  if (!select) return;
  const currentSelectValue = select.value;
  
  // Always rebuild options to sync with state.events
  select.innerHTML = '';
  state.events.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev;
    opt.text = ev;
    select.add(opt);
  });

  // Restore selection if it exists
  if (currentSelectValue && state.events.includes(currentSelectValue)) {
    select.value = currentSelectValue;
  }

  const selectedEvent = select.value || state.events[0];
  const viewer = document.getElementById('player-bracket-viewer');
  viewer.innerHTML = '';

  // Get matches of selected event
  const eventMatches = state.matches.filter(m => m.event === selectedEvent);
  if (eventMatches.length === 0) {
    viewer.innerHTML = `<div class="text-secondary text-center w-full py-4">此項目尚未生成賽事簽表。</div>`;
    return;
  }

  // Determine rounds count
  const maxRound = Math.max(...eventMatches.map(m => m.roundIndex));
  const wrapper = document.createElement('div');
  wrapper.className = 'bracket-wrapper';

  for (let r = 1; r <= maxRound; r++) {
    const roundCol = document.createElement('div');
    roundCol.className = 'bracket-round';
    
    const roundMatches = eventMatches.filter(m => m.roundIndex === r);
    // Sort matches to render them vertically matching bracket structure
    // Since matches in round R feed into round R+1 sequentially:
    // Match index 0,1 feed to match 0. Index 2,3 feed to match 1.
    // Let's sort roundMatches based on their order in initial array
    roundMatches.forEach(match => {
      const matchCard = document.createElement('div');
      matchCard.className = 'bracket-match';
      
      const p1Name = getPlayerNameById(state, match.player1Id);
      const p2Name = getPlayerNameById(state, match.player2Id);
      
      const p1Winner = match.status === 'completed' && match.winnerId === match.player1Id;
      const p2Winner = match.status === 'completed' && match.winnerId === match.player2Id;
      const p1Loser = match.status === 'completed' && match.winnerId !== match.player1Id;
      const p2Loser = match.status === 'completed' && match.winnerId !== match.player2Id;

      const p1Class = p1Winner ? 'winner' : (p1Loser ? 'loser' : '');
      const p2Class = p2Winner ? 'winner' : (p2Loser ? 'loser' : '');

      let scoreP1Html = '';
      let scoreP2Html = '';
      
      if (match.status === 'completed') {
        const s = match.score;
        if (s && s.player1 && s.player1.length > 0) {
          scoreP1Html = s.player1.map((games, idx) => `<span class="score-set">${games}</span>`).join('');
          scoreP2Html = s.player2.map((games, idx) => `<span class="score-set">${games}</span>`).join('');
          
          if (s.supertie && s.supertie.player1) {
            scoreP1Html += `<span class="text-secondary small">(${s.supertie.player1})</span>`;
            scoreP2Html += `<span class="text-secondary small">(${s.supertie.player2})</span>`;
          }
        }
      }

      // Check if match is live/called to show court
      let liveBadge = '';
      if (match.status === 'called' || match.status === 'live') {
        const court = state.courts.find(c => c.id === match.courtId);
        liveBadge = `<span class="badge ${match.status === 'called' ? 'badge-warning' : 'badge-success'}">${court ? court.name.split(' ')[0] : '比賽中'}</span>`;
      } else if (match.status === 'defaulted') {
        liveBadge = `<span class="badge badge-danger">裁定棄賽</span>`;
      }

      if (r > 1) {
        const leftLine = document.createElement('div');
        leftLine.className = 'bracket-line-left';
        matchCard.appendChild(leftLine);
      }

      if (match.nextMatchId) {
        const lineDir = match.p1OrP2 === 'p1' ? 'line-down' : 'line-up';
        const rightLine = document.createElement('div');
        rightLine.className = 'bracket-line-right';
        const vertLine = document.createElement('div');
        vertLine.className = `bracket-line-vertical ${lineDir} round-r${r}`;
        matchCard.appendChild(rightLine);
        matchCard.appendChild(vertLine);
      }

      const headerDiv = document.createElement('div');
      headerDiv.className = 'bracket-match-header';
      const roundSpan = document.createElement('span');
      roundSpan.textContent = match.round || '';
      headerDiv.appendChild(roundSpan);
      
      if (match.status === 'called' || match.status === 'live') {
        const court = state.courts.find(c => c.id === match.courtId);
        const badgeSpan = document.createElement('span');
        badgeSpan.className = `badge ${match.status === 'called' ? 'badge-warning' : 'badge-success'}`;
        badgeSpan.textContent = court ? court.name.split(' ')[0] : '比賽中';
        headerDiv.appendChild(badgeSpan);
      } else if (match.status === 'defaulted') {
        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'badge badge-danger';
        badgeSpan.textContent = '裁定棄賽';
        headerDiv.appendChild(badgeSpan);
      }
      
      if ((match.status === 'completed' || match.status === 'defaulted') && match.player1Id !== 'BYE' && match.player2Id !== 'BYE') {
        const undoBtn = document.createElement('span');
        undoBtn.style.fontSize = '12px';
        undoBtn.style.marginLeft = 'auto';
        undoBtn.style.cursor = 'pointer';
        undoBtn.style.opacity = '0.15';
        undoBtn.innerHTML = '⚙️';
        undoBtn.setAttribute('title', '系統管理');
        undoBtn.setAttribute('data-action', 'admin-match-options');
        undoBtn.setAttribute('data-match-id', match.id);
        headerDiv.appendChild(undoBtn);
      }
      
      matchCard.appendChild(headerDiv);

      const createPlayerRow = (pName, pClass, scoreHtml) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = `bracket-player-row ${pClass}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'bracket-player-name';
        nameSpan.title = pName;
        nameSpan.textContent = pName;
        
        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'bracket-player-score';
        scoreDiv.innerHTML = scoreHtml;
        
        rowDiv.appendChild(nameSpan);
        rowDiv.appendChild(scoreDiv);
        return rowDiv;
      };

      matchCard.appendChild(createPlayerRow(p1Name, p1Class, scoreP1Html));
      matchCard.appendChild(createPlayerRow(p2Name, p2Class, scoreP2Html));
      roundCol.appendChild(matchCard);
    });

    wrapper.appendChild(roundCol);
  }

  viewer.appendChild(wrapper);
}

// Render Staff Dashboard (Stats, Check-in, Queue, Court Deployment)
export function renderStaffDashboard(state) {
  // Sync quick rest buffer & avg match input
  // Render Event Check-in Controls
  const eventCheckinContainer = document.getElementById('event-checkin-controls');
  if (eventCheckinContainer) {
    const activeEvents = [...new Set(state.players.reduce((acc, p) => acc.concat(p.events || []), []))];
    const exactOrder = [
      "男單 UTR 2.0",
      "男單 UTR 3.0",
      "breakpoint® 男學員組 UTR 3.0",
      "男單 UTR 4.0",
      "男單 UTR 5.0",
      "男單 UTR 6.0",
      "男單 知天命 UTR 6.0",
      "男單 UTR 7.0",
      "男單 UTR 8.0",
      "男單 U12",
      "男單 U14",
      "男單 U16",
      "男單 公開組",
      "女單 UTR 2.0",
      "女單 UTR 3.0",
      "breakpoint® 女學員組 UTR 3.0",
      "女單 UTR 4.0",
      "女單 UTR 5.0",
      "女單 知天命 UTR 6.0",
      "女單 UTR 6.0",
      "女單 UTR 7.0",
      "女單 U12",
      "女單 U14",
      "女單 U16",
      "女單 公開組",
      "U8 綠球組",
      "U10 綠球組",
      "男雙 UTR 2.0",
      "男雙 UTR 4.0",
      "男雙 UTR 5.0",
      "男雙 UTR 6.0",
      "男雙 UTR 7.0",
      "男雙 公開組",
      "女雙 UTR 2.0",
      "女雙 UTR 3.0",
      "女雙 UTR 4.0",
      "女雙 UTR 5.0",
      "女雙 UTR 6.0",
      "女雙 UTR 7.0",
      "女雙 公開組",
      "混雙 UTR 2.0",
      "混雙 UTR 3.0",
      "混雙 UTR 4.0",
      "混雙 UTR 5.0",
      "混雙 知天命 UTR 6.0 組-50歲以上",
      "混雙 耳順 UTR 6.0 組-60歲以上",
      "混雙 UTR 6.0",
      "混雙 UTR 7.0",
      "混雙 公開組"
    ];
    
    activeEvents.sort((a, b) => {
      let idxA = exactOrder.indexOf(a);
      let idxB = exactOrder.indexOf(b);
      
      // If not in list, send to bottom
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      
      if (idxA !== idxB) return idxA - idxB;
      return a.localeCompare(b, 'zh-TW', { numeric: true });
    });
    if (activeEvents.length === 0) {
      eventCheckinContainer.innerHTML = '<span class="text-secondary small">尚無任何賽程，無法開放報到。</span>';
    } else {
      eventCheckinContainer.innerHTML = activeEvents.map(ev => {
        const isOpen = state.configs && state.configs.eventsCheckIn && state.configs.eventsCheckIn[ev];
        return `<button class="btn btn-sm ${isOpen ? 'btn-success' : 'btn-outline'}" onclick="window.toggleEventCheckIn('${ev}')">${ev}: ${isOpen ? '開放中 ✅' : '未開放 🔒'}</button>`;
      }).join('');
    }
  }
  
  const quickRestInput = document.getElementById('quick-rest-buffer');
  if (quickRestInput) {
    quickRestInput.value = state.configs.restBufferMinutes || 30;
  }
  const quickAvgMatchInput = document.getElementById('quick-avg-match');
  if (quickAvgMatchInput) {
    quickAvgMatchInput.value = state.configs.avgMatchMinutes || 30;
  }
  const thConflict = document.getElementById('th-conflict-check');
  if (thConflict) {
    thConflict.innerText = `選手報到與 ${state.configs.restBufferMinutes || 30} 分保護衝突檢查`;
  }

  // 1. Update stats indicators
  const checkedInCount = state.players.filter(p => p.events.some(ev => p.checkInStatus && p.checkInStatus[ev]) || p.checkedIn).length;
  document.getElementById('stats-total-players').innerText = state.players.length;
  document.getElementById('stats-checked-in').innerText = `${checkedInCount} / ${state.players.length}`;
  
  const activeCourts = state.courts.filter(c => c.status === 'occupied').length;
  document.getElementById('stats-active-courts').innerText = `${activeCourts} / ${state.courts.length}`;

  const completedMatches = state.matches.filter(m => m.status === 'completed' || m.status === 'defaulted').length;
  document.getElementById('stats-completed-matches').innerText = `${completedMatches} / ${state.matches.length}`;

  // 2. Render Check-in & Gift claim table
  const searchInput = document.getElementById('staff-player-search').value.toLowerCase();
  const checkinTbody = document.getElementById('staff-checkin-tbody');
  checkinTbody.innerHTML = '';

  const filteredPlayers = state.players.filter(p => 
    p.name.toLowerCase().includes(searchInput)
  );

  if (filteredPlayers.length === 0) {
    checkinTbody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary">找不到相符的選手。</td></tr>`;
  } else {
    filteredPlayers.forEach(player => {
      const tr = document.createElement('tr');
    tr.className = 'setup-player-row';
    tr.innerHTML = `
        <td><strong>${player.name}</strong></td>
        <td class="small text-secondary">${(player.events || []).join('<br>') || '無'}</td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span class="small font-bold">${player.gift}</span>
            ${(() => {
              if (!player.gift || player.gift === '無') return '';
              const anyCheckedIn = (player.events || []).some(ev => player.checkInStatus && player.checkInStatus[ev]) || player.checkedIn;
              return `<button class="btn btn-sm ${player.giftClaimed ? 'btn-secondary' : 'btn-outline'}" data-action="toggle-gift" data-id="${player.id}" style="padding: 2px 6px; font-size: 0.8rem;">
                ${player.giftClaimed ? '🎁 已領取' : '🎁 點擊領取'}
              </button>`;
            })()}
          </div>
        </td>
        <td>${player.hasPhotography ? '📷 是' : '無'}</td>
        <td>${player.utr || '無'}</td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${(player.events || []).map(ev => {
              const status = player.checkInStatus && player.checkInStatus[ev];
              const isChecked = status === true;
              const isForfeit = status === 'forfeited';
              
              if (isForfeit) {
                return `<span class="badge badge-danger" style="margin-bottom: 2px;">${ev} 已棄賽</span>`;
              }
              
              return `<div style="display: flex; gap: 4px; align-items: center;">
                <button class="btn btn-sm ${isChecked ? 'btn-primary' : 'btn-outline-accent'}" data-action="toggle-checkin" data-id="${player.id}" data-event="${ev}" style="padding: 2px 6px; font-size: 0.8rem; flex: 1;">
                  ${isChecked ? `✅ ${ev} 已報到` : `🔲 ${ev} 點擊報到`}
                </button>
                ${!isChecked ? `<button class="btn btn-sm btn-outline-danger" data-action="forfeit-event" data-id="${player.id}" data-event="${ev}" style="padding: 2px 6px; font-size: 0.8rem;" title="未報到判定棄賽">❌ 未報到判定棄賽</button>` : ''}
              </div>`;
            }).join('')}
          </div>
        </td>
      `;
      checkinTbody.appendChild(tr);
    });
  }

  // 3. Render Court Deployment (Mini Cards for Staff)
  const courtGrid = document.getElementById('staff-court-grid');
  courtGrid.innerHTML = '';
  
  state.courts.forEach(court => {
    const item = document.createElement('div');
    item.className = 'court-card-mini';
    
    let infoText = '空閒中';
    let subText = '等待指派';
    let btnHtml = '';
    
    if (court.status === 'occupied' && court.currentMatchId) {
      const match = state.matches.find(m => m.id === court.currentMatchId);
      if (match) {
        const p1 = getPlayerNameById(state, match.player1Id);
        const p2 = getPlayerNameById(state, match.player2Id);
        infoText = `${p1} vs ${p2}`;
        subText = match.status === 'called' ? '📢 呼叫點名中' : '🎾 進行比賽中';
        
        btnHtml = `
          <button class="btn btn-sm btn-danger" data-action="staff-abort-match" data-court-id="${court.id}" data-match-id="${match.id}">
            ❌ 中止
          </button>
        `;
      }
    }
    
    item.innerHTML = `
      <div class="court-info">
        <span class="court-title">🏟️ ${court.name.split(' ')[0]}</span>
        <span class="court-status text-secondary">${infoText}</span>
        <small class="small ${court.status === 'occupied' ? 'text-accent' : 'text-muted'}">${subText}</small>
      </div>
      ${btnHtml}
    `;
    courtGrid.appendChild(item);
  });

  // 4. Render Pending Match Queue & Manual court selector
  const queueTbody = document.getElementById('staff-match-queue-tbody');
  queueTbody.innerHTML = '';

  let pendingMatches = state.matches.filter(m => m.status === 'scheduled' && m.player1Id !== 'BYE' && m.player2Id !== 'BYE');

  const filterSelect = document.getElementById('staff-queue-filter');
  const currentFilter = filterSelect ? filterSelect.value : 'all';

  // Update filter dropdown options dynamically from pending matches
  if (filterSelect) {
    const uniqueEvents = [...new Set(state.matches.filter(m => m.status === 'scheduled' && m.player1Id !== 'BYE' && m.player2Id !== 'BYE').map(m => m.event))];
    const optionsHtml = ['<option value="all">全部賽事項目</option>']
      .concat(uniqueEvents.map(ev => `<option value="${ev}" ${ev === currentFilter ? 'selected' : ''}>${ev}</option>`));
    filterSelect.innerHTML = optionsHtml.join('');
  }
  
  // Apply filter
  if (currentFilter !== 'all') {
    pendingMatches = pendingMatches.filter(m => m.event === currentFilter);
  }
  
  if (pendingMatches.length === 0) {
    queueTbody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary">尚無待排賽程（或全部賽事已排定完畢）。</td></tr>`;
  } else {
    // Sort pending matches: fully ready first, then playable (known players), then TBD
    const isPlayerCheckedIn = (p, ev) => p && (p.checkInStatus ? p.checkInStatus[ev] : p.checkedIn);
    const getMatchReadyScore = (match) => {
      if (!match.player1Id || !match.player2Id || match.player1Id === 'BYE' || match.player2Id === 'BYE') return 0; // TBD or BYE
      
      const p1 = state.players.find(p => p.id === match.player1Id);
      const p2 = state.players.find(p => p.id === match.player2Id);
      if (!p1 || !p2) return 0; // TBD
      
      const rLimit = state.configs.restBufferMinutes || 30;
      const p1Ready = isPlayerCheckedIn(p1, match.event) && !checkPlayerRestConflict(p1, state, Date.now(), rLimit).conflict;
      const p2Ready = isPlayerCheckedIn(p2, match.event) && !checkPlayerRestConflict(p2, state, Date.now(), rLimit).conflict;
      
      if (p1Ready && p2Ready) return 2; // Fully ready to schedule
      return 1; // Playable but waiting for check-in/rest
    };

    const sortedPending = [...pendingMatches].sort((a, b) => {
      const scoreA = getMatchReadyScore(a);
      const scoreB = getMatchReadyScore(b);
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Higher score first
      }
      
      // Sort by roundIndex (Round 1 first)
      return a.roundIndex - b.roundIndex;
    });

    // Show top 15 matches (prioritizing playable ones)
    sortedPending.slice(0, 15).forEach(match => {
      const p1 = state.players.find(p => p.id === match.player1Id);
      const p2 = state.players.find(p => p.id === match.player2Id);
      
      const p1Name = p1 ? p1.name : (match.player1Id === 'BYE' ? 'BYE' : '等候對手');
      const p2Name = p2 ? p2.name : (match.player2Id === 'BYE' ? 'BYE' : '等候對手');

      const isBye = match.player1Id === 'BYE' || match.player2Id === 'BYE';
      const isTbd = (!p1 && match.player1Id !== 'BYE') || (!p2 && match.player2Id !== 'BYE');

      let statusDescriptionHtml = '';
      let isAssignDisabled = false;

      if (isBye) {
        statusDescriptionHtml = '<span class="badge badge-info">BYE 輪空賽</span>';
        isAssignDisabled = true;
      } else if (isTbd) {
        statusDescriptionHtml = '<span class="badge badge-info">等候前一輪勝出者（或選手已刪除）</span>';
        isAssignDisabled = true;
      } else {
        // Evaluate Check-in requirements
        const ev = match.event;
        const isPlayerCheckedIn = (p) => p && (p.checkInStatus ? p.checkInStatus[ev] : p.checkedIn);
        const p1Check = isPlayerCheckedIn(p1) ? '✅' : '❌';
        const p2Check = isPlayerCheckedIn(p2) ? '✅' : '❌';
        statusDescriptionHtml += `報到：${p1.name}(${p1Check}) vs ${p2.name}(${p2Check})`;

        // Check rest constraints
        const rLimit = state.configs.restBufferMinutes || 30;
        const p1Rest = checkPlayerRestConflict(p1, state, Date.now(), rLimit);
        const p2Rest = checkPlayerRestConflict(p2, state, Date.now(), rLimit);

        let restViolation = false;
        if (p1Rest.conflict && p1Rest.reason === 'restBuffer') {
          statusDescriptionHtml += `<br><span class="badge badge-danger">⚠️ ${p1.name} 需休息 (剩 ${p1Rest.remainingMin} 分鐘)</span>`;
          restViolation = true;
        }
        if (p2Rest.conflict && p2Rest.reason === 'restBuffer') {
          statusDescriptionHtml += `<br><span class="badge badge-danger">⚠️ ${p2.name} 需休息 (剩 ${p2Rest.remainingMin} 分鐘)</span>`;
          restViolation = true;
        }

        if (!isPlayerCheckedIn(p1) || !isPlayerCheckedIn(p2)) {
          statusDescriptionHtml += '<br><span class="text-danger small">雙方均完成報到方可派場</span>';
          isAssignDisabled = true;
        } else if (restViolation) {
          isAssignDisabled = true;
        } else {
          statusDescriptionHtml += '<br><span class="badge badge-success">✅ 可排程出賽</span>';
        }
      }

      // Generate court selector options
      let courtOptionsHtml = '<option value="">-- 手動指派球場 --</option>';
      state.courts.forEach(c => {
        if (c.status === 'idle') {
          courtOptionsHtml += `<option value="${c.id}">${c.name}</option>`;
        }
      });

      const assignSelect = isAssignDisabled ? 
        `<span class="text-muted small">不可排程</span>` : 
        `<select class="form-control" data-action="assign-court-select" data-match-id="${match.id}">
          ${courtOptionsHtml}
         </select>`;

      const tr = document.createElement('tr');
    tr.className = 'setup-player-row';
    tr.innerHTML = `
        <td><strong>${match.event}</strong><br><span class="badge badge-info">${match.round}</span></td>
        <td><strong>${p1Name}</strong><br><span class="text-muted">vs</span><br><strong>${p2Name}</strong></td>
        <td class="small">${statusDescriptionHtml}</td>
        <td>${assignSelect}</td>
      `;
      queueTbody.appendChild(tr);
    });
  }

  // 5. Render Winners Board & Certificate trigger buttons
  const winnersTbody = document.getElementById('staff-winners-tbody');
  winnersTbody.innerHTML = '';

  state.events.forEach(eventName => {
    const finalMatch = state.matches.find(m => m.event === eventName && m.round === '決賽 (Final)');
    const semiMatches = state.matches.filter(m => m.event === eventName && m.round === '準決賽 (Semifinals)' && m.status === 'completed');
    
    let winnerName = '尚未分出勝負';
    let runnerupName = '尚未分出勝負';
    let thirdPlaceName = '尚未分出勝負';
    let printBtnHtml = '';

    if (semiMatches.length > 0) {
      const thirdPlaces = [];
      semiMatches.forEach(semi => {
        if (semi.winnerId) {
          const loserId = semi.winnerId === semi.player1Id ? semi.player2Id : semi.player1Id;
          thirdPlaces.push(getPlayerNameById(state, loserId));
        }
      });
      if (thirdPlaces.length > 0) {
        thirdPlaceName = thirdPlaces.join(' / ');
      }
    }

    if (finalMatch && finalMatch.status === 'completed' && finalMatch.winnerId) {
      winnerName = getPlayerNameById(state, finalMatch.winnerId);
      const runnerupId = finalMatch.winnerId === finalMatch.player1Id ? finalMatch.player2Id : finalMatch.player1Id;
      runnerupName = getPlayerNameById(state, runnerupId);

      printBtnHtml = `
        <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
          <button class="btn btn-sm btn-accent" data-action="open-certificate" data-name="${winnerName}" data-rank="冠軍 (Winner)" data-event="${eventName}">🏆 冠軍</button>
          <button class="btn btn-sm btn-secondary" data-action="open-certificate" data-name="${runnerupName}" data-rank="亞軍 (Runner-up)" data-event="${eventName}">🥈 亞軍</button>
          ${thirdPlaceName && thirdPlaceName !== '尚未分出勝負' ? `<button class="btn btn-sm btn-secondary" data-action="open-certificate" data-name="${thirdPlaceName}" data-rank="季軍 (3rd Place)" data-event="${eventName}">🥉 季軍</button>` : ''}
        </div>
      `;
    }

    const tr = document.createElement('tr');
    tr.className = 'setup-player-row';
    tr.innerHTML = `
      <td><strong>${eventName}</strong></td>
      <td class="text-accent font-bold">${winnerName}</td>
      <td class="text-secondary">${runnerupName}</td>
      <td class="text-secondary">${thirdPlaceName}</td>
      <td>${printBtnHtml || '<span class="text-muted small">決賽完成後開放</span>'}</td>
    `;
    winnersTbody.appendChild(tr);
  });

  // Sync Announcement
  const annInput = document.getElementById('staff-announcement-input');
  const annBanner = document.getElementById('player-announcement-banner');
  const annText = document.getElementById('player-announcement-text');
  
  const msg = state.configs && state.configs.announcementMessage ? state.configs.announcementMessage : "";
  if (annInput) annInput.value = msg;
  
  if (annBanner && annText) {
    if (msg) {
      annText.innerText = msg;
      annBanner.style.display = 'block';
    } else {
      annBanner.style.display = 'none';
    }
  }

}

// Render Referee Panel
export function renderRefereePanel(state) {
  const grid = document.getElementById('referee-court-grid');
  grid.innerHTML = '';

  const activeCourts = state.courts;

  activeCourts.forEach(court => {
    const card = document.createElement('div');
    card.className = `court-card ${court.status}`;
    
    let contentHtml = '';
    
    if (court.status === 'occupied' && court.currentMatchId) {
      const match = state.matches.find(m => m.id === court.currentMatchId);
      if (match) {
        const p1Name = getPlayerNameById(state, match.player1Id);
        const p2Name = getPlayerNameById(state, match.player2Id);
        const p1 = state.players.find(p => p.id === match.player1Id);
        const p2 = state.players.find(p => p.id === match.player2Id);
        
        if (match.status === 'called') {
          // Timer countdown (10 mins)
          card.classList.add('called');
          const elapsed = Date.now() - match.calledAt;
          const limit = state.configs.summonLimitMinutes * 60 * 1000;
          const remaining = Math.max(0, limit - elapsed);
          const min = Math.floor(remaining / 60000);
          const sec = Math.floor((remaining % 60000) / 1000);
          const countdownStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
          
          let alertText = '';
          if (remaining === 0) {
            alertText = `<span class="badge badge-danger mt-1">⚠️ 逾時未到！可裁定棄賽</span>`;
          }

          contentHtml = `
            <div class="match-details">
              <span class="badge badge-warning">📢 大會點名召集 (10分內需抵達)</span>
              <div class="players-versus mt-2">
                <div style="display: flex; flex-direction: column; align-items: center;">
                  <span>${p1Name}</span>
                  ${p1 && p1.hasPhotography ? '<span style="font-size: 0.7rem; color: #666; font-weight: 500; margin-top: 2px;">📸 需攝影</span>' : ''}
                </div>
                <span class="vs">VS</span>
                <div style="display: flex; flex-direction: column; align-items: center;">
                  <span>${p2Name}</span>
                  ${p2 && p2.hasPhotography ? '<span style="font-size: 0.7rem; color: #666; font-weight: 500; margin-top: 2px;">📸 需攝影</span>' : ''}
                </div>
              </div>
              <div class="match-event">${match.event}</div>
              <div class="timer-container called-timer mt-1">
                <span>⏳ 到達限時：</span><strong>${countdownStr}</strong>
              </div>
              ${alertText}
              <div class="button-group mt-3" style="display: flex; gap: 0.5rem; justify-content: center;">
                <button class="btn btn-sm btn-primary" data-action="referee-start" data-match-id="${match.id}">
                  🟢 選手抵達 (開賽)
                </button>
                <button class="btn btn-sm btn-danger" data-action="referee-default-prompt" data-match-id="${match.id}">
                  🏳️ 裁定棄賽
                </button>
              </div>
            </div>
          `;
        } else {
          // Match Live
          card.classList.add('occupied');
          const elapsed = Date.now() - (match.startedAt || match.calledAt);
          const hr = Math.floor(elapsed / 3600000);
          const min = Math.floor((elapsed % 3600000) / 60000);
          const sec = Math.floor((elapsed % 60000) / 1000);
          const elapsedStr = `${hr > 0 ? hr + ':' : ''}${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
          const scoreStr = formatScore(match.score);

          contentHtml = `
            <div class="match-details">
              <span class="badge badge-success">🎾 比賽進行中</span>
              <div class="players-versus mt-2">
                <div style="display: flex; flex-direction: column; align-items: center;">
                  <span>${p1Name}</span>
                  ${p1 && p1.hasPhotography ? '<span style="font-size: 0.7rem; color: #666; font-weight: 500; margin-top: 2px;">📸 需攝影</span>' : ''}
                </div>
                <span class="vs">VS</span>
                <div style="display: flex; flex-direction: column; align-items: center;">
                  <span>${p2Name}</span>
                  ${p2 && p2.hasPhotography ? '<span style="font-size: 0.7rem; color: #666; font-weight: 500; margin-top: 2px;">📸 需攝影</span>' : ''}
                </div>
              </div>
              <div class="match-event">${match.event}</div>
              <div class="live-score-badge mt-2">${scoreStr || '0 - 0'}</div>
              <div class="timer-container live-timer mt-1" style="font-size: 0.95rem;">
                <span>⏱️ 計時：</span><span>${elapsedStr}</span>
              </div>
              
              <div class="button-group mt-3" style="display: flex; gap: 0.5rem; justify-content: center;">
                <button class="btn btn-sm btn-accent" data-action="referee-score-prompt" data-match-id="${match.id}">
                  📝 登記比分
                </button>
                <button class="btn btn-sm btn-outline" data-action="referee-reset" data-match-id="${match.id}">
                  ⚠️ 中止
                </button>
              </div>
            </div>
          `;
        }
      }
    } else {
      contentHtml = `
        <div class="text-center text-secondary py-4">
          <span style="font-size: 2rem;">💤</span>
          <p class="mt-2 font-bold">空閒球場 (Available)</p>
          <span class="badge badge-info mt-1">等待指派</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="court-name">
        <span>🏟️ ${court.name}</span>
      </div>
      <div class="court-state">
        ${contentHtml}
      </div>
    `;
    grid.appendChild(card);
  });
}

// Render Setup Player Database Manager
export function renderSetupPlayers(state) {
  // Sync Events dropdown for manual match creation
  const eventSelect = document.getElementById('setup-match-event');
  if (eventSelect) {
    eventSelect.innerHTML = '';
    state.events.forEach(ev => {
      const opt = document.createElement('option');
      opt.value = ev;
      opt.text = ev;
      eventSelect.add(opt);
    });
  }

  // Sync Players dropdown for manual match creation
  const p1Select = document.getElementById('setup-match-p1');
  const p2Select = document.getElementById('setup-match-p2');
  if (p1Select && p2Select) {
    p1Select.innerHTML = '<option value="">-- 選擇選手 A --</option>';
    p2Select.innerHTML = '<option value="">-- 選擇選手 B --</option>';
    
    const sortedPlayers = [...state.players].sort((a,b) => a.name.localeCompare(b.name, 'zh-TW'));
    sortedPlayers.forEach(p => {
      const opt1 = document.createElement('option');
      opt1.value = p.id;
      opt1.text = p.name;
      p1Select.add(opt1);
      
      const opt2 = document.createElement('option');
      opt2.value = p.id;
      opt2.text = p.name;
      p2Select.add(opt2);
    });
  }

  document.getElementById('setup-players-count').innerText = state.players.length;
  const tbody = document.getElementById('setup-players-tbody');
  tbody.innerHTML = '';

  if (state.players.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">資料庫目前為空。請手動新增或匯入選手名單。</td></tr>`;
    document.getElementById('setup-events-list').value = state.events.join('\n');
    return;
  }

  // List all players
  state.players.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'setup-player-row';
    tr.innerHTML = `
      <td><strong>${p.name}</strong></td>
      <td>${p.utrName || '無'}</td>
      <td>${p.phone || '無'}</td>
      <td class="small">${p.events.join(', ') || '無'}</td>
      <td>${p.gift}</td>
      <td>${p.hasPhotography ? '📷 是' : '無'}</td>
      <td>${p.utr || '無'}</td>
      <td>
        <button class="btn btn-sm btn-outline" data-action="edit-player" data-id="${p.id}">修改</button>
        <button class="btn btn-sm btn-danger" data-action="delete-player" data-id="${p.id}">刪除</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Also sync inputs
  document.getElementById('setup-events-list').value = state.events.join('\n');
  
  // Re-apply search filter if there is one
  const searchInput = document.getElementById('setup-player-search');
  if (searchInput && searchInput.value) {
    window.filterSetupPlayers(searchInput.value);
  }
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

// HTML5 Canvas Certificate Renderer
export function drawCertificate(playerName, eventName, title, style, rankStr) {
  const canvas = document.getElementById('cert-canvas');
  const ctx = canvas.getContext('2d');
  
  const width = canvas.width;
  const height = canvas.height;

  // Clear Canvas
  ctx.clearRect(0, 0, width, height);

  if (style === 'classic') {
    // CLASSIC STYLE (Gold and Ivory)
    ctx.fillStyle = '#fffdf9';
    ctx.fillRect(0, 0, width, height);

    // Outer double border
    ctx.strokeStyle = '#c5a880';
    ctx.lineWidth = 6;
    ctx.strokeRect(15, 15, width - 30, height - 30);
    
    ctx.strokeStyle = '#c5a880';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(23, 23, width - 46, height - 46);

    // Decorative corners
    drawGoldCorner(ctx, 23, 23, 20);
    drawGoldCorner(ctx, width - 23, 23, 20);
    drawGoldCorner(ctx, 23, height - 23, 20);
    drawGoldCorner(ctx, width - 23, height - 23, 20);

    // Crest emoji / Graphic
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆', width / 2, 85);

    // Typography
    ctx.fillStyle = '#222';
    ctx.font = 'italic 20px Noto Sans TC, sans-serif';
    ctx.fillText('賽 事 榮 譽 證 書', width / 2, 135);

    ctx.font = '900 36px Outfit, Noto Sans TC, sans-serif';
    ctx.fillStyle = '#8f6f40';
    ctx.fillText(title, width / 2, 185);

    ctx.strokeStyle = '#c5a880';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 120, 210);
    ctx.lineTo(width / 2 + 120, 210);
    ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.font = '20px Noto Sans TC, sans-serif';
    ctx.fillText(`恭喜選手`, width / 2, 255);

    // Winner Name
    ctx.font = 'bold 36px Noto Sans TC, sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.fillText(playerName, width / 2, 315);

    ctx.fillStyle = '#444';
    ctx.font = '18px Noto Sans TC, sans-serif';
    ctx.fillText(`在本次大會中表現優異，榮獲`, width / 2, 365);
    
    ctx.font = 'bold 24px Noto Sans TC, sans-serif';
    ctx.fillStyle = '#b8860b';
    ctx.fillText(`【 ${eventName} 】 ${rankStr}`, width / 2, 410);

    ctx.fillStyle = '#666';
    ctx.font = '14px Noto Sans TC, sans-serif';
    ctx.fillText(`（ 亞軍選手：${runnerupName} ）`, width / 2, 450);

    // Signature/Date stamps
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(150, 500);
    ctx.lineTo(280, 500);
    ctx.moveTo(width - 280, 500);
    ctx.lineTo(width - 150, 500);
    ctx.stroke();

    ctx.fillStyle = '#888';
    ctx.font = '12px Noto Sans TC, sans-serif';
    ctx.fillText('大會裁判長 簽章', 215, 520);
    ctx.fillText('大會會長 簽章', width - 215, 520);

  } else if (style === 'modern') {
    // MODERN ATHLETIC STYLE (Neon and Dark Green)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Neon borders
    ctx.strokeStyle = '#c4f013';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    ctx.strokeStyle = 'rgba(196, 240, 19, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    // Background watermarks (tennis net mesh style)
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for (let i = 40; i < width - 40; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 40);
      ctx.lineTo(i, height - 40);
      ctx.stroke();
    }

    // Emoji/Header
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎾', width / 2, 85);

    ctx.fillStyle = '#c4f013';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.fillText('HONORARY CERTIFICATE', width / 2, 130);

    ctx.fillStyle = '#fff';
    ctx.font = '900 38px Outfit, Noto Sans TC, sans-serif';
    ctx.fillText(title, width / 2, 180);

    // Winner Box Background
    ctx.fillStyle = 'rgba(196, 240, 19, 0.08)';
    ctx.fillRect(100, 240, width - 200, 190);
    ctx.strokeStyle = '#c4f013';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(100, 240, width - 200, 190);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Noto Sans TC, sans-serif';
    ctx.fillText('CONGRATULATIONS TO', width / 2, 280);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Noto Sans TC, sans-serif';
    ctx.fillText(playerName, width / 2, 335);

    ctx.fillStyle = '#c4f013';
    ctx.font = 'bold 22px Noto Sans TC, sans-serif';
    ctx.fillText(`🏆 榮獲【 ${eventName} 】 ${rankStr}`, width / 2, 395);

    // Time stamp
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Outfit, sans-serif';
    ctx.fillText(`大會官方認證時間: ${new Date().toLocaleDateString('zh-TW')}`, width / 2, 515);

  } else {
    // MINIMALIST CLEAN STYLE (Monochrome / Slate)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = '300 20px Outfit, sans-serif';
    ctx.fillText('C E R T I F I C A T E', width / 2, 100);

    ctx.font = '900 28px Noto Sans TC, sans-serif';
    ctx.fillText(title, width / 2, 150);

    ctx.font = '300 16px Noto Sans TC, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('This certificate is proudly presented to', width / 2, 220);

    ctx.font = 'bold 38px Noto Sans TC, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(playerName, width / 2, 290);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width/2 - 150, 320);
    ctx.lineTo(width/2 + 150, 320);
    ctx.stroke();

    ctx.font = '16px Noto Sans TC, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(`for securing the ${rankStr} in`, width / 2, 360);

    ctx.font = 'bold 20px Noto Sans TC, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`【 ${eventName} 】`, width / 2, 400);

    // Decorative small text
    ctx.font = '10px Outfit, sans-serif';
    ctx.fillText('ACE TENNIS FEDERATION', width / 2, 510);
  }
}

// ==========================================
// COURT MAP BUILDER & VIEWER
// ==========================================

export function renderSetupCourtMapBuilder(state) {
  const container = document.getElementById('setup-court-map-grid');
  if (!container) return;

  container.innerHTML = '';
  const mapData = state.configs.courtMap || Array(25).fill(null);

  // Generate options for the select
  const courtOptionsHtml = state.courts.map(c => `<option value="${c.id}">🎾 ${c.name.split(' ')[0]}</option>`).join('');

  for (let i = 0; i < 25; i++) {
    const val = mapData[i] || '';
    const div = document.createElement('div');
    div.innerHTML = `
      <select class="form-control setup-court-map-select" style="text-align: center; height: 100%; min-height: 50px; font-size: 0.9rem;">
        <option value="">(空白)</option>
        <option value="desk" ${val === 'desk' ? 'selected' : ''}>🌟 大會 (Desk)</option>
        <option value="practice" ${val === 'practice' ? 'selected' : ''}>🎾 練習球場</option>
        ${state.courts.map(c => `<option value="${c.id}" ${val === c.id ? 'selected' : ''}>🎾 ${c.name.split(' ')[0]}</option>`).join('')}
      </select>
    `;
    container.appendChild(div);
  }
}

export function renderPlayerCourtMap(state) {
  const card = document.getElementById('player-court-map-card');
  const container = document.getElementById('player-court-map-grid');
  if (!card || !container) return;

  const mapData = state.configs.courtMap || Array(25).fill(null);

  // If map is completely empty, hide the card
  if (mapData.every(val => !val)) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  container.innerHTML = '';

  for (let i = 0; i < 25; i++) {
    const val = mapData[i];
    const cell = document.createElement('div');
    cell.style.minHeight = '70px';
    cell.style.borderRadius = '8px';
    cell.style.display = 'flex';
    cell.style.flexDirection = 'column';
    cell.style.alignItems = 'center';
    cell.style.justifyContent = 'center';
    cell.style.textAlign = 'center';
    cell.style.padding = '0.5rem';
    cell.style.border = '1px dashed transparent';
    cell.style.transition = 'all 0.3s ease';

    if (!val) {
      // Empty cell
      cell.style.border = '1px dashed rgba(255,255,255,0.05)';
    } else if (val === 'desk') {
      // Tournament Desk
      cell.style.backgroundColor = 'var(--accent)';
      cell.style.color = '#fff';
      cell.style.boxShadow = '0 0 10px rgba(0, 210, 255, 0.3)';
      cell.innerHTML = `
        <span style="font-size: 1.5rem; margin-bottom: 4px;">🌟</span>
        <strong style="font-size: 0.9rem;">大會服務台</strong>
      `;
    } else if (val === 'practice') {
      // Practice Court
      cell.style.backgroundColor = 'var(--bg-card)';
      cell.style.border = '1px dashed var(--text-secondary)';
      cell.style.color = 'var(--text-secondary)';
      cell.innerHTML = `
        <span style="font-size: 1.5rem; margin-bottom: 4px;">🎾</span>
        <strong style="font-size: 0.9rem;">練習球場</strong>
      `;
    } else {
      // Court
      const court = state.courts.find(c => c.id === val);
      if (court) {
        const isOccupied = court.status === 'occupied' || court.status === 'live';
        cell.style.backgroundColor = isOccupied ? 'var(--warning-bg)' : 'var(--bg-card)';
        cell.style.border = isOccupied ? '1px solid var(--warning)' : '1px solid var(--border)';
        
        const statusText = isOccupied ? '<span class="text-warning small" style="margin-top:4px;">● 比賽中</span>' : '<span class="text-success small" style="margin-top:4px;">○ 空閒</span>';

        cell.innerHTML = `
          <strong style="font-size: 0.95rem;">${court.name.split(' ')[0]}</strong>
          ${statusText}
        `;
      } else {
        // Obsolete court ID
        cell.style.border = '1px dashed rgba(255,255,255,0.05)';
      }
    }

    container.appendChild(cell);
  }
}

// Draw gold corner decorations helper
function drawGoldCorner(ctx, x, y, size) {
  ctx.strokeStyle = '#c5a880';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  // Left or right facing corner
  const factorX = x < 400 ? 1 : -1;
  const factorY = y < 300 ? 1 : -1;
  
  ctx.moveTo(x, y + size * factorY);
  ctx.lineTo(x, y);
  ctx.lineTo(x + size * factorX, y);
  ctx.stroke();
}


window.filterSetupPlayers = function(query) {
  const q = query.toLowerCase().trim();
  const rows = document.querySelectorAll('.setup-player-row');
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    if (text.includes(q)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
};
