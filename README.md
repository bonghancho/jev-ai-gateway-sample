# Jev AI Gateway Sample

A Next.js App Router sample demonstrating **TypeSafe AI's Jev** evaluation model integrated via **Vercel AI Gateway** for support ticket triage.

## Overview

This application analyzes support tickets using Jev's evaluation capabilities to:
- **Classify** tickets by department (technical, billing, sales, general)
- **Score** severity (1-10)
- **Detect** refund requests (boolean)
- **Route** tickets automatically or flag for human review based on confidence thresholds

## Architecture

- **Next.js 15** App Router with TypeScript
- **Vercel AI SDK** (`ai` ≥ 7.0.105) using `experimental_evaluate`
- **Model**: `typesafe-ai/jev` accessed through Vercel AI Gateway
- **Authentication**: AI Gateway connection token (`AI_GATEWAY_API_KEY`)
- **Testing**: Vitest with `Experimental_EvaluationMockModelV4`

## Prerequisites

- **Node.js** 22 or higher
- **Vercel AI Gateway** connection token (see setup below)

## Setup

### 1. Create a Vercel AI Gateway Connection

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Settings** → **AI Gateway** (or visit [vercel.com/dashboard/ai-gateway](https://vercel.com/dashboard/ai-gateway))
3. Click **Create Connection** or **New Connection**
4. Select **TypeSafe AI** as the provider
5. Name your connection (e.g., "Jev Evaluation")
6. Copy the generated **Connection Token** (starts with `vgw_`)

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Gateway token:

```bash
AI_GATEWAY_API_KEY=vgw_your_token_here
```

**Note**: Never commit `.env.local` or any file containing secrets.

### 3. Install Dependencies

```bash
npm install
```

## Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Testing

Run unit tests (no live API key required):

```bash
npm test
```

Tests verify routing logic using `Experimental_EvaluationMockModelV4` from `ai/test`.

## Usage

### Web UI

1. Open the app in your browser
2. Enter a ticket **subject** and **message**
3. Optionally select a customer **plan** (free, pro, enterprise)
4. Click **Triage Ticket**
5. View results:
   - Department classification with probability
   - Severity score (1-10) with confidence
   - Refund detection with probability
   - Routing decision (automated vs. manual review)

### API Endpoint

**POST** `/api/triage`

**Request body:**

```json
{
  "subject": "Unable to access my account",
  "message": "I've been locked out for 3 days. This is urgent!",
  "plan": "pro"
}
```

**Example using curl:**

```bash
curl -X POST http://localhost:3000/api/triage \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Unable to access my account",
    "message": "I have been locked out for 3 days. This is urgent!",
    "plan": "pro"
  }'
```

**Response:**

```json
{
  "department": {
    "value": "technical",
    "probability": 0.92
  },
  "severity": {
    "value": 8,
    "confidence": 0.85
  },
  "requestsRefund": {
    "value": false,
    "probability": 0.88
  },
  "routing": {
    "decision": "manual",
    "reason": "High severity (8/10) requires human review"
  }
}
```

## Routing Logic

Tickets are automatically routed based on these **confidence thresholds**:

| Metric | Threshold | Purpose |
|--------|-----------|---------|
| Department probability | ≥ 0.7 | Ensure confident classification |
| Severity confidence | ≥ 0.6 | Validate severity assessment |
| Refund probability | ≥ 0.7 | Confirm refund request detection |
| High severity | ≥ 8/10 | Always require human review |

**Automated routing** occurs when:
- All confidence thresholds are met
- Severity < 8
- No refund request (or refund detection has low confidence)

**Manual review** is required when:
- Any confidence threshold is below the minimum
- Severity ≥ 8/10
- Refund is requested with high confidence

These thresholds are defined in `src/lib/triage.ts` as `CONFIDENCE_THRESHOLDS`.

## Alternative Authentication: OIDC (Local Development)

For local development with OIDC tokens (expires ~12 hours):

```bash
vercel link
vercel env pull .env.local
```

This populates `VERCEL_OIDC_TOKEN`. The AI SDK will use this token automatically when `AI_GATEWAY_API_KEY` is not set.

**Note**: OIDC tokens are short-lived. For production, use AI Gateway connection tokens.

## Build

Build the production bundle:

```bash
npm run build
```

Verify the build completes without errors.

## Project Structure

```
/workspace
├── src/
│   ├── app/
│   │   ├── api/triage/route.ts    # API endpoint
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Home page UI
│   │   └── globals.css             # Styles
│   └── lib/
│       ├── triage.ts               # Core evaluation logic
│       └── triage.test.ts          # Unit tests
├── package.json
├── tsconfig.json
├── next.config.ts
├── vitest.config.ts
├── .env.example                    # Template for environment variables
├── .gitignore
└── README.md
```

## Key Features

### Zero Data Retention

All evaluation calls include:

```typescript
providerOptions: {
  gateway: {
    zeroDataRetention: true,
  },
}
```

This ensures TypeSafe AI does not retain prompt data.

### Type-Safe Questions

The app uses Jev's three question types:

- **`choice`**: Department selection from predefined options
- **`score`**: Numeric severity rating (1-10)
- **`boolean`**: Refund request detection

### Testing with Mocks

Tests use `Experimental_EvaluationMockModelV4` to simulate Jev responses without network calls:

```typescript
const mockModel = new Experimental_EvaluationMockModelV4({
  answers: {
    department: { value: 'technical', probability: 0.85 },
    severity: { value: 6, confidence: 0.8 },
    requestsRefund: { value: false, probability: 0.95 },
  },
});
```

## References

- [TypeSafe Jev & AI SDK Guide](https://vercel.com/kb/guide/typesafe-jev-and-ai-sdk)
- [Vercel AI Gateway - TypeSafe Docs](https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)

## License

MIT
