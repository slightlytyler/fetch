#!/usr/bin/env node

const execa = require("execa");
const createServer = require("./test/server");

async function run() {
    createServer();

    try {
        const result = await execa("rn-test", process.argv.slice(2), {
            preferLocal: true,
            stdio: ["ignore", "inherit", "inherit"],
        });
        process.exit(result.exitCode);
    } catch (error) {
        process.exit(error.exitCode);
    }
}

run();
