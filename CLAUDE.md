# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (install deps, generate Prisma client, run migrations)
npm run setup

# Development server (with Turbopack)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Run all tests
npm test

# Run a single test file
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx

# Reset the database
npm run db:reset

# Regenerate Prisma client after schema changes
npx prisma generate

# Run a new migration
npx prisma migrate dev
```

The app runs without an `ANTHROPIC_API_KEY` — it falls back to a `MockLanguageModel` that returns hardcoded components. Set `ANTHROPIC_API_KEY` in `.env` to use real Claude (model: `claude-haiku-4-5`).

`node-compat.cjs` is a required shim (loaded via `NODE_OPTIONS` in all scripts) that removes Node 25+ experimental `localStorage`/`sessionStorage` globals which break SSR. Do not remove it.

## Architecture

### Overview

UIGen is a Next.js 15 App Router app where users chat with Claude to generate React components that appear in a live preview — all without writing files to disk.

### Virtual File System

The core abstraction is `VirtualFileSystem` (`src/lib/file-system.ts`), an in-memory tree of `FileNode` objects. All generated code lives here, never on disk. The VFS is:
- **Serialized** to JSON and sent with every `/api/chat` request
- **Deserialized** from JSON when loading a saved project
- **Persisted** to the `Project.data` column (SQLite) on chat completion (authenticated users only)

### AI Tool Loop

The `/api/chat` route (`src/app/api/chat/route.ts`) uses Vercel AI SDK's `streamText` with two tools:
- `str_replace_editor` — creates files, replaces strings, inserts lines (mirrors Claude's native text editor tool)
- `file_manager` — renames and deletes files

The AI uses these tools to write/edit code inside the VirtualFileSystem. The client receives tool call events via the data stream, which `FileSystemContext.handleToolCall` applies to the client-side VFS instance.

### State Management (Contexts)

Two React contexts wrap the main UI:
- `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) — owns the VFS instance, exposes file operations and `handleToolCall` which dispatches AI tool calls into the VFS
- `ChatContext` (`src/lib/contexts/chat-context.tsx`) — wraps Vercel AI SDK's `useChat`, wires `onToolCall` to `FileSystemContext.handleToolCall`, and serializes the current VFS state into every chat request body

### Live Preview

`PreviewFrame` (`src/components/preview/PreviewFrame.tsx`) renders an `<iframe>` whose `srcdoc` is rebuilt whenever `refreshTrigger` changes. The pipeline:
1. `createImportMap` in `src/lib/transform/jsx-transformer.ts` transforms every `.jsx/.tsx` file with Babel standalone into blob URLs
2. Third-party imports (non-relative, non-`@/`) are auto-resolved via `https://esm.sh/`
3. Missing local imports get placeholder stub modules
4. `createPreviewHTML` generates the full HTML document with an importmap and a module script that renders `<App />` into `#root`
5. Tailwind CSS is injected via CDN (`cdn.tailwindcss.com`) into the preview iframe

### Auth

JWT-based auth (`src/lib/auth.ts`) using `jose`. Sessions are stored in an `httpOnly` cookie (`auth-token`, 7-day expiry). The middleware (`src/middleware.ts`) protects `/api/projects` and `/api/filesystem`. Anonymous users can use the app; their work is tracked in `localStorage` via `anon-work-tracker.ts` and can be saved after sign-up.

### Database

Prisma with SQLite (`prisma/dev.db`). Two models:
- `User` — email + bcrypt password
- `Project` — stores `messages` (JSON array) and `data` (serialized VFS JSON), optionally linked to a user

Prisma client is generated to `src/generated/prisma/` (non-standard output location).

### AI Generation Constraints

The system prompt (`src/lib/prompts/generation.tsx`) imposes rules the AI must follow when generating code into the VFS:
- Every project must have `/App.jsx` as the root entrypoint (created first)
- All local file imports must use the `@/` alias (e.g., `@/components/Button`)
- Styling via Tailwind CSS only — no hardcoded styles or HTML files

### Provider Fallback

`src/lib/provider.ts` exports `getLanguageModel()`. If `ANTHROPIC_API_KEY` is absent, it returns `MockLanguageModel`, a full `LanguageModelV1` implementation that emits hardcoded tool calls to create Counter/Form/Card components. The mock limits `maxSteps` to 4 to prevent repetition.
