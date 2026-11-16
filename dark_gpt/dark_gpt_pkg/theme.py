from __future__ import annotations

import os
import sys

# Strictly BLACK, WHITE, and RED palette only (no purple, cyan, green, or blue).
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[91m"
DARK_RED = "\033[31m"
WHITE = "\033[97m"


def enable_windows_vt_mode() -> None:
    if sys.platform != "win32":
        return
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32
        handle = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
        mode = ctypes.c_ulong()
        if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            kernel32.SetConsoleMode(handle, mode.value | 0x0004)
    except Exception:
        pass


def colors_enabled() -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    term = os.environ.get("TERM", "")
    if term.lower() == "dumb":
        return False
    return hasattr(sys.stdout, "isatty") and (sys.stdout.isatty() or os.environ.get("DARK_GPT_FORCE_COLOR") == "1")


def style(text: str, ansi: str, *, force_color: bool | None = None) -> str:
    use_color = colors_enabled() if force_color is None else force_color
    if not use_color:
        return text
    return f"{ansi}{text}{RESET}"


def red(text: str, *, bold: bool = False, force_color: bool | None = None) -> str:
    code = f"{BOLD}{RED}" if bold else RED
    return style(text, code, force_color=force_color)


def white(text: str, *, bold: bool = False, force_color: bool | None = None) -> str:
    code = f"{BOLD}{WHITE}" if bold else WHITE
    return style(text, code, force_color=force_color)


def clear_screen() -> None:
    if os.environ.get("DARK_GPT_NO_CLEAR") == "1":
        return
    if hasattr(sys.stdout, "isatty") and sys.stdout.isatty():
        sys.stdout.write("\033[2J\033[H")
        sys.stdout.flush()


def box_lines(title: str, lines: list[str], width: int = 66, *, force_color: bool | None = None) -> str:
    inner = max(width, max((len(l) for l in lines), default=0) + 4, len(title) + 6)
    top = f"+-{title}-" + ("-" * max(1, inner - len(title) - 3)) + "+"
    bottom = "+" + ("-" * (inner - 1)) + "+"
    out = [red(top, bold=True, force_color=force_color)]
    for line in lines:
        pad = " " * max(0, inner - 3 - len(line))
        out.append(
            red("| ", force_color=force_color)
            + white(line, force_color=force_color)
            + pad
            + red(" |", force_color=force_color)
        )
    out.append(red(bottom, bold=True, force_color=force_color))
    return "\n".join(out)
