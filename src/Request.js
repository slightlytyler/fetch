import Body from "./Body";
import Headers from "./Headers";

class Request {
    constructor(input, options = {}) {
        this.url = input;

        if (input instanceof Request) {
            if (input._body.bodyUsed) {
                throw new TypeError("Already read");
            }

            this.__handleRequestInput(input, options);
        }

        this._body = this._body ?? new Body(options.body)
        this.method = options.method ?? this.method ?? "GET";

        if (this._body._bodyInit && ["GET", "HEAD"].includes(this.method)) {
            throw new TypeError("Body not allowed for GET or HEAD requests");
        }

        if (this._body._bodyReadableStream) {
            throw new TypeError("Streaming request bodies is not supported");
        }

        this.credentials =
            options.credentials ?? this.credentials ?? "same-origin";
        this.headers = this.headers ?? new Headers(options.headers);
        this.signal = options.signal ?? this.signal;

        if (!this.headers.has('content-type') && this._body._mimeType) {
            this.headers.set('content-type', this._body._mimeType);
        }
    }

    __handleRequestInput(request, options) {
        this.url = request.url;
        this.credentials = request.credentials;
        this.method = request.method;
        this.signal = request.signal;
        this.headers = options.headers ?? new Headers(request.headers);

        if (!options.body && request._body._bodyInit) {
            this._body = new Body(request._body._bodyInit);
            request._body.bodyUsed = true;
        }
    }

    get bodyUsed() {
        return this._body.bodyUsed;
    }

    clone() {
        return new Request(this, { body: this._body._bodyInit });
    }

    blob() {
        return this._body.blob();
    }

    arrayBuffer() {
        return this._body.arrayBuffer();
    }

    text() {
        return this._body.text();
    }

    json() {
        return this._body.json();
    }

    formData() {
        return this._body.formData();
    }
}

export default Request;
