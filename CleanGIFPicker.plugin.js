/**
 * @name CleanGIFPicker
 * @author datae
 * @description Right-click the chat bar GIF button to toggle favorites-only view, Shift + Left Click to select multiple GIFs, and right-click to mass remove.
 * @version 1.9.17
 * @source https://github.com/Illytx/CleanGIFPicker
 */

module.exports = class CleanGIFPicker {
    constructor() {
        this.defaultSettings = {
            favoritesOnly: true,
            showDisclaimer: true
        };
        this.settings = Object.assign({}, this.defaultSettings);
    }

    start() {
        const loadedSettings = BdApi.Data.load("CleanGIFPicker", "settings");
        this.settings = Object.assign({}, this.defaultSettings, loadedSettings || {});

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
        document.querySelectorAll(".clean-gif-selected").forEach(function(el) {
            el.classList.remove("clean-gif-selected");
        });
        const note = document.getElementById("clean-gif-warning-note");
        if (note) note.remove();
        const shortcuts = document.getElementById("clean-gif-shortcuts-btn");
        if (shortcuts) shortcuts.remove();
    }

    applyStyles() {
        var css = "";
        
        css += ".clean-gif-selected {\n";
        css += "    outline: 3px solid #5865F2 !important;\n";
        css += "    box-shadow: 0 0 10px rgba(88, 101, 242, 0.6) !important;\n";
        css += "    opacity: 0.85 !important;\n";
        css += "}\n";

        if (this.settings.favoritesOnly) {
            css += "[class*='result__2dc39'][role='button']:has([class*='categoryFade']):not([aria-label*='Favorites' i]),\n";
            css += "[class*='result__2dc39'][role='button']:has([class*='categoryText']):not([aria-label*='Favorites' i]) {\n";
            css += "    display: none !important;\n";
            css += "}\n";
            css += "[class*='result__2dc39']:not(:has([class*='categoryFade'])) {\n";
            css += "    display: block !important;\n";
            css += "}\n";
        }

        BdApi.DOM.addStyle("CleanGIFPicker-CSS", css);
    }

    extractMediaUrl(card) {
        if (!card) return "";

        const img = card.querySelector("img");
        if (img && img.src && img.src.indexOf("data:") !== 0) return img.src;

        const video = card.querySelector("video");
        if (video && video.src && video.src.indexOf("data:") !== 0) return video.src;

        const source = card.querySelector("video source");
        if (source && source.src) return source.src;

        const bgEl = card.querySelector("[style*='background-image']");
        if (bgEl && bgEl.style && bgEl.style.backgroundImage) {
            const bgStr = bgEl.style.backgroundImage;
            if (bgStr.indexOf("url(") !== -1) {
                return bgStr.replace("url(", "").replace(")", "").replace(/"/g, "").replace(/'/g, "");
            }
        }

        try {
            const keys = Object.keys(card);
            let reactKey = null;
            for (let i = 0; i < keys.length; i++) {
                if (keys[i].indexOf("__reactFiber$") === 0 || keys[i].indexOf("__reactProps$") === 0) {
                    reactKey = keys[i];
                    break;
                }
            }
            if (reactKey) {
                let curr = card[reactKey];
                let depth = 0;
                while (curr && depth < 20) {
                    const props = curr.memoizedProps || curr.pendingProps || curr;
                    if (props) {
                        const url = (props.item && (props.item.url || props.item.src)) || props.src || props.url || (props.gif && props.gif.url) || (props.result && props.result.url);
                        if (url && typeof url === "string") return url;
                    }
                    curr = curr.return || curr.child;
                    depth++;
                }
            }
        } catch (e) {}

        return "";
    }

    removeFavorite(card) {
        if (!card) return false;

        card.style.setProperty("display", "none", "important");
        card.style.setProperty("opacity", "0", "important");
        card.style.setProperty("pointer-events", "none", "important");
        card.setAttribute("data-cleaned-removed", "true");

        try {
            const keys = Object.keys(card);
            const reactKey = keys.find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$"));
            if (reactKey) {
                let curr = card[reactKey];
                let depth = 0;
                while (curr && depth < 30) {
                    const props = curr.memoizedProps || curr.pendingProps || curr;
                    if (props) {
                        if (typeof props.onToggleFavorite === "function") {
                            props.onToggleFavorite({ preventDefault: () => {}, stopPropagation: () => {} });
                            return true;
                        }
                        if (props.item && typeof props.onFavorite === "function") {
                            props.onFavorite(props.item);
                            return true;
                        }
                    }
                    curr = curr.return || curr.child;
                    depth++;
                }
            }
        } catch (e) {}

        const anyBtn = card.querySelector("button, [role='button'], [class*='favorite'], [class*='favButton']");
        if (anyBtn) {
            anyBtn.click();
            return true;
        }

        return false;
    }

    async testEmbedUrl(url, card) {
        if (!url) {
            BdApi.UI.showToast("GIF is still loading. Wait a second and try again.", { type: "info" });
            return;
        }

        BdApi.UI.showToast("Testing GIF status...", { type: "info", timeout: 1200 });

        try {
            const res = await BdApi.Net.fetch(url, { method: "HEAD" });
            if (res.status >= 200 && res.status < 400) {
                BdApi.UI.showToast("Embed Verified: Active & Embeddable (" + res.status + ")", { type: "success", timeout: 3500 });
            } else {
                BdApi.UI.showToast("Embed Failed: HTTP " + res.status, { type: "error", timeout: 5000 });
            }
        } catch (err) {
            BdApi.UI.showToast("Embed Failed: Dead link or network error", { type: "error", timeout: 5000 });
        }
    }

    bindEvents() {
        const _this = this;

        this.contextHandler = function(e) {
            const target = e.target;
            const gifCard = target.closest("[class*='result__2dc39']:not(:has([class*='categoryFade']))");
            
            if (gifCard) {
                e.preventDefault();
                e.stopPropagation();

                const mediaUrl = _this.extractMediaUrl(gifCard);
                const selectedCards = document.querySelectorAll(".clean-gif-selected");
                const hasSelected = selectedCards.length > 0;

                const menuItems = [];

                if (hasSelected) {
                    menuItems.push({
                        type: "button",
                        id: "clean-gif-remove-selected",
                        label: "Remove All Selected (" + selectedCards.length + ")",
                        action: function() {
                            selectedCards.forEach(function(card) {
                                _this.removeFavorite(card);
                            });
                            BdApi.UI.showToast("Removed " + selectedCards.length + " GIFs from favorites!", { type: "success" });
                        }
                    });
                }

                menuItems.push(
                    {
                        type: "button",
                        id: "clean-gif-remove",
                        label: "Remove from Favorites",
                        action: function() {
                            _this.removeFavorite(gifCard);
                            BdApi.UI.showToast("Removed from favorites!", { type: "success" });
                        }
                    },
                    {
                        type: "button",
                        id: "clean-gif-check-issues",
                        label: "Check for Issues / Test Embed",
                        action: function() {
                            _this.testEmbedUrl(mediaUrl, gifCard);
                        }
                    },
                    {
                        type: "button",
                        id: "clean-gif-copy-link",
                        label: "Copy Media Link",
                        action: function() {
                            if (mediaUrl) {
                                DiscordNative.clipboard.copy(mediaUrl);
                                BdApi.UI.showToast("Link copied to clipboard!", { type: "info" });
                            } else {
                                BdApi.UI.showToast("Media URL not ready yet. Please wait a second.", { type: "warn" });
                            }
                        }
                    }
                );

                BdApi.ContextMenu.open(
                    e,
                    BdApi.ContextMenu.buildMenu([
                        {
                            type: "group",
                            items: menuItems
                        }
                    ])
                );
                return;
            }

            const btn = target.closest("[role='button'], button");
            if (!btn) return;

            const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
            const descEl = document.getElementById(btn.getAttribute("aria-describedby") || "");
            const descText = descEl ? descEl.textContent.toLowerCase() : "";
            const btnText = (btn.textContent || "").trim().toLowerCase();

            if (ariaLabel.indexOf("gift") !== -1 || descText.indexOf("gift") !== -1) return;

            const isGif = 
                ariaLabel.indexOf("open gif picker") !== -1 ||
                ariaLabel === "gif" ||
                descText.indexOf("send gif") !== -1 ||
                btnText === "gif" ||
                Boolean(btn.querySelector("[class*='lottieIcon_'][aria-label*='gif' i]"));

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
                                checked: _this.settings.favoritesOnly,
                                action: function() {
                                    _this.settings.favoritesOnly = !_this.settings.favoritesOnly;
                                    _this.saveSettings();
                                    _this.applyStyles();
                                    BdApi.UI.showToast(_this.settings.favoritesOnly ? "GIF Picker: Favorites Only" : "GIF Picker: Showing All GIFs", { type: "info" });
                                }
                            },
                            {
                                type: "toggle",
                                id: "clean-gif-disclaimer-toggle",
                                label: "Show Disclaimer Note & Shortcuts",
                                checked: _this.settings.showDisclaimer,
                                action: function() {
                                    _this.settings.showDisclaimer = !_this.settings.showDisclaimer;
                                    _this.saveSettings();
                                    if (!_this.settings.showDisclaimer) {
                                        const note = document.getElementById("clean-gif-warning-note");
                                        if (note) note.style.display = "none";
                                        const shortcuts = document.getElementById("clean-gif-shortcuts-btn");
                                        if (shortcuts) shortcuts.style.display = "none";
                                    }
                                }
                            }
                        ]
                    }
                ])
            );
        };

        window.addEventListener("contextmenu", this.contextHandler, true);

        this.clickHandler = function(e) {
            const gifCard = e.target.closest("[class*='result__2dc39']:not(:has([class*='categoryFade']))");
            if (!gifCard) return;

            if (e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                gifCard.classList.toggle("clean-gif-selected");
                return;
            }
        };

        window.addEventListener("click", this.clickHandler, true);

        this.observer = new MutationObserver(function() {
            const picker = document.querySelector("[class*='expressionPicker_']") || document.querySelector("[class*='drawerSizingWrapper_']");
            
            if (picker) {
                if (window.getComputedStyle(picker).position === "static") {
                    picker.style.position = "relative";
                }

                if (!document.getElementById("clean-gif-warning-note")) {
                    const noteEl = document.createElement("button");
                    noteEl.id = "clean-gif-warning-note";
                    noteEl.innerText = "ⓘ Note";
                    noteEl.title = "Click to read";
                    noteEl.style.position = "absolute";
                    noteEl.style.top = "12px";
                    noteEl.style.right = "16px";
                    noteEl.style.color = "#ffffff";
                    noteEl.style.backgroundColor = "#5865F2";
                    noteEl.style.fontFamily = "var(--font-primary), 'gg sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
                    noteEl.style.border = "none";
                    noteEl.style.borderRadius = "4px";
                    noteEl.style.padding = "4px 8px";
                    noteEl.style.fontSize = "12px";
                    noteEl.style.fontWeight = "600";
                    noteEl.style.cursor = "pointer";
                    noteEl.style.zIndex = "100";
                    noteEl.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.2)";
                    
                    noteEl.onclick = function(e) {
                        e.preventDefault();
                        BdApi.UI.alert(
                            "Note on Broken GIFs", 
                            "Some GIFs might work fine when sent, but might get temporarily labelled as broken in the picker due to your internet connection or slow loading times from the host."
                        );
                    };
                    picker.appendChild(noteEl);
                }

                if (!document.getElementById("clean-gif-shortcuts-btn")) {
                    const shortcutsEl = document.createElement("button");
                    shortcutsEl.id = "clean-gif-shortcuts-btn";
                    shortcutsEl.innerText = "Shortcuts";
                    shortcutsEl.title = "View shortcuts";
                    shortcutsEl.style.position = "absolute";
                    shortcutsEl.style.top = "12px";
                    shortcutsEl.style.right = "74px";
                    shortcutsEl.style.color = "#ffffff";
                    shortcutsEl.style.backgroundColor = "#5865F2";
                    shortcutsEl.style.fontFamily = "var(--font-primary), 'gg sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
                    shortcutsEl.style.border = "none";
                    shortcutsEl.style.borderRadius = "4px";
                    shortcutsEl.style.padding = "4px 8px";
                    shortcutsEl.style.fontSize = "12px";
                    shortcutsEl.style.fontWeight = "600";
                    shortcutsEl.style.cursor = "pointer";
                    shortcutsEl.style.zIndex = "100";
                    shortcutsEl.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.2)";
                    
                    shortcutsEl.onclick = function(e) {
                        e.preventDefault();
                        const modalContent = BdApi.React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } }, [
                            BdApi.React.createElement("span", null, "• Shift + Left Click: Select or deselect multiple GIFs."),
                            BdApi.React.createElement("span", null, "• Right Click any selected GIF: Mass remove all highlighted selections at once.")
                        ]);
                        BdApi.UI.alert("CleanGIFPicker Shortcuts", modalContent);
                    };
                    picker.appendChild(shortcutsEl);
                }
            }

            const noteNode = document.getElementById("clean-gif-warning-note");
            const shortcutsNode = document.getElementById("clean-gif-shortcuts-btn");
            
            if (noteNode) {
                noteNode.style.display = _this.settings.showDisclaimer ? "block" : "none";
            }
            if (shortcutsNode) {
                shortcutsNode.style.display = _this.settings.showDisclaimer ? "block" : "none";
            }

            if (_this.settings.favoritesOnly) {
                const favTile = document.querySelector("[class*='result__2dc39'][role='button'][aria-label*='Favorites' i]:has([class*='categoryFade'])");
                if (favTile && !favTile.hasAttribute("data-clean-gif-clicked")) {
                    favTile.setAttribute("data-clean-gif-clicked", "true");
                    favTile.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
                    favTile.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                    favTile.click();
                }
            }

            const cards = document.querySelectorAll("[class*='result__2dc39']:not(:has([class*='categoryFade']))");
            cards.forEach(function(card) {
                if (card.getAttribute("data-cleaned-removed") === "true") {
                    card.style.setProperty("display", "none", "important");
                    return;
                }
            });
        });

        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    saveSettings() {
        BdApi.Data.save("CleanGIFPicker", "settings", this.settings);
    }
};