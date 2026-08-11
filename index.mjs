import express from "express";
import fs from "fs";
import path from "path";
import {Server} from "socket.io";
import http from "http";

import Logger from "@hackthedev/terminal-logger"
import ArrayTools from "@hackthedev/arraytools"

export default class ExpressStarter {
    constructor() {
        this.version = 1
        this.debug = false
        this.dirname = process.cwd();
        this.app = express();
        this.express = express;
        this.http = http;

        process.stdin.resume();
        process.stdin.setEncoding("utf8");
    }

    registerErrorHandlers(){
        // Catch uncaught errors
        process.on("uncaughtException", function (err) {
            // Handle the error safely
            Logger.error("UNEXPECTED ERROR");
            Logger.error(err.message);
            Logger.error("Details: ");
            Logger.error(err.stack);
        });

        process.on("unhandledRejection", (reason) => {
            Logger.error("UNHANDLED PROMISE REJECTION");
            Logger.error(reason?.stack || reason);
        });
    }

    onProcessInput(callback){
        if(!callback || typeof callback !== "function") throw new Error("Callback function is required")

        process.stdin.on("data", function (text) {
            var data = text.trim();
            var args = data.split(" ");

            callback(args);
        });

    }

    setVersion(version) {
        if (!version) throw new Error("Version is required")
        this.version = version
    }

    startHttpServer(port, onStarted = null){
        Logger.info("Starting HTTP Server on port " + port);

        this.server = http.createServer(this.app);
        this.server.listen(port, async function () {
            Logger.success("Server is running on port " + port);
            if(onStarted) await onStarted();
        })
    }

    getStartupArgs() {
        return process.argv.slice(2);
    }

    async getLatestVersion(repo){
        if(!repo) throw new Error("Repo is required. Example: username/reponame")

        return new Promise(async (resolve, reject) => {
            var versionUrl = `https://raw.githubusercontent.com/${repo}/main/version`;
            const res = await fetch(versionUrl);
            if (res.status !== 200) return null;
            resolve((await res.text()).trim());
        });
    }

    generateId(length) {
        let result = '1';
        const characters = '0123456789';
        const charactersLength = characters.length;
        let counter = 0;
        while (counter < length - 1) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
            counter += 1;
        }
        return result;
    }

    registerTemplateMiddleware({
                                   getPlaceholders = null
                               } = {}) {
        const renderTemplate = async (template, req) => {
            let placeholders = [
                ["version", () => this.version],
                ["random", () => this.generateId(12)],
            ];

            if (getPlaceholders) {
                const customPlaceholders = await getPlaceholders(req);
                placeholders = [...placeholders, ...customPlaceholders];
            }

            for (const [name, callback] of placeholders) {
                let value = typeof callback === "function"
                    ? await callback()
                    : callback;

                template = template.replace(
                    new RegExp(`{{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*}}`, "g"),
                    String(value ?? "")
                );
            }

            return template;
        };

        this.app.use((req, res, next) => {
            const originalWrite = res.write.bind(res);
            const originalEnd = res.end.bind(res);

            let chunks = [];

            res.write = (chunk, encoding, callback) => {
                if (chunk) {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
                }

                if (callback) callback();

                return true;
            };

            res.end = async (chunk, encoding, callback) => {
                if (chunk) {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
                }

                const body = Buffer.concat(chunks);
                const contentType = res.getHeader("Content-Type")?.toString() ?? "";

                const shouldTemplate =
                    contentType.includes("text/") ||
                    contentType.includes("javascript") ||
                    contentType.includes("json") ||
                    contentType.includes("xml");

                if (shouldTemplate) {
                    const rendered = await renderTemplate(body.toString("utf8"), req);

                    res.removeHeader("Content-Length");

                    originalEnd(rendered, "utf8", callback);
                    return;
                }

                originalEnd(body, callback);
            };

            next();
        });
    }
}