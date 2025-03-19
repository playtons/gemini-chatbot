<p align="center">
  An Open-Source AI Chatbot Template Built With Next.js and the AI SDK by Vercel.
</p>

## Running locally

1. git clone this repo
2. get .env from playtons
3. get [bun](https://bun.sh/)
3. run in cloned repo root
```bash
bun install
```
4. run in cloned repo root
```bash
bun run dev
```
5. look at [localhost:3000](http://localhost:3000/) for local website
6. change server LLM behavior (tool calling) at app\(chat)\api\chat\route.ts
7. change client chat behavior (prompts, UI) at components\custom\chat.tsx

## Deployment

Any commit to main branch will be auto-deployed (in case there are no build errors) to playton's [Vercel Instance](https://universal-wisdom.vercel.app/)
Commits to any other branches will not deploy to this instance.

## Features

- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://sdk.vercel.ai/docs)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Supports Google (default), OpenAI, Anthropic, Cohere, and other model providers
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Vercel Postgres powered by Neon](https://vercel.com/storage/postgres) for saving chat history and user data
  - [Vercel Blob](https://vercel.com/storage/blob) for efficient object storage
- [NextAuth.js](https://github.com/nextauthjs/next-auth)
  - Simple and secure authentication



