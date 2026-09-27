# CleanGIFPicker

A lightweight BetterDiscord plugin that streamlines your Discord GIF experience by decluttering internet suggestions, automatically focusing on your Favorites, and providing live diagnostics to catch broken embeds.

---

## 📽️ Preview

(<img width="728" height="362" alt="gifff" src="https://github.com/user-attachments/assets/8a324294-287f-4f60-ba35-3a5e7122a7da" />.gif)


---

## ✨ Features

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
