import {useEffect, useRef} from 'react';
import {useNavigate} from 'react-router-dom';

const KonamiListener = () => {
    const position = useRef(0);
    const navigate = useNavigate();

    useEffect(() => {
        const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

        function onKeyDown(e) {
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            if (e.key === konami[position.current]) {
                position.current++;
                if (position.current === konami.length) {
                    navigate('/konami');
                    position.current = 0;
                }
            } else {
                position.current = (e.key === konami[0]) ? 1 : 0;
            }
        }

        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [navigate]);

    return null;
};

export default KonamiListener;
