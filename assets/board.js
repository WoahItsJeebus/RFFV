/* ============================================================
   board.js — entries, sections & localStorage persistence
   ============================================================ */

const STORAGE_KEY = "jtdm-board-items"

const SECTION_COLORS = [
	"rgba(0,255,255,0.12)",
	"rgba(120,90,255,0.14)",
	"rgba(255,180,0,0.12)",
	"rgba(255,60,80,0.12)",
	"rgba(0,200,120,0.12)",
	"rgba(255,100,200,0.12)",
	"rgba(80,160,255,0.12)",
]

// ── Persistence helpers ────────────────────────────────
function loadItems() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		return raw ? JSON.parse(raw) : []
	} catch { return [] }
}

function saveItems(items) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

let _items = []
let _nextId = 1
let _grid = null

function persist() { saveItems(_items) }

// ── Coordinate helper: viewport center → surface-local ─
function viewportCenterOnSurface(surface) {
	const z = _grid ? _grid.getZoom() : 1
	const rect = surface.getBoundingClientRect()
	return {
		x: ((window.innerWidth  / 2) - rect.left) / z,
		y: ((window.innerHeight / 2) - rect.top) / z,
	}
}

// ── DOM builders ───────────────────────────────────────
function createEntryEl(item, surface) {
	const el = document.createElement("div")
	el.className = "board-entry"
	el.dataset.id = item.id
	el.style.left = `${item.x}px`
	el.style.top  = `${item.y}px`

	el.innerHTML =
		`<button class="board-delete" title="Delete">&times;</button>` +
		`<input class="entry-title" value="" placeholder="Title" spellcheck="false">` +
		`<textarea class="entry-text" placeholder="Notes..." spellcheck="false"></textarea>`

	el.querySelector(".entry-title").value = item.title
	el.querySelector(".entry-text").value  = item.text

	el.querySelector(".entry-title").addEventListener("input", e => {
		item.title = e.target.value; persist()
	})
	el.querySelector(".entry-text").addEventListener("input", e => {
		item.text = e.target.value; persist()
	})

	el.querySelector(".board-delete").addEventListener("click", () => {
		_items = _items.filter(i => i.id !== item.id)
		el.remove()
		persist()
	})

	makeDraggable(el, item)
	surface.appendChild(el)
	return el
}

function createSectionEl(item, surface) {
	const el = document.createElement("div")
	el.className = "board-section"
	el.dataset.id = item.id
	el.style.left   = `${item.x}px`
	el.style.top    = `${item.y}px`
	el.style.width  = `${item.w}px`
	el.style.height = `${item.h}px`
	el.style.background = item.color

	el.innerHTML =
		`<div class="section-glow"></div>` +
		`<button class="board-delete" title="Delete">&times;</button>` +
		`<button class="board-color" title="Change color">&#9673;</button>` +
		`<input class="section-title" value="" placeholder="Section title" spellcheck="false">` +
		`<div class="resize-handle resize-t"></div>` +
		`<div class="resize-handle resize-r"></div>` +
		`<div class="resize-handle resize-b"></div>` +
		`<div class="resize-handle resize-l"></div>` +
		`<div class="resize-handle resize-tl"></div>` +
		`<div class="resize-handle resize-tr"></div>` +
		`<div class="resize-handle resize-bl"></div>` +
		`<div class="resize-handle resize-br"></div>`

	el.querySelector(".section-title").value = item.title

	el.querySelector(".section-title").addEventListener("input", e => {
		item.title = e.target.value; persist()
	})

	el.querySelector(".board-delete").addEventListener("click", () => {
		_items = _items.filter(i => i.id !== item.id)
		el.remove()
		persist()
	})

	// Color cycling
	el.querySelector(".board-color").addEventListener("click", e => {
		e.stopPropagation()
		const idx = SECTION_COLORS.indexOf(item.color)
		item.color = SECTION_COLORS[(idx + 1) % SECTION_COLORS.length]
		el.style.background = item.color
		persist()
	})

	// Cursor-proximity glow on section border
	const glowEl = el.querySelector(".section-glow")
	el.addEventListener("pointermove", e => {
		const z = _grid ? _grid.getZoom() : 1
		const rect = el.getBoundingClientRect()
		const mx = (e.clientX - rect.left) / z - 40
		const my = (e.clientY - rect.top) / z - 40
		glowEl.style.webkitMaskPosition = `${mx}px ${my}px`
		glowEl.style.maskPosition = `${mx}px ${my}px`
		glowEl.style.opacity = "1"
	})
	el.addEventListener("pointerleave", () => {
		glowEl.style.opacity = "0"
	})

	makeDraggable(el, item)
	makeResizable(el, item)
	surface.appendChild(el)
	return el
}

// ── Helpers: find entries inside a section ─────────────
function getAttachedEntries(sectionItem) {
	// Returns { item, el } pairs for every entry fully within the section bounds
	const sx = sectionItem.x, sy = sectionItem.y
	const sw = sectionItem.w, sh = sectionItem.h
	const results = []
	for (const entry of _items) {
		if (entry.type !== "entry") continue
		const el = document.querySelector(`.board-entry[data-id="${entry.id}"]`)
		if (!el) continue
		const ew = el.offsetWidth, eh = el.offsetHeight
		if (entry.x >= sx && entry.y >= sy &&
			entry.x + ew <= sx + sw && entry.y + eh <= sy + sh) {
			results.push({ item: entry, el })
		}
	}
	return results
}

// ── Item dragging (on grid surface) ────────────────────
function makeDraggable(el, item) {
	let dragging = false
	let startX, startY, origLeft, origTop
	let attached = [] // entries riding along with a section drag

	function isNonDrag(target) {
		return target.closest("input, textarea, .board-delete, .board-color, .resize-handle")
	}

	el.addEventListener("pointerdown", e => {
		if (e.button !== 0 || isNonDrag(e.target)) return
		e.preventDefault()
		e.stopPropagation()
		dragging = true
		el.classList.add("dragging")
		el.setPointerCapture(e.pointerId)
		startX = e.clientX; startY = e.clientY
		origLeft = item.x; origTop = item.y

		// If this is a section, snapshot attached entries
		attached = []
		if (item.type === "section") {
			for (const a of getAttachedEntries(item)) {
				attached.push({ item: a.item, el: a.el, origX: a.item.x, origY: a.item.y })
			}
		}
	})

	el.addEventListener("pointermove", e => {
		if (!dragging) return
		const z = _grid ? _grid.getZoom() : 1
		const dx = (e.clientX - startX) / z
		const dy = (e.clientY - startY) / z
		item.x = origLeft + dx
		item.y = origTop  + dy
		el.style.left = `${item.x}px`
		el.style.top  = `${item.y}px`

		// Move attached entries in lockstep
		for (const a of attached) {
			a.item.x = a.origX + dx
			a.item.y = a.origY + dy
			a.el.style.left = `${a.item.x}px`
			a.el.style.top  = `${a.item.y}px`
		}
	})

	el.addEventListener("pointerup", e => {
		if (!dragging) return
		dragging = false
		el.classList.remove("dragging")
		el.releasePointerCapture(e.pointerId)
		attached = []
		persist()
	})
}

// ── Section resizing ─────────────────────────────────────
function makeResizable(el, item) {
	const MIN_W = 160, MIN_H = 80

	el.querySelectorAll(".resize-handle").forEach(handle => {
		const cls = handle.className
		const isLeft   = cls.includes("resize-l") || cls.includes("resize-tl") || cls.includes("resize-bl")
		const isRight  = cls.includes("resize-r") || cls.includes("resize-tr") || cls.includes("resize-br")
		const isTop    = cls.includes("resize-t") && !cls.includes("resize-tr") && !cls.includes("resize-tl") || cls.includes("resize-tl") || cls.includes("resize-tr")
		const isBottom = cls.includes("resize-b") && !cls.includes("resize-br") && !cls.includes("resize-bl") || cls.includes("resize-bl") || cls.includes("resize-br")

		let active = false
		let startX, startY, origW, origH, origX, origY

		handle.addEventListener("pointerdown", e => {
			e.preventDefault()
			e.stopPropagation()
			active = true
			handle.setPointerCapture(e.pointerId)
			startX = e.clientX; startY = e.clientY
			origW = item.w; origH = item.h
			origX = item.x; origY = item.y
		})

		handle.addEventListener("pointermove", e => {
			if (!active) return
			const z = _grid ? _grid.getZoom() : 1
			const dx = (e.clientX - startX) / z
			const dy = (e.clientY - startY) / z

			if (isRight) {
				item.w = Math.max(MIN_W, origW + dx)
				el.style.width = `${item.w}px`
			}
			if (isBottom) {
				item.h = Math.max(MIN_H, origH + dy)
				el.style.height = `${item.h}px`
			}
			if (isLeft) {
				const newW = origW - dx
				if (newW >= MIN_W) {
					item.w = newW; item.x = origX + dx
					el.style.width = `${item.w}px`; el.style.left = `${item.x}px`
				}
			}
			if (isTop) {
				const newH = origH - dy
				if (newH >= MIN_H) {
					item.h = newH; item.y = origY + dy
					el.style.height = `${item.h}px`; el.style.top = `${item.y}px`
				}
			}
		})

		handle.addEventListener("pointerup", e => {
			if (!active) return
			active = false
			handle.releasePointerCapture(e.pointerId)
			persist()
		})
	})
}

// ── Public init ────────────────────────────────────────
export function initBoard(grid) {
	_grid = grid
	const surface = grid.surface
	const addBtn  = document.getElementById("addBtn")
	const wrap    = document.getElementById("addBtnWrap")

	// Toggle dropdown
	addBtn.addEventListener("click", e => {
		e.stopPropagation()
		wrap.classList.toggle("open")
	})

	// Close dropdown on outside click
	document.addEventListener("pointerdown", e => {
		if (!wrap.contains(e.target)) wrap.classList.remove("open")
	})

	// Dropdown actions
	const dropdown = document.getElementById("addDropdown")
	dropdown.addEventListener("click", e => {
		const action = e.target.dataset.action
		if (!action) return
		e.stopPropagation()
		wrap.classList.remove("open")

		// Place new item at the current grid center (viewport center → surface coords)
		const pos = viewportCenterOnSurface(surface)

		const item = {
			id: _nextId++,
			type: action,
			x: Math.round(pos.x),
			y: Math.round(pos.y),
			title: "",
		}

		if (action === "entry") {
			item.text = ""
			_items.push(item)
			persist()
			createEntryEl(item, surface)
		} else if (action === "section") {
			item.w = 300
			item.h = 180
			item.color = SECTION_COLORS[0]
			_items.push(item)
			persist()
			createSectionEl(item, surface)
		}
	})

	// ── Restore saved items ────────────────────────────
	_items = loadItems()
	if (_items.length) _nextId = Math.max(..._items.map(i => i.id)) + 1

	// Sections first (lower z), then entries on top
	_items.filter(i => i.type === "section").forEach(i => createSectionEl(i, surface))
	_items.filter(i => i.type === "entry").forEach(i   => createEntryEl(i, surface))
}
