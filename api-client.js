// api-client.js - WebSocket and HTTP API wrapper

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = window.location.host;
const WS_URL = `${protocol}//${host}/ws`;
const API_URL = `/api/state`;

let ws;
let onValueCallback = null;

function connectWebSocket() {
  ws = new WebSocket(WS_URL);
  
  ws.onopen = () => {
    console.log("WebSocket connected.");
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'state_update') {
      if (onValueCallback) {
        // Mock Firebase snapshot structure
        onValueCallback({ val: () => msg.data });
      }
    }
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected. Reconnecting in 2s...");
    setTimeout(connectWebSocket, 2000);
  };
}

connectWebSocket();

export function onValue(refObj, callback) {
  onValueCallback = callback;
}

export function set(refObj, state) {
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  }).catch(err => console.error("Error setting state:", err));
}

export function ref(dbObj, path) {
  return path;
}

export const db = {};
