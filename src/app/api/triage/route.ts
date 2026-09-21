import { NextRequest, NextResponse } from 'next/server';
import { experimental_evaluate as evaluate } from 'ai';
import { evaluateTicket, makeRoutingDecision } from '@/lib/triage';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.AI_GATEWAY_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'AI_GATEWAY_API_KEY environment variable is not set. Please configure your Vercel AI Gateway connection token.' 
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { subject, message, plan } = body;

    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Subject and message are required' },
        { status: 400 }
      );
    }

    const ticketText = `Subject: ${subject}\n\nMessage: ${message}${plan ? `\n\nCustomer Plan: ${plan}` : ''}`;

    const result = await evaluateTicket(ticketText, apiKey);
    const routing = makeRoutingDecision(result);

    return NextResponse.json({
      department: result.department,
      severity: result.severity,
      requestsRefund: result.requestsRefund,
      routing,
    });
  } catch (error) {
    console.error('Triage error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to triage ticket' 
      },
      { status: 500 }
    );
  }
}
