import BlobManager from "react-native/Libraries/Blob/BlobManager";
import Response from "./Response";
import { createBlobReader } from "./utils";

class StreamBlobResponse {
    constructor(blobData, stream, streamController, options, blobArrayBuffer) {
        const blob = BlobManager.createFromOptions(blobData);
        this._blobData = blobData;
        this._blobResponse = new Response(blob, options);
        this._streamResponse = new Response(stream, options);

        if (blobArrayBuffer) {
            this._blobArrayBuffer = blobArrayBuffer;
            this._arrayBufferResponse = new Response(blobArrayBuffer, options);
            streamController.enqueue(new Uint8Array(blobArrayBuffer));

            return this;
        }

        return createBlobReader(blob)
            .readAsArrayBuffer()
            .then((arrayBuffer) => {
                this._blobArrayBuffer = arrayBuffer;
                this._arrayBufferResponse = new Response(arrayBuffer, options);
                streamController.enqueue(new Uint8Array(arrayBuffer));

                return this;
            });
    }

    get bodyUsed() {
        return (
            this._blobResponse.bodyUsed ||
            this._streamResponse.bodyUsed ||
            this._arrayBufferResponse.bodyUsed
        );
    }

    get type() {
        return this._blobResponse.type;
    }

    get status() {
        return this._blobResponse.status;
    }

    get ok() {
        return this._blobResponse.ok;
    }

    get statusText() {
        return this._blobResponse.statusText;
    }

    get headers() {
        return this._blobResponse.headers;
    }

    get url() {
        return this._blobResponse.url;
    }

    clone() {
        let controller;
        const stream = new ReadableStream({
            start(c) {
                controller = c;
            },
        });

        return new StreamBlobResponse(
            this._blobData,
            stream,
            controller,
            {
                status: this._blobResponse.status,
                statusText: this._blobResponse.statusText,
                headers: new Headers(this._blobResponse.headers),
                url: this._blobResponse.url,
            },
            this._arrayBufferResponse.slice(0)
        );
    }

    blob() {
        return this._blobResponse.blob();
    }

    arrayBuffer() {
        return this._arrayBufferResponse.arrayBuffer();
    }

    text() {
        return this._arrayBufferResponse.text();
    }

    json() {
        return this._arrayBufferResponse.json();
    }

    formData() {
        return this._arrayBufferResponse.formData();
    }

    get body() {
        return this._streamResponse.body;
    }
}

export default StreamBlobResponse;
