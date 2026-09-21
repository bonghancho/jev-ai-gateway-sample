'use client';

import { useState } from 'react';

interface TriageResult {
  department: {
    value: string;
    probability?: number;
  };
  severity: {
    value: number;
    confidence?: number;
  };
  requestsRefund: {
    value: boolean;
    probability?: number;
  };
  routing: {
    decision: 'automated' | 'manual';
    reason: string;
  };
}

export default function Home() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [plan, setPlan] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          message,
          plan: plan || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to triage ticket');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <h1>Support Ticket Triage</h1>
      <p className="subtitle">
        Powered by TypeSafe AI Jev via Vercel AI Gateway
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="subject">Ticket Subject</label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Unable to access my account"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the issue in detail..."
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="plan">Customer Plan (optional)</label>
          <select
            id="plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="">Not specified</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Analyzing...' : 'Triage Ticket'}
        </button>
      </form>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="result">
          <h2>Triage Results</h2>

          <div className="result-item">
            <strong>Department:</strong>
            <span>
              {result.department.value}
              {result.department.probability !== undefined && (
                <span className="confidence">
                  {(result.department.probability * 100).toFixed(1)}%
                </span>
              )}
            </span>
          </div>

          <div className="result-item">
            <strong>Severity:</strong>
            <span>
              {result.severity.value} / 10
              {result.severity.confidence !== undefined && (
                <span className="confidence">
                  Confidence: {(result.severity.confidence * 100).toFixed(1)}%
                </span>
              )}
            </span>
          </div>

          <div className="result-item">
            <strong>Requests Refund:</strong>
            <span>
              {result.requestsRefund.value ? 'Yes' : 'No'}
              {result.requestsRefund.probability !== undefined && (
                <span className="confidence">
                  {(result.requestsRefund.probability * 100).toFixed(1)}%
                </span>
              )}
            </span>
          </div>

          <div
            className={`routing-decision ${result.routing.decision}`}
          >
            <strong>
              {result.routing.decision === 'automated'
                ? '🤖 Automated Assignment'
                : '👤 Manual Review Required'}
            </strong>
            <div style={{ fontWeight: 'normal', marginTop: '0.5rem' }}>
              {result.routing.reason}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
