import { experimental_evaluate as evaluate } from 'ai';

export interface TriageEvaluation {
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
}

export interface RoutingDecision {
  decision: 'automated' | 'manual';
  reason: string;
}

export const CONFIDENCE_THRESHOLDS = {
  MIN_DEPARTMENT_PROBABILITY: 0.7,
  MIN_SEVERITY_CONFIDENCE: 0.6,
  MIN_REFUND_PROBABILITY: 0.7,
  HIGH_SEVERITY_THRESHOLD: 8,
} as const;

export async function evaluateTicket(
  ticketText: string,
  apiKey: string
): Promise<TriageEvaluation> {
  const result = await evaluate({
    model: 'typesafe-ai/jev',
    state: ticketText,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    questions: {
      department: {
        type: 'choice' as const,
        instructions: 'Which department should handle this ticket?',
        criteria: {
          technical: 'Technical issues, bugs, login problems, feature questions',
          billing: 'Payment, invoicing, subscription, or pricing questions',
          sales: 'Product inquiries, demos, or purchasing questions',
          general: 'General inquiries or unclear requests',
        },
      },
      severity: {
        type: 'score' as const,
        instructions: 'Rate the severity of this issue from 0-9, where 0 is lowest and 9 is highest',
        criteria: [
          'Low priority - minor inconvenience',
          'Low-medium priority',
          'Medium priority',
          'Medium-high priority',
          'High priority',
          'High priority - significant impact',
          'Very high priority',
          'Critical - major business impact',
          'Critical - service down',
          'Emergency - complete service outage',
        ],
      },
      requestsRefund: {
        type: 'boolean' as const,
        instructions: 'Does the customer request a refund or mention wanting their money back?',
        criteria: {
          true: 'Customer explicitly requests a refund or mentions wanting money back',
          false: 'No refund request mentioned',
        },
      },
    },
    providerOptions: {
      gateway: {
        zeroDataRetention: true,
      },
    },
  });

  const departmentAnswer = result.answers.department;
  const severityAnswer = result.answers.severity;
  const refundAnswer = result.answers.requestsRefund;

  if (departmentAnswer.type !== 'choice' || severityAnswer.type !== 'score' || refundAnswer.type !== 'boolean') {
    throw new Error('Unexpected answer types from evaluation model');
  }

  const departmentProbability = departmentAnswer.probabilities?.[departmentAnswer.choice];
  
  return {
    department: {
      value: departmentAnswer.choice,
      probability: departmentProbability,
    },
    severity: {
      value: severityAnswer.score,
      confidence: severityAnswer.probabilities ? 
        Math.max(...Object.values(severityAnswer.probabilities)) : undefined,
    },
    requestsRefund: {
      value: refundAnswer.probability > 0.5,
      probability: refundAnswer.probability > 0.5 ? refundAnswer.probability : (1 - refundAnswer.probability),
    },
  };
}

export function makeRoutingDecision(
  evaluation: TriageEvaluation
): RoutingDecision {
  const reasons: string[] = [];

  const departmentConfident = 
    evaluation.department.probability === undefined ||
    evaluation.department.probability >= CONFIDENCE_THRESHOLDS.MIN_DEPARTMENT_PROBABILITY;

  const severityConfident = 
    evaluation.severity.confidence === undefined ||
    evaluation.severity.confidence >= CONFIDENCE_THRESHOLDS.MIN_SEVERITY_CONFIDENCE;

  const refundConfident = 
    evaluation.requestsRefund.probability === undefined ||
    evaluation.requestsRefund.probability >= CONFIDENCE_THRESHOLDS.MIN_REFUND_PROBABILITY;

  if (!departmentConfident) {
    reasons.push('Department classification has low confidence');
  }

  if (!severityConfident) {
    reasons.push('Severity assessment has low confidence');
  }

  if (!refundConfident) {
    reasons.push('Refund request detection has low confidence');
  }

  if (evaluation.severity.value >= CONFIDENCE_THRESHOLDS.HIGH_SEVERITY_THRESHOLD) {
    reasons.push(`High severity (${evaluation.severity.value}/10) requires human review`);
  }

  if (evaluation.requestsRefund.value && refundConfident) {
    reasons.push('Refund request requires human approval');
  }

  if (reasons.length > 0) {
    return {
      decision: 'manual',
      reason: reasons.join('. '),
    };
  }

  return {
    decision: 'automated',
    reason: `Assigned to ${evaluation.department.value} queue with ${evaluation.severity.value}/10 severity`,
  };
}
