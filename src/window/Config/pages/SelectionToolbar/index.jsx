import {
    Button,
    Card,
    CardBody,
    CardHeader,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Input,
    Switch,
    Textarea,
} from '@nextui-org/react';
import { MdAdd, MdDeleteOutline } from 'react-icons/md';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
    DEFAULT_SELECTION_AI_PROFILES,
    DEFAULT_TOOLBAR_EXPLAIN_PROMPT_LIST,
    DEFAULT_TOOLBAR_TRANSLATE_PROMPT_LIST,
} from '../../../../utils/selection_ai';
import { useConfig } from '../../../../hooks/useConfig';

function selectedProfileName(profiles, id) {
    return profiles.find((item) => item.id === id)?.name ?? profiles[0]?.name ?? '';
}

function PromptListEditor({ title, promptList, setPromptList }) {
    const { t } = useTranslation();

    return (
        <Card className='mb-[10px]'>
            <CardHeader className='font-bold'>{title}</CardHeader>
            <CardBody>
                <p className='text-[12px] text-default-500 mb-[8px]'>{t('config.selection_toolbar.prompt_hint')}</p>
                {promptList.map((prompt, index) => {
                    return (
                        <div
                            key={`${prompt.role}-${index}`}
                            className='config-item'
                        >
                            <Textarea
                                label={prompt.role}
                                labelPlacement='outside'
                                variant='faded'
                                value={prompt.content}
                                onValueChange={(value) => {
                                    setPromptList(
                                        promptList.map((item, i) => {
                                            return i === index ? { ...item, content: value } : item;
                                        })
                                    );
                                }}
                            />
                            <Button
                                isIconOnly
                                color='danger'
                                className='my-auto mx-1'
                                variant='flat'
                                onPress={() => {
                                    setPromptList(promptList.filter((_, i) => i !== index));
                                }}
                            >
                                <MdDeleteOutline className='text-[18px]' />
                            </Button>
                        </div>
                    );
                })}
                <Button
                    fullWidth
                    startContent={<MdAdd className='text-[18px]' />}
                    onPress={() => {
                        setPromptList([
                            ...promptList,
                            {
                                role:
                                    promptList.length === 0
                                        ? 'system'
                                        : promptList.length % 2 === 0
                                          ? 'assistant'
                                          : 'user',
                                content: '',
                            },
                        ]);
                    }}
                >
                    {t('config.selection_toolbar.add_prompt')}
                </Button>
            </CardBody>
        </Card>
    );
}

export default function SelectionToolbarConfig() {
    const { t } = useTranslation();
    const [enable, setEnable] = useConfig('selection_toolbar_enable', true);
    const [profiles, setProfiles] = useConfig('selection_toolbar_ai_profiles', DEFAULT_SELECTION_AI_PROFILES);
    const [translateEngine, setTranslateEngine] = useConfig('selection_toolbar_translate_engine', 'default');
    const [translateProfile, setTranslateProfile] = useConfig('selection_toolbar_translate_profile', 'siliconflow');
    const [explainProfile, setExplainProfile] = useConfig('selection_toolbar_explain_profile', 'siliconflow');
    const [translatePromptList, setTranslatePromptList] = useConfig(
        'toolbar_translate_promptList',
        DEFAULT_TOOLBAR_TRANSLATE_PROMPT_LIST
    );
    const [explainPromptList, setExplainPromptList] = useConfig(
        'toolbar_explain_promptList',
        DEFAULT_TOOLBAR_EXPLAIN_PROMPT_LIST
    );

    const updateProfile = (id, patch) => {
        setProfiles(
            profiles.map((profile) => {
                return profile.id === id ? { ...profile, ...patch } : profile;
            })
        );
    };

    const removeProfile = (id) => {
        const nextProfiles = profiles.filter((profile) => profile.id !== id);
        setProfiles(nextProfiles);
        if (translateProfile === id && nextProfiles[0]) {
            setTranslateProfile(nextProfiles[0].id);
        }
        if (explainProfile === id && nextProfiles[0]) {
            setExplainProfile(nextProfiles[0].id);
        }
    };

    return (
        enable !== null &&
        profiles !== null &&
        translateEngine !== null &&
        translateProfile !== null &&
        explainProfile !== null &&
        translatePromptList !== null &&
        explainPromptList !== null && (
            <>
                <Card className='mb-[10px]'>
                    <CardBody>
                        <div className='config-item'>
                            <h3 className='my-auto mx-0'>{t('config.selection_toolbar.enable')}</h3>
                            <Switch
                                isSelected={enable}
                                onValueChange={setEnable}
                            />
                        </div>
                        <div className='config-item'>
                            <h3 className='my-auto mx-0'>{t('config.selection_toolbar.translate_engine')}</h3>
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button variant='bordered'>
                                        {t(`config.selection_toolbar.${translateEngine}`)}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label='selection toolbar translate engine'
                                    onAction={setTranslateEngine}
                                >
                                    <DropdownItem key='default'>{t('config.selection_toolbar.default')}</DropdownItem>
                                    <DropdownItem key='ai'>{t('config.selection_toolbar.ai')}</DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        </div>
                        <div className={`config-item ${translateEngine !== 'ai' && 'hidden'}`}>
                            <h3 className='my-auto mx-0'>{t('config.selection_toolbar.translate_profile')}</h3>
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button variant='bordered'>{selectedProfileName(profiles, translateProfile)}</Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label='selection toolbar translate profile'
                                    onAction={setTranslateProfile}
                                >
                                    {profiles.map((profile) => {
                                        return <DropdownItem key={profile.id}>{profile.name}</DropdownItem>;
                                    })}
                                </DropdownMenu>
                            </Dropdown>
                        </div>
                        <div className='config-item'>
                            <h3 className='my-auto mx-0'>{t('config.selection_toolbar.explain_profile')}</h3>
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button variant='bordered'>{selectedProfileName(profiles, explainProfile)}</Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label='selection toolbar explain profile'
                                    onAction={setExplainProfile}
                                >
                                    {profiles.map((profile) => {
                                        return <DropdownItem key={profile.id}>{profile.name}</DropdownItem>;
                                    })}
                                </DropdownMenu>
                            </Dropdown>
                        </div>
                    </CardBody>
                </Card>
                <Card className='mb-[10px]'>
                    <CardHeader className='font-bold'>{t('config.selection_toolbar.profiles')}</CardHeader>
                    <CardBody>
                        {profiles.map((profile) => {
                            return (
                                <Card
                                    key={profile.id}
                                    shadow='none'
                                    className='mb-[10px] bg-content2'
                                >
                                    <CardBody>
                                        <div className='config-item'>
                                            <Input
                                                label={t('config.selection_toolbar.profile_name')}
                                                labelPlacement='outside-left'
                                                value={profile.name}
                                                variant='bordered'
                                                classNames={{
                                                    base: 'justify-between',
                                                    mainWrapper: 'max-w-[50%]',
                                                }}
                                                onValueChange={(value) => {
                                                    updateProfile(profile.id, { name: value });
                                                }}
                                            />
                                        </div>
                                        <div className='config-item'>
                                            <Input
                                                label={t('config.selection_toolbar.base_url')}
                                                labelPlacement='outside-left'
                                                value={profile.baseURL}
                                                variant='bordered'
                                                classNames={{
                                                    base: 'justify-between',
                                                    mainWrapper: 'max-w-[50%]',
                                                }}
                                                onValueChange={(value) => {
                                                    updateProfile(profile.id, { baseURL: value });
                                                }}
                                            />
                                        </div>
                                        <div className='config-item'>
                                            <Input
                                                label={t('config.selection_toolbar.api_key')}
                                                labelPlacement='outside-left'
                                                type='password'
                                                value={profile.apiKey}
                                                variant='bordered'
                                                classNames={{
                                                    base: 'justify-between',
                                                    mainWrapper: 'max-w-[50%]',
                                                }}
                                                onValueChange={(value) => {
                                                    updateProfile(profile.id, { apiKey: value });
                                                }}
                                            />
                                        </div>
                                        <div className='config-item'>
                                            <Input
                                                label={t('config.selection_toolbar.model')}
                                                labelPlacement='outside-left'
                                                value={profile.model}
                                                variant='bordered'
                                                classNames={{
                                                    base: 'justify-between',
                                                    mainWrapper: 'max-w-[50%]',
                                                }}
                                                onValueChange={(value) => {
                                                    updateProfile(profile.id, { model: value });
                                                }}
                                            />
                                        </div>
                                        <div className='config-item'>
                                            <h3 className='my-auto mx-0'>{t('config.selection_toolbar.stream')}</h3>
                                            <Switch
                                                isSelected={profile.stream}
                                                onValueChange={(value) => {
                                                    updateProfile(profile.id, { stream: value });
                                                }}
                                            />
                                        </div>
                                        <div className='config-item'>
                                            <Textarea
                                                label={t('config.selection_toolbar.request_arguments')}
                                                labelPlacement='outside'
                                                variant='faded'
                                                value={profile.requestArguments}
                                                onValueChange={(value) => {
                                                    updateProfile(profile.id, { requestArguments: value });
                                                }}
                                            />
                                        </div>
                                        <Button
                                            color='danger'
                                            variant='flat'
                                            isDisabled={profiles.length <= 1}
                                            startContent={<MdDeleteOutline className='text-[18px]' />}
                                            onPress={() => {
                                                removeProfile(profile.id);
                                            }}
                                        >
                                            {t('config.selection_toolbar.delete_profile')}
                                        </Button>
                                    </CardBody>
                                </Card>
                            );
                        })}
                        <Button
                            fullWidth
                            startContent={<MdAdd className='text-[18px]' />}
                            onPress={() => {
                                const id = `custom_${Date.now()}`;
                                setProfiles([
                                    ...profiles,
                                    {
                                        ...DEFAULT_SELECTION_AI_PROFILES[2],
                                        id,
                                        name: 'Custom OpenAI-Compatible',
                                    },
                                ]);
                            }}
                        >
                            {t('config.selection_toolbar.add_profile')}
                        </Button>
                    </CardBody>
                </Card>
                <PromptListEditor
                    title={t('config.selection_toolbar.translate_prompt')}
                    promptList={translatePromptList}
                    setPromptList={setTranslatePromptList}
                />
                <PromptListEditor
                    title={t('config.selection_toolbar.explain_prompt')}
                    promptList={explainPromptList}
                    setPromptList={setExplainPromptList}
                />
            </>
        )
    );
}
