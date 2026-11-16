# DARK-GPT // LOCAL AI TERMINAL

**Created by M4TH4CK3R** — *POWERED BY OLLAMA FREE*

A portable, terminal-first local AI assistant written in Python (>= 3.9) for lawful personal use, learning, software engineering, and authorized cybersecurity research.

---

## Visual & Behavior Highlights

- **Strict BLACK / WHITE / RED Terminal Theme**: High-contrast vivid red frames, `[x_x]` identity markers, AI output, and spinners paired with crisp white prompts (`YOU >`). Cleanly falls back to readable plain text when `NO_COLOR=1` is set.
- **Startup Sequence**: Types `DARK-GPT` char-by-char in red, transitions to `[x_x]  [x_x]  [x_x]  [x_x]`, animates `DARK-GPT // INITIALIZING`, announces `DARK-GPT ONLINE`, and renders the main banner with `Created by M4TH4CK3R` beneath the title.
- **Deterministic Creator Answer**: Asking who created the app automatically returns `"DARK-GPT a été créé par M4TH4CK3R."` without making an Ollama request.
- **Real Local Ollama Integration**: Defaults to `http://127.0.0.1:11434/api/chat` and `llama3.2`. Short conversational prompts (e.g., `"T'as compris ?"`, `"Ça va ?"`, `"Bonjour"`, `"Merci"`) still call Ollama with full conversation context and bounded `num_predict`; confirmation checks normalize trivial `"OK"` / `"OK."` / `"okay"` replies to `"Oui, j'ai compris."`.
- **Contextual Session Memory**: Saves sessions (`~/.dark_gpt/sessions/`) across restarts, supporting create, open/switch, list, rename, search, `.txt`/`.json` export, and delete (preserving the `default` session). *Note: this provides contextual conversation memory, not model weight training.*
- **Safe Project Workspaces**: Create, list, edit, delete, and run projects under `~/.dark_gpt/projects/` with strict path-traversal containment and explicit execution authorization prompts.

---

## Requirements & Setup

1. **Python 3.9+**
   ```bash
   python3 --version
   ```
2. **Install Python dependencies** (optional — stdlib `urllib` fallback is built in if `requests` is absent):
   ```bash
   pip install -r requirements.txt
   ```
3. **Install Ollama & pull the default model**:
   - Download Ollama from `https://ollama.com` (macOS users without admin privileges can place `Ollama.app` inside `~/Applications/Ollama.app`; DARK-GPT detects it automatically and starts it silently via `open -gj`).
   - Pull `llama3.2`:
     ```bash
     ollama pull llama3.2
     ```

---

## Running DARK-GPT

### Direct CLI
```bash
python3 dark_gpt.py
```

### Portable Double-Click Launcher (macOS / Linux)
```bash
./start.command
```
Resolves its own directory dynamically, activates `.venv` or `venv` if present, and launches `python3 dark_gpt.py`.

### VS Code Auto-Launch
Opening the `dark_gpt/` folder in Visual Studio Code runs the `.vscode/tasks.json` `folderOpen` task (`DARK-GPT // Terminal`), automatically focusing and maximizing the integrated terminal running `python3 dark_gpt.py`.

On macOS you can also use `launchers/dark-gpt-vscode.command` or build a standalone `.app` bundle with:
```bash
./launchers/build_macos_app.sh
```

---

## Runtime Data Location

User data is stored outside the source directory in `~/.dark_gpt/` (or `DARK_GPT_DATA_DIR` if set):
- `~/.dark_gpt/config.json` (defaults & active preferences; auto-recovers corrupted JSON with timestamped backups)
- `~/.dark_gpt/sessions/` (local JSON conversation sessions)
- `~/.dark_gpt/projects/` (sandboxed local project workspaces)
- `~/.dark_gpt/exports/` (`.txt` / `.json` session exports)

Optional third-party provider adapters (`openai_compatible`, `anthropic`) read API keys solely from environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) and never write secrets to disk.

---

## Verification & Smoke Tests

Run the full test suite (includes an isolated local HTTP mock server for `/api/tags` and `/api/chat`):
```bash
python3 -m unittest discover -s tests -v
```

Quick CLI smoke test:
```bash
python3 dark_gpt.py --smoke
```

---

## Lawful Use & Authorized Research Notice

DARK-GPT is designed exclusively for lawful personal productivity, education, software development, and **explicitly authorized** cybersecurity research. Always obtain written authorization before testing systems, networks, or code you do not own.
