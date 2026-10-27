// Name: Camera Source
// ID: kubohiroyacamerasource
// Description: Share one MediaDevices camera stream between TurboWarp extensions.
// By: Hiroya Kubo
// License: MPL-2.0
// Unsandboxed: required
// Description[ja]: 1つのカメラ映像を複数のTurboWarp機能拡張で共有します。

(function (Scratch) {
  'use strict';

var extensionConfig = {
	id: "kubohiroyacamerasource",
	slug: "camera-source",
	name: "Camera Source",
	description: "Share one MediaDevices camera stream between TurboWarp extensions.",
	author: "Hiroya Kubo",
	license: "MPL-2.0",
	unsandboxed: true,
	blockIconURI: `data:image/svg+xml,${encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\"><circle cx=\"17\" cy=\"24\" r=\"9\" fill=\"none\" stroke=\"#4C97FF\" stroke-width=\"3\"/><circle cx=\"17\" cy=\"24\" r=\"3.4\" fill=\"#4C97FF\"/><path d=\"M30 24h10M29 17l9-5M29 31l9 5\" fill=\"none\" stroke=\"#59C059\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>stroke-width=\"5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 20h24a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4Z\"/><path d=\"m40 29 14-9v24l-14-9\"/></g></svg>")}`
};
var registry = Symbol.for("@kubohiroya/turbowarp-app-shell/runtime-controls-dock/v1");
var edges = [
	"top",
	"bottom",
	"left",
	"right"
];
/** App-neutral, optional controls for standalone players that have no Editor toolbar. */
function createRuntimeControlsDock(options) {
	const { document } = options;
	const view = document.defaultView;
	const labels = /^ja(?:-|$)/iu.test(options.locale || document.documentElement.lang || view?.navigator.language || "") ? {
		tools: "ツール",
		settings: "Dockの設定",
		settingsButton: "設定",
		edge: "表示位置",
		autoHide: "自動的に隠す",
		close: "閉じる",
		top: "上",
		bottom: "下",
		left: "左",
		right: "右"
	} : {
		tools: "Tools",
		settings: "Dock settings",
		settingsButton: "Settings",
		edge: "Position",
		autoHide: "Automatically hide",
		close: "Close",
		top: "Top",
		bottom: "Bottom",
		left: "Left",
		right: "Right"
	};
	const storageKey = options.storageKey || "turbowarp.runtime-controls-dock.v1";
	let edge = "bottom";
	let autoHide = true;
	try {
		const stored = JSON.parse(view?.localStorage.getItem(storageKey) || "null");
		if (stored && edges.includes(stored.edge)) edge = stored.edge;
		if (typeof stored?.autoHide === "boolean") autoHide = stored.autoHide;
	} catch {}
	const root = document.createElement("div");
	root.setAttribute("data-runtime-controls-dock", "true");
	const style = document.createElement("style");
	style.textContent = `[data-runtime-controls-dock] {position:fixed;z-index:2147483000;display:flex;align-items:center;gap:4px;font:14px/1.4 sans-serif;color:#25354a;max-width:100vw;max-height:100vh}
[data-runtime-controls-dock][hidden], [data-runtime-controls-dock] [hidden] {display:none!important}
[data-runtime-controls-dock] button, [data-runtime-controls-dock] select {font:inherit;color:inherit;cursor:pointer}
[data-runtime-controls-dock] button:focus-visible, [data-runtime-controls-dock] select:focus-visible {outline:3px solid #2864bd;outline-offset:2px}
[data-runtime-dock-bar] {display:flex;gap:6px;padding:8px;border:1px solid #9aa8b8;border-radius:14px;background:#f5f8fceF;box-shadow:0 3px 16px #0003;backdrop-filter:blur(16px);overflow:auto;max-width:calc(100vw - 16px);max-height:calc(100vh - 48px)}
[data-runtime-dock-bar] button {min-width:48px;min-height:48px;padding:0 4px;border:1px solid transparent;border-radius:8px;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:12px}
[data-runtime-dock-bar] button:hover {background:#dae5f4}
[data-runtime-dock-bar] button[aria-expanded=true] {border-color:#2864bd;background:#e8effb}
[data-runtime-dock-icon] {font-size:24px;line-height:1}
[data-runtime-dock-handle] {min-width:48px;min-height:28px;border:1px solid #9aa8b8;border-radius:8px;background:#f5f8fc;color:#25354a}
[data-runtime-dock-settings] {position:fixed;z-index:2147483001;box-sizing:border-box;width:280px;max-width:calc(100vw - 24px);padding:16px;border:1px solid #9aa8b8;border-radius:12px;background:#fff;box-shadow:0 4px 16px #0003;display:flex;flex-direction:column;gap:12px}
[data-runtime-dock-panel] {box-sizing:border-box;display:flex;flex-direction:column;width:min(28rem,calc(100vw - 24px));background:#fff;color:#25354a;border:1px solid #9aa8b8;border-radius:12px;box-shadow:0 4px 16px #0003;z-index:2147483001!important;font:14px/1.5 sans-serif;overflow:hidden!important}
[data-runtime-dock-panel][hidden] {display:none!important}
[data-runtime-dock-panel] > :first-child {display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border-bottom:1px solid #d8e0ea}
[data-runtime-dock-panel] > :nth-child(2) {overflow:auto;min-height:0;padding:0 16px}
[data-runtime-dock-panel] > :last-child {padding:12px 16px;border-top:1px solid #d8e0ea}
[data-runtime-dock-panel] h2 {font-size:18px;margin:0}
[data-runtime-dock-panel] h3 {font-size:15px}
[data-runtime-dock-panel] button {font:inherit;min-height:36px;padding:6px 10px;margin:3px;border:1px solid #9aa8b8;border-radius:6px;background:#f5f8fc;color:#25354a;cursor:pointer}
[data-runtime-dock-panel] button[aria-checked=true] {border-color:#2864bd;box-shadow:inset 0 0 0 1px #2864bd;background:#e8effb}
[data-runtime-dock-panel] button:focus-visible {outline:3px solid #2864bd;outline-offset:1px}
[data-runtime-dock-settings] label {display:flex;align-items:center;justify-content:space-between;gap:12px}
[data-runtime-dock-settings] select, [data-runtime-dock-settings] button {min-height:36px;padding:6px 10px;border:1px solid #9aa8b8;border-radius:6px;background:#f5f8fc}
`;
	const handle = document.createElement("button");
	handle.type = "button";
	handle.textContent = labels.tools;
	handle.setAttribute("data-runtime-dock-handle", "true");
	handle.setAttribute("aria-label", labels.tools);
	const bar = document.createElement("div");
	bar.setAttribute("data-runtime-dock-bar", "true");
	bar.setAttribute("role", "toolbar");
	bar.setAttribute("aria-label", labels.tools);
	const settings = document.createElement("div");
	settings.setAttribute("data-runtime-dock-settings", "true");
	settings.setAttribute("role", "dialog");
	settings.setAttribute("aria-label", labels.settings);
	const heading = document.createElement("strong");
	heading.textContent = labels.settings;
	const edgeLabel = document.createElement("label");
	edgeLabel.textContent = labels.edge;
	const edgeSelect = document.createElement("select");
	edgeSelect.setAttribute("aria-label", labels.edge);
	for (const position of edges) {
		const option = document.createElement("option");
		option.value = position;
		option.textContent = labels[position];
		edgeSelect.append(option);
	}
	edgeLabel.append(edgeSelect);
	const autoLabel = document.createElement("label");
	autoLabel.textContent = labels.autoHide;
	const autoCheck = document.createElement("input");
	autoCheck.type = "checkbox";
	autoLabel.append(autoCheck);
	const close = document.createElement("button");
	close.type = "button";
	close.textContent = labels.close;
	settings.append(heading, edgeLabel, autoLabel, close);
	const gear = document.createElement("button");
	gear.type = "button";
	const gearIcon = document.createElement("span");
	gearIcon.setAttribute("data-runtime-dock-icon", "true");
	gearIcon.setAttribute("aria-hidden", "true");
	gearIcon.textContent = "⚙";
	const gearLabel = document.createElement("span");
	gearLabel.textContent = labels.settingsButton;
	gear.append(gearIcon, gearLabel);
	gear.setAttribute("aria-label", labels.settings);
	gear.title = labels.settings;
	root.append(style, handle, bar, settings);
	const entries = /* @__PURE__ */ new Map();
	const listeners = /* @__PURE__ */ new Set();
	let hovered = false, manual = false, settingsOpen = false, disposed = false;
	let timer;
	let keyboardInput = false;
	const hasFocus = () => keyboardInput && root.contains(document.activeElement);
	const expanded = () => !autoHide || hovered || manual || settingsOpen || hasFocus() || [...entries.values()].some((entry) => entry.state.visible && entry.state.expanded);
	const persist = () => {
		try {
			view?.localStorage.setItem(storageKey, JSON.stringify({
				edge,
				autoHide
			}));
		} catch {}
	};
	const placePanel = (panel) => {
		const rect = root.getBoundingClientRect();
		const width = panel.offsetWidth || 320, height = panel.offsetHeight || 240;
		const vw = view?.innerWidth || 480, vh = view?.innerHeight || 360;
		let left = (vw - width) / 2, top = (vh - height) / 2;
		if (edge === "bottom") top = rect.top - height - 8;
		if (edge === "top") top = rect.bottom + 8;
		if (edge === "left") left = rect.right + 8;
		if (edge === "right") left = rect.left - width - 8;
		Object.assign(panel.style, {
			position: "fixed",
			left: `${Math.max(8, Math.min(left, vw - width - 8))}px`,
			top: `${Math.max(8, Math.min(top, vh - height - 8))}px`,
			maxHeight: "calc(100vh - 16px)",
			overflowY: "auto"
		});
	};
	function render() {
		if (disposed) return;
		const visible = [...entries.values()].filter((entry) => entry.state.visible);
		root.hidden = !visible.length;
		if (!visible.length) {
			settingsOpen = false;
			manual = false;
			hovered = false;
		}
		const showing = expanded();
		bar.hidden = !showing;
		settings.hidden = !settingsOpen;
		handle.hidden = !autoHide;
		handle.setAttribute("aria-expanded", String(showing));
		root.setAttribute("data-edge", edge);
		root.setAttribute("data-auto-hide", String(autoHide));
		root.setAttribute("data-expanded", String(showing));
		const vertical = edge === "left" || edge === "right";
		Object.assign(root.style, {
			left: edge === "right" ? "auto" : "0",
			right: edge === "left" ? "auto" : "0",
			top: edge === "bottom" ? "auto" : "0",
			bottom: edge === "top" ? "auto" : "0",
			width: "max-content",
			height: "max-content",
			margin: vertical ? "auto 0" : "0 auto",
			transform: "none",
			flexDirection: edge === "bottom" ? "column" : edge === "top" ? "column-reverse" : edge === "left" ? "row-reverse" : "row"
		});
		bar.style.flexDirection = vertical ? "column" : "row";
		for (const entry of entries.values()) {
			entry.button.hidden = !entry.state.visible;
			entry.label.textContent = entry.state.text || entry.state.label;
			entry.button.setAttribute("aria-label", entry.state.label);
			entry.button.title = entry.state.label;
			entry.button.setAttribute("aria-expanded", String(entry.state.expanded));
		}
		edgeSelect.value = edge;
		autoCheck.checked = autoHide;
		gear.setAttribute("aria-expanded", String(settingsOpen));
		if (settingsOpen) placePanel(settings);
		for (const entry of entries.values()) if (entry.panel && entry.state.expanded && !entry.panel.hidden) placePanel(entry.panel);
		listeners.forEach((listener) => listener());
	}
	const scheduleHide = () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			hovered = false;
			manual = false;
			render();
		}, 600);
	};
	root.addEventListener("pointerenter", (event) => {
		clearTimeout(timer);
		hovered = event.pointerType !== "touch";
		render();
	});
	root.addEventListener("pointerleave", (event) => {
		if (event.pointerType !== "touch") scheduleHide();
	});
	root.addEventListener("focusin", render);
	root.addEventListener("focusout", (event) => {
		if (root.contains(event.relatedTarget)) return;
		queueMicrotask(() => {
			if (!root.contains(document.activeElement)) manual = false;
			render();
		});
	});
	handle.addEventListener("click", () => {
		manual = !manual;
		render();
	});
	gear.addEventListener("click", () => {
		settingsOpen = !settingsOpen;
		render();
		if (settingsOpen) edgeSelect.focus();
	});
	close.addEventListener("click", () => {
		settingsOpen = false;
		render();
		gear.focus();
	});
	edgeSelect.addEventListener("change", () => {
		if (edges.includes(edgeSelect.value)) edge = edgeSelect.value;
		persist();
		render();
	});
	autoCheck.addEventListener("change", () => {
		autoHide = autoCheck.checked;
		persist();
		render();
	});
	const onKey = (event) => {
		keyboardInput = true;
		if (settingsOpen && event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			settingsOpen = false;
			render();
			gear.focus();
		}
	};
	const onPointer = (event) => {
		keyboardInput = false;
		if (!root.contains(event.target)) {
			manual = false;
			hovered = false;
			render();
		}
	};
	const fullscreen = () => {
		(document.fullscreenElement || document.body).append(root);
		render();
	};
	document.addEventListener("keydown", onKey, true);
	document.addEventListener("pointerdown", onPointer, true);
	document.addEventListener("fullscreenchange", fullscreen);
	view?.addEventListener("resize", render);
	(document.fullscreenElement || document.body).append(root);
	const stageControls = { addButton(options) {
		if (disposed) throw new Error("The Dock has been disposed");
		if (!options.id || !options.label || typeof options.onClick !== "function") throw new TypeError("Invalid Dock control");
		entries.get(options.id)?.button.remove();
		const button = document.createElement("button");
		button.type = "button";
		button.setAttribute("data-runtime-dock-control", options.id);
		const icon = document.createElement("span");
		icon.setAttribute("data-runtime-dock-icon", "true");
		icon.setAttribute("aria-hidden", "true");
		icon.textContent = options.icon || "•";
		const label = document.createElement("span");
		button.append(icon, label);
		button.addEventListener("click", options.onClick);
		const entry = {
			button,
			label,
			state: {
				label: options.label,
				text: options.text || "",
				visible: false,
				expanded: false
			}
		};
		entries.set(options.id, entry);
		bar.insertBefore(button, gear.parentNode === bar ? gear : null);
		if (gear.parentNode !== bar) bar.append(gear);
		render();
		return {
			update(state) {
				if (entries.get(options.id) !== entry) return;
				let changed = false;
				for (const key of [
					"label",
					"text",
					"visible",
					"expanded"
				]) {
					const value = state[key];
					if (typeof value === typeof entry.state[key] && entry.state[key] !== value) {
						Object.assign(entry.state, { [key]: value });
						changed = true;
					}
				}
				if (changed) render();
			},
			placePanel(element) {
				const panel = element;
				if (!panel || typeof panel.setAttribute !== "function" || !panel.style) throw new TypeError("Invalid Dock panel");
				entry.panel = panel;
				panel.setAttribute("data-runtime-dock-panel", "true");
				placePanel(panel);
			},
			focus() {
				if (entry.state.visible && entries.get(options.id) === entry) {
					manual = true;
					render();
					button.focus();
				}
			},
			dispose() {
				if (entries.get(options.id) !== entry) return;
				entries.delete(options.id);
				button.remove();
				render();
			}
		};
	} };
	render();
	return {
		stageControls,
		placePanel,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		getSnapshot: () => ({
			edge,
			autoHide,
			expanded: expanded(),
			count: [...entries.values()].filter((entry) => entry.state.visible).length
		}),
		dispose() {
			if (disposed) return;
			disposed = true;
			clearTimeout(timer);
			entries.clear();
			listeners.clear();
			root.remove();
			document.removeEventListener("keydown", onKey, true);
			document.removeEventListener("pointerdown", onPointer, true);
			document.removeEventListener("fullscreenchange", fullscreen);
			view?.removeEventListener("resize", render);
		}
	};
}
/** Sharing on the document also covers independently bundled copies of this package. */
function getRuntimeControlsDock(options) {
	const document = options.document;
	if (document[registry]) return document[registry];
	const dock = createRuntimeControlsDock(options);
	const dispose = dock.dispose;
	dock.dispose = () => {
		dispose();
		if (document[registry] === dock) delete document[registry];
	};
	document[registry] = dock;
	return dock;
}
/** A host adapter for packaged HTML, independent of the player's optional control bar. */
function createStandaloneCameraControlsHost(document, locale) {
	const ja = /^ja(?:-|$)/iu.test(locale);
	const label = ja ? "カメラ" : "Camera";
	const dock = getRuntimeControlsDock({
		document,
		locale
	});
	let dockButton = null;
	let unsubscribeDock = null;
	const providers = /* @__PURE__ */ new Map();
	let root = null;
	let panel;
	let chooser;
	let content;
	let mounted = null;
	let mountedRunning = false;
	let cameraId = "";
	let open = false;
	let disposed = false;
	const detachContent = () => {
		const previous = mounted;
		mounted = null;
		try {
			previous?.onClose?.();
		} finally {
			if (previous && previous.element.parentNode === content) content.removeChild(previous.element);
		}
	};
	const close = (focus = false) => {
		open = false;
		render();
		if (focus) dockButton?.focus();
	};
	const onKey = (event) => {
		if (open && event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			close(true);
		}
	};
	const onPointer = (event) => {
		if (open && root && !root.contains(event.target) && !event.target.closest?.("[data-runtime-dock-control=\"camera\"]")) close();
	};
	const onFullscreen = () => {
		if (root) (document.fullscreenElement || document.body).appendChild(root);
	};
	const removeRoot = () => {
		detachContent();
		root?.remove();
		root = null;
		unsubscribeDock?.();
		unsubscribeDock = null;
		dockButton?.dispose();
		dockButton = null;
		document.removeEventListener("keydown", onKey, true);
		document.removeEventListener("pointerdown", onPointer, true);
		document.removeEventListener("fullscreenchange", onFullscreen);
	};
	const selectProvider = (visible) => {
		const candidates = visible.filter((provider) => provider.cameraId === cameraId);
		return candidates.filter((provider) => provider.kind === "settings" && provider.running).at(-1) || candidates.find((provider) => provider.kind === "permission") || candidates.at(-1);
	};
	const buttonStyle = {
		minHeight: "36px",
		padding: "6px 12px",
		border: "1px solid #617184",
		borderRadius: "6px",
		background: "#fff",
		color: "#25354a",
		font: "inherit",
		cursor: "pointer"
	};
	const createRoot = () => {
		root = document.createElement("div");
		root.setAttribute("data-camera-source-entry-host", "standalone");
		Object.assign(root.style, {
			position: "fixed",
			right: "auto",
			bottom: "auto",
			width: "320px",
			zIndex: "2147483647",
			display: "flex",
			flexDirection: "column",
			alignItems: "flex-end",
			gap: "8px",
			color: "#25354a",
			font: "14px/1.5 sans-serif",
			maxWidth: "calc(100vw - 32px)"
		});
		panel = document.createElement("div");
		panel.setAttribute("role", "dialog");
		panel.setAttribute("aria-label", label);
		panel.setAttribute("data-camera-source-panel", "standalone");
		Object.assign(panel.style, {
			boxSizing: "border-box",
			width: "320px",
			maxWidth: "100%",
			maxHeight: "calc(100vh - 96px)",
			overflowY: "auto",
			padding: "16px",
			border: "1px solid #617184",
			borderRadius: "8px",
			background: "#fff",
			boxShadow: "0 4px 16px #0004"
		});
		const header = document.createElement("div");
		Object.assign(header.style, {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: "12px"
		});
		const title = document.createElement("strong");
		title.textContent = label;
		const dismiss = document.createElement("button");
		dismiss.type = "button";
		dismiss.textContent = "×";
		dismiss.setAttribute("aria-label", ja ? "閉じる" : "Close");
		Object.assign(dismiss.style, buttonStyle);
		dismiss.addEventListener("click", () => close(true));
		header.append(title, dismiss);
		chooser = document.createElement("select");
		chooser.setAttribute("aria-label", ja ? "カメラID" : "Camera ID");
		Object.assign(chooser.style, {
			...buttonStyle,
			width: "100%",
			marginBottom: "8px"
		});
		chooser.addEventListener("change", () => {
			cameraId = chooser.value;
			render();
		});
		content = document.createElement("div");
		panel.append(header, chooser, content);
		dockButton = dock.stageControls.addButton({
			id: "camera",
			label,
			text: label,
			icon: "📷",
			onClick: () => {
				const starting = !open ? selectProvider([...providers.values()].filter((provider) => provider.visible)) : null;
				open = !open;
				render();
				if (starting?.kind === "settings" && !starting.running) Promise.resolve().then(() => starting.onStart?.()).catch(() => {});
			}
		});
		dockButton.update({ visible: true });
		unsubscribeDock = dock.subscribe(() => {
			if (open && root) dock.placePanel(root);
		});
		const style = document.createElement("style");
		style.textContent = `[data-camera-source-entry-host] [data-camera-source-settings] {display:flex;flex-direction:column;gap:12px}
[data-camera-source-entry-host] [data-camera-source-settings] p {margin:0}
[data-camera-source-entry-host] [data-camera-source-settings] label {display:flex;flex-direction:column;gap:4px}
[data-camera-source-entry-host] [data-camera-source-settings] select,
[data-camera-source-entry-host] [data-camera-source-settings] button {min-height:36px;padding:6px 12px;border:1px solid #617184;border-radius:6px;background:#fff;color:#25354a;font:inherit}
[data-camera-source-entry-host] [data-camera-source-settings] [hidden] {display:none}`;
		root.append(style, panel);
		(document.fullscreenElement || document.body).appendChild(root);
		document.addEventListener("keydown", onKey, true);
		document.addEventListener("pointerdown", onPointer, true);
		document.addEventListener("fullscreenchange", onFullscreen);
	};
	function render() {
		if (disposed) return;
		const visible = [...providers.values()].filter((provider) => provider.visible);
		const ids = [...new Set(visible.map((provider) => provider.cameraId))];
		if (!ids.includes(cameraId)) cameraId = ids[0] || "";
		if (!visible.length) {
			open = false;
			removeRoot();
			return;
		}
		if (!root) createRoot();
		const selected = selectProvider(visible);
		dockButton?.update({ expanded: open });
		panel.hidden = !open;
		if (open && root) dock.placePanel(root);
		chooser.hidden = ids.length < 2;
		chooser.replaceChildren(...ids.map((id) => {
			const option = document.createElement("option");
			option.value = id;
			option.textContent = id;
			return option;
		}));
		chooser.value = cameraId;
		panel.setAttribute("data-camera-mode", selected.kind === "permission" || !selected.running ? "permission" : "settings");
		if (!open) {
			detachContent();
			return;
		}
		if (mounted !== selected || mountedRunning !== selected.running) {
			detachContent();
			mounted = selected;
			mountedRunning = selected.running;
			content.appendChild(selected.element);
			Promise.resolve().then(() => {
				if (mounted === selected && open) return selected.onOpen?.();
			}).catch(() => {});
			if (root) dock.placePanel(root);
		}
	}
	return {
		host: { registerProvider(options) {
			if (disposed) throw new Error("The standalone camera host has been disposed");
			const provider = {
				...options,
				visible: options.visible !== false,
				running: options.running === true
			};
			providers.set(options.id, provider);
			render();
			return {
				update(state) {
					if (providers.get(options.id) !== provider) return;
					let changed = false;
					for (const key of ["visible", "running"]) if (typeof state[key] === "boolean" && provider[key] !== state[key]) {
						provider[key] = state[key];
						changed = true;
					}
					if (changed) render();
				},
				dispose() {
					if (providers.get(options.id) !== provider) return;
					providers.delete(options.id);
					render();
				}
			};
		} },
		dispose() {
			if (disposed) return;
			disposed = true;
			providers.clear();
			open = false;
			removeRoot();
		}
	};
}
/** Camera UI shared by all consumers; the GUI only supplies the entry and panel location. */
function createCameraControls(options) {
	const ja = /^ja(?:-|$)/iu.test(options.locale || options.document.documentElement?.lang || globalThis.navigator?.language || "");
	const labels = {
		permission: ja ? "カメラの許可・開始を待っています。" : "Waiting to enable the camera.",
		running: ja ? "カメラは起動しています。" : "The camera is running.",
		select: ja ? "使用するカメラ" : "Camera device",
		default: ja ? "既定のカメラ" : "Default camera",
		front: ja ? "前面カメラ" : "Front camera",
		back: ja ? "背面カメラ" : "Back camera",
		mirror: ja ? "左右反転" : "Mirror preview",
		mirrored: ja ? "左右反転：オン" : "Mirroring: on",
		unmirrored: ja ? "左右反転：オフ" : "Mirroring: off",
		...options.labels
	};
	const panel = options.document.createElement("div");
	panel.setAttribute("data-camera-source-settings", "true");
	const status = options.document.createElement("p");
	const label = options.document.createElement("label");
	label.textContent = labels.select;
	const select = options.document.createElement("select");
	select.setAttribute("aria-label", labels.select);
	label.appendChild(select);
	const mirror = options.document.createElement("button");
	mirror.type = "button";
	mirror.setAttribute("aria-label", labels.mirror);
	panel.append(status, label, mirror);
	let enabled = false;
	let disposed = false;
	let generation = 0;
	let mirroring = options.mirroring === "unmirrored" ? "unmirrored" : "mirrored";
	let selectionTokens = /* @__PURE__ */ new Map();
	let failureMessage = "";
	const error = (failure) => {
		failureMessage = failure instanceof Error ? failure.message : String(failure);
		status.textContent = failureMessage;
	};
	const renderMirror = () => {
		mirror.textContent = mirroring === "mirrored" ? labels.mirrored : labels.unmirrored;
		mirror.setAttribute("aria-pressed", String(mirroring === "mirrored"));
	};
	const refresh = () => {
		if (disposed) return;
		const running = options.port.isCameraRunning();
		registration.update({
			visible: enabled,
			running
		});
		status.textContent = failureMessage || (running ? labels.running : labels.permission);
		label.hidden = !running || !options.port.selectCamera || !options.port.listCameraDevices;
		mirror.hidden = !running || !options.port.setPreviewMirroring;
		renderMirror();
	};
	const open = async () => {
		failureMessage = "";
		const revision = ++generation;
		refresh();
		if (!options.port.isCameraRunning() || !options.port.listCameraDevices || !options.port.selectCamera) return;
		select.disabled = true;
		try {
			const devices = await options.port.listCameraDevices();
			if (disposed || revision !== generation) return;
			const tokens = /* @__PURE__ */ new Map();
			select.replaceChildren();
			const append = (token, text, value) => {
				const option = options.document.createElement("option");
				option.value = token;
				option.textContent = text;
				select.appendChild(option);
				tokens.set(token, value);
			};
			for (const preference of [
				"default",
				"front",
				"back"
			]) append(preference, labels[preference], preference);
			if (Array.isArray(devices)) devices.forEach((device, index) => {
				if (device.deviceId) append(`device:${index}`, device.label || `${ja ? "カメラ" : "Camera"} ${index + 1}`, { deviceId: device.deviceId });
			});
			const active = options.port.getActiveCamera?.();
			if (active?.deviceId && !Array.from(tokens.values()).some((value) => typeof value === "object" && value && value.deviceId === active.deviceId)) append("device:current", active.label || (ja ? "現在のカメラ" : "Current camera"), { deviceId: active.deviceId });
			selectionTokens = tokens;
			const selected = options.port.getCameraSelection?.();
			const deviceId = typeof selected === "object" && selected ? selected.deviceId : null;
			select.value = Array.from(tokens).find(([, value]) => value === selected || deviceId && typeof value === "object" && value && value.deviceId === deviceId)?.[0] || "default";
		} catch (failure) {
			error(failure);
		} finally {
			if (!disposed && revision === generation) select.disabled = false;
		}
	};
	const registration = options.host.registerProvider({
		id: `camera-source-settings:${options.owner}`,
		cameraId: options.cameraId || "default",
		visible: false,
		kind: "settings",
		element: panel,
		running: options.port.isCameraRunning(),
		onOpen: open,
		onClose: () => {
			generation++;
		},
		onStart: async () => {
			failureMessage = "";
			try {
				await options.requestStart();
				refresh();
			} catch (failure) {
				error(failure);
			}
		}
	});
	const handleSelection = async () => {
		if (disposed || !enabled || !selectionTokens.has(select.value)) return;
		failureMessage = "";
		const revision = generation;
		select.disabled = true;
		try {
			await options.port.selectCamera?.(selectionTokens.get(select.value));
		} catch (failure) {
			error(failure);
		} finally {
			if (!disposed && revision === generation) select.disabled = false;
		}
	};
	const handleMirror = async () => {
		if (disposed || !enabled) return;
		failureMessage = "";
		mirror.disabled = true;
		const next = mirroring === "mirrored" ? "unmirrored" : "mirrored";
		try {
			await options.port.setPreviewMirroring?.(next);
			mirroring = next;
			renderMirror();
		} catch (failure) {
			error(failure);
		} finally {
			if (!disposed) mirror.disabled = false;
		}
	};
	select.addEventListener("change", handleSelection);
	mirror.addEventListener("click", handleMirror);
	const timer = setInterval(refresh, 100);
	refresh();
	return {
		element: panel,
		start() {
			enabled = true;
			refresh();
		},
		stop() {
			enabled = false;
			generation++;
			registration.update({ visible: false });
		},
		refresh,
		setMirroring(mode) {
			if (mode === "mirrored" || mode === "unmirrored") {
				mirroring = mode;
				renderMirror();
			}
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			generation++;
			clearInterval(timer);
			registration.dispose();
			panel.remove();
			select.removeEventListener("change", handleSelection);
			mirror.removeEventListener("click", handleMirror);
		}
	};
}
var block_editor_fixed_inputs_schema_default = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "https://kubohiroya.github.io/turbowarp-camera-source/schemas/block-editor-fixed-inputs.schema.json",
	$defs: { "showCameraPreview": {
		"type": "object",
		"properties": { "PREVIEW_FLIP": {
			"type": "string",
			"enum": [
				"none",
				"horizontal",
				"vertical",
				"both"
			]
		} },
		"additionalProperties": false
	} }
};
/** Canonical fixed field fragments; URI is identity only, never fetched. */
function fixedInputBundle(opcode, argument) {
	const source = {
		repository: "turbowarp-camera-source",
		path: "schemas/block-editor-fixed-inputs.schema.json",
		symbol: `#/$defs/${opcode}/properties/${argument}`
	};
	const definitions = block_editor_fixed_inputs_schema_default.$defs;
	return {
		identity: {
			ownerId: "turbowarp-camera-source",
			contractId: "fixed-inputs",
			revision: "1",
			variantId: opcode + "." + argument
		},
		dialect: "2020-12",
		root: {
			retrievalUri: block_editor_fixed_inputs_schema_default.$id,
			document: definitions[opcode].properties[argument],
			artifact: {
				role: "canonical-schema",
				source
			}
		},
		resources: [],
		provenance: {
			canonicalSources: [source, ...[{
				"repository": "turbowarp-camera-source",
				"path": "src/flip.ts",
				"symbol": "FLIPS / isFlip / toFlip"
			}]],
			generatedFiles: [{
				repository: "turbowarp-camera-source",
				path: "docs/schemas/block-editor-fixed-inputs.schema.json"
			}],
			generationSources: [{
				repository: "turbowarp-camera-source",
				path: "scripts/generate-fixed-input-docs.mjs"
			}],
			referenceSchemas: []
		}
	};
}
var invalid = () => [{ message: "Invalid fixed input." }];
function enumBinding(opcode, argument, choices, normalization) {
	const project = (value) => {
		if (typeof value !== "string") return value;
		const normalized = normalization === "none" ? value : normalization === "trim" ? value.trim() : value.trim().toLowerCase();
		return choices.includes(normalized) ? normalized : value;
	};
	return {
		argument,
		schemaBundle: fixedInputBundle(opcode, argument),
		control: {
			label: argument,
			kind: "enum",
			choices: choices.map((value) => ({ value }))
		},
		read: project,
		encode(value) {
			if (typeof value !== "string" || !choices.includes(value)) throw new TypeError("Choose a known value.");
			return value;
		},
		validateCandidate(candidate, _context, finalSnapshot) {
			try {
				return typeof candidate === "string" && choices.includes(candidate) && ownerCheck(opcode, argument, candidate, finalSnapshot) ? [] : invalid();
			} catch {
				return invalid();
			}
		}
	};
}
function ownerCheck(_opcode, _argument, _candidate, _snapshot) {
	return true;
}
var extensionId = "kubohiroyacamerasource";
var validationContext = () => ({
	consumerId: "turbowarp-camera-source",
	nowMs: 0,
	settings: null
});
var fixedInputEditors = [{
	apiVersion: 1,
	extensionId,
	editorId: "showCameraPreview-fixed",
	opcodes: [`${extensionId}_showCameraPreview`],
	contractId: "turbowarp-camera-source/showCameraPreview",
	contractRevision: "1",
	validationContext,
	readOnlyArguments: [],
	bindings: [enumBinding("showCameraPreview", "PREVIEW_FLIP", [
		"none",
		"horizontal",
		"vertical",
		"both"
	], "none")]
}];
/** Register metadata only; the GUI startup capability owns editor activation. */
function registerFixedInputEditors(scratch, definitions, runtimeOverride) {
	const host = scratch;
	const api = host.gui?.blockEditors;
	if (!definitions.length || api?.apiVersion !== 1 || typeof api.registerFixedInputEditor !== "function") return () => {};
	const runtime = runtimeOverride ?? host.vm?.runtime;
	const removers = [];
	let active = true;
	const dispose = () => {
		if (!active) return;
		active = false;
		runtime?.off?.("RUNTIME_DISPOSED", dispose);
		for (const remove of removers.splice(0).reverse()) remove();
	};
	try {
		for (const definition of definitions) {
			const remove = api.registerFixedInputEditor.call(api, definition);
			if (typeof remove !== "function") throw new TypeError("Invalid fixed input registration disposer.");
			removers.push(remove);
		}
		runtime?.on?.("RUNTIME_DISPOSED", dispose);
	} catch (error) {
		dispose();
		throw error;
	}
	return dispose;
}
var camera_intrinsics_v1_default = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "https://kubohiroya.github.io/turbowarp-camera-source/schema/camera-intrinsics-v1.json",
	title: "Camera intrinsic calibration profile v1",
	description: "How one camera projects the world onto its own captured image. Carries no world pose: where a camera stands is solved separately against a shared reference, and mixing the two lets a stale extrinsic be read as a current placement.",
	type: "object",
	additionalProperties: false,
	required: [
		"schema",
		"version",
		"profileId",
		"cameraId",
		"calibratedAt",
		"producer",
		"cameraModel",
		"image",
		"intrinsics",
		"distortion"
	],
	properties: {
		"schema": { "const": "twcs/camera-intrinsics" },
		"version": { "const": 1 },
		"profileId": {
			"$ref": "#/$defs/identifier",
			"description": "Identifies this calibration run. A new solve produces a new id."
		},
		"cameraId": {
			"$ref": "#/$defs/identifier",
			"description": "Operator-assigned camera name such as stage-left. Stable across calibration runs."
		},
		"calibratedAt": {
			"type": "string",
			"pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,6})?Z$",
			"description": "When the calibration was solved, as an RFC 3339 timestamp in UTC."
		},
		"producer": {
			"type": "string",
			"minLength": 1,
			"maxLength": 256,
			"description": "Free text naming whatever produced the profile. Diagnostics only; the contract does not care which extension, tool or person it was."
		},
		"cameraModel": { "const": "pinhole" },
		"image": {
			"type": "object",
			"additionalProperties": false,
			"required": [
				"width",
				"height",
				"undistorted"
			],
			"description": "The image the calibration was solved against. Always the camera's own capture; preview mirroring is a display choice and never changes the calibration.",
			"properties": {
				"width": {
					"type": "integer",
					"minimum": 1,
					"maximum": 16384
				},
				"height": {
					"type": "integer",
					"minimum": 1,
					"maximum": 16384
				},
				"undistorted": {
					"type": "boolean",
					"description": "False for the base contract: the profile describes the raw frame and the consumer applies the distortion model. True states that the images are already corrected, which then forbids leftover coefficients."
				}
			}
		},
		"intrinsics": {
			"type": "object",
			"additionalProperties": false,
			"required": [
				"fx",
				"fy",
				"cx",
				"cy",
				"skew"
			],
			"description": "Pinhole parameters in pixels of the calibration image, with x to the right and y downward from the top-left corner. Named rather than packed into an array because nine numbers cannot say whether they are row-major or column-major. The equivalent row-major 3x3 matrix is [fx, skew, cx, 0, fy, cy, 0, 0, 1].",
			"properties": {
				"fx": {
					"type": "number",
					"exclusiveMinimum": 0,
					"maximum": 1e7
				},
				"fy": {
					"type": "number",
					"exclusiveMinimum": 0,
					"maximum": 1e7
				},
				"cx": {
					"type": "number",
					"minimum": -1e7,
					"maximum": 1e7
				},
				"cy": {
					"type": "number",
					"minimum": -1e7,
					"maximum": 1e7
				},
				"skew": {
					"type": "number",
					"minimum": -1e7,
					"maximum": 1e7,
					"description": "Axis skew. Zero for every square-pixel sensor; kept explicit so it is never assumed."
				}
			}
		},
		"distortion": {
			"type": "object",
			"additionalProperties": false,
			"required": ["model", "coefficients"],
			"properties": {
				"model": { "enum": [
					"none",
					"brown-conrady",
					"kannala-brandt"
				] },
				"coefficients": {
					"type": "array",
					"items": {
						"type": "number",
						"minimum": -1e4,
						"maximum": 1e4
					},
					"description": "Brown-Conrady carries the OpenCV coefficients in their usual order: k1, k2, p1, p2, optionally k3, and k4 to k6 for the rational model. Kannala-Brandt carries the four fisheye coefficients."
				}
			},
			"allOf": [
				{
					"if": {
						"type": "object",
						"required": ["model"],
						"properties": { "model": { "const": "none" } }
					},
					"then": {
						"type": "object",
						"properties": { "coefficients": {
							"type": "array",
							"maxItems": 0
						} }
					}
				},
				{
					"if": {
						"type": "object",
						"required": ["model"],
						"properties": { "model": { "const": "brown-conrady" } }
					},
					"then": {
						"type": "object",
						"properties": { "coefficients": {
							"type": "array",
							"anyOf": [
								{
									"minItems": 4,
									"maxItems": 4
								},
								{
									"minItems": 5,
									"maxItems": 5
								},
								{
									"minItems": 8,
									"maxItems": 8
								}
							]
						} }
					}
				},
				{
					"if": {
						"type": "object",
						"required": ["model"],
						"properties": { "model": { "const": "kannala-brandt" } }
					},
					"then": {
						"type": "object",
						"properties": { "coefficients": {
							"type": "array",
							"minItems": 4,
							"maxItems": 4
						} }
					}
				}
			]
		},
		"capture": {
			"type": "object",
			"additionalProperties": false,
			"description": "The capture configuration the calibration was solved under. Optional as a whole, and optional member by member, but the difference matters: an absent block means nothing was recorded and compatibility cannot be decided, while an absent member inside a present block means the device reported no such control at calibration time. frameRate and facingMode are recorded for the operator and do not decide compatibility, because neither changes how the lens projects.",
			"properties": {
				"frameRate": {
					"type": "number",
					"exclusiveMinimum": 0,
					"maximum": 1e3
				},
				"facingMode": {
					"type": "string",
					"minLength": 1,
					"maxLength": 256
				},
				"resizeMode": {
					"enum": ["none", "crop-and-scale"],
					"description": "Cropping changes the effective intrinsics at the same resolution."
				},
				"zoom": {
					"type": "number",
					"exclusiveMinimum": 0,
					"maximum": 1e3
				},
				"focusMode": { "enum": [
					"none",
					"manual",
					"single-shot",
					"continuous"
				] },
				"focusDistance": {
					"type": "number",
					"minimum": 0,
					"maximum": 1e4
				}
			}
		},
		"quality": {
			"type": "object",
			"additionalProperties": false,
			"required": ["sampleCount", "reprojectionErrorPx"],
			"description": "Optional. Absent means the producer did not report quality, which is not the same as a measured zero.",
			"properties": {
				"sampleCount": {
					"type": "integer",
					"minimum": 1,
					"maximum": 1e4
				},
				"reprojectionErrorPx": {
					"type": "number",
					"minimum": 0,
					"maximum": 1e4
				}
			}
		},
		"device": {
			"type": "object",
			"additionalProperties": false,
			"description": "Hints for recognizing the physical camera again. deviceId is a hint and not an identity: browsers scope it per origin and per profile, so it changes without the camera changing.",
			"properties": {
				"label": {
					"type": "string",
					"minLength": 1,
					"maxLength": 256
				},
				"deviceId": {
					"type": "string",
					"minLength": 1,
					"maxLength": 256
				}
			}
		}
	},
	allOf: [{
		"if": {
			"type": "object",
			"required": ["image"],
			"properties": { "image": {
				"type": "object",
				"required": ["undistorted"],
				"properties": { "undistorted": { "const": true } }
			} }
		},
		"then": {
			"type": "object",
			"properties": { "distortion": {
				"type": "object",
				"properties": { "model": { "const": "none" } }
			} }
		}
	}],
	$defs: { "identifier": {
		"type": "string",
		"pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$"
	} }
};
var editor_legacy_calibration_default = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "https://kubohiroya.github.io/turbowarp-camera-source/schema/editor-legacy-calibration.json",
	title: "Existing Camera Source legacy input shape",
	type: "object",
	required: [
		"schema",
		"version",
		"calibrationId",
		"cameraId",
		"imageWidth",
		"imageHeight",
		"intrinsicMatrix",
		"distortionCoefficients",
		"calibratedAt"
	],
	properties: {
		"schema": { "const": "twrmc/camera-calibration" },
		"version": { "const": 1 },
		"calibrationId": { "type": "string" },
		"cameraId": { "type": "string" },
		"imageWidth": { "type": "number" },
		"imageHeight": { "type": "number" },
		"intrinsicMatrix": {
			"type": "array",
			"items": { "type": "number" },
			"minItems": 9,
			"maxItems": 9
		},
		"distortionCoefficients": {
			"type": "array",
			"items": { "type": "number" }
		},
		"calibratedAt": { "type": "string" },
		"worldFromCameraMatrix": true,
		"worldUnit": true
	},
	additionalProperties: false
};
var editor_ros_camera_info_default = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "https://kubohiroya.github.io/turbowarp-camera-source/schema/editor-ros-camera-info.json",
	title: "Raw ROS camera_info shape (owner validates matrices and metadata)",
	type: "object",
	required: [
		"image_width",
		"image_height",
		"camera_name",
		"camera_matrix",
		"distortion_coefficients",
		"turbowarp_camera_source"
	],
	properties: {
		"image_width": true,
		"image_height": true,
		"camera_name": true,
		"camera_matrix": true,
		"distortion_model": true,
		"distortion_coefficients": true,
		"rectification_matrix": true,
		"projection_matrix": true,
		"binning_x": true,
		"binning_y": true,
		"roi": true,
		"turbowarp_camera_source": true
	},
	additionalProperties: false
};
var CAMERA_INTRINSIC_PROFILE_SCHEMA = "twcs/camera-intrinsics";
/** The application-specific format this contract replaces. Read for migration, never written. */
var LEGACY_CALIBRATION_SCHEMA = "twrmc/camera-calibration";
var IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
var UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;
var MAXIMUM_IMAGE_EDGE = 16384;
var MAXIMUM_PIXEL_MAGNITUDE = 1e7;
var MAXIMUM_DISTORTION_MAGNITUDE = 1e4;
var MAXIMUM_SAMPLE_COUNT = 1e4;
var MAXIMUM_REPROJECTION_ERROR_PX = 1e4;
var MAXIMUM_TEXT_LENGTH = 256;
var MAXIMUM_FRAME_RATE = 1e3;
var MAXIMUM_ZOOM = 1e3;
var MAXIMUM_FOCUS_DISTANCE = 1e4;
var MAXIMUM_SCAN_DEPTH = 16;
var AFFINE_ROW_TOLERANCE = 1e-6;
var DISTORTION_MODELS = [
	"none",
	"brown-conrady",
	"kannala-brandt"
];
var RESIZE_MODES = ["none", "crop-and-scale"];
var FOCUS_MODES = [
	"none",
	"manual",
	"single-shot",
	"continuous"
];
/**
* Coefficient counts each model accepts.
*
* The Brown-Conrady lengths are the OpenCV sets that consumers already handle: four, the usual five
* with k3, and eight for the rational model. Longer OpenCV vectors (thin prism, tilted sensor) are
* rejected rather than carried, because no consumer in this family implements them and a profile
* that is accepted but only partly applied is worse than one that is refused.
*/
var DISTORTION_COEFFICIENT_LENGTHS = {
	none: [0],
	"brown-conrady": [
		4,
		5,
		8
	],
	"kannala-brandt": [4]
};
/**
* Key names that carry pairing or authentication material.
*
* Signaling data is short-lived session state and a calibration profile is a document operators keep
* and copy between venues. Rejecting the whole document is deliberate: a profile that reached here
* carrying an SDP is evidence that something upstream is mixing the two, and quietly stripping the
* key would hide that.
*/
var FORBIDDEN_KEYS = /* @__PURE__ */ new Set([
	"accesstoken",
	"answer",
	"apikey",
	"authorization",
	"candidate",
	"credential",
	"credentials",
	"ice",
	"icecandidate",
	"offer",
	"passphrase",
	"password",
	"secret",
	"sdp",
	"token"
]);
var ProfileRejection = class extends Error {
	constructor(detail) {
		super(detail.message);
		this.name = "ProfileRejection";
		this.detail = detail;
	}
};
function reject(code, path, message) {
	throw new ProfileRejection({
		code,
		path,
		message
	});
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function member(path, name) {
	return path.length === 0 ? name : `${path}.${name}`;
}
/** Normalizes a key so `ICE-Candidate`, `iceCandidate` and `ice_candidate` all match one entry. */
function comparableKey(key) {
	return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function assertNoForbiddenKeys(value, path, depth, seen) {
	if (depth > MAXIMUM_SCAN_DEPTH) reject("invalid-value", path, "The document is nested more deeply than a profile ever is.");
	if (typeof value !== "object" || value === null) return;
	if (seen.has(value)) reject("invalid-value", path, "The document contains a cycle.");
	seen.add(value);
	if (Array.isArray(value)) {
		value.forEach((item, index) => assertNoForbiddenKeys(item, `${path}[${index}]`, depth + 1, seen));
		return;
	}
	for (const [key, child] of Object.entries(value)) {
		if (FORBIDDEN_KEYS.has(comparableKey(key))) reject("forbidden-field", member(path, key), "Pairing and authentication material must not travel inside a calibration profile.");
		assertNoForbiddenKeys(child, member(path, key), depth + 1, seen);
	}
}
function requireRecord(value, path) {
	if (!isRecord(value)) reject(path.length === 0 ? "not-an-object" : "invalid-type", path, "Expected an object.");
	return value;
}
/** Rejects unknown members as well as missing ones, so an unrecognized field is never ignored. */
function requireExactKeys(record, path, required, optional = []) {
	const known = /* @__PURE__ */ new Set([...required, ...optional]);
	for (const key of Object.keys(record)) if (!known.has(key)) reject("unexpected-field", member(path, key), "Unknown member.");
	for (const key of required) if (!(key in record)) reject("missing-field", member(path, key), "Required member is missing.");
}
function requireText(value, path) {
	if (typeof value !== "string") reject("invalid-type", path, "Expected a string.");
	if (value.length === 0 || value.length > MAXIMUM_TEXT_LENGTH) reject("out-of-range", path, `Expected between 1 and ${MAXIMUM_TEXT_LENGTH} characters.`);
	return value;
}
function requireIdentifier(value, path) {
	const text = requireText(value, path);
	if (!IDENTIFIER_PATTERN.test(text)) reject("invalid-value", path, "Expected letters, digits, dot, underscore, colon or hyphen.");
	return text;
}
function requireUtcTimestamp(value, path) {
	const text = requireText(value, path);
	if (!UTC_TIMESTAMP_PATTERN.test(text) || !Number.isFinite(Date.parse(text))) reject("invalid-value", path, "Expected an RFC 3339 timestamp in UTC, such as 2026-09-15T04:05:06Z.");
	return text;
}
function requireBoolean(value, path) {
	if (typeof value !== "boolean") reject("invalid-type", path, "Expected a boolean.");
	return value;
}
function requireFinite(value, path) {
	if (typeof value !== "number") reject("invalid-type", path, "Expected a number.");
	if (!Number.isFinite(value)) reject("invalid-value", path, "Expected a finite number.");
	return value;
}
function requireInteger(value, path, minimum, maximum) {
	const numeric = requireFinite(value, path);
	if (!Number.isInteger(numeric)) reject("invalid-value", path, "Expected an integer.");
	if (numeric < minimum || numeric > maximum) reject("out-of-range", path, `Expected between ${minimum} and ${maximum}.`);
	return numeric;
}
function requireBounded(value, path, minimum, maximum) {
	const numeric = requireFinite(value, path);
	if (numeric < minimum || numeric > maximum) reject("out-of-range", path, `Expected between ${minimum} and ${maximum}.`);
	return numeric;
}
function requireLiteral(value, path, expected, code) {
	if (value !== expected) reject(code, path, `Expected ${JSON.stringify(expected)}.`);
	return expected;
}
function readImage(value, path) {
	const record = requireRecord(value, path);
	requireExactKeys(record, path, [
		"width",
		"height",
		"undistorted"
	]);
	return {
		width: requireInteger(record["width"], member(path, "width"), 1, MAXIMUM_IMAGE_EDGE),
		height: requireInteger(record["height"], member(path, "height"), 1, MAXIMUM_IMAGE_EDGE),
		undistorted: requireBoolean(record["undistorted"], member(path, "undistorted"))
	};
}
/**
* Reads the pinhole parameters.
*
* The principal point is allowed to sit outside the frame — a cropped or shifted sensor puts it
* there legitimately — but not arbitrarily far, because a principal point far outside the image is
* the signature of values given in the wrong unit rather than of an unusual lens.
*/
function readIntrinsics(value, path, image) {
	const record = requireRecord(value, path);
	requireExactKeys(record, path, [
		"fx",
		"fy",
		"cx",
		"cy",
		"skew"
	]);
	return {
		fx: requireBounded(record["fx"], member(path, "fx"), Number.MIN_VALUE, MAXIMUM_PIXEL_MAGNITUDE),
		fy: requireBounded(record["fy"], member(path, "fy"), Number.MIN_VALUE, MAXIMUM_PIXEL_MAGNITUDE),
		cx: requireBounded(record["cx"], member(path, "cx"), -image.width, image.width * 2),
		cy: requireBounded(record["cy"], member(path, "cy"), -image.height, image.height * 2),
		skew: requireBounded(record["skew"], member(path, "skew"), -1e7, MAXIMUM_PIXEL_MAGNITUDE)
	};
}
function readDistortion$1(value, path) {
	const record = requireRecord(value, path);
	requireExactKeys(record, path, ["model", "coefficients"]);
	const modelPath = member(path, "model");
	const rawModel = record["model"];
	if (typeof rawModel !== "string" || !DISTORTION_MODELS.includes(rawModel)) reject("invalid-distortion", modelPath, `Expected one of ${DISTORTION_MODELS.join(", ")}.`);
	const model = rawModel;
	const coefficientsPath = member(path, "coefficients");
	const rawCoefficients = record["coefficients"];
	if (!Array.isArray(rawCoefficients)) reject("invalid-type", coefficientsPath, "Expected an array.");
	const allowed = DISTORTION_COEFFICIENT_LENGTHS[model];
	if (!allowed.includes(rawCoefficients.length)) reject("invalid-distortion", coefficientsPath, `The ${model} model takes ${allowed.join(" or ")} coefficients, not ${rawCoefficients.length}.`);
	return {
		model,
		coefficients: rawCoefficients.map((coefficient, index) => requireBounded(coefficient, `${coefficientsPath}[${index}]`, -1e4, MAXIMUM_DISTORTION_MAGNITUDE))
	};
}
function requireEnum(value, path, allowed) {
	const text = requireText(value, path);
	if (!allowed.includes(text)) reject("invalid-value", path, `Expected one of ${allowed.join(", ")}.`);
	return text;
}
function readCapture(value, path) {
	const record = requireRecord(value, path);
	requireExactKeys(record, path, [], [
		"frameRate",
		"facingMode",
		"resizeMode",
		"zoom",
		"focusMode",
		"focusDistance"
	]);
	const read = (name, reader) => name in record ? reader(record[name], member(path, name)) : void 0;
	const frameRate = read("frameRate", (raw, at) => requireBounded(raw, at, Number.MIN_VALUE, MAXIMUM_FRAME_RATE));
	const facingMode = read("facingMode", requireText);
	const resizeMode = read("resizeMode", (raw, at) => requireEnum(raw, at, RESIZE_MODES));
	const zoom = read("zoom", (raw, at) => requireBounded(raw, at, Number.MIN_VALUE, MAXIMUM_ZOOM));
	const focusMode = read("focusMode", (raw, at) => requireEnum(raw, at, FOCUS_MODES));
	const focusDistance = read("focusDistance", (raw, at) => requireBounded(raw, at, 0, MAXIMUM_FOCUS_DISTANCE));
	return {
		...frameRate === void 0 ? {} : { frameRate },
		...facingMode === void 0 ? {} : { facingMode },
		...resizeMode === void 0 ? {} : { resizeMode },
		...zoom === void 0 ? {} : { zoom },
		...focusMode === void 0 ? {} : { focusMode },
		...focusDistance === void 0 ? {} : { focusDistance }
	};
}
function readQuality(value, path) {
	const record = requireRecord(value, path);
	requireExactKeys(record, path, ["sampleCount", "reprojectionErrorPx"]);
	return {
		sampleCount: requireInteger(record["sampleCount"], member(path, "sampleCount"), 1, MAXIMUM_SAMPLE_COUNT),
		reprojectionErrorPx: requireBounded(record["reprojectionErrorPx"], member(path, "reprojectionErrorPx"), 0, MAXIMUM_REPROJECTION_ERROR_PX)
	};
}
function readDevice(value, path) {
	const record = requireRecord(value, path);
	requireExactKeys(record, path, [], ["label", "deviceId"]);
	const label = "label" in record ? requireText(record["label"], member(path, "label")) : void 0;
	const deviceId = "deviceId" in record ? requireText(record["deviceId"], member(path, "deviceId")) : void 0;
	return {
		...label === void 0 ? {} : { label },
		...deviceId === void 0 ? {} : { deviceId }
	};
}
function readProfile(input) {
	assertNoForbiddenKeys(input, "", 0, /* @__PURE__ */ new WeakSet());
	const record = requireRecord(input, "");
	requireLiteral(record["schema"], "schema", CAMERA_INTRINSIC_PROFILE_SCHEMA, "unsupported-schema");
	requireLiteral(record["version"], "version", 1, "unsupported-version");
	requireExactKeys(record, "", [
		"schema",
		"version",
		"profileId",
		"cameraId",
		"calibratedAt",
		"producer",
		"cameraModel",
		"image",
		"intrinsics",
		"distortion"
	], [
		"capture",
		"quality",
		"device"
	]);
	const image = readImage(record["image"], "image");
	const distortion = readDistortion$1(record["distortion"], "distortion");
	if (image.undistorted && distortion.model !== "none") reject("inconsistent-profile", "distortion.model", "A profile for an already undistorted image cannot also carry distortion coefficients.");
	const capture = "capture" in record ? readCapture(record["capture"], "capture") : void 0;
	const quality = "quality" in record ? readQuality(record["quality"], "quality") : void 0;
	const device = "device" in record ? readDevice(record["device"], "device") : void 0;
	return {
		schema: CAMERA_INTRINSIC_PROFILE_SCHEMA,
		version: 1,
		profileId: requireIdentifier(record["profileId"], "profileId"),
		cameraId: requireIdentifier(record["cameraId"], "cameraId"),
		calibratedAt: requireUtcTimestamp(record["calibratedAt"], "calibratedAt"),
		producer: requireText(record["producer"], "producer"),
		cameraModel: requireLiteral(record["cameraModel"], "cameraModel", "pinhole", "invalid-value"),
		image,
		intrinsics: readIntrinsics(record["intrinsics"], "intrinsics", image),
		distortion,
		...capture === void 0 ? {} : { capture },
		...quality === void 0 ? {} : { quality },
		...device === void 0 ? {} : { device }
	};
}
function toResult(read) {
	try {
		return {
			ok: true,
			profile: read()
		};
	} catch (error) {
		if (error instanceof ProfileRejection) return {
			ok: false,
			error: error.detail
		};
		throw error;
	}
}
/**
* Reads whichever profile format a document is written in.
*
* An operator holding a file does not know, and should not have to know, which of two schemas it
* uses; they know they calibrated this camera once and kept the result. Dispatching on the document
* itself means one entry point accepts both, and the profile that comes out records where it came
* from in `producer`, so nothing about the conversion is hidden.
*
* Only the declared schema decides. A document that says nothing recognizable is refused by the
* current parser, which names what it expected.
*/
function readCameraProfileDocument(input) {
	if (isRecord(input) && input["schema"] === "twrmc/camera-calibration") return adoptLegacyCameraCalibration(input);
	return parseCameraIntrinsicProfile(input);
}
/** Validates a parsed document and returns a normalized profile, or the reason it was refused. */
function parseCameraIntrinsicProfile(input) {
	return toResult(() => readProfile(input));
}
/**
* Renders a profile as JSON with a fixed member order.
*
* Stable output means the same profile always produces the same bytes, so a file can be compared or
* hashed to tell whether two machines really hold the same calibration.
*/
function orderedCapture(capture) {
	const members = [
		["frameRate", capture.frameRate],
		["facingMode", capture.facingMode],
		["resizeMode", capture.resizeMode],
		["zoom", capture.zoom],
		["focusMode", capture.focusMode],
		["focusDistance", capture.focusDistance]
	];
	return Object.fromEntries(members.filter((entry) => entry[1] !== void 0));
}
function serializeCameraIntrinsicProfile(profile) {
	const ordered = {
		schema: profile.schema,
		version: profile.version,
		profileId: profile.profileId,
		cameraId: profile.cameraId,
		calibratedAt: profile.calibratedAt,
		producer: profile.producer,
		cameraModel: profile.cameraModel,
		image: {
			width: profile.image.width,
			height: profile.image.height,
			undistorted: profile.image.undistorted
		},
		intrinsics: {
			fx: profile.intrinsics.fx,
			fy: profile.intrinsics.fy,
			cx: profile.intrinsics.cx,
			cy: profile.intrinsics.cy,
			skew: profile.intrinsics.skew
		},
		distortion: {
			model: profile.distortion.model,
			coefficients: [...profile.distortion.coefficients]
		},
		...profile.capture === void 0 ? {} : { capture: orderedCapture(profile.capture) },
		...profile.quality === void 0 ? {} : { quality: {
			sampleCount: profile.quality.sampleCount,
			reprojectionErrorPx: profile.quality.reprojectionErrorPx
		} },
		...profile.device === void 0 ? {} : { device: {
			...profile.device.label === void 0 ? {} : { label: profile.device.label },
			...profile.device.deviceId === void 0 ? {} : { deviceId: profile.device.deviceId }
		} }
	};
	return `${JSON.stringify(ordered, null, 2)}\n`;
}
function readLegacyMatrixRow(matrix, offset, expected) {
	expected.forEach((value, index) => {
		const actual = requireFinite(matrix[offset + index], `intrinsicMatrix[${offset + index}]`);
		if (Math.abs(actual - value) > AFFINE_ROW_TOLERANCE) reject("inconsistent-profile", `intrinsicMatrix[${offset + index}]`, `Expected ${value} in the intrinsic matrix; the value read as ${actual}.`);
	});
}
/**
* Converts a `twrmc/camera-calibration` v1 document into this contract.
*
* The world pose the old format carried is deliberately dropped. It was the extrinsic of whichever
* calibration sample happened to be last, so treating it as a placement in a shared world frame puts
* a camera somewhere it has never been. Placement belongs to whoever solves it against a common
* reference, and a profile that simply lacks it is honest about what it knows.
*
* Quality is dropped for the same reason: the old format recorded none, and inventing a sample count
* or a reprojection error would turn "unknown" into a measurement.
*/
function adoptLegacyCameraCalibration(input) {
	return toResult(() => {
		assertNoForbiddenKeys(input, "", 0, /* @__PURE__ */ new WeakSet());
		const record = requireRecord(input, "");
		requireLiteral(record["schema"], "schema", LEGACY_CALIBRATION_SCHEMA, "unsupported-schema");
		requireLiteral(record["version"], "version", 1, "unsupported-version");
		requireExactKeys(record, "", [
			"schema",
			"version",
			"calibrationId",
			"cameraId",
			"imageWidth",
			"imageHeight",
			"intrinsicMatrix",
			"distortionCoefficients",
			"calibratedAt"
		], ["worldFromCameraMatrix", "worldUnit"]);
		const matrix = record["intrinsicMatrix"];
		if (!Array.isArray(matrix) || matrix.length !== 9) reject("invalid-value", "intrinsicMatrix", "Expected nine numbers in row-major order.");
		readLegacyMatrixRow(matrix, 3, [0]);
		readLegacyMatrixRow(matrix, 6, [
			0,
			0,
			1
		]);
		const rawCoefficients = record["distortionCoefficients"];
		if (!Array.isArray(rawCoefficients)) reject("invalid-type", "distortionCoefficients", "Expected an array.");
		const model = rawCoefficients.length === 0 ? "none" : "brown-conrady";
		return readProfile({
			schema: CAMERA_INTRINSIC_PROFILE_SCHEMA,
			version: 1,
			profileId: record["calibrationId"],
			cameraId: record["cameraId"],
			calibratedAt: record["calibratedAt"],
			producer: `${LEGACY_CALIBRATION_SCHEMA} v1`,
			cameraModel: "pinhole",
			image: {
				width: record["imageWidth"],
				height: record["imageHeight"],
				undistorted: false
			},
			intrinsics: {
				fx: matrix[0],
				fy: matrix[4],
				cx: matrix[2],
				cy: matrix[5],
				skew: matrix[1]
			},
			distortion: {
				model,
				coefficients: rawCoefficients
			}
		});
	});
}
var YamlError = class extends Error {
	constructor(message, line) {
		super(line > 0 ? `Line ${line}: ${message}` : message);
		this.name = "YamlError";
		this.line = line;
	}
};
var MAXIMUM_DEPTH = 16;
var MAXIMUM_LENGTH = 65536;
function parseYaml(source) {
	if (source.length > MAXIMUM_LENGTH) throw new YamlError("The document is longer than a calibration file ever is.", 0);
	const lines = splitLines(source);
	if (lines.length === 0) throw new YamlError("The document is empty.", 0);
	const reader = new BlockReader(lines);
	const value = reader.readBlock(lines[0].indent, 0);
	if (!reader.done()) throw new YamlError("Unexpected indentation.", reader.peek().number);
	return value;
}
function splitLines(source) {
	const lines = [];
	let started = false;
	source.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/).forEach((raw, index) => {
		const number = index + 1;
		if (/\t/.test(raw.match(/^\s*/)[0])) throw new YamlError("Tabs cannot indent YAML.", number);
		const text = stripComment(raw).trimEnd();
		const content = text.trimStart();
		if (content.length === 0) return;
		if (!started && content.startsWith("%")) return;
		if (content === "---" || content.startsWith("--- ")) {
			if (started) throw new YamlError("Only one document is read from a calibration file.", number);
			started = true;
			const rest = content.slice(3).trim();
			if (rest.length > 0) lines.push({
				number,
				indent: 0,
				text: rest
			});
			return;
		}
		if (content === "...") {
			started = true;
			return;
		}
		started = true;
		lines.push({
			number,
			indent: text.length - content.length,
			text: content
		});
	});
	return lines;
}
/** Removes a `#` comment that is not inside quotes. A `#` only starts one after whitespace. */
function stripComment(raw) {
	let quote;
	for (let index = 0; index < raw.length; index += 1) {
		const character = raw[index];
		if (quote) {
			if (character === "\\" && quote === "\"") index += 1;
			else if (character === quote) quote = void 0;
			continue;
		}
		if (character === "\"" || character === "'") quote = character;
		else if (character === "#" && (index === 0 || /\s/.test(raw[index - 1]))) return raw.slice(0, index);
	}
	return raw;
}
var BlockReader = class {
	constructor(lines) {
		this.lines = lines;
		this.index = 0;
	}
	done() {
		return this.index >= this.lines.length;
	}
	peek() {
		return this.lines[this.index];
	}
	readBlock(indent, depth) {
		if (depth > MAXIMUM_DEPTH) throw new YamlError("The document is nested too deeply.", this.peek()?.number ?? 0);
		const first = this.peek();
		if (!first) throw new YamlError("Expected a value.", 0);
		if (first.text === "-" || first.text.startsWith("- ")) return this.readSequence(indent, depth);
		if (findMappingColon(first.text) >= 0) return this.readMapping(indent, depth);
		this.index += 1;
		return this.readInline(first.text, first.number, first.indent);
	}
	readMapping(indent, depth) {
		const mapping = {};
		while (!this.done()) {
			const line = this.peek();
			if (line.indent < indent) break;
			if (line.indent > indent) throw new YamlError("Unexpected indentation.", line.number);
			const colon = findMappingColon(line.text);
			if (colon < 0) throw new YamlError("Expected a \"key: value\" pair.", line.number);
			const key = readKey(line.text.slice(0, colon).trim(), line.number);
			if (Object.prototype.hasOwnProperty.call(mapping, key)) throw new YamlError(`The key "${key}" appears twice.`, line.number);
			const rest = line.text.slice(colon + 1).trim();
			this.index += 1;
			if (rest.length > 0) {
				mapping[key] = this.readInline(rest, line.number, line.indent);
				continue;
			}
			const next = this.peek();
			const nestedSequence = next !== void 0 && next.indent === indent && (next.text === "-" || next.text.startsWith("- "));
			if (next === void 0 || next.indent <= indent && !nestedSequence) mapping[key] = null;
			else mapping[key] = this.readBlock(next.indent, depth + 1);
		}
		return mapping;
	}
	readSequence(indent, depth) {
		const sequence = [];
		while (!this.done()) {
			const line = this.peek();
			if (line.indent < indent || !(line.text === "-" || line.text.startsWith("- "))) break;
			if (line.indent > indent) throw new YamlError("Unexpected indentation.", line.number);
			const rest = line.text.slice(1).trim();
			this.index += 1;
			if (rest.length === 0) {
				const next = this.peek();
				sequence.push(next !== void 0 && next.indent > indent ? this.readBlock(next.indent, depth + 1) : null);
			} else if (findMappingColon(rest) >= 0 && !/^[[{"']/.test(rest)) throw new YamlError("A mapping inside a block sequence is not part of a calibration file.", line.number);
			else sequence.push(this.readInline(rest, line.number, line.indent));
		}
		return sequence;
	}
	/**
	* Reads a value that starts on one line. A flow collection may continue on the lines after it, as
	* PyYAML writes long matrices, so those lines are drawn in until the brackets balance.
	*/
	readInline(text, number, indent) {
		if (text.startsWith("[") || text.startsWith("{")) {
			let joined = text;
			while (!flowClosed(joined)) {
				const next = this.peek();
				if (!next || next.indent <= indent) throw new YamlError("A bracket is never closed.", number);
				joined += ` ${next.text}`;
				this.index += 1;
			}
			const flow = new FlowReader(joined, number);
			const value = flow.readValue(0);
			flow.expectEnd();
			return value;
		}
		return readScalar(text, number);
	}
};
/** Where the `: ` separating a key from its value is, or -1. Colons inside quotes do not count. */
function findMappingColon(text) {
	let quote;
	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (quote) {
			if (character === "\\" && quote === "\"") index += 1;
			else if (character === quote) quote = void 0;
			continue;
		}
		if (index === 0 && (character === "[" || character === "{")) return -1;
		if (character === "\"" || character === "'") quote = character;
		else if (character === ":" && (index === text.length - 1 || text[index + 1] === " ")) return index;
	}
	return -1;
}
function flowClosed(text) {
	let depth = 0;
	let quote;
	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (quote) {
			if (character === "\\" && quote === "\"") index += 1;
			else if (character === quote) quote = void 0;
			continue;
		}
		if (character === "\"" || character === "'") quote = character;
		else if (character === "[" || character === "{") depth += 1;
		else if (character === "]" || character === "}") depth -= 1;
	}
	return depth <= 0;
}
function readKey(text, number) {
	const value = readScalar(text, number);
	if (typeof value !== "string") return String(value);
	return value;
}
var FlowReader = class {
	constructor(text, number) {
		this.text = text;
		this.number = number;
		this.index = 0;
	}
	readValue(depth) {
		if (depth > MAXIMUM_DEPTH) throw new YamlError("The document is nested too deeply.", this.number);
		this.skipSpace();
		const character = this.text[this.index];
		if (character === "[") return this.readSequence(depth);
		if (character === "{") return this.readMapping(depth);
		return readScalar(this.readToken(), this.number);
	}
	expectEnd() {
		this.skipSpace();
		if (this.index < this.text.length) throw new YamlError("Unexpected text after a closing bracket.", this.number);
	}
	readSequence(depth) {
		this.index += 1;
		const sequence = [];
		this.skipSpace();
		if (this.text[this.index] === "]") {
			this.index += 1;
			return sequence;
		}
		for (;;) {
			sequence.push(this.readValue(depth + 1));
			this.skipSpace();
			const separator = this.text[this.index];
			this.index += 1;
			if (separator === "]") return sequence;
			if (separator !== ",") throw new YamlError("Expected \",\" or \"]\" in a sequence.", this.number);
			this.skipSpace();
			if (this.text[this.index] === "]") {
				this.index += 1;
				return sequence;
			}
		}
	}
	readMapping(depth) {
		this.index += 1;
		const mapping = {};
		this.skipSpace();
		if (this.text[this.index] === "}") {
			this.index += 1;
			return mapping;
		}
		for (;;) {
			this.skipSpace();
			const key = readKey(this.readToken(":"), this.number);
			this.skipSpace();
			if (this.text[this.index] !== ":") throw new YamlError("Expected \":\" after a key.", this.number);
			this.index += 1;
			if (Object.prototype.hasOwnProperty.call(mapping, key)) throw new YamlError(`The key "${key}" appears twice.`, this.number);
			mapping[key] = this.readValue(depth + 1);
			this.skipSpace();
			const separator = this.text[this.index];
			this.index += 1;
			if (separator === "}") return mapping;
			if (separator !== ",") throw new YamlError("Expected \",\" or \"}\" in a mapping.", this.number);
			this.skipSpace();
			if (this.text[this.index] === "}") {
				this.index += 1;
				return mapping;
			}
		}
	}
	/** A quoted string, or plain text up to the next flow delimiter. */
	readToken(stopAlso = "") {
		this.skipSpace();
		const start = this.index;
		const character = this.text[this.index];
		if (character === "\"" || character === "'") {
			this.index += 1;
			while (this.index < this.text.length) {
				const current = this.text[this.index];
				if (current === "\\" && character === "\"") {
					this.index += 2;
					continue;
				}
				if (current === character) {
					if (character === "'" && this.text[this.index + 1] === "'") {
						this.index += 2;
						continue;
					}
					this.index += 1;
					return this.text.slice(start, this.index);
				}
				this.index += 1;
			}
			throw new YamlError("A quoted string is never closed.", this.number);
		}
		while (this.index < this.text.length && !`,]}${stopAlso}`.includes(this.text[this.index])) this.index += 1;
		return this.text.slice(start, this.index).trim();
	}
	skipSpace() {
		while (this.index < this.text.length && /\s/.test(this.text[this.index])) this.index += 1;
	}
};
var INTEGER = /^[-+]?(?:0|[1-9][0-9_]*)$/;
var FLOAT = /^[-+]?(?:[0-9][0-9_]*)?\.?[0-9]*(?:[eE][-+]?[0-9]+)?$/;
function readScalar(text, number) {
	const value = text.trim();
	if (value.length === 0) return null;
	const first = value[0];
	if (first === "\"") return readDoubleQuoted(value, number);
	if (first === "'") {
		if (value.length < 2 || !value.endsWith("'")) throw new YamlError("A quoted string is never closed.", number);
		return value.slice(1, -1).replace(/''/g, "'");
	}
	if (first === "&" || first === "*") throw new YamlError("Anchors and aliases are not read.", number);
	if (first === "!") throw new YamlError("Tags are not read.", number);
	if (first === "|" || first === ">") throw new YamlError("Block scalars are not read.", number);
	if (first === "@" || first === "`") throw new YamlError(`A plain value cannot start with "${first}".`, number);
	if (value === "~" || value === "null" || value === "Null" || value === "NULL") return null;
	if (value === "true" || value === "True" || value === "TRUE") return true;
	if (value === "false" || value === "False" || value === "FALSE") return false;
	if (/^[-+]?\.(?:inf|Inf|INF|nan|NaN|NAN)$/.test(value)) throw new YamlError("Infinity and NaN are not calibration values.", number);
	if (INTEGER.test(value)) return Number(value.replace(/_/g, ""));
	if (/[0-9]/.test(value) && FLOAT.test(value)) {
		const parsed = Number(value.replace(/_/g, ""));
		if (Number.isFinite(parsed)) return parsed;
	}
	return value;
}
function readDoubleQuoted(value, number) {
	if (value.length < 2 || !value.endsWith("\"")) throw new YamlError("A quoted string is never closed.", number);
	const body = value.slice(1, -1);
	let result = "";
	for (let index = 0; index < body.length; index += 1) {
		const character = body[index];
		if (character !== "\\") {
			result += character;
			continue;
		}
		const escape = body[index + 1];
		index += 1;
		switch (escape) {
			case "\"":
			case "\\":
			case "/":
				result += escape;
				break;
			case "n":
				result += "\n";
				break;
			case "t":
				result += "	";
				break;
			case "r":
				result += "\r";
				break;
			case "0":
				result += "\0";
				break;
			case "u": {
				const hex = body.slice(index + 1, index + 5);
				if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new YamlError("Invalid \\u escape.", number);
				result += String.fromCharCode(parseInt(hex, 16));
				index += 4;
				break;
			}
			default: throw new YamlError(`Unsupported escape "\\${escape ?? ""}".`, number);
		}
	}
	return result;
}
/**
* The file a calibration is exchanged in: a ROS `camera_info` YAML document.
*
* The profile contract is how this extension holds a calibration; it is not a format anyone outside
* this family reads. A file an operator carries between machines is better written in the format
* the tools they will meet already read, and for one camera's intrinsics that is the YAML that
* ROS's `camera_calibration_parsers` reads and writes -- OpenCV-based pipelines, ROS and ROS 2
* drivers, and SLAM tools load it as it is.
*
* ROS carries what projection needs and nothing about when or how the camera was configured, which
* is exactly what deciding whether a profile still fits requires. Those members travel in one extra
* top-level mapping, `turbowarp_camera_source`, named after their owner. ROS's reader looks keys up
* by name and never enumerates the document, so a file with the extra mapping still loads there,
* and a file without it is still ROS.
*
* A file that lacks the mapping altogether cannot become a profile: when it was calibrated and which
* run it was are required members, and inventing either would turn "unknown" into a record.
*/
/** The top-level key holding the members ROS has no place for. */
var CAMERA_INFO_EXTENSION_KEY = "turbowarp_camera_source";
var MATRIX_TOLERANCE = 1e-6;
/**
* Every top-level key a ROS file may have, and the extra mapping.
*
* Anything else is refused rather than dropped. A calibration file that carries a key nobody reads
* is either from a tool that means something by it or has had something pasted into it, and a
* profile validator that fails closed does not start ignoring members because they arrived in YAML.
*/
var ROOT_KEYS = /* @__PURE__ */ new Set([
	"image_width",
	"image_height",
	"camera_name",
	"camera_matrix",
	"distortion_model",
	"distortion_coefficients",
	"rectification_matrix",
	"projection_matrix",
	"binning_x",
	"binning_y",
	"roi",
	CAMERA_INFO_EXTENSION_KEY
]);
/** ROS distortion model names, as `sensor_msgs/distortion_models.hpp` spells them. */
var PLUMB_BOB = "plumb_bob";
var RATIONAL_POLYNOMIAL = "rational_polynomial";
var EQUIDISTANT = "equidistant";
var CameraInfoRejection = class extends Error {
	constructor(detail) {
		super(detail.message);
		this.detail = detail;
	}
};
function refuse(code, path, message) {
	throw new CameraInfoRejection({
		code,
		path,
		message
	});
}
/**
* Renders a profile as a ROS `camera_info` YAML document.
*
* The layout follows what `camera_calibration_parsers` writes, key for key and in the same order, so
* the file reads like one ROS produced. The projection matrix is the calibration matrix with a zero
* fourth column, which is what a monocular camera with no rectification has; binning and region of
* interest are left out, as ROS treats them as optional.
*
* Strings in the extra mapping are always double-quoted. A timestamp left plain is read as a date
* by YAML 1.1 readers such as PyYAML, and an id made only of digits as a number.
*/
function serializeCameraInfoYaml(profile) {
	const { fx, fy, cx, cy, skew } = profile.intrinsics;
	const { model, coefficients } = rosDistortion(profile);
	const lines = [
		`image_width: ${profile.image.width}`,
		`image_height: ${profile.image.height}`,
		`camera_name: ${plainOrQuoted(profile.cameraId)}`,
		...matrix("camera_matrix", 3, 3, [
			fx,
			skew,
			cx,
			0,
			fy,
			cy,
			0,
			0,
			1
		]),
		`distortion_model: ${model}`,
		...matrix("distortion_coefficients", 1, coefficients.length, coefficients),
		...matrix("rectification_matrix", 3, 3, [
			1,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			1
		]),
		...matrix("projection_matrix", 3, 4, [
			fx,
			skew,
			cx,
			0,
			0,
			fy,
			cy,
			0,
			0,
			0,
			1,
			0
		]),
		`${CAMERA_INFO_EXTENSION_KEY}:`,
		`  schema: ${quoted(profile.schema)}`,
		`  version: ${profile.version}`,
		`  profileId: ${quoted(profile.profileId)}`,
		`  calibratedAt: ${quoted(profile.calibratedAt)}`,
		`  producer: ${quoted(profile.producer)}`,
		`  undistorted: ${profile.image.undistorted}`
	];
	const capture = profile.capture;
	if (capture !== void 0) {
		lines.push("  capture:");
		if (Object.keys(capture).length === 0) lines[lines.length - 1] += " {}";
		appendMember(lines, "frameRate", capture.frameRate);
		appendMember(lines, "facingMode", capture.facingMode);
		appendMember(lines, "resizeMode", capture.resizeMode);
		appendMember(lines, "zoom", capture.zoom);
		appendMember(lines, "focusMode", capture.focusMode);
		appendMember(lines, "focusDistance", capture.focusDistance);
	}
	if (profile.quality !== void 0) {
		lines.push("  quality:");
		appendMember(lines, "sampleCount", profile.quality.sampleCount);
		appendMember(lines, "reprojectionErrorPx", profile.quality.reprojectionErrorPx);
	}
	if (profile.device !== void 0) {
		lines.push("  device:");
		if (Object.keys(profile.device).length === 0) lines[lines.length - 1] += " {}";
		appendMember(lines, "label", profile.device.label);
		appendMember(lines, "deviceId", profile.device.deviceId);
	}
	return `${lines.join("\n")}\n`;
}
/**
* Turns a ROS `camera_info` YAML document into a profile document, ready to be validated.
*
* Only the shape ROS defines is checked here -- matrix sizes, the fixed entries of the calibration
* matrix, a rectification that does nothing, a distortion model ROS names. Everything the profile
* contract says about the values themselves is left to the profile validator, so there is one
* place that decides whether a calibration is acceptable.
*/
function readCameraInfoYaml(text) {
	let parsed;
	try {
		parsed = parseYaml(text);
	} catch (error) {
		if (error instanceof YamlError) return {
			ok: false,
			error: {
				code: "not-an-object",
				path: "",
				message: `The profile is not valid YAML. ${error.message}`
			}
		};
		throw error;
	}
	return readCameraInfoDocument(parsed);
}
/** Validate a raw ROS mapping without serializing or replacing the editable data. */
function readCameraInfoDocument(parsed) {
	try {
		return {
			ok: true,
			document: toProfileDocument(parsed)
		};
	} catch (error) {
		if (error instanceof CameraInfoRejection) return {
			ok: false,
			error: error.detail
		};
		throw error;
	}
}
function toProfileDocument(parsed) {
	const root = record(parsed, "");
	for (const key of Object.keys(root)) if (!ROOT_KEYS.has(key)) refuse("unexpected-field", key, "Unknown member.");
	readBinningAndRoi(root);
	const width = root["image_width"];
	const height = root["image_height"];
	if (width === void 0) refuse("missing-field", "image_width", "Required member is missing.");
	if (height === void 0) refuse("missing-field", "image_height", "Required member is missing.");
	const k = readMatrix(root, "camera_matrix", 3, 3);
	expectEntries(k, "camera_matrix", [
		[3, 0],
		[6, 0],
		[7, 0],
		[8, 1]
	]);
	if ("rectification_matrix" in root) expectEntries(readMatrix(root, "rectification_matrix", 3, 3), "rectification_matrix", [
		1,
		0,
		0,
		0,
		1,
		0,
		0,
		0,
		1
	].map((value, index) => [index, value]), "A rectification other than identity belongs to a stereo pair, not to one camera's intrinsics.");
	if ("projection_matrix" in root) readMatrix(root, "projection_matrix", 3, 4);
	const distortion = readDistortion(root);
	const extension = root[CAMERA_INFO_EXTENSION_KEY];
	if (extension === void 0) refuse("missing-field", CAMERA_INFO_EXTENSION_KEY, "The file is a ROS camera_info document without the calibration record: when it was calibrated and under which camera settings are not known.");
	const extra = record(extension, CAMERA_INFO_EXTENSION_KEY);
	const known = /* @__PURE__ */ new Set([
		"schema",
		"version",
		"profileId",
		"calibratedAt",
		"producer",
		"undistorted",
		"capture",
		"quality",
		"device"
	]);
	for (const key of Object.keys(extra)) if (!known.has(key)) refuse("unexpected-field", `${CAMERA_INFO_EXTENSION_KEY}.${key}`, "Unknown member.");
	if (extra["schema"] !== "twcs/camera-intrinsics") refuse("unsupported-schema", `${CAMERA_INFO_EXTENSION_KEY}.schema`, `Expected ${JSON.stringify(CAMERA_INTRINSIC_PROFILE_SCHEMA)}.`);
	if (extra["version"] !== 1) refuse("unsupported-version", `${CAMERA_INFO_EXTENSION_KEY}.version`, `Expected 1.`);
	const undistorted = extra["undistorted"] ?? false;
	return {
		schema: CAMERA_INTRINSIC_PROFILE_SCHEMA,
		version: 1,
		profileId: extra["profileId"],
		cameraId: root["camera_name"],
		calibratedAt: extra["calibratedAt"],
		producer: extra["producer"],
		cameraModel: "pinhole",
		image: {
			width,
			height,
			undistorted
		},
		intrinsics: {
			fx: k[0],
			fy: k[4],
			cx: k[2],
			cy: k[5],
			skew: k[1]
		},
		distortion,
		..."capture" in extra ? { capture: extra["capture"] } : {},
		..."quality" in extra ? { quality: extra["quality"] } : {},
		..."device" in extra ? { device: extra["device"] } : {}
	};
}
/**
* Maps a ROS distortion model onto the profile's.
*
* `plumb_bob` coefficients that are all zero read as no distortion. ROS has no model for "none"; a
* lens-free image is written as plumb_bob with five zeros, and reading it back must not invent a
* Brown-Conrady lens that happens to do nothing.
*/
function readDistortion(root) {
	const rawModel = root["distortion_model"] ?? PLUMB_BOB;
	const coefficients = readMatrix(root, "distortion_coefficients", 1, void 0);
	switch (rawModel) {
		case PLUMB_BOB:
			if (coefficients.length !== 4 && coefficients.length !== 5) refuse("invalid-distortion", "distortion_coefficients", `plumb_bob takes 5 coefficients, not ${coefficients.length}.`);
			return isAllZero(coefficients) ? {
				model: "none",
				coefficients: []
			} : {
				model: "brown-conrady",
				coefficients
			};
		case RATIONAL_POLYNOMIAL:
			if (coefficients.length !== 8) refuse("invalid-distortion", "distortion_coefficients", `rational_polynomial takes 8 coefficients, not ${coefficients.length}.`);
			return {
				model: "brown-conrady",
				coefficients
			};
		case EQUIDISTANT:
			if (coefficients.length !== 4) refuse("invalid-distortion", "distortion_coefficients", `equidistant takes 4 coefficients, not ${coefficients.length}.`);
			return {
				model: "kannala-brandt",
				coefficients
			};
		default: refuse("invalid-distortion", "distortion_model", `Expected ${PLUMB_BOB}, ${RATIONAL_POLYNOMIAL} or ${EQUIDISTANT}.`);
	}
}
/**
* Binning and a region of interest change which pixels the calibration describes. ROS writes both
* with their do-nothing values, and only those are accepted: a calibration of a binned or cropped
* image is a different calibration, and reading it as the full frame's would move the principal
* point without anyone noticing.
*/
function readBinningAndRoi(root) {
	for (const name of ["binning_x", "binning_y"]) {
		const value = root[name];
		if (value !== void 0 && value !== 0 && value !== 1) refuse("inconsistent-profile", name, "A binned image is not the image the calibration describes.");
	}
	const roi = root["roi"];
	if (roi === void 0) return;
	const region = record(roi, "roi");
	const width = region["width"] ?? 0;
	const height = region["height"] ?? 0;
	const offsetX = region["x_offset"] ?? 0;
	const offsetY = region["y_offset"] ?? 0;
	const whole = width === 0 && height === 0;
	const full = width === root["image_width"] && height === root["image_height"];
	if (offsetX !== 0 || offsetY !== 0 || !(whole || full)) refuse("inconsistent-profile", "roi", "A region of interest is not the image the calibration describes.");
}
function rosDistortion(profile) {
	const coefficients = [...profile.distortion.coefficients];
	switch (profile.distortion.model) {
		case "none": return {
			model: PLUMB_BOB,
			coefficients: [
				0,
				0,
				0,
				0,
				0
			]
		};
		case "kannala-brandt": return {
			model: EQUIDISTANT,
			coefficients
		};
		case "brown-conrady":
			if (coefficients.length === 8) return {
				model: RATIONAL_POLYNOMIAL,
				coefficients
			};
			return {
				model: PLUMB_BOB,
				coefficients: coefficients.length === 4 ? [...coefficients, 0] : coefficients
			};
	}
}
function readMatrix(root, name, rows, cols) {
	const value = root[name];
	if (value === void 0) refuse("missing-field", name, "Required member is missing.");
	const matrix = record(value, name);
	const declaredRows = matrix["rows"];
	const declaredCols = matrix["cols"];
	const data = matrix["data"];
	if (declaredRows !== rows) refuse("invalid-value", `${name}.rows`, `Expected ${rows}.`);
	if (cols !== void 0 && declaredCols !== cols) refuse("invalid-value", `${name}.cols`, `Expected ${cols}.`);
	if (typeof declaredCols !== "number" || !Number.isInteger(declaredCols) || declaredCols < 0) refuse("invalid-value", `${name}.cols`, "Expected a column count.");
	if (!Array.isArray(data)) refuse("invalid-type", `${name}.data`, "Expected a sequence of numbers.");
	if (data.length !== rows * declaredCols) refuse("invalid-value", `${name}.data`, `Expected ${rows * declaredCols} numbers for a ${rows}x${declaredCols} matrix, not ${data.length}.`);
	return data.map((entry, index) => {
		if (typeof entry !== "number" || !Number.isFinite(entry)) refuse("invalid-type", `${name}.data[${index}]`, "Expected a number.");
		return entry;
	});
}
function expectEntries(data, name, entries, message) {
	for (const [index, expected] of entries) if (Math.abs(data[index] - expected) > MATRIX_TOLERANCE) refuse("inconsistent-profile", `${name}.data[${index}]`, message ?? `Expected ${expected}; the value read as ${data[index]}.`);
}
function record(value, path) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) refuse("not-an-object", path, "Expected a mapping.");
	return value;
}
function isAllZero(values) {
	return values.every((value) => value === 0);
}
function matrix(name, rows, cols, data) {
	return [
		`${name}:`,
		`  rows: ${rows}`,
		`  cols: ${cols}`,
		`  data: [${data.map(number).join(", ")}]`
	];
}
/** Numbers as JavaScript writes them, which is the shortest text that reads back to the same value. */
function number(value) {
	return Object.is(value, -0) ? "0" : String(value);
}
function quoted(text) {
	return JSON.stringify(text);
}
/** Camera names are identifiers and read the same plain, which is how ROS writes them. */
function plainOrQuoted(text) {
	return /^[A-Za-z][A-Za-z0-9._-]*$/.test(text) && !/^(?:true|false|null|yes|no|on|off|y|n)$/i.test(text) ? text : quoted(text);
}
function appendMember(lines, name, value) {
	if (value === void 0) return;
	lines.push(`    ${name}: ${typeof value === "string" ? quoted(value) : number(value)}`);
}
function bundle(document, filename, variantId) {
	const source = {
		repository: "turbowarp-camera-source",
		path: "schemas/" + filename
	};
	return {
		identity: {
			ownerId: "turbowarp-camera-source",
			contractId: "camera-profile",
			revision: "profile-v0.16.0",
			variantId
		},
		dialect: "2020-12",
		root: {
			retrievalUri: document.$id,
			document,
			artifact: {
				role: "canonical-schema",
				source
			}
		},
		resources: [],
		provenance: {
			canonicalSources: [source],
			generatedFiles: [],
			referenceSchemas: [],
			generationSources: []
		}
	};
}
var cameraProfileSchemaBundles = {
	twcs: bundle(camera_intrinsics_v1_default, "camera-intrinsics-v1.json", "twcs"),
	legacy: bundle(editor_legacy_calibration_default, "editor-legacy-calibration.json", "legacy"),
	ros: bundle(editor_ros_camera_info_default, "editor-ros-camera-info.json", "ros")
};
/** Raw edit values stay separate from any normalized profile returned by the owner. */
function readCameraProfileInput(data) {
	if (data && typeof data === "object" && Object.hasOwn(data, "image_width")) {
		const read = readCameraInfoDocument(data);
		return read.ok ? readCameraProfileDocument(read.document) : read;
	}
	return readCameraProfileDocument(data);
}
var validateCameraProfileInput = (data) => {
	const result = readCameraProfileInput(data);
	return result.ok ? {
		kind: "valid",
		issues: []
	} : {
		kind: "invalid",
		issues: [{
			dataPath: "",
			ruleId: result.error.code
		}]
	};
};
function decodeCameraProfileSource(source) {
	const json = source.trim().startsWith("{");
	const data = json ? JSON.parse(source.trim()) : parseYaml(source.trim());
	let variantId;
	if (!json) variantId = "ros";
	else if (data && typeof data === "object" && "schema" in data && data.schema === "twcs/camera-intrinsics") variantId = "twcs";
	else if (data && typeof data === "object" && "schema" in data && data.schema === "twrmc/camera-calibration") variantId = "legacy";
	else throw new TypeError("Unrecognized camera profile variant.");
	return {
		source,
		format: json ? "json" : "yaml",
		variantId,
		data
	};
}
/** Decode and apply the runtime owner's pure rules to the exact commit candidate.
* The common GUI compiles the supplied SchemaBundle and checks schema constraints separately.
* This boundary deliberately performs no schema compilation or GUI initialization.
*/
function validateCameraProfileSource(source, context) {
	let consumerId;
	try {
		const descriptor = Object.getOwnPropertyDescriptor(context, "consumerId");
		if (descriptor && "value" in descriptor && typeof descriptor.value === "string") consumerId = descriptor.value;
	} catch {}
	let decoded;
	try {
		decoded = decodeCameraProfileSource(source);
	} catch (error) {
		const code = error instanceof TypeError && error.message === "Unrecognized camera profile variant." ? "variant-unrecognized" : "input-format-invalid";
		return {
			source,
			result: {
				kind: "invalid",
				diagnostics: [{
					scope: {
						identity: {
							...cameraProfileSchemaBundles.twcs.identity,
							variantId: "unrecognized"
						},
						...consumerId === void 0 ? {} : { consumerId }
					},
					phase: "decode",
					code,
					dataPath: ""
				}]
			}
		};
	}
	const result = validateCameraProfileInput(decoded.data, context);
	return {
		...decoded,
		result: result.kind === "valid" ? {
			kind: "valid",
			diagnostics: []
		} : {
			kind: "invalid",
			diagnostics: result.issues.map((issue) => ({
				scope: {
					identity: cameraProfileSchemaBundles[decoded.variantId].identity,
					...consumerId === void 0 ? {} : { consumerId }
				},
				phase: "owner",
				code: issue.ruleId,
				dataPath: issue.dataPath
			}))
		}
	};
}
function checkedSource(value) {
	return value.result.kind === "valid" ? {
		source: value.source,
		result: {
			kind: "valid",
			diagnostics: []
		}
	} : {
		source: value.source,
		result: {
			kind: value.result.kind,
			diagnostics: value.result.diagnostics
		}
	};
}
/** Presentation is opt-in at the common GUI; schema and stored profile shape stay authoritative. */
var cameraProfileUiSchemas = {
	twcs: {
		"ui:options": { extensionDataLayout: {
			version: 1,
			items: [{ tabs: [
				{
					label: "Profile",
					items: [{
						group: "Identity",
						items: [
							{ field: "profileId" },
							{ field: "cameraId" },
							{ field: "calibratedAt" },
							{ field: "producer" }
						]
					}, {
						group: "Contract",
						items: [
							{ field: "schema" },
							{ field: "version" },
							{ field: "cameraModel" }
						]
					}]
				},
				{
					label: "Camera",
					items: [
						{ field: "image" },
						{ field: "intrinsics" },
						{ field: "distortion" }
					]
				},
				{
					label: "Capture",
					items: [
						{ field: "capture" },
						{ field: "quality" },
						{ field: "device" }
					]
				}
			] }]
		} },
		image: { "ui:options": { extensionDataLayout: {
			version: 1,
			items: [{
				grid: 2,
				items: [{ field: "width" }, { field: "height" }]
			}, { field: "undistorted" }]
		} } },
		intrinsics: { "ui:options": { extensionDataLayout: {
			version: 1,
			items: [{
				grid: 2,
				items: [
					{ field: "fx" },
					{ field: "fy" },
					{ field: "cx" },
					{ field: "cy" }
				]
			}, { field: "skew" }]
		} } }
	},
	legacy: { "ui:options": { extensionDataLayout: {
		version: 1,
		items: [{ tabs: [
			{
				label: "Profile",
				items: [
					{
						group: "Identity",
						items: [
							{ field: "calibrationId" },
							{ field: "cameraId" },
							{ field: "calibratedAt" }
						]
					},
					{ field: "schema" },
					{ field: "version" }
				]
			},
			{
				label: "Camera",
				items: [
					{
						grid: 2,
						items: [{ field: "imageWidth" }, { field: "imageHeight" }]
					},
					{ field: "intrinsicMatrix" },
					{ field: "distortionCoefficients" }
				]
			},
			{
				label: "World",
				items: [{ field: "worldFromCameraMatrix" }, { field: "worldUnit" }]
			}
		] }]
	} } },
	ros: { "ui:options": { extensionDataLayout: {
		version: 1,
		items: [{ tabs: [
			{
				label: "Image",
				items: [
					{ field: "camera_name" },
					{
						grid: 2,
						items: [{ field: "image_width" }, { field: "image_height" }]
					},
					{ field: "turbowarp_camera_source" }
				]
			},
			{
				label: "Matrices",
				items: [
					{ field: "camera_matrix" },
					{ field: "distortion_model" },
					{ field: "distortion_coefficients" },
					{ field: "rectification_matrix" },
					{ field: "projection_matrix" }
				]
			},
			{
				label: "Region",
				items: [{
					grid: 2,
					items: [{ field: "binning_x" }, { field: "binning_y" }]
				}, { field: "roi" }]
			}
		] }]
	} } }
};
function createSourceEditorOptions(nowMs = Date.now) {
	const context = () => ({
		consumerId: extensionConfig.id,
		nowMs: nowMs(),
		settings: null
	});
	return [{
		apiVersion: 1,
		extensionId: extensionConfig.id,
		editorId: "camera-profile-source",
		opcodes: ["registerCameraProfile", "registerCameraProfileAs"].map((opcode) => `${extensionConfig.id}_${opcode}`),
		bindings: [{
			argument: "PROFILE_JSON",
			variants: Object.entries(cameraProfileSchemaBundles).map(([variantId, schemaBundle]) => ({
				variantId,
				format: variantId === "ros" ? "yaml" : "json",
				schemaBundle,
				uiSchema: cameraProfileUiSchemas[variantId]
			})),
			decode: (source) => {
				const decoded = decodeCameraProfileSource(source);
				return {
					...decoded,
					data: decoded.data
				};
			},
			validateSource: (source, context) => checkedSource(validateCameraProfileSource(source, context))
		}],
		validationContext: context
	}];
}
/** Optional capability: old GUIs continue executing blocks without editor registration. */
function registerSourceEditors(scratch, nowMs = Date.now) {
	const api = scratch?.gui?.blockEditors;
	if (api?.apiVersion !== 1 || typeof api.registerSourceEditor !== "function") return () => {};
	const removers = [];
	try {
		for (const options of createSourceEditorOptions(nowMs)) removers.push(api.registerSourceEditor(options));
	} catch {
		for (const remove of removers.reverse()) remove();
		return () => {};
	}
	let active = true;
	return () => {
		if (active) {
			active = false;
			for (const remove of removers.reverse()) remove();
		}
	};
}
var block_definitions_default = {
	extensionName: "Camera Source",
	blocks: [
		{
			"opcode": "startSharedCamera",
			"blockType": "COMMAND",
			"text": "start shared camera [CAMERA_ID] with device ID [DEVICE_ID]",
			"arguments": {
				"CAMERA_ID": {
					"type": "STRING",
					"defaultValue": "default"
				},
				"DEVICE_ID": {
					"type": "STRING",
					"defaultValue": ""
				}
			}
		},
		{
			"opcode": "startRequestedSharedCamera",
			"blockType": "COMMAND",
			"text": "start shared camera [CAMERA_ID] requested by this page",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "startSharedCameraFromCameraButton",
			"blockType": "COMMAND",
			"text": "start shared camera [CAMERA_ID] from the browser's camera button",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "hideCameraButton",
			"blockType": "COMMAND",
			"text": "hide the camera button for shared camera [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraButtonAvailable",
			"blockType": "BOOLEAN",
			"text": "browser's camera button available?",
			"arguments": {}
		},
		{
			"opcode": "stopSharedCamera",
			"blockType": "COMMAND",
			"text": "stop shared camera [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "isCameraRunning",
			"blockType": "BOOLEAN",
			"text": "shared camera [CAMERA_ID] is running?",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraErrorCode",
			"blockType": "REPORTER",
			"text": "shared camera [CAMERA_ID] error code",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraError",
			"blockType": "REPORTER",
			"text": "shared camera [CAMERA_ID] error",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraDeviceIdReporter",
			"blockType": "REPORTER",
			"text": "shared camera [CAMERA_ID] device ID",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "showCameraPreview",
			"blockType": "COMMAND",
			"text": "show shared camera [CAMERA_ID] preview flipped [PREVIEW_FLIP]",
			"arguments": {
				"CAMERA_ID": {
					"type": "STRING",
					"defaultValue": "default"
				},
				"PREVIEW_FLIP": {
					"type": "STRING",
					"defaultValue": "horizontal",
					"menu": "flips"
				}
			}
		},
		{
			"opcode": "hideCameraPreview",
			"blockType": "COMMAND",
			"text": "hide shared camera [CAMERA_ID] preview",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraFrameWidth",
			"blockType": "REPORTER",
			"text": "shared camera [CAMERA_ID] frame width",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraFrameHeight",
			"blockType": "REPORTER",
			"text": "shared camera [CAMERA_ID] frame height",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraFrameRate",
			"blockType": "REPORTER",
			"text": "shared camera [CAMERA_ID] frame rate",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "refreshCameraDevices",
			"blockType": "COMMAND",
			"text": "refresh camera devices",
			"arguments": {}
		},
		{
			"opcode": "cameraDeviceCount",
			"blockType": "REPORTER",
			"text": "camera device count",
			"arguments": {}
		},
		{
			"opcode": "cameraDeviceIdAt",
			"blockType": "REPORTER",
			"text": "camera device ID at [INDEX]",
			"arguments": { "INDEX": {
				"type": "STRING",
				"defaultValue": "1"
			} }
		},
		{
			"opcode": "cameraDeviceLabelAt",
			"blockType": "REPORTER",
			"text": "camera device label at [INDEX]",
			"arguments": { "INDEX": {
				"type": "STRING",
				"defaultValue": "1"
			} }
		},
		{
			"opcode": "registerCameraProfile",
			"blockType": "COMMAND",
			"text": "register camera profile [PROFILE_JSON]",
			"arguments": { "PROFILE_JSON": {
				"type": "STRING",
				"defaultValue": "{}"
			} }
		},
		{
			"opcode": "registerCameraProfileAs",
			"blockType": "COMMAND",
			"text": "register camera profile [PROFILE_JSON] as [CAMERA_ID]",
			"arguments": {
				"PROFILE_JSON": {
					"type": "STRING",
					"defaultValue": "{}"
				},
				"CAMERA_ID": {
					"type": "STRING",
					"defaultValue": "default"
				}
			}
		},
		{
			"opcode": "forgetCameraProfile",
			"blockType": "COMMAND",
			"text": "forget camera profile for [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraProfileRegistered",
			"blockType": "BOOLEAN",
			"text": "camera [CAMERA_ID] is calibrated?",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraProfileJson",
			"blockType": "REPORTER",
			"text": "camera profile JSON for [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraProfileYaml",
			"blockType": "REPORTER",
			"text": "camera profile YAML for [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraProfileError",
			"blockType": "REPORTER",
			"text": "camera profile error",
			"arguments": {}
		},
		{
			"opcode": "cameraProfileErrorDetail",
			"blockType": "REPORTER",
			"text": "camera profile error detail",
			"arguments": {}
		},
		{
			"opcode": "cameraProfileCompatibility",
			"blockType": "REPORTER",
			"text": "camera profile compatibility for [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraProfileCompatibilityDetail",
			"blockType": "REPORTER",
			"text": "camera profile compatibility detail for [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraProfileAdaptation",
			"blockType": "REPORTER",
			"text": "camera profile adaptation for [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraProfileIntrinsicsJson",
			"blockType": "REPORTER",
			"text": "camera intrinsics JSON for [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraConditionsJson",
			"blockType": "REPORTER",
			"text": "camera conditions JSON for [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraConditionsGeneration",
			"blockType": "REPORTER",
			"text": "camera conditions generation for [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "saveCameraProfile",
			"blockType": "COMMAND",
			"text": "save camera profile for [CAMERA_ID] to browser storage",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "restoreStoredCameraProfile",
			"blockType": "COMMAND",
			"text": "restore stored camera profile for [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "restoreStoredCameraProfileForDevice",
			"blockType": "COMMAND",
			"text": "restore stored camera profile calibrated on the device of [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "bindCameraProfileToDevice",
			"blockType": "COMMAND",
			"text": "bind camera profile for [CAMERA_ID] to its current device",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "cameraProfileOnDevice",
			"blockType": "BOOLEAN",
			"text": "camera profile for [CAMERA_ID] belongs to its current device?",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "storedCameraProfileResult",
			"blockType": "REPORTER",
			"text": "stored camera profile result for [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "storedCameraProfileDetail",
			"blockType": "REPORTER",
			"text": "stored camera profile detail for [CAMERA_ID]",
			"arguments": { "CAMERA_ID": {
				"type": "STRING",
				"defaultValue": "default"
			} }
		},
		{
			"opcode": "storedCameraProfilesGeneration",
			"blockType": "REPORTER",
			"text": "stored camera profiles generation",
			"arguments": {}
		}
	],
	menus: { "flips": {
		"acceptReporters": true,
		"items": [
			"none",
			"horizontal",
			"vertical",
			"both"
		]
	} }
};
function positiveNumber(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
function nonNegativeNumber(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : void 0;
}
function nonEmptyText(value) {
	if (typeof value !== "string") return void 0;
	const text = value.trim();
	return text.length === 0 ? void 0 : text;
}
function pixelCount(value) {
	return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}
/**
* Builds the conditions record.
*
* Frame size comes from the delivered frame rather than from the track settings: a track can report
* a requested size that the browser then satisfies with something else, and the number a consumer
* has to match its intrinsics against is the size of the image it is actually handed.
*/
function readCameraConditions(frame, settings = {}) {
	const label = nonEmptyText(frame.label);
	const frameRate = positiveNumber(settings.frameRate);
	const facingMode = nonEmptyText(settings.facingMode);
	const resizeMode = nonEmptyText(settings.resizeMode);
	const zoom = positiveNumber(settings.zoom);
	const focusMode = nonEmptyText(settings.focusMode);
	const focusDistance = nonNegativeNumber(settings.focusDistance);
	return {
		width: pixelCount(frame.width),
		height: pixelCount(frame.height),
		deviceId: nonEmptyText(frame.deviceId) ?? nonEmptyText(settings.deviceId) ?? "",
		previewFlip: frame.previewFlip,
		...label === void 0 ? {} : { label },
		...frameRate === void 0 ? {} : { frameRate },
		...facingMode === void 0 ? {} : { facingMode },
		...resizeMode === void 0 ? {} : { resizeMode },
		...zoom === void 0 ? {} : { zoom },
		...focusMode === void 0 ? {} : { focusMode },
		...focusDistance === void 0 ? {} : { focusDistance }
	};
}
/** Zoom readings are device-reported floats; compare them with a tolerance rather than exactly. */
var ZOOM_TOLERANCE = 1e-6;
var FOCUS_DISTANCE_TOLERANCE = 1e-6;
function finding(code, state, decisive, detail) {
	return {
		code,
		state,
		decisive,
		detail
	};
}
function describe(value) {
	return value === void 0 ? "not reported" : String(value);
}
/**
* Compares one optical member.
*
* Absent on both sides is agreement, not ignorance: the device reported no such control when the
* calibration was solved and reports none now. Present on one side only is a change nobody can
* quantify, so it is left unknown rather than guessed in either direction.
*/
function compareMember(code, name, recorded, observed, equal) {
	if (recorded === void 0 && observed === void 0) return finding(code, "matched", true, `Neither the profile nor the camera reports ${name}.`);
	if (recorded === void 0 || observed === void 0) return finding(code, "unknown", true, `${name} is ${describe(recorded)} in the profile and ${describe(observed)} now, so the two cannot be compared.`);
	const same = equal(recorded, observed);
	return finding(code, same ? "matched" : "mismatched", true, same ? `${name} is ${describe(observed)} in both.` : `${name} was ${describe(recorded)} at calibration and is ${describe(observed)} now.`);
}
var sameText = (left, right) => left === right;
var nearlyEqual = (tolerance) => (left, right) => Math.abs(left - right) <= tolerance;
function captureFindings(capture, conditions) {
	return [
		compareMember("resize-mode", "Resize mode", capture.resizeMode, conditions.resizeMode, sameText),
		compareMember("zoom", "Zoom", capture.zoom, conditions.zoom, nearlyEqual(ZOOM_TOLERANCE)),
		compareMember("focus-mode", "Focus mode", capture.focusMode, conditions.focusMode, sameText),
		compareMember("focus-distance", "Focus distance", capture.focusDistance, conditions.focusDistance, nearlyEqual(FOCUS_DISTANCE_TOLERANCE))
	];
}
function imageSizeFinding(profile, conditions) {
	const expected = `${profile.image.width}x${profile.image.height}`;
	if (conditions.width === 0 || conditions.height === 0) return finding("image-size", "unknown", true, `The camera has delivered no frame yet, so its size cannot be compared with the calibrated ${expected}.`);
	const actual = `${conditions.width}x${conditions.height}`;
	return actual === expected ? finding("image-size", "matched", true, `The frame is ${actual}, as calibrated.`) : finding("image-size", "mismatched", true, `The calibration was solved at ${expected} and the camera now delivers ${actual}.`);
}
function deviceFindings(profile, conditions) {
	const recordedLabel = profile.device?.label;
	const observedLabel = conditions.label;
	const label = recordedLabel !== void 0 && observedLabel !== void 0 ? finding("device-label", recordedLabel === observedLabel ? "matched" : "mismatched", true, recordedLabel === observedLabel ? `The camera still reports itself as ${observedLabel}.` : `The profile was solved on ${recordedLabel} and the camera now reports ${observedLabel}.`) : finding("device-label", "unknown", false, "A device label is missing on one side, which is normal before the browser grants camera permission.");
	const recordedId = profile.device?.deviceId;
	const observedId = conditions.deviceId.length === 0 ? void 0 : conditions.deviceId;
	return [label, finding("device-id", recordedId !== void 0 && observedId !== void 0 && recordedId === observedId ? "matched" : "unknown", false, "A device id is scoped to one browser and profile, so it changes without the camera changing. It is a hint for ordering candidates, never proof of identity.")];
}
/**
* Judges a profile against the conditions a camera reports.
*
* The verdict is `incompatible` when any decisive finding mismatched, `undetermined` when any
* decisive finding could not be settled, and `compatible` only when every decisive finding matched.
* Unknown never resolves upward into `compatible`.
*/
function evaluateProfileCompatibility(profile, conditions) {
	const findings = [imageSizeFinding(profile, conditions)];
	if (profile.image.undistorted) findings.push(finding("undistorted-frames", "unknown", true, "The profile describes already undistorted images. This extension hands over the camera frames as captured and cannot confirm that something upstream corrects them."));
	if (profile.capture === void 0) findings.push(finding("capture-conditions", "unknown", true, "The profile records no capture conditions, so whether the optics are configured as they were at calibration cannot be decided."));
	else findings.push(...captureFindings(profile.capture, conditions));
	findings.push(finding("frame-rate", "matched", false, `Frame rate was ${describe(profile.capture?.frameRate)} at calibration and is ${describe(conditions.frameRate)} now. It does not change how the lens projects.`), finding("facing-mode", "matched", false, `Facing mode was ${describe(profile.capture?.facingMode)} at calibration and is ${describe(conditions.facingMode)} now.`), ...deviceFindings(profile, conditions));
	const decisive = findings.filter((entry) => entry.decisive);
	return {
		state: decisive.some((entry) => entry.state === "mismatched") ? "incompatible" : decisive.some((entry) => entry.state === "unknown") ? "undetermined" : "compatible",
		findings
	};
}
/** The findings that decided the verdict, in the order they were made. */
function decisiveFindings(report) {
	return report.findings.filter((entry) => entry.decisive && entry.state !== "matched");
}
/** Aspect ratios are compared with a tolerance; reported sizes are whole pixels. */
var ASPECT_TOLERANCE = .001;
function adaptProfileToConditions(profile, conditions) {
	const { width: calibratedWidth, height: calibratedHeight } = profile.image;
	const { width, height } = conditions;
	if (width === 0 || height === 0) return {
		state: "unavailable",
		code: "no-frame",
		width,
		height,
		scale: 1,
		detail: "The camera has delivered no frame yet, so there is no size to adapt to."
	};
	if (width === calibratedWidth && height === calibratedHeight) return {
		state: "exact",
		code: "exact",
		intrinsics: profile.intrinsics,
		width,
		height,
		scale: 1,
		detail: `The frame is ${width}x${height}, as calibrated.`
	};
	if (profile.image.undistorted) return {
		state: "unavailable",
		code: "undistorted-frames",
		width,
		height,
		scale: 1,
		detail: "The profile describes already undistorted images, so it cannot be re-expressed for a different frame size here."
	};
	if (profile.capture?.resizeMode === "crop-and-scale") return {
		state: "unavailable",
		code: "cropped",
		width,
		height,
		scale: 1,
		detail: "The track was calibrated with crop-and-scale resizing, so a different frame size may be a crop rather than a scale and the principal point cannot be placed."
	};
	const scaleX = width / calibratedWidth;
	const scaleY = height / calibratedHeight;
	if (Math.abs(scaleX - scaleY) > ASPECT_TOLERANCE) return {
		state: "unavailable",
		code: "aspect-changed",
		width,
		height,
		scale: 1,
		detail: `The calibrated ${calibratedWidth}x${calibratedHeight} and the current ${width}x${height} have different aspect ratios, so the difference is not a scale.`
	};
	const scale = (scaleX + scaleY) / 2;
	return {
		state: "scaled",
		code: "uniform-scale",
		intrinsics: scaleIntrinsics(profile.intrinsics, scale),
		width,
		height,
		scale,
		detail: `The calibrated ${calibratedWidth}x${calibratedHeight} has been scaled by ${scale} to the current ${width}x${height}.`
	};
}
function scaleIntrinsics(intrinsics, scale) {
	return {
		fx: intrinsics.fx * scale,
		fy: intrinsics.fy * scale,
		cx: intrinsics.cx * scale,
		cy: intrinsics.cy * scale,
		skew: intrinsics.skew
	};
}
/**
* The intrinsics to use, if there are any.
*
* Both conditions have to hold, and they are different questions. Compatibility asks whether this
* profile describes this camera as it is configured now; adaptation asks whether the numbers can be
* expressed for the frame size in front of us. A profile can fit the camera and still have no usable
* form — a crop, say — and it can adapt cleanly while belonging to a different camera entirely.
*
* Returning undefined rather than the stored numbers is the whole point. Intrinsics from another
* configuration do not fail visibly: they project, and the geometry that comes back looks like a
* slightly different camera pose rather than like a mistake.
*/
function usableIntrinsics(compatibility, adaptation) {
	if (compatibility.state !== "compatible") return void 0;
	if (adaptation.intrinsics === void 0) return void 0;
	return {
		...adaptation.intrinsics,
		width: adaptation.width,
		height: adaptation.height,
		scale: adaptation.scale,
		adaptation: adaptation.state
	};
}
/**
* The profiles this runtime knows about.
*
* Producer-agnostic by construction: a profile arrives as a document that
* either passes validation or does not, and nothing here can tell chessboard
* calibration from an operator pasting JSON. Naming a producing extension would
* undo the split that keeps this package free of runtime dependencies.
*
* Registration is keyed by `cameraId`, not by `profileId`: a camera has one
* calibration in force at a time, and a fresh solve replaces the previous one
* rather than accumulating beside it.
*/
var CameraProfileRegistry = class {
	constructor() {
		this.profiles = /* @__PURE__ */ new Map();
	}
	/**
	* Validates a document and, only if it passes, stores it.
	*
	* Both the current contract and the `twrmc/camera-calibration` file an operator may still be
	* carrying are accepted; the second is converted on the way in, dropping the world pose it
	* carried rather than letting a stale extrinsic arrive as a placement.
	*
	* Nothing is written before the document has been checked. A half-registered
	* profile would be indistinguishable from a good one at the point of use.
	*/
	register(document) {
		const result = readCameraProfileDocument(document);
		if (!result.ok) return result;
		this.profiles.set(result.profile.cameraId, result.profile);
		return result;
	}
	forget(cameraId) {
		return this.profiles.delete(cameraId.trim());
	}
	clear() {
		this.profiles.clear();
	}
	get(cameraId) {
		return this.profiles.get(cameraId.trim());
	}
	has(cameraId) {
		return this.profiles.has(cameraId.trim());
	}
	cameraIds() {
		return [...this.profiles.keys()].sort();
	}
	/**
	* The profile for a camera, judged against how that camera is configured now.
	*
	* Absent when the camera has never been calibrated. Callers that need one say so themselves.
	*/
	assess(cameraId, conditions) {
		const profile = this.get(cameraId);
		if (!profile) return void 0;
		const compatibility = evaluateProfileCompatibility(profile, conditions);
		const adaptation = adaptProfileToConditions(profile, conditions);
		const usable = usableIntrinsics(compatibility, adaptation);
		return {
			profile,
			compatibility,
			adaptation,
			...usable === void 0 ? {} : { usable }
		};
	}
};
/**
* Profile text as an operator hands it over: a ROS `camera_info` YAML file, or profile JSON.
*
* The operator does not know which one a file is and should not have to. JSON always starts with a
* brace; a calibration YAML file never does, because its top level is a block mapping. That one
* character decides, and each branch names what it expected when the text is not what it looked
* like.
*/
function readProfileText(text) {
	const trimmed = text.trim();
	if (trimmed.length === 0) return {
		ok: false,
		error: {
			code: "not-an-object",
			path: "",
			message: "The profile is empty."
		}
	};
	if (trimmed.startsWith("{")) try {
		return {
			ok: true,
			document: JSON.parse(trimmed)
		};
	} catch {
		return {
			ok: false,
			error: {
				code: "not-an-object",
				path: "",
				message: "The profile is not valid JSON."
			}
		};
	}
	return readCameraInfoYaml(trimmed);
}
/**
* Profiles kept in the browser between sessions.
*
* A cache, not a backup. IndexedDB belongs to one origin in one browser profile, and the browser may
* evict it; the exported file stays the thing an operator keeps. What this buys is the common case:
* the calibration app and the app that uses its result are served from the same origin, so a solve
* saved in one window can be picked up by the other without a file changing hands.
*
* The store holds documents and says nothing about whether one fits a camera. That is decided when
* a profile is restored, against the camera as it is then, by the same validation and compatibility
* rules every other way in goes through.
*/
var cameraProfileDatabaseName = "kubohiroya-camera-source";
var cameraProfileObjectStoreName = "camera-profiles";
/** Other windows on the same origin hear about a save here. The message is `{profileId}`. */
var cameraProfileChannelName = "kubohiroya-camera-source:camera-profiles";
function isText(value) {
	return typeof value === "string";
}
/**
* Whether a value read back has the shape of a record.
*
* The database outlives this build. Anything another version, or a developer console, left behind is
* skipped here rather than handed on as if this build had written it.
*/
function isStoredCameraProfile(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return isText(record["profileId"]) && isText(record["cameraId"]) && isText(record["calibratedAt"]) && isText(record["savedAt"]) && isText(record["document"]) && (record["deviceLabel"] === void 0 || isText(record["deviceLabel"]));
}
function settle(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? /* @__PURE__ */ new Error("IndexedDB request failed."));
	});
}
/**
* The IndexedDB store.
*
* The database is opened on first use, not on construction: every project that loads this extension
* would otherwise create it, including the ones that never save a profile. A failed open is not
* remembered, so a later call gets another attempt instead of inheriting one bad moment for good.
*/
function createIndexedDbCameraProfileStore(factory = globalThis.indexedDB) {
	let opening;
	const database = () => {
		if (!factory) return Promise.reject(/* @__PURE__ */ new Error("IndexedDB is not available."));
		if (!opening) {
			const request = factory.open(cameraProfileDatabaseName, 1);
			request.onupgradeneeded = () => {
				if (!request.result.objectStoreNames.contains("camera-profiles")) request.result.createObjectStore(cameraProfileObjectStoreName, { keyPath: "profileId" });
			};
			opening = settle(request).then((db) => {
				db.onversionchange = () => {
					db.close();
					opening = void 0;
				};
				return db;
			});
			opening.catch(() => {
				opening = void 0;
			});
		}
		return opening;
	};
	return {
		async list() {
			return (await settle((await database()).transaction(cameraProfileObjectStoreName, "readonly").objectStore(cameraProfileObjectStoreName).getAll())).filter(isStoredCameraProfile);
		},
		async put(record) {
			const transaction = (await database()).transaction(cameraProfileObjectStoreName, "readwrite");
			transaction.objectStore(cameraProfileObjectStoreName).put(record);
			await new Promise((resolve, reject) => {
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error ?? /* @__PURE__ */ new Error("IndexedDB write failed."));
				transaction.onabort = () => reject(transaction.error ?? /* @__PURE__ */ new Error("IndexedDB write aborted."));
			});
		}
	};
}
/**
* Where the extension instance puts itself on the VM runtime.
*
* Present as soon as the extension is registered. Absent means Camera Source is not loaded, which a
* consumer has to handle whatever else it does.
*/
var cameraSourceRuntimeKey = "ext_kubohiroyacamerasource";
/**
* Where the versioned capability sits, when the build publishing it has that path enabled.
*
* Separate from `cameraSourceRuntimeKey` on purpose. The extension key is present as soon as Camera
* Source is registered; this one appears only when the calibration profile contract is switched on.
* A consumer can therefore tell "not loaded" from "loaded, and not offering profiles", and neither
* has to be reported as the other.
*/
var cameraSourceCapabilityKey = "kubohiroyaCameraSourceCapability";
var runtimeCapabilityVersion = 1;
function createRuntimeCapability(host) {
	const capability = {
		version: runtimeCapabilityVersion,
		requireVersion(version) {
			if (version !== runtimeCapabilityVersion) throw new Error(`Unsupported Camera Source runtime capability version: ${version}; this build provides ${runtimeCapabilityVersion}.`);
			return capability;
		},
		registerProfile: (document) => host.registerProfile(document),
		forgetProfile: (cameraId) => host.forgetProfile(cameraId),
		profileFor: (cameraId) => host.profileFor(cameraId),
		calibratedCameras: () => host.calibratedCameras(),
		assessProfile: (cameraId) => host.assessProfile(cameraId),
		intrinsicsFor: (cameraId) => host.intrinsicsFor(cameraId),
		conditionsFor: (cameraId) => host.conditionsFor(cameraId),
		conditionsGeneration: (cameraId) => host.conditionsGeneration(cameraId)
	};
	return Object.freeze(capability);
}
var FLIPS = [
	"none",
	"horizontal",
	"vertical",
	"both"
];
function isFlip(value) {
	return typeof value === "string" && FLIPS.includes(value);
}
/** Reads a flip, accepting the boolean the older API used for left-right. */
function toFlip(value, fallback = "none") {
	if (isFlip(value)) return value;
	if (value === true) return "horizontal";
	if (value === false) return "none";
	return fallback;
}
function flipsHorizontally(flip) {
	return flip === "horizontal" || flip === "both";
}
function flipsVertically(flip) {
	return flip === "vertical" || flip === "both";
}
/**
* Taking one still image out of a running camera.
*
* A consumer can already read `CameraFrameSource.element` and draw it itself, and the ones doing
* computer vision should: they want the pixels, not a file. This is for the other kind of consumer,
* which wants an encoded image to hand to something that speaks files -- an asset store, a download,
* an HTTP server publishing the latest frame. Each of those would otherwise write the same canvas,
* the same encode, the same resize, and get the mirroring and the upscaling wrong in its own way.
*
* Nothing here knows about HTTP, assets or storage. It returns bytes and the metadata needed to
* describe them, and what happens to the bytes is the caller's business.
*/
var snapshotTypes = [
	"image/jpeg",
	"image/png",
	"image/webp"
];
var haveCurrentData$1 = 2;
function requestedType(value) {
	if (value === void 0) return "image/jpeg";
	if (!snapshotTypes.includes(value)) throw new TypeError(`Camera snapshot type must be one of ${snapshotTypes.join(", ")}.`);
	return value;
}
/**
* Clamps quality, but refuses a value that was never a quality.
*
* Out of range is a caller saying "as good as possible" in the wrong units, and clamping says the
* same thing. `NaN` or a string is a bug, and silently encoding at the browser's default would hide
* it behind an image that looks fine.
*/
function requestedQuality(value) {
	if (value === void 0) return void 0;
	if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError("Camera snapshot quality must be a finite number between 0 and 1.");
	return Math.min(1, Math.max(0, value));
}
function requestedBound(value, name) {
	if (value === void 0) return void 0;
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new TypeError(`Camera snapshot ${name} must be a positive finite number.`);
	return value;
}
/**
* The encoded size: inside both bounds, same shape, never larger than the frame.
*
* Enlarging is left out rather than offered, because a caller asking for 4000 px of a 640 px frame
* is asking for detail that does not exist, and a file that claims to have it is worse than one that
* says 640. A future option can add it where somebody genuinely needs the pixels padded out.
*/
function encodedSize(width, height, maxWidth, maxHeight) {
	const scale = Math.min(1, maxWidth === void 0 ? 1 : maxWidth / width, maxHeight === void 0 ? 1 : maxHeight / height);
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}
function createCanvas(width, height) {
	const offscreen = globalThis.OffscreenCanvas;
	if (typeof offscreen === "function") return new offscreen(width, height);
	const createElement = globalThis.document?.createElement;
	if (typeof createElement !== "function") throw new Error("Camera snapshots need either OffscreenCanvas or a document to make a canvas in.");
	const canvas = createElement.call(globalThis.document, "canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}
async function encode(canvas, type, quality) {
	if (typeof canvas.convertToBlob === "function") return canvas.convertToBlob({
		type,
		...quality === void 0 ? {} : { quality }
	});
	if (typeof canvas.toBlob === "function") return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => blob ? resolve(blob) : reject(/* @__PURE__ */ new Error("The camera frame could not be encoded.")), type, quality);
	});
	throw new Error("This canvas cannot encode an image.");
}
/**
* Draws the frame the element is presenting and returns it encoded.
*
* No object URL is created and no canvas is attached to the document, so there is nothing to revoke
* and nothing to leak: the canvas and the blob are unreachable once the bytes have been copied out.
*/
async function captureSnapshot(video, options = {}) {
	const type = requestedType(options.type);
	const quality = requestedQuality(options.quality);
	const maxWidth = requestedBound(options.maxWidth, "maxWidth");
	const maxHeight = requestedBound(options.maxHeight, "maxHeight");
	const flip = options.flip ?? "none";
	if (video.readyState < haveCurrentData$1) throw new Error("The shared camera has not presented a frame yet.");
	const sourceWidth = video.videoWidth;
	const sourceHeight = video.videoHeight;
	if (!(sourceWidth > 0) || !(sourceHeight > 0)) throw new Error("The shared camera is presenting frames of no size.");
	const size = encodedSize(sourceWidth, sourceHeight, maxWidth, maxHeight);
	const canvas = createCanvas(size.width, size.height);
	canvas.width = size.width;
	canvas.height = size.height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Camera snapshots need a 2d canvas context.");
	const horizontal = flipsHorizontally(flip);
	const vertical = flipsVertically(flip);
	context.save();
	try {
		if (horizontal || vertical) {
			context.translate(horizontal ? size.width : 0, vertical ? size.height : 0);
			context.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
		}
		context.drawImage(video, 0, 0, size.width, size.height);
	} finally {
		context.restore();
	}
	const capturedAt = Date.now();
	const blob = await encode(canvas, type, quality);
	if (blob.type !== type) throw new Error(`This browser encoded ${blob.type || "an unknown type"} rather than ${type}.`);
	const bytes = new Uint8Array(await blob.arrayBuffer());
	return Object.freeze({
		type,
		bytes,
		width: size.width,
		height: size.height,
		capturedAt
	});
}
/** Whether this browser has the capability element at all. */
function supportsUserMediaElement(view = globalThis) {
	return "HTMLUserMediaElement" in view;
}
/**
* Stops the microphone the element answered with, and takes its track out of the stream.
*
* `<usermedia>` is the element for *combined* audio and video. Its `setConstraints` takes
* `HTMLMediaStreamConstraints`, whose `audio` and `video` must each be a constraint set -- so
* `audio: false` is a `TypeError`, and `{video: {}}` on its own does not drop the microphone,
* because the element's own default is `{audio: {}, video: {}}` and the filtering it applies is to
* each track's parameters, not to which tracks it opens. Asking for video alone is what the
* proposed `<camera>` element is for, and no browser ships that yet.
*
* So the microphone arrives whatever this module asks for, and the one thing left is to stop it
* before any consumer is handed the stream. The browser's prompt still names the microphone, and
* only a `<camera>` element could change that; nothing listens on the microphone either way.
*/
function withoutAudio(stream) {
	const audio = typeof stream.getAudioTracks === "function" ? stream.getAudioTracks() : [];
	for (const track of audio) {
		if (typeof stream.removeTrack === "function") stream.removeTrack(track);
		track.stop();
	}
	return stream;
}
/**
* Places `<usermedia>` in `container` and resolves once the operator has answered.
*
* No styling is applied beyond taking the element out of the document flow: the element enforces
* its own contrast and size rules, and a stylesheet fighting them is how a prompt stops opening.
*/
function requestUserMedia(options) {
	const element = options.document.createElement("usermedia");
	const button = options.document.createElement("button");
	button.type = "button";
	button.textContent = options.label;
	element.append(button);
	if (!options.cameraControls) {
		element.style.position = "absolute";
		element.style.left = "50%";
		element.style.top = "50%";
		element.style.transform = "translate(-50%, -50%)";
		element.style.zIndex = "2";
	}
	try {
		element.setConstraints?.(options.constraints ?? { video: {} });
	} catch {}
	let settle = () => {};
	const settled = new Promise((resolve) => {
		settle = resolve;
	});
	let registration;
	let done = false;
	const finish = (outcome) => {
		if (done) return;
		done = true;
		registration?.dispose();
		element.remove();
		settle(outcome);
	};
	element.addEventListener("stream", () => {
		const stream = element.stream;
		if (stream && typeof stream.getTracks === "function") finish({
			kind: "stream",
			stream: withoutAudio(stream)
		});
		else finish({
			kind: "error",
			code: "usermedia-empty",
			message: "The camera button returned no stream."
		});
	});
	element.addEventListener("cancel", () => finish({ kind: "cancelled" }));
	element.addEventListener("error", (event) => {
		const detail = element.error ?? event.error;
		const code = typeof detail?.name === "string" && detail.name.length > 0 ? detail.name : "usermedia-error";
		if (code === "InvalidStateError") return;
		const message = typeof detail?.message === "string" && detail.message.length > 0 ? detail.message : "The camera button could not open the camera.";
		finish({
			kind: "error",
			code,
			message
		});
	});
	if (options.cameraControls) registration = options.cameraControls.registerProvider({
		id: `camera-source-permission:${options.owner || options.cameraId || "default"}`,
		cameraId: options.cameraId || "default",
		kind: "permission",
		element
	});
	else if (options.container) options.container.append(element);
	else throw new TypeError("Camera permission requires a host or container");
	return Object.freeze({
		dismiss: () => finish({ kind: "cancelled" }),
		settled
	});
}
var videoLayer = "video";
var haveCurrentData = 2;
function videoSkinClass(renderer) {
	const BaseSkin = renderer.exports?.Skin;
	if (typeof BaseSkin !== "function") throw new Error("Camera preview requires renderer.exports.Skin.");
	return class VideoSkin extends BaseSkin {
		constructor(id, skinRenderer, video, onFrame) {
			super(id, skinRenderer);
			this.texture = null;
			this.textureSize = [0, 0];
			this.dirty = true;
			this.disposed = false;
			this.videoFrameCallbackId = null;
			this.animationFrameId = null;
			this.lastCurrentTime = NaN;
			this.handleVideoFrame = () => {
				if (this.disposed) return;
				this.markChanged();
				this.scheduleFrame();
			};
			this.handleAnimationFrame = () => {
				if (this.disposed) return;
				if (this.video.currentTime !== this.lastCurrentTime) this.markChanged();
				this.scheduleFrame();
			};
			this.video = video;
			this.onFrame = onFrame;
			this.private = true;
			this.syncMetrics();
			this.scheduleFrame();
		}
		get size() {
			return this.textureSize;
		}
		getTexture() {
			if (this.disposed || this.video.readyState < haveCurrentData || this.video.videoWidth === 0 || this.video.videoHeight === 0) return null;
			if (this.syncMetrics()) this.onFrame(true);
			if (!this.dirty && this.video.currentTime === this.lastCurrentTime) return this.texture;
			const gl = renderer.gl;
			if (!this.texture) {
				this.texture = gl.createTexture();
				if (!this.texture) throw new Error("Camera preview could not create a WebGL texture.");
				gl.bindTexture(gl.TEXTURE_2D, this.texture);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			} else gl.bindTexture(gl.TEXTURE_2D, this.texture);
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
			try {
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
			} finally {
				gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			}
			this.dirty = false;
			this.lastCurrentTime = this.video.currentTime;
			return this.texture;
		}
		dispose() {
			this.disposed = true;
			if (this.videoFrameCallbackId !== null && this.video.cancelVideoFrameCallback) this.video.cancelVideoFrameCallback(this.videoFrameCallbackId);
			if (this.animationFrameId !== null && typeof globalThis.cancelAnimationFrame === "function") globalThis.cancelAnimationFrame(this.animationFrameId);
			if (this.texture) renderer.gl.deleteTexture(this.texture);
			this.texture = null;
			super.dispose();
		}
		useNearest() {
			return false;
		}
		updateSilhouette() {}
		syncMetrics() {
			const width = this.video.videoWidth;
			const height = this.video.videoHeight;
			if (width === this.textureSize[0] && height === this.textureSize[1]) return false;
			this.textureSize = [width, height];
			this.rotationCenter[0] = width / 2;
			this.rotationCenter[1] = height / 2;
			return true;
		}
		/**
		* Says a new frame arrived, to everything that has to hear it.
		*
		* Three separate listeners, and missing any one of them stops the picture
		* without stopping anything else:
		*
		* `dirty` is this skin's own note that the texture it holds is behind the
		* video. `getTexture` reads it.
		*
		* `emitWasAltered` is the renderer's. A renderer that redrew every frame
		* regardless would not need it, but this one skips the work when nothing
		* says it changed -- and a video is the one skin whose content changes
		* without anybody touching a drawable. Without this the preview updated
		* only when something else forced a redraw, so resizing the stage showed
		* the current frame and then it froze again. `draw` was still being called
		* thirty times a second; it was returning immediately every time.
		*
		* `onFrame` is the extension's, which asks the VM for a redraw and keeps
		* the drawable's size in step with the video's.
		*/
		markChanged() {
			this.dirty = true;
			this.emitWasAltered();
			this.onFrame(this.syncMetrics());
		}
		scheduleFrame() {
			if (typeof this.video.requestVideoFrameCallback === "function") this.videoFrameCallbackId = this.video.requestVideoFrameCallback(this.handleVideoFrame);
			else if (typeof globalThis.requestAnimationFrame === "function") this.animationFrameId = globalThis.requestAnimationFrame(this.handleAnimationFrame);
		}
	};
}
function assertRenderer(renderer) {
	if (!renderer || !Array.isArray(renderer._allSkins) || !Number.isInteger(renderer._nextSkinId) || typeof renderer.createDrawable !== "function" || typeof renderer.destroyDrawable !== "function" || typeof renderer.destroySkin !== "function" || typeof renderer.getNativeSize !== "function") throw new Error("Camera preview requires a compatible TurboWarp renderer.");
}
function createVideoPreview(renderer, video, flip, requestRedraw) {
	assertRenderer(renderer);
	const VideoSkin = videoSkinClass(renderer);
	const skinId = renderer._nextSkinId++;
	let drawableId;
	let disposed = false;
	let previewFlip = flip;
	let lastLayout = "";
	const updateLayout = () => {
		if (drawableId === void 0 || video.videoWidth === 0 || video.videoHeight === 0) return;
		const [stageWidth, stageHeight] = renderer.getNativeSize();
		const layout = [
			video.videoWidth,
			video.videoHeight,
			stageWidth,
			stageHeight,
			previewFlip
		].join(":");
		if (layout === lastLayout) return;
		const scale = Math.max(stageWidth / video.videoWidth, stageHeight / video.videoHeight) * 100;
		renderer.updateDrawableScale(drawableId, [flipsHorizontally(previewFlip) ? -scale : scale, flipsVertically(previewFlip) ? -scale : scale]);
		lastLayout = layout;
	};
	const skin = new VideoSkin(skinId, renderer, video, (metricsChanged) => {
		if (metricsChanged) skin.emitWasAltered();
		updateLayout();
		requestRedraw();
	});
	renderer._allSkins[skinId] = skin;
	try {
		drawableId = renderer.createDrawable(videoLayer);
		if (drawableId === void 0) throw new Error("Camera preview could not create a video drawable.");
		renderer.updateDrawableSkinId(drawableId, skinId);
		renderer.updateDrawablePosition(drawableId, [0, 0]);
		updateLayout();
		renderer.updateDrawableVisible(drawableId, true);
		renderer.markSkinAsPrivate?.(skinId);
		renderer.markDrawableAsNoninteractive?.(drawableId);
		requestRedraw();
	} catch (error) {
		try {
			if (drawableId !== void 0) renderer.destroyDrawable(drawableId, videoLayer);
		} finally {
			renderer.destroySkin(skinId);
		}
		throw error;
	}
	return Object.freeze({
		setFlip: (nextFlip) => {
			if (disposed || previewFlip === nextFlip) return;
			previewFlip = nextFlip;
			updateLayout();
			requestRedraw();
		},
		dispose: () => {
			if (disposed) return;
			disposed = true;
			try {
				if (drawableId !== void 0) renderer.destroyDrawable(drawableId, videoLayer);
			} finally {
				try {
					renderer.destroySkin(skinId);
				} finally {
					requestRedraw();
				}
			}
		}
	});
}
function finite(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/** The time of one presented frame, or the previous one when the metadata carries no time. */
function frameTimeFrom(metadata, timeOriginMs, previous) {
	const capture = finite(metadata.captureTime);
	const presentation = finite(metadata.presentationTime);
	const milliseconds = capture ?? presentation;
	if (milliseconds === void 0) return previous;
	return Object.freeze({
		timestampUs: Math.round((timeOriginMs + milliseconds) * 1e3),
		source: capture === void 0 ? "presentation" : "capture",
		presentedFrames: finite(metadata.presentedFrames) ?? (previous?.presentedFrames ?? 0) + 1
	});
}
/**
* Follows one video element for as long as its camera runs.
*
* Nothing is recorded where the browser has no `requestVideoFrameCallback`; frame sources then carry
* no time, which a consumer has to treat as unknown rather than as now.
*/
var FrameTimeWatcher = class {
	constructor(element, timeOriginMs) {
		this.disposed = false;
		this.element = element;
		this.timeOriginMs = timeOriginMs;
		this.schedule();
	}
	latest() {
		return this.frame;
	}
	dispose() {
		this.disposed = true;
		if (this.handle !== void 0) {
			this.element.cancelVideoFrameCallback(this.handle);
			this.handle = void 0;
		}
	}
	schedule() {
		if (this.disposed || typeof this.element.requestVideoFrameCallback !== "function") return;
		this.handle = this.element.requestVideoFrameCallback((_now, metadata) => {
			this.handle = void 0;
			this.frame = frameTimeFrom(metadata, this.timeOriginMs, this.frame);
			this.schedule();
		});
	}
};
var blockDefinitions = block_definitions_default.blocks;
var menuDefinitions = block_definitions_default.menus;
/**
* The documentation site this extension's palette button opens, and the icon the palette draws
* on every block. Hosts that bundle several extensions read both out of `getInfo()`, so a
* bundled Camera Source without them loses its docs button in the host's palette.
*/
var EXTENSION_DOCS_URI = "https://kubohiroya.github.io/turbowarp-camera-source/";
var BLOCK_ICON_URI = extensionConfig.blockIconURI;
var defaultCameraId = "default";
function mediaDevices() {
	const devices = globalThis.navigator?.mediaDevices;
	if (!devices || typeof devices.getUserMedia !== "function") throw new Error("Camera Source requires navigator.mediaDevices.getUserMedia.");
	return devices;
}
function normalizeId(value, fallback = defaultCameraId) {
	return String(value ?? "").trim() || fallback;
}
/**
* The camera a page was opened for, from its query parameters.
*
* Returns only what was named, so a page opened without parameters starts a camera exactly as the
* plain block does. A size or rate that is not a positive number is ignored rather than guessed.
*/
function requestedCamera(search) {
	let parameters;
	try {
		parameters = new URLSearchParams(search);
	} catch {
		return {};
	}
	const deviceId = optionalText(parameters.get("cameraDeviceId"));
	const video = {};
	if (deviceId) video.deviceId = { exact: deviceId };
	const ideal = (name) => {
		const value = Number(parameters.get(name) ?? "");
		return Number.isFinite(value) && value > 0 ? value : void 0;
	};
	const width = ideal("cameraWidth");
	const height = ideal("cameraHeight");
	const frameRate = ideal("cameraFrameRate");
	if (width !== void 0) video.width = { ideal: width };
	if (height !== void 0) video.height = { ideal: height };
	if (frameRate !== void 0) video.frameRate = { ideal: frameRate };
	if (Object.keys(video).length === 0) return {};
	return {
		...deviceId ? { deviceId } : {},
		video
	};
}
function optionalText(value) {
	return String(value ?? "").trim();
}
function indexFrom(value) {
	const parsed = Number.parseInt(String(value ?? ""), 10);
	return Number.isFinite(parsed) ? parsed - 1 : -1;
}
function videoConstraints(options) {
	if (typeof options.video === "object" && options.video !== null) return {
		audio: false,
		video: options.video
	};
	if (options.deviceId) return {
		audio: false,
		video: { deviceId: { exact: options.deviceId } }
	};
	return {
		audio: false,
		video: options.video ?? true
	};
}
/**
* The flip a `show preview` block asked for.
*
* The menu accepts reporters, so the value can arrive as any string a project computed. Anything
* outside the vocabulary falls back to horizontal rather than silently drawing the preview
* unflipped: a project that asked for a flip and got none would look like the camera was wrong.
*/
function requestedPreviewFlip(args) {
	return toFlip(args.PREVIEW_FLIP, "horizontal");
}
/** The preview flip a consumer asked for through the runtime API. */
function previewFlipOf(options) {
	return toFlip(options.previewFlip);
}
/** The document with its camera id replaced, or the value untouched when it is not an object. */
function rebindCameraId(document, cameraId) {
	if (typeof document !== "object" || document === null || Array.isArray(document)) return document;
	return {
		...document,
		cameraId
	};
}
function parseJson(text) {
	try {
		return {
			ok: true,
			value: JSON.parse(text)
		};
	} catch {
		return { ok: false };
	}
}
/** Which saved profile, in words an operator can match against the file they exported. */
function describeStoredProfile(profile) {
	const label = profile.device?.label;
	return `Profile ${profile.profileId} calibrated at ${profile.calibratedAt}${label ? ` on ${label}` : ""}.`;
}
function compatibilityDetail(report) {
	const findings = decisiveFindings(report);
	if (findings.length === 0) return "The profile matches the camera as configured.";
	return findings.map((entry) => entry.detail).join(" ");
}
/**
* Newest calibration first.
*
* Timestamps are compared as instants, so an offset other than `Z` still sorts where it belongs. One
* that does not parse sorts last: it cannot be shown to be newer than anything.
*/
function newestFirst(left, right) {
	const instant = (text) => {
		const value = Date.parse(text);
		return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
	};
	const byCalibration = instant(right.calibratedAt) - instant(left.calibratedAt);
	if (byCalibration !== 0 && !Number.isNaN(byCalibration)) return byCalibration;
	return instant(right.savedAt) - instant(left.savedAt) || 0;
}
function cameraFailure(error) {
	if (error instanceof Error) return {
		code: error.name || "Error",
		message: error.message
	};
	return {
		code: "Error",
		message: String(error)
	};
}
var CameraSourceExtension = class {
	constructor(options = {}) {
		this.sessions = /* @__PURE__ */ new Map();
		this.blockLeases = /* @__PURE__ */ new Map();
		this.blockPreviewLeases = /* @__PURE__ */ new Map();
		this.blockPreviewRevisions = /* @__PURE__ */ new Map();
		this.cameraFailures = /* @__PURE__ */ new Map();
		this.controls = /* @__PURE__ */ new Set();
		this.standaloneControls = null;
		this.cameraButtons = /* @__PURE__ */ new Map();
		this.cameraButtonStreams = /* @__PURE__ */ new WeakSet();
		this.profiles = new CameraProfileRegistry();
		this.generations = /* @__PURE__ */ new Map();
		this.lastConditions = /* @__PURE__ */ new Map();
		this.assessments = /* @__PURE__ */ new Map();
		this.devices = [];
		this.storedProfileOutcomes = /* @__PURE__ */ new Map();
		this.storedProfilesGeneration = 0;
		this.removeFixedEditors = () => {};
		this.dispose = () => {
			this.removeFixedEditors();
			this.removeSourceEditors();
			this.stopAllCameras();
			this.standaloneControls?.dispose();
			this.standaloneControls = null;
			const runtime = Scratch.vm.runtime;
			if (runtime["kubohiroyaCameraSourceCapability"] === this.capability) delete runtime[cameraSourceCapabilityKey];
			this.profileChannel?.close();
			Scratch.vm.runtime.off?.("PROJECT_STOP_ALL", this.handleProjectBoundary);
			Scratch.vm.runtime.off?.("PROJECT_LOADED", this.handleProjectBoundary);
			Scratch.vm.runtime.off?.("RUNTIME_DISPOSED", this.dispose);
		};
		this.handleProjectBoundary = () => {
			this.stopAllCameras();
			this.profileError = void 0;
			this.storedProfileOutcomes.clear();
		};
		this.removeSourceEditors = registerSourceEditors(Scratch);
		try {
			this.removeFixedEditors = registerFixedInputEditors(Scratch, fixedInputEditors);
			this.profileStore = options.profileStore ?? createIndexedDbCameraProfileStore();
			this.profileChannel = this.openProfileChannel();
			Scratch.vm.runtime[cameraSourceRuntimeKey] = this;
			this.capability = createRuntimeCapability({
				registerProfile: (document) => this.profiles.register(document),
				forgetProfile: (cameraId) => this.profiles.forget(cameraId),
				profileFor: (cameraId) => this.profiles.get(cameraId),
				calibratedCameras: () => this.profiles.cameraIds(),
				assessProfile: (cameraId) => {
					return this.assessmentOf(cameraId);
				},
				intrinsicsFor: (cameraId) => this.intrinsicsOf(cameraId),
				conditionsFor: (cameraId) => this.conditionsOf(cameraId),
				conditionsGeneration: (cameraId) => this.generationOf(cameraId)
			});
			Scratch.vm.runtime[cameraSourceCapabilityKey] = this.capability;
			Scratch.vm.runtime.on?.("PROJECT_STOP_ALL", this.handleProjectBoundary);
			Scratch.vm.runtime.on?.("PROJECT_LOADED", this.handleProjectBoundary);
			Scratch.vm.runtime.on?.("RUNTIME_DISPOSED", this.dispose);
		} catch (error) {
			this.dispose();
			throw error;
		}
	}
	getInfo() {
		return {
			id: extensionConfig.id,
			name: Scratch.translate(block_definitions_default.extensionName),
			docsURI: EXTENSION_DOCS_URI,
			blockIconURI: BLOCK_ICON_URI,
			blocks: blockDefinitions.map((block) => this.toScratchBlock(block)),
			menus: Object.fromEntries(Object.entries(menuDefinitions).map(([id, menu]) => [id, {
				acceptReporters: menu.acceptReporters,
				items: [...menu.items]
			}]))
		};
	}
	isCameraRunning(args = {}) {
		const session = this.sessions.get(normalizeId(args.CAMERA_ID));
		return session?.stream ? this.isStreamRunning(session.stream) : false;
	}
	cameraErrorCode(args = {}) {
		return this.cameraFailures.get(normalizeId(args.CAMERA_ID))?.code ?? "";
	}
	cameraError(args = {}) {
		return this.cameraFailures.get(normalizeId(args.CAMERA_ID))?.message ?? "";
	}
	cameraDeviceIdReporter(args = {}) {
		return this.sessions.get(normalizeId(args.CAMERA_ID))?.activeDeviceId ?? "";
	}
	cameraFrameWidth(args = {}) {
		const session = this.sessions.get(normalizeId(args.CAMERA_ID));
		if (!session?.stream) return 0;
		return session.video?.videoWidth || this.trackSetting(session, "width");
	}
	cameraFrameHeight(args = {}) {
		const session = this.sessions.get(normalizeId(args.CAMERA_ID));
		if (!session?.stream) return 0;
		return session.video?.videoHeight || this.trackSetting(session, "height");
	}
	cameraFrameRate(args = {}) {
		const session = this.sessions.get(normalizeId(args.CAMERA_ID));
		return session?.stream ? this.trackSetting(session, "frameRate") : 0;
	}
	async startSharedCamera(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		if (this.blockLeases.has(cameraId)) return;
		const deviceId = optionalText(args.DEVICE_ID);
		const options = {
			owner: "camera-source-block",
			cameraId
		};
		if (deviceId) options.deviceId = deviceId;
		const lease = await this.acquireCamera(options);
		this.blockLeases.set(cameraId, lease);
	}
	async acquireCamera(options = {}) {
		const cameraId = normalizeId(options.cameraId);
		const session = this.session(cameraId);
		if (session.startPromise) await session.startPromise;
		else if (!session.stream) await this.start(session, options);
		return this.lease(session, options);
	}
	/**
	* Shares a stream the caller already holds, under a camera id, without opening a camera.
	*
	* Refuses when the id already runs a different stream rather than quietly joining it: the caller
	* asked for its own stream to be shared, and answering with somebody else's would leave it
	* believing a stream is in use that nobody reads. Adopting the same stream twice is the one case
	* that joins, because that is what the caller asked for and already got.
	*/
	async adoptCamera(options) {
		const stream = options?.stream;
		if (typeof stream !== "object" || stream === null || typeof stream.getTracks !== "function") throw new TypeError("Camera Source adoptCamera requires a MediaStream.");
		const cameraId = normalizeId(options.cameraId);
		const session = this.session(cameraId);
		if (session.startPromise) await session.startPromise;
		if (session.stream && session.stream !== stream) throw new Error(`Camera id ${cameraId} already runs another stream. Release its leases before adopting.`);
		if (!session.stream) await this.adopt(session, stream);
		return this.lease(session, options);
	}
	lease(session, options) {
		const cameraId = session.cameraId;
		const token = Symbol(String(options.owner ?? "camera-lease"));
		session.leases.add(token);
		try {
			if (options.preview === true) {
				session.previewLeases.set(token, previewFlipOf(options));
				this.ensurePreview(session);
				session.preview?.setFlip(this.previewFlip(session));
			}
		} catch (error) {
			session.leases.delete(token);
			session.previewLeases.delete(token);
			this.stopWhenUnused(session);
			this.cameraFailures.set(cameraId, cameraFailure(error));
			throw error;
		}
		let released = false;
		return Object.freeze({
			getFrameSource: () => this.getFrameSource(session),
			captureFrame: async (captureOptions) => {
				if (released) throw new Error("This camera lease has been released.");
				const video = this.sessions.get(session.cameraId) === session ? session.video : null;
				if (!video) throw new Error("Shared camera is not running.");
				return captureSnapshot(video, captureOptions);
			},
			release: async () => {
				if (released) return;
				released = true;
				session.leases.delete(token);
				session.previewLeases.delete(token);
				if (session.previewLeases.size === 0) {
					session.preview?.dispose();
					session.preview = null;
				} else session.preview?.setFlip(this.previewFlip(session));
				this.stopWhenUnused(session);
			}
		});
	}
	async showCameraPreview(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		const flip = requestedPreviewFlip(args);
		if (this.blockPreviewLeases.get(cameraId)?.flip === flip) return;
		const revision = this.nextPreviewBlockRevision(cameraId);
		const lease = await this.acquireCamera({
			owner: "camera-source-preview-block",
			cameraId,
			preview: true,
			previewFlip: flip
		});
		if (this.blockPreviewRevisions.get(cameraId) !== revision) {
			await lease.release();
			return;
		}
		const current = this.blockPreviewLeases.get(cameraId);
		this.blockPreviewLeases.set(cameraId, {
			lease,
			flip
		});
		await current?.lease.release();
	}
	async hideCameraPreview(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		this.nextPreviewBlockRevision(cameraId);
		const existing = this.blockPreviewLeases.get(cameraId);
		if (!existing) return;
		this.blockPreviewLeases.delete(cameraId);
		await existing.lease.release();
	}
	stopSharedCamera(args = {}) {
		this.stopCameraSession(normalizeId(args.CAMERA_ID));
	}
	async refreshCameraDevices() {
		this.devices = (await mediaDevices().enumerateDevices()).filter((device) => device.kind === "videoinput");
	}
	cameraDeviceCount() {
		return this.devices.length;
	}
	cameraDeviceIdAt(args) {
		return this.devices[indexFrom(args.INDEX)]?.deviceId ?? "";
	}
	cameraDeviceLabelAt(args) {
		return this.devices[indexFrom(args.INDEX)]?.label ?? "";
	}
	stopAllCameras() {
		for (const control of [...this.controls]) control.dispose();
		this.controls.clear();
		for (const request of [...this.cameraButtons.values()]) request.dismiss();
		this.cameraButtons.clear();
		for (const cameraId of [...this.sessions.keys()]) this.stopCameraSession(cameraId);
		this.blockLeases.clear();
		this.blockPreviewLeases.clear();
	}
	registerCameraProfile(args = {}) {
		this.registerProfileText(args.PROFILE_JSON, (document) => document);
	}
	/**
	* Registers a profile under the camera id the project names, whatever id the document carries.
	*
	* The id in a document is the name the camera had where it was solved. A calibration app knows one
	* camera and calls it `default`; the app that uses the result may call the same camera `pose`.
	* Rebinding happens before validation, so the document is checked as the profile it is about to
	* become rather than as the one it was.
	*/
	registerCameraProfileAs(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		this.registerProfileText(args.PROFILE_JSON, (document) => rebindCameraId(document, cameraId));
	}
	/**
	* Writes the profile registered for a camera to browser storage.
	*
	* Only a registered profile can be saved, so whatever reaches storage has already passed
	* validation. Other windows on the origin are told once the write has committed, not before: a
	* window that went looking on the strength of an uncommitted write would find nothing and conclude
	* there was nothing to find.
	*/
	async saveCameraProfile(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		const profile = this.profiles.get(cameraId);
		if (!profile) {
			this.storedProfileOutcomes.set(cameraId, {
				state: "no-profile",
				detail: ""
			});
			return;
		}
		const label = profile.device?.label;
		const record = {
			profileId: profile.profileId,
			cameraId: profile.cameraId,
			calibratedAt: profile.calibratedAt,
			savedAt: (/* @__PURE__ */ new Date()).toISOString(),
			...label === void 0 ? {} : { deviceLabel: label },
			document: serializeCameraIntrinsicProfile(profile)
		};
		try {
			await this.profileStore.put(record);
		} catch {
			this.storedProfileOutcomes.set(cameraId, {
				state: "unavailable",
				detail: ""
			});
			return;
		}
		this.storedProfilesGeneration += 1;
		this.storedProfileOutcomes.set(cameraId, {
			state: "saved",
			detail: describeStoredProfile(profile)
		});
		try {
			this.profileChannel?.postMessage({ profileId: profile.profileId });
		} catch {}
	}
	/**
	* Registers the newest saved profile that fits the camera as it is configured now.
	*
	* Fails closed. Only a `compatible` verdict registers anything; `undetermined` is not a weaker yes,
	* and a camera that has not delivered a frame yet cannot be shown to match any calibration. When
	* nothing qualifies, whatever is already registered for the camera stays exactly as it was: a
	* restore that found nothing usable has no business taking away a profile that was.
	*
	* Every candidate is judged against the conditions directly, without going through the registry,
	* so trying a candidate that loses never displaces the registered one even for a moment.
	*/
	async restoreStoredCameraProfile(args = {}) {
		await this.restoreStoredProfile(normalizeId(args.CAMERA_ID), false);
	}
	/**
	* Like `restore stored camera profile`, but only from profiles calibrated on the device the camera
	* is running on now.
	*
	* Compatibility alone cannot tell two cameras of the same model apart: they report the same label
	* and the same capture conditions, so either one's calibration reads as `compatible` for the other.
	* What differs is the device id, which is scoped to this origin and browser profile. That scope is
	* exactly where browser storage lives, so a profile saved here and a camera opened here agree on it
	* for as long as the browser keeps both.
	*
	* A camera that is not running has no device id, and the answer is then `undetermined`. A profile
	* brought in from another browser carries another id and is never a candidate; register it with
	* the file and `bind camera profile ... to its current device` first.
	*/
	async restoreStoredCameraProfileForDevice(args = {}) {
		await this.restoreStoredProfile(normalizeId(args.CAMERA_ID), true);
	}
	/**
	* Records the device the camera is running on in its registered profile.
	*
	* For the case where the operator has said which camera a profile belongs to, typically by loading
	* a file for it. Only a profile `compatible` with the camera as it is now is bound: a profile that
	* does not fit is not made more trustworthy by naming a device in it. A label the camera reports is
	* written too when the profile has none; one it already has has been compared and matched.
	*/
	bindCameraProfileToDevice(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		const profile = this.profiles.get(cameraId);
		if (!profile) return;
		const conditions = this.conditionsOf(cameraId);
		if (conditions.deviceId.length === 0) return;
		if (evaluateProfileCompatibility(profile, conditions).state !== "compatible") return;
		const document = JSON.parse(serializeCameraIntrinsicProfile(profile));
		const label = profile.device?.label ?? conditions.label;
		document["device"] = {
			...label === void 0 ? {} : { label },
			deviceId: conditions.deviceId
		};
		this.profiles.register(document);
	}
	/** Whether the registered profile was calibrated on, or bound to, the device the camera runs on. */
	cameraProfileOnDevice(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		const deviceId = this.profiles.get(cameraId)?.device?.deviceId;
		return deviceId !== void 0 && deviceId.length > 0 && deviceId === this.conditionsOf(cameraId).deviceId;
	}
	/**
	* Starts a camera the way the page's query parameters ask, or as `start shared camera` does when
	* they ask nothing.
	*
	* How one app hands a camera to another it opens on the same origin. An app running several USB
	* cameras opens the lens calibration app for one of them, and the calibration has to be solved on
	* that device at the size the app will use: a camera the browser picks may be the other camera of
	* the same model, and a profile solved at another size is `incompatible`.
	*
	* `cameraDeviceId` is required exactly. `cameraWidth`, `cameraHeight` and `cameraFrameRate` are
	* asked for as `ideal`, the way the opening app asked, so the camera settles on the same mode.
	*/
	async startRequestedSharedCamera(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		if (this.blockLeases.has(cameraId)) return;
		const lease = await this.acquireCamera({
			owner: "camera-source-block",
			cameraId,
			...requestedCamera(globalThis.location?.search ?? "")
		});
		this.blockLeases.set(cameraId, lease);
	}
	/** Whether this browser has the camera button element at all. */
	cameraButtonAvailable() {
		return supportsUserMediaElement();
	}
	/**
	* Starts a camera from the browser's own camera button, rather than from `getUserMedia`.
	*
	* For a `.sb3` opened in the editor. The document belongs to TurboWarp there, so no host above
	* the project can place a capability element -- and without one, the browser-managed handover is
	* closed to the work entirely. #39 kept this element out of the extension so that no extension
	* could manufacture an operator's intent; placing a block *is* that intent, and the browser still
	* collects the click and draws the prompt. What the block does is put the element where it can be
	* clicked.
	*
	* A camera id that already runs a stream joins it: a packaged work's host adopted one before the
	* project started, and asking again would only refuse (`adoptCamera` guards an id against a
	* second stream). So the same project runs in both distributions with this block in it.
	*
	* Nothing here throws into the project. A refusal, an unsupported browser and a failed open all
	* land in `shared camera error code`, and `start shared camera` remains available.
	*/
	async startSharedCameraFromCameraButton(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		if (this.blockLeases.has(cameraId)) return;
		if (this.sessions.get(cameraId)?.stream) {
			this.blockLeases.set(cameraId, await this.acquireCamera({
				owner: "camera-source-block",
				cameraId
			}));
			return;
		}
		if (!supportsUserMediaElement()) {
			this.cameraFailures.set(cameraId, {
				code: "usermedia-unsupported",
				message: "This browser has no camera button element."
			});
			return;
		}
		const host = this.cameraControlsHost();
		const container = host ? null : this.cameraButtonContainer();
		if (!host && !container) {
			this.cameraFailures.set(cameraId, {
				code: "usermedia-no-stage",
				message: "The stage the camera button would be placed on was not found."
			});
			return;
		}
		this.cameraButtons.get(cameraId)?.dismiss();
		const request = requestUserMedia({
			document,
			...host ? {
				cameraControls: host,
				cameraId
			} : { container },
			label: Scratch.translate("Allow the camera")
		});
		this.cameraButtons.set(cameraId, request);
		const outcome = await request.settled;
		if (this.cameraButtons.get(cameraId) === request) this.cameraButtons.delete(cameraId);
		if (outcome.kind === "cancelled") {
			this.cameraFailures.set(cameraId, {
				code: "usermedia-cancelled",
				message: "The camera was not allowed."
			});
			return;
		}
		if (outcome.kind === "error") {
			this.cameraFailures.set(cameraId, {
				code: outcome.code,
				message: outcome.message
			});
			return;
		}
		try {
			this.cameraButtonStreams.add(outcome.stream);
			this.blockLeases.set(cameraId, await this.adoptCamera({
				owner: "camera-source-block",
				cameraId,
				stream: outcome.stream
			}));
		} catch (error) {
			outcome.stream.getTracks().forEach((track) => track.stop());
			this.cameraFailures.set(cameraId, cameraFailure(error));
		}
	}
	cameraControlsHost() {
		if (Scratch.gui?.cameraControls) return Scratch.gui.cameraControls;
		if (typeof document === "undefined" || !document.body) return null;
		this.standaloneControls ?? (this.standaloneControls = createStandaloneCameraControlsHost(document, Scratch.translate.language || document.documentElement?.lang || globalThis.navigator?.language || "en"));
		return this.standaloneControls.host;
	}
	/** Generic controls live here; consumers supply only preview-specific operations. */
	registerCameraControls(options) {
		const host = this.cameraControlsHost();
		if (!host || typeof document === "undefined") return null;
		const cameraId = normalizeId(options.cameraId);
		let stream = null;
		let lease = null;
		let request = null;
		let disposed = false;
		const port = options.port || { isCameraRunning: () => this.isCameraRunning({ CAMERA_ID: cameraId }) };
		const panel = createCameraControls({
			...options,
			locale: options.locale || Scratch.translate.language || "",
			cameraId,
			document,
			host,
			port: {
				...port,
				isCameraRunning: () => this.isCameraRunning({ CAMERA_ID: cameraId }) || port.isCameraRunning()
			},
			requestStart: async () => {
				if (disposed || request || this.isCameraRunning({ CAMERA_ID: cameraId })) return;
				if (!supportsUserMediaElement()) throw new Error(Scratch.translate("This browser has no camera button element."));
				request = requestUserMedia({
					document,
					cameraControls: host,
					cameraId,
					owner: options.owner,
					label: Scratch.translate("Allow the camera")
				});
				const outcome = await request.settled;
				request = null;
				if (outcome.kind === "error") throw new Error(outcome.message);
				if (outcome.kind !== "stream") return;
				if (disposed) {
					outcome.stream.getTracks().forEach((track) => track.stop());
					return;
				}
				stream = outcome.stream;
				try {
					const adopted = await this.adoptCamera({
						cameraId,
						owner: options.owner,
						stream
					});
					if (disposed) {
						adopted.release();
						return;
					}
					lease = adopted;
				} catch (failure) {
					stream.getTracks().forEach((track) => track.stop());
					stream = null;
					throw failure;
				}
			}
		});
		const control = {
			...panel,
			dispose: () => {
				if (disposed) return;
				disposed = true;
				request?.dismiss();
				panel.dispose();
				lease?.release();
				stream?.getTracks().forEach((track) => track.stop());
				this.controls.delete(control);
			}
		};
		this.controls.add(control);
		return control;
	}
	/** Removes a camera button still waiting for an answer; the script waiting on it continues. */
	hideCameraButton(args = {}) {
		this.cameraButtons.get(normalizeId(args.CAMERA_ID))?.dismiss();
	}
	/**
	* Where the camera button goes: the element that holds the stage canvas.
	*
	* The preview is a renderer skin, so the extension has had no DOM of its own to hang this on. A
	* capability element cannot be drawn into WebGL, and the editor's own layout is not ours to
	* restructure, so it is placed over the canvas and centred, with the element keeping its own look.
	*/
	cameraButtonContainer() {
		const parent = (Scratch.vm.runtime.renderer?.gl?.canvas)?.parentElement ?? null;
		if (!parent) return null;
		const style = parent.style;
		const computed = globalThis.getComputedStyle?.(parent);
		if (style && computed?.position === "static") style.position = "relative";
		return parent;
	}
	async restoreStoredProfile(cameraId, sameDevice) {
		let records;
		try {
			records = await this.profileStore.list();
		} catch {
			this.storedProfileOutcomes.set(cameraId, {
				state: "unavailable",
				detail: ""
			});
			return;
		}
		const conditions = this.conditionsOf(cameraId);
		if (sameDevice && conditions.deviceId.length === 0) {
			this.storedProfileOutcomes.set(cameraId, {
				state: "undetermined",
				detail: "The camera is not running, so the device a saved profile was calibrated on cannot be compared."
			});
			return;
		}
		let incompatible;
		let undetermined;
		let otherDevices = 0;
		for (const record of [...records].sort(newestFirst)) {
			const parsed = parseJson(record.document);
			if (!parsed.ok) continue;
			const document = rebindCameraId(parsed.value, cameraId);
			const result = readCameraProfileDocument(document);
			if (!result.ok) continue;
			if (sameDevice && result.profile.device?.deviceId !== conditions.deviceId) {
				otherDevices += 1;
				continue;
			}
			const report = evaluateProfileCompatibility(result.profile, conditions);
			if (report.state === "compatible") {
				this.profiles.register(document);
				this.storedProfileOutcomes.set(cameraId, {
					state: "restored",
					detail: describeStoredProfile(result.profile)
				});
				return;
			}
			if (report.state === "incompatible") incompatible ?? (incompatible = report);
			else undetermined ?? (undetermined = report);
		}
		const decisive = incompatible ?? undetermined;
		this.storedProfileOutcomes.set(cameraId, decisive === void 0 ? {
			state: "none",
			detail: otherDevices === 0 ? "" : `${otherDevices} saved profile(s) were calibrated on other devices and were not considered.`
		} : {
			state: decisive.state,
			detail: compatibilityDetail(decisive)
		});
	}
	storedCameraProfileResult(args = {}) {
		return this.storedProfileOutcomes.get(normalizeId(args.CAMERA_ID))?.state ?? "";
	}
	storedCameraProfileDetail(args = {}) {
		return this.storedProfileOutcomes.get(normalizeId(args.CAMERA_ID))?.detail ?? "";
	}
	/**
	* A counter that moves whenever a profile is saved, here or in another window on this origin.
	*
	* A project waiting for the calibration app compares this integer rather than polling storage: it
	* restores when the number moves, and the restore decides whether what arrived is usable.
	*/
	storedCameraProfilesGeneration() {
		return this.storedProfilesGeneration;
	}
	forgetCameraProfile(args = {}) {
		this.profiles.forget(normalizeId(args.CAMERA_ID));
	}
	cameraProfileRegistered(args = {}) {
		return this.profiles.has(normalizeId(args.CAMERA_ID));
	}
	cameraProfileJson(args = {}) {
		const profile = this.profiles.get(normalizeId(args.CAMERA_ID));
		return profile ? serializeCameraIntrinsicProfile(profile) : "";
	}
	/**
	* The registered profile as a ROS `camera_info` YAML document, which is how a calibration is
	* written to a file or handed to another machine.
	*
	* The standard part loads in ROS and OpenCV-based tools as it is. What deciding compatibility needs
	* and ROS has no place for travels in the `turbowarp_camera_source` mapping, which ROS's reader
	* does not look at.
	*/
	cameraProfileYaml(args = {}) {
		const profile = this.profiles.get(normalizeId(args.CAMERA_ID));
		return profile ? serializeCameraInfoYaml(profile) : "";
	}
	cameraProfileError() {
		return this.profileError?.code ?? "";
	}
	cameraProfileErrorDetail() {
		if (!this.profileError) return "";
		const { path, message } = this.profileError;
		return path ? `${path}: ${message}` : message;
	}
	cameraProfileCompatibility(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		return this.assessmentOf(cameraId)?.compatibility.state ?? "";
	}
	cameraProfileCompatibilityDetail(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		const assessment = this.assessmentOf(cameraId);
		return assessment === void 0 ? "" : compatibilityDetail(assessment.compatibility);
	}
	cameraProfileAdaptation(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		return this.assessmentOf(cameraId)?.adaptation.state ?? "";
	}
	cameraProfileIntrinsicsJson(args = {}) {
		const cameraId = normalizeId(args.CAMERA_ID);
		const usable = this.intrinsicsOf(cameraId);
		return usable === void 0 ? "" : JSON.stringify(usable);
	}
	cameraConditionsJson(args = {}) {
		return JSON.stringify(this.conditionsOf(normalizeId(args.CAMERA_ID)));
	}
	cameraConditionsGeneration(args = {}) {
		return this.generationOf(normalizeId(args.CAMERA_ID));
	}
	/**
	* Registers profile text, whichever of the two forms an operator was handed.
	*
	* A ROS `camera_info` YAML file is what the calibration app writes and what leaves the PC; profile
	* JSON is what this extension renders and stores. Both reach the same validator, so a file is
	* accepted or refused for the same reasons whichever form it came in.
	*/
	registerProfileText(value, prepare) {
		const parsed = readProfileText(Scratch.Cast.toString(value ?? ""));
		if (!parsed.ok) {
			this.profileError = parsed.error;
			return;
		}
		const result = this.profiles.register(prepare(parsed.document));
		this.profileError = result.ok ? void 0 : result.error;
	}
	/**
	* Listens for saves made in other windows on this origin.
	*
	* Absent where the browser has no BroadcastChannel. The generation then moves only for saves made
	* here, and a project still finds another window's profile the next time it restores.
	*/
	openProfileChannel() {
		const Channel = globalThis.BroadcastChannel;
		if (typeof Channel !== "function") return void 0;
		try {
			const channel = new Channel(cameraProfileChannelName);
			channel.onmessage = () => {
				this.storedProfilesGeneration += 1;
			};
			return channel;
		} catch {
			return;
		}
	}
	/** What the track reports about itself right now. Read only. */
	intrinsicsOf(cameraId) {
		const id = normalizeId(cameraId);
		return this.assessmentOf(id)?.usable;
	}
	conditionsOf(cameraId) {
		const id = normalizeId(cameraId);
		const session = this.sessions.get(id);
		if (!session?.stream) return {
			width: 0,
			height: 0,
			deviceId: "",
			previewFlip: "none"
		};
		const track = session.stream.getVideoTracks()[0];
		let settings = {};
		try {
			settings = track?.getSettings() ?? {};
		} catch {
			settings = {};
		}
		const device = this.devices.find((entry) => entry.deviceId === session.activeDeviceId);
		return readCameraConditions({
			width: session.video?.videoWidth ?? 0,
			height: session.video?.videoHeight ?? 0,
			deviceId: session.activeDeviceId,
			previewFlip: this.previewFlip(session),
			...device?.label ? { label: device.label } : {}
		}, settings);
	}
	/**
	* A counter that moves when the geometry does.
	*
	* Derived by comparing the members that affect projection, so it advances on
	* a resolution change or a zoom and stays put for a frame rate change. A
	* consumer holding a placement solved from these conditions compares one
	* number rather than re-checking each of them.
	*/
	/**
	* The conditions that decide geometry, as one comparable string.
	*
	* The preview flip is not among them. It changes how the stage draws the frame and nothing about
	* how the lens projects, so folding it in would advance the generation and invalidate consumers'
	* work every time an operator turned the preview over.
	*/
	conditionsSignature(conditions) {
		return JSON.stringify([
			conditions.width,
			conditions.height,
			conditions.resizeMode ?? null,
			conditions.zoom ?? null,
			conditions.focusMode ?? null,
			conditions.focusDistance ?? null,
			conditions.deviceId
		]);
	}
	/**
	* The assessment for a camera, reusing the last one while nothing it depends on has changed.
	*
	* The conditions are read on every call, so this cannot answer with a stale view of the camera.
	* What is skipped is the derivation: judging compatibility builds a finding for every member it
	* compares, each with its own sentence, and these reporters are read from blocks that a project
	* can evaluate on every frame. Reusing the result while the inputs are identical keeps that off
	* the frame budget without putting a staleness window in its place.
	*/
	assessmentOf(cameraId) {
		const id = normalizeId(cameraId);
		const conditions = this.conditionsOf(id);
		const signature = this.conditionsSignature(conditions);
		const profile = this.profiles.get(id);
		const cached = this.assessments.get(id);
		if (cached && cached.signature === signature && cached.profile === profile) return cached.assessment;
		const assessment = this.profiles.assess(id, conditions);
		this.assessments.set(id, {
			signature,
			profile,
			assessment
		});
		return assessment;
	}
	generationOf(cameraId) {
		const id = normalizeId(cameraId);
		const conditions = this.conditionsOf(id);
		const signature = this.conditionsSignature(conditions);
		const previous = this.lastConditions.get(id);
		if (previous === void 0) {
			this.lastConditions.set(id, signature);
			this.generations.set(id, 0);
			return 0;
		}
		if (previous === signature) return this.generations.get(id) ?? 0;
		const next = (this.generations.get(id) ?? 0) + 1;
		this.lastConditions.set(id, signature);
		this.generations.set(id, next);
		return next;
	}
	session(cameraId) {
		const existing = this.sessions.get(cameraId);
		if (existing) return existing;
		const session = {
			cameraId,
			leases: /* @__PURE__ */ new Set(),
			previewLeases: /* @__PURE__ */ new Map(),
			active: true,
			stream: null,
			video: null,
			preview: null,
			startPromise: null,
			activeDeviceId: "",
			frameTimes: null,
			adopted: false
		};
		this.sessions.set(cameraId, session);
		return session;
	}
	/**
	* Brings a caller's stream into a session, taking the same path `start` takes after acquisition.
	*
	* `adopted` is set before anything can fail, so no failure path can reach the tracks.
	*/
	async adopt(session, stream) {
		session.adopted = true;
		session.startPromise = (async () => {
			let video = null;
			try {
				if (!session.active) throw new Error("Camera adoption was cancelled.");
				video = document.createElement("video");
				video.muted = true;
				video.playsInline = true;
				video.srcObject = stream;
				await video.play();
				if (!session.active) throw new Error("Camera adoption was cancelled.");
				session.stream = stream;
				session.video = video;
				session.frameTimes = new FrameTimeWatcher(video, globalThis.performance?.timeOrigin ?? 0);
				this.watchStreamEnd(session, stream);
				this.updateActiveDevice(session);
				this.cameraFailures.delete(session.cameraId);
			} catch (error) {
				if (video) video.srcObject = null;
				throw error;
			}
		})();
		try {
			await session.startPromise;
		} catch (error) {
			if (this.sessions.get(session.cameraId) === session) this.stopCameraSession(session.cameraId);
			this.cameraFailures.set(session.cameraId, cameraFailure(error));
			throw error;
		}
	}
	async start(session, options) {
		session.startPromise = (async () => {
			const stream = await mediaDevices().getUserMedia(videoConstraints(options));
			let video = null;
			try {
				if (!session.active) throw new Error("Camera acquisition was cancelled.");
				video = document.createElement("video");
				video.muted = true;
				video.playsInline = true;
				video.srcObject = stream;
				await video.play();
				if (!session.active) throw new Error("Camera acquisition was cancelled.");
				session.stream = stream;
				session.video = video;
				session.frameTimes = new FrameTimeWatcher(video, globalThis.performance?.timeOrigin ?? 0);
				this.watchStreamEnd(session, stream);
				this.updateActiveDevice(session);
				this.cameraFailures.delete(session.cameraId);
			} catch (error) {
				stream.getTracks().forEach((track) => track.stop());
				if (video) video.srcObject = null;
				throw error;
			}
		})();
		try {
			await session.startPromise;
		} catch (error) {
			if (this.sessions.get(session.cameraId) === session) this.stopCameraSession(session.cameraId);
			this.cameraFailures.set(session.cameraId, cameraFailure(error));
			throw error;
		}
	}
	nextPreviewBlockRevision(cameraId) {
		const revision = (this.blockPreviewRevisions.get(cameraId) ?? 0) + 1;
		this.blockPreviewRevisions.set(cameraId, revision);
		return revision;
	}
	isStreamRunning(stream) {
		return stream.active !== false && stream.getVideoTracks().some((track) => track.readyState !== "ended");
	}
	watchStreamEnd(session, stream) {
		const handleEnded = () => {
			if (this.sessions.get(session.cameraId) !== session || session.stream !== stream) return;
			if (!this.isStreamRunning(stream)) this.stopCameraSession(session.cameraId);
		};
		for (const track of stream.getVideoTracks()) track.addEventListener("ended", handleEnded, { once: true });
	}
	updateActiveDevice(session) {
		const settings = (session.stream?.getVideoTracks()[0] ?? null)?.getSettings();
		session.activeDeviceId = typeof settings?.deviceId === "string" ? settings.deviceId : "";
	}
	trackSetting(session, name) {
		const value = session.stream?.getVideoTracks()[0]?.getSettings()[name];
		return typeof value === "number" && Number.isFinite(value) ? value : 0;
	}
	ensurePreview(session) {
		if (session.preview || !session.video) return;
		const runtime = Scratch.vm.runtime;
		session.preview = createVideoPreview(runtime.renderer, session.video, this.previewFlip(session), () => runtime.requestRedraw?.());
	}
	/**
	* How the preview is shown for a camera several consumers may be watching.
	*
	* Any consumer asking for a flipped preview flips it for everyone, which is
	* the same rule the previous boolean followed.
	*/
	previewFlip(session) {
		for (const flip of session.previewLeases.values()) if (flip !== "none") return flip;
		return "none";
	}
	getFrameSource(session) {
		if (!session.video || !session.stream) throw new Error("Shared camera is not running.");
		const frameTime = session.frameTimes?.latest();
		return Object.freeze({
			kind: "video",
			element: session.video,
			width: session.video.videoWidth,
			height: session.video.videoHeight,
			previewFlip: this.previewFlip(session),
			deviceId: session.activeDeviceId,
			...frameTime === void 0 ? {} : { frameTime }
		});
	}
	stopWhenUnused(session) {
		if (this.sessions.get(session.cameraId) !== session) return;
		if (session.leases.size === 0) this.stopCameraSession(session.cameraId);
	}
	stopCameraSession(cameraId) {
		const session = this.sessions.get(cameraId);
		if (!session) return;
		session.active = false;
		this.nextPreviewBlockRevision(cameraId);
		session.preview?.dispose();
		session.frameTimes?.dispose();
		session.frameTimes = null;
		const stream = session.stream;
		if (stream && (!session.adopted || this.cameraButtonStreams.has(stream))) {
			this.cameraButtonStreams.delete(stream);
			stream.getTracks().forEach((track) => track.stop());
		}
		if (session.video) session.video.srcObject = null;
		session.stream = null;
		session.video = null;
		session.startPromise = null;
		session.preview = null;
		session.activeDeviceId = "";
		session.leases.clear();
		session.previewLeases.clear();
		this.sessions.delete(cameraId);
		this.blockLeases.delete(cameraId);
		this.blockPreviewLeases.delete(cameraId);
		this.assessments.delete(cameraId);
	}
	toScratchBlock(block) {
		return {
			opcode: block.opcode,
			blockType: Scratch.BlockType[block.blockType],
			text: Scratch.translate(block.text),
			arguments: Object.fromEntries(Object.entries(block.arguments).map(([name, argument]) => [name, {
				type: Scratch.ArgumentType[argument.type],
				defaultValue: argument.defaultValue,
				...argument.menu === void 0 ? {} : { menu: argument.menu }
			}]))
		};
	}
};
if (extensionConfig.unsandboxed && !Scratch.extensions.unsandboxed) throw new Error(`${extensionConfig.name} must run unsandboxed.`);
Scratch.extensions.register(new CameraSourceExtension());

})(Scratch);
