"""Grade untrusted learner code without handing it the API process.

Two layers:

1. `_static_check` — many exercise tests are pure *content* assertions
   (`'<h1>' in code`, `code.count('def') >= 2`). Those are evaluated from a
   hard AST allow-list with **no code execution at all**.

2. `_run_isolated` — behavioural tests (`reverse('abc') == 'cba'`) genuinely
   need to run the submission. That happens in a **separate, short-lived
   Python process** with:
     * a stripped environment (no SECRET_KEY / DATABASE_URL / OPENAI_API_KEY …)
     * `-I -S` isolated mode, fresh temp cwd
     * POSIX resource limits: CPU seconds, address space, max file size
     * a wall-clock timeout; the whole process group is killed on expiry
     * `socket` / `subprocess` disabled inside the child

This is a *mitigation*, not a jail. For real isolation run the grader behind
nsjail / gVisor / Firecracker or a per-run container (Judge0, Piston, e2b), and
deploy the API with no outbound network. Set `CODE_EXEC_ENABLED=false` to turn
the behavioural runner off entirely (content tests still work).
"""
from __future__ import annotations

import ast
import asyncio
import json
import os
import subprocess
import sys
import tempfile
from typing import Any, Dict, List, Optional

CODE_EXEC_ENABLED = os.getenv("CODE_EXEC_ENABLED", "true").strip().lower() not in {
    "0",
    "false",
    "no",
    "off",
}
_WALL_SECONDS = float(os.getenv("CODE_EXEC_TIMEOUT", "6"))
_CPU_SECONDS = int(os.getenv("CODE_EXEC_CPU", "4"))
_MEM_BYTES = int(os.getenv("CODE_EXEC_MEM_MB", "256")) * 1024 * 1024
_MAX_CODE = 20_000          # chars of submitted code
_MAX_TESTS = 40
_MAX_EXPR = 2_000           # chars per test expression
_IS_POSIX = os.name == "posix"


# --------------------------------------------------------------------------- #
#  Layer 1 — static content checks (no execution)
# --------------------------------------------------------------------------- #

_SAFE_NODES = (
    ast.Expression, ast.BoolOp, ast.UnaryOp, ast.BinOp, ast.Compare,
    ast.Name, ast.Load, ast.Constant,
    ast.List, ast.Tuple, ast.Set, ast.Dict,
    ast.And, ast.Or, ast.Not, ast.USub, ast.UAdd,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
    ast.In, ast.NotIn, ast.Is, ast.IsNot,
    ast.Add, ast.Sub, ast.Mult, ast.Mod, ast.Div, ast.FloorDiv,
    ast.Subscript, ast.Slice,
    ast.Call, ast.Attribute, ast.keyword,
)
_SAFE_FUNCS = {
    "len", "sorted", "sum", "min", "max", "abs", "any", "all",
    "str", "int", "float", "bool", "set", "list", "tuple", "dict", "round",
}
_SAFE_METHODS = {
    "count", "lower", "upper", "strip", "lstrip", "rstrip", "split",
    "splitlines", "startswith", "endswith", "replace", "find", "index",
    "join", "get", "keys", "values", "items", "isdigit", "isalpha",
}
_SAFE_NAMES = {"code", "__code__", "True", "False", "None"} | _SAFE_FUNCS
import builtins as _builtins  # noqa: E402

_SAFE_BUILTINS = {n: getattr(_builtins, n) for n in _SAFE_FUNCS}


def _static_check(expr: str, code: str) -> Optional[bool]:
    """Return pass/fail for a content-only expression, or None if it needs the
    behavioural sandbox (references a user-defined name, calls an unknown fn,
    touches a dunder, …)."""
    try:
        tree = ast.parse(expr.strip(), mode="eval")
    except SyntaxError:
        return None

    for node in ast.walk(tree):
        if not isinstance(node, _SAFE_NODES):
            return None
        if isinstance(node, ast.Attribute):
            if node.attr.startswith("_") or node.attr not in _SAFE_METHODS:
                return None
        if isinstance(node, ast.Name):
            if node.id.startswith("_") and node.id != "__code__":
                return None
            if node.id not in _SAFE_NAMES:
                return None
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id not in _SAFE_FUNCS:
                return None

    try:
        val = eval(  # noqa: S307 — AST allow-listed above; builtins stripped
            compile(tree, "<content-test>", "eval"),
            {"__builtins__": _SAFE_BUILTINS},
            {"code": code, "__code__": code},
        )
    except Exception:
        return False
    return val is not False


# --------------------------------------------------------------------------- #
#  Layer 2 — behavioural run in an isolated child process
# --------------------------------------------------------------------------- #

_CHILD = r'''
import sys, json
try:
    import socket
    def _no(*a, **k): raise OSError("network disabled in grader")
    socket.socket = _no; socket.create_connection = _no
except Exception: pass
try:
    import subprocess as _sp
    def _nosp(*a, **k): raise OSError("subprocess disabled in grader")
    _sp.Popen = _nosp; _sp.run = _nosp; _sp.call = _nosp
except Exception: pass

job = json.loads(sys.stdin.read())
code, exprs = job["code"], job["exprs"]
g = {"code": code, "__code__": code}
run_err = None
try:
    exec(compile(code, "<submission>", "exec"), g)
except Exception as e:
    run_err = "%s: %s" % (type(e).__name__, e)

results = []
for ex in exprs:
    try:
        try:
            val = eval(ex, g)
            results.append({"ok": val is not False, "err": None})
        except SyntaxError:
            exec(ex, g)
            results.append({"ok": True, "err": None})
    except Exception as e:
        msg = "%s: %s" % (type(e).__name__, e)
        results.append({"ok": False, "err": run_err or msg})
sys.stdout.write(json.dumps({"results": results}))
'''


def _preexec() -> None:  # POSIX only — runs in the child before exec
    import resource

    resource.setrlimit(resource.RLIMIT_CPU, (_CPU_SECONDS, _CPU_SECONDS + 1))
    resource.setrlimit(resource.RLIMIT_AS, (_MEM_BYTES, _MEM_BYTES))
    resource.setrlimit(resource.RLIMIT_FSIZE, (1 << 20, 1 << 20))
    try:
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    except Exception:
        pass


def _child_env() -> Dict[str, str]:
    keep = ("PATH", "LANG", "LC_ALL", "LC_CTYPE", "SYSTEMROOT", "TMP", "TEMP")
    env = {k: os.environ[k] for k in keep if k in os.environ}
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


def _run_isolated(code: str, exprs: List[str]) -> List[Dict[str, Any]]:
    job = json.dumps({"code": code, "exprs": exprs})
    with tempfile.TemporaryDirectory(prefix="grade-") as td:
        proc = subprocess.Popen(
            [sys.executable, "-I", "-S", "-B", "-c", _CHILD],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=td,
            env=_child_env(),
            start_new_session=True,
            preexec_fn=_preexec if _IS_POSIX else None,
        )
        try:
            out, _err = proc.communicate(job, timeout=_WALL_SECONDS)
        except subprocess.TimeoutExpired:
            _kill(proc)
            return [
                {"ok": False, "err": "timed out - check for an infinite loop"}
                for _ in exprs
            ]
    try:
        return json.loads(out)["results"]
    except Exception:
        return [{"ok": False, "err": "grader could not run this submission"} for _ in exprs]


def _kill(proc: subprocess.Popen) -> None:
    try:
        if _IS_POSIX:
            os.killpg(os.getpgid(proc.pid), 9)
        else:
            proc.kill()
    except Exception:
        pass
    try:
        proc.wait(timeout=2)
    except Exception:
        pass


# --------------------------------------------------------------------------- #
#  Public entry point
# --------------------------------------------------------------------------- #

def grade(code: str, test_cases: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Run each test in `test_cases["tests"]` against `code`.

    Returns the shape both routers expect:
        {passed, results: [{passed, description, error}], tests_passed, tests_total}
    """
    code = (code or "")[:_MAX_CODE]
    tests = (test_cases or {}).get("tests", []) if isinstance(test_cases, dict) else []
    tests = list(tests)[:_MAX_TESTS]

    results: List[Dict[str, Any]] = [None] * len(tests)  # type: ignore[list-item]
    pending: List[tuple] = []  # (index, expr)

    for i, tc in enumerate(tests):
        expr = (tc.get("test", "") or "")[:_MAX_EXPR]
        desc = tc.get("description", "")
        if not expr.strip():
            results[i] = {"passed": True, "description": desc, "error": None}
            continue
        verdict = _static_check(expr, code)
        if verdict is not None:
            results[i] = {
                "passed": verdict,
                "description": desc,
                "error": None if verdict else "content check failed",
            }
        else:
            pending.append((i, expr))

    if pending:
        if not CODE_EXEC_ENABLED:
            for idx, _ in pending:
                results[idx] = {
                    "passed": False,
                    "description": tests[idx].get("description", ""),
                    "error": "automated run is disabled on this server",
                }
        else:
            ran = _run_isolated(code, [e for _, e in pending])
            for (idx, _), r in zip(pending, ran):
                results[idx] = {
                    "passed": bool(r.get("ok")),
                    "description": tests[idx].get("description", ""),
                    "error": r.get("err"),
                }

    tests_total = len(results)
    tests_passed = sum(1 for r in results if r and r["passed"])
    return {
        "passed": tests_total > 0 and tests_passed == tests_total,
        "results": results,
        "tests_passed": tests_passed,
        "tests_total": tests_total,
    }


async def grade_async(code: str, test_cases: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """`grade` off the event loop — it blocks on a child process for up to the
    wall-clock timeout, which must not stall the API."""
    return await asyncio.to_thread(grade, code, test_cases)
