import { Button, Card, CardBody, CardFooter, CardHeader, Spacer, Spinner, Tooltip } from '@nextui-org/react';
import { MdClose, MdContentCopy } from 'react-icons/md';
import { writeText } from '@tauri-apps/api/clipboard';
import { appWindow } from '@tauri-apps/api/window';
import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

import {
    DEFAULT_SELECTION_AI_PROFILES,
    DEFAULT_TOOLBAR_EXPLAIN_PROMPT_LIST,
    DEFAULT_TOOLBAR_TRANSLATE_PROMPT_LIST,
    runSelectionAiAction,
} from '../../../../utils/selection_ai';
import { useConfig } from '../../../../hooks';
import detect from '../../../../utils/lang_detect';

export default function AiActionArea({ action }) {
    const { t } = useTranslation();
    const [profiles] = useConfig('selection_toolbar_ai_profiles', DEFAULT_SELECTION_AI_PROFILES);
    const [translateProfileId] = useConfig('selection_toolbar_translate_profile', 'siliconflow');
    const [explainProfileId] = useConfig('selection_toolbar_explain_profile', 'siliconflow');
    const [translatePromptList] = useConfig('toolbar_translate_promptList', DEFAULT_TOOLBAR_TRANSLATE_PROMPT_LIST);
    const [explainPromptList] = useConfig('toolbar_explain_promptList', DEFAULT_TOOLBAR_EXPLAIN_PROMPT_LIST);
    const [sourceLanguage] = useConfig('translate_source_language', 'auto');
    const [targetLanguage] = useConfig('translate_target_language', 'zh_cn');
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const title = action.action === 'translate' ? t('selection_toolbar.ai_translate') : t('selection_toolbar.explain');

    useEffect(() => {
        let active = true;
        async function run() {
            if (!action?.text || profiles === null || translatePromptList === null || explainPromptList === null) {
                return;
            }

            setResult('');
            setError('');
            setLoading(true);

            try {
                const detected = sourceLanguage === 'auto' ? await detect(action.text) : sourceLanguage;
                const profileId = action.action === 'translate' ? translateProfileId : explainProfileId;
                const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
                const promptList = action.action === 'translate' ? translatePromptList : explainPromptList;
                const value = await runSelectionAiAction({
                    profile,
                    promptList,
                    text: action.text,
                    from: sourceLanguage,
                    to: targetLanguage,
                    detect: detected,
                    setResult: (nextResult) => {
                        if (active) {
                            setResult(nextResult);
                        }
                    },
                });
                if (active) {
                    setResult(value);
                }
            } catch (e) {
                if (active) {
                    setError(e.toString());
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        run();
        return () => {
            active = false;
        };
    }, [
        action,
        profiles,
        translateProfileId,
        explainProfileId,
        translatePromptList,
        explainPromptList,
        sourceLanguage,
        targetLanguage,
    ]);

    return (
        <div className='h-full overflow-y-auto px-[8px] pb-[8px]'>
            <Card
                shadow='none'
                className='rounded-[10px] mt-[1px]'
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
                className='rounded-[10px]'
            >
                <CardBody className='p-[12px] min-h-[120px]'>
                    {loading && result === '' && (
                        <div className='h-[80px] flex items-center justify-center'>
                            <Spinner size='sm' />
                        </div>
                    )}
                    {result !== '' && (
                        <div className='prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap select-text'>
                            <ReactMarkdown>{result.replace(/_$/, '')}</ReactMarkdown>
                        </div>
                    )}
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
                <CardFooter className='px-[12px] py-[5px]'>
                    <Tooltip content={t('translate.copy')}>
                        <Button
                            isIconOnly
                            size='sm'
                            variant='light'
                            isDisabled={result === ''}
                            onPress={() => {
                                writeText(result.replace(/_$/, ''));
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
