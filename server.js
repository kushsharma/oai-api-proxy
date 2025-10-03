import http from 'http';
import { spawn } from 'child_process';

const PORT = process.env.PORT || 3000;

function buildPrompt(messages, jsonSchema) {
  let prompt = '';

  // Add JSON schema instruction if present
  if (jsonSchema) {
    prompt += `You must respond with valid JSON matching this schema:\n\n${jsonSchema}\n\nRespond ONLY with the JSON, no other text. Not even json formatting back tick structure.\n\n`;
  }

  // Build conversation
  for (const msg of messages) {
    if (msg.role === 'system') {
      prompt += `<system>${msg.content}</system>\n\n`;
    } else if (msg.role === 'user') {
      prompt += `${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      prompt += `Assistant: ${msg.content}\n\n`;
    }
  }

  return prompt.trim();
}

function extractJsonSchema(responseFormat) {
  if (!responseFormat || responseFormat.type !== 'json_schema') {
    return null;
  }

  const schema = responseFormat.json_schema?.schema;
  if (!schema) return null;

  return JSON.stringify(schema, null, 2);
}

async function callClaudeCLI(prompt) {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });

    claude.on('error', (err) => {
      reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
    });

    // Write prompt to stdin
    claude.stdin.write(prompt);
    claude.stdin.end();
  });
}

function stripJsonCodeFence(content) {
  // Remove ```json ... ``` tags if present
  const trimmed = content.trim();
  const jsonFenceStart = /^```json\s*/;
  const jsonFenceEnd = /\s*```$/;

  if (jsonFenceStart.test(trimmed) && jsonFenceEnd.test(trimmed)) {
    return trimmed
      .replace(jsonFenceStart, '')
      .replace(jsonFenceEnd, '')
      .trim();
  }

  return content;
}

async function handleChatCompletion(body) {
  if (!body.messages || !Array.isArray(body.messages)) {
    throw new Error('Invalid request: messages must be an array');
  }

  const jsonSchema = extractJsonSchema(body.response_format);
  const prompt = buildPrompt(body.messages, jsonSchema);

  console.log('Sending to Claude CLI:\n', prompt);

  let content = await callClaudeCLI(prompt);

  // Strip JSON code fences if present
  content = stripJsonCodeFence(content);

  console.log('Received from Claude CLI:\n', content);

  // Estimate token counts (rough approximation: 4 chars ≈ 1 token)
  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = Math.ceil(content.length / 4);

  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: body.model || 'claude-sonnet-4-5-20250929',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: content
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    }
  };
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle chat completions
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const requestBody = JSON.parse(body);
        const response = await handleChatCompletion(requestBody);

        res.writeHead(200);
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error('Error:', error.message);

        const statusCode = error.message.includes('Invalid request') ? 400 : 500;
        res.writeHead(statusCode);
        res.end(JSON.stringify({
          error: {
            message: error.message,
            type: statusCode === 400 ? 'invalid_request_error' : 'server_error'
          }
        }));
      }
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({
      error: {
        message: 'Not found',
        type: 'invalid_request_error'
      }
    }));
  }
});

server.listen(PORT, () => {
  console.log(`OpenAI API proxy server running on http://localhost:${PORT}`);
  console.log(`Proxying to Claude CLI via stdin`);
  console.log(`\nConfigure your OpenAI client with:\n  base_url: http://localhost:${PORT}/v1\n  api_key: any-string`);
});
