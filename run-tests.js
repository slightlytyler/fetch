#!/usr/bin/env node

const execa = require("execa");
const createServer = require("./test/server");

async function run() {
    const server = createServer();
    let exitCode;

    try {
        const result = await execa("rn-test", process.argv.slice(2), {
            preferLocal: true,
            stdio: ["ignore", "inherit", "inherit"],
        });
        exitCode = result.exitCode;
    } catch (error) {
        exitCode = error.exitCode;
    }

    await server.close();

    process.exit(exitCode);
}

run();
