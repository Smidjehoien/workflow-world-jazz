import { FatalError } from '@vercel/workflow-core';
import {
  convertToModelMessages,
  type FinishReason,
  type ModelMessage,
  stepCountIs,
  streamText,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import { z } from 'zod';

const MAX_STEPS = 10;

// Mock flight data
const mockFlights = [
  {
    flightNumber: 'UA123',
    from: 'SFO',
    to: 'LAX',
    departure: '2024-03-15T10:00:00',
    arrival: '2024-03-15T11:30:00',
    price: 250,
    airline: 'United Airlines',
    status: 'On Time',
  },
  {
    flightNumber: 'AA456',
    from: 'JFK',
    to: 'MIA',
    departure: '2024-03-15T14:00:00',
    arrival: '2024-03-15T17:30:00',
    price: 350,
    airline: 'American Airlines',
    status: 'On Time',
  },
  {
    flightNumber: 'DL789',
    from: 'ATL',
    to: 'ORD',
    departure: '2024-03-15T08:00:00',
    arrival: '2024-03-15T09:30:00',
    price: 180,
    airline: 'Delta Airlines',
    status: 'Delayed',
  },
];

const mockAirports: Record<
  string,
  { name: string; city: string; timezone: string }
> = {
  SFO: {
    name: 'San Francisco International Airport',
    city: 'San Francisco',
    timezone: 'PST',
  },
  LAX: {
    name: 'Los Angeles International Airport',
    city: 'Los Angeles',
    timezone: 'PST',
  },
  JFK: {
    name: 'John F. Kennedy International Airport',
    city: 'New York',
    timezone: 'EST',
  },
  MIA: { name: 'Miami International Airport', city: 'Miami', timezone: 'EST' },
  ATL: {
    name: 'Hartsfield-Jackson Atlanta International Airport',
    city: 'Atlanta',
    timezone: 'EST',
  },
  ORD: {
    name: "O'Hare International Airport",
    city: 'Chicago',
    timezone: 'CST',
  },
};

/** Search for available flights */
async function searchFlights({
  from,
  to,
  date,
}: {
  from: string;
  to: string;
  date: string;
}) {
  'use step';

  console.log(`Searching flights from ${from} to ${to} on ${date}`);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Filter mock flights based on criteria
  const results = mockFlights.filter(
    (flight) =>
      flight.from.toLowerCase().includes(from.toLowerCase()) ||
      flight.to.toLowerCase().includes(to.toLowerCase())
  );

  if (results.length === 0) {
    return {
      message: `No flights found from ${from} to ${to} on ${date}`,
      flights: [],
    };
  }

  return {
    message: `Found ${results.length} flights`,
    flights: results,
  };
}

/** Check flight status */
async function checkFlightStatus({ flightNumber }: { flightNumber: string }) {
  'use step';

  console.log(`Checking status for flight ${flightNumber}`);

  // 10% chance of error to demonstrate retry
  if (Math.random() < 0.1) {
    throw new Error('Flight status service temporarily unavailable');
  }

  const flight = mockFlights.find(
    (f) => f.flightNumber.toLowerCase() === flightNumber.toLowerCase()
  );

  if (!flight) {
    throw new FatalError(`Flight ${flightNumber} not found in our system`);
  }

  return {
    flightNumber: flight.flightNumber,
    status: flight.status,
    departure: flight.departure,
    arrival: flight.arrival,
    from: flight.from,
    to: flight.to,
    airline: flight.airline,
    gate:
      Math.random() < 0.5 ? `B${Math.floor(Math.random() * 20) + 1}` : 'TBD',
  };
}

/** Get airport information */
async function getAirportInfo({ airportCode }: { airportCode: string }) {
  'use step';

  console.log(`Getting information for airport ${airportCode}`);

  const airport = mockAirports[airportCode.toUpperCase()];

  if (!airport) {
    return {
      error: `Airport code ${airportCode} not found`,
      suggestion: `Try one of these: ${Object.keys(mockAirports).join(', ')}`,
    };
  }

  return {
    code: airportCode.toUpperCase(),
    ...airport,
    terminals: Math.floor(Math.random() * 4) + 1,
    averageDelay: `${Math.floor(Math.random() * 30)} minutes`,
  };
}

/** Book a flight (mock) */
async function bookFlight({
  flightNumber,
  passengerName,
  seatPreference,
}: {
  flightNumber: string;
  passengerName: string;
  seatPreference?: string;
}) {
  'use step';

  console.log(`Booking flight ${flightNumber} for ${passengerName}`);

  // Simulate processing
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 5% chance of seat unavailable
  if (Math.random() < 0.05) {
    throw new FatalError(
      'Selected seat preference not available. Please try a different preference.'
    );
  }

  const confirmationNumber = `BK${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const seatNumber =
    seatPreference === 'window'
      ? `${Math.floor(Math.random() * 30) + 1}A`
      : seatPreference === 'aisle'
        ? `${Math.floor(Math.random() * 30) + 1}C`
        : `${Math.floor(Math.random() * 30) + 1}B`;

  return {
    success: true,
    confirmationNumber,
    passengerName,
    flightNumber,
    seatNumber,
    message: 'Flight booked successfully! Check your email for confirmation.',
  };
}

/** Check baggage allowance */
async function checkBaggageAllowance({
  airline,
  ticketClass,
}: {
  airline: string;
  ticketClass: string;
}) {
  'use step';

  console.log(`Checking baggage allowance for ${airline} ${ticketClass} class`);

  const allowances = {
    economy: { carryOn: 1, checked: 1, maxWeight: '50 lbs' },
    business: { carryOn: 2, checked: 2, maxWeight: '70 lbs' },
    first: { carryOn: 2, checked: 3, maxWeight: '70 lbs' },
  };

  const classKey = ticketClass.toLowerCase() as keyof typeof allowances;
  const allowance = allowances[classKey] || allowances.economy;

  return {
    airline,
    class: ticketClass,
    carryOnBags: allowance.carryOn,
    checkedBags: allowance.checked,
    maxWeightPerBag: allowance.maxWeight,
    oversizeFee: '$150 per bag',
  };
}

/** A Stream Text Step */
export async function streamTextStep(
  messages: ModelMessage[],
  executeSteps: boolean,
  writeable: WritableStream<UIMessageChunk>
) {
  'use step';

  const result = streamText({
    model: 'bedrock/claude-4-sonnet-20250514-v1',
    messages,
    system: `You are a helpful flight booking assistant. You can help users:
- Search for flights between cities
- Check flight status
- Get airport information
- Book flights
- Check baggage allowances

Be friendly and professional. When searching for flights, always ask for travel dates if not provided.
When booking flights, confirm all details before proceeding.`,
    // We'll handle the back and forth ourselves
    stopWhen: stepCountIs(1),
    tools: {
      searchFlights: {
        description:
          'Search for available flights between two cities on a specific date',
        inputSchema: z.object({
          from: z.string().describe('Departure city or airport code'),
          to: z.string().describe('Arrival city or airport code'),
          date: z.string().describe('Travel date in YYYY-MM-DD format'),
        }),
        ...(executeSteps ? { execute: searchFlights } : {}),
      },
      checkFlightStatus: {
        description: 'Check the current status of a specific flight',
        inputSchema: z.object({
          flightNumber: z.string().describe('Flight number (e.g., UA123)'),
        }),
        ...(executeSteps ? { execute: checkFlightStatus } : {}),
      },
      getAirportInfo: {
        description: 'Get information about a specific airport',
        inputSchema: z.object({
          airportCode: z.string().describe('3-letter airport code (e.g., LAX)'),
        }),
        ...(executeSteps ? { execute: getAirportInfo } : {}),
      },
      bookFlight: {
        description: 'Book a flight for a passenger',
        inputSchema: z.object({
          flightNumber: z.string().describe('Flight number to book'),
          passengerName: z.string().describe('Full name of the passenger'),
          seatPreference: z
            .string()
            .optional()
            .describe('Seat preference: window, aisle, or middle'),
        }),
        ...(executeSteps ? { execute: bookFlight } : {}),
      },
      checkBaggageAllowance: {
        description:
          'Check baggage allowance for a specific airline and ticket class',
        inputSchema: z.object({
          airline: z.string().describe('Name of the airline'),
          ticketClass: z
            .string()
            .describe('Ticket class: economy, business, or first'),
        }),
        ...(executeSteps ? { execute: checkBaggageAllowance } : {}),
      },
    },

    headers: {
      'anthropic-beta': 'interleaved-thinking-2025-05-14',
    },
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 16000 },
      },
    },
  });

  // Pipe the stream to the client
  const writer = writeable.getWriter();
  const reader = result
    // We send these chunks outside the loop
    .toUIMessageStream({ sendStart: false, sendFinish: false })
    .getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);

      // LOCAL HACK to force chunk to be sent
      // if (writer.ready) {
      //   await writer.ready;
      // }
    }
  } finally {
    reader.releaseLock();
    writer.releaseLock();
  }

  return {
    messages: (await result.response).messages,
    finishReason: await result.finishReason,
    text: await result.text,
  };
  // return result;
}

export async function startStream(writeable: WritableStream<UIMessageChunk>) {
  'use step';
  const writer = writeable.getWriter();

  writer.write({
    type: 'start',
  });

  writer.releaseLock(); // likely not needed
}

export async function endStream(writeable: WritableStream<UIMessageChunk>) {
  'use step';
  const writer = writeable.getWriter();

  writer.write({
    type: 'finish',
  });

  writer.close();
  writer.releaseLock(); // likely not needed
}

export async function chat(
  messages: UIMessage[],
  writeable: WritableStream<UIMessageChunk>
) {
  'use workflow';

  const currMessages: ModelMessage[] = convertToModelMessages(messages);
  let finishReason: FinishReason = 'unknown';
  let text: string = '';

  // send the start message
  await startStream(writeable);

  for (let i = 0; i < MAX_STEPS; i++) {
    console.log('STEP', i + 1);
    // console.log('currMessages', JSON.stringify(currMessages, null, 2));

    const result = await streamTextStep(
      currMessages,
      true,
      // finishReason === 'tool-calls', // only
      writeable
    );

    currMessages.push(...result.messages);
    finishReason = result.finishReason;
    text = result.text;

    console.log('finishReason', finishReason);
    // console.log('text', text);

    if (finishReason !== 'tool-calls') {
      break;
    }
  }

  console.log('FINISHED');
  console.log('FINAL TEXT', text);

  await endStream(writeable);

  return 'Workflow finished';
}
