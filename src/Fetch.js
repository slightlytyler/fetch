import { Networking } from "react-native";
import BlobManager from 'react-native/Libraries/Blob/BlobManager';
import { toByteArray } from 'base64-js';
import pDefer from 'p-defer';
import Request from "./Request";
import Response from "./Response";
import { createBlobReader } from './utils';

class AbortError extends Error {
    constructor() {
        super("Aborted");
        this.name = "AbortError";
        Error?.captureStackTrace(this, this.constructor);
    }
}

function createStream(cancel) {
    let streamController;

    const stream = new ReadableStream({
        start(controller) {
            streamController = controller;
        },
        cancel() {
            cancel();
        },
    });

    return {
        stream,
        streamController,
    };
}

class Fetch {
    _nativeNetworkSubscriptions = new Set();
    _nativeResponseType = 'blob';
    _nativeRequestHeaders = {};
    _nativeResponse;
    _textEncoder = new TextEncoder();
    _responseTextOffset = 0;
    _requestId;
    _response;
    _streamController;
    _deferredPromise;

    constructor(resource, options = {}) {
        this._request = new Request(resource, options);
        this._abortFn = this.__abort.bind(this);
        this._deferredPromise = pDefer();

        for (const [name, value] of this._request.headers.entries()) {
            this._nativeRequestHeaders[name] = value;
        }

        if (this._request.signal?.aborted) {
            throw new AbortError();
        }

        this.__doFetch();

        return this._deferredPromise.promise;
    }

    __subscribeToNetworkEvents() {
        [
            "didReceiveNetworkResponse",
            "didReceiveNetworkData",
            "didReceiveNetworkIncrementalData",
            "didReceiveNetworkDataProgress",
            "didCompleteNetworkResponse",
        ].forEach((eventName) => {
            const subscription = Networking.addListener(eventName, (args) => {
                this[`__${eventName}`](...args);
            });
            this._nativeNetworkSubscriptions.add(subscription);
        });
    }

    __clearNetworkSubscriptions() {
        this._nativeNetworkSubscriptions.forEach((subscription) =>
            subscription.remove()
        );
        this._nativeNetworkSubscriptions.clear();
    }

    __abort() {
        Networking.abortRequest(this._requestId);
        this.__clearNetworkSubscriptions();
        this._readableStreamController.error(new AbortError());
        this._deferredPromise.reject(new AbortError());
    }

    __doFetch() {
        this.__subscribeToNetworkEvents();
        this._request.signal?.addEventListener("abort", this._abortFn);

        Networking.sendRequest(
            this._request.method,
            this._request.url.toString(), // request tracking name
            this._request.url.toString(),
            this._nativeRequestHeaders,
            this._request._body._bodyInit ?? null,
            this._nativeResponseType,
            this._nativeResponseType === 'text', // send incremental events only when response type is text
            0, // requests shall not time out
            this.__didCreateRequest.bind(this),
            ["include", "same-origin"].includes(this._request.credentials) // with credentials
        );
    }

    __didCreateRequest(requestId) {
        console.log('fetch __didCreateRequest', { requestId });
        this._requestId = requestId;
    }

    __didReceiveNetworkResponse(requestId, status, headers, url) {
        console.log('fetch __didReceiveNetworkResponse', { requestId, status, headers, url });
        if (requestId !== this._requestId) {
            return;
        }

        const { stream, streamController } = createStream(() => {
            this.__clearNetworkSubscriptions();
            Networking.abortRequest(this._requestId);
        });

        this._streamController = streamController;
        this._response = new Response(stream, { status, headers, url });
        this._deferredPromise.resolve(this._response);
    }

    __didReceiveNetworkData(requestId, response) {
        console.log('fetch __didReceiveNetworkData', { requestId, response });
        if (requestId !== this._requestId) {
            return;
        }

        this._nativeResponse = response;
    }

    __didReceiveNetworkIncrementalData(
        requestId,
        responseText,
        progress,
        total
    ) {
        console.log('fetch __didReceiveNetworkIncrementalData', { requestId, responseText, progress, total });
        if (requestId !== this._requestId) {
            return;
        }

        const newText = responseText.substring(this._responseTextOffset);
        const typedArray = this._textEncoder.encode(newText, { stream: true });

        this._responseTextOffset = responseText.length;
        this._streamController.enqueue(typedArray);
    }

    __didReceiveNetworkDataProgress(requestId, loaded, total) {
        console.log('fetch __didReceiveNetworkDataProgress', { requestId, loaded, total });
        if (requestId !== this._requestId) {
            return;
        }
    }

    __didCompleteNetworkResponse(requestId, errorMessage, didTimeOut) {
        console.log('fetch __didCompleteNetworkResponse', { requestId, errorMessage, didTimeOut });
        if (requestId !== this._requestId) {
            return;
        }

        this.__clearNetworkSubscriptions();
        this._request.signal?.removeEventListener("abort", this._abortFn);

        if (didTimeOut) {
            return this._deferredPromise.reject(
                new Error("Network request timed out")
            );
        }

        if (errorMessage) {
            return this._deferredPromise.reject(
                new Error(`Network request failed: ${errorMessage}`)
            );
        }

        const enqueueSingleChunk = async () => {
            if (this._nativeResponseType === 'base64') {
                this._streamController.enqueue(toByteArray(this._nativeResponse));
            }

            if (this._nativeResponseType === 'blob') {
                const blob = BlobManager.createFromOptions(this._nativeResponse);
                const arrayBuffer = await createBlobReader(blob).readAsArrayBuffer();

                this._streamController.enqueue(new Uint8Array(arrayBuffer));
            }

            this._streamController.close();
        }

        if (this._nativeResponse) {
            enqueueSingleChunk();
            return;
        }

        this._streamController?.close();
    }
}

export default Fetch;
