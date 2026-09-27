[CleanGIFPicker.plugin.js](https://github.com/user-attachments/files/32698376/CleanGIFPicker.plugin.js)
# CleanGIFPicker

A lightweight BetterDiscord plugin that streamlines your Discord GIF experience by decluttering internet suggestions, automatically focusing on your Favorites, and providing live diagnostics to catch broken embeds.

---

## 📽️ Preview

<img width="728" height="362" alt="gifff" src="https://github.com/user-attachments/assets/8a324294-287f-4f60-ba35-3a5e7122a7da" />


---

## ✨ Features
/**
 * @name CleanGIFPicker
 * @author datae
 * @description Right-click the chat bar GIF button to toggle favorites-only view, and right-click individual GIFs to check for embed issues.
 * @version 1.7.0
 * @source https://github.com/Illytx/CleanGIFPicker
 */

module.exports = class CleanGIFPicker {
    constructor() {
        this.defaultSettings = {
            favoritesOnly: true,
            warnBrokenEmbeds: true
        };
        this.settings = Object.assign({}, this.defaultSettings);
    }

    start() {
        this.settings = BdApi.Data.load("CleanGIFPicker", "settings") || this.defaultSettings;

        this.applyStyles();
        this.bindEvents();
    }

    stop() {
        BdApi.DOM.removeStyle("CleanGIFPicker-CSS");
        if (this.contextHandler) {
            window.removeEventListener("contextmenu", this.contextHandler, true);
        }
        if (this.clickHandler) {
            window.removeEventListener("click", this.clickHandler, true);
        }
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        document.querySelectorAll(".clean-gif-broken").forEach(el => el.classList.remove("clean-gif-broken"));
    }

    applyStyles() {
        if (this.settings.favoritesOnly) {
            BdApi.DOM.addStyle(
                "CleanGIFPicker-CSS",
                `
                /* Hide non-favorite category tiles */
                [class*="result__2dc39"][role="button"]:has([class*="categoryFade"]):not([aria-label*="Favorites" i]),
                [class*="result__2dc39"][role="button"]:has([class*="categoryText"]):not([aria-label*="Favorites" i]) {
                    display: none !important;
                }

                /* Ensure actual GIF items inside Favorites remain visible */
                [class*="result__2dc39"]:not(:has([class*="categoryFade"])) {
                    display: block !important;
                }

                /* Visual warning indicator for broken GIFs */
                .clean-gif-broken {
                    outline: 2px dashed #f23f43 !important;
                    opacity: 0.6 !important;
                    position: relative;
                }
                .clean-gif-broken::after {
                    content: "⚠️ Broken Embed";
                    position: absolute;
                    bottom: 4px;
                    left: 4px;
                    background: rgba(0, 0, 0, 0.85);
                    color: #f23f43;
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 4px;
                    pointer-events: none;
                }
                `
            );
        } else {
            BdApi.DOM.removeStyle("CleanGIFPicker-CSS");
        }
    }

    extractMediaUrl(card) {
        if (!card) return "";
        const img = card.querySelector("img");
        const video = card.querySelector("video");
        return img?.getAttribute("src") || video?.getAttribute("src") || "";
    }

    isUrlExpired(url) {
        if (!url) return false;
        if (url.includes("cdn.discordapp.com/attachments/") || url.includes("media.discordapp.net/attachments/")) {
            try {
                const urlObj = new URL(url, window.location.href);
                const exParam = urlObj.searchParams.get("ex");
                if (exParam) {
                    const expireTimestamp = parseInt(exParam, 16) * 1000;
                    return !isNaN(expireTimestamp) && Date.now() > expireTimestamp;
                }
            } catch (_) {}
        }
        return false;
    }

    async testEmbedUrl(url, card) {
        if (!url) {
            BdApi.UI.showToast("❌ No media URL found for this GIF.", { type: "error" });
            return;
        }

        // 1. Check CDN Timestamp
        if (this.isUrlExpired(url)) {
            BdApi.UI.showToast("⚠️ Failed: Discord CDN token expired. This GIF will not embed in chat.", {
                type: "error",
                timeout: 5000
            });
            if (card) card.classList.add("clean-gif-broken");
            return;
        }

        // 2. Check DOM load status
        const img = card?.querySelector("img");
        if (img && img.complete && img.naturalWidth === 0) {
            BdApi.UI.showToast("⚠️ Failed: Image failed to render or source is 404.", {
                type: "error",
                timeout: 5000
            });
            if (card) card.classList.add("clean-gif-broken");
            return;
        }

        // 3. Ping the URL
        BdApi.UI.showToast("Checking GIF embed status...", { type: "info", timeout: 1500 });

        try {
            const res = await fetch(url, { method: "HEAD", mode: "no-cors" });
            BdApi.UI.showToast("✅ Valid: This GIF is active and ready to embed.", {
                type: "success",
                timeout: 4000
            });
            if (card) card.classList.remove("clean-gif-broken");
        } catch (err) {
            BdApi.UI.showToast("⚠️ Warning: Network request failed. The GIF link might fail to embed.", {
                type: "warn",
                timeout: 5000
            });
            if (card) card.classList.add("clean-gif-broken");
        }
    }

    bindEvents() {
        this.contextHandler = (e) => {
            const target = e.target;

            // Scenario A: Right-clicking an individual GIF tile inside the picker
            const gifCard = target.closest('[class*="result__2dc39"]:not(:has([class*="categoryFade"]))');
            if (gifCard) {
                e.preventDefault();
                e.stopPropagation();

                const mediaUrl = this.extractMediaUrl(gifCard);

                BdApi.ContextMenu.open(
                    e,
                    BdApi.ContextMenu.buildMenu([
                        {
                            type: "group",
                            items: [
                                {
                                    type: "button",
                                    id: "clean-gif-check-issues",
                                    label: "🔍 Check for Issues / Test Embed",
                                    action: () => this.testEmbedUrl(mediaUrl, gifCard)
                                },
                                {
                                    type: "button",
                                    id: "clean-gif-copy-link",
                                    label: "📋 Copy Media Link",
                                    action: () => {
                                        if (mediaUrl) {
                                            DiscordNative.clipboard.copy(mediaUrl);
                                            BdApi.UI.showToast("Link copied to clipboard!", { type: "info" });
                                        }
                                    }
                                }
                            ]
                        }
                    ])
                );
                return;
            }

            // Scenario B: Right-clicking the main GIF button in the chat bar
            const gifBtn = target.closest('[role="button"][aria-label*="GIF" i]') ||
                           target.closest('.expression-picker-chat-input-button [role="button"]');

            if (!gifBtn) return;

            const ariaLabel = (gifBtn.getAttribute("aria-label") || "").toLowerCase();
            const describedBy = gifBtn.getAttribute("aria-describedby") || "";
            const isGif = ariaLabel.includes("gif") || 
                          Boolean(document.getElementById(describedBy)?.textContent?.toLowerCase().includes("gif"));

            if (!isGif) return;

            e.preventDefault();
            e.stopPropagation();

            BdApi.ContextMenu.open(
                e,
                BdApi.ContextMenu.buildMenu([
                    {
                        type: "group",
                        items: [
                            {
                                type: "toggle",
                                id: "clean-gif-toggle",
                                label: "Favorites Only (Hide Internet GIFs)",
                                checked: this.settings.favoritesOnly,
                                action: () => {
                                    this.settings.favoritesOnly = !this.settings.favoritesOnly;
                                    this.saveSettings();
                                    this.applyStyles();

                                    BdApi.UI.showToast(
                                        this.settings.favoritesOnly 
                                            ? "GIF Picker: Favorites Only" 
                                            : "GIF Picker: Showing All GIFs",
                                        { type: "info" }
                                    );
                                }
                            },
                            {
                                type: "toggle",
                                id: "clean-gif-warn-toggle",
                                label: "Warn on Broken Embeds",
                                checked: this.settings.warnBrokenEmbeds,
                                action: () => {
                                    this.settings.warnBrokenEmbeds = !this.settings.warnBrokenEmbeds;
                                    this.saveSettings();
                                }
                            }
                        ]
                    }
                ])
            );
        };

        window.addEventListener("contextmenu", this.contextHandler, true);

        // Click interceptor to warn if clicking on a marked dead GIF
        this.clickHandler = (e) => {
            if (!this.settings.warnBrokenEmbeds) return;

            const gifCard = e.target.closest('[class*="result__2dc39"]:not(:has([class*="categoryFade"]))');
            if (!gifCard) return;

            const mediaUrl = this.extractMediaUrl(gifCard);
            const img = gifCard.querySelector("img");

            const isBroken = (img && img.naturalWidth === 0 && img.complete) || this.isUrlExpired(mediaUrl);

            if (isBroken) {
                BdApi.UI.showToast("⚠️ Warning: This GIF link appears to be broken or expired and will fail to embed.", {
                    type: "warn",
                    timeout: 4000
                });
            }
        };

        window.addEventListener("click", this.clickHandler, true);

        // Observer: auto-navigate to Favorites & tag broken embeds automatically
        this.observer = new MutationObserver(() => {
            if (this.settings.favoritesOnly) {
                const favTile = document.querySelector('[class*="result__2dc39"][role="button"][aria-label*="Favorites" i]:has([class*="categoryFade"])');
                if (favTile && !favTile.hasAttribute("data-clean-gif-clicked")) {
                    favTile.setAttribute("data-clean-gif-clicked", "true");
                    favTile.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
                    favTile.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                    favTile.click();
                }
            }

            if (this.settings.warnBrokenEmbeds) {
                const cards = document.querySelectorAll('[class*="result__2dc39"]:not(:has([class*="categoryFade"])):not([data-embed-checked])');
                cards.forEach(card => {
                    card.setAttribute("data-embed-checked", "true");
                    const mediaUrl = this.extractMediaUrl(card);
                    const img = card.querySelector("img");

                    const markBroken = () => card.classList.add("clean-gif-broken");

                    if (this.isUrlExpired(mediaUrl)) {
                        markBroken();
                    } else if (img) {
                        img.addEventListener("error", markBroken, { once: true });
                        if (img.complete && img.naturalWidth === 0) {
                            markBroken();
                        }
                    }
                });
            }
        });

        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    saveSettings() {
        BdApi.Data.save("CleanGIFPicker", "settings", this.settings);
    }
};
- **Favorites-Only Mode**: Strips away trending internet categories, search suggestions, and clutter—keeping your picker focused strictly on your saved GIFs.
- **Auto-Jump to Favorites**: Automatically opens directly into your saved Favorites tab whenever the GIF picker is invoked.
- **Embed Diagnostics**: Right-click any individual GIF inside your favorites to run live checks:
  - Detects expired Discord CDN tokens (`?ex=` parameters).
  - Flags dead/404 image sources before you send them.
  - Automatically tags dead embeds with a dashed red border and a warning badge.
- **Right-Click Chat Bar Quick Toggle**: Right-click the GIF button directly on your chat bar to toggle between Favorites-Only mode and standard browsing on the fly.
- **Quick Copy**: Right-click any GIF to copy its clean direct media link to your clipboard.

---

## 🚀 Installation

1. Make sure you have [BetterDiscord](https://betterdiscord.app/) installed.
2. Download the [`CleanGIFPicker.plugin.js`](./CleanGIFPicker.plugin.js) file from this repository.
3. Move the downloaded file into your BetterDiscord plugins folder:
   - **Windows**: `%appdata%\BetterDiscord\plugins`
   - **macOS**: `~/Library/Application Support/BetterDiscord/plugins`
   - **Linux**: `~/.config/BetterDiscord/plugins`
4. Open Discord, head to **User Settings** $\rightarrow$ **Plugins**, and toggle **CleanGIFPicker** on.

---

## 🛠️ Usage

- **Toggle Favorites Mode**: Right-click the **GIF** button next to the chat message box to open the settings toggle.
- **Test a GIF Embed**: Right-click any thumbnail inside your Favorites grid and select **"🔍 Check for Issues / Test Embed"**.
- **Copy Direct URL**: Right-click any GIF thumbnail and select **"📋 Copy Media Link"**.

---

## 📝 License

Distributed under the [MIT License](LICENSE).
