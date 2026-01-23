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
                                   publicWebDir = null,
                                   getExtensions = null,
                                   getPlaceholders = null
                               } = {}) {

        // set defaults
        if(!publicWebDir) publicWebDir = path.join(this.dirname, "public")
        if(!fs.existsSync(publicWebDir)) fs.mkdirSync(publicWebDir, {recursive: true});
        let templateExtensions = ['.html', '.js']

        const renderTemplate = async (template, req) => {
            let query = req.query;

            let placeholders = [
                ["version", () => this.version],
                ["random", () => this.generateId(12)],
            ];

            if (getPlaceholders) {
                let customPlaceholderArray = await getPlaceholders(req);
                placeholders = ArrayTools.merge(placeholders, customPlaceholderArray);
            }

            return template.replace(/{{\s*([^{}\s]+)\s*}}/g, (match, key) => {
                const found = placeholders.find(([name]) => name === key);
                return found ? found[1]() : '';
            });
        }


        this.app.use(async (req, res, next) => {
            let reqPath = req.path === '/' ? '/index.html' : req.path;
            const ext = path.extname(reqPath).toLowerCase();

            let extensions = [...templateExtensions];

            if (getExtensions) {
                let customExtensionsArray = await getExtensions(req);
                extensions = ArrayTools.merge(extensions, customExtensionsArray);
            }

            if (!extensions.includes(ext)) return next();

            const fullPath = path.join(publicWebDir, reqPath);

            fs.readFile(fullPath, 'utf8', async (err, content) => {
                if (err) return next();

                const rendered = await renderTemplate(content, req);
                const contentType = {
                    '.html': 'text/html',
                    '.js': 'application/javascript',
                }[ext] || 'text/plain';

                res.setHeader('Content-Type', contentType);
                res.send(rendered);
            });
        });
    }
}