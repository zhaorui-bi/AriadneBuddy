#!/usr/bin/env python3
"""Compare full-sequence HMMER bit scores for three supplied KS profiles."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import stat
import sys
import tempfile
from itertools import chain
from pathlib import Path
from typing import Any

VERSION = "1.0.0"
MODEL_ROLES = {"fas_i": "ks-fas-i", "fas_ii": "ks-fas-ii", "pks": "ks-pks"}
REPORT_EVALUE = 10.0
MAX_ROWS = 2_000
MAX_FASTA_BYTES = 32 * 1024 * 1024
MAX_HMM_BYTES = 16 * 1024 * 1024
MAX_EXPORT_BYTES = 8 * 1024 * 1024
MAX_REPORT_BYTES = 2_000_000
EXPORT_COLUMNS = ["ID", "X", "Y", "cluster", "clade"]


def read_regular(path: Path, max_bytes: int) -> bytes:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode):
        raise ValueError(f"Expected a regular file: {path}")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    with os.fdopen(os.open(path, flags), "rb") as handle:
        opened = os.fstat(handle.fileno())
        if not stat.S_ISREG(opened.st_mode) or (before.st_dev, before.st_ino) != (opened.st_dev, opened.st_ino):
            raise ValueError(f"Input changed while opening: {path}")
        if opened.st_size > max_bytes:
            raise ValueError(f"Input exceeds its {max_bytes}-byte limit: {path}")
        data = handle.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ValueError(f"Input exceeds its {max_bytes}-byte limit: {path}")
    return data


def path_value(value: Any, field: str) -> Path:
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > 8_192 or "\0" in value:
        raise ValueError(f"{field} must be a regular input file path")
    relative = value.strip()
    if relative == "~":
        return Path.home()
    if relative.startswith(("~/", "~\\")):
        return Path(os.path.abspath(Path.home() / relative[2:]))
    return Path(os.path.abspath(relative))


def path_list(value: Any, field: str, minimum: int, maximum: int) -> list[Path]:
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        raise ValueError(f"{field} must contain {minimum} to {maximum} file paths")
    paths = [path_value(item, field) for item in value]
    if len(set(paths)) != len(paths):
        raise ValueError(f"{field} must contain distinct file paths")
    return paths


def identifier(value: Any, field: str) -> str:
    if isinstance(value, bytes):
        value = value.decode("utf-8")
    if not isinstance(value, str) or not value or len(value) > 512 or any(not char.isprintable() or char.isspace() for char in value):
        raise ValueError(f"{field} must be a nonempty identifier without spaces")
    return value


def read_profile(plan7: Any, alphabet: Any, data: bytes, role: str) -> Any:
    with plan7.HMMFile(io.BytesIO(data)) as models:
        model = models.read()
        if model is None or models.read() is not None or model.alphabet != alphabet:
            raise ValueError(f"{role} must contain exactly one amino-acid HMM")
    return model


def profile_signature(model: Any) -> str:
    digest = hashlib.sha256()
    for matrix in (model.match_emissions, model.insert_emissions, model.transition_probabilities):
        digest.update(memoryview(matrix).tobytes())
    return digest.hexdigest()


def imported_annotations(data: bytes, role: str, sequence_ids: set[str]) -> dict[str, dict[str, object]]:
    annotations: dict[str, dict[str, object]] = {}
    seen: set[str] = set()
    rows = csv.reader(io.StringIO(data.decode("utf-8-sig"), newline=""), delimiter="\t", quoting=csv.QUOTE_NONE)
    first = next(rows, None)
    if first is None:
        raise ValueError(f"{role} is empty")
    has_coordinates = first == EXPORT_COLUMNS
    records = rows if has_coordinates else chain([first], rows)
    columns = len(EXPORT_COLUMNS) if has_coordinates else 4
    for line, row in enumerate(records, start=2 if has_coordinates else 1):
        if len(row) != columns:
            raise ValueError(f"Invalid annotation row {line} in {role}: expected {columns} tab-separated columns")
        seq_id = identifier(row[0], f"{role} ID at row {line}")
        if seq_id in seen:
            raise ValueError(f"Duplicate ID in {role}: {seq_id}")
        seen.add(seq_id)
        annotation: dict[str, object] = {"source": role}
        if has_coordinates:
            x, y = float(row[1]), float(row[2])
            if not math.isfinite(x) or not math.isfinite(y):
                raise ValueError(f"Invalid coordinates at row {line} in {role}")
            annotation.update(x=x, y=y)
            cluster, clade = int(row[3]), row[4]
        else:
            cluster, clade = int(row[1]), row[2]
            membership = row[3]
            if not membership.endswith("%") or not 0 <= float(membership[:-1]) <= 100:
                raise ValueError(f"Invalid membership percentage at row {line} in {role}")
            annotation["membership"] = membership
        if not 0 <= cluster <= 2**31 - 1:
            raise ValueError(f"Invalid cluster at row {line} in {role}")
        if not clade or len(clade) > 256 or not clade.isprintable():
            raise ValueError(f"Invalid clade label at row {line} in {role}")
        if seq_id in sequence_ids:
            annotation.update(cluster=cluster, clade=clade)
            annotations[seq_id] = annotation
    if not annotations:
        raise ValueError(f"{role} has no ID matching the screened FASTA files")
    return annotations


def classify(scores: dict[str, float | None], minimum: float, maximum: float) -> tuple[str, str]:
    finite_scores = {key: value for key, value in scores.items() if value is not None}
    if len(finite_scores) != len(MODEL_ROLES):
        return "unresolved", "At least one profile has no reportable full-sequence bit score."
    top = max(finite_scores.values())
    winners = [key for key, value in finite_scores.items() if value == top]
    if len(winners) != 1:
        return "unresolved", "Multiple profiles share the highest full-sequence bit score."
    winner = winners[0]
    if winner == "fas_i":
        if minimum <= top <= maximum:
            return "putative_afpk", "FAS I has the highest bit score and falls within the declared FAS I window."
        return "fas_i", "FAS I has the highest bit score outside the declared FAS I window."
    return winner, "This profile has the highest full-sequence bit score."


def published_scores(data: bytes, sequence_ids: set[str]) -> tuple[dict[str, str], dict[str, dict[str, float]]]:
    payload = json.loads(data)
    if not isinstance(payload, dict) or set(payload) != {"doi", "figure", "scores"} or \
            payload["doi"] != "10.1038/s41467-023-44497-0" or payload["figure"] != "Fig. 2A" or not isinstance(payload["scores"], dict):
        raise ValueError("Published KS scores must identify Fig. 2A and supply a scores object by sequence ID")
    matching = {}
    for sequence_id, row in payload["scores"].items():
        identifier(sequence_id, "Published KS score ID")
        if not isinstance(row, dict) or set(row) != set(MODEL_ROLES) or any(
            type(value) not in (int, float) or not math.isfinite(value) for value in row.values()
        ):
            raise ValueError(f"Expected three finite published KS bit scores for {sequence_id}")
        if sequence_id in sequence_ids:
            matching[sequence_id] = row
    if not matching:
        raise ValueError("The published KS scores have no IDs matching the screened FASTA files")
    return {"doi": payload["doi"], "figure": payload["figure"]}, matching


def screen(pyhmmer: Any, request: dict[str, Any], finder_repo: Path | None = None, finder_bin: Path | None = None) -> dict[str, Any]:
    allowed = {
        "workflow", "input_proteins", "ks_models", "fas_i_window", "reference_anchors", "afpk_finder_files", "context",
        "run_afpk_finder", "published_ks_scores_file",
    }
    if not isinstance(request, dict) or request.get("workflow") != "afpk-ks" or set(request) - allowed:
        raise ValueError("Expected an afpk-ks request with supported fields")
    proteins = path_list(request.get("input_proteins"), "input_proteins", 1, 32)
    exports = path_list(request.get("afpk_finder_files", []), "afpk_finder_files", 0, 16)
    if "context" in request and (not isinstance(request["context"], str) or len(request["context"]) > 8_000):
        raise ValueError("context must be text of at most 8000 characters")
    run_finder = request.get("run_afpk_finder", False)
    if not isinstance(run_finder, bool):
        raise ValueError("run_afpk_finder must be true or false")
    if run_finder != (finder_repo is not None) or (finder_bin is not None and finder_repo is None):
        raise ValueError("An original AFPK-finder run requires both run_afpk_finder and a configured v1.0 installation")
    models = request.get("ks_models")
    if not isinstance(models, dict) or set(models) != set(MODEL_ROLES):
        raise ValueError("ks_models must specify fas_i, fas_ii and pks profiles")
    window = request.get("fas_i_window")
    if not isinstance(window, dict) or set(window) != {"min", "max"}:
        raise ValueError("fas_i_window must specify finite min and max bit scores")
    minimum, maximum = window["min"], window["max"]
    if any(type(value) not in (int, float) or not math.isfinite(value) for value in (minimum, maximum)) or minimum > maximum:
        raise ValueError("fas_i_window min and max must be finite and min must be at most max")

    anchors = request.get("reference_anchors", [])
    if not isinstance(anchors, list) or len(anchors) > 16:
        raise ValueError("reference_anchors must contain at most 16 screened FASTA IDs")
    anchor_ids = {identifier(value, "reference_anchors") for value in anchors}
    if len(anchor_ids) != len(anchors):
        raise ValueError("reference_anchors must contain distinct IDs")

    alphabet = pyhmmer.easel.Alphabet.amino()
    fingerprints: dict[str, str] = {}

    def read_input(path: Path, role: str, max_bytes: int) -> bytes:
        contents = read_regular(path, max_bytes)
        fingerprints[role] = hashlib.sha256(contents).hexdigest()
        return contents

    profiles = []
    profile_signatures = set()
    for name, role in MODEL_ROLES.items():
        data = read_input(path_value(models[name], f"ks_models.{name}"), role, MAX_HMM_BYTES)
        profile = read_profile(pyhmmer.plan7, alphabet, data, role)
        signature = profile_signature(profile)
        if signature in profile_signatures:
            raise ValueError("ks_models must contain three distinct HMM profiles")
        profile_signatures.add(signature)
        profiles.append(profile)

    sequences = pyhmmer.easel.DigitalSequenceBlock(alphabet)
    scores: dict[str, dict[str, float | None]] = {}
    finder_sequences: dict[str, str] = {}
    available_bytes = MAX_FASTA_BYTES
    for index, path in enumerate(proteins):
        data = read_input(path, f"protein-input[{index}]", available_bytes)
        available_bytes -= len(data)
        with pyhmmer.easel.SequenceFile(io.BytesIO(data), format="fasta", digital=True, alphabet=alphabet) as fasta:
            for sequence in fasta:
                seq_id = identifier(sequence.name, "FASTA sequence ID")
                if seq_id in scores:
                    raise ValueError(f"Duplicate FASTA sequence ID: {seq_id}")
                if not len(sequence):
                    raise ValueError(f"Empty FASTA sequence: {seq_id}")
                if len(scores) >= MAX_ROWS:
                    raise ValueError(f"An afpk-ks request can screen at most {MAX_ROWS} sequences")
                sequences.append(sequence)
                scores[seq_id] = dict.fromkeys(MODEL_ROLES)
                if run_finder:
                    finder_sequences[seq_id] = sequence.textize().sequence
    if not scores:
        raise ValueError("The input FASTA files contain no protein sequences")
    sequence_ids = set(scores)
    if not anchor_ids.issubset(sequence_ids):
        raise ValueError(f"Reference anchors absent from FASTA: {', '.join(sorted(anchor_ids - sequence_ids)[:10])}")

    annotations: dict[str, list[dict[str, object]]] = {}
    for index, path in enumerate(exports):
        role = f"afpk-finder-output[{index}]"
        data = read_input(path, role, MAX_EXPORT_BYTES)
        for seq_id, annotation in imported_annotations(data, role, sequence_ids).items():
            annotations.setdefault(seq_id, []).append(annotation)

    published_source = None
    published_by_id = {}
    if "published_ks_scores_file" in request:
        path = path_value(request["published_ks_scores_file"], "published_ks_scores_file")
        data = read_input(path, "published-ks-scores", MAX_EXPORT_BYTES)
        published_source, published_by_id = published_scores(data, sequence_ids)

    for key, hits in zip(MODEL_ROLES, pyhmmer.hmmsearch(profiles, sequences, cpus=1, E=REPORT_EVALUE), strict=True):
        for hit in hits:
            if hit.reported and math.isfinite(hit.score):
                scores[identifier(hit.name, "HMMER hit ID")][key] = hit.score

    original_finder = None
    original_by_id = {}
    if finder_repo is not None:
        from afpk_finder_runner import run_original

        original_finder, original_by_id = run_original(finder_repo, finder_bin, finder_sequences)

    rows: list[dict[str, Any]] = []
    candidates: list[str] = []
    for seq_id, values in scores.items():
        classification, reason = classify(values, minimum, maximum)
        role = "anchor" if seq_id in anchor_ids else "candidate"
        row = {"sequence_id": seq_id, "scores": values, "classification": classification, "role": role, "reason": reason}
        if seq_id in annotations:
            row["afpk_finder"] = annotations[seq_id]
        if seq_id in published_by_id:
            row["published_ks_scores"] = published_by_id[seq_id]
        if seq_id in original_by_id:
            row["afpk_finder_run"] = original_by_id[seq_id]
        if role == "candidate" and classification == "putative_afpk":
            candidates.append(seq_id)
        rows.append(row)

    report = {
        "kind": "ariadne.afpk-ks-report",
        "schema_version": 1,
        "method": "three-profile-ks",
        "window": window,
        "inputs": fingerprints,
        "rows": rows,
        "candidates": candidates,
        "summary": {"screened": len(rows), "nominated": len(candidates)},
        "software": {
            "adapter": VERSION,
            "pyhmmer": pyhmmer.__version__,
            "score": "full_sequence_bit_score",
            "report_evalue": REPORT_EVALUE,
        },
    }
    if original_finder is not None:
        report["original_afpk_finder"] = original_finder
    if published_source is not None:
        report["published_ks_source"] = published_source
    return report


def write_report(target: Path, report: dict[str, Any]) -> None:
    rendered = (json.dumps(report, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")
    if len(rendered) > MAX_REPORT_BYTES:
        raise ValueError(f"The report exceeds {MAX_REPORT_BYTES} bytes; screen fewer inputs or include fewer annotations")
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = tempfile.NamedTemporaryFile(mode="wb", dir=target.parent, prefix=f".{target.name}.", delete=False)
    try:
        with temporary:
            temporary.write(rendered)
        os.replace(temporary.name, target)
    finally:
        Path(temporary.name).unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="afpk_ks", description=__doc__)
    parser.add_argument("--version", action="store_true")
    commands = parser.add_subparsers(dest="command")
    command = commands.add_parser("screen")
    command.add_argument("--request-file", required=True, type=Path)
    command.add_argument("--output", required=True, type=Path)
    command.add_argument("--afpk-finder-repo", type=Path)
    command.add_argument("--afpk-finder-bin", type=Path)
    identity = commands.add_parser("finder-identity")
    identity.add_argument("--afpk-finder-repo", required=True, type=Path)
    identity.add_argument("--afpk-finder-bin", type=Path)
    args = parser.parse_args(argv)
    if not args.version and args.command is None:
        parser.error("a command is required")

    if args.command == "finder-identity":
        from afpk_finder_runner import finder_identity

        print(json.dumps(finder_identity(args.afpk_finder_repo, args.afpk_finder_bin)))
        return 0

    try:
        import pyhmmer
    except ImportError as error:
        raise RuntimeError("The selected Python environment must provide pyhmmer") from error
    if args.version:
        print(f"ariadne-afpk-ks {VERSION} (pyhmmer {pyhmmer.__version__})")
        return 0

    request = json.loads(read_regular(args.request_file.expanduser(), 256_000))
    payload = screen(pyhmmer, request, args.afpk_finder_repo, args.afpk_finder_bin)
    write_report(args.output.expanduser(), payload)
    print(json.dumps({"ok": True, "summary": payload["summary"]}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"ok": False, "error": type(error).__name__, "detail": str(error)}), file=sys.stderr)
        raise SystemExit(1)
