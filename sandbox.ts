const blacklist = [
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "Worker",
    "importScripts",
    "indexedDB",
    "location",
    "navigator",
    "SharedWorker",
    "EventSource",
    "caches",
];

export default function sandboxCode(code: string): string {
    return `
        const blacklist = [${blacklist.map((x) => `"${x}"`).join(",")}];
        for (const item of blacklist) {
            try {
                Object.defineProperty(self, item, {value: undefined, writable: false});
            } catch {
                self[item] = undefined; 
            }
        }

        (function() {
            "use strict";
            ${code}
        })()
    `;
}
