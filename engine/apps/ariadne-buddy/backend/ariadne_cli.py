#!/usr/bin/env python3
"""AriadneBuddy adapter CLI — a stable, versioned bridge over the ariadne-tps engines.

The ``ariadne`` package (ariadne-tps) ships deterministic scientific engines:
HMM retrieval (``ariadne.search``), ESM2 semantic scoring (``ariadne.model``),
feature-space structure retrieval (``ariadne.embed``), candidate filtering
(``ariadne.filter``), and reference preparation (``ariadne.data``). This adapter
exposes them behind one JSON-on-stdout CLI contract so the TypeScript harness can
drive every scientific operation as a bounded subprocess.

Output discipline: stdout carries exactly one JSON document per invocation.
Progress goes to stderr. Failures print ``{"ok": false, ...}`` to stderr and
exit non-zero.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Optional, Sequence

ADAPTER_VERSION = "0.1.0-beta.1"
ADAPTER_NAME = "ariadnebuddy-adapter"

DEFAULT_MIN_SCORE = 0.0
DEFAULT_MAX_EVALUE = 1e-3
DEFAULT_MIN_COVERAGE = 10.0
DEFAULT_MIN_LENGTH = 300
DEFAULT_IDENTITY_THRESHOLD = 0.95
DEFAULT_CEESS_THRESHOLD = 0.9
DEFAULT_TOP_K = 5
DEFAULT_ESM_MODEL = "facebook/esm2_t33_650M_UR50D"


# ---------------------------------------------------------------------------
# Output helpers


def log(message: str) -> None:
    sys.stderr.write(f"[{ADAPTER_NAME}] {message}\n")
    sys.stderr.flush()


def emit(value: Any) -> None:
    sys.stdout.write(json.dumps(value, indent=2, default=_json_default, allow_nan=False))
    sys.stdout.write("\n")


def _json_default(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    raise TypeError(f"not JSON serializable: {type(value)!r}")


def write_json_file(path: PathLike, value: Any) -> Path:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=str(target.parent), prefix=f".{target.name}.", delete=False
    )
    try:
        with handle:
            json.dump(value, handle, indent=2, default=_json_default, allow_nan=False)
            handle.write("\n")
        os.replace(handle.name, target)
    except BaseException:
        try:
            os.unlink(handle.name)
        except OSError:
            pass
        raise
    return target


PathLike = Any


def read_json_file(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def read_tsv_rows(path: Path) -> list[dict[str, str]]:
    if not Path(path).is_file():
        return []
    with open(path, "r", encoding="utf-8", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle, delimiter="\t")]


def count_fasta_sequences(path: Path) -> int:
    if not Path(path).is_file():
        return 0
    count = 0
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            if line.startswith(">"):
                count += 1
    return count


def parse_fasta_ids(path: Path) -> list[str]:
    ids: list[str] = []
    if not Path(path).is_file():
        return ids
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            if line.startswith(">"):
                ids.append(line[1:].split()[0] if line[1:].split() else "")
    return ids


# ---------------------------------------------------------------------------
# Repository resolution and engine bootstrap


def resolve_repo(value: str) -> Path:
    repo = Path(value).expanduser().resolve()
    if not (repo / "ariadne" / "__init__.py").is_file():
        raise SystemExit(f"not an ariadne-tps checkout: {repo} (expected ariadne/__init__.py)")
    return repo


def bootstrap(repo: Path) -> dict[str, Any]:
    sys.path.insert(0, str(repo))
    import ariadne  # noqa: F401  (importable package is the readiness contract)

    return {"ariadne_version": getattr(ariadne, "__version__", "unknown")}


def _try_import(name: str) -> Optional[Any]:
    try:
        return __import__(name)
    except Exception:
        return None


def dependency_versions() -> dict[str, Optional[str]]:
    versions: dict[str, Optional[str]] = {}
    for module in ("numpy", "pyhmmer", "pyrodigal", "sklearn", "openpyxl"):
        installed = _try_import(module)
        versions[module] = getattr(installed, "__version__", None) if installed else None
    return versions


def esm_stack() -> dict[str, Any]:
    torch = _try_import("torch")
    transformers = _try_import("transformers")
    available = torch is not None and transformers is not None
    return {
        "available": bool(available),
        "torch": getattr(torch, "__version__", None) if torch else None,
        "transformers": getattr(transformers, "__version__", None) if transformers else None,
        "model": os.environ.get("ARIADNE_ESM_MODEL", DEFAULT_ESM_MODEL),
    }


def repo_reference_dir(repo: Path) -> Path:
    return repo / "input" / "references"


def repo_query_hmm(repo: Path) -> Path:
    return repo / "input" / "query.hmm"


def repo_workbook(repo: Path) -> Path:
    return repo / "TPS.xlsx"


def data_readiness(repo: Path) -> dict[str, Any]:
    references = repo_reference_dir(repo)
    alignments = sorted(references.glob("*.afa")) if references.is_dir() else []
    query_hmm = repo_query_hmm(repo)
    workbook = repo_workbook(repo)
    return {
        "query_hmm_available": query_hmm.is_file(),
        "reference_alignments_available": len(alignments) > 0,
        "reference_clades": [item.stem for item in alignments],
        "tps_workbook_available": workbook.is_file(),
    }


# ---------------------------------------------------------------------------
# Shared engine helpers


def _engine_modules() -> dict[str, Any]:
    return {
        "search": __import__("ariadne.search", fromlist=["search"]),
        "filter": __import__("ariadne.filter", fromlist=["filter"]),
        "embed": __import__("ariadne.embed", fromlist=["embed"]),
        "model": __import__("ariadne.model", fromlist=["model"]),
        "data": __import__("ariadne.data", fromlist=["data"]),
        "utils": __import__("ariadne.utils", fromlist=["utils"]),
    }


def _thresholds(request: dict[str, Any]) -> dict[str, Any]:
    declared = request.get("thresholds") if isinstance(request.get("thresholds"), dict) else {}
    return {
        "min_score": _finite(declared.get("min_score"), DEFAULT_MIN_SCORE),
        "max_evalue": _finite(declared.get("max_evalue"), DEFAULT_MAX_EVALUE),
        "min_coverage": _finite(declared.get("min_coverage"), DEFAULT_MIN_COVERAGE),
        "min_length": int(_finite(declared.get("min_length"), DEFAULT_MIN_LENGTH)),
        "ceess_threshold": _finite(declared.get("ceess_threshold"), DEFAULT_CEESS_THRESHOLD),
        "top_k": int(_finite(declared.get("top_k"), DEFAULT_TOP_K)),
    }


def _finite(value: Any, fallback: float) -> float:
    if isinstance(value, (int, float)) and value == value and value not in (float("inf"), float("-inf")):
        return float(value)
    return float(fallback)


def _request_thresholds_only(request: dict[str, Any], keys: Sequence[str]) -> dict[str, Any]:
    thresholds = _thresholds(request)
    return {key: thresholds[key] for key in keys}


def _ensure_hmm_library(reference_dir: Path, hmm_dir: Path, engines: dict[str, Any]) -> Path:
    hmm_dir.mkdir(parents=True, exist_ok=True)
    existing = sorted(p for p in hmm_dir.glob("*.hmm"))
    if existing:
        return hmm_dir
    alignments = sorted(Path(reference_dir).glob("*.afa"))
    if not alignments:
        raise SystemExit(f"reference directory has no .afa alignments: {reference_dir}")
    for alignment in alignments:
        engines["search"].build_hmm(alignment, hmm_dir / f"{alignment.stem}.hmm", name=alignment.stem)
        log(f"built profile HMM for clade {alignment.stem}")
    return hmm_dir


def _float_or_none(value: Any) -> Optional[float]:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed != parsed or parsed in (float("inf"), float("-inf")):
        return None
    return parsed


def _merged_candidate_rows(
    hits_rows: Sequence[dict[str, str]],
    classification_rows: Sequence[dict[str, str]],
) -> list[dict[str, Any]]:
    classification_by_id = {str(row.get("sequence_id", "")): row for row in classification_rows}
    merged: list[dict[str, Any]] = []
    for hit in hits_rows:
        sequence_id = str(hit.get("sequence_id", ""))
        classification = classification_by_id.get(sequence_id, {})
        merged.append(
            {
                "sequence_id": sequence_id,
                "hmm_score": _float_or_none(hit.get("score")),
                "hmm_evalue": _float_or_none(hit.get("evalue")),
                "length": int(_float_or_none(classification.get("length")) or 0)
                or None,
                "predicted_source": classification.get("predicted_source", ""),
                "confidence": _float_or_none(classification.get("confidence")),
                "is_coral_like": classification.get("is_coral_like", ""),
                "nearest_reference": classification.get("nearest_reference", ""),
                "nearest_distance": _float_or_none(classification.get("nearest_distance")),
                "esm_type_prediction": classification.get("esm_type_prediction", "") or "",
                "esm_ceess_probability": _float_or_none(classification.get("esm_ceess_probability")),
            }
        )
    return merged


def _nominate(
    engines: dict[str, Any],
    *,
    candidates_fasta: Path,
    request: dict[str, Any],
    stage_dir: Path,
    esm_used: bool,
    top_k: int,
) -> dict[str, Any]:
    thresholds = _thresholds(request)
    reference_dir = Path(str(request["reference_dir"])).expanduser()
    workbook = request.get("tps_workbook")
    query_hmm = Path(str(request["query_hmm"])).expanduser()

    hmm_dir = _ensure_hmm_library(reference_dir, stage_dir / "hmm-library", engines)
    classification_dir = stage_dir / "classification"
    classification_dir.mkdir(parents=True, exist_ok=True)

    ceess_xlsx = None
    if esm_used:
        workbook_path = Path(str(workbook)).expanduser() if workbook else None
        if workbook_path is None or not workbook_path.is_file():
            raise SystemExit("semantic scoring requested but tps_workbook is missing")
        ceess_xlsx = workbook_path

    outputs = engines["embed"].classify_candidates(
        candidates_fasta,
        reference_dir,
        classification_dir,
        hmm_dir=hmm_dir,
        top_k=top_k,
        ceess_xlsx=ceess_xlsx,
        ceess_threshold=thresholds["ceess_threshold"],
        ceess_model_name=esm_stack()["model"],
        ceess_device=os.environ.get("ARIADNE_ESM_DEVICE") or None,
    )

    hits = engines["search"].search_proteins_with_hmm(
        candidates_fasta,
        query_hmm,
        min_score=thresholds["min_score"],
        max_evalue=thresholds["max_evalue"],
    )
    hits_rows = [
        {
            "sequence_id": str(row.get("sequence_id", "")),
            "score": row.get("score"),
            "evalue": row.get("evalue"),
        }
        for row in hits
    ]
    classification_rows = read_tsv_rows(Path(outputs["classification"]))
    merged = _merged_candidate_rows(hits_rows, classification_rows)

    nominated: list[dict[str, Any]] = []
    for row in merged:
        probability = row["esm_ceess_probability"]
        if esm_used:
            is_nominated = probability is not None and probability >= thresholds["ceess_threshold"]
        else:
            is_nominated = row["is_coral_like"] == "yes"
        if is_nominated:
            nominated.append({**row, "is_nominated": True})

    artifacts = {key: str(value) for key, value in outputs.items()}
    artifacts["query_hmm_hits"] = str(classification_dir / "query-hmm-hits.json")
    write_json_file(
        classification_dir / "query-hmm-hits.json",
        {"hits": hits_rows, "thresholds": {k: thresholds[k] for k in ("min_score", "max_evalue")}},
    )

    report = {
        "ok": True,
        "kind": "ariadne.nomination-report",
        "schema_version": 1,
        "esm_used": bool(esm_used),
        # Record the explicit waiver so the deterministic audit does not
        # re-warn about absent semantic evidence the caller already waived.
        "esm_waived": bool(not esm_used),
        "target_class": str(request.get("target_class", "")),
        "thresholds": {
            "min_score": thresholds["min_score"],
            "max_evalue": thresholds["max_evalue"],
            "min_length": thresholds["min_length"],
            "ceess_threshold": thresholds["ceess_threshold"],
            "top_k": top_k,
        },
        "candidates": nominated,
        "summary": {
            "evaluated": len(merged),
            "nominated": len(nominated),
            "coral_like": sum(1 for row in merged if row["is_coral_like"] == "yes"),
            "esm_used": bool(esm_used),
        },
        "artifacts": artifacts,
    }
    # Nomination shortlist rows carry merged engine evidence for the audit.
    return report


# ---------------------------------------------------------------------------
# Commands


def command_version(_args: argparse.Namespace) -> None:
    sys.stdout.write(f"{ADAPTER_NAME} {ADAPTER_VERSION}\n")


def command_health(args: argparse.Namespace) -> None:
    repo = resolve_repo(args.repo)
    try:
        info = bootstrap(repo)
    except Exception as error:  # noqa: BLE001 - reported as health failure
        emit(
            {
                "ok": False,
                "adapter_version": ADAPTER_VERSION,
                "error": "ariadne_import_failed",
                "detail": str(error),
            }
        )
        return
    dependencies = dependency_versions()
    missing = sorted(name for name, version in dependencies.items() if version is None)
    data = data_readiness(repo)
    esm = esm_stack()
    ready = not missing and data["query_hmm_available"] and data["reference_alignments_available"]
    payload = {
        "ok": ready,
        "adapter_version": ADAPTER_VERSION,
        "ariadne_version": info["ariadne_version"],
        "python": sys.version.split()[0],
        "dependencies": dependencies,
        "esm": esm,
        "data": data,
        "ready_for_pipeline": ready,
    }
    if args.json:
        emit(payload)
    else:
        log(json.dumps(payload, default=_json_default))


def command_identity(args: argparse.Namespace) -> None:
    repo = resolve_repo(args.repo)
    info = bootstrap(repo)
    dependencies = dependency_versions()
    esm = esm_stack()
    emit(
        {
            "adapter_version": ADAPTER_VERSION,
            "backend_revision": info["ariadne_version"],
            "python": sys.version.split()[0],
            "engines": {
                "hmm": {
                    "available": dependencies.get("pyhmmer") is not None,
                    "pyhmmer": dependencies.get("pyhmmer"),
                },
                "semantic": {
                    "available": esm["available"],
                    "model": esm["model"],
                    "torch": esm["torch"],
                    "transformers": esm["transformers"],
                },
                "feature_space": {
                    "available": dependencies.get("sklearn") is not None,
                    "scikit_learn": dependencies.get("sklearn"),
                },
            },
            "defaults": {
                "min_score": DEFAULT_MIN_SCORE,
                "max_evalue": DEFAULT_MAX_EVALUE,
                "min_coverage": DEFAULT_MIN_COVERAGE,
                "min_length": DEFAULT_MIN_LENGTH,
                "identity_threshold": DEFAULT_IDENTITY_THRESHOLD,
                "ceess_threshold": os.environ.get("ARIADNE_CEESS_THRESHOLD", DEFAULT_CEESS_THRESHOLD)
                if _float_or_none(os.environ.get("ARIADNE_CEESS_THRESHOLD")) is not None
                else DEFAULT_CEESS_THRESHOLD,
                "top_k": os.environ.get("ARIADNE_TOP_K", DEFAULT_TOP_K),
                "esm_model": esm["model"],
            },
            "repo": str(repo),
        }
    )


def command_catalog(args: argparse.Namespace) -> None:
    repo = resolve_repo(args.repo)
    bootstrap(repo)
    references = repo_reference_dir(repo)
    clades: list[dict[str, Any]] = []
    for alignment in sorted(references.glob("*.afa")) if references.is_dir() else []:
        count = count_fasta_sequences(alignment)
        clades.append({"clade": alignment.stem, "sequences": count, "path": str(alignment)})
    tps_types: list[dict[str, Any]] = []
    workbook = repo_workbook(repo)
    if workbook.is_file():
        try:
            engines = _engine_modules()
            records = engines["model"].load_tps_xlsx(workbook)
            counts: dict[str, int] = {}
            for record in records:
                label = str(getattr(record, "label", "") or "unlabeled")
                counts[label] = counts.get(label, 0) + 1
            tps_types = [
                {"type": label, "count": count} for label, count in sorted(counts.items())
            ]
        except Exception as error:  # noqa: BLE001 - catalog degrades gracefully
            log(f"workbook unreadable: {error}")
    search = (args.search or "").lower()
    if search:
        clades = [entry for entry in clades if search in entry["clade"].lower()]
        tps_types = [entry for entry in tps_types if search in entry["type"].lower()]
    kind = args.kind or "all"
    if kind == "clades":
        tps_types = []
    elif kind == "tps-types":
        clades = []
    limit = args.limit or 1000
    emit(
        {
            "ok": True,
            "clades": clades[:limit],
            "tps_types": tps_types[:limit],
            "workbook_available": workbook.is_file(),
        }
    )


def command_build_hmm(args: argparse.Namespace) -> None:
    repo = resolve_repo(args.repo)
    bootstrap(repo)
    engines = _engine_modules()
    output = Path(args.output).expanduser()
    built = engines["search"].build_hmm(
        Path(args.alignment).expanduser(), output, name=args.name
    )
    emit(
        {
            "ok": True,
            "hmm": str(built),
            "sequences": count_fasta_sequences(Path(args.alignment).expanduser()),
        }
    )


def _discover(engines: dict[str, Any], args: argparse.Namespace) -> dict[str, Any]:
    request: dict[str, Any] = {}
    if args.request_file:
        request = read_json_file(Path(args.request_file).expanduser())
        proteins = [str(item) for item in request.get("input_proteins", [])]
        hmm = str(request["query_hmm"])
        thresholds = _request_thresholds_only(request, ("min_score", "max_evalue"))
    else:
        proteins = [item for item in str(args.proteins).split(",") if item.strip()]
        hmm = str(args.hmm)
        thresholds = {
            "min_score": _finite(args.min_score, DEFAULT_MIN_SCORE),
            "max_evalue": _finite(args.max_evalue, DEFAULT_MAX_EVALUE),
        }
    if not proteins:
        raise SystemExit("discovery requires input proteins")
    stage_dir = Path(args.stage_dir).expanduser()
    stage_dir.mkdir(parents=True, exist_ok=True)
    outputs = engines["search"].discover_candidates_from_proteins(
        [Path(item).expanduser() for item in proteins],
        Path(hmm).expanduser(),
        stage_dir,
        min_score=thresholds["min_score"] if thresholds["min_score"] != DEFAULT_MIN_SCORE else None,
        max_evalue=thresholds["max_evalue"] if thresholds["max_evalue"] != DEFAULT_MAX_EVALUE else None,
    )
    hits_rows = read_tsv_rows(Path(outputs["hits_tsv"]))
    artifacts = {key: str(value) for key, value in outputs.items()}
    # Canonical aliases consumed by the research controller (the engine names
    # them candidate_proteins / hits_tsv; stubs and docs speak proteins/hits).
    artifacts["proteins"] = str(outputs["candidate_proteins"])
    artifacts["hits"] = str(outputs["hits_tsv"])
    return {
        "ok": True,
        "stage": "discovery",
        "artifacts": artifacts,
        "summary": {
            "candidate_count": count_fasta_sequences(Path(outputs["candidate_proteins"])),
            "hit_rows": len(hits_rows),
            "inputs": proteins,
            "hmm": hmm,
            "thresholds": thresholds,
        },
    }


def _filter(engines: dict[str, Any], args: argparse.Namespace) -> dict[str, Any]:
    request: dict[str, Any] = {}
    if args.request_file:
        request = read_json_file(Path(args.request_file).expanduser())
        thresholds = _request_thresholds_only(request, ("min_coverage", "min_length"))
    else:
        thresholds = {
            "min_coverage": _finite(args.min_coverage, DEFAULT_MIN_COVERAGE),
            "min_length": _finite(args.min_length, DEFAULT_MIN_LENGTH),
        }
    candidates = Path(args.candidates).expanduser()
    stage_dir = Path(args.stage_dir).expanduser()
    stage_dir.mkdir(parents=True, exist_ok=True)
    outputs = engines["filter"].filter_candidates(
        candidates,
        stage_dir,
        min_coverage=thresholds["min_coverage"],
        min_length=int(thresholds["min_length"]),
        identity_threshold=DEFAULT_IDENTITY_THRESHOLD,
    )
    report_rows = read_tsv_rows(Path(outputs["filter_report"]))
    return {
        "ok": True,
        "stage": "filtering",
        "artifacts": {key: str(value) for key, value in outputs.items()},
        "summary": {
            "input_count": count_fasta_sequences(candidates),
            "kept": count_fasta_sequences(Path(outputs["filtered_fasta"])),
            "removed": len(report_rows),
            "thresholds": thresholds,
        },
    }


def command_score(args: argparse.Namespace) -> None:
    repo = resolve_repo(args.repo)
    bootstrap(repo)
    engines = _engine_modules()
    esm = esm_stack()
    if not esm["available"]:
        raise SystemExit("semantic scoring requires torch and transformers (pip install ariadne-tps[esm])")
    from ariadne.utils import read_fasta  # type: ignore[attr-defined]

    candidates = Path(args.candidates).expanduser()
    workbook = Path(args.workbook).expanduser()
    stage_dir = Path(args.stage_dir).expanduser()
    stage_dir.mkdir(parents=True, exist_ok=True)
    threshold = _finite(args.ceess_threshold, DEFAULT_CEESS_THRESHOLD)
    result = engines["model"].classify_ceess_candidates_with_esm(
        read_fasta(candidates),
        workbook,
        stage_dir,
        model_name=args.model or esm["model"],
        ceess_threshold=threshold,
        device=args.device,
    )
    rows = result.prediction_rows
    nominated = [
        row for row in rows if _float_or_none(row.get("esm_ceess_probability")) is not None
        and float(row["esm_ceess_probability"]) >= threshold
    ]
    write_json_file(
        Path(args.output).expanduser(),
        {
            "ok": True,
            "stage": "scoring",
            "esm_used": True,
            "model": args.model or esm["model"],
            "ceess_threshold": threshold,
            "artifacts": {key: str(value) for key, value in result.output_paths.items()},
            "summary": {
                "evaluated": len(rows),
                "nominated": len(nominated),
                "nominated_ids": [str(row.get("sequence_id", row.get("name", ""))) for row in nominated],
            },
        },
    )
    emit(
        {
            "ok": True,
            "stage": "scoring",
            "output": str(Path(args.output).expanduser()),
            "summary": {"evaluated": len(rows), "nominated": len(nominated)},
        }
    )


def command_classify(args: argparse.Namespace) -> None:
    repo = resolve_repo(args.repo)
    bootstrap(repo)
    engines = _engine_modules()
    candidates = Path(args.candidates).expanduser()
    reference_dir = Path(args.reference_dir).expanduser()
    stage_dir = Path(args.stage_dir).expanduser()
    stage_dir.mkdir(parents=True, exist_ok=True)
    hmm_dir = (
        Path(args.hmm_dir).expanduser()
        if args.hmm_dir
        else _ensure_hmm_library(reference_dir, stage_dir / "hmm-library", engines)
    )
    outputs = engines["embed"].classify_candidates(
        candidates,
        reference_dir,
        stage_dir,
        hmm_dir=hmm_dir,
        top_k=int(_finite(args.top_k, DEFAULT_TOP_K)),
    )
    rows = read_tsv_rows(Path(outputs["classification"]))
    write_json_file(
        Path(args.output).expanduser(),
        {
            "ok": True,
            "stage": "classification",
            "artifacts": {key: str(value) for key, value in outputs.items()},
            "summary": {
                "candidates": len(rows),
                "coral_like": sum(1 for row in rows if row.get("is_coral_like") == "yes"),
                "top_k": int(_finite(args.top_k, DEFAULT_TOP_K)),
            },
        },
    )
    emit(
        {
            "ok": True,
            "stage": "classification",
            "output": str(Path(args.output).expanduser()),
            "summary": {"candidates": len(rows)},
        }
    )


def command_nominate(args: argparse.Namespace) -> None:
    repo = resolve_repo(args.repo)
    bootstrap(repo)
    engines = _engine_modules()
    request = read_json_file(Path(args.request_file).expanduser())
    esm = esm_stack()
    esm_used = (not args.no_esm) and esm["available"]
    if not args.no_esm and not esm["available"]:
        raise SystemExit(
            "semantic scoring unavailable (torch/transformers missing); pass --no-esm or install ariadne-tps[esm]"
        )
    stage_dir = Path(args.stage_dir).expanduser()
    stage_dir.mkdir(parents=True, exist_ok=True)
    top_k = int(_finite(args.top_k, _thresholds(request)["top_k"]))
    report = _nominate(
        engines,
        candidates_fasta=Path(args.candidates).expanduser(),
        request=request,
        stage_dir=stage_dir,
        esm_used=esm_used,
        top_k=top_k,
    )
    write_json_file(Path(args.output).expanduser(), report)
    emit(
        {
            "ok": True,
            "stage": "nomination",
            "output": str(Path(args.output).expanduser()),
            "summary": report["summary"],
        }
    )


def command_pipeline(args: argparse.Namespace) -> None:
    repo = resolve_repo(args.repo)
    bootstrap(repo)
    engines = _engine_modules()
    request = read_json_file(Path(args.request_file).expanduser())
    thresholds = _thresholds(request)
    stage_dir = Path(args.stage_dir).expanduser()
    stage_dir.mkdir(parents=True, exist_ok=True)

    discovery = _discover(engines, argparse.Namespace(
        request_file=args.request_file, proteins=None, hmm=None, stage_dir=str(stage_dir / "01_discovery"),
        min_score=None, max_evalue=None,
    ))
    candidates_fasta = Path(discovery["artifacts"]["candidate_proteins"])
    filtering = _filter(engines, argparse.Namespace(
        request_file=args.request_file, candidates=str(candidates_fasta),
        stage_dir=str(stage_dir / "02_filtering"), min_coverage=None, min_length=None,
    ))
    filtered_fasta = Path(filtering["artifacts"]["filtered_fasta"])

    esm = esm_stack()
    esm_used = esm["available"]
    classification_dir = stage_dir / "03_classification"
    nomination = _nominate(
        engines,
        candidates_fasta=filtered_fasta,
        request=request,
        stage_dir=classification_dir,
        esm_used=esm_used,
        top_k=thresholds["top_k"],
    )
    report = {
        "ok": True,
        "kind": "ariadne.pipeline-report",
        "schema_version": 1,
        "stages": {
            "discovery": {"summary": discovery["summary"], "artifacts": discovery["artifacts"]},
            "filtering": {"summary": filtering["summary"], "artifacts": filtering["artifacts"]},
            "nomination": {"summary": nomination["summary"], "artifacts": nomination["artifacts"]},
        },
        "nomination_report": nomination,
        "esm_used": esm_used,
        "run_dir": str(stage_dir),
    }
    write_json_file(Path(args.output).expanduser(), report)
    emit(
        {
            "ok": True,
            "stage": "pipeline",
            "output": str(Path(args.output).expanduser()),
            "summary": nomination["summary"],
        }
    )


def command_audit_nomination(args: argparse.Namespace) -> None:
    nomination_path = Path(args.nomination_file).expanduser()
    report = read_json_file(nomination_path)
    if report.get("kind") != "ariadne.nomination-report":
        raise SystemExit(f"not a nomination report: {nomination_path}")

    thresholds = report.get("thresholds") if isinstance(report.get("thresholds"), dict) else {}
    min_score = _finite(thresholds.get("min_score"), DEFAULT_MIN_SCORE)
    max_evalue = _finite(thresholds.get("max_evalue"), DEFAULT_MAX_EVALUE)
    min_length = _finite(thresholds.get("min_length"), DEFAULT_MIN_LENGTH)
    ceess_threshold = _finite(thresholds.get("ceess_threshold"), DEFAULT_CEESS_THRESHOLD)
    esm_used = report.get("esm_used") is True
    # A caller-waived no-ESM run must not be re-flagged by the audit; the
    # waiver is already frozen on the research task as a conditional outcome.
    esm_waived = report.get("esm_waived") is True

    issues: list[dict[str, Any]] = []
    ledger: list[dict[str, Any]] = []
    candidates = report.get("candidates") if isinstance(report.get("candidates"), list) else []

    def issue(severity: str, code: str, candidate_id: str, message: str) -> None:
        issues.append({"severity": severity, "code": code, "candidate_id": candidate_id, "message": message})

    for entry in candidates:
        if not isinstance(entry, dict):
            issue("critical", "NOM-000", "<unknown>", "candidate row is not an object")
            continue
        candidate_id = str(entry.get("sequence_id", "<unknown>"))
        score = _float_or_none(entry.get("hmm_score"))
        evalue = _float_or_none(entry.get("hmm_evalue"))
        length = entry.get("length")
        length_value = _float_or_none(length)
        probability = _float_or_none(entry.get("esm_ceess_probability"))
        if score is None or score < min_score:
            issue("critical", "NOM-001", candidate_id, f"HMM score missing or below {min_score}")
        if evalue is None or evalue > max_evalue:
            issue("critical", "NOM-002", candidate_id, f"HMM E-value missing or above {max_evalue}")
        if length_value is not None and length_value < min_length:
            issue("warning", "NOM-003", candidate_id, f"protein length {length_value} below {min_length}")
        if esm_used:
            if probability is None:
                issue("critical", "NOM-004", candidate_id, "ESM CeeSs probability missing")
            elif probability < ceess_threshold:
                issue("critical", "NOM-005", candidate_id, f"ESM CeeSs probability {probability} below threshold {ceess_threshold}")
        elif not esm_waived:
            issue("warning", "NOM-006", candidate_id, "no semantic evidence (ESM scoring not used and not explicitly waived)")
        if not entry.get("nearest_reference"):
            issue("warning", "NOM-007", candidate_id, "nearest reference missing")
        ledger.append(
            {
                "candidate_id": candidate_id,
                "claims": [
                    {"claim": "hmm_hit", "support": {"score": score, "evalue": evalue}},
                    {"claim": "feature_space_context", "support": {"predicted_source": entry.get("predicted_source"), "nearest_reference": entry.get("nearest_reference"), "confidence": entry.get("confidence")}},
                    {"claim": "semantic_score" if esm_used else "semantic_score_waived", "support": {"esm_ceess_probability": probability}},
                ],
            }
        )

    critical = sum(1 for item in issues if item["severity"] == "critical")
    warnings = sum(1 for item in issues if item["severity"] == "warning")
    if len(candidates) == 0:
        status = "fail"
        issue("critical", "NOM-008", "<report>", "nomination report has no candidates")
        critical += 1
    else:
        status = "fail" if critical else "warn" if warnings else "pass"

    audit = {
        "ok": True,
        "kind": "ariadne.nomination-audit",
        "schema_version": 1,
        "status": status,
        "report": str(nomination_path),
        "summary": {
            "candidates": len(candidates),
            "claims": len(ledger),
            "critical_issues": critical,
            "warnings": warnings,
        },
        "issues": issues,
        "claim_ledger": ledger,
        "note": "structural audit of deterministic nomination evidence; does not establish enzymatic activity or product formation",
    }
    write_json_file(Path(args.output).expanduser(), audit)
    emit(
        {
            "ok": True,
            "status": status,
            "output": str(Path(args.output).expanduser()),
            "summary": audit["summary"],
        }
    )


# ---------------------------------------------------------------------------
# Parser


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ariadne_cli", description=__doc__)
    parser.add_argument("--repo", required=True, help="ariadne-tps checkout root")
    parser.add_argument("--version", action="store_true", help="print adapter version")
    subparsers = parser.add_subparsers(dest="command")

    health = subparsers.add_parser("health")
    health.add_argument("--json", action="store_true")

    subparsers.add_parser("identity")

    catalog = subparsers.add_parser("catalog")
    catalog.add_argument("--kind", choices=["all", "clades", "tps-types"])
    catalog.add_argument("--search")
    catalog.add_argument("--limit", type=int)

    build = subparsers.add_parser("build-hmm")
    build.add_argument("--alignment", required=True)
    build.add_argument("--output", required=True)
    build.add_argument("--name")

    discover = subparsers.add_parser("discover")
    discover.add_argument("--request-file")
    discover.add_argument("--proteins", help="comma-separated protein FASTA paths")
    discover.add_argument("--hmm")
    discover.add_argument("--stage-dir", required=True)
    discover.add_argument("--min-score", type=float)
    discover.add_argument("--max-evalue", type=float)
    discover.add_argument("--output", required=True)

    filt = subparsers.add_parser("filter")
    filt.add_argument("--request-file")
    filt.add_argument("--candidates", required=True)
    filt.add_argument("--stage-dir", required=True)
    filt.add_argument("--min-coverage", type=float)
    filt.add_argument("--min-length", type=int)
    filt.add_argument("--output", required=True)

    score = subparsers.add_parser("score")
    score.add_argument("--candidates", required=True)
    score.add_argument("--workbook", required=True)
    score.add_argument("--model")
    score.add_argument("--ceess-threshold", type=float)
    score.add_argument("--device", choices=["cpu", "cuda", "mps"])
    score.add_argument("--stage-dir", required=True)
    score.add_argument("--output", required=True)

    classify = subparsers.add_parser("classify")
    classify.add_argument("--candidates", required=True)
    classify.add_argument("--reference-dir", required=True)
    classify.add_argument("--hmm-dir")
    classify.add_argument("--top-k", type=int)
    classify.add_argument("--stage-dir", required=True)
    classify.add_argument("--output", required=True)

    nominate = subparsers.add_parser("nominate")
    nominate.add_argument("--candidates", required=True)
    nominate.add_argument("--request-file", required=True)
    nominate.add_argument("--top-k", type=int)
    nominate.add_argument("--no-esm", action="store_true")
    nominate.add_argument("--stage-dir", required=True)
    nominate.add_argument("--output", required=True)

    pipeline = subparsers.add_parser("pipeline")
    pipeline.add_argument("--request-file", required=True)
    pipeline.add_argument("--stage-dir", required=True)
    pipeline.add_argument("--output", required=True)

    audit = subparsers.add_parser("audit-nomination")
    audit.add_argument("--nomination-file", required=True)
    audit.add_argument("--output", required=True)

    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.version:
        command_version(args)
        return 0
    handlers = {
        "health": command_health,
        "identity": command_identity,
        "catalog": command_catalog,
        "build-hmm": command_build_hmm,
        "discover": lambda ns: _write_stage(engines_ready(ns), _discover, ns),
        "filter": lambda ns: _write_stage(engines_ready(ns), _filter, ns),
        "score": command_score,
        "classify": command_classify,
        "nominate": command_nominate,
        "pipeline": command_pipeline,
        "audit-nomination": command_audit_nomination,
    }
    handler = handlers.get(args.command)
    if handler is None:
        parser.print_help(sys.stderr)
        return 2
    handler(args)
    return 0


def engines_ready(ns: argparse.Namespace) -> dict[str, Any]:
    repo = resolve_repo(ns.repo)
    bootstrap(repo)
    return _engine_modules()


def _write_stage(engines: dict[str, Any], operation: Any, ns: argparse.Namespace) -> None:
    payload = operation(engines, ns)
    write_json_file(Path(ns.output).expanduser(), payload)
    emit({"ok": True, "stage": payload["stage"], "output": str(Path(ns.output).expanduser()), "summary": payload["summary"]})


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as error:  # noqa: BLE001 - single JSON error contract
        sys.stderr.write(json.dumps({"ok": False, "error": type(error).__name__, "detail": str(error)}, indent=2))
        sys.stderr.write("\n")
        raise SystemExit(1)
