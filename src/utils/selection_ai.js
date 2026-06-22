import { Body, fetch } from '@tauri-apps/api/http';

export const DEFAULT_SELECTION_AI_PROFILES = [
    {
        id: 'siliconflow',
        name: 'SiliconFlow',
        baseURL: 'https://api.siliconflow.com/v1',
        apiKey: '',
        model: 'deepseek-ai/DeepSeek-V3',
        stream: true,
        requestArguments: JSON.stringify(
            {
                temperature: 0.2,
                max_tokens: 2048,
            },
            null,
            2
        ),
    },
    {
        id: 'gemini',
        name: 'Gemini',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey: '',
        model: 'gemini-3.5-flash',
        stream: true,
        requestArguments: JSON.stringify(
            {
                temperature: 0.2,
                max_tokens: 2048,
            },
            null,
            2
        ),
    },
    {
        id: 'custom',
        name: 'Custom OpenAI-Compatible',
        baseURL: '',
        apiKey: '',
        model: '',
        stream: true,
        requestArguments: JSON.stringify(
            {
                temperature: 0.2,
                max_tokens: 2048,
            },
            null,
            2
        ),
    },
];

export const DEFAULT_TOOLBAR_TRANSLATE_PROMPT_LIST = [
    {
        role: 'system',
        content:
            'You are a professional translation engine. Translate the selected text accurately and naturally. Only output the translation.',
    },
    {
        role: 'user',
        content: 'Translate into $to:\n"""\n$text\n"""',
    },
];

export const DEFAULT_TOOLBAR_EXPLAIN_PROMPT_LIST = [
    {
        role: 'system',
        content:
            '你是一个简洁、准确的中文解释助手。解释用户划选的文本，说明含义、上下文、关键概念和可能的歧义。',
    },
    {
        role: 'user',
        content: '请解释下面这段文本：\n"""\n$text\n"""',
    },
];

function normalizeChatCompletionsUrl(baseURL) {
    let url = baseURL.trim();
    if (!url) {
        throw new Error('Base URL is empty');
    }
    if (!/^https?:\/\//.test(url)) {
        url = `https://${url}`;
    }
    url = url.replace(/\/+$/, '');
    if (!url.endsWith('/chat/completions')) {
        url = `${url}/chat/completions`;
    }
    return url;
}

function parseRequestArguments(value) {
    if (!value || !value.trim()) {
        return {};
    }
    try {
        return JSON.parse(value);
    } catch (error) {
        throw new Error(`Request Arguments is not valid JSON: ${error.message}`);
    }
}

export function renderPromptList(promptList, variables) {
    return promptList.map((item) => {
        return {
            ...item,
            content: item.content
                .replaceAll('$text', variables.text)
                .replaceAll('$from', variables.from)
                .replaceAll('$to', variables.to)
                .replaceAll('$detect', variables.detect),
        };
    });
}

function readStreamLine(data, setResult) {
    const value = data.trim();
    if (!value || value === '[DONE]') {
        return '';
    }

    const result = JSON.parse(value);
    return result.choices?.[0]?.delta?.content ?? '';
}

export async function runSelectionAiAction({ profile, promptList, text, from, to, detect, setResult }) {
    if (!profile) {
        throw new Error('Please select an AI profile first');
    }
    if (!profile.baseURL?.trim()) {
        throw new Error('Please configure Base URL first');
    }
    if (!profile.apiKey?.trim()) {
        throw new Error('Please configure API Key first');
    }
    if (!profile.model?.trim()) {
        throw new Error('Please configure Model first');
    }

    const body = {
        ...parseRequestArguments(profile.requestArguments),
        model: profile.model,
        stream: profile.stream,
        messages: renderPromptList(promptList, {
            text,
            from,
            to,
            detect,
        }),
    };
    const url = normalizeChatCompletionsUrl(profile.baseURL);
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profile.apiKey}`,
    };

    if (profile.stream) {
        const res = await window.fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            throw new Error(`Http Request Error\nHttp Status: ${res.status}\n${await res.text()}`);
        }

        let target = '';
        let buffer = '';
        const reader = res.body.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    setResult(target.trim());
                    return target.trim();
                }

                buffer += new TextDecoder().decode(value);
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data:')) {
                        continue;
                    }
                    const chunk = readStreamLine(line.slice(5), setResult);
                    if (chunk) {
                        target += chunk;
                        setResult(`${target}_`);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: Body.json(body),
    });
    if (!res.ok) {
        throw new Error(`Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`);
    }

    const result = res.data?.choices?.[0]?.message?.content;
    if (!result) {
        throw new Error(JSON.stringify(res.data));
    }
    setResult(result.trim());
    return result.trim();
}
