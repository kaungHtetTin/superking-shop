import { createContext, useContext } from 'react';

export const UserChromeContext = createContext(null);

export function useUserChrome() {
    return useContext(UserChromeContext);
}
