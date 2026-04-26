export default class ProcessManager {
    // processes
    private nextPID: number = 1;
    private processes = new Map<number, Process>();

    readonly list = (): number[] => {
        const processes = [...Object.values(this.processes)];
        return processes.map(process => process.pid);
    }

    readonly launch = (app: Application, messageHandler: ProcessMessageHandler, errorHandler: ProcessErrorHandler): number | false => {
        const pid = this.nextPID++;

        try {
            // get data
            const code = app.code;

            // prepare
            const blob: Blob = new Blob([code]);
            const url: string = URL.createObjectURL(blob);

            // create worker
            const worker = new Worker(url);
            const process: Process = {
                pid,
                identifier: app.identifier,
                url,
                worker,
            }

            // add handlers
            worker.addEventListener("message", (e) => {
                messageHandler(pid, e.data);
            })
            worker.addEventListener("error", (e) => {
                errorHandler(pid, e);
            })

            // set
            this.processes.set(pid, process);

            // return
            return pid;
        } catch (e) {
            console.error(`failed to launch ${app.identifier}`, e);
            return false;
        }
    }

    readonly send = (pid: number, message: string): boolean => {
        try {
            const process = this.processes.get(pid);
            if (!process) return false;
            process.worker.postMessage(message);
            return true;
        } catch (e) {
            console.error(`failed to send to ${pid}`, e);
            return false;
        }
    }

    readonly kill = (pid: number): boolean => {
        // get process
        const process: Process | undefined = this.processes.get(pid);

        // nothing to kill if no process
        if (!process) return true;

        try { // kill
            process.worker.terminate();
            URL.revokeObjectURL(process.url);
            this.processes.delete(pid);

            return true;
        } catch (e) {
            console.error(`failed to kill ${pid}`, e);
            return false;
        }
    }
}

export type ApplicationIdentifier = string;

export interface Application {
    identifier: ApplicationIdentifier;
    code: string;
}

export interface Process {
    pid: number;
    identifier: ApplicationIdentifier;
    url: string;
    worker: Worker;
}

export type ProcessMessageHandler = (pid: number, message: string) => void;
export type ProcessErrorHandler = (pid: number, error: ErrorEvent) => void;