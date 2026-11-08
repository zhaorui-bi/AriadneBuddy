"""Unit tests for the AriadneBuddy adapter CLI (backend/ariadne_cli.py).

The adapter is invoked in-process (``main(argv)`` with redirected stdout) so the
tests need no subprocess. A synthetic ariadne-tps checkout (importable
``ariadne`` package plus reference data) is built per test, so no engine
installation is required for the commands under test: version, health, identity,
and the deterministic nomination audit.
"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
ADAPTER = PACKAGE_ROOT / "backend" / "ariadne_cli.py"
ADAPTER_VERSION = "0.1.0-beta.1"


def load_adapter():
    spec = importlib.util.spec_from_file_location("ariadne_cli_under_test", ADAPTER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def purge_ariadne_modules() -> None:
    for name in [entry for entry in sys.modules if entry == "ariadne" or entry.startswith("ariadne.")]:
        del sys.modules[name]


class AdapterHarness:
    """Runs adapter commands in-process against one synthetic repository."""

    def __init__(self, repo: Path) -> None:
        self.repo = repo

    def run(self, adapter_args: list[str]) -> tuple[int, str, str]:
        purge_ariadne_modules()
        module = load_adapter()
        stdout = io.StringIO()
        stderr = io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            try:
                code = module.main(["--repo", str(self.repo), *adapter_args])
            except SystemExit as exit_error:
                code = exit_error.code if isinstance(exit_error.code, int) else 1
                if not isinstance(exit_error.code, int):
                    stderr.write(f"{exit_error.code}\n")
        purge_ariadne_modules()
        return code, stdout.getvalue(), stderr.getvalue()


def make_repo(root: Path) -> Path:
    repo = root / "Ariadne"
    (repo / "ariadne").mkdir(parents=True)
    (repo / "ariadne" / "__init__.py").write_text('__version__ = "9.9.9-test"\n')
    for engine_module in ("search", "filter", "embed", "model", "data", "utils"):
        (repo / "ariadne" / f"{engine_module}.py").write_text(
            '"""Synthetic engine module stub."""\n'
        )
    # Minimal engine-dependency stubs so health/identity see a ready environment
    # without requiring pyhmmer/scikit-learn to be installed in the test runner.
    for dependency in ("numpy", "pyhmmer", "pyrodigal", "sklearn", "openpyxl"):
        (repo / dependency).mkdir()
        (repo / dependency / "__init__.py").write_text('__version__ = "1.0-test"\n')
    references = repo / "input" / "references"
    references.mkdir(parents=True)
    (references / "coral.afa").write_text(">coral_1\nMKV\n")
    (references / "insect.afa").write_text(">insect_1\nMKVL\n")
    (repo / "input" / "query.hmm").write_text("HMMER3/f [test]\n")
    (repo / "TPS.xlsx").write_bytes(b"placeholder-not-parsed-in-these-tests")
    return repo


def nomination_report(path: Path, **overrides: object) -> Path:
    report = {
        "kind": "ariadne.nomination-report",
        "schema_version": 1,
        "esm_used": True,
        "thresholds": {
            "min_score": 0.0,
            "max_evalue": 0.001,
            "min_length": 300,
            "ceess_threshold": 0.9,
            "top_k": 5,
        },
        "candidates": [
            {
                "sequence_id": "seq_good",
                "hmm_score": 210.5,
                "hmm_evalue": 1e-40,
                "length": 320,
                "esm_ceess_probability": 0.97,
                "nearest_reference": "coral_1",
                "predicted_source": "coral",
                "confidence": 0.92,
            }
        ],
        "summary": {"evaluated": 1, "nominated": 1},
    }
    report.update(overrides)
    path.write_text(json.dumps(report))
    return path


class AdapterContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="ariadnebuddy-adapter-test-")
        self.root = Path(self._tmp.name)
        self.repo = make_repo(self.root)
        self.addCleanup(self._tmp.cleanup)
        self.addCleanup(purge_ariadne_modules)

    def test_version_string(self) -> None:
        code, stdout, _stderr = AdapterHarness(self.repo).run(["--version"])
        self.assertEqual(code, 0)
        self.assertIn(f"ariadnebuddy-adapter {ADAPTER_VERSION}", stdout)

    def test_health_reports_readiness_and_reference_data(self) -> None:
        code, stdout, _stderr = AdapterHarness(self.repo).run(["health", "--json"])
        self.assertEqual(code, 0)
        payload = json.loads(stdout)
        self.assertTrue(payload["ok"])
        self.assertTrue(payload["ready_for_pipeline"])
        self.assertTrue(payload["data"]["query_hmm_available"])
        self.assertTrue(payload["data"]["reference_alignments_available"])
        self.assertEqual(set(payload["data"]["reference_clades"]), {"coral", "insect"})
        self.assertIn("pyhmmer", payload["dependencies"])
        self.assertIsInstance(payload["esm"]["available"], bool)

    def test_health_fails_without_reference_data(self) -> None:
        (self.repo / "input" / "query.hmm").unlink()
        code, stdout, _stderr = AdapterHarness(self.repo).run(["health", "--json"])
        self.assertEqual(code, 0)
        payload = json.loads(stdout)
        self.assertFalse(payload["ok"])
        self.assertFalse(payload["ready_for_pipeline"])

    def test_identity_exposes_engines_and_defaults(self) -> None:
        _code, stdout, _stderr = AdapterHarness(self.repo).run(["identity"])
        payload = json.loads(stdout)
        self.assertEqual(payload["adapter_version"], ADAPTER_VERSION)
        self.assertEqual(payload["backend_revision"], "9.9.9-test")
        self.assertIn("hmm", payload["engines"])
        self.assertIn("semantic", payload["engines"])
        self.assertIn("feature_space", payload["engines"])
        self.assertGreaterEqual(payload["defaults"]["ceess_threshold"], 0.5)

    def test_health_reports_import_failure_as_json(self) -> None:
        broken = self.root / "Broken"
        (broken / "ariadne").mkdir(parents=True)
        (broken / "ariadne" / "__init__.py").write_text("raise ImportError('nope')\n")
        (broken / "pyproject.toml").write_text("")
        _code, stdout, _stderr = AdapterHarness(broken).run(["health", "--json"])
        payload = json.loads(stdout)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error"], "ariadne_import_failed")

    def test_audit_passes_complete_nomination_evidence(self) -> None:
        report = nomination_report(self.root / "nomination.json")
        output = self.root / "audit.json"
        code, stdout, _stderr = AdapterHarness(self.repo).run(
            ["audit-nomination", "--nomination-file", str(report), "--output", str(output)]
        )
        self.assertEqual(code, 0)
        summary = json.loads(stdout)["summary"]
        self.assertEqual(summary["candidates"], 1)
        self.assertEqual(summary["critical_issues"], 0)
        audit = json.loads(output.read_text())
        self.assertEqual(audit["status"], "pass")
        self.assertEqual(audit["kind"], "ariadne.nomination-audit")
        self.assertEqual(audit["report"], str(report))
        self.assertEqual(len(audit["claim_ledger"]), 1)

    def test_audit_flags_missing_semantic_and_weak_hmm_evidence(self) -> None:
        report = nomination_report(
            self.root / "nomination-bad.json",
            esm_used=False,
            candidates=[
                {
                    "sequence_id": "seq_bad",
                    "hmm_score": 0.5,
                    "hmm_evalue": 0.5,
                    "length": 120,
                    "nearest_reference": "",
                }
            ],
        )
        output = self.root / "audit-bad.json"
        code, _stdout, _stderr = AdapterHarness(self.repo).run(
            ["audit-nomination", "--nomination-file", str(report), "--output", str(output)]
        )
        self.assertEqual(code, 0)
        audit = json.loads(output.read_text())
        self.assertEqual(audit["status"], "fail")
        codes = {issue["code"] for issue in audit["issues"]}
        self.assertIn("NOM-002", codes)  # E-value above threshold
        self.assertIn("NOM-003", codes)  # short protein warning
        self.assertIn("NOM-006", codes)  # semantic evidence waived
        self.assertIn("NOM-007", codes)  # nearest reference missing

    def test_audit_respects_explicit_esm_waiver(self) -> None:
        report = nomination_report(
            self.root / "nomination-waived.json",
            esm_used=False,
            esm_waived=True,
            candidates=[
                {
                    "sequence_id": "seq_waived",
                    "hmm_score": 180.2,
                    "hmm_evalue": 1e-30,
                    "length": 340,
                    "esm_ceess_probability": None,
                    "nearest_reference": "coral_1",
                }
            ],
        )
        output = self.root / "audit-waived.json"
        code, _stdout, _stderr = AdapterHarness(self.repo).run(
            ["audit-nomination", "--nomination-file", str(report), "--output", str(output)]
        )
        self.assertEqual(code, 0)
        audit = json.loads(output.read_text())
        self.assertEqual(audit["status"], "pass")
        codes = {issue["code"] for issue in audit["issues"]}
        self.assertNotIn("NOM-006", codes)

    def test_audit_rejects_foreign_reports(self) -> None:
        foreign = self.root / "foreign.json"
        foreign.write_text(json.dumps({"kind": "something.else"}))
        code, _stdout, stderr = AdapterHarness(self.repo).run(
            ["audit-nomination", "--nomination-file", str(foreign), "--output", str(self.root / "out.json")]
        )
        self.assertNotEqual(code, 0)
        self.assertIn("not a nomination report", stderr)

    def test_discover_requires_proteins(self) -> None:
        code, _stdout, stderr = AdapterHarness(self.repo).run(
            [
                "discover",
                "--proteins",
                "",
                "--hmm",
                "missing",
                "--stage-dir",
                str(self.root / "stage"),
                "--output",
                str(self.root / "out.json"),
            ]
        )
        self.assertNotEqual(code, 0)
        self.assertIn("discovery requires input proteins", stderr)


if __name__ == "__main__":
    unittest.main()
