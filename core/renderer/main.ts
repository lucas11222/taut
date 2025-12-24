// Taut Renderer Entrypoint
// Bundled and injected into the renderer process by the main process

window.addEventListener('load', async () => {
  const { initialize } = await import('./client')
  console.log('[Taut] Initializing renderer process...')
  initialize()
})
