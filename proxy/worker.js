const ROBLOX_BASE = "https://friends.roblox.com"
const ROPROXY_BASE = "https://friends.roproxy.com"
const USERS_BASE = "https://users.roblox.com"
const USERS_ROPROXY_BASE = "https://users.roproxy.com"
const THUMBNAILS_BASE = "https://thumbnails.roblox.com"
const THUMBNAILS_ROPROXY_BASE = "https://thumbnails.roproxy.com"

function corsHeaders() {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
		"Access-Control-Max-Age": "86400",
	}
}

function jsonResponse(body, init = {}) {
	return new Response(JSON.stringify(body), {
		status: init.status || 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...corsHeaders(),
			...(init.headers || {}),
		},
	})
}

async function forward(request, targetUrl) {
	const headers = new Headers(request.headers)
	headers.delete("origin")
	headers.delete("referer")
	headers.delete("host")
	headers.delete("content-length")

	const init = {
		method: request.method,
		headers,
		redirect: "follow",
	}

	if (request.method !== "GET" && request.method !== "HEAD") {
		init.body = await request.arrayBuffer()
	}

	const response = await fetch(targetUrl, init)
	const responseHeaders = new Headers(response.headers)
	for (const [key, value] of Object.entries(corsHeaders())) responseHeaders.set(key, value)
	responseHeaders.delete("content-encoding")
	responseHeaders.delete("content-length")
	responseHeaders.delete("transfer-encoding")
	return new Response(response.body, {
		status: response.status,
		headers: responseHeaders,
	})
}

function chooseBase(pathname) {
	if (pathname.startsWith("/api/roblox/v1/usernames/users")) return [USERS_BASE, USERS_ROPROXY_BASE, "/v1/usernames/users"]
	if (pathname.startsWith("/api/roblox/v1/users/") && pathname.includes("/avatar-headshot")) return [THUMBNAILS_BASE, THUMBNAILS_ROPROXY_BASE, pathname.replace("/api/roblox", "")]
	if (pathname.startsWith("/api/roblox/v1/users/")) return [ROBLOX_BASE, ROPROXY_BASE, pathname.replace("/api/roblox", "")]
	return null
}

export default {
	async fetch(request) {
		if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() })

		const url = new URL(request.url)
		const route = chooseBase(url.pathname)
		if (!route) return jsonResponse({ error: "Not found" }, { status: 404 })

		const [primaryBase, fallbackBase, path] = route
		const targetUrls = [primaryBase, fallbackBase].filter(Boolean).map(base => `${base}${path}${url.search}`)
		let lastError = null
		for (const targetUrl of targetUrls) {
			try {
				return await forward(request, targetUrl)
			} catch (error) {
				lastError = error
			}
		}

		return jsonResponse({ error: lastError?.message || "Upstream request failed" }, { status: 502 })
	},
}