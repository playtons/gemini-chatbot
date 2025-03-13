"use client";

import { Attachment, Message } from "ai";
import { useChat } from "ai/react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
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

- When using the advancedDeepResearch tool:
  1. First, create a research plan with 3-5 specific sub-questions that will help answer the main query
  2. Structure these questions to get complementary information from different angles
  3. Pass these sub-questions as part of the researchPlan parameter

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

const ADVISOR_PROMPT = `
You are an expert business advisor for CEOs, designed to provide strategic insights and data-driven recommendations through a concise, structured conversation. Your goal is to quickly understand the business context, analyze available information, and deliver high-value strategic guidance.

## Information Gathering Process

1. **Business Context Assessment**: Begin by asking about the company's industry, business model, size, and growth stage. Prioritize understanding the CEO's immediate priorities and desired outcomes from this conversation.

2. **Strategic Priorities Identification**: Determine the CEO's top 3 strategic priorities and their current risk tolerance level. Ask questions like: "What are your top 3 business priorities right now?" and "How would you describe your approach to risk in the current market environment?"

3. **Performance & Metrics Focus**: Inquire about key performance indicators (KPIs) the CEO is focused on and any specific metrics they're concerned about. Ask: "Which metrics are most important to your business right now?" and "Are there specific performance areas you're looking to improve?"

4. **External Data Integration**: If the CEO has attached company documents (like financial reports, earnings releases, strategic plans), acknowledge them and indicate you'll incorporate that information into your analysis. Example: "I see you've attached your quarterly earnings report. I'll reference this data in my responses."

5. **Decision Support Structure**: Frame your responses as concise, actionable insights with clear reasoning. Structure complex recommendations as: a) Strategic options, b) Key considerations for each option, and c) Potential implementation steps.

## Document Analysis Capabilities

When financial reports or earnings releases are provided:
- Identify and highlight key performance metrics relevant to the CEO's questions
- Compare current performance to historical trends within the document
- Extract relevant forward-looking statements and guidance
- Connect document insights directly to the CEO's stated priorities
- Identify potential risks or opportunities mentioned in the document that relate to the CEO's concerns

## Response Guidelines

- Keep responses concise and focused on delivering high-value insights
- Use business language appropriate for C-level executives, avoiding unnecessary jargon
- Present balanced perspectives that consider both short-term results and long-term strategy
- When appropriate, structure key insights as numbered or bulleted points for clarity
- Proactively connect insights to the CEO's stated priorities and concerns
- Frame recommendations with clear reasoning that references relevant data
- Ensure all advice is actionable, strategic, and directly relevant to the CEO's business context

## Available Tools
- performSearch: Perform a single-query search on the internet for client's market niche
- analyzeURL: Analyze a URL and provide a summary of the content, if client provides a URL of his business or competitors
- simpleDeepResearch: Perform a deep research on a topic
- advancedDeepResearch: Perform a deep research on a topic with a research plan

Maintain a professional, consultative tone throughout the conversation while being direct, insightful, and focused on providing decision support that a CEO would value.
`;

export function Chat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages: Array<Message>;
}) {
  const [mode, setMode] = useState<"flights" | "marketing" | "simpleResearch" | "advancedResearch" | "advisor">("advisor");
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

  const handleModeChange = (newMode: "flights" | "marketing" | "simpleResearch" | "advancedResearch" | "advisor") => {
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
        setSystemPrompt(RESEARCH_PROMPT.replace('TOOL_PLACEHOLDER', `- You use the advancedDeepResearch tool with maxSearches=${maxSearches}
        - You create a research plan with specific sub-questions that will comprehensively answer the user's query`));
        break;
      case "advisor":
        setSystemPrompt(ADVISOR_PROMPT);
        break;
    }
  };

  useEffect(() => {
    if (mode === "advancedResearch") {
      setSystemPrompt(RESEARCH_PROMPT.replace('TOOL_PLACEHOLDER', `- You use the advancedDeepResearch tool with maxSearches=${maxSearches}
      - You create a research plan with specific sub-questions that will comprehensively answer the user's query`));
    }
  }, [maxSearches, mode]);

  // Add the export function to convert chat to markdown
  const exportChatToMarkdown = () => {
    // Start with the system prompt
    let markdown = `# Chat Export\n\n## System Prompt\n\n\`\`\`\n${systemPrompt}\n\`\`\`\n\n## Conversation\n\n`;
    
    // Add each message
    messages.forEach(message => {
      const role = message.role === 'user' ? 'User' : 'LLM';
      markdown += `### ${role}:\n\n`;
      
      // Handle content (which could be string or array)
      if (typeof message.content === 'string') {
        markdown += `${message.content}\n\n`;
      } else if (Array.isArray(message.content)) {
        // Type assertion to fix "forEach on never" error
        (message.content as Array<{ type: string; text?: string; image_url?: { url: string } }>).forEach(item => {
          if (item.type === 'text') {
            markdown += `${item.text}\n\n`;
          } else if (item.type === 'image_url') {
            markdown += `![Image](${item.image_url?.url})\n\n`;
          }
        });
      }
      
      // Handle attachments
      if (message.experimental_attachments && message.experimental_attachments.length > 0) {
        markdown += `**Attachments:**\n\n`;
        message.experimental_attachments.forEach(attachment => {
          markdown += `- File: ${attachment.name}\n`;
        });
        markdown += `\n`;
      }
      
      // Handle tool invocations with proper typing
      if (message.toolInvocations && message.toolInvocations.length > 0) {
        markdown += `**Tool Invocations:**\n\n`;
        message.toolInvocations.forEach((tool: any) => {
          // Using type assertion to fix TypeScript errors
          markdown += `- Tool: ${tool.name || tool.id || "Unknown Tool"}\n`;
          if (tool.input !== undefined) {
            markdown += `  Input: \`\`\`json\n${JSON.stringify(tool.input, null, 2)}\n\`\`\`\n`;
          }
          if (tool.output) {
            markdown += `  Output: \`\`\`json\n${JSON.stringify(tool.output, null, 2)}\n\`\`\`\n`;
          }
        });
        markdown += `\n`;
      }
    });
    
    // Create and download the file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${id}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
              {/* Add export button */}
              {messages.length > 0 && (
                <button
                  onClick={exportChatToMarkdown}
                  className="pr-12 p-1 hover:bg-muted rounded-md transition-colors flex items-center gap-1 text-sm text-muted-foreground"
                  aria-label="Export chat"
                  title="Export chat to Markdown"
                >
                  <Download className="size-4" />
                  <span>Export chat to MD</span>
                </button>
              )}
              <Label
                htmlFor="prompt-mode"
                className="text-sm text-muted-foreground"
              >
                AI Mode
              </Label>
              <Select
                value={mode}
                onValueChange={(value: "flights" | "marketing" | "simpleResearch" | "advancedResearch" | "advisor") => 
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
                  <SelectItem value="advisor">Business Advisor</SelectItem>
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
