/* ============================================================
   site.js — shared helpers for all pages
   ============================================================ */

import {
	autoMarkActiveTab,
	initAppSettings,
	startOrbBackgroundFromSettings,
} from "https://woahitsjeebus.github.io/JUIL/assets/site.js"

import { JFSC_NET } from "./config.js"

// ── App init ───────────────────────────────────────────
export function initPage(tabName) {
	initAppSettings()
	startOrbBackgroundFromSettings({ spawnEveryMs: 1600, sizeMin: 340, sizeMax: 720 })
	autoMarkActiveTab(tabName)
}

// ── Version badge ──────────────────────────────────────
export function loadVersionBadge(elementId = "versionCode") {
	fetch("./assets/versions.json", { cache: "no-store" })
		.then(r => r.ok ? r.json() : Promise.reject())
		.then(d => { document.getElementById(elementId).textContent = `v${d.current || "?"}` })
		.catch(() => { document.getElementById(elementId).textContent = "v?" })
}

function formatCount(value) {
	if (typeof value !== "number" || Number.isNaN(value)) return "--"
	return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function setText(id, value) {
	const el = document.getElementById(id)
	if (el) el.textContent = value
}

async function fetchJson(url, options = {}) {
	const response = await fetch(url, {
		mode: "cors",
		credentials: "include",
		cache: "no-store",
		...options,
	})
	if (!response.ok) {
		let message = `${response.status} ${response.statusText}`
		try {
			const body = await response.json()
			if (body?.errors?.[0]?.message) message = body.errors[0].message
		} catch {
			try {
				const bodyText = await response.text()
				if (bodyText) message = bodyText
			} catch {
				/* ignore */
			}
		}
		throw new Error(message)
	}
	return response.json()
}

async function fetchWithFallback(urls, options = {}) {
	let lastError = null
	for (const url of urls) {
		try {
			return await fetchJson(url, options)
		} catch (error) {
			lastError = error
		}
	}
	throw lastError || new Error("Request failed")
}

async function resolveRobloxUserId(query, signal) {
	const trimmed = query.trim()
	if (!trimmed) throw new Error("Enter a username or UserId.")
	if (/^\d+$/.test(trimmed)) return trimmed

	const payload = JSON.stringify({ usernames: [trimmed], excludeBannedUsers: false })
	const data = await fetchWithFallback([
		`${JFSC_NET.usersBase}/v1/usernames/users`,
		`${JFSC_NET.usersFallbackBase}/v1/usernames/users`,
	], {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: payload,
		signal,
	})

	const result = data?.data?.[0]
	if (!result?.id) throw new Error(`Could not find a Roblox user named ${trimmed}.`)
	return String(result.id)
}

async function fetchRobloxProfile(userId, signal) {
	return fetchWithFallback([
		`${JFSC_NET.usersBase}/v1/users/${userId}`,
		`${JFSC_NET.usersFallbackBase}/v1/users/${userId}`,
	], { signal })
}

async function fetchRobloxCount(userId, kind, signal) {
	const data = await fetchWithFallback([
		`${JFSC_NET.friendsBase}/v1/users/${userId}/${kind}/count`,
		`${JFSC_NET.friendsFallbackBase}/v1/users/${userId}/${kind}/count`,
	], { signal })
	return Number(data?.count ?? NaN)
}

async function fetchRobloxPage(userId, kind, signal) {
	return fetchWithFallback([
		`${JFSC_NET.friendsBase}/v1/users/${userId}/${kind}?limit=100&sortOrder=Asc&cursor=`,
		`${JFSC_NET.friendsFallbackBase}/v1/users/${userId}/${kind}?limit=100&sortOrder=Asc&cursor=`,
	], { signal })
}

async function fetchAvatars(userIds, signal) {
	if (!userIds.length) return new Map()
	try {
		const data = await fetchWithFallback([
			`${JFSC_NET.thumbnailsBase}/v1/users/avatar-headshot?userIds=${userIds.join(",")}&size=150x150&format=Png&isCircular=true`,
			`${JFSC_NET.thumbnailsFallbackBase}/v1/users/avatar-headshot?userIds=${userIds.join(",")}&size=150x150&format=Png&isCircular=true`,
		], { signal })
		const map = new Map()
		for (const item of data?.data || []) {
			if (item?.targetId && item?.imageUrl) map.set(String(item.targetId), item.imageUrl)
		}
		return map
	} catch {
		return new Map()
	}
}

function renderEmptyState(container, message) {
	container.innerHTML = ""
	const empty = document.createElement("div")
	empty.className = "emptyState"
	empty.textContent = message
	container.appendChild(empty)
}

async function renderUserCards(container, users, signal) {
	container.innerHTML = ""
	if (!users.length) {
		renderEmptyState(container, "No users were returned on this page.")
		return
	}

	const avatarMap = await fetchAvatars(users.map(user => String(user.id)), signal)
	const fragment = document.createDocumentFragment()

	for (const user of users) {
		const card = document.createElement("article")
		card.className = "userCard"

		const link = document.createElement("a")
		link.className = "userCardLink"
		link.href = `https://www.roblox.com/users/${user.id}/profile`
		link.target = "_blank"
		link.rel = "noreferrer"

		const avatarWrap = document.createElement("div")
		avatarWrap.className = "userAvatarWrap"
		const avatarUrl = avatarMap.get(String(user.id))
		if (avatarUrl) {
			const img = document.createElement("img")
			img.className = "userAvatar"
			img.src = avatarUrl
			img.alt = `${user.displayName || user.name} avatar`
			img.loading = "lazy"
			img.decoding = "async"
			avatarWrap.appendChild(img)
		} else {
			const fallback = document.createElement("div")
			fallback.className = "userAvatar fallback"
			fallback.textContent = (user.displayName || user.name || "?").slice(0, 1).toUpperCase()
			avatarWrap.appendChild(fallback)
		}

		const body = document.createElement("div")
		body.className = "userCardBody"

		const nameRow = document.createElement("div")
		nameRow.className = "userCardNameRow"

		const displayName = document.createElement("strong")
		displayName.className = "userDisplayName"
		displayName.textContent = user.displayName || user.name || "Unknown user"
		nameRow.appendChild(displayName)

		if (user.hasVerifiedBadge) {
			const badge = document.createElement("span")
			badge.className = "miniBadge"
			badge.textContent = "Verified"
			nameRow.appendChild(badge)
		}

		const username = document.createElement("span")
		username.className = "userHandle"
		username.textContent = `@${user.name || user.displayName || user.id}`

		const meta = document.createElement("span")
		meta.className = "userMeta"
		meta.textContent = `UserId ${user.id}`

		body.append(nameRow, username, meta)
		link.append(avatarWrap, body)
		card.appendChild(link)
		fragment.appendChild(card)
	}

	container.appendChild(fragment)
}

// ── Roblox explorer ───────────────────────────────────
export function initRobloxExplorer() {
	const form = document.getElementById("robloxLookupForm")
	const input = document.getElementById("robloxQuery")
	const button = document.getElementById("robloxLookupButton")
	const status = document.getElementById("lookupStatus")
	const profileSummary = document.getElementById("profileSummary")
	const profileAvatar = document.getElementById("profileAvatar")
	const profileDisplayName = document.getElementById("profileDisplayName")
	const profileUsername = document.getElementById("profileUsername")
	const profileId = document.getElementById("profileId")
	const profileVerified = document.getElementById("profileVerified")
	const followersCount = document.getElementById("followersCount")
	const followingCount = document.getElementById("followingCount")
	const followersLoadedCount = document.getElementById("followersLoadedCount")
	const followingLoadedCount = document.getElementById("followingLoadedCount")
	const followersGrid = document.getElementById("followersGrid")
	const followingGrid = document.getElementById("followingGrid")
	const followersPageMeta = document.getElementById("followersPageMeta")
	const followingPageMeta = document.getElementById("followingPageMeta")
	const pageNote = document.getElementById("pageNote")

	if (!form || !input || !button || !status || !profileSummary || !profileAvatar || !profileDisplayName || !profileUsername || !profileId || !profileVerified || !followersCount || !followingCount || !followersLoadedCount || !followingLoadedCount || !followersGrid || !followingGrid || !followersPageMeta || !followingPageMeta || !pageNote) return

	let activeLookup = 0
	let activeController = null

	function setBusy(busy) {
		button.disabled = busy
		input.disabled = busy
		button.textContent = busy ? "Searching…" : "Search"
	}

	function setStatus(message, kind = "info") {
		status.textContent = message
		status.dataset.kind = kind
	}

	function resetResults() {
		profileSummary.hidden = true
		profileAvatar.removeAttribute("src")
		profileAvatar.alt = ""
		profileDisplayName.textContent = ""
		profileUsername.textContent = ""
		profileId.textContent = ""
		profileVerified.hidden = true
		followersCount.textContent = "--"
		followingCount.textContent = "--"
		followersLoadedCount.textContent = "--"
		followingLoadedCount.textContent = "--"
		followersGrid.innerHTML = ""
		followingGrid.innerHTML = ""
		followersPageMeta.textContent = "Waiting for results"
		followingPageMeta.textContent = "Waiting for results"
	}

	async function loadLookup(rawQuery) {
		const lookupId = ++activeLookup
		if (activeController) activeController.abort()
		activeController = new AbortController()
		const { signal } = activeController

		resetResults()
		setBusy(true)
		setStatus(`Looking up ${rawQuery.trim()}…`)

		try {
			const userId = await resolveRobloxUserId(rawQuery, signal)
			if (lookupId !== activeLookup) return

			setStatus(`Resolved UserId ${userId}. Loading counts and current pages…`)

			const profilePromise = fetchRobloxProfile(userId, signal)
			const followerCountPromise = fetchRobloxCount(userId, "followers", signal)
			const followingCountPromise = fetchRobloxCount(userId, "followings", signal)
			const followersPromise = fetchRobloxPage(userId, "followers", signal)
			const followingPromise = fetchRobloxPage(userId, "followings", signal)

			const [profileResult, followerCountResult, followingCountResult, followersResult, followingResult] = await Promise.allSettled([
				profilePromise,
				followerCountPromise,
				followingCountPromise,
				followersPromise,
				followingPromise,
			])

			if (lookupId !== activeLookup) return

			const profile = profileResult.status === "fulfilled" ? profileResult.value : null
			const followerCount = followerCountResult.status === "fulfilled" ? followerCountResult.value : NaN
			const followingCountValue = followingCountResult.status === "fulfilled" ? followingCountResult.value : NaN
			const followersPage = followersResult.status === "fulfilled" ? followersResult.value : null
			const followingPage = followingResult.status === "fulfilled" ? followingResult.value : null

			profileSummary.hidden = false
			profileDisplayName.textContent = profile?.displayName || profile?.name || `User ${userId}`
			profileUsername.textContent = profile?.name ? `@${profile.name}` : `UserId ${userId}`
			profileId.textContent = `UserId ${userId}`
			profileVerified.hidden = !profile?.hasVerifiedBadge
			profileAvatar.alt = `${profile?.displayName || profile?.name || `User ${userId}`} avatar`
			profileAvatar.src = `${JFSC_NET.thumbnailsBase}/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`

			setText("followersCount", formatCount(followerCount))
			setText("followingCount", formatCount(followingCountValue))

			const followersUsers = followersPage?.data || []
			const followingUsers = followingPage?.data || []
			setText("followersLoadedCount", formatCount(followersUsers.length))
			setText("followingLoadedCount", formatCount(followingUsers.length))

			if (followersPage?.nextPageCursor || followersPage?.previousPageCursor) {
				followersPageMeta.textContent = `Loaded ${followersUsers.length} users from this page`
			} else if (followersUsers.length) {
				followersPageMeta.textContent = `Loaded ${followersUsers.length} users from a single page`
			}

			if (followingPage?.nextPageCursor || followingPage?.previousPageCursor) {
				followingPageMeta.textContent = `Loaded ${followingUsers.length} users from this page`
			} else if (followingUsers.length) {
				followingPageMeta.textContent = `Loaded ${followingUsers.length} users from a single page`
			}

			if (followersResult.status === "fulfilled") {
				await renderUserCards(followersGrid, followersUsers, signal)
			} else {
				renderEmptyState(followersGrid, followersResult.reason?.message || "Followers list could not be loaded.")
			}

			if (followingResult.status === "fulfilled") {
				await renderUserCards(followingGrid, followingUsers, signal)
			} else {
				renderEmptyState(followingGrid, followingResult.reason?.message || "Following list could not be loaded.")
			}

			const blockedLists = [followersResult, followingResult].some(result => result.status === "rejected")
			if (blockedLists) {
				setStatus(`Loaded totals for ${profile?.displayName || profile?.name || `User ${userId}`}. The follower/following list endpoints are blocked in this browser-only setup.`, "warn")
				pageNote.textContent = "The counts are public, but the list endpoints are not reliable from a static browser-only app. Use a server-side proxy or backend before relying on those pages."
			} else {
				setStatus(`Loaded ${followersUsers.length} followers and ${followingUsers.length} following for ${profile?.displayName || profile?.name || `User ${userId}`}.`, "success")
				pageNote.textContent = "Showing the current page returned by Roblox for both followers and following."
			}
		} catch (error) {
			if (lookupId !== activeLookup) return
			setStatus(error instanceof Error ? error.message : "Lookup failed.", "error")
			pageNote.textContent = "Try another username or numeric UserId. The counts are still public, but direct browser requests to the list endpoints are blocked unless you add a server-side proxy."
		}
		finally {
			if (lookupId === activeLookup) setBusy(false)
		}
	}

	form.addEventListener("submit", event => {
		event.preventDefault()
		loadLookup(input.value)
	})

	input.addEventListener("keydown", event => {
		if (event.key === "Escape") {
			input.value = ""
			setStatus("Cleared the search box.")
		}
	})

	input.value = "Roblox"
	loadLookup(input.value)
}

// ── Infinite grid drag logic ──────────────────────────
export function initGridDrag() {
	const surface   = document.getElementById("gridSurface")
	const glow      = document.getElementById("gridGlow")
	const origin    = document.getElementById("gridOrigin")
	const coordPill = document.getElementById("coordPill")
	const orbLayer  = document.querySelector(".bgOrbs")

	if (!surface) return

	const CELL = 60
	const MIN_ZOOM = 0.2, MAX_ZOOM = 5
	let offsetX = 0, offsetY = 0
	let zoom = 1
	let dragging = false
	let startX = 0, startY = 0
	let startOX = 0, startOY = 0
	let coordTimer = 0

	function applyTransform() {
		surface.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`
		if (orbLayer) orbLayer.style.transform = `translate(${offsetX}px, ${offsetY}px)`

		const cx = surface.offsetWidth  / 2
		const cy = surface.offsetHeight / 2
		if (glow)   { glow.style.left = `${cx}px`;   glow.style.top = `${cy}px` }
		if (origin) { origin.style.left = `${cx}px`; origin.style.top = `${cy}px` }
	}

	function showCoords() {
		if (!coordPill) return
		const gx = Math.round(-offsetX / (CELL * zoom))
		const gy = Math.round(-offsetY / (CELL * zoom))
		coordPill.textContent = `${gx}, ${gy}`
		coordPill.classList.add("visible")
		clearTimeout(coordTimer)
		coordTimer = setTimeout(() => coordPill.classList.remove("visible"), 1200)
	}

	function zoomAt(screenX, screenY, newZoom) {
		newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom))
		const vpCX = window.innerWidth / 2
		const vpCY = window.innerHeight / 2
		const wx = (screenX - vpCX - offsetX) / zoom
		const wy = (screenY - vpCY - offsetY) / zoom
		offsetX = screenX - wx * newZoom - vpCX
		offsetY = screenY - wy * newZoom - vpCY
		zoom = newZoom
		applyTransform()
		showCoords()
	}

	function isInteractive(el) {
		return el && el.closest(".tabBtn, .versionBadge, a, button, input, select, textarea, #monthSelector, #legend, .robloxApp")
	}

	// Pointer events
	document.addEventListener("pointerdown", e => {
		if (e.button !== 0) return
		if (isInteractive(e.target)) return
		e.preventDefault()
		dragging = true
		startX = e.clientX; startY = e.clientY
		startOX = offsetX;  startOY = offsetY
		document.body.classList.add("dragging")
	})

	document.addEventListener("pointermove", e => {
		if (!dragging) return
		offsetX = startOX + (e.clientX - startX)
		offsetY = startOY + (e.clientY - startY)
		applyTransform()
		showCoords()
	})

	document.addEventListener("pointerup", () => {
		if (!dragging) return
		dragging = false
		document.body.classList.remove("dragging")
	})

	// Wheel zoom
	document.addEventListener("wheel", e => {
		if (isInteractive(e.target)) return
		e.preventDefault()
		const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
		zoomAt(e.clientX, e.clientY, zoom * factor)
	}, { passive: false })

	// Touch events (single-finger drag + two-finger pinch zoom)
	let touchId = null
	let pinching = false
	let pinchStartDist = 0, pinchStartZoom = 1
	let pinchStartOX = 0, pinchStartOY = 0
	let pinchStartMidX = 0, pinchStartMidY = 0

	document.addEventListener("touchstart", e => {
		if (isInteractive(e.target)) return

		if (e.touches.length === 2) {
			if (dragging) { dragging = false; touchId = null; document.body.classList.remove("dragging") }
			pinching = true
			const [t1, t2] = e.touches
			pinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
			pinchStartZoom = zoom
			pinchStartMidX = (t1.clientX + t2.clientX) / 2
			pinchStartMidY = (t1.clientY + t2.clientY) / 2
			pinchStartOX = offsetX
			pinchStartOY = offsetY
			e.preventDefault()
			return
		}

		if (touchId !== null) return
		const t = e.changedTouches[0]
		touchId = t.identifier
		startX = t.clientX; startY = t.clientY
		startOX = offsetX;  startOY = offsetY
		dragging = true
		document.body.classList.add("dragging")
	}, { passive: false })

	document.addEventListener("touchmove", e => {
		if (pinching && e.touches.length === 2) {
			e.preventDefault()
			const [t1, t2] = e.touches
			const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
			const midX = (t1.clientX + t2.clientX) / 2
			const midY = (t1.clientY + t2.clientY) / 2
			const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartZoom * (dist / pinchStartDist)))
			const vpCX = window.innerWidth / 2
			const vpCY = window.innerHeight / 2
			const wx = (pinchStartMidX - vpCX - pinchStartOX) / pinchStartZoom
			const wy = (pinchStartMidY - vpCY - pinchStartOY) / pinchStartZoom
			offsetX = midX - wx * newZoom - vpCX
			offsetY = midY - wy * newZoom - vpCY
			zoom = newZoom
			applyTransform()
			showCoords()
			return
		}

		if (!dragging) return
		for (const t of e.changedTouches) {
			if (t.identifier !== touchId) continue
			e.preventDefault()
			offsetX = startOX + (t.clientX - startX)
			offsetY = startOY + (t.clientY - startY)
			applyTransform()
			showCoords()
		}
	}, { passive: false })

	document.addEventListener("touchend", e => {
		if (pinching) {
			if (e.touches.length < 2) {
				pinching = false
				if (e.touches.length === 1) {
					const t = e.touches[0]
					touchId = t.identifier
					startX = t.clientX; startY = t.clientY
					startOX = offsetX; startOY = offsetY
					dragging = true
					document.body.classList.add("dragging")
				}
			}
			return
		}

		for (const t of e.changedTouches) {
			if (t.identifier !== touchId) continue
			dragging = false
			touchId = null
			document.body.classList.remove("dragging")
		}
	})

	applyTransform()

	// ── Cursor-proximity grid glow ────────────────────
	const cursorGlow = document.getElementById("gridCursorGlow")
	let glowCells = 3  // configurable: number of cells radius

	function updateGlowRadius() {
		if (!cursorGlow) return
		const d = glowCells * CELL * 2
		cursorGlow.style.setProperty("--glow-diameter", `${d}px`)
	}
	updateGlowRadius()

	if (cursorGlow) {
		let glowTimer = 0

		function showGlow(sx, sy) {
			const r = glowCells * CELL
			cursorGlow.style.webkitMaskPosition = `${sx - r}px ${sy - r}px`
			cursorGlow.style.maskPosition = `${sx - r}px ${sy - r}px`
			cursorGlow.style.opacity = "1"
			clearTimeout(glowTimer)
			glowTimer = setTimeout(() => { cursorGlow.style.opacity = "0" }, 1000)
		}

		// Mouse — show glow, ignore touch-sourced pointer events
		document.addEventListener("pointermove", e => {
			if (e.pointerType === "touch") return
			const rect = surface.getBoundingClientRect()
			showGlow((e.clientX - rect.left) / zoom, (e.clientY - rect.top) / zoom)
		})

		document.addEventListener("pointerleave", e => {
			if (e.pointerType === "touch") return
			clearTimeout(glowTimer)
			cursorGlow.style.opacity = "0"
		})

		// Touch — show glow at finger position; 1s auto-fade handles iOS stale input
		document.addEventListener("touchstart", e => {
			if (e.touches.length > 1) return
			const t = e.changedTouches[0]
			const rect = surface.getBoundingClientRect()
			showGlow((t.clientX - rect.left) / zoom, (t.clientY - rect.top) / zoom)
		}, { passive: true })
		document.addEventListener("touchmove", e => {
			if (e.touches.length > 1) return
			const t = e.changedTouches[0]
			const rect = surface.getBoundingClientRect()
			showGlow((t.clientX - rect.left) / zoom, (t.clientY - rect.top) / zoom)
		}, { passive: true })
		document.addEventListener("touchend", () => {
			clearTimeout(glowTimer)
			cursorGlow.style.opacity = "0"
		}, { passive: true })
	}

	return {
		getOffset: () => ({ x: offsetX, y: offsetY }),
		surface, CELL,
		setGlowCells(n) { glowCells = n; updateGlowRadius() },
		getGlowCells() { return glowCells },
		getZoom() { return zoom },
	}
}