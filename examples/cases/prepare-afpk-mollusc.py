#!/usr/bin/env python3
"""Prepare a small AFPK KS screening example from published mollusc data."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from textwrap import fill


SPRINGER = (
    "https://static-content.springer.com/esm/art%3A10.1038%2Fs41467-023-44497-0/"
    "MediaObjects/41467_2023_44497_MOESM"
)
FIGSHARE = "https://ndownloader.figshare.com/files/"
SOURCES = {
    "supplement-1.txt": (SPRINGER + "4_ESM.txt", "133879222add7627d4682385863bba8ff0b5ea306679798980a3b401fe9ae3a9"),
    "supplement-2.txt": (SPRINGER + "5_ESM.txt", "64e29a97cb68f6d0c15b10bde069d5174a64ed934218420caa99ffba9d678244"),
    "supplement-3.txt": (SPRINGER + "6_ESM.txt", "1cf2e0166af4919daf72ad4460b4f780717a0a5be9704931e0b802d954b04ae1"),
    "nr_SRA_mollusk_KS.fa": (FIGSHARE + "42223470", "5d84145f8000abbfa56250ab7fbf2afac34b054972230a40f2f849ca4d3f98fa"),
    "mo_clade1_rmshort.fa": (FIGSHARE + "42239040", "bdb9ee949b06229eb0fa97d10882c2c83768afe7f6b30ceed5c8f0ad03d0cbf6"),
    "mollusk_AFPK_hit": (FIGSHARE + "42237492", "1598529da63ba9a649c51da4352f5b00d93a36f36dc1573e82d23437dd1b7081"),
}
MODELS = {"fas_i": "supplement-2.txt", "fas_ii": "supplement-3.txt", "pks": "supplement-1.txt"}
ANCHORS = ("EcPKS1_E._chlorotica__extraction", "EcPKS2_E._chlorotica__extraction")
FAS_CONTROL = "XP_041363356.1:1-468"
PUBLISHED_HIT = "XP_041375027.1:1-432"


def verified_sources(directory, download):
    for name, (url, sha256) in SOURCES.items():
        target = directory / name
        if download:
            subprocess.run([
                "curl", "--fail", "--silent", "--show-error", "--location", "--retry", "2",
                "--max-time", "45", "--proto", "=https", "--proto-redir", "=https",
                "--output", str(target), url,
            ], check=True)
        if hashlib.sha256(target.read_bytes()).hexdigest() != sha256:
            raise ValueError(f"SHA-256 mismatch for {name}")


def extract_records(source, ids):
    records = {}
    for record in source.read_text(encoding="ascii").split(">")[1:]:
        header, _, lines = record.partition("\n")
        seq_id = header.split()[0]
        if seq_id not in ids:
            continue
        sequence = "".join(lines.split()).replace("-", "")
        if not sequence or records.setdefault(seq_id, sequence) != sequence:
            raise ValueError(f"Conflicting or empty records for {seq_id}")
    missing = set(ids) - records.keys()
    if missing:
        raise ValueError(f"Missing FASTA IDs: {', '.join(sorted(missing))}")
    return records


def prepare(source, output, pyhmmer, run_original, desk_workspace):
    records = extract_records(source / "mo_clade1_rmshort.fa", ANCHORS)
    records.update(extract_records(source / "nr_SRA_mollusk_KS.fa", (FAS_CONTROL, PUBLISHED_HIT)))
    annotations = {
        line for line in (source / "mollusk_AFPK_hit").read_text(encoding="utf-8").splitlines()
        if line.split("\t", 1)[0] == PUBLISHED_HIT
    }
    if len(annotations) != 1:
        raise ValueError(f"Expected one published AFPK-finder row for {PUBLISHED_HIT}")
    alphabet = pyhmmer.easel.Alphabet.amino()
    builder = pyhmmer.plan7.Builder(alphabet)
    background = pyhmmer.plan7.Background(alphabet)
    profiles = {}
    for role, name in MODELS.items():
        with pyhmmer.easel.MSAFile(source / name, format="afa", digital=True, alphabet=alphabet) as alignments:
            alignment = alignments.read()
        alignment.name = role.encode("ascii")
        profile, _, _ = builder.build_msa(alignment, background)
        profile.command_line = None
        profile.creation_time = None
        profiles[role] = profile

    output.mkdir(parents=True)
    (output / "mollusc-ks.faa").write_text("".join(
        f">{seq_id}\n{fill(records[seq_id], 70)}\n"
        for seq_id in (*ANCHORS, FAS_CONTROL, PUBLISHED_HIT)
    ), encoding="ascii")
    (output / "published-afpk-finder.tsv").write_text(next(iter(annotations)) + "\n", encoding="utf-8")
    published_scores = Path(__file__).with_name("afpk-mollusc-published-ks.json")
    (output / "published-ks-scores.json").write_bytes(published_scores.read_bytes())
    for role, profile in profiles.items():
        with (output / f"{role}.hmm").open("wb") as handle:
            profile.write(handle)

    def request(relative_dir):
        payload = {
            "workflow": "afpk-ks",
            "input_proteins": [(relative_dir / "mollusc-ks.faa").as_posix()],
            "ks_models": {role: (relative_dir / f"{role}.hmm").as_posix() for role in MODELS},
            "fas_i_window": {"min": 400, "max": 600},
            "reference_anchors": list(ANCHORS),
            "afpk_finder_files": [(relative_dir / "published-afpk-finder.tsv").as_posix()],
            "published_ks_scores_file": (relative_dir / "published-ks-scores.json").as_posix(),
        }
        if run_original:
            payload["run_afpk_finder"] = True
        return payload

    create = {
        "requestId": "lin-2024-mollusc-afpk-original" if run_original else "lin-2024-mollusc-afpk-demo",
        "objective": "Review published mollusc KS controls and one published putative AFPK in AriadneBuddy.",
        "requestFile": "request.json",
        "maxJobs": 2,
    }
    sources = {name: {"url": url, "sha256": sha} for name, (url, sha) in SOURCES.items()}
    manifests = {"request.json": request(Path()), "create.json": create, "sources.json": sources}
    if desk_workspace is not None:
        manifests["desk-request.json"] = request(output.relative_to(desk_workspace))
    for filename, value in manifests.items():
        (output / filename).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    destination = parser.add_mutually_exclusive_group(required=True)
    destination.add_argument("--out", type=Path, help="New directory for the example files")
    destination.add_argument("--desk-workspace", type=Path, help="Prepare a Research Desk preset in this existing workspace")
    parser.add_argument("--source-dir", type=Path, help="Read the pinned files with the names in SOURCES from this directory")
    parser.add_argument("--run-original", action="store_true", help="Request a live original AFPK-finder v1.0 run")
    args = parser.parse_args()
    desk_workspace = None
    output = args.out
    if args.desk_workspace is not None:
        desk_workspace = args.desk_workspace.resolve()
        if not desk_workspace.is_dir():
            parser.error("--desk-workspace must be an existing workspace directory")
        output = desk_workspace / ".ariadne" / "cases" / "afpk-mollusc"
        if output.resolve() != output:
            parser.error("the Research Desk preset directory cannot pass through a symbolic link")
    if output.exists():
        parser.error(f"the example output directory must be new: {output}")
    try:
        import pyhmmer
    except ImportError:
        parser.exit(1, "Install pyhmmer==0.12.1 in this Python environment first.\n")
    if pyhmmer.__version__ != "0.12.1":
        parser.exit(1, "Use pyhmmer==0.12.1 to reproduce the example profiles.\n")
    with tempfile.TemporaryDirectory(prefix="ariadne-mollusc-") as download_dir:
        source = args.source_dir if args.source_dir is not None else Path(download_dir)
        verified_sources(source, download=args.source_dir is None)
        prepare(source, output, pyhmmer, args.run_original, desk_workspace)
    print(output.resolve())


if __name__ == "__main__":
    main()
