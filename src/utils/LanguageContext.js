import {
    ContentProvider,
    useContent,
} from './ContentContext';

// Backwards compatibility re-exports
export const LanguageProvider = ContentProvider;
export const useLanguage = useContent;
export default useContent;
