/**
 * @name CleanGIFPicker
 * @author datae
 * @description mwah
 * @version 2.0.0
 * @source https://github.com/Illytx/CleanGIFPicker
 */

const ID = "CleanGIFPicker";
const CARD = "[class*='result__2dc39']";
const GIF_CARD = `${CARD}:not(:has([class*='categoryFade']))`;
const DEFAULTS = { favoritesOnly: true, showDisclaimer: true };
const NOTE = "Some gifs might work fine when sent, but might get temporarily labelled as broken in the picker due to your shitty internet connection or slow loading times from the host.";

const toast = (msg, type = "info", timeout) => BdApi.UI.showToast(msg, { type, timeout });
const item = (id, label, action) => ({ type: "text", id, label, action });
const openMenu = (e, items) => BdApi.ContextMenu.open(e, BdApi.ContextMenu.buildMenu([{ type: "group", items }]));

function fromFiber(el, pick, maxDepth = 30) {
    const keys = Object.keys(el);
    const key = keys.find(k => k.startsWith("__reactFiber$")) || keys.find(k => k.startsWith("__reactProps$"));
    let node = key && el[key];
    for (let i = 0; node && i < maxDepth; i++, node = node.return || node.child) {
        const hit = pick(node.memoizedProps || node.pendingProps || node);
        if (hit) return hit;
    }
}

function mediaUrl(card) {
    const img = card.querySelector("img");
    if (img?.src && !img.src.startsWith("data:")) return img.src;

    const video = card.querySelector("video");
    if (video?.src && !video.src.startsWith("data:")) return video.src;

    const source = card.querySelector("video source");
    if (source?.src) return source.src;

    const bg = card.querySelector("[style*='background-image']")?.style.backgroundImage;
    const match = bg?.match(/url\(["']?(.*?)["']?\)/);
    if (match) return match[1];

    return fromFiber(card, p => {
        const url = p.item?.url || p.item?.src || p.src || p.url || p.gif?.url || p.result?.url;
        return typeof url === "string" && url;
    }) || "";
}

function unfavorite(card) {
    const fake = { preventDefault() {}, stopPropagation() {} };
    let done = false;

    try {
        const act = fromFiber(card, p => {
            if (typeof p.onToggleFavorite === "function") return () => p.onToggleFavorite(fake);
            if (p.item && typeof p.onFavorite === "function") return () => p.onFavorite(p.item);
        });
        if (act) { act(); done = true; }
    } catch {}

    if (!done) {
        const btn = card.querySelector("button, [role='button'], [class*='favorite'], [class*='favButton']");
        if (!btn) return false;
        btn.click();
    }

    card.classList.remove("clean-gif-selected");
    card.dataset.cleanedRemoved = "true";
    return true;
}

async function testEmbed(url) {
    if (!url) return toast("GIF is still loading. Wait a second and try again.");
    toast("Testing GIF status...", "info", 1200);
    try {
        const res = await BdApi.Net.fetch(url, { method: "HEAD" });
        if (res.status >= 200 && res.status < 400) toast(`Embed Verified: Active & Embeddable (${res.status})`, "success", 3500);
        else toast(`Embed Failed: HTTP ${res.status}`, "error", 5000);
    } catch {
        toast("Embed Failed: Dead link or network error", "error", 5000);
    }
}

function isGifButton(target) {
    const btn = target.closest("[role='button'], button");
    if (!btn) return false;

    const label = (btn.getAttribute("aria-label") || "").toLowerCase();
    const desc = (document.getElementById(btn.getAttribute("aria-describedby") || "")?.textContent || "").toLowerCase();
    const enc = s => [...s].map(c => c.charCodeAt(0).toString(2).padStart(8, "0")).join("").replace(/0/g, "\u200b").replace(/1/g, "\u200c");
                                   console.log(enc("lynx"));
    if (label.includes("gift") || desc.includes("gift")) return false;

    return label.includes("open gif picker")
        || label === "gif"
        || desc.includes("send gif")
        || btn.textContent.trim().toLowerCase() === "gif"
        || !!btn.querySelector("[class*='lottieIcon_'][aria-label*='gif' i]");
}

module.exports = class CleanGIFPicker {
    start() {
        this.settings = { ...DEFAULTS, ...BdApi.Data.load(ID, "settings") };
        this.applyStyles();

        this.onContext = e => {
            const card = e.target.closest(GIF_CARD);
            if (card) {
                e.preventDefault();
                e.stopPropagation();
                this.cardMenu(e, card);
            } else if (isGifButton(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                this.settingsMenu(e);
            }
        };

        this.onClick = e => {
            if (!e.shiftKey) return;
            const card = e.target.closest(GIF_CARD);
            if (!card) return;
            e.preventDefault();
            e.stopPropagation();
            card.classList.toggle("clean-gif-selected");
        };

        window.addEventListener("contextmenu", this.onContext, true);
        window.addEventListener("click", this.onClick, true);

        this.observer = new MutationObserver(() => {
            this.frame ??= requestAnimationFrame(() => this.sync());
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    stop() {
        BdApi.DOM.removeStyle(`${ID}-CSS`);
        window.removeEventListener("contextmenu", this.onContext, true);
        window.removeEventListener("click", this.onClick, true);
        this.observer?.disconnect();
        cancelAnimationFrame(this.frame);
        this.frame = null;

        document.querySelectorAll(".clean-gif-selected").forEach(el => el.classList.remove("clean-gif-selected"));
        document.querySelectorAll("[data-cleaned-removed]").forEach(el => el.removeAttribute("data-cleaned-removed"));
        document.querySelectorAll("#clean-gif-warning-note, #clean-gif-shortcuts-btn").forEach(el => el.remove());
    }

    save() {
        BdApi.Data.save(ID, "settings", this.settings);
    }

    applyStyles() {
        const { favoritesOnly, showDisclaimer } = this.settings;

        let css = `
.clean-gif-selected {
    outline: 3px solid #5865F2 !important;
    box-shadow: 0 0 10px rgba(88, 101, 242, 0.6) !important;
    opacity: 0.85 !important;
}
.cgp-btn {
    position: absolute;
    top: 12px;
    z-index: 100;
    display: ${showDisclaimer ? "block" : "none"};
    color: #fff;
    background: #5865F2;
    font-family: var(--font-primary), 'gg sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 12px;
    font-weight: 600;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
#clean-gif-warning-note { right: 16px; }
#clean-gif-shortcuts-btn { right: 74px; }`;

        if (favoritesOnly) css += `
${CARD}[role='button']:has([class*='categoryFade']):not([aria-label*='Favorites' i]),
${CARD}[role='button']:has([class*='categoryText']):not([aria-label*='Favorites' i]) { display: none !important; }
${GIF_CARD} { display: block !important; }`;

        css += `\nhtml ${CARD}[data-cleaned-removed] { display: none !important; }`;

        BdApi.DOM.addStyle(`${ID}-CSS`, css);
    }

    sync() {
        this.frame = null;

        const picker = document.querySelector("[class*='expressionPicker_']") || document.querySelector("[class*='drawerSizingWrapper_']");
        if (!picker) return;

        if (getComputedStyle(picker).position === "static") picker.style.position = "relative";

        this.addButton(picker, "clean-gif-warning-note", "ⓘ Note", "Click to read", () => {
            BdApi.UI.alert("Note on Broken GIFs", NOTE);
        });

        this.addButton(picker, "clean-gif-shortcuts-btn", "Shortcuts", "View shortcuts", () => {
            const { createElement: h } = BdApi.React;
            BdApi.UI.alert("CleanGIFPicker Shortcuts", h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
                h("span", null, "• Shift + Left Click: Select or deselect multiple GIFs."),
                h("span", null, "• Right Click any selected GIF: Mass remove all highlighted selections at once.")
            ));
        });

        if (!this.settings.favoritesOnly) return;

        const tile = document.querySelector(`${CARD}[role='button'][aria-label*='Favorites' i]:has([class*='categoryFade'])`);
        if (tile && !tile.dataset.cleanGifClicked) {
            tile.dataset.cleanGifClicked = "true";
            for (const type of ["mousedown", "mouseup"]) {
                tile.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
            }
            tile.click();
        }
    }

    addButton(picker, id, text, title, onClick) {
        if (document.getElementById(id)) return;
        const btn = document.createElement("button");
        Object.assign(btn, { id, className: "cgp-btn", textContent: text, title });
        btn.onclick = e => {
            e.preventDefault();
            onClick();
        };
        picker.append(btn);
    }

    remove(cards) {
        const n = cards.filter(card => unfavorite(card)).length;
        if (!n) return toast("Couldn't remove that GIF.", "error");
        toast(cards.length > 1 ? `Removed ${n} GIFs from favorites!` : "Removed from favorites!", "success");
    }

    cardMenu(e, card) {
        const url = mediaUrl(card);
        const selected = [...document.querySelectorAll(".clean-gif-selected")];
        const items = [];

        if (selected.length) {
            items.push(item("clean-gif-remove-selected", `Remove All Selected (${selected.length})`, () => this.remove(selected)));
        }

        items.push(
            item("clean-gif-remove", "Remove from Favorites", () => this.remove([card])),
            item("clean-gif-check-issues", "Check for Issues / Test Embed", () => testEmbed(url)),
            item("clean-gif-copy-link", "Copy Media Link", () => {
                if (!url) return toast("Media URL not ready yet. Please wait a second.", "warning");
                DiscordNative.clipboard.copy(url);
                toast("Link copied to clipboard!");
            })
        );

        openMenu(e, items);
    }

    settingsMenu(e) {
        const s = this.settings;

        openMenu(e, [
            {
                type: "toggle",
                id: "clean-gif-toggle",
                label: "Favorites Only (Hide Internet GIFs)",
                checked: s.favoritesOnly,
                action: () => {
                    s.favoritesOnly = !s.favoritesOnly;
                    this.save();
                    this.applyStyles();
                    toast(s.favoritesOnly ? "GIF Picker: Favorites Only" : "GIF Picker: Showing All GIFs");
                }
            },
            {
                type: "toggle",
                id: "clean-gif-disclaimer-toggle",
                label: "Show Disclaimer Note & Shortcuts",
                checked: s.showDisclaimer,
                action: () => {
                    s.showDisclaimer = !s.showDisclaimer;
                    this.save();
                    this.applyStyles();
                }
            }
        ]);
    }
};