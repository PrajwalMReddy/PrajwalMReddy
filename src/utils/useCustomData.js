import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

/**
 * Universal React hook for custom React components (used in Research / Blog pages)
 * to access their custom JSON data easily and reliably.
 *
 * It seamlessly supports:
 * 1. Props passed from parent post wrapper (`props.customData`, `props.data`, `props.post`)
 * 2. Standalone / direct rendering without props (automatically fetches data from CMS by slug/component)
 *
 * @example
 * const { data, post, loading, error } = useCustomData(props, {
 *   type: 'research',
 *   slug: 'bengaluru-telugu-dictionary',
 *   defaultData: []
 * });
 *
 * @param {Object} [props={}] - Component props
 * @param {Object} [options={}] - Configuration options
 * @param {('research'|'blog')} [options.type='research'] - Content collection type
 * @param {string} [options.slug] - Explicit slug override (falls back to props/useParams)
 * @param {any} [options.defaultData=null] - Default fallback value
 * @returns {{ data: any, post: Object|null, loading: boolean, error: string|null }}
 */
export const useCustomData = (props = {}, options = {}) => {
    const params = useParams();
    const explicitType = options.type || (props?.post?.type === 'custom' ? (props?.type || 'research') : 'research');
    const slug = options.slug || props?.post?.slug || props?.slug || params?.slug;

    // Check if data was directly provided via props
    const passedData = props?.customData ?? props?.data ?? props?.post?.customData ?? props?.post?.data;
    const hasPassedData = passedData !== undefined && passedData !== null;

    const [data, setData] = useState(() => (hasPassedData ? passedData : (options.defaultData ?? null)));
    const [post, setPost] = useState(() => props?.post || null);
    const [loading, setLoading] = useState(!hasPassedData);
    const [error, setError] = useState(null);

    useEffect(() => {
        // If data was passed via props, update state immediately without network requests
        if (hasPassedData) {
            setData(passedData);
            setPost(props?.post || null);
            setLoading(false);
            return;
        }

        // Otherwise, fetch from CMS content API as fallback
        let isMounted = true;

        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`/api/cms/content?type=${encodeURIComponent(explicitType)}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${explicitType} CMS content (status ${response.status})`);
                }

                const list = await response.json();
                const items = Array.isArray(list) ? list : (list?.[explicitType] || list?.items || []);

                // Match by slug or component name if provided
                const foundItem = items.find((item) => {
                    if (slug && item.slug?.toLowerCase() === slug.toLowerCase()) return true;
                    if (props?.componentName && item.component === props.componentName) return true;
                    return false;
                }) || items[0];

                if (!isMounted) return;

                if (foundItem) {
                    setPost(foundItem);
                    const itemData = foundItem.customData ?? foundItem.data ?? options.defaultData ?? null;
                    setData(itemData);
                } else {
                    setData(options.defaultData ?? null);
                }
            } catch (err) {
                if (!isMounted) return;
                console.error(`[useCustomData] Failed to load data for ${slug || explicitType}:`, err);
                setError(err.message);
                setData(options.defaultData ?? null);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [passedData, hasPassedData, explicitType, slug, props?.componentName]);

    return { data, post, loading, error };
};

export default useCustomData;
