import "react-native-polyfill-globals/auto";
import { test } from "zora";
import { Headers, Request } from "../";

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
        const request = new Request("https://fetch.spec.whatwg.org/");
        t.eq(request.url, "https://fetch.spec.whatwg.org/");
    });

    t.test("construct with URL instance", (t) => {
        var url = new URL("https://fetch.spec.whatwg.org/pathname");
        var request = new Request(url);
        t.eq(request.url.toString(), "https://fetch.spec.whatwg.org/pathname");
    });

    t.test("construct with non-request object", (t) => {
        const url = {
            toString: () => {
                return "https://fetch.spec.whatwg.org/";
            },
        };
        const request = new Request(url);
        t.eq(request.url.toString(), "https://fetch.spec.whatwg.org/");
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
        const request = new Request("");

        t.eq(request.credentials, "same-origin");
    });

    t.test("credentials is overridable", (t) => {
        const request = new Request("", { credentials: "omit" });

        t.eq(request.credentials, "omit");
    });

    t.test("consume request body as text when input is text", async (t) => {
        const text = "Hello world!";
        const request = new Request("", { method: "POST", body: text });

        t.eq(await request.text(), text);
    });

    t.test("consume request body as blob when input is text", async (t) => {
        const text = "Hello world!";
        const request = new Request("", { method: "POST", body: text });
        const blob = await request.blob();

        t.eq(await createBlobReader(blob).readAsText(), text);
    });

    // Tests fails while React Native does not implement FileReader.readAsArrayBuffer
    t.skip(
        "consume request body as arraybuffer when input is text",
        async (t) => {
            const text = "Hello world!";
            const request = new Request("", { method: "POST", body: text });
            const arrayBuffer = await request.arrayBuffer();

            t.eq(readArrayBufferAsText(arrayBuffer), text);
        }
    );

    t.test(
        "consume request body as text when input is array buffer",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!").buffer;
            const request = new Request("", { method: "POST", body: array });

            t.eq(await request.text(), "Hello world!");
        }
    );

    t.test(
        "consume request body as text when input is array view",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const request = new Request("", { method: "POST", body: array });

            t.eq(await request.text(), "Hello world!");
        }
    );

    // React Native does not support Blob construction with arrays
    t.skip(
        "consume request body as blob when input is array buffer",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!").buffer;
            const request = new Request("", { method: "POST", body: array });
            const blob = await request.blob();

            t.eq(await createBlobReader(blob).readAsText(), "Hello world!");
        }
    );

    // React Native does not support Blob construction with arrays
    t.skip(
        "consume request body as blob when input is array view",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const request = new Request("", { method: "POST", body: array });
            const blob = await request.blob();

            t.eq(await createBlobReader(blob).readAsText(), "Hello world!");
        }
    );

    t.test(
        "consume request body as array buffer when input is array buffer",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const request = new Request("", { method: "POST", body: array });
            const text = new TextDecoder().decode(await request.arrayBuffer());

            t.eq(text, "Hello world!");
        }
    );

    t.test(
        "consume request body as array buffer when input is array view",
        async (t) => {
            const array = createTypedArrayFromText("Hello world!");
            const request = new Request("", { method: "POST", body: array });
            const text = new TextDecoder().decode(await request.arrayBuffer());

            t.eq(text, "Hello world!");
        }
    );
});
