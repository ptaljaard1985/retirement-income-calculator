# CI plan

A plan for adding continuous integration to this repo, for when you decide it's worth the setup cost. **Not implemented yet** — this is a blueprint.

## Should you do this?

Probably yes, eventually. The tests are good enough that they're worth running automatically, and a few minutes of configuration once saves you from forgetting to run them later. But it's not urgent. If you're the only person touching the repo and you run tests before pushing, CI adds little that you aren't already getting.

Add CI when one of these becomes true:

- Someone else starts contributing (so you want an automatic gate on their PRs)
- You start making changes from a phone or a machine where you don't have Python and Node installed
- You deploy the calculator to a public URL and want a pre-deploy check
- You've shipped a regression that the tests would have caught but you forgot to run them

Until then, the manual `pytest && node tests/js/run.js` discipline is fine.

## Recommended: GitHub Actions

If the repo lives on GitHub (which is the plan), GitHub Actions is the natural choice. Free for public repos; free for private repos up to 2000 minutes/month, which is far more than this project will ever use. The tests run in under a second each, so a full CI run is 30–60 seconds of actual compute.

## Minimal workflow

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  python-tests:
    name: Python math audits
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install pytest
        run: pip install pytest

      - name: Run tests
        working-directory: tests/python
        run: pytest -v

  js-tests:
    name: JS solver tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run tests
        working-directory: tests/js
        run: node run.js
```

That's it. Two jobs, both targeting `ubuntu-latest`, both running in parallel. Total wall-clock time on a push: ~30 seconds. Whole workflow file is under 40 lines.

## What this gives you

- A green/red badge on every commit and PR
- Automatic rejection of PRs where tests fail (if you turn on branch protection — see below)
- A history of which commits caused regressions
- Peace of mind when merging changes you haven't personally tested

## Branch protection

Once the workflow is in place, turn on branch protection for `main`:

1. GitHub → repo Settings → Branches → Add rule for `main`
2. Check "Require status checks to pass before merging"
3. Select the two check names: `Python math audits` and `JS solver tests`
4. Check "Require branches to be up to date before merging" (optional but good hygiene)

This means no commit can land on `main` unless both test suites pass. If you're the only committer you can bypass this for yourself with "Do not allow bypassing the above settings" left unchecked — but I'd leave it on, because accidentally pushing a broken main is the kind of thing that happens exactly when you're in a hurry.

## What CI should *not* do for this project

- **Don't try to build or bundle.** There's nothing to build. The HTML file is the artefact.
- **Don't run a headless browser for visual regression.** For this size project it's overkill and flaky. Manual print-preview checks are fine.
- **Don't deploy automatically from CI on every push.** Deployment of a client-facing financial tool should be a deliberate human action, not a side effect of a merge.
- **Don't auto-format or lint.** If you add Prettier or ESLint, it'll start re-formatting the one file you care about. For a single handwritten HTML file, formatting tools fight the aesthetic.
- **Don't run `npm install`.** There's no `package.json` and shouldn't be. `node run.js` has zero dependencies beyond Node itself.

## Optional: lint the tests only

If you want linting without polluting the main file, restrict it to the test suites:

```yaml
  lint-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install ruff
      - run: ruff check tests/python
```

`ruff` is fast and zero-config. I would not add this for a project this small — but if a contributor joins and starts writing scruffy tests, it's a lightweight gate.

## Optional: test matrix across Python/Node versions

If you care about the tests running on multiple versions (you probably don't — there's no Python runtime shipping with the product), use a matrix:

```yaml
  python-tests:
    strategy:
      matrix:
        python-version: ['3.10', '3.11', '3.12', '3.13']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      - run: pip install pytest
      - run: cd tests/python && pytest
```

For this project I'd pick one Python version (whatever you have locally), one Node version (`20` LTS), and leave it.

## Badges for the README

Once CI is running, add this to the top of `README.md`:

```markdown
![Tests](https://github.com/YOUR_ORG/drawdown-calculator/actions/workflows/test.yml/badge.svg)
```

Replace `YOUR_ORG` with the actual GitHub org. It'll show green when tests pass, red when they don't. Useful for the 2-second "is main healthy right now?" check.

## What happens when a SARS update breaks everything

This is the main scenario where CI pays for itself. Every February you update the tax tables, and the tests in `test_tax.py` will fail because their expected values are tied to the old tables. Without CI, you might push the partial update (new tables, old expected values) and only notice the test failure when you manually run pytest later — if you remember.

With CI, the push immediately goes red. You can't miss it. You fix the expected values, push again, go green. Five minutes, maybe ten.

## Staged deployment (optional, advanced)

If you eventually host the calculator at `calculators.simplewealth.co.za` (per your earlier suggestion), a reasonable next step is a two-environment setup:

- `calculators-staging.simplewealth.co.za` — auto-deploys from `main` via Cloudflare Pages or Netlify
- `calculators.simplewealth.co.za` — deploys only when a git tag (`v1.2.0`) is pushed

Then CI runs on every push to main; staging updates automatically; you manually tag when you want a production release. The tag workflow is:

```yaml
  deploy-prod:
    name: Deploy to production
    runs-on: ubuntu-latest
    needs: [python-tests, js-tests]
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - uses: actions/checkout@v4
      - run: |
          # your Cloudflare Pages / Netlify / S3 sync command here
```

This is worth setting up once the tool is used by more than just you.

## Cost and reliability

- **Cost**: zero on GitHub's free tier for the usage this project will generate.
- **Reliability**: GitHub Actions is rarely down. The fallback is to run tests locally, which is what you'd be doing anyway.
- **Lock-in**: very low. The workflow file is portable to GitLab CI, CircleCI, or any other runner with trivial changes. The tests themselves are runner-agnostic.

## Checklist when you actually set this up

- [ ] Create `.github/workflows/test.yml` with the minimal workflow above
- [ ] Push to a feature branch first and open a PR — verify the checks run and show up on the PR
- [ ] Merge the PR
- [ ] Turn on branch protection for `main`, requiring both checks to pass
- [ ] Add the tests-passing badge to `README.md`
- [ ] (Optional) Add a `CONTRIBUTING.md` that says "all tests must pass before merging; CI enforces this"

## One sensible rule

**If the tests pass locally but fail in CI, the bug is in the tests or the CI config, not the code.** This isn't always true but it's the default assumption to start with. Check for hardcoded paths, assumptions about the current working directory, locale differences (South African number formatting!), or timezone issues. Fix the test, not the calculator.
