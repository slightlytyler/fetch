import "react-native-polyfill-globals/auto";
import { test } from "zora";
import delay from "delay";
import { Headers, Request, Response, fetch } from "../";

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

function readArrayBufferAsText(array) {
    const decoder = new TextDecoder();

    return decoder.decode(array);
}

function createTypedArrayFromText(text) {
    const decoder = new TextEncoder();

    return decoder.encode(text);
}

async function drainStream(stream) {
    const chunks = [];
    const reader = stream.getReader();

    function readNextChunk() {
        return reader.read().then(({ done, value }) => {
            if (done) {
                return chunks.reduce(
                    (bytes, chunk) => [...bytes, ...chunk],
                    []
                );
            }

            chunks.push(value);

            return readNextChunk();
        });
    }

    const bytes = await readNextChunk();

    return new Uint8Array(bytes);
}

test("headers", (t) => {
    t.test("constructor copies headers", (t) => {
        const original = new Headers();
        original.append("Accept", "application/json");
        original.append("Accept", "text/plain");
        original.append("Content-Type", "text/html");

        const headers = new Headers(original);

        t.eq(headers.get("Accept"), "application/json, text/plain");
        t.eq(headers.get("Content-type"), "text/html");
    });

    t.test("constructor works with arrays", (t) => {
        const array = [
            ["Content-Type", "text/xml"],
            ["Breaking-Bad", "<3"],
        ];
        const headers = new Headers(array);

        t.eq(headers.get("Content-Type"), "text/xml");
        t.eq(headers.get("Breaking-Bad"), "<3");
    });

    t.test("headers are case insensitive", (t) => {
        const headers = new Headers({ Accept: "application/json" });

        t.eq(headers.get("ACCEPT"), "application/json");
        t.eq(headers.get("Accept"), "application/json");
        t.eq(headers.get("accept"), "application/json");
    });

    t.test("appends to existing", (t) => {
        const headers = new Headers({ Accept: "application/json" });
        t.notOk(headers.has("Content-Type"));

        headers.append("Content-Type", "application/json");
        t.ok(headers.has("Content-Type"));
        t.eq(headers.get("Content-Type"), "application/json");
    });

    t.test("appends values to existing header name", (t) => {
        const headers = new Headers({ Accept: "application/json" });
        headers.append("Accept", "text/plain");

        t.eq(headers.get("Accept"), "application/json, text/plain");
    });

    t.test("sets header name and value", (t) => {
        const headers = new Headers();
        headers.set("Content-Type", "application/json");

        t.eq(headers.get("Content-Type"), "application/json");
    });

    t.test("returns null on no header found", (t) => {
        const headers = new Headers();

        t.is(headers.get("Content-Type"), null);
    });

    t.test("has headers that are set", (t) => {
        const headers = new Headers();
        headers.set("Content-Type", "application/json");

        t.ok(headers.has("Content-Type"));
    });

    t.test("deletes headers", (t) => {
        const headers = new Headers();
        headers.set("Content-Type", "application/json");
        t.ok(headers.has("Content-Type"));

        headers.delete("Content-Type");
        t.notOk(headers.has("Content-Type"));
        t.is(headers.get("Content-Type"), null);
    });

    t.test("converts field name to string on set and get", (t) => {
        const headers = new Headers();
        headers.set(1, "application/json");

        t.ok(headers.has("1"));
        t.equal(headers.get(1), "application/json");
    });

    t.test("converts field value to string on set and get", (t) => {
        const headers = new Headers();
        headers.set("Content-Type", 1);
        headers.set("X-CSRF-Token", undefined);

        t.equal(headers.get("Content-Type"), "1");
        t.equal(headers.get("X-CSRF-Token"), "undefined");
    });

    t.test("throws TypeError on invalid character in field name", (t) => {
        t.throws(() => {
            new Headers({ "[Accept]": "application/json" });
        }, TypeError);
        t.throws(() => {
            new Headers({ "Accept:": "application/json" });
        }, TypeError);
        t.throws(() => {
            const headers = new Headers();
            headers.set({ field: "value" }, "application/json");
        }, TypeError);
        t.throws(() => {
            new Headers({ "": "application/json" });
        }, TypeError);
    });

    t.test("is iterable with forEach", (t) => {
        const headers = new Headers();
        headers.append("Accept", "application/json");
        headers.append("Accept", "text/plain");
        headers.append("Content-Type", "text/html");

        const results = [];
        headers.forEach((value, name, object) => {
            results.push({ value, name, object });
        });

        t.eq(results.length, 2);
        t.eq(
            {
                name: "accept",
                value: "application/json, text/plain",
                object: headers,
            },
            results[0]
        );
        t.eq(
            {
                name: "content-type",
                value: "text/html",
                object: headers,
            },
            results[1]
        );
    });

    t.test("forEach accepts second thisArg argument", (t) => {
        const headers = new Headers({ Accept: "application/json" });
        const thisArg = {};
        headers.forEach(function () {
            t.is(this, thisArg);
        }, thisArg);
    });

    t.test("is iterable with keys", (t) => {
        const headers = new Headers();
        headers.append("Accept", "application/json");
        headers.append("Accept", "text/plain");
        headers.append("Content-Type", "text/html");

        const iterator = headers.keys();
        t.eq({ done: false, value: "accept" }, iterator.next());
        t.eq({ done: false, value: "content-type" }, iterator.next());
        t.eq({ done: true, value: undefined }, iterator.next());
    });

    t.test("is iterable with values", (t) => {
        const headers = new Headers();
        headers.append("Accept", "application/json");
        headers.append("Accept", "text/plain");
        headers.append("Content-Type", "text/html");

        var iterator = headers.values();
        t.eq(
            { done: false, value: "application/json, text/plain" },
            iterator.next()
        );
        t.eq({ done: false, value: "text/html" }, iterator.next());
        t.eq({ done: true, value: undefined }, iterator.next());
    });

    t.test("is iterable with entries", (t) => {
        const headers = new Headers();
        headers.append("Accept", "application/json");
        headers.append("Accept", "text/plain");
        headers.append("Content-Type", "text/html");

        const iterator = headers.entries();
        t.eq(
            { done: false, value: ["accept", "application/json, text/plain"] },
            iterator.next()
        );
        t.eq(
            { done: false, value: ["content-type", "text/html"] },
            iterator.next()
        );
        t.eq({ done: true, value: undefined }, iterator.next());
    });

    t.test("headers is an iterator which returns entries iterator", (t) => {
        const headers = new Headers();
        headers.append("Accept", "application/json");
        headers.append("Accept", "text/plain");
        headers.append("Content-Type", "text/html");

        const iterator = headers[Symbol.iterator]();
        t.eq(
            { done: false, value: ["accept", "application/json, text/plain"] },
            iterator.next()
        );
        t.eq(
            { done: false, value: ["content-type", "text/html"] },
            iterator.next()
        );
        t.eq({ done: true, value: undefined }, iterator.next());
    });
});

test("request", (t) => {
    t.test("should throw when called without constructor", (t) => {
        t.throws(() => {
            Request("https://fetch.spec.whatwg.org/");
        });
    });

    t.test("construct with string url", (t) => {
        const req = new Request("https://fetch.spec.whatwg.org/");
        t.eq(req.url, "https://fetch.spec.whatwg.org/");
    });

    t.test("construct with URL instance", (t) => {
        const url = new URL("https://fetch.spec.whatwg.org/pathname");
        const req = new Request(url);
        t.eq(req.url.toString(), "https://fetch.spec.whatwg.org/pathname");
    });

    t.test("construct with non-request object", (t) => {
        const url = {
            toString: () => {
                return "https://fetch.spec.whatwg.org/";
            },
        };
        const req = new Request(url);
        t.eq(req.url.toString(), "https://fetch.spec.whatwg.org/");
    });

    t.test("construct with request", async (t) => {
        const request1 = new Request("https://fetch.spec.whatwg.org/", {
            method: "POST",
            body: "I work out",
            headers: {
                accept: "application/json",
                "Content-Type": "text/plain",
            },
        });
        const request2 = new Request(request1);

        const body2 = await request2.text();
        t.eq(body2, "I work out");
        t.eq(request2.method, "POST");
        t.eq(request2.url, "https://fetch.spec.whatwg.org/");
        t.eq(request2.headers.get("accept"), "application/json");
        t.eq(request2.headers.get("content-type"), "text/plain");

        try {
            await request1.text();
            t.ok(false, "original request body should have been consumed");
        } catch (error) {
            t.ok(
                error instanceof TypeError,
                "expected TypeError for already read body"
            );
        }
    });

    t.test("construct with request and override headers", (t) => {
        const request1 = new Request("https://fetch.spec.whatwg.org/", {
            method: "POST",
            body: "I work out",
            headers: {
                accept: "application/json",
                "X-Request-ID": "123",
            },
        });
        const request2 = new Request(request1, {
            headers: { "x-test": "42" },
        });

        t.eq(request2.headers.get("accept"), null);
        t.eq(request2.headers.get("x-request-id"), null);
        t.eq(request2.headers.get("x-test"), "42");
    });

    t.test("construct with request and override body", async (t) => {
        const request1 = new Request("https://fetch.spec.whatwg.org/", {
            method: "POST",
            body: "I work out",
            headers: {
                "Content-Type": "text/plain",
            },
        });
        const request2 = new Request(request1, {
            body: '{"wiggles": 5}',
            headers: { "Content-Type": "application/json" },
        });

        const body = await request2.json();

        t.eq(body.wiggles, 5);
        t.eq(request2.headers.get("content-type"), "application/json");
    });

    t.test("construct with used request body", async (t) => {
        const request1 = new Request("https://fetch.spec.whatwg.org/", {
            method: "post",
            body: "I work out",
        });

        await request1.text();

        t.throws(() => {
            new Request(request1);
        }, TypeError);
    });

    t.test("GET should not have implicit Content-Type", (t) => {
        const req = new Request("https://fetch.spec.whatwg.org/");

        t.eq(req.headers.get("content-type"), null);
    });

    t.test(
        "POST with blank body should not have implicit Content-Type",
        (t) => {
            const req = new Request("https://fetch.spec.whatwg.org/", {
                method: "POST",
            });
            t.eq(req.headers.get("content-type"), null);
        }
    );

    t.test("construct with string body sets Content-Type header", (t) => {
        const req = new Request("https://fetch.spec.whatwg.org/", {
            method: "POST",
            body: "I work out",
        });

        t.equal(req.headers.get("content-type"), "text/plain;charset=UTF-8");
    });

    t.test(
        "construct with Blob body and type sets Content-Type header",
        (t) => {
            const req = new Request("https://fetch.spec.whatwg.org/", {
                method: "POST",
                body: new Blob(["test"], { type: "image/png" }),
            });

            t.eq(req.headers.get("content-type"), "image/png");
        }
    );

    t.test("construct with body and explicit header uses header", (t) => {
        const req = new Request("https://fetch.spec.whatwg.org/", {
            method: "POST",
            headers: { "Content-Type": "image/png" },
            body: "I work out",
        });

        t.eq(req.headers.get("content-type"), "image/png");
    });

    t.test("construct with Blob body and explicit Content-Type header", (t) => {
        const req = new Request("https://fetch.spec.whatwg.org/", {
            method: "POST",
            headers: { "Content-Type": "image/png" },
            body: new Blob(["test"], { type: "text/plain" }),
        });

        t.eq(req.headers.get("content-type"), "image/png");
    });

    t.test(
        "construct with URLSearchParams body sets Content-Type header",
        (t) => {
            const req = new Request("https://fetch.spec.whatwg.org/", {
                method: "POST",
                body: new URLSearchParams("a=1&b=2"),
            });

            t.eq(
                req.headers.get("content-type"),
                "application/x-www-form-urlencoded;charset=UTF-8"
            );
        }
    );

    t.test(
        "construct with URLSearchParams body and explicit Content-Type header",
        (t) => {
            const req = new Request("https://fetch.spec.whatwg.org/", {
                method: "post",
                headers: { "Content-Type": "image/png" },
                body: new URLSearchParams("a=1&b=2"),
            });

            t.eq(req.headers.get("content-type"), "image/png");
        }
    );

    t.test("construct with unsupported body type", async (t) => {
        const req = new Request("https://fetch.spec.whatwg.org/", {
            method: "POST",
            body: {},
        });

        t.eq(req.headers.get("content-type"), "text/plain;charset=UTF-8");

        const body = await req.text();

        t.eq(body, "[object Object]");
    });

    t.test("construct with null body", async (t) => {
        const req = new Request("https://fetch.spec.whatwg.org/", {
            method: "POST",
        });

        t.is(req.headers.get("content-type"), null);

        const body = await req.text();

        t.eq(body, "");
    });

    t.test("clone GET request", (t) => {
        const req = new Request("https://fetch.spec.whatwg.org/", {
            headers: { "content-type": "text/plain" },
        });
        const clone = req.clone();

        t.eq(clone.url, req.url);
        t.eq(clone.method, "GET");
        t.eq(clone.headers.get("content-type"), "text/plain");
        t.isNot(clone.headers, req.headers);
        t.notOk(req.bodyUsed);
    });

    t.test("clone POST request", async (t) => {
        const req = new Request("https://fetch.spec.whatwg.org/", {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: "I work out",
        });
        const clone = req.clone();

        t.eq(clone.method, "POST");
        t.eq(clone.headers.get("content-type"), "text/plain");
        t.isNot(clone.headers, req.headers);
        t.notOk(req.bodyUsed);

        const bodies = await Promise.all([clone.text(), req.clone().text()]);

        t.eq(bodies, ["I work out", "I work out"]);
    });

    t.test("clone with used request body", async (t) => {
        const req = new Request("https://fetch.spec.whatwg.org/", {
            method: "POST",
            body: "I work out",
        });

        await req.text();

        t.throws(() => {
            req.clone();
        }, TypeError);
    });

    t.test("credentials defaults to same-origin", (t) => {
        const req = new Request("");

        t.eq(req.credentials, "same-origin");
    });

    t.test("credentials is overridable", (t) => {
        const req = new Request("", { credentials: "omit" });

        t.eq(req.credentials, "omit");
    });

    t.test("consume request body as text when input is text", async (t) => {
        const text = "Hello world!";
        const req = new Request("", { method: "POST", body: text });

        t.eq(await req.text(), text);
    });

    t.test("consume request body as Blob when input is text", async (t) => {
        const text = "Hello world!";
        const req = new Request("", { method: "POST", body: text });
        const blob = await req.blob();

        t.eq(await createBlobReader(blob).readAsText(), text);
    });

    // Test fails while React Native does not implement FileReader.readAsArrayBuffer
    t.skip(
        "consume request body as ArrayBuffer when input is text",
        async (t) => {
            const text = "Hello world!";
            const req = new Request("", { method: "POST", body: text });
            const arrayBuffer = await req.arrayBuffer();

            t.eq(readArrayBufferAsText(arrayBuffer), text);
        }
    );

    t.test(
        "consume request body as text when input is ArrayBuffer",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const req = new Request("", { method: "POST", body: array.buffer });

            t.eq(await req.text(), "Hello world!");
        }
    );

    t.test(
        "consume request body as text when input is ArrayBufferView",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const req = new Request("", { method: "POST", body: array });

            t.eq(await req.text(), "Hello world!");
        }
    );

    // React Native does not support Blob construction from ArrayBuffer or ArrayBufferView
    t.skip(
        "consume request body as Blob when input is ArrayBuffer",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const req = new Request("", { method: "POST", body: array.buffer });
            const blob = await req.blob();

            t.eq(await createBlobReader(blob).readAsText(), "Hello world!");
        }
    );

    // React Native does not support Blob construction from ArrayBuffer or ArrayBufferView
    t.skip(
        "consume request body as Blob when input is ArrayBufferView",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const req = new Request("", { method: "POST", body: array });
            const blob = await req.blob();

            t.eq(await createBlobReader(blob).readAsText(), "Hello world!");
        }
    );

    t.test(
        "consume request body as ArrayBuffer when input is ArrayBuffer",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const req = new Request("", { method: "POST", body: array });
            const text = new TextDecoder().decode(await req.arrayBuffer());

            t.eq(text, "Hello world!");
        }
    );

    t.test(
        "consume request body as ArrayBuffer when input is ArrayBufferView",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const req = new Request("", { method: "POST", body: array });
            const text = new TextDecoder().decode(await req.arrayBuffer());

            t.eq(text, "Hello world!");
        }
    );
});

test("response", (t) => {
    t.test("default status is 200", (t) => {
        const res = new Response();

        t.eq(res.status, 200);
        t.eq(res.statusText, "");
        t.ok(res.ok);
    });

    t.test(
        "default status is 200 when an explicit undefined status is passed",
        (t) => {
            const res = new Response("", { status: undefined });

            t.eq(res.status, 200);
            t.eq(res.statusText, "");
            t.ok(res.ok);
        }
    );

    t.test("should throw when called without constructor", (t) => {
        t.throws(() => {
            Response('{"foo":"bar"}', {
                headers: { "content-type": "application/json" },
            });
        });
    });

    t.test("creates headers object from raw headers", async (t) => {
        const res = new Response('{"foo":"bar"}', {
            headers: { "content-type": "application/json" },
        });
        const json = await res.json();

        t.ok(res.headers instanceof Headers);
        t.eq(json.foo, "bar");
    });

    t.test("always creates a new headers instance", (t) => {
        const headers = new Headers({ "x-hello": "world" });
        const res = new Response("", { headers });

        t.eq(res.headers.get("x-hello"), "world");
        t.isNot(res.headers, headers);
    });

    t.test("clone text response", async (t) => {
        const res = new Response('{"foo":"bar"}', {
            headers: { "content-type": "application/json" },
        });
        const clone = res.clone();

        t.isNot(clone.headers, res.headers, "headers were cloned");
        t.eq(clone.headers.get("content-type"), "application/json");

        const jsons = await Promise.all([clone.json(), res.json()]);
        t.eq(
            jsons[0],
            jsons[1],
            "json of cloned object is the same as original"
        );
    });

    t.test("error creates error Response", (t) => {
        const res = Response.error();

        t.ok(res instanceof Response);
        t.eq(res.status, 0);
        t.eq(res.statusText, "");
        t.eq(res.type, "error");
    });

    t.test("redirect creates redirect Response", (t) => {
        const res = Response.redirect("https://fetch.spec.whatwg.org/", 301);

        t.ok(res instanceof Response);
        t.eq(res.status, 301);
        t.eq(res.headers.get("Location"), "https://fetch.spec.whatwg.org/");
    });

    t.test("construct with string body sets Content-Type header", (t) => {
        const res = new Response("I work out");

        t.eq(res.headers.get("content-type"), "text/plain;charset=UTF-8");
    });

    t.test(
        "construct with Blob body and type sets Content-Type header",
        (t) => {
            const res = new Response(
                new Blob(["test"], { type: "text/plain" })
            );

            t.eq(res.headers.get("content-type"), "text/plain");
        }
    );

    t.test("construct with body and explicit header uses header", (t) => {
        const res = new Response("I work out", {
            headers: {
                "Content-Type": "text/plain",
            },
        });

        t.eq(res.headers.get("content-type"), "text/plain");
    });

    t.test("init object as first argument", async (t) => {
        const res = new Response({
            status: 201,
            headers: {
                "Content-Type": "text/html",
            },
        });

        t.eq(res.status, 200);
        t.eq(res.headers.get("content-type"), "text/plain;charset=UTF-8");

        const text = await res.text();

        t.eq(text, "[object Object]");
    });

    t.test("null as first argument", async (t) => {
        const res = new Response(null);

        t.is(res.headers.get("content-type"), null);

        const text = await res.text();

        t.eq(text, "");
    });

    t.test("consume response body as text when input is text", async (t) => {
        const text = "Hello world!";
        const req = new Response(text);

        t.eq(await req.text(), text);
    });

    t.test("consume response body as Blob when input is text", async (t) => {
        const text = "Hello world!";
        const res = new Response(text);
        const blob = await res.blob();

        t.eq(await createBlobReader(blob).readAsText(), text);
    });

    // Test fails while React Native does not implement FileReader.readAsArrayBuffer
    t.skip(
        "consume request body as ArrayBuffer when input is text",
        async (t) => {
            const text = "Hello world!";
            const res = new Response(text);
            const arrayBuffer = await res.arrayBuffer();

            t.eq(readArrayBufferAsText(arrayBuffer), text);
        }
    );

    t.test(
        "consume request body as text when input is ArrayBuffer",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const res = new Response(array.buffer);

            t.eq(await res.text(), "Hello world!");
        }
    );

    t.test(
        "consume request body as text when input is ArrayBufferView",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const res = new Response(array);

            t.eq(await res.text(), "Hello world!");
        }
    );

    // React Native does not support Blob construction from ArrayBuffer or ArrayBufferView
    t.skip(
        "consume request body as Blob when input is ArrayBuffer",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!").buffer;
            const res = new Response(array.buffer);
            const blob = await res.blob();

            t.eq(await createBlobReader(blob).readAsText(), "Hello world!");
        }
    );

    // React Native does not support Blob construction from ArrayBuffer or ArrayBufferView
    t.skip(
        "consume request body as Blob when input is ArrayBufferView",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const res = new Response("", { method: "POST", body: array });
            const blob = await res.blob();

            t.eq(await createBlobReader(blob).readAsText(), "Hello world!");
        }
    );

    t.test(
        "consume request body as ArrayBuffer when input is ArrayBuffer",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const res = new Response(array);
            const text = new TextDecoder().decode(await res.arrayBuffer());

            t.eq(text, "Hello world!");
        }
    );

    t.test(
        "consume request body as ArrayBuffer when input is ArrayBufferView",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const res = new Response(array);
            const text = new TextDecoder().decode(await res.arrayBuffer());

            t.eq(text, "Hello world!");
        }
    );

    t.test("consume request body as stream when input is stream", async (t) => {
        const rs = new ReadableStream({
            async pull(c) {
                await delay(100);
                c.enqueue(createTypedArrayFromText("Hello "));
                await delay(100);
                c.enqueue(createTypedArrayFromText("world"));
                await delay(100);
                c.enqueue(createTypedArrayFromText("!"));
                c.close();
            },
        });
        const res = new Response(rs);
        const text = new TextDecoder().decode(await drainStream(res.body));

        t.eq(text, "Hello world!");
    });

    t.test("consume request body as text when input is stream", async (t) => {
        const rs = new ReadableStream({
            async pull(c) {
                await delay(100);
                c.enqueue(createTypedArrayFromText("Hello "));
                await delay(100);
                c.enqueue(createTypedArrayFromText("world"));
                await delay(100);
                c.enqueue(createTypedArrayFromText("!"));
                c.close();
            },
        });
        const res = new Response(rs);
        const text = await res.text();

        t.eq(text, "Hello world!");
    });

    // React Native does not support Blob construction from ArrayBuffer or ArrayBufferView
    t.skip("consume request body as Blob when input is stream", async (t) => {
        const rs = new ReadableStream({
            async pull(c) {
                await delay(250);
                c.enqueue(createTypedArrayFromText("Hello "));
                await delay(250);
                c.enqueue(createTypedArrayFromText("world"));
                await delay(250);
                c.enqueue(createTypedArrayFromText("!"));
                c.close();
            },
        });
        const res = new Response(rs);
        const text = await res.text();

        t.eq(text, "Hello world!");
    });

    t.test(
        "consume request body as ArrayBuffer when input is stream",
        async (t) => {
            const rs = new ReadableStream({
                async pull(c) {
                    await delay(100);
                    c.enqueue(createTypedArrayFromText("Hello "));
                    await delay(100);
                    c.enqueue(createTypedArrayFromText("world"));
                    await delay(100);
                    c.enqueue(createTypedArrayFromText("!"));
                    c.close();
                },
            });
            const res = new Response(rs);
            const text = new TextDecoder().decode(await res.arrayBuffer());

            t.eq(text, "Hello world!");
        }
    );
});

test("body mixin", (t) => {
    const BASE_URL = "http://localhost:8082";

    // Test fails while React Native does not implement FileReader.readAsArrayBuffer
    t.skip("resolves arrayBuffer promise", async (t) => {
        const url = new URL("/hello", BASE_URL);
        const res = await fetch(url);
        const buf = await res.arrayBuffer();

        t.ok(buf instanceof ArrayBuffer, "buf is an ArrayBuffer instance");
        t.eq(buf.byteLength, 2);
    });

    // Test fails while React Native does not implement FileReader.readAsArrayBuffer
    t.skip("arrayBuffer handles binary data", async (t) => {
        const url = new URL("/binary", BASE_URL);
        const res = await fetch(url);
        const buf = await res.arrayBuffer();

        t.ok(buf instanceof ArrayBuffer, "buf is an ArrayBuffer instance");
        t.eq(buf.byteLength, 256, "buf.byteLength is correct");

        const expected = Array.from({ length: 256 }, (_, i) => i);
        const actual = Array.from(new Uint8Array(buf));

        t.eq(actual, expected);
    });

    // Test fails while React Native does not implement FileReader.readAsArrayBuffer
    t.skip("arrayBuffer handles utf-8 data", async (t) => {
        const url = new URL("/hello/utf8", BASE_URL);
        const res = await fetch(url);
        const buf = await res.arrayBuffer();

        t.ok(buf instanceof ArrayBuffer, "buf is an ArrayBuffer instance");
        t.eq(buf.byteLength, 5, "buf.byteLength is correct");

        const array = Array.from(new Uint8Array(buf));
        t.eq(array, [104, 101, 108, 108, 111]);
    });

    // Test fails while React Native does not implement FileReader.readAsArrayBuffer
    t.skip("arrayBuffer handles utf-16le data", async (t) => {
        const url = new URL("/hello/utf16le", BASE_URL);
        const res = await fetch(url);
        const buf = await res.arrayBuffer();

        t.ok(buf instanceof ArrayBuffer, "buf is an ArrayBuffer instance");
        t.eq(buf.byteLength, 10, "buf.byteLength is correct");

        const array = Array.from(new Uint8Array(buf));
        t.eq(array, [104, 0, 101, 0, 108, 0, 108, 0, 111, 0]);
    });

    t.test("native base64", (t) => {
        t.test("arrayBuffer handles binary data", async (t) => {
            const url = new URL("/binary", BASE_URL);
            const res = await fetch(url, { __nativeResponseType: "base64" });
            const buf = await res.arrayBuffer();

            t.ok(buf instanceof ArrayBuffer, "buf is an ArrayBuffer instance");
            t.eq(buf.byteLength, 256, "buf.byteLength is correct");

            const expected = Array.from({ length: 256 }, (_, i) => i);
            const actual = Array.from(new Uint8Array(buf));

            t.eq(actual, expected);
        });

        t.test("arrayBuffer handles binary data (native base64)", async (t) => {
            const url = new URL("/binary", BASE_URL);
            const res = await fetch(url, { __nativeResponseType: "base64" });
            const buf = await res.arrayBuffer();

            t.ok(buf instanceof ArrayBuffer, "buf is an ArrayBuffer instance");
            t.eq(buf.byteLength, 256, "buf.byteLength is correct");

            const expected = Array.from({ length: 256 }, (_, i) => i);
            const actual = Array.from(new Uint8Array(buf));

            t.eq(actual, expected);
        });

        t.test("arrayBuffer handles utf-8 data", async (t) => {
            const url = new URL("/hello/utf8", BASE_URL);
            const res = await fetch(url, { __nativeResponseType: "base64" });
            const buf = await res.arrayBuffer();

            t.ok(buf instanceof ArrayBuffer, "buf is an ArrayBuffer instance");
            t.eq(buf.byteLength, 5, "buf.byteLength is correct");

            const array = Array.from(new Uint8Array(buf));
            t.eq(array, [104, 101, 108, 108, 111]);
        });

        t.test("arrayBuffer handles utf-16le data", async (t) => {
            const url = new URL("/hello/utf16le", BASE_URL);
            const res = await fetch(url, { __nativeResponseType: "base64" });
            const buf = await res.arrayBuffer();

            t.ok(buf instanceof ArrayBuffer, "buf is an ArrayBuffer instance");
            t.eq(buf.byteLength, 10, "buf.byteLength is correct");

            const array = Array.from(new Uint8Array(buf));
            t.eq(array, [104, 0, 101, 0, 108, 0, 108, 0, 111, 0]);
        });
    });

    // Test fails while React Native does not implement FileReader.readAsArrayBuffer
    t.skip("rejects arrayBuffer promise after body is consumed", async (t) => {
        const url = new URL("/hello", BASE_URL);
        const res = await fetch(url);

        t.eq(res.bodyUsed, false);
        await res.blob();
        t.eq(res.bodyUsed, true);
        t.throws(
            () => res.arrayBuffer(),
            TypeError,
            "Promise rejected after body consumed"
        );
    });

    // Test fails while React Native does not implement FileReader.readAsArrayBuffer
    t.skip("resolves blob promise", async (t) => {
        const url = new URL("/hello", BASE_URL);
        const res = await fetch(url);
        const blob = await res.blob();

        t.ok(blob instanceof Blob, "blob is a Blob instance");
        t.eq(blob.size, 2);
    });
});
