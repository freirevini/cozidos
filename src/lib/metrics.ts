
/**
 * Simple metrics logger for tracking query performance in development.
 * This is a no-op in production.
 */

const isDev = import.meta.env.DEV;

export const metrics = {
    /**
     * Log a query execution time and metadata
     * @param name - The name of the query (e.g., 'get_classification')
     * @param durationMs - Execution time in milliseconds
     * @param metadata - Optional extra data (e.g., filters applied)
     */
    logQuery: (name: string, durationMs: number, metadata?: Record<string, any>) => {
        if (!isDev) return;

        // Use a distinct style for metrics logs to stand out
        console.groupCollapsed(`📊 Metric: ${name} (${durationMs.toFixed(2)}ms)`);
        console.log('Duration:', durationMs, 'ms');
        if (metadata) {
            console.log('Metadata:', metadata);
        }
        console.groupEnd();
    },

    /**
     * Wrap an async function to automatically measure its duration
     * @param name - The name of the query
     * @param fn - The async function to execute
     * @param metadata - Optional extra data
     */
    track: async <T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> => {
        if (!isDev) return fn();

        const start = performance.now();
        try {
            const result = await fn();
            const end = performance.now();
            metrics.logQuery(name, end - start, metadata);
            return result;
        } catch (error) {
            const end = performance.now();
            metrics.logQuery(`${name} (ERROR)`, end - start, { ...metadata, error });
            throw error;
        }
    }
};
