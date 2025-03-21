import { convertToCoreMessages, Message, streamText } from "ai";
import { z } from "zod";

import { geminiProModel } from "@/ai";
import {
  generateReservationPrice,
  generateSampleFlightSearchResults,
  generateSampleFlightStatus,
  generateSampleSeatSelection,
} from "@/ai/actions";
import { auth } from "@/app/(auth)/auth";
import {
  createReservation,
  deleteChatById,
  getChatById,
  getReservationById,
  saveChat,
} from "@/db/queries";
import { generateUUID } from "@/lib/utils";

export async function POST(request: Request) {
  const { id, messages, systemPrompt }: { 
    id: string; 
    messages: Array<Message>;
    systemPrompt?: string;
  } = await request.json();

  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const coreMessages = convertToCoreMessages(messages).filter(
    (message) => message.content.length > 0,
  );

  const result = await streamText({
    model: geminiProModel,
    system: systemPrompt || `\n
        - you help users book flights!
        - keep your responses limited to a sentence.
        - DO NOT output lists.
        - after every tool call, pretend you're showing the result to the user and keep your response limited to a phrase.
        - today's date is ${new Date().toLocaleDateString()}.
        - ask follow up questions to nudge user into the optimal flow
        - ask for any details you don't know, like name of passenger, etc.'
        - C and D are aisle seats, A and F are window seats, B and E are middle seats
        - assume the most popular airports for the origin and destination
        - here's the optimal flow
          - search for flights
          - choose flight
          - select seats
          - create reservation (ask user whether to proceed with payment or change reservation)
          - authorize payment (requires user consent, wait for user to finish payment and let you know when done)
          - display boarding pass (DO NOT display boarding pass without verifying payment)
        '
      `,
    messages: coreMessages,
    tools: {
      getWeather: {
        description: "Get the current weather at a location",
        parameters: z.object({
          latitude: z.number().describe("Latitude coordinate"),
          longitude: z.number().describe("Longitude coordinate"),
        }),
        execute: async ({ latitude, longitude }) => {
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
          );

          const weatherData = await response.json();
          return weatherData;
        },
      },
      displayFlightStatus: {
        description: "Display the status of a flight",
        parameters: z.object({
          flightNumber: z.string().describe("Flight number"),
          date: z.string().describe("Date of the flight"),
        }),
        execute: async ({ flightNumber, date }) => {
          const flightStatus = await generateSampleFlightStatus({
            flightNumber,
            date,
          });

          return flightStatus;
        },
      },
      searchFlights: {
        description: "Search for flights based on the given parameters",
        parameters: z.object({
          origin: z.string().describe("Origin airport or city"),
          destination: z.string().describe("Destination airport or city"),
        }),
        execute: async ({ origin, destination }) => {
          const results = await generateSampleFlightSearchResults({
            origin,
            destination,
          });

          return results;
        },
      },
      selectSeats: {
        description: "Select seats for a flight",
        parameters: z.object({
          flightNumber: z.string().describe("Flight number"),
        }),
        execute: async ({ flightNumber }) => {
          const seats = await generateSampleSeatSelection({ flightNumber });
          return seats;
        },
      },
      createReservation: {
        description: "Display pending reservation details",
        parameters: z.object({
          seats: z.string().array().describe("Array of selected seat numbers"),
          flightNumber: z.string().describe("Flight number"),
          departure: z.object({
            cityName: z.string().describe("Name of the departure city"),
            airportCode: z.string().describe("Code of the departure airport"),
            timestamp: z.string().describe("ISO 8601 date of departure"),
            gate: z.string().describe("Departure gate"),
            terminal: z.string().describe("Departure terminal"),
          }),
          arrival: z.object({
            cityName: z.string().describe("Name of the arrival city"),
            airportCode: z.string().describe("Code of the arrival airport"),
            timestamp: z.string().describe("ISO 8601 date of arrival"),
            gate: z.string().describe("Arrival gate"),
            terminal: z.string().describe("Arrival terminal"),
          }),
          passengerName: z.string().describe("Name of the passenger"),
        }),
        execute: async (props) => {
          const { totalPriceInUSD } = await generateReservationPrice(props);
          const session = await auth();

          const id = generateUUID();

          if (session && session.user && session.user.id) {
            await createReservation({
              id,
              userId: session.user.id,
              details: { ...props, totalPriceInUSD },
            });

            return { id, ...props, totalPriceInUSD };
          } else {
            return {
              error: "User is not signed in to perform this action!",
            };
          }
        },
      },
      authorizePayment: {
        description:
          "User will enter credentials to authorize payment, wait for user to repond when they are done",
        parameters: z.object({
          reservationId: z
            .string()
            .describe("Unique identifier for the reservation"),
        }),
        execute: async ({ reservationId }) => {
          return { reservationId };
        },
      },
      verifyPayment: {
        description: "Verify payment status",
        parameters: z.object({
          reservationId: z
            .string()
            .describe("Unique identifier for the reservation"),
        }),
        execute: async ({ reservationId }) => {
          const reservation = await getReservationById({ id: reservationId });

          if (reservation.hasCompletedPayment) {
            return { hasCompletedPayment: true };
          } else {
            return { hasCompletedPayment: false };
          }
        },
      },
      displayBoardingPass: {
        description: "Display a boarding pass",
        parameters: z.object({
          reservationId: z
            .string()
            .describe("Unique identifier for the reservation"),
          passengerName: z
            .string()
            .describe("Name of the passenger, in title case"),
          flightNumber: z.string().describe("Flight number"),
          seat: z.string().describe("Seat number"),
          departure: z.object({
            cityName: z.string().describe("Name of the departure city"),
            airportCode: z.string().describe("Code of the departure airport"),
            airportName: z.string().describe("Name of the departure airport"),
            timestamp: z.string().describe("ISO 8601 date of departure"),
            terminal: z.string().describe("Departure terminal"),
            gate: z.string().describe("Departure gate"),
          }),
          arrival: z.object({
            cityName: z.string().describe("Name of the arrival city"),
            airportCode: z.string().describe("Code of the arrival airport"),
            airportName: z.string().describe("Name of the arrival airport"),
            timestamp: z.string().describe("ISO 8601 date of arrival"),
            terminal: z.string().describe("Arrival terminal"),
            gate: z.string().describe("Arrival gate"),
          }),
        }),
        execute: async (boardingPass) => {
          return boardingPass;
        },
      },
      analyzeURL: {
        description: "Analyze the content of a webpage URL(s) and provide insights",
        parameters: z.object({
          url: z.string().describe("The URL(s) to analyze"),
        }),
        execute: async ({ url }) => {
          try {
            const response = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`);
            
            if (!response.ok) {
              throw new Error('Failed to fetch URL content');
            }

            const content = await response.text();
            
            // Pass content to LLM but don't send it to client
            return {
              url,
              status: 'success',
              // The LLM will use this content for analysis but we don't need to expose it in the UI
              _rawContent: content
            };
          } catch (error) {
            return {
              error: "Failed to analyze URL",
              status: 'error',
              details: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        },
      },
      performSearch: {
        description: "Search the web for information using Tavily",
        parameters: z.object({
          query: z.string().describe("The search query"),
          numResults: z.number().optional().describe("Number of results to return (default: 5)"),
          category: z.string().optional().describe("Optional category for search (general, tech, finance, etc.)"),
        }),
        execute: async ({ query, numResults = 5, category = "general" }) => {
          try {
            const tavilyToken = process.env.TAVILY_TOKEN;
            
            if (!tavilyToken) {
              throw new Error("Tavily API token not configured");
            }
            
            const searchOptions = {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${tavilyToken}`, 
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                query,
                topic: category,
                search_depth: "basic",
                max_results: numResults,
                include_answer: false,
                include_raw_content: false
              })
            };
            
            const response = await fetch('https://api.tavily.com/search', searchOptions);
            
            if (!response.ok) {
              throw new Error(`Search request failed with status ${response.status}`);
            }
            
            const data = await response.json();
            
            // Format the results to be more useful for the AI
            const formattedResults = {
              query,
              results: data.results?.slice(0, numResults).map((result: {
                title: string;
                url: string;
                content: string;
                score: number;
              }) => ({
                title: result.title,
                url: result.url,
                content: result.content,
                score: result.score
              })) || [],
              responseTime: data.response_time
            };
            
            return formattedResults;
          } catch (error) {
            console.error("Search error:", error);
            return {
              error: "Failed to perform search",
              status: 'error',
              details: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        },
      },
      simpleDeepResearch: {
        description: "Perform deep research by searching and analyzing top results",
        parameters: z.object({
          query: z.string().describe("The research query"),
          depth: z.string().optional().describe("Depth of search (default: basic)"),
        }),
        execute: async ({ query, depth = "basic" }) => {
          console.log(`[TOOL START] simpleDeepResearch initiated with query: "${query}"`);
          console.log(`[TOOL CONFIG] depth: ${depth}`);
          
          try {
            const tavilyToken = process.env.TAVILY_TOKEN;
            
            if (!tavilyToken) {
              console.error(`[TOOL ERROR] Tavily API token not configured`);
              throw new Error("Tavily API token not configured");
            }
            
            console.log(`[SEARCH] Sending request to Tavily API...`);
            const searchOptions = {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${tavilyToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                query: query,
                search_depth: depth,
                max_results: 10,
                include_answer: true,
                include_raw_content: false
              })
            };
            
            const searchResponse = await fetch('https://api.tavily.com/search', searchOptions);
            
            if (!searchResponse.ok) {
              console.error(`[SEARCH] Failed with status ${searchResponse.status}: ${searchResponse.statusText}`);
              throw new Error(`Search request failed with status ${searchResponse.status}`);
            }
            
            console.log(`[SEARCH] Received response from Tavily API`);
            const searchData = await searchResponse.json();
            console.log(`[SEARCH] Got ${searchData.results?.length || 0} results`);
            
            // Process the results
            const sources = (searchData.results || []).map((result: {
              title: string;
              url: string;
              content: string;
            }) => ({
              title: result.title,
              url: result.url,
              content: result.content,
            }));
            
            console.log(`[TOOL COMPLETE] simpleDeepResearch finished successfully`);
            return {
              answer: searchData.answer,
              sources: sources,
              message: `Research completed for: "${query}"`,
              query: query
            };
            
          } catch (error) {
            console.error(`[TOOL ERROR] Simple research error:`, error);
            console.error(`[TOOL ERROR] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
            return {
              error: "Failed to perform research",
              status: 'error',
              details: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        },
      },
      advancedDeepResearch: {
        description: "Perform multi-step deep research by executing multiple searches based on your research plan and synthesizing findings",
        parameters: z.object({
          query: z.string().describe("The main research question"),
          researchPlan: z.object({
            subQuestions: z.array(z.string()).describe("List of specific sub-questions to search for (3-5 recommended)"),
            rationale: z.string().optional().describe("Optional explanation of the research approach")
          }).describe("Your research plan with targeted sub-questions"),
          maxSearches: z.number().optional().describe("Maximum number of search queries to perform (default: 5)"),
          includeDetails: z.boolean().optional().describe("Whether to include detailed research process in output (default: false)"),
        }),
        execute: async ({ query, researchPlan, maxSearches = 5, includeDetails = false }) => {
          console.log(`[TOOL START] advancedDeepResearch initiated with query: "${query}"`);
          console.log(`[TOOL CONFIG] maxSearches: ${maxSearches}, includeDetails: ${includeDetails}`);
          console.log(`[RESEARCH PLAN] Sub-questions: ${JSON.stringify(researchPlan.subQuestions)}`);
          if (researchPlan.rationale) console.log(`[RESEARCH PLAN] Rationale: ${researchPlan.rationale}`);
          
          try {
            const tavilyToken = process.env.TAVILY_TOKEN;
            
            if (!tavilyToken) {
              console.error(`[TOOL ERROR] Tavily API token not configured`);
              throw new Error("Tavily API token not configured");
            }
            
            // Get sub-questions from the research plan provided by the LLM
            const subQuestions = researchPlan.subQuestions.slice(0, maxSearches);
            console.log(`[RESEARCH] Will process ${subQuestions.length} sub-questions`);
            
            // Execute searches for each sub-question
            const researchResults = [];
            const allSearchResults = [];
            
            for (let i = 0; i < subQuestions.length; i++) {
              const question = subQuestions[i];
              console.log(`[SEARCH ${i+1}/${subQuestions.length}] Querying: "${question}"`);
              
              const searchOptions = {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${tavilyToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  query: question,
                  search_depth: "advanced",
                  max_results: 3,
                  include_answer: true,
                  include_raw_content: true
                })
              };
              
              console.log(`[SEARCH ${i+1}] Sending request to Tavily API...`);
              const searchResponse = await fetch('https://api.tavily.com/search', searchOptions);
              
              if (!searchResponse.ok) {
                console.error(`[SEARCH ${i+1}] Failed with status ${searchResponse.status}: ${searchResponse.statusText}`);
                continue; // Skip this question if search fails
              }
              
              console.log(`[SEARCH ${i+1}] Received response from Tavily API`);
              const searchData = await searchResponse.json();
              console.log(`[SEARCH ${i+1}] Got ${searchData.results?.length || 0} results`);
              
              researchResults.push({
                question,
                answer: searchData.answer,
                sources: searchData.results?.slice(0, 3).map((result: { 
                  title: string;
                  url: string;
                  content: string;
                }) => ({
                  title: result.title,
                  url: result.url,
                  content: result.content
                })) || []
              });
              
              // Add to full results collection
              if (searchData.results) {
                allSearchResults.push(...searchData.results.slice(0, 3));
              }
            }
            
            console.log(`[RESEARCH] Completed all searches. Compiling results...`);
            console.log(`[RESEARCH] Total sources gathered: ${allSearchResults.length}`);
            
            // Compile and return results
            const result = {
              query,
              plan: {
                subQuestions,
                rationale: researchPlan.rationale || `Research plan for: ${query}`
              },
              findings: researchResults,
              // Only include detailed results if requested
              allSources: includeDetails ? allSearchResults.map((result: {
                title: string;
                url: string;
                content: string;
                raw_content?: string;
              }) => ({
                title: result.title,
                url: result.url,
                content: result.content,
                fullContent: includeDetails ? (result.raw_content || null) : null
              })) : undefined,
              queriesUsed: subQuestions.length,
              message: `Completed ${subQuestions.length} research queries on "${query}"`
            };
            
            console.log(`[TOOL COMPLETE] advancedDeepResearch finished successfully`);
            return result;
            
          } catch (error) {
            console.error(`[TOOL ERROR] Advanced research error:`, error);
            console.error(`[TOOL ERROR] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
            return {
              error: "Failed to perform advanced research",
              status: 'error',
              details: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        },
      },
    },
    onFinish: async ({ responseMessages }) => {
      if (session.user && session.user.id) {
        try {
          await saveChat({
            id,
            messages: [...coreMessages, ...responseMessages],
            userId: session.user.id,
          });
        } catch (error) {
          console.error("Failed to save chat");
        }
      }
    },
    experimental_telemetry: {
      isEnabled: true,
      functionId: "stream-text",
    },
  });

  return result.toDataStreamResponse({});
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch (error) {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}
