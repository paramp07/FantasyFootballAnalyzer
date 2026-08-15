const DEFAULTS = { appUrl: 'http://localhost:5173' }

chrome.storage.sync.get(DEFAULTS).then((v) => {
  const el = document.getElementById('appUrl')
  if (el) el.value = v.appUrl || DEFAULTS.appUrl
})

const saveBtn = document.getElementById('save')
if (saveBtn) {
  saveBtn.addEventListener('click', async () => {
    const input = document.getElementById('appUrl')
    const val = input ? input.value.trim() : ''
    await chrome.storage.sync.set({
      appUrl: val || DEFAULTS.appUrl,
    })
    const tick = document.getElementById('saved')
    if (tick) {
      tick.hidden = false
      setTimeout(() => (tick.hidden = true), 1500)
    }
  })
}
