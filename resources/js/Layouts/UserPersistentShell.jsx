import { useMemo } from 'react';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav from '@/Components/User/MobileBottomNav';
import { UserChromeContext } from '@/Layouts/UserChromeContext';

export default function UserPersistentShell({ active = false, children }) {
    const contextValue = useMemo(() => ({ persistent: active }), [active]);

    if (!active) {
        return children;
    }

    return (
        <UserChromeContext.Provider value={contextValue}>
            <Navbar persistentRoot />
            {children}
            <MobileBottomNav persistentRoot />
        </UserChromeContext.Provider>
    );
}
