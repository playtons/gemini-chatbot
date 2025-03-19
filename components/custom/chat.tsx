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
import { prompts } from "@/lib/prompts";

export function Chat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages: Array<Message>;
}) {
  const [mode, setMode] = useState<"flights" | "marketing" | "simpleResearch" | "advancedResearch" | "advisor">("advisor");
  const [systemPrompt, setSystemPrompt] = useState(prompts.advisor);
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
        setSystemPrompt(prompts.flights);
        break;
      case "marketing":
        setSystemPrompt(prompts.marketing);
        break;
      case "simpleResearch":
        setSystemPrompt(prompts.getSimpleResearch());
        break;
      case "advancedResearch":
        setSystemPrompt(prompts.getAdvancedResearch(maxSearches));
        break;
      case "advisor":
        setSystemPrompt(prompts.advisor);
        break;
    }
  };

  useEffect(() => {
    if (mode === "advancedResearch") {
      setSystemPrompt(prompts.getAdvancedResearch(maxSearches));
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
