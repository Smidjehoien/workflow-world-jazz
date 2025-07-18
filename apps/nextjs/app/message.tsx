import type { ChatStatus } from 'ai';
import type { MyUIMessage } from '@/util/chat-schema';

export default function Message({
  message,
  status,
  regenerate,
  sendMessage,
  addToolResult,
}: {
  status: ChatStatus;
  message: MyUIMessage;
  regenerate: ({ messageId }: { messageId: string }) => void;
  sendMessage: ({
    text,
    messageId,
  }: {
    text: string;
    messageId?: string;
  }) => void;
  addToolResult: ({
    toolCallId,
    output,
  }: {
    toolCallId: string;
    output: string;
  }) => void;
}) {
  const date = message.metadata?.createdAt
    ? new Date(message.metadata.createdAt).toLocaleString()
    : '';
  const isUser = message.role === 'user';

  return (
    <div
      className={`whitespace-pre-wrap my-2 p-3 rounded-lg shadow
        ${isUser ? 'bg-blue-100 text-right ml-10' : 'bg-gray-100 text-left mr-10'}`}
    >
      <div className="mb-1 text-xs text-gray-500">{date}</div>
      <div className="font-semibold">{isUser ? 'User:' : 'AI:'}</div>
      <div>
        {/* {message.parts
          .map((part) => (part.type === 'text' ? part.text : ''))
          .join('')} */}
        {message.parts.map((part) => {
          switch (part.type) {
            // render text parts as simple text:
            case 'text':
              return part.text;

            // Search Flights Tool
            case 'tool-searchFlights': {
              const callId = part.toolCallId;

              switch (part.state) {
                case 'input-streaming':
                  return (
                    <div
                      key={callId}
                      className="my-2 p-3 bg-blue-50 rounded-md"
                    >
                      <div className="flex items-center gap-2">
                        <span className="animate-spin">🔍</span>
                        <span className="text-sm">
                          Searching for flights...
                        </span>
                      </div>
                    </div>
                  );
                case 'input-available':
                  if (!part.input) return null;
                  return (
                    <div
                      key={callId}
                      className="my-2 p-3 bg-blue-50 rounded-md"
                    >
                      <div className="text-sm font-medium mb-1">
                        ✈️ Searching flights
                      </div>
                      <div className="text-xs text-gray-600">
                        From: {(part.input as any).from} → To:{' '}
                        {(part.input as any).to}
                        <br />
                        Date: {(part.input as any).date}
                      </div>
                    </div>
                  );
                case 'output-available': {
                  const flights = (part.output as any).flights || [];
                  return (
                    <div
                      key={callId}
                      className="my-2 p-3 bg-green-50 rounded-md"
                    >
                      <div className="text-sm font-medium mb-2">
                        ✅ {(part.output as any).message}
                      </div>
                      {flights.map(
                        (flight: any, idx: number) =>
                          flight && (
                            <div
                              key={idx}
                              className="text-xs border-t pt-2 mt-2"
                            >
                              <div className="font-medium">
                                {flight.airline} - {flight.flightNumber}
                              </div>
                              <div>
                                Route: {flight.from} → {flight.to}
                              </div>
                              <div>
                                Departure:{' '}
                                {new Date(flight.departure).toLocaleString()}
                              </div>
                              <div>
                                Status:{' '}
                                <span
                                  className={
                                    flight.status === 'On Time'
                                      ? 'text-green-600'
                                      : 'text-orange-600'
                                  }
                                >
                                  {flight.status}
                                </span>
                              </div>
                              <div>Price: ${flight.price}</div>
                            </div>
                          )
                      )}
                    </div>
                  );
                }
                case 'output-error':
                  return (
                    <div key={callId} className="my-2 p-3 bg-red-50 rounded-md">
                      <div className="text-sm text-red-600">
                        ❌ Error: {part.errorText}
                      </div>
                    </div>
                  );
              }
              break;
            }

            // Check Flight Status Tool
            case 'tool-checkFlightStatus': {
              const callId = part.toolCallId;

              switch (part.state) {
                case 'input-streaming':
                case 'input-available':
                  if (!part.input) return null;
                  return (
                    <div
                      key={callId}
                      className="my-2 p-3 bg-blue-50 rounded-md"
                    >
                      <div className="text-sm">
                        📊 Checking status for flight{' '}
                        {(part.input as any).flightNumber}...
                      </div>
                    </div>
                  );
                case 'output-available': {
                  const status = part.output as any;
                  if (!status) return null;

                  return (
                    <div
                      key={callId}
                      className="my-2 p-3 bg-green-50 rounded-md"
                    >
                      <div className="text-sm font-medium mb-2">
                        Flight Status - {status.flightNumber}
                      </div>
                      <div className="text-xs space-y-1">
                        <div>
                          Status:{' '}
                          <span
                            className={
                              status.status === 'On Time'
                                ? 'text-green-600 font-medium'
                                : 'text-orange-600 font-medium'
                            }
                          >
                            {status.status}
                          </span>
                        </div>
                        <div>
                          Route: {status.from} → {status.to}
                        </div>
                        <div>Airline: {status.airline}</div>
                        <div>
                          Departure:{' '}
                          {new Date(status.departure).toLocaleString()}
                        </div>
                        <div>
                          Arrival: {new Date(status.arrival).toLocaleString()}
                        </div>
                        <div>Gate: {status.gate}</div>
                      </div>
                    </div>
                  );
                }
                case 'output-error':
                  return (
                    <div key={callId} className="my-2 p-3 bg-red-50 rounded-md">
                      <div className="text-sm text-red-600">
                        ❌ {part.errorText}
                      </div>
                    </div>
                  );
              }
              break;
            }

            // Get Airport Info Tool
            case 'tool-getAirportInfo': {
              const callId = part.toolCallId;

              switch (part.state) {
                case 'input-streaming':
                case 'input-available':
                  if (!part.input) {
                    return null;
                  }
                  return (
                    <div
                      key={callId}
                      className="my-2 p-3 bg-blue-50 rounded-md"
                    >
                      <div className="text-sm">
                        🛫 Getting information for{' '}
                        {(part.input as any).airportCode}...
                      </div>
                    </div>
                  );
                case 'output-available': {
                  const airport = part.output as any;
                  if (airport.error) {
                    return (
                      <div
                        key={callId}
                        className="my-2 p-3 bg-yellow-50 rounded-md"
                      >
                        <div className="text-sm">{airport.error}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {airport.suggestion}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={callId}
                      className="my-2 p-3 bg-green-50 rounded-md"
                    >
                      <div className="text-sm font-medium mb-2">
                        {airport.code} - {airport.name}
                      </div>
                      <div className="text-xs space-y-1">
                        <div>City: {airport.city}</div>
                        <div>Timezone: {airport.timezone}</div>
                        <div>Terminals: {airport.terminals}</div>
                        <div>Average Delay: {airport.averageDelay}</div>
                      </div>
                    </div>
                  );
                }
                case 'output-error':
                  return (
                    <div key={callId} className="my-2 p-3 bg-red-50 rounded-md">
                      <div className="text-sm text-red-600">
                        ❌ Error: {part.errorText}
                      </div>
                    </div>
                  );
              }
              break;
            }

            // Book Flight Tool
            case 'tool-bookFlight': {
              const callId = part.toolCallId;

              switch (part.state) {
                case 'input-streaming':
                case 'input-available':
                  if (!part.input) return null;
                  return (
                    <div
                      key={callId}
                      className="my-2 p-3 bg-blue-50 rounded-md"
                    >
                      <div className="text-sm">
                        🎫 Booking flight {(part.input as any).flightNumber} for{' '}
                        {(part.input as any).passengerName}...
                      </div>
                    </div>
                  );
                case 'output-available': {
                  const booking = part.output as any;
                  if (!booking) return null;
                  return (
                    <div
                      key={callId}
                      className="my-2 p-3 bg-green-50 rounded-md"
                    >
                      <div className="text-sm font-medium mb-2">
                        ✅ Booking Confirmed!
                      </div>
                      <div className="text-xs space-y-1">
                        <div>
                          Confirmation #:{' '}
                          <span className="font-mono font-medium">
                            {booking.confirmationNumber}
                          </span>
                        </div>
                        <div>Passenger: {booking.passengerName}</div>
                        <div>Flight: {booking.flightNumber}</div>
                        <div>Seat: {booking.seatNumber}</div>
                        <div className="mt-2 text-gray-600">
                          {booking.message}
                        </div>
                      </div>
                    </div>
                  );
                }
                case 'output-error':
                  return (
                    <div key={callId} className="my-2 p-3 bg-red-50 rounded-md">
                      <div className="text-sm text-red-600">
                        ❌ Booking failed: {part.errorText}
                      </div>
                    </div>
                  );
              }
              break;
            }

            // Check Baggage Allowance Tool
            case 'tool-checkBaggageAllowance': {
              const callId = part.toolCallId;

              switch (part.state) {
                case 'input-streaming':
                case 'input-available':
                  if (!part.input) return null;
                  return (
                    <div
                      key={callId}
                      className="my-2 p-3 bg-blue-50 rounded-md"
                    >
                      <div className="text-sm">
                        🧳 Checking baggage allowance for{' '}
                        {(part.input as any).airline}{' '}
                        {(part.input as any).ticketClass} class...
                      </div>
                    </div>
                  );
                case 'output-available': {
                  const baggage = part.output as any;
                  return (
                    <div
                      key={callId}
                      className="my-2 p-3 bg-green-50 rounded-md"
                    >
                      <div className="text-sm font-medium mb-2">
                        Baggage Allowance - {baggage.airline}
                      </div>
                      <div className="text-xs space-y-1">
                        <div>Class: {baggage.class}</div>
                        <div>Carry-on bags: {baggage.carryOnBags}</div>
                        <div>Checked bags: {baggage.checkedBags}</div>
                        <div>Max weight per bag: {baggage.maxWeightPerBag}</div>
                        <div>Oversize fee: {baggage.oversizeFee}</div>
                      </div>
                    </div>
                  );
                }
                case 'output-error':
                  return (
                    <div key={callId} className="my-2 p-3 bg-red-50 rounded-md">
                      <div className="text-sm text-red-600">
                        ❌ Error: {part.errorText}
                      </div>
                    </div>
                  );
              }
              break;
            }

            // Legacy tool support (keep these for backwards compatibility)
            case 'tool-getLocation': {
              const callId = part.toolCallId;

              switch (part.state) {
                case 'input-streaming':
                  return <div key={callId}>Preparing location request...</div>;
                case 'input-available':
                  return <div key={callId}>Getting location...</div>;
                case 'output-available':
                  return (
                    <div key={callId}>Location: {part.output as string}</div>
                  );
                case 'output-error':
                  return (
                    <div key={callId}>
                      Error getting location: {part.errorText}
                    </div>
                  );
              }
              break;
            }

            case 'tool-getWeatherInformation': {
              const callId = part.toolCallId;

              switch (part.state) {
                // example of pre-rendering streaming tool inputs:
                case 'input-streaming':
                  return (
                    <pre key={callId}>{JSON.stringify(part, null, 2)}</pre>
                  );
                case 'input-available':
                  if (!part.input) return null;
                  return (
                    <div key={callId}>
                      Getting weather information for {(part.input as any).city}
                      ...
                    </div>
                  );
                case 'output-available':
                  if (!part.input) return null;
                  return (
                    <div key={callId}>
                      Weather in {(part.input as any).city}: {part.output}
                    </div>
                  );
                case 'output-error':
                  if (!part.input) return null;
                  return (
                    <div key={callId}>
                      Error getting weather for {(part.input as any).city}:{' '}
                      {part.errorText}
                    </div>
                  );
              }
              break;
            }

            case 'data-workflow': {
              const data = part.data as any;
              return (
                <div
                  className={`text-xs ${data.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}
                >
                  <i>[{data.message}]</i>
                </div>
              );
            }

            // default: {
            //   return (
            //     <div className="text-xs text-gray-400">
            //       <i>[debug: {part.type}]</i>
            //     </div>
            //   );
            // }
          }
        })}
      </div>
      {/* {message.role === 'user' && (
        <button
          type="button"
          onClick={() => regenerate({ messageId: message.id })}
          className="px-3 py-1 mt-2 text-sm transition-colors bg-gray-200 rounded-md hover:bg-gray-300"
          disabled={status !== 'ready'}
        >
          Regenerate
        </button>
      )} */}
    </div>
  );
}
