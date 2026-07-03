# Roblox Friends Explorer

A small static site for looking up a Roblox username or UserId, showing the public follower/following counts, and rendering the current page of follower/following cards returned by Roblox.

## Features

- Username or UserId lookup with a single input box.
- Public follower and following counts for the resolved profile.
- Profile summary with avatar, display name, username, and UserId.
- Card grids for the current loaded page of followers and following.
- The existing draggable/zoomable grid background is still available behind the app.

## How It Works

The app resolves usernames through Roblox’s public username lookup endpoint, then fetches the profile and friends data from Roblox’s friends API.

The counts come from the public count endpoints:

- `/v1/users/{userId}/followers/count`
- `/v1/users/{userId}/followings/count`

The list pages use the paginated endpoints:

- `/v1/users/{userId}/followers?limit=100&sortOrder=Asc&cursor=`
- `/v1/users/{userId}/followings?limit=100&sortOrder=Asc&cursor=`

## Important Note

Roblox currently allows the count endpoints to load publicly, but the followers and followings list requests are blocked from a plain browser-only static site. If you want the lists to work reliably, add a backend or proxy that talks to Roblox server-side.

The front end only calls the same-origin proxy route at `/api/roblox/...`. If that route is not deployed, the page will show a proxy-missing error instead of falling back to cross-origin Roblox requests.

## Proxy Option

This repo includes a small deployable edge proxy in [proxy/worker.js](proxy/worker.js). It is meant to be hosted on the same origin as the site so the browser can call `/api/roblox/...` without CORS issues.

The proxy tries Roblox first and then roproxy as a fallback upstream.

To use it, deploy the worker and the static site together, or mount the worker under the same domain with a route like `/api/roblox/*`.

## Policy Pages

- Privacy Policy: `/pages/privacy/`
- Terms of Service: `/pages/terms/`

## Local Setup

1. Open `index.html` in a browser, or serve the folder with any static file server.
2. Enter a Roblox username or numeric UserId.
3. Review the totals and the loaded follower/following cards.

Example values to try:

- `Roblox`
- `1`

## Project Structure

- `index.html` - main lookup page.
- `assets/site.js` - shared helpers and Roblox lookup logic.
- `assets/site.css` - local page styling.
- `assets/config.js` - Roblox endpoint base URLs.
- `pages/about/` - about page.

## Credits

Built on top of the existing draggable grid template and JUIL shared assets.