import * as IPC from "@swordfern/ipc";
import sandboxCode from "./sandbox";

// Type Definitions
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
    childProcesses: number[];
}

export type ProcessMessageHandler = (
    id: string,
    message: any,
) => IPC.GenericMessage;

// Main
export default class ProcessManager {
    // processes
    private nextPID: number = 1;
    private processes = new Map<number, Process>();

    readonly list = (): number[] => {
        const processes = [...this.processes.values()];
        return processes.map((process) => process.pid);
    };

    readonly launch = (
        app: Application,
        messageHandler: ProcessMessageHandler,
        parentProcess?: Process,
    ): number | false => {
        const pid = this.nextPID++;
        let url: string = "";

        try {
            // get data
            const code = sandboxCode(app.code);

            // prepare
            const blob: Blob = new Blob([code]);
            url = URL.createObjectURL(blob);

            // create worker
            const worker = new Worker(url);
            const process: Process = {
                pid,
                identifier: app.identifier,
                url,
                worker,
                childProcesses: [],
            };

            // add handlers
            worker.addEventListener("message", (e) => {
                const msg = e.data;
                if (!msg.id) return;
                const reply: IPC.GenericMessage = messageHandler(msg.id, msg);
                this.send(pid, reply);
            });

            // set
            this.processes.set(pid, process);
            if (parentProcess && this.processes.has(parentProcess.pid)) {
                parentProcess.childProcesses.push(pid);
            }

            // return
            return pid;
        } catch (e) {
            if (url) URL.revokeObjectURL(url);
            console.error(`failed to launch ${app.identifier}`, e);
            return false;
        }
    };

    readonly send = (pid: number, message: any): boolean => {
        try {
            const process = this.processes.get(pid);
            if (!process) return false;
            process.worker.postMessage(message);
            return true;
        } catch (e) {
            console.error(`failed to send to ${pid}`, e);
            return false;
        }
    };

    readonly kill = (pid: number): boolean => {
        // get process
        const process: Process | undefined = this.processes.get(pid);

        // nothing to kill if no process
        if (!process) return true;

        try {
            // kill
            process.worker.terminate();
            URL.revokeObjectURL(process.url);
            this.processes.delete(pid);

            for (const childPID of process.childProcesses) {
                this.kill(childPID);
            }

            return true;
        } catch (e) {
            console.error(`failed to kill ${pid}`, e);
            return false;
        }
    };
}
