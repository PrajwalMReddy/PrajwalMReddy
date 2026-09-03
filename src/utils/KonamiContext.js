import React, {createContext, useContext, useState} from 'react';

const KonamiContext = createContext();

export const KonamiProvider = ({children}) => {
    const [validKonamiCode, setValidKonamiCode] = useState(null);

    const generateNewKonamiCode = () => {
        const code = Math.random().toString(16).slice(2, 8).padStart(6, '0');
        setValidKonamiCode(code);
        return code;
    };

    return (
        <KonamiContext.Provider value={{validKonamiCode, generateNewKonamiCode}}>
            {children}
        </KonamiContext.Provider>
    );
};

export const useKonami = () => {
    const context = useContext(KonamiContext);
    if (!context) {
        throw new Error('useKonami must be used within KonamiProvider');
    }
    return context;
};
