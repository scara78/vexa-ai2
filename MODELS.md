# Models

```
GET /models
```

Returns all available text models scraped live from Vexa, and live image models from Vexa Image Model. Cached for 5 minutes per serverless instance.

---

## Response

```json
{
  "success": true,
  "default": "vexa",
  "models": {
    "name": {
      "label": "Model Label",
      "provider": "Provider",
      "speed": 0,
      "quality": 0
    }
  },
  "image_models": [
    {
      "name": "Model Name",
      "count": 0
    }
  ]
}
```

---

## Text Models

Text models are **scraped live from Vexa** on every cache miss — there is no hardcoded list. Each model includes a display label, provider, speed in words per second, and a quality score sourced directly from the Vexa UI.

Use `GET /models` to discover what's currently available. The model list changes as Vexa adds or removes models.

### Text model fields

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Display name from Vexa |
| `provider` | string | Company behind the model (Google, OpenAI, Anthropic, etc.) |
| `speed` | number | Processing speed in words per second |
| `quality` | number | Quality score (0–100) as shown on Vexa |

### Default model

`vexa` — used when no `model` param is specified. Falls back to first available model if not present in the scraped list.

---

## Image Models

Fetched live from Vexa Image Model workers endpoint, filtered to online workers only, ranked by worker count descending. Top 30 returned.

If the workers endpoint fails, falls back to the Vexa Image Model model reference API.

Pass the exact `name` to `/image?model=` or the `model` POST body field.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Exact model name to pass to `/image` |
| `count` | number | Active workers right now (0 if sourced from fallback reference) |

---

## Caching

Both lists cached for **5 minutes** per serverless instance.

If upstream is unreachable, falls back to last successful cache or empty defaults:

```json
{ "success": true, "default": "vexa", "models": {}, "image_models": [] }
```