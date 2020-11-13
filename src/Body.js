import { createBlobReader, drainStream, readArrayAsText } from "./utils";

class Body {
    constructor(body) {
        this.bodyUsed = false;
        this._bodyInit = body;

        if (!body) {
            this._bodyText = "";
            return this;
        }

        if (body instanceof Blob) {
            this._bodyBlob = body;
            this._mimeType = body.type;
            return this;
        }

        if (body instanceof FormData) {
            this._bodyFormData = body;
            this._mimeType = "multipart/form-data";
            return this;
        }

        if (body instanceof URLSearchParams) {
            this._bodyText = body.toString();
            this._mimeType = "application/x-www-form-urlencoded;charset=UTF-8";
            return this;
        }

        if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
            this._bodyArrayBuffer = body.slice(0);
            this._mimeType = "application/octet-stream";
            return this;
        }

        if (body instanceof ReadableStream) {
            this._bodyReadableStream = body;
            this._mimeType = "application/octet-stream";
            return this;
        }

        this._bodyText = body.toString();
        this._mimeType = "text/plain;charset=UTF-8";
    }

    __consumed() {
        if (this.bodyUsed) {
            return Promise.reject(new Error("Already read"));
        }
        this.bodyUsed = true;
    }

    async blob() {
        const alreadyConsumed = this.__consumed();
        if (alreadyConsumed) {
            return alreadyConsumed;
        }

        if (this._bodyBlob) {
            return this._bodyBlob;
        }

        if (this._bodyReadableStream) {
            const typedArray = await drainStream(this._bodyReadableStream);

            // Currently not supported by React Native. Should we throw?
            return new Blob([typedArray]);
        }

        if (this._bodyArrayBuffer) {
            // Currently not supported by React Native. Should we throw?
            return new Blob([this._bodyArrayBuffer]);
        }

        if (this._bodyFormData) {
            throw new Error("Could not read FormData body as blob");
        }

        return new Blob([this._bodyText]);
    }

    async arrayBuffer() {
        const alreadyConsumed = this.__consumed();
        if (alreadyConsumed) {
            return alreadyConsumed;
        }

        if (this._bodyReadableStream) {
            const typedArray = await drainStream(this._bodyReadableStream);

            return typedArray.buffer;
        }

        if (this._bodyArrayBuffer) {
            if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
                const {
                    buffer,
                    byteOffset,
                    byteLength,
                } = this._bodyArrayBuffer;

                return Promise.resolve(
                    buffer.slice(byteOffset, byteOffset + byteLength)
                );
            }

            return Promise.resolve(this._bodyArrayBuffer);
        }

        const blob = await this.blob();
        return createBlobReader(blob).readAsArrayBuffer();
    }

    async text() {
        const alreadyConsumed = this.__consumed();
        if (alreadyConsumed) {
            return alreadyConsumed;
        }

        if (this._bodyReadableStream) {
            const typedArray = await drainStream(this._bodyReadableStream);

            return readArrayAsText(typedArray);
        }

        if (this._bodyBlob) {
            return createBlobReader(this._bodyBlob).readAsText();
        }

        if (this._bodyArrayBuffer) {
            return readArrayAsText(this._bodyArrayBuffer);
        }

        if (this._bodyFormData) {
            throw new Error("Could not read FormData body as text");
        }

        return this._bodyText;
    }

    async json() {
        const text = await this.text();

        return JSON.parse(text);
    }

    async formData() {
        const text = await this.text();
        const formData = new FormData();

        text.trim()
            .split("&")
            .forEach((pairs) => {
                if (!pairs) {
                    return;
                }

                const split = pairs.split("=");
                const name = split.shift().replace(/\+/g, " ");
                const value = split.join("=").replace(/\+/g, " ");
                formData.append(
                    decodeURIComponent(name),
                    decodeURIComponent(value)
                );
            });

        return formData;
    }

    get body() {
        // For Request objects, a streaming body is not supported.
        // It's not possible to upload a stream to a server in React Native.
        return this._bodyReadableStream;
    }
}

export default Body;
