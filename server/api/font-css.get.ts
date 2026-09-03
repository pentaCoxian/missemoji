/**
 * Same-origin proxy for the Google Fonts CSS2 stylesheet.
 *
 * `fonts.googleapis.com/css2` does NOT send CORS headers, so the browser cannot
 * `fetch()` it directly (only use it via <link>). But for canvas we need the
 * parsed @font-face src URLs to construct FontFace objects. Fetching the CSS
 * server-side (no CORS) and returning it same-origin solves this cleanly. The
 * actual font files on fonts.gstatic.com ARE CORS-enabled, so the client can
 * load them into FontFace for canvas.
 *
 * Query: ?url=<encoded google css2 url>  (validated to the css2 endpoint only)
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const url = typeof q.url === 'string' ? q.url : ''

  if (!url.startsWith('https://fonts.googleapis.com/css2')) {
    throw createError({ statusCode: 400, statusMessage: 'invalid font url' })
  }

  // Present a modern desktop UA so Google returns woff2 @font-face rules.
  const css = await $fetch<string>(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
    responseType: 'text',
  })

  setHeader(event, 'content-type', 'text/css; charset=utf-8')
  // Cache aggressively — font CSS for a (family, weights) is stable.
  setHeader(event, 'cache-control', 'public, max-age=86400')
  return css
})
