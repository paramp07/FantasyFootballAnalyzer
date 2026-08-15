const DEFAULTS = { appUrl: 'http://localhost:5173' }

const set = (id, text, cls) => {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = text
  el.className = 'v' + (cls ? ' ' + cls : '')
}

function relay(method, path, body) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ kind: 'relay', method, path, body }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, status: 0, error: chrome.runtime.lastError.message })
        } else {
          resolve(res || { ok: false, status: 0 })
        }
      })
    } catch (e) {
      resolve({ ok: false, status: 0, error: e.message })
    }
  })
}

function getWSStatus() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ kind: 'ws-status' }, (res) => {
        if (chrome.runtime.lastError || !res) {
          resolve(false)
        } else {
          resolve(!!res.connected)
        }
      })
    } catch {
      resolve(false)
    }
  })
}

const isDraftRoom = (url) =>
  !!url &&
  (url.includes('fantasy.espn.com/football/draft') ||
    url.includes('fantasy.espn.com/football/mock') ||
    url.includes('football.fantasysports.yahoo.com/draftclient/'))

async function refresh() {
  const cfg = await chrome.storage.sync.get(DEFAULTS).catch(() => DEFAULTS)
  
  const wsOk = await getWSStatus()
  set('ws', wsOk ? 'CONNECTED' : 'DISCONNECTED', wsOk ? 'ok' : 'bad')

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const inRoom = isDraftRoom(tab?.url)
  set('room', inRoom ? 'detected' : 'not open', inRoom ? 'ok' : 'warn')

  const r = await relay('GET', '/api/espn/draft/active')
  if (r.ok && r.data) {
    set('picks', String(r.data.picks ?? 0), (r.data.picks ?? 0) > 0 ? 'ok' : 'warn')
  } else if (r.status === 404) {
    set('picks', '0', 'warn')
  } else {
    set('picks', '—', 'bad')
  }

  const link = document.getElementById('warroom')
  if (link) {
    const baseUrl = (cfg.appUrl || DEFAULTS.appUrl).replace(/\/$/, '')
    link.href = baseUrl.includes('/draft-room') ? baseUrl : `${baseUrl}/draft-room`
  }
}

refresh()
setInterval(refresh, 2000)
