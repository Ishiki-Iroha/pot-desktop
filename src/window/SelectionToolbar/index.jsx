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
            className='h-[30px] min-w-0 px-[9px] gap-[5px] text-[13px] font-medium text-white data-[hover=true]:bg-white/10'
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
            <div className='h-full w-full rounded-[8px] border border-white/10 bg-[#1f1f1f] shadow-lg flex items-center justify-center px-[4px] gap-[1px]'>
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
