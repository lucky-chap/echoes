# Belong feasibility harness

This is an independent, evidence-first Qloo API test; it does not build Belong.

```bash
cd belong-feasibility
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env # add QLOO_API_KEY locally
python run_tests.py --smoke
python run_tests.py --full --max-requests 120
```

It writes `output/belong_report.md`, `belong_results.json`,
`belong_raw_responses.json`, `belong_verdict.md`, and a safe ZIP. No output
contains request headers or API keys. `--smoke` is intentionally small and is
the required first run before `--full`.
