# create-node-api-mock

A zero-dependency Node.js REST API scaffolded by Jewel.

## Run

```bash
npm start
```

## Endpoints

- `GET /health` — health check
- `GET /api/items` — list items
- `POST /api/items` — create item (JSON: `{ "name": "..." }`)

## Test

```bash
npm test
```

## Extend with Jewel

```bash
jewel run "Add DELETE /api/items/:id endpoint with tests" --yes
```
