import { Button } from '@nextui-org/react';
import { invoke } from '@tauri-apps/api';
import React, { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { MdContentCopy } from 'react-icons/md';
import { HiTranslate } from 'react-icons/hi';
import { TbMessageCircleQuestion } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';

function ToolbarButton({ tooltip, icon, action }) {
    return (
        <Button
            size='sm'
            radius='sm'
            variant='light'
            className='h-[30px] min-w-0 px-[8px] text-white data-[hover=true]:bg-white/10'
            startContent={icon}
            onPress={() => {
                invoke('selection_toolbar_action', { action }).catch(() => {});
            }}
        >
            {tooltip}
        </Button>
    );
}

export default function SelectionToolbar() {
    const { t } = useTranslation();
    const [text, setText] = useState('');

    useEffect(() => {
        invoke('get_selection_toolbar_text').then(setText);
        const unlisten = listen('selection_toolbar_text_changed', (event) => {
            setText(event.payload);
        });
        return () => {
            unlisten.then((f) => {
                f();
            });
        };
    }, []);

    return (
        <div className='h-screen w-screen overflow-hidden bg-transparent select-none'>
            <div className='h-full w-full rounded-[8px] border border-white/10 bg-[#1f1f1f] shadow-lg flex items-center px-[6px] gap-[2px]'>
                <div
                    className='h-[24px] w-[10px] shrink-0 cursor-grab opacity-50'
                    data-tauri-drag-region='true'
                >
                    <div className='h-full w-full bg-[radial-gradient(circle,#9ca3af_1px,transparent_1.5px)] [background-size:5px_5px]' />
                </div>
                <div className='h-[22px] w-px bg-white/10 mx-[2px]' />
                <ToolbarButton
                    tooltip={t('selection_toolbar.translate')}
                    action='translate'
                    icon={<HiTranslate className='text-[16px]' />}
                />
                <ToolbarButton
                    tooltip={t('selection_toolbar.explain')}
                    action='explain'
                    icon={<TbMessageCircleQuestion className='text-[16px]' />}
                />
                <ToolbarButton
                    tooltip={t('selection_toolbar.copy')}
                    action='copy'
                    icon={<MdContentCopy className='text-[16px]' />}
                />
                <span className='sr-only'>{text}</span>
            </div>
        </div>
    );
}
