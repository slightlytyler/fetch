function createBlobReader(blob) {
    const reader = new FileReader();
    const fileReaderReady = new Promise((resolve, reject) => {
        reader.onload = function () {
            resolve(reader.result);
        };
        reader.onerror = function () {
            reject(reader.error);
        };
    });

    return {
        readAsArrayBuffer: () => {
            reader.readAsArrayBuffer(blob);
            return fileReaderReady;
        },
        readAsText: () => {
            reader.readAsText(blob);
            return fileReaderReady;
        },
    };
}

async function drainStream(stream) {
    const chunks = [];
    const reader = stream.getReader();

    function readNextChunk() {
        return reader.read().then(({ done, value }) => {
            if (done) {
                return chunks.reduce((byteArray, chunk) => [...byteArray, ...chunk], []);
            }

            chunks.push(value);

            return readNextChunk();
        });
    }

    const byteArray = await readNextChunk();

    return new Uint8Array(byteArray);
}

function readArrayAsText(array) {
    const decoder = new TextDecoder();

    return decoder.decode(array);
}

export {
    createBlobReader,
    drainStream,
    readArrayAsText
}
