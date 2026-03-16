'use client';

import { useEffect } from 'react';

/**
 * Removes browser extension attributes from the body tag
 * that cause hydration warnings in Next.js
 */
export default function RemoveExtensionAttrs() {
  useEffect(() => {
    // Remove Grammarly and other extension attributes
    const removeAttrs = () => {
      const body = document.body;
      if (body) {
        // Remove Grammarly attributes
        body.removeAttribute('data-new-gr-c-s-check-loaded');
        body.removeAttribute('data-gr-ext-installed');
      }
    };

    // Remove immediately on mount
    removeAttrs();

    // Also set up a mutation observer to remove them if they're added later
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.target === document.body) {
          const attrName = mutation.attributeName;
          if (attrName && (attrName.includes('gr-') || attrName.includes('grammarly'))) {
            removeAttrs();
          }
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-new-gr-c-s-check-loaded', 'data-gr-ext-installed'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}

