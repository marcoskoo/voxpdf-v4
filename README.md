# VoxPDF v4

Lector de PDF con voz y GLM AI — 26 features

## Características

- 📄 Lectura de PDF, EPUB, DOCX, CBZ
- 🔊 TTS (Text-to-Speech) con ecualizador
- 🤖 GLM AI: traducción, resúmenes, glosario, mapa mental, flashcards Anki
- 🎙️ Control por voz
- ⏱️ Pomodoro & temporizador de sueño
- 📊 Heat map de lectura
- 📱 Modo e-ink y teleprompter
- ☁️ Cloud sync & sala grupal
- 🌙 Temas: dark, light, sepia, contrast, ocean, eink

## Deploy en Vercel

1. Fork o clone este repositorio
2. Importar en [vercel.com/new](https://vercel.com/new)
3. Configurar environment variables:
   - `ZAI_BASE_URL` - API base URL
   - `ZAI_API_KEY` - API key
   - `ZAI_CHAT_ID` - Chat ID
   - `ZAI_USER_ID` - User ID
   - `ZAI_TOKEN` - JWT Token

## Desarrollo local

```bash
npm install
npx prisma generate
npm run dev
```

## Tech Stack

- Next.js 16 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Zustand (state management)
- GLM AI (z-ai-web-dev-sdk)
- Prisma + SQLite
- pdf.js
