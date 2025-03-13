"use client";

import { Attachment, Message } from "ai";
import { useChat } from "ai/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect } from "react";

import { Message as PreviewMessage } from "@/components/custom/message";
import { useScrollToBottom } from "@/components/custom/use-scroll-to-bottom";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { MultimodalInput } from "./multimodal-input";
import { Overview } from "./overview";

const FLIGHTS_PROMPT = `
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
`;

const MARKETING_PROMPT = `
Act as my personal marketing marketing advisor with the following context:

You have an IQ of 180.
Brutally honest and direct in feedback.
Built high-growth marketing strategies for major brands.
Deep expertise in marketing psychology, strategy, and execution.
Deeply invested in my success, intolerant of excuses.
Focus on high-leverage marketing tactics for maximum ROI.
Systems-thinking focusing on root causes, not surface-level fixes.

Your marketing mission is to:
Identify critical marketing gaps hindering growth.
Design data-driven action plans to close those gaps.
Push me beyond my marketing comfort zone.
Call out marketing blind spots and rationalizations.
Challenge me to think bigger and bolder in marketing strategy.
Hold me accountable to high marketing standards and KPIs.
Provide proven marketing frameworks and mental models.

Tool usage:
- if user provides an URL for analysis, use analyzeURL tool
- if user asks for Deep Research, use simpleDeepResearch tool.
`;

const RESEARCH_PROMPT = `
Act as my advanced research assistant with the following capabilities:

- You excel at finding and analyzing information on any topic.
TOOL_PLACEHOLDER

- When analyzing information:
  * Be rationally critical and examine different viewpoints
  * Consider counterarguments with phrases like "However" or "On the other hand"
  * Assess the reliability of sources
  * Identify consensus views vs. minority positions

- When presenting research, provide:
  1. A concise executive summary of key findings
  2. Main supporting evidence and data points
  3. Different perspectives with fair representation
  4. Limitations of the current research
  5. Citations to sources using numbered references

- When citing sources:
  * Use numbered citations in square brackets (e.g., [1], [2]) within your text
  * Include a "Sources" section at the end with the full URLs in a numbered list
  * Example: "According to recent studies [1], the effect is significant..."
  * Then end with: "Sources: 1. https://example.com 2. https://anothersite.com"

- When uncertain, acknowledge limitations and suggest additional research areas.
- If a user provides URLs, analyze them with the analyzeURL tool.
- Prioritize recent information when temporal relevance matters.
- For follow-up questions, build on previously shared research context.

Your goal is to provide thorough, accurate, and well-organized research to help users understand complex topics.
`;

export function Chat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages: Array<Message>;
}) {
  const [mode, setMode] = useState<"flights" | "marketing" | "simpleResearch" | "advancedResearch">("flights");
  const [systemPrompt, setSystemPrompt] = useState(FLIGHTS_PROMPT);
  const [maxSearches, setMaxSearches] = useState<number>(5);
  const { messages, handleSubmit, input, setInput, append, isLoading, stop } =
    useChat({
      id,
      body: { id, systemPrompt },
      initialMessages,
      maxSteps: 10,
      onFinish: () => {
        window.history.replaceState({}, "", `/chat/${id}`);
      },
    });

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [isPromptVisible, setIsPromptVisible] = useState(true);

  const handleModeChange = (newMode: "flights" | "marketing" | "simpleResearch" | "advancedResearch") => {
    setMode(newMode);
    
    switch (newMode) {
      case "flights":
        setSystemPrompt(FLIGHTS_PROMPT);
        break;
      case "marketing":
        setSystemPrompt(MARKETING_PROMPT);
        break;
      case "simpleResearch":
        setSystemPrompt(RESEARCH_PROMPT.replace('TOOL_PLACEHOLDER', '- You use the simpleDeepResearch tool'));
        break;
      case "advancedResearch":
        setSystemPrompt(RESEARCH_PROMPT.replace('TOOL_PLACEHOLDER', `- You use the advancedDeepResearch tool with maxSearches=${maxSearches}`));
        break;
    }
  };

  useEffect(() => {
    if (mode === "advancedResearch") {
      setSystemPrompt(RESEARCH_PROMPT.replace('TOOL_PLACEHOLDER', `- You use the advancedDeepResearch tool with maxSearches=${maxSearches}`));
    }
  }, [maxSearches, mode]);

  return (
    <div className="flex flex-row justify-center pb-4 md:pb-8 h-dvh bg-background">
      <div className="flex flex-col justify-between items-center gap-4">
        <div className="w-full md:max-w-[800px] px-4 md:px-0 pt-4 mt-16">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">System Prompt</p>
              <button
                onClick={() => setIsPromptVisible(!isPromptVisible)}
                className="p-1 hover:bg-muted rounded-md transition-colors"
                aria-label={isPromptVisible ? "Hide prompt" : "Show prompt"}
              >
                {isPromptVisible ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <Label
                htmlFor="prompt-mode"
                className="text-sm text-muted-foreground"
              >
                AI Mode
              </Label>
              <Select
                value={mode}
                onValueChange={(value: "flights" | "marketing" | "simpleResearch" | "advancedResearch") => 
                  handleModeChange(value)
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flights">Flights Mode</SelectItem>
                  <SelectItem value="marketing">Marketing Mode</SelectItem>
                  <SelectItem value="simpleResearch">Simple Deep Research</SelectItem>
                  <SelectItem value="advancedResearch">Advanced Deep Research</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {mode === "advancedResearch" && (
            <div className="flex items-center justify-end space-x-2 my-2 pr-8">
              <Label
                htmlFor="max-searches"
                className="text-sm text-muted-foreground"
              >
                Max Searches
              </Label>
              <input
                id="max-searches"
                type="number"
                min="1"
                max="10"
                value={maxSearches}
                onChange={(e) => setMaxSearches(Number(e.target.value))}
                className="w-20 p-2 text-sm rounded-lg bg-muted/50 border border-zinc-200 dark:border-zinc-800"
              />
              <span className="text-xs text-muted-foreground">
                (1-10)
              </span>
            </div>
          )}
          
          {isPromptVisible && (
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter system prompt here..."
              className="w-full p-2 text-sm rounded-lg bg-muted/50 border border-zinc-200 dark:border-zinc-800 min-h-[200px] resize-none"
            />
          )}
        </div>

        <div
          ref={messagesContainerRef}
          className="flex flex-col gap-4 h-full w-dvw items-center overflow-y-scroll"
        >
          {/*           {messages.length === 0 && <Overview />} */}

          {messages.map((message) => (
            <PreviewMessage
              key={message.id}
              chatId={id}
              role={message.role}
              content={message.content}
              attachments={message.experimental_attachments}
              toolInvocations={message.toolInvocations}
            />
          ))}

          <div
            ref={messagesEndRef}
            className="shrink-0 min-w-[24px] min-h-[24px]"
          />
        </div>

        <form className="flex flex-row gap-2 relative items-end w-full min-w-[400px] md:max-w-[800px] max-w-[calc(100dvw-32px) px-4 md:px-0">
          <MultimodalInput
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            messages={messages}
            append={append}
          />
        </form>
      </div>
    </div>
  );
}
