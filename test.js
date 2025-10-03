async function testProxy() {
  const baseUrl = 'http://localhost:3000/v1';

  console.log('Testing OpenAI API Proxy...\n');

  // Test 1: Basic chat completion
  console.log('Test 1: Basic chat completion');
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        messages: [
          { role: 'user', content: 'Say "Hello, World!" and nothing else.' }
        ],
        max_tokens: 100
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('✓ Response:', data.choices[0].message.content);
    console.log('✓ Usage:', data.usage);
    console.log('✓ Basic test passed\n');
  } catch (error) {
    console.error('✗ Basic test failed:', error.message);
    console.error();
  }

  // Test 2: JSON schema response
  console.log('Test 2: JSON schema response format');
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        messages: [
          { role: 'user', content: 'Extract: John is 30 years old' }
        ],
        max_tokens: 200,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'person',
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' }
              },
              required: ['name', 'age']
            }
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    console.log('✓ Response:', content);

    // Validate JSON
    const parsed = JSON.parse(content);
    console.log('✓ Parsed JSON:', parsed);

    if (parsed.name && typeof parsed.age === 'number') {
      console.log('✓ JSON schema test passed\n');
    } else {
      console.log('✗ JSON schema validation failed\n');
    }
  } catch (error) {
    console.error('✗ JSON schema test failed:', error.message);
    console.error();
  }

  // Test 3: System message
  console.log('Test 3: System message handling');
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that responds in exactly 3 words.' },
          { role: 'user', content: 'How are you?' }
        ],
        max_tokens: 100
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('✓ Response:', data.choices[0].message.content);
    console.log('✓ System message test passed\n');
  } catch (error) {
    console.error('✗ System message test failed:', error.message);
    console.error();
  }

  console.log('All tests completed!');
}

testProxy().catch(console.error);
