import { Button, Card, CardBody, CardFooter, CardHeader, Spacer, Spinner, Textarea, Tooltip } from '@nextui-org/react';
import { MdClose, MdContentCopy, MdSend } from 'react-icons/md';
import { writeText } from '@tauri-apps/api/clipboard';
import { appWindow } from '@tauri-apps/api/window';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

import {
    DEFAULT_SELECTION_AI_PROFILES,
    DEFAULT_TOOLBAR_EXPLAIN_PROMPT_LIST,
    DEFAULT_TOOLBAR_TRANSLATE_PROMPT_LIST,
    renderPromptList,
    runSelectionAiAction,
} from '../../../../utils/selection_ai';
import { useConfig } from '../../../../hooks';
import detect from '../../../../utils/lang_detect';

function cleanMessageContent(content) {
    return (content ?? '').replace(/_$/, '').trim();
}

function toApiMessages(messages) {
    return messages
        .map((message) => {
            return {
                role: message.role,
                content: cleanMessageContent(message.content),
            };
        })
        .filter((message) => message.content !== '');
}

export default function AiActionArea({ action }) {
    const { t } = useTranslation();
    const [profiles] = useConfig('selection_toolbar_ai_profiles', DEFAULT_SELECTION_AI_PROFILES);
    const [translateProfileId] = useConfig('selection_toolbar_translate_profile', 'siliconflow');
    const [explainProfileId] = useConfig('selection_toolbar_explain_profile', 'siliconflow');
    const [translatePromptList] = useConfig('toolbar_translate_promptList', DEFAULT_TOOLBAR_TRANSLATE_PROMPT_LIST);
    const [explainPromptList] = useConfig('toolbar_explain_promptList', DEFAULT_TOOLBAR_EXPLAIN_PROMPT_LIST);
    const [sourceLanguage] = useConfig('translate_source_language', 'auto');
    const [targetLanguage] = useConfig('translate_target_language', 'zh_cn');
    const [conversation, setConversation] = useState([]);
    const [followUp, setFollowUp] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const baseMessagesRef = useRef([]);
    const requestIdRef = useRef(0);
    const scrollRef = useRef(null);

    const title = action.action === 'translate' ? t('selection_toolbar.ai_translate') : t('selection_toolbar.explain');
    const activeProfileId = action.action === 'translate' ? translateProfileId : explainProfileId;
    const promptList = action.action === 'translate' ? translatePromptList : explainPromptList;
    const profile = useMemo(() => {
        if (profiles === null) {
            return null;
        }
        return profiles.find((item) => item.id === activeProfileId) ?? profiles[0];
    }, [profiles, activeProfileId]);
    const latestAssistantText = cleanMessageContent(
        [...conversation].reverse().find((message) => message.role === 'assistant')?.content ?? ''
    );

    const updateMessageContent = (index, content) => {
        setConversation((oldConversation) => {
            return oldConversation.map((message, messageIndex) => {
                if (messageIndex !== index) {
                    return message;
                }
                return {
                    ...message,
                    content,
                };
            });
        });
    };

    const runChatCompletion = async ({ apiMessages, assistantIndex }) => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setError('');
        setLoading(true);

        try {
            const value = await runSelectionAiAction({
                profile,
                messages: apiMessages,
                setResult: (nextResult) => {
                    if (requestIdRef.current === requestId) {
                        updateMessageContent(assistantIndex, nextResult);
                    }
                },
            });
            if (requestIdRef.current === requestId) {
                updateMessageContent(assistantIndex, value);
            }
        } catch (e) {
            if (requestIdRef.current === requestId) {
                setError(e.toString());
            }
        } finally {
            if (requestIdRef.current === requestId) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        let active = true;
        async function run() {
            if (!action?.text || profile === null || promptList === null) {
                return;
            }

            requestIdRef.current += 1;
            setConversation([]);
            setFollowUp('');
            setError('');

            try {
                const detected = sourceLanguage === 'auto' ? await detect(action.text) : sourceLanguage;
                const baseMessages = renderPromptList(promptList, {
                    text: action.text,
                    from: sourceLanguage,
                    to: targetLanguage,
                    detect: detected,
                });

                if (active) {
                    baseMessagesRef.current = baseMessages;
                    setConversation([{ role: 'assistant', content: '' }]);
                    runChatCompletion({
                        apiMessages: baseMessages,
                        assistantIndex: 0,
                    });
                }
            } catch (e) {
                if (active) {
                    setError(e.toString());
                }
            }
        }

        run();
        return () => {
            active = false;
            requestIdRef.current += 1;
        };
    }, [action, profile, promptList, sourceLanguage, targetLanguage]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [conversation, loading, error]);

    const sendFollowUp = () => {
        const question = followUp.trim();
        if (!question || loading) {
            return;
        }

        const nextConversation = [
            ...conversation,
            {
                role: 'user',
                content: question,
            },
            {
                role: 'assistant',
                content: '',
            },
        ];
        const assistantIndex = nextConversation.length - 1;
        setFollowUp('');
        setConversation(nextConversation);
        runChatCompletion({
            apiMessages: [...baseMessagesRef.current, ...toApiMessages(nextConversation.slice(0, assistantIndex))],
            assistantIndex,
        });
    };

    return (
        <div className='h-full flex flex-col overflow-hidden px-[8px] pb-[8px]'>
            <Card
                shadow='none'
                className='rounded-[8px] mt-[1px] shrink-0'
            >
                <CardHeader className='flex justify-between bg-content2 py-[6px] px-[12px]'>
                    <div className='font-bold text-[14px]'>{title}</div>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        onPress={() => {
                            appWindow.close();
                        }}
                    >
                        <MdClose className='text-[18px]' />
                    </Button>
                </CardHeader>
                <CardBody className='p-[12px]'>
                    <div className='text-default-500 text-[12px] mb-[6px]'>{t('selection_toolbar.selected_text')}</div>
                    <div className='whitespace-pre-wrap select-text'>{action.text}</div>
                </CardBody>
            </Card>
            <Spacer y={2} />
            <Card
                shadow='none'
                className='rounded-[8px] flex-1 min-h-0 flex flex-col'
            >
                <CardBody
                    ref={scrollRef}
                    className='p-[12px] min-h-[120px] overflow-y-auto flex-1'
                >
                    {conversation.map((message, index) => {
                        const content = cleanMessageContent(message.content);
                        const isUser = message.role === 'user';

                        return (
                            <div
                                key={`${message.role}-${index}`}
                                className={`mb-[10px] flex ${isUser ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[92%] rounded-[8px] px-[10px] py-[8px] text-[14px] ${
                                        isUser ? 'bg-primary text-primary-foreground' : 'bg-content2'
                                    }`}
                                >
                                    {content === '' && loading && index === conversation.length - 1 ? (
                                        <div className='h-[32px] min-w-[48px] flex items-center justify-center'>
                                            <Spinner size='sm' />
                                        </div>
                                    ) : isUser ? (
                                        <div className='whitespace-pre-wrap select-text'>{content}</div>
                                    ) : (
                                        <div className='prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap select-text'>
                                            <ReactMarkdown>{content}</ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {error !== '' &&
                        error.split('\n').map((line) => {
                            return (
                                <p
                                    key={line}
                                    className='text-red-500 text-[14px]'
                                >
                                    {line}
                                </p>
                            );
                        })}
                </CardBody>
                <CardFooter className='px-[12px] py-[8px] gap-[8px] border-t-1 border-default-100'>
                    <Textarea
                        size='sm'
                        minRows={1}
                        maxRows={3}
                        value={followUp}
                        onValueChange={setFollowUp}
                        placeholder={t('selection_toolbar.follow_up_placeholder')}
                        isDisabled={loading}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                sendFollowUp();
                            }
                        }}
                    />
                    <Tooltip content={t('selection_toolbar.send')}>
                        <Button
                            isIconOnly
                            size='sm'
                            variant='flat'
                            isDisabled={loading || followUp.trim() === ''}
                            onPress={sendFollowUp}
                        >
                            <MdSend className='text-[16px]' />
                        </Button>
                    </Tooltip>
                    <Tooltip content={t('translate.copy')}>
                        <Button
                            isIconOnly
                            size='sm'
                            variant='light'
                            isDisabled={latestAssistantText === ''}
                            onPress={() => {
                                writeText(latestAssistantText);
                            }}
                        >
                            <MdContentCopy className='text-[16px]' />
                        </Button>
                    </Tooltip>
                </CardFooter>
            </Card>
        </div>
    );
}
