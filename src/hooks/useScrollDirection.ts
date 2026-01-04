import { useState, useEffect, useRef } from 'react';

interface UseScrollDirectionOptions {
    threshold?: number; // Minimum scroll distance before triggering
    initialVisible?: boolean;
}

export function useScrollDirection(options: UseScrollDirectionOptions = {}) {
    const { threshold = 10, initialVisible = true } = options;
    const [isVisible, setIsVisible] = useState(initialVisible);
    const lastScrollY = useRef(0);
    const ticking = useRef(false);

    useEffect(() => {
        const updateScrollDirection = () => {
            const scrollY = window.scrollY;
            const scrollDifference = scrollY - lastScrollY.current;

            // Only update if scroll difference is greater than threshold
            if (Math.abs(scrollDifference) < threshold) {
                ticking.current = false;
                return;
            }

            // At top of page, always show
            if (scrollY < 50) {
                setIsVisible(true);
            }
            // Scrolling down - hide
            else if (scrollDifference > 0) {
                setIsVisible(false);
            }
            // Scrolling up - show
            else {
                setIsVisible(true);
            }

            lastScrollY.current = scrollY > 0 ? scrollY : 0;
            ticking.current = false;
        };

        const onScroll = () => {
            if (!ticking.current) {
                window.requestAnimationFrame(updateScrollDirection);
                ticking.current = true;
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', onScroll);
        };
    }, [threshold]);

    return isVisible;
}
