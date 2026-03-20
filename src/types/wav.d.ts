
declare module 'wav' {
    import { Writable } from 'stream';

    export interface WriterOptions {
        channels?: number;
        sampleRate?: number;
        bitDepth?: number;
    }

    export class Writer extends Writable {
        constructor(options?: WriterOptions);
    }

    const wav: {
        Writer: typeof Writer;
    };

    export default wav;
}
