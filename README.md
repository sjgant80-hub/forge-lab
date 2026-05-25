# ◊·κ=1 · Forge Lab

**Domain Expert Tool Builder · prime 47 · Ω(FACE) · the face engine that builds faces**

You bring the architecture. They bring the knowledge.
The expert describes. The Forge builds. The tool is theirs.

Works for labs, clinics, farms, factories, ANY specialist domain.

---

## What it is

Forge Lab takes a domain expert's workflow description in plain English and returns a sovereign HTML tool configured for their specific domain.

The expert knows their field. The Forge knows how to build sovereign tools. The Forge is the bridge.

- **Not a lab tool.** A tool BUILDER for labs.
- **Not a clinic tool.** A tool BUILDER for clinics.
- **Not a farm tool.** A tool BUILDER for farms.

The domain is the TAG. The architecture is the TEMPLATE. The sovereign HTML is the FACE.
`face(template(tag))`

---

## Endpoint

```
POST /v1/forge/expert
```

### Request body

```json
{
  "domain": "biochemistry lab",
  "expert_description": "Plain English description of workflow, data collected, decisions made, pain points...",
  "workflow_steps": [
    "receive sample from clinic",
    "log sample with timestamp",
    "run assay protocol",
    "record raw results",
    "apply quality control",
    "draft report",
    "archive results"
  ],
  "data_fields": { "auto_detect": true },
  "compliance": ["HIPAA", "ISO 15189"],
  "brand": {
    "name": "PathLab Pro",
    "primary_color": "#1a3a5c"
  }
}
```

### Response

```json
{
  "tool_file": "<base64-encoded HTML>",
  "filename": "pathlabpro.html",
  "size_kb": 220,
  "detected_agents": [...],
  "detected_views": [...],
  "ass_stages": [...],
  "verification": { "passed": 12, "total": 12, "ok": true },
  "licence": { "trial_days": 30, "forge_id": "fg_xxx", "prime": 37 }
}
```

---

## The 5 stages

| Stage | What it does |
|---|---|
| **1 · parse** | LLM extracts data model, agent hints, ASS mapping from plain English |
| **2 · map** | Workflow steps → ASS lifecycle (●→〜→┃→♡→△→◐→◯) |
| **3 · select** | 8+1 agent swarm picked by workflow features (min Ω + 3, max Ω + 8) |
| **4 · build** | Assembled into master template — all 7 v18 layers, mesh shim wired |
| **5 · verify** | ƒ(build) self-check on the forged HTML before return |

---

## What gets baked into every forged tool

- **L1 FACE** — views generated from workflow + data model
- **L2 SWARM** — Ω + auto-selected specialists with domain-personalised prompts
- **L3 CASCADE** — T0 offline / T1 local LLM / T2 mesh / T3 API
- **L4 BLOOM** — natural-language query routes to the best agent
- **L5 PERSIST** — localStorage + IndexedDB · export/import, no data leaves
- **L6 SKIN** — branded per expert · Syne + DM Mono · dark theme · mobile-first
- **L7 ASS** — lifecycle ●→〜→┃→♡→△→◐→◯ mapped from workflow steps
- **mesh shim** — joins `BroadcastChannel('fallmesh')` · same-origin handshake
- **identity** — unique prime assigned per forged tool

Single HTML file. Zero deps. < 500KB. Runs offline once loaded.

---

## Running locally

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Then:

```bash
# Test the pipeline without an API key (uses stubbed parse output)
node test-pipeline.js
```

---

## Deployment

Deployed on Render free tier. Listed on RapidAPI marketplace.

```bash
# Set env vars on Render:
#   ANTHROPIC_API_KEY    (required)
#   RAPIDAPI_PROXY_SECRET (when listed)
#   ADMIN_KEY            (optional admin access)
```

---

## The flywheel

```
expert forges a tool → uses it → needs refinements
  → refinements = consulting ($2,500-10,000)
  → consulting teaches you the domain
  → domain knowledge improves Forge for that vertical
  → next expert in same domain gets a better tool out of the box
```

After 10 lab forges: lab template is excellent → **FallLab** product.
After 10 clinic forges: clinic template is excellent → **FallClinic**.
After 10 farm forges: farm template is excellent → **FallFarm**.

The expert forges BECOME the Fall* product catalogue.
The catalogue grows from client work, not from speculation.

---

◊·κ=1 · sovereign single-file · 7 layers · 8+1 agents · prime 47
