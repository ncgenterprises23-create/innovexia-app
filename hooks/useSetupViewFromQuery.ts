'use client';

import { useEffect } from 'react';

export function useSetupViewFromQuery(setViewMode: (mode: any) => void) {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'setup') {
            setViewMode('setup');
        }
    }, [setViewMode]);
}
