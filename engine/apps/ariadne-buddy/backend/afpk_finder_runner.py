"""Run an explicitly configured installation of the original AFPK-finder v1.0."""

from __future__ import annotations

import csv
import hashlib
import io
import math
import os
import re
import shutil
import signal
import subprocess
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

RELEASE = "v1.0"
REQUIRED_FILES = ("run_AFLP_finder.sh", "script.r", "training_data.txt", *(f"hmm/{i}.hmm" for i in range(1, 31)))
# Digest of the files actually consumed from the Zenodo v1.0 release (10.5281/zenodo.10125497).
RELEASE_SHA256 = "5580b381d54e6ce063ee42f1749633d9492fd42d307c27b4e7669de7e1ce439f"
SEED = 4242
R_PACKAGES = ("Rtsne", "dbscan", "ggplot2", "getopt")
TSNE_HEADER = ["ID", "X", "Y", "cluster", "clade", "length"]
SUMMARY_HEADER = b"ID\tcluster\tclade\tpercentage"
MAX_FILE_BYTES = 16 * 1024 * 1024
RUN_TIMEOUT_SECONDS = 1_800


def file_bytes(path: Path) -> bytes:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"Original AFPK-finder requires a regular file: {path}")
    with path.open("rb") as handle:
        data = handle.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise ValueError(f"Original AFPK-finder file exceeds its size limit: {path}")
    return data


def release_files(repo: Path) -> dict[str, bytes]:
    files = {name: file_bytes(repo / name) for name in REQUIRED_FILES}
    manifest = hashlib.sha256()
    for name, data in files.items():
        manifest.update(name.encode("ascii") + b"\0" + hashlib.sha256(data).digest())
    if manifest.hexdigest() != RELEASE_SHA256:
        raise ValueError("Configured AFPK-finder files do not match the original v1.0 release")
    return files


def runtime_environment(bin_dir: Path | None) -> dict[str, str]:
    env = {
        key: os.environ[key]
        for key in ("HOME", "USERPROFILE", "PATH", "R_HOME", "R_LIBS", "R_LIBS_USER", "R_LIBS_SITE", "LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH")
        if key in os.environ
    }
    env["PATH"] = env.get("PATH", os.defpath)
    if bin_dir is not None:
        if not bin_dir.is_dir():
            raise ValueError("The configured AFPK-finder executable directory does not exist")
        env["PATH"] = str(bin_dir.resolve()) + os.pathsep + env["PATH"]
    env["LC_ALL"] = "C"
    return env


def probe(argv: list[str], env: dict[str, str]) -> list[str]:
    result = subprocess.run(argv, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, timeout=30, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Original AFPK-finder dependency check failed for {Path(argv[0]).name}: {result.stdout[-2_000:]}")
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def runtime_identity(env: dict[str, str]) -> tuple[dict[str, Any], str]:
    programs = {name: shutil.which(name, path=env["PATH"]) for name in ("bash", "hmmsearch", "prodigal", "R", "Rscript")}
    missing = [name for name, executable in programs.items() if executable is None]
    if missing:
        raise RuntimeError(f"Original AFPK-finder is missing local executables: {', '.join(missing)}")
    packages = ', '.join(f'"{name}"' for name in R_PACKAGES)
    r_expression = f'cat(R.version.string, "\n"); for (p in c({packages})) cat(as.character(packageVersion(p)), "\n")'
    r_versions = probe([programs["Rscript"], "--vanilla", "-e", r_expression], env)
    hmmer = next((line for line in probe([programs["hmmsearch"], "-h"], env) if line.startswith("# HMMER ")), None)
    if len(r_versions) != 1 + len(R_PACKAGES) or hmmer is None:
        raise RuntimeError("Could not confirm the original AFPK-finder dependency versions")
    environment = {
        "bash": probe([programs["bash"], "--version"], env)[0],
        "hmmer": hmmer.lstrip("# "),
        "prodigal": probe([programs["prodigal"], "-v"], env)[0],
        "r": r_versions[0],
        "r_packages": dict(zip(R_PACKAGES, r_versions[1:], strict=True)),
    }
    return {
        "release": RELEASE,
        "installation_sha256": RELEASE_SHA256,
        "runner_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "seed": SEED,
        "environment": environment,
    }, programs["bash"]


def finder_identity(repo: Path, bin_dir: Path | None) -> dict[str, Any]:
    release_files(repo)
    return runtime_identity(runtime_environment(bin_dir))[0]


def run_original(repo: Path, bin_dir: Path | None, sequences: dict[str, str]) -> tuple[dict[str, Any], dict[str, list[dict[str, Any]]]]:
    files = release_files(repo)
    env = runtime_environment(bin_dir)
    identity, bash = runtime_identity(env)
    aliases = {f"ariadne_{index:06d}": (name, len(sequence)) for index, (name, sequence) in enumerate(sequences.items(), start=1)}
    prepared = ''.join(f">{alias}\n{sequences[name]}\n" for alias, (name, _) in aliases.items()).encode("ascii")

    with tempfile.TemporaryDirectory(prefix="ariadne-afpk-finder-") as temp:
        scratch = Path(temp)
        upstream = scratch / "upstream"
        (upstream / "hmm").mkdir(parents=True)
        for name, data in files.items():
            (upstream / name).write_bytes(data)
        (upstream / "script.r").chmod(0o700)
        (scratch / "input.fa").write_bytes(prepared)
        profile = scratch / "seed.R"
        profile.write_text(f"set.seed({SEED})\n", encoding="ascii")
        env["R_PROFILE_USER"] = str(profile)
        run_pipeline(bash, scratch, env)
        runs, matched = parse_runs(scratch / "output", aliases)

    return {
        **identity,
        "prepared_input_sha256": hashlib.sha256(prepared).hexdigest(),
        "runs": runs,
    }, matched


def run_pipeline(bash: str, scratch: Path, env: dict[str, str]) -> None:
    with (scratch / "run.log").open("w+b") as log:
        argv = [bash, "-e", "-o", "pipefail", "upstream/run_AFLP_finder.sh", "-p", "input.fa", "-o", "output", "-t", "1"]
        with subprocess.Popen(argv,
                              env=env, cwd=scratch, stdin=subprocess.DEVNULL, stdout=log,
                              stderr=subprocess.STDOUT, start_new_session=True) as runner:
            def terminate(_signal: int, _frame: Any) -> None:
                stop_group(runner.pid)
                raise SystemExit(128 + _signal)

            handlers = {sig: signal.signal(sig, terminate) for sig in (signal.SIGTERM, signal.SIGINT)}
            try:
                code = runner.wait(timeout=RUN_TIMEOUT_SECONDS)
            except subprocess.TimeoutExpired as error:
                stop_group(runner.pid)
                raise RuntimeError("Original AFPK-finder exceeded its 30-minute runtime limit") from error
            finally:
                for sig, handler in handlers.items():
                    signal.signal(sig, handler)
        if code != 0:
            log.seek(max(0, log.seek(0, os.SEEK_END) - 4_000))
            detail = log.read(4_000).decode("utf-8", errors="replace")
            raise RuntimeError(f"Original AFPK-finder failed (exit {code}): {detail}")


def stop_group(pid: int) -> None:
    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def parse_runs(output: Path, aliases: dict[str, tuple[str, int]]) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    tables = [(int(match[1]), table) for table in output.glob("tsne-db*.csv")
              if (match := re.fullmatch(r"tsne-db([1-9][0-9]*)\.csv", table.name))]
    if len(tables) != 2:
        raise RuntimeError("Original AFPK-finder did not produce both expected t-SNE outputs")

    runs = []
    matches: dict[str, list[dict[str, Any]]] = {name: [] for name, _ in aliases.values()}
    for perplexity, path in sorted(tables):
        data = file_bytes(path)
        summary = file_bytes(path.with_suffix(".id"))
        if summary.splitlines()[:1] != [SUMMARY_HEADER]:
            raise ValueError("Original AFPK-finder membership output has an unknown header")
        assignments, memberships = parse_table(data, aliases)
        counts: Counter[str] = Counter()
        for alias, (name, _) in aliases.items():
            observation = assignments.get(alias)
            entry: dict[str, Any] = {"perplexity": perplexity, "status": "missing"}
            if observation is not None:
                entry.update(observation)
                entry["memberships"] = memberships.get(observation["cluster"], [])
            matches[name].append(entry)
            counts[entry["status"]] += 1
        runs.append({
            "perplexity": perplexity,
            "table_sha256": hashlib.sha256(data).hexdigest(),
            "summary_sha256": hashlib.sha256(summary).hexdigest(),
            "matched": len(assignments),
            "clustered": counts["clustered"],
            "noise": counts["noise"],
            "missing": counts["missing"],
        })
    return runs, matches


def parse_table(data: bytes, aliases: dict[str, tuple[str, int]]) -> tuple[dict[str, dict[str, Any]], dict[int, list[dict[str, Any]]]]:
    rows = csv.reader(io.StringIO(data.decode("utf-8"), newline=""), delimiter="\t", quoting=csv.QUOTE_NONE)
    if next(rows, None) != TSNE_HEADER:
        raise ValueError("Original AFPK-finder t-SNE output has an unknown header")
    assignments: dict[str, dict[str, Any]] = {}
    seen = set()
    totals: Counter[str] = Counter()
    clusters: defaultdict[int, Counter[str]] = defaultdict(Counter)
    for row in rows:
        seq_id, raw_x, raw_y, raw_cluster, clade, raw_length = row
        if seq_id in seen:
            raise ValueError("Original AFPK-finder output contains duplicate IDs")
        seen.add(seq_id)
        cluster = int(raw_cluster)
        if cluster < 0:
            raise ValueError("Original AFPK-finder reported an invalid cluster number")
        if clade == "INPUT_KS":
            x, y, length = float(raw_x), float(raw_y), int(raw_length)
            if seq_id not in aliases or length != aliases[seq_id][1] or not math.isfinite(x) or not math.isfinite(y):
                raise ValueError("Original AFPK-finder result does not identify a prepared input sequence")
            assignments[seq_id] = {
                "status": "noise" if cluster == 0 else "clustered",
                "cluster": cluster, "x": x, "y": y, "clade": clade, "length": length,
            }
        else:
            totals[clade] += 1
            clusters[cluster][clade] += 1
    memberships = {
        cluster: [{"clade": clade, "in_cluster": n, "training_total": totals[clade], "percentage": 100 * n / totals[clade]}
                  for clade, n in sorted(counts.items())]
        for cluster, counts in clusters.items()
    }
    return assignments, memberships
