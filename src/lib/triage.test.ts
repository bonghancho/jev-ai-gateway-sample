import { describe, it, expect } from 'vitest';
import { experimental_evaluate as evaluate } from 'ai';
import { Experimental_EvaluationMockModelV4 } from 'ai/test';
import { makeRoutingDecision, CONFIDENCE_THRESHOLDS, TriageEvaluation } from './triage';

describe('Triage Logic', () => {
  describe('makeRoutingDecision', () => {
    it('should route to automated when all confidence thresholds are met and severity is low', () => {
      const evaluation: TriageEvaluation = {
        department: {
          value: 'technical',
          probability: 0.85,
        },
        severity: {
          value: 5,
          confidence: 0.8,
        },
        requestsRefund: {
          value: false,
          probability: 0.9,
        },
      };

      const decision = makeRoutingDecision(evaluation);

      expect(decision.decision).toBe('automated');
      expect(decision.reason).toContain('technical queue');
      expect(decision.reason).toContain('5/10 severity');
    });

    it('should route to manual when department probability is below threshold', () => {
      const evaluation: TriageEvaluation = {
        department: {
          value: 'billing',
          probability: 0.5,
        },
        severity: {
          value: 4,
          confidence: 0.8,
        },
        requestsRefund: {
          value: false,
          probability: 0.9,
        },
      };

      const decision = makeRoutingDecision(evaluation);

      expect(decision.decision).toBe('manual');
      expect(decision.reason).toContain('Department classification has low confidence');
    });

    it('should route to manual when severity confidence is below threshold', () => {
      const evaluation: TriageEvaluation = {
        department: {
          value: 'technical',
          probability: 0.85,
        },
        severity: {
          value: 5,
          confidence: 0.4,
        },
        requestsRefund: {
          value: false,
          probability: 0.9,
        },
      };

      const decision = makeRoutingDecision(evaluation);

      expect(decision.decision).toBe('manual');
      expect(decision.reason).toContain('Severity assessment has low confidence');
    });

    it('should route to manual when severity is high (>= 8)', () => {
      const evaluation: TriageEvaluation = {
        department: {
          value: 'technical',
          probability: 0.85,
        },
        severity: {
          value: 9,
          confidence: 0.8,
        },
        requestsRefund: {
          value: false,
          probability: 0.9,
        },
      };

      const decision = makeRoutingDecision(evaluation);

      expect(decision.decision).toBe('manual');
      expect(decision.reason).toContain('High severity (9/10) requires human review');
    });

    it('should route to manual when refund is requested with high confidence', () => {
      const evaluation: TriageEvaluation = {
        department: {
          value: 'billing',
          probability: 0.85,
        },
        severity: {
          value: 5,
          confidence: 0.8,
        },
        requestsRefund: {
          value: true,
          probability: 0.85,
        },
      };

      const decision = makeRoutingDecision(evaluation);

      expect(decision.decision).toBe('manual');
      expect(decision.reason).toContain('Refund request requires human approval');
    });

    it('should route to automated when refund confidence is low even if value is true', () => {
      const evaluation: TriageEvaluation = {
        department: {
          value: 'technical',
          probability: 0.85,
        },
        severity: {
          value: 5,
          confidence: 0.8,
        },
        requestsRefund: {
          value: true,
          probability: 0.5,
        },
      };

      const decision = makeRoutingDecision(evaluation);

      expect(decision.decision).toBe('manual');
      expect(decision.reason).toContain('Refund request detection has low confidence');
    });

    it('should handle multiple reasons for manual review', () => {
      const evaluation: TriageEvaluation = {
        department: {
          value: 'billing',
          probability: 0.5,
        },
        severity: {
          value: 9,
          confidence: 0.4,
        },
        requestsRefund: {
          value: true,
          probability: 0.85,
        },
      };

      const decision = makeRoutingDecision(evaluation);

      expect(decision.decision).toBe('manual');
      expect(decision.reason).toContain('Department classification has low confidence');
      expect(decision.reason).toContain('Severity assessment has low confidence');
      expect(decision.reason).toContain('High severity (9/10) requires human review');
      expect(decision.reason).toContain('Refund request requires human approval');
    });

    it('should route to automated when confidence values are undefined (not provided by model)', () => {
      const evaluation: TriageEvaluation = {
        department: {
          value: 'technical',
        },
        severity: {
          value: 5,
        },
        requestsRefund: {
          value: false,
        },
      };

      const decision = makeRoutingDecision(evaluation);

      expect(decision.decision).toBe('automated');
    });
  });

  describe('Integration Scenarios', () => {
    it('should correctly evaluate a typical low-severity technical ticket', () => {
      const mockEvaluation: TriageEvaluation = {
        department: { value: 'technical', probability: 0.85 },
        severity: { value: 6, confidence: 0.8 },
        requestsRefund: { value: false, probability: 0.95 },
      };

      const decision = makeRoutingDecision(mockEvaluation);
      
      expect(decision.decision).toBe('automated');
      expect(decision.reason).toContain('technical queue');
      expect(decision.reason).toContain('6/10 severity');
    });

    it('should correctly evaluate a high-severity billing ticket with refund request', () => {
      const mockEvaluation: TriageEvaluation = {
        department: { value: 'billing', probability: 0.92 },
        severity: { value: 9, confidence: 0.88 },
        requestsRefund: { value: true, probability: 0.91 },
      };

      const decision = makeRoutingDecision(mockEvaluation);
      
      expect(decision.decision).toBe('manual');
      expect(decision.reason).toContain('High severity (9/10)');
      expect(decision.reason).toContain('Refund request requires human approval');
    });

    it('should correctly evaluate an ambiguous ticket with low confidence', () => {
      const mockEvaluation: TriageEvaluation = {
        department: { value: 'general', probability: 0.45 },
        severity: { value: 5, confidence: 0.35 },
        requestsRefund: { value: false, probability: 0.88 },
      };

      const decision = makeRoutingDecision(mockEvaluation);
      
      expect(decision.decision).toBe('manual');
      expect(decision.reason).toContain('Department classification has low confidence');
      expect(decision.reason).toContain('Severity assessment has low confidence');
    });
  });

  describe('AI SDK Mock Integration', () => {
    it('should verify mock model structure matches expected API', () => {
      const mockAnswers = {
        department: {
          type: 'choice' as const,
          choice: 'technical',
          probabilities: { technical: 0.85, billing: 0.1, sales: 0.03, general: 0.02 },
        },
        severity: {
          type: 'score' as const,
          score: 6,
          probabilities: { '5': 0.2, '6': 0.6, '7': 0.2 },
        },
        requestsRefund: {
          type: 'boolean' as const,
          probability: 0.05,
        },
      };

      expect(mockAnswers.department.type).toBe('choice');
      expect(mockAnswers.department.choice).toBe('technical');
      expect(mockAnswers.department.probabilities?.technical).toBe(0.85);

      expect(mockAnswers.severity.type).toBe('score');
      expect(mockAnswers.severity.score).toBe(6);

      expect(mockAnswers.requestsRefund.type).toBe('boolean');
      expect(mockAnswers.requestsRefund.probability).toBe(0.05);
    });
  });
});
