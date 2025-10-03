# OpenAI API Proxy for Claude Code

Minimal proxy server that translates OpenAI SDK chat completion calls to the Claude Code CLI via stdin.
In case of structured responses, it tries to guide the claude to resturn json but can't say for sure. Useful
when building apps and need a dev endpoint to avoid burning money on api charges when you have already paid
for the claude subscription.

Currently supports claude code but can be extended for codex or gemini as well.

## How It Works

This proxy allows you to use the OpenAI SDK with your Claude Code subscription. It:
- Receives OpenAI-formatted requests at `/v1/chat/completions`
- Transforms messages into a prompt and pipes to `claude` CLI via stdin
- Returns responses in OpenAI SDK format

## Requirements

- Node.js 18+
- Claude Code CLI installed and authenticated (`claude` command available)

## Setup

```bash
npm install
npm start
```

Server runs on `http://localhost:3000` (configurable via `PORT` env var)

## Usage

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="any-string"  # Not validated, but required by SDK
)

response = client.chat.completions.create(
    model="claude-sonnet-4-5-20250929",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### JavaScript/TypeScript (OpenAI SDK)

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'any-string'
});

const response = await client.chat.completions.create({
  model: 'claude-sonnet-4-5-20250929',
  messages: [
    { role: 'user', content: 'Hello!' }
  ]
});

console.log(response.choices[0].message.content);
```

## Features

### System Messages

System messages are automatically wrapped in `<system>` tags:

```python
response = client.chat.completions.create(
    model="claude-sonnet-4-5-20250929",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ]
)
```

### JSON Schema Support

The proxy handles `response_format` with JSON schemas:

```python
response = client.chat.completions.create(
    model="claude-sonnet-4-5-20250929",
    messages=[{"role": "user", "content": "Extract info about John, age 30"}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "person",
            "schema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "age": {"type": "number"}
                },
                "required": ["name", "age"]
            }
        }
    }
)
```

## Testing

Run the test suite:

```bash
# In one terminal
npm start

# In another terminal
node test.js
```

## Limitations

- Token counts are estimated (4 characters ≈ 1 token)
- Only `client.chat.completions.create()` is supported
- Parameters like `temperature`, `top_p`, `top_k` are not passed to Claude CLI
- Streaming is not supported
- Each request spawns a new `claude` CLI process
