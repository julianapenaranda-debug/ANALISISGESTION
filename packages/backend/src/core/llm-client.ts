/**
 * LLM Client — Módulo compartido para llamadas a LLM
 *
 * Extrae las funciones callOpenAI, callAnthropic, callGemini de story-generator.ts
 * y expone una función unificada callLLM que selecciona el provider según LLM_PROVIDER.
 *
 * Requerimientos: 3.1, 3.3
 */

import https from 'https';

/**
 * Llama a la API de OpenAI
 */
export function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'gpt-4';
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString(),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'OpenAI API error'));
            return;
          }
          resolve(parsed.choices?.[0]?.message?.content || '');
        } catch { reject(new Error('Failed to parse OpenAI response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}


/**
 * Llama a la API de Anthropic
 */
export function callAnthropic(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'claude-sonnet-4-20250514';
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString(),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'Anthropic API error'));
            return;
          }
          const text = parsed.content?.[0]?.text || '';
          resolve(text);
        } catch { reject(new Error('Failed to parse Anthropic response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Llama a la API de Google Gemini
 */
export function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'gemini-2.0-flash';
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 4000 },
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString(),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'Gemini API error'));
            return;
          }
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(text);
        } catch { reject(new Error('Failed to parse Gemini response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Función unificada que selecciona el provider LLM según la variable de entorno LLM_PROVIDER.
 * Providers soportados: 'openai' (default), 'anthropic', 'gemini'.
 */
export async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = process.env.LLM_PROVIDER || 'openai';

  if (provider === 'anthropic') {
    return callAnthropic(systemPrompt, userPrompt);
  } else if (provider === 'gemini') {
    return callGemini(systemPrompt, userPrompt);
  } else {
    return callOpenAI(systemPrompt, userPrompt);
  }
}
