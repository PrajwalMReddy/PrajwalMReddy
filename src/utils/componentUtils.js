// Shared utility functions for components

export const chunkArray = (arr, size) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
};

export const getImage = (imageName) => {
    if (!imageName) return null;
    if (typeof imageName === 'string') {
        const trimmed = imageName.trim();
        if (!trimmed) return null;
        if (
            trimmed.startsWith('/') ||
            trimmed.startsWith('http://') ||
            trimmed.startsWith('https://') ||
            trimmed.startsWith('data:')
        ) {
            return trimmed;
        }
        return `/${trimmed}`;
    }
    return null;
};

